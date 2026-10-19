import { expect, test, type Locator } from "@playwright/test";
import { signIn } from "./helpers";
import { addSelectedLabels } from "./label-selection";
import { appearance, settled } from "../scripts/c5-browser-proof.mjs";
import { inspectC8Layout } from "../scripts/capture-c8-proof.mjs";

async function measurePaper(label: Locator) {
  return label.evaluate((element) => {
    const outer = element.getBoundingClientRect();
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = (color: number[]) =>
      color.slice(0, 3).reduce((total, channel, index) => {
        const value = channel / 255;
        const linear =
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        return total + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
    const text = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim() || !node.parentElement) continue;
      const parent = node.parentElement;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      if (!rects.length) continue;
      let background = [255, 255, 255];
      for (
        let surface: Element | null = parent;
        surface;
        surface = surface.parentElement
      ) {
        const color = rgb(getComputedStyle(surface).backgroundColor);
        if (color.length >= 3 && (color.length < 4 || color[3] === 1)) {
          background = color;
          break;
        }
        if (surface === element) break;
      }
      const foreground = rgb(getComputedStyle(parent).color);
      const dark = luminance(foreground);
      const light = luminance(background);
      text.push({
        value: node.textContent.trim(),
        color: getComputedStyle(parent).color,
        contrast:
          (Math.max(dark, light) + 0.05) / (Math.min(dark, light) + 0.05),
        overflow: Math.max(
          0,
          ...rects.flatMap((rect) => [
            outer.left - rect.left,
            outer.top - rect.top,
            rect.right - outer.right,
            rect.bottom - outer.bottom,
          ]),
        ),
      });
    }
    return {
      width: outer.width,
      height: outer.height,
      background: getComputedStyle(element).backgroundColor,
      text,
    };
  });
}

for (const variant of [
  "en-light",
  "en-dark",
  "fa-light",
  "phone-dark",
] as const) {
  for (const style of ["regular", "promo"] as const) {
    test(`${style} label paper stays readable in ${variant} before and during print`, async ({
      page,
    }, testInfo) => {
      const phone = variant === "phone-dark";
      await page.setViewportSize({
        width: phone ? 390 : 1440,
        height: phone ? 844 : 1080,
      });
      await page.addInitScript(() => {
        window.print = () => {};
      });
      await signIn(page, "Supervisor");
      await page.goto("/#labels");
      if (style === "regular") await addSelectedLabels(page, ["0016"]);
      await page.getByRole("tab", { name: /^Waitlist/ }).click();
      if (style === "regular") {
        await page
          .getByRole("tablist", { name: "Label styles", exact: true })
          .getByRole("tab", { name: /^Regular/ })
          .click();
      }
      await appearance(page, phone ? "en-dark" : variant);
      await settled(page);
      await page.screenshot({
        path: testInfo.outputPath("preview-full.png"),
        fullPage: true,
        animations: "disabled",
      });
      const preview = page
        .locator(".label-grayscale-preview .shelf-label")
        .first();
      await preview.scrollIntoViewIfNeeded();
      await expect(preview).toContainText(
        style === "promo" ? "$16.99" : "$7.49",
      );
      await expect(preview).toContainText(style === "promo" ? "0012" : "0016");
      const screenMetrics = await measurePaper(preview);
      expect(screenMetrics.background).toBe("rgb(255, 255, 255)");
      expect(screenMetrics.text.length).toBeGreaterThan(4);
      for (const word of screenMetrics.text) {
        expect(word.contrast, word.value).toBeGreaterThanOrEqual(7);
        expect(word.overflow, word.value).toBeLessThanOrEqual(0.25);
      }
      const layout = await inspectC8Layout(
        page,
        "label-paper",
        variant === "fa-light" ? "fa" : "en",
        phone ? 390 : 1440,
      );
      expect(layout.failures).toEqual([]);
      await page
        .getByRole("button", {
          name: variant === "fa-light" ? "چاپ برچسب‌ها" : "Print labels",
          exact: true,
        })
        .click();
      await page.emulateMedia({ media: "print" });
      const printed = page.locator(".label-print-output .shelf-label").first();
      const printMetrics = await measurePaper(printed);
      const dimensions = style === "promo" ? [210, 148.5] : [60, 40];
      expect(
        Math.abs(printMetrics.width - (dimensions[0] * 96) / 25.4),
      ).toBeLessThan(0.2);
      expect(
        Math.abs(printMetrics.height - (dimensions[1] * 96) / 25.4),
      ).toBeLessThan(0.2);
      for (const word of printMetrics.text) {
        expect(word.contrast, word.value).toBeGreaterThanOrEqual(7);
        expect(word.overflow, word.value).toBeLessThanOrEqual(0.25);
      }
    });
  }
}
