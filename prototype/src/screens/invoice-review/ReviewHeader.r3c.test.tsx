import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "../../e1-bootstrap";
import { authenticatedTestActor } from "../../authority-test-fixture";
import { createInvoice } from "../../invoice";
import { invoiceView, type InvoiceReadDTO } from "../../invoice-projections";
import { ReviewHeader } from "./ReviewHeader";
const mocked = vi.hoisted(() => ({
  active: false,
  context: {} as Record<string, unknown>,
}));
vi.mock("../../store", () => ({
  useDemo: () => mocked.context,
  useConfiguredTimeZone: () => "America/Toronto",
}));
vi.mock("../../live-reading-activity", () => ({
  useLiveReadingActivity: () => ({ active: mocked.active, elapsed: "0:21" }),
}));
afterEach(cleanup);
beforeEach(() => {
  mocked.active = false;
});
function fixture() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager");
  state.invoice = createInvoice(state, actor, "Branch 1", false, {
    empty: true,
  });
  mocked.context = {
    state,
    lang: "en",
    t: (en: string) => en,
    can: () => false,
  };
  const invoice: InvoiceReadDTO = {
    ...invoiceView(state, actor, state.invoice.id),
    status: "reading",
    original_available: true,
    live_reading: { phase: "processing", attempt_id: "fictional-attempt" },
  };
  return invoice;
}
function show(invoice: InvoiceReadDTO) {
  render(
    <ReviewHeader
      invoice={invoice}
      missing=""
      onClose={vi.fn()}
      onPost={vi.fn()}
      onAttemptPost={vi.fn()}
    />,
  );
}
describe("R3c F7 truthful reading header", () => {
  it("shows New invoice and the actual active reading without missing fragments or a Post control", () => {
    const invoice = fixture();
    mocked.active = true;
    show(invoice);
    expect(screen.getByRole("heading", { name: "New invoice" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Reading with AI…");
    expect(
      screen.queryByText("Not added", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Post invoice" }),
    ).not.toBeInTheDocument();
  });
  it.each([
    ["ready", "Original saved · ready to read"],
    ["processing", "Reading interrupted · read again"],
    ["cancelled", "Reading cancelled · original saved"],
    ["failed", "Reading did not finish · original saved"],
  ] as const)("keeps inactive %s recovery truthful", (phase, caption) => {
    const invoice = fixture();
    invoice.live_reading!.phase = phase;
    show(invoice);
    expect(screen.getByRole("heading", { name: "New invoice" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(caption);
    expect(
      screen.queryByText("Reading with AI…", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Post invoice" }),
    ).not.toBeInTheDocument();
  });
  it("retains invoice identity and ordinary Post presentation in review", () => {
    const invoice = fixture();
    invoice.status = "review";
    invoice.supplier_invoice_number = "FICTIONAL-F7-1";
    invoice.supplier = "Fictional Orchard";
    invoice.invoice_date = "2026-10-29";
    show(invoice);
    expect(
      screen.getByRole("heading", {
        name: "Invoice FICTIONAL-F7-1",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Post invoice" })).toBeVisible();
    expect(
      screen.queryByText("Reading interrupted · read again", { exact: true }),
    ).not.toBeInTheDocument();
  });
});
