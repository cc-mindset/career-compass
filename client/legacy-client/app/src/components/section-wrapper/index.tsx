import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { SectionStatus } from '../../state/api/sectionTypes';

interface SectionWrapperProps {
  status: SectionStatus;
  error?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  minHeight?: string;
  loadingText?: string;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  status,
  error,
  onRetry,
  children,
  minHeight = 'min-h-[200px]',
  loadingText = 'Loading section...',
}) => {
  if (status === 'loading' && !children) {
    return (
      <div className={`${minHeight} flex items-center justify-center bg-white rounded-3xl border border-slate-200 p-8`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-600">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`${minHeight} flex items-center justify-center bg-rose-50 rounded-3xl border border-rose-200 p-8`}>
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-rose-600" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-rose-900">Failed to load this section</p>
            <p className="text-xs text-rose-700">{error || 'An error occurred'}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return <>{children}</>;
  }

  return <>{children}</>;
};
