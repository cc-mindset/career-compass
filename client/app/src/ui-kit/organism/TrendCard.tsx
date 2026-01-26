import React from 'react';
import Card from '../atom/Card';
import { ArrowRight, Library, Activity } from 'lucide-react';

export interface TrendCardProps {
  icon: React.ReactNode;
  title: string;
  excerpt: string;
  author?: string;
  colorGradient?: string;
  accentColor?: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate';
  onClick?: () => void;
  className?: string;
}

const TrendCard: React.FC<TrendCardProps> = ({
  icon,
  title,
  excerpt,
  author = 'CareerCompass AI',
  colorGradient,
  accentColor = 'indigo',
  onClick,
  className = '',
}) => {
  const isLongAuthor = author.length > 24;

  const getAccentColorClasses = () => {
    switch (accentColor) {
      case 'emerald':
        return 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20';
      case 'rose':
        return 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/20';
      case 'amber':
        return 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20';
      case 'indigo':
        return 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20';
      case 'slate':
        return 'border-slate-500 text-slate-600 bg-slate-50 dark:bg-slate-950/20';
      default:
        return 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20';
    }
  };

  return (
    <Card
      onClick={onClick}
      className={`
        h-full group
        overflow-hidden
        flex flex-col
        cursor-pointer
        hover:shadow-2xl hover:shadow-indigo-500/10
        active:scale-[0.98]
        transition-all duration-500
        relative
        ${className}
      `}
      padding="lg"
      rounded="2xl"
      border
    >
      {/* Top gradient bar */}
      {colorGradient && (
        <div className={`h-1.5 w-full bg-gradient-to-r ${colorGradient} absolute top-0 left-0`} />
      )}

      {/* Background decoration */}
      <div className="absolute top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all duration-700 pointer-events-none">
        <Activity className="w-64 h-64" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Icon */}
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div className={`p-3 rounded-2xl ${getAccentColorClasses()} shadow-sm`}>
            {icon}
          </div>
        </div>

        {/* Title and Excerpt */}
        <div className="mb-6 relative z-10">
          <h3 className="font-extrabold text-xl md:text-2xl mb-4 leading-tight group-hover:text-indigo-600 transition-colors text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-3">
            {excerpt}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 gap-4 relative z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>

            <div
              className={`flex flex-col min-w-0 max-w-[75%] ${
                isLongAuthor
                  ? 'group/author relative overflow-hidden bg-slate-50/50 dark:bg-white/5 rounded-lg h-5 flex flex-col justify-center'
                  : ''
              }`}
            >
              {isLongAuthor ? (
                <div className="group-hover-marquee flex items-center">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {author}
                  </span>
                  <span className="w-8 shrink-0 hidden group-hover/author:inline-block" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap hidden group-hover/author:block">
                    {author}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate text-ellipsis">
                  {author}
                </span>
              )}
              {isLongAuthor && (
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-[#111] via-white/50 dark:via-[#111]/50 to-transparent pointer-events-none z-10" />
              )}
            </div>
          </div>
          <button className="flex-shrink-0 text-indigo-600 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12 border border-indigo-100 dark:border-indigo-900/50">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};

export default TrendCard;
