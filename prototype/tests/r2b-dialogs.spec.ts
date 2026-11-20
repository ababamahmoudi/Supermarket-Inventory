import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { expectReceivingStable, word } from "./r2-receiving-helpers";

function importBusinessEvidence(
  state: Awaited<ReturnType<typeof readCanonicalBusinessEvidence>>,
) {
  return {
    invoice: state.invoice,
    invoices: state.invoices,
    ledger: state.ledger,
    stock: state.stock,
    stock_movements: state.stock_movements,
    products: state.products,
    suppliers: state.suppliers,
    returns: state.returns,
  };
}

for (const language of ["en", "fa"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`R2b 4.1 empty-store confirmation in ${language} ${theme}`, async ({
      page,
    }, testInfo) => {
      const phone = testInfo.project.name === "phone";
      await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
      await signIn(page, "Owner");
      await setLanguage(page, language);
      if (theme === "dark")
        await (
          await openShellAction(
            page,
            word(language, "Switch to dark theme", "تغییر به تم تیره"),
          )
        ).click();
      await page.goto("/#settings?group=data");
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
      for (const width of phone ? [390] : [1440, 1000]) {
        await page.setViewportSize({ width, height: 900 });
        await page
          .getByRole("button", {
            name: word(
              language,
              "Remove fictional data…",
              "حذف داده‌های خیالی…",
            ),
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog", {
          name: word(
            language,
            "Start with an empty store",
            "شروع با فروشگاه خالی",
          ),
          exact: true,
        });
        const input = dialog.getByRole("textbox", {
          name: word(
            language,
            "Type DELETE to confirm",
            "برای تأیید حذف را بنویسید",
          ),
          exact: true,
        });
        const remove = dialog.getByRole("button", {
          name: word(language, "Remove fictional data", "حذف داده‌های خیالی"),
          exact: true,
        });
        await expect(remove).toBeDisabled();
        const restingFill = await input.evaluate((element) => {
          const probe = document.createElement("span");
          probe.style.backgroundColor = "var(--surface)";
          document.body.append(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            actual: getComputedStyle(element).backgroundColor,
            expected,
          };
        });
        expect(restingFill.actual).toBe(restingFill.expected);
        await input.focus();
        await input.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        const geometry = await dialog.evaluate((element) => {
          const body = element.querySelector(".ui-dialog-body")!;
          const input = element.querySelector("input")!;
          const label = element.querySelector("label")!;
          const footer = element.querySelector(".ui-dialog-footer")!;
          const bounds = element.getBoundingClientRect();
          const inputBounds = input.getBoundingClientRect();
          return {
            width: bounds.width,
            left: bounds.left,
            right: bounds.right,
            bodyClearance:
              body.getBoundingClientRect().bottom - inputBounds.bottom,
            footerClearance:
              footer.getBoundingClientRect().top - inputBounds.bottom,
            labelSize: getComputedStyle(label).fontSize,
            labelWeight: getComputedStyle(label).fontWeight,
            phraseWeight: getComputedStyle(label.querySelector("strong")!)
              .fontWeight,
            listRows: Array.from(
              element.querySelectorAll(".invoice-empty-lists li > span"),
              (item) => ({
                height: item.getBoundingClientRect().height,
                lineHeight: parseFloat(getComputedStyle(item).lineHeight),
              }),
            ),
          };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(width);
        if (!phone) {
          expect(geometry.width).toBeGreaterThanOrEqual(600);
          for (const row of geometry.listRows)
            expect(row.height).toBeLessThanOrEqual(row.lineHeight + 1);
        }
        expect(geometry.bodyClearance).toBeGreaterThanOrEqual(4);
        expect(geometry.footerClearance).toBeGreaterThanOrEqual(4);
        expect(geometry.labelSize).toBe("13px");
        expect(Number(geometry.labelWeight)).toBeGreaterThanOrEqual(600);
        expect(Number(geometry.phraseWeight)).toBeGreaterThanOrEqual(700);
        const disabledStyle = await remove.evaluate((element) => {
          const style = getComputedStyle(element);
          const probe = document.createElement("span");
          probe.style.backgroundColor = "var(--danger)";
          document.body.append(probe);
          const danger = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            fill: style.backgroundColor,
            opacity: Number(style.opacity),
            danger,
          };
        });
        expect(disabledStyle.fill).toBe(disabledStyle.danger);
        expect(disabledStyle.opacity).toBeGreaterThan(0);
        expect(disabledStyle.opacity).toBeLessThan(1);
        await dialog.screenshot({
          path: testInfo.outputPath(`empty-store-${width}.png`),
        });
        await expectReceivingStable(page, remove, () =>
          input.fill(word(language, "DELETE", "حذف")),
        );
        await expect(remove).toBeEnabled();
        expect(
          await remove.evaluate((element) => getComputedStyle(element).opacity),
        ).toBe("1");
        await dialog
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
        await expect(dialog).toHaveCount(0);
      }
    });
  }
}

