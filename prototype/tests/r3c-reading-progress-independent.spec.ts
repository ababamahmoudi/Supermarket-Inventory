import { expect, test, type Locator, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction, setLanguage } from "./helpers";
import {
  configureLive,
  deferred,
  expectNoPosting,
  fictionalPhoto,
  mockReader,
  newLiveOriginal,
  pressRead,
  retainedSourceHashes,
  sourceHash,
  t,
} from "./r3-live-reading-helpers";

/** Independently measure the loaded phone composition, including clipping ancestors. */
async function phoneProgressGeometry(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(
      '[data-testid="live-reading-progress"]',
    )!;
    const original = document.querySelector<HTMLElement>(
      ".receiving-layout > .original-viewer",
    )!;
    const frame = card.getBoundingClientRect();
    const source = original.getBoundingClientRect();
    const chips = Array.from(
      card.querySelectorAll<HTMLElement>(".live-reading-step"),
    );
    const bounds = chips.map((chip) => chip.getBoundingClientRect());
    const failures: string[] = [];
    if (bounds.length !== 3) failures.push("three actual stage chips required");
    if (bounds.some((box) => Math.abs(box.top - bounds[0].top) > 2))
      failures.push("stage chips stack instead of sharing one row");
    if (
      bounds.some(
        (box) =>
          box.left < frame.left - 2 ||
          box.right > frame.right + 2 ||
          box.top < frame.top - 2 ||
          box.bottom > frame.bottom + 2,
      )
    )
      failures.push("stage chip leaves the real card");
    if (bounds.some((box) => Math.abs(box.width - bounds[0].width) > 2))
      failures.push("stage chips do not have equal tracks");
    for (const label of card.querySelectorAll<HTMLElement>(
      ".live-reading-step-label",
    )) {
      const range = document.createRange();
      range.selectNodeContents(label);
      const glyphs = Array.from(range.getClientRects()).filter(
        (box) => box.width > 0.1 && box.height > 0.1,
      );
      const visible = label.getBoundingClientRect();
      let left = visible.left;
      let right = visible.right;
      let top = visible.top;
      let bottom = visible.bottom;
      let ancestor = label.parentElement;
      while (ancestor && card.contains(ancestor)) {
        const style = getComputedStyle(ancestor);
        const box = ancestor.getBoundingClientRect();
        if (/^(hidden|clip|auto|scroll)$/.test(style.overflowX)) {
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
        }
        if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) {
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
        ancestor = ancestor.parentElement;
      }
      if (
        !glyphs.length ||
        glyphs.some(
          (box) =>
            box.left < left - 2 ||
            box.right > right + 2 ||
            box.top < top - 2 ||
            box.bottom > bottom + 2,
        )
      )
        failures.push(`actual stage glyph is clipped: ${label.textContent}`);
    }
    const cancel = card.querySelector<HTMLElement>(
      ".live-reading-cancel button",
    )!;
    const cancelBox = cancel.getBoundingClientRect();
    const steps = card.querySelector<HTMLElement>(".live-reading-steps")!;
    if (
      cancelBox.top < steps.getBoundingClientRect().bottom - 2 ||
      cancelBox.bottom > frame.bottom + 2 ||
      frame.bottom - cancelBox.bottom > 40
    )
      failures.push("Cancel is not at the compact card end");
    const rtl = getComputedStyle(card).direction === "rtl";
    if (
      rtl
        ? cancelBox.left + cancelBox.width / 2 > frame.left + frame.width / 2
        : cancelBox.left + cancelBox.width / 2 < frame.left + frame.width / 2
    )
      failures.push("Cancel is not at the logical end");
    if (cancelBox.height < 42 || cancelBox.width < 42)
      failures.push("Cancel loses its normal touch target");
    if (!(source.bottom <= frame.top + 2 || frame.bottom <= source.top + 2))
      failures.push("phone original and card overlap");
    if (
      frame.left < -2 ||
      frame.right > innerWidth + 2 ||
      source.left < -2 ||
      source.right > innerWidth + 2 ||
      document.documentElement.scrollWidth > innerWidth + 2
    )
      failures.push("phone reading composition overflows the viewport");
    const rect = (box: DOMRect) => ({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    return {
      failures,
      card: rect(frame),
      original: rect(source),
      originalInvoiceId: original.dataset.originalInvoiceId,
      chips: chips.map((chip, index) => ({
        stage: chip.dataset.stage,
        state: chip.dataset.state,
        text: chip.querySelector(".live-reading-step-label")?.textContent,
        ...rect(bounds[index]),
      })),
      cancel: rect(cancelBox),
    };
  });
}

