import type { MarketOpportunityView } from '../../types';

export interface MarketInsight {
  title: string;
  summary: string;
  category: string;
  meaning: string;
  action: string;
  source: string;
}

export const MARKET_INSIGHTS: MarketInsight[] = [
  {
    title: 'AI-enabled product delivery is becoming a baseline expectation',
    summary: 'Practical AI evidence now matters more than simply listing AI as a skill.',
    category: 'Skills',
    meaning:
      'Senior product leaders are increasingly expected to explain how AI improved a workflow, decision or customer outcome.',
    action: 'Add one measurable AI-enabled product example to your Career Profile.',
    source:
      'WEF Future of Jobs 2025 · LinkedIn and Indeed role signals · Last 60 days',   
  },
  {
    title: 'Commercial ownership is appearing more often in senior postings',
    summary: 'Revenue, margin, retention and efficiency now sit beside product delivery.',
    category: 'Role signals',
    meaning:
      'Delivery experience alone may not differentiate you when employers are screening for business and operating outcomes.',
    action:
      'Connect one roadmap decision to revenue, retention, margin or operating efficiency.',
    source: 'LinkedIn and Indeed senior product postings · Last 60 days',
  },
  {
    title: 'Regulated-platform experience remains defensible',
    summary:
      'Payments, compliance and risk knowledge continues to differentiate leaders.',
    category: 'Opportunity',
    meaning:
      'Your financial-services background is valuable where employers must modernize while managing regulation and risk.',
    action:
      'Make the regulated constraint and business outcome explicit in two recent examples.',
    source: 'Deloitte Tech Trends · Local employer signals · Current reporting period',
  },
  {
    title: 'Toronto demand remains stable, but hiring is more selective',
    summary: 'Demand is holding while employers narrow senior-role requirements.',
    category: 'Market direction',
    meaning:
      'Relevant experience still has value, but broad Product Manager positioning is less competitive than a focused market story.',
    action:
      'Position yourself around regulated platforms, AI-enabled delivery and commercial ownership.',
    source: 'Statistics Canada · LinkedIn and Indeed · Last 60 days',
  },
  {
    title: 'Competition is highest for broadly positioned product roles',
    summary: 'Generic product profiles compete against a wider pool of candidates.',
    category: 'Risk',
    meaning:
      'A general profile can hide the specific strengths that make you credible for senior financial-product roles.',
    action:
      'Use a targeted headline and evidence aligned to the role cluster you want next.',
    source: 'Job-posting concentration and applicant signals · Last 60 days',
  },
  {
    title: 'AI governance is becoming part of product leadership',
    summary:
      'Responsible adoption, data use and decision controls are entering role expectations.',
    category: 'Regulation',
    meaning:
      'Employers need product leaders who can move quickly without overlooking privacy, governance or operational risk.',
    action: 'Document one example of balancing customer value, AI use and governance.',
    source: 'OECD AI policy reporting · Deloitte Tech Trends · Current reporting period',
  },
  {
    title: 'Local financial-services transformation is supporting platform roles',
    summary:
      'Modernization work continues across payments, data and digital operations.',
    category: 'Local market',
    meaning:
      'Your experience is relevant to employers investing in platform modernization rather than only net-new consumer products.',
    action:
      'Prioritize employers and roles tied to payments, platforms, data or operational transformation.',
    source: 'Local business reporting · Indeed role signals · Last 60 days',
  },
  {
    title: 'Product operations is emerging as a credible adjacent path',
    summary: 'Planning cadence, metrics and cross-functional execution transfer well.',
    category: 'Adjacent role',
    meaning:
      'This path uses your delivery leadership while adding a stronger operating-system and enablement focus.',
    action: 'Compare your background against Product Operations Lead requirements.',
    source: 'LinkedIn and Indeed adjacent-role clusters · Last 60 days',
  },
  {
    title: 'AI Product Lead is a high-potential stretch path',
    summary:
      'Product strategy and stakeholder leadership transfer, with a focused evidence gap.',
    category: 'Adjacent role',
    meaning:
      'You do not need to start over, but you need credible examples of AI product judgment and delivery.',
    action:
      'Assess your skills against AI Product Lead expectations and select one evidence gap to close.',
    source: 'WEF Future of Jobs 2025 · Current AI product postings',
  },
  {
    title: 'Evidence quality will matter more than adding more skill labels',
    summary: 'Specific outcomes are more persuasive than an expanding list of keywords.',
    category: 'Action',
    meaning:
      'Your strongest advantage is the experience you already have when it is expressed as clear problems, decisions and measurable outcomes.',
    action: 'Turn one recent achievement into a concise problem-action-result case study.',
    source: 'Cross-source synthesis · WEF, Deloitte and current job-posting language',
  },
];

