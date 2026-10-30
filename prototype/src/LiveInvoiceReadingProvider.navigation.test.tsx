import { File as NodeFile } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { DemoProvider, initialState, useDemo } from "./store";
import { LiveInvoiceReadingProvider } from "./LiveInvoiceReadingProvider";
import { useLiveInvoiceReadingService } from "./live-invoice-reading-context";
import type { LiveInvoiceReadingService } from "./live-invoice-reading-service";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import {
  addTimesheetRow,
  addTimesheetStaff,
  timesheetClock,
  timesheetScope,
} from "./timesheets";
import { createInvoice } from "./invoice";
import { storeInvoiceUpload } from "./invoice-file-access";
import { attachLiveInvoiceOriginals } from "./invoice-live-reading";
import {
  purchaseInvoiceView,
  type InvoiceReadDTO,
} from "./invoice-projections";
import type { DemoState } from "./types";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "./test/rendered-ui-readiness";

// Keep real authority, IndexedDB, importer, Timesheets and route guards.
// Browser proofs cover media preparation/viewing; this test isolates pending-save navigation.
const reader = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./invoice-live-images", async (original) => ({
  ...(await original<typeof import("./invoice-live-images")>()),
  prepareLiveReaderImages: vi.fn(async () => [
    { mime: "image/jpeg", data: "AA==" },
    { mime: "image/jpeg", data: "AA==" },
  ]),
}));
vi.mock("./invoice-live-reader", async (original) => ({
  ...(await original<typeof import("./invoice-live-reader")>()),
  requestLiveInvoiceReading: reader.request,
}));
vi.mock("./screens/invoice-review/OriginalViewer", () => ({
  OriginalViewer: () => null,
}));
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
let ports: ReturnType<typeof useDemo>;
let service: LiveInvoiceReadingService;
let release: (() => void) | undefined;
function Probe() {
  const current = useDemo();
  const currentService = useLiveInvoiceReadingService();
  useLayoutEffect(() => {
    ports = current;
    service = currentService;
  }, [current, currentService]);
  return null;
}
afterEach(() => {
  release?.();
  cleanup();
  fixture?.dispose();
  clearRenderedUiReadiness();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("ready Open retains a real pending Timesheets edit and its notice until guarded navigation succeeds", async () => {
  localStorage.clear();
  sessionStorage.clear();
  const state = initialState();
  state.timesheet_staff = [];
  state.timesheet_days = [];
  state.timesheet_rows = [];
  state.config.modules.timesheets = true;
  state.config.receiving.ai_reading_mode = "live";
  const branch = "Branch 1";
  const department = state.config.timesheets!.departments[0].key;
  const date = timesheetClock(state.config, branch).date;
  fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: {
      locations: [branch],
      selection: { kind: "location", location_id: branch },
    },
  });
  await fixture.repository.runBusinessCommand<DemoState, void>(
    fixture.identity,
    (draft, actor) => {
      const staff = addTimesheetStaff(draft, actor, {
        branch,
        name_en: "Fictional Emery Vale",
        usual_department_key: department,
      });
      addTimesheetRow(draft, actor, {
        branch,
        date,
        department_key: department,
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
  reader.request.mockResolvedValue({
    reading: {
      schema_version: "invoice-reading-v2",
      supplier_name: "Fictional Juniper Pantry",
      supplier_invoice_number: "FICTIONAL-BACKGROUND-NAV-1",
      invoice_date: "2026-10-29",
      currency: "CAD",
      payment_terms: "Net 14",
      subtotal: "1.23",
      tax: "0",
      final_total: "1.23",
      lines: [
        {
          line_type: "item",
          description: "Fictional Juniper Oats 100 g",
          quantity: "1",
          unit: "each",
          units_received: "1",
          unit_cost_before_tax: "1.23",
          line_total: "1.23",
        },
      ],
    },
    statuses: {},
    checksPassed: true,
    models: ["Fictional Background Reader"],
    costUSD: "0.0123",
    seconds: 4,
  });
  render(
    <DemoProvider options={fixture.options}>
      <LiveInvoiceReadingProvider>
        <App />
        <Probe />
      </LiveInvoiceReadingProvider>
    </DemoProvider>,
  );
  await renderedUiReady(
    () =>
      document.querySelector(
        '[aria-label="In time for Fictional Emery Vale"]',
      ) !== null,
  );
  const company = state.config.company.seed_key;
  let invoiceId = "";
  let invoice!: InvoiceReadDTO;
  await act(async () => {
    invoiceId = await ports.command(
      "invoices.enter",
      {
        company_id: company,
        kind: "location_record",
        location_ids: [branch],
        mutation: true,
      },
      (draft, actor) => {
        draft.invoice = createInvoice(draft, actor, branch, false, {
          empty: true,
        });
        return draft.invoice.id;
      },
    );
    const scope = {
      company_id: company,
      kind: "company_shared" as const,
      entity_id: invoiceId,
    };
    const file = new NodeFile(
      [readFileSync(resolve("tests/fixtures/r3-fictional-two-page.pdf"))],
      "fictional-background.pdf",
      { type: "application/pdf" },
    ) as unknown as File;
    const upload = await storeInvoiceUpload(ports.query, file, {
      company_id: company,
      invoice_id: invoiceId,
    });
    await ports.command("invoices.edit", scope, (draft, actor) =>
      attachLiveInvoiceOriginals(draft, actor, {
        invoice_id: invoiceId,
        uploads: [upload],
      }),
    );
    invoice = await ports.query("invoices.read", scope, (draft, actor) =>
      purchaseInvoiceView(draft, actor, invoiceId),
    );
  });
  await act(async () => {
    await service.start(invoice);
  });
  const notice = await screen.findByTestId("live-reading-ready");
  expect(notice).toHaveTextContent("FICTIONAL-BACKGROUND-NAV-1");
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
  const input = screen.getByRole("textbox", {
    name: "In time for Fictional Emery Vale",
  });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "730" } });
  fireEvent.blur(input);
  await waitFor(() => expect(held).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /^Open$/ }));
  await waitFor(() =>
    expect(window.location.hash).toBe(
      `#invoices?id=${encodeURIComponent(invoiceId)}`,
    ),
  );
  expect(input).toBeInTheDocument();
  expect(screen.getByTestId("live-reading-ready")).toBeVisible();
  expect((await fixture.readCanonical()).timesheet_rows![0].in_time).toBe(
    "06:00",
  );
  await act(async () => {
    release?.();
  });
  await waitFor(async () =>
    expect((await fixture.readCanonical()).timesheet_rows![0].in_time).toBe(
      "07:30",
    ),
  );
  await waitFor(() =>
    expect(document.querySelector(".timesheet-departments")).toBeNull(),
  );
  await waitFor(() =>
    expect(screen.queryByTestId("live-reading-ready")).toBeNull(),
  );
  expect((await fixture.readCanonical()).invoice.id).toBe(invoiceId);
  expect((await fixture.readCanonical()).invoice.status).toBe("review");
});
