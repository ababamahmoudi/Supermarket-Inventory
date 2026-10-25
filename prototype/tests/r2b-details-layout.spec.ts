import { expect, test } from "@playwright/test";
import { join } from "node:path";
import {
  importReceivingFixture,
  openReceivingLine,
  word,
} from "./r2-receiving-helpers";
import { chooseOption, openInvoiceDetails, openShellAction } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
for (const language of ["en", "fa"] as const) {
  test(`R2b 2.4 addresses stay multiline and Other terms stay level in ${language}`, async ({
    page,
  }, testInfo) => {
    await importReceivingFixture(page, language);
    await openInvoiceDetails(page);
    const card = page.getByTestId("invoice-details-card");
    const more = card.locator("details.receiving-more");
    if ((await more.getAttribute("open")) === null)
      await more.locator("summary").click();
    const bill = page.locator("#invoice-bill-to"),
      ship = page.locator("#invoice-ship-to");
    await expect(bill).toHaveJSProperty("tagName", "TEXTAREA");
    await expect(ship).toHaveJSProperty("tagName", "TEXTAREA");
    await expect(bill).toHaveAttribute("rows", "2");
    await expect(ship).toHaveAttribute("rows", "2");
    await bill.fill("Invented Lane\nUnit ");
    await bill.pressSequentially("20");
    await expect(bill).toHaveValue("Invented Lane\nUnit 20");
    await bill.press("Tab");
    await ship.fill("Fictional Road\nDock 3");
    await ship.press("Tab");
    await chooseOption(
      page,
      page.locator("#invoice-payment-terms"),
      "other",
      word(language, "Other", "سایر"),
    );
    await page.locator("#invoice-payment-terms-days").fill("20");
    await page.locator("#invoice-payment-terms-days").press("Tab");
    const widths = testInfo.project.name === "phone" ? [390] : [1440, 1000];
    for (const width of widths)
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: 900 });
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              word(
                language,
                `Switch to ${theme} theme`,
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        await expect(page.getByTestId("invoice-review")).toHaveClass(
          /ui-form-surface/,
        );
        const metrics = await card.evaluate((element) => {
          const data = (id: string) => {
            const node = element.querySelector<HTMLElement>(`#${id}`)!;
            const rect = node.getBoundingClientRect();
            return { top: rect.top, height: rect.height };
          };
          const bill =
              element.querySelector<HTMLTextAreaElement>("#invoice-bill-to")!,
            ship =
              element.querySelector<HTMLTextAreaElement>("#invoice-ship-to")!;
          const style = getComputedStyle(bill),
            cardStyle = getComputedStyle(element);
          return {
            terms: data("invoice-payment-terms"),
            days: data("invoice-payment-terms-days"),
            due: data("invoice-due-date"),
            location: data("invoice-location"),
            billLines:
              (bill.clientHeight -
                parseFloat(style.paddingTop) -
                parseFloat(style.paddingBottom)) /
              parseFloat(style.lineHeight),
            billWidth: bill.scrollWidth <= bill.clientWidth + 1,
            shipWidth: ship.scrollWidth <= ship.clientWidth + 1,
            fill: style.backgroundColor,
            surface: cardStyle.backgroundColor,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        expect(
          Math.abs(metrics.terms.top - metrics.days.top),
        ).toBeLessThanOrEqual(2);
        expect(metrics.terms.height).toBe(44);
        expect(metrics.days.height).toBe(44);
        if (width >= 760) {
          expect(
            Math.abs(metrics.due.top - metrics.location.top),
          ).toBeLessThanOrEqual(2);
          expect(
            Math.abs(metrics.terms.top - metrics.due.top),
          ).toBeLessThanOrEqual(2);
        }
        expect(metrics.billLines).toBeCloseTo(2, 3);
        expect(metrics.billWidth && metrics.shipWidth).toBe(true);
        expect(metrics.fill).toBe(metrics.surface);
        expect(metrics.overflow).toBe(false);
        await expect(bill).toHaveValue("Invented Lane\nUnit 20");
        await expect(ship).toHaveValue("Fictional Road\nDock 3");
        await card
          .locator(".receiving-received-field")
          .getByRole("button", {
            name: word(language, "Change", "تغییر"),
            exact: true,
          })
          .click();
        const received = page.getByRole("dialog", {
          name: word(
            language,
            "Change received details",
            "تغییر اطلاعات دریافت",
          ),
          exact: true,
        });
        await expect(received).toHaveClass(/ui-form-surface/);
        expect(
          await received
            .locator("#invoice-received-time")
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toBe(metrics.surface);
        await page.keyboard.press("Escape");
        await chooseOption(
          page,
          page.locator("#invoice-supplier"),
          "__add_supplier",
          word(language, "+ Add supplier", "+ افزودن تأمین‌کننده"),
        );
        const supplier = page.getByRole("dialog", {
          name: word(language, "Add supplier", "افزودن تأمین‌کننده"),
          exact: true,
        });
        await expect(supplier).toHaveClass(/ui-form-surface/);
        expect(
          await supplier
            .getByLabel(word(language, "Supplier name", "نام تأمین‌کننده"), {
              exact: true,
            })
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toBe(metrics.surface);
        await supplier
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
        const editor = await openReceivingLine(page, 0);
        expect(
          await editor
            .locator("#invoice-line-0-name-fa")
            .evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toBe(metrics.surface);
        await editor
          .getByRole("button", {
            name: word(language, "Close", "بستن"),
            exact: true,
          })
          .click();
        if (process.env.R2B_VISUAL_DIR)
          await card.screenshot({
            path: join(
              process.env.R2B_VISUAL_DIR,
              `details-${language}-${width}-${theme}.png`,
            ),
          });
      }
    const canonical = await readCanonicalBusinessEvidence(page);
    expect(canonical.invoice).toMatchObject({
      bill_to: "Invented Lane\nUnit 20",
      ship_to: "Fictional Road\nDock 3",
    });
  });
}
