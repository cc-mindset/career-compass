import mongoose, { Document, Schema } from "mongoose";
import {
  MarketNewsData,
} from "../../types/marketNews";
import { LlmCacheStatus } from "../../constants/db";

export interface IMarketNews extends Document {
  vars_id: string;
  data: MarketNewsData[];
  status: LlmCacheStatus;
  location: string;
  region: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const marketNewsDataSchema = new Schema<MarketNewsData>({
  headline: { type: String, required: true },
  summary: { type: String, required: true },
  impact: { type: String, required: true },
  relevance_score: { type: Number, required: true },
  source: { type: String, required: true },
  date: { type: String, required: true },
});

const marketNewsSchema = new Schema<IMarketNews>(
  {
    location: { type: String, required: true },
    region: { type: String, required: true },
    data: { type: [marketNewsDataSchema], required: true, default: [] },
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

const LlmMarketNews = mongoose.model<IMarketNews>("llm_market_news", marketNewsSchema);
export default LlmMarketNews;
