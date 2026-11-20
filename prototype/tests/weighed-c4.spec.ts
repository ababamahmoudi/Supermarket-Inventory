import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Locator } from "@playwright/test";
import { addSelectedLabels, selectLabelGroup } from "./label-selection";
import { chooseOption, setLanguage, signIn } from "./helpers";
import { approvedLookupPrices } from "./lookup-approved-price-fixture";

const STORAGE_KEY = "supermarket-prototype-v1";
const PRODUCT_CODE = "0016";

async function measurePriceInk(price: Locator) {
  return price.evaluate(async (element) => {
    await document.fonts.ready;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("Text measurement is unavailable");
    const bounds = (rect: DOMRect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    });
    const box = bounds(element.getBoundingClientRect());
    const contains = (rect: ReturnType<typeof bounds>) =>
      rect.left >= box.left - 0.75 &&
      rect.right <= box.right + 0.75 &&
      rect.top >= box.top - 0.75 &&
      rect.bottom <= box.bottom + 0.75;
    const fragments = [];
    for (const fragment of element.querySelectorAll(
      ".weight-price-main,.weight-price-secondary",
    )) {
      const style = getComputedStyle(fragment);
      const text = fragment.textContent!;
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      await document.fonts.load(font, text);
      context.font = font;
      const metrics = context.measureText(text);
      const fontHeight =
        metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      if (
        !Number.isFinite(fontHeight) ||
        fontHeight <= 0 ||
        !Number.isFinite(metrics.actualBoundingBoxAscent) ||
        !Number.isFinite(metrics.actualBoundingBoxDescent)
      )
        throw new Error("Loaded font metrics are unavailable");
      const range = document.createRange();
      range.selectNodeContents(fragment);
      const rects = [...range.getClientRects()].map((rect) => {
        const raw = bounds(rect);
        // Match c6-layout-proof: text ranges include unused font leading.
        // Preserve their horizontal containment and derive painted vertical
        // bounds from the loaded font's baseline, including preview scaling.
        const scale = rect.height / fontHeight;
        const baseline = rect.top + metrics.fontBoundingBoxAscent * scale;
        const ink = {
          left: rect.left,
          right: rect.right,
          top: baseline - metrics.actualBoundingBoxAscent * scale,
          bottom: baseline + metrics.actualBoundingBoxDescent * scale,
        };
        return {
          raw,
          ink,
          scale,
          baseline,
          rawFits: contains(raw),
          inkFits: contains(ink),
        };
      });
      fragments.push({
        text,
        font,
        fontLoaded: document.fonts.check(font, text),
        metrics: {
          fontHeight,
          fontAscent: metrics.fontBoundingBoxAscent,
          fontDescent: metrics.fontBoundingBoxDescent,
          inkAscent: metrics.actualBoundingBoxAscent,
          inkDescent: metrics.actualBoundingBoxDescent,
        },
        rects,
      });
    }
    return {
      box,
      fragments,
      rawFits: fragments.every((fragment) =>
        fragment.rects.every((rect) => rect.rawFits),
      ),
      inkFits:
        fragments.length === 2 &&
        fragments.every(
          (fragment) =>
            fragment.fontLoaded &&
            fragment.rects.length > 0 &&
            fragment.rects.every((rect) => rect.inkFits),
        ),
    };
  });
}

for (const role of ["Supervisor", "Floor Worker", "Cashier"] as const) {
  test(`${role} sees approved weighed prices in Lookup with isolated bilingual units`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await approvedLookupPrices(page, [PRODUCT_CODE]);
    if (role !== "Supervisor") await signIn(page, role);
    await page.goto("/#lookup");
    await page
      .getByLabel("Search products", { exact: true })
      .fill(PRODUCT_CODE);
    const price = page.locator(".lookup-approved-price .weight-price");
    await expect(price.locator(".weight-price-main")).toHaveText("$7.49/lb");
    await expect(price.locator(".weight-price-secondary")).toContainText(
      "$16.51/kg",
    );
    await expect(price.locator(".weight-price-main")).toHaveAttribute(
      "dir",
      "ltr",
    );
    if (role === "Cashier")
      await expect(
        page.locator(".lookup-detail").getByRole("button", { name: /^Edit / }),
      ).toHaveCount(0);
    await setLanguage(page, "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(price.locator(".weight-price-main")).toHaveText("$7.49/پوند");
    await expect(price.locator(".weight-price-secondary")).toContainText(
      "$16.51/کیلوگرم",
    );
  });
}

