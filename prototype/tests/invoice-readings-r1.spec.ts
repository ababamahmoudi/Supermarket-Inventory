import { openInvoiceDetails } from "./helpers";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  chooseOption,
  confirmInvoiceLine,
  openShellAction,
  resetDemo,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { assertDashboardOperationalAndShiftTiles } from "./dashboard-kpi-evidence";
import { openReceivingLine, receivingRow } from "./r2-receiving-helpers";

const sampleFile = fileURLToPath(
  new URL("./fixtures/fictional-readings-export.json", import.meta.url),
);
const twoPageFile = fileURLToPath(
  new URL("./fixtures/r1-fictional-readings-export.json", import.meta.url),
);
const fictionalNumber = "R1-2026-002";
const fictionalSupplier = "Maple Test Produce Ltd.";

async function expectWarningBorder(control: Locator) {
  const actual = await control.evaluate((element) => {
    const warning = document.createElement("span");
    warning.style.color = "var(--pending-dot)";
    document.body.append(warning);
    const warningColor = getComputedStyle(warning).color;
    warning.remove();
    const style = getComputedStyle(element);
    return {
      borders: ["top", "right", "bottom", "left"].map((side) => ({
        style: style.getPropertyValue(`border-${side}-style`),
        width: style.getPropertyValue(`border-${side}-width`),
        color: style.getPropertyValue(`border-${side}-color`),
      })),
      warningColor,
    };
  });
  expect(actual.borders).toEqual(
    Array.from({ length: 4 }, () => ({
      style: "solid",
      width: "2px",
      color: actual.warningColor,
    })),
  );
}

async function openData(page: Page) {
  await page.goto("/#settings");
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import invoice readings", exact: true }),
  ).toBeVisible();
}

async function removeFictionalData(page: Page) {
  await openData(page);
  await page
    .getByRole("button", { name: "Remove fictional data…", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Start with an empty store",
    exact: true,
  });
  await expect(
    confirmation.getByText("Pricing rules and categories", { exact: true }),
  ).toBeVisible();
  await confirmation.getByRole("textbox").fill("DELETE");
  await confirmation
    .getByRole("button", { name: "Remove fictional data", exact: true })
    .click();
  await expect
    .poll(async () => {
      const state = await readCanonicalBusinessEvidence(page);
      return {
        products: state.products.length,
        suppliers: state.suppliers?.length,
        invoices: state.invoices?.length,
        ledger: state.ledger.length,
      };
    })
    .toEqual({ products: 0, suppliers: 0, invoices: 0, ledger: 0 });
}

async function chooseImport(page: Page, file: string) {
  await openData(page);
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles(file);
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await expect(preview).toBeVisible();
  const viewport = page.viewportSize()!;
  const bounds = await preview.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  if (viewport.width <= 759)
    expect(Math.round(bounds!.width)).toBe(viewport.width);
  return preview;
}

async function importSelected(page: Page, count: number) {
  await page
    .getByRole("dialog", { name: "Import invoice readings", exact: true })
    .getByRole("button", {
      name: count === 1 ? "Import 1 invoice" : `Import ${count} invoices`,
      exact: true,
    })
    .click();
  const summary = page.getByRole("dialog", {
    name: "Import complete",
    exact: true,
  });
  await expect(summary).toBeVisible();
  return summary;
}

