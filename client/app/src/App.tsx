import React, { useState, useEffect } from "react";
import { INITIAL_USER } from "./consts";
import { AppView, UserProfile } from "./types";
import Sidebar from "./components/nav/Sidebar";
import Navbar from "./components/nav/Navbar";
import BottomNav from "./components/nav/BottomNav";
import MarketInsightView from "./views/market-insight";
import ProfileView from "./views/profile";
import CareerIntelView from "./views/career-intel";
import EcoSimulatorView from "./views/eco-simulator";
import { UnderConstruction } from "./ui-kit";
import LandingPageView from "./views/landing-page";
import { AppProvider } from "./state/contexts/AppContext";
import {
  MarketInsightsProvider,
  useMarketInsightsState,
} from "./state/marketInsights/MarketInsightsContext";
import { SignedIn, useUser } from "@clerk/clerk-react";
import SyncUser from "./views/landing-page/sync-user";
import AuthPage from "./views/auth";
import { useUserContext } from "./state/contexts/user";

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>("market-insights");
  const { setLoadingStage } = useMarketInsightsState();
  const { updateUserProfile, user: userContext, setHasJourneyStarted: setHasStarted } = useUserContext();
  const user = userContext?.profile || INITIAL_USER;
  const hasStarted = userContext?.hasJourneyStarted || false;
  
  const { user: authUser } = useUser();

  const handleStartJourney = (profileData: UserProfile) => {
    updateUserProfile(profileData);
    setHasStarted(true);
  };

  // Reset loading state when navigating to market-insights
  useEffect(() => {
    if (currentView === "market-insights" && hasStarted) {
      setLoadingStage("idle");
    }
  }, [currentView, hasStarted, setLoadingStage]);

  if (!hasStarted) {
    return <LandingPageView onStart={handleStartJourney} />;
  }

  const renderView = () => {
    switch (currentView) {
      case "market-insights":
        return <MarketInsightView user={user} onNavigate={setCurrentView} />;
      case "profile":
        return (
          <ProfileView
            user={user}
            onEdit={() => alert("Edit Profile clicked")}
          />
        );
      case "career-intel":
        return <CareerIntelView user={user} />;
      case "eco-simulator":
        return <EcoSimulatorView user={user} />;
      case "settings":
        return (
          <UnderConstruction
            viewName={currentView}
            onBack={() => setCurrentView("market-insights")}
          />
        );
      default:
        return <MarketInsightView user={user} onNavigate={setCurrentView} />;
    }
  };

  if (!authUser) {
    return <AuthPage />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <SignedIn>
        <SyncUser />
      </SignedIn>
      <Navbar user={user} onProfileClick={() => setCurrentView("profile")} />

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          user={user}
        />

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className="max-w-[1400px] mx-auto pt-6 px-4 md:px-8 pb-20 lg:pb-8">
            {renderView()}
          </div>
        </main>
      </div>

      <BottomNav currentView={currentView} onNavigate={setCurrentView} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MarketInsightsProvider>
        <AppContent />
      </MarketInsightsProvider>
    </AppProvider>
  );
};

export default App;
