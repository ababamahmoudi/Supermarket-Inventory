import { expect, test, type Locator } from "@playwright/test";
import { openShellAction, setLanguage, signIn } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function appearance(control: Locator) {
  return control.evaluate((element) => {
    const box = element.querySelector(".ui-checkbox-box")!;
    const style = getComputedStyle(box);
    const token = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      element.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const checked = element.getAttribute("aria-checked") === "true";
    return {
      checked,
      background: style.backgroundColor,
      border: style.borderTopColor,
      radius: style.borderRadius,
      width: box.getBoundingClientRect().width,
      height: box.getBoundingClientRect().height,
      tick: box.querySelector("svg")
        ? getComputedStyle(box.querySelector("svg")!).stroke
        : null,
      expectedBackground: token(checked ? "--accent-fill" : "--field-fill"),
      expectedBorder: token(checked ? "--accent-fill" : "--field-border"),
      white: token("--klead-white"),
    };
  });
}
async function assertStyle(control: Locator) {
  const style = await appearance(control);
  expect(style.background).toBe(style.expectedBackground);
  expect(style.border).toBe(style.expectedBorder);
  expect(style.width).toBe(18);
  expect(style.height).toBe(18);
  expect(Number.parseFloat(style.radius)).toBeGreaterThan(0);
  expect(style.tick).toBe(style.checked ? style.white : null);
  return style;
}

for (const language of ["en", "fa"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`K9 real Products Notebook Labels and Returns checkboxes share tokens ${language} ${theme}`, async ({
      page,
    }, info) => {
      await signIn(page, "Manager");
      await setLanguage(page, language);
      if (theme === "dark")
        await (
          await openShellAction(
            page,
            language === "fa" ? "تغییر به تم تیره" : "Switch to dark theme",
          )
        ).click();
      const report = [];
      await page.goto("/#products");
      await page
        .getByRole("button", {
          name: language === "fa" ? "ستون‌ها" : "Columns",
          exact: true,
        })
        .click();
      const columns = page.getByRole("dialog", {
        name: language === "fa" ? "ستون‌ها" : "Columns",
        exact: true,
      });
      const product = columns
        .getByRole("checkbox")
        .filter({ visible: true })
        .first();
      const reference = await assertStyle(product);
      report.push({ screen: "Products Columns", ...reference });
      const optional = columns
        .locator('[role="checkbox"]:not(:disabled)')
        .first();
      const initial = await optional.getAttribute("aria-checked");
      await optional.focus();
      await page.keyboard.press("Space");
      await expect(optional).toHaveAttribute(
        "aria-checked",
        initial === "true" ? "false" : "true",
      );
      report.push({
        screen: "Products Columns toggled",
        ...(await assertStyle(optional)),
      });
      await columns.screenshot({
        path: info.outputPath(`products-checkboxes-${language}-${theme}.png`),
      });
      await page.keyboard.press("Space");
      await page.keyboard.press("Escape");

      await page.goto("/#notes");
      await page
        .getByRole("button", {
          name: language === "fa" ? "دفترچه جدید" : "New notebook",
          exact: true,
        })
        .click();
      const editor = page.getByRole("dialog", {
        name: language === "fa" ? "دفترچه جدید" : "New notebook",
        exact: true,
      });
      const before = await readCanonicalBusinessEvidence(page);
      for (const group of [
        language === "fa" ? "چه کسی می‌تواند بخواند" : "Who can read",
        language === "fa" ? "چه کسی می‌تواند اضافه کند" : "Who can add",
        language === "fa" ? "فیلدهای یادداشت" : "Entry fields",
      ]) {
        const scope = editor.getByRole("group", { name: group, exact: true });
        for (const control of await scope.getByRole("checkbox").all())
          report.push({ screen: group, ...(await assertStyle(control)) });
      }
      const required = editor.locator('[role="checkbox"]:disabled').first();
      await expect(required).toBeChecked();
      const editable = editor
        .locator('[role="checkbox"]:not(:disabled)')
        .first();
      const old = await editable.getAttribute("aria-checked");
      await editable.focus();
      await page.keyboard.press("Space");
      await expect(editable).toHaveAttribute(
        "aria-checked",
        old === "true" ? "false" : "true",
      );
      await expect(required).toBeChecked();
      await editor.screenshot({
        path: info.outputPath(`notebook-checkboxes-${language}-${theme}.png`),
      });
      await editor
        .getByRole("button", {
          name: language === "fa" ? "انصراف" : "Cancel",
          exact: true,
        })
        .click();
      await expect(editor).toHaveCount(0);
      expect(await readCanonicalBusinessEvidence(page)).toEqual(before);

      await page.goto("/#settings?group=returns");
      await expect(page.locator(".labels-settings-stack")).toBeVisible();
      const returns = page
        .locator(".form-card")
        .filter({
          has: page.getByRole("heading", {
            name: language === "fa" ? "مرجوعی‌ها" : "Returns",
            exact: true,
          }),
        })
        .getByRole("checkbox");
      report.push({
        screen: "Returns settings",
        ...(await assertStyle(returns)),
      });
      for (const control of await page
        .locator(".labels-settings-stack")
        .getByRole("checkbox")
        .all())
        report.push({
          screen: "Labels settings",
          ...(await assertStyle(control)),
        });
      const labels = page
        .locator(".labels-settings-stack")
        .getByRole("checkbox")
        .first();
      await labels.focus();
      await page.keyboard.press("Space");
      report.push({ screen: "Labels toggled", ...(await assertStyle(labels)) });
      await page.screenshot({
        path: info.outputPath(`settings-checkboxes-${language}-${theme}.png`),
        fullPage: true,
      });
      // Settings edits remain a local draft until the real Save action.
      await page.goto("/#payables");
      await expect(page.locator(".filter-chip")).toHaveCount(2);
      await expect(page.locator(".filter-chip .ui-checkbox-box")).toHaveCount(
        0,
      );
      expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
      await info.attach(`checkboxes-${language}-${theme}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
    });
