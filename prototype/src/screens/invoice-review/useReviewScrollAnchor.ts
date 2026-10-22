import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/** Keep the used control in place while its receiving layout changes. */
export function useReviewScrollAnchor() {
  const position = useRef<{
    element: HTMLElement;
    top: number;
    scrollY: number;
  } | null>(null);
  const adjustingScroll = useRef<number | null>(null);
  const clear = useCallback(() => {
    position.current = null;
    adjustingScroll.current = null;
  }, []);
  const anchor = useCallback((element?: HTMLElement) => {
    if (element)
      position.current = {
        element,
        top: element.getBoundingClientRect().top,
        scrollY: window.scrollY,
      };
  }, []);
  useEffect(() => {
    const scrolled = () => {
      if (
        (adjustingScroll.current !== null &&
          Math.abs(window.scrollY - adjustingScroll.current) <= 0.25) ||
        (position.current !== null &&
          Math.abs(window.scrollY - position.current.scrollY) <= 0.25)
      ) {
        adjustingScroll.current = null;
        return;
      }
      clear();
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => window.removeEventListener("scroll", scrolled);
  }, [clear]);
  useLayoutEffect(() => {
    const saved = position.current;
    if (!saved) return;
    // Scroll events are asynchronous. A render can arrive after an external
    // scroll but before its event; never restore an earlier viewport then.
    if (
      !saved.element.isConnected ||
      Math.abs(window.scrollY - saved.scrollY) > 0.25
    ) {
      clear();
      return;
    }
    const delta = saved.element.getBoundingClientRect().top - saved.top;
    if (Math.abs(delta) > 0.25) {
      const before = window.scrollY;
      window.scrollBy({ top: delta, behavior: "instant" });
      saved.scrollY = window.scrollY;
      adjustingScroll.current =
        window.scrollY !== before ? window.scrollY : null;
    }
  });
  return { anchor, clear };
}
