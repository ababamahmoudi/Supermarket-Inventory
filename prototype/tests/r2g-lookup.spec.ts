import { expect, test, type Page } from "@playwright/test";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function installLookupExample(page: Page) {
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      const product = state.products.find((row) => row.code === "0003")!;
      product.name_en = "Fictional Orchard Cherry Drink 100 g";
      product.name_fa = "نوشیدنی آلبالوی خیالی ۱۰۰ گرم";
      product.unit_size = "100 g";
      product.branch_prices = { "Branch 1": "2.99" };
      product.selling_price = "2.99";
      state.offers = state.offers.filter(
        (row) =>
          row.company_id !== product.company_id ||
          row.product_code !== product.code,
      );
      state.offers.push({
        company_id: state.config.company.seed_key,
        branch_id: "Branch 1",
        branch: "Branch 1",
        id: "fictional-r2g-lookup-pool",
        product_code: product.code,
        label: "2 for $5.00",
        price: "2.99",
        pool: "fictional-r2g-orchard",
        mix_and_match: true,
        status: "active",
        scope: "branch",
        currency: state.config.company.currency,
      });
      state.expiry = state.expiry.filter(
        (row) =>
          row.company_id !== product.company_id ||
          row.product_code !== product.code,
      );
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
}

for (const width of [360, 390, 509, 760, 1440])
  for (const language of ["en", "fa"] as const)
    test(`B3 Lookup painted grid, full names and phone order ${width} ${language}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await installLookupExample(page);
      await setLanguage(page, language);
      if (language === "fa")
        await (await openShellAction(page, "تغییر به تم تیره")).click();
      const search = page.locator("input.lookup-search");
      await search.fill("0003");
      const result = page.locator(".lookup-result-row");
      await expect(result).toHaveCount(1);
      const name = result.locator(".lookup-fitted-name");
      await expect(name).toHaveText(
        language === "en"
          ? "Fictional Orchard Cherry Drink 100 g"
          : "نوشیدنی آلبالوی خیالی ۱۰۰ گرم",
      );
      await expect(result.locator(".lookup-mix-tag")).toHaveText(
        language === "en" ? "Mix & match" : "ترکیبی",
      );
      await expect(page.locator(".lookup-detail .lookup-mix-tag")).toHaveText(
        language === "en" ? "Mix & match" : "ترکیبی",
      );
      const offer = await page
        .locator(".lookup-detail .lookup-offer-context")
        .evaluate((node) => {
          const terms = node
            .querySelector(".offer-pill")!
            .getBoundingClientRect();
          const tag = node
            .querySelector(".lookup-mix-tag")!
            .getBoundingClientRect();
          return {
            centreDelta: Math.abs(
              (terms.top + terms.bottom - tag.top - tag.bottom) / 2,
            ),
            overlaps: terms.left < tag.right && terms.right > tag.left,
          };
        });
      expect(offer.centreDelta).toBeLessThanOrEqual(1.5);
      expect(offer.overlaps).toBe(false);
      const resultTag = await result
        .locator(".lookup-mix-tag")
        .evaluate((node) => {
          const style = getComputedStyle(node);
          const row = node.closest(".lookup-result-row")!;
          return {
            background: style.backgroundColor,
            rowBackground: getComputedStyle(row).backgroundColor,
            startPadding: parseFloat(style.paddingInlineStart),
            endPadding: parseFloat(style.paddingInlineEnd),
            height: node.getBoundingClientRect().height,
          };
        });
      expect(resultTag.background).not.toBe(resultTag.rowBackground);
      expect(resultTag.startPadding).toBe(8);
      expect(resultTag.endPadding).toBe(8);
      expect(resultTag.height).toBe(20);
      await page.evaluate(() => document.fonts.ready);
      const geometry = await result.evaluate((row) => {
        const bounds = row.getBoundingClientRect();
        const style = getComputedStyle(row);
        const title = row
          .querySelector(".lookup-result-name > strong")!
          .getBoundingClientRect();
        const sub = row
          .querySelector(".lookup-result-secondary")!
          .getBoundingClientRect();
        const price = row
          .querySelector(".lookup-result-price > .selling-price-value")!
          .getBoundingClientRect();
        const pills = row
          .querySelector(".lookup-result-pills")!
          .getBoundingClientRect();
        const label = row.querySelector(".lookup-fitted-name")!;
        const labelStyle = getComputedStyle(label);
        const titleBox = row
          .querySelector(".lookup-result-name > strong")!
          .getBoundingClientRect();
        const glyphs = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        let glyphNode;
        let glyphsContained = true;
        while ((glyphNode = glyphs.nextNode())) {
          const range = document.createRange();
          range.selectNodeContents(glyphNode);
          glyphsContained &&= [...range.getClientRects()].every(
            (box) =>
              box.left >= titleBox.left - 1 && box.right <= titleBox.right + 1,
          );
        }
        const sizeFragments = [...label.querySelectorAll(".unit-fragment")];
        const atomicSizes = sizeFragments.every((fragment) => {
          const range = document.createRange();
          range.selectNodeContents(fragment);
          return (
            new Set(
              [...range.getClientRects()]
                .filter((box) => box.width > 0)
                .map((box) => Math.round(box.top)),
            ).size === 1
          );
        });
        const rtl = style.direction === "rtl";
        const end = rtl
          ? bounds.left + parseFloat(style.paddingLeft)
          : bounds.right - parseFloat(style.paddingRight);
        return {
          priceEnd: rtl ? price.left : price.right,
          pillsEnd: rtl ? pills.left : pills.right,
          end,
          titleBottom: title.bottom,
          titleTop: title.top,
          priceTop: price.top,
          subBottom: sub.bottom,
          pillsTop: pills.top,
          noEllipsis:
            getComputedStyle(row.querySelector(".lookup-result-name > strong")!)
              .whiteSpace === "normal" &&
            labelStyle.textOverflow !== "ellipsis" &&
            !label.textContent!.includes("…"),
          glyphsContained,
          sizeFragments: sizeFragments.length,
          atomicSizes,
          rowOverflow: row.scrollWidth - row.clientWidth,
        };
      });
      expect(Math.abs(geometry.priceEnd - geometry.end)).toBeLessThanOrEqual(
        1.5,
      );
      expect(geometry.noEllipsis).toBe(true);
      expect(geometry.glyphsContained).toBe(true);
      expect(geometry.sizeFragments).toBeGreaterThan(0);
      expect(geometry.atomicSizes).toBe(true);
      expect(geometry.rowOverflow).toBeLessThanOrEqual(2);
      expect(
        Math.abs(geometry.priceTop - geometry.titleTop),
      ).toBeLessThanOrEqual(2);
      if (width <= 760)
        expect(geometry.pillsTop).toBeGreaterThanOrEqual(geometry.subBottom);
      else
        expect(Math.abs(geometry.pillsEnd - geometry.end)).toBeLessThanOrEqual(
          1.5,
        );
      const facts = page.locator(".lookup-detail .lookup-fact-row");
      await expect(facts).toHaveCount(2);
      for (const tile of await facts.locator(".product-quiet-icon").all()) {
        const box = (await tile.boundingBox())!;
        expect(box.width).toBe(40);
        expect(box.height).toBe(40);
      }
      const detail = page.locator(".lookup-detail");
      if (width <= 760) {
        const order = await detail.evaluate((node) => {
          const title = node.querySelector("h2")!.getBoundingClientRect();
          const price = node
            .querySelector(".lookup-price-block")!
            .getBoundingClientRect();
          const actions = node
            .querySelector(".product-header-actions")!
            .getBoundingClientRect();
          const dates = node
            .querySelector(".product-dates-section")!
            .getBoundingClientRect();
          const buttons = [
            ...node.querySelectorAll<HTMLElement>(
              ".product-header-actions > button:not(.ui-icon-button)",
            ),
          ].map((n) => n.getBoundingClientRect().width);
          return {
            titleBottom: title.bottom,
            priceTop: price.top,
            priceBottom: price.bottom,
            actionsTop: actions.top,
            actionsBottom: actions.bottom,
            factsTop: dates.top,
            buttons,
          };
        });
        expect(order.priceTop).toBeGreaterThanOrEqual(order.titleBottom);
        expect(order.actionsTop).toBeGreaterThanOrEqual(order.priceBottom);
        expect(order.factsTop).toBeGreaterThanOrEqual(order.actionsBottom);
        expect(order.buttons).toHaveLength(2);
        expect(
          Math.abs(order.buttons[0] - order.buttons[1]),
        ).toBeLessThanOrEqual(1.5);
      }
      await page.screenshot({
        path: info.outputPath(`lookup-offer-${width}-${language}.png`),
        fullPage: true,
      });
      const beforeType = await search.boundingBox();
      await search.press("End");
      await search.press("Backspace");
      const afterType = await search.boundingBox();
      expect(Math.abs(afterType!.x - beforeType!.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(afterType!.y - beforeType!.y)).toBeLessThanOrEqual(2);
      await search.fill("0016");
      await expect(
        page.locator(".lookup-detail.is-weight-lookup"),
      ).toBeVisible();
      await expect(page.locator(".lookup-size-count")).toHaveCount(0);
      expect(
        await page
          .locator("html")
          .evaluate((node) => node.scrollWidth - node.clientWidth),
      ).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: info.outputPath(`lookup-${width}-${language}.png`),
        fullPage: true,
      });
    });

test("B3 secondary filters retain genuine selection, active captions and read-only business state @r2g-509", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 509, height: 1000 });
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  const before = await readCanonicalBusinessEvidence(page);
  const button = page.getByRole("button", { name: "Filters", exact: true });
  const start = await button.boundingBox();
  const firstChip = page
    .locator(".lookup-pricing-filters > .filter-chip")
    .first();
  const chipStart = await firstChip.boundingBox();
  await button.click();
  const popup = page.getByRole("dialog", { name: "Filters", exact: true });
  const pricing = popup.getByRole("combobox", {
    name: "Pricing category",
    exact: true,
  });
  await expect(pricing).toBeFocused();
  await pricing.click();
  await page.getByRole("option", { name: /^Grocery \(Taxable\)/ }).click();
  await expect(popup).toBeVisible();
  await page.screenshot({
    path: info.outputPath("lookup-filters-popup-509-en.png"),
    fullPage: true,
  });
  await popup.getByRole("button", { name: "Done", exact: true }).click();
  await expect(button).toBeFocused();
  await expect(button.locator(".tab-count")).toHaveText("1");
  const badge = await button.locator(".tab-count").evaluate((node) => {
    const style = getComputedStyle(node);
    const luminance = (value: string) => {
      const rgb = value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((channel) => {
          const srgb = channel / 255;
          return srgb <= 0.04045
            ? srgb / 12.92
            : ((srgb + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const text = luminance(style.color),
      fill = luminance(style.backgroundColor);
    return {
      colour: style.color,
      background: style.backgroundColor,
      contrast: (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05),
    };
  });
  expect(badge.colour).toBe("rgb(255, 255, 255)");
  expect(badge.colour).not.toBe(badge.background);
  expect(badge.contrast).toBeGreaterThanOrEqual(4.5);
  await info.attach("Actual filter count ink and contrast", {
    body: JSON.stringify(badge),
    contentType: "application/json",
  });
  await expect(page.locator(".lookup-active-filters")).toContainText(
    "Grocery (Taxable)",
  );
  const end = await button.boundingBox();
  expect(Math.abs(end!.x - start!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(end!.y - start!.y)).toBeLessThanOrEqual(2);
  const chipEnd = await firstChip.boundingBox();
  expect(Math.abs(chipEnd!.x - chipStart!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(chipEnd!.y - chipStart!.y)).toBeLessThanOrEqual(2);
  await page.reload();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Pricing category", exact: true }),
  ).toContainText("Grocery (Taxable)");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".lookup-active-filters")).toHaveText("");
  await expect(button.locator(".tab-count")).not.toBeVisible();
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.products).toEqual(before.products);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.stock_movements).toEqual(before.stock_movements);
});

test("B3 genuine Cashier phone actions keep the real public price and no private controls @r2g-509", async ({
  page,
}) => {
  await page.setViewportSize({ width: 509, height: 1000 });
  await signIn(page, "Manager");
  await installLookupExample(page);
  await signIn(page, "Cashier");
  await setBranch(page, "Branch 1");
  await page.locator("input.lookup-search").fill("0003");
  const detail = page.locator(".lookup-detail");
  await expect(detail.locator(".price")).toHaveText("$2.99");
  await expect(
    detail.locator(".product-header-actions > button:not(.ui-icon-button)"),
  ).toHaveCount(0);
  const menu = detail.getByRole("button", {
    name: "Product actions",
    exact: true,
  });
  await expect(menu).toBeVisible();
  const geometry = await menu.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const parent = node.parentElement!.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      end: box.right,
      parentEnd: parent.right,
    };
  });
  expect(geometry.width).toBe(44);
  expect(geometry.height).toBe(44);
  expect(Math.abs(geometry.end - geometry.parentEnd)).toBeLessThanOrEqual(1.5);
  await expect(detail).not.toContainText(/Store cost|Margin %|Cost history/);
  await menu.click();
  await expect(
    page.getByRole("menuitem", { name: "Add date", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", {
      name: /Edit product|Change price|Cost history/,
    }),
  ).toHaveCount(0);
});
