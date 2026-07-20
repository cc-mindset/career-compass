import React, { useState, useEffect, useRef } from "react";
import { UserProfile, AppView, RecentNewsArticle } from "../../types";
import { normalizeSenioritiyLabel } from "../../utils";
import {
  MOCK_NEWS,
  TREND_REPORTS,
  HIGH_GROWTH_DATA,
  AT_RISK_DATA,
  TOP_SKILLS_DATA,
  MARKET_RISKS_DATA,
  RECENT_NEWS_DATA,
  FALLBACK_EXECUTIVE_SUMMARY_BRIEF,
  FALLBACK_LABOUR_MARKET_OVERVIEW,
  FALLBACK_KEY_STATS,
  FALLBACK_MAJOR_DRIVERS,
  FALLBACK_MARKET_HEALTH,
  FALLBACK_CITY_VS_REGION,
} from "../../consts";
import {
  Lightbulb,
  MapPin,
  ArrowRight,
  ChevronsRight,
  TrendingUp,
  AlertTriangle,
  Target,
  Zap,
  BarChart2,
  ArrowLeft,
  Rocket,
  Shield,
  RefreshCw,
  FileText,
  Briefcase,
  GraduationCap,
  Library,
  Gauge,
  Star,
  Wrench,
  Loader2,
  Newspaper,
} from "lucide-react";
import { useMarketInsightsState } from "../../state/marketInsights/MarketInsightsContext";
import { SectionWrapper } from "../../components/section-wrapper";
import AnimatedLoader from "../../ui-kit/atom/animated-loader";
import NewsCard from "./news-card";
import PivotBox from "./pivot-box";
import InsightBox from "./insight-box";
import TrendCard from "./trend-card";
import RecentNewsCard from "./recent-news-card";

interface MarketInsightViewProps {
  user: UserProfile;
  onNavigate: (view: AppView) => void;
}

type GrowthSectorCard = {
  title: string;
  description: string;
  roles: string[];
  realityCheck: string;
};

type AtRiskSectorCard = {
  title: string;
  shift: string;
  pivot: string;
  realityCheck: string;
};

type SkillCard = {
  id: string;
  category: string;
  categoryDescription: string;
  title: string;
  level: string;
  description: string;
  skills: string[];
  note: string;
  insights: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge: string;
  iconColor: string;
};

type MarketRiskCard = {
  severity: string;
  risk: string;
  sectors: string[];
  strategy: string;
};

type MarketNewsCard = {
  id: string;
  title: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  excerpt: string;
  date: string;
  source: string;
  relevance: number;
};

