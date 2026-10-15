import { appWorkPending } from "./app-work";

/** Real dirty controls are kept only while mounted; no values leave this tab. */
export function observeUnsavedEditors(document: Document, changed: () => void) {
  const initial = new WeakMap<Element, string>();
  const dirty = new Set<Element>();
  const value = (element: Element) =>
    element instanceof HTMLInputElement
      ? element.type === "checkbox" || element.type === "radio"
        ? String(element.checked)
        : element.value
      : element instanceof HTMLTextAreaElement
        ? element.value
        : (element.getAttribute("aria-checked") ?? "");
  const eligible = (target: EventTarget | null): target is Element =>
    target instanceof Element &&
    target.matches("input, textarea, [role='checkbox'], [role='switch']") &&
    !target.closest("[data-pwa-safe-control]");
  const capture = (event: Event) => {
    if (eligible(event.target) && !initial.has(event.target))
      initial.set(event.target, value(event.target));
  };
  const update = (event: Event) => {
    if (!eligible(event.target)) return;
    const element = event.target;
    // A directly dispatched input with no earlier focus is conservatively dirty.
    if (!initial.has(element) || initial.get(element) !== value(element))
      dirty.add(element);
    else dirty.delete(element);
    changed();
  };
  document.addEventListener("focusin", capture, true);
  document.addEventListener("pointerdown", capture, true);
  document.addEventListener("input", update, true);
  document.addEventListener("change", update, true);
  document.addEventListener("click", update, true);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const element = record.target;
      if (record.type !== "attributes" || !eligible(element)) continue;
      if (initial.has(element) && initial.get(element) !== value(element))
        dirty.add(element);
      else if (initial.has(element)) dirty.delete(element);
    }
    for (const element of dirty)
      if (!element.isConnected) dirty.delete(element);
    changed();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-checked", "value"],
  });
  return {
    pending: () => {
      for (const element of dirty)
        if (!element.isConnected) dirty.delete(element);
      return dirty.size > 0;
    },
    dispose: () => {
      document.removeEventListener("focusin", capture, true);
      document.removeEventListener("pointerdown", capture, true);
      document.removeEventListener("input", update, true);
      document.removeEventListener("change", update, true);
      document.removeEventListener("click", update, true);
      observer.disconnect();
      dirty.clear();
    },
  };
}
export function updateSafe(document: Document, dirty: boolean): boolean {
  return (
    !appWorkPending() &&
    !dirty &&
    !document.querySelector("[role='dialog'], [data-pwa-unsaved='true']")
  );
}
