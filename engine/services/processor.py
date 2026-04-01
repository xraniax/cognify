"""
Subject document processor: fetches documents by subject_id from DB,
preprocesses (or uses existing chunks), and returns a JSON-like structure.
"""
import os
import time
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

#to connect to the database
from sqlalchemy.orm import Session
from sqlalchemy import text

from .preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document
from .embeddings import embed_step

logger = logging.getLogger("engine-processor")

# DB integration: engine root on PYTHONPATH (Docker WORKDIR /app) or package import from services.*
try:
    import database
    import models

    SessionLocal = database.SessionLocal
    Document = models.Document
    logger.info("Imported database and models from engine root.")
except ImportError:
    try:
        from ..database import SessionLocal
        from ..models import Document

        logger.info("Imported database and models via services package (parent package).")
    except ImportError as e3:
        logger.error("Database/models import failed: %s", e3)
        SessionLocal = None  # type: ignore[misc, assignment]
        Document = None  # type: ignore[misc, assignment]


def get_db() -> Optional[Session]:
    """Create a database session. Caller must close it."""
    if SessionLocal is None:
        return None
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


def get_subject_documents(subject_id: UUID, db: Optional[Session] = None) -> List[Any]:
    """
    Return all documents for the given subject_id (UUID, same as subjects.id in Postgres).
    If db is provided, use it; otherwise open and close a session.
    """
    if Document is None:
        return []
    own_session = db is None
    session = db if db is not None else get_db()
    if session is None:
        return []
    try:
        return list(session.query(Document).filter(Document.subject_id == subject_id).all())
    finally:
        if own_session and session is not None:
            try:
                session.close()
            except Exception:
                pass


def _get_existing_chunks(db: Session, document_id: int) -> List[Dict[str, Any]]:
    """Return rows for chunks with content+embedding from DB."""
    if db is None:
        return []
    try:
        result = db.execute(
            text("SELECT id, content, embedding FROM chunks WHERE document_id = :doc_id ORDER BY id"),
            {"doc_id": document_id},
        )
        rows = result.fetchall()
        return [
            {
                "id": row[0],
                "content": row[1] or "",
                "embedding": row[2],
            }
            for row in rows
        ]
    except Exception as e:
        logger.warning("Failed to read existing chunks for document %s: %s", document_id, e)
        return []


def _document_already_processed(db: Session, document_id: int) -> bool:
    """Return True if the document has at least one chunk in the DB."""
    if db is None:
        return False
    try:
        result = db.execute(
            text("SELECT 1 FROM chunks WHERE document_id = :doc_id LIMIT 1"),
            {"doc_id": document_id},
        )
        return result.fetchone() is not None
    except Exception:
        return False


def _update_chunk_embedding(db: Session, chunk_id: int, embedding: Optional[List[float]]) -> None:
    """Update a single chunk embedding in DB."""
    if db is None or chunk_id is None:
        return
    try:
        db.execute(
            text("UPDATE chunks SET embedding = :embedding WHERE id = :chunk_id"),
            {"embedding": embedding, "chunk_id": chunk_id},
        )
        db.commit()
    except Exception as e:
        logger.warning("Failed to update embedding for chunk %s: %s", chunk_id, e)



def _persist_new_chunks(db: Session, document_id: int, chunks: List[str], embeddings: List[Optional[List[float]]]) -> None:
    """Insert chunk rows (with optional embeddings) for a document."""
    if db is None or document_id is None:
        return

    try:
        from ..models import Chunk
    except ImportError:
        try:
            from models import Chunk
        except ImportError:
            import sys
            import os
            sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from models import Chunk
    except Exception as e:
        logger.error("Failed to import Chunk model: %s", e)
        raise

    try:
        for content, embedding in zip(chunks, embeddings):
            # PostgreSQL does not support NUL (0x00) characters in string literals
            cleaned_content = (content or "").replace('\x00', '')
            chunk_obj = Chunk(document_id=document_id, content=cleaned_content, embedding=embedding)
            db.add(chunk_obj)
        db.commit()
    except Exception as e:
        logger.error("CRITICAL: Failed to create chunk rows for document %s: %s", document_id, e)
        db.rollback()
        raise


