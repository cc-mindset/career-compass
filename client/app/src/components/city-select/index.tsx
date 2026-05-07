import { Check, Plus, Search } from "lucide-react";
import React, { useState } from "react";
import { useMarketInsightsState } from "../../state/marketInsights/MarketInsightsContext";
import { getSocket } from "../../providers/socket/socket";
import { OPTIONS } from "../../views/landing-page";
import { normalizeText } from "../../utils";

const CitySelect = ({
  handleSelect,
}: {
  handleSelect: (city: string) => void;
}) => {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");

  const filteredOptions = search
    ? OPTIONS.locations.filter((opt) =>
        // Normalize both option and search input for comparison
        normalizeText(opt).includes(normalizeText(search)),
      ) // Limit to top 10 matches for performance and UX
    : OPTIONS.locations;

  return (
    <div className="relative z-10 top-0 mt-0">
      <div className="absolute left-0 top-0 mb-4 w-full md:w-full bg-white border border-slate-200 rounded-3xl text-black">
        <div className="p-3 border-b border-slate-50 bg-slate-50/50 rounded-t-3xl overflow-visible">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder={`Search city...`}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  handleSelect(search.trim());
                }
              }}
            />
          </div>
        </div>
        <div
          className="max-h-64 overflow-visible z-10 relative bg-white shadow-2xl rounded-b-3xl"
          onScroll={(e) => {
            const el = e.currentTarget;
          }}
        >
          {filteredOptions.slice(0, 20).map((opt) => {
            const isSelected = city === opt;

            return (
              <div
                key={opt}
                onClick={(e) => {
                  e.stopPropagation();
                  setCity(opt);
                  handleSelect(opt);
                }}
                className="flex items-center justify-between px-5 py-3 hover:bg-indigo-50 cursor-pointer transition-colors group border-b border-slate-50 last:border-0"
              >
                <span
                  className={`text-sm font-semibold ${isSelected ? "text-indigo-600" : "text-slate-600"}`}
                >
                  {opt}
                </span>
                {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
              </div>
            );
          })}
          {filteredOptions.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-slate-400 font-medium italic">
                {"No options found"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitySelect;
