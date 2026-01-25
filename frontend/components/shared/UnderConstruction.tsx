
import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';

interface UnderConstructionProps {
  viewName: string;
  onBack: () => void;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({ viewName, onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in zoom-in-95 duration-500">
      <div className="bg-indigo-50 dark:bg-indigo-950/30 p-8 rounded-[3rem] mb-8">
        <Construction className="w-24 h-24 text-indigo-600 dark:text-indigo-400 animate-bounce" />
      </div>
      <h2 className="text-3xl font-extrabold mb-4 capitalize">{viewName.replace('-', ' ')} Coming Soon</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
        We're working hard to bring you the best career experience. This section is currently under development and will be available shortly!
      </p>
      <button 
        onClick={onBack}
        className="flex items-center gap-2 bg-slate-900 dark:bg-white dark:text-black text-white px-8 py-3 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>
    </div>
  );
};

export default UnderConstruction;
