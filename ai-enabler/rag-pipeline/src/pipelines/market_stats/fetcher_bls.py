"""
BLS API v2 Fetcher
==================
Fetches JOLTS, CES, and CPS series for the market_stats pipeline.

API:     https://api.bls.gov/publicAPI/v2/timeseries/data/
Auth:    API key in header (BLS_API_KEY env var). Without key: 25 series/req, 500/day.
         With key: 25 series/req, 500/day (key mainly removes IP throttle).
No key needed for dev — just slower rate limits.

Series ID format:
  JOLTS:  JTU + [supersector_code] + [size_class] + [data_element] + [seasonal]
          JTU = JOLTS Unadjusted prefix  |  JTS = JOLTS Seasonally adjusted
  CES:    CES + [supersector_code] + [data_type_code]
  CPS:    LNU + [measure_code] + [demographic_code]

Outputs: list of normalized dicts ready for transformer.py
"""

import os
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
BLS_API_KEY = os.getenv("BLS_API_KEY", "")  # Optional — works without key

# ---------------------------------------------------------------------------
# Series registry
# Each entry: (series_id, label, signal_type, industry, naics, cadence)
# ---------------------------------------------------------------------------

# JOLTS series — seasonally adjusted rates (SA suffix = S, not SA = U)
# Format: JTS + [industry_code 8 digits] + [size 2] + [element 2] + [SA: S or U]
# Industry code 000000000 = total nonfarm
# Size class 00 = all sizes
# Elements: JO=openings, HI=hires, TS=total sep, QU=quits, LD=layoffs/discharges

JOLTS_SERIES = [
    # Total nonfarm
    # Confirmed format: JTS + industry(6) + state(2) + sizeclass(2) + element(2) + ratelevel(1)
    # Total nonfarm = 000000, All areas = 00, All sizes = 00
    ("JTS000000000000000LDR", "Total nonfarm - layoffs rate",          "contraction_indicator", "Total Nonfarm", "00", "monthly"),
    ("JTS000000000000000JOR", "Total nonfarm - job openings rate",     "vacancy_rate",          "Total Nonfarm", "00", "monthly"),
    ("JTS000000000000000QUR", "Total nonfarm - quits rate",            "worker_confidence",     "Total Nonfarm", "00", "monthly"),
    ("JTS000000000000000HIR", "Total nonfarm - hires rate",            "hiring_rate",           "Total Nonfarm", "00", "monthly"),
    # Information (NAICS 51) — tech proxy
    ("JTS510000000000000LDR", "Information - layoffs rate",            "contraction_indicator", "Information",   "51", "monthly"),
    ("JTS510000000000000JOR", "Information - job openings rate",       "vacancy_rate",          "Information",   "51", "monthly"),
    ("JTS510000000000000QUR", "Information - quits rate",              "worker_confidence",     "Information",   "51", "monthly"),
    # Professional and Business Services (NAICS 54-56)
    # JOLTS uses supersector code 540099 for Professional and Business Services
    ("JTS540099000000000LDR", "Prof & Business Svcs - layoffs rate",   "contraction_indicator", "Professional and Business Services", "54", "monthly"),
    ("JTS540099000000000JOR", "Prof & Business Svcs - openings rate",  "vacancy_rate",          "Professional and Business Services", "54", "monthly"),
    ("JTS540099000000000QUR", "Prof & Business Svcs - quits rate",     "worker_confidence",     "Professional and Business Services", "54", "monthly"),
    # Finance and Insurance (NAICS 52)
    ("JTS520000000000000LDR", "Finance - layoffs rate",                "contraction_indicator", "Finance and Insurance",             "52", "monthly"),
    ("JTS520000000000000JOR", "Finance - job openings rate",           "vacancy_rate",          "Finance and Insurance",             "52", "monthly"),
    # Health Care and Social Assistance (NAICS 62)
    ("JTS620000000000000LDR", "Health Care - layoffs rate",            "contraction_indicator", "Health Care and Social Assistance", "62", "monthly"),
    ("JTS620000000000000JOR", "Health Care - job openings rate",       "vacancy_rate",          "Health Care and Social Assistance", "62", "monthly"),
    # Manufacturing (NAICS 31-33) — JOLTS uses 300000 for manufacturing supersector
    ("JTS300000000000000LDR", "Manufacturing - layoffs rate",          "contraction_indicator", "Manufacturing", "31", "monthly"),
    ("JTS300000000000000JOR", "Manufacturing - job openings rate",     "vacancy_rate",          "Manufacturing", "31", "monthly"),
    # Construction (NAICS 23)
    ("JTS230000000000000LDR", "Construction - layoffs rate",           "contraction_indicator", "Construction",  "23", "monthly"),
    # Accommodation and Food Services (NAICS 72)
    ("JTS720000000000000LDR", "Accommodation & Food - layoffs rate",   "contraction_indicator", "Accommodation and Food Services", "72", "monthly"),
    ("JTS720000000000000JOR", "Accommodation & Food - openings rate",  "vacancy_rate",          "Accommodation and Food Services", "72", "monthly"),
]

