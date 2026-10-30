import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import readings from "./fixtures/r1-fictional-readings-export.json" with { type: "json" };
import { FILE_DATABASE_NAME } from "../src/file-database";
import Decimal from "decimal.js";
import { inspectC8Layout } from "../scripts/capture-c8-proof.mjs";
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
    const chargeCard = page.locator(".posted-invoice-other-charges");
    await expect(chargeCard).toBeVisible();
    const chargesHeading =
      language === "en"
        ? "Other charges and credits"
        : "هزینه‌ها و اعتبارهای دیگر";
    await expect(
      page.getByRole("heading", { name: chargesHeading, exact: true }),
    ).toHaveCount(1);
    await expect(
      chargeCard.getByRole("heading", {
        name: chargesHeading,
        exact: true,
        level: 2,
      }),
    ).toBeVisible();
    const cardGeometry = await chargeCard.evaluate((card) => {
      const header = card.querySelector(":scope > .ui-card-header")!;
      const heading = header.querySelector("h2")!;
      const bounds = card.getBoundingClientRect(),
        title = heading.getBoundingClientRect();
      const style = getComputedStyle(card);
      const gap =
        style.direction === "rtl"
          ? bounds.right - title.right
          : title.left - bounds.left;
      return {
        height: header.getBoundingClientRect().height,
        titleEdge: Math.abs(gap - parseFloat(style.paddingInlineStart)),
      };
    });
    expect(cardGeometry.height).toBeGreaterThanOrEqual(44);
    expect(cardGeometry.titleEdge).toBeLessThanOrEqual(1.5);
    expect(invoice.other_charges).toHaveLength(2);
    for (const charge of invoice.other_charges!)
      await expect(chargeCard).toContainText(charge.description);

    const references = invoice.original_pages!.map((page) => page.file_data);
    const expectedDigests = entry.pages.map((page) =>
      createHash("sha256")
        .update(Buffer.from(page.data, "base64"))
        .digest("hex"),
    );
    expect(await sourceDigests(page, invoice.company_id, references)).toEqual(
      expectedDigests,
    );
    const originalWidth = page.viewportSize()!.width;
    const weightedIndex = invoice.lines.findIndex(
      (line) => line.sold_by === "weight",
    );
    expect(weightedIndex).toBeGreaterThanOrEqual(0);
    const weightedLine = invoice.lines[weightedIndex];
    expect(weightedLine.source_cost_unit).toBe("kg");
    const currencySymbol = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: before.config.company.currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")!.value;
    const amount =
      currencySymbol +
      new Decimal(
        weightedLine.source_cost_before_tax ??
          weightedLine.unit_cost_before_tax,
      ).toFixed(4);
    expect(amount).toBe("$2.5000");
    const row = page.locator(`[data-posted-line="${weightedIndex}"]`);
    const costs = [];
    for (const width of [1440, 1280, 1000, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const cost = row.locator(
        width < 760
          ? ".receiving-phone-quantity .posted-source-cost"
          : ".receiving-cost-cell > .posted-source-cost",
      );
      await expect(cost).toBeVisible();
      await expect(cost).toHaveText(`${amount}/kg`);
      const proof = await inspectC8Layout(
        page,
        "posted-source-cost",
        language,
        width,
      );
      const geometry = await cost.evaluate((element, phone) => {
        const cell = element.closest("td")!;
        const bounds = cell.getBoundingClientRect();
        const cellStyle = getComputedStyle(cell);
        const start = bounds.left + parseFloat(cellStyle.paddingLeft);
        const end = bounds.right - parseFloat(cellStyle.paddingRight);
        const glyphs = (node: Element) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].filter(
            (rect) => rect.width > 0 && rect.height > 0,
          );
        };
        const atomNodes = [
          ...element.querySelectorAll(":scope > .weight-price-main"),
        ];
        const atoms = atomNodes.map((node) => {
          const rects = glyphs(node);
          return {
            text: node.textContent,
            lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
            width:
              Math.max(...rects.map((rect) => rect.right)) -
              Math.min(...rects.map((rect) => rect.left)),
            contained: rects.every(
              (rect) => rect.left >= start - 1.5 && rect.right <= end + 1.5,
            ),
            fontSize: getComputedStyle(node).fontSize,
            fontWeight: getComputedStyle(node).fontWeight,
          };
        });
        const th = cell.closest("table")!.querySelector("thead tr")!.children[
          cell.cellIndex
        ];
        const values = glyphs(element),
          headings = glyphs(th);
        return {
          atoms,
          cellWidth: bounds.width,
          paddingStart: parseFloat(cellStyle.paddingInlineStart),
          paddingEnd: parseFloat(cellStyle.paddingInlineEnd),
          cellDirection: cellStyle.direction,
          headingDirection: getComputedStyle(th).direction,
          cellAlign: cellStyle.textAlign,
          headingAlign: getComputedStyle(th).textAlign,
          leftDifference: phone
            ? 0
            : Math.abs(
                Math.min(...values.map((rect) => rect.left)) -
                  Math.min(...headings.map((rect) => rect.left)),
              ),
          edgeDifference: phone
            ? 0
            : cellStyle.direction === "rtl"
              ? Math.abs(
                  Math.min(...values.map((rect) => rect.left)) -
                    Math.min(...headings.map((rect) => rect.left)),
                )
              : Math.abs(
                  Math.max(...values.map((rect) => rect.right)) -
                    Math.max(...headings.map((rect) => rect.right)),
                ),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      }, width < 760);
      expect(geometry.cellDirection).toBe(language === "fa" ? "rtl" : "ltr");
      expect(geometry.headingDirection).toBe(language === "fa" ? "rtl" : "ltr");
      expect(geometry.atoms).toHaveLength(2);
      expect(geometry.atoms.map((atom) => atom.text)).toEqual([amount, "/kg"]);
      for (const atom of geometry.atoms) {
        expect(atom.lines).toBe(1);
        expect(atom.contained).toBe(true);
        // Existing shared caption/body tokens are 12/14px; the cost keeps them.
        expect(atom.fontSize).toBe(width < 760 ? "12px" : "14px");
        expect(atom.fontWeight).toBe("500");
      }
      expect(
        geometry.edgeDifference,
        `${width} ${JSON.stringify(geometry)}`,
      ).toBeLessThanOrEqual(1.5);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      if (width >= 760) {
        expect(geometry.paddingStart).toBe(12);
        expect(geometry.paddingEnd).toBe(12);
      }
      costs.push({ width, geometry, proof });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.screenshot({
        path: info.outputPath(`posted-source-cost-${width}-${language}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const unit = row
      .locator(".receiving-cost-cell .posted-source-cost > .weight-price-main")
      .last();
    await unit.evaluate((element) =>
      element.setAttribute(
        "style",
        "white-space: normal; display: inline-block; inline-size: 8px; overflow-wrap: anywhere",
      ),
    );
    const broken = await inspectC8Layout(
      page,
      "posted-source-cost-negative",
      language,
      1280,
    );
    const splitUnitLines = await unit.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(
        [...range.getClientRects()]
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => Math.round(rect.top)),
      ).size;
    });
    expect(splitUnitLines).toBeGreaterThan(1);
    await unit.evaluate((element) => element.removeAttribute("style"));
    const restored = await inspectC8Layout(
      page,
      "posted-source-cost-restored",
      language,
      1280,
    );
    await page.setViewportSize({ width: originalWidth, height: 900 });
    await info.attach("Actual source-cost atoms and unchanged C8 word proof", {
      body: JSON.stringify({ costs, broken }),
      contentType: "application/json",
    });
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
    await writeFile(
      info.outputPath("posted-source-cost-proof.json"),
      JSON.stringify({ costs, restored, broken, splitUnitLines }, null, 2),
    );
    await info.attach("Full unfiltered posted-scene C8 reports", {
      body: JSON.stringify({ costs, restored, broken, splitUnitLines }),
      contentType: "application/json",
    });
    expect([
      ...costs.flatMap((cost) => cost.proof.failures),
      ...restored.failures,
    ]).toEqual([]);
  });
