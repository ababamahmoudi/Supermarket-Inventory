import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../App";
import { DemoProvider, initialState } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import type { DemoState } from "../types";
import {
  addTimesheetRow,
  addTimesheetStaff,
  timesheetClock,
  timesheetScope,
} from "../timesheets";
import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
let release: (() => void) | undefined;

async function independentTimesheetFixture() {
  const state = initialState();
  // B is verified before C's optional demo sheets. Set up this test's own
  // invented person and shift through the real protected canonical command.
  state.timesheet_staff = [];
  state.timesheet_days = [];
  state.timesheet_rows = [];
  state.config.modules.timesheets = true;
  const branch = "Branch 1";
  const department = state.config.timesheets?.departments[0];
  if (!department) throw new Error("The timesheet fixture needs a department.");
  const date = timesheetClock(state.config, branch).date;
  const prepared = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: {
      locations: [branch],
      selection: { kind: "location", location_id: branch },
    },
  });
  await prepared.repository.runBusinessCommand<DemoState, void>(
    prepared.identity,
    (draft, actor) => {
      const staff = addTimesheetStaff(draft, actor, {
        branch,
        name_en: "Emery Vale",
        usual_department_key: department.key,
      });
      addTimesheetRow(draft, actor, {
        branch,
        date,
        department_key: department.key,
        staff_id: staff.id,
        in_time: "06:00",
        out_time: "14:00",
      });
    },
    {
      capability: "timesheets.edit",
      resource: timesheetScope(state.config.company.seed_key, branch, true),
    },
  );
  window.history.replaceState(null, "", `/#timesheets?date=${date}`);
  return prepared;
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/#timesheets");
  await i18n.changeLanguage("en");
});
afterEach(() => {
  release?.();
  clearRenderedUiReadiness();
  cleanup();
  fixture?.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  release = undefined;
});

it.each(["Previous day", "Week view"])(
  "a late %s continuation cannot reopen Timesheets after leaving during an actual save",
  async (action) => {
    fixture = await independentTimesheetFixture();
    const original = fixture.repository.runBusinessCommand.bind(
      fixture.repository,
    );
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    let finished: (() => void) | undefined;
    const completed = new Promise<void>((resolve) => {
      finished = resolve;
    });
    type Run = typeof fixture.repository.runBusinessCommand;
    // Delay only scheduling; the actual IDB command still resolves its genuine actor,
    // capability and current canonical draft and commits normally after release.
    vi.spyOn(fixture.repository, "runBusinessCommand").mockImplementation(
      (async (...args: Parameters<Run>) => {
        if (args[2]?.capability === "timesheets.edit") {
          held = true;
          await pending;
          try {
            return await original(...args);
          } finally {
            finished?.();
          }
        }
        return original(...args);
      }) as Run,
    );
    render(
      <DemoProvider options={fixture.options}>
        <App />
      </DemoProvider>,
    );
    await renderedUiReady(
      () =>
        document.querySelector('[aria-label="In time for Emery Vale"]') !==
        null,
    );
    const input = screen.getByRole("textbox", {
      name: "In time for Emery Vale",
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "730" } });
    fireEvent.blur(input);
    await waitFor(() => expect(held).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: action }));
    await act(async () => {
      window.location.hash = "#suppliers";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(window.location.hash).toBe("#suppliers");
    await act(async () => {
      release?.();
      await completed;
    });
    await waitFor(async () => {
      const state = await fixture.readCanonical();
      expect(
        state.timesheet_rows?.some(
          (row) => row.name_en === "Emery Vale" && row.in_time === "07:30",
        ),
      ).toBe(true);
    });
    expect(window.location.hash).toBe("#suppliers");
    expect(document.querySelector(".timesheet-departments")).toBeNull();
  },
);

it("returning to the original time during a delayed save retains the latest typed intent", async () => {
  fixture = await independentTimesheetFixture();
  const original = fixture.repository.runBusinessCommand.bind(
    fixture.repository,
  );
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  let finish: (() => void) | undefined;
  const firstFinished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  type Run = typeof fixture.repository.runBusinessCommand;
  vi.spyOn(fixture.repository, "runBusinessCommand").mockImplementation((async (
    ...args: Parameters<Run>
  ) => {
    if (args[2]?.capability === "timesheets.edit") {
      held = true;
      await pending;
      try {
        return await original(...args);
      } finally {
        finish?.();
      }
    }
    return original(...args);
  }) as Run);
  render(
    <DemoProvider options={fixture.options}>
      <App />
    </DemoProvider>,
  );
  await renderedUiReady(
    () =>
      document.querySelector('[aria-label="In time for Emery Vale"]') !== null,
  );
  const input = screen.getByRole("textbox", {
    name: "In time for Emery Vale",
  });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "730" } });
  fireEvent.blur(input);
  await waitFor(() => expect(held).toBe(true));
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "06:00" } });
  fireEvent.blur(input);
  await act(async () => {
    release?.();
    await firstFinished;
  });
  await waitFor(async () => {
    const state = await fixture.readCanonical();
    expect(
      state.timesheet_rows?.some(
        (row) => row.name_en === "Emery Vale" && row.in_time === "06:00",
      ),
    ).toBe(true);
  });
  expect(input).toHaveValue("06:00");
});
