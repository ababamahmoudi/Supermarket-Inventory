import { useEffect, useState } from "react";
import { Toast } from "./ui";

/** A short confirmation at the bottom of the page that goes away by itself. */
export function useTimedToast(ms = 4000) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), ms);
    return () => window.clearTimeout(timer);
  }, [message, ms]);
  return [message ? <Toast>{message}</Toast> : null, setMessage] as const;
}
