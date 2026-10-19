/** Tab-local work tokens. These never contain business records or identities. */
const leases = new Set<symbol>();
const listeners = new Set<() => void>();
function changed() {
  for (const listener of listeners) listener();
}
export function beginAppWork(): () => void {
  const lease = Symbol();
  leases.add(lease);
  changed();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    leases.delete(lease);
    changed();
  };
}
export function appWorkPending(): boolean {
  return leases.size > 0;
}
export function subscribeAppWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Wrap the actual asynchronous methods; preserve their arguments/results/errors. */
export function trackAppWork<T extends object>(
  target: T,
  names: (keyof T)[],
): T {
  for (const name of names) {
    const operation = target[name];
    if (typeof operation !== "function") throw new Error("app_work_method");
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: (...args: unknown[]) => {
        const release = beginAppWork();
        try {
          const result: unknown = Reflect.apply(operation, target, args);
          return Promise.resolve(result).finally(release);
        } catch (error) {
          release();
          throw error;
        }
      },
    });
  }
  return target;
}
