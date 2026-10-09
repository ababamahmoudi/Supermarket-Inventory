import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import fixture from "./fixtures/a2-demo-data.json";
import { AUTH_STORAGE_KEY, SESSION_KEY } from "./auth";
import {
  C4_BACKUP_KEY,
  hydrateC4State,
  restoreC4Backup,
  restoreC4State,
} from "./c4-state";
import {
  demoOriginalSvg,
  isGeneratedDemoTextOriginal,
  retainDemoOriginal,
} from "./demo-originals";
import { configSeed, demoSeed } from "./config";
import { branchLabel } from "./settings";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";
import type { DemoInvoice, DemoState } from "./types";

function savedC3State(): DemoState {
  const state = initialState();
  delete state.prototype_c4_schema;
  delete state.config.weighed_items;
  delete state.config.returns;
  state.products = state.products.filter((product) => product.code !== "0016");
  for (const invoice of [...state.invoices!, state.invoice]) {
    if (invoice.legacy_demo_original)
      Object.assign(invoice, invoice.legacy_demo_original);
    else {
      delete invoice.file_name;
      delete invoice.file_type;
      delete invoice.file_data;
    }
    delete invoice.demo_original_snapshot;
    delete invoice.legacy_demo_original;
    for (const line of invoice.lines) {
      delete line.units_per_case;
      delete line.quantity_unit;
      delete line.quantity_entered;
      delete line.case_cost_before_tax;
    }
  }
  return state;
}

