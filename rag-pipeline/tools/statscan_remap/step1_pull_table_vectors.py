"""
Step 1: Pull live vector IDs from StatsCan WDS.

All productIds AND dimension member IDs fully verified from step0 output.
Zero guessing — every coordinate built from confirmed member IDs.

Tables and their confirmed dimension structures:

14100355 - LFS Employment by industry, monthly SA
  Dim 1: Geography (1=Canada, 7=ON, 6=QC, 10=AB, 11=BC)
  Dim 2: NAICS (1=Total, 2=Goods, 6=Construction, 7=Manufacturing,
                8=Services, 11=Finance/ins/RE, 12=Prof/sci/tech,
                15=Health care, 16=Info/culture/rec, 17=Accom/food)
  Dim 3: Statistics (1=Estimate)
  Dim 4: Data type (1=Seasonally adjusted)

14100287 - LFS Labour force by province, monthly SA
  Dim 1: Geography (1=Canada, 6=QC, 7=ON, 10=AB, 11=BC)
  Dim 2: Characteristic (3=Employment, 7=Unemployment rate,
                         8=Participation rate, 9=Employment rate)
  Dim 3: Gender (1=Total)
  Dim 4: Age group (1=15+)
  Dim 5: Statistics (1=Estimate)
  Dim 6: Data type (1=Seasonally adjusted)

14100421 - LFS Labour force by occupation (NOC 2021), monthly
  Dim 1: Geography (1=Canada)
  Dim 2: Characteristic (2=Employment, 5=Unemployment, 6=Unemployment rate)
  Dim 3: NOC (1=Total, 2=Management, 7=Business/finance/admin,
               14=Natural/applied sciences, 20=Health,
               27=Education/law/social, 43=Sales/service,
               48=Trades/transport, 56=Manufacturing/utilities)
  Dim 4: Gender (1=Total)

14100442 - JVWS Job vacancies by industry sub-sector, quarterly unadj
  Dim 1: Geography (1=Canada)
  Dim 2: NAICS (1=Total, 5=Construction, 6=Manufacturing, 10=Info/culture,
                11=Finance/insurance, 12=RE/rental/leasing,
                13=Prof/sci/tech, 17=Health care, 19=Accom/food)
  Dim 3: Statistics (1=Job vacancies, 4=Job vacancy rate, 5=Avg offered hourly wage)

14100220 - SEPH Avg weekly earnings by industry, monthly SA, Canada only
  Dim 1: Geography (1=Canada only)
  Dim 2: Estimate (1=Employment, 2=Avg weekly earnings incl overtime)
  Dim 3: NAICS (1=Total, 21=Construction, 34=Manufacturing,
                253=Info/culture, 267=Finance/insurance,
                295=Prof/sci/tech, 331=Health care, 367=Accom/food)

Output: statscan_live_vectors.json
"""

import json
import time
import requests

WDS = "https://www150.statcan.gc.ca/t1/wds/rest"
HEADERS = {"Content-Type": "application/json", "User-Agent": "market-stats-pipeline/1.0"}

# ── 14100355: Employment by industry, monthly SA ────────────────────────────
# coord: geo . naics . statistics(1=estimate) . data_type(1=SA)
LFS_EMPLOYMENT = [
    (14100355, "1.1.1.1.0.0.0.0.0.0",  "Canada - total employment",                            "employment_level", "Total Industries",                  "all", "national", "national", "monthly"),
    (14100355, "1.2.1.1.0.0.0.0.0.0",  "Canada - goods-producing employment",                  "employment_level", "Goods-Producing",                   "all", "national", "national", "monthly"),
    (14100355, "1.8.1.1.0.0.0.0.0.0",  "Canada - services-producing employment",               "employment_level", "Services-Producing",                "all", "national", "national", "monthly"),
    (14100355, "1.7.1.1.0.0.0.0.0.0",  "Canada - manufacturing employment",                    "employment_level", "Manufacturing",                     "31",  "national", "national", "monthly"),
    (14100355, "1.6.1.1.0.0.0.0.0.0",  "Canada - construction employment",                     "employment_level", "Construction",                      "23",  "national", "national", "monthly"),
    (14100355, "1.11.1.1.0.0.0.0.0.0", "Canada - finance insurance real estate employment",    "employment_level", "Finance Insurance Real Estate",      "52",  "national", "national", "monthly"),
    (14100355, "1.12.1.1.0.0.0.0.0.0", "Canada - professional scientific technical employment","employment_level", "Professional Scientific Technical",  "54",  "national", "national", "monthly"),
    (14100355, "1.15.1.1.0.0.0.0.0.0", "Canada - health care social assistance employment",    "employment_level", "Health Care and Social Assistance",  "62",  "national", "national", "monthly"),
    (14100355, "1.16.1.1.0.0.0.0.0.0", "Canada - information culture recreation employment",   "employment_level", "Information Culture Recreation",     "51",  "national", "national", "monthly"),
    (14100355, "1.17.1.1.0.0.0.0.0.0", "Canada - accommodation food services employment",      "employment_level", "Accommodation and Food Services",    "72",  "national", "national", "monthly"),
]

