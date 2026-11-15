import { companyLocalToUtc } from "./company-time";
import { browserShellOptions } from "./browser-shell-options";
import type { ReadModelProjectors } from "./e1-read-model";
import { saleStoreDate, saleDateAfter } from "./sales";
import { projectHistoryEntry, selectHistory } from "./history";
import { signedOutReadView } from "./e1-read-model";
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
import {
  createPackageService,
  readWeightPackages,
  previewWeightPackage,
} from "./package-service";
import {
  addWeightPackage,
  packageParentSnapshot,
  syncWeightPackages,
  syncWeightPackagesAtClock,
} from "./weight-packages";
import {
  catalogTestActor,
  foreignCatalogManager,
} from "./catalog-authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import {
  capturePriceUpdateChanges,
  evaluatePriceUpdates,
} from "./price-updates";
import {
  applyApprovedPrice,
  proposeRegularPrice,
  resolveApproval,
} from "./approvals";
import { savePriceChange, endSale, type ChangePriceInput } from "./sales";
import {
  productEditSnapshot,
  saveProductEdits,
  type ProductEdits,
} from "./product-editor";
import { projectProductReadDTO } from "./catalog-read-model";
import { pendingPrice } from "./catalog";
import { lookupBranchCatalog } from "./lookup-branch";
import type { DemoState } from "./types";

