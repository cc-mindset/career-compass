
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../../types';
import { Briefcase, MapPin, ChevronRight, User, Building2, Sparkles, Search, Check, ArrowLeft, ArrowRight, Target, BarChart3, GraduationCap, X, Plus } from 'lucide-react';

interface LandingPageViewProps {
  onStart: (userData: UserProfile) => void;
}

// Mock data for searchable dropdowns
const OPTIONS = {
  locations: ["San Francisco, CA", "New York, NY", "London, UK", "Berlin, DE", "Singapore, SG", "Toronto, CA", "Austin, TX", "Seattle, WA", "Tokyo, JP"],
  roles: ["Product Designer", "Frontend Engineer", "AI Researcher", "Product Manager", "Full Stack Developer", "Data Scientist", "Marketing Lead", "UX Researcher", "Backend Engineer"],
  seniority: ["Junior (0-2 Yrs)", "Mid-Level (3-5 Yrs)", "Senior (6-9 Yrs)", "Lead (10+ Yrs)", "Director / Executive"],
  employers: ["Google", "Meta", "Tesla", "Tech Corp Inc.", "Stealth Startup", "Amazon", "Microsoft", "NVIDIA", "OpenAI"],
  skills: ["Figma", "React", "TypeScript", "Python", "Machine Learning", "Strategic Thinking", "Product Strategy", "User Research", "Agile Methodology", "Tailwind CSS", "Node.js", "GraphQL", "AWS"]
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
  { key: 'location', label: "Where are you based?", placeholder: "Select Location", icon: <MapPin className="w-5 h-5" />, options: OPTIONS.locations },
  { key: 'role', label: "What is your current title?", placeholder: "Select Role", icon: <Briefcase className="w-5 h-5" />, options: OPTIONS.roles },
  { key: 'seniority', label: "What is your seniority level?", placeholder: "Select Experience", icon: <User className="w-5 h-5" />, options: OPTIONS.seniority },
  { key: 'employers', label: "Where do you currently work?", placeholder: "Select Employer", icon: <Building2 className="w-5 h-5" />, options: OPTIONS.employers, allowCustom: true },
  { key: 'skills', label: "What are your top skills?", placeholder: "Select at least 3 skills", icon: <Sparkles className="w-5 h-5" />, options: OPTIONS.skills, allowCustom: true },
  { key: 'name', label: "What name do you like to go by?", placeholder: "Enter your name", icon: <User className="w-5 h-5" />, options: [], allowCustom: true },
];

