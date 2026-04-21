import os
import tempfile
import json
import logging
import traceback
from typing import List, Optional
from uuid import UUID

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile, Request, Depends, Form
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
import asyncio
import redis.asyncio as async_redis

from celery import chain
from celery.result import AsyncResult
try:
    from celery_app import celery_app
    from tasks import (
        task_ocr,
        task_chunk,
        task_embed,
        task_store,
        task_record_failure,
        task_generate,
        processDocument,
    )
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from celery_app import celery_app
    from tasks import (
        task_ocr,
        task_chunk,
        task_embed,
        task_store,
        task_record_failure,
        task_generate,
        processDocument,
    )

from .preprocessing import DEFAULT_UPLOADS_DIR, preprocess_document, preprocess_uploads_folder
from .document_processor import process_document, process_text_pipeline
from .embeddings import embed_step, ollama_tags_url
from .processor import process_subject
from .retrieval import retrieve_chunks_by_topic
from .generation import (
    generate_study_material, evaluate_quiz, generate_chat_response,
    evaluate_answer_semantically
)
from .schemas import (
    EmbedRequest, ProcessTextRequest, RetrieveRequest, GenerateRequest,
    ChatRequest, QuizEvaluateRequest, QuizEvaluateResponse,
    EvaluateAnswerRequest, EvaluateAnswerResponse,
    DebugChunkRequest, DebugStoreRequest, DebugGenerateRequest
)

try:
    import database
    import models
    SessionLocal = database.SessionLocal
    Document = models.Document
    Chunk = models.Chunk
except ImportError:
    from ..database import SessionLocal
    from ..models import Document, Chunk

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("engine-api")
from utils.logging import get_job_logger

ALLOWED_EXTENSIONS = frozenset({".pdf", ".png", ".jpg", ".jpeg"})

app = FastAPI(
    title="Cognify Engine API",
    description="Document preprocessing, chunking, embeddings (Ollama), and subject processing.",
    version="0.2.0",
)


def _stage_error_response(
    stage: str,
    message: str,
    *,
    details: Optional[str] = None,
    status_code: int = 500,
) -> JSONResponse:
    payload = {"status": "error", "stage": stage, "message": message}
    if details:
        payload["details"] = details
    logger.error("[%s] %s%s", stage, message, f" — {details}" if details else "")
    return JSONResponse(status_code=status_code, content=payload)


async def _save_upload_to_temp(file: UploadFile) -> str:
    suffix = os.path.splitext(file.filename or "")[1].lower() or ".pdf"
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Only PDF and image files are supported (.pdf, .png, .jpg, .jpeg)."
        )
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode="wb") as tmp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        return tmp.name


def _safe_remove(path: Optional[str]) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        os.remove(path)
        logger.info("Cleaned up temporary file: %s", path)
    except OSError as e:
        logger.error("Cleanup failed for %s: %s", path, e)


def _all_embeddings_failed(embeddings: List[Optional[List[float]]]) -> bool:
    return bool(embeddings) and all(e is None for e in embeddings)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder({"status": "error", "stage": "api", "detail": exc.detail}),
        )
    logger.exception("Global error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "stage": "api",
            "message": "Internal server error",
        },
    )


@app.get("/")
async def root():
    return {
        "service": "Cognify Engine",
        "docs": "/docs",
        "endpoints": {
            "preprocess": "POST /preprocess — upload file → raw_text, cleaned_text, chunks",
            "embed": "POST /embed — JSON body with text or chunks → embeddings",
            "process_text": "POST /process-text — JSON raw text → full pipeline (optional embeddings)",
            "process_document": "POST /process-document — upload → preprocess → chunk → embed",
            "process_uploads_folder": "GET /process-uploads — batch preprocess files in uploads dir",
            "process_subject": "GET /subjects/{subject_id}/process — DB-backed subject pipeline",
        },
    }


