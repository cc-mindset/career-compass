
import React from 'react';
import { Bell, ChevronDown, Briefcase } from 'lucide-react';
import { UserProfile } from '../../types';

interface NavbarProps {
  user: UserProfile;
  onProfileClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onProfileClick }) => {
  return (
    <nav className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30">
      <div className="flex items-center gap-4 sm:gap-6 lg:gap-12 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-xl shadow-lg shadow-indigo-600/20 flex-shrink-0">
            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 truncate">CareerCompass</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0">
        <div className="relative">
          <button className="p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-slate-600 hover:bg-slate-100 transition-all touch-manipulation" aria-label="Notifications">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">3</span>
          </button>
        </div>

        <div className="h-6 sm:h-8 w-px bg-slate-200 mx-1 sm:mx-2 hidden md:block"></div>

        <button 
          onClick={onProfileClick}
          className="flex items-center gap-2 sm:gap-3 pl-1 pr-2 sm:pr-3 py-1 rounded-xl sm:rounded-2xl hover:bg-slate-50 transition-all group touch-manipulation"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl overflow-hidden ring-2 ring-indigo-500/10 group-hover:ring-indigo-500 transition-all flex-shrink-0">
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-sm font-bold leading-tight group-hover:text-indigo-600 transition-colors">{user.name}</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{user.role}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors hidden sm:block" />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
