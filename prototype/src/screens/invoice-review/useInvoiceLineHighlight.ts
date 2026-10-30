import { useEffect } from "react";
import { useRouteParam } from "../../navigation";

/** Navigation to delivery evidence is an explicit request to move to that line. */
export function useInvoiceLineHighlight(invoiceId: string, ready: boolean) {
  const lineId = useRouteParam("line");
  useEffect(() => {
    if (!ready || lineId === null || lineId === "") return;
    let target: HTMLElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-line-id]"),
      ).find((element) => element.dataset.lineId === lineId);
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "instant" });
      target.classList.add("invoice-line-target");
      timer = setTimeout(
        () => target?.classList.remove("invoice-line-target"),
        2000,
      );
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      target?.classList.remove("invoice-line-target");
    };
  }, [invoiceId, lineId, ready]);
}
