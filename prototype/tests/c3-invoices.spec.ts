import { expect, test, type Page } from "@playwright/test";
import { setLanguage, signIn, uploadInvoice } from "./helpers";
import type { DemoState } from "../src/types";
import type { Order } from "../src/orders";

test.setTimeout(60000);
const storage = "supermarket-prototype-v1";

async function reviewWithComparison(page: Page) {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await uploadInvoice(page);
  await page.evaluate((key) => {
    const state: DemoState = JSON.parse(localStorage.getItem(key)!);
    const invoice = state.invoice;
    const item = invoice.lines[0];
    const product = state.products.find(
      (entry) => entry.code === item.product_code,
    )!;
    const supplier = state.suppliers!.find(
      (entry) => entry.name === invoice.supplier,
    )!;
    const order: Order = {
      id: "c3-layout-order",
      company_id: invoice.company_id,
      branch: invoice.branch,
      supplier: invoice.supplier,
      supplier_id: supplier.id,
      reference: "ORD-C3-LAYOUT",
      date: invoice.invoice_date!,
      currency: state.config.company.currency,
      status: "ordered",
      created_at: invoice.received_at!,
      created_by: "Fictional layout fixture",
      expected_total_before_tax: "0.90",
      source_note_ids: [],
      linked_invoice_ids: [],
      version: 1,
      receipts: [],
      lines: [
        {
          id: "c3-layout-line",
          company_id: invoice.company_id,
          supplier_item_id: item.supplier_item_id ?? "c3-layout-item",
          product_code: item.product_code,
          supplier_item_code: item.supplier_item_code ?? "",
          name_en: product.name_en,
          name_fa: product.name_fa,
          unit_size: product.unit_size,
          units_per_case: item.units_per_case ?? 1,
          ordered_cases: "1",
          ordered_units: 1,
          expected_unit_cost: "0.9000",
          expected_case_cost: "0.9000",
          expected_line_total: "0.90",
          expected_cost_source: "entered",
          received_units: 0,
          cancelled_units: 0,
          source_note_ids: [],
        },
      ],
    };
    state.orders = [order];
    localStorage.setItem(key, JSON.stringify(state));
  }, storage);
  await page.reload();
  await page.getByLabel("Order (optional)", { exact: true }).click();
  await page.getByRole("option", { name: /ORD-C3-LAYOUT/ }).click();
  await expect(page.locator(".invoice-order-table tbody tr")).toHaveCount(6);
  await expect(page.locator(".invoice-order-costs").first()).toBeVisible();
  await expect(
    page.locator(".invoice-line-price .badge").first(),
  ).toBeVisible();
}

async function invoiceGeometry(page: Page) {
  return page.evaluate(() => {
    const failures: string[] = [];
    const area = document.querySelector("#main-content")!;
    const visible = (node: Element) =>
      node.getClientRects().length &&
      getComputedStyle(node).visibility !== "hidden";
    for (const panel of area.querySelectorAll<HTMLElement>(
      ".card,.table-wrap,table,.invoice-workspace,.invoice-document-pane,.invoice-review-pane,.invoice-line-review,.invoice-action-footer,.invoice-preview,.invoice-preview-text",
    )) {
      if (!visible(panel)) continue;
      const bounds = panel.getBoundingClientRect();
      if (panel.scrollWidth > panel.clientWidth + 2)
        failures.push(
          `Sideways panel: ${panel.className} ${panel.scrollWidth}/${panel.clientWidth}`,
        );
      if (bounds.left < -2 || bounds.right > window.innerWidth + 2)
        failures.push(`Outside viewport: ${panel.className}`);
    }
    for (const cell of area.querySelectorAll<HTMLElement>("td,th")) {
      if (!visible(cell)) continue;
      const bounds = cell.getBoundingClientRect();
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!node.textContent?.trim() || !parent || !visible(parent)) continue;
        const parentBounds = parent.getBoundingClientRect();
        // The accessible labels in summary cells intentionally occupy a 1px box.
        if (
          parentBounds.width <= 2 ||
          parent.closest(".sr-only,.visually-hidden")
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
            failures.push(
              `Clipped cell text: ${node.textContent.trim().slice(0, 100)}`,
            );
        }
      }
      for (const control of cell.querySelectorAll<HTMLElement>(
        "button,input,[role=combobox],.badge",
      )) {
        if (!visible(control)) continue;
        const rect = control.getBoundingClientRect();
        if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
          failures.push(
            `Clipped cell control: ${control.textContent?.trim() || control.getAttribute("aria-label")}`,
          );
      }
    }
    const text = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      const node = text.currentNode;
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || !visible(parent)) continue;
      if (parent.closest("td,th,.sr-only,.visually-hidden")) continue;
      if (parent.getBoundingClientRect().width <= 2) continue;
      const panel = parent.closest(
        ".card,.ui-summary-tile,.invoice-action-footer",
      );
      if (!panel) continue;
      const bounds = panel.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
          failures.push(
            `Clipped panel text: ${node.textContent.trim().slice(0, 100)}`,
          );
      }
    }
    return failures;
  });
}

