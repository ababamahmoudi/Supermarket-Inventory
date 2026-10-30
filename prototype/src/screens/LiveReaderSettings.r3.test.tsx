import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { SettingsConfigurationGate } from "../SettingsConfigurationGate";
import i18n from "../i18n";
import App from "../App";
import LiveReaderSettings from "./LiveReaderSettings";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
const originalWidth = window.innerWidth;
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/#settings?group=receiving");
  Object.defineProperty(window, "innerWidth", {
    value: 1440,
    configurable: true,
  });
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "innerWidth", {
    value: originalWidth,
    configurable: true,
  });
});
async function settingsFixture() {
  const state = initialState();
  state.config.receiving.ai_reader_address =
    "http://retained-reader.local:5191";
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <SettingsConfigurationGate>
        <LiveReaderSettings />
      </SettingsConfigurationGate>
    </DemoProvider>,
  );
  await screen.findByLabelText("Reader address");
  return fixture;
}

it("saves Live and the custom address through genuine settings authority, and Reset restores the localhost default", async () => {
  const fixture = await settingsFixture();
  const before = await fixture.readCanonical();
  fireEvent.click(screen.getByRole("combobox", { name: "Reading mode" }));
  fireEvent.click(screen.getByRole("option", { name: "Live" }));
  fireEvent.change(screen.getByLabelText("Reader address"), {
    target: { value: "http://fictional-reader.local:5191/base/" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(async () =>
    expect((await fixture.readCanonical()).config.receiving).toEqual({
      ...before.config.receiving,
      ai_reading_mode: "live",
      ai_reader_address: "http://fictional-reader.local:5191/base",
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Reader address")).toHaveValue(
      "http://fictional-reader.local:5191/base",
    ),
  );
  expect((await fixture.readCanonical()).products).toEqual(before.products);
  fireEvent.click(screen.getByRole("button", { name: "Reset reader address" }));
  expect(screen.getByLabelText("Reader address")).toHaveValue(
    "http://localhost:5191",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).config.receiving.ai_reader_address,
    ).toBeNull(),
  );
  expect((await fixture.readCanonical()).config.receiving.ai_reading_mode).toBe(
    "live",
  );
});

it("shows honest health outcomes and never displays a result for an address the person has replaced", async () => {
  await settingsFixture();
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("ready", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText("Connected · reader ready");
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText(
    /Can't reach the reader at http:\/\/retained-reader.local:5191/,
  );
  expect(
    screen.getByText(/The reader may also need to allow this page's address/),
  ).toBeVisible();
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  expect(
    screen.getByRole("button", { name: "Testing connection…" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reader address"), {
    target: { value: "http://new-reader.local:5191" },
  });
  await act(async () => finish(new Response("ready", { status: 200 })));
  expect(
    screen.queryByText("Connected · reader ready"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Can't reach the reader/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled();
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("the genuine Manager Demo toggle changes the same saved mode and retains its address", async () => {
  const state = initialState();
  state.config.receiving.ai_reader_address =
    "http://retained-reader.local:5191";
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <App />
    </DemoProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Demo" }));
  const toggle = await screen.findByRole("menuitemcheckbox", {
    name: "Simulated reading",
  });
  expect(toggle).toBeChecked();
  toggle.focus();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-disabled", "true");
  expect(toggle).toHaveAttribute("aria-busy", "true");
  expect(toggle).toHaveFocus();
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).config.receiving.ai_reading_mode,
    ).toBe("live"),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Simulated reading" }),
    ).not.toBeChecked(),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Simulated reading" }),
    ).toHaveAttribute("aria-busy", "false"),
  );
  fireEvent.click(
    screen.getByRole("menuitemcheckbox", { name: "Simulated reading" }),
  );
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).config.receiving.ai_reading_mode,
    ).toBe("simulated"),
  );
  expect(
    (await fixture.readCanonical()).config.receiving.ai_reader_address,
  ).toBe("http://retained-reader.local:5191");
});

it("the Floor Worker Demo menu cannot change the company reading mode", async () => {
  window.history.replaceState(null, "", "/#invoices");
  const fixture = await authenticatedProviderFixture({
    state: initialState,
    role: "floor_worker",
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <App />
    </DemoProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Demo" }));
  expect(
    screen.queryByRole("menuitemcheckbox", { name: "Simulated reading" }),
  ).not.toBeInTheDocument();
  expect((await fixture.readCanonical()).config.receiving.ai_reading_mode).toBe(
    "simulated",
  );
});
