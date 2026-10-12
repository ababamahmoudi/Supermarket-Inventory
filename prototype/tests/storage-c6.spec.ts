import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { resetDemo, signIn } from "./helpers";

const mainKey = "supermarket-prototype-v1";
const databaseName = "supermarket-prototype-files-v1";
const digest = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");

async function makePhoto(page: Page, index: number, target = 3_000_000) {
  // Twenty different deterministic noise photos exercise real JPEG decoding,
  // resizing, encoded byte volume and retained source hashes. Not empty padding.
  const fixture = await page.evaluate(
    async ({ index, target }) => {
      const canvas = document.createElement("canvas");
      canvas.width = target > 1_000_000 ? 2560 : 1200;
      canvas.height = target > 1_000_000 ? 2048 : 900;
      const context = canvas.getContext("2d")!;
      const image = context.createImageData(canvas.width, canvas.height);
      let seed = (index + 1) * 1234567;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed >>> 24;
      };
      for (let pixel = 0; pixel < image.data.length; pixel += 4) {
        image.data[pixel] = random();
        image.data[pixel + 1] = random();
        image.data[pixel + 2] = random();
        image.data[pixel + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      context.fillStyle = "white";
      context.fillRect(60, 60, 850, 150);
      context.fillStyle = "black";
      context.font = "bold 52px sans-serif";
      context.fillText(`Fictional storage photo ${index + 1}`, 85, 150);
      const encode = (quality: number) =>
        new Promise<Blob>((resolve) =>
          canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality),
        );
      let low = 0.1,
        high = 1;
      let blob = await encode(high);
      if (blob.size < target)
        throw new Error("Photo fixture did not reach requested size.");
      for (let pass = 0; pass < 9; pass++) {
        const quality = (low + high) / 2;
        const candidate = await encode(quality);
        if (candidate.size >= target) {
          blob = candidate;
          high = quality;
          if (candidate.size < target * 1.06) break;
        } else low = quality;
      }
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      return {
        base64: data.slice(data.indexOf(",") + 1),
        size: blob.size,
        width: canvas.width,
        height: canvas.height,
      };
    },
    { index, target },
  );
  const buffer = Buffer.from(fixture.base64, "base64");
  expect(buffer.length).toBeGreaterThanOrEqual(target);
  expect(buffer.length).toBeLessThan(target * 1.08);
  return {
    ...fixture,
    buffer,
    sha256: digest(buffer),
    name: `fictional-storage-photo-${index + 1}.jpg`,
  };
}
async function saved(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    mainKey,
  );
}
async function waitForSavedFiles(page: Page) {
  await expect
    .poll(async () => {
      const state = await saved(page);
      return Boolean(
        state &&
        !JSON.stringify(state).includes('"file_data":"data:') &&
        !JSON.stringify(state).includes('"logo_data":"data:'),
      );
    })
    .toBe(true);
}
async function retainedFiles(page: Page, references: string[]) {
  return page.evaluate(
    async ({ databaseName, references }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const sha = async (blob: Blob) =>
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
          ),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
      try {
        const results = [];
        for (const reference of references) {
          const record = await new Promise<{
            reference: string;
            company_id: string;
            source: Blob;
            preview: Blob;
            source_size: number;
            sha256: string;
          }>((resolve, reject) => {
            const request = database
              .transaction("files", "readonly")
              .objectStore("files")
              .get(reference);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const image = await createImageBitmap(record.preview);
          results.push({
            reference,
            company_id: record.company_id,
            size: record.source.size,
            hash: await sha(record.source),
            recorded_hash: record.sha256,
            preview_width: image.width,
            preview_height: image.height,
            preview_size: record.preview.size,
          });
          image.close();
        }
        return results;
      } finally {
        database.close();
      }
    },
    { databaseName, references },
  );
}
async function textBytes(page: Page) {
  return page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index)!,
    ).reduce(
      (sum, key) =>
        sum + (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2,
      0,
    ),
  );
}
async function openManual(page: Page) {
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
}

