import { synchronizeThemeColor } from "./pwa-theme";
import { beginAppWork, subscribeAppWork } from "./app-work";
import { observeUnsavedEditors, updateSafe } from "./pwa-safety";
export type PwaStatus = { available: boolean; safe: boolean; failed: boolean };
const initial: PwaStatus = { available: false, safe: true, failed: false };
let status = initial;
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | null = null;
let editors: ReturnType<typeof observeUnsavedEditors> | null = null;
let newerController = false;
let requestedUpdate = false;
function emit(patch: Partial<PwaStatus> = {}) {
  const next = {
    ...status,
    ...patch,
    safe: editors ? updateSafe(document, editors.pending()) : true,
  };
  if (
    Object.keys(next).every(
      (key) => next[key as keyof PwaStatus] === status[key as keyof PwaStatus],
    )
  )
    return;
  status = next;
  for (const listener of listeners) listener();
  // An in-progress agreement must be invalidated by new work in any open tab.
  if (!status.safe) registration?.waiting?.postMessage({ type: "APP_BUSY" });
}
export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const pwaSnapshot = () => status;
export async function startPwa(): Promise<() => void> {
  if (
    !import.meta.env.PROD ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return () => undefined;
  synchronizeThemeColor(document);
  const themeObserver = new MutationObserver(() =>
    synchronizeThemeColor(document),
  );
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "style"],
  });
  editors = observeUnsavedEditors(document, () => emit());
  const unsubscribe = subscribeAppWork(() => emit());
  let releasePrinting: (() => void) | null = null;
  const printStart = () => {
    releasePrinting ??= beginAppWork();
  };
  const printEnd = () => {
    releasePrinting?.();
    releasePrinting = null;
  };
  const safe = () => !!editors && updateSafe(document, editors.pending());
  let hadController = Boolean(navigator.serviceWorker.controller);
  const message = (event: MessageEvent) => {
    if (
      event.data?.type === "CAN_UPDATE" &&
      typeof event.data.request === "string"
    ) {
      const worker = event.source as ServiceWorker | null;
      worker?.postMessage({
        type: "UPDATE_VOTE",
        request: event.data.request,
        safe: safe(),
      });
    }
  };
  const controllerChange = () => {
    if (!navigator.serviceWorker.controller) return;
    if (!hadController) {
      hadController = true;
      return;
    }
    // Only the tab whose user requested the update may reload, after a fresh check.
    newerController = true;
    if (requestedUpdate && safe()) window.location.reload();
    else emit({ available: true });
  };
  navigator.serviceWorker.addEventListener("message", message);
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    controllerChange,
  );
  window.addEventListener("beforeprint", printStart);
  window.addEventListener("afterprint", printEnd);
  try {
    registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}service-worker.js`,
      { updateViaCache: "none" },
    );
    const changed = () =>
      emit({ available: !!registration?.waiting || newerController });
    registration.addEventListener("updatefound", () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", changed);
    });
    changed();
  } catch {
    emit({ failed: true });
  }
  return () => {
    unsubscribe();
    themeObserver.disconnect();
    printEnd();
    editors?.dispose();
    editors = null;
    navigator.serviceWorker.removeEventListener("message", message);
    navigator.serviceWorker.removeEventListener(
      "controllerchange",
      controllerChange,
    );
    window.removeEventListener("beforeprint", printStart);
    window.removeEventListener("afterprint", printEnd);
  };
}
export function requestAppUpdate(): boolean {
  if (!editors || !updateSafe(document, editors.pending())) {
    emit();
    return false;
  }
  if (newerController) {
    window.location.reload();
    return true;
  }
  if (!registration?.waiting) return false;
  requestedUpdate = true;
  registration.waiting.postMessage({ type: "CHECK_UPDATE" });
  return true;
}