function stateFixture() {
  const state = initialState();
  state.approvals = [];
  state.activity = [];
  state.label_waitlist = [];
  state.price_update_tasks = [];
  state.offers = [];
  state.sales = [];
  const parent = {
    ...structuredClone(state.products[0]),
    code: "9100",
    barcode: "FICTIONAL-PARENT-9100",
  };
  state.products.push(parent);
  Object.assign(parent, {
    name_en: "Fictional Ground Coriander",
    name_fa: "گشنیز خیالی",
    sold_by: "weight",
    status: "active",
    pricing_category: "grocery",
    taxable: false,
    last_cost_before_tax: "4.1000",
    selling_price: "8.99",
    branch_prices: { "Branch 1": "8.99", "Branch 2": "9.99" },
    manual_prices: {},
    price_provenance: {},
  });
  return { state, parent };
}
function domainFixture() {
  const { state, parent } = stateFixture();
  const actor = catalogTestActor(state, "manager");
  const before = cloneWithAuthority(state);
  const child = addWeightPackage(state, actor, {
    parent_code: parent.code,
    expected_parent_snapshot: packageParentSnapshot(state, actor, parent.code),
    size: "250",
    unit: "g",
  });
  capturePriceUpdateChanges(before, state, actor);
  return { state, parent, actor, child };
}
async function repositoryFixture() {
  const { state, parent } = stateFixture();
  const repository = new BrowserAuthorityRepository(new IDBFactory());
  await initializeAuthority(repository, {
    state,
    demo_users: configuredDemoPeople(),
    registered_computers: configuredDemoComputers(),
  });
  const authentication = createAuthenticationService({ repository });
  const signed = await authentication.switchDemoUser(
    state.config.company.seed_key,
    "manager",
  );
  const service = createPackageService(repository);
  const snapshot = await service.parentSnapshot(signed.identity, parent.code);
  return {
    repository,
    authentication,
    service,
    identity: signed.identity,
    company: state.config.company.seed_key,
    parentCode: parent.code,
    snapshot,
  };
}
describe("R2e D4 actual derived price effects", () => {
  it("uses accepted branch prices, derives pending without approval, and emits changes once", () => {
    const { state, parent, actor, child } = domainFixture();
    expect(child.branch_prices).toEqual({
      "Branch 1": "5.49",
      "Branch 2": "5.99",
    });
    expect(child.selling_price).toBe("");
    expect(
      state.price_update_tasks?.filter(
        (item) => item.product_code === child.code,
      ),
    ).toHaveLength(2);
    expect(
      state.label_waitlist?.filter((item) => item.product_code === child.code),
    ).toHaveLength(2);
    expect(
      state.approvals.some((item) => item.product_code === child.code),
    ).toBe(false);
    expect(
      state.activity
        .filter(
          (item) =>
            item.product_code === child.code &&
            item.action === "Package price recalculated",
        )
        .every((item) => JSON.stringify(item.after).includes("0.551155 lb ×")),
    ).toBe(true);
    const stable = JSON.stringify({
      tasks: state.price_update_tasks,
      labels: state.label_waitlist,
      activity: state.activity,
    });
    capturePriceUpdateChanges(cloneWithAuthority(state), state, actor);
    expect(
      JSON.stringify({
        tasks: state.price_update_tasks,
        labels: state.label_waitlist,
        activity: state.activity,
      }),
    ).toBe(stable);
    state.approvals.push({
      id: "fictional-pending-parent",
      company_id: parent.company_id,
      branch: "Branch 1",
      product_code: parent.code,
      type: "price_change",
      status: "pending",
      proposed_price: "10.99",
      current_price: "8.99",
    });
    capturePriceUpdateChanges(cloneWithAuthority(state), state, actor);
    expect(pendingPrice(state, child, "Branch 1")).toBe("6.49");
    expect(pendingPrice(state, child, "Branch 2")).toBeNull();
    expect(child.branch_prices?.["Branch 1"]).toBe("5.49");
  });
  it("a genuine parent approval changes only its selected branch and retains child barcode", () => {
    const { state, parent, actor, child } = domainFixture();
    const barcode = child.barcode;
    const oldOther = child.branch_prices?.["Branch 2"];
    const before = cloneWithAuthority(state);
    state.approvals.push({
      id: "fictional-approval",
      company_id: parent.company_id,
      branch: "Branch 1",
      product_code: parent.code,
      type: "price_change",
      status: "pending",
      proposed_price: "10.99",
      current_price: "8.99",
    });
    resolveApproval(
      state,
      actor,
      "fictional-approval",
      "approve",
      "branch",
      "Branch 1",
    );
    capturePriceUpdateChanges(before, state, actor);
    expect(child.branch_prices?.["Branch 1"]).toBe("6.49");
    expect(child.branch_prices?.["Branch 2"]).toBe(oldOther);
    expect(child.barcode).toBe(barcode);
    expect(
      state.label_waitlist?.filter(
        (item) =>
          item.product_code === child.code && item.branch === "Branch 1",
      ),
    ).toHaveLength(1);
    const task = state.price_update_tasks?.find(
      (item) => item.product_code === child.code && item.branch === "Branch 1",
    );
    expect(task?.new_price.price).toBe("6.49");
    expect(task?.steps.length).toBeGreaterThan(1);
  });
  it("manual parent changes and approved sale start/end derive packages in the same command", () => {
    const { state, parent, actor, child } = domainFixture();
    const now = new Date();
    let before = cloneWithAuthority(state);
    applyApprovedPrice(
      state,
      actor,
      parent.code,
      "10.99",
      "branch",
      "Branch 1",
    );
    capturePriceUpdateChanges(before, state, actor, now);
    expect(child.branch_prices?.["Branch 1"]).toBe("6.49");
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: state.config.company.timezone,
    }).format(now);
    const input: ChangePriceInput = {
      product_code: parent.code,
      mode: "sale",
      scope: "current",
      branches: ["Branch 1"],
      price: "7.99",
      price_unit: "lb",
      starts_on: date,
      last_day: null,
      accept_below_margin: true,
      below_cost_reason: "Fictional approved demonstration",
      add_labels: false,
    };
    before = cloneWithAuthority(state);
    const sale = savePriceChange(state, actor, input, now).sales[0];
    capturePriceUpdateChanges(before, state, actor, now);
    expect(
      state.products.find((item) => item.code === child.code)?.branch_prices?.[
        "Branch 1"
      ],
    ).toBe("4.99");
    before = cloneWithAuthority(state);
    endSale(
      state,
      actor,
      sale.id,
      { expected_revision: sale.revision, reason: "Fictional sale finished" },
      now,
    );
    capturePriceUpdateChanges(before, state, actor, now);
    expect(
      state.products.find((item) => item.code === child.code)?.branch_prices?.[
        "Branch 1"
      ],
    ).toBe("6.49");
  });
  it("bare company defaults do not approve package prices at unrelated branches", () => {
    const { state, parent, actor, child } = domainFixture();
    expect(child.branch_prices?.["Branch 3"]).toBeUndefined();
    delete parent.branch_prices?.["Branch 1"];
    syncWeightPackages(state, actor);
    expect(child.branch_prices?.["Branch 1"]).toBeUndefined();
    expect(
      lookupBranchCatalog(state, actor).find((item) => item.code === child.code)
        ?.price,
    ).toBeNull();
  });
  it("does not update archived packages or allow forged authority/system witnesses", () => {
    const { state, parent, actor, child } = domainFixture();
    child.status = "archived";
    const frozen = structuredClone(child);
    parent.branch_prices!["Branch 1"] = "20.99";
    syncWeightPackages(state, actor);
    expect(child).toEqual(frozen);
    expect(() => syncWeightPackages(state, { ...actor })).toThrow();
    expect(() =>
      syncWeightPackagesAtClock(state, {
        kind: "system",
        applied_at: new Date().toISOString(),
        source_event_id: "price_updates",
      }),
    ).toThrow();
    expect(() =>
      readWeightPackages(state, foreignCatalogManager(state), parent.code),
    ).toThrow();
  });
  it("blocks independent child regular prices, approval and inherited metadata edits", () => {
    const { state, actor, child } = domainFixture();
    expect(() =>
      applyApprovedPrice(
        state,
        actor,
        child.code,
        "30.99",
        "branch",
        "Branch 1",
      ),
    ).toThrow();
    expect(() =>
      proposeRegularPrice(state, actor, child.code, "Branch 1", "30.99"),
    ).toThrow();
    const edits: ProductEdits = {
      name_en: child.name_en,
      name_fa: child.name_fa,
      description_en: "",
      description_fa: "",
      unit_size: child.unit_size,
      ai_category: child.ai_category,
      pricing_category: "rice",
      barcode: child.barcode,
      main_supplier: child.main_supplier,
      scope: "all",
      sold_by: "each",
    };
    expect(() =>
      saveProductEdits(
        state,
        actor,
        child.code,
        edits,
        productEditSnapshot(state, actor, child.code),
      ),
    ).toThrow();
    const current = JSON.stringify(child);
    state.approvals.push({
      id: "fictional-invalid-child-approval",
      company_id: child.company_id,
      branch: "Branch 1",
      product_code: child.code,
      type: "price_change",
      status: "pending",
      proposed_price: "30.99",
      current_price: "5.49",
    });
    expect(() =>
      resolveApproval(
        state,
        actor,
        "fictional-invalid-child-approval",
        "approve",
        "branch",
        "Branch 1",
      ),
    ).toThrow();
    expect(JSON.stringify(child)).toBe(current);
  });
  it("public cashier DTOs contain safe fields and only their permitted branch prices", () => {
    const { state, parent, child } = domainFixture();
    const cashier = catalogTestActor(state, "cashier");
    const dto = projectProductReadDTO(state, cashier, child);
    expect(dto.package_of_product_id).toBe(parent.code);
    expect(dto.branch_prices).toEqual({ "Branch 1": "5.49" });
    expect(JSON.stringify(dto)).not.toMatch(
      /last_cost|margin|formula|actor_user|source_invoice/,
    );
    expect(
      JSON.stringify(signedOutReadView(state.config).config),
    ).not.toContain("package_container_cost");
    expect(() =>
      previewWeightPackage(state, cashier, parent.code, "250", "g", "Branch 1"),
    ).toThrow();
  });
});