# ── 14100287: Labour force by province, monthly SA ──────────────────────────
# coord: geo . characteristic . gender(1) . age(1=15+) . statistics(1=estimate) . data_type(1=SA)
LFS_PROVINCE = [
    (14100287, "1.7.1.1.1.1.0.0.0.0",  "Canada - national unemployment rate",   "unemployment_rate", "All Industries", "all", "national",         "national",   "monthly"),
    (14100287, "7.7.1.1.1.1.0.0.0.0",  "Ontario unemployment rate",             "unemployment_rate", "All Industries", "all", "Ontario",          "provincial", "monthly"),
    (14100287, "6.7.1.1.1.1.0.0.0.0",  "Quebec unemployment rate",              "unemployment_rate", "All Industries", "all", "Quebec",           "provincial", "monthly"),
    (14100287, "11.7.1.1.1.1.0.0.0.0", "British Columbia unemployment rate",    "unemployment_rate", "All Industries", "all", "British Columbia",  "provincial", "monthly"),
    (14100287, "10.7.1.1.1.1.0.0.0.0", "Alberta unemployment rate",             "unemployment_rate", "All Industries", "all", "Alberta",          "provincial", "monthly"),
    (14100287, "1.9.1.1.1.1.0.0.0.0",  "Canada - national employment rate",     "employment_level",  "All Industries", "all", "national",         "national",   "monthly"),
    (14100287, "1.8.1.1.1.1.0.0.0.0",  "Canada - participation rate",           "worker_confidence", "All Industries", "all", "national",         "national",   "monthly"),
]

# ── 14100421: Labour force by occupation (NOC 2021), monthly ────────────────
# coord: geo(1=CA) . characteristic . noc . gender(1=total)
LFS_OCCUPATION = [
    (14100421, "1.6.1.1.0.0.0.0.0.0",  "Canada - unemployment rate total all occupations",     "unemployment_rate", "All Occupations",                    "NOC-all", "national", "national", "monthly"),
    (14100421, "1.6.2.1.0.0.0.0.0.0",  "Canada - unemployment management occupations",         "unemployment_rate", "Management Occupations",              "NOC-0",   "national", "national", "monthly"),
    (14100421, "1.6.7.1.0.0.0.0.0.0",  "Canada - unemployment business finance admin",         "unemployment_rate", "Business Finance Admin",              "NOC-1",   "national", "national", "monthly"),
    (14100421, "1.6.14.1.0.0.0.0.0.0", "Canada - unemployment natural applied sciences",       "unemployment_rate", "Natural and Applied Sciences",        "NOC-2",   "national", "national", "monthly"),
    (14100421, "1.6.20.1.0.0.0.0.0.0", "Canada - unemployment health occupations",             "unemployment_rate", "Health Occupations",                  "NOC-3",   "national", "national", "monthly"),
    (14100421, "1.6.27.1.0.0.0.0.0.0", "Canada - unemployment education law social",           "unemployment_rate", "Education Law Social Services",       "NOC-4",   "national", "national", "monthly"),
    (14100421, "1.6.43.1.0.0.0.0.0.0", "Canada - unemployment sales service",                  "unemployment_rate", "Sales and Service",                   "NOC-6",   "national", "national", "monthly"),
    (14100421, "1.6.48.1.0.0.0.0.0.0", "Canada - unemployment trades transport",               "unemployment_rate", "Trades Transport Equipment",          "NOC-7",   "national", "national", "monthly"),
    (14100421, "1.6.56.1.0.0.0.0.0.0", "Canada - unemployment manufacturing utilities",        "unemployment_rate", "Manufacturing and Utilities",         "NOC-9",   "national", "national", "monthly"),
    (14100421, "1.2.14.1.0.0.0.0.0.0", "Canada - employment natural applied sciences",         "employment_level",  "Natural and Applied Sciences",        "NOC-2",   "national", "national", "monthly"),
    (14100421, "1.2.20.1.0.0.0.0.0.0", "Canada - employment health occupations",               "employment_level",  "Health Occupations",                  "NOC-3",   "national", "national", "monthly"),
    (14100421, "1.2.27.1.0.0.0.0.0.0", "Canada - employment education law social",             "employment_level",  "Education Law Social Services",       "NOC-4",   "national", "national", "monthly"),
]

