import { expect, test, type Page } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";
import {
  chooseC8Date,
  openC8ProductEditor,
  readC8State,
  visitC8,
} from "../scripts/capture-c8-proof.mjs";
import type { DemoState } from "../src/types";

const exact = (en: string, fa: string) =>
  new RegExp("^(?:" + en + "|" + fa + ")$");
const business = (state: DemoState) =>
  JSON.stringify({
    products: state.products,
    expiry: state.expiry,
    activity: state.activity,
    ledger: state.ledger,
  });
const openDates = (state: DemoState, code: string) =>
  state.expiry.filter(
    (date) =>
      date.company_id === state.config.company.seed_key &&
      date.product_code === code &&
      date.status !== "removed",
  );

async function prepare(page: Page, language: "en" | "fa") {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
}

for (const language of ["en", "fa"] as const) {
  test(
    "C8 product follows same-document hashchange, Back and Forward (" +
      language +
      ")",
    async ({ page }) => {
      await prepare(page, language);
      const state = await readC8State(page);
      const product = (code: string) =>
        state.products.find(
          (entry) =>
            entry.company_id === state.config.company.seed_key &&
            entry.code === code,
        )!;
      const check = async (code: string, previousCode: string) => {
        const current = product(code);
        await expect(page.locator(".product-page h1")).toHaveText(
          language === "fa"
            ? current.name_fa || current.name_en
            : current.name_en,
        );
        await expect(page.locator(".product-page")).toContainText(
          current.barcode,
        );
        await expect(page.locator(".product-page")).not.toContainText(
          product(previousCode).barcode,
        );
      };
      await visitC8(page, "product?code=0016");
      await check("0016", "0006");
      // Keep the same mounted document: a reload would hide the reported bug.
      await visitC8(page, "product?code=0006");
      await check("0006", "0016");
      await page.goBack();
      await expect(page).toHaveURL(/#product\?code=0016$/);
      await check("0016", "0006");
      await page.goForward();
      await expect(page).toHaveURL(/#product\?code=0006$/);
      await check("0006", "0016");
      expect(business(await readC8State(page))).toBe(business(state));
    },
  );

  test(
    "C8 tracking without any company date blocks Save and focuses the linked field (" +
      language +
      ")",
    async ({ page }) => {
      await prepare(page, language);
      const before = await readC8State(page);
      expect(openDates(before, "0004")).toHaveLength(0);
      const dialog = await openC8ProductEditor(page, "0004");
      await dialog
        .getByLabel(exact("English name", "نام انگلیسی"), { exact: true })
        .fill("C8 blocked save must not persist");
      const tracking = dialog.getByRole("switch", {
        name: exact("Date tracking", "پیگیری تاریخ"),
      });
      if ((await tracking.getAttribute("aria-checked")) !== "true")
        await tracking.click();
      await dialog
        .getByRole("button", { name: exact("Save product", "ذخیرهٔ محصول") })
        .click();
      const missing = dialog.getByRole("alert", {
        name: exact("What's missing", "چه چیزی کم است"),
      });
      await expect(missing).toBeVisible();
      const link = missing.getByRole("link", {
        name: exact(
          "Add an expiry date, or turn off date tracking",
          "یک تاریخ انقضا اضافه کنید، یا پیگیری تاریخ را خاموش کنید",
        ),
      });
      await expect(link).toBeVisible();
      const date = dialog
        .locator(".product-editor-date-inline")
        .getByLabel(exact("Date", "تاریخ"), { exact: true });
      await expect(date).toBeFocused();
      await link.click();
      await expect(date).toBeFocused();
      await expect(date).toHaveAttribute("aria-invalid", "true");
      expect(business(await readC8State(page))).toBe(business(before));
      await dialog
        .getByRole("button", { name: exact("Cancel", "انصراف") })
        .click();
      await expect(dialog).toBeHidden();
      expect(business(await readC8State(page))).toBe(business(before));
    },
  );

  test(
    "C8 Save includes a picked past date not yet Added exactly once (" +
      language +
      ")",
    async ({ page }) => {
      await prepare(page, language);
      const before = await readC8State(page);
      expect(openDates(before, "0004")).toHaveLength(0);
      const dialog = await openC8ProductEditor(page, "0004");
      const tracking = dialog.getByRole("switch", {
        name: exact("Date tracking", "پیگیری تاریخ"),
      });
      if ((await tracking.getAttribute("aria-checked")) !== "true")
        await tracking.click();
      const inline = dialog.locator(".product-editor-date-inline");
      const date = inline.getByLabel(exact("Date", "تاریخ"), { exact: true });
      const yesterday = await page.evaluate((timeZone) => {
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const previous = new Date(today + "T12:00:00Z");
        previous.setUTCDate(previous.getUTCDate() - 1);
        return previous.toISOString().slice(0, 10);
      }, before.config.company.timezone);
      await chooseC8Date(page, date, yesterday);
      const selectedDate = (await date.innerText()).trim();
      expect(selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(selectedDate).toBe(yesterday);
      await inline
        .getByLabel(exact("Quantity \\(optional\\)", "مقدار \\(اختیاری\\)"), {
          exact: true,
        })
        .fill("2");
      await inline
        .getByLabel(exact("Lot \\(optional\\)", "سری ساخت \\(اختیاری\\)"), {
          exact: true,
        })
        .fill("C8-PICKED-NOT-ADDED");
      await expect(dialog.locator(".product-editor-date-row")).toHaveCount(0);
      expect(openDates(await readC8State(page), "0004")).toHaveLength(0);
      await dialog
        .getByRole("button", { name: exact("Save product", "ذخیرهٔ محصول") })
        .click();
      await expect(dialog).toBeHidden();
      await expect
        .poll(async () => openDates(await readC8State(page), "0004").length)
        .toBe(1);
      const after = await readC8State(page);
      expect(openDates(after, "0004")[0]).toMatchObject({
        branch: "Branch 1",
        date: selectedDate,
        quantity: "2",
        lot_number: "C8-PICKED-NOT-ADDED",
      });
      expect(
        after.products.find((entry) => entry.code === "0004")?.date_tracking,
      ).toBe(true);
      expect(after.ledger).toEqual(before.ledger);
      const reopened = await openC8ProductEditor(page, "0004");
      await expect(reopened.locator(".product-editor-date-row")).toHaveCount(1);
      await reopened
        .getByRole("button", { name: exact("Save product", "ذخیرهٔ محصول") })
        .click();
      await expect(reopened).toBeHidden();
      expect(openDates(await readC8State(page), "0004")).toHaveLength(1);
    },
  );

  test(
    "C8 existing other-location open date allows Save without copying its date (" +
      language +
      ")",
    async ({ page }) => {
      await prepare(page, language);
      const before = await readC8State(page);
      const elsewhere = openDates(before, "0006");
      expect(elsewhere.length).toBeGreaterThan(0);
      expect(elsewhere.every((entry) => entry.branch !== "Branch 2")).toBe(
        true,
      );
      await setBranch(page, "Branch 2");
      const dialog = await openC8ProductEditor(page, "0006");
      await expect(dialog.locator(".product-editor-date-row")).toHaveCount(0);
      const tracking = dialog.getByRole("switch", {
        name: exact("Date tracking", "پیگیری تاریخ"),
      });
      if ((await tracking.getAttribute("aria-checked")) !== "true")
        await tracking.click();
      await dialog
        .getByLabel(exact("English name", "نام انگلیسی"), { exact: true })
        .fill("C8 date retained at original store");
      await dialog
        .getByRole("button", { name: exact("Save product", "ذخیرهٔ محصول") })
        .click();
      await expect(dialog).toBeHidden();
      await expect
        .poll(
          async () =>
            (await readC8State(page)).products.find(
              (entry) => entry.code === "0006",
            )?.name_en,
        )
        .toBe("C8 date retained at original store");
      const after = await readC8State(page);
      expect(after.expiry).toEqual(before.expiry);
      expect(after.ledger).toEqual(before.ledger);
      expect(
        after.products.find((entry) => entry.code === "0006")?.date_tracking,
      ).toBe(true);
    },
  );

  test(
    "C8 incomplete staged date blocks Save and valid picked date Cancel persists nothing (" +
      language +
      ")",
    async ({ page }) => {
      await prepare(page, language);
      const before = await readC8State(page);
      expect(openDates(before, "0004")).toHaveLength(0);
      const dialog = await openC8ProductEditor(page, "0004");
      const tracking = dialog.getByRole("switch", {
        name: exact("Date tracking", "پیگیری تاریخ"),
      });
      if ((await tracking.getAttribute("aria-checked")) !== "true")
        await tracking.click();
      const inline = dialog.locator(".product-editor-date-inline");
      await inline
        .getByLabel(exact("Lot \\(optional\\)", "سری ساخت \\(اختیاری\\)"), {
          exact: true,
        })
        .fill("C8-INCOMPLETE-THEN-CANCEL");
      await inline
        .getByLabel(exact("Quantity \\(optional\\)", "مقدار \\(اختیاری\\)"), {
          exact: true,
        })
        .fill("2");
      await dialog
        .getByRole("button", { name: exact("Save product", "ذخیرهٔ محصول") })
        .click();
      const date = inline.getByLabel(exact("Date", "تاریخ"), { exact: true });
      await expect(
        dialog.getByRole("alert", {
          name: exact("What's missing", "چه چیزی کم است"),
        }),
      ).toBeVisible();
      await expect(date).toHaveAttribute("aria-invalid", "true");
      expect(business(await readC8State(page))).toBe(business(before));
      await chooseC8Date(page, date);
      const quantity = inline.getByLabel(
        exact("Quantity \\(optional\\)", "مقدار \\(اختیاری\\)"),
        { exact: true },
      );
      await quantity.fill("-1");
      await dialog
        .getByRole("button", { name: exact("Save product", "ذخیرهٔ محصول") })
        .click();
      await expect(quantity).toHaveAttribute("aria-invalid", "true");
      await expect(
        dialog.getByRole("alert", {
          name: exact("What's missing", "چه چیزی کم است"),
        }),
      ).toBeVisible();
      expect(business(await readC8State(page))).toBe(business(before));
      await quantity.fill("2");
      await expect(dialog.locator(".product-editor-date-row")).toHaveCount(0);
      await dialog
        .getByRole("button", { name: exact("Cancel", "انصراف") })
        .click();
      await expect(dialog).toBeHidden();
      expect(business(await readC8State(page))).toBe(business(before));
      const reopened = await openC8ProductEditor(page, "0004");
      await expect(reopened.locator(".product-editor-date-row")).toHaveCount(0);
      await expect(
        reopened
          .locator(".product-editor-date-inline")
          .getByLabel(exact("Lot \\(optional\\)", "سری ساخت \\(اختیاری\\)"), {
            exact: true,
          }),
      ).toHaveValue("");
      await reopened
        .getByRole("button", { name: exact("Cancel", "انصراف") })
        .click();
      expect(business(await readC8State(page))).toBe(business(before));
    },
  );
}
