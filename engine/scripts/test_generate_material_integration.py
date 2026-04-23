import sys
import time
from typing import Any, Dict, Tuple

import requests

BASE_URL = "http://localhost:8000"
GENERATE_URL = f"{BASE_URL}/generate"
JOB_URL = f"{BASE_URL}/job"

SUBJECT_ID = "6a0690ee-9bde-4f6c-b552-4f132ea50927"
MATERIAL_TYPES = ["summary", "quiz", "flashcards", "exam"]

LANGUAGE = "en"
TOP_K = 5

POLL_INTERVAL_SECONDS = 2.0
JOB_TIMEOUT_SECONDS = 600.0


def trigger_generate(material_type: str) -> Tuple[bool, str, Dict[str, Any]]:
    """Call /generate and return (ok, message, payload)."""
    payload = {
        "subject_id": SUBJECT_ID,
        "material_type": material_type,
        "topic": None,
        "language": LANGUAGE,
        "top_k": TOP_K,
    }
    try:
        resp = requests.post(GENERATE_URL, json=payload, timeout=JOB_TIMEOUT_SECONDS)
    except Exception as e:  # network / connection error
        return False, f"/generate request failed: {e}", {}

    try:
        data = resp.json()
    except ValueError:
        return False, f"/generate returned non-JSON body (status={resp.status_code})", {}

    if resp.status_code != 200:
        return False, f"/generate status={resp.status_code} body={data}", {}

    job_id = data.get("job_id")
    if not job_id:
        return False, f"/generate response missing job_id: {data}", {}

    return True, job_id, data


def wait_for_job(job_id: str) -> Tuple[bool, str, Dict[str, Any]]:
    """Poll /job/<job_id> until SUCCESS/FAILURE or timeout."""
    deadline = time.time() + JOB_TIMEOUT_SECONDS
    last_payload: Dict[str, Any] = {}
    last_status: str = ""

    while time.time() < deadline:
        try:
            resp = requests.get(f"{JOB_URL}/{job_id}", timeout=30)
            last_payload = resp.json()
        except Exception as e:
            return False, f"/job poll failed for {job_id}: {e}", {}

        status = last_payload.get("status")
        # NEW: log lifecycle transitions so we can see PENDING -> STARTED -> SUCCESS/FAILURE
        if status and status != last_status:
            print(f"[JOB] {job_id} status={status}")
            last_status = status
        if status in {"SUCCESS", "FAILURE"}:
            return (status == "SUCCESS"), status, last_payload

        time.sleep(POLL_INTERVAL_SECONDS)

    return False, "TIMEOUT", last_payload


def _unwrap_content(material_type: str, content: Any) -> Tuple[Any, str]:
    """Handle wrapper structures such as {"warning": ..., "content": {...}}."""
    warning = ""
    if isinstance(content, dict) and "content" in content and "warning" in content:
        warning = str(content.get("warning") or "")
        content = content.get("content")
    return content, warning


def validate_material(material_type: str, content: Any) -> Tuple[bool, str]:
    """Lightweight structural + non-empty checks per material type."""
    base, warning = _unwrap_content(material_type, content)

    if material_type == "summary":
        if not isinstance(base, str) or not base.strip():
            return False, "summary content is empty or not a string"
        return True, warning or ""

    if not isinstance(base, dict):
        return False, f"{material_type} content is not a JSON object"

    ctype = base.get("type")
    if ctype != material_type:
        return False, f"type field mismatch: expected '{material_type}', got '{ctype}'"

    if material_type == "flashcards":
        cards = base.get("cards") or []
        if not cards:
            return False, "flashcards.cards is empty"
        for idx, card in enumerate(cards):
            if not isinstance(card, dict):
                return False, f"card {idx} is not an object"
            if not card.get("front") or not card.get("back"):
                return False, f"card {idx} missing front/back"
        return True, warning or ""

    if material_type == "quiz":
        questions = base.get("questions") or []
        if not questions:
            return False, "quiz.questions is empty"
        for q in questions:
            if not isinstance(q, dict):
                return False, "quiz question is not an object"
            if not q.get("id") or not q.get("question"):
                return False, "quiz question missing id/question"
            if not q.get("correct_answer"):
                return False, "quiz question missing correct_answer"
        return True, warning or ""

    if material_type == "exam":
        questions = base.get("questions") or []
        answers = base.get("answer_sheet") or []
        if not questions:
            return False, "exam.questions is empty"
        if not answers:
            return False, "exam.answer_sheet is empty"
        for idx, q in enumerate(questions):
            if not isinstance(q, dict):
                return False, f"exam question {idx} is not an object"
            if not q.get("question") or not q.get("answer_space"):
                return False, f"exam question {idx} missing question/answer_space"
        return True, warning or ""

    # Fallback for unexpected type
    return False, f"Unknown material_type '{material_type}'"


