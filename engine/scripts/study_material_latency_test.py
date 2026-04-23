import time
import json
import csv
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from requests.exceptions import RequestException

BASE_URL = "http://localhost:8000"
ENDPOINT = f"{BASE_URL}/generate"

SUBJECT_ID = "6a0690ee-9bde-4f6c-b552-4f132ea50927"
MATERIAL_TYPES = ["summary", "quiz", "flashcards", "exam"]

LANGUAGE = "en"
TOP_K = 5  # use enough chunks to simulate real generation

TIMEOUT_SECONDS = 600  # HTTP timeout per request
RUNS_PER_TYPE = 1      # increase to e.g. 3 or 5 for averaging


def test_material_type(material_type: str) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "subject_id": SUBJECT_ID,
        "material_type": material_type,
        "topic": None,
        "language": LANGUAGE,
        "top_k": TOP_K,
    }

    start = time.perf_counter()
    status_code: Optional[int] = None
    response_text: str = ""
    error: Optional[str] = None

    try:
        resp = requests.post(
            ENDPOINT,
            json=payload,
            timeout=TIMEOUT_SECONDS,
        )
        latency = time.perf_counter() - start
        status_code = resp.status_code
        response_text = resp.text or ""
    except RequestException as e:
        latency = time.perf_counter() - start
        error = str(e)

    return {
        "material_type": material_type,
        "latency": latency,
        "status_code": status_code,
        "response_size": len(response_text),
        "error": error,
    }


def print_summary(results: List[Dict[str, Any]]) -> None:
    header = f"{'Material Type':<15} {'Latency (s)':<12} {'Status':<8} {'Resp Size (chars)':<18}"
    print(header)
    print("-" * len(header))

    for r in results:
        status_display = (
            str(r["status_code"]) if r["status_code"] is not None else "ERR"
        )
        flag = "" if (r["error"] is None and r["status_code"] == 200) else "!"
        print(
            f"{r['material_type']:<15} "
            f"{r['latency']:<12.3f} "
            f"{status_display:<8} "
            f"{r['response_size']:<18}{flag}"
        )

    print("\nErrors (if any):")
    any_error = False
    for r in results:
        if r["error"]:
            any_error = True
            print(f"- {r['material_type']}: {r['error']}")
    if not any_error:
        print("None")


def save_results(results: List[Dict[str, Any]], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d-%H%M%S")

    # JSON
    json_path = output_dir / f"study_material_latency_{timestamp}.json"
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # CSV
    csv_path = output_dir / f"study_material_latency_{timestamp}.csv"
    fieldnames = ["material_type", "latency", "status_code", "response_size", "error"]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            writer.writerow(row)

    print(f"Saved JSON results to: {json_path}")
    print(f"Saved CSV results to:  {csv_path}")


def main() -> None:
    print(f"Testing /generate latency on {ENDPOINT}")
    print(f"Subject ID: {SUBJECT_ID}")
    print(f"Material types: {', '.join(MATERIAL_TYPES)}")
    print(f"Runs per type: {RUNS_PER_TYPE}\n")

    results: List[Dict[str, Any]] = []
    for mtype in MATERIAL_TYPES:
        for i in range(RUNS_PER_TYPE):
            print(f"Running test for material_type='{mtype}' run={i+1}/{RUNS_PER_TYPE}...")
            res = test_material_type(mtype)
            results.append(res)

    print("\nLatency Summary:")
    print_summary(results)

    save_results(results, Path("latency_results"))


if __name__ == "__main__":
    main()