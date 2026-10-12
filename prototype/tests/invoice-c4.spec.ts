import { expect, test, type Page } from "@playwright/test";
import Decimal from "decimal.js";
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };
import type { DemoState } from "../src/types";
import { setBranch, setLanguage, signIn } from "./helpers";

const storage = "supermarket-prototype-v1";
const originalId = `a2-fixture:${receiptFixtures.invoices[0].number}`;
const saved = (page: Page): Promise<DemoState> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storage);

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
    const row = page
      .locator(".history-table tbody tr")
      .filter({ hasText: fa ? "اصلاح فاکتور" : "Correct invoice" })
      .first();
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
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(twoPagePdf());
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
  const uploaded = (await saved(page)).invoice.file_data;
  expect(uploaded).toMatch(/^data:application\/pdf;base64,/);
  await page.reload();
  await expect(page.locator(".invoice-pdf-pages")).toContainText("1 / 2");
  expect((await saved(page)).invoice.file_data).toBe(uploaded);
  await expect(
    page.getByRole("alert").filter({ hasText: "preview could not be opened" }),
  ).toHaveCount(0);
  await expect(page.locator("iframe,embed,object")).toHaveCount(0);
});
