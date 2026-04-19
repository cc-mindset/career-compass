import mongoose, { Document, Schema } from "mongoose";
import { EcoSimulatorData } from "../../types/ecoSimulator";
import { LlmCacheStatus } from "../../constants/db";

export interface IEcoSimulator extends Document {
    location: string;
    current_job_title: string;
    seniority_level: string;
    user_adoption_level: string;
    global_Instability_levels: string;
    upskilling_pace: string;
    data: EcoSimulatorData;
    status: LlmCacheStatus;
    vars_id: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const ecoSimulatorDataSchema = new Schema<EcoSimulatorData>({
    chances_of_being_laid_off_formula: { type: String, required: true },
    career_demand_formula: { type: String, required: true },
    career_growth_opportunities_formula: { type: String, required: true },
    simulation_insights: { type: String, required: true },
    tips: { type: String, required: true },
});

const ecoSimulatorSchema = new Schema<IEcoSimulator>(
    {
        location: { type: String, required: true },
        current_job_title: { type: String, required: true },
        seniority_level: { type: String, required: true },
        user_adoption_level: { type: String, required: true },
        global_Instability_levels: { type: String, required: true },
        upskilling_pace: { type: String, required: true },
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

export default mongoose.model<IEcoSimulator>("EcoSimulator", ecoSimulatorSchema);