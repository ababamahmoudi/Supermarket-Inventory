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
import { LiveInvoiceReadingProvider } from "../LiveInvoiceReadingProvider";
import {
  useLiveInvoiceReadingService,
  useLiveInvoiceReadingOperation,
} from "../live-invoice-reading-context";
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
  selection: vi.fn(),
}));
let context: ReturnType<typeof useDemo>;
vi.mock("../store", () => ({ useDemo: () => context }));
vi.mock("../invoice-file-access", () => ({
  loadInvoiceOriginal: ports.load,
  storeInvoiceUpload: vi.fn(),
}));
vi.mock("../invoice-live-pdf-pages", () => ({
  loadLiveOriginalSelection: ports.selection,
  inspectLivePdfPages: vi.fn(),
}));
vi.mock("../invoice-live-images", async (original) => ({
  ...(await original<typeof import("../invoice-live-images")>()),
  prepareLiveReaderImages: ports.prepare,
}));
vi.mock("../invoice-live-reader", async (original) => ({
  ...(await original<typeof import("../invoice-live-reader")>()),
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
  addLiveInvoicePages: vi.fn(),
  removeLiveInvoicePage: vi.fn(),
  selectLiveInvoicePdfPages: vi.fn(),
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
  ports.selection.mockResolvedValue({
    count: 1,
    pdf: false,
    selected: null,
    editable: true,
  });
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
  const view = render(<LiveInvoiceReading invoice={draft()} />, {
    wrapper: LiveInvoiceReadingProvider,
  });
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
      diagnostic: { reason: "timeout" },
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
it("prepares the canonical PDF selection and uses reading-purpose original access", async () => {
  ports.begin.mockReturnValue({
    invoice_id: "fictional-live-draft",
    attempt_id: "fictional-processing-attempt",
    branch: "fictional-location",
    started_at: new Date().toISOString(),
    original_sha256s: ["a".repeat(64)],
    pdf_pages: [2],
  });
  await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  expect(ports.prepare).toHaveBeenCalledWith(
    [expect.any(File)],
    expect.any(AbortSignal),
    [2],
  );
  expect(
    ports.load.mock.calls.every((call) => call[1].purpose === "reading"),
  ).toBe(true);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
  );
});
it("keeps the empty active selection empty while allowing a photo to be added", async () => {
  ports.selection.mockResolvedValue({
    count: 0,
    pdf: false,
    selected: null,
    editable: true,
  });
  render(<LiveInvoiceReading invoice={draft()} />, {
    wrapper: LiveInvoiceReadingProvider,
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add page" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "Read invoice" })).toBeDisabled();
  expect(ports.load).not.toHaveBeenCalled();
  expect(ports.begin).not.toHaveBeenCalled();
  expect(
    screen.getByText("No pages selected for reading. Add a page to continue."),
  ).toBeVisible();
});
it("keeps the accepted request when the configured reader changes", async () => {
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
  expect(signal.aborted).toBe(false);
  expect(ports.request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
});
it("keeps the accepted request when Live mode is switched off without making an automatic fallback request", async () => {
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
  expect(signal.aborted).toBe(false);
  expect(ports.request).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Read invoice" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Use simulated reading" }),
  ).toBeNull();
});
it("aborts when another accepted attempt supersedes this one", async () => {
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  const signal = ports.prepare.mock.calls[0][1] as AbortSignal;
  const replacement = {
    ...draft(),
    live_reading: {
      phase: "processing" as const,
      attempt_id: "another-accepted-attempt",
    },
  };
  context = { ...context, state: { ...context.state, invoice: replacement } };
  await act(async () =>
    view.rerender(<LiveInvoiceReading invoice={replacement} />),
  );
  expect(signal.aborted).toBe(true);
  expect(ports.request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Read again" })).toBeVisible();
});
it("refreshes the protected page preview when an external reorder changes only the public invoice version", async () => {
  let order = ["fictional-A.png", "fictional-B.png", "fictional-C.png"];
  ports.load.mockImplementation(
    async (_query: unknown, input: { page?: number }) => {
      const name = order[input.page ?? 0];
      return {
        source: new Blob([name], { type: "image/png" }),
        type: "image/png",
        name,
      };
    },
  );
  const invoice = {
    ...draft(),
    version: 1,
    file_name: "fictional-A.png",
    original_page_count: 3,
  };
  ports.selection.mockResolvedValue({
    count: 3,
    pdf: false,
    selected: null,
    editable: true,
  });
  const view = render(<LiveInvoiceReading invoice={invoice} />, {
    wrapper: LiveInvoiceReadingProvider,
  });
  const shownOrder = () =>
    Array.from(
      screen
        .getByTestId("live-reading-pages")
        .querySelectorAll(".live-reading-page-name"),
    ).map((name) => name.getAttribute("title"));
  await waitFor(() =>
    expect(shownOrder()).toEqual([
      "fictional-A.png",
      "fictional-B.png",
      "fictional-C.png",
    ]),
  );
  expect(ports.load).toHaveBeenCalledTimes(3);
  order = ["fictional-A.png", "fictional-C.png", "fictional-B.png"];
  view.rerender(<LiveInvoiceReading invoice={{ ...invoice, version: 2 }} />);
  await waitFor(() =>
    expect(shownOrder()).toEqual([
      "fictional-A.png",
      "fictional-C.png",
      "fictional-B.png",
    ]),
  );
  expect(ports.load).toHaveBeenCalledTimes(6);
  expect(ports.load.mock.calls.map((call) => call[1].page)).toEqual([
    0, 1, 2, 0, 1, 2,
  ]);
  expect(ports.request).not.toHaveBeenCalled();
});
it("keeps interrupted Processing recovery available while disabling impossible page-order actions", async () => {
  ports.load.mockImplementation(
    async (_query: unknown, input: { page?: number }) => ({
      source: new Blob(["fictional original"], { type: "image/png" }),
      type: "image/png",
      name: ["fictional-A.png", "fictional-B.png", "fictional-C.png"][
        input.page ?? 0
      ],
    }),
  );
  const invoice: InvoiceReadDTO = {
    ...draft(),
    original_page_count: 3,
    live_reading: {
      phase: "processing",
      attempt_id: "interrupted-processing-attempt",
    },
  };
  ports.selection.mockResolvedValue({
    count: 3,
    pdf: false,
    selected: null,
    editable: true,
  });
  const view = render(<LiveInvoiceReading invoice={invoice} />, {
    wrapper: LiveInvoiceReadingProvider,
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read again" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "Enter by hand" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Move page 2 up" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Move page 2 down" }),
  ).toBeDisabled();
  expect(ports.command).not.toHaveBeenCalled();
  await act(async () =>
    view.rerender(
      <LiveInvoiceReading
        invoice={{
          ...invoice,
          live_reading: { phase: "ready", attempt_id: "ready-attempt" },
        }}
      />,
    ),
  );
  expect(screen.getByRole("button", { name: "Read invoice" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Move page 2 up" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Move page 2 down" }),
  ).toBeEnabled();
  expect(ports.request).not.toHaveBeenCalled();
});

it("continues the same paid request after the invoice screen leaves and applies to its saved target", async () => {
  ports.prepare.mockResolvedValue([{ mime: "image/jpeg", data: "fictional" }]);
  let answer!: (value: unknown) => void;
  ports.request.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  ports.apply.mockReturnValue({ imported: [], skipped: [] });
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  await waitFor(() => expect(ports.request).toHaveBeenCalledTimes(1));
  const signal = ports.request.mock.calls[0][2] as AbortSignal;
  await act(async () => view.rerender(<p>Lookup remains open</p>));
  try {
    expect(signal.aborted).toBe(false);
    expect(ports.settle).not.toHaveBeenCalled();
    expect(appWorkPending()).toBe(false);
  } finally {
    await act(async () =>
      answer({ seconds: 12, costUSD: "0.0123", models: ["Fictional reader"] }),
    );
  }
  await waitFor(() => expect(ports.apply).toHaveBeenCalledTimes(1));
  expect(ports.apply.mock.calls[0][2]).toMatchObject({
    invoice_id: "fictional-live-draft",
    attempt_id: "fictional-processing-attempt",
  });
  expect(screen.getByText("Lookup remains open")).toBeVisible();
  expect(ports.request).toHaveBeenCalledTimes(1);
  expect(ports.settle).not.toHaveBeenCalled();
  expect(appWorkPending()).toBe(false);
});

it("uses the accepted reader address after settings and location selection change", async () => {
  let prepared!: (images: unknown) => void;
  ports.prepare.mockReturnValue(
    new Promise((resolve) => {
      prepared = resolve;
    }),
  );
  ports.request.mockResolvedValue({
    seconds: 12,
    costUSD: "0.0123",
    models: ["Fictional reader"],
  });
  ports.apply.mockReturnValue({ imported: [], skipped: [] });
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  context = {
    ...context,
    actor: {
      ...context.actor!,
      selection: { kind: "location", location_id: "other-fictional-location" },
    },
    state: {
      ...context.state,
      config: {
        ...context.state.config,
        receiving: {
          ...context.state.config.receiving,
          ai_reading_mode: "simulated",
          ai_reader_address: "http://other-fictional-reader.test:5191",
        },
      },
    },
  };
  await act(async () => view.rerender(<p>Other route</p>));
  expect((ports.prepare.mock.calls[0][1] as AbortSignal).aborted).toBe(false);
  await act(async () => prepared([{ mime: "image/jpeg", data: "fictional" }]));
  await waitFor(() => expect(ports.apply).toHaveBeenCalledTimes(1));
  expect(ports.request.mock.calls[0][0]).toBe(
    "http://fictional-reader.test:5191",
  );
  expect(ports.request).toHaveBeenCalledTimes(1);
});

it("cannot adopt a late background response under a replacement session", async () => {
  ports.prepare.mockResolvedValue([{ mime: "image/jpeg", data: "fictional" }]);
  let answer!: (value: unknown) => void;
  ports.request.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  await waitFor(() => expect(ports.request).toHaveBeenCalledTimes(1));
  const signal = ports.request.mock.calls[0][2] as AbortSignal;
  context = {
    ...context,
    actor: { ...context.actor!, session_id: "replacement-fictional-session" },
  };
  await act(async () => view.rerender(<p>New session</p>));
  expect(signal.aborted).toBe(true);
  await act(async () =>
    answer({ seconds: 12, costUSD: "0.0123", models: ["Fictional reader"] }),
  );
  expect(ports.apply).not.toHaveBeenCalled();
  expect(ports.settle).not.toHaveBeenCalled();
  expect(screen.queryByTestId("live-reading-ready")).toBeNull();
});

function RetireControls() {
  const service = useLiveInvoiceReadingService();
  return (
    <>
      <button
        onClick={() =>
          service.retire(
            "fictional-live-company",
            "fictional-live-draft",
            "old-unrelated-attempt",
          )
        }
      >
        Retire old attempt
      </button>
      <button
        onClick={() =>
          service.retire(
            "fictional-live-company",
            "fictional-live-draft",
            "fictional-processing-attempt",
          )
        }
      >
        Retire accepted attempt
      </button>
    </>
  );
}
it("retires only the exact discarded transport without an extra canonical settlement", async () => {
  ports.prepare.mockResolvedValue([{ mime: "image/jpeg", data: "fictional" }]);
  let answer!: (value: unknown) => void;
  ports.request.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  await waitFor(() => expect(ports.request).toHaveBeenCalledTimes(1));
  const signal = ports.request.mock.calls[0][2] as AbortSignal;
  await act(async () => view.rerender(<RetireControls />));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Retire old attempt" })),
  );
  expect(signal.aborted).toBe(false);
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Retire accepted attempt" }),
    ),
  );
  expect(signal.aborted).toBe(true);
  await act(async () =>
    answer({ seconds: 12, costUSD: "0.0123", models: ["Fictional reader"] }),
  );
  expect(ports.settle).not.toHaveBeenCalled();
  expect(ports.apply).not.toHaveBeenCalled();
  expect(screen.queryByTestId("live-reading-ready")).toBeNull();
});

function RetiredFailureControls() {
  const operation = useLiveInvoiceReadingOperation(draft());
  return (
    <>
      <RetireControls />
      <output data-testid="retired-failure">{String(operation.failure)}</output>
    </>
  );
}
it("retires only the accepted failed source snapshot without keeping a stale failure on its replacement", async () => {
  ports.prepare.mockResolvedValue([{ mime: "image/jpeg", data: "fictional" }]);
  ports.request.mockRejectedValue(new TypeError("Fictional network failure"));
  const view = await ready();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Read invoice" })),
  );
  await screen.findByText(
    "The AI reading didn't finish. Your original is saved.",
  );
  const settlements = ports.settle.mock.calls.length;
  await act(async () => view.rerender(<RetiredFailureControls />));
  expect(screen.getByTestId("retired-failure")).toHaveTextContent("true");
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Retire old attempt" })),
  );
  expect(screen.getByTestId("retired-failure")).toHaveTextContent("true");
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Retire accepted attempt" }),
    ),
  );
  expect(screen.getByTestId("retired-failure")).toHaveTextContent("false");
  expect(ports.settle).toHaveBeenCalledTimes(settlements);
});
