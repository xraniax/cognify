import os
import json
import logging
import time
import re
import uuid
from typing import List, Optional, Dict, Any, Union

import httpx
import asyncio
from utils.logging import get_job_logger
from .schemas import ExamOutput, QuizOutput, FlashcardsOutput, GenerateRequest, GenerationPolicy, QuestionTypePreference
from .policies import PolicyEngine, GenerationSegment

logger = logging.getLogger("engine-generation")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama_gpu:11434").rstrip("/")
OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_GENERATION_MODEL = os.getenv("OLLAMA_GENERATION_MODEL", "qwen2.5:7b-instruct")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b-instruct")

OLLAMA_GENERATION_TIMEOUT = httpx.Timeout(600.0, connect=10.0)
OLLAMA_CHAT_TIMEOUT = httpx.Timeout(600.0, connect=10.0)
OLLAMA_MAX_CONTEXT_CHARS = 12000 

# STABILIZATION: Single-model unification flag
ENABLE_MULTI_MODEL_ROUTING = False

def select_model(task_type: str) -> str:
    """STRICT ROUTER: Force Qwen 2.5 for ALL tasks."""
    if ENABLE_MULTI_MODEL_ROUTING:
        if task_type in ["quiz", "flashcard", "short_answer"]:
            selected = "qwen2.5:7b-instruct"
        else:
            selected = "llama3.1:8b"
    else:
        selected = "qwen2.5:7b-instruct"
        
    logger.info(f"MODEL_SELECTED={selected} TASK_TYPE={task_type}")
    return selected

