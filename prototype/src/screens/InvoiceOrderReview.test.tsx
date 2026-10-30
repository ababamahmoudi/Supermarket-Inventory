import {
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState } from "../store";
import { authenticatedTestActor } from "../authority-test-fixture";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";
import { installMissingInvoiceImageDecoder } from "../invoice-ui-image-test-platform";
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

const providers: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] =
  [];
beforeEach(async () => {
  installMissingInvoiceImageDecoder();
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of providers.splice(0)) fixture.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function provider(
  state: ReturnType<typeof initialState>,
  role: "manager" | "floor_worker",
) {
  const fixture = await authenticatedProviderFixture({
    state,
    role,
    actorOptions: { locations: ["Branch 1"] },
  });
  providers.push(fixture);
  return fixture;
}
it("never includes a different location's current draft in a worker's saved-draft list", async () => {
  const state = initialState(),
    manager = authenticatedTestActor(state, "manager", {
      locations: ["Branch 2"],
    });
  state.invoice = createInvoice(state, manager, "Branch 2", true);
  state.invoice.supplier_invoice_number = "PRIVATE-BRANCH-2";
  const fixture = await provider(state, "floor_worker");
  window.location.hash = "#invoices";
  render(
    <DemoProvider options={fixture.options}>
      <Invoices />
    </DemoProvider>,
  );
  expect(
    await screen.findByRole("button", { name: "New invoice" }),
  ).toBeVisible();
  expect(screen.queryByText("PRIVATE-BRANCH-2")).not.toBeInTheDocument();
  expect((await fixture.readCanonical()).invoice.id).toBe(state.invoice.id);
});
it("keeps linked invoice review rendered during blank cost and pack edits, preserving Units until corrected", async () => {
  const state = initialState(),
    context = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
      name_en: "Ali",
    });
  state.invoice = createInvoice(state, context, "Branch 1", true);
  state.invoice.supplier = "Fresh Valley Foods";
  state.invoice.supplier_confirmed = true;
  state.invoice.file_name = "fictional-original.png";
  state.invoice.file_data = "data:image/png;base64,ZGVtbw==";
  addManualLine(state, context, "0002");
  setInvoiceLineQuantity(state.invoice.lines[0], "12", "units", 12);
  recalculateInvoice(state.invoice, state.config);
  const item = supplierItemFacts(
    state,
    context,
    state.invoice.supplier,
    "all",
  ).find((record) => record.product_code === "0002")!;
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
  setInvoiceOrder(state, context, order.id);
  window.location.hash = `#invoices?id=${encodeURIComponent(state.invoice.id)}`;
  const fixture = await provider(state, "manager");
  render(
    <DemoProvider options={fixture.options}>
      <Invoices />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByTestId("invoice-line-row-0")),
  );
  fireEvent.click(screen.getByTestId("invoice-line-row-0"));
  await renderedUiReady(() =>
    Boolean(screen.queryByLabelText("Unit cost before tax")),
  );
  const cost = await screen.findByLabelText("Unit cost before tax");
  cost.focus();
  fireEvent.change(cost, { target: { value: "" } });
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("heading", { name: "Compare with order" })),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Compare with order" }),
    ).toBeVisible(),
  );
  expect(cost).toHaveFocus();
  await renderedUiReady(
    () =>
      (
        screen.queryByLabelText(
          "Unit cost before tax",
        ) as HTMLInputElement | null
      )?.value === "",
  );
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).invoice.lines[0].unit_cost_before_tax,
    ).toBe(""),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Unit cost before tax")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(
    screen.getByText(
      "Enter a cost of zero or more with up to four decimal places.",
    ),
  ).toBeVisible();
  expect(
    within(document.querySelector(".receiving-header")!).getByRole("button", {
      name: "Post invoice",
    }),
  ).toBeEnabled();
  fireEvent.click(
    within(document.querySelector(".receiving-header")!).getByRole("button", {
      name: "Post invoice",
    }),
  );
  expect(
    screen.getByRole("alert", { name: "What's missing" }),
  ).toHaveTextContent("unit cost is empty or invalid");
  expect(
    screen.queryByRole("dialog", { name: "Post invoice" }),
  ).not.toBeInTheDocument();
  fireEvent.change(cost, { target: { value: "0.9800" } });
  await renderedUiReady(
    () =>
      (
        screen.queryByLabelText(
          "Unit cost before tax",
        ) as HTMLInputElement | null
      )?.value === "0.9800",
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Unit cost before tax")).toHaveValue("0.9800"),
  );
  // The box shows the typed cost at once; the save itself can take over a
  // second on a busy test machine, so give the saved value time to arrive.
  await waitFor(
    async () =>
      expect(
        (await fixture.readCanonical()).invoice.lines[0].unit_cost_before_tax,
      ).toBe("0.9800"),
    { timeout: 5000 },
  );
  expect(screen.queryByLabelText("Units per case")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Invoiced units")).toHaveValue("12");
  expect((await fixture.readCanonical()).invoice.lines[0]).toMatchObject({
    quantity_unit: "units",
    qty_invoiced: 12,
  });
  const exactLineAmount = (await fixture.readCanonical()).invoice.lines[0]
    .line_total;
  fireEvent.click(screen.getByRole("combobox", { name: "Unit" }));
  fireEvent.click(await screen.findByRole("option", { name: "Cases" }));
  await waitFor(async () =>
    expect((await fixture.readCanonical()).invoice.lines[0].quantity_unit).toBe(
      "cases",
    ),
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByLabelText("Units per case")),
  );
  const pack = screen.getByLabelText("Units per case");
  fireEvent.change(pack, { target: { value: "" } });
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("heading", { name: "Compare with order" })),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Compare with order" }),
    ).toBeVisible(),
  );
  await renderedUiReady(
    () =>
      screen.queryByLabelText<HTMLInputElement>("Units per case")?.value ===
      "0",
  );
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).invoice.lines[0].units_per_case,
    ).toBe(0),
  );
  expect(screen.getByLabelText("Cases invoiced")).toHaveValue("1");
  expect(
    within(document.querySelector(".receiving-header")!).getByRole("button", {
      name: "Post invoice",
    }),
  ).toBeEnabled();
  fireEvent.click(
    within(document.querySelector(".receiving-header")!).getByRole("button", {
      name: "Post invoice",
    }),
  );
  expect(
    screen.getByRole("alert", { name: "What's missing" }),
  ).toHaveTextContent("units per case is invalid");
  expect(
    screen.queryByRole("dialog", { name: "Post invoice" }),
  ).not.toBeInTheDocument();
  fireEvent.change(pack, { target: { value: "12" } });
  await renderedUiReady(
    () =>
      (screen.queryByLabelText("Units per case") as HTMLInputElement | null)
        ?.value === "12",
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Units per case")).toHaveValue("12"),
  );
  expect(screen.getByLabelText("Cases invoiced")).toHaveValue("1");
  await waitFor(async () =>
    expect((await fixture.readCanonical()).invoice.lines[0].qty_invoiced).toBe(
      12,
    ),
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Unit" }));
  fireEvent.click(await screen.findByRole("option", { name: "Units" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Invoiced units")).toHaveValue("12"),
  );
  expect(screen.queryByLabelText("Units per case")).not.toBeInTheDocument();
  await waitFor(async () =>
    expect((await fixture.readCanonical()).invoice.lines[0]).toMatchObject({
      quantity_unit: "units",
      qty_invoiced: 12,
      unit_cost_before_tax: "0.9800",
      line_total: exactLineAmount,
    }),
  );
  await renderedUiReady(() =>
    Boolean(
      screen.queryByRole("columnheader", { name: "Ordered units remaining" }),
    ),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("columnheader", { name: "Ordered units remaining" }),
    ).toBeVisible(),
  );
});
it("groups every invalid total and shows local errors without crashing while fields are cleared", async () => {
  const state = initialState(),
    actor = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
    });
  state.invoice = createInvoice(state, actor, "Branch 1", true);
  window.location.hash = `#invoices?id=${encodeURIComponent(state.invoice.id)}`;
  const fixture = await provider(state, "manager");
  render(
    <DemoProvider options={fixture.options}>
      <Invoices />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("button", { name: "Edit totals" })),
  );
  if (!screen.queryByLabelText("Subtotal"))
    fireEvent.click(screen.getByRole("button", { name: "Edit totals" }));
  await renderedUiReady(() => Boolean(screen.queryByLabelText("Subtotal")));
  const subtotal = await screen.findByLabelText("Subtotal");
  // With valid total and tax R2 calculates a cleared subtotal. Make the tax
  // invalid first so these remain three actual questions rather than a
  // calculable missing amount.
  fireEvent.change(screen.getByLabelText("Tax"), { target: { value: "bad" } });
  await waitFor(async () =>
    expect((await fixture.readCanonical()).invoice.tax).toBe("bad"),
  );
  fireEvent.change(subtotal, { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Invoice total"), {
    target: { value: "" },
  });
  await renderedUiReady(
    () =>
      (screen.queryByLabelText("Subtotal") as HTMLInputElement | null)
        ?.value === "" &&
      (screen.queryByLabelText("Tax") as HTMLInputElement | null)?.value ===
        "bad" &&
      (screen.queryByLabelText("Invoice total") as HTMLInputElement | null)
        ?.value === "",
  );
  await waitFor(() => {
    expect(screen.getByLabelText("Subtotal")).toHaveValue("");
    expect(screen.getByLabelText("Tax")).toHaveValue("bad");
    expect(screen.getByLabelText("Invoice total")).toHaveValue("");
  });
  await waitFor(async () =>
    expect((await fixture.readCanonical()).invoice).toMatchObject({
      subtotal: "",
      tax: "bad",
      final_total: "",
    }),
  );
  fireEvent.click(
    within(document.querySelector(".receiving-header")!).getByRole("button", {
      name: "Post invoice",
    }),
  );
  expect(
    await screen.findByRole("heading", { name: "What's missing" }),
  ).toBeVisible();
  expect(
    screen.getAllByText(
      "Tax is invalid. Enter a nonnegative amount with up to two decimal places.",
    ).length,
  ).toBeGreaterThan(0);
  for (const label of ["Subtotal", "Tax", "Invoice total"]) {
    expect(screen.getByLabelText(label)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  }
  expect(
    within(document.querySelector(".receiving-header")!).getByRole("button", {
      name: "Post invoice",
    }),
  ).toBeEnabled();
});