async function stableCancel(button: Locator, action: () => Promise<void>) {
  await button.scrollIntoViewIfNeeded();
  const before = await button.boundingBox();
  expect(before).not.toBeNull();
  await action();
  const movement = await button.evaluate(async (element, previous) => {
    let maximum = 0;
    for (let frame = 0; frame < 6; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const current = element.getBoundingClientRect();
      maximum = Math.max(
        maximum,
        Math.abs(current.x - previous!.x),
        Math.abs(current.y - previous!.y),
        Math.abs(current.width - previous!.width),
        Math.abs(current.height - previous!.height),
      );
    }
    return maximum;
  }, before);
  expect(movement).toBeLessThanOrEqual(2);
}

for (const language of ["en", "fa"] as const) {
  test(`K7 independent 509px compact steps, moving bar and actual Cancel retain the exact original ${language}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 509, height: 932 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const gate = deferred();
    const transportFailures: string[] = [];
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/invoice-readings")
        transportFailures.push(request.failure()?.errorText ?? "");
    });
    const reader = await mockReader(page, [
      { kind: "held", wait: gate.promise },
    ]);
    try {
      await configureLive(page);
      await setLanguage(page, language);
      if (language === "fa")
        await (await openShellAction(page, "تغییر به تم تیره")).click();
      const photo = await fictionalPhoto(
        page,
        `fictional-k7-509-${language}.png`,
      );
      const original = await newLiveOriginal(page, photo, "photo", language);
      const before = await readCanonicalBusinessEvidence(page);
      await pressRead(page, language);
      await expect.poll(() => reader.requests.length).toBe(1);
      await page.evaluate(() => document.fonts.ready);
      const card = page.getByTestId("live-reading-progress");
      await expect(
        card.locator('.live-reading-step[data-stage="reading"]'),
      ).toHaveAttribute("data-state", "active");
      await expect(
        card.locator('.live-reading-step[data-stage="finding"]'),
      ).toHaveAttribute("data-state", "waiting");
      await expect(
        card.locator('.live-reading-step[data-stage="calculating"]'),
      ).toHaveAttribute("data-state", "waiting");
      await expect
        .poll(async () => (await phoneProgressGeometry(page)).failures)
        .toEqual([]);
      const clean = await phoneProgressGeometry(page);
      expect(clean.originalInvoiceId).toBe(original.id);
      expect(clean.chips.map((chip) => chip.text)).toEqual(
        language === "en"
          ? ["Reading the invoice", "Finding products", "Calculating prices"]
          : ["خواندن فاکتور", "یافتن کالاها", "محاسبهٔ قیمت‌ها"],
      );
      const pending = (await readCanonicalBusinessEvidence(page)).invoice;
      expect(pending.id).toBe(original.id);
      expect(pending.company_id).toBe(original.company_id);
      expect(pending.created_by_user_id).toBe(original.created_by_user_id);
      expect(await retainedSourceHashes(page, pending)).toEqual([
        sourceHash(photo),
      ]);
      await page.screenshot({
        path: info.outputPath(`independent-reading-509-${language}.png`),
        fullPage: true,
      });

      const steps = card.locator(".live-reading-steps");
      const savedSteps = await steps.evaluate((element) => {
        const previous = element.getAttribute("style");
        (element as HTMLElement).style.gridTemplateColumns = "1fr";
        return previous;
      });
      let stacked;
      try {
        stacked = await phoneProgressGeometry(page);
        expect(stacked.failures).toContain(
          "stage chips stack instead of sharing one row",
        );
      } finally {
        await steps.evaluate((element, previous) => {
          if (previous === null) element.removeAttribute("style");
          else element.setAttribute("style", previous);
        }, savedSteps);
      }
      const label = card.locator(".live-reading-step-label").first();
      const savedLabel = await label.evaluate((element) => {
        const previous = element.getAttribute("style");
        Object.assign((element as HTMLElement).style, {
          inlineSize: "8px",
          maxInlineSize: "8px",
          overflow: "hidden",
          whiteSpace: "nowrap",
        });
        return previous;
      });
      let clipped;
      try {
        clipped = await phoneProgressGeometry(page);
        expect(
          clipped.failures.some((failure) =>
            failure.startsWith("actual stage glyph is clipped:"),
          ),
        ).toBe(true);
      } finally {
        await label.evaluate((element, previous) => {
          if (previous === null) element.removeAttribute("style");
          else element.setAttribute("style", previous);
        }, savedLabel);
      }
      await expect
        .poll(async () => (await phoneProgressGeometry(page)).failures)
        .toEqual([]);
      const restored = await phoneProgressGeometry(page);
      const bar = card.getByRole("progressbar");
      await expect(bar).not.toHaveAttribute("aria-valuenow");
      const transform = () =>
        bar.evaluate(
          (element) => getComputedStyle(element, "::before").transform,
        );
      const firstTransform = await transform();
      await expect
        .poll(transform, { intervals: [50, 100, 200] })
        .not.toBe(firstTransform);
      const clock = card.locator(".live-reading-time bdi");
      const firstTime = await clock.innerText();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect
        .poll(() =>
          bar.evaluate(
            (element) => getComputedStyle(element, "::before").animationName,
          ),
        )
        .toBe("none");
      await expect.poll(async () => clock.innerText()).not.toBe(firstTime);
      expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
        pending,
      );
      const cancel = card.locator(".live-reading-cancel").getByRole("button", {
        name: t(language, "Cancel", "انصراف"),
        exact: true,
      });
      await stableCancel(cancel, () => cancel.hover());
      await stableCancel(cancel, () => cancel.focus());
      await cancel.click();
      await expect
        .poll(
          async () =>
            (await readCanonicalBusinessEvidence(page)).invoice.live_reading
              ?.phase,
        )
        .toBe("cancelled");
      gate.resolve();
      await expect.poll(() => reader.finished).toBe(1);
      await expect.poll(() => transportFailures.length).toBe(1);
      expect(transportFailures[0]).not.toBe("");
      const cancelled = (await readCanonicalBusinessEvidence(page)).invoice;
      expect(cancelled.id).toBe(original.id);
      expect(cancelled.company_id).toBe(original.company_id);
      expect(cancelled.created_by_user_id).toBe(original.created_by_user_id);
      expect(cancelled.status).toBe("reading");
      expect(cancelled.live_reading?.phase).toBe("cancelled");
      expect(cancelled.lines).toEqual(before.invoice.lines);
      expect(cancelled.reading_record).toBeUndefined();
      expect(cancelled.file_data).toBe(original.file_data);
      expect(await retainedSourceHashes(page, cancelled)).toEqual([
        sourceHash(photo),
      ]);
      await expect(page.getByTestId("live-reading-ready")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: t(language, "Read again", "خواندن دوباره"),
          exact: true,
        }),
      ).toBeVisible();
      expectNoPosting(before, await readCanonicalBusinessEvidence(page));
      expect(reader.requests).toHaveLength(1);
      await info.attach("independent-509-card-and-real-negatives", {
        body: JSON.stringify(
          {
            clean,
            stacked,
            clipped,
            restored,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } finally {
      gate.resolve();
    }
  });
}