const MarketInsightView: React.FC<MarketInsightViewProps> = ({ user }) => {
  const lastAutoGenerateTupleRef = useRef<string | null>(null);
  const {
    generateStatus,
    generateError,
    progressText,
    sections,
    retrySection,
    generateMarketInsights,
    retrieved,
  } = useMarketInsightsState();

  useEffect(() => {
    if (!retrieved && user.location && user.role && user.experience && !sections.marketReport.data) {
      const normalizedExperience = normalizeSenioritiyLabel(user.experience);
      const tupleKey = `${user.location}__${user.role}__${normalizedExperience}`;
      if (lastAutoGenerateTupleRef.current !== tupleKey) {
        lastAutoGenerateTupleRef.current = tupleKey;
        generateMarketInsights({
          location: user.location,
          job: user.role,
          seniority: normalizedExperience,
        });
      }
    }
  }, [retrieved, user.location, user.role, user.experience, sections.marketReport.data, generateMarketInsights]);

  // Read from per-section data (available immediately on section_success)
  // instead of generateState.data.insights (only set on job_complete)
  const marketReportData = sections.marketReport.data as any;
  const industryTrendsData = sections.industryTrends.data as any;
  const newsIntelData = sections.newsAndCareerIntel.data as any;

  // Per-section loading flags — show the wave in the opened detail view until data arrives
  const marketReportLoading = sections.marketReport.status === "loading";
  const industryTrendsLoading = sections.industryTrends.status === "loading";

  // Market report fields
  const executiveSummaryBrief =
    marketReportData?.market_report_summary_brief || null;
  const executiveSummary = marketReportData?.market_report_summary || null;
  const labourMarketSnapshot = marketReportData?.labour_market_snapshot || null;
  const cityVsRegionComparison =
    marketReportData?.city_vs_region_comparison || null;

  // Transform growth_sectors to match expected format
  const highGrowthSectors: GrowthSectorCard[] =
    industryTrendsData?.growth_sectors?.map((item: any) => ({
      title: item.sector || item.title,
      description: item.why_it_matters || item.description,
      roles: item.example_roles || item.roles || [],
      realityCheck: item.risk_reality_check || item.realityCheck,
    })) || HIGH_GROWTH_DATA;

  // Transform at_risk_sectors to match expected format
  const atRiskSectors: AtRiskSectorCard[] =
    industryTrendsData?.at_risk_sectors?.map((item: any) => ({
      title: item.sector || item.title,
      shift: item.automation_reason || item.shift,
      pivot: item.pivot_direction || item.pivot,
      realityCheck: item.risk_reality_check || item.realityCheck,
    })) || AT_RISK_DATA;

  // Transform top_skills_demand to match expected format
  // Backend sends nested structure with categories/quadrants/skills
  // Frontend expects flat array with icon, color, badge properties
  const topSkillsDemand: SkillCard[] = industryTrendsData?.top_skills_demand?.categories
    ? industryTrendsData.top_skills_demand.categories.flatMap(
        (quadrant: any) => {
          // Map quadrant names to UI styling
          const quadrantStyles: Record<string, any> = {
            "Emerging Stars": {
              color: "border-emerald-200",
              badge: "bg-indigo-600 text-white",
              icon: Rocket,
              iconColor: "bg-emerald-500",
            },
            "Strategic Must-Haves": {
              color: "border-purple-200",
              badge: "bg-indigo-600 text-white",
              icon: Star,
              iconColor: "bg-purple-500",
            },
            "Stable Foundations": {
              color: "border-blue-200",
              badge: "bg-amber-600 text-white",
              icon: Target,
              iconColor: "bg-blue-500",
            },
            "Niche Specialists": {
              color: "border-amber-200",
              badge: "bg-emerald-600 text-white",
              icon: Wrench,
              iconColor: "bg-amber-500",
            },
          };
          const styles =
            quadrantStyles[quadrant.quadrant] ||
            quadrantStyles["Stable Foundations"];

          return (quadrant.skills || []).map((skill: any, sIdx: number) => ({
            id: `${quadrant.quadrant.toLowerCase().replace(/\s+/g, "-")}-${sIdx}`,
            category: quadrant.quadrant,
            categoryDescription: quadrant.description || "",
            title: skill.category,
            level: skill.demand_level || "Medium",
            description: skill.why || skill.description,
            skills: skill.examples || [],
            note: skill.growth_trend || "",
            insights: skill.so_what || skill.description,
            ...styles,
          }));
        },
      )
    : TOP_SKILLS_DATA;

  // Transform market_risks to match expected format
  const marketRisks: MarketRiskCard[] =
    industryTrendsData?.market_risks?.map((item: any) => ({
      severity: item.severity,
      risk: item.risk,
      sectors: item.affected_sectors || item.sectors || [],
      strategy: item.mitigation_strategy || item.strategy,
    })) || MARKET_RISKS_DATA;

  const marketNews: MarketNewsCard[] =
    newsIntelData?.market_news?.map((item: any, idx: number) => ({
      id: item.id || `news-${idx}`,
      title: item.headline || item.title,
      sentiment: (item.impact || item.sentiment) as
        | "Positive"
        | "Neutral"
        | "Negative",
      excerpt: item.summary || item.excerpt,
      date: item.date,
      source: item.source,
      relevance: item.relevance_score || item.relevance || 5,
    })) || RECENT_NEWS_DATA;

  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [currentTrendIndex, setCurrentTrendIndex] = useState(0);
  const [selectedMarketNews, setSelectedMarketNews] =
    useState<RecentNewsArticle | null>(null);

  const newsSectionRef = useRef<HTMLDivElement>(null);
  const trendsSectionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const newsScrollRef = useRef<HTMLDivElement>(null);
  const trendsScrollRef = useRef<HTMLDivElement>(null);

  // Swipe detection for mobile news cards
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [trendTouchStart, setTrendTouchStart] = useState<number | null>(null);
  const [trendTouchEnd, setTrendTouchEnd] = useState<number | null>(null);

  const totalNewsCards = MOCK_NEWS.length;
  const totalTrendCards = TREND_REPORTS.length;

  // Loading UI component
  const LoadingUI = () => {
    const getLoadingText = () => {
      if (generateError) {
        return generateError;
      }
      if (progressText) {
        return progressText;
      }
      if (generateStatus === "in-progress") {
        return "Generating your market insights...";
      }
      return "Preparing your dashboard...";
    };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
        {/* Welcome back card */}
        <section className="bg-gradient-to-br from-indigo-500 via-indigo-700 to-slate-900 border border-indigo-400/30 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden group lg:h-[160px] flex flex-col justify-center mb-12 shadow-xl shadow-indigo-900/10 transition-all duration-500">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-4xl font-extrabold mb-1 flex items-center gap-3 tracking-tight text-white">
                Welcome back, {user.name.split(" ")[0]}! 👋
              </h1>
              <p className="text-indigo-50 text-base md:text-lg font-medium tracking-tight opacity-90">
                Here's what's happening in your industry today
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-white/20 flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-sm text-white">
                <Briefcase className="w-3 h-3 md:w-4 md:h-4 text-indigo-100" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  {user.role}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-white/20 flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-sm text-white">
                <GraduationCap className="w-3 h-3 md:w-4 md:h-4 text-indigo-100" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  {user.experience.replace(/\s*\([^)]*\)\s*/g, "").trim()}
                </span>
              </div>
            </div>
          </div>
          {/* Decorative background circle */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover:scale-125 transition-all duration-1000" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-16 -mb-16" />
        </section>

        {/* Loading indicator */}
        <div className="flex flex-col items-center justify-center min-h-[40vh] py-20">
          <div className="flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-xl md:text-2xl font-semibold text-slate-900">
              {getLoadingText()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Navigate to next/previous card on mobile
  const goToNextCard = () => {
    if (currentNewsIndex < totalNewsCards - 1 && newsScrollRef.current) {
      const newIndex = currentNewsIndex + 1;
      setCurrentNewsIndex(newIndex);
      // Find the target card element and scroll to it
      const cards = newsScrollRef.current.children;
      if (cards[newIndex]) {
        (cards[newIndex] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }
  };

  const goToPrevCard = () => {
    if (currentNewsIndex > 0 && newsScrollRef.current) {
      const newIndex = currentNewsIndex - 1;
      setCurrentNewsIndex(newIndex);
      // Find the target card element and scroll to it
      const cards = newsScrollRef.current.children;
      if (cards[newIndex]) {
        (cards[newIndex] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }
  };

  // Swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentNewsIndex < totalNewsCards - 1) {
      goToNextCard();
    }
    if (isRightSwipe && currentNewsIndex > 0) {
      goToPrevCard();
    }
  };

  // Navigate to next/previous trend card on mobile
  const goToNextTrend = () => {
    if (currentTrendIndex < totalTrendCards - 1 && trendsScrollRef.current) {
      const newIndex = currentTrendIndex + 1;
      setCurrentTrendIndex(newIndex);
      const cards = trendsScrollRef.current.children;
      if (cards[newIndex]) {
        (cards[newIndex] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }
  };

  const goToPrevTrend = () => {
    if (currentTrendIndex > 0 && trendsScrollRef.current) {
      const newIndex = currentTrendIndex - 1;
      setCurrentTrendIndex(newIndex);
      const cards = trendsScrollRef.current.children;
      if (cards[newIndex]) {
        (cards[newIndex] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }
  };

  // Swipe handlers for trends
  const onTrendTouchStart = (e: React.TouchEvent) => {
    setTrendTouchEnd(null);
    setTrendTouchStart(e.targetTouches[0].clientX);
  };

  const onTrendTouchMove = (e: React.TouchEvent) => {
    setTrendTouchEnd(e.targetTouches[0].clientX);
  };

  const onTrendTouchEnd = () => {
    if (!trendTouchStart || !trendTouchEnd) return;
    const distance = trendTouchStart - trendTouchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentTrendIndex < totalTrendCards - 1) {
      goToNextTrend();
    }
    if (isRightSwipe && currentTrendIndex > 0) {
      goToPrevTrend();
    }
  };

  // Sync scroll position with current index on mobile
  useEffect(() => {
    if (newsScrollRef.current && window.innerWidth < 768) {
      const handleScroll = () => {
        if (!newsScrollRef.current) return;
        const scrollLeft = newsScrollRef.current.scrollLeft;
        const containerWidth = newsScrollRef.current.offsetWidth;
        const cards = Array.from(
          newsScrollRef.current.children,
        ) as HTMLElement[];

        // Find which card is most visible
        let newIndex = 0;
        let maxVisible = 0;

        cards.forEach((card, index) => {
          const cardLeft = card.offsetLeft;
          const cardWidth = card.offsetWidth;
          const visibleLeft = Math.max(0, scrollLeft - cardLeft);
          const visibleRight = Math.min(
            cardWidth,
            scrollLeft + containerWidth - cardLeft,
          );
          const visible = Math.max(0, visibleRight - visibleLeft);

          if (visible > maxVisible) {
            maxVisible = visible;
            newIndex = index;
          }
        });

        if (
          newIndex !== currentNewsIndex &&
          newIndex >= 0 &&
          newIndex < totalNewsCards
        ) {
          setCurrentNewsIndex(newIndex);
        }
      };

      const scrollContainer = newsScrollRef.current;
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [currentNewsIndex, totalNewsCards]);

  // Sync trends scroll position with current index on mobile
  useEffect(() => {
    if (trendsScrollRef.current && window.innerWidth < 768) {
      const handleScroll = () => {
        if (!trendsScrollRef.current) return;
        const scrollLeft = trendsScrollRef.current.scrollLeft;
        const containerWidth = trendsScrollRef.current.offsetWidth;
        const cards = Array.from(
          trendsScrollRef.current.children,
        ) as HTMLElement[];

        // Find which card is most visible
        let newIndex = 0;
        let maxVisible = 0;

        cards.forEach((card, index) => {
          const cardLeft = card.offsetLeft;
          const cardWidth = card.offsetWidth;
          const visibleLeft = Math.max(0, scrollLeft - cardLeft);
          const visibleRight = Math.min(
            cardWidth,
            scrollLeft + containerWidth - cardLeft,
          );
          const visible = Math.max(0, visibleRight - visibleLeft);

          if (visible > maxVisible) {
            maxVisible = visible;
            newIndex = index;
          }
        });

        if (
          newIndex !== currentTrendIndex &&
          newIndex >= 0 &&
          newIndex < totalTrendCards
        ) {
          setCurrentTrendIndex(newIndex);
        }
      };

      const scrollContainer = trendsScrollRef.current;
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [currentTrendIndex, totalTrendCards]);

  // Scroll to the respective section when a detail is opened
  useEffect(() => {
    if (selectedNewsId && newsSectionRef.current) {
      newsSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [selectedNewsId]);

  useEffect(() => {
    if (selectedTrendId && trendsSectionRef.current) {
      setTimeout(() => {
        trendsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }
  }, [selectedTrendId]);

  // Logic for truly infinite manual scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Start in the middle set for immediate bidirectional scrolling
    const setWidth = el.scrollWidth / 3;
    el.scrollLeft = setWidth;

    const handleScroll = () => {
      const currentScroll = el.scrollLeft;
      const totalWidth = el.scrollWidth;
      const singleSetWidth = totalWidth / 3;

      // If we scroll too far right (into the 3rd set), jump back to the 2nd set
      if (currentScroll >= singleSetWidth * 2) {
        el.scrollLeft = currentScroll - singleSetWidth;
      }
      // If we scroll too far left (into the 1st set), jump forward to the 2nd set
      else if (currentScroll <= 0) {
        el.scrollLeft = singleSetWidth;
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [selectedNewsId, selectedTrendId]);

  const closeNewsDetail = () => setSelectedNewsId(null);
  const closeTrendDetail = () => setSelectedTrendId(null);

  // Hero/header for each trend detail — kept visible while the body loads
  const renderTrendHero = (id: string, location: string) => {
    switch (id) {
      case "high-growth":
        return (
          <div className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100">
            <div className="flex items-center gap-3 mb-2">
              <Rocket className="w-8 h-8 text-emerald-600" />
              <h2 className="text-2xl font-extrabold text-slate-900">
                10 High-Growth Sectors & Roles
              </h2>
            </div>
            <p className="text-slate-500 font-medium">
              Industries with strong hiring momentum in {location}
            </p>
          </div>
        );
      case "at-risk":
        return (
          <div className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
              <h2 className="text-2xl font-extrabold text-slate-900">
                10 At-Risk Role Clusters & Pivot Paths
              </h2>
            </div>
            <p className="text-slate-500 font-medium">
              Understanding automation, structural shifts, and strategic pivot
              paths
            </p>
          </div>
        );
      case "top-skills":
        return (
          <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
            <div className="flex items-center gap-4 mb-2">
              <Zap className="w-8 h-8 text-indigo-600" />
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Top Skills Demand in 2025
                </h2>
                <p className="text-slate-500 font-medium">
                  Skills positioned by market maturity and growth velocity
                </p>
              </div>
            </div>
          </div>
        );
      case "market-risks":
        return (
          <div className="bg-amber-50/50 p-8 rounded-3xl border border-amber-100">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-8 h-8 text-amber-600" />
              <h2 className="text-2xl font-extrabold text-slate-900">
                Market Risks & Challenges
              </h2>
            </div>
            <p className="text-slate-500 font-medium">
              Potential challenges and mitigation strategies for your career path
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTrendDetail = (id: string, location: string) => {
    if (industryTrendsLoading) {
      return (
        <div className="space-y-10">
          {renderTrendHero(id, location)}
          <div className="min-h-[300px] flex items-center justify-center">
            <AnimatedLoader />
          </div>
        </div>
      );
    }
    switch (id) {
      case "high-growth":
        return (
          <div className="space-y-10">
            <div className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-2">
                <Rocket className="w-8 h-8 text-emerald-600" />
                <h2 className="text-2xl font-extrabold text-slate-900">
                  10 High-Growth Sectors & Roles
                </h2>
              </div>
              <p className="text-slate-500 font-medium">
                Industries with strong hiring momentum in {location}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {highGrowthSectors.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50/50 border-[1.5px] border-emerald-500 rounded-[2.5rem] p-8 flex flex-col h-full shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-bold text-slate-900">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-slate-600 mb-6 leading-relaxed text-base">
                    {item.description}
                  </p>
                  <div className="mt-auto space-y-6">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest mb-2">
                        Example Roles:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.roles.map((role, rIdx) => (
                          <span
                            key={rIdx}
                            className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold text-slate-700"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                    <InsightBox
                      text={item.realityCheck}
                      compact={true}
                      forceBaseSize={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "at-risk":
        return (
          <div className="space-y-10">
            <div className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-8 h-8 text-rose-600" />
                <h2 className="text-2xl font-extrabold text-slate-900">
                  10 At-Risk Role Clusters & Pivot Paths
                </h2>
              </div>
              <p className="text-slate-500 font-medium">
                Understanding automation, structural shifts, and strategic pivot
                paths
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {atRiskSectors.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border-[1.5px] border-rose-500 rounded-[2.5rem] p-8 flex flex-col h-full shadow-md"
                >
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <div className="mb-6">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest mb-1">
                      Automation / Shift:
                    </p>
                    <p className="text-slate-600 text-base leading-relaxed">
                      {item.shift}
                    </p>
                  </div>

                  <div className="mt-auto space-y-6">
                    <PivotBox
                      text={item.pivot}
                      forceBaseSize={true}
                      compact={true}
                    />
                    <InsightBox
                      text={item.realityCheck}
                      forceBaseSize={true}
                      compact={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "top-skills":
        return (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
              <div className="flex items-center gap-4 mb-2">
                <Zap className="w-8 h-8 text-indigo-600" />
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    Top Skills Demand in 2025
                  </h2>
                  <p className="text-slate-500 font-medium">
                    Skills positioned by market maturity and growth velocity
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {topSkillsDemand.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className={`border-[1.5px] rounded-[2.5rem] p-8 ${item.color} relative overflow-hidden group bg-transparent`}
                  >
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center gap-4 mb-8">
                        <div
                          className={`${item.iconColor} text-white p-3 rounded-2xl shadow-lg`}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold text-slate-900">
                            {item.category}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">
                            {item.categoryDescription}
                          </p>
                        </div>
                      </div>

                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-2xl font-bold text-slate-900">
                            {item.title}
                          </h4>
                          <span
                            className={`px-4 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${item.badge}`}
                          >
                            {item.level}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-6">
                          {item.skills.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="bg-slate-50 border border-slate-200 px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition-all hover:border-indigo-400/50"
                            >
                              {s}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 text-slate-500 font-medium italic text-xs">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>{item.note}</span>
                        </div>
                      </div>

                      <div className="mt-auto">
                        <InsightBox
                          text={item.insights}
                          compact={true}
                          forceBaseSize={true}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "market-risks":
        return (
          <div className="space-y-10">
            <div className="bg-amber-50/50 p-8 rounded-3xl border border-amber-100">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-8 h-8 text-amber-600" />
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Market Risks & Challenges
                </h2>
              </div>
              <p className="text-slate-500 font-medium">
                Potential challenges and mitigation strategies for your career
                path
              </p>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[640px] overflow-hidden bg-white rounded-[1.5rem] md:rounded-[2.5rem] border-[1.5px] border-amber-500 shadow-md">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 tracking-widest whitespace-nowrap border-b border-b-amber-500">
                        Severity
                      </th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 tracking-widest whitespace-nowrap border-b border-b-amber-500">
                        Risk
                      </th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 tracking-widest whitespace-nowrap border-b border-b-amber-500">
                        Sectors
                      </th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 tracking-widest whitespace-nowrap border-b border-b-amber-500">
                        Strategy
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {marketRisks.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-4 md:px-8 md:py-6 w-[15%]">
                          <span
                            className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[10px] font-extrabold uppercase border ${
                              row.severity === "High"
                                ? "border-rose-500/30 text-rose-600 bg-rose-50"
                                : row.severity === "Medium"
                                  ? "border-amber-500/30 text-amber-600 bg-amber-50"
                                  : "border-indigo-500/30 text-indigo-600 bg-indigo-50"
                            }`}
                          >
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 font-bold text-slate-900 text-base md:text-lg w-[20%] min-w-[140px]">
                          {row.risk}
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 w-[20%]">
                          <div className="flex flex-wrap gap-1.5 md:gap-2">
                            {row.sectors.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-1 md:px-3 md:py-1.5 bg-white border-0 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold text-slate-700 shadow-sm transition-all cursor-default"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 text-slate-700 leading-relaxed text-sm md:text-lg w-[45%] min-w-[180px]">
                          {row.strategy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Hero/header for each market-report article — kept visible while the body loads
  const renderArticleHero = (id: string, location: string, country: string) => {
    switch (id) {
      case "1":
        return (
          <div className="bg-indigo-50/50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-indigo-100">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <MapPin className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                Market Intelligence Report
              </h2>
            </div>
            <p className="text-indigo-900 font-bold mb-1 text-sm md:text-base">
              {location}, {country}
            </p>
            <p className="text-slate-500 font-medium text-sm md:text-base">
              Your personalized career intelligence based on real labor market
              data
            </p>
          </div>
        );
      case "2":
        return (
          <div className="bg-sky-50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-sky-100">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <BarChart2 className="w-6 h-6 md:w-8 md:h-8 text-sky-600" />
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                Labour Market Snapshot
              </h2>
            </div>
            <p className="text-slate-500 font-medium text-sm md:text-base">
              Current state of the job market in {location}
            </p>
          </div>
        );
      case "3":
        return (
          <div className="bg-amber-50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-amber-100">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <MapPin className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                {location} vs Broader Region
              </h2>
            </div>
            <p className="text-slate-500 font-medium text-sm md:text-base">
              How your city compares to the wider region
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderArticleContent = (
    id: string,
    location: string,
    country: string,
  ) => {
    if (marketReportLoading) {
      return (
        <div className="space-y-12">
          {renderArticleHero(id, location, country)}
          <div className="min-h-[300px] flex items-center justify-center">
            <AnimatedLoader />
          </div>
        </div>
      );
    }
    switch (id) {
      case "1":
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-indigo-50/50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-indigo-100">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <MapPin className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                  Market Intelligence Report
                </h2>
              </div>
              <p className="text-indigo-900 font-bold mb-1 text-sm md:text-base">
                {location}, {country}
              </p>
              <p className="text-slate-500 font-medium text-sm md:text-base">
                Your personalized career intelligence based on real labor market
                data
              </p>
            </div>

            <div>
              <h3 className="text-lg md:text-xl font-bold text-black mb-4 md:mb-6">
                Market News Summary (Based on the Last 2 Months)
              </h3>
              <div className="space-y-4 md:space-y-6 text-slate-700 leading-relaxed text-base md:text-lg">
                {executiveSummaryBrief ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: executiveSummaryBrief
                        .split("\n\n")
                        .map((p: string) => `<p>${p}</p>`)
                        .join(""),
                    }}
                  />
                ) : (
                  <p className="text-slate-500 italic">
                    {FALLBACK_EXECUTIVE_SUMMARY_BRIEF}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white border-[1.5px] border-emerald-500 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 font-bold mb-3 md:mb-4">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">
                    Strongest Opportunity
                  </span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                  {executiveSummary?.summary_key_stats?.strongest_opportunity ||
                    FALLBACK_KEY_STATS.strongest_opportunity}
                </p>
              </div>

              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white border-[1.5px] border-rose-500 shadow-sm">
                <div className="flex items-center gap-2 text-rose-600 font-bold mb-3 md:mb-4">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">
                    Highest Risk Sector
                  </span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                  {executiveSummary?.summary_key_stats?.highest_risk_sector ||
                    FALLBACK_KEY_STATS.highest_risk_sector}
                </p>
              </div>

              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white border-[1.5px] border-indigo-500 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-600 font-bold mb-3 md:mb-4">
                  <Target className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">
                    Top Skill Demand
                  </span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                  {executiveSummary?.summary_key_stats?.top_skill_demand ||
                    FALLBACK_KEY_STATS.top_skill_demand}
                </p>
              </div>

              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white border-[1.5px] border-lime-500 shadow-sm">
                <div className="flex items-center gap-2 text-lime-600 font-bold mb-3 md:mb-4">
                  <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">
                    Pivot Necessity
                  </span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                  {executiveSummary?.summary_key_stats?.pivot_necessity ||
                    FALLBACK_KEY_STATS.pivot_necessity}
                </p>
              </div>
            </div>
          </div>
        );
      case "2":
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-sky-50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-sky-100">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <BarChart2 className="w-6 h-6 md:w-8 md:h-8 text-sky-600" />
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                  Labour Market Snapshot
                </h2>
              </div>
              <p className="text-slate-500 font-medium text-sm md:text-base">
                Current state of the job market in {location}
              </p>
            </div>

            <div className="space-y-6 md:space-y-8 text-base md:text-lg text-slate-700 leading-relaxed">
              {labourMarketSnapshot?.overview ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: labourMarketSnapshot.overview
                      .split("\n\n")
                      .map((p: string) => `<p>${p}</p>`)
                      .join(""),
                  }}
                />
              ) : (
                <p className="text-slate-500 italic">
                  {FALLBACK_LABOUR_MARKET_OVERVIEW}
                </p>
              )}
            </div>

            <div>
              <p className="font-bold text-slate-900 mb-4 md:mb-6 text-sm md:text-base">
                Major Market Drivers:
              </p>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {((labourMarketSnapshot?.major_drivers || FALLBACK_MAJOR_DRIVERS) as string[]).map((tag, i) => (
                  <div
                    key={i}
                    className="px-4 py-2 md:px-5 md:py-3 bg-white border border-slate-200 rounded-lg md:rounded-[1rem] text-xs md:text-sm font-bold uppercase text-slate-700 transition-all cursor-default"
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2.5rem] text-center border-[1.5px] border-emerald-500 bg-transparent">
                <p className="text-slate-900 text-[10px] md:text-xs font-bold uppercase mb-2">
                  Employment Rate
                </p>
                <p className="text-xl md:text-2xl font-extrabold text-emerald-600">
                  {labourMarketSnapshot?.market_health?.employment_rate ||
                    FALLBACK_MARKET_HEALTH.employment_rate}
                </p>
              </div>
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2.5rem] text-center border-[1.5px] border-rose-500 bg-transparent">
                <p className="text-slate-900 text-[10px] md:text-xs font-bold uppercase mb-2">
                  Job Growth Rate
                </p>
                <p className="text-xl md:text-2xl font-extrabold text-rose-600">
                  {labourMarketSnapshot?.market_health?.job_growth_rate ||
                    FALLBACK_MARKET_HEALTH.job_growth_rate}
                </p>
              </div>
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2.5rem] text-center border-[1.5px] border-indigo-500 bg-transparent">
                <p className="text-slate-900 text-[10px] md:text-xs font-bold uppercase mb-2">
                  Overall Trend
                </p>
                <p className="text-xl md:text-2xl font-extrabold text-indigo-600">
                  {labourMarketSnapshot?.market_health?.trend ||
                    FALLBACK_MARKET_HEALTH.trend}
                </p>
              </div>
            </div>
          </div>
        );
      case "3":
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-amber-50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-amber-100">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <MapPin className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                  {location} vs Broader Region
                </h2>
              </div>
              <p className="text-slate-500 font-medium text-sm md:text-base">
                How your city compares to the wider region
              </p>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 sm:overflow-visible">
              <div className="min-w-[640px] overflow-hidden bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] md:text-sm font-bold text-slate-900">
                        Factor
                      </th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] md:text-sm font-bold text-amber-600">
                        {location}
                      </th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] md:text-sm font-bold text-amber-600">
                        Wider Region
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {((cityVsRegionComparison?.data || FALLBACK_CITY_VS_REGION) as Array<{
                      factor?: string;
                      f?: string;
                      city?: string;
                      l?: string;
                      wider_region?: string;
                      w?: string;
                    }>).map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-4 md:px-8 md:py-6 font-bold text-slate-900 w-[25%] text-xs md:text-base">
                          {row.factor || row.f}
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 text-slate-700 leading-relaxed text-xs md:text-lg w-[37.5%]">
                          {row.city || row.l}
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 text-slate-700 leading-relaxed text-xs md:text-lg w-[37.5%]">
                          {row.wider_region || row.w}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Conditionally render loading UI or full content (after all hooks)
  // Treat "success" as complete; idle also shows the full view.
  const hasAnySectionStarted =
    sections.marketReport.status !== "idle" ||
    sections.industryTrends.status !== "idle" ||
    sections.newsAndCareerIntel.status !== "idle";

  const showContent =
    generateStatus === "success" ||
    generateStatus === "idle" ||
    hasAnySectionStarted;

  return !showContent ? (
    <LoadingUI />
  ) : (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <style>{`
        @keyframes marquee-scroll-infinite {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333333%); }
        }
        .animate-marquee-cards {
          display: flex;
          width: max-content;
          animation: marquee-scroll-infinite 60s linear infinite;
        }
        /* Pause animation on hover to allow manual scrolling */
        .group-marquee:hover .animate-marquee-cards {
          animation-play-state: paused;
        }
        .group-hover-marquee {
          display: inline-flex;
          white-space: nowrap;
        }
        @keyframes sub-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .group\\/desc:hover .group-hover-marquee,
        .group\\/author:hover .group-hover-marquee {
          animation: sub-marquee 8s linear infinite;
        }
        .graffiti-pattern {
          background-color: #ffffff;
          background-image: 
            radial-gradient(at 10% 10%, #f1f4ff 0, transparent 30%),
            radial-gradient(at 90% 90%, #f8faff 0, transparent 30%),
            url("data:image/svg+xml,%3Csvg width='600' height='600' viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50,150 Q150,100 250,150 T450,150' fill='none' stroke='%236366f1' stroke-width='0.4' stroke-opacity='0.05'/%3E%3Ccircle cx='500' cy='120' r='2' fill='%236366f1' fill-opacity='0.04'/%3E%3Cpath d='M550,450 Q580,480 540,510' fill='none' stroke='%236366f1' stroke-width='1' stroke-opacity='0.03'/%3E%3Crect x='100' y='500' width='8' height='8' rx='2' fill='%236366f1' fill-opacity='0.02' transform='rotate(30 104 504)'/%3E%3Cpath d='M400,50 L420,50 M410,40 L410,60' stroke='%236366f1' stroke-width='0.4' stroke-opacity='0.04'/%3E%3C/svg%3E");
          background-size: cover;
        }
        .dark .graffiti-pattern {
          background-color: #0c0e17;
          background-image: 
            radial-gradient(at 10% 10%, #1a1c2e 0, transparent 30%),
            url("data:image/svg+xml,%3Csvg width='600' height='600' viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50,150 Q150,100 250,150 T450,150' fill='none' stroke='%23818cf8' stroke-width='0.4' stroke-opacity='0.08'/%3E%3Ccircle cx='500' cy='120' r='2' fill='%23818cf8' fill-opacity='0.06'/%3E%3Cpath d='M550,450 Q580,480 540,510' fill='none' stroke='%23818cf8' stroke-width='1' stroke-opacity='0.05'/%3E%3C/svg%3E");
        }
      `}</style>

      {!selectedNewsId && !selectedTrendId && (
        <section className="bg-gradient-to-br from-indigo-500 via-indigo-700 to-slate-900 border border-indigo-400/30 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden group lg:h-[160px] flex flex-col justify-center mb-12 shadow-xl shadow-indigo-900/10 transition-all duration-500">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-4xl font-extrabold mb-1 flex items-center gap-3 tracking-tight text-white">
                Welcome back, {user.name.split(" ")[0]}! 👋
              </h1>
              <p className="text-indigo-50 text-base md:text-lg font-medium tracking-tight opacity-90">
                Here's what's happening in your industry today
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-white/20 flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-sm text-white">
                <Briefcase className="w-3 h-3 md:w-4 md:h-4 text-indigo-100" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  {user.role}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-white/20 flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-sm text-white">
                <GraduationCap className="w-3 h-3 md:w-4 md:h-4 text-indigo-100" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  {user.experience.replace(/\s*\([^)]*\)\s*/g, "").trim()}
                </span>
              </div>
            </div>
          </div>
          {/* Decorative background circle */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover:scale-125 transition-all duration-1000" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-16 -mb-16" />
        </section>
      )}

      <div className="space-y-12 md:space-y-16">
        {/* Market Report Section */}
        <section
          ref={newsSectionRef}
          className="relative transition-all duration-500 scroll-mt-24"
        >
          <SectionWrapper
            status={sections.marketReport.status}
            error={sections.marketReport.error}
            onRetry={() => retrySection("marketReport")}
            minHeight="min-h-[400px]"
            loadingText="Loading market intelligence report..."
          >
            {!selectedNewsId ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-6 md:mb-8 px-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 flex-shrink-0" />
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                      Market Report
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mobile navigation arrows */}
                    <div className="flex items-center gap-1 md:hidden">
                      <button
                        onClick={goToPrevCard}
                        disabled={currentNewsIndex === 0}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 transition-all touch-manipulation"
                        aria-label="Previous card"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={goToNextCard}
                        disabled={currentNewsIndex >= totalNewsCards - 1}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 transition-all touch-manipulation"
                        aria-label="Next card"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Desktop indicator */}
                    <div className="hidden md:block text-indigo-600 flex-shrink-0">
                      <ChevronsRight className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                    </div>
                  </div>
                </div>

                <div
                  ref={newsScrollRef}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  className="flex overflow-x-auto gap-4 md:gap-6 pb-6 px-2 hide-scrollbar snap-x snap-mandatory md:snap-none"
                >
                  {MOCK_NEWS.map((article) => (
                    <div
                      key={article.id}
                      className="min-w-full md:min-w-[45%] lg:min-w-[calc(33.333%-1rem)] snap-start"
                    >
                      <NewsCard
                        article={article}
                        onClick={() => setSelectedNewsId(article.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <button
                  onClick={closeNewsDetail}
                  className="flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:gap-3 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" /> Back to Market Report
                </button>
                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 p-6 md:p-8 lg:p-12 shadow-sm ring-1 ring-slate-200/50">
                  {renderArticleContent(
                    selectedNewsId,
                    user.location,
                    user.country,
                  )}
                </div>
              </div>
            )}
          </SectionWrapper>
        </section>

        {/* Industry Growth and Decline Trends Section */}
        <section
          ref={trendsSectionRef}
          className="relative transition-all duration-500 scroll-mt-24"
        >
          <SectionWrapper
            status={sections.industryTrends.status}
            error={sections.industryTrends.error}
            onRetry={() => retrySection("industryTrends")}
            minHeight="min-h-[400px]"
            loadingText="Analyzing industry trends & sectors..."
          >
            {!selectedTrendId ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-6 md:mb-8 px-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 flex-shrink-0" />
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 line-clamp-2 sm:line-clamp-1">
                      Industry Growth and Decline Trends
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mobile navigation arrows */}
                    <div className="flex items-center gap-1 md:hidden">
                      <button
                        onClick={goToPrevTrend}
                        disabled={currentTrendIndex === 0}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 transition-all touch-manipulation"
                        aria-label="Previous trend"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={goToNextTrend}
                        disabled={currentTrendIndex >= totalTrendCards - 1}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 transition-all touch-manipulation"
                        aria-label="Next trend"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Desktop indicator */}
                    <div className="hidden md:block text-indigo-600 flex-shrink-0">
                      <ChevronsRight className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                    </div>
                  </div>
                </div>

                <div
                  ref={trendsScrollRef}
                  onTouchStart={onTrendTouchStart}
                  onTouchMove={onTrendTouchMove}
                  onTouchEnd={onTrendTouchEnd}
                  className="flex overflow-x-auto gap-4 md:gap-6 pb-6 px-2 hide-scrollbar snap-x snap-mandatory md:snap-none"
                >
                  {TREND_REPORTS.map((report) => (
                    <div
                      key={report.id}
                      className="min-w-full md:min-w-[45%] lg:min-w-[calc(33.333%-1rem)] snap-start"
                    >
                      <TrendCard
                        report={report}
                        onClick={() => setSelectedTrendId(report.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <button
                  onClick={closeTrendDetail}
                  className="flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:gap-3 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" /> Back to Industry Trends
                </button>
                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 p-6 md:p-8 lg:p-12 shadow-sm ring-1 ring-slate-200/50 min-h-[400px] md:min-h-[500px]">
                  {renderTrendDetail(selectedTrendId, user.location)}
                </div>
              </div>
            )}
          </SectionWrapper>
        </section>

        {/* Recent Market News Section */}
        {!selectedNewsId && !selectedTrendId && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <SectionWrapper
              status={sections.newsAndCareerIntel.status}
              error={sections.newsAndCareerIntel.error}
              onRetry={() => retrySection("newsAndCareerIntel")}
              minHeight="min-h-[300px]"
              loadingText="Fetching latest market news & insights..."
            >
              {/* Title Section with GREEN PULSE */}
              <div className="mb-6 md:mb-8 px-2 flex items-center gap-3">
                <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 flex-shrink-0" />
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Recent Market News
                </h2>
                <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </div>
              </div>

              {/* Unified White Background Card Container with Graffiti Pattern - 1rem BORDER RADIUS */}
              <div className="relative graffiti-pattern rounded-[1rem] p-4 sm:p-6 md:p-10 shadow-xl shadow-indigo-500/5 overflow-hidden group-marquee">
                {/* Manual scroll container - uses JS scroll hijacking to loop infinitely */}
                <div
                  ref={scrollContainerRef}
                  className="relative -mx-4 sm:-mx-6 md:-mx-10 overflow-x-auto py-4 hide-scrollbar transition-all duration-300 snap-none"
                >
                  <div className="animate-marquee-cards gap-4 sm:gap-6 md:gap-12">
                    {/* Triple buffer for absolute seamless infinite loop: Set A | Set A | Set A */}
                    {[...marketNews, ...marketNews, ...marketNews].map(
                      (news, index) => (
                        <RecentNewsCard
                          key={`${news.id}-${index}`}
                          news={news}
                          onClick={() => setSelectedMarketNews(news)}
                        />
                      ),
                    )}
                  </div>

                  {/* Horizontal Fade Overlays: ensure they are within the container and blend with the background */}
                  <div className="absolute inset-y-0 left-0 w-16 sm:w-24 md:w-32 bg-gradient-to-r from-[#ffffff] to-transparent pointer-events-none z-10" />
                  <div className="absolute inset-y-0 right-0 w-16 sm:w-24 md:w-32 bg-gradient-to-l from-[#ffffff] to-transparent pointer-events-none z-10" />
                </div>
              </div>
            </SectionWrapper>
          </section>
        )}
      </div>

      {selectedMarketNews && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedMarketNews(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 md:px-8 py-4 md:py-6 flex items-start justify-between gap-4 rounded-t-[2rem] z-10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest ${selectedMarketNews.sentiment === "Positive" ? "bg-emerald-50 text-emerald-600 border border-emerald-500/20" : selectedMarketNews.sentiment === "Negative" ? "bg-rose-50 text-rose-600 border border-rose-500/20" : "bg-slate-100 text-slate-600 border border-slate-300"}`}
                  >
                    {selectedMarketNews.sentiment}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedMarketNews.date}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                  {selectedMarketNews.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedMarketNews(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
              >
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 md:px-8 py-6 md:py-8 space-y-6">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Library className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-slate-700">
                    {selectedMarketNews.source}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-indigo-600" />
                  <span className="text-slate-600">
                    Relevance:{" "}
                    <span className="font-bold text-indigo-600">
                      {selectedMarketNews.relevance * 10}%
                    </span>
                  </span>
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <p className="text-lg leading-relaxed text-slate-700">
                  {selectedMarketNews.excerpt}
                </p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">
                      Career Impact
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      This news article has been analyzed and rated as highly
                      relevant to your career path. Consider how these market
                      trends might influence your strategic planning and skill
                      development.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketInsightView;
