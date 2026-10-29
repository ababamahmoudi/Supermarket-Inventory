import { expect, test } from "@playwright/test";
import { signIn, setLanguage, openShellAction } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { inspect } from "../scripts/c5-browser-proof.mjs";

for (const [language, theme] of [
  ["en", "light"],
  ["fa", "dark"],
] as const) {
  for (const width of [360, 390, 509, 760]) {
    test(`R2g A5 unrelated page Undo stays out of the full-width dialog at ${width}px (${language}/${theme})${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
          )
        ).click();
      await page.goto("/#offers");
      const before = await readCanonicalBusinessEvidence(page);
      const row = page.locator(
        '.current-offers-table tr[data-product-code="0003"]',
      );
      const stopText = language === "en" ? "Stop offer" : "توقف پیشنهاد";
      await row.getByRole("button", { name: stopText, exact: true }).click();
      await page
        .getByRole("dialog", { name: stopText, exact: true })
        .getByRole("button", { name: stopText, exact: true })
        .click();
      const pageUndo = page.getByTestId("undo-toast");
      await expect(pageUndo).toBeVisible();
      const createText = language === "en" ? "Create offer" : "ایجاد پیشنهاد";
      await page.getByRole("button", { name: createText, exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: createText,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId("dialog-action-status")).toHaveCount(0);
      await expect(
        dialog.getByRole("button", {
          name: language === "en" ? "Undo" : "واگرد",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(pageUndo).toHaveCount(0);
      const geometry = await dialog.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const footer = node.querySelector(".ui-dialog-footer")!;
        const feedback = footer.querySelector("[data-dialog-feedback-host]")!;
        const actions = [...footer.querySelectorAll(":scope > button")].map(
          (button) => {
            const box = button.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          },
        );
        return {
          width: bounds.width,
          bottom: bounds.bottom,
          feedback: feedback.getBoundingClientRect().height,
          actions,
          viewport: innerHeight,
        };
      });
      expect(geometry.width).toBe(width);
      expect(Math.abs(geometry.bottom - geometry.viewport)).toBeLessThanOrEqual(
        1.5,
      );
      expect(geometry.feedback).toBe(0);
      expect(
        Math.abs(geometry.actions[0].width - geometry.actions[1].width),
      ).toBeLessThanOrEqual(1.5);
      expect(
        Math.abs(geometry.actions[0].y - geometry.actions[1].y),
      ).toBeLessThanOrEqual(1.5);
      const report = await inspect(
        page,
        "R2g A5 Create offer",
        `${width}-${language}-${theme}`,
        "manager",
      );
      expect(report.failures).toEqual([]);
      const submit = dialog.locator(".ui-dialog-footer > button").last();
      const oldStyle = await submit.getAttribute("style");
      await submit.evaluate((button) => {
        button.style.inlineSize = `${button.getBoundingClientRect().width - 4}px`;
        button.style.flex = "0 0 auto";
      });
      expect(
        (
          await inspect(
            page,
            "R2g A5 shrunken negative",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures.some((failure: string) =>
          failure.includes("Phone dialog footer"),
        ),
      ).toBe(true);
      if (oldStyle === null)
        await submit.evaluate((button) => button.removeAttribute("style"));
      else
        await submit.evaluate(
          (button, style) => button.setAttribute("style", style),
          oldStyle,
        );
      await submit.evaluate((button) => {
        button.style.transform = "translateY(4px)";
      });
      expect(
        (
          await inspect(
            page,
            "R2g A5 shifted negative",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures.some((failure: string) =>
          failure.includes("Phone dialog footer"),
        ),
      ).toBe(true);
      if (oldStyle === null)
        await submit.evaluate((button) => button.removeAttribute("style"));
      else
        await submit.evaluate(
          (button, style) => button.setAttribute("style", style),
          oldStyle,
        );
      await page.evaluate(() => {
        const copied = document.createElement("dialog");
        copied.className = "ui-dialog confirm-dialog";
        copied.setAttribute("open", "");
        copied.dataset.r2gCounterfeit = "";
        copied.innerHTML =
          '<div class="ui-dialog-actions"><button class="ui-button button button-primary" data-control-kind="action" style="width:320px;min-height:44px">Fictional copied action</button></div>';
        document.body.append(copied);
      });
      expect(
        (
          await inspect(
            page,
            "R2g A5 counterfeit negative",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures.some((failure: string) =>
          failure.includes("Text action stretched: Fictional copied action"),
        ),
      ).toBe(true);
      await page
        .locator("dialog[data-r2g-counterfeit]")
        .evaluate((node) => node.remove());
      expect(
        (
          await inspect(
            page,
            "R2g A5 restored",
            `${width}-${language}-${theme}`,
            "manager",
          )
        ).failures,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`A5-${width}-${language}-${theme}.png`),
      });
      await dialog
        .getByRole("button", {
          name: language === "en" ? "Cancel" : "انصراف",
          exact: true,
        })
        .click();
      await expect(pageUndo).toBeVisible();
      await pageUndo
        .getByRole("button", {
          name: language === "en" ? "Undo" : "واگرد",
          exact: true,
        })
        .click();
      await expect(pageUndo).toHaveCount(0);
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.offers).toEqual(before.offers);
    });
  }
}

for (const language of ["en", "fa"] as const) {
  test(`R2g A5 body scroll fades track the real remaining content at 509px ${language} @r2g-509`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 509, height: 520 });
    await signIn(page, "Manager");
    await setLanguage(page, language);
    await page.goto("/#offers");
    const name = language === "en" ? "Create offer" : "ایجاد پیشنهاد";
    await page.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    const body = dialog.locator(":scope > .ui-dialog-body");
    await expect
      .poll(() =>
        body.evaluate((node) => node.scrollHeight > node.clientHeight),
      )
      .toBe(true);
    await expect(body).toHaveCSS("scrollbar-width", "none");
    expect(
      await body.evaluate(
        (node) => getComputedStyle(node, "::-webkit-scrollbar").display,
      ),
    ).toBe("none");
    await body.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(body).toHaveAttribute("data-dialog-scroll-start", "false");
    await expect(body).toHaveAttribute("data-dialog-scroll-end", "true");
    await expect(body).toHaveCSS("mask-image", /linear-gradient/);
    await body.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(body).toHaveAttribute("data-dialog-scroll-end", "false");
    await expect(body).toHaveAttribute("data-dialog-scroll-start", "true");
    await expect(
      dialog.locator(".ui-dialog-footer > button").first(),
    ).toBeInViewport();
    await expect(
      dialog.locator(".ui-dialog-footer > button").last(),
    ).toBeInViewport();
  });
}