@app.get("/health")
async def health():
    try:
        ollama_response = requests.get(ollama_tags_url(), timeout=5)
        ollama_healthy = ollama_response.status_code == 200
    except Exception as e:
        logger.warning("Ollama health check failed: %s", e)
        ollama_healthy = False

    return {
        "status": "ok" if ollama_healthy else "degraded",
        "ollama": "healthy" if ollama_healthy else "unreachable",
        "engine": "healthy",
    }


@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Check the status of a background task."""
    task_result = AsyncResult(job_id, app=celery_app)

    response = {
        "job_id": job_id,
        "status": task_result.status,  # PENDING, STARTED, SUCCESS, FAILURE
        "result": None,
        "error": None,
    }

    if task_result.status == "FAILURE":
        response["error"] = str(task_result.result)
    elif task_result.status == "SUCCESS":
        response["result"] = task_result.result
    elif task_result.status == "STARTED":
        response["meta"] = task_result.info

    return response


@app.get("/job/{job_id}/stream")
async def stream_job_updates(job_id: str):
    """
    Server-Sent Events (SSE) endpoint to stream generation updates from Redis.
    """
    redis_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    
    async def event_generator():
        client = async_redis.from_url(redis_url)
        pubsub = client.pubsub()
        channel = f"job:{job_id}:stream"
        
        try:
            await pubsub.subscribe(channel)
            logger.info(f"SSE: Client subscribed to {channel}")
            
            # Send initial connection event
            yield "data: {\"status\": \"connected\"}\n\n"
            
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30.0)
                if message:
                    data = message["data"].decode("utf-8")
                    yield f"data: {data}\n\n"
                    
                    # If the message indicates it's the final chunk, we can exit the loop
                    try:
                        parsed = json.loads(data)
                        if parsed.get("is_final"):
                            logger.info(f"SSE: Received final chunk for {job_id}")
                            break
                    except:
                        pass
                else:
                    # Keep-alive or timeout check
                    yield "data: {\"status\": \"ping\"}\n\n"
                
                await asyncio.sleep(0.01)
                
        except Exception as e:
            logger.error(f"SSE Error for {job_id}: {e}")
            yield f"data: {{\"status\": \"error\", \"message\": \"{str(e)}\"}}\n\n"
        finally:
            await pubsub.unsubscribe(channel)
            await client.close()
            logger.info(f"SSE: Client unsubscribed and closed for {job_id}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/preprocess")
async def preprocess_route(file: UploadFile = File(..., description="PDF or image file")):
    """
    Upload a file, run extract + clean + chunk only (no Ollama).
    Returns raw_text, cleaned_text, chunks, num_chunks, and document type.
    """
    logger.info("Preprocess request for: %s", file.filename)
    tmp_path: Optional[str] = None
    try:
        try:
            tmp_path = await _save_upload_to_temp(file)
        except ValueError as e:
            return _stage_error_response(
                "preprocess",
                "Invalid or unsupported upload",
                details=str(e),
                status_code=400,
            )
        logger.info("Saved temporary file to: %s", tmp_path)
        result = preprocess_document(tmp_path)
        return {
            "status": "success",
            "stage": "preprocess",
            "filename": file.filename,
            **result,
        }
    except ValueError as e:
        return _stage_error_response(
            "preprocess",
            "Text extraction or validation failed",
            details=str(e),
            status_code=422,
        )
    except FileNotFoundError as e:
        return _stage_error_response(
            "preprocess",
            "Uploaded file missing on disk",
            details=str(e),
            status_code=400,
        )
    except Exception as e:
        logger.exception("Preprocess failed for %s", file.filename)
        return _stage_error_response(
            "preprocess",
            "Preprocessing failed",
            details=str(e),
            status_code=500,
        )
    finally:
        _safe_remove(tmp_path)


@app.post("/embed")
async def embed_route(body: EmbedRequest):
    """
    Generate embeddings using the same Ollama path as the full document pipeline.
    Send either `text` (one string) or `chunks` (list of strings).
    """
    if body.chunks is not None and len(body.chunks) > 0:
        texts = body.chunks
    else:
        texts = [body.text.strip()]
    logger.info("Embed request: %d text(s)", len(texts))
    try:
        embeddings = embed_step(texts)
    except Exception as e:
        logger.exception("Embedding stage failed")
        return _stage_error_response(
            "embedding",
            "Embedding service error",
            details=str(e),
            status_code=502,
        )

    if _all_embeddings_failed(embeddings):
        return _stage_error_response(
            "embedding",
            "All embedding requests failed (check Ollama and OLLAMA_BASE_URL)",
            status_code=502,
        )

    return {
        "status": "success",
        "stage": "embedding",
        "count": len(embeddings),
        "embeddings": embeddings,
    }


@app.post("/process-text")
async def process_text_route(body: ProcessTextRequest):
    """Run clean → chunk → optional embed on raw text (no file upload)."""
    logger.info("Process-text request, include_embeddings=%s", body.include_embeddings)
    try:
        result = process_text_pipeline(
            body.text,
            max_chunk_chars=body.max_chunk_chars,
            chunk_overlap=body.chunk_overlap,
            include_embeddings=body.include_embeddings,
        )
        out = {
            "status": "success",
            "stage": "processing",
            "message": "Text pipeline completed",
            **result,
        }
        if body.include_embeddings and _all_embeddings_failed(result.get("embeddings") or []):
            out["embedding_warning"] = (
                "all_embedding_requests_failed; check Ollama and OLLAMA_BASE_URL"
            )
            logger.error("[%s] %s", "embedding", out["embedding_warning"])
        return out
    except Exception as e:
        logger.exception("Process-text pipeline failed")
        return _stage_error_response(
            "processing",
            "Text pipeline failed",
            details=str(e),
            status_code=500,
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _trigger_pipeline(file_path: str, document_id: Optional[str], subject_id: Optional[str], user_id: Optional[str] = None) -> str:
    """
    Build and dispatch the Celery chain:
        task_ocr → task_chunk → task_embed → task_store
    with task_record_failure wired as a link_error callback.
    Returns the chain's root task ID (used as the job_id).
    """
    pipeline = chain(
        task_ocr.s(file_path, document_id, subject_id, user_id),
        task_chunk.s(),
        task_embed.s(),
        task_store.s(),
    )
    result = pipeline.apply_async(
        link_error=task_record_failure.s(document_id, user_id)
    )
    return result.id


@app.post("/process-document")
async def process_document_route(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None),
    document_id: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
):
    """
    Trigger background processing for a document via the modular Celery pipeline.
    Accepts either an NFS file_path or a direct file upload.
    """
    # Path remapping for cross-container consistency (Docker volume sharing)
    # Backend sends /app/uploads/... but engine sees it as /data/uploads/...
    if file_path and file_path.startswith('/app/uploads/'):
        alt_path = file_path.replace('/app/uploads/', '/data/uploads/')
        if os.path.exists(alt_path):
            file_path = alt_path
            logger.info(f"Remapped backend path to engine path: {file_path}")

    if file_path and os.path.exists(file_path):
        logger.info(f"Triggering pipeline for NFS file: {file_path} (document_id={document_id}, user_id={user_id})")
        job_id = _trigger_pipeline(file_path, document_id, subject_id, user_id)
        return {"status": "accepted", "job_id": job_id, "message": "Processing started in background"}

    if not file:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "No file or valid file_path provided."},
        )

    # HTTP upload fallback: save to shared uploads dir then process
    filename = file.filename
    target_path = os.path.join(DEFAULT_UPLOADS_DIR, f"async_{filename}")

    try:
        os.makedirs(DEFAULT_UPLOADS_DIR, exist_ok=True)
        with open(target_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)

        logger.info(f"Saved upload to {target_path}, triggering pipeline.")
        job_id = _trigger_pipeline(target_path, document_id, subject_id, user_id)
        return {"status": "accepted", "job_id": job_id, "message": "Upload success, processing started"}
    except Exception as e:
        logger.error(f"Failed to handle upload: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.get("/process-uploads")
async def process_uploads_route(uploads_dir: Optional[str] = None):
    try:
        results = preprocess_uploads_folder(uploads_dir=uploads_dir)
        return {
            "message": f"Processed {len(results)} file(s) from uploads.",
            "uploads_dir": uploads_dir or DEFAULT_UPLOADS_DIR,
            "results": results,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@app.get("/subjects/{subject_id}/process")
async def process_subject_route(
    subject_id: str,
    uploads_dir: Optional[str] = None,
):
    """
    Trigger async processing for all documents in a subject.
    """
    logger.info("Dispatching Celery task tasks.processDocument")
    logger.info(f"Triggering async subject processing for id={subject_id}")
    task = processDocument.delay(subject_id, uploads_dir=uploads_dir)
    return {"status": "accepted", "job_id": task.id, "message": "Subject processing task queued"}

@app.post("/retrieve")
async def retrieve_route(body: RetrieveRequest, db: Session = Depends(get_db)):
    """Retrieve top-k relevant chunks for a given topic and subject."""
    logger.info("Retrieve request for subject: %s, topic: %s", body.subject_id, body.topic)
    try:
        chunks = retrieve_chunks_by_topic(db, str(body.subject_id), body.topic, body.top_k or 10)
        return {
            "status": "success",
            "stage": "retrieval",
            "count": len(chunks),
            "chunks": [{"id": c.id, "content": c.content, "document_id": c.document_id} for c in chunks]
        }
    except Exception as e:
        logger.exception("Retrieval failed")
        return _stage_error_response(
            "retrieval",
            "Retrieval failed",
            details=str(e),
            status_code=500,
        )

@app.post("/chat")
async def chat_route(body: ChatRequest, db: Session = Depends(get_db)):
    """Conversational chat grounded in retrieved context."""
    logger.info("Chat request: subject=%s, query=%s, user_id=%s", body.subject_id, body.question, body.user_id)
    try:
        # 1. Retrieve context chunks
        chunks = retrieve_chunks_by_topic(db, body.subject_id, None, body.top_k or 10)
        chunk_texts = [c.content for c in chunks if c.content]
        
        # 2. Generate response
        context = "\n\n".join(chunk_texts)
        response = await generate_chat_response(body.question, context, [], body.language)
        
        return {
            "status": "success",
            "stage": "chat",
            "response": response
        }
    except Exception as e:
        logger.exception("Chat failed")
        return _stage_error_response(
            "chat",
            "Chat failed",
            details=str(e),
            status_code=500,
        )

@app.post("/generate")
async def generate_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials using LLM based on retrieved context."""
    logger.info("Generate request (async): subject=%s, type=%s, topic=%s, user_id=%s, generation_options=%s", body.subject_id, body.material_type, body.topic, body.user_id, body.generation_options)
    
    if not body.generation_options:
        raise HTTPException(status_code=400, detail="Missing generation_options in request payload.")

    try:
        # Trigger the async task
        task = task_generate.delay(
            str(body.subject_id), 
            body.material_type, 
            body.topic, 
            body.language, 
            body.top_k or 10,
            body.user_id,
            generation_options=body.generation_options
        )
        
        return {
            "status": "accepted",
            "stage": "generation",
            "job_id": task.id,
            "message": f"Study material generation for {body.material_type} started in background"
        }
    except Exception as e:
        logger.exception("Generation trigger failed")
        return _stage_error_response(
            "generation",
            "Study material generation failed to queue",
            details=str(e),
            status_code=500,
        )

