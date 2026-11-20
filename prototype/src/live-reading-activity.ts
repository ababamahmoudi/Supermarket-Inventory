import { useEffect, useState, useSyncExternalStore } from "react";
import type { InvoiceReadDTO } from "./invoice-projections";

interface ActiveReading {
  attemptId: string;
  startedAt: string;
}
const active = new Map<string, ActiveReading>();
const listeners = new Set<() => void>();
const key = (company: string, invoice: string) =>
  JSON.stringify([company, invoice]);
const publish = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function markLiveReadingActive(
  company: string,
  invoice: string,
  attemptId: string,
  startedAt: string,
) {
  active.set(key(company, invoice), { attemptId, startedAt });
  publish();
}
export function clearLiveReadingActive(
  company: string,
  invoice: string,
  attemptId?: string,
) {
  const current = active.get(key(company, invoice));
  if (!current || (attemptId && current.attemptId !== attemptId)) return;
  active.delete(key(company, invoice));
  publish();
}
export function elapsedReadingTime(startedAt?: string, now = Date.now()) {
  const start = startedAt ? Date.parse(startedAt) : now;
  const seconds = Number.isFinite(start)
    ? Math.max(0, Math.floor((now - start) / 1000))
    : 0;
  return (
    String(Math.floor(seconds / 60)) +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}
export function useLiveReadingActivity(invoice: InvoiceReadDTO) {
  const reading = useSyncExternalStore(
    subscribe,
    () => {
      const current = active.get(key(invoice.company_id, invoice.id));
      return current?.attemptId === invoice.live_reading?.attempt_id
        ? current
        : null;
    },
    () => null,
  );
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!reading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [reading]);
  return {
    active: Boolean(reading),
    elapsed: elapsedReadingTime(reading?.startedAt, now),
  };
}
