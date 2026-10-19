import { expect, test } from "@playwright/test";
import {
  signIn,
  setBranch,
  setLanguage,
  openShellAction,
} from "../tests/helpers";
import { applyBlackTeaAcrossStores, route } from "../tests/e2-browser-flow";
import { readCanonicalBusinessEvidence } from "../tests/business-evidence";

for (const variant of [
  { key: "en-light", lang: "en", dark: false, width: 1440 },
  { key: "en-dark", lang: "en", dark: true, width: 1440 },
  { key: "fa-light", lang: "fa", dark: false, width: 1440 },
  { key: "phone-dark", lang: "en", dark: true, width: 390 },
] as const) {
  test(`E2 screenshots ${variant.key}`, async ({ page }, testInfo) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error")
        browserErrors.push(`console: ${message.text()}`);
    });
    await page.setViewportSize({ width: variant.width, height: 1000 });
    const { task, product } = await applyBlackTeaAcrossStores(page);
    if (variant.dark)
      await (await openShellAction(page, "Switch to dark theme")).click();
    await setLanguage(page, variant.lang);
    // Dismiss the actual optional toast through its public control; do not
    // hide overlays or alter business state for a screenshot.
    const dismiss = page.getByRole("button", {
      name: variant.lang === "fa" ? "بستن پیام واگرد" : "Dismiss Undo message",
      exact: true,
    });
    if (await dismiss.isVisible()) await dismiss.click();

    const capture = async (scene: string) => {
      await expect(page.locator("main h1")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.fonts.status))
        .toBe("loaded");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 2,
        ),
      ).toBe(false);
      expect(
        await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              "main .card,main .price-updates-row,main .price-update-check-row",
            ),
          ]
            .filter((node) => node.scrollWidth > node.clientWidth + 2)
            .map((node) => node.className),
        ),
      ).toEqual([]);
      const path = testInfo.outputPath(`${scene}-${variant.key}.png`);
      await page.screenshot({ path, fullPage: true, animations: "disabled" });
      await testInfo.attach(`${scene}-${variant.key}`, {
        path,
        contentType: "image/png",
      });
    };
    await signIn(page, "Branch Supervisor");
    await setBranch(page, "Branch 2");
    await route(page, "price-updates");
    await expect(page.locator("main .price-updates-row")).not.toHaveCount(0);
    await capture("price-updates-list");
    await route(page, `price-update?id=${encodeURIComponent(task.id)}`);
    await expect(page.locator("main .price-update-checks")).toBeVisible();
    await capture("price-update-task");
    await page
      .getByRole("button", { name: /^(Notifications,|اعلان‌ها،)/ })
      .click();
    await expect(page.locator(".personal-notification")).not.toHaveCount(0);
    await capture("price-updates-bell");
    await page.keyboard.press("Escape");
    await signIn(page, "Manager");
    await setBranch(page, "all");
    await route(page, "dashboard");
    await expect(page.locator(".price-update-dashboard-card")).toBeVisible();
    await capture("dashboard-price-updates");
    // Supplemental genuine element capture keeps this card readable beside the
    // required full-page phone image; it is not an edited/cropped image file.
    await page.locator(".price-update-dashboard-card").screenshot({
      path: testInfo.outputPath(`dashboard-card-detail-${variant.key}.png`),
      animations: "disabled",
    });
    await signIn(page, "Cashier");
    await setBranch(page, "Branch 2");
    await route(page, `lookup?search=${product.code}`);
    const search = page.locator(".lookup-page").getByRole("combobox", {
      name: variant.lang === "fa" ? "جست‌وجوی محصولات" : "Search products",
      exact: true,
    });
    await search.fill(product.code);
    await search.press("Enter");
    await expect(page.locator(".price-changed-hint")).toBeVisible();
    await capture("cashier-price-changed");
    await signIn(page, "Branch Supervisor");
    await setBranch(page, "Branch 2");
    await route(page, `price-update?id=${encodeURIComponent(task.id)}`);
    await page
      .getByRole("button", {
        name: variant.lang === "fa" ? "چاپ برچسب اکنون" : "Print label now",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog", {
        name:
          variant.lang === "fa"
            ? "آیا برچسب‌ها درست چاپ شدند؟"
            : "Did the labels print correctly?",
        exact: true,
      })
      .getByRole("button", {
        name: variant.lang === "fa" ? "بله" : "Yes",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: variant.lang === "fa" ? "برچسب جدید چاپ شد" : "New label printed",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("checkbox", {
        name:
          variant.lang === "fa"
            ? "در صندوق فروش تغییر داده شد"
            : "Changed on the cash register",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name:
          variant.lang === "fa"
            ? "در صندوق فروش تغییر داده شد"
            : "Changed on the cash register",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("button", {
        name: variant.lang === "fa" ? "علامت‌گذاری انجام‌شده" : "Mark as done",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).price_update_tasks?.find(
            (item) => item.id === task.id,
          )?.status,
      )
      .toBe("done");
    await signIn(page, "Manager");
    await setBranch(page, "all");
    await route(page, "price-updates?view=progress");
    await expect(
      page.locator("main .price-update-progress-group"),
    ).toBeVisible();
    const saved = (
      await readCanonicalBusinessEvidence(page)
    ).price_update_tasks!.find((item) => item.id === task.id)!;
    await expect(
      page.locator("main .price-update-progress-group"),
    ).toContainText(saved.completed_by!);
    await capture("manager-store-progress");

    expect(browserErrors).toEqual([]);
  });
}
