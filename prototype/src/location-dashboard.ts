import type { AuthenticatedActor } from "./authority-types";
import { actorAtLocation, freshActor } from "./authority";
import {
  can,
  requireCapability,
  resolveLocationSelection,
} from "./permissions";
import { companyDate, dateAfter } from "./invoice";
import { receivedLog } from "./received";
import {
  activeTrackedDates,
  dateIsDueSoon,
  trackedDateDaysLeft,
} from "./date-tracking";
import { readableNotebookEntries } from "./notebooks";
import { listBranchRequests } from "./branch-requests";
import type { DemoState } from "./types";

export interface LocationDashboardRow {
  id: string;
  location_id: string;
  title_en: string;
  title_fa?: string;
  code?: string;
  date?: string;
  status?: string;
  href: string;
}
export interface LocationDashboardDTO {
  location_ids: readonly string[];
  arrivals: LocationDashboardRow[];
  sales: LocationDashboardRow[];
  dates: LocationDashboardRow[];
  returns: LocationDashboardRow[];
  requests: LocationDashboardRow[];
  notes: LocationDashboardRow[];
}
/** A narrow operational DTO: no ledger, invoice costs, margin, balance or private approval. */
export function locationDashboardView(
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
): LocationDashboardDTO {
  const current = freshActor(state, actor);
  requireCapability(
    state,
    current,
    "dashboard.location",
    { company_id: current.company_id, kind: "company_shared" },
    now,
  );
  const ids = resolveLocationSelection(state, current, current.selection),
    locations = new Set(ids);
  const today = companyDate(state.config, now),
    weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = dateAfter(today, -(weekday === 0 ? 6 : weekday - 1));
  const scope = (location_id: string, id: string) => ({
    company_id: current.company_id,
    kind: "location_record" as const,
    location_ids: [location_id],
    entity_id: id,
  });
  const product = (code: string) =>
    state.products.find(
      (item) => item.company_id === current.company_id && item.code === code,
    );
  const productTitle = (code: string) => {
    const value = product(code);
    return { title_en: value?.name_en ?? code, title_fa: value?.name_fa, code };
  };
  const arrivals = ids.flatMap((location) => {
    if (
      !can(state, current, "received.read", scope(location, location), now)
        .allowed
    )
      return [];
    return receivedLog(state, actorAtLocation(state, current, location), {
      from: start,
      to: today,
    }).map((receipt) => ({
      id: receipt.id,
      location_id: receipt.branch,
      ...productTitle(receipt.product_code),
      date: receipt.date,
      href: `received?product=${encodeURIComponent(receipt.product_code)}&from=${start}&to=${today}`,
    }));
  });
  const sales = (state.sales ?? [])
    .filter(
      (sale) =>
        sale.company_id === current.company_id &&
        locations.has(sale.branch) &&
        sale.status === "active" &&
        can(state, current, "sales.read", scope(sale.branch, sale.id), now)
          .allowed,
    )
    .map((sale) => ({
      id: sale.id,
      location_id: sale.branch,
      ...productTitle(sale.product_code),
      date: sale.last_day ?? undefined,
      status: sale.status,
      href: `offers?product=${encodeURIComponent(sale.product_code)}`,
    }));
  const dates = activeTrackedDates(state, current)
    .filter((date) => dateIsDueSoon(state, date, now))
    .map((date) => ({
      id: date.id,
      location_id: date.branch,
      ...productTitle(date.product_code),
      date: date.date,
      status:
        trackedDateDaysLeft(date.date, today) < 0 ? "expired" : "due_soon",
      href: `expiry?product=${encodeURIComponent(date.product_code)}`,
    }));
  const returns = state.returns
    .filter(
      (record) =>
        record.company_id === current.company_id &&
        locations.has(record.branch) &&
        !["resolved", "cancelled"].includes(record.status) &&
        can(
          state,
          current,
          "returns.read",
          scope(record.branch, record.id),
          now,
        ).allowed,
    )
    .map((record) => ({
      id: record.id,
      location_id: record.branch,
      title_en: record.supplier,
      status: record.status,
      href: `return?id=${encodeURIComponent(record.id)}`,
    }));
  const requests = listBranchRequests(state, current, { status: "open" }).map(
    (record) => ({
      id: record.id,
      location_id: locations.has(record.to_branch)
        ? record.to_branch
        : record.from_branch,
      title_en: record.reference,
      status: record.status,
      href: `requests?id=${encodeURIComponent(record.id)}`,
    }),
  );
  const builtin = state.notes
    .filter(
      (note) =>
        note.company_id === current.company_id &&
        locations.has(note.branch) &&
        !note.archived &&
        note.type === "note_to_supervisor" &&
        note.status === "open" &&
        can(state, current, "notes.read", scope(note.branch, note.id), now)
          .allowed,
    )
    .map((note) => ({
      id: note.id,
      location_id: note.branch,
      title_en: note.text,
      status: note.status,
      href: `notes?note=${encodeURIComponent(note.id)}`,
    }));
  const custom = readableNotebookEntries(state, current)
    .filter((entry) => entry.notify_supervisor && entry.status === "open")
    .map((entry) => ({
      id: entry.id,
      location_id: entry.branch,
      title_en: entry.text,
      status: entry.status,
      href: `notes?notebook=${encodeURIComponent(entry.notebook_id)}`,
    }));
  return {
    location_ids: ids,
    arrivals,
    sales,
    dates,
    returns,
    requests,
    notes: [...builtin, ...custom],
  };
}
