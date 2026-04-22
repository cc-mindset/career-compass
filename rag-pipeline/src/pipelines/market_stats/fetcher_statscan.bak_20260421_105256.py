"""
Statistics Canada WDS Fetcher
==============================
Fetches LFS, JVWS, and SEPH data for the market_stats pipeline.

API:  https://www150.statcan.gc.ca/t1/wds/rest/
Auth: None required. Rate limit is generous (~100 req/min).

Key concepts:
  - productId:  table number as integer (e.g. table 14-10-0027-01 → 14100027)
  - coordinate: dot-separated dimension positions (e.g. "1.3.0.0.0.0.0.0.0.0")
                Position 1 = geography, Position 2 = industry/classification, etc.
  - vectorId:   alternative to coordinate — a stable numeric ID for a specific series.
                More reliable than coordinates when table dimensions change.

Strategy used here: vectorId-based fetching.
  Each entry in the registry has a pre-looked-up vectorId.
    Use POST /getSeriesInfoFromVector with payload [{"vectorId": <id>}] to verify.
  Use POST /getDataFromVectorsAndLatestNPeriods to fetch N months of data.

How to find vectorIds:
  1. Go to https://www150.statcan.gc.ca/t1/tbl1/en/table/{table_id}
  2. Click "Add/Remove data" → select the dimensions you want
  3. The URL will update with the vector ID, or use:
     GET https://www150.statcan.gc.ca/t1/wds/rest/getSeriesInfoFromCubePidCoord
  We've pre-looked up the key vectors below. All marked VERIFY should be
  confirmed against the StatsCan table explorer before production.

Outputs: list of normalized dicts — identical schema to fetcher_bls.py output.
"""

import json
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

STATSCAN_WDS_URL = "https://www150.statcan.gc.ca/t1/wds/rest/"


# ---------------------------------------------------------------------------
# Series registry — (vector_id, label, signal_type, industry, noc_or_naics,
#                    geo, geo_type, cadence, table_ref)
# ---------------------------------------------------------------------------
#
# Geography codes for coordinate position 1 in most LFS tables:
#   1 = Canada (national)
#   2 = Newfoundland and Labrador
#   3 = Prince Edward Island
#   4 = Nova Scotia
#   5 = New Brunswick
#   6 = Quebec
#   7 = Ontario
#   8 = Manitoba
#   9 = Saskatchewan
#   10 = Alberta
#   11 = British Columbia
#
# Industry uses NAICS 2017 at the sector level — same codes as BLS for major sectors.
# Occupation uses NOC 2016 (being updated to NOC 2021 — VERIFY current version).
# ---------------------------------------------------------------------------

