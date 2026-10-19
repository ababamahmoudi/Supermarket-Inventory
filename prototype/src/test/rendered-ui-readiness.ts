/** Test-only actual DOM readiness; no timer, state/permission mock, or production import. */
const observers = new Set<MutationObserver>();
/** The unchanged Vitest test budget detects a condition that never becomes true. */
export function renderedUiReady(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      observer.disconnect();
      observers.delete(observer);
    };
    const check = () => {
      try {
        if (!condition()) return;
        finish();
        resolve();
      } catch (cause) {
        finish();
        reject(cause);
      }
    };
    const observer = new MutationObserver(check);
    observers.add(observer);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    check();
  });
}
/** Disconnect before React cleanup so an old case can never observe a later one. */
export function clearRenderedUiReadiness(): void {
  for (const observer of observers) observer.disconnect();
  observers.clear();
}
