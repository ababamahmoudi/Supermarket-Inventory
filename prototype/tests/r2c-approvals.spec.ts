import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { chooseOption, openShellAction } from "./helpers";
import {
  importReceivingFixture,
  openReceivingLine,
  word,
} from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { inspect } from "../scripts/c5-browser-proof.mjs";
test.setTimeout(120000);
const source = fileURLToPath(
  new URL(
    "./fixtures/r2c-approval-fictional-readings-export.json",
    import.meta.url,
  ),
);
for (const language of ["en", "fa"] as const) {
  test(`R2c 4 approval rows, full editor and batch dialog in ${language}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const imported = await importReceivingFixture(
      page,
      language,
      undefined,
      undefined,
      source,
    );
    const reviewUrl = page.url();
    await page.goto("/#settings?group=catalog");
    await page
      .getByRole("navigation", {
        name: word(language, "Settings groups", "گروه‌های تنظیمات"),
        exact: true,
      })
      .getByRole("button", {
        name: word(language, "Catalog", "کاتالوگ"),
        exact: true,
      })
      .click();
    await page
      .locator(".settings-pricing-table tbody tr")
      .filter({ hasText: word(language, "Rice", "برنج") })
      .getByRole("button", {
        name: word(language, "Edit", "ویرایش"),
        exact: true,
      })
      .click();
    const categoryDialog = page.getByRole("dialog");
    await categoryDialog
      .getByRole("switch", {
        name: word(language, "Minimum margin active", "حداقل حاشیه سود فعال"),
        exact: true,
      })
      .check();
    await categoryDialog.locator("#category-minimum_margin").fill("0.30");
    await categoryDialog
      .getByRole("button", {
        name: word(language, "Apply category", "اعمال دسته"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: word(language, "Save changes", "ذخیره تغییرات"),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (
            await readCanonicalBusinessEvidence(page)
          ).config.pricing_categories.find((row) => row.key === "rice")
            ?.minimum_margin,
      )
      .toBe("0.30");
    await page.goto(reviewUrl);
    const expandDetails = page.getByRole("button", {
      name: word(language, "Expand invoice details", "باز کردن اطلاعات فاکتور"),
      exact: true,
    });
    if (await expandDetails.isVisible()) await expandDetails.click();

    await page
      .getByRole("button", {
        name: word(
          language,
          "Looks right: Invoice details",
          "درست است: اطلاعات فاکتور",
        ),
        exact: true,
      })
      .click();
    for (let index = 0; index < 3; index++) {
      const editor = await openReceivingLine(page, index);
      await chooseOption(
        page,
        editor.locator(`#invoice-line-${index}-category`),
        index === 0 ? "rice" : "grocery",
        word(
          language,
          index === 0 ? "Rice" : "Grocery",
          index === 0 ? "برنج" : "خواربار",
        ),
      );
      await editor
        .getByRole("button", {
          name: word(language, "Confirm line", "تأیید ردیف"),
          exact: true,
        })
        .click();
      await expect(editor).toHaveCount(0);
    }
    await page
      .getByRole("button", {
        name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
        exact: true,
      })
      .click();
    const post = page
      .locator(".receiving-post-control:visible")
      .getByRole("button");
    await expect(post).toBeEnabled();
    await post.click();
    await page
      .getByRole("dialog", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .getByRole("button", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .click();
    await expect(page.locator(".posted-receiving")).toBeVisible();
    await page.goto("/#approvals");
    await expect(page.locator(".approval-detail-row")).toHaveCount(3);
    const before = await readCanonicalBusinessEvidence(page);
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"] as const) {
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
        const report = await inspect(
          page,
          "R2c Approvals",
          `${language}-${theme}`,
          "owner",
        );
        expect(report.failures).toEqual([]);
        const rows = page.locator(".approval-detail-row");
        if (theme === "light" && (width === 1440 || width === 390)) {
          const firstAction = rows
            .first()
            .locator(".approval-decision-actions > button")
            .first();
          const oldStyle = await firstAction.getAttribute("style");
          await firstAction.evaluate((element) => {
            element.style.blockSize = "32px";
            element.style.minBlockSize = "32px";
          });
          expect(
            (
              await inspect(
                page,
                "R2c approval 32px negative control",
                `${language}-${theme}`,
                "owner",
              )
            ).failures.some((failure: string) =>
              failure.startsWith("Text action height:"),
            ),
          ).toBe(true);
          await firstAction.evaluate((element, style) => {
            if (style === null) element.removeAttribute("style");
            else element.setAttribute("style", style);
          }, oldStyle);
          const oldType = await rows.first().getAttribute("data-approval-type");
          await rows.first().evaluate((element) => {
            element.setAttribute("data-approval-type", "invalid-composition");
          });
          expect(
            (
              await inspect(
                page,
                "R2c approval composition negative control",
                `${language}-${theme}`,
                "owner",
              )
            ).failures,
          ).toContain(
            "Approval decision row needs its exact ordered, aligned actions",
          );
          await rows.first().evaluate((element, type) => {
            if (type === null) element.removeAttribute("data-approval-type");
            else element.setAttribute("data-approval-type", type);
          }, oldType);
          expect(
            (
              await inspect(
                page,
                "R2c restored approval row",
                `${language}-${theme}`,
                "owner",
              )
            ).failures,
          ).toEqual([]);
        }
        for (const row of await rows.all()) {
          const actions = row.locator(".approval-decision-actions > button");
          await expect(actions).toHaveCount(3);
          const bounds = await actions.evaluateAll((nodes) =>
            nodes.map((node) => {
              const b = node.getBoundingClientRect();
              return { x: b.x, y: b.y, right: b.right, h: b.height };
            }),
          );
          for (const box of bounds) {
            expect(box.h).toBe(44);
            expect(Math.abs(box.y - bounds[0].y)).toBeLessThanOrEqual(2);
          }
          const sorted = [...bounds].sort((a, b) => a.x - b.x);
          for (let i = 1; i < sorted.length; i++)
            expect(sorted[i].x - sorted[i - 1].right).toBeGreaterThanOrEqual(7);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: info.outputPath(`approvals-${language}-${width}-${theme}.png`),
          fullPage: true,
        });
        const editAction = rows.last().getByRole("button", {
          name: word(language, "Edit and approve", "ویرایش و تأیید"),
          exact: true,
        });
        await editAction.scrollIntoViewIfNeeded();
        const editScroll = await page.evaluate(() => window.scrollY);
        if (width === 390) expect(editScroll).toBeGreaterThan(100);
        await editAction.click();
        const editor = page.getByRole("dialog", {
          name: word(language, "Edit and approve", "ویرایش و تأیید"),
          exact: true,
        });
        await expect(editor).toBeVisible();
        await expect(
          editor.getByLabel(
            word(
              language,
              "Supplier code (optional)",
              "کد تأمین‌کننده (اختیاری)",
            ),
            { exact: true },
          ),
        ).toBeVisible();
        expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
        expect(
          (
            await inspect(
              page,
              "R2c full approval editor",
              `${language}-${theme}`,
              "owner",
            )
          ).failures,
        ).toEqual([]);
        await editor.screenshot({
          path: info.outputPath(
            `approval-editor-${language}-${width}-${theme}.png`,
          ),
        });
        await editor
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
        await expect
          .poll(async () =>
            Math.abs((await page.evaluate(() => window.scrollY)) - editScroll),
          )
          .toBeLessThanOrEqual(2);
        const group = page.getByTestId(`invoice-approval-group-${imported.id}`);
        await group
          .getByRole("button", { name: /^(Approve all 3|تأیید همهٔ 3)/ })
          .click();
        const batch = page.getByRole("dialog", {
          name: word(
            language,
            "Review invoice approvals",
            "بررسی تأییدهای فاکتور",
          ),
          exact: true,
        });
        await expect(batch.getByRole("checkbox")).toHaveCount(4);
        await expect(batch.locator(".batch-below-minimum")).toHaveCount(1);
        await expect(batch.locator(".batch-category").first()).toHaveText(
          word(language, "Rice", "برنج"),
        );
        const rowPaint = await batch.locator("tbody").evaluate((body) => {
          const rows = [...body.querySelectorAll("tr")];
          return {
            warning: getComputedStyle(rows[0]).backgroundColor,
            normal: getComputedStyle(rows[1]).backgroundColor,
            cells: rows.flatMap((row) =>
              [...row.querySelectorAll("td")].map(
                (cell) => getComputedStyle(cell).backgroundColor,
              ),
            ),
          };
        });
        expect(rowPaint.warning).not.toBe(rowPaint.normal);
        expect(
          rowPaint.cells.every((color) => color === "rgba(0, 0, 0, 0)"),
        ).toBe(true);
        await expect(
          batch.locator(".table-row-link,.table-details-toggle"),
        ).toHaveCount(0);
        const selectAll = batch.getByRole("checkbox", {
          name: word(language, "Select all products", "انتخاب همهٔ کالاها"),
          exact: true,
        });
        await expect(selectAll).toBeChecked();
        await selectAll.uncheck();
        await expect(
          batch.locator(".ui-dialog-footer > .button-primary"),
        ).toBeDisabled();
        await selectAll.check();
        await expect(
          batch.locator(".ui-dialog-footer > .button-primary"),
        ).toBeEnabled();
        const geometry = await batch.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const body = element.querySelector(".invoice-approval-table-wrap")!;
          return {
            x: rect.x,
            right: rect.right,
            overflow: body.scrollWidth - body.clientWidth,
            headerSize: getComputedStyle(element.querySelector("h2")!).fontSize,
          };
        });
        expect(geometry.x).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(width);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.headerSize).toBe("20px");
        await batch.screenshot({
          path: info.outputPath(
            `invoice-approval-${language}-${width}-${theme}.png`,
          ),
        });
        await batch
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
        expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
      }
    }
    const saveAction = page
      .locator(".approval-detail-row")
      .first()
      .getByRole("button", {
        name: word(language, "Edit and approve", "ویرایش و تأیید"),
        exact: true,
      });
    await saveAction.scrollIntoViewIfNeeded();
    const saveScroll = await page.evaluate(() => window.scrollY);
    await saveAction.click();
    const edit = page.getByRole("dialog", {
      name: word(language, "Edit and approve", "ویرایش و تأیید"),
      exact: true,
    });
    await edit
      .getByLabel(word(language, "Unit size", "اندازهٔ واحد"), { exact: true })
      .fill("1 kg");
    await edit
      .getByLabel(word(language, "English name", "نام انگلیسی"), {
        exact: true,
      })
      .fill("Edited Everpine Test Rice");
    await chooseOption(
      page,
      edit.getByLabel(word(language, "Pricing category", "دستهٔ قیمت‌گذاری"), {
        exact: true,
      }),
      "grocery",
      word(language, "Grocery", "مواد غذایی"),
    );
    const price = edit.getByLabel(
      word(language, "Selling price (per unit)", "قیمت فروش (هر واحد)"),
      { exact: true },
    );
    await expect(price).toHaveValue("2.99");
    await price.fill("3.99");
    await edit
      .getByLabel(
        word(language, "Supplier code (optional)", "کد تأمین‌کننده (اختیاری)"),
        { exact: true },
      )
      .fill("EV-EDITED");
    await chooseOption(
      page,
      edit.getByLabel(word(language, "Taxable", "مشمول مالیات"), {
        exact: true,
      }),
      "yes",
      word(language, "Yes", "بله"),
    );
    await edit
      .getByLabel(word(language, "Reason (required)", "دلیل (الزامی)"), {
        exact: true,
      })
      .fill("Independent fictional price and product correction.");
    await edit
      .getByRole("button", {
        name: word(language, "Save and approve", "ذخیره و تأیید"),
        exact: true,
      })
      .click();
    await expect(edit).toHaveCount(0);
    await expect(page.locator(".approval-detail-row")).toHaveCount(2);
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.scrollY)) - saveScroll),
      )
      .toBeLessThanOrEqual(2);
    const afterEdit = await readCanonicalBusinessEvidence(page);
    const saved = afterEdit.products.find(
      (product) => product.name_en === "Edited Everpine Test Rice",
    )!;
    expect(saved).toMatchObject({
      pricing_category: "grocery",
      taxable: true,
      status: "active",
      selling_price: "3.99",
    });
    expect(
      afterEdit.supplier_items?.some(
        (item) =>
          item.product_code === saved.code &&
          item.supplier_item_code === "EV-EDITED",
      ),
    ).toBe(true);
    expect(
      afterEdit.activity.filter(
        (item) => item.action === "Edit and approve product",
      ),
    ).toHaveLength(1);
    expect(afterEdit.invoice).toEqual(before.invoice);
    expect(afterEdit.invoices).toEqual(before.invoices);
    expect(afterEdit.ledger).toEqual(before.ledger);
    expect(afterEdit.stock_movements).toEqual(before.stock_movements);
    await page
      .getByTestId(`invoice-approval-group-${imported.id}`)
      .getByRole("button", { name: /^(Approve all 2|تأیید همهٔ 2)/ })
      .click();
    const batch = page.getByRole("dialog", {
      name: word(language, "Review invoice approvals", "بررسی تأییدهای فاکتور"),
      exact: true,
    });
    await batch.locator("tbody").getByRole("checkbox").last().uncheck();
    await batch
      .getByRole("button", {
        name: word(language, "Approve 1 product", "تأیید 1 کالا"),
        exact: true,
      })
      .click();
    await expect(batch).toHaveCount(0);
    await expect(page.locator(".approval-detail-row")).toHaveCount(1);
    const final = await readCanonicalBusinessEvidence(page);
    expect(
      final.approvals.filter((item) => item.status === "approved"),
    ).toHaveLength(2);
    expect(
      final.approvals.filter((item) => item.status === "pending"),
    ).toHaveLength(1);
    expect(final.ledger).toEqual(before.ledger);
    expect(final.stock_movements).toEqual(before.stock_movements);
    expect(errors).toEqual([]);
  });
}