describe("R2e D5 actual canonical package API", () => {
  it("commits creation, code, prices, labels and price tasks together; invalid writes roll back everything", async () => {
    const fixture = await repositoryFixture();
    const { repository, service, identity, parentCode, snapshot, company } =
      fixture;
    try {
      const saved = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "250",
        unit: "g",
      });
      const after = await repository.loadBusiness<DemoState>(company);
      const child = after.state.products.find(
        (item) => item.code === saved.product_code,
      )!;
      expect(child.branch_prices?.["Branch 1"]).toBe("5.49");
      expect(
        after.state.price_update_tasks?.filter(
          (item) => item.product_code === child.code,
        ),
      ).toHaveLength(2);
      expect(
        after.state.label_waitlist?.filter(
          (item) => item.product_code === child.code,
        ),
      ).toHaveLength(2);
      const raw = JSON.stringify(after);
      await expect(
        service.add(identity, {
          parent_code: parentCode,
          expected_parent_snapshot: snapshot,
          size: "500",
          unit: "g",
          barcode: "9916847256307",
        }),
      ).rejects.toThrow();
      expect(
        JSON.stringify(await repository.loadBusiness<DemoState>(company)),
      ).toBe(raw);
      await expect(
        service.add(identity, {
          parent_code: parentCode,
          expected_parent_snapshot: snapshot,
          size: "250",
          unit: "g",
        }),
      ).rejects.toThrow();
      expect(
        JSON.stringify(await repository.loadBusiness<DemoState>(company)),
      ).toBe(raw);
      await service.archive(
        identity,
        child.code,
        child.package_version!,
        "Fictional discontinued container",
      );
      const next = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "250",
        unit: "g",
      });
      expect(Number(next.product_code)).toBeGreaterThan(Number(child.code));
      expect(
        (await repository.loadBusiness<DemoState>(company)).state.products.find(
          (item) => item.code === child.code,
        )?.status,
      ).toBe("archived");
    } finally {
      repository.dispose();
    }
  });
  it("allows Branch Supervisor package editing while denying general metadata and unauthorized preview locations", async () => {
    const { repository, authentication, service, parentCode, company } =
      await repositoryFixture();
    try {
      const signed = await authentication.switchDemoUser(
        company,
        "rh-supervisor",
      );
      const snapshot = await service.parentSnapshot(
        signed.identity,
        parentCode,
      );
      const added = await service.add(signed.identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "100",
        unit: "g",
      });
      const loaded = (await repository.loadBusiness<DemoState>(company)).state;
      const child = loaded.products.find(
        (item) => item.code === added.product_code,
      )!;
      expect(child.package_of_product_id).toBe(parentCode);
      const preview = await service.preview(
        signed.identity,
        parentCode,
        "250",
        "g",
        "Branch 2",
      );
      expect(preview.price).toBe("5.99");
      expect(preview.cost_before_tax).toBeNull();
      await expect(
        service.preview(signed.identity, parentCode, "250", "g", "Branch 1"),
      ).rejects.toThrow();
      const result = await repository.queryBusiness<DemoState, boolean>(
        signed.identity,
        (state, actor) => {
          expect(() => productEditSnapshot(state, actor, parentCode)).toThrow();
          return true;
        },
      );
      expect(result.value).toBe(true);
    } finally {
      repository.dispose();
    }
  });
  it.each(["cashier", "ny-floor"])(
    "denies %s writes, preserves their safe reads, and rejects cross-company identity",
    async (username) => {
      const {
        repository,
        authentication,
        service,
        parentCode,
        snapshot,
        company,
        identity,
      } = await repositoryFixture();
      try {
        await service.add(identity, {
          parent_code: parentCode,
          expected_parent_snapshot: snapshot,
          size: "250",
          unit: "g",
        });
        const signed = await authentication.switchDemoUser(company, username);
        expect(await service.list(signed.identity, parentCode)).toHaveLength(1);
        const before = JSON.stringify(
          await repository.loadBusiness<DemoState>(company),
        );
        await expect(
          service.add(signed.identity, {
            parent_code: parentCode,
            expected_parent_snapshot: snapshot,
            size: "500",
            unit: "g",
          }),
        ).rejects.toThrow();
        expect(
          JSON.stringify(await repository.loadBusiness<DemoState>(company)),
        ).toBe(before);
        await expect(
          service.list(
            { ...signed.identity, company_id: "fictional-other-company" },
            parentCode,
          ),
        ).rejects.toThrow();
      } finally {
        repository.dispose();
      }
    },
  );
  it("clock reconciliation is durable and idempotent through the actual system witness", async () => {
    const { repository, service, identity, parentCode, snapshot, company } =
      await repositoryFixture();
    try {
      const added = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "1",
        unit: "lb",
      });
      await repository.runBusinessCommand<DemoState, void>(
        identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          applyApprovedPrice(
            state,
            actor,
            parentCode,
            "10.99",
            "branch",
            "Branch 1",
          );
          capturePriceUpdateChanges(before, state, actor);
        },
      );
      await repository.runSystemReconciliation<DemoState, void>(
        company,
        "price_updates",
        evaluatePriceUpdates,
      );
      const after = (await repository.loadBusiness<DemoState>(company)).state;
      expect(
        after.products.find((item) => item.code === added.product_code)
          ?.branch_prices?.["Branch 1"],
      ).toBe("11.49");
      const stable = JSON.stringify({
        tasks: after.price_update_tasks,
        labels: after.label_waitlist,
        activity: after.activity,
      });
      await repository.runSystemReconciliation<DemoState, void>(
        company,
        "price_updates",
        evaluatePriceUpdates,
      );
      const next = (await repository.loadBusiness<DemoState>(company)).state;
      expect(
        JSON.stringify({
          tasks: next.price_update_tasks,
          labels: next.label_waitlist,
          activity: next.activity,
        }),
      ).toBe(stable);
    } finally {
      repository.dispose();
    }
  });
});

