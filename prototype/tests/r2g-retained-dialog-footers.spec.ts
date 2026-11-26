import { expect, test, type Locator, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { guardR2gBrowserErrors } from "./r2g-browser-errors";

guardR2gBrowserErrors();

async function footerGeometry(dialog: Locator) {
  return dialog.locator(".ui-dialog-actions").evaluate((footer) => {
    const css = getComputedStyle(footer);
    const rect = footer.getBoundingClientRect();
    const actions = [...footer.querySelectorAll(":scope > button")].map(
      (action) => {
        const box = action.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      },
    );
    return {
      width:
        rect.width -
        parseFloat(css.paddingLeft) -
        parseFloat(css.paddingRight) -
        parseFloat(css.borderLeftWidth) -
        parseFloat(css.borderRightWidth),
      gap: parseFloat(css.columnGap) || 0,
      actions,
    };
  });
}

async function checkFooter(
  page: Page,
  dialog: Locator,
  scene: string,
  width: number,
  language: string,
  nested: boolean,
) {
  const report = () => inspect(page, scene, `${width}-${language}`, "manager");
  expect((await report()).failures).toEqual([]);
  const geometry = await footerGeometry(dialog);
  if (width <= 760) {
    const expected =
      (geometry.width - geometry.gap * (geometry.actions.length - 1)) /
      geometry.actions.length;
    for (const action of geometry.actions) {
      expect(Math.abs(action.width - expected)).toBeLessThanOrEqual(1.5);
      expect(action.height).toBe(44);
      expect(Math.abs(action.y - geometry.actions[0].y)).toBeLessThanOrEqual(
        1.5,
      );
    }
    const action = dialog.locator(".ui-dialog-actions > button").last();
    const style = await action.getAttribute("style");
    const restore = async () => {
      if (style === null)
        await action.evaluate((node) => node.removeAttribute("style"));
      else
        await action.evaluate(
          (node, value) => node.setAttribute("style", value),
          style,
        );
    };
    await action.evaluate((node) => {
      node.style.setProperty(
        "inline-size",
        `${node.getBoundingClientRect().width + 4}px`,
        "important",
      );
    });
    expect(
      (await report()).failures.some((failure: string) =>
        failure.includes("Phone dialog footer"),
      ),
      "a real footer stretched by 4px must fail",
    ).toBe(true);
    await restore();
    await action.evaluate((node) => {
      for (const property of ["block-size", "min-block-size", "max-block-size"])
        node.style.setProperty(property, "48px", "important");
    });
    expect(
      (await report()).failures.some((failure: string) =>
        failure.includes("height"),
      ),
      "a real footer control with the wrong height must fail",
    ).toBe(true);
    await restore();
    if (nested) {
      await dialog.evaluate((node) => {
        const footer = node.querySelector(".ui-dialog-actions")!;
        const field = document.createElement("input");
        field.dataset.retainedFooterNegative = "";
        field.setAttribute("aria-label", "Counterfeit editable body");
        footer.parentElement!.insertBefore(field, footer);
      });
      expect(
        (await report()).failures.some((failure: string) =>
          failure.includes(
            "Invalid retained read-only dialog footer composition",
          ),
        ),
        "an editable body cannot inherit the retained read-only composition",
      ).toBe(true);
      await dialog
        .locator("[data-retained-footer-negative]")
        .evaluate((node) => node.remove());
    }
    expect((await report()).failures).toEqual([]);
  } else {
    // Supplier history retains its existing R2c 44px control contract even on
    // desktop. The other retained dialogs use the ordinary 40px action.
    const historyInReceivingScreen = await dialog.evaluate(
      (node) =>
        node.matches(".supplier-item-history-dialog") &&
        Boolean(node.closest(".r2c-screen")),
    );
    for (const action of geometry.actions) {
      expect(action.height).toBe(historyInReceivingScreen ? 44 : 40);
      expect(action.width).toBeLessThan(geometry.width / 2);
    }
    const action = dialog.locator(".ui-dialog-actions > button").last();
    const style = await action.getAttribute("style");
    await action.evaluate((node) => {
      node.style.setProperty("inline-size", "100%", "important");
    });
    expect(
      (await report()).failures.some((failure: string) =>
        failure.includes("Text action stretched"),
      ),
      "desktop footer controls keep their intrinsic-width contract",
    ).toBe(true);
    if (style === null)
      await action.evaluate((node) => node.removeAttribute("style"));
    else
      await action.evaluate(
        (node, value) => node.setAttribute("style", value),
        style,
      );
    expect((await report()).failures).toEqual([]);
  }
}

for (const width of [390, 509, 1440]) {
  for (const [language, theme] of [
    ["en", "light"],
    ["fa", "dark"],
  ] as const) {
    test(`R2g A5 retained Settings, history and policy footers ${width} ${language} ${theme}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Supervisor");
      await setBranch(page, "Branch 1");
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            language === "en" ? "Switch to dark theme" : "تغییر به تم تیره",
          )
        ).click();
      const before = await readCanonicalBusinessEvidence(page);
      await page.goto("/#settings?group=branches");
      await page
        .getByRole("button", {
          name: language === "en" ? "Add location" : "افزودن مکان",
          exact: true,
        })
        .click();
      for (const mode of ["add", "edit"]) {
        const dialog = page.locator("dialog.settings-dialog[open]");
        await expect(dialog).toBeVisible();
        await expect(dialog.locator(".ui-dialog-actions > span")).toHaveCount(
          0,
        );
        await expect(dialog.locator(".settings-dialog-state")).toHaveText(
          language === "en" ? "Unsaved changes" : "تغییرات ذخیره‌نشده",
        );
        await checkFooter(
          page,
          dialog,
          `R2g A5 ${mode} location`,
          width,
          language,
          false,
        );
        const input = dialog.locator("#branch-name-en");
        await input.scrollIntoViewIfNeeded();
        const previous = await footerGeometry(dialog);
        const previousInput = await input.boundingBox();
        await input.fill("Fictional retained-dialog location");
        const current = await footerGeometry(dialog);
        for (let index = 0; index < current.actions.length; index++)
          for (const key of ["x", "y", "width", "height"] as const)
            expect(
              Math.abs(
                current.actions[index][key] - previous.actions[index][key],
              ),
            ).toBeLessThanOrEqual(2);
        const currentInput = await input.boundingBox();
        expect(
          Math.abs(currentInput!.y - previousInput!.y),
        ).toBeLessThanOrEqual(2);
        expect(
          (
            await inspect(
              page,
              "R2g A5 typed location",
              `${width}-${language}`,
              "manager",
            )
          ).failures,
        ).toEqual([]);
        await dialog
          .getByRole("button", {
            name: language === "en" ? "Cancel" : "لغو",
            exact: true,
          })
          .click();
        if (mode === "add")
          await page
            .getByRole("button", {
              name: language === "en" ? "Edit" : "ویرایش",
              exact: true,
            })
            .first()
            .click();
      }
      await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
      await page
        .getByRole("tab", {
          name: language === "en" ? "Supplier items" : "کالاهای تأمین‌کننده",
          exact: true,
        })
        .click();
      const item = page
        .locator(".supplier-items-table tbody tr.supplier-item-history-row")
        .first();
      await item.focus();
      await page.keyboard.press("Enter");
      const history = page.locator("dialog.supplier-item-history-dialog[open]");
      await expect(history).toBeVisible();
      await checkFooter(
        page,
        history,
        "R2g A5 supplier price history",
        width,
        language,
        true,
      );
      await history
        .getByRole("button", {
          name: language === "en" ? "Close" : "بستن",
          exact: true,
        })
        .click();
      await page.goto("/#return?id=demo-return-1");
      await page
        .getByRole("button", {
          name: language === "en" ? "Return policy" : "سیاست مرجوعی",
          exact: true,
        })
        .click();
      const policy = page.locator("dialog.return-policy-dialog[open]");
      await expect(policy).toBeVisible();
      await checkFooter(
        page,
        policy,
        "R2g A5 return policy",
        width,
        language,
        true,
      );
      await page.screenshot({
        path: info.outputPath(`retained-footer-${width}-${language}.png`),
      });
      await policy
        .getByRole("button", {
          name: language === "en" ? "Close" : "بستن",
          exact: true,
        })
        .click();
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.config).toEqual(before.config);
      expect(after.products).toEqual(before.products);
      expect(after.invoices).toEqual(before.invoices);
      expect(after.ledger).toEqual(before.ledger);
    });
  }
}
