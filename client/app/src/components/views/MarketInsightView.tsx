
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, NewsArticle, AppView, RecentNewsArticle } from '../../utils/types/types';
import { MOCK_NEWS, TREND_REPORTS, HIGH_GROWTH_DATA, AT_RISK_DATA, TOP_SKILLS_DATA, MARKET_RISKS_DATA, RECENT_NEWS_DATA } from '../../consts/constants';
import { Lightbulb, MapPin, ArrowRight, ChevronsRight, TrendingUp, AlertTriangle, Target, Zap, BarChart2, ArrowLeft, Rocket, Shield, RefreshCw, FileText, Activity, Briefcase, GraduationCap, Library, Calendar, Globe, Gauge, Star, Wrench } from 'lucide-react';

interface MarketInsightViewProps {
  user: UserProfile;
  onNavigate: (view: AppView) => void;
}

const MarketInsightView: React.FC<MarketInsightViewProps> = ({ user, onNavigate }) => {
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [currentTrendIndex, setCurrentTrendIndex] = useState(0);
  
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

  // Navigate to next/previous card on mobile
  const goToNextCard = () => {
    if (currentNewsIndex < totalNewsCards - 1 && newsScrollRef.current) {
      const newIndex = currentNewsIndex + 1;
      setCurrentNewsIndex(newIndex);
      // Find the target card element and scroll to it
      const cards = newsScrollRef.current.children;
      if (cards[newIndex]) {
        (cards[newIndex] as HTMLElement).scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
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
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
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
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
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
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
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
        const cards = Array.from(newsScrollRef.current.children) as HTMLElement[];
        
        // Find which card is most visible
        let newIndex = 0;
        let maxVisible = 0;
        
        cards.forEach((card, index) => {
          const cardLeft = card.offsetLeft;
          const cardWidth = card.offsetWidth;
          const visibleLeft = Math.max(0, scrollLeft - cardLeft);
          const visibleRight = Math.min(cardWidth, scrollLeft + containerWidth - cardLeft);
          const visible = Math.max(0, visibleRight - visibleLeft);
          
          if (visible > maxVisible) {
            maxVisible = visible;
            newIndex = index;
          }
        });
        
        if (newIndex !== currentNewsIndex && newIndex >= 0 && newIndex < totalNewsCards) {
          setCurrentNewsIndex(newIndex);
        }
      };
      
      const scrollContainer = newsScrollRef.current;
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [currentNewsIndex, totalNewsCards]);

  // Sync trends scroll position with current index on mobile
  useEffect(() => {
    if (trendsScrollRef.current && window.innerWidth < 768) {
      const handleScroll = () => {
        if (!trendsScrollRef.current) return;
        const scrollLeft = trendsScrollRef.current.scrollLeft;
        const containerWidth = trendsScrollRef.current.offsetWidth;
        const cards = Array.from(trendsScrollRef.current.children) as HTMLElement[];
        
        // Find which card is most visible
        let newIndex = 0;
        let maxVisible = 0;
        
        cards.forEach((card, index) => {
          const cardLeft = card.offsetLeft;
          const cardWidth = card.offsetWidth;
          const visibleLeft = Math.max(0, scrollLeft - cardLeft);
          const visibleRight = Math.min(cardWidth, scrollLeft + containerWidth - cardLeft);
          const visible = Math.max(0, visibleRight - visibleLeft);
          
          if (visible > maxVisible) {
            maxVisible = visible;
            newIndex = index;
          }
        });
        
        if (newIndex !== currentTrendIndex && newIndex >= 0 && newIndex < totalTrendCards) {
          setCurrentTrendIndex(newIndex);
        }
      };
      
      const scrollContainer = trendsScrollRef.current;
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [currentTrendIndex, totalTrendCards]);

  // Scroll to the respective section when a detail is opened
  useEffect(() => {
    if (selectedNewsId && newsSectionRef.current) {
      newsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedNewsId]);

  useEffect(() => {
    if (selectedTrendId && trendsSectionRef.current) {
      setTimeout(() => {
        trendsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [selectedNewsId, selectedTrendId]);

  const closeNewsDetail = () => setSelectedNewsId(null);
  const closeTrendDetail = () => setSelectedTrendId(null);

  const renderTrendDetail = (id: string, location: string) => {
    switch (id) {
      case 'high-growth':
        return (
          <div className="space-y-10">
            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/50">
              <div className="flex items-center gap-3 mb-2">
                <Rocket className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">10 High-Growth Sectors & Roles</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Industries with strong hiring momentum in {location}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {HIGH_GROWTH_DATA.map((item, idx) => (
                <div key={idx} className="bg-slate-50/50 dark:bg-[#0a0a0a] border-[1.5px] border-emerald-500 dark:border-emerald-500/50 rounded-[2.5rem] p-8 flex flex-col h-full shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{item.title}</h3>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed text-base">{item.description}</p>
                  <div className="mt-auto space-y-6">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest mb-2">Example Roles:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.roles.map((role, rIdx) => (
                          <span key={rIdx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">{role}</span>
                        ))}
                      </div>
                    </div>
                    <InsightBox text={item.realityCheck} compact={true} forceBaseSize={true} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'at-risk':
        return (
          <div className="space-y-10">
            <div className="bg-rose-50/50 dark:bg-rose-950/10 p-8 rounded-3xl border border-rose-100 dark:border-rose-900/50">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">10 At-Risk Role Clusters & Pivot Paths</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Understanding automation, structural shifts, and strategic pivot paths</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {AT_RISK_DATA.map((item, idx) => (
                <div key={idx} className="bg-white dark:bg-[#0a0a0a] border-[1.5px] border-rose-500 dark:border-rose-500/50 rounded-[2.5rem] p-8 flex flex-col h-full shadow-md">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                  <div className="mb-6">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest mb-1">Automation / Shift:</p>
                    <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">{item.shift}</p>
                  </div>
                  
                  <div className="mt-auto space-y-6">
                     <PivotBox text={item.pivot} forceBaseSize={true} compact={true} />
                     <InsightBox text={item.realityCheck} forceBaseSize={true} compact={true} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'top-skills':
        return (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-4 mb-2">
                <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Top Skills Demand in 2025</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Skills positioned by market maturity and growth velocity</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {TOP_SKILLS_DATA.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div key={idx} className={`border-[1.5px] rounded-[2.5rem] p-8 ${item.color} relative overflow-hidden group bg-transparent`}>
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center gap-4 mb-8">
                        <div className={`${item.iconColor} text-white p-3 rounded-2xl shadow-lg`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{item.category}</h3>
                          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">{item.categoryDescription}</p>
                        </div>
                      </div>

                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{item.title}</h4>
                          <span className={`px-4 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${item.badge}`}>{item.level}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6 font-medium">{item.description}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                          {item.skills.map((s, sIdx) => (
                            <span key={sIdx} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all hover:border-indigo-400/50">{s}</span>
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium italic text-xs">
                           <TrendingUp className="w-3.5 h-3.5" />
                          <span>{item.note}</span>
                        </div>
                      </div>
                      
                      <div className="mt-auto">
                        <InsightBox text={item.insights} compact={true} forceBaseSize={true} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'market-risks':
        return (
          <div className="space-y-10">
            <div className="bg-amber-50/50 dark:bg-amber-950/10 p-8 rounded-3xl border border-amber-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Market Risks & Challenges</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Potential challenges and mitigation strategies for your career path</p>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[640px] overflow-hidden bg-white dark:bg-[#0a0a0a] rounded-[1.5rem] md:rounded-[2.5rem] border-[1.5px] border-amber-500 dark:border-amber-500/50 shadow-md">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 dark:text-white tracking-widest whitespace-nowrap">Severity</th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 dark:text-white tracking-widest whitespace-nowrap">Risk</th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 dark:text-white tracking-widest whitespace-nowrap">Sectors</th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] font-extrabold uppercase text-slate-900 dark:text-white tracking-widest whitespace-nowrap">Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {MARKET_RISKS_DATA.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-4 md:px-8 md:py-6 w-[15%]">
                          <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[10px] font-extrabold uppercase border ${
                            row.severity === 'High' ? 'border-rose-500/30 text-rose-600 bg-rose-50 dark:bg-rose-950/20' : 
                            row.severity === 'Medium' ? 'border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-950/20' : 
                            'border-indigo-500/30 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20'
                          }`}>
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 font-bold text-slate-900 dark:text-white text-base md:text-lg w-[20%] min-w-[140px]">{row.risk}</td>
                        <td className="px-4 py-4 md:px-8 md:py-6 w-[20%]">
                          <div className="flex flex-wrap gap-1.5 md:gap-2">
                            {row.sectors.map((s, sIdx) => (
                              <span key={sIdx} className="px-2 py-1 md:px-3 md:py-1.5 bg-white dark:bg-[#111] border-0 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-all cursor-default">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 md:px-8 md:py-6 text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-lg w-[45%] min-w-[180px]">{row.strategy}</td>
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

  const renderArticleContent = (id: string, location: string, country: string) => {
    switch (id) {
      case '1':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <MapPin className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">Market Intelligence Report</h2>
              </div>
              <p className="text-indigo-900 dark:text-indigo-300 font-bold mb-1 text-sm md:text-base">{location}, {country}</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">Your personalized career intelligence based on real labor market data</p>
            </div>

            <div>
              <h3 className="text-lg md:text-xl font-bold text-black dark:text-indigo-400 mb-4 md:mb-6">Market News Summary (Based on the Last 2 Months)</h3>
              <div className="space-y-4 md:space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed text-base md:text-lg">
                <p>Over the next 3–10 years, {location} and the Bay Area will stay a global jobs hotspot, but the centre of gravity is shifting. The region is still the core hub for AI engineering and advanced tech roles, even after several waves of layoffs. Reports show a massive increase in demand for AI engineers, with the Bay Area as the "center of gravity" for those jobs, even as traditional software roles grow more slowly.</p>
                <p>At the same time, the Bay Area has seen repeated rounds of tech layoffs in 2024–2025, with thousands of jobs cut as big firms restructure around AI and cost savings. This means mid-level, routine-heavy tech, admin, and customer support roles are under real pressure, while specialised AI, product, data, security, climate-tech, and health-related jobs are gaining ground.</p>
                <p>For job seekers, the key truth is: the problem is often not you, it's the market. Some roles in the Bay Area are shrinking or being automated. That means you need a strategic pivot, not just a "better CV." At the same time, there are fast-growing paths in AI & data, green/clean energy, climate and sustainability, digital health, and public-interest tech, where your skills can be repurposed with targeted learning.</p>
                <p>Your goal is to treat the {location} job market like a chess board, not a slot machine: understand which squares are shrinking, which ones are opening up, and build a 3–6 month plan to stop certain behaviours, start future-proof ones, and double down on your real strengths.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white dark:bg-[#0a0a0a] border-[1.5px] border-emerald-500 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold mb-3 md:mb-4">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Strongest Opportunity</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-tight">AI & Machine Learning Roles - Driven by tech sector growth and startup expansions in {location}.</p>
              </div>
              
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white dark:bg-[#0a0a0a] border-[1.5px] border-rose-500 shadow-sm">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold mb-3 md:mb-4">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Highest Risk Sector</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-tight">Trade-Dependent Industries - Impacted by international trade policies on local industries.</p>
              </div>
              
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white dark:bg-[#0a0a0a] border-[1.5px] border-indigo-500 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-3 md:mb-4">
                  <Target className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Top Skill Demand</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-tight">AI & Machine Learning expertise</p>
              </div>
              
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2rem] bg-white dark:bg-[#0a0a0a] border-[1.5px] border-lime-500 shadow-sm">
                <div className="flex items-center gap-2 text-lime-600 dark:text-lime-400 font-bold mb-3 md:mb-4">
                  <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="uppercase tracking-widest text-[10px] md:text-xs">Pivot Necessity</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-tight">Moderate</p>
              </div>
            </div>
          </div>
        );
      case '2':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-sky-50 dark:bg-sky-950/20 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-sky-100 dark:border-sky-900/50">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <BarChart2 className="w-6 h-6 md:w-8 md:h-8 text-sky-600 dark:text-sky-400" />
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">Labour Market Snapshot</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">Current state of the job market in {location}</p>
            </div>
            
            <div className="space-y-6 md:space-y-8 text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>The employment rate for software publishers in {location} showed a slight decline from 409.9 in June 2025 to 401.1 in August 2025 (BLS Employment Data). This trend reflects broader market adjustments, with tech roles continuing to be a significant part of the employment landscape. Nationally, similar trends in tech employment suggest a stabilization rather than marked growth.</p>
              <p>Comparatively, {location} remains a competitive market, especially for tech professionals, despite national cooling trends. The city's focus on innovation and high-tech industries continues to drive demand for skilled workers, although the overall market health shows signs of slowing growth.</p>
            </div>
            
            <InsightBox text="San Francisco's tech-driven market remains more resilient compared to national averages, which are experiencing broader contractions in various sectors. The local emphasis on AI and tech innovation offers a buffer against national economic pressures." />
            
            <div>
              <p className="font-bold text-slate-900 dark:text-white mb-4 md:mb-6 text-sm md:text-base">Major Market Drivers:</p>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {[
                  "AI startup expansion in San Francisco",
                  "High cost of living and competitive hiring benefits",
                  "Impact of international trade policies on local industries",
                  "Shift from talent hoarding to selective hiring",
                  "Increasing focus on remote and hybrid work models"
                ].map((tag, i) => (
                  <div 
                    key={i} 
                    className="px-4 py-2 md:px-5 md:py-3 bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-lg md:rounded-[1rem] text-xs md:text-sm font-bold uppercase text-slate-700 dark:text-slate-300 transition-all cursor-default"
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2.5rem] text-center border-[1.5px] border-emerald-500 bg-transparent">
                <p className="text-slate-900 dark:text-white text-[10px] md:text-xs font-bold uppercase mb-2">Employment Rate</p>
                <p className="text-xl md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">4.1% to 4.3% (mid-2025)</p>
              </div>
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2.5rem] text-center border-[1.5px] border-rose-500 bg-transparent">
                <p className="text-slate-900 dark:text-white text-[10px] md:text-xs font-bold uppercase mb-2">Job Growth Rate</p>
                <p className="text-xl md:text-2xl font-extrabold text-rose-600 dark:text-rose-400">Declining</p>
              </div>
              <div className="p-6 md:p-8 rounded-xl md:rounded-[2.5rem] text-center border-[1.5px] border-indigo-500 bg-transparent">
                <p className="text-slate-900 dark:text-white text-[10px] md:text-xs font-bold uppercase mb-2">Overall Trend</p>
                <p className="text-xl md:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">Stable</p>
              </div>
            </div>
          </div>
        );
      case '3':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-amber-50 dark:bg-amber-950/20 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-amber-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <MapPin className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">{location} vs Broader Region</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">How your city compares to the wider region</p>
            </div>
            
            <div className="overflow-x-auto -mx-4 sm:mx-0 sm:overflow-visible">
              <div className="min-w-[640px] overflow-hidden bg-white dark:bg-slate-900/50 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] md:text-sm font-bold text-slate-900 dark:text-white">Factor</th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] md:text-sm font-bold text-amber-600 dark:text-amber-400">{location}</th>
                      <th className="px-4 py-4 md:px-8 md:py-5 text-[10px] md:text-sm font-bold text-amber-600 dark:text-amber-400">Wider Region</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { 
                        f: "Overall job market trend", 
                        l: "High-skill, high-volatility – strong demand in AI, frontier tech, finance, product, design; repeated restructuring in big tech and startups.", 
                        w: "Mixed but resilient – strong in healthcare, education, logistics, clean energy, advanced manufacturing and public services, with tech distributed across the region." 
                      },
                      { 
                        f: "Remote / hybrid work trend", 
                        l: "Prevalent in tech and startups; hybrid arrangements are common to attract talent.", 
                        w: "Varies by industry; manufacturing and logistics are more on-site, while tech and services offer hybrid options." 
                      },
                      { 
                        f: "Notable structural shifts", 
                        l: "AI startups leasing luxury apartments and offering benefits to attract talent (News 3, News 4).", 
                        w: "Less reliant on such incentives; broader range of sectors not as tech-centric." 
                      },
                      { 
                        f: "Cost of living / compensation", 
                        l: "High cost of living offset by competitive tech salaries and benefits.", 
                        w: "Lower cost of living with salaries adjusted accordingly; less pressure on housing costs." 
                      },
                      { 
                        f: "Industry distribution", 
                        l: "Dominated by tech, finance, and innovative sectors.", 
                        w: `Diverse with ${location} holding strong presence in healthcare, education, and manufacturing.` 
                      }
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-4 md:px-8 md:py-6 font-bold text-slate-900 dark:text-white w-[25%] text-xs md:text-base">{row.f}</td>
                        <td className="px-4 py-4 md:px-8 md:py-6 text-slate-700 dark:text-slate-300 leading-relaxed text-xs md:text-lg w-[37.5%]">{row.l}</td>
                        <td className="px-4 py-4 md:px-8 md:py-6 text-slate-700 dark:text-slate-300 leading-relaxed text-xs md:text-lg w-[37.5%]">{row.w}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <InsightBox text="Understanding these regional differences helps you position yourself strategically. Your city may have different opportunities, compensation levels, and work arrangements than the broader region." />
          </div>
        );
      default:
        return null;
    }
  };

  return (
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
                Welcome back, {user.name.split(' ')[0]}! 👋
              </h1>
              <p className="text-indigo-50 text-base md:text-lg font-medium tracking-tight opacity-90">Here's what's happening in your industry today</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-white/20 flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-sm text-white">
                <Briefcase className="w-3 h-3 md:w-4 md:h-4 text-indigo-100" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{user.role}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl border border-white/20 flex items-center gap-2 md:gap-3 transition-transform hover:scale-105 shadow-sm text-white">
                <GraduationCap className="w-3 h-3 md:w-4 md:h-4 text-indigo-100" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{user.experience.replace(/\s*\([^)]*\)\s*/g, '').trim()}</span>
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
        <section ref={newsSectionRef} className="relative transition-all duration-500 scroll-mt-24">
          {!selectedNewsId ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between mb-6 md:mb-8 px-2">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">Market Report</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Mobile navigation arrows */}
                  <div className="flex items-center gap-1 md:hidden">
                    <button
                      onClick={goToPrevCard}
                      disabled={currentNewsIndex === 0}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all touch-manipulation"
                      aria-label="Previous card"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToNextCard}
                      disabled={currentNewsIndex >= totalNewsCards - 1}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all touch-manipulation"
                      aria-label="Next card"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Desktop indicator */}
                  <div className="hidden md:block text-indigo-600 dark:text-indigo-400 flex-shrink-0">
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
                {MOCK_NEWS.map((article, index) => (
                  <div 
                    key={article.id} 
                    className="min-w-full md:min-w-[45%] lg:min-w-[calc(33.333%-1rem)] snap-start"
                  >
                    <NewsCard article={article} onClick={() => setSelectedNewsId(article.id)} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <button onClick={closeNewsDetail} className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-8 hover:gap-3 transition-all">
                <ArrowLeft className="w-5 h-5" /> Back to Market Report
              </button>
              <div className="bg-white dark:bg-[#111] rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 lg:p-12 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50">
                {renderArticleContent(selectedNewsId, user.location, user.country)}
              </div>
            </div>
          )}
        </section>

        {/* Industry Growth and Decline Trends Section */}
        <section ref={trendsSectionRef} className="relative transition-all duration-500 scroll-mt-24">
          {!selectedTrendId ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between mb-6 md:mb-8 px-2">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white line-clamp-2 sm:line-clamp-1">Industry Growth and Decline Trends</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Mobile navigation arrows */}
                  <div className="flex items-center gap-1 md:hidden">
                    <button
                      onClick={goToPrevTrend}
                      disabled={currentTrendIndex === 0}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all touch-manipulation"
                      aria-label="Previous trend"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToNextTrend}
                      disabled={currentTrendIndex >= totalTrendCards - 1}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all touch-manipulation"
                      aria-label="Next trend"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Desktop indicator */}
                  <div className="hidden md:block text-indigo-600 dark:text-indigo-400 flex-shrink-0">
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
                {TREND_REPORTS.map(report => (
                  <div key={report.id} className="min-w-full md:min-w-[45%] lg:min-w-[calc(33.333%-1rem)] snap-start">
                    <TrendCard report={report} onClick={() => setSelectedTrendId(report.id)} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <button onClick={closeTrendDetail} className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-8 hover:gap-3 transition-all">
                <ArrowLeft className="w-5 h-5" /> Back to Industry Trends
              </button>
              <div className="bg-white dark:bg-[#111] rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 lg:p-12 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50 min-h-[400px] md:min-h-[500px]">
                {renderTrendDetail(selectedTrendId, user.location)}
              </div>
            </div>
          )}
        </section>

        {/* Recent Market News Section */}
        {!selectedNewsId && !selectedTrendId && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            {/* Title Section with GREEN PULSE */}
            <div className="mb-6 md:mb-8 px-2 flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Recent Market News</h2>
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
                  {[...RECENT_NEWS_DATA, ...RECENT_NEWS_DATA, ...RECENT_NEWS_DATA].map((news, index) => (
                    <RecentNewsCard key={`${news.id}-${index}`} news={news} />
                  ))}
                </div>
                
                {/* Horizontal Fade Overlays: ensure they are within the container and blend with the background */}
                <div className="absolute inset-y-0 left-0 w-16 sm:w-24 md:w-32 bg-gradient-to-r from-[#ffffff] dark:from-[#0c0e17] to-transparent pointer-events-none z-10" />
                <div className="absolute inset-y-0 right-0 w-16 sm:w-24 md:w-32 bg-gradient-to-l from-[#ffffff] dark:from-[#0c0e17] to-transparent pointer-events-none z-10" />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const RecentNewsCard: React.FC<{ news: RecentNewsArticle }> = ({ news }) => {
  return (
    <div className="min-w-[280px] w-[85vw] sm:min-w-[360px] sm:w-[400px] md:w-[480px] lg:w-[540px] flex-shrink-0 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-sm border border-indigo-600/50 dark:border-indigo-400/50 rounded-[1.5rem] p-6 md:p-8 transition-all duration-300 hover:bg-white dark:hover:bg-[#222] hover:scale-[1.02] shadow-none">
      {/* 1PX INDIGO BORDER, BOX SHADOWS REMOVED */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 md:mb-6">
        <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white leading-tight flex-1 min-w-0">
          {news.title}
        </h3>
        <span className={`px-3 py-1.5 rounded-xl md:rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex-shrink-0 w-fit ${
          news.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20' :
          news.sentiment === 'Negative' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-500/20' :
          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
        }`}>
          {news.sentiment}
        </span>
      </div>

      <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base lg:text-lg leading-relaxed mb-6 md:mb-8 line-clamp-2 font-medium">
        {news.excerpt}
      </p>

      {/* CONSOLIDATED FOOTER: REPLACED LIVE WEB WITH RELEVANCE METER */}
      <div className="pt-4 md:pt-6 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{news.date}</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[120px] sm:max-w-none">{news.source}</span>
          </div>
        </div>

        {/* UPDATED RELEVANCE METER: GAUGE ICON ON THE LEFT */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg sm:rounded-xl border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 shadow-sm flex-shrink-0">
            <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap">Relevance</span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 flex-shrink-0">{news.relevance * 10}%</span>
            </div>
            <div className="h-1.5 w-24 sm:w-32 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-700/40">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                style={{ width: `${news.relevance * 10}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TrendCard: React.FC<{ report: any; onClick: () => void }> = ({ report, onClick }) => {
  const getIcon = () => {
    switch (report.id) {
      case 'high-growth': return <Rocket className="w-5 h-5" />;
      case 'at-risk': return <AlertTriangle className="w-5 h-5" />;
      case 'market-risks': return <Shield className="w-5 h-5" />;
      case 'top-skills': return <Zap className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getAccentColor = () => {
    switch (report.id) {
      case 'high-growth': return 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
      case 'at-risk': return 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/20';
      case 'market-risks': return 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20';
      case 'top-skills': return 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20';
      default: return 'border-slate-500 text-slate-600 bg-slate-50 dark:bg-slate-950/20';
    }
  };

  const authorName = "CareerCompass AI";
  const isLongAuthor = authorName.length > 24;

  return (
    <div 
      onClick={onClick}
      className="h-full group bg-white dark:bg-[#0f0f0f] rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800/50 transition-all duration-500 flex flex-col cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 active:scale-[0.98] relative"
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${report.color}`} />
      
      <div className="p-8 flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all duration-700 pointer-events-none">
          <Activity className="w-64 h-64" />
        </div>

        <div className="flex justify-between items-start mb-8 relative z-10">
          <div className={`p-3 rounded-2xl ${getAccentColor()} shadow-sm`}>
            {getIcon()}
          </div>
        </div>

        <div className="mb-6 relative z-10">
          <h3 className="font-extrabold text-xl md:text-2xl mb-4 leading-tight group-hover:text-indigo-600 transition-colors text-slate-900 dark:text-white">
            {report.title}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-3">
            {report.excerpt}
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 gap-4 relative z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>
            
            <div className={`flex flex-col min-w-0 max-w-[75%] ${isLongAuthor ? 'group/author relative overflow-hidden bg-slate-50/50 dark:bg-white/5 rounded-lg h-5 flex flex-col justify-center' : ''}`}>
              {isLongAuthor ? (
                <div className="group-hover-marquee flex items-center">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {authorName}
                  </span>
                  <span className="w-8 shrink-0 hidden group-hover/author:inline-block" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap hidden group-hover/author:block">
                    {authorName}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate text-ellipsis">
                  {authorName}
                </span>
              )}
              {isLongAuthor && (
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-[#111] via-white/50 dark:via-[#111]/50 to-transparent pointer-events-none z-10" />
              )}
            </div>
          </div>
          <button className="flex-shrink-0 text-indigo-600 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12 border border-indigo-100 dark:border-indigo-900/50">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const InsightBox: React.FC<{ text: string; compact?: boolean; forceBaseSize?: boolean }> = ({ text, compact = false, forceBaseSize = false }) => (
  <div className={`bg-amber-50/50 dark:bg-amber-950/15 rounded-[1.5rem] md:rounded-[2rem] flex gap-3 md:gap-4 animate-in fade-in slide-in-from-left-2 duration-300 border border-amber-400/60 dark:border-amber-400/50 shadow-sm ${compact && !forceBaseSize ? 'p-4 md:p-5 lg:p-6' : 'p-5 md:p-6 lg:p-8'}`}>
    <div className="pt-1">
      <Lightbulb className={`${compact && !forceBaseSize ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} text-amber-600 dark:text-amber-400 flex-shrink-0`} />
    </div>
    <div>
      <p className={`text-slate-700 dark:text-slate-300 leading-relaxed italic ${
        forceBaseSize 
          ? 'text-sm md:text-base' 
          : compact 
            ? 'text-xs md:text-sm' 
            : 'text-base md:text-lg'
      }`}>
        <span className="font-bold text-slate-900 dark:text-white not-italic">Insights:</span> {text}
      </p>
    </div>
  </div>
);

const PivotBox: React.FC<{ text: string; compact?: boolean; forceBaseSize?: boolean }> = ({ text, compact = false, forceBaseSize = false }) => (
  <div className={`bg-lime-50/50 dark:bg-lime-950/15 rounded-[2rem] flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300 border border-lime-400/60 dark:border-lime-400/50 shadow-sm ${compact && !forceBaseSize ? 'p-5 md:p-6' : 'p-6 md:p-8'}`}>
    <div className="pt-1">
      <RefreshCw className={`${compact && !forceBaseSize ? 'w-4 h-4' : 'w-6 h-6'} text-lime-600 dark:text-lime-400 flex-shrink-0`} />
    </div>
    <div>
      <p className={`text-slate-700 dark:text-slate-300 leading-relaxed ${forceBaseSize ? 'text-base' : compact ? 'text-sm' : 'text-lg'}`}>
        <span className="font-bold text-slate-900 dark:text-white">Pivot Direction:</span> {text}
      </p>
    </div>
  </div>
);

const NewsCard: React.FC<{ article: NewsArticle; onClick: () => void }> = ({ article, onClick }) => {
  const isLongAuthor = article.author.length > 24;

  return (
    <div 
      onClick={onClick}
      className="h-full group bg-white dark:bg-[#111] rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-500 flex flex-col cursor-pointer hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 active:scale-[0.98]"
    >
      <div className="aspect-[1.8/1] overflow-hidden relative">
        <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute top-4 left-4 bg-white/95 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border-0">
          {article.category}
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-bold text-lg mb-2 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2 text-slate-900 dark:text-white">{article.title}</h3>
        
        <div className="relative h-6 overflow-hidden mb-6 group/desc flex items-center bg-slate-50/50 dark:bg-white/5 rounded-lg">
          <div className="group-hover-marquee flex items-center">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap">
              {article.excerpt}
            </p>
            <span className="w-12 shrink-0 hidden group-hover/desc:inline-block" />
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap hidden group-hover/desc:block">
              {article.excerpt}
            </p>
          </div>
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white dark:from-[#111] via-white/70 dark:via-[#111]/70 to-transparent pointer-events-none z-10" />
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>
            
            <div className={`flex flex-col min-w-0 max-w-[75%] ${isLongAuthor ? 'group/author relative overflow-hidden bg-slate-50/50 dark:bg-white/5 rounded-lg h-5 flex flex-col justify-center' : ''}`}>
              {isLongAuthor ? (
                <div className="group-hover-marquee flex items-center">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {article.author}
                  </span>
                  <span className="w-8 shrink-0 hidden group-hover/author:inline-block" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap hidden group-hover/author:block">
                    {article.author}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate text-ellipsis">
                  {article.author}
                </span>
              )}
              {isLongAuthor && (
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-[#111] via-white/50 dark:via-[#111]/50 to-transparent pointer-events-none z-10" />
              )}
            </div>
          </div>
          <button className="flex-shrink-0 text-indigo-600 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12 border border-indigo-100 dark:border-indigo-900/50">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketInsightView;
