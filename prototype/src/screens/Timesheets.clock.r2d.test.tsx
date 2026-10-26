import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { initialState } from "../e1-bootstrap";
import { DemoProvider, useDemo } from "../store";
import { saveTimesheetNotes, timesheetScope } from "../timesheets";
import type { LocationSelection } from "../authority-types";
import i18n from "../i18n";
import Timesheets from "./Timesheets";

let fixture:
  Awaited<ReturnType<typeof authenticatedProviderFixture>> | undefined;
let live: ReturnType<typeof useDemo> | undefined;
function Page() {
  const context = useDemo();
  useLayoutEffect(() => {
    live = context;
  }, [context]);
  return context.actor ? <Timesheets /> : null;
}
function current() {
  if (!live?.actor) throw new Error("Actual timesheet actor is not ready");
  return live;
}
const sheet = () => document.querySelector(".timesheets-page");
async function mount(selection: LocationSelection, route = "#timesheets") {
  const state = initialState();
  state.config.modules.timesheets = true;
  const second = state.config.branches.find(
    (branch) => branch.id === "Branch 2",
  )!;
  second.timezone = "Pacific/Auckland";
  window.history.replaceState(null, "", `/${route}`);
  fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection },
  });
  render(
    <DemoProvider options={fixture.options}>
      <Page />
    </DemoProvider>,
  );
  if (selection.kind === "location")
    await waitFor(() =>
      expect(sheet()).toHaveAttribute(
        "data-timesheet-branch",
        selection.location_id,
      ),
    );
  else await screen.findByRole("combobox", { name: "Branch" });
}
async function chooseBranch() {
  fireEvent.click(screen.getByRole("combobox", { name: "Branch" }));
  fireEvent.click(await screen.findByRole("option", { name: "Richmond Hill" }));
  await waitFor(() =>
    expect(sheet()).toHaveAttribute("data-timesheet-branch", "Branch 2"),
  );
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/#timesheets");
  vi.useFakeTimers({ toFake: ["Date"] });
  // Toronto is still October 26; Auckland is already October 27.
  vi.setSystemTime(new Date("2026-10-27T03:59:30.000Z"));
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = undefined;
  live = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("uses the first selected aggregate branch's local today", async () => {
  await mount({ kind: "all_locations" });
  await chooseBranch();
  await waitFor(() =>
    expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-27"),
  );
  expect(window.location.hash).toBe("#timesheets");
});
it("keeps an explicit past date and week view when choosing an aggregate branch", async () => {
  await mount(
    { kind: "all_locations" },
    "#timesheets?date=2026-10-20&view=week",
  );
  await chooseBranch();
  expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-20");
  expect(screen.getByRole("heading", { name: "Week view" })).toBeVisible();
  expect(window.location.hash).toBe("#timesheets?date=2026-10-20&view=week");
});
it("uses the new real branch's today for an implicit date", async () => {
  await mount({ kind: "location", location_id: "Branch 1" });
  expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-26");
  await act(async () => {
    await current().setLocation({ kind: "location", location_id: "Branch 2" });
  });
  await waitFor(() =>
    expect(sheet()).toHaveAttribute("data-timesheet-branch", "Branch 2"),
  );
  expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-27");
});
it("keeps the person's selected past day across a real branch change", async () => {
  await mount({ kind: "location", location_id: "Branch 1" });
  fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
  await waitFor(() =>
    expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-25"),
  );
  await act(async () => {
    await current().setLocation({ kind: "location", location_id: "Branch 2" });
  });
  await waitFor(() =>
    expect(sheet()).toHaveAttribute("data-timesheet-branch", "Branch 2"),
  );
  expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-25");
});
it("does not jump the current sheet at midnight when a genuine same-location save refreshes config", async () => {
  await mount({ kind: "location", location_id: "Branch 1" });
  expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-26");
  vi.setSystemTime(new Date("2026-10-27T04:00:30.000Z"));
  await act(async () => {
    const actor = current().actor!;
    await current().command(
      "timesheets.edit",
      timesheetScope(actor.company_id, "Branch 1", true),
      (draft, fresh) => {
        saveTimesheetNotes(draft, fresh, {
          branch: "Branch 1",
          date: "2026-10-26",
          notes: "Keep this working paper open.",
        });
      },
    );
  });
  expect(
    (await fixture!.readCanonical()).timesheet_days?.find(
      (day) => day.branch === "Branch 1" && day.date === "2026-10-26",
    )?.notes,
  ).toBe("Keep this working paper open.");
  expect(sheet()).toHaveAttribute("data-timesheet-date", "2026-10-26");
  expect(window.location.hash).toBe("#timesheets");
});