describe("R2e D6 protected transaction edge proofs", () => {
  it("rolls a failed parent cascade back and retries a complete parent write without duplicate child effects", async () => {
    const { repository, service, identity, parentCode, snapshot, company } =
      await repositoryFixture();
    try {
      const added = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "250",
        unit: "g",
      });
      const prior = JSON.stringify(
        await repository.loadBusiness<DemoState>(company),
      );
      await expect(
        repository.runBusinessCommand<DemoState, void>(
          identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            applyApprovedPrice(
              state,
              actor,
              parentCode,
              "20.99",
              "branch",
              "Branch 1",
            );
            state.config.weighed_items!.package_container_fee = "invalid";
            capturePriceUpdateChanges(before, state, actor);
          },
        ),
      ).rejects.toThrow();
      expect(
        JSON.stringify(await repository.loadBusiness<DemoState>(company)),
      ).toBe(prior);
      const write = () =>
        repository.runBusinessCommand<DemoState, void>(
          identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            applyApprovedPrice(
              state,
              actor,
              parentCode,
              "20.99",
              "branch",
              "Branch 1",
            );
            capturePriceUpdateChanges(before, state, actor);
          },
        );
      await write();
      let state = (await repository.loadBusiness<DemoState>(company)).state;
      const child = state.products.find(
        (item) => item.code === added.product_code,
      )!;
      expect(child.branch_prices).toEqual({
        "Branch 1": "11.99",
        "Branch 2": "5.99",
      });
      const actual = () =>
        JSON.stringify({
          tasks: state.price_update_tasks?.filter(
            (item) => item.product_code === added.product_code,
          ),
          labels: state.label_waitlist?.filter(
            (item) => item.product_code === added.product_code,
          ),
          audit: state.activity.filter(
            (item) => item.product_code === added.product_code,
          ),
        });
      const stable = actual();
      await write();
      state = (await repository.loadBusiness<DemoState>(company)).state;
      expect(actual()).toBe(stable);
    } finally {
      repository.dispose();
    }
  });
  it("configured fee and prefix apply to actual child writes, archived manufacturer barcodes cannot be reused", async () => {
    const { repository, service, identity, parentCode, snapshot, company } =
      await repositoryFixture();
    try {
      await repository.runBusinessCommand<DemoState, void>(
        identity,
        (state) => {
          state.config.weighed_items!.package_container_fee = "1.49";
          state.config.weighed_items!.package_barcode_prefix = "29";
        },
      );
      const generated = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "250",
        unit: "g",
      });
      let state = (await repository.loadBusiness<DemoState>(company)).state;
      const child = state.products.find(
        (item) => item.code === generated.product_code,
      )!;
      expect(child.barcode).toMatch(/^29\d{11}$/);
      expect(child.branch_prices?.["Branch 1"]).toBe("6.49");
      const maker = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "500",
        unit: "g",
        barcode: "9916847256306",
      });
      state = (await repository.loadBusiness<DemoState>(company)).state;
      const manual = state.products.find(
        (item) => item.code === maker.product_code,
      )!;
      expect(manual.package_barcode_generated).toBe(false);
      const upc = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "2",
        unit: "lb",
        barcode: "092835716409",
      });
      expect(
        (await repository.loadBusiness<DemoState>(company)).state.products.find(
          (item) => item.code === upc.product_code,
        )?.barcode,
      ).toBe("092835716409");
      await expect(
        service.add(identity, {
          parent_code: parentCode,
          expected_parent_snapshot: snapshot,
          size: "3",
          unit: "lb",
          barcode: "0092835716409",
        }),
      ).rejects.toThrow();
      await service.archive(
        identity,
        manual.code,
        manual.package_version!,
        "Fictional size withdrawn",
      );
      const prior = JSON.stringify(
        await repository.loadBusiness<DemoState>(company),
      );
      await expect(
        service.add(identity, {
          parent_code: parentCode,
          expected_parent_snapshot: snapshot,
          size: "1",
          unit: "lb",
          barcode: "9916847256306",
        }),
      ).rejects.toThrow();
      expect(
        JSON.stringify(await repository.loadBusiness<DemoState>(company)),
      ).toBe(prior);
    } finally {
      repository.dispose();
    }
  });
  it("versioned edit changes real size and names; stale edits, orphaning and forged child price writes fail atomically", async () => {
    const { repository, service, identity, parentCode, snapshot, company } =
      await repositoryFixture();
    try {
      const added = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "250",
        unit: "g",
      });
      const original = (
        await repository.loadBusiness<DemoState>(company)
      ).state.products.find((item) => item.code === added.product_code)!;
      const edits = {
        expected_version: original.package_version!,
        size: "500",
        unit: "g" as const,
        barcode: original.barcode,
        name_en: "Fictional Family Coriander",
        name_fa: "گشنیز خانوادگی خیالی",
      };
      await service.edit(identity, original.code, edits);
      const changed = await repository.loadBusiness<DemoState>(company);
      expect(
        changed.state.products.find((item) => item.code === original.code),
      ).toMatchObject({
        package_size: "500",
        package_version: 2,
        name_en: edits.name_en,
        branch_prices: { "Branch 1": "10.49" },
      });
      await expect(
        service.edit(identity, original.code, edits),
      ).rejects.toThrow();
      expect(await repository.loadBusiness<DemoState>(company)).toEqual(
        changed,
      );
      await expect(
        repository.runBusinessCommand<DemoState, void>(
          identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            state.products.find((item) => item.code === parentCode)!.status =
              "archived";
            capturePriceUpdateChanges(before, state, actor);
          },
        ),
      ).rejects.toThrow();
      expect(await repository.loadBusiness<DemoState>(company)).toEqual(
        changed,
      );
      await expect(
        repository.runBusinessCommand<DemoState, void>(
          identity,
          (state, actor) => {
            savePriceChange(state, actor, {
              product_code: original.code,
              mode: "regular",
              scope: "current",
              branches: ["Branch 1"],
              price: "30.99",
              price_unit: "each",
              starts_on: "",
              last_day: null,
              accept_below_margin: true,
              below_cost_reason: "Fictional forbidden child override",
              add_labels: false,
            });
          },
        ),
      ).rejects.toThrow();
      expect(await repository.loadBusiness<DemoState>(company)).toEqual(
        changed,
      );
    } finally {
      repository.dispose();
    }
  });
  it("does not project another company's linked child even when parent codes coincide", () => {
    const { state, actor, parent, child } = domainFixture();
    state.products.push({
      ...structuredClone(child),
      company_id: "fictional-other-company",
      code: "9998",
      barcode: "2000000099983",
    });
    expect(
      readWeightPackages(state, actor, parent.code).map((item) => item.code),
    ).toEqual([child.code]);
  });
});

