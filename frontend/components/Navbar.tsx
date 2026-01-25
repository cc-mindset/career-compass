
import React from 'react';
import { Bell, Moon, Sun, ChevronDown, Briefcase } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onProfileClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, darkMode, toggleDarkMode, onProfileClick }) => {
  return (
    <nav className="h-20 bg-white dark:bg-[#111] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-30 transition-colors">
      <div className="flex items-center gap-12">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">CareerCompass</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        <button 
          onClick={toggleDarkMode}
          className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        
        <div className="relative">
          <button className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-[#111] flex items-center justify-center">3</span>
          </button>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden md:block"></div>

        <button 
          onClick={onProfileClick}
          className="flex items-center gap-3 pl-1 pr-3 py-1 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-indigo-500/10 group-hover:ring-indigo-500 transition-all">
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-sm font-bold leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{user.name}</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{user.role}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
