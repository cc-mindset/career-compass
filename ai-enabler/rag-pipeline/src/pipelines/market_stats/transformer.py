"""
Market Stats Transformer
=========================
Converts normalized fetcher dicts (from fetcher_bls.py, fetcher_statscan.py or
fetcher_imf.py) into embeddable prose chunks — same logic, same output schema
regardless of source.

This is the most important stage: raw numbers embed poorly. The LLM needs
interpretive language around the numbers to reason about career risk.

Output per chunk:
  {
    "chunk_id":    str,         # deterministic: {series_id}_{period}
    "text":        str,         # the embeddable prose — what gets sent to OpenAI
    "metadata":    dict,        # Pinecone metadata for pre-filtering
    "namespace":   str,         # which Pinecone namespace this goes into
  }

Namespace routing:
  signal_type → namespace
  contraction_indicator, employment_level, worker_confidence, hiring_rate
    → "labor-market-stats"
  vacancy_rate, unemployment_rate
    → "labor-market-stats"  (also)
  wage_level
    → "geo-labor-signals"   (wage data is inherently geo-relevant)
  unemployment_outlook, gdp_outlook (IMF WEO projections)
    → "forward-looking"     (actuals-only sources can't produce this; IMF can)

The text field follows the same context-prefix pattern as market_reports:
  "Country: {X} | Source: {Y} | Industry: {Z} | Signal: {A} | Period: {B} |
   Region: {C} | Content: {prose}"
"""

import hashlib
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Signal type → namespace routing
# ---------------------------------------------------------------------------
NAMESPACE_MAP = {
    "contraction_indicator": "labor-market-stats",
    "employment_level":      "labor-market-stats",
    "worker_confidence":     "labor-market-stats",
    "hiring_rate":           "labor-market-stats",
    "vacancy_rate":          "labor-market-stats",
    "unemployment_rate":     "labor-market-stats",
    "wage_level":            "geo-labor-signals",
    "unemployment_outlook":  "forward-looking",
    "gdp_outlook":           "forward-looking",
}

# ---------------------------------------------------------------------------
# Human-readable signal type labels (used in prose)
# ---------------------------------------------------------------------------
SIGNAL_LABELS = {
    "contraction_indicator": "layoffs and discharges rate",
    "employment_level":      "payroll employment level",
    "worker_confidence":     "quits rate (worker confidence)",
    "hiring_rate":           "hires rate",
    "vacancy_rate":          "job vacancy / openings rate",
    "unemployment_rate":     "unemployment rate",
    "wage_level":            "average wage / earnings",
    "unemployment_outlook":  "unemployment rate outlook",
    "gdp_outlook":           "GDP growth outlook",
}

# ---------------------------------------------------------------------------
# Prose templates per signal type
# ---------------------------------------------------------------------------

def _prose_contraction(d: dict, v: dict) -> str:
    latest    = v["latest"]
    avg       = v["avg_12mo"]
    prev      = v["previous"]
    trend     = v["trend_direction"]
    mom       = v.get("mom_change")
    industry  = d["industry"]
    country   = d["country_name"]
    period    = d["period"]
    source    = d["source"]

    # Trend interpretation
    if trend in ("significantly_elevated", "elevated"):
        assessment = (
            f"This is above the 12-month average of {avg}, indicating an active "
            f"contraction phase with elevated displacement risk in this sector."
        )
        risk_signal = "elevated layoff risk"
    elif trend in ("significantly_below", "below"):
        assessment = (
            f"This is below the 12-month average of {avg}, suggesting the sector "
            f"is in a relatively stable or recovery phase with low displacement pressure."
        )
        risk_signal = "low layoff risk"
    else:
        assessment = (
            f"This is near the 12-month average of {avg}, indicating stable "
            f"conditions with no significant layoff pressure."
        )
        risk_signal = "near-average layoff risk"

    mom_str = ""
    if mom is not None:
        direction = "up" if mom > 0 else "down"
        mom_str = f" The rate moved {direction} by {abs(mom):.2f} percentage points from the prior period."

    return (
        f"The {SIGNAL_LABELS['contraction_indicator']} for the {industry} sector "
        f"in {country} stood at {latest} in {period} ({source}).{mom_str} "
        f"{assessment} Overall signal: {risk_signal}."
    )