async def invoke_ollama(payload: Dict[str, Any], timeout: Union[int, float, httpx.Timeout], job_id: Optional[str] = None) -> httpx.Response:
    """Hardened Ollama invocation with exponential backoff retries."""
    if not isinstance(timeout, httpx.Timeout):
        timeout = httpx.Timeout(float(timeout), connect=10.0)
    
    log = get_job_logger(job_id, "engine-ollama-client")
    max_retries = 2
    
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(OLLAMA_GENERATE_URL, json=payload, timeout=timeout)
                response.raise_for_status()
                
                # Logging telemetry
                resp_json = response.json()
                log.info(f"[OLLAMA_STATS] done_reason={resp_json.get('done_reason')} total_duration={resp_json.get('total_duration')}")
                
                return response
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
            err_msg = f"{type(e).__name__}: {str(e)}" if str(e) else type(e).__name__
            if attempt < max_retries:
                wait_time = (2 ** attempt) + 1
                log.warning(f"[LLM_RETRY] Attempt {attempt+1}/{max_retries+1} failed: {err_msg}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                log.error(f"[LLM_FATAL] All {max_retries+1} attempts failed: {err_msg}")
                raise
        except Exception as e:
            log.error(f"[LLM_UNEXPECTED] {type(e).__name__}: {e}")
            raise

async def generate_study_material(
    context_chunks: List[str],
    material_type: str,
    topic: Optional[str] = None,
    language: str = "en",
    timeout: Union[int, float, httpx.Timeout] = OLLAMA_GENERATION_TIMEOUT,
    job_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    policy: Optional[GenerationPolicy] = None
) -> Dict[str, Any]:
    log = get_job_logger(job_id, "engine-generation")
    if material_type == "quiz":
        return await generate_quiz_strict(policy, "\n".join(context_chunks), topic, language, timeout, job_id)
    elif material_type == "flashcards":
        return await generate_flashcards_strict(policy, "\n".join(context_chunks), topic, language, timeout, job_id)
    elif material_type == "summary":
        return await generate_summary_strict(policy, "\n".join(context_chunks), topic, language, timeout, job_id)
    elif material_type == "exam":
        full_context = "\n".join(context_chunks)
        segments = PolicyEngine.decompose_policy(policy)
        tasks = [generate_segment_async(seg, full_context, language, job_id) for seg in segments]
        results = await asyncio.gather(*tasks)
        all_questions = []
        for i, r in enumerate(results):
            log.info(f"[TRACE] Parallel worker {i} returned {len(r)} questions")
            all_questions.extend(r)
            
        log.info(f"[TRACE] Total accumulated exam questions from workers: {len(all_questions)}")
        return {
            "type": "exam",
            "content": {"questions": all_questions[:policy.total_count if policy else 10]},
            "metadata": {"difficulty": policy.difficulty if policy else "mixed", "version": "v1.1"}
        }
    else:
        raise ValueError(f"Unknown material type: {material_type}")

async def generate_segment_async(segment: GenerationSegment, context: str, language: str, job_id: str, timeout: Union[int, float, httpx.Timeout] = OLLAMA_GENERATION_TIMEOUT) -> List[Dict[str, Any]]:
    log = get_job_logger(job_id, "engine-parallel-gen")
    prompt = f"Generate {segment.count} {segment.difficulty} {segment.q_type} questions in {language}.\nContext:\n{context[:int(OLLAMA_MAX_CONTEXT_CHARS/2)]}\nJSON output only."
    num_predict = min(8192, 300 * (segment.count or 10))
    payload = {"model": "qwen2.5:7b-instruct", "prompt": prompt, "format": "json", "stream": False, "options": {"num_ctx": 16384, "num_predict": num_predict}}
    try:
        response = await invoke_ollama(payload, timeout, job_id)

        data = json.loads(response.json().get("response", ""))
        return data.get("questions", [])
    except: return []

async def generate_quiz_strict(policy: GenerationPolicy, context: str, topic: Optional[str] = None, language: str = "en", timeout: Union[int, float, httpx.Timeout] = OLLAMA_GENERATION_TIMEOUT, job_id: Optional[str] = None) -> Dict[str, Any]:
    log = get_job_logger(job_id, "engine-generation")
    start_time = time.perf_counter()
    count = policy.total_count if policy else 10
    log.info(f"[TRACE] generate_quiz_strict explicitly prompting LLM for {count} questions.")
    
    prompt = f"Generate EXACTLY {count} quiz questions based ONLY on the context.\nFormat MUST be strict JSON.\nSCHEMA:\n{{\"type\": \"quiz\", \"content\": {{\"questions\": [{{\"question\": \"...\", \"options\": [\"\", \"\", \"\", \"\"], \"answer\": \"...\", \"type\": \"single_choice\"}}]}}}}\nContext:\n{context[:OLLAMA_MAX_CONTEXT_CHARS]}\n"
    num_predict = min(16384, 500 * count)
    payload = {"model": "qwen2.5:7b-instruct", "prompt": prompt, "format": "json", "stream": False, "options": {"num_thread": 8, "num_batch": 128, "num_ctx": 16384, "num_predict": num_predict}}
    try:
        response = await invoke_ollama(payload, timeout, job_id)
        raw_text = response.json().get("response", "{}")
        repaired_json = PolicyEngine.repair_json_content(raw_text)
        result = json.loads(repaired_json)
        
        # Robust Recursive Extractor: Find the first array that looks like quiz items
        def find_questions_array(data):
            if isinstance(data, list):
                if len(data) > 0 and isinstance(data[0], dict) and ("question" in data[0] or "text" in data[0]):
                    return data
                for item in data:
                    res = find_questions_array(item)
                    if res: return res
            elif isinstance(data, dict):
                # Check known keys first
                for key in ["questions", "quiz", "flashcards", "cards", "data", "items", "content"]:
                    if key in data:
                        res = find_questions_array(data[key])
                        if res: return res
                # Fallback search all keys
                for val in data.values():
                    res = find_questions_array(val)
                    if res: return res
            return []

        extracted_questions = find_questions_array(result)
        log.info(f"[TRACE] generate_quiz_strict actually parsed out {len(extracted_questions)} questions from the LLM output")
        result = {"content": {"questions": extracted_questions}}

        # FRONTEND REMAP: Ensure type is "single_choice" for MCQs and IDs are present
        content = result.get("content", {})
        questions = content.get("questions", [])[:count] # STRICT ENFORCEMENT
        for i, q in enumerate(questions):
            q["type"] = "single_choice"  # Force MCQ for quiz
            if "id" not in q:
                q["id"] = f"q_{i}_{int(time.time())}"
        
        content["questions"] = questions

        return {
            "type": "quiz",
            "content": content,
            "metadata": {
                "difficulty": policy.difficulty if policy else "mixed",
                "telemetry": {"latency_ms": int((time.perf_counter() - start_time) * 1000)}
            }
        }
    except Exception as e:
        log.error(f"[QUIZ_ERROR] {e}")
        raise ValueError(f"Quiz generation failed: {e}")

async def generate_flashcards_strict(policy: GenerationPolicy, context: str, topic: Optional[str] = None, language: str = "en", timeout: Union[int, float, httpx.Timeout] = OLLAMA_GENERATION_TIMEOUT, job_id: Optional[str] = None) -> Dict[str, Any]:
    log = get_job_logger(job_id, "engine-generation")
    start_time = time.perf_counter()
    count = policy.total_count if policy else 15
    prompt = f"Generate EXACTLY {count} distinct study flashcards in {language}.\nThe output MUST be a strict, valid JSON object.\nSCHEMA:\n{{\"type\": \"flashcards\", \"content\": {{\"cards\": [{{\"front\": \"Question/Concept\", \"back\": \"Answer/Definition\"}}]}}}}\nContext:\n{context[:OLLAMA_MAX_CONTEXT_CHARS]}\n"
    num_predict = min(16384, 300 * count)
    payload = {"model": "qwen2.5:7b-instruct", "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.3, "num_thread": 8, "num_batch": 128, "num_ctx": 16384, "num_predict": num_predict}}
    try:
        response = await invoke_ollama(payload, timeout, job_id)
        raw_text = response.json().get("response", "{}")
        repaired_json = PolicyEngine.repair_json_content(raw_text)
        result = json.loads(repaired_json)
        
        # ROBUST PARSING: Handle list vs dict
        if isinstance(result, list):
            content = {"cards": result}
        elif isinstance(result, dict):
            content = result.get("content", result)
            if isinstance(content, dict) and "cards" not in content:
                for v in result.values():
                    if isinstance(v, list):
                        content = {"cards": v}
                        break
        else:
            raise ValueError(f"Unexpected JSON type for flashcards: {type(result)}")

        # STRICT ENFORCEMENT
        if "cards" in content:
            content["cards"] = content["cards"][:count]

        return {
            "type": "flashcards",
            "content": content,
            "metadata": {
                "difficulty": policy.difficulty if policy else "mixed",
                "count": len(content.get("cards", [])),
                "telemetry": {"latency_ms": int((time.perf_counter() - start_time) * 1000)}
            }
        }
    except Exception as e:
        log.error(f"[FLASHCARD_ERROR] {e}")
        raise RuntimeError(f"Flashcard generation strictly failed: {e}")

async def generate_summary_strict(policy: GenerationPolicy, context: str, topic: Optional[str] = None, language: str = "en", timeout: Union[int, float, httpx.Timeout] = OLLAMA_GENERATION_TIMEOUT, job_id: Optional[str] = None, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    log = get_job_logger(job_id, "engine-generation")
    start_time = time.perf_counter()
    prompt = f"Generate a study summary in {language}.\nThe output MUST be a strict, valid JSON object.\nSCHEMA:\n{{\"type\": \"summary\", \"content\": {{\"title\": \"Topic\", \"sections\": [{{\"heading\": \"Section 1\", \"body\": \"...\"}}]}}}}\nContext:\n{context[:OLLAMA_MAX_CONTEXT_CHARS]}\n"
    payload = {
        "model": "qwen2.5:7b-instruct", 
        "prompt": prompt, 
        "stream": False, 
        "format": "json", 
        "keep_alive": "30m", 
        "options": {
            "temperature": 0.4, 
            "num_thread": 8, 
            "num_batch": 128, 
            "num_ctx": 16384,
            "num_predict": 8192
        }
    }
    try:
        response = await invoke_ollama(payload, timeout, job_id)
        raw_text = response.json().get("response", "{}")
        repaired_json = PolicyEngine.repair_json_content(raw_text)
        result = json.loads(repaired_json)

        # ROBUST PARSING: Ensure we return an object with sections
        if isinstance(result, dict):
            content = result.get("content", result)
        else:
            content = {"title": "Summary", "sections": [{"heading": "Overview", "body": str(result)}]}

        if isinstance(content, str):
            try:
                content = json.loads(content)
            except:
                content = {"title": "Summary", "sections": [{"heading": "Overview", "body": content}]}
            
        if isinstance(content, dict) and "sections" not in content:
            # If LLM returned title/sections at top level or in some other key
            sections = content.get("sections") or content.get("data") or content.get("items")
            if sections and isinstance(sections, list):
                content = {"title": content.get("title", "Summary"), "sections": sections}
            else:
                # Wrap everything in a section if it's just a dict of keys
                content = {"title": content.get("title", "Summary"), "sections": [{"heading": "Details", "body": json.dumps(content)}]}

        return {
            "type": "summary",
            "content": content,
            "metadata": {
                "difficulty": policy.difficulty if policy else "mixed",
                "telemetry": {"latency_ms": int((time.perf_counter() - start_time) * 1000)}
            }
        }
    except Exception as e:
        log.error(f"[SUMMARY_ERROR] {e}")
        raise RuntimeError(f"Summary generation strictly failed: {e}")

async def generate_chat_response(query: str, context: str, history: List[Dict[str, str]], language: str = "en", job_id: Optional[str] = None) -> str:
    prompt = f"You are a helpful academic tutor assistant.\nYou answer ONLY using the provided context.\nContext:\n---\n{context[:6000]}\n---\nQuery: {query}"
    try:
        response = await invoke_ollama({"model": "qwen2.5:7b-instruct", "prompt": prompt, "stream": False, "options": {"num_ctx": 8192}}, OLLAMA_CHAT_TIMEOUT, job_id)
        return response.json().get("response", "I'm sorry, I couldn't process that.").strip()
    except Exception as e: raise ValueError(f"Chat generation failed: {e}")

async def evaluate_answer_semantically(question: str, user_answer: str, correct_answer: str, job_id: Optional[str] = None) -> Dict[str, Any]:
    prompt = f"Strictly evaluate the user's answer.\nQuestion: {question}\nCorrect: {correct_answer}\nUser: {user_answer}\nReturn JSON: {{\"score\": 0.0-1.0, \"feedback\": \"...\"}}"
    try:
        response = await invoke_ollama({"model": "qwen2.5:7b-instruct", "prompt": prompt, "stream": False, "format": "json", "options": {"num_ctx": 4096}}, OLLAMA_CHAT_TIMEOUT, job_id)
        data = json.loads(response.json().get("response", "{}"))
        score = float(data.get("score", 0))
        return {"is_correct": score >= 0.7, "score": score, "feedback": data.get("feedback", "")}
    except: return {"is_correct": user_answer.strip().lower() == correct_answer.strip().lower(), "score": 1.0, "feedback": "Exact match fallback."}

def evaluate_quiz(questions: List[Dict[str, Any]], submissions: List[Dict[str, Any]]) -> Dict[str, Any]:
    results = []
    question_map = {q["id"]: q for q in questions}
    for sub in submissions:
        q_id = sub.get("question_id")
        user_ans = str(sub.get("user_answer", "")).strip().lower()
        q = question_map.get(q_id)
        if not q: continue
        is_correct = user_ans == str(q.get("correct_answer", "")).strip().lower()
        results.append({"question_id": q_id, "status": "correct" if is_correct else "wrong", "color": "green" if is_correct else "red", "explanation": q.get("explanation") if not is_correct else None})
    score = sum(1 for r in results if r["status"] == "correct")
    return {"score": score, "total": len(questions), "percentage": (score / len(questions)) * 100 if questions else 0, "results": results}
