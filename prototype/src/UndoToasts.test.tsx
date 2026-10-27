import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo, relativeDate } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { clearExpiry } from "./operations";
import { addTrackedDate, scopedTrackedDates } from "./date-tracking";
import { setImmediate as realSetImmediate } from "node:timers";
import UndoToasts from "./UndoToasts";
import i18n from "./i18n";
import { useState } from "react";

let currentCommand: Promise<unknown> | null = null;
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
function Harness() {
  const { command, state, actor, setLang } = useDemo();
  const [modal, setModal] = useState(false);
  return (
    <>
      <button
        disabled={!actor}
        onClick={() => {
          currentCommand = command(
            "dates.remove",
            {
              company_id: state.config.company.seed_key,
              kind: "location_record",
              location_ids: ["Branch 1"],
              mutation: true,
            },
            (draft, freshActor) => {
              let entry = scopedTrackedDates(draft, freshActor).find(
                (item) => item.status === "active",
              );
              if (!entry) {
                const product = draft.products[0];
                entry = addTrackedDate(draft, freshActor, {
                  product_code: product.code,
                  branch: "Branch 1",
                  date_type: "expiry",
                  date: relativeDate(30),
                });
              }
              clearExpiry(draft, freshActor, entry.id);
            },
          );
        }}
      >
        Change date entry
      </button>
      <button onClick={() => setLang("fa")}>Persian</button>
      <button onClick={() => setModal(true)}>Open dialog</button>
      {modal && (
        <dialog open aria-label="Another action">
          <div className="ui-dialog-actions">
            <button onClick={() => setModal(false)}>Close dialog</button>
          </div>
        </dialog>
      )}
      <output data-testid="date-status">{state.expiry[0]?.status}</output>
      <output data-testid="audit-actor">
        {state.activity.find((entry) => entry.action === "expiry_cleared")?.by}
      </output>
      <UndoToasts />
    </>
  );
}
beforeEach(async () => {
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
  currentCommand = null;
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function renderHarness() {
  // Genuine crypto, SDK identity and actual IDB initialization finish on real
  // clocks. Only the existing UI timer controls below use the fake clock.
  const fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  vi.useFakeTimers({
    toFake: [
      "Date",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  // The toast interval must be created under the controlled UI clock. Genuine
  // crypto/setup above uses real time; native IndexedDB tasks remain unmocked.
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  const started = performance.now();
  while (
    screen
      .getByRole("button", { name: "Change date entry" })
      .hasAttribute("disabled") &&
    performance.now() - started < 10000
  ) {
    await act(async () => {
      await new Promise<void>((resolve) => realSetImmediate(resolve));
    });
  }
  expect(
    screen.getByRole("button", { name: "Change date entry" }),
  ).not.toBeDisabled();
  return fixture;
}
async function changeDate() {
  await act(async () => {
    fireEvent.click(screen.getByText("Change date entry"));
    await currentCommand;
  });
}
async function waitForUndo(
  fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>,
) {
  const started = performance.now();
  while (performance.now() - started < 10000) {
    const state = await fixture.readCanonical();
    if (
      state.expiry[0].status === "active" &&
      !screen.queryByTestId("undo-toast") &&
      !screen.queryByTestId("dialog-action-status")
    ) {
      await act(async () => {
        await new Promise<void>((resolve) => realSetImmediate(resolve));
      });
      return;
    }
    await act(async () => {
      await new Promise<void>((resolve) => realSetImmediate(resolve));
    });
  }
  throw new Error("Actual scoped Undo did not restore the retained date");
}
describe("Undo toast integration", () => {
  it("pauses on keyboard focus and resumes only after focus leaves", async () => {
    await renderHarness();
    await changeDate();
    act(() => vi.advanceTimersByTime(1000));
    const undo = screen.getByRole("button", { name: /^Undo$/ });
    fireEvent.focus(undo);
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByTestId("undo-toast")).toBeVisible();
    fireEvent.blur(undo, {
      relatedTarget: screen.getByText("Change date entry"),
    });
    act(() => vi.advanceTimersByTime(6999));
    expect(screen.getByTestId("undo-toast")).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("uses a quiet modal-footer status, defers the page toast and preserves its remaining Undo time", async () => {
    await renderHarness();
    await changeDate();
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.focus(screen.getByRole("button", { name: /^Undo$/ }));
    await act(async () => fireEvent.click(screen.getByText("Open dialog")));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("dialog-action-status").closest(".ui-dialog-actions"),
    ).toContainElement(screen.getByText("Close dialog"));
    expect(screen.getByTestId("dialog-action-status")).not.toHaveClass(
      "undo-toast",
    );
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByTestId("dialog-action-status")).toBeVisible();
    await act(async () => fireEvent.click(screen.getByText("Close dialog")));
    expect(
      screen.queryByTestId("dialog-action-status"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("undo-toast").closest("dialog")).toBeNull();
    expect(
      screen.getByTestId("undo-toast").closest(".undo-toast-stack")
        ?.parentElement,
    ).toBe(document.body);
    act(() => vi.advanceTimersByTime(6999));
    expect(screen.getByTestId("undo-toast")).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("keeps the genuine guarded Undo available in the modal footer", async () => {
    const fixture = await renderHarness();
    await changeDate();
    await act(async () => fireEvent.click(screen.getByText("Open dialog")));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /^Undo$/ })),
    );
    await waitForUndo(fixture);
    expect(screen.getByTestId("date-status")).toHaveTextContent("active");
    expect(
      screen.queryByTestId("dialog-action-status"),
    ).not.toBeInTheDocument();
  });
  it("a new eligible action replaces the paused message", async () => {
    await renderHarness();
    await changeDate();
    const first = screen.getByTestId("undo-toast");
    fireEvent.mouseEnter(first);
    await changeDate();
    expect(first).not.toBeInTheDocument();
    expect(screen.getAllByTestId("undo-toast")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("restores through the signed-in domain API and appends the actor's Undone audit", async () => {
    const fixture = await renderHarness();
    await changeDate();
    expect(screen.getByTestId("date-status")).toHaveTextContent("cleared");
    expect(screen.getByTestId("audit-actor")).toHaveTextContent(
      fixture.actor.actor,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Undo$/ }));
    });
    await waitForUndo(fixture);
    expect(screen.getByTestId("date-status")).toHaveTextContent("active");
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("dismisses the message without reversing the action", async () => {
    await renderHarness();
    await changeDate();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss Undo message" }),
    );
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
    expect(screen.getByTestId("date-status")).toHaveTextContent("cleared");
  });
  it("never stacks repeated eligible actions", async () => {
    await renderHarness();
    for (let i = 0; i < 5; i++) await changeDate();
    expect(screen.getAllByTestId("undo-toast")).toHaveLength(1);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });
  it("Persian localizes Undo and the action without changing timer duration", async () => {
    await renderHarness();
    await changeDate();
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByText("Persian"));
    expect(screen.getByRole("button", { name: /^واگرد$/ })).toBeVisible();
    expect(screen.getByTestId("undo-toast")).toHaveTextContent("تاریخ پاک شد");
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
});