const businessDocument = (invoice: DemoInvoice) => {
  const copy = structuredClone(invoice);
  delete copy.file_name;
  delete copy.file_type;
  delete copy.file_data;
  delete copy.demo_original_snapshot;
  delete copy.legacy_demo_original;
  return copy;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T16:00:00.000Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("C4 verified backup and additive migration", () => {
  it("keeps the exact raw bytes and restores them, including whitespace and edited names", () => {
    const state = savedC3State();
    state.products[0].name_en = "My retained product";
    state.config.company.name_en = "My retained supermarket";
    const raw = `\n${JSON.stringify(state, null, 3)}\n`;
    localStorage.setItem(STORAGE_KEY, raw);
    const original = structuredClone(state);
    const migrated = restoreC4State(state, localStorage, raw);
    expect(migrated).not.toBe(state);
    expect(state).toEqual(original);
    expect(localStorage.getItem(C4_BACKUP_KEY)).toBe(raw);
    expect(migrated.prototype_c4_schema).toBe(1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    expect(restoreC4Backup(localStorage, STORAGE_KEY)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(original);
  });

  it("preserves prices, custom packs, documents, financial allocations, operational evidence and authentication", () => {
    const state = savedC3State();
    state.config.weighed_items = {
      conversion_factor: "2.20462",
      main_display_unit: "kg",
      show_second_unit: false,
      use_rounding_bands: false,
    };
    state.config.returns = {
      deduct_expected_credit_at_pickup: false,
      waiting_credit_days: 21,
    };
    state.products[0].selling_price = "19.99";
    state.products[0].date_tracking = true;
    state.invoices![0].lines[0].units_per_case = 7;
    state.invoices![0].lines[0].quantity_unit = "units";
    state.invoices![0].lines[0].quantity_entered = "12";
    state.invoice.file_name = "my-original.pdf";
    state.invoice.file_type = "application/pdf";
    state.invoice.file_data = "data:application/pdf;base64,JVBERi0xLjQ=";
    localStorage.setItem(AUTH_STORAGE_KEY, "retained password data");
    sessionStorage.setItem(SESSION_KEY, "retained session data");
    const before = structuredClone(state);
    const migrated = restoreC4State(state, localStorage);
    expect(migrated.config).toEqual(before.config);
    for (const key of [
      "products",
      "invoice",
      "ledger",
      "supplier_items",
      "orders",
      "branch_requests",
      "request_transfer_events",
      "returns",
      "expiry",
      "stock",
      "stock_movements",
      "notes",
      "notebooks",
      "templates",
      "activity",
    ] as const)
      expect(migrated[key], key).toEqual(before[key]);
    expect(migrated.invoices!.map(businessDocument)).toEqual(
      before.invoices!.map(businessDocument),
    );
    expect(migrated.invoices![0].lines[0].units_per_case).toBe(7);
    expect(migrated.products.some((product) => product.code === "0016")).toBe(
      false,
    );
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(
      "retained password data",
    );
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("retained session data");
  });

  it("is idempotent and retains the first verified backup after later edits", () => {
    const state = savedC3State();
    const first = restoreC4State(state, localStorage);
    const backup = localStorage.getItem(C4_BACKUP_KEY);
    first.products[0].name_en = "Edited after C4";
    first.config.returns!.waiting_credit_days = 30;
    const before = structuredClone(first);
    expect(hydrateC4State(first)).toBe(first);
    expect(restoreC4State(first, localStorage)).toBe(first);
    expect(first).toEqual(before);
    expect(localStorage.getItem(C4_BACKUP_KEY)).toBe(backup);
  });

  it("publishes no migration when writes, read-back verification or a prior incompatible backup fail", () => {
    for (const storage of [
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      { getItem: () => "unverified bytes", setItem: () => undefined },
      {
        getItem: () => {
          throw new Error("unavailable");
        },
        setItem: () => undefined,
      },
      { getItem: () => null, setItem: () => undefined },
    ]) {
      const state = savedC3State();
      const before = structuredClone(state);
      expect(restoreC4State(state, storage)).toBe(state);
      expect(state).toEqual(before);
      expect(state.prototype_c4_schema).toBeUndefined();
    }
    localStorage.setItem(C4_BACKUP_KEY, "bad backup");
    localStorage.setItem(STORAGE_KEY, "unchanged business data");
    expect(restoreC4Backup(localStorage, STORAGE_KEY)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("unchanged business data");
    localStorage.setItem(
      C4_BACKUP_KEY,
      JSON.stringify({ version: 1, config: true, products: [] }),
    );
    expect(restoreC4Backup(localStorage, STORAGE_KEY)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("unchanged business data");
  });

  it("does not import this customer's fictional originals or products into another company", () => {
    const state = savedC3State();
    state.config.company.seed_key = "independent-market";
    const before = structuredClone(state);
    const migrated = restoreC4State(state, localStorage);
    expect(migrated.products).toEqual(before.products);
    expect(migrated.invoices).toEqual(before.invoices);
    expect(migrated.invoice).toEqual(before.invoice);
    expect(migrated.ledger).toEqual(before.ledger);
    expect(migrated.config.company).toEqual(before.config.company);
  });

  it("provider startup passes the raw persisted document to backup before publishing migrated state", () => {
    const old = savedC3State();
    const raw = ` ${JSON.stringify(old, null, 2)}\n`;
    localStorage.setItem(STORAGE_KEY, raw);
    function Probe() {
      const { state } = useDemo();
      return createElement(
        "output",
        { "data-testid": "migration-version" },
        state.prototype_c4_schema,
      );
    }
    render(createElement(DemoProvider, null, createElement(Probe)));
    expect(screen.getByTestId("migration-version")).toHaveTextContent("1");
    expect(localStorage.getItem(C4_BACKUP_KEY)).toBe(raw);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).prototype_c4_schema,
    ).toBe(1);
  });
});

describe("fresh fictional packs and immutable originals", () => {
  it("uses configured realistic packs while retaining every historical unit quantity, unit cost and invoice/ledger total", () => {
    const state = initialState();
    for (const source of fixture.invoices) {
      const invoice = state.invoices!.find(
        (entry) => entry.supplier_invoice_number === source.number,
      )!;
      let subtotal = new Decimal(0);
      let tax = new Decimal(0);
      for (const [index, sourceLine] of source.lines.entries()) {
        const line = invoice.lines[index];
        expect(line.qty_invoiced).toBe(sourceLine.qty);
        expect(line.qty_received_at_posting).toBe(sourceLine.qty);
        expect(line.unit_cost_before_tax).toBe(
          new Decimal(sourceLine.unit_cost).toFixed(4),
        );
        expect(line.units_per_case).toBe(
          (demoSeed.demo_case_packs as Record<string, number>)[
            line.product_code
          ],
        );
        const represented = new Decimal(line.quantity_entered!).times(
          line.quantity_unit === "cases" ? line.units_per_case! : 1,
        );
        expect(represented.toFixed()).toBe(String(sourceLine.qty));
        expect(line.line_total).toBe(
          new Decimal(sourceLine.unit_cost).times(sourceLine.qty).toFixed(2),
        );
        subtotal = subtotal.plus(line.line_total);
        tax = tax.plus(line.line_tax ?? "0");
      }
      expect(invoice.subtotal).toBe(subtotal.toFixed(2));
      expect(invoice.tax).toBe(tax.toFixed(2));
      expect(invoice.final_total).toBe(subtotal.plus(tax).toFixed(2));
      expect(
        state.ledger.find(
          (entry) =>
            entry.invoice_id === invoice.id && entry.type === "invoice",
        )?.amount,
      ).toBe(invoice.final_total);
    }
    const invoice = state.invoice;
    expect(invoice.lines[0]).toMatchObject({
      units_per_case: 12,
      quantity_unit: "cases",
      quantity_entered: "2",
      qty_invoiced: 24,
      line_total: "23.52",
    });
    expect(
      invoice.lines.find((line) => line.product_code === "0006"),
    ).toMatchObject({
      units_per_case: 10,
      quantity_entered: "2",
      qty_invoiced: 20,
    });
    expect(invoice.final_total).toBe("177.02");
    expect(invoice.payable_after_open_shorts).toBe("169.79");
    expect(
      state.products.find((product) => product.code === "0016"),
    ).toMatchObject({
      sold_by: "weight",
      last_cost_before_tax: "4.9895",
      selling_price: "7.49",
    });
  });

  it("retains an honest SVG original for every demo invoice with its actual supplier/location/date/lines/totals", () => {
    const state = initialState();
    for (const invoice of [...state.invoices!, state.invoice]) {
      expect(invoice.file_name).toMatch(/^fictional-.+\.svg$/);
      expect(invoice.file_type).toBe("image/svg+xml");
      expect(invoice.demo_original_snapshot).toBe(true);
      const svg = decodeURIComponent(
        invoice.file_data!.split(",").slice(1).join(","),
      );
      const document = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(document.querySelector("parsererror")).toBeNull();
      const content = document.documentElement.textContent!;
      for (const value of [
        invoice.supplier,
        invoice.supplier_invoice_number,
        branchLabel(state.config, invoice.branch, "en"),
        invoice.invoice_date!,
        invoice.subtotal,
        invoice.tax,
        invoice.final_total,
      ])
        expect(content).toContain(value);
      for (const line of invoice.lines) {
        expect(content).toContain(line.product_code);
        expect(content).toContain(line.line_total);
      }
    }
    const invoice = state.invoices![0];
    const retained = invoice.file_data;
    invoice.lines[0].unit_cost_before_tax = "999.0000";
    state.products[0].name_en = "Later catalog edit";
    retainDemoOriginal(invoice, state.config);
    expect(invoice.file_data).toBe(retained);
  });

  it("escapes all document text and does not mistake user/custom originals for generated text", () => {
    const state = savedC3State();
    const invoice = state.invoices![0];
    expect(isGeneratedDemoTextOriginal(invoice)).toBe(true);
    invoice.file_data =
      "data:text/plain;charset=utf-8,Uploaded%20by%20a%20user";
    expect(isGeneratedDemoTextOriginal(invoice)).toBe(false);
    const custom = structuredClone(invoice);
    retainDemoOriginal(invoice, state.config);
    expect(invoice).toEqual(custom);
    const migrated = restoreC4State(state, localStorage);
    expect(migrated.invoices![0]).toEqual(custom);
    invoice.supplier = '<script>alert("supplier")</script> & Sons';
    invoice.lines[0].description = '<image onerror="fail"/> & beans';
    const svg = demoOriginalSvg(invoice, configSeed);
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(document.querySelector("script, image, parsererror")).toBeNull();
    expect(document.documentElement.textContent).toContain(invoice.supplier);
    expect(document.documentElement.textContent).toContain(
      invoice.lines[0].description,
    );
  });
});
