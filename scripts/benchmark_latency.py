#!/usr/bin/env python3
"""
scripts/benchmark_latency.py
=============================
Cognify end-to-end AI generation latency benchmark.

Measures REAL wall-clock latency by calling the live backend API over HTTP.
No production code is modified. No business logic is bypassed.
All measurements include: auth overhead, backend routing, pgvector HNSW
retrieval, Ollama (Qwen2.5:3B) inference, and DB write.

Pipeline coverage
-----------------
  quiz        → POST /generate-combined/stream  (pgvector RAG + LLM, T=0.8 default)
  summary     → POST /generate-combined/stream  (MAP T=0.1 + REDUCE T=0.7)
  flashcards  → POST /generate-combined/stream  (pgvector RAG + LLM, T=0.8 default)
  exam        → POST /generate-combined/stream  (Adaptive Profile + pgvector + LLM)
  ocr         → POST /upload → poll COMPLETED   (Celery: task_ocr→chunk→embed→store)

Requirements
------------
  pip install httpx          # preferred
  # or: pip install requests  # fallback

Usage examples
--------------
  # Fastest start — auto-create subject + upload sample text, then benchmark all:
  python scripts/benchmark_latency.py \\
      --email user@example.com --password secret --setup

  # Use an existing subject that already has ingested documents:
  python scripts/benchmark_latency.py \\
      --email user@example.com --password secret \\
      --subject-id <uuid> --material-ids <uuid1> [<uuid2> ...]

  # 10 runs, 2 warmup, include OCR benchmark, save results:
  python scripts/benchmark_latency.py \\
      --email user@example.com --password secret --setup \\
      --runs 10 --warmup 2 \\
      --ocr-file /path/to/sample.pdf \\
      --save-json results.json --save-csv results.csv --verbose

  # Selective cases only:
  python scripts/benchmark_latency.py \\
      --email user@example.com --password secret --setup \\
      --cases quiz summary
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── HTTP library detection ────────────────────────────────────────────────────
try:
    import httpx as _httpx
except ImportError:
    _httpx = None  # type: ignore[assignment]

try:
    import requests as _requests
except ImportError:
    _requests = None  # type: ignore[assignment]

if _httpx is None and _requests is None:
    print(
        "ERROR: no HTTP library found.\n"
        "Install one of:  pip install httpx   OR   pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Constants (all overridable via env or CLI) ────────────────────────────────
_DEFAULT_BACKEND = os.environ.get("COGNIFY_BACKEND_URL", "http://localhost:5000")
_STREAM_TIMEOUT  = int(os.environ.get("BENCH_STREAM_TIMEOUT",  "600"))  # generous for CPU
_POLL_TIMEOUT    = int(os.environ.get("BENCH_POLL_TIMEOUT",    "600"))
_POLL_INTERVAL   = float(os.environ.get("BENCH_POLL_INTERVAL",  "3"))

# ── Sample academic text used when --setup creates a fresh document ───────────
_SAMPLE_TEXT = """\
Introduction to Machine Learning

Machine learning (ML) is a branch of artificial intelligence that enables systems
to learn from data without being explicitly programmed.

Three main paradigms exist:

Supervised Learning trains models on labeled examples. Algorithms include linear
regression, logistic regression, support vector machines, decision trees, random
forests, and deep neural networks. Performance is assessed via accuracy, precision,
recall, and F1-score.

Unsupervised Learning finds hidden structure in unlabeled data. K-means and DBSCAN
cluster similar examples. PCA and autoencoders reduce high-dimensional data.

Reinforcement Learning trains agents through reward signals. The agent takes actions
and receives rewards or penalties. Key algorithms: Q-learning, SARSA, and PPO.

Key Concepts
- Bias-variance tradeoff: high bias causes underfitting; high variance causes overfitting.
- Regularisation: L1 (Lasso) and L2 (Ridge) penalties constrain model weights.
- Cross-validation: k-fold CV produces an unbiased estimate of generalisation error.
- Gradient descent: iteratively minimises a loss function via partial derivatives.
- Backpropagation: efficiently computes gradients in multi-layer neural networks.

