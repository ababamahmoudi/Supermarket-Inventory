import { expect, test, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { word } from "./r2-receiving-helpers";
import { createTotalsAlert } from "./pr29-dashboard-helpers";

/** New PR 29 English labels must never appear on the Persian screens. */
const newEnglish = [
  "Show all",
  "Open approvals",
  "Complete profile",
  "contact details not added",
  "totals don't match",
  "Totals don't match",
  "Subtotal on paper",
  "Calculated from the lines",
  "Difference",
  "Open invoice",
  "Correct invoice",
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
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow, `${label} horizontal page scroll`).toBe(false);
  if (language === "fa") {
    const text = await page.locator("main").innerText();
    for (const phrase of newEnglish)
      expect(text, `${label} untranslated "${phrase}"`).not.toContain(phrase);
  }
}

for (const language of ["en", "fa"] as const) {
  test(`PR 29 Dashboard, Suppliers, Alerts and History pass the c5 proof in ${language}`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await signIn(page, "Manager");
    await createTotalsAlert(page);
    await setBranch(page, "all");
    await setLanguage(page, language);
    const widths =
      info.project.name === "phone" ? [390] : ([1440, 1000] as const);
    for (const [name, route, ready] of [
      ["dashboard", "dashboard", ".dashboard-approvals"],
      ["suppliers", "suppliers", ".suppliers-overview"],
      [
        "supplier",
        "suppliers?name=Corner%20Spice%20Co.",
        ".supplier-contact-card",
      ],
      ["alerts", "alerts", ".totals-alert"],
      ["history", "history", ".history-card"],
    ] as const) {
      await page.goto(`/#${route}`);
      await expect(page.locator(ready).first()).toBeVisible();
      for (const width of widths)
        for (const dark of [false, true]) {
          await page.setViewportSize({ width, height: 900 });
          await setTheme(page, language, dark);
          await proof(
            page,
            `${name}-${language}-${width}-${dark ? "dark" : "light"}`,
            language,
          );
        }
    }
    expect(errors).toEqual([]);
  });
}