LFS_SERIES = [
    # ── Table 14-10-0027-01: Employees by job type, monthly ──
    # National employment level by industry (NAICS) — Canada total
    # VERIFY vectorIds against: https://www150.statcan.gc.ca/t1/tbl1/en/table/14100023
    (1100965,  "Canada - total employment",                            "employment_level",  "Total Industries",                  "all", "national", "national", "monthly", "14-10-0023-01"),
    (1100966,  "Canada - goods-producing employment",                  "employment_level",  "Goods-Producing",                   "all", "national", "national", "monthly", "14-10-0023-01"),
    (1100967,  "Canada - services-producing employment",               "employment_level",  "Services-Producing",                "all", "national", "national", "monthly", "14-10-0023-01"),
    (1100972,  "Canada - manufacturing employment",                    "employment_level",  "Manufacturing",                     "31", "national", "national", "monthly", "14-10-0023-01"),
    (1100974,  "Canada - construction employment",                     "employment_level",  "Construction",                     "23", "national", "national", "monthly", "14-10-0023-01"),
    (1100978,  "Canada - finance insurance real estate employment",     "employment_level",  "Finance Insurance Real Estate",     "52", "national", "national", "monthly", "14-10-0023-01"),
    (1100980,  "Canada - professional scientific technical employment", "employment_level",  "Professional Scientific Technical", "54", "national", "national", "monthly", "14-10-0023-01"),
    (1100984,  "Canada - health care social assistance employment",     "employment_level",  "Health Care and Social Assistance", "62", "national", "national", "monthly", "14-10-0023-01"),
    (1100985,  "Canada - information culture recreation employment",    "employment_level",  "Information Culture Recreation",    "51", "national", "national", "monthly", "14-10-0023-01"),
    (1100986,  "Canada - accommodation food services employment",       "employment_level",  "Accommodation and Food Services",   "72", "national", "national", "monthly", "14-10-0023-01"),

    # ── Table 14-10-0027-01: Employment by job type (layoffs proxy) ──
    # "Job losers" = involuntary separations — closest LFS equivalent to JOLTS layoffs
    # VERIFY: these vectorIds for job losers by industry
    (1582081,  "Canada - job losers total (layoff proxy)",             "contraction_indicator", "Total Industries",              "all", "national", "national", "monthly", "14-10-0027-01"),
    (1582083,  "Canada - job leavers total (quits proxy)",             "worker_confidence",     "Total Industries",              "all", "national", "national", "monthly", "14-10-0027-01"),

    # ── Table 14-10-0287-01: Unemployment rate by province ──
    # National overall rate
    (2062808,  "Canada - national unemployment rate",                  "unemployment_rate", "All Industries",                    "all", "national", "national", "monthly", "14-10-0287-01"),
    # Provincial rates — key for geo_preferences signal
    (2062815,  "Ontario unemployment rate",                            "unemployment_rate", "All Industries",                    "all", "Ontario",  "provincial","monthly", "14-10-0287-01"),
    (2062816,  "Quebec unemployment rate",                             "unemployment_rate", "All Industries",                    "all", "Quebec",   "provincial","monthly", "14-10-0287-01"),
    (2062817,  "British Columbia unemployment rate",                   "unemployment_rate", "All Industries",                    "all", "British Columbia","provincial","monthly","14-10-0287-01"),
    (2062818,  "Alberta unemployment rate",                            "unemployment_rate", "All Industries",                    "all", "Alberta",  "provincial","monthly", "14-10-0287-01"),

    # ── Table 14-10-0066-01: Unemployment by occupation (NOC) ──
    # VERIFY these vectorIds — NOC groups at national level
    (1100889,  "Canada - unemployment management business finance",    "unemployment_rate", "Management Business Finance",       "NOC-0-1", "national","national","monthly","14-10-0066-01"),
    (1100891,  "Canada - unemployment natural applied sciences",       "unemployment_rate", "Natural and Applied Sciences",      "NOC-2",   "national","national","monthly","14-10-0066-01"),
    (1100893,  "Canada - unemployment health occupations",             "unemployment_rate", "Health Occupations",                "NOC-3",   "national","national","monthly","14-10-0066-01"),
    (1100895,  "Canada - unemployment education law social",           "unemployment_rate", "Education Law Social Services",     "NOC-4",   "national","national","monthly","14-10-0066-01"),
    (1100897,  "Canada - unemployment trades transport",               "unemployment_rate", "Trades Transport Equipment",        "NOC-7",   "national","national","monthly","14-10-0066-01"),
    (1100899,  "Canada - unemployment sales service",                  "unemployment_rate", "Sales and Service",                 "NOC-6",   "national","national","monthly","14-10-0066-01"),
]

JVWS_SERIES = [
    # ── Table 14-10-0325-01: Job vacancies by industry and province ──
    # VERIFY these vectorIds — national vacancy rate by industry
    (1310145,  "Canada - total job vacancy rate",                      "vacancy_rate",      "Total Industries",                  "all", "national","national","quarterly","14-10-0325-01"),
    (1310148,  "Canada - professional scientific technical vacancy rate","vacancy_rate",    "Professional Scientific Technical", "54", "national","national","quarterly","14-10-0325-01"),
    (1310149,  "Canada - information culture recreation vacancy rate",  "vacancy_rate",     "Information Culture Recreation",    "51", "national","national","quarterly","14-10-0325-01"),
    (1310150,  "Canada - finance insurance real estate vacancy rate",   "vacancy_rate",     "Finance Insurance Real Estate",     "52", "national","national","quarterly","14-10-0325-01"),
    (1310151,  "Canada - health care vacancy rate",                    "vacancy_rate",      "Health Care and Social Assistance", "62", "national","national","quarterly","14-10-0325-01"),
    (1310152,  "Canada - manufacturing vacancy rate",                  "vacancy_rate",      "Manufacturing",                    "31", "national","national","quarterly","14-10-0325-01"),
    (1310153,  "Canada - construction vacancy rate",                   "vacancy_rate",      "Construction",                     "23", "national","national","quarterly","14-10-0325-01"),
    # Average offered wages by industry — compensation signal
    (1310200,  "Canada - total average offered wage",                  "wage_level",        "Total Industries",                  "all", "national","national","quarterly","14-10-0325-01"),
    (1310203,  "Canada - professional scientific technical offered wage","wage_level",       "Professional Scientific Technical", "54", "national","national","quarterly","14-10-0325-01"),
    (1310204,  "Canada - information culture recreation offered wage",  "wage_level",        "Information Culture Recreation",    "51", "national","national","quarterly","14-10-0325-01"),
]