for (const language of ["en", "fa"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`R2b 4.2 import preview has one status and ordinary fields in ${language} ${theme}`, async ({
      page,
    }, testInfo) => {
      const phone = testInfo.project.name === "phone";
      await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
      await signIn(page, "Owner");
      // With no printed branch hint and All locations, the real import needs a choice.
      await setBranch(page, "all");
      const beforePreview = importBusinessEvidence(
        await readCanonicalBusinessEvidence(page),
      );
      await setLanguage(page, language);
      if (theme === "dark")
        await (
          await openShellAction(
            page,
            word(language, "Switch to dark theme", "تغییر به تم تیره"),
          )
        ).click();
      await page.goto("/#settings?group=data");
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
      const fixturePath = new URL(
        "./fixtures/r2-fictional-readings-export.json",
        import.meta.url,
      );
      const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
      const entry = fixture.invoices[1];
      entry.checked_answer = structuredClone(entry.ai_reading);
      fixture.invoices = [entry];
      const file = page.getByLabel(
        word(language, "Choose file…", "انتخاب فایل…"),
        { exact: true },
      );
      const dialog = page.getByRole("dialog", {
        name: word(language, "Import invoice readings", "ورود خوانش فاکتورها"),
        exact: true,
      });
      const widths = phone ? [390] : [1440, 1000];
      for (const [widthIndex, width] of widths.entries()) {
        await page.setViewportSize({ width, height: 900 });
        await file.setInputFiles({
          name: "fictional-preview.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(fixture)),
        });
        await expect(dialog).toBeVisible();
        const row = dialog.locator(
          'tr[data-import-id="fictional-r2-complete"]',
        );
        const status = row.locator(".invoice-import-status");
        const location = row.getByRole("combobox");
        await expect(location).toBeVisible();
        await expect(location).toHaveText(
          word(language, "Choose a location…", "یک مکان انتخاب کنید…"),
        );
        await expect(location).toHaveAttribute("aria-invalid", "true");
        await expect(status).toHaveText(
          word(language, "Choose a location", "یک مکان انتخاب کنید"),
        );
        await expect(
          dialog.getByRole("button", {
            name: word(language, "Import 1 invoice", "ورود 1 فاکتور"),
            exact: true,
          }),
        ).toBeDisabled();
        const invalidColor = await location.evaluate((element) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--danger)";
          document.body.append(probe);
          const expected = getComputedStyle(probe).color;
          probe.remove();
          return { actual: getComputedStyle(element).borderTopColor, expected };
        });
        expect(invalidColor.actual).toBe(invalidColor.expected);
        expect(
          importBusinessEvidence(await readCanonicalBusinessEvidence(page)),
        ).toEqual(beforePreview);
        await location.click();
        await expect(
          page.getByRole("option", {
            name: word(language, "Choose a location…", "یک مکان انتخاب کنید…"),
            exact: true,
          }),
        ).toHaveCount(0);
        await page
          .getByRole("option", {
            name: word(language, "North York", "نورث یورک"),
            exact: true,
          })
          .click();
        await expect(location).toHaveAttribute("aria-invalid", "false");
        await expect(status).toContainText(word(language, "Ready", "آماده"));
        await expect(status.locator(".badge")).toHaveCount(1);
        const number = row.getByText("R2-FICTIONAL-025", { exact: true });
        await expect(number).toBeVisible();
        const numberLines = await number.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set(Array.from(range.getClientRects(), (rect) => rect.top))
            .size;
        });
        expect(numberLines).toBe(1);
        if (!phone)
          await expect(
            dialog.getByRole("columnheader", {
              name: word(language, "Status", "وضعیت"),
              exact: true,
            }),
          ).toBeVisible();
        if (!phone) {
          const headings = await dialog
            .getByRole("columnheader")
            .evaluateAll((elements) =>
              elements
                .filter((element) => element.textContent?.trim())
                .map((element) => {
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  const text = range.getBoundingClientRect();
                  const cell = element.getBoundingClientRect();
                  return {
                    left: text.left - cell.left,
                    right: cell.right - text.right,
                  };
                }),
            );
          for (const heading of headings) {
            expect(heading.left).toBeGreaterThanOrEqual(0);
            expect(heading.right).toBeGreaterThanOrEqual(0);
          }
        }
        await expect(
          dialog.getByRole("button", {
            name: word(language, "Import 1 invoice", "ورود 1 فاکتور"),
            exact: true,
          }),
        ).toBeEnabled();
        await expect(
          dialog.getByText(
            word(language, "Checked by you", "بررسی‌شده توسط شما"),
            { exact: true },
          ),
        ).toHaveCount(0);
        await expect(
          dialog.locator(".invoice-readings-mode-help"),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await dialog.getByRole("heading").click();
        const field = await location.evaluate((element) => {
          const style = getComputedStyle(element);
          const probe = document.createElement("span");
          probe.style.borderColor = "var(--field-border)";
          probe.style.backgroundColor = "var(--surface)";
          document.body.append(probe);
          const expected = getComputedStyle(probe);
          const result = {
            height: element.getBoundingClientRect().height,
            border: style.borderTopWidth,
            outline: style.outlineStyle,
            color: style.borderTopColor,
            expectedColor: expected.borderTopColor,
            fill: style.backgroundColor,
            expectedFill: expected.backgroundColor,
          };
          probe.remove();
          return result;
        });
        expect(field.height).toBe(44);
        expect(field.border).toBe("1px");
        expect(field.outline).toBe("none");
        expect(field.color).toBe(field.expectedColor);
        expect(field.fill).toBe(field.expectedFill);
        await location.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(location).toBeFocused();
        expect(
          await location.evaluate((element) => ({
            style: getComputedStyle(element).outlineStyle,
            width: getComputedStyle(element).outlineWidth,
          })),
        ).toEqual({ style: "solid", width: "2px" });
        await dialog.getByRole("heading").click();
        const dimensions = await dialog
          .locator(".invoice-reading-thumbnail")
          .evaluateAll((images) =>
            images.map((image) => {
              const r = image.getBoundingClientRect();
              return {
                width: r.width,
                height: r.height,
                fit: getComputedStyle(image).objectFit,
              };
            }),
          );
        expect(dimensions.length).toBe(1);
        expect(dimensions[0]).toEqual({
          width: 56,
          height: 72,
          fit: "contain",
        });
        const badge = await status.locator(".badge").evaluate((element) => {
          const dot = element.querySelector(".ui-status-dot")!;
          const text = Array.from(element.childNodes).find(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          )!;
          const range = document.createRange();
          range.selectNodeContents(text);
          const textBounds = range.getBoundingClientRect();
          const dotBounds = dot.getBoundingClientRect();
          return {
            text: element.textContent,
            clearance:
              getComputedStyle(dot).display === "none"
                ? null
                : getComputedStyle(element).direction === "rtl"
                  ? dotBounds.left - textBounds.right
                  : textBounds.left - dotBounds.right,
          };
        });
        if (badge.clearance !== null)
          expect(badge.clearance).toBeGreaterThanOrEqual(4);
        if (badge.text?.includes("·")) expect(badge.text).toContain(" · ");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width + 1);
        await dialog.screenshot({
          path: testInfo.outputPath(`import-preview-${width}.png`),
        });
        if (widthIndex < widths.length - 1) {
          await dialog
            .getByRole("button", {
              name: word(language, "Cancel", "انصراف"),
              exact: true,
            })
            .click();
          await expect(dialog).toHaveCount(0);
          expect(
            importBusinessEvidence(await readCanonicalBusinessEvidence(page)),
          ).toEqual(beforePreview);
        }
      }
      const checked = dialog.getByRole("button", {
        name: word(language, "My checked values", "مقادیر بررسی‌شدهٔ من"),
        exact: true,
      });
      const status = dialog.locator(".invoice-import-status");
      const before = await status.innerText();
      await expectReceivingStable(page, checked, async () => {
        await checked.click();
        await expect(status).not.toHaveText(before);
      });
      await dialog
        .getByRole("button", {
          name: word(language, "Cancel", "انصراف"),
          exact: true,
        })
        .click();
      expect(
        importBusinessEvidence(await readCanonicalBusinessEvidence(page)),
      ).toEqual(beforePreview);
      await file.setInputFiles(fixturePath.pathname);
      const duplicateRows = dialog.locator("tr[data-import-id]");
      await expect(duplicateRows).toHaveCount(2);
      for (const row of await duplicateRows.all()) {
        await expect(row.locator(".invoice-import-status .badge")).toHaveCount(
          1,
        );
        await expect(row.locator(".invoice-import-status")).toHaveText(
          word(
            language,
            "Same invoice twice in this file",
            "همین فاکتور دو بار در این فایل است",
          ),
        );
      }
      const images = await dialog
        .locator(".invoice-reading-thumbnail")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const r = element.getBoundingClientRect();
            return { width: r.width, height: r.height };
          }),
        );
      expect(images).toEqual([
        { width: 56, height: 72 },
        { width: 56, height: 72 },
      ]);
      await dialog
        .getByRole("button", {
          name: word(language, "Cancel", "انصراف"),
          exact: true,
        })
        .click();
      await expect(dialog).toHaveCount(0);
      expect(
        importBusinessEvidence(await readCanonicalBusinessEvidence(page)),
      ).toEqual(beforePreview);
    });
  }
}

