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
          await expect(
            page.getByRole("checkbox", {
              name:
                language === "fa"
                  ? "در صندوق فروش تغییر داده شد"
                  : "Changed on the cash register",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("checkbox", {
              name:
                language === "fa" ? "برچسب جدید چاپ شد" : "New label printed",
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
                  ".price-update-checks button",
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
            `${route.startsWith("price-update?") ? "task-checkboxes" : "pending-tasks"}-${language}-${width}.png`,
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
