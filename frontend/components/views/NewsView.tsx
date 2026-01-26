import React, { useState } from 'react';
import { NewsArticle, AppView } from '../../types';
import { MOCK_NEWS } from '../../constants';
import { ArrowLeft, Search, Filter, Library, ArrowRight } from 'lucide-react';

interface NewsViewProps {
  onNavigate: (view: AppView) => void;
  // This view reuses the rendering logic from Dashboard but manages its own state
}

const NewsView: React.FC<NewsViewProps> = ({ onNavigate }) => {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...new Set(MOCK_NEWS.map(a => a.category))];
  const filteredArticles = activeCategory === 'All' 
    ? MOCK_NEWS 
    : MOCK_NEWS.filter(a => a.category === activeCategory);

  if (selectedArticleId) {
    const article = MOCK_NEWS.find(a => a.id === selectedArticleId);
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <button 
          onClick={() => setSelectedArticleId(null)} 
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-6 md:mb-8 hover:gap-3 transition-all touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" /> Back to News
        </button>
        <div className="bg-white dark:bg-[#111] rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 lg:p-12 shadow-sm">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="aspect-video rounded-xl md:rounded-[2rem] overflow-hidden mb-6 md:mb-8">
              <img src={article?.image} className="w-full h-full object-cover" alt={article?.title} />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">{article?.title}</h1>
            <div className="flex items-center gap-3 md:gap-4 py-4 border-y border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 flex-shrink-0">
                  <Library className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase">Source</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{article?.author}</p>
                </div>
              </div>
            </div>
            <div className="prose prose-slate dark:prose-invert max-w-none text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed space-y-5 md:space-y-6">
               <p>{article?.excerpt}</p>
               <p>Detailed analysis reveals that current market fluctuations are driven by technological integration and shifting consumer behaviors. Experts suggest that professionals should focus on cross-disciplinary skills to remain resilient.</p>
               <p>The report further elaborates on regional disparities, noting that while urban hubs are seeing a surge in specialized tech roles, suburban areas are experiencing growth in logistics and remote service support.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-8 md:mb-12">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1 sm:mb-2 text-slate-900 dark:text-white">Market Intelligence</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">The latest updates from the global and local labor markets</p>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:flex-initial min-w-0">
            <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search news..." 
              className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8 md:mb-10 overflow-x-auto pb-2 hide-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl md:rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap border touch-manipulation ${
              activeCategory === cat 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                : 'bg-white dark:bg-[#111] text-slate-500 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:text-indigo-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {filteredArticles.map(article => (
          <div 
            key={article.id}
            onClick={() => setSelectedArticleId(article.id)}
            className="group bg-white dark:bg-[#111] rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-500 flex flex-col cursor-pointer hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 active:scale-[0.98] touch-manipulation"
          >
            <div className="aspect-video overflow-hidden relative">
              <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/95 dark:bg-black/80 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest">
                {article.category}
              </div>
            </div>
            <div className="p-5 sm:p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2 text-slate-900 dark:text-white">{article.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm line-clamp-3 mb-4 sm:mb-6 flex-1">{article.excerpt}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase truncate max-w-[150px]">{article.author}</span>
                <div className="text-indigo-600 group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsView;
