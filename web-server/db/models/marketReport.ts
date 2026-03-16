import mongoose, { Document, Schema } from "mongoose";
import {
  CityVsRegionComparison,
  ComparisonData,
  ExecutiveSummary,
  KeyStats,
  LabourMarketSnapshot,
  MarketHealth,
  MarketReportData,
} from "../../types/marketReport";

export enum MarketReportStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface IMarketReport extends Document {
  vars_id: string;
  data: MarketReportData;
  status: MarketReportStatus;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const keyStatsSchema = new Schema<KeyStats>({
  strongest_opportunity: { type: String, required: true },
  highest_risk_sector: { type: String, required: true },
  top_skill_demand: { type: String, required: true },
  pivot_necessity: { type: String, required: true },
});

const executiveSummarySchema = new Schema<ExecutiveSummary>({
  overview: { type: String, required: true },
  key_stats: keyStatsSchema,
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
  data: [comparisonDataSchema],
});

const marketReportDataSchema = new Schema<MarketReportData>({
  executive_summary_brief: { type: String, required: true },
  executive_summary: executiveSummarySchema,
  labour_market_snapshot: labourMarketSnapshotSchema,
  city_vs_region_comparison: cityVsRegionComparisonSchema,
  report_sources: [{ type: String, required: true }],
});

const marketReportSchema = new Schema<IMarketReport>(
  {
    location: { type: String, required: true },
    data: marketReportDataSchema,
    vars_id: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: MarketReportStatus,
      required: true,
      default: MarketReportStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const MarketReport = mongoose.model<IMarketReport>(
  "MarketReport",
  marketReportSchema,
);
export default MarketReport;
