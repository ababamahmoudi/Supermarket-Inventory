import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

for (const language of ["en", "fa"] as const)
  for (const width of [390, 768, 900, 1024, 1180, 1280, 1440, 1920]) {
    test(`stored Persian decimal retains its actual visual order in ${language} at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Supervisor");
      await setLanguage(page, language);
      await page.goto("/#received");
      const name = page
        .locator('.received-table .product-name bdi[lang="fa"]')
        .filter({ hasText: "برنج باسماتی ۴٫۵ کیلوگرمی" })
        .first();
      await expect(name).toHaveText("برنج باسماتی ۴٫۵ کیلوگرمی");
      const fragment = name.locator(".unit-fragment");
      await expect(fragment).toHaveText("۴٫۵ کیلوگرمی");
      const visual = await fragment.evaluate((element) => {
        const number = element.querySelector("bdi")!;
        const node = number.firstChild!;
        const characters = [...(node.textContent ?? "")].map((value, index) => {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const bounds = range.getBoundingClientRect();
          return {
            value,
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
          };
        });
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          characters,
          lineTops: [
            ...new Set(
              [...range.getClientRects()].map((rect) => Math.round(rect.top)),
            ),
          ],
        };
      });
      expect(visual.characters.map((item) => item.value)).toEqual([
        "۴",
        "٫",
        "۵",
      ]);
      expect(visual.characters[0].left).toBeLessThan(visual.characters[1].left);
      expect(visual.characters[1].left).toBeLessThan(visual.characters[2].left);
      // Nested bidi can have a different font box, but every glyph shares the same baseline.
      expect(new Set(visual.characters.map((item) => item.top)).size).toBe(1);
      await info.attach("Persian decimal actual character geometry", {
        body: JSON.stringify(visual, null, 2),
        contentType: "application/json",
      });
    });
  }
