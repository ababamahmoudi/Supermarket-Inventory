import { expect, test, type Locator } from "@playwright/test";
import Decimal from "decimal.js";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { signIn, setBranch, setLanguage, openShellAction } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import fixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };

const invoiceId = `a2-fixture:${fixtures.invoices[0].number}`;

async function correctionGeometry(dialog: Locator) {
  return dialog.evaluate((element) => {
    const bounds = (target: Element) => {
      const rect = target.getBoundingClientRect();
      return {
        x: rect.x,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const header = element.querySelector(":scope > .ui-dialog-header")!;
    const body = element.querySelector(":scope > .ui-dialog-body")!;
    const footer = element.querySelector(":scope > .ui-dialog-footer")!;
    const editor = element.querySelector(".receiving-line-editor");
    const product = editor?.querySelector(".receiving-product-section");
    const quantity = editor?.querySelector(".receiving-quantity-section");
    const table = element.querySelector(".receiving-lines-table")!;
    const title = header.querySelector("h2");
    const titleId = element.getAttribute("aria-labelledby");
    const close = header.querySelector(
      "button.ui-icon-button[data-control-kind='icon']",
    );
    const css = getComputedStyle(element);
    return {
      genuine:
        element instanceof HTMLDialogElement &&
        element.open &&
        element.matches(
          ".ui-dialog.ui-dialog-structured.invoice-correction-dialog",
        ) &&
        Boolean(element.getAttribute("data-dialog-feedback-scope")) &&
        Boolean(titleId && document.getElementById(titleId) === title) &&
        ["Correct invoice", "اصلاح فاکتور"].includes(
          title?.textContent?.trim() ?? "",
        ) &&
        ["Close dialog", "بستن پنجره"].includes(
          close?.getAttribute("aria-label") ?? "",
        ) &&
        Boolean(close?.querySelector("svg.lucide-x")) &&
        Boolean(body.querySelector(":scope > .invoice-correction-form")) &&
        Boolean(body.querySelector("#invoice-correction-reason")) &&
        footer.querySelectorAll(
          ":scope > button.ui-button[data-control-kind='action']",
        ).length === 2,
      dialog: bounds(element),
      radii: [
        css.borderTopLeftRadius,
        css.borderTopRightRadius,
        css.borderBottomLeftRadius,
        css.borderBottomRightRadius,
      ].map(parseFloat),
      dialogRadius: parseFloat(css.getPropertyValue("--radius-dialog")),
      header: { ...bounds(header), display: getComputedStyle(header).display },
      body: { ...bounds(body), overflow: getComputedStyle(body).overflowY },
      footer: { ...bounds(footer), display: getComputedStyle(footer).display },
      editor: editor ? bounds(editor) : null,
      product: product ? bounds(product) : null,
      quantity: quantity ? bounds(quantity) : null,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      tableOverflow: table.scrollWidth - table.clientWidth,
    };
  });
}

function correctionGeometryFailures(
  geometry: Awaited<ReturnType<typeof correctionGeometry>>,
  width: number,
  open: boolean,
) {
  const failures: string[] = [];
  const phone = width <= 760;
  if (!geometry.genuine)
    failures.push(
      "The correction frame must belong to the actual managed native correction dialog",
    );
  const expectedWidth = phone ? width : Math.min(1100, width - 32);
  if (Math.abs(geometry.dialog.width - expectedWidth) > 1)
    failures.push(
      "The correction dialog must use its bounded composition width",
    );
  if (geometry.dialog.x < -1 || geometry.dialog.right > width + 1)
    failures.push("The correction dialog must stay inside the viewport");
  if (geometry.documentOverflow > 1 || geometry.tableOverflow > 1)
    failures.push("The correction page and table must not scroll horizontally");
  if (phone) {
    if (
      Math.abs(geometry.dialog.x) > 1 ||
      Math.abs(geometry.dialog.bottom - geometry.viewport.height) > 1 ||
      geometry.dialog.top < -1 ||
      geometry.dialog.height > geometry.viewport.height + 1
    )
      failures.push("The phone correction sheet must meet the viewport edges");
    const expectedRadii = open
      ? [0, 0, 0, 0]
      : [geometry.dialogRadius, geometry.dialogRadius, 0, 0];
    if (
      geometry.radii.some(
        (radius, index) => Math.abs(radius - expectedRadii[index]) > 1,
      )
    )
      failures.push(
        "The phone correction sheet must retain its actual frame corners",
      );
  }
  if (phone && open) {
    if (
      Math.abs(geometry.dialog.top) > 1 ||
      Math.abs(geometry.dialog.height - geometry.viewport.height) > 1 ||
      !geometry.editor ||
      Math.abs(geometry.editor.x) > 1 ||
      Math.abs(geometry.editor.top) > 1 ||
      Math.abs(geometry.editor.width - width) > 1 ||
      Math.abs(geometry.editor.height - geometry.viewport.height) > 1
    )
      failures.push("The phone correction editor must fill the viewport");
    if (
      geometry.header.display !== "none" ||
      geometry.footer.display !== "none"
    )
      failures.push("The phone editor must use only its own header and footer");
  } else {
    if (Math.abs(geometry.footer.bottom - geometry.dialog.bottom) > 1)
      failures.push("The correction footer must stay at the dialog bottom");
    if (
      geometry.body.top < geometry.header.bottom - 1 ||
      geometry.body.bottom > geometry.footer.top + 1 ||
      geometry.footer.top < geometry.header.bottom
    )
      failures.push(
        "The correction body must stay between its header and footer",
      );
    if (geometry.body.overflow !== "auto")
      failures.push("The bounded correction body must remain scrollable");
    if (open) {
      if (
        !geometry.product ||
        !geometry.quantity ||
        Math.abs(geometry.product.top - geometry.quantity.top) > 1 ||
        Math.max(
          geometry.quantity.x - geometry.product.right,
          geometry.product.x - geometry.quantity.right,
        ) < 20
      )
        failures.push(
          "The desktop editor sections must share a two-column row",
        );
    }
  }
  return failures;
}

for (const language of ["en", "fa"] as const)
  for (const width of [1440, 1000, 390])
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
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        expect(
          correctionGeometryFailures(
            await correctionGeometry(dialog),
            width,
            false,
          ),
        ).toEqual([]);
        if (width <= 760) {
          const originalStyle = await dialog.getAttribute("style");
          try {
            await dialog.evaluate((element, frameWidth) => {
              element.style.inlineSize = `${frameWidth - 4}px`;
            }, width);
            expect(
              correctionGeometryFailures(
                await correctionGeometry(dialog),
                width,
                false,
              ),
            ).toContain(
              "The correction dialog must use its bounded composition width",
            );
          } finally {
            await dialog.evaluate((element, style) => {
              if (style === null) element.removeAttribute("style");
              else element.setAttribute("style", style);
            }, originalStyle);
          }
          try {
            await dialog.evaluate((element) => {
              element.style.translate = "0 -4px";
            });
            expect(
              correctionGeometryFailures(
                await correctionGeometry(dialog),
                width,
                false,
              ),
            ).toContain(
              "The phone correction sheet must meet the viewport edges",
            );
          } finally {
            await dialog.evaluate((element, style) => {
              if (style === null) element.removeAttribute("style");
              else element.setAttribute("style", style);
            }, originalStyle);
          }
          const close = dialog.locator(
            ":scope > .ui-dialog-header button.ui-icon-button",
          );
          try {
            await close.evaluate((button) =>
              button.setAttribute("data-control-kind", "counterfeit"),
            );
            expect(
              correctionGeometryFailures(
                await correctionGeometry(dialog),
                width,
                false,
              ),
            ).toContain(
              "The correction frame must belong to the actual managed native correction dialog",
            );
          } finally {
            await close.evaluate((button) =>
              button.setAttribute("data-control-kind", "icon"),
            );
          }
          expect(
            correctionGeometryFailures(
              await correctionGeometry(dialog),
              width,
              false,
            ),
          ).toEqual([]);
        }
        if (language === "en" && width === 1440 && theme === "light") {
          const originalStyle = await dialog.getAttribute("style");
          try {
            await dialog.evaluate((element) => {
              element.style.inlineSize = "560px";
            });
            expect(
              correctionGeometryFailures(
                await correctionGeometry(dialog),
                width,
                false,
              ),
            ).toContain(
              "The correction dialog must use its bounded composition width",
            );
          } finally {
            await dialog.evaluate((element, style) => {
              if (style === null) element.removeAttribute("style");
              else element.setAttribute("style", style);
            }, originalStyle);
          }
          const body = dialog.locator(":scope > .ui-dialog-body");
          const bodyStyle = await body.getAttribute("style");
          try {
            await body.evaluate((element) => {
              element.style.flex = "0 1 auto";
            });
            expect(
              correctionGeometryFailures(
                await correctionGeometry(dialog),
                width,
                false,
              ),
            ).toContain("The correction footer must stay at the dialog bottom");
          } finally {
            await body.evaluate((element, style) => {
              if (style === null) element.removeAttribute("style");
              else element.setAttribute("style", style);
            }, bodyStyle);
          }
          expect(
            correctionGeometryFailures(
              await correctionGeometry(dialog),
              width,
              false,
            ),
          ).toEqual([]);
        }
        await dialog.locator(".invoice-line-toggle").first().click();
        const editor = dialog.getByRole("region", {
          name: t("Line 1", "ردیف 1"),
          exact: true,
        });
        await expect(editor).toHaveClass(/ui-form-surface/);
        expect(
          correctionGeometryFailures(
            await correctionGeometry(dialog),
            width,
            true,
          ),
        ).toEqual([]);
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
        expect(
          correctionGeometryFailures(
            await correctionGeometry(dialog),
            width,
            false,
          ),
        ).toEqual([]);
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
