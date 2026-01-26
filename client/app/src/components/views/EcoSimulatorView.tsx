import React, { useState } from 'react';
import { UserProfile } from '../../utils/types/types';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Zap, Info, ChevronRight } from 'lucide-react';

interface EcoSimulatorViewProps {
  user: UserProfile;
}

const EcoSimulatorView: React.FC<EcoSimulatorViewProps> = ({ user }) => {
  const [aiImpact, setAiImpact] = useState(50);
  const [marketVolatility, setMarketVolatility] = useState(30);
  const [upskillSpeed, setUpskillSpeed] = useState(70);

  // Derived metrics
  const resiliencyScore = Math.max(10, Math.min(100, (upskillSpeed * 0.6) + (100 - aiImpact * 0.3) - (marketVolatility * 0.1)));
  const marketDemand = Math.max(10, Math.min(100, (aiImpact * 0.4) + (upskillSpeed * 0.3) - (marketVolatility * 0.2)));

  const getStatus = (score: number) => {
    if (score > 75) return { label: 'Robust', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (score > 50) return { label: 'Stable', color: 'text-indigo-500', bg: 'bg-indigo-500/10' };
    return { label: 'Vulnerable', color: 'text-rose-500', bg: 'bg-rose-500/10' };
  };

  const resiliency = getStatus(resiliencyScore);
  const demand = getStatus(marketDemand);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="mb-8 md:mb-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3 text-slate-900">
          Career Eco Simulator <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 flex-shrink-0" />
        </h1>
        <p className="text-slate-500 text-sm sm:text-base">Model the impact of global economic variables on your role as a {user.role}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Controls Section */}
        <div className="lg:col-span-1 space-y-6 md:space-y-10">
          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h2 className="text-base md:text-lg font-bold mb-6 md:mb-8 flex items-center gap-2 text-slate-900">
              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" /> Variables
            </h2>
            
            <div className="space-y-8 md:space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">AI Adoption Level</label>
                  <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{aiImpact}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={aiImpact} 
                  onChange={(e) => setAiImpact(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">Market Volatility</label>
                  <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">{marketVolatility}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={marketVolatility} 
                  onChange={(e) => setMarketVolatility(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">Upskilling Velocity</label>
                  <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{upskillSpeed}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={upskillSpeed} 
                  onChange={(e) => setUpskillSpeed(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 bg-indigo-600 rounded-xl md:rounded-[2rem] text-white">
            <div className="flex items-start gap-3 md:gap-4">
              <Info className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5 md:mt-1" />
              <div className="min-w-0">
                <p className="font-bold mb-1 text-xs sm:text-sm">Pro Tip</p>
                <p className="text-[11px] sm:text-xs text-indigo-100 leading-relaxed">Increasing your Upskilling Velocity is the single most effective way to counter high Market Volatility.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className={`p-3 md:p-4 rounded-2xl md:rounded-3xl ${resiliency.bg} mb-4 md:mb-6`}>
                <ShieldCheck className={`w-6 h-6 md:w-8 md:h-8 ${resiliency.color}`} />
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 md:mb-2">Market Resiliency</p>
              <h3 className={`text-3xl md:text-4xl font-extrabold ${resiliency.color} mb-1.5 md:mb-2`}>{Math.round(resiliencyScore)}%</h3>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">Status: {resiliency.label}</p>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className={`p-3 md:p-4 rounded-2xl md:rounded-3xl ${demand.bg} mb-4 md:mb-6`}>
                <TrendingUp className={`w-6 h-6 md:w-8 md:h-8 ${demand.color}`} />
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 md:mb-2">Career Demand</p>
              <h3 className={`text-3xl md:text-4xl font-extrabold ${demand.color} mb-1.5 md:mb-2`}>{Math.round(marketDemand)}%</h3>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">Status: {demand.label}</p>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h2 className="text-lg md:text-xl font-bold mb-6 md:mb-8 text-slate-900">Simulation Insights</h2>
            <div className="space-y-5 md:space-y-6">
              <div className="flex gap-4 md:gap-6 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0 flex-shrink-0"></div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 mb-1 text-base md:text-lg">AI-Augmented Evolution</h4>
                  <p className="text-slate-500 leading-relaxed text-sm md:text-base">As AI adoption reaches {aiImpact}%, routine tasks in your role as a {user.role} will shift towards high-level strategic oversight. You should expect to spend 40% less time on production and 60% more time on AI system orchestration.</p>
                </div>
              </div>
              <div className="flex gap-4 md:gap-6 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2.5 shrink-0 flex-shrink-0"></div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 mb-1 text-base md:text-lg">Opportunity Delta</h4>
                  <p className="text-slate-500 leading-relaxed text-sm md:text-base">With your current upskilling velocity of {upskillSpeed}%, you are positioned in the top 15% of candidates for roles in "Platform Design" and "AI-Integrator" clusters in {user.location}.</p>
                </div>
              </div>
            </div>
            
            <button className="mt-8 md:mt-12 w-full py-3 md:py-4 bg-slate-50 hover:bg-slate-100 rounded-xl md:rounded-2xl font-bold text-indigo-600 transition-all flex items-center justify-center gap-2 border border-slate-200 touch-manipulation">
              Download Full Forecast <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EcoSimulatorView;
