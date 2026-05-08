import mongoose, { Document, Schema } from "mongoose";
import { CareerIntelData, KeyFinding, StrategiesByExperience } from "../../types/careerIntel";
import { LlmCacheStatus } from "../../constants/db";

export interface ICareerIntel extends Document {
    vars_id: string;
    data: CareerIntelData;
    status: LlmCacheStatus;
    location: string;
    region: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const strategiesByExperienceSchema = new Schema<StrategiesByExperience>({
    new_graduates: { type: [String], required: true, default: [] },
    mid_career_pivoting: { type: [String], required: true, default: [] },
    newcomers_international: { type: [String], required: true, default: [] },
});

const keyFindingSchema = new Schema<KeyFinding>({
    impact_level: { type: String, required: true },
    insight: { type: String, required: true },
    action_item: { type: String, required: true },
    driving_force: { type: String, required: true },
});

const careerIntelDataSchema = new Schema<CareerIntelData>({
    strategies_by_experience: { type: strategiesByExperienceSchema, required: true },
    key_findings: { type: [keyFindingSchema], required: true, default: [] },
    report_sources: [{ type: String, required: true }],
});

const careerIntelSchema = new Schema<ICareerIntel>(
    {
        location: { type: String, required: true },
        region: { type: String, required: true },
        data: careerIntelDataSchema,
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

const LlmCareerIntel = mongoose.model<ICareerIntel>("llm_career_intel", careerIntelSchema);
export default LlmCareerIntel;
