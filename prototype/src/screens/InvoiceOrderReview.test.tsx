import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { DemoProvider, initialState, STORAGE_KEY } from "../store";
import { SESSION_KEY } from "../auth";
import i18n from "../i18n";
import {
  addManualLine,
  createInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "../invoice";
import { createOrder, placeOrder } from "../orders";
import { supplierItemFacts } from "../supplier-items";
import { setInvoiceOrder } from "../invoice-orders";
import Invoices from "./Invoices";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  void i18n.changeLanguage("en");
});

it("never includes a different location's current draft in a worker's saved-draft list", () => {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 2", true);
  state.invoice.supplier_invoice_number = "PRIVATE-BRANCH-2";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "floorworker",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
  window.location.hash = "#invoices";
  render(
    <DemoProvider>
      <Invoices />
    </DemoProvider>,
  );
  expect(screen.queryByText("PRIVATE-BRANCH-2")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New invoice" })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).invoice.id).toBe(
    state.invoice.id,
  );
});

it("keeps linked invoice review rendered during blank cost and pack edits, preserving Units until corrected", () => {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1", true);
  state.invoice.supplier = "Fresh Valley Foods";
  state.invoice.supplier_confirmed = true;
  state.invoice.file_name = "fictional-original.png";
  state.invoice.file_data = "data:image/png;base64,ZGVtbw==";
  addManualLine(state, "0002");
  setInvoiceLineQuantity(state.invoice.lines[0], "12", "units", 12);
  recalculateInvoice(state.invoice, state.config);
  const item = supplierItemFacts(
    state,
    state.invoice.company_id,
    state.invoice.supplier,
    "all",
  ).find((record) => record.product_code === "0002")!;
  const context = {
    company_id: state.invoice.company_id,
    role: "supervisor" as const,
    branch: "Branch 1",
    actor: "Ali",
  };
  const order = createOrder(state, context, {
    branch: "Branch 1",
    supplier: state.invoice.supplier,
    lines: [
      {
        supplier_item_id: item.id,
        cases: String(12 / item.units_per_case),
        expected_unit_cost: "0.9800",
      },
    ],
  });
  placeOrder(state, context, order.id);
  setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
  window.location.hash = `#invoices?id=${encodeURIComponent(state.invoice.id)}`;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
  render(
    <DemoProvider>
      <Invoices />
    </DemoProvider>,
  );
  const cost = screen.getByLabelText("Unit cost before tax");
  fireEvent.change(cost, { target: { value: "" } });
  expect(
    screen.getByRole("heading", { name: "Compare with order" }),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Enter a nonnegative unit cost with no more than four decimal places.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Post invoice" })).toBeDisabled();
  fireEvent.change(cost, { target: { value: "0.9800" } });
  const pack = screen.getByLabelText("Units per case");
  fireEvent.change(pack, { target: { value: "" } });
  expect(
    screen.getByRole("heading", { name: "Compare with order" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Invoiced quantity")).toHaveValue("12");
  expect(screen.getByRole("button", { name: "Post invoice" })).toBeDisabled();
  fireEvent.change(pack, { target: { value: "12" } });
  expect(screen.getByLabelText("Invoiced quantity")).toHaveValue("12");
  expect(
    screen.getByRole("columnheader", { name: "Ordered units remaining" }),
  ).toBeVisible();
});