# CES series — seasonally adjusted payroll employment
# Format: CES + [supersector 8 digits] + [data_type 2]
# Data type 01 = all employees (thousands), 11 = avg hourly earnings
CES_SERIES = [
    ("CES0000000001", "Total nonfarm employment",                      "employment_level",  "Total Nonfarm",                     "00", "monthly"),
    ("CES0500000001", "Total private employment",                      "employment_level",  "Total Private",                     "05", "monthly"),
    ("CES0600000001", "Goods-producing employment",                    "employment_level",  "Goods-Producing",                   "06", "monthly"),
    ("CES0700000001", "Service-providing employment",                  "employment_level",  "Service-Providing",                 "07", "monthly"),
    ("CES1000000001", "Mining and logging employment",                 "employment_level",  "Mining and Logging",                "10", "monthly"),
    ("CES2000000001", "Construction employment",                       "employment_level",  "Construction",                     "20", "monthly"),
    ("CES3000000001", "Manufacturing employment",                      "employment_level",  "Manufacturing",                    "30", "monthly"),
    ("CES4000000001", "Trade, trans, utilities employment",            "employment_level",  "Trade Transportation Utilities",    "40", "monthly"),
    ("CES5000000001", "Information employment",                        "employment_level",  "Information",                      "50", "monthly"),
    ("CES5500000001", "Financial activities employment",               "employment_level",  "Financial Activities",             "55", "monthly"),
    ("CES6000000001", "Professional and business services employment", "employment_level",  "Professional and Business Services","60", "monthly"),
    ("CES6500000001", "Education and health services employment",      "employment_level",  "Education and Health Services",    "65", "monthly"),
    ("CES7000000001", "Leisure and hospitality employment",            "employment_level",  "Leisure and Hospitality",          "70", "monthly"),
    ("CES8000000001", "Other services employment",                     "employment_level",  "Other Services",                   "80", "monthly"),
    ("CES9000000001", "Government employment",                         "employment_level",  "Government",                       "90", "monthly"),
    # Avg hourly earnings — key wage signal
    ("CES0500000011", "Private sector avg hourly earnings",            "wage_level",        "Total Private",                    "05", "monthly"),
    ("CES6000000011", "Professional and business svcs avg hourly earnings", "wage_level",   "Professional and Business Services","60", "monthly"),
    ("CES5000000011", "Information avg hourly earnings",               "wage_level",        "Information",                      "50", "monthly"),
]

# CPS series — unemployment by occupation and education
# LNU = Labor force statistics, seasonally adjusted
# These are the national occupation-level unemployment rates from CPS
# VERIFY: CPS occupation series IDs — BLS publishes these but they are less
# standardized than JOLTS/CES. The LNUxx series below are standard SA rates.
CPS_SERIES = [
    # Overall unemployment rates
    ("LNS14000000",  "Overall unemployment rate (U-3)",               "unemployment_rate", "All Occupations",       "all", "monthly"),
    ("LNS13327709",  "U-6 total underemployment rate",                "unemployment_rate", "All Occupations",       "all", "monthly"),
    # Unemployment by education (strong career demand signal)
    ("LNS14027659",  "Unemployment - less than HS diploma",           "unemployment_rate", "Less than HS",          "edu", "monthly"),
    ("LNS14027660",  "Unemployment - HS graduates no college",        "unemployment_rate", "HS Graduate",           "edu", "monthly"),
    ("LNS14027689",  "Unemployment - some college or assoc degree",   "unemployment_rate", "Some College",          "edu", "monthly"),
    ("LNS14027662",  "Unemployment - bachelor degree and higher",     "unemployment_rate", "Bachelor's+",           "edu", "monthly"),
    # Unemployment by occupation major group
    # VERIFY: These SOC-based series — confirm at data.bls.gov/cgi-bin/surveymost?ln
    ("LNU04032215",  "Unemployment - management and professional",    "unemployment_rate", "Management Professional","occ", "monthly"),
    ("LNU04032218",  "Unemployment - service occupations",            "unemployment_rate", "Service Occupations",   "occ", "monthly"),
    ("LNU04032219",  "Unemployment - sales and office",               "unemployment_rate", "Sales and Office",      "occ", "monthly"),
    ("LNU04032222",  "Unemployment - natural resources construction", "unemployment_rate", "Natural Resources",     "occ", "monthly"),
    ("LNU04032226",  "Unemployment - production transport",           "unemployment_rate", "Production Transport",  "occ", "monthly"),
]

