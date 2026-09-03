import mongoose, { Document, Schema } from "mongoose";
import { CareerIntelData, EvidenceLensCoverage } from "../../types/careerIntel";
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

const evidenceLensCoverageSchema = new Schema<EvidenceLensCoverage>(
    {
        'Technology & regulation': [{ type: String }],
        'Economy & industry': [{ type: String }],
        'People & place': [{ type: String }],
    },
    { _id: false },
);

const careerIntelDataSchema = new Schema<CareerIntelData>({
    report_sources: [{ type: String, required: true }],
    evidence_lens_coverage: { type: evidenceLensCoverageSchema, required: false, default: undefined },
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
