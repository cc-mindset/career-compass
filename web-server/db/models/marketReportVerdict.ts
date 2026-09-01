import mongoose, { Document, Schema } from "mongoose";
import { MarketReportVerdict, MarketShift } from "../../types/marketReport";
import { LlmCacheStatus } from "../../constants/db";

export interface MarketReportVerdictCacheData {
  market_report_verdict: MarketReportVerdict;
  market_shifts?: MarketShift[];
}

export interface IMarketReportVerdict extends Document {
  vars_id: string;
  data: MarketReportVerdictCacheData;
  status: LlmCacheStatus;
  location: string;
  region: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const marketReportSignalsSchema = new Schema({
  role_demand: { type: String, enum: ["Stable", "High", "Low"], required: true },
  competition: { type: String, enum: ["Stable", "High", "Low"], required: true },
  evidence_quality: { type: String, enum: ["Stable", "High", "Low"], required: true },
});

const marketReportVerdictSchema = new Schema<MarketReportVerdict>({
  verdict_label: { type: String, required: true },
  outlook_label: { type: String, required: true },
  headline: { type: String, required: true },
  summary: { type: String, required: true },
  signals: { type: marketReportSignalsSchema, required: true, _id: false },
});

const marketShiftSchema = new Schema<MarketShift>(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
  },
  { _id: false },
);

const marketReportVerdictCacheDataSchema = new Schema<MarketReportVerdictCacheData>({
  market_report_verdict: { type: marketReportVerdictSchema, required: true },
  market_shifts: { type: [marketShiftSchema], required: false },
});

const schema = new Schema<IMarketReportVerdict>(
  {
    location: { type: String, required: true },
    region: { type: String, required: true },
    data: marketReportVerdictCacheDataSchema,
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

const LlmMarketReportVerdict = mongoose.model<IMarketReportVerdict>(
  "llm_market_report_verdict",
  schema,
);

export default LlmMarketReportVerdict;
