import { expect, test, type Page } from "@playwright/test";
import { openShellAction, setLanguage } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  configureLive,
  deferred,
  expectNoPosting,
  expectReview,
  fictionalPhoto,
  fictionalResponse,
  mockReader,
  newLiveOriginal,
  pressRead,
  retainedSourceHashes,
  sourceHash,
} from "./r3-live-reading-helpers";

async function geometry(page: Page, width: number) {
  return page.evaluate((width) => {
    const card = document.querySelector<HTMLElement>(
      '[data-testid="live-reading-progress"]',
    )!;
    const source = document.querySelector<HTMLElement>(
      ".receiving-layout > .original-viewer",
    )!;
    const box = card.getBoundingClientRect();
    const original = source.getBoundingClientRect();
    const failures: string[] = [];
    const chips = Array.from(
      card.querySelectorAll<HTMLElement>(".live-reading-step"),
    );
    if (chips.length !== 3) failures.push("three real step chips required");
    if (
      chips.length &&
      chips.some(
        (chip) =>
          Math.abs(
            chip.getBoundingClientRect().top -
              chips[0].getBoundingClientRect().top,
          ) > 2,
      )
    )
      failures.push("step chips leave their compact row");
    if (width > 760) {
      if (Math.abs(box.top - original.top) > 2)
        failures.push("cards do not share their top edge");
      if (!(box.right <= original.left + 2 || original.right <= box.left + 2))
        failures.push("cards are not side by side");
    }
    for (const label of card.querySelectorAll<HTMLElement>(
      ".live-reading-step-label",
    )) {
      const bounds = label.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(label);
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0.1 && rect.height > 0.1,
      );
      if (
        !rects.length ||
        rects.some(
          (rect) =>
            rect.left < bounds.left - 2 ||
            rect.right > bounds.right + 2 ||
            rect.top < bounds.top - 2 ||
            rect.bottom > bounds.bottom + 2,
        )
      )
        failures.push(`step text leaves its box: ${label.textContent}`);
      const text = label.firstChild;
      if (text instanceof Text) {
        for (const word of label.textContent!.matchAll(/[A-Za-z]+/g)) {
          const wordRange = document.createRange();
          wordRange.setStart(text, word.index!);
          wordRange.setEnd(text, word.index! + word[0].length);
          const glyphs = Array.from(wordRange.getClientRects());
          if (glyphs.some((rect) => Math.abs(rect.top - glyphs[0].top) > 2))
            failures.push(`step word breaks across lines: ${word[0]}`);
        }
      }
    }
    const cancel = card.querySelector<HTMLElement>(
      ".live-reading-cancel button",
    );
    const steps = card.querySelector<HTMLElement>(".live-reading-steps");
    if (
      !cancel ||
      !steps ||
      cancel.getBoundingClientRect().top <
        steps.getBoundingClientRect().bottom - 2 ||
      cancel.getBoundingClientRect().bottom > box.bottom + 2
    )
      failures.push("Cancel is not at the card end");
    if (document.documentElement.scrollWidth > window.innerWidth + 2)
      failures.push("page overflows horizontally");
    return {
      failures,
      card: { width: box.width, height: box.height },
      original: { width: original.width, height: original.height },
    };
  }, width);
}

