import mongoose, { Document, Schema } from "mongoose";
import {
  AtRiskSector,
  GrowthSector,
  GrowthLocation,
  IndustryTrendData,
  MarketRisk,
  PriorityCapability,
  SkillCategory,
  Skill,
  ThirtyDayFocusItem,
  TopSkillsDemand,
} from "../../types/industryTrend";
import { LlmCacheStatus } from "../../constants/db";

export interface IIndustryTrend extends Document {
  vars_id: string;
  data: IndustryTrendData;
  status: LlmCacheStatus;
  location: string;
  region: string;
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
  quadrant: { type: String, required: true },
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

const growthLocationSchema = new Schema<GrowthLocation>({
  name: { type: String, required: true },
  summary: { type: String, required: true },
  signal: { type: String, required: true },
  marketDetail: { type: String, required: true },
  meaningDetail: { type: String, required: true },
});

const priorityCapabilitySchema = new Schema<PriorityCapability>({
  name: { type: String, required: true },
  demand_level: { type: String, required: true },
  evidence_building_action: { type: String, required: true },
});

const thirtyDayFocusItemSchema = new Schema<ThirtyDayFocusItem>({
  label: { type: String, required: true },
  action: { type: String, required: true },
});

const industryTrendDataSchema = new Schema<IndustryTrendData>({
  growth_sectors: [growthSectorSchema],
  at_risk_sectors: [atRiskSectorSchema],
  top_skills_demand: topSkillsDemandSchema,
  growth_locations: { type: [growthLocationSchema], required: false, default: undefined },
  priority_capabilities: { type: [priorityCapabilitySchema], required: false, default: undefined },
  thirty_day_focus: { type: [thirtyDayFocusItemSchema], required: false, default: undefined },
  market_risks: [marketRiskSchema],
  report_sources: [{ type: String, required: true }],
});

const industryTrendSchema = new Schema<IIndustryTrend>(
  {
    location: { type: String, required: true },
    region: { type: String, required: true },
    data: industryTrendDataSchema,
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

const LlmIndustryTrend = mongoose.model<IIndustryTrend>(
  "llm_industry_trend",
  industryTrendSchema,
);
export default LlmIndustryTrend;
