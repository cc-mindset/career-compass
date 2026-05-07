"""
Step 3: Post-remap verification
=================================
Confirms every vectorId in the registry returns live data from StatsCan WDS.
Uses getDataFromVectorsAndLatestNPeriods (POST) — the same endpoint that
step1 used successfully. Skips getSeriesInfoFromVector which has an
unreliable API contract.

Exit code 0 = all pass.
"""

import argparse
import sys
import time
import importlib.util
import requests
from pathlib import Path

WDS = "https://www150.statcan.gc.ca/t1/wds/rest"
HEADERS = {"Content-Type": "application/json", "User-Agent": "market-stats-pipeline/1.0"}


def load_registry(fetcher_path: Path) -> list[tuple]:
    spec = importlib.util.spec_from_file_location("fetcher_statscan", fetcher_path)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.ALL_SERIES


def verify_has_data(vector_id: int) -> tuple[bool, str, str]:
    """
    Returns (ok, refPer, value).
    Uses POST /getDataFromVectorsAndLatestNPeriods — same as step1.
    """
    url = f"{WDS}/getDataFromVectorsAndLatestNPeriods"
    payload = [{"vectorId": vector_id, "latestN": 1}]
    try:
        r = requests.post(url, json=payload, headers=HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()
        item = data[0] if isinstance(data, list) and data else data
        if item.get("status") != "SUCCESS":
            return False, "", f"status={item.get('status')}"
        obj    = item.get("object", {})
        points = obj.get("vectorDataPoint", [])
        if not points:
            return False, "", "no data points"
        latest = points[0]
        return True, latest.get("refPer", ""), str(latest.get("value", ""))
    except Exception as e:
        return False, "", str(e)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetcher", default="../src/pipelines/market_stats/fetcher_statscan.py")
    args = parser.parse_args()

    fetcher_path = Path(args.fetcher)
    if not fetcher_path.exists():
        print(f"ERROR: {fetcher_path} not found.")
        sys.exit(1)

    print(f"Loading registry from: {fetcher_path}")
    try:
        registry = load_registry(fetcher_path)
    except Exception as e:
        print(f"ERROR loading registry: {e}")
        sys.exit(1)

    print(f"Found {len(registry)} series\n")
    print(f"{'#':<4} {'VectorId':<14} {'Status':<8} {'refPer':<12} {'Value':<12} Label")
    print("-" * 100)

    passes  = []
    failures = []

    for i, entry in enumerate(registry):
        vector_id = entry[0]
        label     = entry[1]

        ok, ref_per, value = verify_has_data(vector_id)

        if ok:
            print(f"{i+1:<4} {vector_id:<14} {'PASS':<8} {ref_per:<12} {value:<12} {label[:50]}")
            passes.append(vector_id)
        else:
            print(f"{i+1:<4} {vector_id:<14} {'FAIL':<8} {'':12} {'':<12} {label[:50]}")
            print(f"     reason: {value}")
            failures.append({"vector_id": vector_id, "label": label, "reason": value})

        time.sleep(0.2)

    print("\n" + "=" * 60)
    print(f"PASS:  {len(passes)} / {len(registry)}")
    print(f"FAIL:  {len(failures)} / {len(registry)}")

    if failures:
        print("\nFailed series:")
        for f in failures:
            print(f"  vectorId={f['vector_id']}  reason={f['reason']}")
            print(f"    label: {f['label']}")
        sys.exit(1)
    else:
        print("\nAll vectors verified. Registry is clean and production-ready.")
        sys.exit(0)


if __name__ == "__main__":
    main()