Applications
Image recognition, natural language processing, recommender systems, autonomous
driving, medical image analysis, fraud detection, and speech recognition.
"""

# ─────────────────────────────────────────────────────────────────────────────
# Low-level HTTP helpers
# ─────────────────────────────────────────────────────────────────────────────

def _post_json(url: str, body: dict, headers: dict, timeout: int = 60) -> dict:
    """Blocking JSON POST, returns parsed response body."""
    if _httpx:
        r = _httpx.post(url, json=body, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.json()
    r = _requests.post(url, json=body, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _post_form(
    url: str,
    data: dict,
    files: Optional[dict],
    headers: dict,
    timeout: int = 120,
) -> dict:
    """Multipart form POST (used for /upload endpoint)."""
    if _httpx:
        r = _httpx.post(url, data=data, files=files, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.json()
    r = _requests.post(url, data=data, files=files, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _get_json(url: str, headers: dict, timeout: int = 30) -> dict:
    """Blocking JSON GET."""
    if _httpx:
        r = _httpx.get(url, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.json()
    r = _requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _consume_sse_until_done(
    url: str,
    body: dict,
    headers: dict,
    timeout: int,
) -> float:
    """
    POST to an SSE endpoint, consume the full stream, return elapsed seconds.

    Timer starts immediately before the HTTP request is issued and stops when a
    terminal event is detected.  This measures:
        network round-trip + pgvector retrieval + Ollama inference + DB write

    Terminal signals (matching engine/services/routes/generation.py):
      data: [DONE]                           — normal end-of-stream marker
      data: {"is_final": true, ...}          — explicit final-chunk flag
      data: {"status": "SUCCESS"|"FAILURE"}  — status-based termination
      data: [ERROR] ...                      — error during generation
    """
    h = {**headers, "Accept": "text/event-stream", "Cache-Control": "no-cache"}

    def _is_terminal(raw_line: str) -> bool:
        line = raw_line.strip()
        if not line.startswith("data:"):
            return False
        payload = line[len("data:"):].strip()
        if payload in ("[DONE]", ""):
            return payload == "[DONE]"
        if payload.startswith("[ERROR]"):
            return True
        try:
            obj = json.loads(payload)
            if obj.get("is_final"):
                return True
            if obj.get("status") in {"SUCCESS", "FAILURE", "FAILED"}:
                return True
        except (json.JSONDecodeError, AttributeError):
            pass
        return False

    start = time.perf_counter()

    if _httpx:
        with _httpx.Client(timeout=_httpx.Timeout(timeout)) as client:
            with client.stream("POST", url, json=body, headers=h) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if _is_terminal(line):
                        break
    else:
        with _requests.post(
            url, json=body, headers=h, stream=True, timeout=timeout
        ) as resp:
            resp.raise_for_status()
            for raw in resp.iter_lines(decode_unicode=True):
                if raw and _is_terminal(raw):
                    break

    return time.perf_counter() - start


# ─────────────────────────────────────────────────────────────────────────────
# Authentication
# ─────────────────────────────────────────────────────────────────────────────

def login(backend: str, email: str, password: str) -> str:
    """POST /api/auth/login → JWT token string."""
    resp = _post_json(
        f"{backend}/api/auth/login",
        {"email": email, "password": password},
        headers={},
        timeout=20,
    )
    token = resp.get("data", {}).get("token") or resp.get("token")
    if not token:
        raise RuntimeError(
            f"Login failed — no token in response.\n{json.dumps(resp, indent=2)}"
        )
    return token


def _bearer(token: str) -> Dict[str, str]:
    """Auth header only (no Content-Type — let the library set it per request)."""
    return {"Authorization": f"Bearer {token}"}


def _bearer_json(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─────────────────────────────────────────────────────────────────────────────
# Subject helpers
# ─────────────────────────────────────────────────────────────────────────────

def create_subject(backend: str, token: str, name: str) -> str:
    """POST /api/subjects → UUID of the created subject."""
    resp = _post_json(
        f"{backend}/api/subjects",
        {"name": name, "description": "Created by benchmark_latency.py — safe to delete"},
        headers=_bearer_json(token),
    )
    sid = resp.get("data", {}).get("id")
    if not sid:
        raise RuntimeError(f"Subject creation failed: {resp}")
    return sid


# ─────────────────────────────────────────────────────────────────────────────
# Document upload helpers
# ─────────────────────────────────────────────────────────────────────────────

def upload_text(
    backend: str,
    token: str,
    subject_id: str,
    text: str,
    title: str,
) -> str:
    """
    POST /api/materials/upload with raw text content (no file).
    The backend sends this to engine /process-document which runs the full
    Celery ingestion chain: text → chunk → embed (nomic-embed-text) → pgvector.
    Returns the material UUID.
    """
    resp = _post_form(
        f"{backend}/api/materials/upload",
        data={
            "title": title,
            "content": text,
            "type": "upload",
            "subjectId": subject_id,
            "skipDuplicateCheck": "true",  # avoid 409 on repeated benchmark runs
        },
        files=None,
        headers=_bearer(token),
    )
    mat_id = resp.get("data", {}).get("id")
    if not mat_id:
        raise RuntimeError(f"Text upload failed: {resp}")
    return mat_id


def upload_file(
    backend: str,
    token: str,
    subject_id: str,
    file_path: str,
    title: str,
) -> str:
    """
    POST /api/materials/upload with a binary file (PDF / image).
    Triggers the full OCR Celery chain:
        task_ocr → task_chunk → task_embed → task_store
    Returns the material UUID.
    """
    p = Path(file_path)
    suffix = p.suffix.lower()
    mime_map = {
        ".pdf":  "application/pdf",
        ".png":  "image/png",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    mime = mime_map.get(suffix, "application/octet-stream")

    with open(p, "rb") as fh:
        resp = _post_form(
            f"{backend}/api/materials/upload",
            data={
                "title": title,
                "type": "upload",
                "subjectId": subject_id,
                "skipDuplicateCheck": "true",
            },
            files={"file": (p.name, fh, mime)},
            headers=_bearer(token),
        )
    mat_id = resp.get("data", {}).get("id")
    if not mat_id:
        raise RuntimeError(f"File upload failed: {resp}")
    return mat_id


def poll_until_completed(
    backend: str,
    token: str,
    material_id: str,
    label: str = "",
) -> float:
    """
    Poll GET /api/materials/:id/sync until status == COMPLETED or FAILED.
    The /sync endpoint triggers checkJobStatus() on the backend which polls the
    engine job (Redis text job or Celery) and writes the result to the DB.
    Without /sync the status stays PROCESSING forever because the backend never
    proactively polls the engine job result.
    Returns elapsed seconds from the first poll call.
    """
    start    = time.perf_counter()
    deadline = start + _POLL_TIMEOUT
    last_status = ""

    while time.perf_counter() < deadline:
        elapsed = time.perf_counter() - start
        try:
            resp   = _get_json(f"{backend}/api/materials/{material_id}/sync", headers=_bearer_json(token))
            status = resp.get("data", {}).get("status", "UNKNOWN")
        except Exception as exc:
            print(f"      [{elapsed:>5.0f}s]  poll error: {exc}", flush=True)
            time.sleep(_POLL_INTERVAL)
            continue

        # Print on every status change, or every 15 s regardless
        if status != last_status or int(elapsed) % 15 == 0:
            print(f"      [{elapsed:>5.0f}s]  status={status}", flush=True)
            last_status = status

        if status == "COMPLETED":
            return elapsed
        if status in ("FAILED", "ERROR", "FAILED_JOB"):
            raise RuntimeError(
                f"Material {material_id} {label} ended with status={status!r}"
            )
        time.sleep(_POLL_INTERVAL)

    raise TimeoutError(
        f"Material {material_id} {label} did not reach COMPLETED within {_POLL_TIMEOUT}s"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Core benchmark functions
# ─────────────────────────────────────────────────────────────────────────────

def bench_generation(
    backend: str,
    token: str,
    subject_id: str,
    material_ids: List[str],
    task_type: str,
    gen_options: Dict[str, Any],
) -> float:
    """
    Measure one streaming generation request end-to-end.

    Path:  POST /api/materials/generate-combined/stream
             → backend validates materialIds (must be COMPLETED uploads)
             → engine POST /generate/stream  (synchronous SSE, no Celery)
                 → pgvector HNSW cosine retrieval (top_k=20)
                 → Ollama Qwen2.5:3B inference
                 → DB write (materials table)
             → SSE stream piped back to client

    Returns wall-clock seconds from request start → final [DONE] event.
    """
    return _consume_sse_until_done(
        url=f"{backend}/api/materials/generate-combined/stream",
        body={
            "materialIds": material_ids,
            "taskType":    task_type,
            "subjectId":   subject_id,
            "genOptions":  gen_options,
        },
        headers=_bearer_json(token),
        timeout=_STREAM_TIMEOUT,
    )


def bench_ocr_pipeline(
    backend: str,
    token: str,
    subject_id: str,
    file_path: str,
) -> float:
    """
    Measure the full Celery OCR ingestion pipeline.

    Path:  POST /api/materials/upload (file)
             → backend → engine POST /process-document
                 → Celery: task_ocr (pytesseract) → task_chunk → task_embed
                           (nomic-embed-text) → task_store (pgvector)
             → poll GET /api/materials/:id until COMPLETED

    Returns wall-clock seconds from upload POST start → COMPLETED status.
    """
    start  = time.perf_counter()
    mat_id = upload_file(
        backend, token, subject_id, file_path,
        title=f"bench-ocr-{int(time.time())}",
    )
    poll_until_completed(backend, token, mat_id, label="(OCR pipeline)")
    return time.perf_counter() - start


# ─────────────────────────────────────────────────────────────────────────────
# Statistics
# ─────────────────────────────────────────────────────────────────────────────

def _compute_stats(samples: List[float]) -> Dict[str, float]:
    n = len(samples)
    return {
        "avg":    round(statistics.mean(samples), 2),
        "min":    round(min(samples), 2),
        "max":    round(max(samples), 2),
        "stddev": round(statistics.stdev(samples) if n > 1 else 0.0, 3),
        "n":      n,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test-case runner
# ─────────────────────────────────────────────────────────────────────────────

def run_case(
    name: str,
    fn,
    runs: int,
    warmup: int,
    verbose: bool,
) -> Dict[str, Any]:
    """
    Execute fn() for (warmup + runs) iterations.
    Discards warmup results, computes stats over the benchmark runs only.
    Catches per-run exceptions and records them as errors without aborting.
    """
    measurements: List[float] = []
    errors = 0
    total  = warmup + runs

    for i in range(total):
        is_warmup = i < warmup
        tag = (
            f"warmup {i + 1}/{warmup}" if is_warmup
            else f"run {i - warmup + 1}/{runs}"
        )
        try:
            t = fn()
            if verbose:
                discard = "  (discarded)" if is_warmup else ""
                print(f"    [{tag}]  {t:.2f}s{discard}")
            if not is_warmup:
                measurements.append(t)
        except Exception as exc:
            print(f"    [{tag}]  ERROR: {exc}", file=sys.stderr)
            if not is_warmup:
                errors += 1

    valid = [x for x in measurements if not math.isnan(x)]
    if not valid:
        return {
            "name": name, "avg": None, "min": None,
            "max": None, "stddev": None, "n": 0, "errors": errors,
        }

    result         = _compute_stats(valid)
    result["name"] = name
    result["errors"] = errors
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

# Column widths for the results table
_W = {"name": 46, "avg": 8, "min": 7, "max": 7, "stddev": 9, "n": 4, "errors": 7}


def _fmt(v: Optional[float], width: int, decimals: int = 2) -> str:
    if v is None:
        return "ERR".rjust(width)
    return f"{v:.{decimals}f}".rjust(width)


def print_table(results: List[Dict[str, Any]]) -> None:
    header = (
        f"{'Test Case':<{_W['name']}}"
        f"{'Avg(s)':>{_W['avg']}}"
        f"{'Min(s)':>{_W['min']}}"
        f"{'Max(s)':>{_W['max']}}"
        f"{'StdDev':>{_W['stddev']}}"
        f"{'N':>{_W['n']}}"
        f"{'Errors':>{_W['errors']}}"
    )
    sep = "─" * len(header)

    print()
    print(sep)
    print(header)
    print(sep)
    for r in results:
        name = r["name"]
        if len(name) > _W["name"] - 1:
            name = name[: _W["name"] - 4] + "..."
        print(
            f"{name:<{_W['name']}}"
            f"{_fmt(r.get('avg'),    _W['avg'])}"
            f"{_fmt(r.get('min'),    _W['min'])}"
            f"{_fmt(r.get('max'),    _W['max'])}"
            f"{_fmt(r.get('stddev'), _W['stddev'], 3)}"
            f"{r.get('n', 0):>{_W['n']}}"
            f"{r.get('errors', 0):>{_W['errors']}}"
        )
    print(sep)
    print()


def save_json(results: List[Dict[str, Any]], path: str) -> None:
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model":        os.environ.get("OLLAMA_GENERATION_MODEL", "qwen2.5:3b"),
        "results":      results,
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)
    print(f"  Saved JSON → {path}")


def save_csv(results: List[Dict[str, Any]], path: str) -> None:
    fields = ["name", "avg", "min", "max", "stddev", "n", "errors"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in results:
            w.writerow({k: r.get(k, "") for k in fields})
    print(f"  Saved CSV  → {path}")


# ─────────────────────────────────────────────────────────────────────────────
# CLI definition
# ─────────────────────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="benchmark_latency.py",
        description="Cognify end-to-end AI generation latency benchmark",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        epilog=(
            "The --setup flag is the easiest way to start: it creates a fresh\n"
            "benchmark subject, uploads a built-in sample text, waits for Celery\n"
            "ingestion to complete, then runs the generation benchmarks.\n\n"
            "Re-running with the same --subject-id and --material-ids skips setup\n"
            "and is faster (no ingestion overhead between runs)."
        ),
    )

    grp_conn = p.add_argument_group("Connection")
    grp_conn.add_argument(
        "--backend-url", default=_DEFAULT_BACKEND, metavar="URL",
        help="Cognify backend base URL (also reads COGNIFY_BACKEND_URL env var)",
    )
    grp_conn.add_argument("--email",    required=True, help="Cognify account e-mail")
    grp_conn.add_argument("--password", required=True, help="Cognify account password")

    grp_scope = p.add_argument_group("Scope")
    grp_scope.add_argument(
        "--setup", action="store_true",
        help="Auto-create a benchmark subject + upload built-in sample text, "
             "then wait for Celery ingestion before benchmarking",
    )
    grp_scope.add_argument(
        "--subject-id", metavar="UUID",
        help="Pre-existing subject UUID that already has ingested documents "
             "(required when --setup is not used)",
    )
    grp_scope.add_argument(
        "--material-ids", nargs="+", metavar="UUID",
        help="Uploaded material UUIDs to scope the RAG context (required when "
             "--setup is not used, as /generate-combined/stream requires at "
             "least one materialId)",
    )

    grp_bench = p.add_argument_group("Benchmark control")
    grp_bench.add_argument(
        "--cases", nargs="+",
        choices=["quiz", "summary", "flashcards", "exam", "ocr", "all"],
        default=["all"],
        help="Which test cases to run (ocr also requires --ocr-file)",
    )
    grp_bench.add_argument(
        "--runs",   type=int, default=5,
        help="Number of timed benchmark runs per case (warmup runs not counted)",
    )
    grp_bench.add_argument(
        "--warmup", type=int, default=1,
        help="Runs to perform and discard before timing starts "
             "(warms Ollama model into VRAM)",
    )
    grp_bench.add_argument(
        "--ocr-file", metavar="PATH",
        help="PDF or image file to use for the OCR pipeline benchmark",
    )

    grp_gen = p.add_argument_group("Generation parameters")
    grp_gen.add_argument(
        "--count", type=int, default=10,
        help="Questions / flashcards to generate (maps to genOptions.count)",
    )
    grp_gen.add_argument(
        "--difficulty", default="intermediate",
        choices=["introductory", "intermediate", "advanced"],
        help="Difficulty level for quiz / flashcard / exam cases",
    )
    grp_gen.add_argument(
        "--language", default="en",
        help="Language code for generated content (e.g. en, fr, ar)",
    )

    grp_out = p.add_argument_group("Output")
    grp_out.add_argument("--save-json", metavar="FILE", help="Save results to JSON file")
    grp_out.add_argument("--save-csv",  metavar="FILE", help="Save results to CSV file")
    grp_out.add_argument(
        "--verbose", action="store_true",
        help="Print wall-clock latency of every individual run",
    )

    return p


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    args    = _build_parser().parse_args()
    backend = args.backend_url.rstrip("/")

    want    = set(args.cases)
    run_all = "all" in want
    do_quiz      = run_all or "quiz"       in want
    do_summary   = run_all or "summary"    in want
    do_flashcard = run_all or "flashcards" in want
    do_exam      = run_all or "exam"       in want
    do_ocr       = (run_all or "ocr" in want) and bool(args.ocr_file)

    # ── Banner ────────────────────────────────────────────────────────────────
    print()
    print("═" * 62)
    print("  Cognify — End-to-End Latency Benchmark")
    print(f"  Backend  : {backend}")
    print(f"  Model    : {os.environ.get('OLLAMA_GENERATION_MODEL', 'qwen2.5:3b')}")
    print(f"  Runs     : {args.runs}  |  Warmup : {args.warmup}")
    print(f"  Count    : {args.count}  |  Difficulty : {args.difficulty}")
    print("═" * 62)

    # ── 1. Authenticate ───────────────────────────────────────────────────────
    print(f"\n[1/3] Authenticating as {args.email} ...")
    token = login(backend, args.email, args.password)
    print("      ✓ token acquired")

    # ── 2. Subject + document setup ───────────────────────────────────────────
    subject_id   = args.subject_id
    material_ids: List[str] = list(args.material_ids or [])

    if args.setup:
        print("\n[2/3] Setup — creating benchmark subject ...")
        bench_tag  = int(time.time())
        subject_id = create_subject(backend, token, f"bench-{bench_tag}")
        print(f"      ✓ subject: {subject_id}")

        doc_title = f"bench-ml-intro-{bench_tag}"
        print(f"      Uploading sample text as '{doc_title}' ...")
        mat_id = upload_text(
            backend, token, subject_id, _SAMPLE_TEXT, title=doc_title
        )
        print(f"      ✓ material uploaded: {mat_id}")
        print(
            f"      Waiting for Celery ingestion "
            f"(chunk → embed via nomic-embed-text → pgvector) ..."
        )
        try:
            t_ingest = poll_until_completed(backend, token, mat_id, "(ingestion)")
            material_ids = [mat_id]
            print(f"      ✓ ingestion completed in {t_ingest:.1f}s")
        except (TimeoutError, RuntimeError) as exc:
            print(f"      ✗ ingestion failed: {exc}", file=sys.stderr)
            print(
                "      Cannot proceed without a COMPLETED document.\n"
                "      Try:  --subject-id <uuid> --material-ids <uuid>",
                file=sys.stderr,
            )
            sys.exit(1)

    else:
        # Manual mode — validate required args
        if not subject_id:
            print(
                "\nERROR: --subject-id is required when not using --setup.\n"
                "       Pass a subject UUID that already has ingested documents,\n"
                "       or use --setup to auto-create one.",
                file=sys.stderr,
            )
            sys.exit(1)
        if not material_ids:
            print(
                "\nERROR: --material-ids is required when not using --setup.\n"
                "       The /generate-combined/stream endpoint requires at least\n"
                "       one materialId pointing to a COMPLETED upload.\n"
                "       Use --setup to handle this automatically.",
                file=sys.stderr,
            )
            sys.exit(1)

        print(f"\n[2/3] Using subject  : {subject_id}")
        print(f"      Material IDs   : {material_ids}")

    # ── 3. Benchmarks ─────────────────────────────────────────────────────────
    print("\n[3/3] Running benchmarks ...\n")

    base_opts: Dict[str, Any] = {
        "language":   args.language,
        "difficulty": args.difficulty,
        "count":      args.count,
    }
    results: List[Dict[str, Any]] = []

    # ── Quiz ──────────────────────────────────────────────────────────────────
    if do_quiz:
        print(
            f"▶  Quiz  "
            f"({args.count}q, {args.difficulty}, top_k=20, T=0.8 Ollama default)"
        )
        results.append(run_case(
            name=f"Quiz ({args.count}q, {args.difficulty}, top_k=20)",
            fn=lambda: bench_generation(
                backend, token, subject_id, material_ids,
                task_type="quiz",
                gen_options={**base_opts},
            ),
            runs=args.runs, warmup=args.warmup, verbose=args.verbose,
        ))

    # ── Summary ───────────────────────────────────────────────────────────────
    if do_summary:
        print(
            f"\n▶  Summary  "
            f"(concise_summary mode, T=0.1 MAP / T=0.7 REDUCE)"
        )
        results.append(run_case(
            name="Summary (concise_summary, T=0.7 REDUCE)",
            fn=lambda: bench_generation(
                backend, token, subject_id, material_ids,
                task_type="summary",
                gen_options={**base_opts, "summary_mode": "concise_summary"},
            ),
            runs=args.runs, warmup=args.warmup, verbose=args.verbose,
        ))

    # ── Flashcards ────────────────────────────────────────────────────────────
    if do_flashcard:
        print(
            f"\n▶  Flashcards  "
            f"({args.count} cards, {args.difficulty}, T=0.8 Ollama default)"
        )
        results.append(run_case(
            name=f"Flashcards ({args.count} cards, {args.difficulty})",
            fn=lambda: bench_generation(
                backend, token, subject_id, material_ids,
                task_type="flashcards",
                gen_options={**base_opts},
            ),
            runs=args.runs, warmup=args.warmup, verbose=args.verbose,
        ))

    # ── Adaptive exam ─────────────────────────────────────────────────────────
    if do_exam:
        print(
            f"\n▶  Adaptive exam  "
            f"({args.count}q, difficulty=adaptive, dynamic timeout)"
        )
        results.append(run_case(
            name=f"Exam ({args.count}q, adaptive, Adaptive Profile Svc)",
            fn=lambda: bench_generation(
                backend, token, subject_id, material_ids,
                task_type="mock_exam",
                # "adaptive" triggers Adaptive Profile Service lookup
                # (blended Redis + PostgreSQL mastery) and injects weak
                # concepts into the prompt
                gen_options={**base_opts, "difficulty": "adaptive"},
            ),
            runs=args.runs, warmup=args.warmup, verbose=args.verbose,
        ))

    # ── OCR pipeline ──────────────────────────────────────────────────────────
    if do_ocr:
        print(
            f"\n▶  OCR pipeline  "
            f"({Path(args.ocr_file).name})"
        )
        print(
            "   Measures: upload POST → task_ocr (pytesseract) → "
            "task_chunk → task_embed → COMPLETED"
        )
        results.append(run_case(
            name="OCR pipeline (upload → task_ocr → chunk → embed)",
            fn=lambda: bench_ocr_pipeline(
                backend, token, subject_id, args.ocr_file
            ),
            runs=args.runs, warmup=args.warmup, verbose=args.verbose,
        ))
    elif run_all and not args.ocr_file:
        print(
            "\n   (OCR benchmark skipped — "
            "provide --ocr-file <path.pdf> to enable it)"
        )

    # ── Print results ─────────────────────────────────────────────────────────
    print_table(results)

    if args.setup:
        print(
            f"  Benchmark subject: {subject_id}\n"
            f"  (You can reuse it with: --subject-id {subject_id} "
            f"--material-ids {' '.join(material_ids)})\n"
        )

    if args.save_json:
        save_json(results, args.save_json)
    if args.save_csv:
        save_csv(results, args.save_csv)


if __name__ == "__main__":
    main()
