import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
} from "@testing-library/react";
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
import { authenticatedTestActor } from "../authority-test-fixture";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { useProtectedQuery } from "../use-protected-query";
import { selectInvoiceWorkspace } from "../invoice-workspace-read";
import { requireInvoiceAuthority } from "../invoice-authority";
import { purchaseInvoiceView } from "../invoice-projections";
import { postPayment } from "../operations";
import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";
import { installMissingInvoiceImageDecoder } from "../invoice-ui-image-test-platform";
import { useState } from "react";

beforeEach(async () => {
  installMissingInvoiceImageDecoder();
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#invoices";
  await i18n.changeLanguage("en");
});

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
async function fixtureFor(state = postedFixture()) {
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { locations: ["Branch 1"], name_en: "Ali" },
  });
  fixtures.push(fixture);
  return fixture;
}
function postedFixture() {
  const state = initialState(),
    actor = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
      name_en: "Ali",
    });
  state.invoice = createInvoice(state, actor, "Branch 1", true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_confirmed: true,
    supplier_invoice_number: "UI-CORRECTION-100",
    file_name: "retained-original.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
  });
  addManualLine(state, actor, "0002");
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
  postInvoice(state, actor);
  return state;
}

function Harness({ approvals = false }: { approvals?: boolean }) {
  const { state, actor, command, setLang } = useDemo();
  const [loaded, setLoaded] = useState(false);
  const invoice = state.invoice_workspace?.invoice;
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
    entity_id: invoice?.id,
  };
  const facts = useProtectedQuery(
    invoice ? "invoices.cost_read" : null,
    scope,
    (canonical, currentActor) => {
      requireInvoiceAuthority(
        canonical,
        currentActor,
        "invoices.cost_read",
        invoice?.id,
      );
      const source = canonical.invoice;
      return {
        corrections:
          canonical.invoice_content_corrections?.filter(
            (row) => row.invoice_id === source.id,
          ).length ?? 0,
        original_total: source.final_total,
      };
    },
    invoice?.id ?? "",
  );
  return (
    <>
      <button
        disabled={!actor || !invoice}
        onClick={async () => {
          if (!invoice) return;
          await command("invoices.read", scope, (draft, currentActor) =>
            selectInvoiceWorkspace(draft, currentActor, invoice.id),
          );
          setLoaded(true);
        }}
      >
        Load posted invoice
      </button>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <button
        disabled={!actor || !invoice}
        onClick={async () => {
          if (!invoice) return;
          await command(
            "payables.write",
            {
              company_id: invoice.company_id,
              kind: "location_record",
              location_ids: [invoice.branch],
              mutation: true,
              location_policy: "active_only",
            },
            (draft, currentActor) =>
              postPayment(draft, currentActor, {
                supplier: invoice.supplier,
                amount: "1.00",
                date: "2026-10-09",
                cheque: "",
                receipt: "UI concurrent change",
                allocations: [{ invoice_id: invoice.id, amount: "1.00" }],
              }),
          );
        }}
      >
        Concurrent ledger change
      </button>
      <output data-testid="corrections">
        {facts.data?.corrections ?? "—"}
      </output>
      <output data-testid="current-total">{invoice?.final_total ?? "—"}</output>
      <output data-testid="original-total">
        {facts.data?.original_total ?? "—"}
      </output>
      {loaded &&
        (approvals ? (
          <Approvals />
        ) : (
          invoice && (
            <InvoiceCorrectionDialog
              original={invoice}
              onClose={() => {}}
              onSaved={() => {}}
            />
          )
        ))}
    </>
  );
}

async function correctionPreview() {
  const user = userEvent.setup();
  const fixture = await fixtureFor();
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  await renderedUiReady(
    () =>
      (
        screen.queryByRole("button", {
          name: "Load posted invoice",
        }) as HTMLButtonElement | null
      )?.disabled === false,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Load posted invoice" }),
    ).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Load posted invoice" }));
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("dialog", { name: "Correct invoice" })),
  );
  const dialog = await screen.findByRole("dialog", { name: "Correct invoice" });
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
  await renderedUiReady(() =>
    Boolean(within(dialog).queryByText("Corrected payable")),
  );
  await within(dialog).findByText("Corrected payable");
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
  await waitFor(() =>
    expect(screen.getByTestId("corrections")).toHaveTextContent("1"),
  );
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
  await waitFor(() =>
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "The invoice or allocations changed",
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("corrections")).toHaveTextContent("0"),
  );
  expect(screen.getByTestId("current-total")).toHaveTextContent("10.00");
});

it("shows retained superseded proposals without mislabelling or approval actions in English and Persian", async () => {
  const user = userEvent.setup(),
    state = postedFixture();
  state.approvals.at(-1)!.status = "superseded";
  const fixture = await fixtureFor(state);
  render(
    <DemoProvider options={fixture.options}>
      <Harness approvals />
    </DemoProvider>,
  );
  await renderedUiReady(
    () =>
      (
        screen.queryByRole("button", {
          name: "Load posted invoice",
        }) as HTMLButtonElement | null
      )?.disabled === false,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Load posted invoice" }),
    ).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Load posted invoice" }));
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("tab", { name: "Superseded" })),
  );
  await user.click(await screen.findByRole("tab", { name: "Superseded" }));
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

it("shows a weighed posted quantity with its retained case count and source-unit pack", async () => {
  const state = postedFixture(),
    actor = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
    });
  const line = purchaseInvoiceView(state, actor).lines[0];
  Object.assign(line, {
    sold_by: "weight",
    quantity_unit: "cases",
    quantity_entered: "3",
    source_quantity: "30",
    source_quantity_unit: "kg",
    case_weight: "10",
    case_weight_unit: "kg",
  });
  const fixture = await fixtureFor(state);
  render(
    <DemoProvider options={fixture.options}>
      <InvoiceQuantity line={line} />
    </DemoProvider>,
  );
  expect(await screen.findByText("3")).toBeInTheDocument();
  expect(screen.getByText("30 kg")).toBeInTheDocument();
  expect(screen.getByText("10 kg")).toBeInTheDocument();
  expect(screen.getByText(/Case of/)).toBeInTheDocument();
});
