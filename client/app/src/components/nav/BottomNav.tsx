import React from 'react';
import { LayoutGrid, Sparkles, BarChart3, Settings, User } from 'lucide-react';
import { AppView } from '../../types';

const MOBILE_NAV_ITEMS: { id: AppView; label: string; icon: React.ElementType }[] = [
  { id: 'market-insights', label: 'Insights', icon: LayoutGrid },
  { id: 'career-intel', label: 'Intel', icon: Sparkles },
  { id: 'eco-simulator', label: 'Eco', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface BottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 pt-2"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-stretch justify-around px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`min-w-0 flex-1 flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-500 hover:bg-slate-50 active:scale-95'
              }`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-bold truncate w-full text-center leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
