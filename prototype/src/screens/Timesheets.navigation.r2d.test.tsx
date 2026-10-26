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
import { DemoProvider, initialState, useDemo } from "../store";
import { IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { appWorkPending } from "../app-work";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import type { DemoState } from "../types";
import {
  addTimesheetRow,
  addTimesheetStaff,
  timesheetClock,
  timesheetScope,
  timesheetDateAfter,
} from "../timesheets";
import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
let release: (() => void) | undefined;

async function independentTimesheetFixture(
  role: "manager" | "cashier" = "manager",
) {
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
    role,
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
    await waitFor(() =>
      expect(document.querySelector(".timesheet-departments")).toBeNull(),
    );
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

it.each(["manager", "cashier"] as const)(
  "a focused queued %s edit saves on external hash navigation without a blur or debounce",
  async (role) => {
    fixture = await independentTimesheetFixture(role);
    const command = vi.spyOn(fixture.repository, "runBusinessCommand");
    window.history.replaceState(null, "", "/#lookup");
    render(
      <DemoProvider options={fixture.options}>
        <App />
      </DemoProvider>,
    );
    await renderedUiReady(
      () => document.querySelector("main h1")?.textContent === "Cashier lookup",
    );
    await act(async () => {
      window.location.hash = "#timesheets";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await renderedUiReady(
      () =>
        document.querySelector('[aria-label="In time for Emery Vale"]') !==
        null,
    );
    const input = screen.getByRole("textbox", {
      name: "In time for Emery Vale",
    });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "730" } });
    expect(input).toHaveFocus();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(
      command.mock.calls.some(
        (args) => args[2]?.capability === "timesheets.edit",
      ),
    ).toBe(false);
    // Both events occur before yielding: the 350 ms debounce cannot have run.
    await act(async () => {
      window.location.hash = "#lookup";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(async () =>
      expect((await fixture.readCanonical()).timesheet_rows?.[0].in_time).toBe(
        "07:30",
      ),
    );
    await waitFor(() =>
      expect(document.querySelector(".timesheet-departments")).toBeNull(),
    );
    expect(window.location.hash).toBe("#lookup");
    const state = await fixture.readCanonical();
    expect(
      state.activity.find((event) => event.action === "Edit timesheet row"),
    ).toMatchObject({ actor_user_id: fixture.actor.user_id });
    await waitFor(() => expect(appWorkPending()).toBe(false));
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  },
);

it.each(["retry", "revert"] as const)(
  "a real failed queued transaction retains text and recovers through %s before navigation",
  async (recovery) => {
    fixture = await independentTimesheetFixture();
    const originalCommand = fixture.repository.runBusinessCommand.bind(
      fixture.repository,
    );
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    type Run = typeof fixture.repository.runBusinessCommand;
    vi.spyOn(fixture.repository, "runBusinessCommand").mockImplementation(
      (async (...args: Parameters<Run>) => {
        if (!held && args[2]?.capability === "timesheets.edit") {
          held = true;
          await pending;
        }
        return originalCommand(...args);
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
    const before = await fixture.readCanonical();
    const originalPut = FakeObjectStore.prototype.put;
    let fail = true;
    vi.spyOn(FakeObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const row = value as { state?: DemoState };
      if (
        fail &&
        this.name === "business" &&
        row.state?.timesheet_rows?.some((row) => row.in_time === "07:30")
      ) {
        fail = false;
        throw new DOMException("Fictional storage full", "QuotaExceededError");
      }
      return originalPut.call(this, value, key);
    });
    const input = screen.getByRole("textbox", {
      name: "In time for Emery Vale",
    });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "730" } });
    await act(async () => {
      window.location.hash = "#lookup";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(held).toBe(true));
    await act(async () => {
      window.location.hash = "#suppliers";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      release?.();
    });
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input).toHaveValue("730");
    expect(input).toBeVisible();
    expect(window.location.hash).toMatch(/^#timesheets/);
    expect(await fixture.readCanonical()).toEqual(before);
    expect(appWorkPending()).toBe(true);
    if (recovery === "retry") {
      fireEvent.click(
        screen.getByRole("button", { name: /Try again\. Could not save/ }),
      );
      await waitFor(async () =>
        expect(
          (await fixture.readCanonical()).timesheet_rows?.[0].in_time,
        ).toBe("07:30"),
      );
    } else {
      fireEvent.change(input, { target: { value: "06:00" } });
      fireEvent.blur(input);
      await waitFor(() =>
        expect(input).toHaveAttribute("aria-invalid", "false"),
      );
      expect(await fixture.readCanonical()).toEqual(before);
    }
    await waitFor(() => expect(appWorkPending()).toBe(false));
    await act(async () => {
      window.location.hash = "#lookup";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() =>
      expect(document.querySelector(".timesheet-departments")).toBeNull(),
    );
    expect(window.location.hash).toBe("#lookup");
  },
);

it("an initial Timesheets invalid edit blocks a date-hash change before either route listener accepts it", async () => {
  fixture = await independentTimesheetFixture();
  render(
    <DemoProvider options={fixture.options}>
      <App />
    </DemoProvider>,
  );
  await renderedUiReady(
    () =>
      document.querySelector('[aria-label="In time for Emery Vale"]') !== null,
  );
  const input = screen.getByRole("textbox", { name: "In time for Emery Vale" });
  const before = await fixture.readCanonical();
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "999" } });
  await act(async () => {
    window.location.hash = `#timesheets?date=${timesheetDateAfter(before.timesheet_rows![0].date, -1)}&view=week`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
  expect(input).toHaveValue("999");
  expect(input).toBeVisible();
  expect(document.querySelector(".timesheets-page")).toHaveAttribute(
    "data-timesheet-date",
    before.timesheet_rows![0].date,
  );
  expect(window.location.hash).toMatch(/^#timesheets/);
  expect(await fixture.readCanonical()).toEqual(before);
  expect(appWorkPending()).toBe(true);
  cleanup();
  await waitFor(() => expect(appWorkPending()).toBe(false));
});

it("a queued chain cannot write the old edit as a newly signed-in person", async () => {
  fixture = await independentTimesheetFixture();
  const original = fixture.repository.runBusinessCommand.bind(
    fixture.repository,
  );
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  type Run = typeof fixture.repository.runBusinessCommand;
  vi.spyOn(fixture.repository, "runBusinessCommand").mockImplementation((async (
    ...args: Parameters<Run>
  ) => {
    if (!held && args[2]?.capability === "timesheets.edit") {
      held = true;
      await pending;
    }
    return original(...args);
  }) as Run);
  let commands: ReturnType<typeof useDemo> | undefined;
  function SessionCommands() {
    commands = useDemo();
    return null;
  }
  render(
    <DemoProvider options={fixture.options}>
      <SessionCommands />
      <App />
    </DemoProvider>,
  );
  await renderedUiReady(
    () =>
      document.querySelector('[aria-label="In time for Emery Vale"]') !== null,
  );
  const input = screen.getByRole("textbox", { name: "In time for Emery Vale" });
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "730" } });
  fireEvent.blur(input);
  await waitFor(() => expect(held).toBe(true));
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "845" } });
  await act(async () => {
    await commands!.switchDemoUser("cashier");
  });
  expect(commands!.actor?.user_id).not.toBe(fixture.actor.user_id);
  await act(async () => {
    window.location.hash = "#lookup";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await act(async () => {
    release?.();
  });
  await waitFor(() => expect(appWorkPending()).toBe(false));
  expect((await fixture.readCanonical()).timesheet_rows?.[0].in_time).toBe(
    "06:00",
  );
  expect(
    (await fixture.readCanonical()).activity.filter(
      (event) => event.action === "Edit timesheet row",
    ),
  ).toEqual([]);
  expect(window.location.hash).not.toContain("timesheets");
});

it("clean fields allow unload, while a genuine in-flight save stays protected until accepted", async () => {
  fixture = await independentTimesheetFixture();
  const original = fixture.repository.runBusinessCommand.bind(
    fixture.repository,
  );
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  type Run = typeof fixture.repository.runBusinessCommand;
  vi.spyOn(fixture.repository, "runBusinessCommand").mockImplementation((async (
    ...args: Parameters<Run>
  ) => {
    if (args[2]?.capability === "timesheets.edit") {
      held = true;
      await pending;
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
  const clean = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  const input = screen.getByRole("textbox", { name: "In time for Emery Vale" });
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "730" } });
  fireEvent.blur(input);
  await waitFor(() => expect(held).toBe(true));
  const pendingUnload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(pendingUnload);
  expect(pendingUnload.defaultPrevented).toBe(true);
  await act(async () => {
    release?.();
  });
  await waitFor(() => expect(appWorkPending()).toBe(false));
  const accepted = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(accepted);
  expect(accepted.defaultPrevented).toBe(false);
});
