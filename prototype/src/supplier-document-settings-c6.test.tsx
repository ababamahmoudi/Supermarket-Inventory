import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { createOrder } from "./orders";
import { OrderPrintDocument } from "./order-print";
import {
  BilingualPrintText,
  OperationalPrintDocument,
} from "./operational-print";
import { saveSupplierDocumentSettings } from "./supplier-document-settings";

const context = (state: ReturnType<typeof initialState>) =>
  authenticatedTestActor(state, "manager", { name_en: "Document reviewer" });
describe("C6 supplier document language", () => {
  it("prints the supplier order in English by default even from the Persian interface", () => {
    const state = initialState();
    const order = createOrder(state, context(state), {
      branch: "Branch 1",
      supplier: "Fresh Valley Foods",
      lines: [
        {
          new_item: {
            id: "document-item",
            name_en: "Fictional item",
            name_fa: "کالای نمایشی",
          },
          cases: "1",
        },
      ],
    });
    const { container } = render(
      <OrderPrintDocument order={order} config={state.config} language="fa" />,
    );
    expect(container.querySelector("article")).toHaveAttribute("lang", "en");
    expect(container.querySelector("article")).toHaveAttribute("dir", "ltr");
    expect(container.querySelector('[lang="fa"]')).toBeNull();
    expect(screen.getByText("Fictional item")).toBeVisible();
    expect(container.textContent).not.toMatch(/[\u0600-\u06ff]/);
    expect(order.lines[0].name_fa).toBe("کالای نمایشی");
  });
  it("keeps internal operational documents bilingual", () => {
    const { container } = render(
      <OperationalPrintDocument
        title_en="Picking list"
        title_fa="فهرست برداشت"
        company_name="Fictional store"
        reference="BR-0001"
        language="fa"
      >
        <BilingualPrintText en="Items" fa="کالاها" />
      </OperationalPrintDocument>,
    );
    expect(container.querySelector("article")).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("Picking list")).toBeVisible();
    expect(screen.getByText("فهرست برداشت")).toBeVisible();
    expect(screen.getByText("کالاها")).toBeVisible();
  });
  it("audits an authorized per-document choice while preserving original invoices, pickup evidence and money", () => {
    const state = initialState();
    const evidence = JSON.stringify({
      invoices: state.invoices,
      returns: state.returns,
      ledger: state.ledger,
      stock: state.stock,
    });
    saveSupplierDocumentSettings(state, context(state), {
      return_memo: "bilingual",
      supplier_order: "en",
    });
    expect(state.activity[0]).toMatchObject({
      action: "Supplier document settings changed",
      entity_id: "supplier_documents",
      by: "Document reviewer",
      company_id: state.config.company.seed_key,
    });
    expect(
      JSON.stringify({
        invoices: state.invoices,
        returns: state.returns,
        ledger: state.ledger,
        stock: state.stock,
      }),
    ).toBe(evidence);
    const before = JSON.stringify(state);
    expect(() =>
      saveSupplierDocumentSettings(
        state,
        authenticatedTestActor(state, "floor_worker"),
        { return_memo: "en", supplier_order: "en" },
      ),
    ).toThrow("capability");
    expect(() =>
      saveSupplierDocumentSettings(
        state,
        authenticatedTestActor(
          {
            ...state,
            config: {
              ...state.config,
              company: { ...state.config.company, seed_key: "other-company" },
            },
          },
          "manager",
        ),
        { return_memo: "en", supplier_order: "en" },
      ),
    ).toThrow("company");
    expect(JSON.stringify(state)).toBe(before);
  });
});
