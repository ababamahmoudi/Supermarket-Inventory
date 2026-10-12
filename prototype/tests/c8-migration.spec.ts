import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  decodeHistoryStorage,
  encodeHistoryStorage,
} from "../src/history-storage";
import type { DemoState } from "../src/types";
import { invoiceImage, setBranch, signIn } from "./helpers";

const mainKey = "supermarket-prototype-v1";
const databaseName = "supermarket-prototype-files-v1";
const recoveryKey = "c8-migration-proof-allow-backup";
const digest = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");

interface MigrationEvent {
  kind:
    "backup-read" | "backup-text" | "backup-hash" | "backup-failed" | "publish";
  reference?: string;
  exists?: boolean;
  raw?: string;
  sha256?: string;
  schema?: number;
}
interface MigrationProbe {
  events: MigrationEvent[];
}
type ProofWindow = Window & { __c8MigrationProof?: MigrationProbe };

async function savedRaw(page: Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), mainKey);
  expect(raw, "The real durable snapshot must exist").not.toBeNull();
  return raw!;
}
async function saved(page: Page) {
  return decodeHistoryStorage(JSON.parse(await savedRaw(page))) as DemoState;
}

async function readBackup(page: Page, reference: string) {
  return page.evaluate(
    async ({ databaseName, reference }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const record = await new Promise<
          | {
              reference: string;
              company_id: string;
              storage_key: string;
              sha256: string;
              raw: Blob;
            }
          | undefined
        >((resolve, reject) => {
          const request = database
            .transaction("backups", "readonly")
            .objectStore("backups")
            .get(reference);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (!record) return null;
        return {
          reference: record.reference,
          company_id: record.company_id,
          storage_key: record.storage_key,
          sha256: record.sha256,
          raw: await record.raw.text(),
          bytes: record.raw.size,
        };
      } finally {
        database.close();
      }
    },
    { databaseName, reference },
  );
}

async function readOriginal(page: Page, reference: string) {
  return page.evaluate(
    async ({ databaseName, reference }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const record = await new Promise<{
          reference: string;
          company_id: string;
          source: Blob;
          source_size: number;
          sha256: string;
          name: string;
        }>((resolve, reject) => {
          const request = database
            .transaction("files", "readonly")
            .objectStore("files")
            .get(reference);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (!record) throw new Error("The uploaded original must be retained.");
        const bytes = new Uint8Array(await record.source.arrayBuffer());
        return {
          reference: record.reference,
          company_id: record.company_id,
          recorded_hash: record.sha256,
          source_size: record.source_size,
          actual_size: record.source.size,
          name: record.name,
          base64: btoa(
            Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
          ),
        };
      } finally {
        database.close();
      }
    },
    { databaseName, reference },
  );
}

async function prepareRetainedState(page: Page) {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  // Keep the actual seeded local calendar day stable across migration/reload.
  // Timers still run; this does not fabricate any business record.
  await page.clock.setFixedTime(
    new Date(await page.evaluate(() => Date.now())),
  );
  await page.goto("/#settings?group=company");
  await page
    .getByLabel("Name (English)", { exact: true })
    .fill("C8 Saved Market");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).config.company.name_en)
    .toBe("C8 Saved Market");

  await page.goto("/#product?code=0004");
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const dialog = page.locator(".change-price-dialog[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /^New regular price/ }).click();
  await dialog.getByLabel("Price", { exact: true }).fill("8.79");
  await dialog
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () =>
        (await saved(page)).products.find((product) => product.code === "0004")
          ?.manual_prices?.all.price,
    )
    .toBe("8.79");

  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  const sourceHash = digest(invoiceImage.buffer);
  await expect
    .poll(async () => (await saved(page)).invoice.file_data)
    .toBe(`idb-file:v1:super-arzon:${sourceHash}`);
  const image = page.getByRole("img", {
    name: "Original invoice image",
    exact: true,
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(1);
  await expect(
    page.getByText(/Browser storage is full or disabled/),
  ).toHaveCount(0);

  const originalRaw = await savedRaw(page);
  const state = decodeHistoryStorage(JSON.parse(originalRaw)) as DemoState;
  expect(state.prototype_c6_schema).toBe(1);
  expect(state.prototype_c8_schema).toBe(1);
  expect(state.config.company.name_en).toBe("C8 Saved Market");
  expect(
    state.products.find((product) => product.code === "0004")?.manual_prices
      ?.all.price,
  ).toBe("8.79");
  expect(state.activity.some((entry) => entry.entity_id === "company")).toBe(
    true,
  );
  expect(
    state.activity.some(
      (entry) =>
        entry.action === "Set regular price" && entry.entity_id === "0004",
    ),
  ).toBe(true);
  expect(state.invoice.entry_mode).toBe("manual");
  expect(state.invoice.file_name).toBe(invoiceImage.name);
  const original = await readOriginal(page, state.invoice.file_data!);
  expect(original.company_id).toBe(state.config.company.seed_key);
  expect(original.recorded_hash).toBe(sourceHash);
  expect(original.source_size).toBe(invoiceImage.buffer.length);
  expect(original.actual_size).toBe(invoiceImage.buffer.length);
  expect(Buffer.from(original.base64, "base64")).toEqual(invoiceImage.buffer);
  return { originalRaw, state, original, sourceHash };
}

async function prepareSchemaBoundary(page: Page, state: DemoState) {
  // Honest C8-shaped missing-schema boundary, not an archived historical C7
  // snapshot. Remove only the marker; preserve every existing business field.
  const boundary = structuredClone(state);
  delete boundary.prototype_c8_schema;
  const raw = JSON.stringify(encodeHistoryStorage(boundary));
  const sha256 = digest(raw);
  const reference = `idb-backup:v1:${encodeURIComponent(state.config.company.seed_key)}:${encodeURIComponent(mainKey)}:${sha256}`;
  expect(await readBackup(page, reference)).toBeNull();
  const written = await page.evaluate(
    ({ mainKey, raw }) => {
      localStorage.setItem(mainKey, raw);
      return localStorage.getItem(mainKey);
    },
    { mainKey, raw },
  );
  expect(written).toBe(raw);
  expect(decodeHistoryStorage(JSON.parse(raw))).toEqual(boundary);
  return { raw, sha256, reference };
}

async function observeMigration(
  page: Page,
  reference: string,
  failBackup = false,
) {
  await page.addInitScript(
    ({ mainKey, databaseName, reference, failBackup, recoveryKey }) => {
      const proof: MigrationProbe = { events: [] };
      (window as ProofWindow).__c8MigrationProof = proof;
      const retainedBackupBlobs = new WeakSet<Blob>();
      const originalGet = IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.get = function (key) {
        const request = originalGet.call(this, key);
        if (
          this.transaction.db.name === databaseName &&
          this.name === "backups" &&
          key === reference
        )
          request.addEventListener("success", () => {
            const record = request.result;
            proof.events.push({
              kind: "backup-read",
              reference,
              exists: Boolean(record),
            });
            if (record?.raw instanceof Blob)
              retainedBackupBlobs.add(record.raw);
          });
        return request;
      };
      const originalText = Blob.prototype.text;
      Blob.prototype.text = async function () {
        const raw = await originalText.call(this);
        if (retainedBackupBlobs.has(this))
          proof.events.push({ kind: "backup-text", reference, raw });
        return raw;
      };
      const originalBytes = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = async function () {
        const bytes = await originalBytes.call(this);
        if (retainedBackupBlobs.has(this)) {
          const hash = await crypto.subtle.digest("SHA-256", bytes);
          const sha256 = Array.from(new Uint8Array(hash), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          proof.events.push({ kind: "backup-hash", reference, sha256 });
        }
        return bytes;
      };
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (
        value: unknown,
        key?: IDBValidKey,
      ) {
        if (
          failBackup &&
          sessionStorage.getItem(recoveryKey) !== "yes" &&
          this.transaction.db.name === databaseName &&
          this.name === "backups" &&
          value !== null &&
          typeof value === "object" &&
          "reference" in value &&
          value.reference === reference
        ) {
          proof.events.push({ kind: "backup-failed", reference });
          throw new DOMException(
            "C8 proof: backup write quota exhausted",
            "QuotaExceededError",
          );
        }
        return originalPut.call(this, value, key);
      };
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        originalSet.call(this, key, value);
        if (this === localStorage && key === mainKey)
          proof.events.push({
            kind: "publish",
            schema: JSON.parse(value).prototype_c8_schema,
          });
      };
    },
    { mainKey, databaseName, reference, failBackup, recoveryKey },
  );
}

async function migrationEvents(page: Page) {
  return page.evaluate(
    () => (window as ProofWindow).__c8MigrationProof?.events ?? [],
  );
}
async function assertVerifiedBeforePublish(
  page: Page,
  boundary: Awaited<ReturnType<typeof prepareSchemaBoundary>>,
) {
  const events = await migrationEvents(page);
  const publishedAt = events.findIndex((event) => event.kind === "publish");
  expect(
    publishedAt,
    "Migration must publish its durable replacement",
  ).toBeGreaterThan(-1);
  const beforePublish = events.slice(0, publishedAt);
  expect(beforePublish).toContainEqual({
    kind: "backup-read",
    reference: boundary.reference,
    exists: true,
  });
  expect(beforePublish).toContainEqual({
    kind: "backup-text",
    reference: boundary.reference,
    raw: boundary.raw,
  });
  expect(beforePublish).toContainEqual({
    kind: "backup-hash",
    reference: boundary.reference,
    sha256: boundary.sha256,
  });
  expect(events[publishedAt].schema).toBe(1);
  const backup = await readBackup(page, boundary.reference);
  expect(backup).toEqual({
    reference: boundary.reference,
    company_id: "super-arzon",
    storage_key: mainKey,
    sha256: boundary.sha256,
    raw: boundary.raw,
    bytes: Buffer.byteLength(boundary.raw),
  });
  expect(digest(backup!.raw)).toBe(backup!.sha256);
  return { events, backup };
}

test("C8 schema-only boundary preserves real saved settings, manual prices, all records and original bytes after verified exact backup", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const prepared = await prepareRetainedState(page);
  const boundary = await prepareSchemaBoundary(page, prepared.state);
  await observeMigration(page, boundary.reference);
  await page.reload();
  await expect
    .poll(async () => (await saved(page)).prototype_c8_schema)
    .toBe(1);
  const proof = await assertVerifiedBeforePublish(page, boundary);
  expect(
    await saved(page),
    "Every decoded saved field must survive the additive boundary",
  ).toEqual(prepared.state);
  expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
    prepared.original,
  );
  await expect(
    page.getByRole("img", { name: "Original invoice image", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Browser storage is full or disabled/),
  ).toHaveCount(0);
  await page.reload();
  await expect.poll(async () => await saved(page)).toEqual(prepared.state);
  expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
    prepared.original,
  );
  expect(
    (await migrationEvents(page)).filter((event) =>
      event.kind.startsWith("backup-"),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
  await testInfo.attach("c8-schema-only-migration-proof.json", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          fixture:
            "Real C8 UI state with only prototype_c8_schema removed; not an archived C7 snapshot",
          saved_sha256_before: digest(prepared.originalRaw),
          exact_boundary_backup_sha256: boundary.sha256,
          source_sha256: prepared.sourceHash,
          retained_activity_count: prepared.state.activity.length,
          sale_ids: prepared.state.sales?.map((sale) => sale.id),
          sale_request_ids: prepared.state.sale_requests?.map(
            (request) => request.id,
          ),
          every_decoded_field_preserved: true,
          backup_verified_before_publish: true,
          repeated_load_idempotent: true,
          events: proof.events.map(({ raw, ...event }) => ({
            ...event,
            ...(raw === undefined ? {} : { raw_sha256: digest(raw) }),
          })),
        },
        null,
        2,
      ),
    ),
  });
});