test("weighed defaults persist, change only display/rules, and a kg cost editor save preserves the approved lb amount", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await approvedLookupPrices(page, [PRODUCT_CODE]);
  const weighedBefore = structuredClone(
    (await readCanonicalBusinessEvidence(page)).config.weighed_items,
  );
  const productsBefore = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).products,
  );
  await page.goto("/#settings?group=pricing");
  await expect(
    page.getByLabel("Main display unit", { exact: true }),
  ).toHaveText("lb");
  await expect(
    page.getByRole("switch", { name: "Show second unit", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Use rounding bands", exact: true }),
  ).toBeChecked();
  await chooseOption(
    page,
    page.getByLabel("Main display unit", { exact: true }),
    "kg",
  );
  await page
    .getByRole("switch", { name: "Show second unit", exact: true })
    .uncheck();
  await page
    .getByRole("switch", { name: "Use rounding bands", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  // Save updates the form before asynchronous file migration/persistence ends.
  // Require the exact durable configuration before testing reload persistence.
  await expect
    .poll(() =>
      readCanonicalBusinessEvidence(page).then(
        (canonicalState) =>
          JSON.parse(JSON.stringify(canonicalState)!).config.weighed_items,
      ),
    )
    .toEqual({
      ...weighedBefore,
      conversion_factor: "2.20462",
      main_display_unit: "kg",
      show_second_unit: false,
      use_rounding_bands: false,
    });
  await page.reload();
  await expect(
    page.getByLabel("Main display unit", { exact: true }),
  ).toHaveText("kg");
  await expect(
    page.getByRole("switch", { name: "Show second unit", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Use rounding bands", exact: true }),
  ).not.toBeChecked();
  expect(
    await readCanonicalBusinessEvidence(page).then(
      (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).products,
    ),
  ).toEqual(productsBefore);

  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill(PRODUCT_CODE);
  await expect(
    page.locator(".lookup-approved-price .weight-price-main"),
  ).toHaveText("$16.51/kg");
  await expect(
    page.locator(".lookup-approved-price .weight-price-secondary"),
  ).toHaveCount(0);
  await page
    .locator(".lookup-detail")
    .getByRole("button", { name: /^Edit / })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  const soldBy = editor.getByRole("group", { name: "Sold by", exact: true });
  await expect(
    soldBy.getByRole("button", { name: "By weight", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    soldBy.getByRole("button", { name: "Each", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const perKg = editor
    .getByRole("group", { name: "Cost unit", exact: true })
    .getByRole("button", { name: "per kg", exact: true });
  await perKg.click();
  await expect(perKg).toHaveAttribute("aria-pressed", "true");
  await expect(
    editor.getByLabel("Cost before tax", { exact: true }),
  ).toHaveValue("11.0000");
  // The R2f weight editor deliberately presents canonical lb price with its kg
  // comparison; the operational Lookup/list above still follows kg settings.
  const sellingPrice = editor.locator(".weight-product-price-card");
  await expect(sellingPrice.locator(".weight-product-price-main")).toHaveText(
    "$7.49/lb",
  );
  await expect(sellingPrice.locator(".weight-product-price-second")).toHaveText(
    "$16.51 /kg · Before tax",
  );
  await expect(sellingPrice.locator("input")).toHaveCount(0);
  // This undated fixture must resolve tracking before a metadata save. The
  // approved amount remains read-only; this does not open Change price.
  await editor.locator(".weight-product-optional-details > summary").click();
  await editor
    .getByRole("switch", { name: "Date tracking", exact: true })
    .uncheck();
  await chooseOption(
    page,
    editor.getByLabel("Stop tracking", { exact: true }),
    "keep",
    "Stop tracking, keep the date on the product",
  );
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  const product = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => {
      const canonicalEvidenceInput = { key: STORAGE_KEY, code: PRODUCT_CODE };
      return JSON.parse(JSON.stringify(canonicalState)!).products.find(
        (item: { code: string }) => item.code === canonicalEvidenceInput.code,
      );
    },
  );
  expect(product.selling_price).toBe("7.49");
  expect(product.last_cost_before_tax).toBe("4.9895");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill(PRODUCT_CODE);
  await expect(page.locator("tbody .weight-price-main").first()).toHaveText(
    "$16.51/kg",
  );
});

test("weighed Regular labels retain physical geometry, readable units, and approved monetary state", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await addSelectedLabels(page, [PRODUCT_CODE]);
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await selectLabelGroup(page, "regular", "Regular");
  const label = page.locator(".label-bilingual-preview .shelf-label");
  await expect(label.locator(".weight-price-main")).toHaveText("$7.49/lb");
  await expect(label.locator(".weight-price-secondary")).toContainText(
    "$16.51/kg",
  );
  await label.scrollIntoViewIfNeeded();
  const price = label.locator(".price");
  const clean = await measurePriceInk(price);
  expect(clean.inkFits).toBe(true);

  // Move the actual approved price outside its row, then restore the exact
  // inline style. The ink guard must reject real overflow at the same 0.75px
  // tolerance; no label template, business record or screenshot is altered.
  const mainPrice = price.locator(".weight-price-main");
  const savedStyle = await mainPrice.evaluate((element) => {
    const original = element.getAttribute("style");
    Object.assign((element as HTMLElement).style, {
      position: "relative",
      top: "60px",
    });
    return original;
  });
  let outside;
  try {
    outside = await measurePriceInk(price);
    expect(outside.inkFits).toBe(false);
    expect(
      outside.fragments[0].rects.some(
        (rect) => rect.ink.bottom > outside!.box.bottom + 0.75,
      ),
    ).toBe(true);
  } finally {
    await mainPrice.evaluate((element, original) => {
      if (original === null) element.removeAttribute("style");
      else element.setAttribute("style", original);
    }, savedStyle);
  }
  const restored = await measurePriceInk(price);
  expect(restored.inkFits).toBe(true);
  await expect(mainPrice).toHaveText("$7.49/lb");
  await expect(price.locator(".weight-price-secondary")).toContainText(
    "$16.51/kg",
  );
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  const geometry = await page
    .locator(".label-print-output .shelf-label")
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
  expect(Math.abs(geometry.width - (60 * 96) / 25.4)).toBeLessThan(0.2);
  expect(Math.abs(geometry.height - (40 * 96) / 25.4)).toBeLessThan(0.2);
  const paper = await page
    .locator(".label-print-output .print-sheet")
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
  expect(Math.abs(paper.width - (210 * 96) / 25.4)).toBeLessThan(0.2);
  expect(Math.abs(paper.height - (297 * 96) / 25.4)).toBeLessThan(0.2);
  const printedPrice = page.locator(".label-print-output .shelf-label .price");
  await expect(printedPrice.locator(".weight-price-main")).toHaveText(
    "$7.49/lb",
  );
  await expect(printedPrice.locator(".weight-price-secondary")).toContainText(
    "$16.51/kg",
  );
  const printedInk = await measurePriceInk(printedPrice);
  expect(printedInk.inkFits).toBe(true);
  const product = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => {
      const canonicalEvidenceInput = { key: STORAGE_KEY, code: PRODUCT_CODE };
      return JSON.parse(JSON.stringify(canonicalState)!).products.find(
        (item: { code: string }) => item.code === canonicalEvidenceInput.code,
      );
    },
  );
  expect(product.selling_price).toBe("7.49");
  await info.attach("Loaded-font label overflow negative control", {
    body: JSON.stringify(
      { clean, outside, restored, printedInk, geometry, paper },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
