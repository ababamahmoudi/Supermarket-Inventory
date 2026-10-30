import { expect, test, type Page } from "@playwright/test";
import { installLocationReturnScene } from "./r2f-location-return-fixture";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { setBranch, setLanguage, openShellAction } from "./helpers";
import { auditR2fAlignment } from "./r2f-alignment";

async function platformFonts(page: Page, selectors: Record<string, string>) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const evidence: Record<
      string,
      { familyName: string; isCustomFont: boolean; glyphCount: number }[]
    > = {};
    for (const [name, selector] of Object.entries(selectors)) {
      const { nodeId } = await session.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector,
      });
      expect(nodeId, `actual rendered ${name}`).toBeGreaterThan(0);
      evidence[name] = (
        await session.send("CSS.getPlatformFontsForNode", { nodeId })
      ).fonts;
    }
    return evidence;
  } finally {
    await session.detach();
  }
}
const bundledPersian = (
  fonts: { familyName: string; isCustomFont: boolean; glyphCount: number }[],
) =>
  fonts.some(
    (font) =>
      font.isCustomFont &&
      /Vazirmatn/.test(font.familyName) &&
      font.glyphCount > 0,
  );
const caption = '.returns-overview-table th[data-column-key="credit"]';
const amount =
  '.returns-overview-table tbody tr[data-row-href="#return?id=r2f-return-one"] td[data-column-key="credit"] strong';
const unknown =
  '.returns-overview-table tbody tr[data-row-href="#return?id=r2f-return-two"] td[data-column-key="credit"] .ui-numeric-caption';

async function renderCaptionFont(page: Page, historical: boolean) {
  const transition = await page
    .locator(caption)
    .evaluate(async (node, previous) => {
      const element = node as HTMLElement;
      if (previous) element.style.fontFamily = "var(--font-en)";
      else element.style.removeProperty("font-family");
      const expectedFamily = previous
        ? getComputedStyle(document.documentElement).getPropertyValue(
            "--font-en",
          )
        : getComputedStyle(element.parentElement!).fontFamily;
      const inspect = () => {
        const fontFamily = getComputedStyle(element).fontFamily;
        const box = element.getBoundingClientRect();
        return {
          inlineFamily: element.style.fontFamily,
          fontFamily,
          width: box.width,
          height: box.height,
        };
      };
      // CDP platform fonts describe rendered glyphs. Establish the actual style
      // and layout, then let font loading and a paint finish before reading them.
      const requested = inspect();
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return { expectedFamily, requested, rendered: inspect() };
    }, historical);
  const normalizedFamily = (family: string) =>
    family
      .replace(/["']/g, "")
      .replace(/\s*,\s*/g, ",")
      .trim();
  for (const style of [transition.requested, transition.rendered]) {
    expect(style.inlineFamily).toBe(historical ? "var(--font-en)" : "");
    expect(normalizedFamily(style.fontFamily)).toBe(
      normalizedFamily(transition.expectedFamily),
    );
    expect(style.width).toBeGreaterThan(0);
    expect(style.height).toBeGreaterThan(0);
  }
  expect(transition.rendered.fontFamily.includes("Vazirmatn")).toBe(
    !historical,
  );
  return transition;
}

test("FA numeric captions use bundled interface glyphs across host fallbacks while return money retains numeric glyphs", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installLocationReturnScene(page);
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      delete state.returns.find((record) => record.id === "r2f-return-two")!
        .lines[0].unit_cost;
    },
    undefined,
  );
  await page.reload();
  await setLanguage(page, "fa");
  await setBranch(page, "Branch 1");
  await page.goto("/#returns");
  await expect(page.locator(amount)).toHaveText("$11.00");
  await expect(page.locator(unknown)).toHaveText("نیاز به بررسی");
  // Model a host with wider Arabic fallback without changing the bundled digit face.
  await page.evaluate(() =>
    document.documentElement.style.setProperty(
      "--font-en",
      'Manrope, "DejaVu Sans Mono", monospace',
    ),
  );
  const scenes = [];
  for (const width of [1440, 1000])
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 1000 });
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
          )
        ).click();
      await page.evaluate(() => document.fonts.ready);
      const fonts = await platformFonts(page, { caption, amount, unknown });
      expect(bundledPersian(fonts.caption)).toBe(true);
      expect(fonts.caption.every((font) => font.isCustomFont)).toBe(true);
      expect(bundledPersian(fonts.unknown)).toBe(true);
      expect(fonts.unknown.every((font) => font.isCustomFont)).toBe(true);
      expect(
        fonts.amount.every(
          (font) => font.isCustomFont && /Manrope/.test(font.familyName),
        ),
      ).toBe(true);
      expect(
        fonts.amount.reduce((count, font) => count + font.glyphCount, 0),
      ).toBeGreaterThanOrEqual(6);
      const alignment = await auditR2fAlignment(page, { scene: "D8" });
      expect(alignment.columns).toBeGreaterThan(0);
      expect(alignment.failures).toEqual([]);
      scenes.push({ width, theme, fonts, alignment });
      await page.screenshot({
        path: info.outputPath(`return-caption-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  // The actual previous .numeric font contract is rejected even on a host whose
  // default Arabic fallback happens to fit. This is font evidence, not a waiver.
  const historicalStyle = await renderCaptionFont(page, true);
  const previous = await platformFonts(page, { caption, amount });
  expect(bundledPersian(previous.caption)).toBe(false);
  expect(
    previous.caption.some((font) => !font.isCustomFont && font.glyphCount > 0),
  ).toBe(true);
  expect(
    previous.amount.every(
      (font) => font.isCustomFont && /Manrope/.test(font.familyName),
    ),
  ).toBe(true);
  expect(
    previous.amount.reduce((count, font) => count + font.glyphCount, 0),
  ).toBeGreaterThanOrEqual(6);
  const restoredStyle = await renderCaptionFont(page, false);
  const restored = await platformFonts(page, { caption });
  expect(bundledPersian(restored.caption)).toBe(true);
  expect(restored.caption.every((font) => font.isCustomFont)).toBe(true);
  expect((await auditR2fAlignment(page, { scene: "D8" })).failures).toEqual([]);
  await info.attach("actual-platform-fonts-and-alignment", {
    body: JSON.stringify(
      { scenes, historicalStyle, previous, restoredStyle, restored },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