@app.post("/evaluate-quiz", response_model=QuizEvaluateResponse)
async def evaluate_quiz_route(body: QuizEvaluateRequest):
    """
    Evaluate user answers for a quiz.
    The request includes the original questions (with correct answers) 
    and the user submissions.
    """
    logger.info("Evaluate quiz request: %d submissions", len(body.submissions))
    try:
        # Convert Pydantic models to dicts for the helper
        questions_dict = [q.model_dump() for q in body.questions]
        submissions_dict = [s.model_dump() for s in body.submissions]
        
        result = evaluate_quiz(questions_dict, submissions_dict)
        return result
    except Exception as e:
        logger.exception("Quiz evaluation failed")
        return _stage_error_response(
            "evaluation",
            "Quiz evaluation failed",
            details=str(e),
            status_code=500,
        )

@app.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer_route(body: EvaluateAnswerRequest):
    """
    Evaluate a single student answer semantically using LLM.
    Useful for short_answer, problem, and scenario questions.
    """
    logger.info("Evaluate answer request: q='%s'...", body.question[:50])
    try:
        result = await evaluate_answer_semantically(
            body.question,
            body.correct_answer,
            body.user_answer
        )
        return result
    except Exception as e:
        logger.exception("Answer evaluation failed")
        return _stage_error_response(
            "evaluation",
            "Answer evaluation failed",
            details=str(e),
            status_code=500,
        )

