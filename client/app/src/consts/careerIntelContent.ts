/**
 * Content for Career Intel "Guidance" section (from career-intel assets).
 * Tailored guidance by career stage: New Graduates, Mid-Career, Newcomers.
 */
export type CareerStageId = 'new-graduates' | 'mid-career' | 'newcomers';

export interface GuidanceItem {
  text: string;
  source?: string; // e.g. "News article: ..." or "BLS Employment Data"
}

export const CAREER_STAGE_LABELS: Record<CareerStageId, string> = {
  'new-graduates': 'New Graduates',
  'mid-career': 'Mid-Career',
  newcomers: 'Newcomers',
};

export const GUIDANCE_BY_STAGE: Record<CareerStageId, GuidanceItem[]> = {
  'new-graduates': [
    { text: 'Consider opportunities in AI startups in San Francisco which offer generous benefits', source: 'News article: AI startups leasing luxury apartments' },
    { text: 'Explore entry-level roles in sectors with less impact from current layoffs, such as productivity software', source: 'News article: Reflecting On Productivity Software Stocks' },
    { text: 'Network with professionals in tech firms focusing on AI and pharmaceuticals, which are in focus for growth', source: 'News article: What To Expect in Markets This Week' },
    { text: 'Utilize local non-profit resources aimed at Gen Z employment, boosted by recent funding', source: 'News article: Nonprofits focused on Gen Z employment' },
    { text: 'Focus on building skills relevant to software publishing, as employment in this sector remains relatively stable', source: 'BLS Employment Data' },
    { text: 'Attend local tech meetups or seminars to broaden industry knowledge and connections' },
    { text: 'Leverage career services at local universities for workshops and job fairs' },
    { text: 'Apply for internships with companies offering remote work flexibility' },
    { text: 'Develop a strong LinkedIn presence to connect with hiring managers in San Francisco' },
    { text: 'Consider roles in data analytics and research organizations like IDinsight', source: 'News article: Senior Manager, US Operations' },
  ],
  'mid-career': [
    { text: 'Investigate transitioning to industries still doing well despite layoffs, such as productivity software', source: 'News article: Reflecting On Productivity Software Stocks' },
    { text: 'Consider roles in AI startups, leveraging any tech background to meet current market demand', source: 'News article: AI startups leasing luxury apartments' },
    { text: 'Enhance skills in data analytics to align with organizations like IDinsight', source: 'News article: Senior Manager, US Operations' },
    { text: 'Network with professionals in pharmaceuticals and the gig economy, sectors currently in focus', source: 'News article: What To Expect in Markets This Week' },
    { text: 'Attend workshops on career pivot strategies offered by local organizations' },
    { text: 'Leverage online courses to gain certifications in growing fields like AI and data science' },
    { text: 'Connect with local career coaches for personalized guidance on transitioning careers' },
    { text: 'Explore remote work opportunities to widen the job search beyond local geography' },
    { text: 'Join industry-specific groups in San Francisco for insider tips on job openings' },
    { text: 'Research opportunities in consultancy roles that utilize previous industry experience' },
  ],
  newcomers: [
    { text: 'Focus on sectors with less impact from layoffs, such as productivity software and AI startups', source: 'News article: Reflecting On Productivity Software Stocks' },
    { text: 'Use resources from local non-profits focused on international talent integration' },
    { text: 'Attend networking events in San Francisco to build a professional network quickly' },
    { text: 'Enhance language proficiency to improve job market competitiveness' },
    { text: 'Seek mentorship from professionals who have successfully integrated into the local market' },
    { text: 'Explore roles in global organizations like IDinsight that value diverse perspectives', source: 'News article: Senior Manager, US Operations' },
    { text: 'Utilize online platforms to showcase international experience and skills' },
    { text: 'Research visa sponsorship opportunities from AI startups in San Francisco', source: 'News article: AI startups leasing luxury apartments' },
    { text: 'Join international professional groups in San Francisco for support and advice' },
    { text: 'Consider roles in industries identified as having potential despite economic shifts, such as pharmaceuticals', source: 'News article: What To Expect in Markets This Week' },
  ],
};

/**
 * Content for Career Intel "Recommended Actions" section (from key-market-findings assets).
 * Each row: impact, market finding, recommended action, driving force.
 */
export type ImpactLevel = 'high' | 'medium' | 'low';

export interface RecommendedActionRow {
  impact: ImpactLevel;
  marketFinding: string;
  recommendedAction: string;
  drivingForce: string;
}

export const RECOMMENDED_ACTIONS: RecommendedActionRow[] = [
  {
    impact: 'high',
    marketFinding: 'AI startups in San Francisco are offering attractive benefits to attract talent.',
    recommendedAction: 'Consider roles in AI startups for competitive compensation packages.',
    drivingForce: 'Intense competition for specialised AI talent; startups use housing stipends and perks to differentiate offers and secure engineers amid a tight labour market.',
  },
  {
    impact: 'medium',
    marketFinding: 'Productivity software companies are maintaining stability despite economic challenges.',
    recommendedAction: 'Target job applications in productivity software for more stable opportunities.',
    drivingForce: 'Sustained enterprise demand for workflow and collaboration tools as companies prioritise efficiency and continuity during economic uncertainty.',
  },
  {
    impact: 'low',
    marketFinding: 'The software publishing sector shows slight employment fluctuations.',
    recommendedAction: 'Monitor employment trends in software publishing for potential opportunities.',
    drivingForce: 'Product release cycles, platform transitions, and short-term hiring adjustments that produce modest, cyclical employment changes.',
  },
  {
    impact: 'medium',
    marketFinding: 'Non-profits are receiving funding to support Gen Z employment.',
    recommendedAction: 'Engage with non-profits for job search assistance and resources.',
    drivingForce: 'Targeted philanthropic and programmatic investments responding to youth employment challenges, increasing capacity for training and placement programs.',
  },
  {
    impact: 'high',
    marketFinding: 'Tech and pharmaceutical sectors are expected to be in focus for growth.',
    recommendedAction: 'Explore job opportunities in tech and pharmaceuticals for future growth potential.',
    drivingForce: 'Ongoing R&D investment and the integration of AI into product roadmaps are driving hiring demand in both tech and pharma.',
  },
  {
    impact: 'low',
    marketFinding: 'Employment in software publishers marginally decreased from June to July 2025.',
    recommendedAction: 'Consider diversifying skills to include emerging tech areas.',
    drivingForce: 'Seasonal or post-quarter normalization of hiring and role reclassifications leading to small month-to-month shifts.',
  },
  {
    impact: 'medium',
    marketFinding: 'Job market pressures are visible due to economic uncertainties.',
    recommendedAction: 'Stay informed about economic trends to adjust job search strategies accordingly.',
    drivingForce: 'Macro headwinds—such as inflation, interest-rate sensitivity, and cautious corporate budgets—prompt firms to slow hiring and restructure.',
  },
  {
    impact: 'high',
    marketFinding: 'AI demand continues to drive market attention.',
    recommendedAction: 'Develop AI-related skills to enhance employability in tech-focused roles.',
    drivingForce: 'Rapid adoption of AI technologies across products and services is creating concentrated demand for AI and data-science talent.',
  },
];