test("C8 backup write failure blocks schema replacement and retains exact state and originals until recovery", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const prepared = await prepareRetainedState(page);
  const boundary = await prepareSchemaBoundary(page, prepared.state);
  await observeMigration(page, boundary.reference, true);
  await page.reload();
  await expect(
    page.getByText(/Browser storage is full or disabled/),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await migrationEvents(page)).filter(
          (event) => event.kind === "backup-failed",
        ).length,
    )
    .toBeGreaterThan(0);
  expect(await savedRaw(page)).toBe(boundary.raw);
  expect(await readBackup(page, boundary.reference)).toBeNull();
  expect(
    (await migrationEvents(page)).filter((event) => event.kind === "publish"),
  ).toEqual([]);
  expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
    prepared.original,
  );
  await expect(
    page.getByRole("img", { name: "Original invoice image", exact: true }),
  ).toBeVisible();
  const failureEvents = await migrationEvents(page);

  // Release only the injected environmental fault; recovery still runs the
  // actual app migration and must verify its real IndexedDB backup first.
  await page.evaluate((key) => sessionStorage.setItem(key, "yes"), recoveryKey);
  await page.reload();
  await expect
    .poll(async () => (await saved(page)).prototype_c8_schema)
    .toBe(1);
  const recovery = await assertVerifiedBeforePublish(page, boundary);
  expect(await saved(page)).toEqual(prepared.state);
  expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
    prepared.original,
  );
  await expect(
    page.getByText(/Browser storage is full or disabled/),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  await testInfo.attach("c8-backup-failure-recovery-proof.json", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          fixture:
            "Real C8 UI state with only prototype_c8_schema removed; actual backup put throws QuotaExceededError",
          boundary_sha256: boundary.sha256,
          source_sha256: prepared.sourceHash,
          exact_raw_preserved_during_failure: true,
          durable_replacement_blocked: true,
          every_decoded_field_preserved_after_recovery: true,
          failure_events: failureEvents,
          recovery_events: recovery.events.map(({ raw, ...event }) => ({
            ...event,
            ...(raw === undefined ? {} : { raw_sha256: digest(raw) }),
          })),
        },
        null,
        2,
      ),
    ),
  });
});
