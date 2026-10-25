import { expect, test } from "@playwright/test";
import Decimal from "decimal.js";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import fixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };

const invoiceId = `a2-fixture:${fixtures.invoices[0].number}`;
for (const language of ["en", "fa"] as const)
  for (const width of [1440, 390])
    test(`R2b 3.3 shared correction editor ${language} ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Owner");
      await setBranch(page, "all");
      await setLanguage(page, language);
      const t = (en: string, fa: string) => (language === "en" ? en : fa);
      await page.goto(`/#invoices?id=${encodeURIComponent(invoiceId)}`);
      const correct = page.getByRole("button", {
        name: t("Correct invoice", "اصلاح فاکتور"),
        exact: true,
      });
      await expect(correct).toBeVisible();
      const before = await readCanonicalBusinessEvidence(page);
      const original = before.invoices!.find((row) => row.id === invoiceId)!;
      const nextCost = new Decimal(original.lines[0].unit_cost_before_tax)
        .plus("0.5000")
        .toFixed(4);
      for (const theme of ["light", "dark"] as const) {
        if (theme === "dark")
          await (
            await openShellAction(
              page,
              t("Switch to dark theme", "تغییر به تم تیره"),
            )
          ).click();
        await correct.click();
        const dialog = page.getByRole("dialog", {
          name: t("Correct invoice", "اصلاح فاکتور"),
          exact: true,
        });
        await expect(dialog.locator(".receiving-line-editor")).toHaveCount(0);
        await expect(dialog.locator(".invoice-line-toggle")).toHaveCount(
          original.lines.length,
        );
        await expect(dialog.locator(".receiving-lines-table")).toBeVisible();
        await dialog.locator(".invoice-line-toggle").first().click();
        const editor = dialog.getByRole("region", {
          name: t("Line 1", "ردیف 1"),
          exact: true,
        });
        await expect(editor).toHaveClass(/ui-form-surface/);
        const quantity = editor.locator("#invoice-line-0-invoiced");
        const cost = editor.getByRole("textbox", {
          name: t("Unit cost before tax", "هزینه هر واحد پیش از مالیات"),
          exact: true,
        });
        for (const control of [quantity, cost]) {
          await expect(control).toHaveCSS("height", "44px");
          const fill = await control.evaluate((element) => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = "var(--surface)";
            element.parentElement!.appendChild(probe);
            const expected = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return {
              actual: getComputedStyle(element).backgroundColor,
              expected,
            };
          });
          expect(fill.actual).toBe(fill.expected);
        }
        for (const name of [
          t("Taxable", "مشمول مالیات"),
          t("Track date", "پیگیری تاریخ"),
        ]) {
          const group = editor.getByRole("group", { name, exact: true });
          await expect(group.getByRole("button")).toHaveText([
            t("No", "خیر"),
            t("Yes", "بله"),
          ]);
        }
        await quantity.scrollIntoViewIfNeeded();
        const quantityBox = await quantity.boundingBox();
        await quantity.fill("");
        await quantity.pressSequentially("20", { delay: 0 });
        await expect(quantity).toHaveValue("20");
        const afterTyping = await quantity.boundingBox();
        expect(Math.abs(afterTyping!.x - quantityBox!.x)).toBeLessThanOrEqual(
          2,
        );
        expect(Math.abs(afterTyping!.y - quantityBox!.y)).toBeLessThanOrEqual(
          2,
        );
        // Restore the retained physical quantity: this correction changes only cost.
        await quantity.fill(
          String(
            original.lines[0].quantity_entered ??
              original.lines[0].qty_invoiced,
          ),
        );
        await cost.scrollIntoViewIfNeeded();
        const costBox = await cost.boundingBox();
        await cost.fill(nextCost);
        await expect(cost).toHaveValue(nextCost);
        const afterCost = await cost.boundingBox();
        expect(Math.abs(afterCost!.x - costBox!.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(afterCost!.y - costBox!.y)).toBeLessThanOrEqual(2);
        await expect(
          editor.getByRole("button", {
            name: t("Remove line", "حذف ردیف"),
            exact: true,
          }),
        ).toBeDisabled();
        expect(
          (
            await inspect(
              page,
              "R2b correction editor",
              `${language}-${theme}`,
              "owner",
            )
          ).failures,
        ).toEqual([]);
        await editor
          .getByRole("button", { name: t("Close", "بستن"), exact: true })
          .last()
          .click();
        await expect(dialog.locator(".receiving-line-editor")).toHaveCount(0);
        const staged = await readCanonicalBusinessEvidence(page);
        expect(staged.invoices!.find((row) => row.id === invoiceId)).toEqual(
          original,
        );
        expect(staged.ledger).toEqual(before.ledger);
        expect(staged.stock_movements).toEqual(before.stock_movements);
        expect(staged.invoice_content_corrections ?? []).toEqual(
          before.invoice_content_corrections ?? [],
        );
        await dialog
          .getByRole("textbox", {
            name: t("Reason (required)", "دلیل (الزامی)"),
            exact: true,
          })
          .fill(
            "Review the fictional recorded cost against its retained original.",
          );
        await dialog
          .getByRole("button", {
            name: t("Preview correction", "پیش‌نمایش اصلاح"),
            exact: true,
          })
          .click();
        const difference = dialog.getByRole("region", {
          name: t("What will change", "چه چیزی تغییر می‌کند"),
          exact: true,
        });
        await expect(difference).toContainText(t("Unit cost", "هزینه واحد"));
        await expect(difference).toContainText(
          new Decimal(original.lines[0].unit_cost_before_tax).toFixed(4),
        );
        await expect(difference).toContainText(nextCost);
        await expect(difference).toContainText("→");
        if (theme === "light") {
          await page.keyboard.press("Escape");
        } else {
          await dialog
            .getByRole("button", { name: t("Continue", "ادامه"), exact: true })
            .click();
          await dialog
            .getByRole("button", {
              name: t("Confirm correction", "تأیید اصلاح"),
              exact: true,
            })
            .click();
          await expect(dialog).not.toBeVisible();
          const after = await readCanonicalBusinessEvidence(page);
          const correction = after.invoice_content_corrections!.at(-1)!;
          expect(correction.after.lines[0].unit_cost_before_tax).toBe(nextCost);
          expect(after.invoices!.find((row) => row.id === invoiceId)).toEqual(
            original,
          );
          expect(after.ledger.slice(0, before.ledger.length)).toEqual(
            before.ledger,
          );
          expect(after.stock_movements).toEqual(before.stock_movements);
          expect(after.ledger.at(-1)).toMatchObject({
            type: "adjustment",
            invoice_id: invoiceId,
            amount: correction.payable_delta,
          });
        }
      }
    });
