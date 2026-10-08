import Decimal from "decimal.js";
import fixture from "./fixtures/a2-demo-data.json";
import { configSeed, demoSeed } from "./config";
import { companyDate, dateAfter } from "./invoice";
import { calculatePrice } from "./pricing";
import type { OperationalLedger } from "./operations";
import type { Branch, DemoInvoice, DemoState, InvoiceLine } from "./types";

export const DEMO_FIXTURE_BACKUP_KEY =
  "supermarket-prototype-before-a2-fixtures";
const cents = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const atDate = (date: string) => `${date}T16:00:00.000Z`;
const fixtureId = (number: string) => `a2-fixture:${number}`;

/** Explicit fictional documents support every demo balance and stock estimate. */
export function hydrateDemoFixture(input: DemoState): DemoState {
  if (
    input.demo_fixture_schema === 2 ||
    input.config.company.seed_key !== configSeed.company.seed_key
  )
    return input;
  const state = structuredClone(input);
  const anchor =
    state.demo_fixture_anchor_date ??
    state.supplier_balance_snapshot_date ??
    companyDate(state.config);
  const company_id = state.config.company.seed_key;
  const actor = demoSeed.demo_users.find(
    (user) => user.role === "floor_worker",
  )!.name;
  const supervisor = demoSeed.demo_users.find(
    (user) => user.role === "supervisor",
  )!.name;
  const movements: NonNullable<DemoState["stock_movements"]> = [];
  const stock = (
    branch: Branch,
    code: string,
    qty: number,
    type: string,
    reference: string,
    date: string,
  ) => {
    if (!qty) return;
    movements.push({
      id: `a2-fixture:stock:${movements.length}`,
      company_id,
      branch,
      product_code: code,
      qty,
      type,
      reference,
      by: actor,
      at: atDate(date),
    });
  };
  for (const [branch, counts] of Object.entries(fixture.opening_stock)) {
    for (const [code, qty] of Object.entries(counts)) {
      if (
        state.products.some(
          (product) =>
            product.company_id === company_id && product.code === code,
        )
      )
        stock(
          branch as Branch,
          code,
          qty,
          "count",
          "A2 fictional opening count",
          dateAfter(anchor, -56),
        );
    }
  }
  state.invoices ??= [];
  for (const document of fixture.invoices) {
    const invoiceId = fixtureId(document.number);
    const branch = document.branch as Branch;
    const invoiceDate = dateAfter(anchor, document.relative_days);
    const lines: InvoiceLine[] = document.lines.map((item) => {
      const product = state.products.find(
        (value) =>
          value.company_id === company_id && value.code === item.product_code,
      );
      if (!product)
        throw new Error(
          `Fictional receipt product ${item.product_code} is missing.`,
        );
      const lineTotal = cents(new Decimal(item.unit_cost).times(item.qty));
      const lineTax = product.taxable
        ? cents(new Decimal(lineTotal).times(state.config.tax.rate))
        : "0.00";
      const calculation = calculatePrice(
        item.unit_cost,
        product.pricing_category,
        state.config,
      );
      stock(
        branch,
        product.code,
        item.qty,
        "received",
        document.number,
        invoiceDate,
      );
      return {
        company_id,
        product_code: product.code,
        description: product.name_en,
        qty_invoiced: item.qty,
        qty_received_at_posting: item.qty,
        unit_cost_before_tax: new Decimal(item.unit_cost).toFixed(4),
        line_total: lineTotal,
        taxable: product.taxable,
        tax_profile: product.tax_profile,
        calculated_selling_price: calculation.selling_price,
        current_selling_price: product.selling_price || null,
        pricing_category: product.pricing_category,
        date_tracking: product.date_tracking,
        date_confirmed: true,
        review_confirmed: true,
        line_tax: lineTax,
        demo_note: "",
      };
    });
    const subtotal = cents(
      Decimal.sum(...lines.map((line) => line.line_total)),
    );
    const tax = cents(
      Decimal.sum(...lines.map((line) => line.line_tax ?? "0")),
    );
    const total = cents(new Decimal(subtotal).plus(tax));
    const invoice: DemoInvoice = {
      ...structuredClone(demoSeed.demo_invoice),
      company_id,
      branch,
      id: invoiceId,
      supplier: document.supplier,
      supplier_invoice_number: document.number,
      status: "posted",
      lines,
      subtotal,
      tax,
      final_total: total,
      short_lines: [],
      payable_after_open_shorts: total,
      invoice_date: invoiceDate,
      received_at: atDate(invoiceDate),
      posted_at: atDate(invoiceDate),
      receiving_employee: document.posted_by,
      payment_terms: document.payment_terms,
      due_date: dateAfter(anchor, document.due_relative_days),
      supplier_confirmed: true,
      file_name: `${document.number}-fictional-demo.txt`,
      file_type: "text/plain",
      file_data: `data:text/plain;charset=utf-8,${encodeURIComponent(`Fictional prototype invoice ${document.number}\n${document.supplier}\n${invoiceDate}\n${lines.map((line) => `${line.description}: ${line.qty_invoiced} × ${line.unit_cost_before_tax}`).join("\n")}\nTotal ${total}`)}`,
    };
    if (!state.invoices.some((item) => item.id === invoiceId))
      state.invoices.push(invoice);
    for (const line of lines) {
      const product = state.products.find(
        (item) =>
          item.company_id === company_id && item.code === line.product_code,
      )!;
      if (product.selling_price !== line.calculated_selling_price) continue;
      const previous = product.price_provenance?.[branch];
      if (
        !previous ||
        (previous.invoice_date &&
          previous.invoice_date < invoiceDate &&
          !previous.changed_at)
      )
        product.price_provenance = {
          ...product.price_provenance,
          [branch]: {
            invoice_number: document.number,
            calculated_price: line.calculated_selling_price,
            invoice_date: invoiceDate,
          },
        };
    }
    const ledgerInvoiceId = `${invoiceId}:invoice`;
    if (!state.ledger.some((row) => row.id === ledgerInvoiceId)) {
      state.ledger.push({
        id: ledgerInvoiceId,
        company_id,
        branch,
        supplier: document.supplier,
        type: "invoice",
        amount: total,
        date: invoiceDate,
        reference: document.number,
        invoice_id: invoiceId,
        currency: state.config.company.currency,
      });
      const payment = new Decimal(total).minus(document.outstanding);
      if (payment.lt(0))
        throw new Error(
          `Fictional invoice ${document.number} cannot have a balance above its total.`,
        );
      if (payment.gt(0)) {
        const row: OperationalLedger = {
          id: `${invoiceId}:payment`,
          company_id,
          branch,
          supplier: document.supplier,
          type: "payment",
          amount: payment.negated().toFixed(2),
          date: invoiceDate,
          reference: `${document.number}-PAYMENT`,
          cheque_number: `${document.number}-DEMO`,
          invoice_id: invoiceId,
          currency: state.config.company.currency,
          posted_by: supervisor,
          allocations: [{ invoice_id: invoiceId, amount: payment.toFixed(2) }],
        };
        state.ledger.push(row);
      }
    }
  }
  for (const seed of fixture.returns) {
    const record = state.returns.find(
      (item) => item.id === seed.id && item.company_id === company_id,
    );
    if (!record) continue;
    record.created_at ??= atDate(dateAfter(anchor, seed.created_relative_days));
    record.created_by ??= seed.created_by;
    record.linked_invoice ??= fixtureId(seed.invoice_number);
    // Only the baseline event is added; saved pickup/resolution edits are kept.
    const original = demoSeed.open_returns.find(
      (item) => item.supplier === record.supplier,
    );
    for (const line of original?.lines ?? [])
      stock(
        record.branch,
        line.product_code,
        -line.qty,
        "return",
        record.id,
        dateAfter(anchor, seed.created_relative_days),
      );
    if (original?.replacement_received)
      stock(
        record.branch,
        original.replacement_received.product_code,
        original.replacement_received.qty,
        "replacement",
        record.id,
        dateAfter(anchor, seed.created_relative_days + 1),
      );
  }
  const storeUse = state.notes.find(
    (note) => note.id === "demo-note-2" && note.company_id === company_id,
  );
  if (storeUse) {
    storeUse.product_code ??= "0006";
    storeUse.qty ??= 2;
    stock("Branch 1", "0006", 2 * -1, "store_use", storeUse.id, anchor);
  }
  const toOrder = state.notes.find(
    (note) => note.id === "demo-note-1" && note.company_id === company_id,
  );
  if (toOrder) toOrder.product_code ??= "0008";
  for (const seed of fixture.expiry) {
    const record = state.expiry.find(
      (item) => item.id === seed.id && item.company_id === company_id,
    );
    const invoice = state.invoices.find(
      (item) => item.id === fixtureId(seed.invoice_number),
    );
    if (record && invoice) {
      record.invoice_id ??= invoice.id;
      record.invoice_number ??= invoice.supplier_invoice_number;
      record.received_date ??= invoice.invoice_date;
    }
  }
  for (const approval of state.approvals) {
    if (
      !["demo-lavash-price", "demo-barberries-product"].includes(approval.id) ||
      approval.company_id !== company_id
    )
      continue;
    const invoice = state.invoices.find(
      (item) => item.id === fixtureId("FV-20390"),
    )!;
    const line = invoice.lines.find(
      (item) => item.product_code === approval.product_code,
    )!;
    approval.invoice_ids ??= [invoice.id];
    approval.invoice_number ??= invoice.supplier_invoice_number;
    approval.triggered_by ??= invoice.receiving_employee;
    approval.posted_at ??= invoice.posted_at;
    approval.created_at ??= invoice.posted_at;
    approval.unit_cost ??= line.unit_cost_before_tax;
    approval.margin ??= new Decimal(approval.proposed_price)
      .minus(approval.unit_cost)
      .div(approval.proposed_price)
      .toString();
  }
  for (const item of fixture.price_changes) {
    const id = `a2-fixture:price:${item.product_code}`;
    if (!state.activity.some((entry) => entry.id === id))
      state.activity.push({
        id,
        company_id,
        branch: item.branch as Branch,
        product_code: item.product_code,
        action: "Approve price",
        by: item.by,
        at: atDate(dateAfter(anchor, item.relative_days)),
      });
  }
  const baseline: Record<string, number> = {};
  for (const movement of movements) {
    const key = `${movement.branch}:${movement.product_code}`;
    baseline[key] = (baseline[key] ?? 0) + movement.qty;
  }
  for (const [key, qty] of Object.entries(baseline)) {
    const [branch, code] = key.split(":");
    const oldReplacement = demoSeed.open_returns.reduce(
      (sum, record) =>
        sum +
        (record.branch === branch &&
        record.replacement_received?.product_code === code
          ? record.replacement_received.qty
          : 0),
      0,
    );
    state.stock[key] = (state.stock[key] ?? 0) + qty - oldReplacement;
  }
  state.stock_movements = [...movements, ...(state.stock_movements ?? [])];
  state.demo_fixture_schema = 2;
  state.demo_fixture_anchor_date = anchor;
  return state;
}

/** A verified, restorable copy precedes any upgrade of an older browser demo. */
export function restoreDemoFixture(
  state: DemoState,
  storage: Pick<Storage, "setItem" | "getItem">,
): DemoState {
  if (
    state.demo_fixture_schema === 2 ||
    state.config.company.seed_key !== configSeed.company.seed_key
  )
    return state;
  const backup = JSON.stringify(state);
  try {
    storage.setItem(DEMO_FIXTURE_BACKUP_KEY, backup);
    if (storage.getItem(DEMO_FIXTURE_BACKUP_KEY) !== backup) return state;
  } catch {
    // If the backup cannot be verified, keep the previous saved demo intact.
    return state;
  }
  return hydrateDemoFixture(state);
}
