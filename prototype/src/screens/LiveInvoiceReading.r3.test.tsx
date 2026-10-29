import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LiveInvoiceReading } from "./LiveInvoiceReading";
import type { InvoiceReadDTO } from "../invoice-projections";
import type { useDemo } from "../store";
import { configSeed } from "../config";
import { appWorkPending } from "../app-work";

const ports = vi.hoisted(() => ({
  load: vi.fn(),
  prepare: vi.fn(),
  request: vi.fn(),
  begin: vi.fn(),
  settle: vi.fn(),
  apply: vi.fn(),
  command: vi.fn(),
}));
let context: ReturnType<typeof useDemo>;
vi.mock("../store", () => ({ useDemo: () => context }));
vi.mock("../invoice-file-access", () => ({
  loadInvoiceOriginal: ports.load,
  storeInvoiceUpload: vi.fn(),
}));
vi.mock("../invoice-live-images", () => ({
  prepareLiveReaderImages: ports.prepare,
}));
vi.mock("../invoice-live-reader", () => ({
  LIVE_READING_TIMEOUT_MS: 240000,
  requestLiveInvoiceReading: ports.request,
  buildLiveInvoiceReadingsExport: vi.fn(),
}));
vi.mock("../invoice-live-reading", () => ({
  attachLiveInvoiceOriginals: vi.fn(),
  beginLiveInvoiceReading: ports.begin,
  settleLiveInvoiceReading: ports.settle,
  applyLiveInvoiceReading: ports.apply,
  reorderLiveInvoiceOriginals: vi.fn(),
  useSimulatedLiveInvoiceReading: vi.fn(),
}));
const t = (en: string) => en;
function draft() {
  return {
    id: "fictional-live-draft",
    company_id: "fictional-live-company",
    status: "reading",
    file_name: "fictional-page.png",
    file_type: "image/png",
    file_size: 20,
    original_available: true,
    original_page_count: 1,
    live_reading: { phase: "ready", attempt_id: "fictional-ready-attempt" },
    lines: [],
  } as unknown as InvoiceReadDTO;
}
beforeEach(() => {
  vi.clearAllMocks();
  context = {
    state: {
      config: {
        ...configSeed,
        receiving: {
          ...configSeed.receiving,
          ai_reading_mode: "live",
          ai_reader_address: "http://fictional-reader.test:5191",
        },
      },
    },
    actor: {
      company_id: "fictional-live-company",
      user_id: "fictional-manager",
      session_id: "fictional-session",
      role: "manager",
      authority_epoch: 1,
      person_version: 1,
      selection: { kind: "location", location_id: "fictional-location" },
    },
    t,
    query: vi.fn(),
    command: ports.command,
  } as unknown as ReturnType<typeof useDemo>;
  ports.load.mockResolvedValue({
    source: new Blob(["fictional original"], { type: "image/png" }),
    type: "image/png",
    name: "fictional-page.png",
  });
  ports.begin.mockReturnValue({
    invoice_id: "fictional-live-draft",
    attempt_id: "fictional-processing-attempt",
    branch: "fictional-location",
    started_at: new Date().toISOString(),
    original_sha256s: ["a".repeat(64)],
  });
  ports.command.mockImplementation(async (_capability, _scope, mutate) =>
    mutate({}, context.actor),
  );
  ports.prepare.mockImplementation(() => new Promise(() => {}));
});
afterEach(async () => {
  cleanup();
  await act(async () => {});
  vi.useRealTimers();
});
async function ready() {
  const view = render(<LiveInvoiceReading invoice={draft()} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read invoice" })).toBeEnabled(),
  );
  return view;
}
it("ends an unresponsive preparation at four minutes without ever calling the reader or blocking page leave", async () => {
  await ready();
  vi.useFakeTimers();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  expect(ports.begin).toHaveBeenCalledTimes(1);
  expect(ports.prepare).toHaveBeenCalledTimes(1);
  expect(appWorkPending()).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(239999));
  expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  expect(
    screen.queryByText("The AI reading didn't finish. Your original is saved."),
  ).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(
    screen.getByText("The AI reading didn't finish. Your original is saved."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  expect(ports.request).not.toHaveBeenCalled();
  expect(ports.settle).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    {
      invoice_id: "fictional-live-draft",
      attempt_id: "fictional-processing-attempt",
      outcome: "failed",
    },
  );
  expect(appWorkPending()).toBe(false);
});
it("cancels preparation and retains recovery without waiting for its promise", async () => {
  await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
  );
  expect(ports.request).not.toHaveBeenCalled();
  expect(ports.settle).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    {
      invoice_id: "fictional-live-draft",
      attempt_id: "fictional-processing-attempt",
      outcome: "cancelled",
    },
  );
  expect(screen.getByRole("button", { name: "Enter by hand" })).toBeVisible();
  expect(appWorkPending()).toBe(false);
});
it("aborts the old request intent when the configured reader changes", async () => {
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  const signal = ports.prepare.mock.calls[0][1] as AbortSignal;
  context = {
    ...context,
    state: {
      ...context.state,
      config: {
        ...context.state.config,
        receiving: {
          ...context.state.config.receiving,
          ai_reader_address: "http://other-fictional-reader.test:5191",
        },
      },
    },
  };
  await act(async () =>
    view.rerender(<LiveInvoiceReading invoice={draft()} />),
  );
  expect(signal.aborted).toBe(true);
  expect(ports.request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Enter by hand" })).toBeVisible();
});
it("aborts when Live mode is switched off without making an automatic fallback request", async () => {
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  const signal = ports.prepare.mock.calls[0][1] as AbortSignal;
  context = {
    ...context,
    state: {
      ...context.state,
      config: {
        ...context.state.config,
        receiving: {
          ...context.state.config.receiving,
          ai_reading_mode: "simulated",
        },
      },
    },
  };
  await act(async () =>
    view.rerender(<LiveInvoiceReading invoice={draft()} />),
  );
  expect(signal.aborted).toBe(true);
  expect(ports.request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Read invoice" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Use simulated reading" }),
  ).toBeVisible();
});
it("aborts when another accepted attempt supersedes this one", async () => {
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  const signal = ports.prepare.mock.calls[0][1] as AbortSignal;
  await act(async () =>
    view.rerender(
      <LiveInvoiceReading
        invoice={{
          ...draft(),
          live_reading: {
            phase: "processing",
            attempt_id: "another-accepted-attempt",
          },
        }}
      />,
    ),
  );
  expect(signal.aborted).toBe(true);
  expect(ports.request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Read again" })).toBeVisible();
});
