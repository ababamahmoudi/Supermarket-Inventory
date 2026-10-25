import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import {
  signIn,
  setLanguage,
  openShellAction,
  openInvoiceUpload,
  openInvoiceLine,
  confirmInvoiceLine,
  chooseOption,
} from "./helpers";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };

test.setTimeout(60000);
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUjYAAAAASUVORK5CYII=",
  "base64",
);
async function review(page: import("@playwright/test").Page) {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await (
    await openInvoiceUpload(page)
  ).setInputFiles({
    name: "fictional-a2-invoice.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(page.locator('[data-testid^="invoice-line-row-"]')).toHaveCount(
    6,
    {
      timeout: 10000,
    },
  );
  // Existing seed lines can render before the uploaded original and its
  // simulated reading transition finish. Geometry and edits must use the
  // committed upload rather than the previous workspace during that change.
  await expect
    .poll(() =>
      readCanonicalBusinessEvidence(page).then((canonicalState) => {
        const invoice = JSON.parse(JSON.stringify(canonicalState)!).invoice;
        return {
          fileName: invoice.file_name,
          originalHash: invoice.file_data?.split(":").at(-1),
          status: invoice.status,
        };
      }),
    )
    .toEqual({
      fileName: "fictional-a2-invoice.png",
      originalHash: createHash("sha256").update(pixel).digest("hex"),
      status: "review",
    });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}
test("invoice lines start closed, confirm once and reopen without opening the next line", async ({
  page,
}, testInfo) => {
  await review(page);
  const rows = page.locator('[data-testid^="invoice-line-row-"]');
  await expect(rows).toHaveCount(6);
  await expect(page.locator(".receiving-line-editor")).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", {
      name: "Confirm date tracking decision",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", {
      name: "Track a date for this line",
      exact: true,
    }),
  ).toHaveCount(0);
  const post = page.getByRole("button", { name: "Post invoice", exact: true });
  await expect(post).toBeEnabled();
  await post.focus();
  await expect(post.locator("..").getByRole("tooltip")).toContainText(
    /Lines: 6 not confirmed/,
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("Lines: 6 not confirmed");
  const first = rows.first();
  const editor = await openInvoiceLine(page, 0);
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await editor
    .getByRole("group", { name: "Track date", exact: true })
    .getByRole("button", { name: "No", exact: true })
    .click();
  await confirmInvoiceLine(page, editor);
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".receiving-line-editor")).toHaveCount(0);
  await expect(
    first.getByRole("img", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  const reopened = await openInvoiceLine(page, 0);
  await expect(first).toHaveAttribute("aria-expanded", "true");
  if (testInfo.project.name === "phone")
    await reopened.getByRole("button", { name: "Close", exact: true }).click();
  else await first.getByRole("cell").nth(2).click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(rows.nth(4)).toContainText("New product");
  await expect(
    rows.nth(2).getByRole("img", { name: "Not confirmed", exact: true }),
  ).toBeVisible();
  const canonical = await readCanonicalBusinessEvidence(page);
  expect(canonical.invoice.lines[4].product_code).toBe("NEW");
  expect(canonical.invoice.lines[2]).toMatchObject({
    calculated_selling_price: "2.99",
    current_selling_price: "1.99",
  });
  expect(
    canonical.approvals.filter(
      (approval) => approval.source_invoice_id === canonical.invoice.id,
    ),
  ).toHaveLength(0);
});

test("Persian signed money, line numbers and short deduction remain isolated", async ({
  page,
}) => {
  await review(page);
  const editor = await openInvoiceLine(page, 5);
  await editor
    .getByRole("button", { name: "Report short or refused", exact: true })
    .click();
  await editor.getByLabel("Short units", { exact: true }).fill("4");
  const equation = editor.locator("p").filter({ hasText: "Deduction:" });
  await expect(equation).toContainText("4 units × $1.6000");
  await expect(equation).toContainText("$6.40");
  await expect(equation.locator('bdi[dir="ltr"]').first()).toContainText(
    "4 units × $1.6000",
  );
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await setLanguage(page, "fa");
  const deduction = page
    .getByTestId("invoice-totals-card")
    .locator(".receiving-total-row")
    .filter({ hasText: "کسری‌ها و ردشده‌ها" });
  await expect(deduction).toContainText("-$7.23");
  await expect(deduction.locator('bdi[dir="ltr"]')).toContainText("-$7.23");
  const numberCell = page
    .getByTestId("invoice-line-row-0")
    .locator('td[data-column-key="number"]');
  await expect(numberCell).toBeVisible();
  await expect(numberCell.locator('bdi[dir="ltr"]')).toHaveText("1");
  const canonical = await readCanonicalBusinessEvidence(page);
  expect(canonical.invoice.lines[5]).toMatchObject({
    qty_invoiced: 12,
    qty_received_at_posting: 8,
  });
});

