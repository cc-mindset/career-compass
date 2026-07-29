import React, { createContext, useContext, useState, useCallback } from "react";

export interface EcoSimulatorData {
  layoff_chances_formula: string;
  career_demand_formula: string;
  career_growth_opportunities_formula: string;
  salary_increment_formula: string;
  simulation_insights: string[];
  tips: string;
  isRemaining: boolean;
}

interface EcoSimulatorContextType {
  data: EcoSimulatorData | null;
  loading: boolean;
  error: string | null;
  fetchEcoSimulatorData: (
    location: string,
    currentJobTitle: string,
    seniorityLevel: string,
  ) => Promise<void>;
}

const EcoSimulatorContext = createContext<EcoSimulatorContextType | undefined>(
  undefined,
);
const apiBase = import.meta.env.VITE_API_URL || "";

export const useEcoSimulator = () => {
  const context = useContext(EcoSimulatorContext);
  if (!context) {
    throw new Error("useEcoSimulator must be used within EcoSimulatorProvider");
  }
  return context;
};

export const EcoSimulatorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [data, setData] = useState<EcoSimulatorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEcoSimulatorData = useCallback(
    async (
      location: string,
      currentJobTitle: string,
      seniorityLevel: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiBase}/api/eco-simulator?location=${encodeURIComponent(location)}&current_job_title=${encodeURIComponent(currentJobTitle)}&seniority_level=${encodeURIComponent(seniorityLevel)}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch eco simulator data");
        }
        const result = await response.json();
        setData(result.data);
        if(result.data.isRemaining) {
          setTimeout(() => {
            fetchEcoSimulatorData(location, currentJobTitle, seniorityLevel);
          }, 5000); // Clear data after 5 seconds
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return (
    <EcoSimulatorContext.Provider
      value={{ data, loading, error, fetchEcoSimulatorData }}
    >
      {children}
    </EcoSimulatorContext.Provider>
  );
};