describe("R2e package cost audit privacy", () => {
  it("audits changed derived cost even when price is unchanged, with private cost basis hidden from Supervisor history", () => {
    const { state, parent } = stateFixture();
    const actor = catalogTestActor(state, "branch_supervisor", "Branch 2");
    const before = cloneWithAuthority(state);
    const child = addWeightPackage(state, actor, {
      parent_code: parent.code,
      expected_parent_snapshot: packageParentSnapshot(
        state,
        actor,
        parent.code,
      ),
      size: "250",
      unit: "g",
    });
    capturePriceUpdateChanges(before, state, actor);
    const event = state.activity.find(
      (item) =>
        item.product_code === child.code &&
        item.action === "Package cost recalculated",
    )!;
    expect(event.after).toMatchObject({
      unit_cost_before_tax: "2.2597",
      package_cost_basis: { parent_cost_per_lb: "4.1000" },
    });
    expect(() => projectHistoryEntry(state, actor, event)).toThrow();
    expect(JSON.stringify(selectHistory(state, actor))).not.toMatch(
      /unit_cost|package_cost_basis|parent_cost_per_lb|container_cost|4\.1000|2\.2597/,
    );
    const previousPrice = child.branch_prices?.["Branch 2"];
    parent.last_cost_before_tax = "4.2000";
    const prior = cloneWithAuthority(state);
    capturePriceUpdateChanges(prior, state, actor);
    expect(child.branch_prices?.["Branch 2"]).toBe(previousPrice);
    expect(child.last_cost_before_tax).toBe("2.3149");
    expect(
      state.activity.filter(
        (item) =>
          item.product_code === child.code &&
          item.action === "Package cost recalculated" &&
          item.branch === "all",
      ),
    ).toHaveLength(2);
  });
});

