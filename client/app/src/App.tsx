import React, { useState, useEffect } from "react";
import { NAVIGATION_ITEMS, BOTTOM_NAV_ITEMS, INITIAL_USER, } from "./consts/constants";
import { AppView, UserProfile } from "./utils/types/types";
import Sidebar from "./components/nav/Sidebar";
import Navbar from "./components/nav/Navbar";
import BottomNav from "./components/nav/BottomNav";

import MarketInsightView from "./components/views/MarketInsightView";
import ProfileView from "./components/views/ProfileView";
import CareerIntelView from "./components/views/CareerIntelView";
import EcoSimulatorView from "./components/views/EcoSimulatorView";
import LandingPageView from "./components/views/LandingPageView";

import { UnderConstruction } from "./ui-kit";

import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from "@clerk/clerk-react";
import { MarketInsightsProvider, useMarketInsightsState } from "./state/marketInsights/MarketInsightsContext";


// Component to sync user data with backend
function UserSync() {
  const { user, isLoaded } = useUser();
  const hasSyncedRef = React.useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || hasSyncedRef.current) return;

    hasSyncedRef.current = true;

    fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkId: { type: String, unique: true, index: true },
        email: { type: String },

        // clerkId: user.id,
        // email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
      }),
    }).catch((err) => console.error("Failed to sync user:", err));
  }, [isLoaded, user]);

  // Previous code - caused multiple calls to backend on re-render
  // useEffect(() => {
  //   if (isLoaded && user) {
  //     // Sync user data with backend MongoDB
  //     fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         clerkId: user.id,
  //         email: user.primaryEmailAddress?.emailAddress,
  //         firstName: user.firstName,
  //         lastName: user.lastName,
  //       }),
  //     }).catch(err => console.error('Failed to sync user:', err));
  //   }
  // }, [isLoaded, user]);

  return null;
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>("market-insights");
  const [user, setUser] = useState<UserProfile>(INITIAL_USER); //stores UserProfile data in useState
  const { setLoadingStage } = useMarketInsightsState();

  const { user: clerkUser, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;

    setUser({
      ...INITIAL_USER,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      role: "User",
      location: "",
      experience: "",
    });
  }, [isLoaded, clerkUser]);

  const renderView = () => {
    switch (currentView) {
      case "market-insights":
        return <MarketInsightView user={user} onNavigate={setCurrentView} />;
      case "profile":
        return <ProfileView user={user} onEdit={() => alert("Edit Profile clicked")} />;
      case "career-intel":
        return <CareerIntelView user={user} />;
      case "eco-simulator":
        return <EcoSimulatorView user={user} />;
      case "settings":
        return <UnderConstruction viewName={currentView} onBack={() => setCurrentView("market-insights")} />;
      default:
        return <MarketInsightView user={user} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
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
  
  // Temporary code for landing page flow
  const [enteredApp, setEnteredApp] = useState(false);

  return (
    <MarketInsightsProvider>
      {/* Previous LandingView code */}
      {/* <SignedOut>
        <LandingPageView onStart={() => {}} />
      </SignedOut> */}

      {/* Temporary code for landing page flow - remove after */}
      <SignedOut>
        <LandingPageView onStart={() => setEnteredApp(true)} />
      </SignedOut>

      <SignedIn>
        {!enteredApp ? (
          <LandingPageView onStart={() => setEnteredApp(true)} />
        ) : (
          <>
            <UserSync />
            <AppContent />
          </>
        )}
      </SignedIn>

      {/* Current Working Code - Still has errors */}
      {/* <SignedOut>
        <div className="h-screen flex flex-col items-center justify-center gap-6">
          <LandingPageView onStart={() => {}} />

          <SignInButton mode="modal">
            <button className="px-6 py-3 rounded-lg bg-black text-white">
              Sign in / Sign up
            </button>
          </SignInButton>
        </div>

        <button className="px-6 py-3 rounded-lg bg-black text-white">
          Sign Out
        </button>
      </SignedOut>

      <SignedIn>
        <UserSync />
        <AppContent />
      </SignedIn> */}
    </MarketInsightsProvider>

    // Previous Code
    // <AppProvider> {/* Remove AppProvider*/}
    // <MarketInsightsProvider>
    //   <AppContent />
    // </MarketInsightsProvider>
    // </AppProvider> {/* Remove AppProvider */}
  );
};

export default App;
