/**
 * Maps client LOCATION_OPTIONS (client/client/app/src/consts/index.ts) to the
 * metro (US, BLS LAUS) / CMA (Canada, StatsCan table 14-10-0459-01) geo key
 * used in the geo_hiring_trend Mongo collection — see
 * ai-enabler/rag-pipeline/src/pipelines/market_stats/{fetcher_bls,fetcher_statscan}.py
 * for the underlying series registry these geo values come from.
 *
 * Keys are lowercase, whitespace-collapsed LOCATION_OPTIONS strings.
 *
 * Mississauga and Brampton are not separate StatsCan CMAs — both fold into
 * the Toronto CMA (there is no finer-grained official data to show instead).
 * Every other US/Canada city in LOCATION_OPTIONS has direct metro/CMA
 * coverage. International locations and the 3 "Remote — *" options have no
 * single local geo to compare against a national baseline, so they are
 * intentionally absent here — resolveHiringTrendSeries() (hiringTrendService.ts)
 * returns `available: false` for anything not in this table, rather than
 * guessing or falling back to a mismatched geo.
 */
export interface GeoHiringTrendLocation {
  geo: string;
  country: "US" | "CA";
}

export const GEO_HIRING_TREND_LOCATIONS: Record<string, GeoHiringTrendLocation> = {
  "toronto, ontario, canada": { geo: "Toronto", country: "CA" },
  "vancouver, british columbia, canada": { geo: "Vancouver", country: "CA" },
  "montreal, quebec, canada": { geo: "Montreal", country: "CA" },
  "calgary, alberta, canada": { geo: "Calgary", country: "CA" },
  "ottawa, ontario, canada": { geo: "Ottawa", country: "CA" },
  "edmonton, alberta, canada": { geo: "Edmonton", country: "CA" },
  "winnipeg, manitoba, canada": { geo: "Winnipeg", country: "CA" },
  "halifax, nova scotia, canada": { geo: "Halifax", country: "CA" },
  "mississauga, ontario, canada": { geo: "Toronto", country: "CA" }, // no separate CMA
  "brampton, ontario, canada": { geo: "Toronto", country: "CA" }, // no separate CMA
  "hamilton, ontario, canada": { geo: "Hamilton", country: "CA" },
  "kitchener-waterloo, ontario, canada": { geo: "Kitchener-Waterloo", country: "CA" },
  "london, ontario, canada": { geo: "London", country: "CA" },
  "sudbury, ontario, canada": { geo: "Sudbury", country: "CA" },

  "new york, new york, usa": { geo: "New York", country: "US" },
  "san francisco bay area, california, usa": { geo: "San Francisco Bay Area", country: "US" },
  "los angeles, california, usa": { geo: "Los Angeles", country: "US" },
  "chicago, illinois, usa": { geo: "Chicago", country: "US" },
  "boston, massachusetts, usa": { geo: "Boston", country: "US" },
  "seattle, washington, usa": { geo: "Seattle", country: "US" },
  "austin, texas, usa": { geo: "Austin", country: "US" },
  "dallas–fort worth, texas, usa": { geo: "Dallas–Fort Worth", country: "US" },
  "atlanta, georgia, usa": { geo: "Atlanta", country: "US" },
  "washington, dc, usa": { geo: "Washington, DC", country: "US" },
  "miami, florida, usa": { geo: "Miami", country: "US" },
};

/** series_id of the national comparator to pair against any local geo above. */
export const NATIONAL_COMPARATOR_SERIES_ID: Record<"US" | "CA", string> = {
  US: "LNU04000000", // US national unemployment rate, NOT seasonally adjusted — matches metro LAUS methodology
  CA: "STATSCAN_V1643277934", // Canada national, same table (14-10-0459-01) as the CMA series — matches methodology
};

export const NATIONAL_COMPARATOR_LABEL: Record<"US" | "CA", string> = {
  US: "United States",
  CA: "Canada",
};
