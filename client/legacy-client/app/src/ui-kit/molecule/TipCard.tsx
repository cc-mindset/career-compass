import React from 'react';
import { Info } from 'lucide-react';

export interface TipCardProps {
  text: string;
  compact?: boolean;
  forceBaseSize?: boolean;
  className?: string;
}

const TipCard: React.FC<TipCardProps> = ({
  text,
  compact = false,
  forceBaseSize = false,
  className = '',
}) => {
  return (
    <div
      className={`
        bg-purple-50/50 
        rounded-[1.5rem] md:rounded-[2rem] 
        flex gap-3 md:gap-4 
        animate-in fade-in slide-in-from-left-2 duration-300 
        border border-purple-400/60 
        shadow-sm 
        ${compact && !forceBaseSize ? 'p-4 md:p-5 lg:p-6' : 'p-5 md:p-6 lg:p-8'}
        ${className}
      `}
    >
      <div className="pt-1">
        <Info
          className={`
            ${compact && !forceBaseSize ? 'w-4 h-4' : 'w-5 h-5 md:w-6 md:h-6'} 
            text-purple-600 
            flex-shrink-0
          `}
        />
      </div>
      <div>
        <p
          className={`
            text-slate-700 
            leading-relaxed 
            ${
              forceBaseSize
                ? 'text-sm md:text-base'
                : compact
                  ? 'text-xs md:text-sm'
                  : 'text-base md:text-lg'
            }
          `}
        >
          <span className="font-bold text-slate-900">Tip:</span> {text}
        </p>
      </div>
    </div>
  );
};

export default TipCard;