# ---------------------------------------------------------------------------
# LAUS series — state unemployment rates + employment levels, seasonally adj
# Format: LASST + {state_fips_2} + 0000000000000 + {measure}
# Measure: 03 = unemployment rate, 06 = employed, 07 = labor force
# Prefix LASST = seasonally adjusted state total
# All 50 states + DC
# ---------------------------------------------------------------------------
LAUS_SERIES = [
    ("LASST010000000000003", "Alabama unemployment rate",        "unemployment_rate", "All Industries", "all", "Alabama",              "state", "monthly"),
    ("LASST020000000000003", "Alaska unemployment rate",         "unemployment_rate", "All Industries", "all", "Alaska",               "state", "monthly"),
    ("LASST040000000000003", "Arizona unemployment rate",        "unemployment_rate", "All Industries", "all", "Arizona",              "state", "monthly"),
    ("LASST050000000000003", "Arkansas unemployment rate",       "unemployment_rate", "All Industries", "all", "Arkansas",             "state", "monthly"),
    ("LASST060000000000003", "California unemployment rate",     "unemployment_rate", "All Industries", "all", "California",           "state", "monthly"),
    ("LASST080000000000003", "Colorado unemployment rate",       "unemployment_rate", "All Industries", "all", "Colorado",             "state", "monthly"),
    ("LASST090000000000003", "Connecticut unemployment rate",    "unemployment_rate", "All Industries", "all", "Connecticut",          "state", "monthly"),
    ("LASST100000000000003", "Delaware unemployment rate",       "unemployment_rate", "All Industries", "all", "Delaware",             "state", "monthly"),
    ("LASST110000000000003", "Washington DC unemployment rate",  "unemployment_rate", "All Industries", "all", "Washington DC",        "state", "monthly"),
    ("LASST120000000000003", "Florida unemployment rate",        "unemployment_rate", "All Industries", "all", "Florida",              "state", "monthly"),
    ("LASST130000000000003", "Georgia unemployment rate",        "unemployment_rate", "All Industries", "all", "Georgia",              "state", "monthly"),
    ("LASST150000000000003", "Hawaii unemployment rate",         "unemployment_rate", "All Industries", "all", "Hawaii",               "state", "monthly"),
    ("LASST160000000000003", "Idaho unemployment rate",          "unemployment_rate", "All Industries", "all", "Idaho",                "state", "monthly"),
    ("LASST170000000000003", "Illinois unemployment rate",       "unemployment_rate", "All Industries", "all", "Illinois",             "state", "monthly"),
    ("LASST180000000000003", "Indiana unemployment rate",        "unemployment_rate", "All Industries", "all", "Indiana",              "state", "monthly"),
    ("LASST190000000000003", "Iowa unemployment rate",           "unemployment_rate", "All Industries", "all", "Iowa",                 "state", "monthly"),
    ("LASST200000000000003", "Kansas unemployment rate",         "unemployment_rate", "All Industries", "all", "Kansas",               "state", "monthly"),
    ("LASST210000000000003", "Kentucky unemployment rate",       "unemployment_rate", "All Industries", "all", "Kentucky",             "state", "monthly"),
    ("LASST220000000000003", "Louisiana unemployment rate",      "unemployment_rate", "All Industries", "all", "Louisiana",            "state", "monthly"),
    ("LASST230000000000003", "Maine unemployment rate",          "unemployment_rate", "All Industries", "all", "Maine",                "state", "monthly"),
    ("LASST240000000000003", "Maryland unemployment rate",       "unemployment_rate", "All Industries", "all", "Maryland",             "state", "monthly"),
    ("LASST250000000000003", "Massachusetts unemployment rate",  "unemployment_rate", "All Industries", "all", "Massachusetts",        "state", "monthly"),
    ("LASST260000000000003", "Michigan unemployment rate",       "unemployment_rate", "All Industries", "all", "Michigan",             "state", "monthly"),
    ("LASST270000000000003", "Minnesota unemployment rate",      "unemployment_rate", "All Industries", "all", "Minnesota",            "state", "monthly"),
    ("LASST280000000000003", "Mississippi unemployment rate",    "unemployment_rate", "All Industries", "all", "Mississippi",          "state", "monthly"),
    ("LASST290000000000003", "Missouri unemployment rate",       "unemployment_rate", "All Industries", "all", "Missouri",             "state", "monthly"),
    ("LASST300000000000003", "Montana unemployment rate",        "unemployment_rate", "All Industries", "all", "Montana",              "state", "monthly"),
    ("LASST310000000000003", "Nebraska unemployment rate",       "unemployment_rate", "All Industries", "all", "Nebraska",             "state", "monthly"),
    ("LASST320000000000003", "Nevada unemployment rate",         "unemployment_rate", "All Industries", "all", "Nevada",               "state", "monthly"),
    ("LASST330000000000003", "New Hampshire unemployment rate",  "unemployment_rate", "All Industries", "all", "New Hampshire",        "state", "monthly"),
    ("LASST340000000000003", "New Jersey unemployment rate",     "unemployment_rate", "All Industries", "all", "New Jersey",           "state", "monthly"),
    ("LASST350000000000003", "New Mexico unemployment rate",     "unemployment_rate", "All Industries", "all", "New Mexico",           "state", "monthly"),
    ("LASST360000000000003", "New York unemployment rate",       "unemployment_rate", "All Industries", "all", "New York",             "state", "monthly"),
    ("LASST370000000000003", "North Carolina unemployment rate", "unemployment_rate", "All Industries", "all", "North Carolina",       "state", "monthly"),
    ("LASST380000000000003", "North Dakota unemployment rate",   "unemployment_rate", "All Industries", "all", "North Dakota",         "state", "monthly"),
    ("LASST390000000000003", "Ohio unemployment rate",           "unemployment_rate", "All Industries", "all", "Ohio",                 "state", "monthly"),
    ("LASST400000000000003", "Oklahoma unemployment rate",       "unemployment_rate", "All Industries", "all", "Oklahoma",             "state", "monthly"),
    ("LASST410000000000003", "Oregon unemployment rate",         "unemployment_rate", "All Industries", "all", "Oregon",               "state", "monthly"),
    ("LASST420000000000003", "Pennsylvania unemployment rate",   "unemployment_rate", "All Industries", "all", "Pennsylvania",         "state", "monthly"),
    ("LASST440000000000003", "Rhode Island unemployment rate",   "unemployment_rate", "All Industries", "all", "Rhode Island",         "state", "monthly"),
    ("LASST450000000000003", "South Carolina unemployment rate", "unemployment_rate", "All Industries", "all", "South Carolina",       "state", "monthly"),
    ("LASST460000000000003", "South Dakota unemployment rate",   "unemployment_rate", "All Industries", "all", "South Dakota",         "state", "monthly"),
    ("LASST470000000000003", "Tennessee unemployment rate",      "unemployment_rate", "All Industries", "all", "Tennessee",            "state", "monthly"),
    ("LASST480000000000003", "Texas unemployment rate",          "unemployment_rate", "All Industries", "all", "Texas",                "state", "monthly"),
    ("LASST490000000000003", "Utah unemployment rate",           "unemployment_rate", "All Industries", "all", "Utah",                 "state", "monthly"),
    ("LASST500000000000003", "Vermont unemployment rate",        "unemployment_rate", "All Industries", "all", "Vermont",              "state", "monthly"),
    ("LASST510000000000003", "Virginia unemployment rate",       "unemployment_rate", "All Industries", "all", "Virginia",             "state", "monthly"),
    ("LASST530000000000003", "Washington unemployment rate",     "unemployment_rate", "All Industries", "all", "Washington",           "state", "monthly"),
    ("LASST540000000000003", "West Virginia unemployment rate",  "unemployment_rate", "All Industries", "all", "West Virginia",        "state", "monthly"),
    ("LASST550000000000003", "Wisconsin unemployment rate",      "unemployment_rate", "All Industries", "all", "Wisconsin",            "state", "monthly"),
    ("LASST560000000000003", "Wyoming unemployment rate",        "unemployment_rate", "All Industries", "all", "Wyoming",              "state", "monthly"),
]