# ── 14100442: JVWS Job vacancies by industry sub-sector, quarterly unadj ────
# coord: geo(1=CA) . naics . statistics
# NAICS member IDs from step0:
#   1=Total, 5=Construction, 6=Manufacturing, 10=Info/culture,
#   11=Finance/insurance, 12=RE/rental/leasing, 13=Prof/sci/tech,
#   17=Health care, 19=Accom/food
# Statistics: 1=Job vacancies, 4=Job vacancy rate, 5=Avg offered hourly wage
JVWS = [
    (14100442, "1.1.4.0.0.0.0.0.0.0",  "Canada - total job vacancy rate",                      "vacancy_rate", "Total Industries",                  "all", "national", "national", "quarterly"),
    (14100442, "1.13.4.0.0.0.0.0.0.0", "Canada - professional scientific vacancy rate",        "vacancy_rate", "Professional Scientific Technical",  "54", "national", "national", "quarterly"),
    (14100442, "1.10.4.0.0.0.0.0.0.0", "Canada - information culture vacancy rate",            "vacancy_rate", "Information Culture Recreation",     "51", "national", "national", "quarterly"),
    (14100442, "1.11.4.0.0.0.0.0.0.0", "Canada - finance insurance vacancy rate",              "vacancy_rate", "Finance Insurance",                  "52", "national", "national", "quarterly"),
    (14100442, "1.17.4.0.0.0.0.0.0.0", "Canada - health care vacancy rate",                   "vacancy_rate", "Health Care and Social Assistance",  "62", "national", "national", "quarterly"),
    (14100442, "1.6.4.0.0.0.0.0.0.0",  "Canada - manufacturing vacancy rate",                 "vacancy_rate", "Manufacturing",                      "31", "national", "national", "quarterly"),
    (14100442, "1.5.4.0.0.0.0.0.0.0",  "Canada - construction vacancy rate",                  "vacancy_rate", "Construction",                       "23", "national", "national", "quarterly"),
    (14100442, "1.19.4.0.0.0.0.0.0.0", "Canada - accommodation food vacancy rate",             "vacancy_rate", "Accommodation and Food Services",    "72", "national", "national", "quarterly"),
    (14100442, "1.1.5.0.0.0.0.0.0.0",  "Canada - total average offered hourly wage",          "wage_level",   "Total Industries",                  "all", "national", "national", "quarterly"),
    (14100442, "1.13.5.0.0.0.0.0.0.0", "Canada - professional scientific offered wage",       "wage_level",   "Professional Scientific Technical",  "54", "national", "national", "quarterly"),
    (14100442, "1.10.5.0.0.0.0.0.0.0", "Canada - information culture offered wage",           "wage_level",   "Information Culture Recreation",     "51", "national", "national", "quarterly"),
    (14100442, "1.17.5.0.0.0.0.0.0.0", "Canada - health care offered wage",                   "wage_level",   "Health Care and Social Assistance",  "62", "national", "national", "quarterly"),
]

# ── 14100220: SEPH weekly earnings + employment by industry, monthly SA ──────
# coord: geo(1=CA) . estimate . naics
# Estimate: 1=Employment, 2=Avg weekly earnings incl overtime
# NAICS confirmed from step0: 1=Total, 21=Construction, 34=Manufacturing,
#   253=Info/culture, 267=Finance/insurance, 295=Prof/sci/tech,
#   331=Health care, 367=Accom/food
SEPH = [
    (14100220, "1.2.1.0.0.0.0.0.0.0",   "Canada - total avg weekly earnings all industries",   "wage_level",      "Total Industries",                  "all", "national", "national", "monthly"),
    (14100220, "1.2.34.0.0.0.0.0.0.0",  "Canada - manufacturing avg weekly earnings",          "wage_level",      "Manufacturing",                     "31",  "national", "national", "monthly"),
    (14100220, "1.2.21.0.0.0.0.0.0.0",  "Canada - construction avg weekly earnings",           "wage_level",      "Construction",                      "23",  "national", "national", "monthly"),
    (14100220, "1.2.267.0.0.0.0.0.0.0", "Canada - finance insurance avg weekly earnings",      "wage_level",      "Finance Insurance Real Estate",     "52",  "national", "national", "monthly"),
    (14100220, "1.2.295.0.0.0.0.0.0.0", "Canada - professional scientific avg weekly earnings","wage_level",      "Professional Scientific Technical", "54",  "national", "national", "monthly"),
    (14100220, "1.2.331.0.0.0.0.0.0.0", "Canada - health care avg weekly earnings",            "wage_level",      "Health Care and Social Assistance", "62",  "national", "national", "monthly"),
    (14100220, "1.2.253.0.0.0.0.0.0.0", "Canada - information culture avg weekly earnings",    "wage_level",      "Information Culture Recreation",    "51",  "national", "national", "monthly"),
    (14100220, "1.2.367.0.0.0.0.0.0.0", "Canada - accommodation food avg weekly earnings",     "wage_level",      "Accommodation and Food Services",   "72",  "national", "national", "monthly"),
    (14100220, "1.1.1.0.0.0.0.0.0.0",   "Canada - total payroll employment all industries",    "employment_level","Total Industries",                  "all", "national", "national", "monthly"),
    (14100220, "1.1.295.0.0.0.0.0.0.0", "Canada - professional scientific payroll employment", "employment_level","Professional Scientific Technical", "54",  "national", "national", "monthly"),
    (14100220, "1.1.253.0.0.0.0.0.0.0", "Canada - information culture payroll employment",     "employment_level","Information Culture Recreation",    "51",  "national", "national", "monthly"),
]

