import React, { useState, useRef, useEffect } from "react";
import { UserProfile } from "../../utils/types/types";
import { useMarketInsightsState } from "../../state/marketInsights/MarketInsightsContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getSocket } from "../../providers/socket/socket";
import { Briefcase, MapPin, ChevronRight, User, Building2, Sparkles, Search, Check, ArrowLeft, ArrowRight, Target, BarChart3, GraduationCap, X, Plus, Upload, FileText } from "lucide-react";
import { buildLocations } from "../../utils/LocationPackage/LocationPackage";
import professions from "professions";
import { techRolesRaw } from "../../consts/techRolesRaw";
import { PRIORITY_CITIES } from "../../consts/techRolesRaw";

interface LandingPageViewProps {
  onStart: (userData: UserProfile) => void;
}

const techRoleSet = new Set(techRolesRaw.map((r) => r.toLowerCase()));
const otherRoles = professions
  .filter((r: string) => !techRoleSet.has(r.toLowerCase()))
  .sort((a: string, b: string) => a.localeCompare(b));

const techRoles = [
  ...techRolesRaw.sort((a, b) => a.localeCompare(b)), // tech roles first
  ...otherRoles, // everything else after
];

const allLocations = buildLocations().map((l) => l.label); //
const remainingLocations = allLocations.filter(
  (l) => !PRIORITY_CITIES.includes(l),
);

// Mock data for searchable dropdowns
const OPTIONS = {
  locations: [...PRIORITY_CITIES, ...remainingLocations],
  roles: techRoles,
  seniority: [ "Junior (0-2 Yrs)", "Mid-Level (3-5 Yrs)", "Senior (6-9 Yrs)", "Lead (10+ Yrs)", "Director / Executive" ],
  employers: [ "Google", "Meta", "Tesla", "Tech Corp Inc.", "Stealth Startup", "Amazon", "Microsoft", "NVIDIA", "OpenAI" ],
  skills: [ "Figma", "React", "TypeScript", "Python", "Machine Learning", "Strategic Thinking", "Product Strategy", "User Research", "Agile Methodology", "Tailwind CSS", "Node.js", "GraphQL", "AWS" ],
};

interface StepConfig {
  key: string;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  options: string[];
  allowCustom?: boolean;
}

const STEPS: StepConfig[] = [
  {
    key: "location",
    label: "Where are you based?",
    placeholder: "Select Location",
    icon: <MapPin className="w-5 h-5" />,
    options: OPTIONS.locations,
  },
  {
    key: "role",
    label: "What is your current title?",
    placeholder: "Select Role",
    icon: <Briefcase className="w-5 h-5" />,
    options: OPTIONS.roles,
  },
  {
    key: "seniority",
    label: "What is your seniority level?",
    placeholder: "Select Experience",
    icon: <User className="w-5 h-5" />,
    options: OPTIONS.seniority,
  },
  {
    key: "resume",
    label: "Upload your resume (optional)",
    placeholder: "Choose file or skip",
    icon: <Upload className="w-5 h-5" />,
    options: [],
  },
  {
    key: "name",
    label: "What name do you like to go by?",
    placeholder: "Enter your name",
    icon: <User className="w-5 h-5" />,
    options: [],
    allowCustom: true,
  },
];

