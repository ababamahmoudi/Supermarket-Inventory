import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const screens = [
  ["lookup", "Cashier lookup", "جست‌وجوی صندوق‌دار"],
  ["invoices", "Invoices", "فاکتورها"],
  ["approvals", "Approvals", "تأییدها"],
  ["alerts", "Alerts", "هشدارها"],
  ["offers", "Offers", "پیشنهادهای فروش"],
  ["labels", "Labels", "برچسب‌ها"],
  ["returns", "Returns", "مرجوعی‌ها"],
  ["expiry", "Date tracking", "پیگیری تاریخ"],
  ["notes", "Notes", "یادداشت‌ها"],
  ["payables", "Payables", "پرداختنی‌ها"],
  ["dashboard", "Supervisor dashboard", "داشبورد سرپرست"],
  ["products", "Products", "محصولات"],
  ["suppliers", "Suppliers", "تأمین‌کنندگان"],
  ["settings", "Settings", "تنظیمات"],
];

test("all screens and both languages work offline with no console errors", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await signIn(page, "Supervisor");
  await page.evaluate(() => document.fonts.ready);
  await context.setOffline(true);
  for (const language of ["en", "fa"]) {
    if (language === "fa")
      await page.getByRole("button", { name: "فارسی", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      language === "fa" ? "rtl" : "ltr",
    );
    for (const [route, en, fa] of screens) {
      await page.evaluate((route) => {
        window.location.hash = route;
      }, route);
      await expect(
        page.getByRole("heading", {
          name: language === "fa" ? fa : en,
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
