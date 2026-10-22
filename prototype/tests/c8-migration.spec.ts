import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  decodeHistoryStorage,
  encodeHistoryStorage,
} from "../src/history-storage";
import type { DemoState } from "../src/types";
import { AUTHORITY_DATABASE_NAME } from "../src/authority-repository";
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1";
import sourceConfig from "../../seed/arzon-config.json" with { type: "json" };
import retainedConfig from "../src/compat/configuration.json" with { type: "json" };
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { invoiceImage, setBranch, signIn } from "./helpers";

const mainKey = "supermarket-prototype-v1";
const companyId = { ...retainedConfig.company, ...sourceConfig.company }
  .seed_key;
const databaseName = "supermarket-prototype-files-v1";
const recoveryKey = "c8-migration-proof-allow-backup";
const storageFailure =
  /Browser storage (?:is full or disabled|could not be read or updated)/;
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
  expect(raw, "The exact retained legacy source must exist").not.toBeNull();
  return raw!;
}
async function saved(page: Page) {
  return readCanonicalBusinessEvidence(page);
}

async function showReviewOriginal(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 760)
    await page.getByRole("button", { name: /^View original \(/ }).click();
}

/** This isolated test deliberately exercises the real first import. The app is
 * unloaded before its authority database alone is removed; immutable files,
 * raw legacy sources and every file backup remain in their existing database.
 */
async function freshMigrationSurface(page: Page) {
  const origin = new URL(page.url()).origin;
  const setup = `${origin}/__e1-migration-setup`;
  await page.route(setup, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Retained migration setup</title>",
    }),
  );
  // E3's real service worker can answer navigations before page.route, so
  // leave its controlled document before preparing this isolated first import.
  // The app must be absent while its authority database alone is removed.
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator)
      for (const registration of await navigator.serviceWorker.getRegistrations())
        await registration.unregister();
  });
  await page.goto("about:blank");
  await page.goto(setup);
  await expect(page).toHaveTitle("Retained migration setup");
  await expect(page.locator('script[type="module"]')).toHaveCount(0);
  await expect(page.locator(".topbar")).toHaveCount(0);
  await page.evaluate(
    ({ databaseName, identityKey }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("The app has an open authority connection."));
        request.onsuccess = () => {
          sessionStorage.removeItem(identityKey);
          resolve();
        };
      }),
    { databaseName: AUTHORITY_DATABASE_NAME, identityKey: AUTH_IDENTITY_KEY },
  );
  return origin;
}

async function canonicalBusinessExists(page: Page) {
  return page.evaluate(
    ({ databaseName, companyId }) =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onupgradeneeded = () => {
          request.transaction?.abort();
          reject(new Error("Evidence must not create a canonical database."));
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("business", "readonly");
          const read = transaction.objectStore("business").get(companyId);
          let exists = false;
          read.onsuccess = () => {
            exists = read.result !== undefined;
          };
          transaction.oncomplete = () => {
            database.close();
            resolve(exists);
          };
          transaction.onabort = transaction.onerror = () => {
            database.close();
            reject(
              transaction.error ??
                new Error("Cannot inspect canonical publication."),
            );
          };
        };
      }),
    {
      databaseName: AUTHORITY_DATABASE_NAME,
      companyId: companyId,
    },
  );
}

