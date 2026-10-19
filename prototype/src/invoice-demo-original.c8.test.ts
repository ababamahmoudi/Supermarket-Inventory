import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectivePrice, regularPrice } from "./catalog";
import {
  INCLUDED_COST_INVOICE_SHA256,
  readStoredFile,
  storeUploadedFile,
  type FileBackupRecord,
  type FileRepository,
  type StoredFileRecord,
} from "./file-database";
import { demoSaleCostInvoice, invoiceBlockers, postInvoice } from "./invoice";
import { activeSaleAt, savePriceChange } from "./sales";
import { authenticatedTestActor } from "./authority-test-fixture";
import type { AuthenticatedActor } from "./authority-types";
import { initialState } from "./store";
import {
  confirmSupplier,
  hydrateSuppliers,
  supplierRecords,
} from "./supplier-editor";
import type { DemoState } from "./types";

const now = new Date("2026-10-12T16:00:00Z");
let manager: AuthenticatedActor;
function fixtureState() {
  const state = initialState();
  manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
    name_en: "Demo Manager",
    now,
  });
  return state;
}

class MemoryFiles implements FileRepository {
  files = new Map<string, StoredFileRecord>();
  backups = new Map<string, FileBackupRecord>();
  async getFile(reference: string) {
    return this.files.get(reference);
  }
  async putFile(record: StoredFileRecord) {
    this.files.set(record.reference, record);
  }
  async getBackup(reference: string) {
    return this.backups.get(reference);
  }
  async putBackup(record: FileBackupRecord) {
    this.backups.set(record.reference, record);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function readAndReviewOriginal(
  state: DemoState,
  receiver: AuthenticatedActor = manager,
) {
  const bytes = new Uint8Array(
    readFileSync("public/demo-originals/fictional-hw-5012.svg"),
  );
  const repository = new MemoryFiles();
  const stored = await storeUploadedFile(
    Object.assign(new Blob([bytes], { type: "image/svg+xml" }), {
      name: "fictional-hw-5012.svg",
    }),
    state.config.company.seed_key,
    { purpose: "invoice" },
    repository,
  );
  const retained = await readStoredFile(
    stored.reference,
    state.config.company.seed_key,
    repository,
  );
  expect(retained.sha256).toBe(INCLUDED_COST_INVOICE_SHA256);
  expect(new Uint8Array(await retained.source.arrayBuffer())).toEqual(bytes);
  // These are the actual upload attachment and explicit line-confirmation steps.
  // Supplier confirmation remains the builder's result, never a test override.
  state.invoice = demoSaleCostInvoice(state, receiver, "Branch 1");
  Object.assign(state.invoice, {
    file_data: stored.reference,
    file_name: stored.name,
    file_type: stored.type,
    file_size: stored.size,
    receiving_employee: receiver.actor,
  });
  state.invoice.lines[0].review_confirmed = true;
  return { bytes, repository, stored };
}

function homeWare(state: DemoState) {
  hydrateSuppliers(state);
  return supplierRecords(state).find(
    (record) =>
      record.company_id === state.config.company.seed_key &&
      record.name === "HomeWare Imports",
  )!;
}

function assertPostedReceipt(state: DemoState, previousStock: number) {
  expect(state.invoice.status).toBe("posted");
  expect(state.invoice.lines[0].unit_cost_before_tax).toBe("14.2000");
  expect(state.invoice.lines[0].case_cost_before_tax).toBe("42.6000");
  expect(state.invoice.subtotal).toBe("42.60");
  expect(state.invoice.tax).toBe("5.54");
  expect(state.invoice.final_total).toBe("48.14");
  expect(state.stock["Branch 1:0012"]).toBe(previousStock + 3);
  expect(
    state.ledger.filter((entry) => entry.invoice_id === state.invoice.id),
  ).toEqual([
    expect.objectContaining({
      type: "invoice",
      amount: "48.14",
      reference: "HW-5012",
      supplier: "HomeWare Imports",
      company_id: "super-arzon",
      branch: "Branch 1",
    }),
  ]);
}

describe("C8 actual included original supplier confirmation", () => {
  it("reads the exact retained original and posts an actually confirmed supplier once without changing the running sale", async () => {
    const state = fixtureState();
    expect(homeWare(state).status).toBe("confirmed");
    const sales = structuredClone(state.sales);
    expect(activeSaleAt(state, "0012", "Branch 1", now)?.sale_price).toBe(
      "16.99",
    );
    const previousStock = state.stock["Branch 1:0012"];
    const { repository, stored, bytes } = await readAndReviewOriginal(state);
    expect(state.invoice.supplier_confirmed).toBe(true);
    expect(invoiceBlockers(state, manager)).toEqual([]);
    expect(
      state.alerts.filter((entry) => entry.type === "sale_cost_increase"),
    ).toHaveLength(0);
    expect(postInvoice(state, manager)).toBe(true);
    assertPostedReceipt(state, previousStock);
    expect(state.sales).toEqual(sales);
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    expect(regularPrice(state, "0012", "Branch 1")).toBe("20.99");
    expect(
      state.approvals.find(
        (entry) => entry.source_invoice_id === state.invoice.id,
      ),
    ).toMatchObject({
      status: "pending",
      proposed_price: "23.49",
      applies_after_sale: true,
    });
    expect(
      state.alerts.find((entry) => entry.type === "sale_cost_increase"),
    ).toMatchObject({
      invoice_id: state.invoice.id,
      previous_cost: "12.6000",
      new_cost: "14.2000",
      sale_price: "16.99",
    });
    const posted = structuredClone(state);
    expect(postInvoice(state, manager)).toBe(false);
    expect(state).toEqual(posted);
    const retained = await readStoredFile(
      stored.reference,
      manager.company_id,
      repository,
    );
    expect(new Uint8Array(await retained.source.arrayBuffer())).toEqual(bytes);
  });

  it("blocks a proposed supplier atomically until actual Manager confirmation, then posts the same retained original", async () => {
    const state = fixtureState();
    const supplier = homeWare(state);
    supplier.status = "proposed";
    const previousStock = state.stock["Branch 1:0012"];
    await readAndReviewOriginal(state);
    expect(state.invoice.supplier_confirmed).toBe(false);
    expect(invoiceBlockers(state, manager)).toEqual(["supplier_pending"]);
    const pending = structuredClone(state);
    expect(() => postInvoice(state, manager)).toThrow("supplier_pending");
    expect(state).toEqual(pending);
    confirmSupplier(state, manager, supplier.id, now);
    expect(supplier.status).toBe("confirmed");
    expect(state.invoice.supplier_confirmed).toBe(true);
    expect(invoiceBlockers(state, manager)).toEqual([]);
    expect(postInvoice(state, manager)).toBe(true);
    assertPostedReceipt(state, previousStock);
    expect(state.sales).toEqual(pending.sales);
  });

  it("never treats a same-name foreign supplier as confirmed for this company's original", async () => {
    const state = fixtureState();
    homeWare(state).company_id = "other-company";
    await readAndReviewOriginal(state);
    expect(state.invoice.supplier_confirmed).toBe(false);
    expect(invoiceBlockers(state, manager)).toContain("supplier_pending");
    const pending = structuredClone(state);
    expect(() => postInvoice(state, manager)).toThrow("supplier_pending");
    expect(state).toEqual(pending);
  });

  it("keeps a receiver's manual-price recommendation pending for the final approval while the original and active sale stay unchanged", async () => {
    const state = fixtureState();
    savePriceChange(
      state,
      manager,
      {
        product_code: "0012",
        mode: "regular",
        scope: "current",
        branches: ["Branch 1"],
        price: "24.99",
        price_unit: "each",
        starts_on: "2026-10-12",
        last_day: null,
        accept_below_margin: false,
        below_cost_reason: "",
        add_labels: false,
      },
      now,
    );
    const sales = structuredClone(state.sales);
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
      name_en: "Demo Floor Worker",
      now,
    });
    await readAndReviewOriginal(state, worker);
    expect(state.invoice.supplier_confirmed).toBe(true);
    expect(state.invoice.lines[0].manual_price_decision).toBe("rule");
    state.invoice.lines[0].manual_price_decision = "keep";
    state.invoice.receiving_employee = "Demo Floor Worker";
    expect(postInvoice(state, worker)).toBe(true);
    expect(
      state.approvals.find(
        (entry) => entry.source_invoice_id === state.invoice.id,
      ),
    ).toMatchObject({
      status: "pending",
      proposed_price: "23.49",
      applies_after_sale: true,
      manual_price_review: {
        kept_price: "24.99",
        calculated_price: "23.49",
        receiver_recommendation: "keep",
      },
    });
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    expect(state.sales).toEqual(sales);
  });
});
