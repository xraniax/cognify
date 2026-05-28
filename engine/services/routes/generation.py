"""Generation routes: async Celery dispatch and real-time SSE streaming."""
# This module is part of the Orchestration Layer (engine side).
# /generate  → Orchestration Layer: validates request and enqueues a Celery task (Engine Layer).
# /generate/stream → Orchestration Layer: resolves context, runs adaptive profile, then streams
#                    directly through the Engine Layer, persisting the result in-band.
import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.normalization.input_normalizer import SUPPORTED_MATERIAL_TYPES, normalize_material_type
from streaming.stream_core import stream_llm_response
from tasks import task_generate_material
from .._route_utils import _stage_error_response, get_db
from ..generation import generate_study_material_stream, normalize_ai_generated_content
from ..summary_pipeline import generate_summary_stream, MAP_MAX_CHUNKS, SUMMARY_MAX_CONTEXT_CHARS
from ..retrieval import retrieve_chunks_by_topic, retrieve_sequential_chunks
from ..schemas import GenerateRequest
from ..ollama_config import OLLAMA_GENERATION_MODEL

router = APIRouter()
logger = logging.getLogger("engine-api")


@router.post("/generate")
async def generate_route(body: GenerateRequest, db: Session = Depends(get_db)):
    """Generate study materials asynchronously via Celery. Returns job_id immediately."""
    logger.info("Generate request (async): subject=%s, type=%s, topic=%s",
                body.subject_id, body.material_type, body.topic)
    try:
        request_options = body.generation_options if isinstance(body.generation_options, dict) else {}
        topic = body.topic or request_options.get("topic")
        language = body.language or request_options.get("language") or "en"

        requested_type = (body.material_type or "").strip().lower()
        material_type = normalize_material_type(body.material_type)
        if material_type not in SUPPORTED_MATERIAL_TYPES:
            return _stage_error_response("generation", f"Unsupported material type '{requested_type}'", status_code=400)
        if body.subject_id is None:
            return _stage_error_response("generation", "Missing subject_id for async generation", status_code=400)

        # ── Engine Layer: enqueue Celery generation task ──
        task = task_generate_material.apply_async(kwargs={
            "subject_id": str(body.subject_id) if body.subject_id else "",
            "material_type": material_type,
            "topic": topic,
            "language": language,
            "top_k": body.top_k,
            "user_id": str(body.user_id) if body.user_id else None,
            "options": request_options,
            "chunks": body.chunks,
            "source_filenames": body.source_filenames,
            "material_ids": [str(mid) for mid in body.material_ids] if body.material_ids else None,
        })
        return {
            "status": "SUCCESS", "stage": "generation", "job_id": task.id,
            "message": f"Study material generation for {body.material_type} started in background",
        }
    except Exception as e:
        logger.exception("Generation trigger failed")
        return _stage_error_response("generation", "Study material generation failed to queue",
                                     details=str(e), status_code=500)


