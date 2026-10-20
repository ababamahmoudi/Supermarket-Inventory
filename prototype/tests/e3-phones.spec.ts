import { resolve } from "node:path";
import { applyBlackTeaAcrossStores } from "./e2-browser-flow";
import {
  openC8PriceDialog,
  postC8SaleCostInvoice,
} from "../scripts/capture-c8-proof.mjs";
import { expect, test } from "@playwright/test";
import { inspectC8Layout } from "../scripts/capture-c8-proof.mjs";
import { setBranch, setLanguage, signIn } from "./helpers";
const lists = [
  { page: "products", selector: ".catalog-products-table" },
  { page: "labels", selector: ".labels-product-table" },
  { page: "received", selector: ".received-table" },
  { page: "suppliers", selector: ".suppliers-table" },
  { page: "payables", selector: ".payables-overview-table" },
  { page: "returns", selector: ".returns-overview-table" },
  { page: "dashboard", selector: ".dashboard-invoices .ui-data-table" },
];
for (const width of [390, 430])
  for (const language of ["en", "fa"] as const) {
    test(`E3 compact phone lists ${width} ${language}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 932 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await signIn(page, "Manager");
      await setBranch(page, "Branch 1");
      await setLanguage(page, language);
      for (const scene of lists) {
        await page.goto(`/#${scene.page}`);
        const list = page.locator(scene.selector).first();
        await expect(list).toBeVisible();
        const rows = list.locator("tr.phone-list-row");
        await expect(rows.first()).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);
        for (const row of await rows.all()) {
          await expect(row.locator(".phone-list-name")).toBeVisible();
          await expect(row.locator(".phone-list-value")).toBeVisible();
          await expect(
            row.locator(".phone-list-chevron .table-row-link"),
          ).toHaveCount(1);
          await expect(row.locator(".table-details-toggle")).toHaveCount(0);
          expect(
            await row.evaluate((element) => ({
              radius: getComputedStyle(element).borderRadius,
              background: getComputedStyle(element).backgroundColor,
              secondaryDirection: getComputedStyle(
                element.querySelector(".phone-list-secondary")!,
              ).flexDirection,
            })),
          ).toEqual({
            radius: "0px",
            background: "rgba(0, 0, 0, 0)",
            secondaryDirection: "row",
          });
        }
        if (scene.page === "products" || scene.page === "labels") {
          const englishName = rows
            .filter({ hasText: "Stainless Steel Pot" })
            .first()
            .locator(".phone-list-name")
            .getByText("Stainless Steel Pot 24 cm", { exact: true });
          await expect(englishName).toBeVisible();
          const size = englishName
            .locator(".unit-fragment")
            .filter({ hasText: /^24 cm$/ });
          await expect(size).toBeVisible();
          expect(
            await size.evaluate((element) => element.getClientRects().length),
          ).toBe(1);
        }
        if (scene.page === "received" && language === "fa") {
          for (const quantity of [
            {
              name: "Basmati Rice 4.5 kg",
              cases: "7",
              loose: "2",
              total: "30",
            },
            {
              name: "Dried Red Kidney Beans 900 g",
              cases: "3",
              loose: "4",
              total: "40",
            },
          ]) {
            const receipt = rows.filter({ hasText: quantity.name }).filter({
              has: page
                .locator(".cases-and-units .quantity-number")
                .filter({ hasText: new RegExp(`^${quantity.cases}$`) }),
            });
            await expect(receipt).toHaveCount(1);
            const expression = receipt.locator(".cases-and-units");
            const pairs = expression.locator(".quantity-pair");
            await expect(pairs).toHaveText([
              `${quantity.cases} کارتن`,
              `${quantity.loose} واحد`,
            ]);
            await expect(
              receipt.locator(".received-units .quantity-pair"),
            ).toHaveText(`${quantity.total} واحد`);
            const geometry = await expression.evaluate((element) => {
              const pairNodes = [
                ...element.querySelectorAll<HTMLElement>(".quantity-pair"),
              ];
              const separator = element
                .querySelector(".quantity-separator")!
                .getBoundingClientRect();
              return {
                direction: getComputedStyle(element).direction,
                separator: { left: separator.left, right: separator.right },
                pairs: pairNodes.map((pair) => {
                  const number =
                    pair.querySelector<HTMLElement>(".quantity-number")!;
                  const label =
                    pair.querySelector<HTMLElement>(".quantity-label")!;
                  const numberRect = number.getBoundingClientRect();
                  const labelRect = label.getBoundingClientRect();
                  const rect = pair.getBoundingClientRect();
                  return {
                    direction: getComputedStyle(pair).direction,
                    numberDirection: getComputedStyle(number).direction,
                    numberLeft: numberRect.left,
                    labelRight: labelRect.right,
                    numberTop: numberRect.top,
                    numberBottom: numberRect.bottom,
                    labelTop: labelRect.top,
                    labelBottom: labelRect.bottom,
                    numberRects: number.getClientRects().length,
                    labelRects: label.getClientRects().length,
                    left: rect.left,
                    right: rect.right,
                  };
                }),
              };
            });
            expect(geometry.direction).toBe("rtl");
            expect(geometry.pairs).toHaveLength(2);
            for (const pair of geometry.pairs) {
              expect(pair.direction).toBe("rtl");
              expect(pair.numberDirection).toBe("ltr");
              expect(pair.numberLeft).toBeGreaterThanOrEqual(
                pair.labelRight - 1,
              );
              expect(pair.numberTop).toBeLessThan(pair.labelBottom);
              expect(pair.labelTop).toBeLessThan(pair.numberBottom);
              expect(pair.numberRects).toBe(1);
              expect(pair.labelRects).toBe(1);
            }
            // Cases are read first from the right; each number stays with its own label.
            expect(geometry.pairs[0].left).toBeGreaterThanOrEqual(
              geometry.separator.right - 1,
            );
            expect(geometry.separator.left).toBeGreaterThanOrEqual(
              geometry.pairs[1].right - 1,
            );
          }
        }
        if (scene.page === "labels") {
          const checkbox = rows.first().getByRole("checkbox");
          await checkbox.check();
          await expect(checkbox).toBeChecked();
          await expect(page).toHaveURL(/#labels$/);
          await checkbox.uncheck();
        }
        const layout = await inspectC8Layout(
          page,
          `e3-${scene.page}`,
          language,
          width,
        );
        expect(layout.failures).toEqual([]);
        await testInfo.attach(`${scene.page}-${language}-${width} layout`, {
          body: JSON.stringify(layout, null, 2),
          contentType: "application/json",
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: testInfo.outputPath(`${scene.page}-${language}-${width}.png`),
          fullPage: true,
        });
      }
      await page.goto("/#dashboard");
      const returns = page.locator(".dashboard-returns .dashboard-list-row");
      if (await returns.count()) {
        await expect(
          returns.first().locator(".dashboard-list-action .table-row-link"),
        ).toHaveCount(1);
        await expect(
          returns.first().locator(".dashboard-list-copy"),
        ).toBeVisible();
        const positions = await returns.first().evaluate((row) => {
          const copy = row
            .querySelector(".dashboard-list-copy")!
            .getBoundingClientRect();
          const pill = row
            .querySelector(".dashboard-list-pill")!
            .getBoundingClientRect();
          return {
            copyStart: copy.left,
            copyEnd: copy.right,
            pillStart: pill.left,
            pillEnd: pill.right,
          };
        });
        if (language === "fa")
          expect(positions.pillEnd).toBeLessThanOrEqual(
            positions.copyStart + 1,
          );
        else
          expect(positions.copyEnd).toBeLessThanOrEqual(
            positions.pillStart + 1,
          );
      }
      await signIn(page, "ny-floor");
      await page.goto("/#suppliers");
      await expect(
        page.locator(".suppliers-table .phone-list-row").first(),
      ).toBeVisible();
      await expect(page.locator(".suppliers-table")).not.toContainText(
        /Balance|Overdue|مانده|سررسید گذشته/,
      );
      expect(errors).toEqual([]);
    });
    test(`E3 new screens retain genuine phone layout ${width} ${language}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 932 });
      await page.goto("/");
      await signIn(page, "Manager");
      await setLanguage(page, language);
      for (const route of ["settings?group=people", "price-updates"]) {
        await page.goto(`/#${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        if (route.startsWith("settings")) {
          await page
            .getByRole("button", {
              name: language === "fa" ? "افزودن شخص" : "Add person",
              exact: true,
            })
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page
            .getByRole("dialog")
            .getByRole("checkbox", {
              name: language === "fa" ? "نورث یورک" : "North York",
              exact: true,
            })
            .check();
          const layout = await inspectC8Layout(
            page,
            "e3-add-person",
            language,
            width,
          );
          expect(layout.failures).toEqual([]);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: testInfo.outputPath(`add-person-${language}-${width}.png`),
            fullPage: false,
          });
          await page.keyboard.press("Escape");
          const person = page
            .locator(".people-e1 tbody tr")
            .filter({ has: page.getByText("cashier", { exact: true }) });
          await person
            .getByRole("button", {
              name: language === "fa" ? "ویرایش" : "Edit",
              exact: true,
            })
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          const editLayout = await inspectC8Layout(
            page,
            "e3-edit-person",
            language,
            width,
          );
          expect(editLayout.failures).toEqual([]);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: testInfo.outputPath(`edit-person-${language}-${width}.png`),
            fullPage: false,
          });
          await page.keyboard.press("Escape");
        }
        const layout = await inspectC8Layout(
          page,
          `e3-${route}`,
          language,
          width,
        );
        expect(layout.failures).toEqual([]);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.replace(/[?=]/g, "-")}-${language}-${width}.png`,
          ),
          fullPage: true,
        });
      }
      await signIn(page, "Branch Supervisor");
      await page.goto("/#dashboard");
      await expect(page.locator(".location-dashboard")).toBeVisible();
      let layout = await inspectC8Layout(
        page,
        "e3-location-dashboard",
        language,
        width,
      );
      expect(layout.failures).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(
          `location-dashboard-${language}-${width}.png`,
        ),
        fullPage: true,
      });
      await page
        .locator(".topbar")
        .getByRole("combobox", {
          name: language === "fa" ? "مکان" : "Location",
          exact: true,
        })
        .click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await expect(page.locator(".ui-select-popover")).toHaveCSS(
        "opacity",
        "1",
      );
      const pickerLayout = await inspectC8Layout(
        page,
        "e3-location-picker",
        language,
        width,
      );
      expect(pickerLayout.failures).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`location-picker-${language}-${width}.png`),
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      const bell = page.locator(".topbar").getByRole("button", {
        name: language === "fa" ? /^اعلان‌ها،/ : /^Notifications,/,
      });
      await bell.click();
      await expect(page.getByRole("menu").last()).toBeVisible();
      await expect(page.locator(".ui-menu-popover")).toHaveCSS("opacity", "1");
      layout = await inspectC8Layout(
        page,
        "e3-notification-bell",
        language,
        width,
      );
      expect(layout.failures).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`notification-bell-${language}-${width}.png`),
        fullPage: true,
      });
    });
  }

for (const width of [390, 430])
  for (const language of ["en", "fa"] as const) {
    test(`E3 genuine task, change-price and sale-alert phone layout ${width} ${language}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 932 });
      await page.goto("/");
      const { task } = await applyBlackTeaAcrossStores(page);
      await signIn(page, "Branch Supervisor");
      await setBranch(page, "Branch 2");
      await setLanguage(page, language);
      for (const route of [
        "price-updates",
        `price-update?id=${encodeURIComponent(task.id)}`,
      ]) {
        await page.goto(`/#${route}`);
        await expect(
          page.locator(".price-updates-page,.price-update-detail"),
        ).toBeVisible();
        if (route.startsWith("price-update?")) {
          // S1 (Ali's rule): a price update has only Seen and Done.
          await expect(
            page.getByRole("button", {
              name:
                language === "fa" ? "علامت‌گذاری دیده‌شده" : "Mark as seen",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name:
                language === "fa" ? "علامت‌گذاری انجام‌شده" : "Mark as done",
              exact: true,
            }),
          ).toBeVisible();
        }
        const layout = await inspectC8Layout(
          page,
          `e3-${route}`,
          language,
          width,
        );
        expect(layout.failures).toEqual([]);
        if (route.startsWith("price-update?")) {
          expect(
            await page.evaluate(() => {
              const stack =
                document.querySelector<HTMLElement>(".undo-toast-stack");
              if (!stack) return [];
              if (!stack.parentElement?.hasAttribute("data-undo-toast-host"))
                return ["Undo has no reserved task row"];
              const box = stack.getBoundingClientRect();
              return [
                ...document.querySelectorAll<HTMLElement>(
                  ".price-update-status-steps button",
                ),
              ]
                .filter((control) => {
                  if (stack.contains(control)) return false;
                  const rect = control.getBoundingClientRect();
                  return (
                    Math.min(rect.right, box.right) -
                      Math.max(rect.left, box.left) >
                      1 &&
                    Math.min(rect.bottom, box.bottom) -
                      Math.max(rect.top, box.top) >
                      1
                  );
                })
                .map((control) => control.textContent?.trim());
            }),
          ).toEqual([]);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.startsWith("price-update?") ? "task-seen-done" : "pending-tasks"}-${language}-${width}.png`,
          ),
          fullPage: true,
        });
      }
      await signIn(page, "Manager");
      await setBranch(page, "all");
      await page.goto("/#price-updates?view=progress");
      await expect(page.locator(".price-update-progress-group")).toBeVisible();
      let layout = await inspectC8Layout(
        page,
        "e3-store-progress",
        language,
        width,
      );
      expect(layout.failures).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`store-progress-${language}-${width}.png`),
        fullPage: true,
      });
      await setBranch(page, "Branch 1");
      await openC8PriceDialog(page, "0012");
      layout = await inspectC8Layout(page, "e3-change-price", language, width);
      expect(layout.failures).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`change-price-${language}-${width}.png`),
        fullPage: false,
      });
      await page.keyboard.press("Escape");
      await postC8SaleCostInvoice(
        page,
        resolve("public/demo-originals/fictional-hw-5012.svg"),
      );
      await page.goto("/#alerts");
      await expect(page.locator(".sales-alert-card")).toBeVisible();
      layout = await inspectC8Layout(
        page,
        "e3-sale-cost-alert",
        language,
        width,
      );
      expect(layout.failures).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`sale-cost-alert-${language}-${width}.png`),
        fullPage: true,
      });
    });
  }
