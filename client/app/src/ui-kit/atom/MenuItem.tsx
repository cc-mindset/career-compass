import React from 'react';

export interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  badge?: React.ReactNode;
  showIndicator?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  active = false,
  onClick,
  className = '',
  badge,
  showIndicator = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl
        transition-all duration-200 group
        ${
          active
            ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-100'
            : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 border border-transparent'
        }
        ${className}
      `}
    >
      {icon && (
        <span className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
          {icon}
        </span>
      )}
      <span className="text-base flex-1 text-left">{label}</span>
      {badge && <span>{badge}</span>}
      {active && showIndicator && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
      )}
    </button>
  );
};

export default MenuItem;