test("R2b 4.2 changing source preserves a scrolled preview of many invoices", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "phone" ? 390 : 1000,
    height: 900,
  });
  await signIn(page, "Owner");
  await page.goto("/#settings?group=data");
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/r2-fictional-readings-export.json", import.meta.url),
      "utf8",
    ),
  );
  const template = fixture.invoices[1];
  fixture.invoices = Array.from({ length: 18 }, (_, index) => {
    const entry = structuredClone(template);
    entry.id = `fictional-preview-${index}`;
    entry.ai_reading.supplier_invoice_number = `PREVIEW-${index + 1}`;
    entry.checked_answer = structuredClone(entry.ai_reading);
    return entry;
  });
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles({
    name: "fictional-many-invoices.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const dialog = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await expect(dialog.locator(".invoice-import-status")).toHaveCount(18);
  await expect(
    dialog.getByRole("button", { name: "Import 18 invoices", exact: true }),
  ).toBeEnabled();
  const body = dialog.locator(".ui-dialog-body");
  expect(
    await body.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    ),
  ).toBeGreaterThan(100);
  await body.evaluate((element) => {
    element.scrollTop = 15;
  });
  const checked = dialog.getByRole("button", {
    name: "My checked values",
    exact: true,
  });
  await expect(checked).toBeInViewport({ ratio: 1 });
  const before = await dialog
    .locator(".invoice-import-status")
    .first()
    .innerText();
  await expectReceivingStable(
    page,
    checked,
    async () => {
      await checked.click();
      await expect(dialog.locator(".invoice-import-status")).toHaveCount(18);
      await expect(
        dialog.locator(".invoice-import-status").first(),
      ).not.toHaveText(before);
    },
    { scroll: false },
  );
  expect(await body.evaluate((element) => element.scrollTop)).toBe(15);
});
