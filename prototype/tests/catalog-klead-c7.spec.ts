import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { DemoState } from "../src/types";
import { signIn, setLanguage } from "./helpers";
import {
  button,
  field,
  exact,
  today,
  choose,
  settled,
} from "../scripts/c5-browser-proof.mjs";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";
import { setupCatalogScene } from "../scripts/c6-catalog-scenes.mjs";
import { approvedLookupPrices } from "./lookup-approved-price-fixture";

const helpers = { button, field, exact, today, choose };
const widths = [390, 768, 900, 1024, 1180, 1280, 1440, 1920];
async function state(page: Page): Promise<DemoState> {
  return readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
}
async function visit(page: Page, route: string) {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, route);
  await settled(page);
}
function businessSnapshot(saved: DemoState) {
  return JSON.stringify({
    products: saved.products,
    expiry: saved.expiry,
    invoice: saved.invoice,
    invoices: saved.invoices,
    ledger: saved.ledger,
    offers: saved.offers,
    clearance_offers: saved.offers.filter((offer) => offer.clearance === true),
    receipt_lots: saved.receipt_lots,
  });
}
async function measure(
  page: Page,
  scene: string,
  language: string,
  width: number,
  info: TestInfo,
) {
  const proof = await inspectResponsiveLayout(page, scene, language, width);
  await info.attach(`${scene}-${language}-${width}-real-geometry`, {
    body: JSON.stringify(proof, null, 2),
    contentType: "application/json",
  });
  expect(proof.actualWidth).toBe(width);
  expect(proof.words + proof.contentWords).toBeGreaterThan(10);
  expect(proof.failures).toEqual([]);
  return proof;
}

