import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import readings from "./fixtures/r1-fictional-readings-export.json" with { type: "json" };
import { FILE_DATABASE_NAME } from "../src/file-database";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  chooseOption,
  confirmInvoiceLine,
  openInvoiceDetails,
  openInvoiceLine,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";

async function sourceDigests(
  page: Page,
  companyId: string,
  references: string[],
) {
  return page.evaluate(
    async ({ databaseName, companyId, references }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onupgradeneeded = () => {
          request.transaction!.abort();
          reject(new Error("Original evidence must already exist."));
        };
        request.onerror = request.onblocked = () =>
          reject(new Error("Cannot read original evidence."));
        request.onsuccess = () => resolve(request.result);
      });
      try {
        const records = await new Promise<
          { company_id: string; source: Blob | ArrayBuffer; sha256: string }[]
        >((resolve, reject) => {
          const transaction = database.transaction("files", "readonly");
          const records: {
            company_id: string;
            source: Blob | ArrayBuffer;
            sha256: string;
          }[] = [];
          references.forEach((reference, index) => {
            const request = transaction.objectStore("files").get(reference);
            request.onsuccess = () => {
              records[index] = request.result;
            };
          });
          transaction.oncomplete = () => resolve(records);
          transaction.onerror = transaction.onabort = () =>
            reject(new Error("Cannot read retained source bytes."));
        });
        return await Promise.all(
          records.map(async (record) => {
            if (record?.company_id !== companyId)
              throw new Error("Original company differs.");
            const bytes =
              record.source instanceof Blob
                ? await record.source.arrayBuffer()
                : record.source;
            if (!(bytes instanceof ArrayBuffer))
              throw new Error("Unknown retained source encoding.");
            const digest = Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            )
              .map((value) => value.toString(16).padStart(2, "0"))
              .join("");
            if (digest !== record.sha256)
              throw new Error("Retained source digest changed.");
            return digest;
          }),
        );
      } finally {
        database.close();
      }
    },
    { databaseName: FILE_DATABASE_NAME, companyId, references },
  );
}

for (const language of ["en", "fa"] as const)
  test(`C1 posted imports retain every model in closed Reading evidence ${language}`, async ({
    page,
  }, info) => {
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await page.goto("/#invoices");
    await page
      .getByRole("button", { name: "New invoice", exact: true })
      .click();
    const chooser = page.getByRole("dialog", {
      name: "New invoice",
      exact: true,
    });
    const [fileChoice] = await Promise.all([
      page.waitForEvent("filechooser"),
      chooser.getByRole("button", { name: "JSON file", exact: true }).click(),
    ]);
    const entry = readings.invoices[0];
    await fileChoice.setFiles({
      name: "fictional-c1-posted-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...readings, invoices: [entry] })),
    });
    const preview = page.getByRole("dialog", {
      name: "Import invoice readings",
      exact: true,
    });
    await expect(preview).toBeVisible();
    await preview
      .getByRole("button", { name: "My checked values", exact: true })
      .click();
    await preview
      .getByRole("button", { name: "Import 1 invoice", exact: true })
      .click();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    const imported = (await readCanonicalBusinessEvidence(page)).invoice;
    expect(imported.reading_record?.source).toBe("imported");
    expect(imported.reading_record?.models).toEqual(entry.ai_models);
    expect(imported.original_pages).toHaveLength(entry.pages.length);
    await openInvoiceDetails(page);
    await page
      .getByRole("button", {
        name: "Looks right: Invoice details",
        exact: true,
      })
      .click();
    for (let index = 0; index < imported.lines.length; index++) {
      const editor = await openInvoiceLine(page, index);
      await chooseOption(
        page,
        editor.getByLabel("Pricing category", { exact: true }),
        "grocery",
        "Grocery",
      );
      await editor
        .getByRole("group", { name: "Track date", exact: true })
        .getByRole("button", { name: "No", exact: true })
        .click();
      await confirmInvoiceLine(page, editor);
    }
    await page
      .getByRole("button", { name: "Looks right: Totals", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Post invoice", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Post invoice", exact: true })
      .getByRole("button", { name: "Post invoice", exact: true })
      .click();
    await expect(page.locator(".posted-invoice-document")).toBeVisible();
    await setLanguage(page, language);
    const before = await readCanonicalBusinessEvidence(page);
    const invoice = before.invoices!.find(
      (invoice) => invoice.id === imported.id,
    )!;
    expect(invoice.status).toBe("posted");
    expect(invoice.reading_record).toEqual(imported.reading_record);
    const references = invoice.original_pages!.map((page) => page.file_data);
    const expectedDigests = entry.pages.map((page) =>
      createHash("sha256")
        .update(Buffer.from(page.data, "base64"))
        .digest("hex"),
    );
    expect(await sourceDigests(page, invoice.company_id, references)).toEqual(
      expectedDigests,
    );
    const header = page.locator(".posted-receiving > .receiving-header");
    await expect(header).toContainText(
      language === "en"
        ? "Read by AI · imported file"
        : "خوانده‌شده با هوش مصنوعی · فایل واردشده",
    );
    await expect(header).not.toContainText(
      /AI reading, imported \(not live\)|خوانش هوش مصنوعی، واردشده/,
    );
    for (const model of entry.ai_models)
      await expect(header).not.toContainText(model);
    const more = page.locator(".posted-receiving .receiving-more");
    await expect(more).not.toHaveAttribute("open");
    const reading = more.getByRole("heading", {
      name: language === "en" ? "Reading" : "خوانش",
      exact: true,
    });
    await expect(reading).not.toBeVisible();
    await more.locator(":scope > summary").click();
    await expect(more).toHaveAttribute("open", "");
    await expect(reading).toBeVisible();
    for (const model of entry.ai_models)
      await expect(more).toContainText(model);
    await expect(
      more.locator(".receiving-reading-evidence > p").last().locator("bdi"),
    ).toHaveText(entry.ai_models.join(", "));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: info.outputPath(`posted-reading-${language}.png`),
      fullPage: true,
    });
    expect(await sourceDigests(page, invoice.company_id, references)).toEqual(
      expectedDigests,
    );
    const correctionTitle =
      language === "en" ? "Correct invoice" : "اصلاح فاکتور";
    await header
      .getByRole("button", { name: correctionTitle, exact: true })
      .click();
    const correction = page.getByRole("dialog", {
      name: correctionTitle,
      exact: true,
    });
    await expect(correction).toBeVisible();
    await correction
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    await expect(correction).not.toBeVisible();
    const after = await readCanonicalBusinessEvidence(page);
    for (const key of [
      "invoices",
      "invoice_content_corrections",
      "invoice_received_corrections",
      "invoice_location_corrections",
      "stock_movements",
      "ledger",
      "products",
      "approvals",
    ] as const)
      expect(after[key]).toEqual(before[key]);
    await expect(page).toHaveURL((url) =>
      url.hash.includes(encodeURIComponent(invoice.id)),
    );
    await expect(
      header.getByRole("link", {
        name: language === "en" ? "Invoices" : "فاکتورها",
        exact: true,
      }),
    ).toHaveAttribute("href", "#invoices");
    expect(
      await page.locator(".posted-receiving").getAttribute("data-can-correct"),
    ).toBe("true");
    await page.reload();
    await expect(page.locator(".posted-receiving")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(
      page.locator(".posted-receiving .receiving-more > summary"),
    ).toBeVisible();
    await expect(
      page.locator(".posted-receiving .receiving-more"),
    ).not.toHaveAttribute("open");
    await expect(
      page.locator(".posted-receiving > .receiving-header"),
    ).not.toContainText(entry.ai_models.join(", "));
  });
