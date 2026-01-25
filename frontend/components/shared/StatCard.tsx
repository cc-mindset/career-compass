
import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  count: number | string;
  label: string;
  trend?: string;
  status?: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, count, label, trend, status, color }) => (
  <div className="min-w-0 bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-5 xl:p-6 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col justify-between">
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className={`${color} p-2.5 rounded-xl group-hover:scale-110 transition-transform border border-slate-100 dark:border-slate-800`}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
        </div>
        {trend && (
          <span className="text-emerald-500 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg">{trend}</span>
        )}
        {status && (
          <span className="text-indigo-500 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-1 rounded-lg">{status}</span>
        )}
      </div>
      <h3 className="text-2xl xl:text-3xl font-extrabold mb-1">{count}</h3>
    </div>
    <p className="text-slate-500 dark:text-slate-400 text-xs xl:text-sm font-medium leading-tight">{label}</p>
  </div>
);

export default StatCard;
