import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  signIn,
  setBranch,
  setLanguage,
  openShellAction,
  chooseOption,
} from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { auditR2fAlignment } from "./r2f-alignment";

async function fixture(page: Page) {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await runCanonicalBusinessFixture(
    page,
    (draft) => {
      const parent = draft.products.find((product) => product.code === "0016")!;
      Object.assign(parent, { unit_size: "", date_tracking: false });
    },
    null,
  );
  await page.reload();
}
async function openEditor(page: Page, language: "en" | "fa") {
  await page.goto("/#products");
  await page.locator(".catalog-filter-toolbar input").first().fill("0016");
  const phone = (await page.evaluate(() => innerWidth)) <= 760;
  if (phone) {
    await page
      .locator('.catalog-products-table a[href="#product?code=0016"]')
      .first()
      .click();
  }
  const edit = page
    .locator(phone ? ".product-header-actions" : ".catalog-products-table")
    .getByRole("button", { name: /^(Edit |ویرایش )/ })
    .first();
  await expect(edit).toBeVisible();
  await edit.click();
  const dialog = page.getByRole("dialog", {
    name: language === "en" ? "Edit product" : "ویرایش محصول",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: language === "en" ? "Save product" : "ذخیرهٔ محصول",
      exact: true,
    }),
  ).toBeEnabled();
  return dialog;
}
async function stable(control: Locator, action: () => Promise<void>) {
  await control.scrollIntoViewIfNeeded();
  const before = await control.boundingBox();
  expect(before).not.toBeNull();
  await action();
  const movement = await control.evaluate(async (element, original) => {
    let maximum = 0;
    for (let frame = 0; frame < 6; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const current = element.getBoundingClientRect();
      maximum = Math.max(
        maximum,
        Math.abs(original!.x - current.x),
        Math.abs(original!.y - current.y),
      );
    }
    return maximum;
  }, before);
  expect(movement).toBeLessThanOrEqual(2);
}

