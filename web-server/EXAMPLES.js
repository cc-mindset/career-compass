/**
 * Example: How to Add New LLM Features
 * 
 * This file demonstrates how to create new services using the modular architecture
 */

// ============================================================================
// EXAMPLE 1: Resume Analysis Service
// ============================================================================

// File: services/resumeAnalysisService.js
import { generateWithRAG } from './ragService.js';
import { openaiClient } from '../lib/openai.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

const RESUME_SYSTEM_PROMPT = `You are an expert career counselor and resume analyst.
Provide actionable feedback on resumes based on industry best practices and current job market trends.`;

export async function analyzeResume(resumeText, targetRole = null) {
  try {
    logger.info('📄 Analyzing resume');

    // Build the analysis query
    let query = `Analyze this resume and provide detailed feedback:\n\n${resumeText}`;
    if (targetRole) {
      query += `\n\nTarget Role: ${targetRole}`;
    }

    // Option A: Use RAG with Pinecone data
    const analysis = await generateWithRAG(
      query,
      RESUME_SYSTEM_PROMPT,
      {
        namespaces: ['resume-tips', 'job-requirements'], // Your Pinecone namespaces
        topKPerNamespace: { 'resume-tips': 5, 'job-requirements': 5 },
        responseFormat: 'json',
        useCache: true,
      }
    );

    return analysis;
  } catch (error) {
    logger.error('Resume analysis failed:', error);
    throw error;
  }
}