SERIES_TARGETS = LFS_EMPLOYMENT + LFS_PROVINCE + LFS_OCCUPATION + JVWS + SEPH

TABLE_SOURCE_MAP = {
    14100355: "14-10-0355-01",
    14100287: "14-10-0287-01",
    14100421: "14-10-0421-01",
    14100442: "14-10-0442-01",
    14100220: "14-10-0220-01",
}


def resolve_vector_from_coord(product_id: int, coordinate: str) -> dict | None:
    url = f"{WDS}/getDataFromCubePidCoordAndLatestNPeriods"
    payload = [{"productId": product_id, "coordinate": coordinate, "latestN": 1}]
    r = requests.post(url, json=payload, headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    item = data[0] if isinstance(data, list) and data else data
    if item.get("status") != "SUCCESS":
        return None
    obj = item.get("object", {})
    vector_id = obj.get("vectorId")
    if not vector_id:
        return None
    data_points = obj.get("vectorDataPoint", [])
    latest = data_points[0] if data_points else {}
    return {
        "vectorId":   vector_id,
        "productId":  obj.get("productId"),
        "coordinate": obj.get("coordinate"),
        "refPer":     latest.get("refPer", ""),
        "value":      latest.get("value", ""),
    }


def main():
    results = []
    failed  = []

    print(f"Resolving {len(SERIES_TARGETS)} series targets...\n")

    for i, target in enumerate(SERIES_TARGETS):
        product_id, coord, label, signal_type, industry, naics, geo, geo_type, cadence = target
        print(f"[{i+1:02d}/{len(SERIES_TARGETS)}] {label[:65]}")

        try:
            resolved = resolve_vector_from_coord(product_id, coord)
            if resolved:
                results.append({
                    "vectorId":     resolved["vectorId"],
                    "productId":    product_id,
                    "coordinate":   coord,
                    "table_ref":    TABLE_SOURCE_MAP.get(product_id, str(product_id)),
                    "label":        label,
                    "signal_type":  signal_type,
                    "industry":     industry,
                    "naics_or_noc": naics,
                    "geo":          geo,
                    "geo_type":     geo_type,
                    "cadence":      cadence,
                    "refPer":       resolved["refPer"],
                    "value":        resolved["value"],
                    "status":       "resolved",
                })
                print(f"  ✓ vectorId={resolved['vectorId']}  refPer={resolved['refPer']}  value={resolved['value']}")
            else:
                failed.append({"label": label, "productId": product_id, "coordinate": coord, "reason": "no vectorId returned"})
                print(f"  ✗ no vectorId")

        except Exception as e:
            failed.append({"label": label, "productId": product_id, "coordinate": coord, "reason": str(e)})
            print(f"  ✗ error: {e}")

        time.sleep(0.3)

    output = {
        "resolved": results,
        "failed":   failed,
        "summary":  {"total": len(SERIES_TARGETS), "resolved": len(results), "failed": len(failed)},
    }

    with open("statscan_live_vectors.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Resolved: {len(results)} / {len(SERIES_TARGETS)}")
    print(f"Failed:   {len(failed)}")
    print(f"Output:   statscan_live_vectors.json")

    if failed:
        print(f"\nFailed entries:")
        for item in failed:
            print(f"  table={item['productId']} coord={item['coordinate']}")
            print(f"    {item['label'][:65]}")

    print(f"\nBy table:")
    for pid in [14100355, 14100287, 14100421, 14100442, 14100220]:
        r = sum(1 for x in results if x["productId"] == pid)
        f = sum(1 for x in failed  if x["productId"] == pid)
        total = r + f
        print(f"  {pid} ({TABLE_SOURCE_MAP[pid]}): {r}/{total} resolved")


if __name__ == "__main__":
    main()