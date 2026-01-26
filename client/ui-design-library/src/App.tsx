import React, { useState } from 'react';
import { Palette, Type, Box, Layout, Home } from 'lucide-react';
import ThemePage from './pages/ThemePage';
import TypographyPage from './pages/TypographyPage';
import AtomsPage from './pages/AtomsPage';
import MoleculesPage from './pages/MoleculesPage';
import OrganismsPage from './pages/OrganismsPage';

type Page = 'home' | 'theme' | 'typography' | 'atoms' | 'molecules' | 'organisms';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [darkMode, setDarkMode] = useState(false);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const navItems = [
    { id: 'home' as Page, label: 'Home', icon: Home },
    { id: 'theme' as Page, label: 'Theme & Colors', icon: Palette },
    { id: 'typography' as Page, label: 'Typography', icon: Type },
    { id: 'atoms' as Page, label: 'Atoms', icon: Box },
    { id: 'molecules' as Page, label: 'Molecules', icon: Layout },
    { id: 'organisms' as Page, label: 'Organisms', icon: Layout },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'theme':
        return <ThemePage />;
      case 'typography':
        return <TypographyPage />;
      case 'atoms':
        return <AtomsPage />;
      case 'molecules':
        return <MoleculesPage />;
      case 'organisms':
        return <OrganismsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#111] border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">CareerCompass Design Library</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">UI Kit Documentation & Showcase</p>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white dark:bg-[#111] border-r border-slate-200 dark:border-slate-800 h-[calc(100vh-73px)] sticky top-[73px] overflow-y-auto custom-scrollbar">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-900/50'
                      : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto p-8">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-extrabold mb-4 text-slate-900 dark:text-white">
          CareerCompass Design Library
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          A comprehensive guide to our design system, components, and design tokens.
          This library serves as the single source of truth for all UI components.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#111] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
          <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl w-fit mb-4">
            <Palette className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Theme & Colors</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Explore our color palette, gradients, and theme tokens used throughout the application.
          </p>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
          <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl w-fit mb-4">
            <Type className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Typography</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            View all text styles, font sizes, weights, and line heights used in the design system.
          </p>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
          <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl w-fit mb-4">
            <Box className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Components</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Browse all UI components organized by atomic design principles: Atoms, Molecules, and Organisms.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
