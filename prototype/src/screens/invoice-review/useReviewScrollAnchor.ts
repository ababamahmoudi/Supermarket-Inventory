import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/** Keep the used control in place while its receiving layout changes. */
export function useReviewScrollAnchor(
  scrollParent?: (element: HTMLElement) => HTMLElement | null,
) {
  const position = useRef<{
    element: HTMLElement;
    top: number;
    scrollTop: number;
    parent: HTMLElement | null;
  } | null>(null);
  const adjustingScroll = useRef<number | null>(null);
  const clear = useCallback(() => {
    position.current = null;
    adjustingScroll.current = null;
  }, []);
  const anchor = useCallback(
    (element?: HTMLElement) => {
      if (element) {
        const parent = scrollParent?.(element) ?? null;
        position.current = {
          element,
          top: element.getBoundingClientRect().top,
          scrollTop: parent ? parent.scrollTop : window.scrollY,
          parent,
        };
      }
    },
    [scrollParent],
  );
  useEffect(() => {
    const scrolled = (event: Event) => {
      const saved = position.current;
      if (
        !saved ||
        (saved.parent
          ? event.target !== saved.parent
          : event.target !== window && event.target !== document)
      )
        return;
      const top = saved.parent ? saved.parent.scrollTop : window.scrollY;
      if (
        (adjustingScroll.current !== null &&
          Math.abs(top - adjustingScroll.current) <= 0.25) ||
        (position.current !== null &&
          Math.abs(top - position.current.scrollTop) <= 0.25)
      ) {
        adjustingScroll.current = null;
        return;
      }
      clear();
    };
    window.addEventListener("scroll", scrolled, {
      passive: true,
      capture: true,
    });
    return () => window.removeEventListener("scroll", scrolled, true);
  }, [clear]);
  useLayoutEffect(() => {
    const saved = position.current;
    if (!saved) return;
    // Scroll events are asynchronous. A render can arrive after an external
    // scroll but before its event; never restore an earlier viewport then.
    if (
      !saved.element.isConnected ||
      (saved.parent && !saved.parent.isConnected) ||
      Math.abs(
        (saved.parent ? saved.parent.scrollTop : window.scrollY) -
          saved.scrollTop,
      ) > 0.25
    ) {
      clear();
      return;
    }
    const delta = saved.element.getBoundingClientRect().top - saved.top;
    if (Math.abs(delta) > 0.25) {
      const before = saved.parent ? saved.parent.scrollTop : window.scrollY;
      if (saved.parent)
        saved.parent.scrollBy({ top: delta, behavior: "instant" });
      else window.scrollBy({ top: delta, behavior: "instant" });
      saved.scrollTop = saved.parent ? saved.parent.scrollTop : window.scrollY;
      adjustingScroll.current =
        saved.scrollTop !== before ? saved.scrollTop : null;
    }
  });
  return { anchor, clear };
}