export interface MarketOpportunity {
  name: string;
  summary: string;
  signal: string;
  marketDetail: string;
  meaningDetail: string;
}

/** `roles` is rendered from `best` plus `emerging`; the other views map one-to-one. */
export type OpportunityGroup = 'best' | 'emerging' | 'sectors' | 'locations' | 'risks';

export const MARKET_OPPORTUNITIES: Record<OpportunityGroup, MarketOpportunity[]> = {
  best: [
    {
      name: 'AI Product Lead',
      summary:
        'Strategy, regulated products and stakeholder leadership transfer directly.',
      signal: 'Strong potential',
      marketDetail:
        'Product strategy, payments and cross-functional leadership match the core role.',
      meaningDetail: 'Build one clear AI-enabled product case study.',
    },
    {
      name: 'Platform Product Lead',
      summary: 'Payments, APIs and delivery experience provide a strong foundation.',
      signal: 'High fit',
      marketDetail:
        'Your regulated-platform experience transfers with limited repositioning.',
      meaningDetail: 'Show platform adoption or ecosystem outcomes more explicitly.',
    },
    {
      name: 'Product Operations Lead',
      summary:
        'Planning cadence, metrics and alignment skills transfer with minimal retraining.',
      signal: 'Accessible path',
      marketDetail: 'Your operating cadence and stakeholder alignment already fit.',
      meaningDetail:
        'Add stronger evidence of systems and organization-wide measurement.',
    },
  ],
  emerging: [
    {
      name: 'AI Product Manager',
      summary: 'AI responsibilities are moving into mainstream product portfolios.',
      signal: 'Demand rising',
      marketDetail:
        'Employers increasingly need practical AI use cases and measurable outcomes.',
      meaningDetail: 'Watch expectations around experimentation and governance.',
    },
    {
      name: 'Digital Identity Product Lead',
      summary:
        'Identity, consent and fraud controls are becoming core platform capabilities.',
      signal: 'Growing',
      marketDetail: 'Regulated platforms are investing in trust infrastructure.',
      meaningDetail: 'Watch demand for privacy, risk and platform experience.',
    },
    {
      name: 'Product Governance Lead',
      summary: 'AI adoption is creating new ownership needs across product organizations.',
      signal: 'Early growth',
      marketDetail:
        'Teams need accountable decision-making across privacy, risk and AI use.',
      meaningDetail: 'Watch whether this becomes a dedicated leadership role.',
    },
  ],
  sectors: [
    {
      name: 'Financial services & fintech',
      summary:
        'Strongest local fit for your regulated-product and payments background.',
      signal: 'High hiring signal',
      marketDetail: 'Stable demand in payments, platforms, risk and modernization.',
      meaningDetail: 'Platform, AI product and operations roles · Toronto · Last 60 days.',
    },
    {
      name: 'Enterprise software & AI',
      summary:
        'Demand is growing for leaders who turn AI capabilities into measurable workflows.',
      signal: 'Growing signal',
      marketDetail: 'Selective growth around applied AI and workflow software.',
      meaningDetail: 'AI and platform product roles · Toronto and remote · Last 60 days.',
    },
    {
      name: 'Digital infrastructure',
      summary:
        'Modernization supports demand across identity, payments and data services.',
      signal: 'Stable signal',
      marketDetail: 'Stable demand linked to regulated infrastructure.',
      meaningDetail: 'Platform and identity roles · Canada · Current reporting period.',
    },
  ],
  locations: [
    {
      name: 'Toronto, Ontario',
      summary:
        'Largest concentration of relevant senior product roles and regulated employers.',
      signal: 'Strongest market',
      marketDetail:
        'Stable demand with high competition; financial services and fintech lead.',
      meaningDetail:
        'Hybrid is common · Statistics Canada and job-posting signals · Last 60 days.',
    },
    {
      name: 'Remote — Canada',
      summary:
        'Broader access to software and AI product teams, with more applicants per role.',
      signal: 'High reach',
      marketDetail:
        'Wider access but a substantially larger national candidate pool.',
      meaningDetail:
        'Enterprise software and AI lead · Compensation varies · Last 60 days.',
    },
    {
      name: 'Kitchener–Waterloo, Ontario',
      summary: 'Smaller market with concentrated technology and platform employers.',
      signal: 'Growing market',
      marketDetail: 'Lower volume than Toronto with targeted technology demand.',
      meaningDetail:
        'Hybrid and onsite are more common · Regional postings · Last 60 days.',
    },
  ],
  risks: [
    {
      name: 'Generic Product Manager positioning',
      summary:
        'Broad profiles compete with a larger pool and hide specialized evidence.',
      signal: 'High relevance',
      marketDetail:
        'Senior searches increasingly narrow around sector, platform and outcomes.',
      meaningDetail:
        'Lead with regulated platforms, AI delivery and commercial ownership.',
    },
    {
      name: 'AI evidence gap',
      summary:
        'Skill labels without a practical example may not satisfy senior expectations.',
      signal: 'Immediate risk',
      marketDetail: 'AI-enabled delivery is becoming a baseline expectation.',
      meaningDetail: 'Develop one measurable AI workflow or decision case study.',
    },
    {
      name: 'High remote-role competition',
      summary: 'National candidate pools increase competition for flexible roles.',
      signal: 'Market risk',
      marketDetail: 'Remote access expands opportunity and applicant volume together.',
      meaningDetail: 'Use tighter targeting and employer-specific evidence.',
    },
  ],
};