def main() -> None:
    overall_ok = True
    print(f"Testing /generate + /job for subject_id={SUBJECT_ID}")
    print(f"Base URL: {BASE_URL}\n")

    for material_type in MATERIAL_TYPES:
        print(f"=== Material type: {material_type} ===")

        ok, info, _ = trigger_generate(material_type)
        if not ok:
            print(f"[FAIL] Trigger /generate: {info}")
            overall_ok = False
            continue

        job_id = info
        print(f"[OK]  /generate accepted job_id={job_id}")

        ok, job_status, job_payload = wait_for_job(job_id)
        if not ok:
            print(f"[FAIL] Job {job_id} ended with status={job_status} payload={job_payload}")
            overall_ok = False
            continue

        result = job_payload.get("result") or {}
        if str(result.get("status") or "").upper() != "SUCCESS":
            print(f"[FAIL] Job {job_id} result.status={result.get('status')} payload={result}")
            overall_ok = False
            continue

        ai_generated_content = result.get("ai_generated_content") or {}
        content = ai_generated_content.get("content") if isinstance(ai_generated_content, dict) else None
        if content is None:
            print(f"[FAIL] Job {job_id} missing ai_generated_content.content payload={result}")
            overall_ok = False
            continue

        valid, msg = validate_material(material_type, content)
        if not valid:
            print(f"[FAIL] Validation failed for {material_type}: {msg}")
            overall_ok = False
        else:
            note = f" ({msg})" if msg else ""
            print(f"[OK]  Validation passed for {material_type}{note}")

        print()

    # NEW: Edge-case checks for /generate validation behaviour. These do not
    # change overall_ok unless the API behaves in a clearly broken way
    # (e.g., 5xx for simple validation errors), but they surface issues in logs.

    # 1) Invalid material_type should be rejected with a 4xx error.
    invalid_payload = {
        "subject_id": SUBJECT_ID,
        "material_type": "invalid_type",
        "topic": None,
        "language": LANGUAGE,
        "top_k": TOP_K,
    }
    try:
        resp = requests.post(GENERATE_URL, json=invalid_payload, timeout=JOB_TIMEOUT_SECONDS)
        if 400 <= resp.status_code < 500:
            print(f"[OK]  /generate rejected invalid material_type with status={resp.status_code}")
        else:
            print(
                f"[WARN] /generate did not clearly reject invalid material_type: status={resp.status_code}, body={resp.text}"
            )
    except Exception as e:
        print(f"[WARN] /generate request for invalid material_type failed with network error: {e}")

    # 2) Unknown subject_id (likely no documents) should not crash the pipeline.
    unknown_subject_payload = {
        "subject_id": "00000000-0000-0000-0000-000000000000",
        "material_type": "summary",
        "topic": None,
        "language": LANGUAGE,
        "top_k": TOP_K,
    }
    try:
        resp = requests.post(GENERATE_URL, json=unknown_subject_payload, timeout=JOB_TIMEOUT_SECONDS)
        data = resp.json()
        if resp.status_code >= 500:
            print(
                f"[FAIL] /generate crashed for unknown subject_id: status={resp.status_code}, body={data}"
            )
            overall_ok = False
        else:
            print(
                f"[OK]  /generate handled unknown subject_id without 5xx: status={resp.status_code}"
            )
    except Exception as e:
        print(f"[WARN] /generate request for unknown subject_id failed with network error: {e}")

    if not overall_ok:
        print("One or more material types failed validation.")
        sys.exit(1)

    print("All material types validated successfully.")


if __name__ == "__main__":
    main()
