import {
  LayoutGrid,
  Sparkles,
  BarChart3,
  Settings,
  Rocket,
  Star,
  Target,
  Wrench,
} from "lucide-react";
import {
  NewsArticle,
  Course,
  UserProfile,
  CareerMilestone,
  RecentNewsArticle,
} from "../types";

export const INITIAL_USER: UserProfile = {
  name: "Alex Morgan",
  role: "Product Designer",
  company: "Tech Corp Inc.",
  location: "San Francisco, CA",
  country: "United States",
  experience: "2 Years",
  avatar:
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&mouth=smile&backgroundColor=E0E7FF",
  skills: [
    "UI/UX Design",
    "Figma",
    "Prototyping",
    "User Research",
    "Design Systems",
    "Wireframing",
  ],
  completedCourses: 12,
  certifications: 5,
};

export const NAVIGATION_ITEMS = [
  { id: "market-insights", label: "Market Insights", icon: LayoutGrid },
  { id: "career-intel", label: "Career Intel", icon: Sparkles },
  { id: "eco-simulator", label: "Eco Simulator", icon: BarChart3 },
];

export const BOTTOM_NAV_ITEMS = [
  { id: "settings", label: "Settings", icon: Settings },
];

export const MOCK_NEWS: NewsArticle[] = [
  {
    id: "1",
    title: "Market Intelligence Report",
    excerpt:
      "Analysis of the last 2 months: Key shifts in global job hotspots and center of gravity changes across the tech sector and emerging markets",
    author:
      "Fortune, Yahoo! Finance, NASDAQ Stock Market, U.S. Bureau of Labor Statistics Employment Data",
    authorAvatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Fortune&mouth=smile&backgroundColor=c0aede",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
    category: "Insights",
  },
  {
    id: "2",
    title: "Labor Market Snapshot",
    excerpt:
      "Current state of the job market: Employment rates, software publisher trends, and national cooling trends impacting modern workplace dynamics",
    author: "CareerCompass AI",
    authorAvatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=AI&mouth=smile&backgroundColor=b6e3f4",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop",
    category: "Market Data",
  },
  {
    id: "3",
    title: "Local vs Broader Region",
    excerpt:
      "Comparative analysis: Factor-by-factor breakdown of how your city compares to the wider regional economy and neighboring metropolitan areas",
    author: "CareerCompass AI",
    authorAvatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Regional&mouth=smile&backgroundColor=ffd5dc",
    image:
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=2670&auto=format&fit=crop",
    category: "Comparison",
  },
];

export const RECENT_NEWS_DATA: RecentNewsArticle[] = [
  {
    id: "rn1",
    title: "Nonprofits Focused on Gen Z Employment Receive $25M Boost",
    sentiment: "Positive",
    excerpt:
      "Citi Foundation has awarded $25 million to nonprofits focused on Gen Z employment, aiming to support young jobseekers in a challenging market.",
    date: "2025-10-21",
    source: "Fortune",
    relevance: 8,
  },
  {
    id: "rn2",
    title: "Tech Sector Resilience: AI Roles Surge 15% in Q3",
    sentiment: "Positive",
    excerpt:
      "New labor reports indicate a sharp rise in artificial intelligence engineering vacancies despite broader hiring plateaus in traditional software.",
    date: "2025-10-20",
    source: "NASDAQ",
    relevance: 9,
  },
  {
    id: "rn3",
    title: "Hybrid Work Mandates Tighten Across Global Finance Hubs",
    sentiment: "Neutral",
    excerpt:
      "Major institutions are adjusting remote work policies, favoring a 4-day in-office model to boost mentorship and collaborative design cycles.",
    date: "2025-10-19",
    source: "Yahoo Finance",
    relevance: 6,
  },
  {
    id: "rn4",
    title: "Renewable Energy Startups Secure Record Early-Stage Funding",
    sentiment: "Positive",
    excerpt:
      "A wave of venture capital is flowing into climate-tech, creating a surge in demand for product designers with systems thinking expertise.",
    date: "2025-10-18",
    source: "Bloomberg",
    relevance: 7,
  },
];

export const TREND_REPORTS = [
  {
    id: "high-growth",
    title: "10 High-Growth Sectors & Roles",
    excerpt:
      "Expanding industries with strong hiring momentum in San Francisco and across the global tech landscape.",
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop",
    category: "Opportunities",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "at-risk",
    title: "10 At-Risk Role Clusters & Pivot Paths",
    excerpt:
      "Understanding automation, structural shifts, and strategic pivot paths to future-proof your career.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2670&auto=format&fit=crop",
    category: "Pivot Strategies",
    color: "from-rose-500 to-orange-500",
  },
  {
    id: "market-risks",
    title: "Market Risks & Challenges",
    excerpt:
      "A deep dive into potential challenges and mitigation strategies for the current economic climate.",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=2670&auto=format&fit=crop",
    category: "Risk Analysis",
    color: "from-amber-500 to-yellow-500",
  },
  {
    id: "top-skills",
    title: "Top Skills In Demand",
    excerpt:
      "The critical skill sets positioned by market maturity and growth velocity for 2025 and beyond.",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2671&auto=format&fit=crop",
    category: "Skill Mapping",
    color: "from-indigo-500 to-purple-500",
  },
];