def _prose_employment_level(d: dict, v: dict) -> str:
    latest   = v["latest"]
    prev     = v["previous"]
    mom      = v.get("mom_change")
    avg      = v["avg_12mo"]
    trend    = v["trend_direction"]
    industry = d["industry"]
    country  = d["country_name"]
    period   = d["period"]
    source   = d["source"]

    mom_str = ""
    if mom is not None and prev is not None:
        direction = "gained" if mom > 0 else "lost"
        mom_str = f" The sector {direction} approximately {abs(mom):.1f}k jobs from the prior period."

    if trend in ("significantly_elevated", "elevated"):
        momentum = "expanding above its recent trend"
    elif trend in ("significantly_below", "below"):
        momentum = "contracting below its recent trend"
    else:
        momentum = "holding near its recent average"

    return (
        f"Payroll employment in the {industry} sector in {country} was {latest} thousand "
        f"in {period} ({source}).{mom_str} Employment is currently {momentum} "
        f"(12-month average: {avg}k)."
    )


def _prose_vacancy_rate(d: dict, v: dict) -> str:
    latest   = v["latest"]
    avg      = v["avg_12mo"]
    mom      = v.get("mom_change")
    trend    = v["trend_direction"]
    industry = d["industry"]
    country  = d["country_name"]
    period   = d["period"]
    source   = d["source"]

    mom_str = ""
    if mom is not None:
        direction = "rose" if mom > 0 else "fell"
        mom_str = f" The vacancy rate {direction} by {abs(mom):.2f} points from the prior period."

    if trend in ("significantly_elevated", "elevated"):
        demand_signal = "strong — employers are actively struggling to fill roles, indicating high career demand"
    elif trend in ("significantly_below", "below"):
        demand_signal = "weak — fewer open roles than usual, indicating reduced career demand or hiring freeze"
    else:
        demand_signal = "moderate — in line with recent trend"

    return (
        f"The job vacancy / openings rate for {industry} in {country} was {latest}% "
        f"in {period} ({source}).{mom_str} "
        f"12-month average: {avg}%. Demand signal: {demand_signal}."
    )


def _prose_unemployment_rate(d: dict, v: dict) -> str:
    latest   = v["latest"]
    avg      = v["avg_12mo"]
    mom      = v.get("mom_change")
    trend    = v["trend_direction"]
    industry = d["industry"]
    country  = d["country_name"]
    period   = d["period"]
    source   = d["source"]
    geo      = d["geo"]

    geo_str = f" in {geo}" if geo not in ("national", "all") else f" nationally in {country}"

    mom_str = ""
    if mom is not None:
        direction = "rose" if mom > 0 else "fell"
        mom_str = f" The rate {direction} by {abs(mom):.2f} points from the prior period."

    if trend in ("significantly_elevated", "elevated"):
        reading = "elevated — workers in this category face harder-than-usual conditions"
    elif trend in ("significantly_below", "below"):
        reading = "low — favorable conditions, high absorption of available workers"
    else:
        reading = "near typical levels"

    return (
        f"The unemployment rate for {industry}{geo_str} was {latest}% in {period} ({source}).{mom_str} "
        f"12-month average: {avg}%. Current conditions: {reading}."
    )


def _prose_wage_level(d: dict, v: dict) -> str:
    latest   = v["latest"]
    avg      = v["avg_12mo"]
    mom      = v.get("mom_change")
    trend    = v["trend_direction"]
    industry = d["industry"]
    country  = d["country_name"]
    period   = d["period"]
    source   = d["source"]
    geo      = d["geo"]

    unit = "CAD/week" if d["country"] == "CA" and "weekly" in d["series_label"].lower() else (
        "CAD" if d["country"] == "CA" else "USD"
    )

    mom_str = ""
    if mom is not None:
        direction = "increased" if mom > 0 else "decreased"
        mom_str = f" Wages {direction} by {abs(mom):.2f} {unit} from the prior period."

    geo_str = f" in {geo}" if geo not in ("national", "all") else ""

    return (
        f"Average wages / earnings for the {industry} sector{geo_str} in {country} "
        f"were {latest} {unit} in {period} ({source}).{mom_str} "
        f"12-month average: {avg} {unit}. "
        f"Wage trend is currently {trend.replace('_', ' ')}."
    )


