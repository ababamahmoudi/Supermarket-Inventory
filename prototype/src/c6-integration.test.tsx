import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { removeTrackedDate, stopProductDateTracking } from "./date-tracking";
import { shouldShowUndoNotification } from "./undo-notification-policy";
import { hydrateC6State } from "./c6-state";
import { configSeed } from "./config";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { activeTrackedDateView } from "./notes-dates-read";

let actionCompleted: Promise<unknown> = Promise.resolve();
function ReminderHarness() {
  const { state, authStage, command, undoToasts, undoActivity } = useDemo();
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "location_record" as const,
    location_ids: ["Branch 1"],
  };
  const alerts = state.alerts.filter(
    (item) => item.type === "date_reminder" && item.expiry_id === "c6-date",
  );
  return (
    <>
      <output data-testid="stage">{authStage}</output>
      <output data-testid="alerts">
        {alerts.length}:{alerts[0]?.status ?? "none"}
      </output>
      <output data-testid="tracking">
        {
          activeTrackedDateView(state).filter((item) => item.id === "c6-date")
            .length
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
          (actionCompleted = command("catalog.edit", scope, (draft, actor) => {
            draft.products.find((item) => item.code === "0006")!.name_en =
              "Updated product";
            draft.activity.push({
              id: "c6-edit",
              company_id: draft.config.company.seed_key,
              branch: "Branch 1",
              action: "Edit product",
              by: actor.actor,
              actor_user_id: actor.user_id,
              at: new Date().toISOString(),
              reversible: true,
              entity_type: "product",
              entity_id: "0006",
            });
          }))
        }
      >
        Edit field
      </button>
      <button
        onClick={() =>
          (actionCompleted = command("dates.remove", scope, (draft, actor) =>
            removeTrackedDate(draft, actor, "c6-date", "sold_out"),
          ))
        }
      >
        Remove date
      </button>
      <button
        onClick={() =>
          (actionCompleted = command("catalog.edit", scope, (draft, actor) =>
            stopProductDateTracking(draft, actor, "0006", "keep"),
          ))
        }
      >
        Stop keep
      </button>
      <button
        onClick={() => {
          actionCompleted = undoActivity(undoToasts[0].id);
        }}
      >
        Undo action
      </button>
    </>
  );
}

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T16:00:00Z"));
  localStorage.clear();
  sessionStorage.clear();
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
  fixture = await authenticatedProviderFixture({ state, role: "manager" });
});
afterEach(() => {
  fixture.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function showReminder() {
  render(
    <DemoProvider options={fixture.options}>
      <ReminderHarness />
    </DemoProvider>,
  );
  await waitFor(
    () => expect(screen.getByTestId("stage")).toHaveTextContent("complete"),
    { timeout: 10000 },
  );
}

describe("C6 reminders and audited Undo integration", () => {
  it("does not toast a field edit; a date removal is reversible without copying derived alerts into History", async () => {
    await showReminder();
    expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending");
    fireEvent.click(screen.getByText("Edit field"));
    await act(async () => {
      await actionCompleted;
    });
    await waitFor(async () =>
      expect(
        (await fixture.readCanonical()).products.find(
          (item) => item.code === "0006",
        )!.name_en,
      ).toBe("Updated product"),
    );
    expect(screen.getByTestId("toast")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByText("Remove date"));
    await act(async () => {
      await actionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("toast")).toHaveTextContent("Remove date"),
    );
    await waitFor(() =>
      expect(screen.getByTestId("alerts")).toHaveTextContent("1:resolved"),
    );
    fireEvent.click(screen.getByText("Undo action"));
    await act(async () => {
      await actionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("tracking")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("date")).toHaveTextContent("active");
    await waitFor(() =>
      expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending"),
    );
  });
  it("stop-and-keep removes the product from active tracking and resolves its existing reminder", async () => {
    await showReminder();
    fireEvent.click(screen.getByText("Stop keep"));
    await act(async () => {
      await actionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("tracking")).toHaveTextContent("0"),
    );
    expect(screen.getByTestId("date")).toHaveTextContent("active");
    await waitFor(() =>
      expect(screen.getByTestId("alerts")).toHaveTextContent("1:resolved"),
    );
    expect(screen.getByTestId("toast")).toHaveTextContent(
      "Stop tracking this product",
    );
  });
  it("creates a reminder once when local time enters the window without a field edit", async () => {
    await fixture.repository.runBusinessCommand<
      ReturnType<typeof initialState>,
      void
    >(fixture.identity, (draft) => {
      draft.expiry[0].date = "2026-10-20";
    });
    const clock = new Date();
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(clock);
    await showReminder();
    expect(screen.getByTestId("alerts")).toHaveTextContent("0:none");
    await act(async () => {
      vi.setSystemTime(new Date("2026-10-15T16:00:00Z"));
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("alerts")).toHaveTextContent("1:pending"),
    );
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(60_000);
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
