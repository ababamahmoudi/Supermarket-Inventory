import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  BrowserAuthorityRepository,
  AUTHORITY_DATABASE_NAME,
} from "./authority-repository";
import { initializeAuthority } from "./authority-initialization";
import {
  configuredDemoPeople,
  configuredDemoComputers,
} from "./e1-seed-fixtures";
import { initialState } from "./e1-bootstrap";
import { migratePackageState } from "./package-state";
import { sha256Bytes } from "./sha256";
import type { DemoState } from "./types";

function oldState() {
  const state = initialState();
  delete state.prototype_r2e_package_schema;
  delete state.config.weighed_items!.package_container_fee;
  delete state.config.weighed_items!.package_container_cost;
  delete state.config.weighed_items!.package_barcode_prefix;
  delete state.config.weighed_items!.ounces_per_lb;
  return state;
}
async function fixture(state = oldState()) {
  const factory = new IDBFactory();
  const repository = new BrowserAuthorityRepository(factory);
  await initializeAuthority(repository, {
    state,
    demo_users: configuredDemoPeople(),
    registered_computers: configuredDemoComputers(),
  });
  return { factory, repository, company: state.config.company.seed_key };
}
async function rawStore(factory: IDBFactory, store: string) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      const request = database
        .transaction(store, "readonly")
        .objectStore(store)
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
describe("R2e D verified additive package migration", () => {
  it("backs up exact restorable state before defaults; preserves every product and authority credential byte", async () => {
    const { factory, repository, company } = await fixture();
    try {
      const prior = await repository.loadBusiness<DemoState>(company);
      const authority = await rawStore(factory, "companies");
      await migratePackageState(repository, company);
      const after = await repository.loadBusiness<DemoState>(company);
      expect(after.state.prototype_r2e_package_schema).toBe(1);
      expect(after.state.config.weighed_items).toMatchObject({
        package_container_fee: "0.49",
        package_container_cost: "0.00",
        package_barcode_prefix: "20",
        ounces_per_lb: "16",
      });
      for (const key of Object.keys(prior.state).filter(
        (key) => !["config", "prototype_r2e_package_schema"].includes(key),
      ) as (keyof DemoState)[])
        expect(after.state[key]).toEqual(prior.state[key]);
      expect(await rawStore(factory, "companies")).toEqual(authority);
      const backup = (
        (await rawStore(factory, "private_backups")) as {
          raw: string;
          sha256: string;
          source_key: string;
        }[]
      ).find((item) => item.raw === JSON.stringify(prior.state))!;
      expect(backup).toBeDefined();
      expect(backup.sha256).toBe(
        sha256Bytes(new TextEncoder().encode(backup.raw)),
      );
      expect(backup.source_key).toContain(`revision:${prior.revision}`);
      const restored = await fixture(JSON.parse(backup.raw));
      try {
        expect(
          (await restored.repository.loadBusiness<DemoState>(company)).state,
        ).toEqual(prior.state);
      } finally {
        restored.repository.dispose();
      }
      await migratePackageState(repository, company);
      expect((await repository.loadBusiness<DemoState>(company)).revision).toBe(
        after.revision,
      );
    } finally {
      repository.dispose();
    }
  });
  it("retains custom fees, costs, prefix and factor without adding packages", async () => {
    const old = oldState();
    Object.assign(old.config.weighed_items!, {
      package_container_fee: "0.79",
      package_container_cost: "0.1200",
      package_barcode_prefix: "29",
      conversion_factor: "3",
      ounces_per_lb: "20",
    });
    const { repository, company } = await fixture(old);
    try {
      await migratePackageState(repository, company);
      const after = (await repository.loadBusiness<DemoState>(company)).state;
      expect(after.config.weighed_items).toEqual(old.config.weighed_items);
      expect(after.products).toEqual(old.products);
    } finally {
      repository.dispose();
    }
  });
  it("writes no defaults when backup verification fails", async () => {
    const { repository, company } = await fixture();
    try {
      const prior = await repository.loadBusiness<DemoState>(company);
      vi.spyOn(repository, "archivePrivateBackup").mockRejectedValue(
        new Error("fictional verification failure"),
      );
      await expect(migratePackageState(repository, company)).rejects.toThrow(
        "fictional verification failure",
      );
      expect(await repository.loadBusiness<DemoState>(company)).toEqual(prior);
    } finally {
      repository.dispose();
    }
  });
  it("re-backs up a newer revision rather than upgrading stale bytes", async () => {
    const { repository, company } = await fixture();
    try {
      const archive = repository.archivePrivateBackup.bind(repository);
      let raced = false;
      vi.spyOn(repository, "archivePrivateBackup").mockImplementation(
        async (...args) => {
          await archive(...args);
          if (!raced) {
            raced = true;
            await repository.runSystemReconciliation<DemoState, void>(
              company,
              "packages_migration",
              (state) => {
                state.products[0].description_en =
                  "Fictional concurrent edit retained";
              },
            );
          }
        },
      );
      await migratePackageState(repository, company);
      const after = (await repository.loadBusiness<DemoState>(company)).state;
      expect(after.products[0].description_en).toBe(
        "Fictional concurrent edit retained",
      );
      expect(after.prototype_r2e_package_schema).toBe(1);
      expect(repository.archivePrivateBackup).toHaveBeenCalledTimes(2);
    } finally {
      repository.dispose();
    }
  });
});