# ---------------------------------------------------------------------------
# SAE series — state-level payroll employment + avg weekly earnings
# Format: SMS + S(SA) + {state_fips_2} + {area_5} + {industry_8} + {data_type_2}
# Statewide total nonfarm: area=00000, industry=00000000
# Data type 01 = all employees (thousands), 13 = avg weekly earnings
# Key states only for payroll — 50 states × 2 metrics = 100 series which
# exceeds batch limits fast, so we cover the 20 largest labor markets
# plus every state for unemployment (LAUS above covers all 51 already)
# ---------------------------------------------------------------------------
SAE_SERIES = [
    # Total nonfarm payroll employment by state (seasonally adjusted)
    # Format: SMS + S + fips(2) + 00000 + 00000000 + 01
    ("SMS06000000000000001", "California total nonfarm employment",     "employment_level", "Total Nonfarm", "all", "California",    "state", "monthly"),
    ("SMS48000000000000001", "Texas total nonfarm employment",          "employment_level", "Total Nonfarm", "all", "Texas",         "state", "monthly"),
    ("SMS53000000000000001", "Washington total nonfarm employment",     "employment_level", "Total Nonfarm", "all", "Washington",    "state", "monthly"),
    ("SMS36000000000000001", "New York total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "New York",      "state", "monthly"),
    ("SMS25000000000000001", "Massachusetts total nonfarm employment",  "employment_level", "Total Nonfarm", "all", "Massachusetts", "state", "monthly"),
    ("SMS17000000000000001", "Illinois total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Illinois",      "state", "monthly"),
    ("SMS12000000000000001", "Florida total nonfarm employment",        "employment_level", "Total Nonfarm", "all", "Florida",       "state", "monthly"),
    ("SMS51000000000000001", "Virginia total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Virginia",      "state", "monthly"),
    ("SMS08000000000000001", "Colorado total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Colorado",      "state", "monthly"),
    ("SMS41000000000000001", "Oregon total nonfarm employment",         "employment_level", "Total Nonfarm", "all", "Oregon",        "state", "monthly"),
    ("SMS47000000000000001", "Tennessee total nonfarm employment",      "employment_level", "Total Nonfarm", "all", "Tennessee",     "state", "monthly"),
    ("SMS37000000000000001", "North Carolina total nonfarm employment", "employment_level", "Total Nonfarm", "all", "North Carolina","state", "monthly"),
    ("SMS13000000000000001", "Georgia total nonfarm employment",        "employment_level", "Total Nonfarm", "all", "Georgia",       "state", "monthly"),
    ("SMS34000000000000001", "New Jersey total nonfarm employment",     "employment_level", "Total Nonfarm", "all", "New Jersey",    "state", "monthly"),
    ("SMS42000000000000001", "Pennsylvania total nonfarm employment",   "employment_level", "Total Nonfarm", "all", "Pennsylvania",  "state", "monthly"),
    ("SMS39000000000000001", "Ohio total nonfarm employment",           "employment_level", "Total Nonfarm", "all", "Ohio",          "state", "monthly"),
    ("SMS26000000000000001", "Michigan total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Michigan",      "state", "monthly"),
    ("SMS24000000000000001", "Maryland total nonfarm employment",       "employment_level", "Total Nonfarm", "all", "Maryland",      "state", "monthly"),
    ("SMS49000000000000001", "Utah total nonfarm employment",           "employment_level", "Total Nonfarm", "all", "Utah",          "state", "monthly"),
    ("SMS32000000000000001", "Nevada total nonfarm employment",         "employment_level", "Total Nonfarm", "all", "Nevada",        "state", "monthly"),
    # Avg weekly earnings for top tech/finance states (data type 13)
    ("SMS06000000000000013", "California avg weekly earnings",          "wage_level",       "Total Nonfarm", "all", "California",    "state", "monthly"),
    ("SMS48000000000000013", "Texas avg weekly earnings",               "wage_level",       "Total Nonfarm", "all", "Texas",         "state", "monthly"),
    ("SMS53000000000000013", "Washington avg weekly earnings",          "wage_level",       "Total Nonfarm", "all", "Washington",    "state", "monthly"),
    ("SMS36000000000000013", "New York avg weekly earnings",            "wage_level",       "Total Nonfarm", "all", "New York",      "state", "monthly"),
    ("SMS25000000000000013", "Massachusetts avg weekly earnings",       "wage_level",       "Total Nonfarm", "all", "Massachusetts", "state", "monthly"),
    ("SMS08000000000000013", "Colorado avg weekly earnings",            "wage_level",       "Total Nonfarm", "all", "Colorado",      "state", "monthly"),
    ("SMS47000000000000013", "Tennessee avg weekly earnings",           "wage_level",       "Total Nonfarm", "all", "Tennessee",     "state", "monthly"),
    ("SMS37000000000000013", "North Carolina avg weekly earnings",      "wage_level",       "Total Nonfarm", "all", "North Carolina","state", "monthly"),
    ("SMS49000000000000013", "Utah avg weekly earnings",                "wage_level",       "Total Nonfarm", "all", "Utah",          "state", "monthly"),
    ("SMS32000000000000013", "Nevada avg weekly earnings",              "wage_level",       "Total Nonfarm", "all", "Nevada",        "state", "monthly"),
]

# Group all series for batched API requests (max 25 per request)
ALL_SERIES = JOLTS_SERIES + CES_SERIES + CPS_SERIES + LAUS_SERIES + SAE_SERIES


def _chunk_series(series_list: list, chunk_size: int = 25) -> list[list]:
    """Split series list into API-safe chunks of max 25."""
    return [series_list[i:i + chunk_size] for i in range(0, len(series_list), chunk_size)]


def _build_request_payload(series_ids: list[str], start_year: str, end_year: str) -> dict:
    payload = {
        "seriesid": series_ids,
        "startyear": start_year,
        "endyear": end_year,
        "calculations": True,   # includes net_changes and pct_changes
        "annualaverage": False,
    }
    if BLS_API_KEY:
        payload["registrationkey"] = BLS_API_KEY
    return payload


def _fetch_batch(series_ids: list[str], start_year: str, end_year: str) -> dict:
    """POST one batch to BLS API v2. Returns raw response dict."""
    payload = _build_request_payload(series_ids, start_year, end_year)
    headers = {"Content-type": "application/json"}
    response = requests.post(
        BLS_API_URL,
        data=json.dumps(payload),
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    if data.get("status") != "REQUEST_SUCCEEDED":
        logger.warning(f"BLS API status: {data.get('status')} | message: {data.get('message')}")

    return data


def _build_series_lookup(series_registry: list[tuple]) -> dict:
    """
    Build id → metadata lookup. Handles two tuple formats:
      6-field (JOLTS/CES/CPS): (id, label, signal_type, industry, naics, cadence)
      8-field (LAUS/SAE):      (id, label, signal_type, industry, naics, geo, geo_type, cadence)
    """
    lookup = {}
    for s in series_registry:
        if len(s) == 8:
            lookup[s[0]] = {
                "label":        s[1],
                "signal_type":  s[2],
                "industry":     s[3],
                "naics_or_noc": s[4],
                "geo":          s[5],
                "geo_type":     s[6],
                "cadence":      s[7],
            }
        else:
            # 6-field — national series, default geo
            lookup[s[0]] = {
                "label":        s[1],
                "signal_type":  s[2],
                "industry":     s[3],
                "naics_or_noc": s[4],
                "geo":          "national",
                "geo_type":     "national",
                "cadence":      s[5],
            }
    return lookup


def _extract_latest_periods(series_data: dict, n_periods: int = 13) -> list[dict]:
    """
    Extract the latest N data points from a BLS series response object.
    Returns list of {period, value, footnotes} sorted newest first.
    BLS returns data newest-first already, but we sort to be safe.
    """
    data_points = series_data.get("data", [])
    # Sort by year desc, period desc (M12 > M01 etc.)
    sorted_points = sorted(
        data_points,
        key=lambda x: (x.get("year", "0"), x.get("period", "M00")),
        reverse=True,
    )
    results = []
    for point in sorted_points[:n_periods]:
        value = point.get("value", "-")
        if value == "-":
            continue
        results.append({
            "period":     f"{point['year']}-{point['period'].replace('M', '')}",
            "value":      float(value),
            "footnotes":  [f.get("text", "") for f in point.get("footnotes", []) if f.get("text")],
        })
    return results


def fetch_bls(
    lookback_years: int = 2,
    series_override: Optional[list[tuple]] = None,
) -> list[dict]:
    """
    Main entry point. Fetches all BLS series and returns a list of
    normalized intermediate dicts ready for transformer.py.

    Args:
        lookback_years: How many years of history to fetch (default 2).
        series_override: Optionally pass a subset of series tuples for testing.

    Returns:
        List of normalized dicts, one per series with latest 13 months of data.
    """
    series_to_fetch = series_override or ALL_SERIES
    lookup = _build_series_lookup(series_to_fetch)

    end_year   = str(datetime.now().year)
    start_year = str(datetime.now().year - lookback_years)

    series_ids = [s[0] for s in series_to_fetch]
    chunks     = _chunk_series(series_ids, chunk_size=25)

    # Map series_id → raw BLS series response
    raw_by_id: dict[str, dict] = {}
    for i, chunk in enumerate(chunks):
        logger.info(f"Fetching BLS batch {i+1}/{len(chunks)} ({len(chunk)} series)")
        try:
            response = _fetch_batch(chunk, start_year, end_year)
            for series in response.get("Results", {}).get("series", []):
                raw_by_id[series["seriesID"]] = series
        except requests.RequestException as e:
            logger.error(f"BLS batch {i+1} failed: {e}")
            # Continue — partial results are still useful
            continue

    # Build normalized output dicts
    normalized: list[dict] = []
    for series_id, meta in lookup.items():
        raw = raw_by_id.get(series_id)
        if not raw:
            logger.warning(f"No data returned for series {series_id}")
            continue

        periods = _extract_latest_periods(raw, n_periods=13)
        if not periods:
            logger.warning(f"Empty data for series {series_id}")
            continue

        latest   = periods[0]
        previous = periods[1] if len(periods) > 1 else None
        # 12-month average
        avg_12mo = round(
            sum(p["value"] for p in periods[:12]) / min(len(periods), 12), 2
        ) if periods else None

        normalized.append({
            # Identity
            "series_id":    series_id,
            "source":       _resolve_source(series_id),
            "country":      "US",
            "country_name": "United States",
            # Classification
            "signal_type":  meta["signal_type"],
            "industry":     meta["industry"],
            "naics_or_noc": meta["naics_or_noc"],
            "geo":          meta["geo"],
            "geo_type":     meta["geo_type"],
            "cadence":      meta["cadence"],
            # Time
            "period":       latest["period"],
            # Values for transformer to use in prose generation
            "values": {
                "latest":           latest["value"],
                "previous":         previous["value"] if previous else None,
                "mom_change":       round(latest["value"] - previous["value"], 3) if previous else None,
                "avg_12mo":         avg_12mo,
                "trend_direction":  _trend(latest["value"], avg_12mo),
                "periods_history":  periods,  # full 13-month history
            },
            # Passthrough label for transformer
            "series_label": meta["label"],
        })

    logger.info(f"BLS fetch complete: {len(normalized)} series normalized")
    return normalized


def _resolve_source(series_id: str) -> str:
    """Map series prefix to human-readable source name."""
    prefix_map = {
        "JTS": "BLS_JOLTS",
        "JTU": "BLS_JOLTS",
        "CES": "BLS_CES",
        "LNS": "BLS_CPS",
        "LNU": "BLS_CPS",
        "LAS": "BLS_LAUS",
        "SMS": "BLS_SAE",
        "SMU": "BLS_SAE",
    }
    for prefix, source in prefix_map.items():
        if series_id.startswith(prefix):
            return source
    return "BLS_UNKNOWN"


def _trend(latest: float, avg_12mo: Optional[float]) -> str:
    """Simple trend label for transformer context."""
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Quick test — fetch just 3 series to verify connectivity
    test_series = JOLTS_SERIES[:3]
    results = fetch_bls(lookback_years=1, series_override=test_series)
    for r in results:
        print(json.dumps({k: v for k, v in r.items() if k != "values"}, indent=2))
        print(f"  latest: {r['values']['latest']}, avg_12mo: {r['values']['avg_12mo']}, trend: {r['values']['trend_direction']}")
        print()