SEPH_SERIES = [
    # ── Table 14-10-0190-01: Survey of Employment, Payrolls and Hours ──
    # Average weekly earnings by industry — more granular wage signal than JVWS
    # VERIFY these vectorIds
    (1100059,  "Canada - total avg weekly earnings all industries",    "wage_level",        "Total Industries",                  "all", "national","national","monthly","14-10-0190-01"),
    (1100065,  "Canada - manufacturing avg weekly earnings",           "wage_level",        "Manufacturing",                    "31", "national","national","monthly","14-10-0190-01"),
    (1100071,  "Canada - construction avg weekly earnings",            "wage_level",        "Construction",                     "23", "national","national","monthly","14-10-0190-01"),
    (1100073,  "Canada - finance insurance avg weekly earnings",       "wage_level",        "Finance Insurance Real Estate",     "52", "national","national","monthly","14-10-0190-01"),
    (1100075,  "Canada - professional scientific avg weekly earnings", "wage_level",        "Professional Scientific Technical", "54", "national","national","monthly","14-10-0190-01"),
    (1100079,  "Canada - health care avg weekly earnings",             "wage_level",        "Health Care and Social Assistance", "62", "national","national","monthly","14-10-0190-01"),
    (1100080,  "Canada - information culture avg weekly earnings",     "wage_level",        "Information Culture Recreation",    "51", "national","national","monthly","14-10-0190-01"),
    (1100083,  "Canada - accommodation food avg weekly earnings",      "wage_level",        "Accommodation and Food Services",   "72", "national","national","monthly","14-10-0190-01"),
]

ALL_SERIES = LFS_SERIES + JVWS_SERIES + SEPH_SERIES


def _build_series_lookup(series_registry: list[tuple]) -> dict:
    return {
        str(s[0]): {
            "label":        s[1],
            "signal_type":  s[2],
            "industry":     s[3],
            "naics_or_noc": s[4],
            "geo":          s[5],
            "geo_type":     s[6],
            "cadence":      s[7],
            "table_ref":    s[8],
        }
        for s in series_registry
    }


