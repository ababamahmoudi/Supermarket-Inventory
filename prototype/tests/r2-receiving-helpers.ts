import { expect, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";

export type ReceivingLanguage = "en" | "fa";
export const receivingNumber = "R2-FICTIONAL-025";
export const receivingFixture = fileURLToPath(
  new URL("./fixtures/r2-fictional-readings-export.json", import.meta.url),
);
export const word = (language: ReceivingLanguage, en: string, fa: string) =>
  language === "fa" ? fa : en;

export async function removeReceivingDemo(
  page: Page,
  language: ReceivingLanguage,
) {
  await page.goto("/#settings");
  await page
    .getByRole("navigation", {
      name: word(language, "Settings groups", "گروه‌های تنظیمات"),
      exact: true,
    })
    .getByRole("button", {
      name: word(language, "Data", "داده‌ها"),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: word(language, "Remove fictional data…", "حذف داده‌های خیالی…"),
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  const remove = dialog.getByRole("button", {
    name: word(language, "Remove fictional data", "حذف داده‌های خیالی"),
    exact: true,
  });
  await expect(remove).toBeDisabled();
  await dialog.getByRole("textbox").fill(word(language, "DELETE", "حذف"));
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect
    .poll(async () => {
      const evidence = await readCanonicalBusinessEvidence(page);
      return {
        invoices: evidence.invoices?.length ?? 0,
        products: evidence.products.length,
        suppliers: evidence.suppliers?.length ?? 0,
      };
    })
    .toEqual({ invoices: 0, products: 0, suppliers: 0 });
}

export async function importReceivingFixture(
  page: Page,
  language: ReceivingLanguage,
) {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
  await removeReceivingDemo(page, language);
  await page
    .getByLabel(word(language, "Choose file…", "انتخاب فایل…"), { exact: true })
    .setInputFiles(receivingFixture);
  const preview = page.getByRole("dialog", {
    name: word(language, "Import invoice readings", "ورود خوانش فاکتورها"),
    exact: true,
  });
  const partial = preview.locator(
    '[data-import-id="fictional-r2-page-one-only"]',
  );
  const complete = preview.locator('[data-import-id="fictional-r2-complete"]');
  await expect(partial.getByRole("checkbox")).not.toBeChecked();
  await expect(complete.getByRole("checkbox")).toBeChecked();
  await expect(
    preview.getByText(
      word(
        language,
        "Same invoice twice in this file",
        "همین فاکتور دو بار در این فایل است",
      ),
      { exact: true },
    ),
  ).toHaveCount(2);
  await expect(preview).not.toContainText(
    word(language, "Already in the app", "از قبل در برنامه است"),
  );
  // Choosing either copy excludes the other; keep the complete invoice for review.
  await partial.getByRole("checkbox").check();
  await expect(complete.getByRole("checkbox")).not.toBeChecked();
  await complete.getByRole("checkbox").check();
  await expect(partial.getByRole("checkbox")).not.toBeChecked();
  await preview
    .getByRole("button", {
      name: word(language, "Import 1 invoices", "ورود 1 فاکتور"),
      exact: true,
    })
    .click();
  const summary = page.getByRole("dialog", {
    name: word(language, "Import complete", "ورود کامل شد"),
    exact: true,
  });
  await expect(summary).toBeVisible();
  await summary
    .getByText(word(language, "Open Needs review", "باز کردن نیازمند بررسی"), {
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoices?.filter(
          (invoice) => invoice.supplier_invoice_number === receivingNumber,
        ).length,
    )
    .toBe(1);
  const invoice = (await readCanonicalBusinessEvidence(page)).invoices!.find(
    (entry) => entry.supplier_invoice_number === receivingNumber,
  )!;
  await page
    .locator(".invoice-saved-drafts tbody tr")
    .filter({ hasText: receivingNumber })
    .getByRole("link", { name: receivingNumber, exact: true })
    .click();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  return invoice;
}

export function receivingRow(page: Page, index: number) {
  return page.getByTestId(`invoice-line-row-${index}`);
}
export async function openReceivingLine(page: Page, index: number) {
  await receivingRow(page, index).click();
  const editor = page
    .locator(`[id="invoice-line-${index}-name-en"]`)
    .locator("xpath=ancestor::section[@role='region'][1]");
  await expect(editor).toBeVisible();
  return editor;
}
export async function setReceivingCategory(
  page: Page,
  editor: Locator,
  language: ReceivingLanguage,
) {
  await chooseOption(
    page,
    editor.locator('[id$="-category"]'),
    "grocery",
    word(language, "Grocery", "خواربار"),
  );
}

/** Observe frame geometry during the action, not just an eventual stable value. */
export async function expectReceivingStable(
  page: Page,
  measured: Locator,
  action: () => Promise<unknown>,
  options: { scroll?: boolean } = {},
) {
  if (options.scroll !== false) {
    await measured.evaluate((element) =>
      element.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "instant",
      }),
    );
    // Setup scrolling is intentional; start the invariant after its layout frames.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(measured).toBeInViewport({ ratio: 1 });
  }
  const element = await measured.elementHandle();
  if (!element) throw new Error("Stability target is missing");
  await element.evaluate((target) => {
    const state = {
      top: target.getBoundingClientRect().top,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      maxDelta: 0,
      disconnected: false,
      active: true,
    };
    Object.assign(target, { __receivingGeometry: state });
    const sample = () => {
      state.disconnected ||= !target.isConnected;
      state.maxDelta = Math.max(
        state.maxDelta,
        Math.abs(target.getBoundingClientRect().top - state.top),
      );
      if (state.active) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await action();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const geometry = await element.evaluate((target) => {
    const state = (
      target as HTMLElement & {
        __receivingGeometry: {
          top: number;
          scrollY: number;
          documentHeight: number;
          maxDelta: number;
          disconnected: boolean;
          active: boolean;
        };
      }
    ).__receivingGeometry;
    state.active = false;
    return {
      maxDelta: state.maxDelta,
      disconnected: state.disconnected,
      startTop: state.top,
      finalTop: target.getBoundingClientRect().top,
      startScrollY: state.scrollY,
      finalScrollY: window.scrollY,
      startDocumentHeight: state.documentHeight,
      finalDocumentHeight: document.documentElement.scrollHeight,
    };
  });
  await element.dispose();
  expect(
    geometry.disconnected,
    "The control must not remount during editing",
  ).toBe(false);
  expect(
    geometry.maxDelta,
    `The used control/closing row must stay within 2px on every measured frame: ${JSON.stringify(geometry)}`,
  ).toBeLessThanOrEqual(2);
}
