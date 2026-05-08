import mongoose, { Document, Schema } from "mongoose";
import {
  CityVsRegionComparison,
  ComparisonData,
  MarketReportSummary,
  SummaryKeyStats,
  LabourMarketSnapshot,
  MarketHealth,
  MarketReportData,
} from "../../types/marketReport";
import { LlmCacheStatus } from "../../constants/db";

export interface IMarketReport extends Document {
  vars_id: string;
  data: MarketReportData;
  status: LlmCacheStatus;
  location: string;
  region: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const summaryKeyStatsSchema = new Schema<SummaryKeyStats>({
  strongest_opportunity: { type: String, required: true },
  highest_risk_sector: { type: String, required: true },
  top_skill_demand: { type: String, required: true },
  pivot_necessity: { type: String, required: true },
});

const marketReportSummarySchema = new Schema<MarketReportSummary>({
  overview: { type: String, required: true },
  summary_key_stats: { type: summaryKeyStatsSchema, required: true, _id: false },
});

const marketHealthSchema = new Schema<MarketHealth>({
  employment_rate: { type: String, required: true },
  job_growth_rate: { type: String, required: true },
  trend: { type: String, required: true },
});

const labourMarketSnapshotSchema = new Schema<LabourMarketSnapshot>({
  overview: { type: String, required: true },
  local_vs_national: { type: String, required: true },
  major_drivers: [{ type: String, required: true }],
  market_health: marketHealthSchema,
});

const comparisonDataSchema = new Schema<ComparisonData>({
  factor: { type: String, required: true },
  city: { type: String, required: true },
  wider_region: { type: String, required: true },
});

const cityVsRegionComparisonSchema = new Schema<CityVsRegionComparison>({
  title: { type: String, required: true },
  data: { type: [comparisonDataSchema], required: true, default: [] },
});

const marketReportDataSchema = new Schema<MarketReportData>({
  market_report_summary_brief: { type: String, required: true },
  market_report_summary: { type: marketReportSummarySchema, required: true },
  labour_market_snapshot: { type: labourMarketSnapshotSchema, required: true },
  city_vs_region_comparison: {
    type: cityVsRegionComparisonSchema,
    required: true,
  },
  report_sources: [{ type: String, required: true }],
});

const marketReportSchema = new Schema<IMarketReport>(
  {
    location: { type: String, required: true },
    region: { type: String, required: true },
    data: marketReportDataSchema,
    vars_id: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: LlmCacheStatus,
      required: true,
      default: LlmCacheStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const LlmMarketReport = mongoose.model<IMarketReport>(
  "llm_market_report",
  marketReportSchema,
);
export default LlmMarketReport;
