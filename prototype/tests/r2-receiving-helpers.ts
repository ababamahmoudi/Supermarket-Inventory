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
  onPreview?: (preview: Locator) => Promise<void>,
  onSummary?: (summary: Locator) => Promise<void>,
  sourceFile: Parameters<Locator["setInputFiles"]>[0] = receivingFixture,
) {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
  await removeReceivingDemo(page, language);
  await page
    .getByLabel(word(language, "Choose file…", "انتخاب فایل…"), { exact: true })
    .setInputFiles(sourceFile);
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
  await onPreview?.(preview);
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
  await onSummary?.(summary);
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
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
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
    const context = () => {
      const bounds = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      return {
        top: bounds.top,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        targetHeight: bounds.height,
        targetStyle: {
          transform: style.transform,
          translate: style.translate,
          marginBlockStart: style.marginBlockStart,
          marginBlockEnd: style.marginBlockEnd,
          paddingBlockStart: style.paddingBlockStart,
          paddingBlockEnd: style.paddingBlockEnd,
          lineHeight: style.lineHeight,
          fontSize: style.fontSize,
          alignSelf: style.alignSelf,
          position: style.position,
          top: style.top,
        },
        active: target.matches(":active"),
        focused: target.matches(":focus"),
        viewport: window.visualViewport
          ? {
              offsetTop: window.visualViewport.offsetTop,
              offsetLeft: window.visualViewport.offsetLeft,
              pageTop: window.visualViewport.pageTop,
              pageLeft: window.visualViewport.pageLeft,
              height: window.visualViewport.height,
              scale: window.visualViewport.scale,
            }
          : null,
        ancestors: [
          ".receiving-header",
          ".receiving-details",
          ".receiving-card-title",
          ".main-content",
          ".topbar",
          ".receiving-review",
          ".receiving-lines-table",
        ].map((selector) => {
          const node = document.querySelector(selector);
          if (!node) return { selector, missing: true };
          const rectangle = node.getBoundingClientRect();
          return {
            selector,
            top: rectangle.top,
            left: rectangle.left,
            height: rectangle.height,
            width: rectangle.width,
            transform: getComputedStyle(node).transform,
          };
        }),
      };
    };
    const state = {
      top: target.getBoundingClientRect().top,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      maxDelta: 0,
      startFrame: context(),
      maxFrame: null as null | Record<string, unknown>,
      disconnected: false,
      active: true,
    };
    Object.assign(target, { __receivingGeometry: state });
    const sample = () => {
      state.disconnected ||= !target.isConnected;
      const bounds = target.getBoundingClientRect();
      const delta = Math.abs(bounds.top - state.top);
      if (delta > state.maxDelta) {
        state.maxDelta = delta;
        state.maxFrame = context();
      }
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
          startFrame: Record<string, unknown>;
          maxFrame: null | Record<string, unknown>;
          disconnected: boolean;
          active: boolean;
        };
      }
    ).__receivingGeometry;
    state.active = false;
    return {
      maxDelta: state.maxDelta,
      startFrame: state.startFrame,
      maxFrame: state.maxFrame,
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
