import React, { createContext, useContext, useState, ReactNode } from 'react';

type MarketInsightsLoadingStage = 'idle' | 'first' | 'second' | 'third' | 'complete';

interface AppContextType {
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
  const [marketInsightsLoadingStage, setMarketInsightsLoadingStage] = useState<MarketInsightsLoadingStage>('idle');

  return (
    <AppContext.Provider
      value={{
        marketInsightsLoadingStage,
        setMarketInsightsLoadingStage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
