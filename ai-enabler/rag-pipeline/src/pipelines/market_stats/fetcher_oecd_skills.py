"""
OECD Skills for Jobs Fetcher
=============================
Fetches skill shortage/surplus index data from OECD's Skills for Jobs
Database for the market_stats pipeline. Feeds the `skills_demand` signal
type (namespace "labor-market-stats" — a national labor-market health
indicator alongside unemployment/vacancy, not geo-specific like wages).

This is a frozen edition snapshot, NOT a rolling series — confirmed via
the dataset's own structure: it has only two dimensions (LOCATION, SKILL),
no TIME_PERIOD at all. The "2022" in the dataset code is the edition year,
not a queryable date range. Re-run this manually whenever OECD ships a new
edition (new dataset code, e.g. a future S4J2025) rather than putting it
on the monthly cadence BLS/StatsCan use — the data won't change in between.

API: https://sdmx.oecd.org/archive/rest/data/OECD,DF_S4J2022/?format=jsondata
     No key required. Found via the "Download the Data" link on
     oecdskillsforjobsdatabase.org (not in OECD's main Data Explorer
     catalog — it's a separate, standalone tool).

Only the 14 top-level skill categories are kept (out of 70 total codes in
the dataset) — the other 56 are narrower sub-splits of these same 14;
keeping only the top level avoids ~4x more chunks for marginal specificity.

Outputs: list of normalized dicts ready for transformer.py.
"""

import logging

import requests

logger = logging.getLogger(__name__)

OECD_SKILLS_URL = "https://sdmx.oecd.org/archive/rest/data/OECD,DF_S4J2022/?format=jsondata"

COUNTRIES = {
    "USA": ("US", "United States"),
    "CAN": ("CA", "Canada"),
}

# Edition year — this dataset has no TIME_PERIOD dimension of its own.
EDITION_PERIOD = "2022"


def _fetch_raw() -> dict:
    response = requests.get(
        OECD_SKILLS_URL,
        timeout=30,
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    return response.json()


def fetch_oecd_skills() -> list[dict]:
    """
    Main entry point. Fetches the OECD Skills for Jobs index for US + CA,
    top-level skill categories only, and returns normalized dicts ready
    for transformer.py.
    """
    payload = _fetch_raw()
    struct = payload["data"]["structures"][0]
    dims = struct["dimensions"]["observation"]
    loc_dim = next(d for d in dims if d["id"] == "LOCATION")["values"]
    skill_dim = next(d for d in dims if d["id"] == "SKILL")["values"]

    loc_index = {v["id"]: i for i, v in enumerate(loc_dim)}
    skill_by_index = {i: v for i, v in enumerate(skill_dim)}
    # Keep only top-level (parent) skill categories — codes with no hyphen.
    top_level_indices = {i for i, v in skill_by_index.items() if "-" not in v["id"]}

    observations = payload["data"]["dataSets"][0]["observations"]

    normalized: list[dict] = []
    for iso3, (country, country_name) in COUNTRIES.items():
        if iso3 not in loc_index:
            logger.warning(f"No OECD Skills for Jobs data for {iso3}")
            continue
        loc_i = loc_index[iso3]

        for key, val in observations.items():
            loc_str, skill_str = key.split(":")
            if int(loc_str) != loc_i:
                continue
            skill_i = int(skill_str)
            if skill_i not in top_level_indices:
                continue

            index_value = val[0]
            if index_value is None:
                continue

            skill_meta = skill_by_index[skill_i]
            skill_label = skill_meta.get("name") or skill_meta["id"]

            normalized.append({
                "series_id":    f"OECD_S4J{EDITION_PERIOD}_{skill_meta['id']}_{iso3}",
                "source":       "OECD_S4J",
                "country":      country,
                "country_name": country_name,
                "signal_type":  "skills_demand",
                "industry":     "All industries",
                "naics_or_noc": "all",
                "geo":          "national",
                "geo_type":     "national",
                "cadence":      "edition",
                "period":       EDITION_PERIOD,
                "values": {
                    "skill_category": skill_label,
                    "index":          index_value,
                },
                "series_label": f"{country_name} - {skill_label} skill needs index (OECD S4J {EDITION_PERIOD})",
            })

    logger.info(f"OECD Skills for Jobs fetch complete: {len(normalized)} series normalized")
    return normalized


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    records = fetch_oecd_skills()
    for r in records:
        print(f"{r['series_id']}: {r['values']}")
