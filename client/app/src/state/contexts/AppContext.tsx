import React, { createContext, useContext, ReactNode } from 'react';
import {
  useMarketInsightsState,
  MarketInsightsLoadingStage,
} from '../marketInsights/MarketInsightsContext';

interface AppContextType {
  // Re‑expose all market insights API + loading state globally
  marketInsightsLoadingStage: MarketInsightsLoadingStage;
  setMarketInsightsLoadingStage: (stage: MarketInsightsLoadingStage) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // Pull all market insights state from its dedicated context
  const { loadingStage, setLoadingStage } = useMarketInsightsState();

  return (
    <AppContext.Provider
      value={{
        marketInsightsLoadingStage: loadingStage,
        setMarketInsightsLoadingStage: setLoadingStage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