# --- DEBUG ENDPOINTS ---

@app.post("/debug/chunk")
async def debug_chunk(body: DebugChunkRequest):
    """DEBUG: Test chunking stage independently."""
    log = get_job_logger("debug-chunk", "engine-api")
    log.info("DEBUG: Chunking request")
    try:
        from .preprocessing import chunk_step, clean_text_step
        cleaned = clean_text_step(body.text)
        chunks = chunk_step(
            cleaned, 
            max_chunk_chars=body.max_chunk_chars, 
            chunk_overlap=body.chunk_overlap,
            job_id="debug-chunk"
        )
        return {"status": "success", "chunks": chunks, "count": len(chunks)}
    except Exception as e:
        log.exception("DEBUG: Chunking failed")
        return _stage_error_response("debug-chunk", str(e))

@app.post("/debug/embed")
async def debug_embed(body: EmbedRequest):
    """DEBUG: Test embedding stage independently."""
    log = get_job_logger("debug-embed", "engine-api")
    log.info("DEBUG: Embedding request")
    try:
        if body.chunks:
            texts = body.chunks
        else:
            texts = [body.text]
        
        embeddings = embed_step(texts, job_id="debug-embed")
        
        sample = None
        vector_length = 0
        if embeddings and embeddings[0]:
            sample = embeddings[0][:5]
            vector_length = len(embeddings[0])
            
        return {
            "status": "success", 
            "vector_length": vector_length, 
            "sample": sample,
            "count": len(embeddings)
        }
    except Exception as e:
        log.exception("DEBUG: Embedding failed")
        return _stage_error_response("debug-embed", str(e))

