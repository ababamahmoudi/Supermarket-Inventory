import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { expect, test, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import configuration from "../../seed/arzon-config.json" with { type: "json" };
import { AUTHORITY_DATABASE_NAME } from "../src/authority-repository";
import { AUTH_IDENTITY_KEY } from "../src/auth-preferences.e1";
import { encodeHistoryStorage } from "../src/history-storage";
import { readCanonicalBusinessEvidence } from "./business-evidence";

const mainKey = "supermarket-prototype-v1";
const databaseName = "supermarket-prototype-files-v1";
const storageFailure =
  /Browser storage (?:is full or disabled|could not be read or updated)/;
const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

function lanAddress(baseURL: string) {
  if (process.env.C6_LAN_BASE_URL) return process.env.C6_LAN_BASE_URL;
  const url = new URL(baseURL);
  const address = Object.values(networkInterfaces())
    .flat()
    .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;
  if (!address)
    throw new Error("An IPv4 LAN interface is needed for HTTP proof.");
  url.protocol = "http:";
  url.hostname = address;
  return url.origin;
}

async function saved(page: Page) {
  return readCanonicalBusinessEvidence(page);
}

async function signInManager(page: Page, origin: string) {
  const account = demoSeed.demo_users.find(
    (user) => user.username === "manager",
  );
  if (!account) throw new Error("The configured Manager fixture is missing.");
  if (page.url() !== new URL(origin).href) await page.goto(origin);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill(account.username);
  await page
    .getByLabel("Password", { exact: true })
    .fill(account.password ?? "demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (account.setup.second_step_method === "authenticator") {
    await page
      .getByLabel("Authenticator app code", { exact: true })
      .fill(configuration.session.simulated_authenticator_code);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  } else {
    await page
      .getByRole("button", { name: "Continue with passkey", exact: true })
      .click();
  }
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".user-chip-copy strong")).toHaveText(
    account.name_en,
  );
}

/** Unload the actual app before a deliberate first-import fixture. Keep its
 * existing file database, backups and raw text; remove only the authority DB.
 */
async function freshMigrationSurface(page: Page, origin: string) {
  const setup = `${origin}/__e1-migration-setup`;
  await page.route(setup, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Retained migration setup</title>",
    }),
  );
  await page.goto(setup);
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
}

async function photoFixture(page: Page, large: boolean) {
  const base64 = await page.evaluate(async (large) => {
    const canvas = document.createElement("canvas");
    canvas.width = large ? 2560 : 1200;
    canvas.height = large ? 2048 : 900;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = large ? 8191 : 731;
    for (let index = 0; index < pixels.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels.data[index + channel] = seed >>> 24;
      }
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const target = large ? 3 * 1024 * 1024 : 400_000;
    const encode = (quality: number) =>
      new Promise<Blob>((resolve) =>
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality),
      );
    let low = 0.1,
      high = 1;
    let source = await encode(high);
    if (source.size < target) throw new Error("JPEG fixture is too small.");
    for (let pass = 0; pass < 10; pass++) {
      const quality = (low + high) / 2;
      const candidate = await encode(quality);
      if (candidate.size >= target) {
        high = quality;
        source = candidate;
      } else low = quality;
    }
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(source);
    });
  }, large);
  const buffer = Buffer.from(base64, "base64");
  expect(buffer.length).toBeGreaterThanOrEqual(
    large ? 3 * 1024 * 1024 : 400_000,
  );
  return { base64, buffer, hash: sha(buffer) };
}

async function retained(page: Page, reference: string) {
  const record = await page.evaluate(
    async ({ reference, databaseName }) => {
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
          company_id: string;
          sha256: string;
          source_size: number;
          source: Blob | ArrayBuffer;
          source_mime_type?: string;
          binary_encoding?: "array-buffer-v1";
          preview: Blob | ArrayBuffer;
          preview_mime_type?: string;
        }>((resolve, reject) => {
          const request = database
            .transaction("files")
            .objectStore("files")
            .get(reference);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.readAsDataURL(storedBlob(record, "source"));
        });
        const image = new Image();
        const url = URL.createObjectURL(storedBlob(record, "preview"));
        try {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () =>
              reject(new Error("Retained preview cannot decode."));
            image.src = url;
          });
          return {
            company_id: record.company_id,
            sha256: record.sha256,
            source_size: record.source_size,
            base64,
            preview_width: image.naturalWidth,
            preview_height: image.naturalHeight,
          };
        } finally {
          URL.revokeObjectURL(url);
        }
      } finally {
        database.close();
      }
    },
    { reference, databaseName },
  );
  return { ...record, bytes: Buffer.from(record.base64, "base64") };
}

