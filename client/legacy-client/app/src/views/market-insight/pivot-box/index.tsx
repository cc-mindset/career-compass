import { RefreshCw } from "lucide-react";
import React from "react";

const PivotBox: React.FC<{
  text: string;
  compact?: boolean;
  forceBaseSize?: boolean;
}> = ({ text, compact = false, forceBaseSize = false }) => (
  <div
    className={`bg-lime-50/50 rounded-[2rem] flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300 border border-lime-400/60 shadow-sm ${compact && !forceBaseSize ? "p-5 md:p-6" : "p-6 md:p-8"}`}
  >
    <div className="pt-1">
      <RefreshCw
        className={`${compact && !forceBaseSize ? "w-4 h-4" : "w-6 h-6"} text-lime-600 flex-shrink-0`}
      />
    </div>
    <div>
      <p
        className={`text-slate-700 leading-relaxed ${forceBaseSize ? "text-base" : compact ? "text-sm" : "text-lg"}`}
      >
        <span className="font-bold text-slate-900">Pivot Direction:</span>{" "}
        {text}
      </p>
    </div>
  </div>
);

export default PivotBox