def _fetch_vectors_latest_n(vector_ids: list[int], n_periods: int = 13) -> list[dict]:
    """
    POST to getDataFromVectorsAndLatestNPeriods.
    Returns raw list of StatsCan response objects.

    Note: StatsCan WDS supports max 300 vectors per request.
    """
    url = f"{STATSCAN_WDS_URL}getDataFromVectorsAndLatestNPeriods"
    payload = [{"vectorId": vid, "latestN": n_periods} for vid in vector_ids]
    response = requests.post(
        url,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return data


def _extract_periods(vector_response: dict, n_periods: int = 13) -> list[dict]:
    """
    Extract data points from a single StatsCan vector response object.
    The 'object' key contains vectorDataPoint list with refPer and value.
    """
    obj = vector_response.get("object", {})
    if not obj:
        return []

    data_points = obj.get("vectorDataPoint", [])
    results = []
    for point in sorted(
        data_points,
        key=lambda x: x.get("refPer", ""),
        reverse=True,
    )[:n_periods]:
        value_raw = point.get("value")
        if value_raw is None:
            continue
        try:
            value = float(value_raw)
        except (ValueError, TypeError):
            continue

        results.append({
            "period": point.get("refPer", "")[:7],  # e.g. "2025-02"
            "value":  value,
        })
    return results


def fetch_statscan(
    lookback_periods: int = 13,
    series_override: Optional[list[tuple]] = None,
) -> list[dict]:
    """
    Main entry point. Fetches all Statistics Canada series and returns
    normalized dicts with the SAME schema as fetcher_bls.py output.

    The only fields that differ vs BLS output:
      - country = "CA"
      - source = "STATSCAN_LFS" | "STATSCAN_JVWS" | "STATSCAN_SEPH"
      - naics_or_noc may use NOC codes for occupation-level series
      - geo / geo_type reflects provincial data where applicable

    Args:
        lookback_periods: How many months/quarters to fetch (default 13).
        series_override: Subset of series tuples for testing.

    Returns:
        List of normalized dicts, one per series.
    """
    series_to_fetch = series_override or ALL_SERIES
    lookup = _build_series_lookup(series_to_fetch)

    vector_ids = [s[0] for s in series_to_fetch]

    # StatsCan allows up to 300 per request — we're well under that
    logger.info(f"Fetching {len(vector_ids)} StatsCan vectors")
    try:
        raw_responses = _fetch_vectors_latest_n(vector_ids, n_periods=lookback_periods)
    except requests.RequestException as e:
        logger.error(f"StatsCan fetch failed: {e}")
        return []

    # Build lookup: vectorId (str) → raw response object
    raw_by_vector: dict[str, dict] = {}
    for item in raw_responses:
        if item.get("status") == "SUCCESS":
            obj = item.get("object", {})
            vid = str(obj.get("vectorId", ""))
            raw_by_vector[vid] = item
        else:
            logger.warning(f"StatsCan returned non-SUCCESS: {item.get('object', {}).get('vectorId')} — {item.get('status')}")

    normalized: list[dict] = []
    for vector_id_int, meta in [(s[0], lookup[str(s[0])]) for s in series_to_fetch]:
        vid_str = str(vector_id_int)
        raw = raw_by_vector.get(vid_str)
        if not raw:
            logger.warning(f"No data for vector {vid_str}")
            continue

        periods = _extract_periods(raw, n_periods=lookback_periods)
        if not periods:
            logger.warning(f"Empty periods for vector {vid_str}")
            continue

        latest   = periods[0]
        previous = periods[1] if len(periods) > 1 else None
        avg_12mo = round(
            sum(p["value"] for p in periods[:12]) / min(len(periods), 12), 2
        ) if periods else None

        normalized.append({
            # Identity
            "series_id":    f"STATSCAN_V{vid_str}",
            "source":       _resolve_source(meta["table_ref"]),
            "country":      "CA",
            "country_name": "Canada",
            # Classification — same field names as BLS output
            "signal_type":  meta["signal_type"],
            "industry":     meta["industry"],
            "naics_or_noc": meta["naics_or_noc"],
            "geo":          meta["geo"],
            "geo_type":     meta["geo_type"],
            "cadence":      meta["cadence"],
            # Time
            "period":       latest["period"],
            # Values — same structure as BLS output
            "values": {
                "latest":          latest["value"],
                "previous":        previous["value"] if previous else None,
                "mom_change":      round(latest["value"] - previous["value"], 3) if previous else None,
                "avg_12mo":        avg_12mo,
                "trend_direction": _trend(latest["value"], avg_12mo),
                "periods_history": periods,
            },
            "series_label": meta["label"],
        })

    logger.info(f"StatsCan fetch complete: {len(normalized)} series normalized")
    return normalized


def _resolve_source(table_ref: str) -> str:
    table_map = {
        "14-10-0023": "STATSCAN_LFS",
        "14-10-0027": "STATSCAN_LFS",
        "14-10-0066": "STATSCAN_LFS",
        "14-10-0287": "STATSCAN_LFS",
        "14-10-0355": "STATSCAN_LFS",
        "14-10-0325": "STATSCAN_JVWS",
        "14-10-0190": "STATSCAN_SEPH",
    }
    for prefix, source in table_map.items():
        if table_ref.startswith(prefix):
            return source
    return "STATSCAN_UNKNOWN"


def _trend(latest: float, avg_12mo: Optional[float]) -> str:
    """Identical logic to fetcher_bls._trend — same thresholds for consistency."""
    if avg_12mo is None:
        return "unknown"
    diff = latest - avg_12mo
    if diff > avg_12mo * 0.10:
        return "significantly_elevated"
    elif diff > avg_12mo * 0.03:
        return "elevated"
    elif diff < -avg_12mo * 0.10:
        return "significantly_below"
    elif diff < -avg_12mo * 0.03:
        return "below"
    else:
        return "near_average"


def verify_vector(vector_id: int) -> dict:
    """
    Helper to verify a single vectorId and see what it contains.
    Use this during development to confirm vector IDs before adding to registry.

    Usage:
        from fetcher_statscan import verify_vector
        info = verify_vector(1100965)
        print(info)
    """
    url = f"{STATSCAN_WDS_URL}getSeriesInfoFromVector"
    # WDS expects a POST body with a list payload.
    response = requests.post(url, json=[{"vectorId": vector_id}], timeout=15)
    response.raise_for_status()
    data = response.json()
    if isinstance(data, list) and data:
        return data[0]
    return {"status": "FAILED", "object": {"vectorId": vector_id, "message": "Unexpected response format"}}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Quick test — fetch just 3 vectors to verify connectivity
    test_series = LFS_SERIES[:3]
    results = fetch_statscan(lookback_periods=3, series_override=test_series)
    for r in results:
        print(json.dumps({k: v for k, v in r.items() if k != "values"}, indent=2))
        print(f"  latest: {r['values']['latest']}, avg_12mo: {r['values']['avg_12mo']}, trend: {r['values']['trend_direction']}")
        print()

    # Bonus: verify a vector to see its metadata
    print("\n--- Vector info for 1100965 ---")
    try:
        info = verify_vector(1100965)
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"verify failed: {e}")