const LandingPageView: React.FC<LandingPageViewProps> = ({ onStart }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    role: '',
    seniority: '',
    employers: '',
    skills: [] as string[]
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeStep = STEPS[currentStep];
  const filteredOptions = activeStep.options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showAddCustom = activeStep.allowCustom && search.trim() !== "" && !activeStep.options.some(opt => opt.toLowerCase() === search.toLowerCase().trim());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    if (activeStep.key === 'skills') {
      setFormData(prev => {
        const isSelected = prev.skills.includes(val);
        const newSkills = isSelected 
          ? prev.skills.filter(s => s !== val) 
          : [...prev.skills, val];
        return { ...prev, skills: newSkills };
      });
      setSearch("");
    } else {
      setFormData(prev => ({ ...prev, [activeStep.key]: val }));
      setIsOpen(false);
      setSearch("");
      if (currentStep < STEPS.length - 1) {
        setTimeout(() => setCurrentStep(prev => prev + 1), 300);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setIsOpen(false);
      setSearch("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCompleted) {
      alert("Please complete all sections to start.");
      return;
    }

    const newUser: UserProfile = {
      name: formData.name || "Explorer",
      role: formData.role,
      company: formData.employers,
      location: formData.location,
      country: formData.location.includes(',') ? formData.location.split(',')[1].trim() : "United States",
      experience: formData.seniority,
      // 'avataaars' with 'smile' mouth mouth provides a professional and friendly look
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name || 'User')}&mouth=smile&backgroundColor=E0E7FF`,
      skills: formData.skills,
      completedCourses: 0,
      certifications: 0
    };
    
    onStart(newUser);
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const isCompleted = formData.name && formData.location && formData.role && formData.seniority && formData.employers && formData.skills.length >= 3;

  const currentStepValue = () => {
    if (activeStep.key === 'skills') {
      if (formData.skills.length === 0) return activeStep.label;
      return `${formData.skills.length} skills selected`;
    }
    return (formData as any)[activeStep.key] || activeStep.label;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 overflow-x-hidden flex flex-col">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">CareerCompass</h1>
        </div>
        <button 
          className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          Sign In
        </button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-0 pb-12 flex flex-col items-center justify-center text-center">
        {/* Hero Content */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 mb-12 -mt-28 md:-mt-36">
          <h1 className="text-4xl md:text-7xl font-extrabold mb-8 tracking-tight leading-[1.05] text-slate-950 max-w-5xl mx-auto">
            Your AI-Powered <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Career Guide</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 text-base md:text-xl font-normal leading-relaxed mb-12">
            Navigate your career journey with personalized recommendations, skill gap analysis, and real-time job market insights.
          </p>
        </div>

        {/* Horizontal Progressive Input Bar */}
        <div className="w-full max-w-4xl relative z-40 animate-in fade-in zoom-in-95 duration-700 delay-200">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-indigo-500/10 p-2 md:p-2.5 flex flex-col md:flex-row items-center gap-3">
            
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
                <div 
                  onClick={() => setIsOpen(!isOpen)}
                  className="group flex items-center justify-between cursor-pointer"
                >
                  <h3 className="text-base md:text-lg font-bold text-slate-900 truncate">
                    {currentStepValue()}
                  </h3>
                  <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform duration-300 ml-2 ${isOpen ? 'rotate-90' : ''}`} />
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
                          placeholder={activeStep.allowCustom ? `Search or type to add...` : `Search ${activeStep.key}...`}
                          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && activeStep.allowCustom && search.trim()) {
                              handleSelect(search.trim());
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
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
                          <span className="text-sm font-bold text-indigo-700">Add "{search.trim()}"</span>
                        </div>
                      )}
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => {
                          const isSelected = activeStep.key === 'skills' 
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
                              <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`}>
                                {opt}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                            </div>
                          );
                        })
                      ) : !showAddCustom && (
                        <div className="px-5 py-8 text-center">
                          <p className="text-sm text-slate-400 font-medium italic">
                            {activeStep.allowCustom ? "Type above and press enter to add" : "No options found"}
                          </p>
                        </div>
                      )}
                    </div>
                    {activeStep.key === 'skills' && (
                      <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          {formData.skills.length < 3 ? `Choose ${3 - formData.skills.length} more` : 'Ready to go!'}
                        </p>
                        <button 
                          onClick={() => setIsOpen(false)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
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
                  disabled={!(formData as any)[activeStep.key]}
                  className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100 group"
                >
                  Start Journey
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button 
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={activeStep.key === 'skills' ? formData.skills.length < 3 : !(formData as any)[activeStep.key]}
                  className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-300 disabled:opacity-80 disabled:scale-100"
                >
                  Next
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
                  idx === currentStep ? 'w-6 bg-indigo-600' : 
                  idx < currentStep ? 'w-3 bg-indigo-200' : 'w-3 bg-slate-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Selected Skills Chips */}
        {activeStep.key === 'skills' && formData.skills.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-2xl animate-in fade-in duration-300">
            {formData.skills.map(skill => (
              <span key={skill} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-black text-xs font-extrabold rounded-full border border-slate-200 shadow-sm">
                {skill}
                <X 
                  className="w-3 h-3 cursor-pointer text-slate-400 hover:text-black transition-colors" 
                  onClick={() => handleSelect(skill)} 
                />
              </span>
            ))}
          </div>
        )}

        {/* Feature Highlights */}
        <div className="mt-32 flex flex-wrap justify-center gap-10 md:gap-20 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
          <FeatureHoverItem 
            icon={<Target className="w-6 h-6" />}
            title="Career Matching"
            description="Find roles that align with your profile and ambitions using intelligent matching algorithms."
          />
          <FeatureHoverItem 
            icon={<BarChart3 className="w-6 h-6" />}
            title="Market Insights"
            description="Stay informed with trends, demand signals, and salary benchmarks for your target roles."
          />
          <FeatureHoverItem 
            icon={<GraduationCap className="w-6 h-6" />}
            title="Skill Development"
            description="Target learning paths and practice plans to close skill gaps and grow your career readiness."
          />
        </div>
      </main>
    </div>
  );
};

const FeatureHoverItem = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="group relative flex flex-col items-center">
    <div className="p-6 rounded-[1.75rem] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 hover:scale-110 hover:bg-indigo-100 transition-all duration-300 cursor-pointer shadow-lg shadow-indigo-600/5">
      {icon}
    </div>
    
    {/* Detail Popover on Hover */}
    <div className="absolute bottom-full mb-6 w-64 p-5 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-indigo-500/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none transform translate-y-2 group-hover:translate-y-0">
      <h4 className="font-bold text-slate-900 mb-2 text-sm">{title}</h4>
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{description}</p>
      <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45" />
    </div>
  </div>
);

export default LandingPageView;