for (const width of [360, 390, 509, 760, 1440]) {
  for (const [language, theme] of [
    ["en", "light"],
    ["fa", "dark"],
  ] as const) {
    test(`R2g C1 weight editor ${width} ${language} ${theme}${width === 509 ? " @r2g-509" : ""}`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await fixture(page);
      await setLanguage(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await (
          await openShellAction(
            page,
            language === "en" ? `Switch to ${theme} theme` : "تغییر به تم تیره",
          )
        ).click();
      }
      const before = await readCanonicalBusinessEvidence(page);
      const dialog = await openEditor(page, language);
      await page.evaluate(() => document.fonts.ready);
      const titleGeometry = await dialog.evaluate((element) => {
        const caption = element.querySelector(".product-editor-caption")!;
        const title = element.querySelector(".product-editor-section-title")!;
        const field = element.querySelector(".field")!;
        return {
          align: getComputedStyle(element).textAlign,
          titleAlign: getComputedStyle(title).textAlign,
          fieldAlign: getComputedStyle(field).textAlign,
          captionBottom: caption.getBoundingClientRect().bottom,
          titleTop: title.getBoundingClientRect().top,
          viewportOverflow: document.documentElement.scrollWidth - innerWidth,
          dialogWidth: element.getBoundingClientRect().width,
        };
      });
      expect(titleGeometry.align).toBe("start");
      expect(titleGeometry.titleAlign).toBe("start");
      expect(titleGeometry.fieldAlign).toBe("start");
      expect(titleGeometry.titleTop).toBeGreaterThanOrEqual(
        titleGeometry.captionBottom,
      );
      expect(titleGeometry.viewportOverflow).toBeLessThanOrEqual(1);
      expect(titleGeometry.dialogWidth).toBeLessThanOrEqual(width);
      const englishName = dialog.getByRole("textbox", {
        name: language === "en" ? "English name" : "نام انگلیسی",
        exact: true,
      });
      await stable(englishName, () =>
        englishName.fill(
          "Fictional Orchard Roasted Kernels With Sea Salt and a Long English Product Name",
        ),
      );
      const empty = dialog.locator(".weight-package-empty");
      expect(
        await empty.evaluate((element) => getComputedStyle(element).textAlign),
      ).toBe("start");
      const cost = dialog.getByRole("textbox", {
        name: language === "en" ? "Cost before tax" : "هزینه پیش از مالیات",
        exact: true,
      });
      await stable(cost, () => cost.fill("4.7312"));
      await expect(
        dialog.locator(".weight-product-cost + .weight-product-price-preview"),
      ).toHaveText(
        language === "en" ? "= $10.43 per kg" : "= $10.43 هر کیلوگرم",
      );
      const newSize = dialog.getByRole("textbox", {
        name: language === "en" ? "New size" : "اندازه جدید",
        exact: true,
      });
      await stable(newSize, () => newSize.fill("250"));
      await chooseOption(
        page,
        dialog.getByRole("combobox", {
          name: language === "en" ? "Package unit" : "واحد بسته",
          exact: true,
        }),
        "g",
      );
      const add = dialog.getByRole("button", {
        name: language === "en" ? "Add size" : "افزودن اندازه",
        exact: true,
      });
      await stable(add, () => add.click());
      const tags = dialog.locator(
        '[data-package-code="staged"] .weight-package-new',
      );
      await expect(tags).toHaveText(
        language === "en" ? ["New", "New"] : ["جدید", "جدید"],
      );
      for (const tag of await tags.all()) {
        const geometry = await tag.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(element).lineHeight),
          whiteSpace: getComputedStyle(element).whiteSpace,
        }));
        expect(geometry.whiteSpace).toBe("nowrap");
        expect(geometry.height).toBeLessThanOrEqual(geometry.line + 12);
      }
      await dialog
        .locator(".weight-product-optional-details > summary")
        .click();
      await expect(
        dialog.getByRole("textbox", { name: /^(Unit size|اندازهٔ واحد)$/ }),
      ).toHaveCount(0);
      const gap = await dialog.evaluate((element) => {
        const descriptions = element.querySelector(
          ".weight-product-optional-details .product-editor-description-row",
        )!;
        const dates = element.querySelector(
          ".weight-product-optional-details .product-date-editor",
        )!;
        return (
          dates.getBoundingClientRect().top -
          descriptions.getBoundingClientRect().bottom
        );
      });
      expect(gap).toBeGreaterThanOrEqual(15);
      expect(gap).toBeLessThanOrEqual(17);
      const alignment = await auditR2fAlignment(page, { scene: "D3" });
      await info.attach("r2g-c1-geometry", {
        body: JSON.stringify({ titleGeometry, gap, alignment }, null, 2),
        contentType: "application/json",
      });
      expect(alignment.failures).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`r2g-c1-${width}-${language}-${theme}.png`),
      });
      await dialog
        .getByRole("button", {
          name: language === "en" ? "Cancel" : "انصراف",
          exact: true,
        })
        .click();
      const after = await readCanonicalBusinessEvidence(page);
      expect(after.products).toEqual(before.products);
      expect(after.approvals).toEqual(before.approvals);
      expect(after.product_code_high_water).toBe(
        before.product_code_high_water,
      );
      expect(errors).toEqual([]);
    });
  }
}

test("R2g C1 saving a real weight draft does not demand hidden Unit size", async ({
  page,
}) => {
  await fixture(page);
  const before = await readCanonicalBusinessEvidence(page);
  const dialog = await openEditor(page, "en");
  await dialog
    .getByRole("textbox", { name: "English name", exact: true })
    .fill("Fictional renamed kernels");
  await dialog
    .getByRole("textbox", { name: "New size", exact: true })
    .fill("250");
  await dialog.getByRole("button", { name: "Add size", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const saved = await readCanonicalBusinessEvidence(page);
  const parent = saved.products.find((product) => product.code === "0016")!;
  expect(parent.unit_size).toBe("");
  expect(parent.name_en).toBe("Fictional renamed kernels");
  const child = saved.products.find(
    (product) => product.package_of_product_id === parent.code,
  )!;
  expect(child.package_size).toBe("250");
  expect(child.code).not.toBe("staged");
  expect(child.barcode).toMatch(/^20\d{11}$/);
  expect(saved.invoices).toEqual(before.invoices);
  expect(saved.ledger).toEqual(before.ledger);
});
