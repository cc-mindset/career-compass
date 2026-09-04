import GeoHiringTrend from "../../db/models/geoHiringTrend.js";
import {
  GEO_HIRING_TREND_LOCATIONS,
  NATIONAL_COMPARATOR_SERIES_ID,
  NATIONAL_COMPARATOR_LABEL,
} from "../../constants/geoHiringTrendLocations.js";
import type { HiringTrendSeries, HiringTrendPoint } from "../../types/marketReport";
import { logger } from "../../utils/logger.js";

// Deterministic, no LLM call — exact-key Mongo lookup against geo_hiring_trend
// (ai-enabler). Three tiers: curated alias -> metro/CMA match -> state/province
// fallback. Never fabricates a trend line.

const UNAVAILABLE: HiringTrendSeries = {
  available: false,
  window_label: "",
  local_label: "",
  national_label: "",
  points: [],
};

type Country = "US" | "CA";

const normalizeLocation = (location: string): string =>
  location.trim().toLowerCase().replace(/\s+/g, " ");

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const COUNTRY_HINTS: { pattern: RegExp; country: Country }[] = [
  { pattern: /usa$|united states$/i, country: "US" },
  { pattern: /canada$/i, country: "CA" },
];

// Disambiguates same-named metros in different states, e.g. "Bloomington, IL"
// vs "Bloomington, IN" — both stored as "Bloomington (XX)" in geo_hiring_trend.
const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** "City, Region, Country" -> parts. Doesn't handle freeform text beyond that shape. */
const parseLocation = (location: string): { city: string; region: string; country: Country | null } => {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const country = COUNTRY_HINTS.find((h) => h.pattern.test(last))?.country ?? null;
  return { city: parts[0] || "", region: parts.length >= 3 ? parts[parts.length - 2] : "", country };
};

const buildSeries = async (geo: string, country: Country): Promise<HiringTrendSeries> => {
  const [localDoc, nationalDoc] = await Promise.all([
    GeoHiringTrend.findOne({ geo, country, signal_type: "unemployment_rate" }).lean(),
    GeoHiringTrend.findOne({ series_id: NATIONAL_COMPARATOR_SERIES_ID[country] }).lean(),
  ]);
  if (!localDoc || !nationalDoc) {
    logger.warn(`hiringTrendService: missing doc for geo="${geo}" country="${country}"`);
    return UNAVAILABLE;
  }

  const nationalByPeriod = new Map((nationalDoc.periods_history || []).map((p) => [p.period, p.value]));
  const points: HiringTrendPoint[] = (localDoc.periods_history || [])
    .filter((p) => nationalByPeriod.has(p.period))
    .map((p) => ({ period: p.period, local_index: p.value, national_index: nationalByPeriod.get(p.period) as number }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

  if (points.length < 2) return UNAVAILABLE;

  return {
    available: true,
    window_label: `Last ${points.length} months`,
    local_label: `${geo} (unemployment rate)`,
    national_label: `${NATIONAL_COMPARATOR_LABEL[country]} (unemployment rate)`,
    points,
  };
};

export async function resolveHiringTrendSeries(location: string): Promise<HiringTrendSeries> {
  try {
    const curated = GEO_HIRING_TREND_LOCATIONS[normalizeLocation(location)];
    if (curated) return await buildSeries(curated.geo, curated.country);

    const { city, region, country } = parseLocation(location);
    if (!country) return UNAVAILABLE;

    if (city) {
      // Matches an exact geo, or city as a hyphen/space-delimited component of a
      // compound metro name (e.g. "Chicago" inside "Chicago-Naperville-Elgin").
      const componentPattern = new RegExp(`(^|[\\s-])${escapeRegex(city)}($|[\\s-])`, "i");
      const metroDocs = await GeoHiringTrend.find({
        country,
        geo_type: "metro",
        signal_type: "unemployment_rate",
        geo: componentPattern,
      }).lean();

      if (metroDocs.length === 1) return await buildSeries(metroDocs[0].geo, country);
      if (metroDocs.length > 1) {
        // Same-named metro in multiple states (e.g. "Springfield") — disambiguate
        // via the parsed state, e.g. geo "Springfield (IL)" contains "(IL)".
        const abbr = country === "US" ? US_STATE_ABBR[region.toLowerCase()] : undefined;
        const disambiguated = abbr ? metroDocs.find((d) => d.geo.includes(`(${abbr})`)) : undefined;
        return await buildSeries((disambiguated || metroDocs[0]).geo, country);
      }
    }

    if (region) {
      const stateDoc = await GeoHiringTrend.findOne({
        country,
        geo_type: { $in: ["state", "provincial"] },
        signal_type: "unemployment_rate",
        geo: new RegExp(`^${escapeRegex(region)}$`, "i"),
      }).lean();
      if (stateDoc) return await buildSeries(stateDoc.geo, country);
    }

    return UNAVAILABLE;
  } catch (error) {
    logger.error(`hiringTrendService: lookup failed for location="${location}"`, error as Error);
    return UNAVAILABLE;
  }
}
