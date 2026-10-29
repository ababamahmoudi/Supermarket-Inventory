import { useRef, useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { initialState } from "../../e1-bootstrap";
import { cloneWithAuthority } from "../../authority";
import { authenticatedTestActor } from "../../authority-test-fixture";
import { normalizeInvoiceReceivingReview } from "../../invoice-checks";
import {
  addInvoiceOtherCharge,
  editInvoiceOtherCharge,
  removeInvoiceOtherCharge,
} from "../../invoice-other-charges";
import type { InvoicePurchaseReadDTO } from "../../invoice-projections";
import type { DemoInvoice } from "../../types";
import type { ReviewUpdate } from "./types";
import { OtherChargesEditor } from "./OtherChargesEditor";
import { TotalsCard } from "./TotalsCard";

const locale = vi.hoisted(() => ({ language: "en" as "en" | "fa" }));
vi.mock("../../store", () => ({
  useDemo: () => ({
    t: (en: string, fa: string) => (locale.language === "fa" ? fa : en),
    state: { config: { company: { currency: "CAD" } } },
  }),
}));
afterEach(() => {
  cleanup();
  locale.language = "en";
});

function draft() {
  const state = initialState();
  state.invoice.lines = [
    {
      ...state.invoice.lines[0],
      quantity_unit: "units",
      quantity_entered: "2",
      qty_invoiced: 2,
      qty_received_at_posting: 2,
      unit_cost_before_tax: "1.1000",
      case_cost_before_tax: undefined,
      line_total: "2.20",
    },
  ];
  Object.assign(state.invoice, {
    status: "review",
    other_charges: [],
    short_lines: [],
    subtotal: "2.20",
    tax: "0.00",
    final_total: "2.20",
    final_total_manual: true,
    low_confidence_fields: [],
    calculated_from_lines: true,
    calculated_fields: ["subtotal"],
    reading_record: {
      source: "imported",
      file_name: "fictional-totals.json",
      page_sha256s: ["e".repeat(64)],
      models: ["fictional-model"],
      reading_cost_usd: "0.01",
      exported_at: "2026-10-29T12:00:00Z",
      ai_source: "fictional",
    },
  });
  return { state, actor: authenticatedTestActor(state, "manager") };
}

function Harness() {
  const [initial] = useState(draft);
  const source = useRef(initial);
  const [invoice, setInvoice] = useState(initial.state.invoice);
  const update: ReviewUpdate = async (change) => {
    const next = cloneWithAuthority(source.current.state);
    const value = change(next, source.current.actor);
    // Receiving's parent normalizes each successful mutation before projecting
    // the next invoice. Keep that real provenance path in this rendered proof.
    normalizeInvoiceReceivingReview(next.invoice);
    source.current = { ...source.current, state: next };
    setInvoice(next.invoice);
    return value;
  };
  const projected = invoice as unknown as InvoicePurchaseReadDTO;
  return (
    <>
      <button
        onClick={() =>
          update((state, actor) => addInvoiceOtherCharge(state, actor))
        }
      >
        Add fictional charge
      </button>
      <OtherChargesEditor
        invoice={projected}
        onEdit={(index, field, value) =>
          void update((state, actor) =>
            editInvoiceOtherCharge(state, actor, index, field, value),
          )
        }
        onRemove={(index) =>
          void update((state, actor) =>
            removeInvoiceOtherCharge(state, actor, index),
          )
        }
      />
      <TotalsCard invoice={projected} update={update} attemptedPost={false} />
      <output data-testid="canonical-invoice">{JSON.stringify(invoice)}</output>
    </>
  );
}

const savedInvoice = () =>
  JSON.parse(
    screen.getByTestId("canonical-invoice").textContent!,
  ) as DemoInvoice;

it.each(["en", "fa"] as const)(
  "retains the focused auto-opened subtotal through every typed character and later charge edits in %s",
  async (language) => {
    locale.language = language;
    const user = userEvent.setup();
    render(<Harness />);
    const subtotalLabel = language === "en" ? "Subtotal" : "جمع پیش از مالیات";
    expect(screen.queryByRole("textbox", { name: subtotalLabel })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Add fictional charge" }),
    );
    const subtotal = screen.getByRole("textbox", { name: subtotalLabel });
    expect(subtotal).toHaveValue("");
    expect(savedInvoice().calculated_fields).toContain("subtotal");
    await user.type(subtotal, "8.88");
    expect(savedInvoice().subtotal).toBe("8.88");
    expect(screen.getByRole("textbox", { name: subtotalLabel })).toBe(subtotal);
    expect(subtotal).toHaveFocus();
    expect(subtotal).toHaveValue("8.88");
    expect(savedInvoice().calculated_fields).not.toContain("subtotal");

    await user.type(
      screen.getByLabelText(
        language === "en" ? "Charge 1 description" : "شرح هزینه 1",
      ),
      "Fictional freight",
    );
    await user.type(
      screen.getByLabelText(
        language === "en" ? "Charge 1 amount" : "مبلغ هزینه 1",
      ),
      "1.37",
    );
    expect(savedInvoice().subtotal).toBe("8.88");
    expect(savedInvoice().tax).toBe("0.00");
    expect(savedInvoice().final_total).toBe("2.20");
    expect(savedInvoice().calculated_from_lines).toBe(true);
    expect(savedInvoice().calculated_fields).not.toContain("subtotal");
    expect(screen.getByRole("textbox", { name: subtotalLabel })).toBe(subtotal);

    const edit = screen.getByRole("button", {
      name: language === "en" ? "Edit totals" : "ویرایش جمع‌ها",
    });
    await user.click(edit);
    expect(edit).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: subtotalLabel })).toBeNull();
    await user.click(
      screen.getByRole("button", {
        name: language === "en" ? "Looks right: Totals" : "درست است: جمع‌ها",
      }),
    );
    expect(savedInvoice().subtotal).toBe("8.88");
    expect(edit).toHaveAttribute("aria-expanded", "false");
    await user.click(edit);
    expect(screen.getByRole("textbox", { name: subtotalLabel })).toHaveValue(
      "8.88",
    );
  },
);

it("still resolves and closes an automatically opened total when no person edits it", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole("button", { name: "Add fictional charge" }),
  );
  expect(screen.getByRole("textbox", { name: "Subtotal" })).toHaveValue("");
  await user.type(screen.getByLabelText("Charge 1 amount"), "1.37");
  expect(savedInvoice().subtotal).toBe("3.57");
  expect(savedInvoice().calculated_fields).toContain("subtotal");
  expect(screen.queryByRole("textbox", { name: "Subtotal" })).toBeNull();
  expect(screen.getByRole("button", { name: "Edit totals" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
