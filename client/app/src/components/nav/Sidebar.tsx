import React from 'react';
import { Edit2, MapPin } from 'lucide-react';
import { AppView, UserProfile } from '../../types';
import { NAVIGATION_ITEMS, BOTTOM_NAV_ITEMS } from '../../consts';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: UserProfile;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, user }) => {
  return (
    <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 h-full p-6 pt-6">
      {/* Location Card - Deepened Indigo-Slate Gradient */}
      <div className="mb-8 bg-gradient-to-br from-indigo-500 via-indigo-700 to-slate-900 border border-indigo-400/30 p-5 rounded-3xl text-white relative overflow-hidden group lg:h-[160px] flex flex-col justify-center shadow-xl shadow-indigo-900/10">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-3">
            <div className="bg-white/10 backdrop-blur-xl p-2 rounded-lg border border-white/10 shadow-sm text-white">
              <MapPin className="w-4 h-4" />
            </div>
            <button className="p-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full transition-colors text-indigo-100 hover:text-white border border-white/5">
              <span className="sr-only">Edit location</span>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <p className="text-indigo-100/80 text-[10px] font-bold uppercase tracking-widest">Current Location</p>
            <h3 className="font-bold text-lg leading-tight text-white">{user.location}</h3>
            <p className="text-indigo-50/70 text-[11px] font-medium">{user.country}</p>
          </div>
        </div>
        {/* Subtle glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-12 -mt-12 blur-3xl group-hover:scale-125 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8 blur-2xl" />
      </div>

      <nav className="flex-1 space-y-2">
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as AppView)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 border border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="text-base">{item.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
            </button>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-slate-100 space-y-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as AppView)}
              className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 transition-all group"
            >
              <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-base">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;