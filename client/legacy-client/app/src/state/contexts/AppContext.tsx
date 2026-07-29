import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  /**
   * Global server availability status.
   * If false, the app should fall back to static/constants-based content.
   */
  serverAvailable: boolean;
  setServerAvailable: (available: boolean) => void;
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
  // Global server availability state
  const [serverAvailable, setServerAvailable] = useState<boolean>(true);

  return (
    <AppContext.Provider
      value={{
        serverAvailable,
        setServerAvailable,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