@app.post("/debug/store")
async def debug_store(body: DebugStoreRequest, db: Session = Depends(get_db)):
    """DEBUG: Test chunk + embed + store independently."""
    log = get_job_logger("debug-store", "engine-api")
    log.info(f"DEBUG: Store request for subject {body.subject_id}")
    try:
        from .preprocessing import chunk_step, clean_text_step
        from .embeddings import embed_step
        
        # 1. Pipeline
        cleaned = clean_text_step(body.text)
        chunks = chunk_step(cleaned, job_id="debug-store")
        embeddings = embed_step(chunks, job_id="debug-store")
        
        # 2. Persist
        # Ensure subject exists
        subj = db.query(models.Subject).filter(models.Subject.id == body.subject_id).first()
        if not subj:
            subj = models.Subject(id=body.subject_id)
            db.add(subj)
            db.flush()

        # Ensure a document exists for this subject
        doc = db.query(models.Document).filter(models.Document.subject_id == body.subject_id).first()
        if not doc:
            doc = models.Document(
                subject_id=body.subject_id,
                filename="debug_upload.txt",
                file_path="/tmp/debug_upload.txt"
            )
            db.add(doc)
            db.flush()
        
        for content, emb in zip(chunks, embeddings):
            chunk_obj = models.Chunk(
                document_id=doc.id,
                content=content,
                embedding=emb
            )
            db.add(chunk_obj)
        
        db.commit()
        return {"status": "success", "stored_chunks": len(chunks), "document_id": doc.id}
    except Exception as e:
        db.rollback()
        log.exception("DEBUG: Store failed")
        return _stage_error_response("debug-store", str(e))

