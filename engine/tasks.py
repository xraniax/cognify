import os
import sys
import logging
import time
from uuid import UUID
from typing import Optional, Dict, Any, List, Union
from utils.logging import get_job_logger

# Define global logger for top-level tasks and initialization
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Ensure project root is in path for Celery workers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from celery import chain
from celery_app import celery_app
import redis
import json

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
    soft_time_limit=600,
    time_limit=900,
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
        log.error(f"STEP: OCR CRITICAL - Could not create/find engine Document record: {e}")
        log.error(f"DEBUG: subject_id={subject_id} (type={type(subject_id)}), filename={filename}")
        raise ValueError(f"Failed to establish engine Document record for subject {subject_id}: {e}")

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
    soft_time_limit=180,
    time_limit=210
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


CURRENT_CONFIG_VERSION = 1

def initialize_workspace_config(subject_id: str, existing_opts: Optional[dict] = None) -> dict:
    """
    Mandatory Workspace Entry Point. 
    Eradicates drift via strict versioning and 'Heal-and-Alert' logic.
    """
    opts = existing_opts or {}
    corrections = []
    
    # 1. Version Check
    version = opts.get("config_version", 0)
    if version < CURRENT_CONFIG_VERSION:
        corrections.append(f"version_upgrade({version}->{CURRENT_CONFIG_VERSION})")
    
    # 2. Build configuration with default-or-repair logic
    config = {
        "difficulty": opts.get("difficulty", "intermediate"),
        "count": opts.get("count", opts.get("numberOfQuestions", 10)),
        "types": opts.get("types", opts.get("examTypes", [])),
        "timeout": opts.get("timeout", 300),
        "strict_fallback_immunity": True,
        "config_version": CURRENT_CONFIG_VERSION
    }
    
    # 3. Detect and repair specific corruptions
    if not isinstance(config["types"], list) or len(config["types"]) == 0:
        config["types"] = ["single_choice", "multiple_select", "short_answer"]
        corrections.append("defaulted_missing_exam_types")
        
    if not isinstance(config["count"], int) or config["count"] <= 0:
        config["count"] = 10
        corrections.append(f"repaired_invalid_count({opts.get('count')})")

    # 4. Observability: Heal-and-Alert (No silent masking)
    if corrections:
        logger.warning(
            f"[CONFIG AUDIT] Workspace {subject_id} was misconfigured or outdated. "
            f"Repairs made: {', '.join(corrections)}. "
            "Please audit upstream write path in Node.js backend."
        )
    else:
        logger.info(f"[CONFIG VALID] Workspace {subject_id} passed initialization (v{CURRENT_CONFIG_VERSION})")
        
    return config