async function readBackup(page: Page, reference: string) {
  return page.evaluate(
    async ({ databaseName, reference }) => {
      const storedBlob = (
        record: object,
        field: "source" | "preview" | "raw",
      ): Blob => {
        const fields = record as Record<string, unknown>;
        const value = fields[field];
        if (!("binary_encoding" in fields) && value instanceof Blob)
          return value;
        const mime = fields[`${field}_mime_type`];
        if (
          fields.binary_encoding === "array-buffer-v1" &&
          value instanceof ArrayBuffer &&
          typeof mime === "string"
        ) {
          const blob = new Blob([value], { type: mime });
          if (blob.type === mime) return blob;
        }
        throw new Error("Unexpected retained binary encoding.");
      };
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
              raw: Blob | ArrayBuffer;
              raw_mime_type?: string;
              binary_encoding?: "array-buffer-v1";
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
          raw: await storedBlob(record, "raw").text(),
          bytes: storedBlob(record, "raw").size,
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
      const storedBlob = (
        record: object,
        field: "source" | "preview" | "raw",
      ): Blob => {
        const fields = record as Record<string, unknown>;
        const value = fields[field];
        if (!("binary_encoding" in fields) && value instanceof Blob)
          return value;
        const mime = fields[`${field}_mime_type`];
        if (
          fields.binary_encoding === "array-buffer-v1" &&
          value instanceof ArrayBuffer &&
          typeof mime === "string"
        ) {
          const blob = new Blob([value], { type: mime });
          if (blob.type === mime) return blob;
        }
        throw new Error("Unexpected retained binary encoding.");
      };
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const record = await new Promise<{
          reference: string;
          company_id: string;
          source: Blob | ArrayBuffer;
          source_mime_type?: string;
          binary_encoding?: "array-buffer-v1";
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
        const bytes = new Uint8Array(
          await storedBlob(record, "source").arrayBuffer(),
        );
        return {
          reference: record.reference,
          company_id: record.company_id,
          recorded_hash: record.sha256,
          source_size: record.source_size,
          actual_size: storedBlob(record, "source").size,
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
  const previousInvoiceId = (await saved(page)).invoice.id;
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  // Select a file only after the chosen entry command's real canonical manual
  // draft and current protected editor agree.
  await expect
    .poll(async () => {
      const current = (await saved(page)).invoice;
      return (
        current.id !== previousInvoiceId &&
        current.entry_mode === "manual" &&
        current.status === "draft"
      );
    })
    .toBe(true);
  await expect(
    page.getByRole("heading", { name: "Invoice lines", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Attach original", { exact: true })
    .setInputFiles(invoiceImage);
  const sourceHash = digest(invoiceImage.buffer);
  await expect
    .poll(async () => (await saved(page)).invoice.file_data)
    .toBe(`idb-file:v1:super-arzon:${sourceHash}`);
  await showReviewOriginal(page);
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
  await expect(page.getByText(storageFailure)).toHaveCount(0);

  // E1's real durable snapshot is canonical IndexedDB. Serialize that exact
  // UI-produced state solely to prepare an explicit legacy migration fixture;
  // no live localStorage business mirror is created.
  const originalRaw = JSON.stringify(encodeHistoryStorage(await saved(page)));
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
  await freshMigrationSurface(page);
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
    ({
      databaseName,
      authorityDatabaseName,
      reference,
      failBackup,
      recoveryKey,
    }) => {
      const proof: MigrationProbe = { events: [] };
      (window as ProofWindow).__c8MigrationProof = proof;
      const retainedBackupBlobs = new WeakSet<Blob>();
      const retainedBackupBuffers = new WeakSet<ArrayBuffer>();
      const originalBlob = Blob;
      // The public repository still returns Blob values. Track the actual
      // reconstruction from a retained buffer so the unchanged text/hash
      // guards observe verification before publication for either encoding.
      window.Blob = new Proxy(originalBlob, {
        construct(target, argumentsList, newTarget) {
          const blob = Reflect.construct(
            target,
            argumentsList,
            newTarget,
          ) as Blob;
          const parts = argumentsList[0] as BlobPart[] | undefined;
          if (
            Array.isArray(parts) &&
            parts.some(
              (part) =>
                part instanceof ArrayBuffer && retainedBackupBuffers.has(part),
            )
          )
            retainedBackupBlobs.add(blob);
          return blob;
        },
      });
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
            else if (
              record?.binary_encoding === "array-buffer-v1" &&
              record.raw instanceof ArrayBuffer &&
              typeof record.raw_mime_type === "string"
            )
              retainedBackupBuffers.add(record.raw);
            else if (record)
              throw new Error("Unexpected retained backup encoding.");
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
        const request = originalPut.call(this, value, key);
        if (
          this.transaction.db.name === authorityDatabaseName &&
          this.name === "business" &&
          value !== null &&
          typeof value === "object" &&
          "state" in value
        ) {
          const snapshot = value as { state: { prototype_c8_schema?: number } };
          this.transaction.addEventListener(
            "complete",
            () => {
              proof.events.push({
                kind: "publish",
                schema: snapshot.state.prototype_c8_schema,
              });
            },
            { once: true },
          );
        }
        return request;
      };
    },
    {
      databaseName,
      authorityDatabaseName: AUTHORITY_DATABASE_NAME,
      reference,
      failBackup,
      recoveryKey,
    },
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
  await signIn(page, "Manager");
  // E1's root invoice route is the Drafts list. Open this actual retained
  // invoice's protected workspace before asserting its original is visible.
  await page.goto(
    `/#invoices?id=${encodeURIComponent(prepared.state.invoice.id)}`,
  );
  await expect
    .poll(async () => (await saved(page)).prototype_c8_schema)
    .toBe(1);
  const proof = await assertVerifiedBeforePublish(page, boundary);
  expect(
    await savedRaw(page),
    "First import must preserve its exact legacy source",
  ).toBe(boundary.raw);
  expect(
    await saved(page),
    "Every decoded saved field must survive the additive boundary",
  ).toEqual(prepared.state);
  expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
    prepared.original,
  );
  await showReviewOriginal(page);
  await expect(
    page.getByRole("img", { name: "Original invoice image", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(storageFailure)).toHaveCount(0);
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
            "Actual UI-produced E1 business state with only prototype_c8_schema removed; not an archived C7 snapshot",
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
  await page.goto("/#invoices");
  await expect(page.getByText(storageFailure)).toBeVisible();
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
  // A failed first import cannot expose private invoice data before a genuine
  // authority/session exists. Retained bytes above are still verified exactly.
  expect(await canonicalBusinessExists(page)).toBe(false);
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Original invoice image", exact: true }),
  ).toHaveCount(0);
  const failureEvents = await migrationEvents(page);

  // Release only the injected environmental fault; recovery still runs the
  // actual app migration and must verify its real IndexedDB backup first.
  await page.evaluate((key) => sessionStorage.setItem(key, "yes"), recoveryKey);
  await signIn(page, "Manager");
  await page.goto("/#invoices");
  await expect
    .poll(async () => (await saved(page)).prototype_c8_schema)
    .toBe(1);
  const recovery = await assertVerifiedBeforePublish(page, boundary);
  expect(await saved(page)).toEqual(prepared.state);
  expect(await readOriginal(page, prepared.state.invoice.file_data!)).toEqual(
    prepared.original,
  );
  await expect(page.getByText(storageFailure)).toHaveCount(0);
  expect(errors).toEqual([]);
  await testInfo.attach("c8-backup-failure-recovery-proof.json", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          fixture:
            "Actual UI-produced E1 business state with only prototype_c8_schema removed; actual backup put throws QuotaExceededError",
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