test("Owner imports fictional readings, reviews checks and posts only item lines through normal approvals", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "phone" ? 390 : 1440,
    height: testInfo.project.name === "phone" ? 664 : 900,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await removeFictionalData(page);

  // Establish the supplied fictional sample in the app so the second fixture's
  // duplicate has a genuine persisted original and supplier invoice number.
  let preview = await chooseImport(page, sampleFile);
  await expect(
    preview
      .locator(".invoice-import-status")
      .getByText(/Ready(?: · \d+ to check)?/),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "My checked values", exact: true })
    .click();
  let summary = await importSelected(page, 1);
  await summary.getByText("Open Needs review", { exact: true }).click();
  await expect(
    page.getByRole("tab", { name: /^Needs review \d+$/ }),
  ).toBeVisible();

  preview = await chooseImport(page, twoPageFile);
  await expect(
    preview.getByLabel("Import FV-20417", { exact: true }),
  ).toBeDisabled();
  await expect(
    preview.getByLabel("Import FV-20417", { exact: true }),
  ).not.toBeChecked();
  await expect(
    preview.getByText("Already in the app", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByLabel(`Import ${fictionalNumber}`, { exact: true }),
  ).toBeChecked();
  await expect(
    preview.getByText(fictionalSupplier, { exact: true }),
  ).toBeVisible();
  summary = await importSelected(page, 1);
  await expect(
    summary.getByText("Invoice FV-20417 · Fresh Valley Foods", { exact: true }),
  ).toBeVisible();
  await expect(
    summary.getByText(
      "An original page with the same SHA-256 is already in the app.",
      { exact: true },
    ),
  ).toBeVisible();
  await summary.getByText("Open Needs review", { exact: true }).click();
  await page
    .locator(".invoice-saved-drafts tbody tr")
    .filter({ hasText: fictionalNumber })
    .getByRole("link", { name: fictionalNumber, exact: true })
    .click();

  await expect(page.locator('[data-testid^="invoice-line-row-"]')).toHaveCount(
    2,
  );
  await expect(
    page.locator('[id^="invoice-line-"][id$="-name-en"]'),
  ).toHaveCount(0);
  let firstEditor = await openReceivingLine(page, 0);
  let importedCost = firstEditor.getByLabel("Unit cost before tax", {
    exact: true,
  });
  await expect(importedCost).toHaveValue("2.0000");
  await expect(importedCost).toHaveAttribute("aria-invalid", "false");
  await expect(firstEditor).not.toContainText(
    "Enter a cost of zero or more up to four decimal places.",
  );
  await expectWarningBorder(importedCost);
  await firstEditor.getByRole("button", { name: "Close", exact: true }).click();
  await (await openShellAction(page, "Switch to dark theme")).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  firstEditor = await openReceivingLine(page, 0);
  importedCost = firstEditor.getByLabel("Unit cost before tax", {
    exact: true,
  });
  await expectWarningBorder(importedCost);
  await firstEditor.getByRole("button", { name: "Close", exact: true }).click();
  await (await openShellAction(page, "Switch to light theme")).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(
    page.getByText(/Read by AI · imported file/).first(),
  ).toBeVisible();
  const phone = testInfo.project.name === "phone";
  if (phone)
    await page
      .getByRole("button", { name: "View original (2 pages)", exact: true })
      .click();
  await expect(page.getByLabel("Page 1 of 2", { exact: true })).toBeVisible();
  const originalImage = page
    .locator(".invoice-original-media img")
    .filter({ visible: true });
  await expect(originalImage).toHaveJSProperty("naturalWidth", 760);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByLabel("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(originalImage).toHaveJSProperty("naturalWidth", 760);
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(page.getByLabel("Page 1 of 2", { exact: true })).toBeVisible();
  if (phone)
    await page
      .getByRole("dialog", { name: "Original invoice", exact: true })
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  await expect(
    page.getByRole("heading", {
      name: "Other charges and credits",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Returnable container deposit", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional promotional discount", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Post invoice", exact: true })
    .click({ force: true });
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("not confirmed");
  await expect(
    page.getByRole("dialog", { name: "Post invoice", exact: true }),
  ).toHaveCount(0);
  const beforeReview = await readCanonicalBusinessEvidence(page);
  expect(beforeReview.ledger).toHaveLength(0);
  expect(beforeReview.products).toHaveLength(0);
  // R2 activates imported suppliers immediately and never blocks on contact details.
  await expect(
    page.getByRole("button", { name: "Confirm supplier", exact: true }),
  ).toHaveCount(0);
  expect(
    beforeReview.suppliers?.find(
      (supplier) => supplier.name === fictionalSupplier,
    )?.phone ?? "",
  ).toBe("");
  await openInvoiceDetails(page);
  await page
    .getByRole("button", { name: "Looks right: Invoice details", exact: true })
    .click();
  for (let index = 0; index < 2; index++) {
    const editor = await openReceivingLine(page, index);
    await chooseOption(
      page,
      editor.getByLabel("Pricing category", { exact: true }),
      "grocery",
      "Grocery",
    );
    if (index === 0) {
      await editor
        .getByRole("group", { name: "Track date", exact: true })
        .getByRole("button", { name: "Yes", exact: true })
        .click();
      const date = editor.getByLabel("Date", { exact: true });
      await expect(date).toContainText("2026-11-27");
      await date.click();
      await page
        .getByRole("button", { name: "2026-11-27", exact: true })
        .click();
    } else {
      await expect(
        editor
          .getByRole("group", { name: "Track date", exact: true })
          .getByRole("button", { name: "No", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await expect(
      editor.getByRole("button", { name: /^Looks right:/ }),
    ).toHaveCount(0);
    await confirmInvoiceLine(page, editor);
    await expect(
      receivingRow(page, index).getByRole("img", {
        name: "Confirmed",
        exact: true,
      }),
    ).toBeVisible();
    await expect(editor).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Looks right: Totals", exact: true })
    .click();
  await expect(page.getByText("Please check", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoices?.find(
          (invoice) => invoice.supplier_invoice_number === fictionalNumber,
        )?.status,
    )
    .toBe("posted");
  const posted = await readCanonicalBusinessEvidence(page);
  expect(posted.products).toHaveLength(2);
  expect(posted.products.map((product) => product.name_en)).toEqual(
    expect.arrayContaining([
      "R1 Fictional Dry Beans 500 g",
      "R1 Fictional Bulk Lentils",
    ]),
  );
  expect(
    posted.products.every((product) => product.status === "pending_approval"),
  ).toBe(true);
  expect(
    posted.ledger
      .filter((entry) => entry.supplier === fictionalSupplier)
      .map((entry) => entry.amount),
  ).toEqual(["10.00"]);
  expect(
    posted.stock_movements?.filter(
      (entry) => entry.invoice_id === posted.invoice.id,
    ),
  ).toHaveLength(2);
  await expect(
    page.getByRole("heading", {
      name: "Other charges and credits",
      exact: true,
    }),
  ).toBeVisible();

  await page.goto("/#approvals");
  for (const productName of [
    "R1 Fictional Dry Beans 500 g",
    "R1 Fictional Bulk Lentils",
  ]) {
    const card = page.locator("section.card").filter({
      has: page.getByRole("heading", { name: productName, exact: true }),
    });
    await card
      .getByRole("button", { name: "Approve product", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Review approval", exact: true })
      .getByRole("button", { name: "Approve product", exact: true })
      .click();
  }
  await expect
    .poll(async () =>
      (await readCanonicalBusinessEvidence(page)).products.every(
        (product) => product.status === "active",
      ),
    )
    .toBe(true);
  await (await openShellAction(page, "Demo")).click();
  await page.getByRole("menuitem", { name: "Reset demo", exact: true }).click();
  const reset = page.getByRole("dialog", { name: "Reset demo", exact: true });
  await expect(reset).toContainText("This also removes invoices you imported.");
  await reset.getByRole("button", { name: "Cancel", exact: true }).click();
  await resetDemo(page);
  await expect
    .poll(
      async () => (await readCanonicalBusinessEvidence(page)).products.length,
    )
    .toBeGreaterThan(2);
  expect(
    (await readCanonicalBusinessEvidence(page)).invoices?.some(
      (invoice) => invoice.supplier_invoice_number === fictionalNumber,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("an empty store renders intentional lists at desktop and phone widths in English and Persian", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "phone" ? 390 : 1440,
    height: 900,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await removeFictionalData(page);
  for (const language of ["en", "fa"] as const) {
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    await assertDashboardOperationalAndShiftTiles(page, {
      language,
      navigate: false,
    });
    const operationalValues = page.locator(
      ".dashboard-kpis > .ui-summary-tile:not(.timesheet-on-shift-tile) > .kpi-value",
    );
    await expect(operationalValues).toHaveCount(5);
    await expect(operationalValues).toHaveText(["0", "0", "0", "0", "0"]);
    await expect(
      page.locator(".timesheet-on-shift-tile > .kpi-value"),
    ).toHaveText("0");
    for (const route of [
      "lookup",
      "products",
      "suppliers",
      "invoices",
      "received",
      "returns",
      "labels",
      "offers",
      "price-updates",
      "expiry",
      "orders",
      "payables",
    ]) {
      await page.goto(`/#${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main .empty-state").first()).toBeVisible();
      await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
  }
  expect(errors).toEqual([]);
});

test("invalid JSON exports stay outside the store and explain the format problem", async ({
  page,
}) => {
  await signIn(page, "Owner");
  await openData(page);
  const before = await readCanonicalBusinessEvidence(page);
  const fictional = JSON.parse(readFileSync(sampleFile, "utf8"));
  fictional.version = 99;
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles({
    name: "fictional-wrong-version.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fictional)),
  });
  await expect(page.getByRole("alert")).toContainText(/version/i);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.suppliers).toEqual(before.suppliers);
  expect(after.activity).toEqual(before.activity);
});
