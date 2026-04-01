import os
import sys
import logging
import time
from uuid import UUID
from utils.logging import get_job_logger

# Ensure project root is in path for Celery workers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from celery import chain
from celery_app import celery_app

# DEPRECATED: Standardizing on utils.logging.get_job_logger
def get_job_logger_deprecated(job_id):
    return get_job_logger(job_id, "cognify-worker")


# --- REUSABLE ERROR HANDLER ---

@celery_app.task(name="tasks.task_record_failure")
def task_record_failure(request, exc, traceback, document_id, user_id=None):
    """
    Global failure handler called when any task in the chain fails.
    Logs the error and returns a structured failure dictionary.
    The result will be stored in the chain's result backend.
    """
    error_message = str(exc)
    logger.error(
        f"Chain failure for document_id={document_id}, user_id={user_id}: {error_message}"
    )
    logger.exception(exc)
    return {
        "status": "FAILED",
        "document_id": document_id,
        "user_id": user_id,
        "error": error_message
    }


# --- MODULAR PIPELINE TASKS ---

@celery_app.task(
    bind=True,
    name="tasks.task_ocr",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=300,
    time_limit=360,
)
def task_ocr(self, file_path, document_id, subject_id, user_id=None):
    """Step 1: Extract raw text from the PDF file.
    
    Also ensures an engine Document record exists and passes the integer
    engine_doc_id downstream so task_store can persist chunks with the
    correct FK (the engine documents table uses SERIAL int, not UUID).
    """
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.ocr")
    log.info(f"STEP: OCR STARTED for {file_path} (Attempt {self.request.retries + 1}), user_id={user_id}")
    start_time = time.perf_counter()

    # --- Ensure engine Document record exists BEFORE extraction ---
    # The backend passes a UUID document_id (its own PK), but the engine's
    # documents table uses an integer PK.  We create/find the engine record here
    # so all downstream tasks can use the correct integer engine_doc_id.
    engine_doc_id = None
    try:
        from database import SessionLocal
        from models import Document as EngineDocument
        import os as _os
        filename = _os.path.basename(file_path)
        db = SessionLocal()
        try:
            # Try to find existing record by filename + subject_id
            existing = db.query(EngineDocument).filter(
                EngineDocument.subject_id == subject_id,
                EngineDocument.filename == filename,
            ).first()
            if existing:
                engine_doc_id = existing.id
                log.info(f"STEP: OCR using existing engine doc_id={engine_doc_id}")
            else:
                doc = EngineDocument(
                    subject_id=subject_id,
                    filename=filename,
                    file_path=file_path,
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)
                engine_doc_id = doc.id
                log.info(f"STEP: OCR created engine doc_id={engine_doc_id} for subject={subject_id}")
        finally:
            db.close()
    except Exception as e:
        log.warning(f"STEP: OCR could not create engine Document record: {e} — chunk persistence may fail")

    from services.preprocessing import preprocess_step
    try:
        pre = preprocess_step(file_path, job_id=job_id)
        text = pre["cleaned_text"]
        duration = time.perf_counter() - start_time
        log.info(f"STEP: OCR SUCCESS (duration: {duration:.2f}s, chars: {len(text)})")
        return {
            "document_id": document_id,       # backend UUID (kept for reference)
            "engine_doc_id": engine_doc_id,   # integer FK for engine chunks table
            "subject_id": subject_id,
            "user_id": user_id,
            "file_path": file_path,
            "extracted_text": text,
        }
    except Exception as e:
        log.exception(f"STEP: OCR FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_chunk",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=120,
    time_limit=150
)
def task_chunk(self, data):
    """Step 2: Split extracted text into semantic chunks."""
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.chunk")
    text = data["extracted_text"]
    user_id = data.get("user_id")
    log.info(f"STEP: CHUNKING STARTED for {len(text)} chars (Attempt {self.request.retries + 1})")
    start_time = time.perf_counter()

    try:
        from services.preprocessing import chunk_step
        chunks = chunk_step(text, max_chunk_chars=2000, chunk_overlap=200, job_id=job_id)
        duration = time.perf_counter() - start_time
        log.info(f"STEP: CHUNKING SUCCESS (duration: {duration:.2f}s, chunks: {len(chunks)})")
        return {**data, "chunks": chunks}
    except Exception as e:
        log.exception(f"STEP: CHUNKING FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_embed",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=180,
    time_limit=210
)
def task_embed(self, data):
    """Step 3: Generate embeddings for each chunk."""
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.embed")
    chunks = data["chunks"]
    user_id = data.get("user_id")
    log.info(f"STEP: EMBEDDING STARTED for {len(chunks)} chunks (Attempt {self.request.retries + 1})")
    start_time = time.perf_counter()

    from services.embeddings import embed_step
    try:
        embeddings = embed_step(chunks, job_id=job_id)
        duration = time.perf_counter() - start_time
        log.info(f"STEP: EMBEDDING SUCCESS (duration: {duration:.2f}s)")
        return {
            **data,
            "embeddings": embeddings,
            "provider": "ollama",
            "model": "nomic-embed-text",
        }
    except Exception as e:
        log.exception(f"STEP: EMBEDDING FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise


@celery_app.task(
    bind=True,
    name="tasks.task_store",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=60,
    time_limit=90
)
def task_store(self, data):
    """
    Step 4: Persist chunks and embeddings to DB.
    """
    job_id = self.request.id
    from services.api import logger as api_logger
    from database import SessionLocal
    from services.processor import _persist_new_chunks
    
    document_id = data.get("document_id")       # backend UUID (for reference)
    engine_doc_id = data.get("engine_doc_id")   # integer PK in engine documents table
    subject_id = data.get("subject_id")
    chunks = data.get("chunks", [])
    embeddings = data.get("embeddings", [])
    
    api_logger.info(f"[PIPELINE] task_store RECEIVED for document_id={document_id}, engine_doc_id={engine_doc_id}, chunks={len(chunks)}")
    
    if not engine_doc_id:
        api_logger.error(f"[PIPELINE] task_store: engine_doc_id missing for document_id={document_id}. Cannot persist chunks.")
        raise ValueError(f"engine_doc_id not provided — cannot persist chunks for document_id={document_id}")

    db = SessionLocal()
    try:
        _persist_new_chunks(db, engine_doc_id, chunks, embeddings)
        
        # Mark subject as READY
        from models import Subject
        from datetime import datetime
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if subject:
            subject.is_ready = True
            subject.last_processed_at = datetime.now()
            api_logger.info(f"[PIPELINE] task_store SUCCESS: Marked subject {subject_id} as READY")
        else:
            api_logger.warning(f"[PIPELINE] task_store: Subject {subject_id} not found in DB")

        db.commit()
        api_logger.info(f"[PIPELINE] task_store SUCCESS: Saved {len(chunks)} chunks for engine_doc_id {engine_doc_id}")
    except Exception as e:
        api_logger.exception(f"[PIPELINE] task_store FAILED for engine_doc_id {engine_doc_id}: {e}")
        db.rollback()
        raise
    finally:
        db.close()
    
    return {
        "status": "SUCCESS",
        "document_id": document_id,
        "engine_doc_id": engine_doc_id,
        "chunk_count": len(chunks),
    }


@celery_app.task(
    bind=True,
    name="tasks.task_generate",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    soft_time_limit=300,
    time_limit=360
)
def task_generate(self, subject_id, material_type, topic=None, language="en", top_k=10, user_id=None):
    """
    Step 5: Generate study materials (Summary/Quiz/Flashcards/Exam) asynchronously.
    """
    job_id = self.request.id
    log = get_job_logger(job_id, "tasks.generate")
    log.info(f"STEP: GENERATION STARTED for subject={subject_id}, type={material_type} (Attempt {self.request.retries + 1})")
    start_time = time.perf_counter()

    from database import SessionLocal
    from services.retrieval import retrieve_chunks_by_topic
    from services.generation import generate_study_material

    db = SessionLocal()
    try:
        # 0. Validate subject has documents/chunks (Subject ID Mismatch Guard)
        from models import Chunk, Document
        from sqlalchemy import func
        chunk_count = db.query(func.count(Chunk.id)).join(Document).filter(Document.subject_id == subject_id).scalar()
        if chunk_count == 0:
            if self.request.retries < self.max_retries:
                log.warning(f"STEP: RETRYING - No chunks found for subject {subject_id} (Attempt {self.request.retries + 1}/{self.max_retries}). Waiting for persistence...")
                raise self.retry(countdown=5) # Wait 5 seconds for race condition
            else:
                log.error(f"[ERROR] No chunks found for subject_id: {subject_id} after {self.max_retries} attempts — subject remains empty.")
                raise ValueError(f"No content found for subject {subject_id}. Please ensure documents are uploaded and processed.")

        # 1. Retrieve context
        chunks = retrieve_chunks_by_topic(db, subject_id, topic, top_k, job_id=job_id)
        chunk_texts = [c.content for c in chunks if c.content]
        
        if not chunk_texts:
            log.warning(f"STEP: GENERATION FAILED - No content for subject {subject_id}")
            return {"status": "FAILED", "error": "No content available for this subject"}

        # 2. Generate material
        material = generate_study_material(chunk_texts, material_type, topic, language, job_id=job_id)
        
        duration = time.perf_counter() - start_time
        log.info(f"STEP: GENERATION SUCCESS (duration: {duration:.2f}s)")
        return {
            "status": "SUCCESS",
            "subject_id": subject_id,
            "material_type": material_type,
            "content": material if isinstance(material, str) else None,
            "ai_generated_content": material if isinstance(material, (dict, list)) else None
        }
    except Exception as e:
        log.exception(f"STEP: GENERATION FAILED (Attempt {self.request.retries + 1}): {str(e)}")
        raise
    finally:
        db.close()


# --- LEGACY WRAPPER (subject-level processing, backward compatible) ---

@celery_app.task(name="tasks.processDocument")
def processDocument(subject_id, uploads_dir=None, file_path=None):
    """
    Consolidated subject-level processing.
    Triggered by the backend for bulk processing.
    """
    from services.api import logger as api_logger
    from services.preprocessing import DEFAULT_UPLOADS_DIR
    
    base_dir = uploads_dir if uploads_dir else DEFAULT_UPLOADS_DIR
    api_logger.info(f"[PIPELINE] Celery worker received tasks.processDocument for subject_id={subject_id}")
    if file_path:
        api_logger.info(f"[PIPELINE] Processing specific file_path: {file_path}")
    api_logger.info(f"[PIPELINE] Using uploads_dir: {base_dir}")
    
    from services.processor import process_subject
    try:
        # process_subject now contains all the fail-fast logic and [PIPELINE] logs
        result = process_subject(
            subject_id, 
            uploads_dir=base_dir,
            file_path=file_path
        )
        
        if result.get("errors"):
            error_msg = "; ".join(result["errors"])
            api_logger.error(f"[PIPELINE] Task finished with errors: {error_msg}")
            # If no documents were processed correctly, we should fail the task
            if result.get("total_chunks", 0) == 0:
                raise ValueError(f"Pipeline failed: {error_msg}")
        
        api_logger.info(f"[PIPELINE] Task tasks.processDocument COMPLETED for subject_id={subject_id}")
        return {"status": "SUCCESS", "subject_id": subject_id, "summary": result}
    except Exception as e:
        api_logger.exception(f"[PIPELINE] Task tasks.processDocument FAILED for {subject_id}: {str(e)}")
        raise # Re-raise to mark task as FAILED in Celery
