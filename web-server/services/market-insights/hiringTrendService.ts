import GeoHiringTrend from "../../db/models/geoHiringTrend.js";
import {
  GEO_HIRING_TREND_LOCATIONS,
  NATIONAL_COMPARATOR_SERIES_ID,
  NATIONAL_COMPARATOR_LABEL,
} from "../../constants/geoHiringTrendLocations.js";
import type { HiringTrendSeries, HiringTrendPoint } from "../../types/marketReport";
import { logger } from "../../utils/logger.js";

/**
 * Deterministic, retrieval-free real local-vs-national hiring trend for the
 * Market Report Overview "Market direction" chart — see
 * types/marketReport.ts's HiringTrendSeries docstring for why this is never
 * requested from the LLM. This is an exact-key lookup (geo + series_id)
 * against geo_hiring_trend, not a RAG/Pinecone query: structured monthly
 * numeric data with a known key doesn't benefit from semantic search.
 */
const UNAVAILABLE: HiringTrendSeries = {
  available: false,
  window_label: "",
  local_label: "",
  national_label: "",
  points: [],
};

const normalizeLocation = (location: string): string =>
  location.trim().toLowerCase().replace(/\s+/g, " ");

export async function resolveHiringTrendSeries(location: string): Promise<HiringTrendSeries> {
  const resolved = GEO_HIRING_TREND_LOCATIONS[normalizeLocation(location)];
  if (!resolved) return UNAVAILABLE;

  try {
    const [localDoc, nationalDoc] = await Promise.all([
      GeoHiringTrend.findOne({
        geo: resolved.geo,
        country: resolved.country,
        signal_type: "unemployment_rate",
      }).lean(),
      GeoHiringTrend.findOne({
        series_id: NATIONAL_COMPARATOR_SERIES_ID[resolved.country],
      }).lean(),
    ]);

    if (!localDoc || !nationalDoc) {
      logger.warn(
        `hiringTrendService: no geo_hiring_trend doc for geo="${resolved.geo}" country="${resolved.country}" (local=${!!localDoc}, national=${!!nationalDoc})`,
      );
      return UNAVAILABLE;
    }

    const nationalByPeriod = new Map(
      (nationalDoc.periods_history || []).map((p) => [p.period, p.value]),
    );

    const points: HiringTrendPoint[] = (localDoc.periods_history || [])
      .filter((p) => nationalByPeriod.has(p.period))
      .map((p) => ({
        period: p.period,
        local_index: p.value,
        national_index: nationalByPeriod.get(p.period) as number,
      }))
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

    // Fewer than 2 points isn't a usable trend line.
    if (points.length < 2) return UNAVAILABLE;

    return {
      available: true,
      window_label: `Last ${points.length} months`,
      local_label: `${resolved.geo} (unemployment rate)`,
      national_label: `${NATIONAL_COMPARATOR_LABEL[resolved.country]} (unemployment rate)`,
      points,
    };
  } catch (error) {
    logger.error(`hiringTrendService: lookup failed for location="${location}"`, error as Error);
    return UNAVAILABLE;
  }
}
