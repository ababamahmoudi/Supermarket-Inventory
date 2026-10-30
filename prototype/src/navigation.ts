import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useDemo } from "./store";
import { deferTimesheetNavigation } from "./screens/timesheet-save-context";

const prefix = "supermarket-navigation-v1";
const fallback = new Map<string, string>();

export function navigationKey(
  company: string,
  username: string,
  location: string,
  field: string,
) {
  return JSON.stringify([prefix, company, username, location, field]);
}
export function readNavigationValue<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === undefined || raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    try {
      const raw = fallback.get(key);
      return raw === undefined ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  }
}
export function saveNavigationValue<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  fallback.set(key, raw);
  try {
    sessionStorage.setItem(key, raw);
  } catch {
    /* Keep current-session preferences when storage is unavailable. */
  }
}

/** Preserve list filters without sharing them between users, companies or locations. */
export function useListState<T>(
  field: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const { state, user, branch } = useDemo();
  const key = navigationKey(
    state.config.company.seed_key,
    user?.username ?? "signed-out",
    branch,
    field,
  );
  const initialValue = () =>
    typeof initial === "function" ? (initial as () => T)() : initial;
  const [entry, setEntry] = useState(() => ({
    key,
    value: readNavigationValue(key, initialValue()),
  }));
  if (entry.key !== key) {
    setEntry({ key, value: readNavigationValue(key, initialValue()) });
  }
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setEntry((previous) => {
        // A delayed callback from another person/location must not change
        // the active filters or initialize its old key with another default.
        if (previous.key !== key) return previous;
        const value =
          typeof next === "function"
            ? (next as (current: T) => T)(previous.value)
            : next;
        saveNavigationValue(key, value);
        return Object.is(previous.value, value) ? previous : { key, value };
      });
    },
    [key],
  );
  return [entry.value, setValue];
}

function subscribeRoute(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
export function useRouteParam(name: string): string | null {
  const get = useCallback(
    () =>
      new URLSearchParams(window.location.hash.split("?")[1] ?? "").get(name),
    [name],
  );
  return useSyncExternalStore(subscribeRoute, get, () => null);
}

/** Remember the source of an invoice within this person's location/session scope. */
export function rememberInvoiceReturnRoute(
  company: string,
  username: string,
  location: string,
  from: string,
  to: string,
) {
  const [page, query = ""] = to.replace(/^#/, "").split("?");
  const invoiceId = new URLSearchParams(query).get("id");
  if (page !== "invoices" || !invoiceId) return;
  const [fromPage, fromQuery = ""] = from.replace(/^#/, "").split("?");
  // Editing, posting and switching content versions keep the genuine entry page.
  if (fromPage === "invoices" && new URLSearchParams(fromQuery).has("id"))
    return;
  const destination =
    fromPage === "invoices" || !fromPage ? "#invoices?tab=posted" : from;
  if (!/^#[a-z][a-z0-9-]*(?:\?.*)?$/.test(destination)) return;
  saveNavigationValue(
    navigationKey(company, username, location, `invoice-return:${invoiceId}`),
    destination,
  );
}

export function readInvoiceReturnRoute(
  company: string,
  username: string,
  location: string,
  invoiceId: string,
) {
  const destination = readNavigationValue(
    navigationKey(company, username, location, `invoice-return:${invoiceId}`),
    "#invoices?tab=posted",
  );
  return /^#[a-z][a-z0-9-]*(?:\?.*)?$/.test(destination)
    ? destination
    : "#invoices?tab=posted";
}

interface RouteScroll {
  top: number;
  left: number;
  panels: { top: number; left: number }[];
}
/** Hash routes still participate in browser Back; restore after the new list is rendered. */
export function useNavigationRestoration() {
  const { state, user, branch } = useDemo();
  const company = state.config.company.seed_key;
  const username = user?.username ?? "signed-out";
  useEffect(() => {
    let route = window.location.hash;
    let frame = 0;
    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const key = (hash: string) =>
      navigationKey(company, username, branch, `scroll:${hash}`);
    const panels = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("#main-content .table-wrap"),
      );
    const save = () =>
      saveNavigationValue<RouteScroll>(key(route), {
        top: window.scrollY,
        left: window.scrollX,
        panels: panels().map((panel) => ({
          top: panel.scrollTop,
          left: panel.scrollLeft,
        })),
      });
    const onScroll = () => {
      if (window.location.hash === route) save();
    };
    const restore = () => {
      const saved = readNavigationValue<RouteScroll | null>(key(route), null);
      if (saved) {
        if (saved.top || saved.left || window.scrollY || window.scrollX)
          window.scrollTo({
            top: saved.top,
            left: saved.left,
            behavior: "instant",
          });
        panels().forEach((panel, index) => {
          panel.scrollTop = saved.panels[index]?.top ?? 0;
          panel.scrollLeft = saved.panels[index]?.left ?? 0;
        });
      } else if (window.scrollY || window.scrollX) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    };
    const onRoute = (event: HashChangeEvent) => {
      if (deferTimesheetNavigation(event)) return;
      save();
      rememberInvoiceReturnRoute(
        company,
        username,
        branch,
        route,
        window.location.hash,
      );
      route = window.location.hash;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(restore);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("hashchange", onRoute);
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(restore);
    });
    return () => {
      save();
      window.cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousMode;
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("hashchange", onRoute);
    };
  }, [company, username, branch]);
}
