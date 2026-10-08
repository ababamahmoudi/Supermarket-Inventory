import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

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
      });
      await signIn(page, "Floor Worker");
      await page.goto("/#labels");
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
      if (language === "fa") await setLanguage(page, "fa");
      const labels = page.locator(".shelf-label");
      await expect(labels).toHaveCount(3);
      await expect(labels.first().locator(".price")).toHaveText("$2.99");
      await expect(labels.first().locator('[lang="fa"]')).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      const metrics = await labels.evaluateAll((boxes) =>
        boxes.map((box) => {
          const outer = box.getBoundingClientRect();
          const inner = box
            .querySelector(".shelf-label-content")!
            .getBoundingClientRect();
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
      }
      await page.reload();
      await expect(
        page.getByLabel(
          language === "en" ? "Saved template" : "قالب ذخیره‌شده",
          { exact: true },
        ),
      ).toContainText(
        language === "en" ? "Choose a template" : "یک قالب انتخاب کنید",
      );
      await page
        .getByLabel(language === "en" ? "Saved template" : "قالب ذخیره‌شده", {
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: "Template 1", exact: true })
        .click();
      await expect(labels).toHaveCount(3);
      await expect(page.locator(".label-unused")).toHaveCount(0);
    });
  }
}