test("C6 nonsecure HTTP uploads, migrates near-full text storage and verifies original bytes without SubtleCrypto", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const server = new URL(baseURL!);
  const simulatedOrigin = process.env.C6_NONSECURE_TEST_ORIGIN;
  const origin = simulatedOrigin ?? lanAddress(baseURL!);
  if (simulatedOrigin) {
    const fixtureOrigin = new URL(simulatedOrigin);
    if (
      fixtureOrigin.protocol !== "http:" ||
      !fixtureOrigin.hostname.endsWith(".invalid")
    )
      throw new Error(
        "The explicit nonsecure transport fixture must use HTTP and a reserved .invalid hostname.",
      );
    // Serve the unchanged production app from our loopback test server under a
    // genuinely nonsecure HTTP origin. Only transport is routed: browser crypto,
    // IndexedDB, Blobs, decoding, resizing and downloads are all native. This
    // works in managed runners whose egress policy blocks private LAN addresses.
    // This explicitly selected fixture simulates response transport; it does
    // not establish genuine LAN network access. By default, transport is direct.
    await page.route(`${origin}/**`, async (route) => {
      const request = new URL(route.request().url());
      const response = await route.fetch({
        url: `${server.origin}${request.pathname}${request.search}`,
      });
      await route.fulfill({ response });
    });
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(origin);
  expect(response?.status()).toBe(200);
  const capabilities = await page.evaluate(() => ({
    origin: location.origin,
    secure: isSecureContext,
    subtle: Boolean(globalThis.crypto?.subtle),
    indexedDB: typeof indexedDB !== "undefined",
  }));
  expect(capabilities.secure).toBe(false);
  expect(capabilities.subtle).toBe(false);
  expect(capabilities.indexedDB).toBe(true);
  await signInManager(page, origin);
  await expect
    .poll(async () => Boolean((await saved(page))?.products))
    .toBe(true);
  await page.goto(`${origin}/#invoices`);
  const previousInvoiceId = (await saved(page)).invoice.id;
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  const chooser = page.getByRole("dialog", {
    name: "New invoice",
    exact: true,
  });
  await expect(chooser).toBeVisible();
  expect((await saved(page)).invoice.id).toBe(previousInvoiceId);
  await chooser
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
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
  const photo = await photoFixture(page, true);
  await page
    .locator('input[type="file"][aria-label="Attach original"]')
    .setInputFiles({
      name: "fictional-lan-original.jpg",
      mimeType: "image/jpeg",
      buffer: photo.buffer,
    });
  await expect
    .poll(async () => (await saved(page))?.invoice.file_data)
    .toMatch(new RegExp(`^idb-file:v1:.*:${photo.hash}$`));
  const uploaded = (await saved(page)).invoice;
  const source = await retained(page, uploaded.file_data!);
  expect(source.company_id).toBe(uploaded.company_id);
  expect(source.sha256).toBe(photo.hash);
  expect(source.source_size).toBe(photo.buffer.length);
  expect(source.bytes).toEqual(photo.buffer);
  expect(Math.max(source.preview_width, source.preview_height)).toBe(2000);
  await page.reload();
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await page.getByRole("button", { name: /^View original \(/ }).click();
  const image = page
    .getByRole("img", {
      name: "Original invoice image",
      exact: true,
    })
    .filter({ visible: true });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(2000);
  expect((await saved(page)).invoice.file_data).toBe(uploaded.file_data);
  expect((await retained(page, uploaded.file_data!)).bytes).toEqual(
    photo.buffer,
  );
  await page
    .locator(".invoice-original-controls:visible")
    .getByRole("button", { name: "More", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("fictional-lan-original.jpg");
  expect(await readFile((await download.path())!)).toEqual(photo.buffer);

  const legacy = await photoFixture(page, false);
  const legacyState = await saved(page);
  const inline = `data:image/jpeg;base64,${legacy.base64}`;
  legacyState.invoice.file_data = inline;
  legacyState.invoice.file_name = "legacy-lan-original.jpg";
  legacyState.invoice.file_type = "image/jpeg";
  legacyState.invoice.file_size = undefined;
  legacyState.invoice.legacy_demo_original = {
    file_name: "legacy-preserved.jpg",
    file_type: "image/jpeg",
    file_data: inline,
  };
  legacyState.config.company.logo_data = inline;
  const raw = JSON.stringify(encodeHistoryStorage(legacyState));
  const legacyBackup = structuredClone(legacyState);
  delete legacyBackup.invoice.legacy_demo_original;
  delete legacyBackup.config.company.logo_data;
  const backupRaw = JSON.stringify(encodeHistoryStorage(legacyBackup));
  await freshMigrationSurface(page, origin);
  const prepared = await page.evaluate(
    ({ raw, backupRaw, mainKey }) => {
      localStorage.setItem(mainKey, raw);
      localStorage.setItem("supermarket-prototype-before-c4", backupRaw);
      const used = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index)!,
      ).reduce(
        (sum, key) =>
          sum + (key.length + localStorage.getItem(key)!.length) * 2,
        0,
      );
      const paddingKey = "c6-lan-padding";
      const padding = Math.floor(
        (5 * 1024 * 1024 - 4096 - used - paddingKey.length * 2) / 2,
      );
      if (padding < 0)
        throw new Error("Legacy fixture exceeded the 5MiB quota.");
      localStorage.setItem(paddingKey, "x".repeat(padding));
      return { raw, backupRaw };
    },
    { raw, backupRaw, mainKey },
  );
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage) {
        let bytes = (key.length + String(value).length) * 2;
        for (let index = 0; index < this.length; index++) {
          const other = this.key(index)!;
          if (other !== key)
            bytes += (other.length + this.getItem(other)!.length) * 2;
        }
        if (bytes > 5 * 1024 * 1024)
          throw new DOMException("5MiB text quota", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await signInManager(page, origin);
  await expect
    .poll(async () => (await saved(page))?.invoice.file_data)
    .toMatch(new RegExp(`^idb-file:v1:.*:${legacy.hash}$`));
  const migrated = await saved(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), mainKey)).toBe(
    prepared.raw,
  );
  expect(migrated.invoice.legacy_demo_original!.file_data).toBe(
    migrated.invoice.file_data,
  );
  expect(migrated.config.company.logo_data).toBe(migrated.invoice.file_data);
  expect((await retained(page, migrated.invoice.file_data!)).bytes).toEqual(
    legacy.buffer,
  );
  const backups = await page.evaluate(async (databaseName) => {
    const storedBlob = (
      record: object,
      field: "source" | "preview" | "raw",
    ): Blob => {
      const fields = record as Record<string, unknown>;
      const value = fields[field];
      if (!("binary_encoding" in fields) && value instanceof Blob) return value;
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
      const records = await new Promise<
        {
          storage_key: string;
          sha256: string;
          raw: Blob | ArrayBuffer;
          raw_mime_type?: string;
          binary_encoding?: "array-buffer-v1";
        }[]
      >((resolve, reject) => {
        const request = database
          .transaction("backups")
          .objectStore("backups")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return Promise.all(
        records.map(async (record) => ({
          key: record.storage_key,
          sha256: record.sha256,
          raw: await storedBlob(record, "raw").text(),
        })),
      );
    } finally {
      database.close();
    }
  }, databaseName);
  expect(
    backups.some(
      (backup) => backup.key === mainKey && backup.raw === prepared.raw,
    ),
  ).toBe(true);
  expect(
    backups.some(
      (backup) =>
        backup.key === "supermarket-prototype-before-c4" &&
        backup.raw === prepared.backupRaw,
    ),
  ).toBe(true);
  for (const backup of backups) expect(backup.sha256).toBe(sha(backup.raw));
  const textBytes = await page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index)!,
    ).reduce(
      (sum, key) => sum + (key.length + localStorage.getItem(key)!.length) * 2,
      0,
    ),
  );
  expect(textBytes).toBeLessThan(5 * 1024 * 1024);
  await expect(page.getByText(storageFailure)).toHaveCount(0);
  await page.reload();
  await expect
    .poll(async () => (await saved(page))?.invoice.file_data)
    .toBe(migrated.invoice.file_data);
  expect((await retained(page, migrated.invoice.file_data!)).bytes).toEqual(
    legacy.buffer,
  );
  expect((await retained(page, uploaded.file_data!)).bytes).toEqual(
    photo.buffer,
  );
  expect(errors).toEqual([]);
  const proofPath = testInfo.outputPath("nonsecure-lan-exact-bytes-proof.json");
  await writeFile(
    proofPath,
    JSON.stringify(
      {
        capabilities,
        transport: simulatedOrigin
          ? "simulated-http-response-transport-from-loopback"
          : "direct-lan",
        uploaded_bytes: photo.buffer.length,
        uploaded_sha256: photo.hash,
        preview_longest_side: 2000,
        upload_reload_download_exact: true,
        legacy_bytes: legacy.buffer.length,
        legacy_sha256: legacy.hash,
        backup_main_sha256: sha(prepared.raw),
        backup_legacy_sha256: sha(prepared.backupRaw),
        verified_backup_count: backups.length,
        text_bytes_after: textBytes,
        migrated_reload_exact: true,
        browser_errors: errors,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("HTTP LAN exact upload and migration proof", {
    path: proofPath,
    contentType: "application/json",
  });
});
