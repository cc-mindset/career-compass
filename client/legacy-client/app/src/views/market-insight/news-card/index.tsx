import React from "react";
import { ArrowRight, Library } from "lucide-react";
import { NewsArticle } from "../../../types";

const NewsCard: React.FC<{ article: NewsArticle; onClick: () => void }> = ({
  article,
  onClick,
}) => {
  const isLongAuthor = article.author.length > 24;

  return (
    <div
      onClick={onClick}
      className="h-full group bg-white rounded-[2rem] overflow-hidden border border-slate-200 transition-all duration-500 flex flex-col cursor-pointer hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 active:scale-[0.98]"
    >
      <div className="aspect-[1.8/1] overflow-hidden relative">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border-0">
          {article.category}
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-bold text-lg mb-2 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2 text-slate-900">
          {article.title}
        </h3>

        <div className="relative h-6 overflow-hidden mb-6 group/desc flex items-center bg-slate-50/50 rounded-lg">
          <div className="group-hover-marquee flex items-center">
            <p className="text-slate-500 text-xs font-medium whitespace-nowrap">
              {article.excerpt}
            </p>
            <span className="w-12 shrink-0 hidden group-hover/desc:inline-block" />
            <p className="text-slate-500 text-xs font-medium whitespace-nowrap hidden group-hover/desc:block">
              {article.excerpt}
            </p>
          </div>
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/70 to-transparent pointer-events-none z-10" />
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-indigo-600 flex-shrink-0">
              <Library className="w-3.5 h-3.5" />
            </div>

            <div
              className={`flex flex-col min-w-0 max-w-[75%] ${isLongAuthor ? "group/author relative overflow-hidden bg-slate-50/50 rounded-lg h-5 flex flex-col justify-center" : ""}`}
            >
              {isLongAuthor ? (
                <div className="group-hover-marquee flex items-center">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                    {article.author}
                  </span>
                  <span className="w-8 shrink-0 hidden group-hover/author:inline-block" />
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap hidden group-hover/author:block">
                    {article.author}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-500 truncate text-ellipsis">
                  {article.author}
                </span>
              )}
              {isLongAuthor && (
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/50 to-transparent pointer-events-none z-10" />
              )}
            </div>
          </div>
          <button className="flex-shrink-0 text-indigo-600 p-2.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12 border border-indigo-100">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
