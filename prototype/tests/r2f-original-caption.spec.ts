import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { preparePostedTwoPageOriginal } from "./posted-two-page-original-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction, setLanguage } from "./helpers";

async function captionGeometry(caption: Locator) {
  return caption.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const failures: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only"))
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const field = node.parentElement?.closest(
        ".original-viewer-file-name, .original-viewer-page-count",
      );
      const fieldBounds = field?.getBoundingClientRect() ?? bounds;
      for (const rect of range.getClientRects()) {
        if (rect.left < bounds.left - 1.5 || rect.right > bounds.right + 1.5)
          failures.push(
            `Original subtitle leaves its box: ${node.textContent}`,
          );
        if (
          rect.left < fieldBounds.left - 1.5 ||
          rect.right > fieldBounds.right + 1.5
        )
          failures.push(
            `Original subtitle leaves its own group: ${node.textContent}`,
          );
      }
    }
    const actions = element
      .closest(".original-viewer-header")
      ?.querySelector(".original-viewer-header-actions")
      ?.getBoundingClientRect();
    if (
      actions &&
      bounds.left < actions.right - 1.5 &&
      bounds.right > actions.left + 1.5
    )
      failures.push("Original subtitle overlaps header actions");
    return failures;
  });
}

for (const language of ["en", "fa"] as const)
  test(`two-page original filename and page count remain visible in ${language}`, async ({
    page,
  }, info) => {
    const { entry, invoice, before } = await preparePostedTwoPageOriginal(page);
    const expected = entry.pages.map((page) =>
      createHash("sha256")
        .update(Buffer.from(page.data, "base64"))
        .digest("hex"),
    );
    if (language === "fa") {
      await (await openShellAction(page, "Switch to dark theme")).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    await setLanguage(page, language);
    const word = (en: string, fa: string) => (language === "en" ? en : fa);
    for (const width of [1440, 1280, 1000, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      let scope = page.locator(".original-viewer");
      if (width === 390) {
        await scope.locator(".original-viewer-phone-trigger").click();
        scope = page.getByRole("dialog", {
          name: word("Original invoice", "فاکتور اصلی"),
          exact: true,
        });
      }
      const caption = scope.locator(
        width === 390
          ? ":scope > .dialog-description"
          : ".original-viewer-file",
      );
      await expect(caption).toBeVisible();
      await expect.poll(() => captionGeometry(caption)).toEqual([]);
      await expect(
        caption.locator(".original-viewer-file-name"),
      ).toHaveAttribute("title", invoice.original_pages![0].file_name);
      await expect(
        caption.locator(".original-viewer-file-name > .sr-only"),
      ).toHaveText(invoice.original_pages![0].file_name);
      const count = caption.locator(".original-viewer-page-count");
      await expect(count).toHaveText(word("2 pages", "۲ صفحه"));
      await expect(count).toBeVisible();
      if (width === 390)
        await expect(scope).toHaveAccessibleDescription(
          `${invoice.original_pages![0].file_name} ${word("2 pages", "۲ صفحه")}`,
        );
      expect(
        await count.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set(
            Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
          ).size;
        }),
      ).toBe(1);
      if (width !== 390)
        for (const action of await scope
          .locator(".original-viewer-header-actions > button")
          .all())
          await expect(action).toHaveCSS("height", "32px");
      const toolbar = scope.getByRole("toolbar", {
        name: word("Original invoice", "فاکتور اصلی"),
        exact: true,
      });
      await expect(toolbar).toHaveCSS("height", "44px");
      while (
        (await scope
          .locator(".invoice-original-media")
          .getAttribute("data-rotation")) !== "0"
      )
        await toolbar
          .getByRole("button", { name: word("Rotate", "چرخش"), exact: true })
          .click();
      await toolbar
        .getByRole("button", {
          name: word("Fit width", "اندازه عرض"),
          exact: true,
        })
        .click();
      const image = scope.locator(".invoice-original-media img");
      const digest = async () =>
        image.evaluate(async (image) => {
          const bytes = await (
            await fetch(image.getAttribute("src")!)
          ).arrayBuffer();
          return Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (value) => value.toString(16).padStart(2, "0"),
          ).join("");
        });
      await expect.poll(digest).toBe(expected[0]);
      await image.evaluate(async (image: HTMLImageElement) => {
        await image.decode();
        image.getBoundingClientRect();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      await expect(scope.locator(".invoice-original-skeleton")).toHaveCount(0);
      await scope.screenshot({
        path: info.outputPath(`original-caption-${width}-${language}.png`),
      });
      await toolbar
        .getByRole("button", {
          name: word("Next page", "صفحه بعد"),
          exact: true,
        })
        .click();
      await expect(scope.locator(".invoice-original-page")).toHaveText("2 / 2");
      await expect.poll(digest).toBe(expected[1]);
      await toolbar
        .getByRole("button", {
          name: word("Zoom in", "بزرگ‌نمایی"),
          exact: true,
        })
        .click();
      await expect(scope.locator(".invoice-original-media")).toHaveAttribute(
        "data-zoom",
        "1.25",
      );
      await toolbar
        .getByRole("button", { name: word("Rotate", "چرخش"), exact: true })
        .click();
      await expect(scope.locator(".invoice-original-media")).toHaveAttribute(
        "data-rotation",
        "90",
      );
      await toolbar
        .getByRole("button", { name: word("More", "بیشتر"), exact: true })
        .click();
      const download = page.waitForEvent("download");
      await page
        .getByRole("menuitem", {
          name: word("Download", "دانلود"),
          exact: true,
        })
        .click();
      expect(
        createHash("sha256")
          .update(await readFile((await (await download).path())!))
          .digest("hex"),
      ).toBe(expected[1]);
      await toolbar
        .getByRole("button", {
          name: word("Previous page", "صفحه قبل"),
          exact: true,
        })
        .click();
      await expect.poll(digest).toBe(expected[0]);
      while (
        (await scope
          .locator(".invoice-original-media")
          .getAttribute("data-rotation")) !== "0"
      )
        await toolbar
          .getByRole("button", { name: word("Rotate", "چرخش"), exact: true })
          .click();
      await toolbar
        .getByRole("button", {
          name: word("Fit width", "اندازه عرض"),
          exact: true,
        })
        .click();
      if (width === 390)
        await scope
          .getByRole("button", {
            name: word("Close dialog", "بستن پنجره"),
            exact: true,
          })
          .click();
      else {
        await scope
          .getByRole("button", {
            name: word("Expand", "بزرگ کردن"),
            exact: true,
          })
          .click();
        const expanded = page.getByRole("dialog", {
          name: word("Original invoice", "فاکتور اصلی"),
          exact: true,
        });
        await expect(expanded).toHaveAccessibleDescription(
          `${invoice.original_pages![0].file_name} ${word("2 pages", "۲ صفحه")}`,
        );
        await expect
          .poll(() =>
            captionGeometry(expanded.locator(":scope > .dialog-description")),
          )
          .toEqual([]);
        await expanded
          .getByRole("button", {
            name: word("Close dialog", "بستن پنجره"),
            exact: true,
          })
          .click();
        await scope
          .getByRole("button", {
            name: word("Hide original", "پنهان کردن اصل"),
            exact: true,
          })
          .click();
        await expect(scope.locator(".original-viewer-panel")).toBeHidden();
        await scope
          .getByRole("button", {
            name: word("Show original", "نمایش اصل"),
            exact: true,
          })
          .click();
        await expect(scope.locator(".original-viewer-panel")).toBeVisible();
      }
      await expect(page).toHaveURL((url) =>
        url.hash.includes(encodeURIComponent(invoice.id)),
      );
    }
    const after = await readCanonicalBusinessEvidence(page);
    for (const key of [
      "invoices",
      "products",
      "stock_movements",
      "ledger",
      "approvals",
    ] as const)
      expect(after[key]).toEqual(before[key]);
  });