export const HIGH_GROWTH_DATA = [
  {
    title: "AI & Advanced Tech",
    status: "Expanding",
    description:
      "San Francisco remains a hub for AI and cutting-edge technology, drawing top talent and offering numerous opportunities for innovation.",
    roles: ["AI Researcher", "Machine Learning Engineer", "Data Scientist"],
    realityCheck:
      "While expanding, the sector is highly competitive and subject to rapid technological changes. The demand for continuous learning and adaptation is high.",
  },
  {
    title: "Green Tech & Clean Energy",
    status: "Growing",
    description:
      "With a focus on sustainability, San Francisco is investing in clean energy solutions, supporting the global shift towards environmentally friendly practices.",
    roles: [
      "Renewable Energy Engineer",
      "Sustainability Consultant",
      "Environmental Scientist",
    ],
    realityCheck:
      "Government policies and economic factors can affect growth. Entry into the field may require specific technical skills or certifications.",
  },
  {
    title: "Healthcare & Biotech",
    status: "Growing",
    description:
      "Healthcare innovation and biotech are critical to addressing medical challenges and improving quality of life, offering stable career paths.",
    roles: [
      "Biomedical Engineer",
      "Clinical Research Coordinator",
      "Biostatistician",
    ],
    realityCheck:
      "Regulatory changes and funding issues can impact job availability, and roles often demand advanced degrees or specialized training.",
  },
  {
    title: "Cybersecurity",
    status: "Expanding",
    description:
      "As threats to data security increase, the demand for cybersecurity professionals grows, securing critical systems and data.",
    roles: [
      "Security Analyst",
      "Penetration Tester",
      "Cybersecurity Consultant",
    ],
    realityCheck:
      "The field requires continuous learning to keep up with evolving threats. Certifications are often necessary.",
  },
];

export const AT_RISK_DATA = [
  {
    title: "Traditional Front-End / Generalist Software Engineers",
    shift: "AI coding tools, offshore talent, and shift toward AI/infra work",
    pivot: "Aim for AI engineering, infra/platform, security engineering...",
    realityCheck:
      "The rise of AI tools and automation reduces demand for basic coding tasks. Engineers should consider specializing in high-demand areas such as AI, machine learning, or cybersecurity.",
  },
  {
    title: "Retail Salespersons",
    shift: "Increased e-commerce and automation of sales processes",
    pivot:
      "Consider roles in digital marketing, e-commerce operations, or customer success management",
    realityCheck:
      "With the growth of online shopping, traditional retail roles are declining. Skills in digital platforms and customer engagement online are increasingly valuable.",
  },
  {
    title: "Manual Data Entry Clerks",
    shift: "Automated data processing and AI-driven data management",
    pivot:
      "Upskill to data analysis, data visualization, or database management",
    realityCheck:
      "AI and machine learning are automating routine data tasks, creating a demand for roles that interpret and manage complex data.",
  },
];

export const MARKET_RISKS_DATA = [
  {
    severity: "High",
    risk: "Economic uncertainties affecting job stability",
    sectors: ["Tech", "Manufacturing"],
    strategy:
      "Diversify skill sets and explore freelance or contract work to maintain income stability.",
  },
  {
    severity: "Medium",
    risk: "Policy changes impacting industry growth",
    sectors: ["Automotive", "Energy"],
    strategy:
      "Stay informed on policy developments and consider roles in resilient sectors.",
  },
  {
    severity: "High",
    risk: "Layoffs in specific sectors like tech",
    sectors: ["Technology", "Media"],
    strategy:
      "Expand job search to include industries with stable or growing employment opportunities.",
  },
  {
    severity: "Medium",
    risk: "Housing affordability in tech hubs",
    sectors: ["Housing", "Real Estate"],
    strategy:
      "Consider remote work options to access job markets without relocating.",
  },
  {
    severity: "Low",
    risk: "Tariff impacts on manufacturing",
    sectors: ["Manufacturing", "Agriculture"],
    strategy: "Explore roles in industries less affected by tariffs.",
  },
];

// Fallback data for when backend insights are not available
export const FALLBACK_EXECUTIVE_SUMMARY_BRIEF =
  "Market insights are being generated. Please wait for personalized analysis based on your location and career profile.";

