import { expect, type Page } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";
import { removeReceivingDemo, word } from "./r2-receiving-helpers";

export const pr29Number = "PR29-FICT-001";

/** Imports the wholly fictional PR 29 invoice and opens its review. */
export async function openPr29Invoice(page: Page, language: "en" | "fa") {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
  await removeReceivingDemo(page, language);
  await page
    .getByLabel(word(language, "Choose file…", "انتخاب فایل…"), { exact: true })
    .setInputFiles("tests/fixtures/pr29-fictional-readings-export.json");
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: word(language, "Import 1 invoice", "ورود 1 فاکتور"),
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", {
      name: word(language, "Import complete", "ورود کامل شد"),
    })
    .getByText(word(language, "Open Needs review", "باز کردن نیازمند بررسی"), {
      exact: true,
    })
    .click();
  await page
    .locator(".invoice-saved-table tbody tr")
    .filter({ hasText: pr29Number })
    .getByRole("link", { name: pr29Number, exact: true })
    .first()
    .click();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
}
