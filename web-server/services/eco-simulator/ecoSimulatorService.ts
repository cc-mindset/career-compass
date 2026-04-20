import { LlmCacheStatus } from "../../constants/db";
import EcoSimulator from "../../db/models/ecoSimulator";
import { EcoSimulatorData } from "../../types/ecoSimulator";

export const ECO_SIMULATOR_CACHE_DURATION_DAYS = 1;

export const getVarsIdForEcoSimulator = (location: string, current_job_title: string, seniority_level: string): string => {
    return `${location.toLowerCase()}_${current_job_title.toLowerCase()}_${seniority_level.toLowerCase()}`;
}

export const generateEcoSimulatorData = async (location: string, current_job_title: string, seniority_level: string): Promise<EcoSimulatorData> => {
    // Placeholder implementation - replace with actual logic to generate data
    const data = {
        layoff_chances_formula: "Math.max(10, Math.min(100, (upskillSpeed * 0.55) + (100 - aiImpact * 0.25) + (100 - aiTechAdvancement * 0.2) - (globalInstabilityLevels * 0.1)))",
        career_demand_formula: "Math.max(10, Math.min(100, (marketDemand * 0.6) + (100 - aiImpact * 0.25) + (100 - aiTechAdvancement * 0.2) - (globalInstabilityLevels * 0.1)))",
        career_growth_opportunities_formula: "Math.max(10, Math.min(100, (upskillSpeed * 0.55) + (100 - aiImpact * 0.25) + (100 - aiTechAdvancement * 0.2) - (globalInstabilityLevels * 0.1)))",
        salary_increment_formula: "Math.max(10, Math.min(100, (upskillSpeed * 0.55) + (100 - aiImpact * 0.25) + (100 - aiTechAdvancement * 0.2) - (globalInstabilityLevels * 0.1)))",
        simulation_insights: "",
        tips: ""
    };

    await EcoSimulator.create({
        location,
        current_job_title,
        seniority_level,
        data,
        vars_id: getVarsIdForEcoSimulator(location, current_job_title, seniority_level),
        status: LlmCacheStatus.ACTIVE,
    });

    return data;
}

export const getEcoSimulatorData = async (location: string, current_job_title: string, seniority_level: string): Promise<EcoSimulatorData | null> => {
    const vars_id = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
    let ecoSimulatorEntry = await EcoSimulator.findOne({ vars_id, status: LlmCacheStatus.ACTIVE, updatedAt: { $gte: new Date(Date.now() - ECO_SIMULATOR_CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000) } }); // Cache valid for specified duration
    if (ecoSimulatorEntry) {
        return ecoSimulatorEntry.data;
    }
    return await generateEcoSimulatorData(location, current_job_title, seniority_level) || null;
}