test("the original sticks beside the work column and the progress bar has a full surface", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "Phone review uses a full-screen original viewer and bottom progress bar.",
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await review(page);
  const layout = await page.locator(".receiving-layout").boundingBox();
  const work = await page.locator(".receiving-work").boundingBox();
  const original = page.locator(".original-viewer");
  const panel = await original.boundingBox();
  expect(panel!.x).toBeGreaterThan(work!.x + work!.width);
  expect(work!.width / (layout!.width - 16)).toBeCloseTo(0.6, 1);
  expect(panel!.width / (layout!.width - 16)).toBeCloseTo(0.4, 1);
  await expect(original).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 450));
  const sticky = await original.boundingBox();
  const top = await original.evaluate((node) =>
    parseFloat(getComputedStyle(node).top),
  );
  expect(Math.abs(sticky!.y - top)).toBeLessThanOrEqual(2);
  const progress = page.locator(".receiving-progress");
  await expect(progress).toHaveCSS("position", "sticky");
  expect(
    await progress.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await expect(
    page
      .locator(".receiving-header")
      .getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("manual invoice drafts work when randomUUID is unavailable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByRole("combobox", {
      name: "Add a product to the invoice",
      exact: true,
    }),
    "0002",
    "Canned Fava Beans 400 g",
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.innerWidth === document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await expect(page).toHaveURL(/#invoices$/);
  const invoice = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  await page.goto(`/#invoices?id=${encodeURIComponent(invoice.id)}`);
  await page.reload();
  await expect(page.locator('[data-testid^="invoice-line-row-"]')).toHaveCount(
    1,
  );
  expect(invoice.status).toBe("draft");
  expect(typeof invoice.id).toBe("string");
  expect(invoice.id.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => typeof globalThis.crypto.randomUUID)).toBe(
    "undefined",
  );
  expect(errors).toEqual([]);
});

test("fictional invoice answers are available only inside Demo and retain Persian copy", async ({
  page,
}) => {
  await review(page);
  await expect(
    page.getByText("Use fictional demo answer", { exact: true }),
  ).toHaveCount(0);
  await (await openShellAction(page, "Demo")).click();
  await page
    .getByRole("menuitem", { name: "Use fictional demo answer", exact: true })
    .click();
  await expect(
    page.getByLabel(
      "Is the expiry date the same as the goods already in the store?",
      {
        exact: true,
      },
    ),
  ).toHaveText("No, different dates");
  await expect(
    page.getByText("Use fictional demo answer", { exact: true }),
  ).toHaveCount(0);
  await setLanguage(page, "fa");
  await expect(
    page.getByLabel("آیا تاریخ انقضا با کالاهای موجود در فروشگاه یکسان است؟", {
      exact: true,
    }),
  ).toHaveText("خیر، تاریخ‌های متفاوت");
  const answer = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) =>
      JSON.parse(JSON.stringify(canonicalState)!).invoice.lower_price_answers,
  );
  expect(answer.same_expiry).toBe("no");
  expect(answer.old_expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(answer.new_expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(answer.units_left).toBeGreaterThan(0);
});

