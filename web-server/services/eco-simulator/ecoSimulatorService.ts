import { LlmCacheStatus } from "../../constants/db";
import EcoSimulator from "../../db/models/ecoSimulator";
import { EcoSimulatorData } from "../../types/ecoSimulator";
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { SYSTEM_PROMPT } from "../market-insights/marketInsightsService_multipart";
import { generateSingleResponse } from "../ragService";

export const ECO_SIMULATOR_CACHE_DURATION_DAYS = 1;

export function getEcoSimulatorDataPrompt(location: string, current_job_title: string, seniority_level: string): string {
    return `You are an economic simulator that provides insights on the impact of AI on various careers. Based on the location (${location}), current job title (${current_job_title}), and seniority level (${seniority_level}), provide the following information in JSON format:

{
  "layoff_chances_formula": "A formula that calculates the chances of being laid off due to AI, considering factors such as upskill speed, AI impact on the industry, AI technological advancement, and global instability levels.",
  "career_demand_formula": "A formula that calculates the demand for the career in the future, considering factors such as AI impact on the industry, AI technological advancement, upskill speed, and global instability levels.",
  "career_growth_opportunities_formula": "A formula that calculates the growth opportunities in the career, considering factors such as upskill speed, AI impact on the industry, AI technological advancement, market demand, and global instability levels.",
  "salary_increment_formula": "A formula that calculates the potential salary increment in the career, considering factors such as upskill speed, AI technological advancement, market demand, and global instability levels.",
  "simulation_insights": "Provide insights based on the above formulas and factors.",
  "tips": "Provide tips for individuals in this career to navigate the impact of AI effectively."
}

Return ONLY valid JSON with NO markdown formatting.`;
}

export const getVarsIdForEcoSimulator = (location: string, current_job_title: string, seniority_level: string): string => {
    return `${location.toLowerCase()}_${current_job_title.toLowerCase()}_${seniority_level.toLowerCase()}`;
}

export const cacheEcoSimulatorResponse = async (location: string, current_job_title: string, seniority_level: string, response: EcoSimulatorData, status: LlmCacheStatus): Promise<void> => {
    const cacheKey = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
    await EcoSimulator.updateOne(
        { vars_id: cacheKey },
        {
            location,
            current_job_title,
            seniority_level,
            data: response,
            vars_id: cacheKey,
            status,
        }
    );
}

export const generateEcoSimulatorData = async (location: string, current_job_title: string, seniority_level: string, jobId?: string): Promise<EcoSimulatorData> => {
    try {
        logger.info(`📊 Starting eco simulator generation for: ${location}, ${current_job_title}, ${seniority_level}`);

        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'job_start',
                stage: 'Preparing eco simulator data',
                jobId
            });
        }

        const prompt = getEcoSimulatorDataPrompt(location, current_job_title, seniority_level);
        const cacheKey = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
        const cachedResponse = await EcoSimulator.findOne({ vars_id: cacheKey, status: LlmCacheStatus.ACTIVE, updatedAt: { $gte: new Date(Date.now() - ECO_SIMULATOR_CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000) } });

        if (cachedResponse && cachedResponse.status === LlmCacheStatus.ACTIVE) {
            const data = cachedResponse.data;
            if (jobId) {
                emitToJob(jobId, 'progress', {
                    type: 'section_success',
                    section: 'ecoSimulator',
                    data,
                    jobId,
                });
            }
            
            if (jobId) {
                emitToJob(jobId, 'progress', {
                    type: 'job_complete',
                    data,
                    jobId,
                });
            }
            return data;
        }

        if (cachedResponse && cachedResponse.status === LlmCacheStatus.UPDATING) {
            if (jobId) {
                emitToJob(jobId, 'progress', {
                    type: 'section_in_progress',
                    section: 'ecoSimulator',
                    data: cachedResponse,
                    jobId,
                });
            }
        }

        // Generate new
        await EcoSimulator.updateOne(
            { vars_id: cacheKey },
            {
                $set: {
                    status: LlmCacheStatus.UPDATING
                }
            }
        );

        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'section_in_progress',
                section: 'ecoSimulator',
                data: { status: LlmCacheStatus.UPDATING },
                jobId,
            });
        }

        const userPrompt = `Location: ${location}
                            Current Job Title: ${current_job_title}
                            Seniority Level: ${seniority_level}`;
        const response = await generateSingleResponse(SYSTEM_PROMPT, userPrompt, prompt, 'json', 3);

        const data = response as unknown as EcoSimulatorData;
        await cacheEcoSimulatorResponse(location, current_job_title, seniority_level, data, LlmCacheStatus.ACTIVE);

        await EcoSimulator.create({
            location,
            current_job_title,
            seniority_level,
            data,
            vars_id: getVarsIdForEcoSimulator(location, current_job_title, seniority_level),
            status: LlmCacheStatus.ACTIVE,
        });

        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'job_complete',
                data,
                jobId,
            });
        }

        return data;
    } catch (error) {
        logger.error(`Error generating eco simulator data:`, error);
        // Fallback data
        const fallbackData = {
            layoff_chances_formula: "Math.max(10, Math.min(100, (upskillSpeed * 0.55) + (100 - aiImpact * 0.25) + (100 - aiTechAdvancement * 0.2) - (globalInstabilityLevels * 0.1)))",
            career_demand_formula: "Math.max(10, Math.min(100, (aiImpact * 0.3) + (aiTechAdvancement * 0.25) + (upskillSpeed * 0.3) - (globalInstabilityLevels * 0.2)))",
            career_growth_opportunities_formula: "Math.max(10, Math.min(100, (upskillSpeed * 0.4) + (aiImpact * 0.2) + (aiTechAdvancement * 0.2) + (marketDemand * 0.25) - (globalInstabilityLevels * 0.2)))",
            salary_increment_formula: "Math.max(10, Math.min(100, (upskillSpeed * 0.45) + (aiTechAdvancement * 0.2) + (marketDemand * 0.3) - (globalInstabilityLevels * 0.15)))",
            simulation_insights: "Fallback simulation insights due to LLM error",
            tips: "Fallback tips due to LLM error"
        };

        await EcoSimulator.create({
            location,
            current_job_title,
            seniority_level,
            data: fallbackData,
            vars_id: getVarsIdForEcoSimulator(location, current_job_title, seniority_level),
            status: LlmCacheStatus.ACTIVE,
        });

        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'job_error',
                error: 'Failed to generate eco simulator data, using fallback',
                jobId,
            });
        }

        return fallbackData;
    }
}

export const getEcoSimulatorData = async (location: string, current_job_title: string, seniority_level: string): Promise<EcoSimulatorData | null> => {
    const vars_id = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
    let ecoSimulatorEntry = await EcoSimulator.findOne({ vars_id, status: LlmCacheStatus.ACTIVE, updatedAt: { $gte: new Date(Date.now() - ECO_SIMULATOR_CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000) } }); // Cache valid for specified duration
    if (ecoSimulatorEntry) {
        return ecoSimulatorEntry.data;
    }
    return await generateEcoSimulatorData(location, current_job_title, seniority_level) || null;
}