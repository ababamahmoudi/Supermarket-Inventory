import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A single visible line, with the complete value retained in its native tooltip. */
export function FitText({
  value,
  className,
  render,
}: {
  value: string;
  className?: string;
  render?: (visible: string) => ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(value);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      if (typeof CanvasRenderingContext2D === "undefined") return;
      const style = getComputedStyle(element);
      const width =
        element.clientWidth -
        parseFloat(style.paddingInlineStart || "0") -
        parseFloat(style.paddingInlineEnd || "0") -
        4; // Leave room for glyph overhang and tabular-number advance widths.
      if (width <= 0) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if (context.measureText(value).width <= width) {
        setVisible(value);
        return;
      }
      const points = Array.from(value);
      let low = 0,
        high = points.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (
          context.measureText(`${points.slice(0, middle).join("").trimEnd()}…`)
            .width <=
          width - 1
        )
          low = middle;
        else high = middle - 1;
      }
      setVisible(`${points.slice(0, low).join("").trimEnd()}…`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [value]);
  return (
    <span ref={ref} className={className} title={value}>
      {render ? render(visible) : visible}
    </span>
  );
}
