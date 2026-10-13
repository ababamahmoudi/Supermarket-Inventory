import { createContext, useContext } from "react";
import type { CompanyConfig } from "./types";

export const SettingsConfigurationContext = createContext<CompanyConfig | null>(
  null,
);
export function useSettingsConfiguration(): CompanyConfig {
  const value = useContext(SettingsConfigurationContext);
  if (!value)
    throw new Error("Protected settings configuration is not loaded.");
  return value;
}
