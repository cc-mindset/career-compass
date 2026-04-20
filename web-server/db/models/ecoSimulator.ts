import mongoose, { Document, Schema } from "mongoose";
import { EcoSimulatorData } from "../../types/ecoSimulator";
import { LlmCacheStatus } from "../../constants/db";

export interface IEcoSimulator extends Document {
    location: string;
    current_job_title: string;
    seniority_level: string;
    data: EcoSimulatorData;
    status: LlmCacheStatus;
    vars_id: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const ecoSimulatorDataSchema = new Schema<EcoSimulatorData>({
    layoff_chances_formula: { type: String, required: true },
    career_demand_formula: { type: String, required: true },
    career_growth_opportunities_formula: { type: String, required: true },
    salary_increment_formula: { type: String, required: true },
    simulation_insights: { type: String, required: true },
    tips: { type: String, required: true },
});

const EcoSimulatorSchema = new Schema<IEcoSimulator>(
    {
        location: { type: String, required: true },
        current_job_title: { type: String, required: true },
        seniority_level: { type: String, required: true },
        data: ecoSimulatorDataSchema,
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

export default mongoose.model<IEcoSimulator>("EcoSimulator", EcoSimulatorSchema);