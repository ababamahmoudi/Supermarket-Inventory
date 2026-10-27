import { expect, test } from "@playwright/test";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { addActualPackageSizes } from "./r2f-package-service-proof";
import { auditR2fAlignment } from "./r2f-alignment";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const)
    for (const theme of ["light", "dark"] as const) {
      test(`D4 actual weight parent and package navigation ${width} ${language} ${theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        await signIn(page, "Manager");
        const packages = await addActualPackageSizes(page);
        expect(packages).toHaveLength(4);
        await page.reload();
        if (width === 390)
          await expect(page.locator(".mobile-more-menu")).toBeVisible();
        await setLanguage(page, language);
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              language === "en"
                ? `Switch to ${theme} theme`
                : theme === "dark"
                  ? "تغییر به تم تیره"
                  : "تغییر به تم روشن",
            )
          ).click();
        await setBranch(page, "Branch 1");
        await page.goto("/#lookup?search=0016");
        const detail = page.locator(".lookup-detail.is-weight-lookup");
        await expect(detail).toBeVisible();
        await expect(detail.locator(".lookup-package-box")).toHaveCount(4);
        await expect(
          page.locator(".lookup-pricing-filters .filter-chip"),
        ).toHaveCount(6);
        for (const chip of await page
          .locator(".lookup-pricing-filters .filter-chip")
          .all())
          expect((await chip.boundingBox())!.height).toBe(44);
        await expect(detail.locator(".selling-price-unit").first()).toHaveText(
          "/lb",
        );
        await expect(
          detail.locator(".selling-price-secondary").first(),
        ).toContainText("/kg");
        expect(
          await detail
            .locator(".lookup-approved-price > .price")
            .evaluate((n) => parseFloat(getComputedStyle(n).fontSize)),
        ).toBe(36);
        await page.evaluate(() => document.fonts.ready);
        expect(
          (await auditR2fAlignment(page, { scene: "D4" })).failures,
        ).toEqual([]);
        expect(
          await page
            .locator("html")
            .evaluate((n) => n.scrollWidth - n.clientWidth),
        ).toBeLessThanOrEqual(2);
        await page.screenshot({
          path: info.outputPath(`weight-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        const before = await readCanonicalBusinessEvidence(page);
        await detail.locator(".lookup-package-box").first().click();
        await expect(
          page.locator(".lookup-detail.is-weight-lookup"),
        ).toHaveCount(0);
        await expect(page.locator(".lookup-product-meta")).toContainText(
          packages[0].code,
        );
        await expect(page.locator(".lookup-approved-price")).not.toContainText(
          "/lb",
        );
        const after = await readCanonicalBusinessEvidence(page);
        expect(after.products).toEqual(before.products);
        expect(after.ledger).toEqual(before.ledger);
        expect(after.stock_movements).toEqual(before.stock_movements);
        await page.locator(".lookup-search-pill input").fill("");
        await page
          .getByRole("combobox", {
            name: language === "en" ? "Search products" : "جست‌وجوی محصولات",
            exact: true,
          })
          .fill("0016");
        await expect(
          page.locator(".lookup-detail.is-weight-lookup"),
        ).toBeVisible();
        for (const target of [
          page.locator("html"),
          page.locator(".lookup-detail"),
        ])
          expect(
            await target.evaluate((n) => n.scrollWidth - n.clientWidth),
          ).toBeLessThanOrEqual(2);
      });
    }

test("D4 Cashier uses genuine public package charging without edit/cost authority", async ({
  page,
}) => {
  await signIn(page, "Manager");
  const packages = await addActualPackageSizes(page);
  await signIn(page, "Cashier");
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup?search=0016");
  await expect(page.locator(".lookup-package-box")).toHaveCount(4);
  for (const name of [/^Edit /, /^Change price$/, /^Package sizes$/])
    await expect(
      page.locator(".lookup-detail").getByRole("button", { name }),
    ).toHaveCount(0);
  await expect(page.locator(".lookup-detail")).not.toContainText(
    /Margin|Cost before tax/,
  );
  await page.locator(".lookup-package-box").first().click();
  await expect(page.locator(".lookup-product-meta")).toContainText(
    packages[0].code,
  );
  await expect(page.locator(".lookup-approved-price")).toContainText("$1.99");
  for (const name of [/^Edit /, /^Change price$/, /^Package sizes$/])
    await expect(
      page.locator(".lookup-detail").getByRole("button", { name }),
    ).toHaveCount(0);
});
