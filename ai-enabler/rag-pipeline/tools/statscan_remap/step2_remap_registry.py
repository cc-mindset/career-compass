"""
Step 2 (revised): Remap StatsCan registry in fetcher_statscan.py
=================================================================
Reads statscan_live_vectors.json and replaces the entire series registry
in fetcher_statscan.py with verified live vectorIds.

Handles any variable naming convention in the existing file — finds all
series list variables and ALL_SERIES, replaces the whole block.

Usage:
    python step2_remap_registry.py \
        --vectors statscan_live_vectors.json \
        --fetcher ../src/pipelines/market_stats/fetcher_statscan.py
"""

import argparse
import json
import re
import shutil
import importlib.util
from pathlib import Path
from datetime import datetime

REGISTRY_START = "# --- REGISTRY START (managed by step2_remap_registry.py) ---"
REGISTRY_END   = "# --- REGISTRY END ---"

TABLE_SOURCE_MAP = {
    14100355: "14-10-0355-01",
    14100287: "14-10-0287-01",
    14100421: "14-10-0421-01",
    14100442: "14-10-0442-01",
    14100220: "14-10-0220-01",
}

GROUP_NAMES = {
    14100355: "LFS_EMPLOYMENT",
    14100287: "LFS_PROVINCE",
    14100421: "LFS_OCCUPATION",
    14100442: "JVWS",
    14100220: "SEPH",
}

GROUP_COMMENTS = {
    14100355: "LFS Employment by industry, monthly SA (14-10-0355-01)",
    14100287: "LFS Labour force by province, monthly SA (14-10-0287-01)",
    14100421: "LFS Labour force by occupation NOC, monthly (14-10-0421-01)",
    14100442: "JVWS Job vacancies by industry sub-sector, quarterly (14-10-0442-01)",
    14100220: "SEPH Avg weekly earnings + employment by industry, monthly SA (14-10-0220-01)",
}


def format_tuple(e: dict) -> str:
    table_ref = TABLE_SOURCE_MAP.get(e["productId"], str(e["productId"]))
    return (
        f'    ({e["vectorId"]:>10},  '
        f'"{e["label"]}",  '
        f'"{e["signal_type"]}",  '
        f'"{e["industry"]}",  '
        f'"{e["naics_or_noc"]}",  '
        f'"{e["geo"]}",  '
        f'"{e["geo_type"]}",  '
        f'"{e["cadence"]}",  '
        f'"{table_ref}"),'
    )


def build_registry_block(resolved: list[dict]) -> str:
    order = [14100355, 14100287, 14100421, 14100442, 14100220]
    groups: dict[int, list] = {pid: [] for pid in order}
    for e in resolved:
        groups.setdefault(e["productId"], []).append(e)

    lines = [REGISTRY_START, ""]
    group_var_names = []

    for pid in order:
        entries = groups.get(pid, [])
        if not entries:
            continue
        var_name = GROUP_NAMES.get(pid, f"TABLE_{pid}")
        comment  = GROUP_COMMENTS.get(pid, f"Table {pid}")
        group_var_names.append(var_name)

        lines.append(f"# {comment}")
        lines.append(f"{var_name} = [")
        for e in entries:
            lines.append(format_tuple(e))
        lines.append("]")
        lines.append("")

    # ALL_SERIES concatenation
    if group_var_names:
        parts = " + ".join(group_var_names)
        lines.append(f"ALL_SERIES = {parts}")
        lines.append("")

    lines.append(REGISTRY_END)
    return "\n".join(lines)


def inject_registry(source: str, new_block: str) -> str:
    # Case 1: sentinels already present — replace between them
    if REGISTRY_START in source and REGISTRY_END in source:
        pattern = re.compile(
            re.escape(REGISTRY_START) + r".*?" + re.escape(REGISTRY_END),
            re.DOTALL
        )
        result = pattern.sub(new_block, source)
        if result != source:
            return result

    # Case 2: find any series list variables + ALL_SERIES and replace the block
    # Match any uppercase variable = [ ... ] blocks (series registries)
    series_pattern = re.compile(
        r"^[A-Z][A-Z_]+\s*=\s*\[.*?^\]",
        re.MULTILINE | re.DOTALL
    )
    all_matches = list(series_pattern.finditer(source))

    # Filter to only registry-looking variables (containing tuple patterns)
    registry_matches = [
        m for m in all_matches
        if re.search(r"\(\s*\d+\s*,", m.group())  # contains (int, ...) tuples
    ]

    if registry_matches:
        start = registry_matches[0].start()
        end   = registry_matches[-1].end()

        # Also consume ALL_SERIES line if it follows within 5 lines
        remaining = source[end:]
        all_series_match = re.search(
            r"[\n\r]{0,4}ALL_SERIES\s*=\s*[^\n]+\n",
            remaining
        )
        if all_series_match and all_series_match.start() < 10:
            end += all_series_match.end()

        return source[:start] + new_block + "\n" + source[end:]

    # Case 3: insert before first function def
    func_match = re.search(r"^def ", source, re.MULTILINE)
    if func_match:
        pos = func_match.start()
        return source[:pos] + new_block + "\n\n" + source[pos:]

    return source + "\n\n" + new_block


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vectors", default="statscan_live_vectors.json")
    parser.add_argument("--fetcher", default="../src/pipelines/market_stats/fetcher_statscan.py")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    vectors_path = Path(args.vectors)
    fetcher_path = Path(args.fetcher)

    if not vectors_path.exists():
        print(f"ERROR: {vectors_path} not found.")
        return
    if not fetcher_path.exists():
        print(f"ERROR: {fetcher_path} not found.")
        return

    with open(vectors_path) as f:
        data = json.load(f)

    resolved = data.get("resolved", [])
    failed   = data.get("failed", [])
    print(f"Loaded {len(resolved)} resolved, {len(failed)} failed\n")

    if failed:
        print(f"WARNING: {len(failed)} excluded:")
        for item in failed:
            print(f"  ✗ {item['label'][:60]}")
        print()

    new_block = build_registry_block(resolved)

    if args.dry_run:
        print("=== DRY RUN ===\n")
        print(new_block)
        return

    backup = fetcher_path.with_suffix(
        f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}.py"
    )
    shutil.copy(fetcher_path, backup)
    print(f"Backed up to: {backup}")

    source  = fetcher_path.read_text()
    updated = inject_registry(source, new_block)
    fetcher_path.write_text(updated)
    print(f"Updated:      {fetcher_path}")

    # Sanity check by importing
    try:
        spec = importlib.util.spec_from_file_location("fetcher_statscan", fetcher_path)
        mod  = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        count = len(mod.ALL_SERIES)
        status = "✓" if count == len(resolved) else "✗ MISMATCH"
        print(f"\n{status} ALL_SERIES has {count} series ({len(resolved)} expected)")
    except Exception as e:
        print(f"\nCould not import for sanity check: {e}")

    print(f"\nDone. {len(resolved)} vectors written.")
    print(f"Next: python step3_verify_remapped.py --fetcher {args.fetcher}")


if __name__ == "__main__":
    main()