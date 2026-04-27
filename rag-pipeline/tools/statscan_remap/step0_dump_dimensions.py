"""
Step 0: Dump dimension metadata for all StatsCan tables we need.

Run this ONCE locally. Output tells us the exact memberId values
for each dimension so we can build correct coordinate strings.

Output: statscan_dimensions.json
"""

import json
import time
import requests

WDS = "https://www150.statcan.gc.ca/t1/wds/rest"
HEADERS = {"Content-Type": "application/json", "User-Agent": "market-stats-pipeline/1.0"}

TABLES = [
    (14100442, "Job vacancies, payroll employees, job vacancy rate, and average offered hourly wage by industry sub-sector, quarterly, unadjusted for seasonality"),
    (14100355, "LFS - Employment by industry, monthly SA"),
    (14100287, "LFS - Labour force characteristics by province, monthly SA"),
    (14100421, "LFS - Labour force by occupation (NOC), monthly"),
    #(14100441, "JVWS - Job vacancies by industry sector, quarterly SA"),
    (14100220, "SEPH - Employment and avg weekly earnings by industry, monthly SA"),
]


def get_cube_metadata(product_id: int) -> dict | None:
    # POST with list payload — this is the correct WDS contract
    url = f"{WDS}/getCubeMetadata"
    payload = [{"productId": product_id}]
    r = requests.post(url, json=payload, headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    # Response is a list, one item per productId in the request
    item = data[0] if isinstance(data, list) else data
    if item.get("status") != "SUCCESS":
        print(f"  Non-success: {item.get('status')}")
        return None
    return item.get("object", {})


def main():
    output = {}

    for product_id, label in TABLES:
        print(f"\n{'='*60}")
        print(f"Table {product_id}: {label}")
        print('='*60)

        try:
            cube = get_cube_metadata(product_id)
            if not cube:
                print("  FAILED — no metadata returned")
                output[str(product_id)] = {"error": "no metadata"}
                continue

            title = cube.get("cubeTitleEn", "")
            dims  = cube.get("dimension", [])
            print(f"  Title: {title}")
            print(f"  Dimensions: {len(dims)}")

            table_info = {
                "productId": product_id,
                "title":     title,
                "label":     label,
                "dimensions": []
            }

            for d in dims:
                pos      = d["dimensionPositionId"]
                dim_name = d["dimensionNameEn"]
                members  = d.get("member", [])

                print(f"\n  Dim {pos}: {dim_name} ({len(members)} members)")
                dim_info = {
                    "position": pos,
                    "name":     dim_name,
                    "members":  []
                }

                for m in members:
                    mid   = m["memberId"]
                    mname = m["memberNameEn"]
                    # Only print/store non-hierarchical leaf members
                    # (hasChildren=False) to avoid printing parent nodes
                    is_leaf = not m.get("hasChildren", False)
                    marker  = "  " if is_leaf else "* "
                    print(f"    {marker}memberId={mid:<5}  {mname}")
                    dim_info["members"].append({
                        "memberId":   mid,
                        "name":       mname,
                        "isLeaf":     is_leaf,
                        "parentId":   m.get("parentMemberId"),
                    })

                table_info["dimensions"].append(dim_info)

            output[str(product_id)] = table_info
            time.sleep(0.5)

        except Exception as e:
            print(f"  ERROR: {e}")
            output[str(product_id)] = {"error": str(e)}

    with open("statscan_dimensions.json", "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n\nDone. Output written to statscan_dimensions.json")
    print("Share this file — it will be used to build correct coordinates.")


if __name__ == "__main__":
    main()