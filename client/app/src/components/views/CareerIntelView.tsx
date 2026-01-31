import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../utils/types/types';
import { getCareerSuggestions } from '../../providers/gemini/geminiService';
import {
  CAREER_STAGE_LABELS,
  GUIDANCE_BY_STAGE,
  RECOMMENDED_ACTIONS,
  type CareerStageId,
  type ImpactLevel,
} from '../../consts/careerIntelContent';
import { Target, Lightbulb, ChevronRight, BrainCircuit, GraduationCap, Briefcase, Globe, Sparkles, ClipboardList } from 'lucide-react';

interface CareerIntelViewProps {
  user: UserProfile;
}

const CAREER_STAGE_IDS: CareerStageId[] = ['new-graduates', 'mid-career', 'newcomers'];
const CAREER_STAGE_ICONS = { 'new-graduates': GraduationCap, 'mid-career': Briefcase, newcomers: Globe };

// Match Market Risks & Challenges severity pill style (text only, no icon)
const IMPACT_STYLES: Record<ImpactLevel, { pill: string }> = {
  high: { pill: 'border-rose-500/30 text-rose-600 bg-rose-50' },
  medium: { pill: 'border-amber-500/30 text-amber-600 bg-amber-50' },
  low: { pill: 'border-indigo-500/30 text-indigo-600 bg-indigo-50' },
};

const IMPACT_ORDER: Record<ImpactLevel, number> = { high: 0, medium: 1, low: 2 };
const SORTED_RECOMMENDED_ACTIONS = [...RECOMMENDED_ACTIONS].sort(
  (a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]
);

const CareerIntelView: React.FC<CareerIntelViewProps> = ({ user }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guidanceStage, setGuidanceStage] = useState<CareerStageId>('new-graduates');
  const [expandedActionIdx, setExpandedActionIdx] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    const data = await getCareerSuggestions(user.role, user.location);
    setSuggestions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
  }, [user.role, user.location]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <BrainCircuit className="w-10 h-10 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-bold mb-2">Analyzing the Market...</h3>
          <p className="text-slate-500 max-w-xs mx-auto italic">Gemini is connecting current trends with your profile to build your strategic advantage.</p>
        </div>
      ) : (
        <div className="space-y-8 md:space-y-12">
          {/* Guidance — first, flush with drawer location card */}
          <section className="space-y-4 md:space-y-5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 sm:gap-3">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 fill-amber-500 flex-shrink-0" />
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Guidiance</h2>
              </div>
              <p className="text-slate-500 text-sm md:text-base">Tailored guidance based on your career stage</p>
            </div>

            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[1.5rem] md:rounded-[2.5rem] lg:rounded-[3rem] p-6 md:p-8 lg:p-12 text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 md:mb-6">
                  <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md flex-shrink-0">
                    <Target className="w-4 h-4 md:w-5 md:h-5 text-indigo-300" />
                  </div>
                  <span className="text-indigo-200/80 text-sm font-medium">Choose your stage</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
                  {CAREER_STAGE_IDS.map((id) => {
                    const Icon = CAREER_STAGE_ICONS[id];
                    const isActive = guidanceStage === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setGuidanceStage(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all touch-manipulation ${
                          isActive
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/5 text-indigo-200 border border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {CAREER_STAGE_LABELS[id]}
                      </button>
                    );
                  })}
                </div>

                <ul className="space-y-3 md:space-y-4">
                  {GUIDANCE_BY_STAGE[guidanceStage].map((item, idx) => (
                    <li
                      key={idx}
                      className="flex gap-4 p-4 md:p-5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/30 text-indigo-200 font-bold text-sm flex items-center justify-center border border-white/10">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white/95 text-sm md:text-base leading-relaxed">{item.text}</p>
                        {item.source && (
                          <p className="text-indigo-200/70 text-xs mt-1.5 italic">{item.source}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] -mr-48 -mt-48" aria-hidden />
            </div>
          </section>

          {/* Top Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {suggestions.map((item, idx) => (
              <div 
                key={idx}
                className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-slate-200 relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-500 shadow-sm"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <Target className="w-24 h-24 md:w-32 md:h-32" />
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3 mb-4 md:mb-6">
                  <div className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                    <Lightbulb className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{item.category}</span>
                </div>

                <h3 className="text-lg md:text-xl font-extrabold mb-3 md:mb-4 text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-slate-500 leading-relaxed mb-6 md:mb-8 text-sm md:text-base">
                  {item.description}
                </p>

                <button className="flex items-center gap-2 text-indigo-600 font-bold text-xs sm:text-sm group-hover:gap-3 transition-all touch-manipulation">
                  Explore Implementation <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Recommended Actions — title outside, like Guidiance */}
          <section className="space-y-4 md:space-y-5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 sm:gap-3">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 flex-shrink-0" />
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Recommended Actions</h2>
              </div>
              <p className="text-slate-500 text-sm md:text-base">
                Market trends for San Francisco, California — actionable next steps
              </p>
            </div>

            <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-indigo-500 shadow-sm">
              <div className="space-y-4">
              {SORTED_RECOMMENDED_ACTIONS.map((row, idx) => {
                const { pill } = IMPACT_STYLES[row.impact];
                const isExpanded = expandedActionIdx === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 overflow-hidden transition-all duration-200 hover:bg-indigo-50/70 hover:shadow-md hover:shadow-indigo-200/30"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedActionIdx(isExpanded ? null : idx)}
                      className="w-full text-left p-4 sm:p-5 flex flex-wrap items-start gap-3 sm:gap-4"
                    >
                      <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl text-[10px] font-extrabold uppercase border ${pill}`}>
                        {row.impact.charAt(0).toUpperCase() + row.impact.slice(1)}
                      </span>
                      <span className="flex-1 min-w-0 text-slate-800 font-medium text-sm md:text-base">
                        {row.recommendedAction}
                      </span>
                      <ChevronRight
                        className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-3 border-t border-slate-100 bg-slate-50/50">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Market finding</p>
                          <p className="text-slate-600 text-sm">{row.marketFinding}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Driving force</p>
                          <p className="text-slate-600 text-sm">{row.drivingForce}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CareerIntelView;
