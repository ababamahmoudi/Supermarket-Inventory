import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { openShellAction, setLanguage, signIn, uploadInvoice } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function nameGeometry(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  return page.locator(".receiving-product-name").evaluateAll((elements) => {
    const failures: string[] = [];
    let fragments = 0;
    for (const element of elements) {
      const bounds = element.getBoundingClientRect();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          fragments++;
          if (rect.left < bounds.left - 1.5 || rect.right > bounds.right + 1.5)
            failures.push(
              `Visible name leaves its box: ${element.textContent}`,
            );
          if (rect.top < bounds.top - 1.5 || rect.bottom > bounds.bottom + 1.5)
            failures.push(
              `Visible name leaves its vertical box: ${element.textContent}`,
            );
        }
      }
    }
    return { names: elements.length, fragments, failures };
  });
}

for (const language of ["en", "fa"] as const) {
  test(`retained invoice names fit their actual boxes after resize (${language})`, async ({
    page,
    browserName,
  }, info) => {
    await signIn(page, "Supervisor");
    await page.goto("/#invoices");
    await uploadInvoice(page);
    if (language === "fa") {
      await (await openShellAction(page, "Switch to dark theme")).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    await setLanguage(page, language);
    const names = page.locator(".receiving-product-name");
    await expect(names).toHaveCount(6);
    const titles = await names.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("title")),
    );
    expect(titles[0]).toBe("Canned Fava Beans 400 g");
    const before = await readCanonicalBusinessEvidence(page);
    for (const width of [360, 390, 509, 760, 1000, 1279, 1280, 1281, 1440]) {
      await page.setViewportSize({ width, height: 1080 });
      await expect
        .poll(async () => (await nameGeometry(page)).failures)
        .toEqual([]);
      const proof = await nameGeometry(page);
      expect(proof.names).toBe(6);
      expect(proof.fragments).toBeGreaterThanOrEqual(6);
      for (let index = 0; index < titles.length; index++) {
        const name = names.nth(index);
        const title = titles[index]!;
        await expect(name).toHaveAttribute("title", title);
        await expect(name.locator("..")).toHaveAccessibleName(
          new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
        const visible = (await name.innerText()).trim();
        expect(
          visible === title,
          `${width}px shows the complete retained name ${title}`,
        ).toBe(true);
      }
      if (width === 1280) {
        await page.screenshot({
          path: info.outputPath(`invoice-full-1280-${language}.png`),
          fullPage: true,
        });
        await page.locator(".receiving-lines").screenshot({
          path: info.outputPath(`invoice-names-1280-${language}.png`),
        });
        const metrics = await names.evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            const range = document.createRange();
            range.selectNodeContents(element);
            return {
              title: element.getAttribute("title"),
              visible: element.textContent,
              font: style.font,
              name: element.getBoundingClientRect().toJSON(),
              cell: element.closest("td")!.getBoundingClientRect().toJSON(),
              glyphs: Array.from(range.getClientRects(), (rect) =>
                rect.toJSON(),
              ),
            };
          }),
        );
        const platformFonts: unknown[] = [];
        if (browserName === "chromium") {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("DOM.enable");
          await cdp.send("CSS.enable");
          const document = await cdp.send("DOM.getDocument");
          const nodes = await cdp.send("DOM.querySelectorAll", {
            nodeId: document.root.nodeId,
            selector: ".receiving-product-name > .ltr-fragment",
          });
          for (const nodeId of nodes.nodeIds)
            platformFonts.push(
              await cdp.send("CSS.getPlatformFontsForNode", { nodeId }),
            );
          await cdp.detach();
        }
        const metricsPath = info.outputPath(
          `invoice-name-metrics-${language}.json`,
        );
        await writeFile(
          metricsPath,
          JSON.stringify({ metrics, platformFonts }, null, 2) + "\n",
        );
        await info.attach(`invoice-name-metrics-${language}`, {
          path: metricsPath,
          contentType: "application/json",
        });
      }
    }
    await page.setViewportSize({ width: 1280, height: 1080 });
    await expect
      .poll(async () => (await nameGeometry(page)).failures)
      .toEqual([]);
    const first = names.first();
    // Keep all text/title intact, then deliberately move a painted glyph 4px
    // beyond the exact name edge. The geometry oracle must reject it.
    const original = await first.locator("bdi").evaluate((element) => {
      const style = element.getAttribute("style");
      const name = element.parentElement!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const right = Math.max(
        ...Array.from(range.getClientRects(), (rect) => rect.right),
      );
      (element as HTMLElement).style.position = "relative";
      (element as HTMLElement).style.left = `${name.right - right + 4}px`;
      return style;
    });
    expect((await nameGeometry(page)).failures.length).toBeGreaterThan(0);
    await first.locator("bdi").evaluate((element, style) => {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    }, original);
    expect((await nameGeometry(page)).failures).toEqual([]);
    await first.locator("..").click();
    await expect(page.locator("#invoice-line-0-detail")).toBeVisible();
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
  });
}
