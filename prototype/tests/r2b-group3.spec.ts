import { expect, test } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };

const invoiceId = `a2-fixture:${receiptFixtures.invoices[0].number}`;
for (const language of ["en", "fa"] as const)
  for (const width of [1440, 1000, 390])
    test(`R2b 3.2 posted receiving layout ${language} ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Owner");
      await setBranch(page, "all");
      await setLanguage(page, language);
      const t = (en: string, fa: string) => (language === "en" ? en : fa);
      await page.goto(`/#invoices?id=${encodeURIComponent(invoiceId)}`);
      await expect(
        page.getByRole("button", {
          name: t("Correct invoice", "اصلاح فاکتور"),
          exact: true,
        }),
      ).toBeVisible();
      const before = await readCanonicalBusinessEvidence(page);
      const source = before.invoices!.find(
        (invoice) => invoice.id === invoiceId,
      )!;
      const root = page.locator(".posted-receiving");
      const original = root.locator(".original-viewer");
      const work = root.locator(".receiving-work");
      for (const theme of ["light", "dark"]) {
        if (theme === "dark")
          await (
            await openShellAction(
              page,
              t("Switch to dark theme", "تغییر به تم تیره"),
            )
          ).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const geometry = await root.evaluate((element) => {
          const bounds = (selector: string) => {
            const rect = element
              .querySelector(selector)!
              .getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              right: rect.right,
              bottom: rect.bottom,
            };
          };
          const table = element.querySelector(".posted-invoice-lines")!;
          return {
            original: bounds(".original-viewer"),
            work: bounds(".receiving-work"),
            overflow:
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
            tableOverflow: table.scrollWidth - table.clientWidth,
          };
        });
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.tableOverflow).toBeLessThanOrEqual(1);
        if (width >= 1180) {
          if (language === "en")
            expect(geometry.original.x).toBeGreaterThanOrEqual(
              geometry.work.right + 14,
            );
          else
            expect(geometry.original.right).toBeLessThanOrEqual(
              geometry.work.x - 14,
            );
          await expect(original).toHaveCSS("position", "sticky");
        } else {
          expect(geometry.original.bottom).toBeLessThanOrEqual(
            geometry.work.y + 2,
          );
        }
        await expect(
          root.locator("header").getByRole("button", {
            name: t("Correct invoice", "اصلاح فاکتور"),
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          root.locator("header").getByRole("button", {
            name: t("Move invoice", "انتقال فاکتور"),
            exact: true,
          }),
        ).toBeVisible();
        await expect(root.locator('[data-posted-action="done"]')).toHaveClass(
          /button-primary/,
        );
        await expect(
          root.locator(
            ".posted-invoice-lines .receiving-status-cell, .posted-invoice-lines .receiving-status-icon",
          ),
        ).toHaveCount(0);
        await expect(
          root.locator(".posted-invoice-lines .receiving-row-confirmed"),
        ).toHaveCount(0);
        await expect(
          root.locator(".posted-invoice-lines th").filter({ hasText: /^#$/ }),
        ).toHaveCount(0);
        const presentation = await inspect(
          page,
          "R2b posted invoice",
          `${language}-${theme}`,
          "owner",
        );
        expect(presentation.failures).toEqual([]);
        if (width === 390 && language === "en" && theme === "light") {
          const done = root.locator('[data-posted-action="done"]');
          await done.evaluate((element) => {
            element.style.display = "none";
          });
          expect(
            (
              await inspect(
                page,
                "R2c missing Done negative control",
                "en-light",
                "owner",
              )
            ).failures,
          ).toContain(
            "Posted receiving header must show exactly its authorized actions",
          );
          await done.evaluate((element) => {
            element.style.removeProperty("display");
          });
          const correct = root.locator("[data-posted-action=correct]");
          const beforeBox = await correct.boundingBox();
          const priorStyle = await correct.getAttribute("style");
          await correct.evaluate((element) => {
            element.style.transform = "translateY(100px)";
          });
          const broken = await inspect(
            page,
            "R2b posted invalid header negative control",
            "en-light",
            "owner",
          );
          expect(broken.failures).toContain(
            "Posted receiving header actions must stay inside the header",
          );
          await correct.evaluate((element, style) => {
            if (style === null) element.removeAttribute("style");
            else element.setAttribute("style", style);
          }, priorStyle);
          expect(
            (
              await inspect(
                page,
                "R2b posted restored header",
                "en-light",
                "owner",
              )
            ).failures,
          ).toEqual([]);
          const afterBox = await correct.boundingBox();
          expect(Math.abs(afterBox!.x - beforeBox!.x)).toBeLessThanOrEqual(2);
          expect(Math.abs(afterBox!.y - beforeBox!.y)).toBeLessThanOrEqual(2);
        }
        await page.screenshot({
          path: info.outputPath(`posted-${language}-${width}-${theme}.png`),
          fullPage: true,
        });
        await expect(work.locator(".posted-invoice-totals > div")).toHaveCount(
          5,
        );
        for (const cost of await root
          .locator(".receiving-cost-cell")
          .allTextContents())
          expect(cost.trim()).toMatch(/\d\.\d{4}(?:\/\w+)?$/);
        const hasDate = source.lines.some(
          (line) => line.date_tracking && line.date_value,
        );
        await expect(
          root.getByRole("columnheader", {
            name: t("Tracked date", "تاریخ پیگیری‌شده"),
            exact: true,
          }),
        ).toHaveCount(width < 760 ? 0 : hasDate ? 1 : 0);
        if (width < 760) {
          await original
            .getByRole("button", { name: /^(View original|مشاهده اصل)/ })
            .click();
          const viewer = page.getByRole("dialog", {
            name: t("Original invoice", "اصل فاکتور"),
            exact: true,
          });
          await expect(viewer).toBeVisible();
          await expect(
            viewer.getByRole("img", {
              name: t("Original invoice image", "تصویر اصل فاکتور"),
              exact: true,
            }),
          ).toBeVisible();
          await viewer.locator(".ui-dialog-header .ui-icon-button").click();
          await expect(viewer).not.toBeVisible();
        }
      }
      const after = await readCanonicalBusinessEvidence(page);
      expect(
        after.invoices!.find((invoice) => invoice.id === invoiceId),
      ).toEqual(source);
      expect(after.ledger).toEqual(before.ledger);
      expect(after.stock_movements).toEqual(before.stock_movements);
      expect(after.invoice_content_corrections).toEqual(
        before.invoice_content_corrections,
      );
      await root.locator('[data-posted-action="done"]').click();
      await expect(page).toHaveURL(/#invoices\?tab=posted$/);
      await expect(page.locator(".invoice-posted-list")).toBeVisible();
    });
