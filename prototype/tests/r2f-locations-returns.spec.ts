import { expect, test } from "@playwright/test";
import { auditR2fAlignment } from "./r2f-alignment";
import {
  chooseOption,
  openShellAction,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { installLocationReturnScene } from "./r2f-location-return-fixture";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const)
    for (const theme of ["light", "dark"] as const) {
      test(`D5 D8 real locations and returns ${width} ${language} ${theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await installLocationReturnScene(page);
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
        await setBranch(page, "all");
        await page.goto("/#lookup?search=0004");
        const locations = page.locator(".lookup-locations-table");
        await expect(locations.locator("tbody tr")).toHaveCount(4);
        await expect(
          locations.locator('[data-location="Warehouse"]'),
        ).toContainText(
          language === "en" ? "Not sold here" : "اینجا فروخته نمی‌شود",
        );
        await expect(
          locations.locator('[data-location="Branch 3"] .differs'),
        ).toContainText("$7.49");
        await expect(page.locator(".lookup-location-facts")).toContainText(
          language === "en"
            ? "Newmarket's price differs"
            : "قیمت نیومارکت متفاوت است",
        );
        if (width === 390)
          await expect(
            locations.locator(".lookup-location-phone-name"),
          ).toHaveCount(4);
        else {
          await expect(locations.locator("thead")).toContainText(
            language === "en" ? "Next expiry" : "انقضای بعدی",
          );
          await expect(
            locations.locator(".lookup-location-expiry.is-soon"),
          ).toBeVisible();
          const density = await locations.evaluate((node) => ({
            head: node.querySelector("thead tr")!.getBoundingClientRect()
              .height,
            rows: [...node.querySelectorAll("tbody tr")].map(
              (row) => row.getBoundingClientRect().height,
            ),
          }));
          expect(Math.abs(density.head - 32)).toBeLessThanOrEqual(2);
          for (const height of density.rows)
            expect(Math.abs(height - 48)).toBeLessThanOrEqual(2);
          await expect(
            locations.locator(".lookup-location-expiry.is-soon .ui-badge"),
          ).toHaveCount(0);
        }
        await page.evaluate(() => document.fonts.ready);
        expect(
          (await auditR2fAlignment(page, { scene: "D5" })).failures,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`locations-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        await setBranch(page, "Branch 1");
        await page.goto("/#returns");
        const table = page.locator(".returns-overview-table");
        await expect(table.locator("tbody tr")).toHaveCount(3);
        await expect(
          page.getByRole("combobox", {
            name: language === "en" ? "Return branch" : "شعبه مرجوعی",
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(table).toContainText(
          language === "en" ? "+2 more" : "+2 قلم دیگر",
        );
        await expect(table).toContainText("$11.00");
        if (width === 1000) {
          expect(
            await table.evaluate((node) => node.scrollWidth - node.clientWidth),
          ).toBeGreaterThan(2);
          await expect(table).toHaveAttribute(
            "data-width-hidden-column-count",
            "0",
          );
        }
        if (width === 390) {
          await expect(table.locator(".return-phone-header")).toHaveCount(3);
          const filterWidths = await page
            .locator(".returns-toolbar .filter-toolbar-controls")
            .evaluate((node) => ({
              parent: node.getBoundingClientRect().width,
              children: [...node.children].map(
                (n) => n.getBoundingClientRect().width,
              ),
            }));
          for (const width of filterWidths.children)
            expect(Math.abs(width - filterWidths.parent)).toBeLessThanOrEqual(
              2,
            );
          const phone = await table
            .locator("tbody tr")
            .first()
            .evaluate((row) => {
              const rect = (s: string) =>
                row.querySelector(s)!.getBoundingClientRect();
              const head = rect(".return-phone-header");
              const supplier = rect(".return-phone-supplier");
              const status = rect(".return-phone-status");
              const date = rect(".return-phone-meta > :first-child");
              const money = rect(".return-phone-meta > :last-child");
              return {
                head: head.height,
                supplier: supplier.y + supplier.height / 2,
                status: status.y + status.height / 2,
                date: date.y,
                money: money.y,
              };
            });
          expect(Math.abs(phone.supplier - phone.status)).toBeLessThanOrEqual(
            2,
          );
          expect(Math.abs(phone.date - phone.money)).toBeLessThanOrEqual(5);
          expect(phone.head).toBeLessThanOrEqual(32);
          await expect(table.locator(".return-phone-meta")).toHaveCount(3);
          const bounds = await table.locator("tbody tr").evaluateAll((rows) =>
            rows.map((row) => {
              const b = row.getBoundingClientRect();
              return { top: b.top, bottom: b.bottom };
            }),
          );
          expect(bounds[1].top - bounds[0].bottom).toBeGreaterThanOrEqual(7.5);
          expect(
            await table.locator(".return-phone-next .table-row-link").count(),
          ).toBe(3);
        } else {
          await expect(table.locator("thead")).toContainText(
            language === "en" ? "Credit due" : "اعتبار مورد انتظار",
          );
          await expect(table.locator("thead")).not.toContainText(
            language === "en" ? "Branch" : "شعبه",
          );
        }
        for (const target of [
          page.locator("html"),
          page.locator(".returns-overview"),
        ]) {
          expect(
            await target.evaluate(
              (node) => node.scrollWidth - node.clientWidth,
            ),
          ).toBeLessThanOrEqual(2);
        }
        expect(
          (await auditR2fAlignment(page, { scene: "D8" })).failures,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`returns-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        expect(errors).toEqual([]);
      });
    }

test("D8 money uses retained currency, stays private to financial roles, and the record chevron opens the actual return", async ({
  page,
}) => {
  await installLocationReturnScene(page);
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      state.returns[0].currency = "USD";
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "all");
  await page.goto("/#returns");
  await expect(page.locator(".returns-overview-table thead")).toContainText(
    "Branch",
  );
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Return branch", exact: true }),
    "Branch 3",
    "Newmarket",
  );
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(0);
  await setBranch(page, "Branch 1");
  await expect(
    page.getByRole("combobox", { name: "Return branch", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#returns");
  const first = page.locator(".returns-overview-table tbody tr").first();
  await expect(first).toContainText("USD");
  const before = await readCanonicalBusinessEvidence(page);
  await first.locator(".table-row-link").click();
  await expect(page).toHaveURL(/#return\?id=r2f-return-one$/);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.returns).toEqual(before.returns);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  await signIn(page, "Cashier");
  await setBranch(page, "Branch 1");
  await page.goto("/#returns");
  const returns = page.locator(".returns-overview-table");
  await expect(returns.locator("tbody tr")).toHaveCount(3);
  await expect(returns).not.toContainText("$11.00");
  await expect(returns).not.toContainText("USD");
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Credit due", exact: true }),
  ).toHaveCount(0);
});