def _build_document_result(
    doc: Optional[Any], # Made optional
    subject_id: UUID,
    file_path: str,
    uploads_dir: str,
    db: Session,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
    job_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    For one document: load from file (preprocess) or from DB chunks; return chunks with metadata.
    Ensures Document record exists BEFORE chunking.
    """
    if db is None:
        raise ValueError("[PIPELINE] Database session is required but was None")

    doc_id = getattr(doc, "id", None) if doc else None
    filename = (getattr(doc, "filename", "") if doc else "") or os.path.basename(file_path)
    result: Dict[str, Any] = {
        "document_id": doc_id,
        "subject_id": subject_id,
        "filename": filename,
        "processed": False,
        "from_cache": False,
        "chunks": [],
        "error": None,
    }

    # --- 1. PERSIST Document if not already in DB ---
    # This MUST happen before chunking to satisfy the [PIPELINE] requirement
    if doc_id is None:
        try:
            from models import Document as DocModel
            # Check if a document with this filename already exists for this subject to avoid duplicates
            existing_doc = db.query(DocModel).filter(
                DocModel.subject_id == subject_id,
                DocModel.filename == filename
            ).first()

            if existing_doc:
                doc_id = existing_doc.id
                logger.info(f"[PIPELINE] Document record already exists with ID: {doc_id}")
            else:
                doc = DocModel(
                    subject_id=subject_id,
                    filename=filename,
                    file_path=file_path
                )
                db.add(doc)
                db.commit() # Hard commit to ensure ID is generated and visible
                doc_id = doc.id
                logger.info(f"[PIPELINE] Document saved with ID: {doc_id}")
            
            result["document_id"] = doc_id
        except Exception as e:
            logger.error(f"[PIPELINE] Failed to save document record: {e}")
            db.rollback()
            raise

    # --- 2. Check if already processed (has chunks) ---
    if doc_id is not None and _document_already_processed(db, doc_id):
        existing = _get_existing_chunks(db, doc_id)
        if existing:
            logger.info(f"[PIPELINE] Found {len(existing)} existing chunks for doc_id {doc_id}")
            # add missing embeddings if needed
            missing_indices = [i for i, c in enumerate(existing) if not c.get("embedding")]
            if missing_indices:
                texts = [existing[i]["content"] for i in missing_indices]
                new_embeddings = embed_step(texts, job_id=job_id)
                for i, new_emb in zip(missing_indices, new_embeddings):
                    existing[i]["embedding"] = new_emb
                    _update_chunk_embedding(db, existing[i]["id"], new_emb)

            result["from_cache"] = True
            result["processed"] = True
            result["chunks"] = [
                {
                    "index": i,
                    "content": row.get("content", ""),
                    "embedding": row.get("embedding"),
                    "metadata": {
                        "document_id": doc_id,
                        "subject_id": subject_id,
                        "filename": filename,
                        "chunk_index": i,
                        "from_db": True,
                    },
                }
                for i, row in enumerate(existing)
            ]
            return result

    # --- 3. PIPELINE START: Preprocess ---
    logger.info(f"[PIPELINE] Starting processing for file: {file_path}")
    if not os.path.isfile(file_path):
        msg = f"[PIPELINE] File not found: {file_path}"
        logger.error(msg)
        raise FileNotFoundError(msg)

    # Preprocess (Extract text + chunking)
    try:
        preprocessed = preprocess_document(
            file_path,
            max_chunk_chars=max_chunk_chars,
            chunk_overlap=chunk_overlap,
            job_id=job_id,
        )
    except Exception as e:
        logger.error(f"[PIPELINE] Text extraction failed for {filename}: {e}")
        raise

    text = preprocessed.get("cleaned_text", "").strip()
    if not text:
        logger.error(f"[PIPELINE] Extracted text is empty for {filename}")
        raise ValueError(f"Extracted text is empty for {filename}")

    logger.info(f"[PIPELINE] Text extracted successfully (len: {len(text)})")

    chunks_raw = preprocessed.get("chunks", [])
    if not chunks_raw:
        logger.error(f"[PIPELINE] No chunks generated for {filename}")
        raise ValueError(f"No chunks generated for {filename}")

    logger.info(f"[PIPELINE] Chunks created: {len(chunks_raw)}")

    # --- 4. EMBED ---
    start_time = time.time()
    try:
        embeddings = embed_step(chunks_raw, job_id=job_id)
        if not embeddings or all(e is None for e in embeddings):
             raise ValueError("All embedding attempts returned None")
        logger.info(f"[PIPELINE] Embeddings generated: {len(embeddings)}")
    except Exception as err:
        logger.error(f"[PIPELINE] Embedding generation failed for {filename}: {err}")
        raise
    
    elapsed = time.time() - start_time
    logger.info(f"[PIPELINE] Embedding generation took {elapsed:.2f}s")

    # --- 5. PERSIST Chunks ---
    try:
        _persist_new_chunks(db, doc_id, chunks_raw, embeddings)
        logger.info(f"[PIPELINE] Chunks persisted for doc_id {doc_id}")
    except Exception as e:
        logger.error(f"[PIPELINE] Failed to persist chunks: {e}")
        db.rollback()
        raise

    result["processed"] = True
    result["doc_type"] = preprocessed.get("type", "PDF")
    result["num_chunks"] = len(chunks_raw)
    result["chunks"] = [
        {
            "index": i,
            "content": chunk,
            "embedding": embeddings[i] if i < len(embeddings) else None,
            "metadata": {
                "document_id": doc_id,
                "subject_id": subject_id,
                "filename": filename,
                "chunk_index": i,
                "from_db": False,
            },
        }
        for i, chunk in enumerate(chunks_raw)
    ]
    return result


def process_subject(
    subject_id: UUID,
    *,
    uploads_dir: Optional[str] = None,
    file_path: Optional[str] = None, # Added
    topic: Optional[str] = None,
    max_chunk_chars: int = 1500,
    chunk_overlap: int = 200,
    job_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main entry: take a subject_id, pull all documents from DB, preprocess each (if not already
    processed), chunk with metadata, and return a JSON-like structure. Handles errors gracefully.
    """
    base_dir = uploads_dir if uploads_dir is not None else DEFAULT_UPLOADS_DIR
    payload: Dict[str, Any] = {
        "subject_id": subject_id,
        "documents": [],
        "total_chunks": 0,
        "errors": [],
    }

    db = get_db()
    if db is None:
        msg = "[PIPELINE] Database session could not be established"
        logger.error(msg)
        payload["errors"].append(msg)
        return payload

    try:
        # Override for specific file processing
        if file_path:
            logger.info(f"[PIPELINE] Processing specific file: {file_path}")
            doc_result = _build_document_result(
                None,
                subject_id,
                file_path,
                base_dir,
                db,
                max_chunk_chars=max_chunk_chars,
                chunk_overlap=chunk_overlap,
                job_id=job_id,
            )
            payload["documents"].append(doc_result)
            payload["total_chunks"] += len(doc_result.get("chunks", []))
            if doc_result.get("error"):
                payload["errors"].append(doc_result["error"])
            return payload

        logger.info(f"[PIPELINE] Fetching documents for subject_id={subject_id}")
        docs = get_subject_documents(subject_id, db=db)
        logger.info(f"[PIPELINE] Found {len(docs)} documents.")
    except Exception as e:
        logger.error(f"[PIPELINE] Failed to fetch documents for subject {subject_id}: {e}")
        payload["errors"].append(f"Failed to fetch documents for subject {subject_id}: {e}")
        return payload
    finally:
        try:
            if db is not None:
                db.close()
        except Exception:
            pass

    if not docs:
        return payload

    # Re-open a session for per-document chunk lookups and keep it for the loop
    db = get_db()
    if db is None:
        msg = "[PIPELINE] Database session could not be established"
        logger.error(msg)
        payload["errors"].append(msg)
        return payload

    try:
        for doc in docs:
            doc_id = getattr(doc, "id", None)
            filename = getattr(doc, "filename", "")
            if not filename:
                payload["documents"].append({
                    "document_id": doc_id,
                    "subject_id": subject_id,
                    "filename": None,
                    "processed": False,
                    "from_cache": False,
                    "chunks": [],
                    "error": "Document has no filename",
                })
                payload["errors"].append(f"Document id={doc_id}: no filename")
                continue

            file_path = os.path.join(base_dir, filename)
            doc_result = _build_document_result(
                doc,
                subject_id,
                file_path,
                base_dir,
                db, # Strictly passed
                max_chunk_chars=max_chunk_chars,
                chunk_overlap=chunk_overlap,
                job_id=job_id,
            )

            if doc_result.get("error"):
                payload["errors"].append(f"Document id={doc_id} ({filename}): {doc_result['error']}")

            # Optional topic filter
            if topic and doc_result.get("chunks"):
                filtered = [
                    c for c in doc_result["chunks"]
                    if topic.lower() in (c.get("content") or "").lower()
                ]
                doc_result["chunks"] = filtered
                doc_result["num_chunks"] = len(filtered)

            payload["documents"].append(doc_result)
            payload["total_chunks"] += len(doc_result.get("chunks", []))
    finally:
        try:
            if db is not None:
                db.close()
        except Exception:
            pass

    return payload


# Legacy helpers for backward compatibility (e.g. build_subject_corpus, filter_by_topic)

def build_subject_corpus(subject_id: UUID, uploads_dir: Optional[str] = None) -> str:
    """
    Build a single corpus string from all subject documents.
    Uses process_subject and concatenates cleaned text from each document.
    """
    result = process_subject(subject_id, uploads_dir=uploads_dir)
    parts: List[str] = []
    for doc in result.get("documents", []):
        if doc.get("error"):
            continue
        for c in doc.get("chunks", []):
            content = c.get("content") or ""
            if content:
                parts.append(content)
    return "\n".join(parts)


def filter_by_topic(corpus: str, topic: Optional[str]) -> str:
    """Filter corpus paragraphs by topic (case-insensitive)."""
    if topic is None:
        return corpus
    filtered = [p for p in corpus.split("\n") if topic.lower() in p.lower()]
    return "\n".join(filtered)