export const OPPORTUNITY_ACTION_LABELS: Record<OpportunityGroup, string> = {
  best: 'View my fit',
  emerging: 'Why this role matters',
  sectors: 'View sector outlook',
  locations: 'Compare this location',
  risks: 'Review this risk',
};

export const OPPORTUNITY_VIEWS: Array<[MarketOpportunityView, string]> = [
  ['roles', 'Role opportunities'],
  ['sectors', 'Hiring sectors'],
  ['locations', 'Locations'],
  ['risks', 'Risks to watch'],
];

export const OPPORTUNITY_HEADINGS: Record<MarketOpportunityView, [string, string]> = {
  roles: [
    'Find the opportunities most relevant to you',
    'See your strongest current matches first, then monitor emerging roles worth watching.',
  ],
  sectors: [
    'See where relevant hiring is concentrated',
    'Compare sector demand, role fit and the market signals behind each outlook.',
  ],
  locations: [
    'Compare the markets available to you',
    'Review demand, competition and work patterns before deciding where to focus.',
  ],
  risks: [
    'Understand what could weaken your position',
    'See the market risks most relevant to your search and how to respond.',
  ],
};

export interface EvidenceGroup {
  index: string;
  title: string;
  tags: string[];
}

export const EVIDENCE_GROUPS: EvidenceGroup[] = [
  {
    index: '01',
    title: 'Technology & regulation',
    tags: [
      'Generative AI & automation',
      'Digital sovereignty',
      'Cybersecurity and regulation',
    ],
  },
  {
    index: '02',
    title: 'Economy & industry',
    tags: ['Macroeconomic indicators', 'Supply-chain change', 'Trade wars & reshoring'],
  },
  {
    index: '03',
    title: 'People & place',
    tags: [
      'Demographics & immigration',
      'Local business trends',
      'Energy and infrastructure',
    ],
  },
];