@router.post("/generate/stream")
async def generate_stream_route(body: GenerateRequest):
    """Generate study materials as real-time SSE chunks, bypassing Celery."""
    logger.info("Generate stream request: subject=%s, type=%s, topic=%s",
                body.subject_id, body.material_type, body.topic)

    request_options = body.generation_options if isinstance(body.generation_options, dict) else {}
    topic = body.topic or request_options.get("topic")
    language = body.language or request_options.get("language") or "en"

    requested_type = (body.material_type or "").strip().lower()
    material_type = normalize_material_type(body.material_type)
    if material_type not in SUPPORTED_MATERIAL_TYPES:
        return _stage_error_response("generation_stream", f"Unsupported material type '{requested_type}'", status_code=400)
    if body.subject_id is None:
        return _stage_error_response("generation_stream", "Missing subject_id for generation stream", status_code=400)

    async def generation_async_generator():
        logger.info("[TRACE][STREAM_START] Generator initialized")
        yield "[PROGRESS] Connecting to engine..."
        from database import SessionLocal
        db = SessionLocal()
        accumulated_text = []
        try:
            if body.material_id:
                yield f"[METADATA] {json.dumps({'material_id': str(body.material_id)})}"
            
            yield "[PROGRESS] Retrieving relevant context..."
            # ── Ingestion Layer: resolve context chunks from payload or DB ──
            logger.info("[TRACE][STREAM_RETRIEVAL] Starting retrieval subject=%s", body.subject_id)
            if body.chunks and isinstance(body.chunks, list) and len(body.chunks) > 0:
                inner_chunks = body.chunks
                logger.info("[TRACE][STREAM_CONTEXT] Using provided chunks count=%d", len(inner_chunks))
            elif material_type == "summary":
                ONE_SHOT_CHUNK_LIMIT = max(20, SUMMARY_MAX_CONTEXT_CHARS // 1500)
                chunks_with_scores = await asyncio.to_thread(
                    retrieve_sequential_chunks,
                    db, body.subject_id, limit=ONE_SHOT_CHUNK_LIMIT,
                    source_filenames=body.source_filenames or [],
                    material_ids=body.material_ids
                )
                inner_chunks = [c.content for c in chunks_with_scores if c.content]
                logger.info("[TRACE][STREAM_CONTEXT] Found seq chunks count=%d", len(inner_chunks))
            else:
                chunks_with_scores = await asyncio.to_thread(
                    retrieve_chunks_by_topic,
                    db, str(body.subject_id), topic, body.top_k, 
                    source_filenames=body.source_filenames,
                    material_ids=body.material_ids
                )
                inner_chunks = [c.content for c, _ in chunks_with_scores if c.content]
                logger.info("[TRACE][STREAM_CONTEXT] Found vector chunks count=%d", len(inner_chunks))
            
            if not inner_chunks:
                logger.warning("[TRACE][STREAM_EMPTY] No chunks found")
                if body.material_id:
                    from models import Material
                    from datetime import datetime
                    _mat = db.query(Material).filter(Material.id == body.material_id).first()
                    if _mat:
                        _mat.status = "FAILED"
                        _mat.processed_at = datetime.now()
                        db.commit()
                yield "[ERROR] No document chunks found for the given subject or topic."
                return

            # ── Orchestration Layer: adaptive profile resolution ──
            # Adaptive difficulty + weak-concept resolution for flashcards.
            # Stream path has db access → use get_adaptive_profile (blends Redis + PostgreSQL
            # mastery + flashcard_reviews), which is richer than the Celery Redis-only path.
            # Activates when difficulty=="adaptive" or generation_options.adaptive==True.
            if (
                material_type == "flashcards"
                and body.user_id
                and body.subject_id
            ):
                _adaptive_requested = (
                    request_options.get("difficulty") in ("adaptive", "auto")
                    or request_options.get("adaptive") is True
                    or request_options.get("mode") == "adaptive"
                )
                if _adaptive_requested:
                    try:
                        from ..adaptive_profile_service import get_adaptive_profile
                        _prof = get_adaptive_profile(
                            str(body.user_id), str(body.subject_id), db
                        )
                        request_options["difficulty"] = _prof["recommended_difficulty"]
                        if not request_options.get("adaptive_weak_concepts"):
                            request_options["adaptive_weak_concepts"] = _prof["weak_concepts"]
                        logger.info(
                            "[ADAPTIVE_FLASH] user=%s resolved difficulty=%s weak_concepts=%d",
                            body.user_id,
                            _prof["recommended_difficulty"],
                            len(_prof["weak_concepts"]),
                        )
                    except Exception as _e:
                        logger.warning("[ADAPTIVE_FLASH] Profile lookup failed: %s", _e)
                        request_options.setdefault("difficulty", "intermediate")

            # ── Engine Layer: execute LLM generation ──
            if material_type == "summary":
                summary_mode = body.summary_mode or request_options.get("summary_mode")
                difficulty = request_options.get("difficulty") or "intermediate"
                summary_weak_concepts: list = []

                # Adaptive profile resolution for teach_me_mode — mirrors flashcard
                # adaptive block above: uses get_adaptive_profile (Redis + PostgreSQL blend)
                # since the stream path already holds a db session.
                if summary_mode == "teach_me_mode" and body.user_id and body.subject_id:
                    try:
                        from ..adaptive_profile_service import get_adaptive_profile
                        _prof = get_adaptive_profile(
                            str(body.user_id), str(body.subject_id), db
                        )
                        difficulty = _prof["recommended_difficulty"]
                        summary_weak_concepts = _prof["weak_concepts"]
                        logger.info(
                            "[ADAPTIVE_SUMMARY] user=%s resolved difficulty=%s weak_concepts=%d",
                            body.user_id, difficulty, len(summary_weak_concepts),
                        )
                    except Exception as _e:
                        logger.warning("[ADAPTIVE_SUMMARY] Profile lookup failed: %s", _e)

                async for piece in generate_summary_stream(
                    inner_chunks, topic, language, difficulty, summary_mode,
                    weak_concepts=summary_weak_concepts,
                ):
                    if piece is None: continue
                    text = str(piece)
                    if text.startswith("[ERROR]"):
                        raise RuntimeError(text[7:].strip() or "Summary stream failed")
                    
                    if not text.startswith("[PROGRESS]"):
                        accumulated_text.append(text)
                    yield text
                    await asyncio.sleep(0)
            else:
                async for piece in generate_study_material_stream(inner_chunks, material_type, topic, language, options=request_options):
                    if piece is None: continue
                    text = str(piece)
                    if text.startswith("[ERROR]"):
                        raise RuntimeError(text[7:].strip() or "Generation stream failed")
                    
                    if not text.startswith("[PROGRESS]"):
                        accumulated_text.append(text)
                    yield text
                    await asyncio.sleep(0)

            # ── Final Persistence ──
            if body.material_id and accumulated_text:
                final_content = "".join(accumulated_text)
                from models import Material
                from datetime import datetime
                mat = db.query(Material).filter(Material.id == body.material_id).first()
                if mat:
                    logger.info("[TRACE][STREAM_PERSIST] Saving final output for material_id=%s", body.material_id)
                    try:
                        payload = normalize_ai_generated_content(
                            material_type, final_content,
                            model=OLLAMA_GENERATION_MODEL,
                            topic=body.topic,
                            subject_id=str(body.subject_id) if body.subject_id else None,
                        )
                    except Exception as norm_err:
                        logger.warning(
                            "[TRACE][STREAM_PERSIST_NORM_FAIL] %s normalization failed (%s), marking FAILED",
                            material_type, norm_err,
                        )
                        mat.status = "FAILED"
                        mat.processed_at = datetime.now()
                        db.commit()
                        if material_type == "flashcards":
                            yield f'[ERROR] {json.dumps({"reason": "FLASHCARDS_PARSE_FAILED", "message": str(norm_err)})}'
                        else:
                            yield f"[ERROR] {str(norm_err)}"
                        return
                    mat.ai_generated_content = json.dumps(payload, ensure_ascii=False)
                    mat.status = "COMPLETED"
                    mat.completed_at = datetime.now()
                    mat.processed_at = datetime.now()
                    db.commit()
                else:
                    logger.warning("[TRACE][STREAM_PERSIST_MISS] Material %s not found in DB", body.material_id)

        except Exception as e:
            logger.exception("Generation stream failed")
            if body.material_id:
                from models import Material
                mat = db.query(Material).filter(Material.id == body.material_id).first()
                if mat:
                    mat.status = "FAILED"
                    db.commit()
            yield f"[ERROR] {str(e)}"
        finally:
            if body.material_id:
                try:
                    from models import Material
                    from datetime import datetime
                    _mat = db.query(Material).filter(Material.id == body.material_id).first()
                    if _mat and _mat.status == "PROCESSING":
                        _mat.status = "FAILED"
                        _mat.processed_at = datetime.now()
                        db.commit()
                        logger.error(
                            "[TRACE][STREAM_LIFECYCLE] material_id=%s exited with status PROCESSING — forced to FAILED",
                            body.material_id,
                        )
                except Exception:
                    logger.exception(
                        "[TRACE][STREAM_LIFECYCLE] Failed to enforce FAILED state for material_id=%s",
                        body.material_id,
                    )
            db.close()

    return StreamingResponse(
        stream_llm_response(
            generation_async_generator(), 
            source="generation",
            metadata={"material_id": str(body.material_id)} if body.material_id else None
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
