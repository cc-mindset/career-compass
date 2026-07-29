import { Calendar, Gauge, Library } from "lucide-react";
import { RecentNewsArticle } from "../../../types";
import React from "react";

const RecentNewsCard: React.FC<{
  news: RecentNewsArticle;
  onClick?: () => void;
}> = ({ news, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="min-w-[280px] w-[85vw] sm:min-w-[360px] sm:w-[400px] md:w-[480px] lg:w-[540px] flex-shrink-0 bg-white/95 backdrop-blur-sm border border-indigo-600/50 rounded-[1.5rem] p-6 md:p-8 transition-all duration-300 hover:bg-white hover:scale-[1.02] shadow-none cursor-pointer"
    >
      {/* 1PX INDIGO BORDER, BOX SHADOWS REMOVED */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 md:mb-6">
        <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 leading-tight flex-1 min-w-0">
          {news.title}
        </h3>
        <span
          className={`px-3 py-1.5 rounded-xl md:rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex-shrink-0 w-fit ${
            news.sentiment === "Positive"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-500/20"
              : news.sentiment === "Negative"
                ? "bg-rose-50 text-rose-600 border border-rose-500/20"
                : "bg-slate-100 text-slate-600 border border-slate-300"
          }`}
        >
          {news.sentiment}
        </span>
      </div>

      <p className="text-slate-600 text-sm md:text-base lg:text-lg leading-relaxed mb-6 md:mb-8 line-clamp-2 font-medium">
        {news.excerpt}
      </p>

      {/* CONSOLIDATED FOOTER: REPLACED LIVE WEB WITH RELEVANCE METER */}
      <div className="pt-4 md:pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-indigo-600 flex-shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-500">
              {news.date}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-indigo-600 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-500 truncate max-w-[120px] sm:max-w-none">
              {news.source}
            </span>
          </div>
        </div>

        {/* UPDATED RELEVANCE METER: GAUGE ICON ON THE LEFT */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg sm:rounded-xl border border-indigo-200 text-indigo-600 shadow-sm flex-shrink-0">
            <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Relevance
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-indigo-600 flex-shrink-0">
                {news.relevance * 10}%
              </span>
            </div>
            <div className="h-1.5 w-24 sm:w-32 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
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

export default RecentNewsCard;
