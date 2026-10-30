import { createContext, useContext, useSyncExternalStore } from "react";
import type { InvoiceReadDTO } from "./invoice-projections";
import type { LiveInvoiceReadingService } from "./live-invoice-reading-service";
export const LiveReadingContext =
  createContext<LiveInvoiceReadingService | null>(null);
export function useOptionalLiveInvoiceReadingService() {
  return useContext(LiveReadingContext);
}
export function useLiveInvoiceReadingService() {
  const service = useOptionalLiveInvoiceReadingService();
  if (!service) throw new Error("The app reading service is unavailable.");
  return service;
}
export function useLiveInvoiceReadingOperation(invoice: InvoiceReadDTO) {
  const service = useLiveInvoiceReadingService();
  return useSyncExternalStore(
    service.subscribe,
    () => service.snapshot(invoice.company_id, invoice.id),
    () => service.snapshot(invoice.company_id, invoice.id),
  );
}