test("C6 keeps twenty distinct 3MB photos out of text storage, preserves exact originals and reloads readable previews", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Supervisor");
  await waitForSavedFiles(page);
  await page.goto("/#invoices");
  const uploaded: {
    id: string;
    reference: string;
    sha256: string;
    size: number;
    name: string;
  }[] = [];
  for (let index = 0; index < 20; index++) {
    await openManual(page);
    const photo = await makePhoto(page, index);
    await page
      .getByLabel("Upload a PDF or photo", { exact: true })
      .setInputFiles({
        name: photo.name,
        mimeType: "image/jpeg",
        buffer: photo.buffer,
      });
    await expect
      .poll(async () => (await saved(page))?.invoice.file_data)
      .toMatch(new RegExp(`^idb-file:v1:.*:${photo.sha256}$`));
    const invoice = (await saved(page)).invoice;
    uploaded.push({
      id: invoice.id,
      reference: invoice.file_data,
      sha256: photo.sha256,
      size: photo.size,
      name: photo.name,
    });
    const image = page.getByRole("img", {
      name: "Original invoice image",
      exact: true,
    });
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBe(2000);
    await expect(
      page.getByText(/Browser storage is full or disabled/),
    ).toHaveCount(0);
  }
  expect(new Set(uploaded.map((file) => file.sha256)).size).toBe(20);
  expect(new Set(uploaded.map((file) => file.reference)).size).toBe(20);
  const before = await retainedFiles(
    page,
    uploaded.map((file) => file.reference),
  );
  expect(before).toHaveLength(20);
  for (const [index, file] of before.entries()) {
    expect(file.size).toBe(uploaded[index].size);
    expect(file.hash).toBe(uploaded[index].sha256);
    expect(file.recorded_hash).toBe(file.hash);
    expect(
      Math.max(file.preview_width, file.preview_height),
    ).toBeLessThanOrEqual(2000);
    expect(file.preview_size).toBeLessThan(file.size);
  }
  const bytesBefore = await textBytes(page);
  if (bytesBefore >= 5 * 1024 * 1024) {
    const profile = await page.evaluate((mainKey) => {
      const state = JSON.parse(localStorage.getItem(mainKey)!);
      const fields = Object.entries(state)
        .map(([key, value]) => ({
          key,
          bytes: JSON.stringify(value).length * 2,
        }))
        .sort((a, b) => b.bytes - a.bytes);
      const keys = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index)!,
      ).map((key) => ({
        key,
        bytes: (key.length + localStorage.getItem(key)!.length) * 2,
      }));
      const actions: Record<string, number> = {};
      for (const entry of state.activity)
        actions[entry.action] =
          (actions[entry.action] ?? 0) + JSON.stringify(entry).length * 2;
      return {
        keys,
        fields,
        activity_count: state.activity.length,
        action_bytes: actions,
      };
    }, mainKey);
    await testInfo.attach("Text storage size profile", {
      body: JSON.stringify(profile, null, 2),
      contentType: "application/json",
    });
  }
  expect(bytesBefore).toBeLessThan(5 * 1024 * 1024);
  await page.reload();
  await waitForSavedFiles(page);
  const after = await retainedFiles(
    page,
    uploaded.map((file) => file.reference),
  );
  expect(after).toEqual(before);
  const state = await saved(page);
  const allInvoices = [...state.invoices, state.invoice];
  for (const file of uploaded)
    expect(
      allInvoices.some(
        (invoice: { id: string; file_data: string }) =>
          invoice.id === file.id && invoice.file_data === file.reference,
      ),
    ).toBe(true);
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Original invoice image", exact: true })
        .evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(2000);
  const downloadEvent = page.waitForEvent("download");
  await page
    .locator(".invoice-original-controls")
    .getByRole("button", { name: "Download", exact: true })
    .click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(digest(await readFile(path!))).toBe(uploaded.at(-1)!.sha256);
  expect(download.suggestedFilename()).toBe(uploaded.at(-1)!.name);
  // The dictionary must hydrate real History actions and their conflict guards
  // before a user can revert after refresh; merely retaining files is not enough.
  expect(state.prototype_history_dictionary?.version).toBe(1);
  const originalName = state.products.find(
    (product: { code: string }) => product.code === "0009",
  ).name_en;
  await page.goto("/#lookup");
  await page
    .getByRole("combobox", { name: "Search products", exact: true })
    .fill("0009");
  await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor
    .getByLabel("English name", { exact: true })
    .fill(`${originalName} storage reload proof`);
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await saved(page)).products.find(
          (product: { code: string }) => product.code === "0009",
        ).name_en,
    )
    .toContain("storage reload proof");
  await page.reload();
  await page.goto("/#history");
  const row = page
    .locator(".history-table tbody tr")
    .filter({ hasText: "Save product" })
    .first();
  await row.getByRole("button", { name: "Revert", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Revert change", exact: true })
    .getByRole("button", { name: "Revert change", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await saved(page)).products.find(
          (product: { code: string }) => product.code === "0009",
        ).name_en,
    )
    .toBe(originalName);
  expect(
    await retainedFiles(
      page,
      uploaded.map((file) => file.reference),
    ),
  ).toEqual(before);
  const bytesAfter = await textBytes(page);
  expect(bytesAfter).toBeLessThan(5 * 1024 * 1024);
  expect(errors).toEqual([]);
  const proofPath = testInfo.outputPath("twenty-real-photos-proof.json");
  await writeFile(
    proofPath,
    JSON.stringify(
      {
        files: after,
        text_bytes_before: bytesBefore,
        text_bytes_after: bytesAfter,
        reload_readable: true,
        downloaded_source_hash: uploaded.at(-1)!.sha256,
        history_revert_after_reload: true,
        browser_errors: errors,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("20 real 3MB photos and exact source retention", {
    path: proofPath,
    contentType: "application/json",
  });
});

test("C6 resolves an uploaded company logo before an immediate label Print, and retains the source after reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.print = () => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".label-print-output img"),
      );
      document.body.dataset.storedLogoPrint = JSON.stringify(
        images.map((image) => ({
          complete: image.complete,
          width: image.naturalWidth,
          height: image.naturalHeight,
          loading: image.getAttribute("aria-busy"),
          error: image.getAttribute("data-file-error"),
          source: image.src.startsWith("blob:"),
        })),
      );
    };
  });
  await signIn(page, "Supervisor");
  await waitForSavedFiles(page);
  const photo = await makePhoto(page, 99);
  await page.goto("/#settings?group=company");
  await page
    .locator("#company-logo")
    .getByLabel("Upload file", { exact: true })
    .setInputFiles({
      name: "fictional-company-logo.jpg",
      mimeType: "image/jpeg",
      buffer: photo.buffer,
    });
  await expect
    .poll(() =>
      page
        .locator(".settings-logo-preview")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(2000);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(async () => (await saved(page))?.config.company.logo_data)
    .toMatch(new RegExp(`^idb-file:v1:.*:${photo.sha256}$`));
  const reference = (await saved(page)).config.company.logo_data;
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.getByRole("tab", { name: "Products", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("0003");
  await page
    .getByRole("checkbox", { name: "Select product 0003", exact: true })
    .check();
  await page
    .getByRole("region", { name: "Add to waitlist", exact: true })
    .getByRole("button", { name: "Add 1 product to waitlist", exact: true })
    .click();
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  // No wait for a logo image here: the application must gate window.print.
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await expect
    .poll(() => page.locator("body").getAttribute("data-stored-logo-print"))
    .not.toBeNull();
  const printed = JSON.parse(
    (await page.locator("body").getAttribute("data-stored-logo-print"))!,
  );
  expect(printed.length).toBeGreaterThan(0);
  for (const image of printed) {
    expect(image.complete).toBe(true);
    expect(image.width).toBe(2000);
    expect(image.height).toBeGreaterThan(0);
    expect(image.loading).not.toBe("true");
    expect(image.error).toBeNull();
    expect(image.source).toBe(true);
  }
  await page.reload();
  await waitForSavedFiles(page);
  expect((await saved(page)).config.company.logo_data).toBe(reference);
  const files = await retainedFiles(page, [reference]);
  expect(files[0].hash).toBe(photo.sha256);
  expect(files[0].size).toBe(photo.size);
  expect(await textBytes(page)).toBeLessThan(5 * 1024 * 1024);
  await testInfo.attach("Uploaded logo was loaded before window.print", {
    body: JSON.stringify(
      { printed, file: files[0], reload_retained: true },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("C6 retains malformed History text until an explicit Reset, verifying its raw IndexedDB backup first", async ({
  page,
}, testInfo) => {
  await signIn(page, "Supervisor");
  await waitForSavedFiles(page);
  const malformed = await page.evaluate((mainKey) => {
    const state = JSON.parse(localStorage.getItem(mainKey)!);
    state.prototype_history_dictionary = {
      version: 1,
      blocks: [],
      bindings: [],
      integrity: "deliberate-corruption-fixture",
    };
    const raw = JSON.stringify(state);
    localStorage.setItem(mainKey, raw);
    return raw;
  }, mainKey);
  await page.reload();
  await expect(page.getByText(/Saved history could not be read/)).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), mainKey)).toBe(
    malformed,
  );
  // A valid in-memory action must not overwrite the unreadable saved history.
  await page.goto("/#lookup");
  await page
    .getByRole("combobox", { name: "Search products", exact: true })
    .fill("0009");
  await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor
    .getByLabel("English name", { exact: true })
    .fill("Fictional recovery check");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), mainKey)).toBe(
    malformed,
  );
  await resetDemo(page);
  await expect(page.getByText(/Saved history could not be read/)).toHaveCount(
    0,
  );
  await expect
    .poll(
      async () =>
        (await page.evaluate((key) => localStorage.getItem(key), mainKey)) !==
        malformed,
    )
    .toBe(true);
  const backups = await page.evaluate(async (databaseName) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const records = await new Promise<{ raw: Blob; sha256: string }[]>(
        (resolve, reject) => {
          const request = database
            .transaction("backups", "readonly")
            .objectStore("backups")
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      return Promise.all(
        records.map(async (record) => ({
          raw: await record.raw.text(),
          sha256: record.sha256,
        })),
      );
    } finally {
      database.close();
    }
  }, databaseName);
  expect(
    backups.some(
      (backup) =>
        backup.raw === malformed && backup.sha256 === digest(malformed),
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByText(/Saved history could not be read/)).toHaveCount(
    0,
  );
  await testInfo.attach(
    "Unreadable History retained and exactly archived before Reset",
    {
      body: JSON.stringify(
        {
          original_sha256: digest(malformed),
          backup_verified: true,
          reset_reloaded: true,
        },
        null,
        2,
      ),
      contentType: "application/json",
    },
  );
});

test("C6 migrates a near-full 5MiB legacy text store with verified raw backups and no lost source bytes", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await signIn(page, "Supervisor");
  await waitForSavedFiles(page);
  const photo = await makePhoto(page, 77, 400_000);
  const inline = `data:image/jpeg;base64,${photo.base64}`;
  const prepared = await page.evaluate(
    ({ inline, mainKey }) => {
      const state = JSON.parse(localStorage.getItem(mainKey)!);
      state.invoice.file_data = inline;
      state.invoice.file_name = "legacy-immutable-original.jpg";
      state.invoice.file_type = "image/jpeg";
      state.invoice.legacy_demo_original = {
        file_name: "legacy-preserved.jpg",
        file_type: "image/jpeg",
        file_data: inline,
      };
      state.config.company.logo_data = inline;
      const raw = JSON.stringify(state);
      const backup = structuredClone(state);
      delete backup.invoice.legacy_demo_original;
      delete backup.config.company.logo_data;
      const backupRaw = JSON.stringify(backup);
      localStorage.setItem(mainKey, raw);
      localStorage.setItem("supermarket-prototype-before-c4", backupRaw);
      const used = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index)!,
      ).reduce(
        (sum, key) =>
          sum + (key.length + localStorage.getItem(key)!.length) * 2,
        0,
      );
      const fillerKey = "c6-storage-proof-padding";
      const padding = Math.floor(
        (5 * 1024 * 1024 - 4096 - used - fillerKey.length * 2) / 2,
      );
      if (padding < 0)
        throw new Error(
          "Legacy fixture exceeded the 5MiB limit before migration.",
        );
      localStorage.setItem(fillerKey, "x".repeat(padding));
      return { raw, backupRaw, usedBefore: 5 * 1024 * 1024 - 4096 };
    },
    { inline, mainKey },
  );
  // Safari's relevant text quota is stricter than Chromium's. Enforce 5MiB on
  // actual Storage writes while using the browser's real IndexedDB/Blobs.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage) {
        let bytes = (key.length + String(value).length) * 2;
        for (let index = 0; index < this.length; index++) {
          const existingKey = this.key(index)!;
          if (existingKey !== key)
            bytes +=
              (existingKey.length + this.getItem(existingKey)!.length) * 2;
        }
        if (bytes > 5 * 1024 * 1024)
          throw new DOMException("5MiB text quota", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await waitForSavedFiles(page);
  const state = await saved(page);
  expect(state.invoice.file_data).toMatch(/^idb-file:v1:/);
  expect(state.invoice.legacy_demo_original.file_data).toBe(
    state.invoice.file_data,
  );
  expect(state.config.company.logo_data).toBe(state.invoice.file_data);
  const files = await retainedFiles(page, [state.invoice.file_data]);
  expect(files[0].hash).toBe(photo.sha256);
  expect(files[0].size).toBe(photo.size);
  const backups = await page.evaluate(async (databaseName) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const records = await new Promise<
        { storage_key: string; raw: Blob; sha256: string }[]
      >((resolve, reject) => {
        const request = database
          .transaction("backups", "readonly")
          .objectStore("backups")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return Promise.all(
        records.map(async (record) => ({
          key: record.storage_key,
          raw: await record.raw.text(),
          digest: record.sha256,
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
  for (const backup of backups) expect(digest(backup.raw)).toBe(backup.digest);
  const text = await textBytes(page);
  expect(text).toBeLessThan(5 * 1024 * 1024);
  await expect(
    page.getByText(/Browser storage is full or disabled/),
  ).toHaveCount(0);
  await page.reload();
  await waitForSavedFiles(page);
  expect((await saved(page)).invoice.file_data).toBe(state.invoice.file_data);
  expect((await retainedFiles(page, [state.invoice.file_data]))[0].hash).toBe(
    photo.sha256,
  );
  await testInfo.attach("Strict 5MiB migration and verified restore evidence", {
    body: JSON.stringify(
      {
        source_hash: photo.sha256,
        source_size: photo.size,
        migrated_reference: state.invoice.file_data,
        text_bytes_after: text,
        exact_main_backup_sha256: digest(prepared.raw),
        exact_legacy_backup_sha256: digest(prepared.backupRaw),
        verified_backup_count: backups.length,
        reload_preserved: true,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("C6 keeps legacy inline evidence intact when the file database is disabled", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await waitForSavedFiles(page);
  const before = await page.evaluate((mainKey) => {
    const state = JSON.parse(localStorage.getItem(mainKey)!);
    state.invoice.file_data =
      "data:application/pdf;base64,JVBERi0xLjcKJUZpY3Rpb25hbCBkZW1v";
    state.invoice.file_name = "retained-on-failure.pdf";
    state.invoice.file_type = "application/pdf";
    const raw = JSON.stringify(state);
    localStorage.setItem(mainKey, raw);
    return raw;
  }, mainKey);
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException("File database disabled", "SecurityError");
    };
  });
  await page.reload();
  await expect(
    page.getByText(/Browser storage is full or disabled/),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), mainKey)).toBe(
    before,
  );
});