def _prose_worker_confidence(d: dict, v: dict) -> str:
    latest   = v["latest"]
    avg      = v["avg_12mo"]
    mom      = v.get("mom_change")
    trend    = v["trend_direction"]
    industry = d["industry"]
    country  = d["country_name"]
    period   = d["period"]
    source   = d["source"]

    note = ""
    if d["country"] == "CA":
        note = " (Note: Canada uses a job leavers proxy — less precise than US JOLTS quits rate.)"

    if trend in ("significantly_elevated", "elevated"):
        reading = "high — workers are voluntarily leaving at above-normal rates, indicating strong confidence in finding new roles"
    elif trend in ("significantly_below", "below"):
        reading = "low — workers are staying put, indicating reduced confidence in the job market"
    else:
        reading = "near average — neutral signal on worker confidence"

    return (
        f"The quits / voluntary separation rate for {industry} in {country} was {latest}% "
        f"in {period} ({source}).{note} "
        f"12-month average: {avg}%. Worker confidence signal: {reading}."
    )


def _prose_hiring_rate(d: dict, v: dict) -> str:
    latest   = v["latest"]
    avg      = v["avg_12mo"]
    industry = d["industry"]
    country  = d["country_name"]
    period   = d["period"]
    source   = d["source"]
    trend    = v["trend_direction"]

    return (
        f"The hires rate for {industry} in {country} was {latest}% in {period} ({source}). "
        f"12-month average: {avg}%. "
        f"Current hiring pace is {trend.replace('_', ' ')} relative to recent trend."
    )


def _prose_outlook(indicator_phrase: str, d: dict, v: dict) -> str:
    """
    Shared prose builder for IMF outlook signal types (unemployment_outlook,
    gdp_outlook) — both have the same values shape: a current-year estimate
    plus a list of future projected years.
    """
    country   = d["country_name"]
    period    = d["period"]
    source    = d["source"]
    unit      = v["unit"]
    current   = v["current_estimate"]
    projected = v["projected"]

    current_str = f"{current}{unit}" if current is not None else "not yet published"
    lead = f"The IMF estimates {indicator_phrase} for {country} at {current_str} in {period} ({source})."

    if not projected:
        return lead

    final = projected[-1]
    if current is None:
        direction = "projected at"
    elif final["value"] > current:
        direction = "rising to"
    elif final["value"] < current:
        direction = "easing to"
    else:
        direction = "holding near"

    path = ", ".join(f"{p['year']}: {p['value']}{unit}" for p in projected)
    return (
        f"{lead} Its multi-year outlook has this {direction} {final['value']}{unit} "
        f"by {final['year']} (path: {path})."
    )


def _prose_unemployment_outlook(d: dict, v: dict) -> str:
    return _prose_outlook("the unemployment rate", d, v)


def _prose_gdp_outlook(d: dict, v: dict) -> str:
    return _prose_outlook("real GDP growth", d, v)


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
PROSE_GENERATORS = {
    "contraction_indicator": _prose_contraction,
    "employment_level":      _prose_employment_level,
    "vacancy_rate":          _prose_vacancy_rate,
    "unemployment_rate":     _prose_unemployment_rate,
    "wage_level":            _prose_wage_level,
    "worker_confidence":     _prose_worker_confidence,
    "hiring_rate":           _prose_hiring_rate,
    "unemployment_outlook":  _prose_unemployment_outlook,
    "gdp_outlook":           _prose_gdp_outlook,
}


def _build_context_prefix(d: dict) -> str:
    """
    Mirrors the context prefix format from the market_reports pipeline.
    This is prepended to the prose before embedding.
    """
    return (
        f"Country: {d['country_name']} | "
        f"Source: {d['source']} | "
        f"Industry: {d['industry']} | "
        f"Signal: {SIGNAL_LABELS.get(d['signal_type'], d['signal_type'])} | "
        f"Period: {d['period']} | "
        f"Region: {d['geo']} | "
        f"Content: "
    )


