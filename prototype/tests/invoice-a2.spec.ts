import { expect, test } from "@playwright/test";
import Decimal from "decimal.js";
import {
  signIn,
  setLanguage,
  openShellAction,
  openInvoiceUpload,
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
  await expect(page.locator(".invoice-line")).toHaveCount(6, {
    timeout: 10000,
  });
}
test("each invoice line requires one date answer, collapses when confirmed and opens from the row", async ({
  page,
}) => {
  await review(page);
  const lines = page.locator(".invoice-line");
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
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toBeVisible();
  const first = lines.first();
  await first
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(first).toHaveAttribute("data-expanded", "true");
  await first.getByRole("button", { name: "No", exact: true }).click();
  await first
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(first).toHaveAttribute("data-expanded", "false");
  await expect(first.locator(".invoice-line-detail")).toHaveCount(0);
  await first.locator(".invoice-line-toggle").click();
  await expect(first).toHaveAttribute("data-expanded", "true");
  await first.locator(".invoice-line-summary td").nth(3).click();
  await expect(first).toHaveAttribute("data-expanded", "false");
  await expect(
    lines.nth(4).getByText("No Product Code yet", { exact: true }),
  ).toBeVisible();
  await expect(
    lines.nth(2).getByText("Pending", { exact: true }),
  ).toBeVisible();
  await expect(
    lines.nth(2).getByText("Goes to approval when posted", { exact: true }),
  ).toBeVisible();
  const section = page.locator(".invoice-summary-section");
  expect(
    await section
      .locator(".invoice-summary-note")
      .evaluate((note) =>
        Math.round(
          note.getBoundingClientRect().top -
            note.previousElementSibling!.getBoundingClientRect().bottom,
        ),
      ),
  ).toBe(16);
});
test("Persian signed money, line numbers and deduction parentheses stay isolated", async ({
  page,
}) => {
  await review(page);
  await page
    .locator(".invoice-line")
    .nth(5)
    .getByRole("checkbox", { name: "Mark as short", exact: true })
    .check();
  await setLanguage(page, "fa");
  const deduction = page
    .locator(".invoice-summary-grid .ui-summary-tile")
    .nth(2);
  await expect(deduction).toContainText("-$7.23");
  await expect(deduction.locator('bdi[dir="ltr"]')).toContainText("-$7.23");
  await expect(page.locator(".invoice-line-toggle > bdi").first()).toHaveText(
    "1.",
  );
  const parentheses = page
    .locator(".invoice-line")
    .nth(5)
    .locator(".banner > bdi")
    .last();
  await expect(parentheses).toHaveAttribute("dir", "ltr");
  await expect(parentheses).toContainText("($6.40 + $0.83 )");
});
test("the document sticks beside the review and the action bar has a full surface", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "Phone review uses one stacked column.",
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await review(page);
  await page.evaluate(() => window.scrollTo(0, 450));
  const pane = await page.locator(".invoice-document-pane").boundingBox();
  const topbar = await page.locator(".topbar").boundingBox();
  expect(pane!.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height + 22);
  expect(pane!.y).toBeLessThanOrEqual(topbar!.y + topbar!.height + 26);
  const reviewPane = await page.locator(".invoice-review-pane").boundingBox();
  const footer = await page.locator(".invoice-action-footer").boundingBox();
  // The C7 bar reserves its own row below the review pane instead of stretching across the original.
  expect(Math.abs(reviewPane!.width - footer!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(reviewPane!.x - footer!.x)).toBeLessThanOrEqual(2);
  expect(footer!.y).toBeGreaterThanOrEqual(reviewPane!.y + reviewPane!.height);
  await expect(page.locator(".invoice-action-footer")).toHaveCSS(
    "position",
    "static",
  );
  expect(
    await page
      .locator(".invoice-action-footer")
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
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
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
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
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  const invoice = await page.evaluate(
    () => JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice,
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
  const answer = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice
        .lower_price_answers,
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
  const original = page.locator(".invoice-original-media img");
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
  const invoice = await page.evaluate(
    () => JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice,
  );
  expect(invoice.supplier_invoice_number).toBe("FV-20390");
  expect(invoice.status).toBe("posted");
  expect(invoice.file_type).toBe("image/svg+xml");
  expect(invoice.file_data).toMatch(/^idb-file:v1:/);
  const retainedSource = await page.evaluate(async (reference: string) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("supermarket-prototype-files-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{ source: Blob }>((resolve, reject) => {
        const request = database
          .transaction("files", "readonly")
          .objectStore("files")
          .get(reference);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return record.source.text();
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
  await setLanguage(page, "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(original).toHaveAttribute("src", source.data);
  await expect(document).toContainText("FV-20390");
  await page.reload();
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
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice
          .file_data,
    ),
  ).toBe(invoice.file_data);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(document).toContainText("FV-20390");
  expect(errors).toEqual([]);
});