export async function quickResumeCheck(resumeText) {
  try {
    logger.info('🚀 Quick resume check (no RAG)');

    // Option B: Direct OpenAI call (no Pinecone retrieval)
    const cacheKey = cache.generateKey('resume-check', resumeText.substring(0, 100));
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const messages = [
      { role: 'system', content: 'You are a resume expert. Provide quick feedback.' },
      { role: 'user', content: `Quick check of this resume:\n\n${resumeText}` },
    ];

    const feedback = await openaiClient.generateCompletion(messages, {
      temperature: 0.5,
      max_tokens: 500,
    });

    cache.set(cacheKey, feedback, 3600000); // 1 hour
    return feedback;
  } catch (error) {
    logger.error('Quick resume check failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Career Path Recommendations
// ============================================================================

// File: services/careerPathService.js
import { generateWithRAG } from './ragService.js';
import { logger } from '../utils/logger.js';

export async function generateCareerPath(userProfile, currentRole, yearsExperience) {
  try {
    logger.info(`🛤️ Generating career path for ${currentRole}`);

    const systemPrompt = `You are a career development advisor. Generate personalized career path recommendations.`;
    
    const query = `Generate a career path recommendation for:
Current Role: ${currentRole}
Years of Experience: ${yearsExperience}
Profile: ${JSON.stringify(userProfile)}

Provide a structured JSON response with:
- next_roles: Array of potential next positions
- skills_to_develop: Skills needed for advancement
- timeline: Realistic progression timeline
- salary_trajectory: Expected salary growth
- certifications: Recommended certifications`;

    const careerPath = await generateWithRAG(query, systemPrompt, {
      namespaces: ['career-data', 'industry-trends'],
      responseFormat: 'json',
    });

    return careerPath;
  } catch (error) {
    logger.error('Career path generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 3: Skill Gap Analysis
// ============================================================================

// File: services/skillGapService.js
import { pineconeClient } from '../lib/pinecone.js';
import { openaiClient } from '../lib/openai.js';
import { logger } from '../utils/logger.js';

export async function analyzeSkillGap(currentSkills, targetRole, location) {
  try {
    logger.info(`🎯 Analyzing skill gap for ${targetRole}`);

    // Step 1: Create embedding for the target role
    const queryText = `${targetRole} required skills and qualifications in ${location}`;
    const queryVector = await openaiClient.createEmbedding(queryText);

    // Step 2: Query Pinecone for job requirements
    const jobRequirements = await pineconeClient.queryNamespaceWithVector(
      'job-requirements',
      queryVector,
      20
    );

    // Step 3: Extract required skills from results
    const requiredSkills = new Set();
    jobRequirements.matches?.forEach(match => {
      if (match.metadata?.skills) {
        match.metadata.skills.forEach(skill => requiredSkills.add(skill));
      }
    });

    // Step 4: Compare with current skills
    const currentSkillSet = new Set(currentSkills.map(s => s.toLowerCase()));
    const gaps = Array.from(requiredSkills).filter(
      skill => !currentSkillSet.has(skill.toLowerCase())
    );

    // Step 5: Generate recommendations
    const analysis = {
      current_skills: currentSkills,
      required_skills: Array.from(requiredSkills),
      skill_gaps: gaps,
      match_percentage: ((currentSkills.length / requiredSkills.size) * 100).toFixed(1),
    };

    logger.info(`✓ Skill gap analysis complete: ${analysis.match_percentage}% match`);
    return analysis;
  } catch (error) {
    logger.error('Skill gap analysis failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: Job Market Trends
// ============================================================================

// File: services/trendAnalysisService.js
import { retrieveContext, formatContextForLLM } from './ragService.js';
import { openaiClient } from '../lib/openai.js';
import { logger } from '../utils/logger.js';

export async function analyzeTrends(industry, timeframe = '6 months') {
  try {
    logger.info(`📈 Analyzing trends for ${industry}`);

    // Custom retrieval with specific parameters
    const context = await retrieveContext(
      `${industry} industry trends, hiring patterns, and market changes in the last ${timeframe}`,
      {
        namespaces: ['news-data', 'industry-reports'],
        topKPerNamespace: { 'news-data': 15, 'industry-reports': 10 },
        useCache: true,
      }
    );

    // Format context
    const formattedContext = formatContextForLLM(context);

    // Generate custom analysis
    const systemPrompt = `You are an industry analyst. Analyze trends and provide forecasts.`;
    const userPrompt = `${formattedContext}\n\nAnalyze the trends for ${industry} and provide:
1. Key emerging trends
2. Growth areas
3. Declining sectors
4. Predictions for next 12 months
5. Recommended actions for job seekers

Format as JSON.`;

    const trends = await openaiClient.generateJSONCompletion(systemPrompt, userPrompt, {
      temperature: 0.6,
      max_tokens: 2000,
    });

    return trends;
  } catch (error) {
    logger.error('Trend analysis failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 5: Salary Negotiation Assistant
// ============================================================================

// File: services/salaryNegotiationService.js
import { generateWithRAG } from './ragService.js';
import { logger } from '../utils/logger.js';

export async function generateNegotiationStrategy(
  jobTitle,
  currentSalary,
  offeredSalary,
  location,
  yearsExperience
) {
  try {
    logger.info(`💰 Generating negotiation strategy for ${jobTitle}`);

    const systemPrompt = `You are a salary negotiation expert and career coach.
Provide data-driven negotiation strategies based on market data.`;

    const query = `Generate a salary negotiation strategy:

Job Title: ${jobTitle}
Location: ${location}
Years of Experience: ${yearsExperience}
Current Salary: $${currentSalary}
Offered Salary: $${offeredSalary}

Provide:
1. Market rate analysis (based on real data)
2. Negotiation talking points
3. Recommended counter-offer range
4. Red flags to watch for
5. Alternative benefits to negotiate

Return as structured JSON.`;

    const strategy = await generateWithRAG(query, systemPrompt, {
      namespaces: ['salary-data', 'bls-data', 'negotiation-tips'],
      topKPerNamespace: {
        'salary-data': 10,
        'bls-data': 5,
        'negotiation-tips': 5,
      },
      responseFormat: 'json',
      useCache: false, // Don't cache - personalized data
    });

    return strategy;
  } catch (error) {
    logger.error('Negotiation strategy generation failed:', error);
    throw error;
  }
}

// ============================================================================
// ADD ENDPOINTS TO server.js
// ============================================================================

/*
import { analyzeResume, quickResumeCheck } from './services/resumeAnalysisService.js';
import { generateCareerPath } from './services/careerPathService.js';
import { analyzeSkillGap } from './services/skillGapService.js';
import { analyzeTrends } from './services/trendAnalysisService.js';
import { generateNegotiationStrategy } from './services/salaryNegotiationService.js';

// Resume analysis
app.post('/api/resume/analyze', async (req, res) => {
  try {
    const { resumeText, targetRole } = req.body;
    if (!resumeText) return res.status(400).json({ error: 'Resume text required' });
    
    const analysis = await analyzeResume(resumeText, targetRole);
    res.json({ success: true, analysis });
  } catch (error) {
    logger.error('Resume analysis endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quick resume check
app.post('/api/resume/quick-check', async (req, res) => {
  try {
    const { resumeText } = req.body;
    const feedback = await quickResumeCheck(resumeText);
    res.json({ success: true, feedback });
  } catch (error) {
    logger.error('Quick check endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Career path
app.post('/api/career/path', async (req, res) => {
  try {
    const { userProfile, currentRole, yearsExperience } = req.body;
    const path = await generateCareerPath(userProfile, currentRole, yearsExperience);
    res.json({ success: true, path });
  } catch (error) {
    logger.error('Career path endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Skill gap analysis
app.post('/api/skills/gap-analysis', async (req, res) => {
  try {
    const { currentSkills, targetRole, location } = req.body;
    const analysis = await analyzeSkillGap(currentSkills, targetRole, location);
    res.json({ success: true, analysis });
  } catch (error) {
    logger.error('Skill gap endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trend analysis
app.post('/api/trends/analyze', async (req, res) => {
  try {
    const { industry, timeframe } = req.body;
    const trends = await analyzeTrends(industry, timeframe);
    res.json({ success: true, trends });
  } catch (error) {
    logger.error('Trends endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Salary negotiation
app.post('/api/salary/negotiation', async (req, res) => {
  try {
    const { jobTitle, currentSalary, offeredSalary, location, yearsExperience } = req.body;
    const strategy = await generateNegotiationStrategy(
      jobTitle,
      currentSalary,
      offeredSalary,
      location,
      yearsExperience
    );
    res.json({ success: true, strategy });
  } catch (error) {
    logger.error('Negotiation endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});
*/

// ============================================================================
// TESTING EXAMPLES
// ============================================================================

/*
// Test resume analysis
const testResume = `
John Doe
Software Engineer
5 years of experience in React, Node.js, Python
Built scalable web applications...
`;

const analysis = await analyzeResume(testResume, 'Senior Software Engineer');
console.log(analysis);

// Test career path
const path = await generateCareerPath(
  { interests: ['AI', 'management'], strengths: ['leadership', 'coding'] },
  'Software Engineer',
  5
);
console.log(path);

// Test skill gap
const gap = await analyzeSkillGap(
  ['JavaScript', 'React', 'Node.js'],
  'Full Stack Developer',
  'San Francisco, CA'
);
console.log(gap);
*/