for (const width of [1280, 1440, 1920]) {
  for (const language of ["en", "fa"] as const) {
    for (const dark of [false, true]) {
      test(`invoice names, Pending and order cost decisions fit every panel at ${width} in ${language} ${dark ? "dark" : "light"}`, async ({
        page,
      }, testInfo) => {
        test.skip(
          testInfo.project.name === "phone",
          "This proof exercises the three required desktop widths.",
        );
        await page.setViewportSize({ width, height: 1080 });
        await reviewWithComparison(page);
        if (dark)
          await page
            .getByRole("button", { name: "Switch to dark theme", exact: true })
            .click();
        if (language === "fa") await setLanguage(page, "fa");
        await page.evaluate(() => document.fonts.ready);
        expect(await invoiceGeometry(page)).toEqual([]);
        const panes = await page
          .locator(".invoice-workspace")
          .evaluate((element) => {
            const original = element
              .querySelector(".invoice-document-pane")!
              .getBoundingClientRect();
            const review = element
              .querySelector(".invoice-review-pane")!
              .getBoundingClientRect();
            return { originalBottom: original.bottom, reviewTop: review.top };
          });
        if (width < 1800)
          expect(panes.reviewTop).toBeGreaterThanOrEqual(panes.originalBottom);
      });
    }
  }
}

test("posted invoice Columns persist, and detail/browser Back retain the Posted list", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("tab", { name: "Posted", exact: true }).click();
  await expect(
    page.locator(".invoice-posted-table tbody tr").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  const columns = page.getByRole("dialog", { name: "Columns", exact: true });
  await expect(
    columns.getByRole("checkbox", { name: "Invoice", exact: true }),
  ).toBeDisabled();
  await columns
    .getByRole("checkbox", { name: "Supplier", exact: true })
    .uncheck();
  await columns.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator(".invoice-posted-table th[data-column-key=supplier]"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Posted", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator(".invoice-posted-table th[data-column-key=supplier]"),
  ).toHaveCount(0);
  await page
    .locator(".invoice-posted-table")
    .getByRole("button", { name: "View invoice", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/#invoices\?id=/);
  await expect(
    page.getByRole("link", { name: "Back to Invoices", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#invoices$/);
  await expect(page.locator(".invoice-posted-table")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Posted", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .locator(".invoice-posted-table")
    .getByRole("button", { name: "View invoice", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Back to Invoices", exact: true })
    .click();
  await expect(page.locator(".invoice-posted-table")).toBeVisible();
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await columns
    .getByRole("button", { name: "Reset columns", exact: true })
    .click();
  await columns.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator(".invoice-posted-table th[data-column-key=supplier]"),
  ).toHaveCount(1);
});

test("a manual draft detail returns to its list without losing the saved line", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await expect(page).toHaveURL(/#invoices\?id=/);
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Back to Invoices", exact: true })
    .click();
  await expect(page.locator(".invoice-saved-drafts")).toBeVisible();
  await expect(page.locator(".invoice-lines-table")).toHaveCount(0);
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".invoice-saved-drafts")).toBeVisible();
});
