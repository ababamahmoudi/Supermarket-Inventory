import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_STORAGE_KEY, SESSION_KEY, initialAuth } from "./auth";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";
import {
  activeTrackedDates,
  removeTrackedDate,
  stopProductDateTracking,
} from "./date-tracking";
import { shouldShowUndoNotification } from "./undo-notification-policy";
import { hydrateC6State } from "./c6-state";
import { configSeed } from "./config";

function ReminderHarness() {
  const { state, update, historyContext, undoToasts, undoActivity } = useDemo();
  const alerts = state.alerts.filter(
    (item) => item.type === "date_reminder" && item.expiry_id === "c6-date",
  );
  return (
    <>
      <output data-testid="alerts">
        {alerts.length}:{alerts[0]?.status ?? "none"}
      </output>
      <output data-testid="tracking">
        {
          activeTrackedDates(state, historyContext!).filter(
            (item) => item.id === "c6-date",
          ).length
        }
      </output>
      <output data-testid="date">
        {state.expiry.find((item) => item.id === "c6-date")?.status}
      </output>
      <output data-testid="toast">
        {undoToasts.map((item) => item.action).join(",")}
      </output>
      <button
        onClick={() =>
          update((draft) => {
            draft.products.find((item) => item.code === "0006")!.name_en =
              "Updated product";
            draft.activity.push({
              id: "c6-edit",
              company_id: draft.config.company.seed_key,
              branch: "Branch 1",
              action: "Edit product",
              by: historyContext!.actor,
              at: new Date().toISOString(),
              reversible: true,
              entity_type: "product",
              entity_id: "0006",
            });
          })
        }
      >
        Edit field
      </button>
      <button
        onClick={() =>
          update((draft) =>
            removeTrackedDate(draft, historyContext!, "c6-date", "sold_out"),
          )
        }
      >
        Remove date
      </button>
      <button
        onClick={() =>
          update((draft) =>
            stopProductDateTracking(draft, historyContext!, "0006", "keep"),
          )
        }
      >
        Stop keep
      </button>
      <button onClick={() => undoActivity(undoToasts[0].id)}>
        Undo action
      </button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T16:00:00Z"));
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(initialAuth()));
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
  const state = initialState();
  state.expiry = [
    {
      id: "c6-date",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      product_code: "0006",
      date: "2026-10-17",
      date_type: "expiry",
      expires_in_days: 5,
      status: "active",
    },
  ];
  state.alerts = state.alerts.filter((item) => item.type !== "date_reminder");
  const product = state.products.find((item) => item.code === "0006")!;
  product.date_tracking = true;
  product.date_reminder_days = 5;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
});
afterEach(() => vi.useRealTimers());

describe("C6 reminders and audited Undo integration", () => {
  it("does not toast a field edit; a date removal is reversible without copying derived alerts into History", () => {
    render(
      <DemoProvider>
        <ReminderHarness />
      </DemoProvider>,
    );
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending");
    fireEvent.click(screen.getByText("Edit field"));
    expect(screen.getByTestId("toast")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByText("Remove date"));
    expect(screen.getByTestId("toast")).toHaveTextContent("Remove date");
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:resolved");
    fireEvent.click(screen.getByText("Undo action"));
    expect(screen.getByTestId("date")).toHaveTextContent("active");
    expect(screen.getByTestId("tracking")).toHaveTextContent("1");
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending");
  });
  it("stop-and-keep removes the product from active tracking and resolves its existing reminder", () => {
    render(
      <DemoProvider>
        <ReminderHarness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Stop keep"));
    expect(screen.getByTestId("tracking")).toHaveTextContent("0");
    expect(screen.getByTestId("date")).toHaveTextContent("active");
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:resolved");
    expect(screen.getByTestId("toast")).toHaveTextContent(
      "Stop tracking this product",
    );
  });
  it("creates a reminder once when local time enters the window without a field edit", () => {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    state.expiry[0].date = "2026-10-20";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(
      <DemoProvider>
        <ReminderHarness />
      </DemoProvider>,
    );
    expect(screen.getByTestId("alerts")).toHaveTextContent("0:none");
    act(() => {
      vi.setSystemTime(new Date("2026-10-15T16:00:00Z"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending");
    act(() => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending");
    expect(screen.getByTestId("toast")).toBeEmptyDOMElement();
  });
  it("reserves transient Undo for final actions while leaving ordinary edit history available", () => {
    for (const action of [
      "Save draft",
      "Edit draft",
      "Add date",
      "Add product",
      "Company settings changed",
      "Change copies",
    ])
      expect(shouldShowUndoNotification(action), action).toBe(false);
    for (const action of [
      "Remove line",
      "Stop offer",
      "Approve price",
      "Reject proposal",
      "Send request",
      "Complete notebook entry",
      "note_resolved",
    ])
      expect(shouldShowUndoNotification(action), action).toBe(true);
  });
  it("updates untouched default branding once and preserves custom company colors and document choices", () => {
    const state = initialState();
    delete state.prototype_c6_schema;
    state.config.company.branding.dark_primary_color = "#5B86E5";
    state.config.company.branding.primary_color = "#0F766E";
    state.config.supplier_documents = {
      return_memo: "bilingual",
      supplier_order: "en",
    };
    hydrateC6State(state);
    expect(state.config.company.branding.dark_primary_color).toBe(
      configSeed.company.branding.dark_primary_color,
    );
    expect(state.config.company.branding.primary_color).toBe("#0F766E");
    expect(state.config.supplier_documents.return_memo).toBe("bilingual");
    state.config.company.branding.dark_primary_color = "#5B86E5";
    hydrateC6State(state);
    expect(state.config.company.branding.dark_primary_color).toBe("#5B86E5");
  });
});
