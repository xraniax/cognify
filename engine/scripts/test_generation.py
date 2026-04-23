#!/usr/bin/env python3
"""End-to-end tests for the Cognify Engine LLM generation pipeline.

This script:
- Calls the real generation function used by the /generate endpoint
  (services.generation.generate_study_material) for multiple material types.
- Performs a direct sanity check against the Ollama /api/generate endpoint
  using the configured OLLAMA_GENERATION_MODEL (expected: qwen2.5:3b).

It assumes the Ollama GPU container is reachable at OLLAMA_BASE_URL and that
OLLAMA_GENERATION_MODEL is set in the environment.
"""

import os
import sys
import time
import logging
from typing import Any, Dict, Tuple

import requests

# Ensure we can import the engine services when run as a script
sys.path.insert(0, os.path.dirname(__file__))

from services.generation import (
    generate_study_material,
    OLLAMA_GENERATION_MODEL,
    OLLAMA_BASE_URL,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("test-generation")

# Mirror the material types that /generate supports
MATERIAL_TYPES = ["summary", "quiz", "flashcards", "exam"]

OLLAMA_GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"


def _unwrap_content(material_type: str, content: Any) -> Tuple[Any, str]:
    """Reuse the same wrapper logic as integration tests.

    Some generation responses may be wrapped as {"warning": str, "content": {...}}.
    Returns (inner_content, warning_message).
    """
    warning = ""
    if isinstance(content, dict) and "content" in content and "warning" in content:
        warning = str(content.get("warning") or "")
        content = content.get("content")
    return content, warning


def validate_material(material_type: str, content: Any) -> Tuple[bool, str]:
    """Structural + non-empty checks per material type (copied from integration test).

    This ensures we are not getting empty or malformed outputs from the LLM.
    """
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


def test_generation_pipeline() -> bool:
    """Call the real generation pipeline used by /generate.

    Uses services.generation.generate_study_material with a small synthetic
    context to ensure:
    - qwen2.5:3b (via OLLAMA_GENERATION_MODEL) is invoked
    - responses are non-empty
    - structures for quiz/flashcards/exam are valid JSON
    """
    overall_ok = True

    model_name = OLLAMA_GENERATION_MODEL or "<UNSET>"
    logger.info("Generation model from env: %s", model_name)
    logger.info("Ollama generate URL: %s", OLLAMA_GENERATE_URL)

    if not OLLAMA_GENERATION_MODEL:
        logger.error(
            "OLLAMA_GENERATION_MODEL is not set; expected a real model name "
            "(e.g. 'qwen2.5:3b'). Configure it in engine/.env or your shell "
            "environment before running generation tests."
        )
        return False

    # Simple but rich enough context for all material types
    base_chunks = [
        """Machine learning is a subfield of artificial intelligence that focuses on
        algorithms which learn patterns from data. Supervised, unsupervised, and
        reinforcement learning are key paradigms. Neural networks, decision trees,
        and gradient boosting are common model families used in modern ML systems."""
    ]

    for material_type in MATERIAL_TYPES:
        logger.info("=== Testing generation pipeline for material_type=%s ===", material_type)
        try:
            started = time.perf_counter()
            content = generate_study_material(
                base_chunks,
                material_type=material_type,
                topic="machine learning",
                language="en",
                retries=1,
            )
            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.info("Generation call completed in %d ms", duration_ms)

            valid, msg = validate_material(material_type, content)
            if not valid:
                logger.error("[FAIL] %s generation invalid: %s", material_type, msg)
                overall_ok = False
            else:
                note = f" ({msg})" if msg else ""
                logger.info("[OK]  %s generation valid%s", material_type, note)
        except Exception as e:
            logger.exception("[FAIL] Exception during %s generation: %s", material_type, e)
            overall_ok = False

    return overall_ok


def test_direct_ollama_generate() -> bool:
    """Direct sanity test against Ollama /api/generate.

    Uses the configured OLLAMA_GENERATION_MODEL (expected: qwen2.5:3b) and a
    simple prompt, checking that:
    - the model responds without error
    - response body is non-empty
    - latency is reasonable (logged, not enforced)
    """
    if not OLLAMA_GENERATION_MODEL:
        logger.error(
            "OLLAMA_GENERATION_MODEL is not set; cannot run direct Ollama sanity test. "
            "Configure it in engine/.env or your environment."
        )
        return False

    model_name = OLLAMA_GENERATION_MODEL
    prompt = "Generate a short study summary about machine learning."

    payload: Dict[str, Any] = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
    }

    logger.info("Direct Ollama sanity test: url=%s model=%s", OLLAMA_GENERATE_URL, model_name)

    try:
        started = time.perf_counter()
        resp = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=300)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
    except Exception as e:
        logger.error("[FAIL] Direct Ollama request failed: %s", e)
        return False

    if resp.status_code != 200:
        logger.error("[FAIL] Ollama status=%s body=%s", resp.status_code, resp.text)
        return False

    try:
        data = resp.json()
    except ValueError:
        logger.error("[FAIL] Ollama returned non-JSON body: %s", resp.text[:200])
        return False

    text = (data.get("response") or "").strip()
    if not text:
        logger.error("[FAIL] Ollama JSON missing/empty 'response' field: %s", data)
        return False

    logger.info("[OK]  Ollama responded in %d ms, %d chars", elapsed_ms, len(text))
    logger.debug("Ollama response preview: %s", text[:200])
    return True


def main() -> int:
    logger.info("Starting generation pipeline tests...")

    pipeline_ok = test_generation_pipeline()
    direct_ok = test_direct_ollama_generate()

    logger.info("\nSummary:")
    logger.info("- Generation pipeline (generate_study_material): %s", "OK" if pipeline_ok else "FAIL")
    logger.info("- Direct Ollama /api/generate: %s", "OK" if direct_ok else "FAIL")

    if pipeline_ok and direct_ok:
        logger.info("All generation tests passed.")
        return 0

    logger.error("Generation tests failed. Check Ollama logs and configuration.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