for (const language of ["en", "fa"] as const) {
  test(`K7 truthful painted steps, compact source columns, timer and reduced motion ${language}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const gate = deferred();
    const reader = await mockReader(page, [
      {
        kind: "held",
        wait: gate.promise,
        response: fictionalResponse("FICTIONAL-PAINTED-PROGRESS"),
      },
    ]);
    await configureLive(page);
    await setLanguage(page, language);
    if (language === "fa")
      await (await openShellAction(page, "تغییر به تم تیره")).click();
    const before = await readCanonicalBusinessEvidence(page);
    const photo = await fictionalPhoto(page, "fictional-progress-original.png");
    const original = await newLiveOriginal(page, photo, "photo", language);
    await pressRead(page, language);
    await expect.poll(() => reader.requests.length).toBe(1);
    const progress = page.getByTestId("live-reading-progress");
    await expect(progress.getByRole("progressbar")).toHaveAttribute(
      "aria-label",
      language === "en" ? "Reading the invoice" : "خواندن فاکتور",
    );
    await expect(progress.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
    const clock = progress.locator(".live-reading-time bdi");
    const initialClock = await clock.innerText();
    await expect.poll(async () => clock.innerText()).not.toBe(initialClock);
    const pendingInvoice = (await readCanonicalBusinessEvidence(page)).invoice;
    await page.evaluate(() => {
      const frames: { stage: string; complete: number }[] = [];
      let scheduled = "";
      const observer = new MutationObserver(() => record());
      const record = () => {
        const current = document.querySelector<HTMLElement>(
          '.live-reading-step[aria-current="step"]',
        );
        const stage = current?.dataset.stage;
        if (!stage || stage === scheduled) return;
        scheduled = stage;
        requestAnimationFrame(() => {
          const painted = document.querySelector<HTMLElement>(
            '.live-reading-step[aria-current="step"]',
          );
          if (
            painted?.dataset.stage !== stage ||
            !painted.getBoundingClientRect().width ||
            getComputedStyle(painted).visibility === "hidden"
          )
            return;
          frames.push({
            stage,
            complete: document.querySelectorAll(
              '.live-reading-step[data-state="complete"]',
            ).length,
          });
        });
      };
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      record();
      (
        window as unknown as {
          progressProof: { frames: typeof frames; stop(): void };
        }
      ).progressProof = { frames, stop: () => observer.disconnect() };
    });
    for (const width of [1440, 1000, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(async () => (await geometry(page, width)).failures)
        .toEqual([]);
      await page.screenshot({
        path: info.outputPath(`reading-${width}-${language}.png`),
      });
      if (width === 1000) {
        const saved = await page
          .locator(".receiving-layout > .original-viewer")
          .evaluate((element) => {
            const value = element.getAttribute("style");
            (element as HTMLElement).style.marginBlockStart = "24px";
            return value;
          });
        expect((await geometry(page, width)).failures).toContain(
          "cards do not share their top edge",
        );
        await page
          .locator(".receiving-layout > .original-viewer")
          .evaluate((element, style) => {
            if (style === null) element.removeAttribute("style");
            else element.setAttribute("style", style);
          }, saved);
        await expect
          .poll(async () => (await geometry(page, width)).failures)
          .toEqual([]);
      }
    }
    if (language === "en") {
      const calculation = progress.locator(
        '.live-reading-step[data-stage="calculating"]',
      );
      const originalStyle = await calculation.evaluate((element) => {
        const previous = element.getAttribute("style");
        (element as HTMLElement).style.gridTemplateColumns =
          "16px minmax(0, 1fr)";
        return previous;
      });
      expect((await geometry(page, 390)).failures).toContain(
        "step word breaks across lines: Calculating",
      );
      await calculation.evaluate((element, previous) => {
        if (previous === null) element.removeAttribute("style");
        else element.setAttribute("style", previous);
      }, originalStyle);
      await expect
        .poll(async () => (await geometry(page, 390)).failures)
        .toEqual([]);
    }
    const label = progress.locator(".live-reading-step-label").first();
    const style = await label.evaluate((element) => {
      const previous = element.getAttribute("style");
      Object.assign((element as HTMLElement).style, {
        inlineSize: "1px",
        maxInlineSize: "1px",
        overflow: "hidden",
      });
      return previous;
    });
    expect(
      (await geometry(page, 390)).failures.some((failure) =>
        failure.startsWith("step text leaves its box"),
      ),
    ).toBe(true);
    await label.evaluate((element, previous) => {
      if (previous === null) element.removeAttribute("style");
      else element.setAttribute("style", previous);
    }, style);
    await expect
      .poll(async () => (await geometry(page, 390)).failures)
      .toEqual([]);
    const animation = () =>
      progress
        .locator(".live-reading-indeterminate")
        .evaluate(
          (element) => getComputedStyle(element, "::before").animationName,
        );
    expect(await animation()).not.toBe("none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(animation).toBe("none");
    expect((await readCanonicalBusinessEvidence(page)).invoice).toEqual(
      pendingInvoice,
    );
    expect(reader.requests).toHaveLength(1);
    gate.resolve();
    const reviewed = await expectReview(page, original.id, language);
    const phases = await page.evaluate(() => {
      const proof = (
        window as unknown as {
          progressProof: {
            frames: { stage: string; complete: number }[];
            stop(): void;
          };
        }
      ).progressProof;
      proof.stop();
      return proof.frames;
    });
    expect(phases.map((phase) => phase.stage)).toEqual([
      "reading",
      "finding",
      "calculating",
    ]);
    expect(phases.find((phase) => phase.stage === "finding")?.complete).toBe(1);
    expect(
      phases.find((phase) => phase.stage === "calculating")?.complete,
    ).toBe(2);
    expect(await retainedSourceHashes(page, reviewed)).toEqual([
      sourceHash(photo),
    ]);
    expectNoPosting(before, await readCanonicalBusinessEvidence(page));
    expect(reader.requests).toHaveLength(1);
  });
}