export const FALLBACK_LABOUR_MARKET_OVERVIEW =
  "Labor market data is currently being retrieved from multiple sources including BLS employment reports, recent news, and economic indicators. Your personalized snapshot will be available shortly.";

export const FALLBACK_KEY_STATS = {
  strongest_opportunity: "Data is being analyzed - check back shortly",
  highest_risk_sector: "Analysis in progress",
  top_skill_demand: "Insights loading...",
  pivot_necessity: "To be determined",
};

export const FALLBACK_MAJOR_DRIVERS = [
  "Market analysis in progress",
  "Economic indicators being evaluated",
  "Industry trends under review",
];

export const FALLBACK_MARKET_HEALTH = {
  employment_rate: "Calculating...",
  job_growth_rate: "Analyzing data...",
  trend: "Pending",
};

export const FALLBACK_CITY_VS_REGION = [
  {
    factor: "Overall job market trend",
    city: "Analysis in progress...",
    wider_region: "Analysis in progress...",
  },
];

export const TOP_SKILLS_DATA = [
  {
    id: "emerging-stars",
    category: "Emerging Stars",
    categoryDescription: "Skills gaining rapid importance and demand.",
    title: "AI & Machine Learning",
    level: "High",
    description:
      "Skills related to artificial intelligence and machine learning technologies.",
    skills: ["TensorFlow", "PyTorch", "Scikit-learn"],
    note: "Increasing demand due to tech industry growth.",
    insights:
      "AI startups in San Francisco are driving demand for AI expertise. Consider online courses and certifications in AI to boost your employability in this thriving sector.",
    color: "border-emerald-200",
    badge: "bg-indigo-600 text-white",
    icon: Rocket,
    iconColor: "bg-emerald-500",
  },
  {
    id: "strategic-must-haves",
    category: "Strategic Must-Haves",
    categoryDescription: "Core skills critical for current tech roles.",
    title: "Cloud Computing",
    level: "Medium",
    description: "Skills associated with cloud technology platforms.",
    skills: ["AWS", "Azure", "Google Cloud"],
    note: "Steady demand with growing emphasis on cloud integration.",
    insights:
      "Cloud platforms are essential for scalable tech solutions in San Francisco. Gain familiarity with one or more cloud platforms through hands-on projects and certifications.",
    color: "border-purple-200",
    badge: "bg-indigo-600 text-white",
    icon: Star,
    iconColor: "bg-purple-500",
  },
  {
    id: "stable-foundations",
    category: "Stable Foundations",
    categoryDescription:
      "Consistently in-demand skills across various tech roles.",
    title: "Data Analytics",
    level: "Growing",
    description: "Skills for analyzing and deriving insights from data.",
    skills: ["Tableau", "SQL", "Excel"],
    note: "Sustained demand as companies focus on data-driven decisions.",
    insights:
      "Data analytics is crucial for strategic planning in tech companies. Enhance your data skills through practical courses and real-world data projects.",
    color: "border-blue-200",
    badge: "bg-amber-600 text-white",
    icon: Target,
    iconColor: "bg-blue-500",
  },
  {
    id: "niche-specialists",
    category: "Niche Specialists",
    categoryDescription:
      "Specialized skills with high demand in specific sectors.",
    title: "Cybersecurity",
    level: "High",
    description: "Skills focused on protecting systems and data.",
    skills: ["Penetration Testing", "Network Security", "Incident Response"],
    note: "Growing due to increased cyber threats.",
    insights:
      "San Francisco's tech companies prioritize cybersecurity to protect innovations. Pursue cybersecurity certifications and stay updated on industry best practices to capitalize on this demand.",
    color: "border-slate-200",
    badge: "bg-indigo-600 text-white",
    icon: Wrench,
    iconColor: "bg-slate-500",
  },
];

export const MOCK_COURSES: Course[] = [
  {
    id: "1",
    title: "Advanced UI/UX Design Principles",
    provider: "MasterClass",
    duration: "12 hours",
    level: "Beginner",
    rating: 4.8,
    reviews: "2.4k reviews",
    image: "https://picsum.photos/seed/course1/100/100",
    icon: "🎨",
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    id: "2",
    title: "Frontend Development Bootcamp",
    provider: "Udemy",
    duration: "20 hours",
    level: "Intermediate",
    rating: 4.9,
    reviews: "3.1k reviews",
    image: "https://picsum.photos/seed/course2/100/100",
    icon: "💻",
    color: "bg-purple-100 text-purple-600",
  },
];

export const CAREER_PATH: CareerMilestone[] = [
  { id: 1, title: "Product Designer", status: "Completed" },
  {
    id: 2,
    title: "Senior Product Designer",
    status: "In Progress",
    progress: 60,
    estimate: "6 months",
  },
  {
    id: 3,
    title: "Lead Product Designer",
    status: "Future",
    estimate: "2-3 years",
  },
];
