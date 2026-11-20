import { expect, test, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { openShellAction } from "./helpers";
import { word } from "./r2-receiving-helpers";
import { openPr29Invoice } from "./pr29-receiving-helpers";

/** New PR 29 English labels must never appear on the Persian screens. */
const newEnglish = [
  "Applies to",
  "Invoice total",
  "Chosen items",
  "Add item",
  "Do these for every line at once",
  "Confirm ready",
  "ready line",
  "Selling price",
  "margin",
  "Looks right",
  "Open invoice",
  "On the paper",
  "Edit paper total",
  "Fees and deposits",
  "Split by line total",
  "checked by you",
];

async function setTheme(page: Page, language: "en" | "fa", dark: boolean) {
  const current = await page.locator("html").getAttribute("data-theme");
  if ((current === "dark") === dark) return;
  await (
    await openShellAction(
      page,
      word(
        language,
        `Switch to ${dark ? "dark" : "light"} theme`,
        dark ? "تغییر به تم تیره" : "تغییر به تم روشن",
      ),
    )
  ).click();
}

async function proof(page: Page, label: string, language: "en" | "fa") {
  const report = await inspect(page, "PR 29", label, "owner");
  expect(report.failures, label).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    `${label} horizontal page scroll`,
  ).toBe(true);
  if (language === "fa") {
    const text = await page.locator("main").innerText();
    for (const phrase of newEnglish)
      expect(text, `${label} untranslated "${phrase}"`).not.toContain(phrase);
  }
}

for (const language of ["en", "fa"] as const) {
  test(`PR 29 changed receiving screens pass the c5 proof in ${language}`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openPr29Invoice(page, language);
    // Put the new controls on screen: the credit choice with chosen items.
    const credit = page.locator("#invoice-check-charge-1-applies_to");
    await credit
      .getByRole("button", {
        name: word(language, "Chosen items", "کالاهای انتخابی"),
      })
      .click();
    await credit.getByRole("combobox").click();
    await page.getByRole("option").first().click();
    await expect(credit.locator(".receiving-credit-info")).toBeVisible();
    const widths =
      info.project.name === "phone" ? [390] : ([1440, 1000] as const);
    for (const width of widths)
      for (const dark of [false, true]) {
        await page.setViewportSize({ width, height: 900 });
        await setTheme(page, language, dark);
        await proof(
          page,
          `review-${language}-${width}-${dark ? "dark" : "light"}`,
          language,
        );
      }
    await page.goto("/#invoices");
    await expect(page.locator(".invoice-saved-table").first()).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await proof(page, `list-${language}-${width}`, language);
    }
    await page.goto("/#history");
    await expect(page.locator("main")).toBeVisible();
    await proof(page, `history-${language}`, language);
    expect(errors).toEqual([]);
  });
}
