import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openInvoiceSourcePicker, setBranch, setLanguage } from "./helpers";
import {
  configureLive,
  fictionalPhoto,
  mockReader,
  retainedSourceHashes,
  sourceHash,
  t,
} from "./r3-live-reading-helpers";
const pdfPath = fileURLToPath(
  new URL("./fixtures/r3-fictional-two-page.pdf", import.meta.url),
);
for (const language of ["en", "fa"] as const) {
  test(`R3c F3 Photo opens native picker, cancellation writes nothing and selected originals fill one draft ${language}`, async ({
    page,
  }) => {
    const reader = await mockReader(page, []);
    await configureLive(page);
    if (language === "fa") await setLanguage(page, "fa");
    await page.goto("/#invoices");
    const original = await fictionalPhoto(page, "fictional-native-photo.png");
    const before = await readCanonicalBusinessEvidence(page);
    const cancelled = await openInvoiceSourcePicker(page, "photo", language);
    expect(await cancelled.element().getAttribute("accept")).toBe("image/*");
    expect(await cancelled.element().getAttribute("capture")).toBeNull();
    expect(cancelled.isMultiple()).toBe(true);
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    await expect(page.getByTestId("invoice-upload-entry")).toHaveCount(0);
    await cancelled.setFiles([]);
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    const chosen = await openInvoiceSourcePicker(page, "photo", language);
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    await chosen.setFiles(original);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.live_reading
            ?.phase,
      )
      .toBe("ready");
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.id).not.toBe(before.invoice.id);
    expect(after.invoice.file_name).toBe(original.name);
    expect(after.invoice.lines).toEqual([]);
    expect(await retainedSourceHashes(page, after.invoice)).toEqual([
      sourceHash(original),
    ]);
    const beforeIds = new Set([
      before.invoice.id,
      ...(before.invoices ?? []).map((invoice) => invoice.id),
    ]);
    const afterIds = new Set([
      after.invoice.id,
      ...(after.invoices ?? []).map((invoice) => invoice.id),
    ]);
    expect(afterIds.size).toBe(beforeIds.size + 1);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.products).toEqual(before.products);
    expect(after.approvals).toEqual(before.approvals);
    expect(after.stock_movements).toEqual(before.stock_movements);
    await expect(page.getByTestId("invoice-upload-entry")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: t(language, "Read invoice", "خواندن فاکتور"),
        exact: true,
      }),
    ).toBeVisible();
    expect(reader.requests).toHaveLength(0);
  });
  test(`R3c F3 PDF opens native picker, invalid selection creates no draft and valid bytes are retained ${language}`, async ({
    page,
  }) => {
    const reader = await mockReader(page, []);
    await configureLive(page);
    if (language === "fa") await setLanguage(page, "fa");
    await page.goto("/#invoices");
    const before = await readCanonicalBusinessEvidence(page);
    const invalid = await openInvoiceSourcePicker(page, "pdf", language);
    expect(await invalid.element().getAttribute("accept")).toBe(
      "application/pdf",
    );
    expect(invalid.isMultiple()).toBe(false);
    await invalid.setFiles({
      name: "fictional-not-an-invoice.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Fictional invalid source"),
    });
    await expect(
      page.getByRole("alert").filter({
        hasText: t(
          language,
          "Choose a PDF, PNG, JPEG, WebP, or GIF file.",
          "فایل PDF، PNG، JPEG، WebP یا GIF انتخاب کنید.",
        ),
      }),
    ).toBeVisible();
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    const valid = await openInvoiceSourcePicker(page, "pdf", language);
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    await valid.setFiles(pdfPath);
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.live_reading
            ?.phase,
      )
      .toBe("ready");
    const after = await readCanonicalBusinessEvidence(page);
    expect(after.invoice.id).not.toBe(before.invoice.id);
    expect(after.invoice.file_type).toBe("application/pdf");
    expect(await retainedSourceHashes(page, after.invoice)).toEqual([
      createHash("sha256")
        .update(await readFile(pdfPath))
        .digest("hex"),
    ]);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.approvals).toEqual(before.approvals);
    await expect(page.getByTestId("invoice-upload-entry")).toHaveCount(0);
    expect(reader.requests).toHaveLength(0);
  });
}
test("R3c F3 a native picker opened at another location cannot create or adopt an invoice", async ({
  page,
}) => {
  await configureLive(page);
  await page.goto("/#invoices");
  const original = await fictionalPhoto(page, "fictional-stale-location.png");
  const before = await readCanonicalBusinessEvidence(page);
  const chosen = await openInvoiceSourcePicker(page, "photo");
  await setBranch(page, "Branch 2");
  const input = chosen.element();
  if (await input.evaluate((element) => element.isConnected))
    await chosen.setFiles(original);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoice.id).toBe(before.invoice.id);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.activity).toEqual(before.activity);
  expect(after.ledger).toEqual(before.ledger);
});

test("R3c F3 leaving during native-file validation cannot create a draft after returning", async ({
  page,
}) => {
  await configureLive(page);
  await page.goto("/#invoices");
  await page.evaluate(() => {
    const arrayBuffer = File.prototype.arrayBuffer;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.assign(window, {
      fictionalSourceValidation: { started: false, release },
    });
    File.prototype.arrayBuffer = async function () {
      if (this.name === "fictional-navigation.svg") {
        (
          window as unknown as {
            fictionalSourceValidation: { started: boolean };
          }
        ).fictionalSourceValidation.started = true;
        await pending;
      }
      return arrayBuffer.call(this);
    };
  });
  const before = await readCanonicalBusinessEvidence(page);
  const chosen = await openInvoiceSourcePicker(page, "photo");
  await chosen.setFiles({
    name: "fictional-navigation.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Fictional navigation proof</text></svg>',
    ),
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              fictionalSourceValidation: { started: boolean };
            }
          ).fictionalSourceValidation.started,
      ),
    )
    .toBe(true);
  // Use the same real client navigation as the app; the old selection must not
  // become current simply because the invoice list later mounts again.
  await page.evaluate(() => {
    window.location.hash = "products";
  });
  await expect(page).toHaveURL(/#products$/);
  await page.getByRole("heading", { name: "Products", exact: true }).waitFor();
  await page.evaluate(() => {
    window.location.hash = "invoices";
  });
  await expect(
    page.getByRole("button", { name: "New invoice", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as {
        fictionalSourceValidation: { release: () => void };
      }
    ).fictionalSourceValidation.release(),
  );
  expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
  await expect(page.getByTestId("invoice-upload-entry")).toHaveCount(0);
});
