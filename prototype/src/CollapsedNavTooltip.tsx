import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import "./collapsed-nav-tooltip.css";

/** The label belongs to the icon's hover/focus intent, outside sidebar stacking. */
export function CollapsedNavTooltip({
  enabled,
  label,
  children,
}: {
  enabled: boolean;
  label: string;
  children: ReactElement<
    ComponentPropsWithoutRef<"a"> & { ref?: React.Ref<HTMLAnchorElement> }
  >;
}) {
  const id = useId();
  const anchor = useRef<HTMLAnchorElement | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    setOpen(false);
  }
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const shown = enabled && open;
  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const showAfterDelay = () => {
    if (!enabled || timer.current !== null || open) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (hovered.current || focused.current) setOpen(true);
    }, 300);
  };
  const hideWithoutIntent = () => {
    if (hovered.current || focused.current) return;
    clearTimer();
    setOpen(false);
  };
  useEffect(() => {
    if (!enabled) {
      clearTimer();
      hovered.current = false;
      focused.current = false;
    }
    return clearTimer;
  }, [enabled]);
  useLayoutEffect(() => {
    if (!shown || !tooltip.current || !anchor.current) return;
    const node = tooltip.current;
    // Native top-layer placement also stays above a dialog opened in the app.
    if (typeof node.showPopover === "function") node.showPopover();
    const measure = () => {
      const trigger = anchor.current?.getBoundingClientRect();
      if (!trigger) return;
      const bounds = node.getBoundingClientRect();
      const rtl = document.documentElement.dir === "rtl";
      setPosition({
        left: Math.max(
          12,
          Math.min(
            rtl ? trigger.left - bounds.width - 12 : trigger.right + 12,
            window.innerWidth - bounds.width - 12,
          ),
        ),
        top: Math.max(
          12,
          Math.min(
            trigger.top + (trigger.height - bounds.height) / 2,
            window.innerHeight - bounds.height - 12,
          ),
        ),
      });
      node.dataset.side = rtl ? "left" : "right";
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      if (
        typeof node.hidePopover === "function" &&
        node.matches(":popover-open")
      )
        node.hidePopover();
    };
  }, [shown, label]);
  const original = children.props;
  return (
    <>
      {cloneElement(children, {
        ref: anchor,
        "aria-describedby": shown
          ? [original["aria-describedby"], id].filter(Boolean).join(" ")
          : original["aria-describedby"],
        onMouseEnter: (event) => {
          original.onMouseEnter?.(event);
          hovered.current = true;
          showAfterDelay();
        },
        onMouseLeave: (event) => {
          original.onMouseLeave?.(event);
          hovered.current = false;
          hideWithoutIntent();
        },
        onFocus: (event) => {
          original.onFocus?.(event);
          focused.current = true;
          showAfterDelay();
        },
        onBlur: (event) => {
          original.onBlur?.(event);
          focused.current = false;
          hideWithoutIntent();
        },
        onClick: (event) => {
          clearTimer();
          setOpen(false);
          original.onClick?.(event);
        },
        onKeyDown: (event) => {
          original.onKeyDown?.(event);
          if (event.key === "Escape") {
            clearTimer();
            setOpen(false);
          }
        },
      })}
      {shown &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="tooltip"
            popover="manual"
            className="collapsed-nav-tooltip"
            style={{ ...position, visibility: position ? "visible" : "hidden" }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
