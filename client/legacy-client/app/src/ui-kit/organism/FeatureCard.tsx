import React from 'react';
import Card from '../atom/Card';
import { ChevronRight, Lightbulb } from 'lucide-react';

export interface FeatureCardProps {
  icon?: React.ReactNode;
  category?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon = <Lightbulb className="w-4 h-4 md:w-5 md:h-5" />,
  category,
  title,
  description,
  actionLabel = 'Explore Implementation',
  onAction,
  className = '',
}) => {
  return (
    <Card
      className={`
        relative overflow-hidden group
        hover:border-indigo-500/50
        transition-all duration-500
        ${className}
      `}
      padding="lg"
      rounded="2xl"
      border
      hover
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <Lightbulb className="w-24 h-24 md:w-32 md:h-32" />
      </div>

      {/* Icon and Category */}
      {category && (
        <div className="flex items-center gap-2 sm:gap-3 mb-4 md:mb-6 relative z-10">
          <div className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-indigo-50 text-indigo-600 flex-shrink-0">
            {icon}
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {category}
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg md:text-xl font-extrabold mb-3 md:mb-4 text-slate-900 group-hover:text-indigo-600 transition-colors relative z-10">
        {title}
      </h3>

      {/* Description */}
      <p className="text-slate-500 leading-relaxed mb-6 md:mb-8 text-sm md:text-base relative z-10">
        {description}
      </p>

      {/* Action Button */}
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 text-indigo-600 font-bold text-xs sm:text-sm group-hover:gap-3 transition-all touch-manipulation relative z-10"
        >
          {actionLabel} <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>
      )}
    </Card>
  );
};

export default FeatureCard;