const LandingPageView: React.FC<LandingPageViewProps> = ({ onStart }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    role: "",
    seniority: "",
    employers: "",
    skills: [] as string[],
    resumeFile: null as File | null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(""); //Handles search input for dropdowns
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openFeatureIndex, setOpenFeatureIndex] = useState<number | null>(null);
  const [isDraggingResume, setIsDraggingResume] = useState(false);

  const { generateMarketInsights } = useMarketInsightsState();
  const [hasStartedFilling, setHasStartedFilling] = useState(false);
  const lastMarketInsightsLocationTriggeredRef = useRef<string | null>(null);

  // Lazily bootstrap WebSocket connection once the user starts interacting with the form
  const { isConnected } = useWebSocket(); // Hook uses a global singleton; it's safe to call once here.

  // Log connection status for debugging
  useEffect(() => {
    if (hasStartedFilling) {
      console.log(
        `[LandingPage] Form interaction started, WebSocket connected: ${isConnected}`,
      );
    }
  }, [hasStartedFilling, isConnected]);

  const activeStep = STEPS[currentStep];

  // Normalize text for better search matching
  const normalizeText = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ") // collapse multiple spaces
      .trim(); // removes leading/trailing spaces

  // Filter options based on search input
  const filteredOptions = search
    ? activeStep.options.filter((opt) =>
        // Normalize both option and search input for comparison
        normalizeText(opt).includes(normalizeText(search)),
      ) // Limit to top 10 matches for performance and UX
    : activeStep.options;

  // Determine if we should show the "Add Custom" option
  const showAddCustom =
    activeStep.allowCustom &&
    search.trim() !== "" &&
    !activeStep.options.some(
      (opt) => opt.toLowerCase() === search.toLowerCase().trim(),
    );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    if (!hasStartedFilling) {
      setHasStartedFilling(true);
    }

    // Kick off websocket + market-insights generation the moment "Location" is selected.
    // This lets the user see the socket connection immediately and start receiving progress updates.
    if (activeStep.key === "location") {
      // Ensure the socket instance is created and a connection attempt starts ASAP.
      const socket = getSocket();
      if (!socket.connected) socket.connect();

      // Avoid re-triggering for the same location unless the user actually changes it.
      if (lastMarketInsightsLocationTriggeredRef.current !== val) {
        lastMarketInsightsLocationTriggeredRef.current = val;
        generateMarketInsights({ location: val });
      }
    }

    if (activeStep.key === "skills") {
      setFormData((prev) => {
        const isSelected = prev.skills.includes(val);
        const newSkills = isSelected
          ? prev.skills.filter((s) => s !== val)
          : [...prev.skills, val];
        return { ...prev, skills: newSkills };
      });
      setSearch("");
    } else {
      setFormData((prev) => ({ ...prev, [activeStep.key]: val }));
      setIsOpen(false);
      setSearch("");
      if (currentStep < STEPS.length - 1) {
        setTimeout(() => setCurrentStep((prev) => prev + 1), 300);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setIsOpen(false);
      setSearch("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCompleted) {
      alert("Please complete all sections to start.");
      return;
    }

    const newUser: UserProfile = {
      name: formData.name || "Explorer",
      role: formData.role,
      company: "",
      location: formData.location,
      country: formData.location.includes(",")
        ? formData.location.split(",")[1].trim()
        : "United States",
      experience: formData.seniority
        ? formData.seniority.replace(/\s*\([^)]*\)\s*/g, "").trim()
        : "",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name || "User")}&mouth=smile&backgroundColor=E0E7FF`,
      skills: [],
      completedCourses: 0,
      certifications: 0,
    };

    // Market insights generation is triggered on Location selection.
    // Only trigger here if the user changed location after the initial trigger.
    if (lastMarketInsightsLocationTriggeredRef.current !== newUser.location) {
      lastMarketInsightsLocationTriggeredRef.current = newUser.location;
      generateMarketInsights({
        location: newUser.location,
        // userId can be wired up and passed later
      });
    }

    onStart(newUser);
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const isCompleted = formData.location && formData.role && formData.seniority;

  const currentStepValue = () => {
    if (activeStep.key === "resume") {
      return formData.resumeFile
        ? formData.resumeFile.name.length > 4
          ? formData.resumeFile.name.slice(0, 4) + ".."
          : formData.resumeFile.name
        : activeStep.label;
    }
    const value = (formData as any)[activeStep.key] || activeStep.label;
    // Remove the "(0-2 Yrs)" part from seniority values
    if (activeStep.key === "seniority" && value && value !== activeStep.label) {
      return value.replace(/\s*\([^)]*\)\s*/g, "").trim();
    }
    return value;
  };

  const RESUME_ACCEPT = [".pdf", ".doc", ".docx"];
  const isResumeFile = (file: File) =>
    RESUME_ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext));

  const applyResumeFile = (file: File) => {
    if (!isResumeFile(file)) return;
    setFormData((prev) => ({ ...prev, resumeFile: file }));
    if (currentStep < STEPS.length - 1) {
      setTimeout(() => setCurrentStep((prev) => prev + 1), 300);
    }
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyResumeFile(file);
    e.target.value = "";
  };

  const handleResumeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResume(true);
  };

  const handleResumeDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResume(false);
  };

  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingResume(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyResumeFile(file);
  };

  const [visibleCount, setVisibleCount] = useState(20);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 overflow-x-hidden flex flex-col">
      <style>{`
        .resume-label-marquee {
          display: inline-flex;
          white-space: nowrap;
        }
        @keyframes resume-sub-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-12%); }
        }
        .group\\/resume-desc:hover .resume-label-marquee {
          animation: resume-sub-marquee 1.4s linear forwards;
        }
      `}</style>
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-xl shadow-lg shadow-indigo-600/20 flex-shrink-0">
            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 truncate">
            CareerCompass
          </h1>
        </div>
        <button className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors flex-shrink-0 touch-manipulation">
          Sign In
        </button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-0 pb-12 flex flex-col items-center justify-center text-center">
        {/* Hero Content */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 mb-6 md:mb-12 -mt-4 md:-mt-16">
          <h1 className="text-4xl md:text-7xl font-extrabold mb-4 md:mt-4 md:mb-8 tracking-tight leading-[1.05] text-slate-950 max-w-5xl mx-auto">
            Your AI-Powered <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Career Guide
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 text-base md:text-xl font-normal leading-relaxed mb-4 md:mb-12">
            Navigate your career journey with personalized recommendations,
            skill gap analysis, and real-time job market insights.
          </p>
        </div>

        {/* Horizontal Progressive Input Bar */}
        <div className="w-full max-w-4xl relative z-40 animate-in fade-in zoom-in-95 duration-700 delay-200">
          <div className="bg-white rounded-[2rem] border border-indigo-400/30 md:border-2 md:border-indigo-400/30 shadow-2xl shadow-indigo-500/10 p-2 md:p-2.5 flex flex-col md:flex-row items-center gap-3">
            {/* Step Content */}
            <div className="flex-1 w-full flex items-center gap-4 px-4 min-h-[52px]">
              <div className="hidden md:flex items-center gap-4 shrink-0">
                <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
                  {activeStep.icon}
                </div>
                <div className="w-px h-6 bg-slate-100" />
              </div>

              <div className="flex-1 text-left relative" ref={dropdownRef}>
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5 ml-1">
                  Question {currentStep + 1} of {STEPS.length}
                </p>
                {activeStep.key === "resume" ? (
                  <div
                    onDragOver={handleResumeDragOver}
                    onDragLeave={handleResumeDragLeave}
                    onDrop={handleResumeDrop}
                    className={`group/resume flex items-center justify-between w-full gap-3 md:px-2 md:py-1 rounded-xl border-2 border-dashed transition-colors ${
                      isDraggingResume
                        ? "border-indigo-400 bg-indigo-50/50"
                        : "border-transparent"
                    }`}
                  >
                    {/* Questionnaire Resume Upload */}
                    <div className="relative h-7 overflow-hidden flex-1 min-w-0 flex items-center bg-slate-50/50 rounded-lg w-[11rem] sm:w-[12.5rem] md:w-[14rem] group/resume-desc">
                      <div className="resume-label-marquee flex items-center">
                        <span className="font-bold text-slate-900 text-base md:text-lg whitespace-nowrap">
                          Upload your resume for the best experience
                        </span>
                        <span className="w-12 shrink-0 hidden group-hover/resume-desc:inline-block" />
                        <span className="font-bold text-slate-900 text-base md:text-lg whitespace-nowrap hidden group-hover/resume-desc:block">
                          Upload your resume for the best experience
                        </span>
                      </div>
                      <div
                        className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/70 to-transparent pointer-events-none z-10"
                        aria-hidden
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleResumeUpload}
                        className="hidden"
                        aria-label="Upload resume"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-200"
                        title="Upload resume"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      {formData.resumeFile && (
                        <span className="inline-flex items-center gap-1.5 text-slate-600 text-xs font-medium shrink-0">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {formData.resumeFile.name.length > 4
                            ? formData.resumeFile.name.slice(0, 4) + ".."
                            : formData.resumeFile.name}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => {
                        setIsOpen(!isOpen);
                        setVisibleCount(20);
                      }}
                      className="group flex items-center justify-between cursor-pointer md:hover:bg-indigo-50/50 md:hover:text-indigo-600 rounded-lg md:px-2 md:py-1 transition-all duration-200"
                    >
                      <h3
                        className={`font-bold text-slate-900 md:group-hover:text-indigo-600 truncate transition-colors duration-200 ${
                          activeStep.key === "role" ||
                          activeStep.key === "seniority"
                            ? "text-sm md:text-lg"
                            : "text-base md:text-lg"
                        }`}
                      >
                        {currentStepValue()}
                      </h3>
                      <ChevronRight
                        className={`w-4 h-4 text-slate-300 md:group-hover:text-indigo-600 transition-all duration-300 ml-2 ${isOpen ? "rotate-90" : ""}`}
                      />
                    </div>

                    {/* Dropdown Menu (Selection) */}
                    {isOpen && (
                      <div className="absolute left-0 bottom-full mb-4 w-full md:w-[400px] bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-indigo-500/20 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                          <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              autoFocus
                              type="text"
                              placeholder={
                                activeStep.allowCustom
                                  ? `Search or type to add...`
                                  : `Search ${activeStep.key}...`
                              }
                              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all"
                              value={search}
                              onChange={(e) => {
                                setSearch(e.target.value);
                                setVisibleCount(20);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  activeStep.allowCustom &&
                                  search.trim()
                                ) {
                                  handleSelect(search.trim());
                                }
                              }}
                            />
                          </div>
                        </div>
                        {/* Scrollable container for options */}
                        <div
                          className="max-h-64 overflow-y-auto custom-scrollbar"
                          onScroll={(e) => {
                            const el = e.currentTarget;
                            if (
                              el.scrollHeight - el.scrollTop - el.clientHeight <
                              50
                            ) {
                              setVisibleCount((prev) => prev + 20);
                            }
                          }}
                        >
                          {showAddCustom && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(search.trim());
                              }}
                              className="flex items-center gap-3 px-5 py-3.5 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-slate-100 bg-indigo-50/30"
                            >
                              <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                                <Plus className="w-3 h-3" />
                              </div>
                              <span className="text-sm font-bold text-indigo-700">
                                Add "{search.trim()}"
                              </span>
                            </div>
                          )}
                          {filteredOptions.slice(0, visibleCount).map((opt) => {
                            const isSelected =
                              activeStep.key === "skills"
                                ? formData.skills.includes(opt)
                                : (formData as any)[activeStep.key] === opt;

                            return (
                              <div
                                key={opt}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(opt);
                                }}
                                className="flex items-center justify-between px-5 py-3 hover:bg-indigo-50 cursor-pointer transition-colors group border-b border-slate-50 last:border-0"
                              >
                                <span
                                  className={`text-sm font-semibold ${isSelected ? "text-indigo-600" : "text-slate-600"}`}
                                >
                                  {opt}
                                </span>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-indigo-600" />
                                )}
                              </div>
                            );
                          })}
                          {filteredOptions.length === 0 && !showAddCustom && (
                            <div className="px-5 py-8 text-center">
                              <p className="text-sm text-slate-400 font-medium italic">
                                {activeStep.allowCustom
                                  ? "Type above and press enter to add"
                                  : "No options found"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-3">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous question"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {isLastStep ? (
                <button
                  onClick={handleSubmit}
                  disabled={
                    activeStep.key === "name"
                      ? false
                      : !(formData as any)[activeStep.key]
                  }
                  className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100 group"
                >
                  Start Journey
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={
                    activeStep.key === "resume" || activeStep.key === "name"
                      ? false
                      : !(formData as any)[activeStep.key]
                  }
                  className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-300 disabled:opacity-80 disabled:scale-100"
                >
                  {activeStep.key === "resume" && !formData.resumeFile
                    ? "SKIP"
                    : "Next"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6 flex justify-center gap-2">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 rounded-full transition-all duration-500 ${
                  idx === currentStep
                    ? "w-6 bg-indigo-600"
                    : idx < currentStep
                      ? "w-3 bg-indigo-200"
                      : "w-3 bg-slate-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-24 md:mt-32 flex flex-wrap justify-center gap-y-16 gap-x-10 md:gap-20 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
          <FeatureHoverItem
            index={0}
            icon={<Target className="w-6 h-6" />}
            title="Career Matching"
            description="Find roles that align with your profile and ambitions using intelligent matching algorithms."
            isOpen={openFeatureIndex === 0}
            onToggle={() =>
              setOpenFeatureIndex(openFeatureIndex === 0 ? null : 0)
            }
          />
          <FeatureHoverItem
            index={1}
            icon={<BarChart3 className="w-6 h-6" />}
            title="Market Insights"
            description="Stay informed with trends, demand signals, and salary benchmarks for your target roles."
            isOpen={openFeatureIndex === 1}
            onToggle={() =>
              setOpenFeatureIndex(openFeatureIndex === 1 ? null : 1)
            }
          />
          <FeatureHoverItem
            index={2}
            icon={<GraduationCap className="w-6 h-6" />}
            title="Skill Development"
            description="Target learning paths and practice plans to close skill gaps and grow your career readiness."
            isOpen={openFeatureIndex === 2}
            onToggle={() =>
              setOpenFeatureIndex(openFeatureIndex === 2 ? null : 2)
            }
          />
        </div>
      </main>
    </div>
  );
};

interface FeatureHoverItemProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
}

const FeatureHoverItem: React.FC<FeatureHoverItemProps> = ({
  index,
  icon,
  title,
  description,
  isOpen,
  onToggle,
}) => {
  const featureRef = useRef<HTMLDivElement>(null);

  // Shift popup towards center on mobile for first (0) and third (2) icons
  const getMobilePosition = () => {
    if (index === 0) {
      // First icon: shift right (towards center) - increased shift
      return "sm:left-1/2 sm:-translate-x-1/2 left-[calc(50%+4rem)] -translate-x-1/2";
    } else if (index === 2) {
      // Third icon: shift left (towards center) - increased shift
      return "sm:left-1/2 sm:-translate-x-1/2 left-[calc(50%-4rem)] -translate-x-1/2";
    }
    return "left-1/2 -translate-x-1/2";
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        featureRef.current &&
        !featureRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          onToggle();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={featureRef} className="group relative flex flex-col items-center">
      <button
        onClick={onToggle}
        className={`p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[1.75rem] bg-indigo-50 text-indigo-600 border border-indigo-100 transition-all duration-300 cursor-pointer shadow-lg shadow-indigo-600/5 touch-manipulation ${
          isOpen
            ? "scale-110 bg-indigo-100"
            : "hover:scale-110 hover:bg-indigo-100"
        }`}
        aria-expanded={isOpen}
        aria-label={`${title} - ${description}`}
      >
        {icon}
      </button>

      {/* Detail: shown on click (mobile) or hover (desktop) */}
      <div
        className={`absolute bottom-full mb-4 sm:mb-6 ${getMobilePosition()} w-64 p-4 sm:p-5 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xl shadow-indigo-500/10 z-50 transition-all duration-300 ${
          isOpen
            ? "opacity-100 visible transform translate-y-0 pointer-events-auto"
            : "opacity-0 invisible transform translate-y-2 pointer-events-none md:group-hover:opacity-100 md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:pointer-events-auto"
        }`}
      >
        <h4 className="font-bold text-slate-900 mb-1.5 sm:mb-2 text-sm">
          {title}
        </h4>
        <p className="text-sm text-slate-500 font-normal leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

export default LandingPageView;
