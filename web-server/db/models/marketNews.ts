import mongoose, { Document, Schema } from "mongoose";
import {
  KeyFinding,
  MarketNewsData,
  MarketNewsItem,
  StrategiesByProfile,
} from "../../types/marketNews";

export enum MarketNewsStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface IMarketNews extends Document {
  vars_id: string;
  data: MarketNewsData;
  status: MarketNewsStatus;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const marketNewsItemSchema = new Schema<MarketNewsItem>({
  headline: { type: String, required: true },
  summary: { type: String, required: true },
  impact: { type: String, required: true },
  relevance_score: { type: Number, required: true },
  source: { type: String, required: true },
  date: { type: String, required: true },
});

const strategiesByProfileSchema = new Schema<StrategiesByProfile>({
  new_graduates: [{ type: String, required: true }],
  mid_career_pivoting: [{ type: String, required: true }],
  newcomers_international: [{ type: String, required: true }],
});

const keyFindingSchema = new Schema<KeyFinding>({
  impact_level: { type: String, required: true },
  insight: { type: String, required: true },
  action_item: { type: String, required: true },
  driving_force: { type: String, required: true },
});

const marketNewsDataSchema = new Schema<MarketNewsData>({
  market_news: [marketNewsItemSchema],
  strategies_by_profile: strategiesByProfileSchema,
  key_findings: [keyFindingSchema],
  report_sources: [{ type: String, required: true }],
});

const marketNewsSchema = new Schema<IMarketNews>(
  {
    location: { type: String, required: true },
    data: marketNewsDataSchema,
    vars_id: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: MarketNewsStatus,
      required: true,
      default: MarketNewsStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const MarketNews = mongoose.model<IMarketNews>("MarketNews", marketNewsSchema);
export default MarketNews;
