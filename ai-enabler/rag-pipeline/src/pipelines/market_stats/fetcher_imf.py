"""
IMF Fetcher
===========
Fetches unemployment-rate and real-GDP-growth projections from the IMF
DataMapper API (World Economic Outlook data) for the market_stats pipeline.

This is the one thing BLS/StatsCan can't produce: they report actuals only.
IMF WEO reports actual + forecast years in the same series, so this feeds the
`unemployment_outlook` / `gdp_outlook` signal types (namespace "forward-looking"),
which ground the Market Report's "12-month outlook" claim in a real projection
instead of LLM narrative.

API: https://www.imf.org/external/datamapper/api/v1/{indicator}
     No key required. Country-path filtering does not actually filter
     server-side (confirmed empirically — /LUR/USA still returns every
     country), so we fetch the full indicator (~50-70KB) and slice out
     US/CA in Python.

Outputs: list of normalized dicts ready for transformer.py.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import requests

logger = logging.getLogger(__name__)

IMF_API_URL = "https://www.imf.org/external/datamapper/api/v1"

# indicator code -> (human label, unit, signal_type)
INDICATORS = {
    "LUR":       ("Unemployment rate", "%", "unemployment_outlook"),
    "NGDP_RPCH": ("Real GDP growth",   "%", "gdp_outlook"),
}

COUNTRIES = {
    "USA": ("US", "United States"),
    "CAN": ("CA", "Canada"),
}


def _fetch_indicator(indicator: str) -> dict:
    response = requests.get(
        f"{IMF_API_URL}/{indicator}",
        timeout=30,
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    return response.json()


def fetch_imf(projection_years: int = 5) -> list[dict]:
    """
    Main entry point. Fetches IMF WEO projections for US + CA and returns
    normalized dicts ready for transformer.py.

    Args:
        projection_years: how many future years of projection to keep per indicator.

    Returns:
        List of normalized dicts, one per (indicator, country).
    """
    current_year = datetime.now(timezone.utc).year
    normalized: list[dict] = []

    for indicator, (label, unit, signal_type) in INDICATORS.items():
        try:
            payload = _fetch_indicator(indicator)
        except requests.RequestException as e:
            logger.error(f"IMF fetch failed for {indicator}: {e}")
            continue

        series_by_country = payload.get("values", {}).get(indicator, {})

        for iso3, (country, country_name) in COUNTRIES.items():
            series = series_by_country.get(iso3)
            if not series:
                logger.warning(f"No IMF data for {indicator}/{iso3}")
                continue

            current_estimate = series.get(str(current_year))
            projected = [
                {"year": year, "value": series[year]}
                for year in sorted(series.keys())
                if year.isdigit() and int(year) > current_year
            ][:projection_years]

            if current_estimate is None and not projected:
                logger.warning(f"No usable IMF data for {indicator}/{iso3}")
                continue

            normalized.append({
                "series_id":    f"IMF_WEO_{indicator}_{iso3}",
                "source":       "IMF_WEO",
                "country":      country,
                "country_name": country_name,
                "signal_type":  signal_type,
                "industry":     "All industries",
                "naics_or_noc": "all",
                "geo":          "national",
                "geo_type":     "national",
                "cadence":      "annual",
                "period":       str(current_year),
                "values": {
                    "indicator_label":  label,
                    "unit":             unit,
                    "current_estimate": current_estimate,
                    "projected":        projected,
                },
                "series_label": f"{country_name} - {label} (IMF WEO projection)",
            })

    logger.info(f"IMF fetch complete: {len(normalized)} series normalized")
    return normalized


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    records = fetch_imf()
    for r in records:
        print(f"{r['series_id']}: {r['values']}")
