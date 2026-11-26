import { useLayoutEffect, type RefObject } from "react";

/** Keep footer action tracks and scroll-edge fades tied to the actual dialog. */
export function useDialogScrollEdges(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
): void {
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    let frame = 0;
    const observed = new Set<HTMLElement>();
    const resize = new ResizeObserver(() => schedule());
    const measure = () => {
      for (const footer of dialog.querySelectorAll<HTMLElement>(
        ".ui-dialog-actions, .dialog-actions, .c3-dialog-actions, .product-editor-actions",
      )) {
        if (footer.closest("dialog") !== dialog) continue;
        const count = [
          ...footer.querySelectorAll<HTMLElement>(
            ":scope > .ui-button.button:not(.ui-icon-button)",
          ),
        ].filter(
          (button) =>
            !button.hidden && getComputedStyle(button).display !== "none",
        ).length;
        const value = String(Math.max(1, count));
        if (
          footer.style.getPropertyValue("--dialog-footer-action-count") !==
          value
        )
          footer.style.setProperty("--dialog-footer-action-count", value);
      }
      const candidates = [dialog, ...dialog.querySelectorAll<HTMLElement>("*")];
      for (const element of candidates) {
        if (
          element.matches("textarea, input") ||
          element.closest(".ui-popover, [role='listbox']") ||
          !["auto", "scroll"].includes(getComputedStyle(element).overflowY)
        )
          continue;
        if (!observed.has(element)) {
          resize.observe(element);
          observed.add(element);
        }
        element.dataset.dialogScroll = "";
        const maximum = element.scrollHeight - element.clientHeight;
        element.dataset.dialogScrollStart = String(element.scrollTop > 1);
        element.dataset.dialogScrollEnd = String(
          maximum - element.scrollTop > 1,
        );
      }
    };
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    resize.observe(dialog);
    const mutation = new MutationObserver(schedule);
    mutation.observe(dialog, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "class", "style"],
    });
    dialog.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
      dialog.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      for (const element of observed) {
        delete element.dataset.dialogScroll;
        delete element.dataset.dialogScrollStart;
        delete element.dataset.dialogScrollEnd;
      }
    };
  }, [ref, open]);
}
