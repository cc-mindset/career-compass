import React, { useState, useEffect } from 'react';
import { NAVIGATION_ITEMS, BOTTOM_NAV_ITEMS, INITIAL_USER } from './constants';
import { AppView, UserProfile } from './types';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardView from './components/views/DashboardView';
import ProfileView from './components/views/ProfileView';
import NewsView from './components/views/NewsView';
import CareerIntelView from './components/views/CareerIntelView';
import EcoSimulatorView from './components/views/EcoSimulatorView';
import UnderConstruction from './components/shared/UnderConstruction';
import LandingPageView from './components/views/LandingPageView';

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('market-insights');
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const handleStartJourney = (profileData: UserProfile) => {
    setUser(profileData);
    setHasStarted(true);
  };

  if (!hasStarted) {
    return <LandingPageView onStart={handleStartJourney} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'market-insights':
        return <DashboardView user={user} onNavigate={setCurrentView} />;
      case 'profile':
        return <ProfileView user={user} onEdit={() => alert('Edit Profile clicked')} />;
      case 'news':
        return <NewsView onNavigate={setCurrentView} />;
      case 'career-intel':
        return <CareerIntelView user={user} />;
      case 'eco-simulator':
        return <EcoSimulatorView user={user} />;
      case 'settings':
        return <UnderConstruction viewName={currentView} onBack={() => setCurrentView('market-insights')} />;
      default:
        return <DashboardView user={user} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">
      <Navbar 
        user={user} 
        darkMode={darkMode} 
        toggleDarkMode={toggleDarkMode} 
        onProfileClick={() => setCurrentView('profile')}
      />
      
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <Sidebar 
          currentView={currentView} 
          onNavigate={setCurrentView} 
          user={user}
        />
        
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#0a0a0a]">
          <div className="max-w-[1400px] mx-auto pt-6 px-4 md:px-8 pb-8">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;