for (const width of widths)
  for (const language of ["en", "fa"] as const) {
    test(`Klead catalog/date actual UI ${language} ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      await signIn(page, "Supervisor");
      await approvedLookupPrices(page, ["0003"]);
      await visit(page, "lookup");
      await setLanguage(page, language);
      const before = businessSnapshot(await state(page));
      const lookup = page.locator(".lookup-page");
      const search = lookup.getByLabel(
        exact("Search products", "جست‌وجوی محصولات"),
      );
      await search.fill("0003");
      await expect(lookup.locator(".lookup-detail .price")).toHaveText("$2.99");
      await expect(
        lookup.locator(".lookup-price-context .offer-pill"),
      ).toHaveText(language === "fa" ? "۲ عدد $5.00" : "2 for $5.00");
      await expect(lookup.locator(".product-dates-readonly")).toBeVisible();
      await expect(
        lookup.locator(".product-dates-readonly").getByRole("switch"),
      ).toHaveCount(0);
      await expect(
        lookup
          .locator(".product-dates-readonly")
          .getByRole("button", { name: exact("Add", "افزودن") }),
      ).toHaveCount(0);
      const shapes = await lookup.evaluate((element) => {
        const search = element.querySelector(".lookup-search-pill")!;
        const price = element.querySelector(".lookup-approved-price .price")!;
        const offer = element.querySelector(
          ".lookup-price-context .offer-pill",
        )!;
        const amount = price.getBoundingClientRect(),
          pill = offer.getBoundingClientRect();
        return {
          searchHeight: search.getBoundingClientRect().height,
          searchRadius: getComputedStyle(search).borderRadius,
          font: getComputedStyle(price).fontSize,
          lineHeight: getComputedStyle(price).lineHeight,
          price: amount.toJSON(),
          offer: pill.toJSON(),
        };
      });
      expect(shapes.searchHeight).toBe(56);
      expect(shapes.searchRadius).toBe("16px");
      expect(shapes.font).toBe("60px");
      expect(shapes.lineHeight).toBe("60px");
      expect(
        Math.min(shapes.price.bottom, shapes.offer.bottom) -
          Math.max(shapes.price.top, shapes.offer.top),
      ).toBeGreaterThan(0);
      await measure(page, "c7-lookup", language, width, info);
      await search.clear();
      await lookup.locator(".lookup-more-filters > summary").click();
      const chips = lookup.locator(".lookup-category-chips");
      await expect(chips.getByRole("combobox")).toHaveCount(0);
      await expect(
        chips.getByRole("button", { name: exact("All", "همه") }),
      ).toHaveAttribute("aria-pressed", "true");
      await chips.locator(".filter-chip").nth(1).click();
      await expect(chips.locator(".filter-chip").nth(1)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const codes = await lookup
        .locator(".lookup-result-row")
        .evaluateAll((rows) => rows.map((row) => row.id.split("-").at(-1)));
      const saved = await state(page);
      const categories = [
        ...new Set(
          saved.products
            .filter(
              (p) =>
                p.company_id === saved.config.company.seed_key &&
                p.status !== "archived",
            )
            .map((p) => p.ai_category)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(
        (a, b) =>
          saved.products.filter((p) => p.ai_category === b).length -
            saved.products.filter((p) => p.ai_category === a).length ||
          a.localeCompare(b),
      );
      expect(codes.length).toBeGreaterThan(0);
      expect(
        codes.every(
          (code) =>
            saved.products.find(
              (p) =>
                p.code === code &&
                p.company_id === saved.config.company.seed_key,
            )?.ai_category === categories[0],
        ),
      ).toBe(true);
      expect(businessSnapshot(saved)).toBe(before);
      await visit(page, "products");
      await expect(
        page.locator(".catalog-products-table .table-row-link").first(),
      ).toBeVisible();
      await expect(
        page
          .locator(".catalog-products-table")
          .getByRole("button", { name: exact("View", "نمایش") }),
      ).toHaveCount(0);
      await measure(page, "c7-products", language, width, info);
      const route = await page
        .locator(".catalog-products-table .table-row-link")
        .first()
        .getAttribute("href");
      await page
        .locator(".catalog-products-table .table-row-link")
        .first()
        .click();
      expect(new URL(page.url()).hash).toBe(route);
      // This dated shelf row is created by the guarded retained quick-add form.
      await setLanguage(page, "en");
      const fixture = await setupCatalogScene(
        page,
        "edit-product-dates",
        helpers,
      );
      await setLanguage(page, language);
      const beforeEditor = businessSnapshot(await state(page));
      await fixture.afterAppearance(page);
      const dialog = page.getByRole("dialog", {
        name: exact("Edit product", "ویرایش محصول"),
      });
      await expect(
        dialog.getByRole("region", { name: exact("Names", "نام‌ها") }),
      ).toBeAttached();
      await expect(
        dialog.getByRole("region", { name: exact("Pricing", "قیمت‌گذاری") }),
      ).toBeAttached();
      await expect(
        dialog.getByRole("region", { name: exact("Details", "جزئیات") }),
      ).toBeAttached();
      const dateRegion = dialog.getByRole("region", {
        name: exact("Date tracking", "پیگیری تاریخ"),
      });
      await expect(dateRegion).toContainText("C6-SHELF-06");
      const geometry = await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect(),
          header = element
            .querySelector(".ui-dialog-header")!
            .getBoundingClientRect(),
          footer = element
            .querySelector(".product-editor-actions")!
            .getBoundingClientRect();
        const add = element.querySelector(".product-editor-date-inline")!;
        return {
          viewportHeight: innerHeight,
          dialog: bounds.toJSON(),
          header: header.toJSON(),
          footer: footer.toJSON(),
          addColumns:
            getComputedStyle(add).gridTemplateColumns.split(" ").length,
          bodyClient: element.querySelector(".product-editor-body")!
            .clientWidth,
          bodyScroll: element.querySelector(".product-editor-body")!
            .scrollWidth,
        };
      });
      expect(geometry.dialog.left).toBeGreaterThanOrEqual(0);
      expect(geometry.dialog.right).toBeLessThanOrEqual(width);
      expect(geometry.header.top).toBeGreaterThanOrEqual(0);
      expect(geometry.footer.bottom).toBeLessThanOrEqual(
        geometry.viewportHeight,
      );
      expect(geometry.bodyScroll).toBeLessThanOrEqual(geometry.bodyClient + 1);
      if (width === 390) expect(geometry.addColumns).toBe(2);
      const glyphs = await dateRegion.evaluate((region) => {
        const context = document.createElement("canvas").getContext("2d")!;
        const panel = region
          .closest(".product-editor-body")!
          .getBoundingClientRect();
        const words = [];
        const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const element = node.parentElement!;
          if (element.closest(".sr-only,[aria-hidden=true]")) continue;
          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden")
            continue;
          const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          context.font = font;
          for (const match of (node.textContent ?? "").matchAll(/\S+/gu)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            const metrics = context.measureText(match[0]);
            const fontHeight =
              metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
            for (const rect of range.getClientRects()) {
              const scale = rect.height / fontHeight;
              const baseline = rect.top + metrics.fontBoundingBoxAscent * scale;
              const bounds = {
                left: rect.left,
                right: rect.right,
                top: baseline - metrics.actualBoundingBoxAscent * scale,
                bottom: baseline + metrics.actualBoundingBoxDescent * scale,
              };
              if (
                bounds.bottom <= Math.max(0, panel.top) ||
                bounds.top >= Math.min(innerHeight, panel.bottom)
              )
                continue;
              words.push({ text: match[0], font, bounds });
            }
          }
        }
        const collisions = [];
        for (let i = 0; i < words.length; i++)
          for (let j = i + 1; j < words.length; j++) {
            const a = words[i],
              b = words[j];
            if (
              Math.min(a.bounds.right, b.bounds.right) -
                Math.max(a.bounds.left, b.bounds.left) >
                1 &&
              Math.min(a.bounds.bottom, b.bounds.bottom) -
                Math.max(a.bounds.top, b.bounds.top) >
                1
            )
              collisions.push({
                first: a.text,
                second: b.text,
                a: a.bounds,
                b: b.bounds,
              });
          }
        return {
          method:
            "loaded-font actual glyph ink; original range baseline, viewport/body clipping",
          words,
          collisions,
        };
      });
      await info.attach(`editor-date-glyph-ink-${language}-${width}`, {
        body: JSON.stringify(glyphs, null, 2),
        contentType: "application/json",
      });
      expect(glyphs.words.length).toBeGreaterThan(10);
      expect(glyphs.collisions).toEqual([]);
      await measure(page, "c7-edit-product-dates", language, width, info);
      await button(dialog, "Cancel", "انصراف").click();
      expect(businessSnapshot(await state(page))).toBe(beforeEditor);
      await visit(page, "expiry");
      await measure(page, "c7-date-tracking", language, width, info);
      await expect(page.locator(".date-quick-more-toggle")).toBeVisible();
      await page.locator(".date-quick-more-toggle").click();
      await expect(page.locator(".date-quick-more")).toBeVisible();
      await expect(
        page.locator(".date-quick-add").getByRole("textbox", {
          name: exact("Lot (optional)", "سری ساخت (اختیاری)"),
        }),
      ).toBeVisible();
    });
  }

for (const role of ["Floor Worker", "Cashier"] as const)
  test(`Klead preserves ${role} catalog money and edit restrictions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "Manager");
    await approvedLookupPrices(page, ["0009"]);
    await signIn(page, role);
    await visit(page, role === "Cashier" ? "lookup" : "products");
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
    await expect(page.getByText("Store cost", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Margin %", { exact: true })).toHaveCount(0);
    if (role === "Floor Worker") {
      await page.getByRole("button", { name: "Columns", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Columns", exact: true });
      await expect(dialog.getByText("Store cost", { exact: true })).toHaveCount(
        0,
      );
      await expect(dialog.getByText("Margin %", { exact: true })).toHaveCount(
        0,
      );
      await button(dialog, "Close").click();
    }
    await visit(page, "lookup");
    await field(page.locator(".lookup-page"), "Search products").fill("0009");
    await expect(page.locator(".lookup-detail .price")).toHaveText("$2.99");
  });
