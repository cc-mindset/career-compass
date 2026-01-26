import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface PivotCardProps {
  text: string;
  compact?: boolean;
  forceBaseSize?: boolean;
  className?: string;
}

const PivotCard: React.FC<PivotCardProps> = ({
  text,
  compact = false,
  forceBaseSize = false,
  className = '',
}) => {
  return (
    <div
      className={`
        bg-lime-50/50 dark:bg-lime-950/15 
        rounded-[2rem] 
        flex gap-4 
        animate-in fade-in slide-in-from-left-2 duration-300 
        border border-lime-400/60 dark:border-lime-400/50 
        shadow-sm 
        ${compact && !forceBaseSize ? 'p-5 md:p-6' : 'p-6 md:p-8'}
        ${className}
      `}
    >
      <div className="pt-1">
        <RefreshCw
          className={`
            ${compact && !forceBaseSize ? 'w-4 h-4' : 'w-6 h-6'} 
            text-lime-600 dark:text-lime-400 
            flex-shrink-0
          `}
        />
      </div>
      <div>
        <p
          className={`
            text-slate-700 dark:text-slate-300 
            leading-relaxed 
            ${forceBaseSize ? 'text-base' : compact ? 'text-sm' : 'text-lg'}
          `}
        >
          <span className="font-bold text-slate-900 dark:text-white">Pivot Direction:</span> {text}
        </p>
      </div>
    </div>
  );
};

export default PivotCard;
