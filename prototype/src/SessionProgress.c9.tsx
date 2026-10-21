import { useEffect, useState, type ReactNode } from "react";
import { appWorkPending, subscribeAppWork } from "./app-work";
import "./session-progress-c9.css";

/** Startup has no prior workspace. Fast starts do not mount an auth card. */
export function InitialSessionLoading({ children }: { children: ReactNode }) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setElapsed(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return elapsed ? children : <div className="initial-session-loading" />;
}

/** Observe actual work leases, including overlapping operations, without data. */
export function SessionProgress({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let pending = appWorkPending();
    let timer: number | undefined;
    const start = () => {
      timer = window.setTimeout(() => setVisible(true), 300);
    };
    if (pending) start();
    const unsubscribe = subscribeAppWork(() => {
      const next = appWorkPending();
      if (next === pending) return;
      pending = next;
      window.clearTimeout(timer);
      if (pending) start();
      else setVisible(false);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
  return visible ? (
    <div className="session-progress" role="progressbar" aria-label={label}>
      <span />
    </div>
  ) : null;
}
