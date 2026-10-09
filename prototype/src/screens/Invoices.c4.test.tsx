import { beforeEach, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, initialState, useDemo } from "../store";
import {
  addManualLine,
  createInvoice,
  postInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "../invoice";
import { InvoiceCorrectionDialog } from "./InvoiceCorrectionDialog";
import { InvoiceQuantity } from "./PostedInvoice";
import { Approvals } from "./Approvals";
import { effectiveInvoiceVersion } from "../invoice-version";
import i18n from "../i18n";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#invoices";
  await i18n.changeLanguage("en");
});

function postedFixture() {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1", true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_confirmed: true,
    supplier_invoice_number: "UI-CORRECTION-100",
    file_name: "retained-original.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
  });
  addManualLine(state, "0002");
  const line = state.invoice.lines[0];
  setInvoiceLineQuantity(line, "10", "units", 1);
  line.unit_cost_before_tax = "1.0000";
  recalculateInvoice(state.invoice, state.config);
  line.review_confirmed = true;
  line.date_tracking = false;
  line.date_confirmed = true;
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional cost evidence for correction review.",
  };
  postInvoice(state, "supervisor", "Branch 1", "Ali");
  return state;
}

function Harness({ approvals = false }: { approvals?: boolean }) {
  const { state, update, switchDemoUser, setBranch, setLang } = useDemo();
  return (
    <>
      <button
        onClick={() => {
          switchDemoUser("supervisor");
          setBranch("Branch 1");
          update((draft) => {
            Object.assign(draft, postedFixture());
            if (approvals) draft.approvals.at(-1)!.status = "superseded";
          });
        }}
      >
        Load posted invoice
      </button>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <button
        onClick={() =>
          update((draft) => {
            draft.ledger.push({
              id: "concurrent-adjustment",
              company_id: draft.config.company.seed_key,
              branch: "Branch 1",
              supplier: draft.invoice.supplier,
              type: "adjustment",
              amount: "1.00",
              date: "2026-10-09",
              reference: "UI concurrent change",
              invoice_id: draft.invoice.id,
              currency: draft.config.company.currency,
            });
          })
        }
      >
        Concurrent ledger change
      </button>
      <output data-testid="corrections">
        {state.invoice_content_corrections?.length ?? 0}
      </output>
      <output data-testid="current-total">
        {effectiveInvoiceVersion(state, state.invoice).final_total}
      </output>
      <output data-testid="original-total">{state.invoice.final_total}</output>
      {approvals ? (
        <Approvals />
      ) : (
        state.invoice.status === "posted" && (
          <InvoiceCorrectionDialog
            original={state.invoice}
            onClose={() => {}}
            onSaved={() => {}}
          />
        )
      )}
    </>
  );
}

async function correctionPreview() {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Load posted invoice" }));
  const dialog = screen.getByRole("dialog", { name: "Correct invoice" });
  const cost = within(dialog).getByLabelText("Unit cost before tax");
  await user.clear(cost);
  await user.type(cost, "2.0000");
  await user.type(
    within(dialog).getByLabelText("Reason (required)"),
    "Correct the supplier cost evidence.",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Preview correction" }),
  );
  return { user, dialog };
}

it("requires preview and confirmation before appending a correction and preserves original totals", async () => {
  const { user, dialog } = await correctionPreview();
  expect(screen.getByTestId("corrections")).toHaveTextContent("0");
  expect(within(dialog).getByText("Corrected payable")).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Continue" }));
  expect(screen.getByTestId("corrections")).toHaveTextContent("0");
  await user.click(
    within(dialog).getByRole("button", { name: "Confirm correction" }),
  );
  expect(screen.getByTestId("corrections")).toHaveTextContent("1");
  expect(screen.getByTestId("original-total")).toHaveTextContent("10.00");
  expect(screen.getByTestId("current-total")).toHaveTextContent("20.00");
});

it("rejects a correction whose financial evidence changes after preview", async () => {
  const { user, dialog } = await correctionPreview();
  await user.click(within(dialog).getByRole("button", { name: "Continue" }));
  await user.click(
    screen.getByRole("button", { name: "Concurrent ledger change" }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Confirm correction" }),
  );
  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "The invoice or allocations changed",
  );
  expect(screen.getByTestId("corrections")).toHaveTextContent("0");
  expect(screen.getByTestId("current-total")).toHaveTextContent("10.00");
});

it("shows retained superseded proposals without mislabelling or approval actions in English and Persian", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness approvals />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Load posted invoice" }));
  await user.click(screen.getByRole("tab", { name: "Superseded" }));
  expect(screen.getAllByText("Superseded").length).toBeGreaterThan(1);
  expect(
    screen.queryByRole("button", { name: "Approve price" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reject" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(screen.getAllByText("جایگزین‌شده").length).toBeGreaterThan(1);
});

it("shows a weighed posted quantity with its retained case count and source-unit pack", () => {
  const line = postedFixture().invoice.lines[0];
  Object.assign(line, {
    sold_by: "weight",
    quantity_unit: "cases",
    quantity_entered: "3",
    source_quantity: "30",
    source_quantity_unit: "kg",
    case_weight: "10",
    case_weight_unit: "kg",
  });
  render(
    <DemoProvider>
      <InvoiceQuantity line={line} />
    </DemoProvider>,
  );
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText("30 kg")).toBeInTheDocument();
  expect(screen.getByText("10 kg")).toBeInTheDocument();
  expect(screen.getByText(/Case of/)).toBeInTheDocument();
});