@celery_app.task(
    bind=True,
    name="tasks.task_generate",
    autoretry_for=(Exception,),
    retry_backoff=60,  # Wait 60s before first retry
    retry_jitter=True,
    max_retries=2,     # Limit to 2 retries (3 total attempts)
    soft_time_limit=600,
    time_limit=900
)
def task_generate(self, subject_id, material_type, topic=None, language="en", top_k=10, user_id=None, generation_options=None, **kwargs):
    """
    Step 5: Generate study materials (Summary/Quiz/Flashcards/Exam) asynchronously.
    """
    # 0. Compatibility Shim: Unify 'options' and 'generation_options'
    generation_options = generation_options or kwargs.get("options")

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
        log.info(f"STEP: GENERATION Validating content for subject {subject_id} (found {chunk_count} chunks)")
        
        if chunk_count == 0:
            if self.request.retries < self.max_retries:
                log.warning(f"STEP: RETRYING - No chunks found for subject {subject_id} (Attempt {self.request.retries + 1}/{self.max_retries}). Waiting for persistence...")
                raise self.retry(countdown=5) # Wait 5 seconds for race condition
            else:
                log.error(f"[ERROR] No chunks found for subject_id: {subject_id} (type={type(subject_id)}) after {self.max_retries} attempts.")
                # Diagnostic: check if subject exists at all in engine DB
                from models import Subject as EngineSubject
                exists = db.query(EngineSubject).filter(EngineSubject.id == subject_id).first() is not None
                log.error(f"DIAGNOSTIC: Subject {subject_id} exists in engine DB: {exists}")
                raise ValueError(f"No content found for subject {subject_id}. Please ensure documents are uploaded and processed.")

        # 2. Extract policy directly from generation_options
        from services.policies import GenerationPolicy
        
        if not generation_options:
            raise ValueError("generation_options must be provided for generation.")
            
        try:
            policy = GenerationPolicy(**generation_options)
            log.info(f"[WORKSPACE CHECK] Validated generation policy configuration.")
            log.info(f"[TRACE] Full generation_options dict: {generation_options}")
            log.info(f"[TRACE] policy.total_count after parse is: {policy.total_count}")
        except Exception as e:
            raise ValueError(f"Failed to load GenerationPolicy from generation_options: {e}")

        # 1. Retrieve context (optimized for task type)
        # Dynamically scale top_k to guarantee sufficient context for large target counts
        target_count = policy.total_count if policy else 10
        dynamic_top_k = max(top_k, 20, target_count * 2)
        log.info(f"[TRACE] Retrieval requested top_k={top_k}, scaled dynamically to dynamic_top_k={dynamic_top_k} to satisfy total_count={target_count}")

        chunks = retrieve_chunks_by_topic(db, subject_id, topic, dynamic_top_k, job_id=job_id, task_type=material_type)
        chunk_texts = [c.content for c in chunks if c.content]
        
        log.info(f"[TRACE] Actually retrieved {len(chunk_texts)} chunks from vector database for subject_id={subject_id}")
        
        if not chunk_texts:
            log.warning(f"STEP: GENERATION FAILED - No content for subject {subject_id}")
            return {"status": "FAILED", "error": "No content available for this subject"}

        # 3. Generate material
        import asyncio
        from services.generation import OLLAMA_GENERATION_TIMEOUT
        log.info(f"STEP: GENERATING {material_type} PARALLEL (GPS v1.1)...")

        # Call the async version of generate_study_material
        material = asyncio.run(generate_study_material(
            chunk_texts, 
            material_type, 
            topic, 
            language, 
            timeout=generation_options.get("timeout", OLLAMA_GENERATION_TIMEOUT),
            job_id=job_id, 
            options=generation_options,
            policy=policy
        ))
        
        # 3. Handle Result
        ai_generated_content = material if isinstance(material, dict) else None
        final_material_text = json.dumps(material) if isinstance(material, dict) else str(material)
        
        # SSE Broadcast for UI progress
        try:
            r = redis.from_url(os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"))
            channel = f"job:{job_id}:stream"
            r.publish(channel, json.dumps({
                "status": "completed",
                "telemetry": material.get("metadata", {}).get("telemetry") if isinstance(material, dict) else None,
                "is_final": True
            }))
        except Exception as e:
            log.warning(f"[REDIS] Failed to broadcast job completion for {job_id}: {e}")

        duration = time.perf_counter() - start_time
        log.info(f"[GENERATION] [SUCCESS] duration={duration:.2f}s type={material_type} job={job_id}")
        
        # 3. Handle Result: Promote nested 'content' to top-level for frontend compatibility
        ai_generated_content = material if isinstance(material, dict) else {}
        
        # Promote nested 'content' to top-level for frontend compatibility
        top_level_content = ai_generated_content.get("content")
        
        # [DIAGNOSTIC] Log structure to verify the fix
        log.info(f"[DEBUG_GEN] type={material_type} top_level={type(top_level_content).__name__}")
        if isinstance(top_level_content, dict):
            log.info(f"[DEBUG_GEN] keys={list(top_level_content.keys())}")
            
        final_content_text = top_level_content

        log.info(f"[GENERATION] [SUCCESS] duration={time.perf_counter() - start_time:.2f}s type={material_type} job={job_id}")
        
        return {
            "status": "SUCCESS",
            "subject_id": subject_id,
            "material_type": material_type,
            "content": final_content_text,
            "ai_generated_content": ai_generated_content
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
