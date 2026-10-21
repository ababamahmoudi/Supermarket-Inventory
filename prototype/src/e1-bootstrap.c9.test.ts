import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserAuthorityRepository } from "./authority-repository";
import { configSeed } from "./config";
import { createBrowserProviderOptions } from "./e1-application-options";
import { initialState, relativeDate } from "./e1-bootstrap";
import { createE1ShellRuntime } from "./e1-shell-runtime";
import type { ShellSnapshot } from "./e1-store-controller";
import type { ScopedReadView } from "./e1-read-model";
import type { DemoState } from "./types";

const NativeDateTimeFormat = Intl.DateTimeFormat;
// This instant is October 18 in the configured Toronto company timezone.
const now = new Date("2026-10-19T01:30:00.000Z");
const repositories: BrowserAuthorityRepository[] = [];
const runtimes: { dispose(): void }[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
});

afterEach(() => {
  runtimes.splice(0).forEach((runtime) => runtime.dispose());
  repositories.splice(0).forEach((repository) => repository.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function useLocalizedDateOrdering() {
  return vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    const formatter = new NativeDateTimeFormat(locales, options);
    if (
      locales === "en-CA" &&
      options?.year === "numeric" &&
      options.month === "2-digit" &&
      options.day === "2-digit" &&
      !options.hour
    ) {
      // A localized display format is not a machine date contract. Keep the
      // actual formatToParts, calendar and timezone behavior unchanged.
      Object.defineProperty(formatter, "format", {
        configurable: true,
        value: (value?: Date | number) => {
          const parts = formatter.formatToParts(value);
          const part = (type: string) =>
            parts.find((entry) => entry.type === type)!.value;
          return `${part("month")}/${part("day")}/${part("year")}`;
        },
      });
    }
    return formatter;
  });
}

function runtimeOptions(
  loadInitialBusiness = createBrowserProviderOptions().loadInitialBusiness,
) {
  const repository = new BrowserAuthorityRepository(indexedDB);
  repositories.push(repository);
  const snapshots: ShellSnapshot<ScopedReadView>[] = [];
  return {
    ...createBrowserProviderOptions(),
    repository,
    localStorage,
    sessionStorage,
    loadInitialBusiness,
    publish: (snapshot: ShellSnapshot<ScopedReadView>) =>
      snapshots.push(snapshot),
    publishPreferences: vi.fn(),
    publishError: vi.fn(),
    snapshots,
  };
}

it("retains ordinary initial records with the original native date formatter", () => {
  const state = initialState();
  expect(state.supplier_balance_snapshot_date).toBe("2026-10-18");
  expect(state.invoices!.length).toBeGreaterThan(0);
  expect(createBrowserProviderOptions().demoUsers).toHaveLength(6);
});

it.each([
  [-56, "2026-08-23"],
  [-1, "2026-10-17"],
  [0, "2026-10-18"],
  [1, "2026-10-19"],
  [14, "2026-11-01"],
] as const)(
  "keeps relative offset %i as an ISO company date when localized display ordering changes",
  (days, expected) => {
    const formatter = useLocalizedDateOrdering();
    expect(relativeDate(days)).toBe(expected);
    expect(formatter).toHaveBeenCalledWith("en-CA", {
      timeZone: configSeed.company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  },
);

it("creates actual invoice and stock fixtures when localized dates contain slashes", () => {
  useLocalizedDateOrdering();
  const state = initialState();
  expect(state.config.company.timezone).toBe(configSeed.company.timezone);
  expect(state.supplier_balance_snapshot_date).toBe("2026-10-18");
  expect(state.invoices!.length).toBeGreaterThan(0);
  for (const invoice of state.invoices!)
    expect(invoice.invoice_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(state.stock_movements!.length).toBeGreaterThan(0);
  for (const movement of state.stock_movements!)
    expect(Number.isFinite(Date.parse(movement.at))).toBe(true);
});

it("starts the actual runtime, enforces normal credentials and second step, and reopens retained business", async () => {
  useLocalizedDateOrdering();
  const load = vi.fn(createBrowserProviderOptions().loadInitialBusiness);
  const options = runtimeOptions(load);
  const runtime = await createE1ShellRuntime(options);
  runtimes.push(runtime);
  const manager = options.demoUsers.find(
    (person) => person.role === "manager",
  )!;
  expect(await runtime.demoPeople()).toHaveLength(6);
  expect(options.snapshots.at(-1)?.stage).toBe("signed_out");
  await expect(
    runtime.controller.signIn(manager.username, "incorrect-bootstrap-password"),
  ).rejects.toMatchObject({ code: "invalid" });
  expect(options.snapshots.at(-1)?.actor).toBeNull();
  await runtime.controller.signIn(manager.username, manager.password);
  expect(options.snapshots.at(-1)?.stage).toBe("second_step_challenge");
  expect(options.snapshots.at(-1)?.secondStepMethod).toBe(
    manager.setup.second_step_method,
  );
  expect(options.snapshots.at(-1)?.actor).toBeNull();
  await expect(
    runtime.controller.completeSecondStep("incorrect-bootstrap-response"),
  ).rejects.toMatchObject({ code: "second_step" });
  expect(options.snapshots.at(-1)?.actor).toBeNull();
  await runtime.controller.completeSecondStep(
    manager.setup.second_step_method === "passkey"
      ? "simulated-passkey"
      : configSeed.session.simulated_authenticator_code,
  );
  expect(options.snapshots.at(-1)?.stage).toBe("complete");
  expect(options.snapshots.at(-1)?.actor?.user_id).toBe(manager.id);
  const retained = await options.repository.loadBusiness<DemoState>(
    options.companyId,
  );
  runtime.dispose();
  options.repository.dispose();

  const reopenedOptions = runtimeOptions(load);
  const reopened = await createE1ShellRuntime(reopenedOptions);
  runtimes.push(reopened);
  expect(load).toHaveBeenCalledTimes(1);
  expect(reopenedOptions.snapshots.at(-1)?.stage).toBe("complete");
  expect(reopenedOptions.snapshots.at(-1)?.actor?.user_id).toBe(manager.id);
  expect(
    await reopenedOptions.repository.loadBusiness(reopenedOptions.companyId),
  ).toEqual(retained);
  expect(await reopened.demoPeople()).toHaveLength(6);
  expect(options.publishError).not.toHaveBeenCalled();
  expect(reopenedOptions.publishError).not.toHaveBeenCalled();
});