export interface EvidenceSource {
  name: string;
  role: string;
  date: string;
}

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  { name: 'WEF Future of Jobs', role: 'Strategic foundation', date: '2025' },
  { name: 'Statistics Canada', role: 'Regional labour data', date: 'Updated 8 days ago' },
  { name: 'LinkedIn & Indeed', role: 'Job-posting signals', date: 'Last 60 days' },
  { name: 'TD Economics', role: 'Macroeconomic outlook', date: 'Updated this quarter' },
];

export interface Capability {
  name: string;
  demand: string;
  width: string;
  action: string;
}

export const CAPABILITIES: Capability[] = [
  {
    name: 'AI workflow design',
    demand: 'High demand',
    width: '86%',
    action: 'Build one case study showing how AI improved a workflow or decision.',
  },
  {
    name: 'Commercial product strategy',
    demand: 'High demand',
    width: '81%',
    action: 'Connect two roadmap decisions to revenue, retention or efficiency.',
  },
  {
    name: 'Regulated data governance',
    demand: 'Growing',
    width: '72%',
    action: 'Document an example of balancing customer value, risk and compliance.',
  },
];

export const FOCUS_WEEKS: Array<[string, string]> = [
  ['Week 1', 'Choose one AI-enabled product example.'],
  ['Week 2', 'Add the commercial result and decision context.'],
  ['Weeks 3–4', 'Test the story against two target roles.'],
];

export interface MarketSignal {
  index: string;
  title: string;
  copy: string;
}

export const MARKET_SIGNAL_ROWS: MarketSignal[] = [
  {
    index: '01',
    title: 'AI-enabled product delivery is becoming a baseline expectation',
    copy: 'Employers increasingly expect senior product leaders to show how AI improves delivery, decision quality or customer outcomes.',
  },
  {
    index: '02',
    title: 'Commercial ownership is appearing more often in senior postings',
    copy: 'Product leaders are being asked to connect strategy with revenue, retention and operating efficiency.',
  },
  {
    index: '03',
    title: 'Regulated platform experience remains defensible',
    copy: 'Payments, compliance and risk experience continues to differentiate candidates.',
  },
];

export const GUEST_SHIFTS: Array<[string, string]> = [
  [
    'AI-enabled product delivery is becoming a baseline expectation',
    'Employers want practical evidence of how AI improves workflows, decisions or customer outcomes.',
  ],
  [
    'Commercial ownership matters more in senior postings',
    'Revenue, margin, retention and operating efficiency are appearing alongside product delivery.',
  ],
  [
    'Regulated-platform experience remains valuable',
    'Payments, compliance and risk experience continue to differentiate product leaders.',
  ],
];

export interface ArchivedReport {
  role: string;
  date: string;
  industry: string;
}

export const ARCHIVED_REPORTS: ArchivedReport[] = [
  { role: 'Product Manager', date: 'March 12, 2026', industry: 'Financial Services' },
  { role: 'Product Lead', date: 'January 8, 2026', industry: 'Software and SaaS' },
];

/** Percentage checkpoints the generation ring steps through before completing. */
export const MARKET_PROGRESS_CHECKPOINTS = [8, 18, 31, 47, 63, 78, 89, 96, 100];

export const SENIORITY_OPTIONS = [
  'Entry level',
  'Junior',
  'Mid-level',
  'Lead / Manager',
  'Director',
  'Executive',
];
