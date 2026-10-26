import { createContext } from "react";

export const TimesheetSaveContext = createContext<{
  register: (id: string, flush: () => Promise<boolean>) => () => void;
} | null>(null);
