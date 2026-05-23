import logging
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import httpx
from pydantic import ValidationError

from ..schemas import PlanGenerateRequest, StudyPlanOutput, StudyPlanContent, PlanSession, GenerationMetadata
from ..generation import OLLAMA_GENERATE_URL, OLLAMA_GENERATION_MODEL

router = APIRouter()
logger = logging.getLogger("engine-api-goals")


def _build_prompt(body: PlanGenerateRequest) -> str:
    goals_text = "\n".join([
        f"- [{g.id}] '{g.title}'"
        f" | type: {g.type}, period: {g.period}, target: {g.target}"
        + (f", subject: {g.subject}" if g.subject else "")
        + (f", current progress: {g.progress_pct}%" if hasattr(g, 'progress_pct') and g.progress_pct is not None else "")
        for g in body.goals
    ])

    sections: list[str] = []

    if body.weak_concepts_context:
        sections.append(
            "WEAK CONCEPTS TO PRIORITISE (from forgetting-curve analysis):\n"
            + body.weak_concepts_context
        )
    if body.subject_mastery_context:
        sections.append(
            "SUBJECT MASTERY LEVELS:\n" + body.subject_mastery_context
        )
    if body.recent_activity_context:
        sections.append(
            "RECENT STUDY ACTIVITY:\n" + body.recent_activity_context
        )

    context_block = ("\n\n" + "\n\n".join(sections)) if sections else ""

    valid_days = "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, or Sunday"

    return f"""You are an expert study planner building a personalised weekly schedule.

USER GOALS:
{goals_text}{context_block}

SCHEDULE CONSTRAINTS:
- Study days per week: {body.days_per_week}
- Average hours per study day: {body.hours_per_day}
- Prioritise any weak concepts listed above — schedule dedicated review sessions for them.
- Link each session to the most relevant goal using its id in the goal_id field.
- Keep session durations realistic (30–120 minutes each).
- Spread sessions across the week; do not stack everything on one day.

Output ONLY the following JSON — no prose, no markdown fences:
{{
  "type": "study_plan",
  "content": {{
    "summary": "<2–3 sentence motivational summary explaining the plan rationale>",
    "sessions": [
      {{
        "day_of_week": "<must be exactly one of: {valid_days}>",
        "duration_minutes": <integer>,
        "focus_topic": "<specific topic or concept>",
        "goal_id": "<goal id string or null>"
      }}
    ]
  }},
  "metadata": {{
    "difficulty": "intermediate",
    "version": "v1"
  }}
}}"""


def _normalize_day_name(day_str: str) -> str:
    if not isinstance(day_str, str):
        return "Monday"
    day_str_lower = day_str.lower()
    if "mon" in day_str_lower:
        return "Monday"
    if "tue" in day_str_lower:
        return "Tuesday"
    if "wed" in day_str_lower:
        return "Wednesday"
    if "thu" in day_str_lower:
        return "Thursday"
    if "fri" in day_str_lower:
        return "Friday"
    if "sat" in day_str_lower:
        return "Saturday"
    if "sun" in day_str_lower:
        return "Sunday"
    return "Monday"


def _try_parse_plan(raw: str) -> dict | None:
    """Try to parse Ollama's raw text into a valid plan dict."""
    # Attempt 1 — direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Attempt 2 — strip markdown fences then parse
    stripped = raw.strip().strip("```json").strip("```").strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    # Attempt 3 — find the first {...} block
    start = raw.find('{')
    end   = raw.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end + 1])
        except json.JSONDecodeError:
            pass
    return None


@router.post("/generate-plan")
async def generate_plan_route(body: PlanGenerateRequest):
    """Generate an adaptive study plan using the user's goals and learning signals."""
    logger.info("generate-plan: %d goals, days_per_week=%d", len(body.goals), body.days_per_week)

    prompt = _build_prompt(body)

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                OLLAMA_GENERATE_URL,
                json={
                    "model":   OLLAMA_GENERATION_MODEL,
                    "prompt":  prompt,
                    "stream":  False,
                    "format":  "json",
                    "options": {"temperature": 0.4, "num_predict": 2048}
                }
            )

        if resp.status_code != 200:
            raise RuntimeError(f"Ollama {resp.status_code}: {resp.text[:200]}")

        raw_response = resp.json().get("response", "{}")
        parsed = _try_parse_plan(raw_response)

        if parsed is None:
            raise RuntimeError("Could not extract valid JSON from Ollama response")

        # Always stamp the model name so GenerationMetadata.model is populated.
        # Ollama's output only contains difficulty/version — it never emits 'model'.
        if isinstance(parsed.get("metadata"), dict):
            parsed["metadata"].setdefault("model", OLLAMA_GENERATION_MODEL)
        else:
            parsed["metadata"] = {
                "model": OLLAMA_GENERATION_MODEL,
                "difficulty": "intermediate",
                "version": "v1",
            }

        # Normalize the day_of_week fields in sessions to match the Literal schema exactly
        if isinstance(parsed.get("content"), dict) and isinstance(parsed["content"].get("sessions"), list):
            for session in parsed["content"]["sessions"]:
                if isinstance(session, dict) and "day_of_week" in session:
                    session["day_of_week"] = _normalize_day_name(session["day_of_week"])

        # Validate through pydantic — raises ValidationError if schema is wrong
        try:
            plan = StudyPlanOutput(**parsed)
        except ValidationError as ve:
            # Schema mismatch is a code bug, not an Ollama failure — surface it clearly.
            logger.error("generate-plan schema validation failed: %s", ve)
            raise HTTPException(status_code=500, detail=f"Plan schema error: {ve}")

        return plan

    except HTTPException:
        raise  # let FastAPI handle it unchanged
    except Exception as exc:
        logger.exception("generate-plan Ollama/network error: %s", exc)
        # Return a minimal valid plan so the frontend doesn't crash on transient failures
        fallback = StudyPlanOutput(
            type="study_plan",
            content=StudyPlanContent(
                summary="Could not generate a personalised plan right now. "
                        "Try again or check that Ollama is running.",
                sessions=[]
            ),
            metadata=GenerationMetadata(
                model=OLLAMA_GENERATION_MODEL,
                difficulty="intermediate",
                version="v1"
            )
        )
        return JSONResponse(
            status_code=200,
            content=fallback.model_dump()
        )