@app.get("/debug/retrieve/{subject_id}")
async def debug_retrieve(subject_id: UUID, topic: Optional[str] = None, db: Session = Depends(get_db)):
    """DEBUG: Test retrieval stage independently."""
    log = get_job_logger("debug-retrieve", "engine-api")
    log.info(f"DEBUG: Retrieval request for subject {subject_id}, topic={topic}")
    try:
        from .retrieval import retrieve_chunks_by_topic
        chunks = retrieve_chunks_by_topic(db, subject_id, topic, top_k=5, job_id="debug-retrieve")
        return {
            "status": "success", 
            "count": len(chunks),
            "chunks": [{"id": c.id, "content": c.content[:100] + "..."} for c in chunks]
        }
    except Exception as e:
        log.exception("DEBUG: Retrieval failed")
        return _stage_error_response("debug-retrieve", str(e))

@app.post("/debug/generate")
async def debug_generate(body: DebugGenerateRequest, db: Session = Depends(get_db)):
    """DEBUG: Test retrieval + generation independently (synchronous)."""
    log = get_job_logger("debug-generate", "engine-api")
    log.info(f"DEBUG: Generation request for subject {body.subject_id}, type={body.material_type}")
    try:
        from .retrieval import retrieve_chunks_by_topic
        from .generation import generate_study_material
        
        # 1. Retrieve
        chunks = retrieve_chunks_by_topic(db, body.subject_id, body.topic, top_k=body.top_k, job_id="debug-generate")
        if not chunks:
            return _stage_error_response("debug-generate", "No chunks found for retrieval", status_code=404)
        
        chunk_texts = [c.content for c in chunks]
        
        # 2. Generate (Async)
        result = await generate_study_material(
            chunk_texts, 
            body.material_type, 
            topic=body.topic, 
            language=body.language, 
            job_id="debug-generate"
        )
        
        return {
            "status": "success",
            "material_type": body.material_type,
            "content": result
        }
    except Exception as e:
        log.exception("DEBUG: Generation failed")
        return _stage_error_response("debug-generate", str(e))
@app.get("/debug/pipeline-status/{subject_id}")
async def debug_pipeline_status(subject_id: UUID, db: Session = Depends(get_db)):
    """DEBUG: Check document and chunk counts for a subject."""
    try:
        from models import Document, Chunk
        doc_count = db.query(Document).filter(Document.subject_id == subject_id).count()
        chunk_count = db.query(Chunk).join(Document).filter(Document.subject_id == subject_id).count()
        
        return {
            "status": "success",
            "subject_id": subject_id,
            "document_count": doc_count,
            "chunk_count": chunk_count,
            "message": f"Subject {subject_id} has {doc_count} documents and {chunk_count} chunks."
        }
    except Exception as e:
        logger.exception("DEBUG: Pipeline status check failed")
        return _stage_error_response("debug-status", str(e))

@app.get("/debug/subjects")
async def debug_subjects(db: Session = Depends(get_db)):
    """DEBUG: List all subjects with document and chunk counts."""
    try:
        from models import Subject, Document, Chunk
        from sqlalchemy import func
        
        # We need to count chunks linked to documents belonging to the subject
        results = db.query(
            Subject.id,
            Subject.is_ready,
            Subject.last_processed_at,
            func.count(Document.id.distinct()).label('doc_count')
        ).outerjoin(Document).group_by(Subject.id, Subject.is_ready, Subject.last_processed_at).all()
        
        subjects_data = []
        for r in results:
            sid = r.id
            c_count = db.query(func.count(Chunk.id)).join(Document).filter(Document.subject_id == sid).scalar()
            subjects_data.append({
                "subject_id": str(sid),
                "is_ready": r.is_ready,
                "last_processed_at": r.last_processed_at.isoformat() if r.last_processed_at else None,
                "document_count": r.doc_count,
                "chunk_count": c_count,
            })
            
        return {
            "status": "success",
            "total_subjects": len(subjects_data),
            "subjects": subjects_data
        }
    except Exception as e:
        logger.exception("DEBUG: Subjects listing failed")
        return _stage_error_response("debug-subjects", str(e))

