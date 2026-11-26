import { expect, test, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { openShellAction, setBranch, setLanguage } from "./helpers";
import { word } from "./r2-receiving-helpers";
import {
  createOfferSuggestion,
  createPriceUpdates,
} from "./pr29-price-updates-helpers";

/** New PR 29 English labels must never appear on the Persian screens. */
const newEnglish = [
  "Print label",
  "Print now",
  "Add to print queue",
  "Starting slot",
  "Select all",
  "Mark as seen",
  "Mark as done",
  "Not done yet",
  "Not seen yet",
  "Export CSV",
  "Last 30 days",
  "kept forever",
  "Offer suggestions",
  "No products yet",
  "count together",
  "Dismiss",
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
  const report = await inspect(page, "PR 29", label, "manager");
  expect(report.failures, label).toEqual([]);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    // Tabs never wrap: every tab in a tab list sits on one line.
    wrapped: Array.from(document.querySelectorAll("main [role=tablist]")).some(
      (list) =>
        new Set(
          Array.from(list.querySelectorAll("[role=tab]")).map((tab) =>
            Math.round(tab.getBoundingClientRect().top),
          ),
        ).size > 1,
    ),
  }));
  expect(layout.overflow, `${label} horizontal page scroll`).toBe(false);
  expect(layout.wrapped, `${label} tabs wrapped`).toBe(false);
  if (language === "fa") {
    const text = await page.locator("main").innerText();
    for (const phrase of newEnglish)
      expect(text, `${label} untranslated "${phrase}"`).not.toContain(phrase);
  }
}

for (const language of ["en", "fa"] as const) {
  test(`PR 29 Price updates and Offers pass the c5 proof in ${language}`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await createOfferSuggestion(page);
    await createPriceUpdates(page);
    await setBranch(page, "all");
    await setLanguage(page, language);
    const widths =
      info.project.name === "phone" ? [390] : ([1440, 1000] as const);
    const each = async (name: string, open?: () => Promise<void>) => {
      for (const width of widths)
        for (const dark of [false, true]) {
          await page.setViewportSize({ width, height: 900 });
          await setTheme(page, language, dark);
          if (open) await open();
          await proof(
            page,
            `${name}-${language}-${width}-${dark ? "dark" : "light"}`,
            language,
          );
          if (open) {
            await page.keyboard.press("Escape");
            await expect(page.locator("dialog[open]")).toHaveCount(0);
          }
        }
    };
    await page.goto("/#price-updates");
    await expect(page.locator(".price-updates-row").first()).toBeVisible();
    // Put the bulk bar on screen.
    await page.locator(".price-updates-row [role=checkbox]").first().click();
    await expect(page.locator(".price-updates-bulk-bar")).toBeVisible();
    await each("price-updates");
    await each("print-label", async () => {
      await page.locator(".price-updates-print").first().click();
      await expect(page.locator(".price-label-print-dialog")).toBeVisible();
    });
    await page
      .locator(".price-updates-bulk-bar")
      .getByRole("button", {
        name: word(language, "Mark as done", "علامت انجام‌شده"),
      })
      .click();
    await page.locator("main").getByRole("tab").nth(1).click();
    await expect(page.locator(".price-updates-retention")).toBeVisible();
    await each("price-updates-done");
    await page.goto("/#offers");
    await expect(page.locator(".offer-suggestions-card")).toBeVisible();
    await each("offers");
    await page.locator("main").getByRole("tab").nth(2).click();
    await expect(page.locator(".offer-pools-card")).toBeVisible();
    await each("offer-pools");
    expect(errors).toEqual([]);
  });
}
