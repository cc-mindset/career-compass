import mongoose, { Document, Schema } from "mongoose";
import {
  AtRiskSector,
  GrowthSector,
  IndustryTrendData,
  MarketRisk,
  SkillCategory,
  Skill,
  TopSkillsDemand,
} from "../../types/industryTrend";

export enum IndustryTrendStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface IIndustryTrend extends Document {
  vars_id: string;
  data: IndustryTrendData;
  status: IndustryTrendStatus;
  location: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const growthSectorSchema = new Schema<GrowthSector>({
  sector: { type: String, required: true },
  growth_outlook: { type: String, required: true },
  example_roles: [{ type: String, required: true }],
  why_it_matters: { type: String, required: true },
  risk_reality_check: { type: String, required: true },
});

const atRiskSectorSchema = new Schema<AtRiskSector>({
  sector: { type: String, required: true },
  automation_reason: { type: String, required: true },
  pivot_direction: { type: String, required: true },
  risk_reality_check: { type: String, required: true },
});

const skillSchema = new Schema<Skill>({
  category: { type: String, required: true },
  description: { type: String, required: true },
  examples: [{ type: String, required: true }],
  demand_level: { type: String, required: true },
  growth_trend: { type: String, required: true },
  why: { type: String, required: true },
  so_what: { type: String, required: true },
});

const skillCategorySchema = new Schema<SkillCategory>({
  category: { type: String, required: true },
  description: { type: String, required: true },
  skills: { type: [skillSchema], required: true, default: [] },
});

const topSkillsDemandSchema = new Schema<TopSkillsDemand>({
  title: { type: String, required: true },
  categories: { type: [skillCategorySchema], required: true, default: [] },
});

const marketRiskSchema = new Schema<MarketRisk>({
  risk: { type: String, required: true },
  severity: { type: String, required: true },
  affected_sectors: [{ type: String, required: true }],
  mitigation_strategy: { type: String, required: true },
});

const industryTrendDataSchema = new Schema<IndustryTrendData>({
  growth_sectors: [growthSectorSchema],
  at_risk_sectors: [atRiskSectorSchema],
  top_skills_demand: topSkillsDemandSchema,
  market_risks: [marketRiskSchema],
  report_sources: [{ type: String, required: true }],
});

const industryTrendSchema = new Schema<IIndustryTrend>(
  {
    location: { type: String, required: true },
    data: industryTrendDataSchema,
    vars_id: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: IndustryTrendStatus,
      required: true,
      default: IndustryTrendStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const IndustryTrendLlm = mongoose.model<IIndustryTrend>(
  "industry_trend_llm",
  industryTrendSchema,
);
export default IndustryTrendLlm;