it("retains only the expanded order row keys during a fresh protected read so a real Manager can accept the changed cost", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.classList.contains("ui-data-table") ? 460 : 0,
        height: 36,
      } as DOMRect;
    },
  );
  const state = initialState(),
    context = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
      name_en: "Ali",
    });
  state.invoice = createInvoice(state, context, "Branch 1", true);
  state.invoice.supplier = "Fresh Valley Foods";
  state.invoice.supplier_confirmed = true;
  addManualLine(state, context, "0002");
  setInvoiceLineQuantity(state.invoice.lines[0], "12", "units", 12);
  state.invoice.lines[0].unit_cost_before_tax = "0.9800";
  recalculateInvoice(state.invoice, state.config);
  const item = supplierItemFacts(
    state,
    context,
    state.invoice.supplier,
    "all",
  ).find((record) => record.product_code === "0002")!;
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
  setInvoiceOrder(state, context, order.id);
  window.location.hash = `#invoices?id=${encodeURIComponent(state.invoice.id)}`;
  const fixture = await provider(state, "manager");
  const view = render(
    <DemoProvider options={fixture.options}>
      <Invoices />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("heading", { name: "Compare with order" })),
  );
  expect(
    screen.getByRole("heading", { name: "Compare with order" }),
  ).toBeVisible();
  await renderedUiReady(() =>
    Boolean(screen.queryByTestId("invoice-line-row-0")),
  );
  fireEvent.click(screen.getByTestId("invoice-line-row-0"));
  const table = () =>
    view.container.querySelector<HTMLElement>(".invoice-order-table")!;
  fireEvent.click(
    within(table()).getByRole("button", { name: "Show details" }),
  );
  expect(
    within(table()).getByRole("button", { name: "Hide details" }),
  ).toHaveAttribute("aria-expanded", "true");
  fireEvent.change(screen.getByLabelText("Unit cost before tax"), {
    target: { value: "1.3000" },
  });
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).invoice.lines[0].unit_cost_before_tax,
    ).toBe("1.3000"),
  );
  await waitFor(() =>
    expect(
      within(table()).getByRole("button", { name: "Hide details" }),
    ).toHaveAttribute("aria-expanded", "true"),
  );
  await waitFor(() =>
    expect(
      within(table()).getByRole("button", { name: "Accept new cost" }),
    ).toBeVisible(),
  );
  fireEvent.click(
    within(table()).getByRole("button", { name: "Accept new cost" }),
  );
  await waitFor(async () => {
    const current = await fixture.readCanonical();
    expect(current.invoice.id).toBe(state.invoice.id);
    expect(current.invoice.order_id).toBe(order.id);
    expect(current.invoice.lines[0].order_price_decision).toBe("accept");
    expect(current.orders!.find((row) => row.id === order.id)?.lines).toEqual(
      order.lines,
    );
    expect(current.ledger).toEqual(state.ledger);
    expect(current.stock).toEqual(state.stock);
  });
  await waitFor(() =>
    expect(
      within(table()).getByRole("button", { name: "Hide details" }),
    ).toHaveAttribute("aria-expanded", "true"),
  );
});
