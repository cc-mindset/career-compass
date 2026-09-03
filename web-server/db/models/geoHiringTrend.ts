import mongoose, { Document, Schema } from "mongoose";

/**
 * Read-only from web-server's perspective. Written by
 * ai-enabler/rag-pipeline/src/pipelines/market_stats/geo_trend_store.py on
 * every BLS/StatsCan ingestion run — see that file's docstring for why this
 * lives in Mongo (exact-key structured numeric data) rather than as Pinecone
 * chunks. One document per series_id, upserted each run so periods_history
 * always reflects the latest fetch's lookback window.
 */
export interface IHiringTrendPeriodPoint {
  period: string;
  value: number;
}

export interface IGeoHiringTrend extends Document {
  series_id: string;
  source: string;
  country: string;
  country_name: string;
  signal_type: string;
  industry: string;
  naics_or_noc: string;
  geo: string;
  geo_type: string;
  cadence: string;
  label: string;
  periods_history: IHiringTrendPeriodPoint[];
  latest: number;
  avg_12mo: number;
  trend_direction: string;
  updated_at: Date;
}

const periodPointSchema = new Schema<IHiringTrendPeriodPoint>(
  {
    period: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const geoHiringTrendSchema = new Schema<IGeoHiringTrend>(
  {
    series_id: { type: String, required: true, unique: true },
    source: { type: String },
    country: { type: String },
    country_name: { type: String },
    signal_type: { type: String },
    industry: { type: String },
    naics_or_noc: { type: String },
    geo: { type: String },
    geo_type: { type: String },
    cadence: { type: String },
    label: { type: String },
    periods_history: { type: [periodPointSchema], default: [] },
    latest: { type: Number },
    avg_12mo: { type: Number },
    trend_direction: { type: String },
    updated_at: { type: Date },
  },
  {
    collection: "geo_hiring_trend",
    versionKey: false,
  },
);

const GeoHiringTrend = mongoose.model<IGeoHiringTrend>(
  "geo_hiring_trend_doc",
  geoHiringTrendSchema,
);
export default GeoHiringTrend;
