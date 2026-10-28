import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { BrowserAuthorityRepository } from "./authority-repository";
import { initializeAuthority } from "./authority-initialization";
import {
  configuredDemoPeople,
  configuredDemoComputers,
} from "./e1-seed-fixtures";
import { createAuthenticationService } from "./authentication-service";
import { initialState } from "./e1-bootstrap";
import { actorAtLocation, cloneWithAuthority } from "./authority";
import { capturePriceUpdateChanges } from "./price-updates";
import { createPackageService } from "./package-service";
import {
  readWeightEditor,
  weightEditorSnapshot,
  weightPricingSnapshot,
  saveWeightProductEditor,
  addWeightProductEditor,
  savePackageEditor,
  weightPriceCandidate,
  type WeightPackageDraft,
} from "./weight-product-editor";
import { productStoreCost, productCostHistory } from "./product-costs";
import {
  createInvoice,
  addManualLine,
  recalculateInvoice,
  postInvoice,
  receiveShort,
} from "./invoice";
import {
  setInvoiceWeightQuantity,
  setInvoiceWeightCost,
  setInvoiceWeightReceived,
} from "./invoice-weight";
import { savePriceChange } from "./sales";
import {
  correctPostedInvoice,
  invoiceContentCorrectionPreview,
} from "./invoice-corrections";
import { effectiveInvoiceVersion } from "./invoice-version";
import { queryPriceChangePreview } from "./price-change-read-model";
import { resolveApproval } from "./approvals";
import { projectProductReadDTO } from "./catalog-read-model";
import { selectHistory } from "./history";
import type { AuthenticatedActor } from "./authority-types";
import type { ProductEdits } from "./product-editor";
import type { ChangePriceInput } from "./sales";
import type { DemoState, Product } from "./types";

