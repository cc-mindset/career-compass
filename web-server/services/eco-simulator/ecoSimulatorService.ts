import { LlmCacheStatus } from "../../constants/db";
import EcoSimulator from "../../db/models/ecoSimulator";
import { EcoSimulatorData } from "../../types/ecoSimulator";
import { logger } from '../../utils/logger.js';
import { emitToJob } from '../../lib/websocket.js';
import { SYSTEM_PROMPT } from "../market-insights/marketInsightsService_multipart";
import { enqueueJob } from "../../lib/redisQueue";
import { generateSingleResponse } from "../llmService";
import { getFormattedContext } from "../ragService";

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

export const cacheEcoSimulatorResponse = async (location: string, current_job_title: string, seniority_level: string, response: EcoSimulatorData): Promise<void> => {
    const cacheKey = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
    await EcoSimulator.updateOne(
        { vars_id: cacheKey },
        {
            location,
            current_job_title,
            seniority_level,
            data: response,
            vars_id: cacheKey,
            status: LlmCacheStatus.ACTIVE,
        },
        { upsert: true }
    );
}

export const generateAndCacheEcoSimulatorData = async (location: string, current_job_title: string, seniority_level: string, jobId?: string): Promise<EcoSimulatorData> => {
    try {
        logger.info(`📊 Starting eco simulator generation for: ${location}, ${current_job_title}, ${seniority_level}`);
        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'job_start',
                stage: 'Preparing eco simulator data',
                jobId
            });
        }

        const cacheKey = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
        const cachedResponse = await EcoSimulator.findOne({ vars_id: cacheKey, status: LlmCacheStatus.ACTIVE, updatedAt: { $gte: new Date(Date.now() - ECO_SIMULATOR_CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000) } });

        if (cachedResponse && cachedResponse.status === LlmCacheStatus.ACTIVE) {
            const data = cachedResponse.data;
            if (jobId) {
                emitToJob(jobId, 'progress', {
                    type: 'section_in_progress',
                    section: 'ecoSimulator',
                    data,
                    jobId,
                });
            }
            return data;
        }

        //returning stale data while updating in background
        if (cachedResponse && cachedResponse.status === LlmCacheStatus.UPDATING) {
            if (jobId) {
                emitToJob(jobId, 'progress', {
                    type: 'section_in_progress',
                    section: 'ecoSimulator',
                    data: cachedResponse.data,
                    jobId,
                });
            }
            return cachedResponse.data;
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

        const prompt = getEcoSimulatorDataPrompt(location, current_job_title, seniority_level);

        //RAG
        let formattedContext = "";
        if (process.env.GLOBAL_USE_RAG === 'true') {
            formattedContext = await getFormattedContext({
                useCache: true,
                cacheKey: `eco_simulator_context_${location}_${current_job_title}_${seniority_level}`,
                retrievalQuery: `Context for eco simulator generation for ${location}, ${current_job_title}, ${seniority_level}`,
                namespaces: ['eco-data'],
                topKPerNamespace: { 'eco-data': 10 },
            }, prompt);
        }

        //LLM
        const response = await generateSingleResponse(SYSTEM_PROMPT, formattedContext, prompt, 'json', 3);

        const data = response as unknown as EcoSimulatorData;

        //Cache latest response in DB
        await cacheEcoSimulatorResponse(location, current_job_title, seniority_level, data);

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

export const getEcoSimulatorData = async (location: string, current_job_title: string, seniority_level: string, userId = ""): Promise<EcoSimulatorData | null> => {

    // Check cache first
    const vars_id = getVarsIdForEcoSimulator(location, current_job_title, seniority_level);
    let ecoSimulatorEntry = await EcoSimulator.findOne({ vars_id, status: LlmCacheStatus.ACTIVE, updatedAt: { $gte: new Date(Date.now() - ECO_SIMULATOR_CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000) } });
    if (ecoSimulatorEntry) {
        return ecoSimulatorEntry.data;
    }

    //Generate new data and cache it, with job progress updates if jobId is provided
    let results: EcoSimulatorData | null = null;
    const jobId = await enqueueJob(location, userId || "") || undefined;

    try {
        results = await generateAndCacheEcoSimulatorData(location, current_job_title, seniority_level, jobId);

        logger.info(`✓ Job complete: ${jobId} - Eco simulator data generated successfully`);
        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'job_complete',
                data: { location, current_job_title, seniority_level, results },
                jobId,
            });
        }
    } catch (error: any) {
        logger.error('Error during eco simulator generation:', error);
        if (jobId) {
            emitToJob(jobId, 'progress', {
                type: 'job_error',
                error: error.message,
                jobId,
            });
        }
        throw error;
    }

    return await results
}