def _build_metadata(d: dict) -> dict:
    """
    Pinecone metadata — used for pre-filtering at query time.
    Your backend can filter on any of these fields before semantic search.
    """
    return {
        "country":      d["country"],
        "source":       d["source"],
        "signal_type":  d["signal_type"],
        "industry":     d["industry"],
        "naics_or_noc": d["naics_or_noc"],
        "geo":          d["geo"],
        "geo_type":     d["geo_type"],
        "period":       d["period"],
        "cadence":      d["cadence"],
        "series_id":    d["series_id"],
    }


def _chunk_id(series_id: str, period: str) -> str:
    """Deterministic chunk ID — same series + period always produces the same ID."""
    raw = f"{series_id}_{period}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def transform(normalized_records: list[dict]) -> list[dict]:
    """
    Main entry point. Accepts list of normalized fetcher dicts (BLS or StatsCan)
    and returns list of chunk dicts ready for embedder.py.

    Args:
        normalized_records: Output from fetch_bls() or fetch_statscan().

    Returns:
        List of chunk dicts with keys: chunk_id, text, metadata, namespace.
    """
    chunks = []

    for d in normalized_records:
        signal_type = d.get("signal_type", "")
        prose_fn    = PROSE_GENERATORS.get(signal_type)

        if not prose_fn:
            logger.warning(f"No prose generator for signal_type '{signal_type}' — skipping {d['series_id']}")
            continue

        try:
            prose      = prose_fn(d, d["values"])
            prefix     = _build_context_prefix(d)
            full_text  = prefix + prose
            namespace  = NAMESPACE_MAP.get(signal_type, "labor-market-stats")
            metadata   = _build_metadata(d)
            cid        = _chunk_id(d["series_id"], d["period"])

            chunks.append({
                "chunk_id":  cid,
                "text":      full_text,
                "metadata":  metadata,
                "namespace": namespace,
            })

        except Exception as e:
            logger.error(f"Transform failed for {d['series_id']}: {e}")
            continue

    logger.info(f"Transform complete: {len(chunks)} chunks from {len(normalized_records)} records")
    return chunks


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Smoke test with fake data matching the normalized schema
    fake_records = [
        {
            "series_id":    "JTS510000000000000LDS",
            "source":       "BLS_JOLTS",
            "country":      "US",
            "country_name": "United States",
            "signal_type":  "contraction_indicator",
            "industry":     "Information",
            "naics_or_noc": "51",
            "geo":          "national",
            "geo_type":     "national",
            "cadence":      "monthly",
            "period":       "2025-02",
            "series_label": "Information - layoffs rate",
            "values": {
                "latest":          1.6,
                "previous":        1.4,
                "mom_change":      0.2,
                "avg_12mo":        1.1,
                "trend_direction": "significantly_elevated",
                "periods_history": [{"period": "2025-02", "value": 1.6}],
            },
        },
        {
            "series_id":    "STATSCAN_V1100965",
            "source":       "STATSCAN_LFS",
            "country":      "CA",
            "country_name": "Canada",
            "signal_type":  "employment_level",
            "industry":     "Total Industries",
            "naics_or_noc": "all",
            "geo":          "national",
            "geo_type":     "national",
            "cadence":      "monthly",
            "period":       "2025-02",
            "series_label": "Canada - total employment",
            "values": {
                "latest":          20150.4,
                "previous":        20100.1,
                "mom_change":      50.3,
                "avg_12mo":        20050.0,
                "trend_direction": "elevated",
                "periods_history": [{"period": "2025-02", "value": 20150.4}],
            },
        },
    ]

    chunks = transform(fake_records)
    for c in chunks:
        print(f"chunk_id: {c['chunk_id']}")
        print(f"namespace: {c['namespace']}")
        print(f"text:\n{c['text']}")
        print(f"metadata: {json.dumps(c['metadata'], indent=2)}")
        print()