describe("R2e package effects share the installed sales-clock write", () => {
  it("scheduled start and expiry commit the parent event, child prices/tasks/labels/audit atomically", async () => {
    const { repository, service, identity, parentCode, snapshot, company } =
      await repositoryFixture();
    try {
      const added = await service.add(identity, {
        parent_code: parentCode,
        expected_parent_snapshot: snapshot,
        size: "250",
        unit: "g",
      });
      const now = new Date();
      const loaded = (await repository.loadBusiness<DemoState>(company)).state;
      const today = saleStoreDate(loaded.config, "Branch 1", now);
      const startsOn = saleDateAfter(today, 1);
      const lastDay = saleDateAfter(today, 2);
      await repository.runBusinessCommand<DemoState, void>(
        identity,
        (state, actor) => {
          const before = cloneWithAuthority(state);
          savePriceChange(
            state,
            actor,
            {
              product_code: parentCode,
              mode: "sale",
              scope: "current",
              branches: ["Branch 1"],
              price: "7.99",
              price_unit: "lb",
              starts_on: startsOn,
              last_day: lastDay,
              accept_below_margin: true,
              below_cost_reason: "Fictional scheduled bulk sale",
              add_labels: false,
            },
            now,
          );
          capturePriceUpdateChanges(before, state, actor, now);
        },
      );
      const job = browserShellOptions(
        {} as ReadModelProjectors,
      ).systemJobs.find((item) => item.source === "sales_clock")!;
      const startClock = new Date(
        companyLocalToUtc(loaded.config, startsOn, "12:00"),
      );
      await repository.runSystemReconciliation<DemoState, void>(
        company,
        "sales_clock",
        job.apply,
        startClock,
      );
      const started = (await repository.loadBusiness<DemoState>(company)).state;
      expect(
        started.sale_events?.some(
          (item) => item.product_code === parentCode && item.kind === "started",
        ),
      ).toBe(true);
      expect(
        started.products.find((item) => item.code === added.product_code)
          ?.branch_prices?.["Branch 1"],
      ).toBe("4.99");
      expect(
        started.price_update_tasks?.find(
          (item) =>
            item.product_code === added.product_code &&
            item.branch === "Branch 1",
        )?.new_price.price,
      ).toBe("4.99");
      expect(
        started.label_waitlist?.filter(
          (item) =>
            item.product_code === added.product_code &&
            item.branch === "Branch 1",
        ),
      ).toHaveLength(1);
      const endClock = new Date(
        companyLocalToUtc(loaded.config, saleDateAfter(lastDay, 1), "12:00"),
      );
      await repository.runSystemReconciliation<DemoState, void>(
        company,
        "sales_clock",
        job.apply,
        endClock,
      );
      const ended = (await repository.loadBusiness<DemoState>(company)).state;
      expect(
        ended.sale_events?.some(
          (item) => item.product_code === parentCode && item.kind === "ended",
        ),
      ).toBe(true);
      expect(
        ended.products.find((item) => item.code === added.product_code)
          ?.branch_prices?.["Branch 1"],
      ).toBe("5.49");
      expect(
        ended.price_update_tasks?.find(
          (item) =>
            item.product_code === added.product_code &&
            item.branch === "Branch 1",
        )?.new_price.price,
      ).toBe("5.49");
      const stable = JSON.stringify({
        child: ended.products.find((item) => item.code === added.product_code),
        tasks: ended.price_update_tasks,
        labels: ended.label_waitlist,
        audit: ended.activity,
      });
      await repository.runSystemReconciliation<DemoState, void>(
        company,
        "sales_clock",
        job.apply,
        endClock,
      );
      const repeated = (await repository.loadBusiness<DemoState>(company))
        .state;
      expect(
        JSON.stringify({
          child: repeated.products.find(
            (item) => item.code === added.product_code,
          ),
          tasks: repeated.price_update_tasks,
          labels: repeated.label_waitlist,
          audit: repeated.activity,
        }),
      ).toBe(stable);
    } finally {
      repository.dispose();
    }
  });
});

