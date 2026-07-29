import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  Library,
  Rocket,
  Shield,
  Zap,
} from "lucide-react";

const TrendCard: React.FC<{ report: any; onClick: () => void }> = ({
  report,
  onClick,
}) => {
  const getIcon = () => {
    switch (report.id) {
      case "high-growth":
        return <Rocket className="w-5 h-5" />;
      case "at-risk":
        return <AlertTriangle className="w-5 h-5" />;
      case "market-risks":
        return <Shield className="w-5 h-5" />;
      case "top-skills":
        return <Zap className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getAccentColor = () => {
    switch (report.id) {
      case "high-growth":
        return "border-emerald-500 text-emerald-600 bg-emerald-50";
      case "at-risk":
        return "border-rose-500 text-rose-600 bg-rose-50";
      case "market-risks":
        return "border-amber-500 text-amber-600 bg-amber-50";
      case "top-skills":
        return "border-indigo-500 text-indigo-600 bg-indigo-50";
      default:
        return "border-slate-500 text-slate-600 bg-slate-50";
    }
  };

  const authorName = "CareerCompass AI";
  const isLongAuthor = authorName.length > 24;

  return (
    <div
      onClick={onClick}
      className="h-full group bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 transition-all duration-500 flex flex-col cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 active:scale-[0.98] relative"
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
          <h3 className="font-extrabold text-xl md:text-2xl mb-4 leading-tight group-hover:text-indigo-600 transition-colors text-slate-900">
            {report.title}
          </h3>
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-3">
            {report.excerpt}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 gap-4 relative z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-indigo-600 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>

            <div
              className={`flex flex-col min-w-0 max-w-[75%] ${isLongAuthor ? "group/author relative overflow-hidden bg-slate-50/50 rounded-lg h-5 flex flex-col justify-center" : ""}`}
            >
              {isLongAuthor ? (
                <div className="group-hover-marquee flex items-center">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                    {authorName}
                  </span>
                  <span className="w-8 shrink-0 hidden group-hover/author:inline-block" />
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap hidden group-hover/author:block">
                    {authorName}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 truncate text-ellipsis">
                  {authorName}
                </span>
              )}
              {isLongAuthor && (
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/50 to-transparent pointer-events-none z-10" />
              )}
            </div>
          </div>
          <button className="flex-shrink-0 text-indigo-600 p-2.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12 border border-indigo-100">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrendCard;
