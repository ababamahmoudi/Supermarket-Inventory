import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import Decimal from "decimal.js";
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };
import type { DemoState } from "../src/types";
import { setBranch, setLanguage, signIn } from "./helpers";

const originalId = `a2-fixture:${receiptFixtures.invoices[0].number}`;
const saved = (page: Page): Promise<DemoState> =>
  readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );

for (const language of ["en", "fa"] as const)
  test(`posted original and confirmed correction retain immutable evidence and version links in ${language}`, async ({
    page,
  }) => {
    const fa = language === "fa";
    await signIn(page, "Supervisor");
    await setBranch(page, "all");
    if (fa) await setLanguage(page, "fa");
    await page.goto(`/#invoices?id=${encodeURIComponent(originalId)}`);
    const before = await saved(page);
    const original = before.invoices!.find((row) => row.id === originalId)!;
    await expect(page.locator(".posted-invoice-document")).toContainText(
      original.supplier_invoice_number,
    );
    await expect(page.locator(".invoice-line input")).toHaveCount(0);
    await expect(
      page.getByLabel(fa ? "پیوست اصل فاکتور" : "Attach original", {
        exact: true,
      }),
    ).toBeHidden();
    const documentOrder = await page
      .locator(".invoice-posted-workspace")
      .evaluate((element) => {
        const header = element.querySelector(".posted-invoice-header")!;
        const original = element.querySelector(".invoice-original-card")!;
        return !!(
          header.compareDocumentPosition(original) &
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      });
    expect(documentOrder).toBe(true);
    await expect(
      page.getByText("Changes save automatically in this browser", {
        exact: true,
      }),
    ).toHaveCount(0);
    const image = page.getByRole("img", {
      name: fa ? "تصویر اصل فاکتور" : "Original invoice image",
      exact: true,
    });
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: fa ? "دانلود" : "Download", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(original.file_name);

    await page
      .getByRole("button", {
        name: fa ? "اصلاح فاکتور" : "Correct invoice",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: fa ? "اصلاح فاکتور" : "Correct invoice",
      exact: true,
    });
    const first = dialog.locator(".invoice-correction-line").first();
    const nextCost = new Decimal(original.lines[0].unit_cost_before_tax)
      .plus("0.5000")
      .toFixed(4);
    await first
      .getByLabel(fa ? "هزینه هر واحد پیش از مالیات" : "Unit cost before tax", {
        exact: true,
      })
      .fill(nextCost);
    await dialog
      .getByLabel(fa ? "دلیل (الزامی)" : "Reason (required)", { exact: true })
      .fill("Correct the recorded fictional unit cost.");
    await dialog
      .getByRole("button", {
        name: fa ? "پیش‌نمایش اصلاح" : "Preview correction",
        exact: true,
      })
      .click();
    await expect(dialog).toContainText(
      fa ? "قابل پرداخت اصلاح‌شده" : "Corrected payable",
    );
    expect((await saved(page)).invoice_content_corrections ?? []).toHaveLength(
      before.invoice_content_corrections?.length ?? 0,
    );
    await dialog
      .getByRole("button", { name: fa ? "ادامه" : "Continue", exact: true })
      .click();
    expect((await saved(page)).invoice_content_corrections ?? []).toHaveLength(
      before.invoice_content_corrections?.length ?? 0,
    );
    await dialog
      .getByRole("button", {
        name: fa ? "تأیید اصلاح" : "Confirm correction",
        exact: true,
      })
      .click();
    await expect(dialog).not.toBeVisible();
    const after = await saved(page);
    const correction = after.invoice_content_corrections!.at(-1)!;
    expect(after.invoices!.find((row) => row.id === originalId)).toEqual(
      original,
    );
    expect(after.ledger.slice(0, before.ledger.length)).toEqual(before.ledger);
    expect(correction).toMatchObject({
      invoice_id: originalId,
      original_file_invoice_id: originalId,
    });
    expect(correction.after.lines[0].unit_cost_before_tax).toBe(nextCost);
    expect(new Decimal(correction.payable_delta).gt(0)).toBe(true);
    expect(after.ledger.slice(before.ledger.length)).toEqual([
      expect.objectContaining({
        invoice_id: originalId,
        amount: correction.payable_delta,
        type: "adjustment",
      }),
    ]);
    const originalLink = page
      .locator(".posted-invoice-versions")
      .getByRole("link", {
        name: fa ? "اصل فاکتور" : "Original invoice",
        exact: true,
      });
    await originalLink.click();
    await expect(
      page.getByRole("button", {
        name: fa ? "اصلاح فاکتور" : "Correct invoice",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .locator(".posted-invoice-versions")
      .getByRole("link", { name: fa ? "اصلاح 1" : "Correction 1", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: fa ? "اصلاح فاکتور" : "Correct invoice",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    expect((await saved(page)).invoice_content_corrections!.at(-1)).toEqual(
      correction,
    );
    await page.goto("/#history");
    const correctedLink = page.locator(".history-table").getByRole("link", {
      name: fa ? "نمایش اصلاح‌شده" : "View corrected",
      exact: true,
    });
    await expect(correctedLink).toBeVisible();
    const row = correctedLink.locator("xpath=ancestor::tr[1]");
    const action = fa ? "اصلاح فاکتور" : "Correct invoice";
    if (!(await row.getByText(action, { exact: true }).isVisible())) {
      const disclosure = row.getByRole("button", {
        name: fa ? "نمایش جزئیات" : "Show details",
        exact: true,
      });
      const panelId = await disclosure.getAttribute("aria-controls");
      await disclosure.click();
      await expect(
        page.locator(`[id=${JSON.stringify(panelId)}]`),
      ).toContainText(action);
    } else {
      await expect(row.getByText(action, { exact: true })).toBeVisible();
    }
    await expect(
      row.getByRole("link", {
        name: fa ? "نمایش اصلاح‌شده" : "View corrected",
        exact: true,
      }),
    ).toHaveAttribute("href", new RegExp(`version=${correction.id}`));
    await row
      .getByRole("button", {
        name: fa ? "کارهای بیشتر" : "More actions",
        exact: true,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: fa ? "نمایش اصل" : "View original",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/version=original/);
  });

/** A real two-page PDF built from vector content, uploaded through the same file control. */
function twoPagePdf() {
  const stream = (contents: string) =>
    `<< /Length ${Buffer.byteLength(contents)} >>\nstream\n${contents}endstream`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>",
    stream("0.2 0.4 0.8 rg 20 280 260 90 re f\n"),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 6 0 R >>",
    stream("0.8 0.4 0.2 rg 20 100 260 90 re f\n"),
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 7\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return {
    name: "fictional-two-page-invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(body),
  };
}

test("an uploaded PDF uses the custom viewer, navigates actual pages and retains exact bytes after refresh", async ({
  page,
}, testInfo) => {
  const fixture = twoPagePdf();
  const digest = (bytes: Buffer) =>
    createHash("sha256").update(bytes).digest("hex");
  const expectedHash = digest(fixture.buffer);
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  const previousInvoiceId = (await saved(page)).invoice.id;
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  // File injection bypasses inert/disabled controls. Wait for the real manual
  // command and protected workspace before acting as an enabled file picker.
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
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible();
  const upload = page.getByLabel("Upload a PDF or photo", { exact: true });
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(fixture);
  const canvas = page.getByRole("img", {
    name: "Original invoice PDF",
    exact: true,
  });
  await expect(canvas).toBeVisible();
  await expect(page.locator(".invoice-pdf-pages")).toContainText("1 / 2");
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(1);
  const pixel = (vertical: number) =>
    canvas.evaluate((element, vertical) => {
      const canvas = element as HTMLCanvasElement;
      return Array.from(
        canvas
          .getContext("2d")!
          .getImageData(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height * vertical),
            1,
            1,
          ).data,
      ).slice(0, 3);
    }, vertical);
  await expect.poll(() => pixel(0.18)).toEqual([51, 102, 204]);
  const initialPixels = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).toDataURL(),
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".invoice-pdf-pages")).toContainText("2 / 2");
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL()),
    )
    .not.toBe(initialPixels);
  await expect.poll(() => pixel(0.63)).toEqual([204, 102, 51]);
  await expect
    .poll(async () => (await saved(page)).invoice.file_data)
    .toMatch(new RegExp(`^idb-file:v1:.*:${expectedHash}$`));
  const retained = await saved(page);
  const uploaded = retained.invoice.file_data!;
  const companyId = retained.config.company.seed_key;
  expect(retained.invoice.file_size).toBe(fixture.buffer.length);
  const storedPdf = () =>
    page.evaluate(
      async ({ reference, companyId }) => {
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
          const request = indexedDB.open("supermarket-prototype-files-v1", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const record = await new Promise<{
            company_id: string;
            type: string;
            sha256: string;
            source_size: number;
            source: Blob | ArrayBuffer;
            source_mime_type?: string;
            binary_encoding?: "array-buffer-v1";
          }>((resolve, reject) => {
            const request = database
              .transaction("files", "readonly")
              .objectStore("files")
              .get(reference);
            request.onsuccess = () =>
              request.result
                ? resolve(request.result)
                : reject(new Error("Missing retained PDF source."));
            request.onerror = () => reject(request.error);
          });
          if (record.company_id !== companyId)
            throw new Error("Stored PDF company scope mismatch.");
          return {
            company_id: record.company_id,
            type: record.type,
            sha256: record.sha256,
            size: record.source_size,
            bytes: Array.from(
              new Uint8Array(await storedBlob(record, "source").arrayBuffer()),
            ),
          };
        } finally {
          database.close();
        }
      },
      { reference: uploaded, companyId },
    );
  const beforeReload = await storedPdf();
  expect(beforeReload.type).toBe("application/pdf");
  expect(beforeReload.sha256).toBe(expectedHash);
  expect(beforeReload.size).toBe(fixture.buffer.length);
  expect(Buffer.from(beforeReload.bytes)).toEqual(fixture.buffer);
  expect(digest(Buffer.from(beforeReload.bytes))).toBe(expectedHash);
  await page.reload();
  await expect(page.locator(".invoice-pdf-pages")).toContainText("1 / 2");
  expect((await saved(page)).invoice.file_data).toBe(uploaded);
  await expect.poll(() => pixel(0.18)).toEqual([51, 102, 204]);
  const afterReload = await storedPdf();
  expect(afterReload).toEqual(beforeReload);
  expect(Buffer.from(afterReload.bytes)).toEqual(fixture.buffer);
  const downloadEvent = page.waitForEvent("download");
  await page
    .locator(".invoice-original-controls")
    .getByRole("button", { name: "Download", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(fixture.name);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloaded = await readFile(downloadPath!);
  expect(downloaded).toEqual(fixture.buffer);
  expect(digest(downloaded)).toBe(expectedHash);
  await expect(
    page.getByRole("alert").filter({ hasText: "preview could not be opened" }),
  ).toHaveCount(0);
  await expect(page.locator("iframe,embed,object")).toHaveCount(0);
  const evidencePath = testInfo.outputPath("two-page-pdf-bytes-proof.json");
  await writeFile(
    evidencePath,
    JSON.stringify(
      {
        reference: uploaded,
        company_id: companyId,
        original_bytes: fixture.buffer.length,
        original_sha256: expectedHash,
        retained_sha256: afterReload.sha256,
        download_sha256: digest(downloaded),
        exact_bytes_before_after_reload_and_download: true,
        page_one_rgb: [51, 102, 204],
        page_two_rgb: [204, 102, 51],
        first_page_rendered_after_reload: true,
      },
      null,
      2,
    ),
  );
  await testInfo.attach(
    "Two real PDF pages and unchanged source after reload/download",
    {
      path: evidencePath,
      contentType: "application/json",
    },
  );
});
