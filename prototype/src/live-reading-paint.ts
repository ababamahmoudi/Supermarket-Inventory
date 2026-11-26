/** Give a real visible phase a paint opportunity without blocking hidden tabs.
 * The short timer bounds a throttled scheduler; it is not simulated progress.
 */
export function paintLiveReadingStage(signal: AbortSignal): Promise<void> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (typeof document === "undefined" || document.visibilityState === "hidden")
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    let first: number | undefined;
    let second: number | undefined;
    let finished = false;
    const finish = (cancelled = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      if (first !== undefined) cancelAnimationFrame(first);
      if (second !== undefined) cancelAnimationFrame(second);
      signal.removeEventListener("abort", abort);
      document.removeEventListener("visibilitychange", visibility);
      if (cancelled) reject(new DOMException("Cancelled", "AbortError"));
      else resolve();
    };
    const abort = () => finish(true);
    const visibility = () => {
      if (document.visibilityState === "hidden") finish();
    };
    const fallback = setTimeout(() => finish(), 50);
    signal.addEventListener("abort", abort, { once: true });
    document.addEventListener("visibilitychange", visibility);
    if (typeof requestAnimationFrame === "function")
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => finish());
      });
    else queueMicrotask(() => finish());
  });
}
