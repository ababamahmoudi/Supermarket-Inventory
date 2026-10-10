import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, useDemo } from "./store";
import { AUTH_STORAGE_KEY, SESSION_KEY, initialAuth } from "./auth";
import UndoToasts from "./UndoToasts";
import i18n from "./i18n";
import { useState } from "react";

function Harness() {
  const { update, state, setLang } = useDemo();
  const [modal, setModal] = useState(false);
  return (
    <>
      <button
        onClick={() =>
          update((draft) => {
            const entry = draft.expiry[0];
            entry.status = entry.status === "active" ? "cleared" : "active";
            draft.activity.push({
              id: `toast-${draft.activity.length}`,
              company_id: draft.config.company.seed_key,
              branch: "Branch 1",
              action: "expiry_cleared",
              by: "Old hardcoded actor",
              at: new Date().toISOString(),
            });
          })
        }
      >
        Change date entry
      </button>
      <button onClick={() => setLang("fa")}>Persian</button>
      <button onClick={() => setModal(true)}>Open dialog</button>
      {modal && (
        <dialog open aria-label="Another action">
          <button onClick={() => setModal(false)}>Close dialog</button>
        </dialog>
      )}
      <output data-testid="date-status">{state.expiry[0].status}</output>
      <output data-testid="audit-actor">{state.activity.at(-1)?.by}</output>
      <UndoToasts />
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
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
  void i18n.changeLanguage("en");
});
afterEach(() => {
  vi.useRealTimers();
});
describe("Undo toast integration", () => {
  it("pauses on keyboard focus and resumes only after focus leaves", () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Change date entry"));
    act(() => vi.advanceTimersByTime(1000));
    const undo = screen.getByRole("button", { name: /^Undo$/ });
    fireEvent.focus(undo);
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByTestId("undo-toast")).toBeVisible();
    fireEvent.blur(undo, {
      relatedTarget: screen.getByText("Change date entry"),
    });
    act(() => vi.advanceTimersByTime(8999));
    expect(screen.getByTestId("undo-toast")).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("stays above modal content and resumes a relocated toast's timer when its old focus disappears", async () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Change date entry"));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.focus(screen.getByRole("button", { name: /^Undo$/ }));
    await act(async () => fireEvent.click(screen.getByText("Open dialog")));
    expect(screen.getByTestId("undo-toast").closest("dialog")).toBe(
      screen.getByRole("dialog"),
    );
    await act(async () => fireEvent.click(screen.getByText("Close dialog")));
    expect(screen.getByTestId("undo-toast").closest("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("resumes a paused item when three newer messages hide it", () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Change date entry"));
    act(() => vi.advanceTimersByTime(1000));
    const first = screen.getByTestId("undo-toast");
    fireEvent.mouseEnter(first);
    for (let index = 0; index < 3; index++)
      fireEvent.click(screen.getByText("Change date entry"));
    expect(first.hidden).toBe(true);
    act(() => vi.advanceTimersByTime(9000));
    expect(first).not.toBeInTheDocument();
    expect(screen.getAllByTestId("undo-toast")).toHaveLength(3);
  });
  it("restores through the signed-in domain API and appends the actor's Undone audit", () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Change date entry"));
    expect(screen.getByTestId("date-status")).toHaveTextContent("cleared");
    expect(screen.getByTestId("audit-actor")).toHaveTextContent(
      "Demo Supervisor",
    );
    fireEvent.click(screen.getByRole("button", { name: /^Undo$/ }));
    expect(screen.getByTestId("date-status")).toHaveTextContent("active");
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
  it("shows three newest toasts plus the extra count and keeps hidden timers running", () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Change date entry"));
      act(() => vi.advanceTimersByTime(500));
    }
    expect(
      screen.getAllByTestId("undo-toast").filter((node) => !node.hidden),
    ).toHaveLength(3);
    expect(screen.getByText("+2 more")).toBeVisible();
    act(() => vi.advanceTimersByTime(7500));
    expect(screen.getAllByTestId("undo-toast")).toHaveLength(4);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });
  it("hovering one toast preserves only its own remaining display time", () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Change date entry"));
    act(() => vi.advanceTimersByTime(1000));
    const older = screen.getByTestId("undo-toast");
    fireEvent.mouseEnter(older);
    fireEvent.click(screen.getByText("Change date entry"));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getAllByTestId("undo-toast")).toEqual([older]);
    fireEvent.mouseLeave(older);
    act(() => vi.advanceTimersByTime(8999));
    expect(older).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(older).not.toBeInTheDocument();
  });
  it("Persian localizes Undo and the action without changing timer duration", () => {
    render(
      <DemoProvider>
        <Harness />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Change date entry"));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByText("Persian"));
    expect(screen.getByRole("button", { name: /^واگرد$/ })).toBeVisible();
    expect(screen.getByTestId("undo-toast")).toHaveTextContent("تاریخ پاک شد");
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument();
  });
});
