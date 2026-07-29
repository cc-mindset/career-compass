import { ReactNode } from "react";

export interface StepConfig {
  key: string;
  label: string;
  placeholder: string;
  icon: ReactNode;
  options: string[];
  allowCustom?: boolean;
}