test("Supplier invoice links open the actual posted document and retained original image in either language", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Supervisor");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Invoices", exact: true }).click();
  const openedSupplierInvoices = page.locator(".supplier-tab-card");
  const invoiceLink = openedSupplierInvoices.getByRole("link", {
    name: "FV-20390",
    exact: true,
  });
  if (!(await invoiceLink.isVisible())) {
    const details = openedSupplierInvoices.getByRole("button", {
      name: "Show details",
      exact: true,
    });
    for (let index = 0; index < (await details.count()); index += 1) {
      await details.nth(index).click();
      if (await invoiceLink.isVisible()) break;
    }
  }
  await invoiceLink.click();
  await expect(page).toHaveURL(/#invoices\?id=/);
  const phone = (page.viewportSize()?.width ?? 1440) < 760;
  const originalDialog = () =>
    page.getByRole("dialog", {
      name: /^(Original invoice|اصل فاکتور)$/,
    });
  const showOriginal = async () => {
    if (!phone) return;
    await page
      .getByRole("button", { name: /^(View original|مشاهده اصل)/ })
      .click();
    await expect(originalDialog()).toBeVisible();
  };
  await showOriginal();
  const original = page.locator(".invoice-original-media img:visible");
  await expect(original).toHaveCount(1);
  await expect(original).toBeVisible();
  await expect(original).toHaveJSProperty("complete", true);
  expect(
    await original.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  const source = await original.evaluate(async (image) => {
    const data = image.getAttribute("src")!;
    const bytes = await (await fetch(data)).arrayBuffer();
    const document = new DOMParser().parseFromString(
      new TextDecoder().decode(bytes),
      "image/svg+xml",
    );
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return {
      data,
      sha256: Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      text: Array.from(document.querySelectorAll("text")).map(
        (entry) => entry.textContent,
      ),
    };
  });
  expect(source.text).toContain("FV-20390");
  expect(source.text).toContain("Fresh Valley Foods");
  const receipt = receiptFixtures.invoices.find(
    (invoice) => invoice.number === "FV-20390",
  )!;
  for (const line of receipt.lines) {
    const product = demoSeed.products.find(
      (item) => item.code === line.product_code,
    );
    const name =
      line.product_code === "0015"
        ? demoSeed.demo_invoice.lines.find(
            (item) => item.product_code === "NEW",
          )!.description
        : product?.name_en;
    expect(name).toBeDefined();
    expect(source.text).toContain(name);
    expect(source.text).toContain(new Decimal(line.unit_cost).toFixed(4));
    expect(source.text).toContain(
      new Decimal(line.unit_cost).times(line.qty).toFixed(2),
    );
  }
  const invoice = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(invoice.supplier_invoice_number).toBe("FV-20390");
  expect(invoice.status).toBe("posted");
  expect(invoice.file_type).toBe("image/svg+xml");
  expect(invoice.file_data).toMatch(/^idb-file:v1:/);
  const retainedSource = await page.evaluate(async (reference: string) => {
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
      const request = indexedDB.open("supermarket-prototype-files-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{
        source: Blob | ArrayBuffer;
        source_mime_type?: string;
        binary_encoding?: "array-buffer-v1";
      }>((resolve, reject) => {
        const request = database
          .transaction("files", "readonly")
          .objectStore("files")
          .get(reference);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return storedBlob(record, "source").text();
    } finally {
      database.close();
    }
  }, invoice.file_data);
  expect(retainedSource).toContain("Fresh Valley Foods");
  expect(retainedSource).toContain(invoice.final_total);
  expect(retainedSource).toBe(
    await original.evaluate(async (image) =>
      (await fetch(image.getAttribute("src")!)).text(),
    ),
  );
  expect(source.text).toContain(invoice.final_total);
  const document = page.locator(".posted-invoice-document");
  await expect(document).toContainText("FV-20390");
  await expect(document.locator("input,select,textarea")).toHaveCount(0);
  await expect(page.locator(".invoice-preview-text")).toHaveCount(0);
  if (phone) {
    await originalDialog().locator(".ui-dialog-header .ui-icon-button").click();
    await expect(originalDialog()).not.toBeVisible();
  }
  await setLanguage(page, "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await showOriginal();
  if (phone) {
    // Closing/reopening the fullscreen viewer creates a new Blob URL. The
    // source bytes must remain identical across the language change.
    const translatedSource = await original.evaluate(async (image) => {
      const bytes = await (
        await fetch(image.getAttribute("src")!)
      ).arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return {
        text: new TextDecoder().decode(bytes),
        sha256: Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join(""),
      };
    });
    expect(translatedSource).toEqual({
      text: retainedSource,
      sha256: source.sha256,
    });
  } else await expect(original).toHaveAttribute("src", source.data);
  await expect(document).toContainText("FV-20390");
  await page.reload();
  await showOriginal();
  await expect(original).toBeVisible();
  await expect(original).toHaveJSProperty("complete", true);
  expect(
    await original.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  const reloadedSource = await original.evaluate(async (image) => {
    const bytes = await (await fetch(image.getAttribute("src")!)).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return {
      text: new TextDecoder().decode(bytes),
      sha256: Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    };
  });
  expect(reloadedSource.text).toBe(retainedSource);
  expect(reloadedSource.sha256).toBe(source.sha256);
  expect(
    await readCanonicalBusinessEvidence(page).then(
      (canonicalState) =>
        JSON.parse(JSON.stringify(canonicalState)!).invoice.file_data,
    ),
  ).toBe(invoice.file_data);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(document).toContainText("FV-20390");
  expect(errors).toEqual([]);
});
