import { expect, test, type Locator } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";
import {
  inspectC8Layout,
  openC8PriceDialog,
  readC8State,
} from "../scripts/capture-c8-proof.mjs";

async function captionBounds(button: Locator) {
  return button.evaluate((element) => {
    const track = element.closest(".ui-segments")!;
    const caption = element.querySelector(":scope > span")!;
    const range = document.createRange();
    range.selectNodeContents(caption);
    const glyph = range.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const frame = track.getBoundingClientRect();
    return {
      text: caption.textContent,
      font: parseFloat(getComputedStyle(element).fontSize),
      trackHeight: frame.height,
      buttonHeight: box.height,
      top: box.top,
      glyphStart: glyph.left - Math.max(frame.left, box.left),
      glyphEnd: Math.min(frame.right, box.right) - glyph.right,
      buttonStart: box.left - frame.left,
      buttonEnd: frame.right - box.right,
    };
  });
}

for (const width of [360, 390, 430, 509, 760])
  for (const language of ["en", "fa"] as const)
    test(`R2g B2 full Stores captions and reachable Ends choices ${width} ${language}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 932 });
      await signIn(page, "Manager");
      await setBranch(page, "Branch 1");
      await setLanguage(page, language);
      const before = await readC8State(page);
      // The retained E3 regression uses the existing sale, not the blank
      // new-sale example in the earlier B2 composition proof.
      const dialog = await openC8PriceDialog(page, "0012");
      const stores = dialog.getByRole("group", {
        name: language === "en" ? "Stores" : "فروشگاه‌ها",
        exact: true,
      });
      const storeCaptions = stores.getByRole("button");
      await expect(storeCaptions).toHaveText(
        language === "en"
          ? ["All stores", "Only North York", "Choose stores"]
          : ["همهٔ فروشگاه‌ها", "فقط نورث یورک", "انتخاب فروشگاه‌ها"],
      );
      for (const button of await storeCaptions.all()) {
        const bounds = await captionBounds(button);
        expect(bounds.font).toBe(14);
        expect(bounds.trackHeight).toBe(44);
        expect(bounds.glyphStart).toBeGreaterThanOrEqual(-1);
        expect(bounds.glyphEnd).toBeGreaterThanOrEqual(-1);
        expect(bounds.buttonStart).toBeGreaterThanOrEqual(-1);
        expect(bounds.buttonEnd).toBeGreaterThanOrEqual(-1);
      }
      const ends = dialog.getByRole("group", {
        name: language === "en" ? "Ends" : "پایان",
        exact: true,
      });
      await ends.scrollIntoViewIfNeeded();
      let proof = await inspectC8Layout(
        page,
        "r2g-price-ends",
        language,
        width,
      );
      expect(proof.failures).toEqual([]);
      expect(proof.priceEndTracks).toHaveLength(1);
      const buttons = ends.getByRole("button");
      await expect(buttons).toHaveCount(5);
      await buttons.first().focus();
      await buttons.first().press("Home");
      const visited: Awaited<ReturnType<typeof captionBounds>>[] = [];
      for (let index = 0; index < 5; index++) {
        const button = buttons.nth(index);
        await expect(button).toBeFocused();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        const bounds = await captionBounds(button);
        visited.push(bounds);
        expect(bounds.font).toBe(14);
        expect(bounds.trackHeight).toBe(44);
        expect(bounds.buttonHeight).toBe(40);
        expect(bounds.glyphStart).toBeGreaterThanOrEqual(-1);
        expect(bounds.glyphEnd).toBeGreaterThanOrEqual(-1);
        expect(bounds.buttonStart).toBeGreaterThanOrEqual(-1);
        expect(bounds.buttonEnd).toBeGreaterThanOrEqual(-1);
        proof = await inspectC8Layout(page, "r2g-price-ends", language, width);
        expect(proof.failures).toEqual([]);
        expect(proof.priceEndTracks).toHaveLength(1);
        if (index === 4 && proof.priceEndTracks[0].maximum > 1) {
          expect(proof.priceEndTracks[0].fadeStart).toBe(true);
          expect(proof.priceEndTracks[0].fadeEnd).toBe(false);
        }
        if (index < 4) {
          await button.press(language === "fa" ? "ArrowLeft" : "ArrowRight");
          const next = await captionBounds(buttons.nth(index + 1));
          expect(Math.abs(next.top - bounds.top)).toBeLessThanOrEqual(2);
        }
      }
      await testInfo.attach("native-ends-caption-geometry", {
        body: JSON.stringify({
          width,
          language,
          visited,
          track: proof.priceEndTracks,
        }),
        contentType: "application/json",
      });
      await dialog.screenshot({
        path: testInfo.outputPath(`price-ends-${width}-${language}.png`),
      });
      await dialog
        .getByRole("button", {
          name: language === "en" ? "Cancel" : "انصراف",
          exact: true,
        })
        .click();
      const after = await readC8State(page);
      for (const key of [
        "products",
        "sales",
        "sale_requests",
        "offers",
        "invoice",
        "ledger",
        "stock_movements",
      ] as const)
        expect(after[key]).toEqual(before[key]);
    });

for (const language of ["en", "fa"] as const)
  test(`R2g B2 scroll qualification rejects shifted geometry and copied tracks ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 932 });
    await signIn(page, "Manager");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    const dialog = await openC8PriceDialog(page, "0012");
    const ends = dialog
      .getByRole("group", {
        name: language === "en" ? "Ends" : "پایان",
        exact: true,
      })
      .first();
    await ends.scrollIntoViewIfNeeded();
    const inspect = () =>
      inspectC8Layout(page, "r2g-price-negative", language, 360);
    const positive = await inspect();
    expect(positive.failures).toEqual([]);
    expect(positive.priceEndTracks).toHaveLength(1);
    for (const mutation of [
      "shift-track",
      "shift-button",
      "missing-price-label",
      "missing-fade",
      "counterfeit-track",
    ] as const) {
      await ends.evaluate((track, mutation) => {
        if (mutation === "shift-track")
          track.style.transform = "translateX(4px)";
        if (mutation === "shift-button")
          (track.children[1] as HTMLElement).style.transform =
            "translateX(4px)";
        if (mutation === "missing-price-label")
          track
            .closest("dialog")!
            .querySelector(".change-price-amount-field > label")!
            .setAttribute("for", "counterfeit-price");
        if (mutation === "missing-fade") track.style.maskImage = "none";
        if (mutation === "counterfeit-track") {
          const fake = track.parentElement!.cloneNode(true) as HTMLElement;
          fake.dataset.counterfeitTrack = "";
          fake.style.inlineSize = "130px";
          fake.style.overflow = "hidden";
          track.closest(".change-price-ends-row")!.append(fake);
        }
      }, mutation);
      const negative = await inspect();
      expect(
        negative.failures.some(
          (failure: string) =>
            failure.includes("form control clips sideways") ||
            failure.includes("form controls overlap"),
        ),
      ).toBe(true);
      if (mutation !== "counterfeit-track")
        expect(negative.priceEndTracks).toHaveLength(0);
      await ends.evaluate((track) => {
        track.style.removeProperty("transform");
        track.style.removeProperty("mask-image");
        for (const button of track.children)
          (button as HTMLElement).style.removeProperty("transform");
        const dialog = track.closest("dialog")!;
        const label = dialog.querySelector<HTMLLabelElement>(
          ".change-price-amount-field > label",
        )!;
        label.htmlFor = dialog.querySelector<HTMLInputElement>(
          ".change-price-amount-field input",
        )!.id;
        dialog.querySelector("[data-counterfeit-track]")?.remove();
      });
      const restored = await inspect();
      expect(restored.failures).toEqual([]);
      expect(restored.priceEndTracks).toHaveLength(1);
    }
  });
