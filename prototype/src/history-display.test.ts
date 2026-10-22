import { describe, expect, it } from "vitest";
import { historyActionLabel, historyFieldLabel } from "./history-copy";
import {
  historyChangeIsMoney,
  historyDisplayChanges,
  historyProductName,
  historyInvoiceEvidence,
} from "./history-display";
import type { Activity } from "./types";

const activity = (values: Partial<Activity> = {}): Activity => ({
  id: "test-price",
  company_id: "test-company",
  branch: "Store A",
  product_code: "0004",
  action: "Approve price",
  by: "Fictional approver",
  at: "2026-10-12T12:00:00Z",
  ...values,
});

describe("History presentation uses recorded evidence", () => {
  it("uses recorded imported invoice identity and line count without replacing the audit", () => {
    const entry = activity({
      action: "Create invoice draft",
      entity_type: "invoice",
      entity_id: "fictional-invoice",
      after: {
        supplier_invoice_number: "FICTIONAL-25",
        supplier: "Cedar Valley Foods Inc.",
        lines: Array.from({ length: 25 }, () => ({
          description: "Invented item",
        })),
        reading_record: { source: "imported" },
      },
    });
    const before = structuredClone(entry);
    expect(historyInvoiceEvidence(entry)).toEqual({
      id: "fictional-invoice",
      number: "FICTIONAL-25",
      supplier: "Cedar Valley Foods Inc.",
      lineCount: 25,
      imported: true,
    });
    expect(entry).toEqual(before);
    expect(
      historyInvoiceEvidence({ ...entry, entity_type: "product" }),
    ).toBeUndefined();
  });
  it.each([
    "Imported 12 invoice readings from fictional-readings-2026-10-21.json",
    "Create invoice draft",
    "Removed fictional data",
  ])(
    "shows the recorded R1 action instead of a generic activity: %s",
    (action) => {
      expect(historyActionLabel(action, "en")).toBe(action);
      const persian = historyActionLabel(action, "fa");
      expect(persian).not.toBe("فعالیت ثبت‌شده");
      expect(persian).not.toBe(action);
      if (action.startsWith("Imported ")) {
        expect(persian).toContain("۱۲");
        expect(persian).toContain("fictional-readings-2026-10-21.json");
      }
    },
  );
  it("shows a legacy product price change without making it reversible", () => {
    const entry = activity({
      before: { product: { code: "0004", selling_price: "6.99" } },
      after: { product: { code: "0004", selling_price: "6.49" } },
      reversible: false,
    });
    const original = structuredClone(entry);
    expect(historyDisplayChanges(entry)).toEqual([
      {
        path: ["price", "product", "selling_price"],
        field: "selling_price",
        before: "6.99",
        after: "6.49",
      },
    ]);
    expect(entry).toEqual(original);
    expect(entry.reversal).toBeUndefined();
  });

  it("uses actual patches, putting business prices ahead of audit metadata", () => {
    const entry = activity({
      reversal: [
        {
          path: ["products", { key: "code", value: "0004" }, "updated_at"],
          before: "old",
          after: "new",
          before_exists: true,
          after_exists: true,
        },
        {
          path: ["products", { key: "code", value: "0004" }, "name_en"],
          before: "Old name",
          after: "New name",
          before_exists: true,
          after_exists: true,
        },
        {
          path: ["products", { key: "code", value: "0004" }, "selling_price"],
          before: "6.99",
          after: "6.49",
          before_exists: true,
          after_exists: true,
        },
      ],
    });
    const original = structuredClone(entry);
    const changes = historyDisplayChanges(entry);
    expect(changes.map((change) => change.field)).toEqual([
      "selling_price",
      "name_en",
    ]);
    expect(historyChangeIsMoney(changes[0])).toBe(true);
    expect(entry).toEqual(original);
  });

  it("reads flat path maps and preserves real four-decimal cost differences", () => {
    const changes = historyDisplayChanges(
      activity({
        before: { "products · 0004 · last_cost_before_tax": "1.5525" },
        after: { "products · 0004 · last_cost_before_tax": "1.5555" },
      }),
    );
    expect(changes[0]).toMatchObject({
      field: "last_cost_before_tax",
      before: "1.5525",
      after: "1.5555",
    });
    expect(historyChangeIsMoney(changes[0])).toBe(true);
  });

  it("does not present equivalent cost precision as a changed amount", () => {
    expect(
      historyDisplayChanges(
        activity({ before: { price: "18.4000" }, after: { price: "18.40" } }),
      ),
    ).toEqual([]);
  });

  it("retains real status and line quantities from complete order snapshots", () => {
    const changes = historyDisplayChanges(
      activity({
        action: "Place order",
        before: {
          id: "order-1",
          version: 1,
          status: "draft",
          lines: [{ id: "line-1", ordered_units: 24 }],
        },
        after: {
          id: "order-1",
          version: 2,
          status: "ordered",
          lines: [{ id: "line-1", ordered_units: 48 }],
        },
      }),
    );
    expect(
      changes.map((change) => [change.field, change.before, change.after]),
    ).toEqual([
      ["status", "draft", "ordered"],
      ["ordered_units", 24, 48],
    ]);
  });

  it("never invents before-and-after values for an action without evidence", () => {
    expect(historyDisplayChanges(activity())).toEqual([]);
  });
  it("keeps file evidence metadata out of the summary without changing recorded business values", () => {
    const entry = activity({
      before: {
        file_data: "idb-file:v1:previous",
        file_name: "previous.pdf",
        file_type: "application/pdf",
        file_size: 1024,
        original_file_invoice_id: "previous-invoice",
        demo_original_snapshot: true,
        legacy_demo_original: {
          file_name: "legacy.pdf",
          file_data: "data:application/pdf;base64,old",
        },
        prototype_history_dictionary: { blocks: ["old"], integrity: "old" },
        __c6_history_ref: 0,
        product: { name_en: "Black Tea 450 g", selling_price: "6.99" },
      },
      after: {
        file_data: "idb-file:v1:corrected",
        file_name: "corrected.pdf",
        file_type: "image/png",
        file_size: 2048,
        original_file_invoice_id: "corrected-invoice",
        demo_original_snapshot: false,
        legacy_demo_original: {
          file_name: "new-legacy.pdf",
          file_data: "data:image/png;base64,new",
        },
        prototype_history_dictionary: { blocks: ["new"], integrity: "new" },
        __c6_history_ref: 1,
        product: {
          name_en: "Black Tea 450 g corrected",
          selling_price: "6.49",
        },
      },
    });
    const original = structuredClone(entry);
    expect(
      historyDisplayChanges(entry).map(({ field, before, after }) => ({
        field,
        before,
        after,
      })),
    ).toEqual([
      { field: "selling_price", before: "6.99", after: "6.49" },
      {
        field: "name_en",
        before: "Black Tea 450 g",
        after: "Black Tea 450 g corrected",
      },
    ]);
    expect(entry).toEqual(original);
  });

  it("retains a true scalar price change and an absent creation value", () => {
    expect(
      historyDisplayChanges(activity({ before: "6.99", after: "6.49" }))[0],
    ).toMatchObject({ before: "6.99", after: "6.49", field: "price" });
    expect(
      historyDisplayChanges(
        activity({ action: "Add note", after: { text: "Actual note" } }),
      )[0],
    ).toMatchObject({ before: undefined, after: "Actual note", field: "text" });
  });

  it("uses company-scoped product names and English fallback in Persian", () => {
    const products = [
      {
        company_id: "other-company",
        code: "0004",
        name_en: "Private other product",
        name_fa: "",
      },
      {
        company_id: "test-company",
        code: "0004",
        name_en: "Black Tea 450 g",
        name_fa: "",
      },
    ];
    expect(historyProductName(products, activity(), "test-company", "en")).toBe(
      "Black Tea 450 g",
    );
    expect(historyProductName(products, activity(), "test-company", "fa")).toBe(
      "Black Tea 450 g",
    );
    expect(
      historyProductName(
        products,
        activity({ company_id: "other-company" }),
        "test-company",
        "en",
      ),
    ).toBeUndefined();
  });

  it("uses retained names when the catalog record is absent, rejecting foreign snapshots", () => {
    expect(
      historyProductName(
        [],
        activity({
          after: {
            product: {
              company_id: "test-company",
              name_en: "Retained name",
              name_fa: "نام ثبت‌شده",
            },
          },
        }),
        "test-company",
        "fa",
      ),
    ).toBe("نام ثبت‌شده");
    expect(
      historyProductName(
        [],
        activity({
          after: {
            product: { company_id: "other-company", name_en: "Private name" },
          },
        }),
        "test-company",
        "en",
      ),
    ).toBeUndefined();
  });
  it("keeps the historical name instead of relabeling an older edit with a later name", () => {
    const products = [
      {
        company_id: "test-company",
        code: "0004",
        name_en: "Newest name",
        name_fa: "",
      },
    ];
    const entry = activity({
      after: {
        product: {
          code: "0004",
          company_id: "test-company",
          name_en: "Name at this action",
          name_fa: "",
        },
      },
    });
    expect(historyProductName(products, entry, "test-company", "en")).toBe(
      "Name at this action",
    );
  });
  it("does not give an entry another product's retained name", () => {
    expect(
      historyProductName(
        [],
        activity({
          after: {
            product: {
              company_id: "test-company",
              code: "9999",
              name_en: "Other product",
            },
          },
        }),
        "test-company",
        "en",
      ),
    ).toBeUndefined();
  });
  it("displays a recorded sale request without leaking technical identity fields", () => {
    const changes = historyDisplayChanges(
      activity({
        action: "Request a sale",
        before: {
          id: "request",
          requested_price: "7.99",
          status: "pending",
          requester_username: "worker",
        },
        after: {
          id: "request",
          requested_price: "7.49",
          status: "approved",
          requester_username: "worker",
          approved_sale_id: "sale",
        },
      }),
    );
    expect(
      changes.map((change) => [change.field, change.before, change.after]),
    ).toEqual([
      ["requested_price", "7.99", "7.49"],
      ["status", "pending", "approved"],
    ]);
  });
});

describe("C8 actual sale History vocabulary", () => {
  it.each([
    "Schedule sale",
    "Start sale",
    "Change sale",
    "End sale",
    "Sale reminder",
    "Revert sale",
    "Set regular price",
    "Request sale",
    "Change sale request",
    "Withdraw sale request",
    "Approve sale request",
    "Reject sale request",
    "Expire sale request",
    "Decide sale alert",
    "Save sales settings",
  ])("names the recorded %s action in both languages", (action) => {
    expect(historyActionLabel(action, "en")).toBe(action);
    expect(historyActionLabel(action, "fa")).not.toBe("فعالیت ثبت‌شده");
    expect(historyActionLabel(action, "fa")).not.toBe(action);
  });
  it("labels actual retained sale price and calendar fields", () => {
    expect(historyFieldLabel("sale_price", "en")).toBe("Sale price");
    expect(historyFieldLabel("requested_price", "en")).toBe("Sale price");
    expect(historyFieldLabel("last_day", "en")).toBe("Last day");
    expect(historyFieldLabel("starts_on", "fa")).toBe("شروع");
  });
});