function edits(product: Product): ProductEdits {
  return {
    name_en: product.name_en,
    name_fa: product.name_fa,
    description_en: product.description_en ?? "",
    description_fa: product.description_fa ?? "",
    unit_size: product.unit_size,
    ai_category: product.ai_category,
    pricing_category: product.pricing_category,
    barcode: product.barcode,
    main_supplier: product.main_supplier,
    date_tracking: false,
    sold_by: "weight",
    scope: "all",
  };
}
function packageDraft(size = "250"): WeightPackageDraft {
  return {
    key: `new-${size}`,
    size,
    unit: "g",
    barcode: "",
    name_en: "",
    name_fa: "",
    generated: true,
  };
}
function postRealCost(
  state: DemoState,
  actor: AuthenticatedActor,
  code: string,
  branch: string,
  cost: string,
  short = false,
) {
  actor = actorAtLocation(state, actor, branch);
  state.invoice = createInvoice(state, actor, branch, true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_invoice_number: `FICTIONAL-${branch}-${cost}`,
    supplier_confirmed: true,
    invoice_date: new Date().toISOString().slice(0, 10),
    received_at: new Date().toISOString(),
    file_name: "fictional-weight-cost.png",
    file_type: "image/png",
    file_data: "data:image/png;base64,ZmljdGlvbmFs",
  });
  addManualLine(state, actor, code);
  const line = state.invoice.lines[0];
  setInvoiceWeightQuantity(line, "2", "lb", state.config);
  setInvoiceWeightCost(line, cost, "lb", state.config);
  if (short) setInvoiceWeightReceived(line, "1", state.config);
  Object.assign(line, {
    date_tracking: false,
    date_confirmed: true,
    review_confirmed: true,
  });
  recalculateInvoice(state.invoice, state.config);
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional regular receipt retained.",
  };
  postInvoice(state, actor);
}
async function fixture(withReceipts = false) {
  const state = initialState();
  state.invoices = [];
  state.ledger = [];
  state.approvals = [];
  state.activity = [];
  state.offers = [];
  state.sales = [];
  const parent: Product = {
    ...structuredClone(state.products[0]),
    company_id: state.config.company.seed_key,
    code: "9300",
    name_en: "Fictional Ground Juniper",
    name_fa: "سرو کوهی خیالی",
    barcode: "FICTIONAL-PARENT-9300",
    sold_by: "weight",
    unit_size: "lb",
    pricing_category: "grocery",
    last_cost_before_tax: "4.1000",
    selling_price: "6.49",
    branch_prices: { "Branch 1": "6.49", "Branch 2": "9.49" },
    manual_prices: {},
    price_provenance: {},
    status: "active",
    date_tracking: false,
  };
  state.products.push(parent);
  const repository = new BrowserAuthorityRepository(new IDBFactory());
  await initializeAuthority(repository, {
    state,
    demo_users: configuredDemoPeople(),
    registered_computers: configuredDemoComputers(),
  });
  const auth = createAuthenticationService({ repository });
  const signed = await auth.switchDemoUser(
    state.config.company.seed_key,
    "manager",
  );
  await auth.setLocation(signed.identity, {
    kind: "location",
    location_id: "Branch 1",
  });
  if (withReceipts)
    await repository.runBusinessCommand<DemoState, void>(
      signed.identity,
      (canonical, actor) => {
        postRealCost(canonical, actor, parent.code, "Branch 1", "4.1000");
        postRealCost(canonical, actor, parent.code, "Branch 2", "6.0000");
      },
    );
  const service = createPackageService(repository);
  const result = await service.add(signed.identity, {
    parent_code: parent.code,
    expected_parent_snapshot: await service.parentSnapshot(
      signed.identity,
      parent.code,
    ),
    size: "250",
    unit: "g",
  });
  const read = () => repository.loadBusiness<DemoState>(parent.company_id);
  const boot = () =>
    repository.queryBusiness(signed.identity, (canonical, actor) =>
      readWeightEditor(canonical as DemoState, actor, parent.code),
    );
  return {
    repository,
    auth,
    service,
    identity: signed.identity,
    company: parent.company_id,
    code: parent.code,
    childCode: result.product_code,
    read,
    boot,
  };
}
describe("R2f D3 atomic real weight-product editor commands", () => {
  it("keeps actual receipts immutable, creates a real pending price, and derives private costs from each branch's current source", async () => {
    const f = await fixture(true);
    try {
      const prior = await f.read();
      const source = (await f.boot()).value;
      const product = prior.state.products.find(
        (item) => item.code === f.code,
      )!;
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          saveWeightProductEditor(
            state,
            actor,
            f.code,
            { ...edits(product), name_en: "Fictional Juniper Pantry" },
            source.snapshot,
            [packageDraft("500")],
            { value: "5.1000", unit: "lb" },
          );
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      const after = (await f.read()).state;
      const parent = after.products.find((item) => item.code === f.code)!;
      const child = after.products.find((item) => item.code === f.childCode)!;
      expect(parent.name_en).toBe("Fictional Juniper Pantry");
      expect(parent.branch_prices?.["Branch 1"]).toBe("6.49");
      expect(parent.pending_price).toBe("7.99");
      expect(child.branch_prices?.["Branch 1"]).toBe("3.99");
      expect(child.package_pending_prices?.["Branch 1"]).toBe("4.99");
      expect(child.package_branch_costs?.["Branch 1"]).toBe("2.8109");
      expect(child.package_branch_costs?.["Branch 2"]).toBe("3.3069");
      expect(after.invoices).toEqual(prior.state.invoices);
      expect(after.ledger).toEqual(prior.state.ledger);
      expect(after.stock_movements).toEqual(prior.state.stock_movements);
      const costs = await f.repository.queryBusiness<DemoState, string[]>(
        f.identity,
        (state, actor) => [
          productStoreCost(
            state,
            actorAtLocation(state, actor, "Branch 1"),
            state.products.find((item) => item.code === f.code)!,
          )!,
          productStoreCost(
            state,
            actorAtLocation(state, actor, "Branch 2"),
            state.products.find((item) => item.code === f.code)!,
          )!,
        ],
      );
      expect(costs.value).toEqual(["5.1000", "6.0000"]);
      const history = await f.repository.queryBusiness(
        f.identity,
        (state, actor) =>
          productCostHistory(
            state as DemoState,
            actor,
            (state as DemoState).products.find((item) => item.code === f.code)!,
          ),
      );
      expect(history.value).toHaveLength(1);
      expect(history.value[0].unit_cost_before_tax).toBe("4.1000");
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          postRealCost(state, actor, f.code, "Branch 1", "3.8000");
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      const current = await f.repository.queryBusiness<
        DemoState,
        string | null
      >(f.identity, (state, actor) =>
        productStoreCost(
          state,
          actor,
          state.products.find((item) => item.code === f.code)!,
        ),
      );
      expect(current.value).toBe("3.8000");
      expect(
        (await f.read()).state.products.find((item) => item.code === f.code)
          ?.manual_costs?.["Branch 1"].unit_cost_before_tax,
      ).toBe("5.1000");
    } finally {
      f.repository.dispose();
    }
  });
  it.each(["correction", "later delivery"] as const)(
    "supersedes the private manual marker when the same source line gains a genuine %s",
    async (kind) => {
      const f = await fixture();
      try {
        await f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) =>
            postRealCost(
              state,
              actor,
              f.code,
              "Branch 1",
              "4.1000",
              kind === "later delivery",
            ),
        );
        const boot = (await f.boot()).value;
        await f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) =>
            saveWeightProductEditor(
              state,
              actor,
              f.code,
              edits(state.products.find((item) => item.code === f.code)!),
              boot.snapshot,
              [],
              { value: "5.1000", unit: "lb" },
            ),
        );
        const saved = (await f.read()).state;
        const original = structuredClone(
          saved.invoices!.find((item) =>
            item.lines.some((line) => line.product_code === f.code),
          )!,
        );
        const originalSource = await f.repository.queryBusiness(
          f.identity,
          (state, actor) =>
            productCostHistory(
              state as DemoState,
              actor,
              (state as DemoState).products.find(
                (item) => item.code === f.code,
              )!,
            ),
        );
        await f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            if (kind === "correction") {
              const lines = structuredClone(
                effectiveInvoiceVersion(state, original).lines,
              );
              setInvoiceWeightCost(lines[0], "4.7000", "lb", state.config);
              const input = {
                lines,
                unit_cost_reentered: [0],
                reason: "Fictional effective receipt cost correction",
              };
              const preview = invoiceContentCorrectionPreview(
                state,
                actor,
                original.id,
                input,
              );
              expect(preview.blockers).toEqual([]);
              correctPostedInvoice(
                state,
                actor,
                original.id,
                input,
                preview.snapshot,
                "fictional-weight-correction",
              );
            } else {
              state.invoice = structuredClone(
                state.invoices!.find((item) => item.id === original.id)!,
              );
              receiveShort(
                state,
                f.code,
                1,
                "FICTIONAL-LATER-RECEIPT",
                actor,
                0,
              );
            }
            capturePriceUpdateChanges(before, state, actor);
          },
        );
        const current = await f.repository.queryBusiness(
          f.identity,
          (state, actor) => {
            const product = (state as DemoState).products.find(
              (item) => item.code === f.code,
            )!;
            return {
              cost: productStoreCost(state as DemoState, actor, product),
              history: productCostHistory(state as DemoState, actor, product),
              marker: product.manual_costs?.["Branch 1"],
            };
          },
        );
        expect(current.value.cost).toBe(
          kind === "correction" ? "4.7000" : "4.1000",
        );
        expect(current.value.history[0].id).toBe(originalSource.value[0].id);
        expect(current.value.marker?.unit_cost_before_tax).toBe("5.1000");
        if (kind === "correction")
          expect(
            (await f.read()).state.invoices!.find(
              (item) => item.id === original.id,
            ),
          ).toEqual(original);
        else
          expect(current.value.history[0].receipt_id).toContain(
            "FICTIONAL-LATER-RECEIPT",
          );
      } finally {
        f.repository.dispose();
      }
    },
  );
  it("rolls back metadata, manual-cost evidence, approvals and code allocation when one staged package is invalid", async () => {
    const f = await fixture();
    try {
      const source = (await f.boot()).value,
        prior = await f.read(),
        product = prior.state.products.find((item) => item.code === f.code)!;
      await expect(
        f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) =>
            saveWeightProductEditor(
              state,
              actor,
              f.code,
              { ...edits(product), name_en: "Must not be saved" },
              source.snapshot,
              [{ ...packageDraft("500"), barcode: "9916847256307" }],
              { value: "5.1000", unit: "lb" },
            ),
        ),
      ).rejects.toThrow();
      expect(await f.read()).toEqual(prior);
    } finally {
      f.repository.dispose();
    }
  });
  it("preserves another branch's pending cost review while editing this branch and blocks partial replacement of an all-location review", async () => {
    const f = await fixture();
    try {
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          const other = actorAtLocation(state, actor, "Branch 2");
          const product = state.products.find((item) => item.code === f.code)!;
          saveWeightProductEditor(
            state,
            other,
            f.code,
            edits(product),
            weightEditorSnapshot(state, other, f.code),
            [],
            { value: "6.5000", unit: "lb" },
          );
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      const before = (await f.read()).state;
      const otherReview = structuredClone(
        before.approvals.find(
          (item) =>
            item.product_code === f.code &&
            item.branch === "Branch 2" &&
            item.status === "pending",
        )!,
      );
      const boot = (await f.boot()).value;
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const prior = cloneWithAuthority(state);
          saveWeightProductEditor(
            state,
            actor,
            f.code,
            edits(state.products.find((item) => item.code === f.code)!),
            boot.snapshot,
            [],
            { value: "5.1000", unit: "lb" },
          );
          capturePriceUpdateChanges(prior, state, actor);
        },
      );
      const after = (await f.read()).state;
      expect(
        after.approvals.find((item) => item.id === otherReview.id),
      ).toEqual(otherReview);
      expect(
        after.approvals
          .filter(
            (item) => item.product_code === f.code && item.status === "pending",
          )
          .map((item) => item.branch)
          .sort(),
      ).toEqual(["Branch 1", "Branch 2"]);
      const child = after.products.find((item) => item.code === f.childCode)!;
      expect(child.package_pending_prices?.["Branch 1"]).toBe("4.99");
      expect(child.package_pending_prices?.["Branch 2"]).toBe("5.99");
      const same = await f.boot();
      await f.auth.setLocation(f.identity, { kind: "all_locations" });
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const all = actor;
          saveWeightProductEditor(
            state,
            all,
            f.code,
            edits(state.products.find((item) => item.code === f.code)!),
            weightEditorSnapshot(state, all, f.code),
            [],
            { value: "5.7000", unit: "lb" },
          );
        },
      );
      const allReview = await f.read();
      await f.auth.setLocation(f.identity, {
        kind: "location",
        location_id: "Branch 1",
      });
      const fresh = (await f.boot()).value;
      await expect(
        f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) =>
            saveWeightProductEditor(
              state,
              actor,
              f.code,
              edits(state.products.find((item) => item.code === f.code)!),
              fresh.snapshot,
              [],
              { value: "5.9000", unit: "lb" },
            ),
        ),
      ).rejects.toThrow("pending_cost_review");
      expect(await f.read()).toEqual(allReview);
      expect(same.value.snapshot).not.toBe(fresh.snapshot);
    } finally {
      f.repository.dispose();
    }
  });
  it("rejects stale parent/config/package evidence and keeps a new parent plus all packages in one write", async () => {
    const f = await fixture();
    try {
      const source = (await f.boot()).value;
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state) => {
          state.config.weighed_items!.package_container_fee = "0.79";
        },
      );
      const stale = await f.read(),
        product = stale.state.products.find((item) => item.code === f.code)!;
      await expect(
        f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) =>
            saveWeightProductEditor(
              state,
              actor,
              f.code,
              edits(product),
              source.snapshot,
              [],
            ),
        ),
      ).rejects.toThrow();
      expect(await f.read()).toEqual(stale);
      const created = await f.repository.runBusinessCommand<DemoState, string>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          const added = addWeightProductEditor(
            state,
            actor,
            {
              ...edits(product),
              name_en: "Fictional Valley Marjoram",
              name_fa: "مرزنجوش خیالی",
              barcode: "",
              last_cost_before_tax: "3.4900",
              last_cost_unit: "lb",
              similar_name_confirmed: true,
              minimum_margin_confirmed: true,
            },
            [packageDraft("100"), packageDraft("500")],
            weightPricingSnapshot(state, actor),
          );
          capturePriceUpdateChanges(before, state, actor);
          return added.code;
        },
      );
      const after = (await f.read()).state;
      const parent = after.products.find(
        (item) => item.code === created.value,
      )!;
      const children = after.products.filter(
        (item) => item.package_of_product_id === parent.code,
      );
      expect(children).toHaveLength(2);
      expect(
        new Set([parent.code, ...children.map((item) => item.code)]).size,
      ).toBe(3);
      expect(
        children.every(
          (item) =>
            item.barcode.startsWith("20") && item.branch_prices?.["Branch 1"],
        ),
      ).toBe(true);
    } finally {
      f.repository.dispose();
    }
  });
  it("shows the staged new cost in the genuine price preview and applies an explicit Manager price as the same authorized decision", async () => {
    const f = await fixture();
    try {
      const source = (await f.boot()).value,
        prior = await f.read(),
        product = prior.state.products.find((item) => item.code === f.code)!;
      const input: ChangePriceInput = {
        product_code: f.code,
        mode: "regular",
        scope: "current",
        branches: ["Branch 1"],
        price: "9.99",
        price_unit: "lb",
        starts_on: "",
        last_day: null,
        accept_below_margin: true,
        below_cost_reason: "Fictional explicit price review",
        add_labels: false,
      };
      const preview = await f.repository.queryBusiness(
        f.identity,
        (state, actor) =>
          queryPriceChangePreview(
            weightPriceCandidate(state as DemoState, actor, {
              code: f.code,
              cost: "5.1000",
              cost_unit: "lb",
              pricing_category: "grocery",
            }),
            actor,
            input,
            "Branch 1",
          ),
      );
      expect(preview.value.effects[0].cost).toBe("5.1000");
      expect(await f.read()).toEqual(prior);
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          saveWeightProductEditor(
            state,
            actor,
            f.code,
            edits(product),
            source.snapshot,
            [packageDraft("500")],
            { value: "5.1000", unit: "lb" },
            new Date(),
            input,
          );
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      const after = (await f.read()).state;
      const parent = after.products.find((item) => item.code === f.code)!;
      expect(parent.branch_prices?.["Branch 1"]).toBe("9.99");
      expect(parent.manual_prices?.["Branch 1"]?.rule_price).toBe("7.99");
      expect(
        after.approvals.filter(
          (item) => item.product_code === f.code && item.status === "pending",
        ),
      ).toHaveLength(0);
      expect(
        after.products.find((item) => item.code === f.childCode)
          ?.branch_prices?.["Branch 1"],
      ).toBe("5.99");
    } finally {
      f.repository.dispose();
    }
  });
  it("does not let a manual price for another branch suppress this branch's required cost approval", async () => {
    const f = await fixture();
    try {
      const boot = (await f.boot()).value;
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          const product = state.products.find((item) => item.code === f.code)!;
          saveWeightProductEditor(
            state,
            actor,
            f.code,
            edits(product),
            boot.snapshot,
            [],
            { value: "5.1000", unit: "lb" },
            new Date(),
            {
              product_code: f.code,
              mode: "regular",
              scope: "selected",
              branches: ["Branch 2"],
              price: "9.99",
              price_unit: "lb",
              starts_on: "",
              last_day: null,
              accept_below_margin: true,
              below_cost_reason: "Fictional reviewed branch decision",
              add_labels: false,
            },
          );
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      const after = (await f.read()).state;
      const parent = after.products.find((item) => item.code === f.code)!;
      const child = after.products.find((item) => item.code === f.childCode)!;
      expect(parent.branch_prices).toMatchObject({
        "Branch 1": "6.49",
        "Branch 2": "9.99",
      });
      expect(
        after.approvals
          .filter(
            (item) => item.product_code === f.code && item.status === "pending",
          )
          .map((item) => [item.branch, item.proposed_price]),
      ).toEqual([["Branch 1", "7.99"]]);
      expect(child.branch_prices?.["Branch 1"]).toBe("3.99");
      expect(child.package_pending_prices?.["Branch 1"]).toBe("4.99");
      expect(child.branch_prices?.["Branch 2"]).toBe("5.99");
      expect(child.package_pending_prices?.["Branch 2"]).toBeUndefined();
    } finally {
      f.repository.dispose();
    }
  });
  it("retains an explicit manual price through real Keep and clears it only after the real Rule decision", async () => {
    const f = await fixture();
    try {
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          savePriceChange(state, actor, {
            product_code: f.code,
            mode: "regular",
            scope: "current",
            branches: ["Branch 1"],
            price: "9.99",
            price_unit: "lb",
            starts_on: "",
            last_day: null,
            accept_below_margin: true,
            below_cost_reason: "Fictional reviewed decision",
            add_labels: false,
          });
        },
      );
      for (const [cost, decision] of [
        ["5.1000", "keep"],
        ["5.3000", "rule"],
      ] as const) {
        const source = (await f.boot()).value;
        await f.repository.runBusinessCommand<DemoState, void>(
          f.identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            const product = state.products.find(
              (item) => item.code === f.code,
            )!;
            const marker = structuredClone(product.manual_prices?.["Branch 1"]);
            saveWeightProductEditor(
              state,
              actor,
              f.code,
              edits(product),
              source.snapshot,
              [],
              { value: cost, unit: "lb" },
            );
            const approval = state.approvals.find(
              (item) =>
                item.product_code === f.code && item.status === "pending",
            )!;
            expect(approval.manual_price_review?.kept_price).toBe("9.99");
            const current = state.products.find(
              (item) => item.code === f.code,
            )!;
            expect(current.branch_prices?.["Branch 1"]).toBe("9.99");
            resolveApproval(
              state,
              actor,
              approval.id,
              "approve",
              "branch",
              "Branch 1",
              undefined,
              undefined,
              decision,
            );
            if (decision === "keep") {
              expect(current.branch_prices?.["Branch 1"]).toBe("9.99");
              expect(current.manual_prices?.["Branch 1"]).toEqual(marker);
            } else {
              expect(current.branch_prices?.["Branch 1"]).toBe("7.99");
              expect(current.manual_prices?.["Branch 1"]).toBeUndefined();
            }
            capturePriceUpdateChanges(before, state, actor);
          },
        );
      }
    } finally {
      f.repository.dispose();
    }
  });
  it("uses genuine ordinary approval and denies Supervisor metadata/cost access", async () => {
    const f = await fixture();
    try {
      const source = (await f.boot()).value,
        prior = await f.read(),
        product = prior.state.products.find((item) => item.code === f.code)!;
      await f.repository.runBusinessCommand<DemoState, void>(
        f.identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          saveWeightProductEditor(
            state,
            actor,
            f.code,
            edits(product),
            source.snapshot,
            [],
            { value: "5.1000", unit: "lb" },
          );
          capturePriceUpdateChanges(before, state, actor);
          const approval = state.approvals.find(
            (item) => item.product_code === f.code && item.status === "pending",
          )!;
          resolveApproval(
            state,
            actor,
            approval.id,
            "approve",
            "branch",
            "Branch 1",
          );
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      expect(
        (await f.read()).state.products.find((item) => item.code === f.code)
          ?.branch_prices?.["Branch 1"],
      ).toBe("7.99");
      const signed = await f.auth.switchDemoUser(f.company, "rh-supervisor");
      const bs = await f.repository.queryBusiness(
        signed.identity,
        (state, actor) =>
          readWeightEditor(state as DemoState, actor, f.code, true),
      );
      expect(bs.value.cost_per_lb).toBeNull();
      expect(JSON.stringify(bs.value)).not.toMatch(
        /manual_costs|package_branch_costs|last_cost_before_tax|receipt_basis/,
      );
      await expect(
        f.repository.queryBusiness(signed.identity, (state, actor) =>
          readWeightEditor(state as DemoState, actor, f.code),
        ),
      ).rejects.toThrow();
      const before = await f.read();
      await expect(
        f.repository.runBusinessCommand<DemoState, void>(
          signed.identity,
          (state, actor) =>
            saveWeightProductEditor(
              state,
              actor,
              f.code,
              edits(product),
              source.snapshot,
              [],
              { value: "1.0000", unit: "lb" },
            ),
        ),
      ).rejects.toThrow();
      expect(await f.read()).toEqual(before);
      const write = await f.repository.runBusinessCommand<DemoState, void>(
        signed.identity,
        (state, actor) => {
          const prior = cloneWithAuthority(state);
          savePackageEditor(
            state,
            actor,
            f.code,
            weightEditorSnapshot(state, actor, f.code, true),
            [packageDraft("500")],
          );
          capturePriceUpdateChanges(prior, state, actor);
        },
      );
      expect(
        write.business.state.products.filter(
          (item) => item.package_of_product_id === f.code,
        ),
      ).toHaveLength(2);
      const views = await f.repository.queryBusiness(
        signed.identity,
        (state, actor) => ({
          products: (state as DemoState).products
            .filter((item) => item.package_of_product_id === f.code)
            .map((item) =>
              projectProductReadDTO(state as DemoState, actor, item as Product),
            ),
          history: selectHistory(state as DemoState, actor),
        }),
      );
      expect(JSON.stringify(views.value)).not.toMatch(
        /manual_costs|package_branch_costs|receipt_basis/,
      );
    } finally {
      f.repository.dispose();
    }
  });
});
