import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";
import { addSelectedLabels } from "./label-selection";

for (const language of ["en", "fa"] as const) {
  for (const dimensions of [
    [60, 40],
    [10, 6],
  ] as const) {
    test(`saved ${dimensions[0]} × ${dimensions[1]} mm labels fit their physical boxes in ${language} without randomUUID`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        Object.defineProperty(globalThis.crypto, "randomUUID", {
          configurable: true,
          value: undefined,
        });
        window.print = () => {};
      });
      await signIn(page, "Floor Worker");
      await page.goto("/#labels");
      await page.getByRole("tab", { name: "Templates", exact: true }).click();
      await page
        .getByRole("button", { name: "New template", exact: true })
        .click();
      await page
        .getByLabel("Width (mm)", { exact: true })
        .fill(String(dimensions[0]));
      await page
        .getByLabel("Height (mm)", { exact: true })
        .fill(String(dimensions[1]));
      await page
        .getByRole("button", { name: "Save template", exact: true })
        .click();
      await expect(
        page.getByLabel("Saved template", { exact: true }),
      ).toHaveText("Template 1");
      await page.getByRole("tab", { name: "Products", exact: true }).click();
      await addSelectedLabels(page, ["0003", "0005", "0009"]);
      await page.getByRole("tab", { name: /^Waitlist/ }).click();
      await page
        .getByRole("button", { name: "Print labels", exact: true })
        .click();
      await page.emulateMedia({ media: "print" });
      const labels = page.locator(".label-print-output .shelf-label");
      await expect(labels).toHaveCount(3);
      await expect(labels.first().locator(".price")).toHaveText("$2.99");
      await expect(labels.first().locator('[lang="fa"]')).toBeVisible();
      const metrics = await labels.evaluateAll((boxes) =>
        boxes.map((box) => {
          const outer = box.getBoundingClientRect();
          const inner = box
            .querySelector(".shelf-label-content")!
            .getBoundingClientRect();
          const image = box
            .querySelector(".shelf-label-logo img")
            ?.getBoundingClientRect();
          return {
            width: outer.width,
            height: outer.height,
            overflow: Math.max(
              outer.left - inner.left,
              outer.top - inner.top,
              inner.right - outer.right,
              inner.bottom - outer.bottom,
              0,
            ),
            logoHeight: image?.height,
            priceFont: Number.parseFloat(
              getComputedStyle(box.querySelector(".price")!).fontSize,
            ),
            nameFont: Number.parseFloat(
              getComputedStyle(box.querySelector(".product-name strong")!)
                .fontSize,
            ),
          };
        }),
      );
      for (const metric of metrics) {
        expect(
          Math.abs(metric.width - (dimensions[0] * 96) / 25.4),
        ).toBeLessThan(0.2);
        expect(
          Math.abs(metric.height - (dimensions[1] * 96) / 25.4),
        ).toBeLessThan(0.2);
        expect(metric.overflow).toBeLessThanOrEqual(0.2);
        expect(metric.priceFont).toBeGreaterThan(metric.nameFont);
        if (dimensions[0] >= 50)
          expect(metric.logoHeight).toBeGreaterThanOrEqual(
            (8 * 96) / 25.4 - 0.1,
          );
        else expect(metric.logoHeight).toBeUndefined();
      }
      await page.emulateMedia({ media: "screen" });
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "No", exact: true })
        .click();
      if (language === "fa") await setLanguage(page, "fa");
      await page.reload();
      await page
        .getByRole("tab", {
          name: language === "en" ? "Templates" : "قالب‌ها",
          exact: true,
        })
        .click();
      await page
        .getByLabel(language === "en" ? "Saved template" : "قالب ذخیره‌شده", {
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: "Template 1", exact: true })
        .click();
      await expect(
        page.getByLabel(language === "en" ? "Width (mm)" : "عرض (میلی‌متر)", {
          exact: true,
        }),
      ).toHaveValue(String(dimensions[0]));
      await expect(page.getByRole("alert")).toHaveCount(0);
    });
  }
}