describe("R2e packages retain the normal approved-sale decision workflow", () => {
  it.each(["end", "change", "keep"] as const)(
    "parent reduction creates one actual child conflict and a genuine Manager can %s it",
    async (decision) => {
      const { repository, service, identity, parentCode, snapshot, company } =
        await repositoryFixture();
      try {
        const { decideSaleCostAlert, migrateSalePriceInvariants } =
          await import("./sales");
        const added = await service.add(identity, {
          parent_code: parentCode,
          expected_parent_snapshot: snapshot,
          size: "250",
          unit: "g",
        });
        const now = new Date();
        const source = (await repository.loadBusiness<DemoState>(company))
          .state;
        const today = saleStoreDate(source.config, "Branch 1", now);
        await repository.runBusinessCommand<DemoState, void>(
          identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            savePriceChange(
              state,
              actor,
              {
                product_code: added.product_code,
                mode: "sale",
                scope: "current",
                branches: ["Branch 1"],
                price: "4.99",
                price_unit: "each",
                starts_on: today,
                last_day: null,
                accept_below_margin: true,
                below_cost_reason: "Fictional package sale",
                add_labels: false,
              },
              now,
            );
            capturePriceUpdateChanges(before, state, actor, now);
          },
        );
        const changeParent = () =>
          repository.runBusinessCommand<DemoState, void>(
            identity,
            (state, actor) => {
              const before = cloneWithAuthority(state);
              applyApprovedPrice(
                state,
                actor,
                parentCode,
                "5.99",
                "branch",
                "Branch 1",
              );
              capturePriceUpdateChanges(before, state, actor, now);
            },
          );
        await changeParent();
        let actual = (await repository.loadBusiness<DemoState>(company)).state;
        const child = actual.products.find(
          (item) => item.code === added.product_code,
        )!;
        expect(child.branch_prices?.["Branch 1"]).toBe("3.99");
        const conflict = actual.alerts.find(
          (item) =>
            item.product_code === child.code &&
            item.type === "sale_regular_not_above_sale",
        )!;
        expect(conflict).toMatchObject({
          package_parent_product_code: parentCode,
          status: "pending",
          sale_price: "4.99",
          proposed_regular_price: "3.99",
        });
        expect(conflict.invoice_id).toBeUndefined();
        await changeParent();
        actual = (await repository.loadBusiness<DemoState>(company)).state;
        expect(
          actual.alerts.filter(
            (item) =>
              item.product_code === child.code &&
              item.type === "sale_regular_not_above_sale",
          ),
        ).toHaveLength(1);
        await migrateSalePriceInvariants(repository, company);
        actual = (await repository.loadBusiness<DemoState>(company)).state;
        expect(
          actual.sales?.find((item) => item.id === conflict.sale_id)?.status,
        ).toBe("active");
        await repository.runBusinessCommand<DemoState, void>(
          identity,
          (state, actor) => {
            const before = cloneWithAuthority(state);
            const sale = state.sales!.find(
              (item) => item.id === conflict.sale_id,
            )!;
            decideSaleCostAlert(
              state,
              actor,
              conflict.id,
              {
                decision,
                expected_sale_revision: sale.revision,
                reason: "Fictional package sale review",
                ...(decision === "change"
                  ? {
                      input: {
                        product_code: child.code,
                        mode: "sale" as const,
                        scope: "current" as const,
                        branches: ["Branch 1"],
                        price: "3.49",
                        price_unit: "each" as const,
                        starts_on: today,
                        last_day: null,
                        accept_below_margin: true,
                        below_cost_reason: "Fictional revised sale",
                        add_labels: false,
                      },
                    }
                  : {}),
              },
              now,
            );
            capturePriceUpdateChanges(before, state, actor, now);
          },
        );
        await migrateSalePriceInvariants(repository, company);
        actual = (await repository.loadBusiness<DemoState>(company)).state;
        expect(
          actual.alerts.find((item) => item.id === conflict.id),
        ).toMatchObject({ status: "resolved", sale_decision: decision });
        const { effectivePrice } = await import("./catalog");
        expect(effectivePrice(actual, child.code, "Branch 1", now)).toBe(
          decision === "end" ? "3.99" : decision === "change" ? "3.49" : "4.99",
        );
        expect(
          actual.sales?.find((item) => item.id === conflict.sale_id)?.status,
        ).toBe(decision === "end" ? "ended" : "active");
      } finally {
        repository.dispose();
      }
    },
  );
});
