import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import Button from '../atom/Button';

export interface UnderConstructionProps {
  viewName: string;
  onBack: () => void;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({ viewName, onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] text-center px-4 sm:px-6 animate-in zoom-in-95 duration-500">
      <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] mb-6 md:mb-8">
        <Construction className="w-16 h-16 sm:w-24 sm:h-24 text-indigo-600 dark:text-indigo-400 animate-bounce" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 md:mb-4 capitalize text-slate-900 dark:text-white">
        {viewName.replace('-', ' ')} Coming Soon
      </h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 md:mb-8 text-sm sm:text-base px-2">
        We're working hard to bring you the best career experience. This section is currently under development and will be available shortly!
      </p>
      <Button
        variant="secondary"
        icon={<ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
        iconPosition="left"
        onClick={onBack}
        rounded="2xl"
      >
        Back to Market Insights
      </Button>
    </div>
  );
};

export default UnderConstruction;
