import { useLayoutEffect, type RefObject } from "react";

const footerSelector =
  ".bottom-bar, .invoice-action-footer, .labels-selection-bar, .sticky-actions, [data-sticky-actions], .receiving-progress, dialog[open] .dialog-actions, dialog[open] .ui-dialog-actions, dialog[open] .c3-dialog-actions, dialog[open] .product-editor-actions";

/** Keep page feedback above actual bottom controls and any higher-priority stack. */
export function useFloatingFeedbackOffset(
  ref: RefObject<HTMLElement | null>,
  property: string,
  above?: string,
) {
  // Run after each commit because Undo can mount/unmount or move into its
  // owning dialog. No observer, offset or page stack is retained for inline Undo.
  useLayoutEffect(() => {
    const stack = ref.current;
    if (!stack) return;
    let frame = 0;
    const observed = new Set<Element>();
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => schedule());
    const measure = () => {
      // Fixed controls use the layout viewport, including mobile page scaling.
      const height =
        window.innerHeight || document.documentElement.clientHeight;
      let offset = 24;
      const current = new Set<Element>();
      for (const bar of document.querySelectorAll<HTMLElement>(
        footerSelector,
      )) {
        current.add(bar);
        const style = getComputedStyle(bar);
        const bounds = bar.getBoundingClientRect();
        if (
          !bounds.height ||
          style.visibility === "hidden" ||
          style.display === "none" ||
          bounds.bottom > height + 2 ||
          bounds.top < 0
        )
          continue;
        // Receiving's desktop strip is a sticky TOP header, not a footer.
        if (
          bar.matches(".receiving-progress") &&
          (style.position !== "fixed" || style.bottom === "auto")
        )
          continue;
        if (
          ["fixed", "sticky"].includes(style.position) ||
          bounds.bottom > height - 120
        )
          offset = Math.max(offset, height - bounds.top + 12);
      }
      for (const peer of above
        ? document.querySelectorAll<HTMLElement>(above)
        : []) {
        current.add(peer);
        const bounds = peer.getBoundingClientRect();
        const style = getComputedStyle(peer);
        if (
          bounds.height &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          bounds.bottom <= height + 2 &&
          bounds.top >= 0
        )
          offset = Math.max(offset, height - bounds.top + 8);
      }
      for (const element of observed)
        if (!current.has(element)) {
          resize?.unobserve(element);
          observed.delete(element);
        }
      for (const element of current)
        if (!observed.has(element)) {
          resize?.observe(element);
          observed.add(element);
        }
      // RTL mobile layout overflow can move the natural fixed anchor offscreen.
      // Correct only that measured overflow, retaining the normal anchor when it fits.
      const bounds = stack.getBoundingClientRect();
      if (bounds.width) {
        const previous =
          parseFloat(
            stack.style.getPropertyValue("--floating-feedback-inline-shift"),
          ) || 0;
        const left = bounds.left - previous;
        const right = bounds.right - previous;
        const shift =
          left < 16
            ? 16 - left
            : right > window.innerWidth - 16
              ? window.innerWidth - 16 - right
              : 0;
        const inline = `${Math.round(shift * 100) / 100}px`;
        if (
          stack.style.getPropertyValue("--floating-feedback-inline-shift") !==
          inline
        )
          stack.style.setProperty("--floating-feedback-inline-shift", inline);
      }
      const value = `${Math.ceil(offset)}px`;
      if (stack.style.getPropertyValue(property) !== value)
        stack.style.setProperty(property, value);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "open"],
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      cancelAnimationFrame(frame);
    };
  });
}
