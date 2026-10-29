import { expect, test, type Locator } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";
import {
  inspectC8Layout,
  openC8PriceDialog,
  readC8State,
} from "../scripts/capture-c8-proof.mjs";

async function unitRectangles(fragment: Locator) {
  return fragment.evaluate((element) => {
    const rectangles = (range: Range) =>
      [...range.getClientRects()]
        .filter((rect) => rect.width > 0.1 && rect.height > 0.1)
        .map(({ top, bottom, height }) => ({ top, bottom, height }));
    const elementRange = document.createRange();
    elementRange.selectNodeContents(element);
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const glyphs: ReturnType<typeof rectangles> = [];
    while (text.nextNode()) {
      if (!text.currentNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(text.currentNode);
      glyphs.push(...rectangles(range));
    }
    return { element: rectangles(elementRange), glyphs };
  });
}

for (const language of ["en", "fa"] as const)
  test(`B2 real unit glyph lines exclude BDI boxes and reject tall overlapping wraps ${language} @r2g-509`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 509, height: 932 });
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    const dialog = await openC8PriceDialog(page, "0012");
    const before = await readC8State(page);
    // The real Product page remains behind the native modal. Its English
    // name contains the same retained 24 cm fragment as the Firefox case.
    const fragment = page.locator(
      language === "fa"
        ? ".product-page > .page-header .product-other-name .unit-fragment"
        : ".product-page > .page-header h1 .unit-fragment",
    );
    await expect(fragment).toHaveCount(1);
    await expect(fragment).toHaveText("24 cm");
    const number = fragment.locator(":scope > bdi");
    await expect(number).toHaveText("24");
    const inspect = () =>
      inspectC8Layout(page, "real-unit-glyph-lines", language, 509);
    const clean = await inspect();
    expect(clean.failures).toEqual([]);
    const saved = {
      fragment: await fragment.getAttribute("style"),
      number: await number.getAttribute("style"),
    };
    const restore = async () => {
      for (const [node, style] of [
        [fragment, saved.fragment],
        [number, saved.number],
      ] as const)
        await node.evaluate((element, original) => {
          if (original === null) element.removeAttribute("style");
          else element.setAttribute("style", original);
        }, style);
    };
    try {
      // A tall inline BDI has a line box in addition to the number glyphs.
      // The number and unit still share one painted text line. The old
      // element-Range classifier counted that wrapper as another line.
      await number.evaluate((element) => {
        element.style.display = "inline-block";
        element.style.lineHeight = "72px";
      });
      const oneLine = await unitRectangles(fragment);
      expect(
        new Set(oneLine.element.map((rect) => Math.round(rect.top))).size,
      ).toBeGreaterThan(1);
      expect(
        new Set(oneLine.glyphs.map((rect) => Math.round(rect.top))).size,
      ).toBe(1);
      const painted = await inspect();
      expect(painted.failures).toEqual([]);
      await info.attach("Real one-line glyphs and distinct BDI wrapper box", {
        body: JSON.stringify({ rectangles: oneLine, proof: painted }),
        contentType: "application/json",
      });
      await restore();

      for (const lineHeight of [40, 7]) {
        await fragment.evaluate((element, height) => {
          Object.assign(element.style, {
            display: "block",
            inlineSize: "20px",
            whiteSpace: "normal",
            fontSize: "32px",
            lineHeight: `${height}px`,
          });
        }, lineHeight);
        const wrapped = await unitRectangles(fragment);
        const tops = [...new Set(wrapped.glyphs.map((rect) => rect.top))].sort(
          (a, b) => a - b,
        );
        expect(tops.length).toBeGreaterThan(1);
        if (lineHeight === 7) {
          const upper = wrapped.glyphs.find((rect) => rect.top === tops[0])!;
          const lower = wrapped.glyphs.find((rect) => rect.top === tops[1])!;
          expect(
            Math.min(upper.bottom, lower.bottom) -
              Math.max(upper.top, lower.top),
          ).toBeGreaterThan(Math.min(upper.height, lower.height) / 2);
        }
        const broken = await inspect();
        expect(broken.failures).toContain(
          "real-unit-glyph-lines: unit fragment broken across lines: 24 cm",
        );
        await info.attach(
          `Real wrapped glyphs with ${lineHeight}px line height`,
          {
            body: JSON.stringify({ rectangles: wrapped, proof: broken }),
            contentType: "application/json",
          },
        );
        await restore();
        expect((await inspect()).failures).toEqual([]);
      }
    } finally {
      await restore();
    }
    await dialog
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    expect(await readC8State(page)).toEqual(before);
  });
