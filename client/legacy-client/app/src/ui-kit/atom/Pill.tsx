import React from 'react';

export interface PillProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  uppercase?: boolean;
  border?: boolean;
}

const Pill: React.FC<PillProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  uppercase = true,
  border = false,
}) => {
  const variantClasses = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    error: 'bg-rose-50 text-rose-600',
    info: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-500/20',
    rose: 'bg-rose-50 text-rose-600 border-rose-500/20',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600 border-slate-300',
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-[9px] rounded-lg',
    sm: 'px-3 py-1.5 text-[10px] rounded-xl',
    md: 'px-4 py-2 text-xs rounded-2xl',
  };

  const borderClasses = border ? 'border' : '';

  return (
    <span
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${borderClasses}
        ${uppercase ? 'uppercase font-extrabold tracking-widest' : 'font-bold'}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Pill;
