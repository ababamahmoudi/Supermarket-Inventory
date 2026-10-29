import { chooseC8Date } from "../scripts/capture-c8-proof.mjs";
import { auditR2fAlignment } from "./r2f-alignment";
import { expect, test, type Page, type Locator } from "@playwright/test";
import {
  signIn,
  setBranch,
  chooseOption,
  setLanguage,
  openShellAction,
} from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

export async function openWeightProductEditor(page: Page, code = "0016") {
  await page.goto(`/#product?code=${code}`);
  await expect(page.locator(".product-header-actions")).toBeVisible();
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: /^(Edit |ویرایش )/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: /^(Edit product|ویرایش محصول)$/,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".weight-product-price-main")).toContainText("$");
  return dialog;
}
export async function stageWeightPackage(
  page: Page,
  size: string,
  unit: "g" | "kg" | "lb" | "oz" = "g",
) {
  const dialog = page.getByRole("dialog", {
    name: /^(Edit product|ویرایش محصول|Package sizes|اندازه بسته‌ها)$/,
  });
  await dialog
    .getByRole("textbox", { name: /^(New size|اندازه جدید)$/ })
    .fill(size);
  await chooseOption(
    page,
    dialog.getByRole("combobox", { name: /^(Package unit|واحد بسته)$/ }),
    unit,
  );
  await dialog
    .getByRole("button", { name: /^(Add size|افزودن اندازه)$/ })
    .click();
}

test("R2f D3 stages costs and new sizes without writes on Cancel, then saves a real child atomically", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  const before = await readCanonicalBusinessEvidence(page);
  let dialog = await openWeightProductEditor(page);
  await dialog
    .getByRole("textbox", { name: "Cost before tax", exact: true })
    .fill("5.1000");
  await stageWeightPackage(page, "250");
  await expect(
    dialog.locator('[data-package-code="staged"] .weight-package-new'),
  ).toHaveText(["New", "New"]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const cancelled = await readCanonicalBusinessEvidence(page);
  expect(cancelled.products).toEqual(before.products);
  expect(cancelled.approvals).toEqual(before.approvals);
  expect(cancelled.product_code_high_water).toBe(
    before.product_code_high_water,
  );
  expect(cancelled.ledger).toEqual(before.ledger);
  dialog = await openWeightProductEditor(page);
  await stageWeightPackage(page, "250");
  await expect(dialog.locator(".weight-package-price")).toContainText("$4.49");
  await dialog
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(
    dialog.getByRole("alert").filter({ hasText: "Add an expiry date" }).first(),
  ).toBeVisible();
  const details = dialog.locator("details.weight-product-optional-details");
  if (
    !(await details.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await details.locator("summary").click();
  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: before.config.company.timezone,
  }).format(new Date(Date.now() + 86400000));
  await chooseC8Date(page, dialog.locator('[id$="-new-date"]'), tomorrow);
  await dialog
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const saved = await readCanonicalBusinessEvidence(page);
  const child = saved.products.find(
    (product) => product.package_of_product_id === "0016",
  );
  expect(child).toBeDefined();
  expect(child?.package_size).toBe("250");
  expect(child?.barcode).toMatch(/^20\d{11}$/);
  expect(child?.branch_prices?.["Branch 1"]).toBe("4.49");
  expect(
    saved.price_update_tasks?.filter(
      (item) => item.product_code === child!.code,
    ).length,
  ).toBeGreaterThan(0);
  expect(
    saved.label_waitlist?.filter((item) => item.product_code === child!.code)
      .length,
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("R2f D3 uses one canonical cost through lb/kg switches and stages explicit price changes", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  const dialog = await openWeightProductEditor(page);
  const cost = dialog.getByRole("textbox", {
    name: "Cost before tax",
    exact: true,
  });
  const original = await cost.inputValue();
  const segments = dialog.getByRole("group", { name: "Cost unit" });
  await segments.getByRole("button", { name: "per kg", exact: true }).click();
  await segments.getByRole("button", { name: "per lb", exact: true }).click();
  await expect(cost).toHaveValue(original);
  const before = await readCanonicalBusinessEvidence(page);
  await dialog
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const price = page.getByRole("dialog", { name: "Change price", exact: true });
  await expect(price).toBeVisible();
  await price.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await readCanonicalBusinessEvidence(page)).products).toEqual(
    before.products,
  );
});

test("R2f D3 actual Supervisor package-only creation, edit/archive and responsive alignment", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await signIn(page, "Branch Supervisor");
  await setBranch(page, "Branch 2");
  await page.goto("/#product?code=0016");
  await page
    .getByRole("button", { name: "Package sizes", exact: true })
    .click();
  let packages = page.getByRole("dialog", {
    name: "Package sizes",
    exact: true,
  });
  await expect(
    packages.getByRole("textbox", { name: "Cost before tax", exact: true }),
  ).toHaveCount(0);
  for (const size of ["100", "250", "500", "1000"])
    await stageWeightPackage(page, size);
  await packages
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(packages).toBeHidden();
  const created = await readCanonicalBusinessEvidence(page);
  expect(
    created.products.filter((p) => p.package_of_product_id === "0016"),
  ).toHaveLength(4);
  await page.reload();
  await page
    .getByRole("button", { name: "Package sizes", exact: true })
    .click();
  packages = page.getByRole("dialog", { name: "Package sizes", exact: true });
  const first = packages.locator("[data-package-code]").first();
  const code = await first.getAttribute("data-package-code");
  await first.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", {
    name: "Edit package size",
    exact: true,
  });
  await edit
    .getByRole("textbox", { name: "English name", exact: true })
    .fill("Fictional almond bag");
  await edit
    .getByRole("button", { name: "Apply to draft", exact: true })
    .click();
  await packages
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  expect(
    (await readCanonicalBusinessEvidence(page)).products.find(
      (p) => p.code === code,
    )?.name_en,
  ).toBe("Fictional almond bag");
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  const reports = [];
  console.info("D3 actual package create/edit complete");
  for (const width of [390, 1440, 1000])
    for (const lang of ["en", "fa"] as const)
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 1700 : 1500,
        });
        await setLanguage(page, lang);
        const current = await page.locator("html").getAttribute("data-theme");
        if (current !== theme)
          await (
            await openShellAction(
              page,
              lang === "fa"
                ? theme === "dark"
                  ? "تغییر به تم تیره"
                  : "تغییر به تم روشن"
                : theme === "dark"
                  ? "Switch to dark theme"
                  : "Switch to light theme",
            )
          ).click();
        console.info(`D3 matrix ${width} ${lang} ${theme}`);
        const dialog = await openWeightProductEditor(page);
        await expect(dialog.locator("[data-package-code]")).toHaveCount(4);
        const audit = await auditR2fAlignment(page, { scene: "D3" });
        expect(audit.failures, JSON.stringify(audit, null, 2)).toEqual([]);
        reports.push({ width, lang, theme, audit });
        if (
          (width === 1440 && lang === "en" && theme === "light") ||
          (width === 1440 && lang === "fa" && theme === "dark") ||
          (width === 390 && lang === "en" && theme === "light")
        )
          await page.screenshot({
            path: info.outputPath(
              `weight-product-${width}-${theme}-${lang}.png`,
            ),
            fullPage: true,
          });
        const size = dialog.getByRole("textbox", {
          name: lang === "en" ? "New size" : "اندازه جدید",
          exact: true,
        });
        await stableControl(page, size, () => size.fill("750"));
        const add = dialog.getByRole("button", {
          name: lang === "en" ? "Add size" : "افزودن اندازه",
          exact: true,
        });
        await stableControl(page, add, () => add.click());
        const stagedRow = dialog.locator('[data-package-code="staged"]').last();
        const beforeArchive = await stagedRow.boundingBox();
        await stagedRow.getByRole("button").click();
        await page
          .getByRole("menuitem", {
            name: lang === "en" ? "Archive" : "بایگانی",
            exact: true,
          })
          .click();
        const archiveDraft = page.getByRole("dialog", {
          name: lang === "en" ? "Archive package size" : "بایگانی اندازه بسته",
          exact: true,
        });
        await archiveDraft
          .getByRole("textbox", {
            name: lang === "en" ? "Reason" : "دلیل",
            exact: true,
          })
          .fill("Fictional draft size discontinued");
        await archiveDraft
          .getByRole("button", {
            name: lang === "en" ? "Archive" : "بایگانی",
            exact: true,
          })
          .click();
        const afterArchive = await stagedRow.boundingBox();
        expect(
          Math.abs(afterArchive!.y - beforeArchive!.y),
        ).toBeLessThanOrEqual(2);
        await expect(stagedRow).toHaveAttribute("data-pending-archive", "true");
        const costunit = dialog
          .getByRole("group", {
            name: lang === "en" ? "Cost unit" : "واحد هزینه",
          })
          .getByRole("button", {
            name: lang === "en" ? "per kg" : "هر کیلو",
            exact: true,
          });
        await stableControl(page, costunit, () => costunit.click());
        const each = dialog
          .getByRole("group", {
            name: lang === "en" ? "Sold by" : "روش فروش",
            exact: true,
          })
          .getByRole("button", {
            name: lang === "en" ? "Each" : "عددی",
            exact: true,
          });
        await stableControl(page, each, () => each.click());
        const weight = dialog
          .getByRole("group", {
            name: lang === "en" ? "Sold by" : "روش فروش",
            exact: true,
          })
          .getByRole("button", {
            name: lang === "en" ? "By weight" : "وزنی",
            exact: true,
          });
        await stableControl(page, weight, () => weight.click());
        await dialog
          .getByRole("button", {
            name: lang === "en" ? "Cancel" : "انصراف",
            exact: true,
          })
          .click();
      }
  await info.attach("D3-alignment-matrix.json", {
    body: JSON.stringify(reports, null, 2),
    contentType: "application/json",
  });
  await setLanguage(page, "en");
  await signIn(page, "Branch Supervisor");
  await setBranch(page, "Branch 2");
  await page.goto("/#product?code=0016");
  await page
    .getByRole("button", { name: "Package sizes", exact: true })
    .click();
  packages = page.getByRole("dialog", { name: "Package sizes", exact: true });
  const row = packages.locator(`[data-package-code="${code}"]`);
  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  const archive = page.getByRole("dialog", {
    name: "Archive package size",
    exact: true,
  });
  await archive
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill("Fictional size discontinued");
  await archive.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(row).toHaveAttribute("data-pending-archive", "true");
  expect(
    (await readCanonicalBusinessEvidence(page)).products.find(
      (p) => p.code === code,
    )?.status,
  ).toBe("active");
  await packages
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  expect(
    (await readCanonicalBusinessEvidence(page)).products.find(
      (p) => p.code === code,
    )?.status,
  ).toBe("archived");
});

async function stableControl(
  page: Page,
  control: Locator,
  action: () => Promise<unknown>,
) {
  await control.scrollIntoViewIfNeeded();
  const before = await control.boundingBox();
  const beforeFrame = await control.evaluate((element) => {
    const body = element.closest(".product-editor-body")!;
    const content = body.querySelector(".weight-product-content")!;
    return {
      body: body.getBoundingClientRect().toJSON(),
      scroll: (body as HTMLElement).scrollTop,
      height: body.scrollHeight,
      content: content.getBoundingClientRect().toJSON(),
      dialog: element.closest("dialog")!.getBoundingClientRect().toJSON(),
    };
  });
  await action();
  await page.waitForTimeout(100);
  const after = await control.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  const afterFrame = await control.evaluate((element) => {
    const body = element.closest(".product-editor-body")!;
    const content = body.querySelector(".weight-product-content")!;
    return {
      body: body.getBoundingClientRect().toJSON(),
      scroll: (body as HTMLElement).scrollTop,
      height: body.scrollHeight,
      content: content.getBoundingClientRect().toJSON(),
      dialog: element.closest("dialog")!.getBoundingClientRect().toJSON(),
    };
  });
  expect(
    Math.abs(after!.y - before!.y),
    JSON.stringify({ before, after, beforeFrame, afterFrame }, null, 2),
  ).toBeLessThanOrEqual(2);
}

test("R2f D3 creates a weight parent with packages and stages an explicit price using the new cost before one Save", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add product", exact: true });
  await dialog
    .getByRole("textbox", { name: "English name", exact: true })
    .fill("Fictional Valley Tamarind");
  await dialog
    .getByRole("group", { name: "Sold by", exact: true })
    .getByRole("button", { name: "By weight", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Cost before tax", exact: true })
    .fill("3.4900");
  await dialog
    .getByRole("textbox", { name: "New size", exact: true })
    .fill("250");
  await dialog.getByRole("button", { name: "Add size", exact: true }).click();
  await expect(
    dialog.locator('[data-package-code="staged"] .weight-package-new'),
  ).toHaveText(["New", "New"]);
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  let saved = await readCanonicalBusinessEvidence(page);
  const parent = saved.products.find(
    (item) => item.name_en === "Fictional Valley Tamarind",
  )!;
  expect(parent.sold_by).toBe("weight");
  expect(parent.last_cost_before_tax).toBe("3.4900");
  const children = saved.products.filter(
    (item) => item.package_of_product_id === parent.code,
  );
  expect(children).toHaveLength(1);
  expect(children[0].date_tracking).toBe(false);
  const original = saved;
  dialog = await openWeightProductEditor(page, parent.code);
  await dialog
    .getByRole("textbox", { name: "Cost before tax", exact: true })
    .fill("5.1000");
  await dialog
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  let price = page.getByRole("dialog", { name: "Change price", exact: true });
  await price
    .getByRole("textbox", { name: "Price (per lb)", exact: true })
    .fill("9.99");
  await expect(price.getByText(/Margin at this price/)).toContainText("49%");
  await price
    .getByRole("button", { name: "Apply to draft", exact: true })
    .click();
  await expect(price).toBeHidden();
  expect((await readCanonicalBusinessEvidence(page)).products).toEqual(
    original.products,
  );
  await expect(dialog.locator(".weight-product-price-main")).toContainText(
    "$9.99",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await readCanonicalBusinessEvidence(page)).products).toEqual(
    original.products,
  );
  dialog = await openWeightProductEditor(page, parent.code);
  await dialog
    .getByRole("textbox", { name: "Cost before tax", exact: true })
    .fill("5.1000");
  await dialog
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  price = page.getByRole("dialog", { name: "Change price", exact: true });
  await price
    .getByRole("textbox", { name: "Price (per lb)", exact: true })
    .fill("9.99");
  await price
    .getByRole("button", { name: "Apply to draft", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  saved = await readCanonicalBusinessEvidence(page);
  const updated = saved.products.find((item) => item.code === parent.code)!;
  expect(updated.selling_price).toBe("9.99");
  expect(updated.manual_prices?.all?.price).toBe("9.99");
  expect(updated.manual_costs?.["Branch 1"]?.unit_cost_before_tax).toBe(
    "5.1000",
  );
  expect(
    saved.products.find((item) => item.code === children[0].code)
      ?.branch_prices?.["Branch 1"],
  ).toBe("5.99");
  expect(saved.invoices).toEqual(original.invoices);
  expect(saved.ledger).toEqual(original.ledger);
});

test("R2f D3 New size uses the actual parent Sale basis and saves exactly its read-only preview", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add product", exact: true });
  await dialog
    .getByRole("textbox", { name: "English name", exact: true })
    .fill("Fictional Mountain Tarragon");
  await dialog
    .getByRole("group", { name: "Sold by", exact: true })
    .getByRole("button", { name: "By weight", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Cost before tax", exact: true })
    .fill("3.4900");
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const added = await readCanonicalBusinessEvidence(page);
  const parent = added.products.find(
    (item) => item.name_en === "Fictional Mountain Tarragon",
  )!;
  await page.goto(`/#product?code=${parent.code}`);
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const sale = page.getByRole("dialog", { name: "Change price", exact: true });
  await sale
    .getByRole("textbox", { name: "Price (per lb)", exact: true })
    .fill("4.99");
  await sale.getByRole("button", { name: "Start sale", exact: true }).click();
  await expect(sale).toBeHidden();
  const before = await readCanonicalBusinessEvidence(page);
  dialog = await openWeightProductEditor(page, parent.code);
  await expect(dialog.locator(".weight-product-price-main")).toContainText(
    "$5.49",
  );
  await expect(dialog.locator(".weight-package-formula")).toContainText(
    "$4.99/lb",
  );
  await expect(dialog.locator(".weight-package-formula")).toContainText(
    "Sale price",
  );
  await dialog
    .getByRole("textbox", { name: "New size", exact: true })
    .fill("1");
  await chooseOption(
    page,
    dialog.getByRole("combobox", { name: "Package unit", exact: true }),
    "lb",
  );
  await expect(dialog.locator(".weight-package-add-preview")).toContainText(
    "$5.49",
  );
  await dialog.getByRole("button", { name: "Add size", exact: true }).click();
  await expect(
    dialog.locator('[data-package-code="staged"] .weight-package-price'),
  ).toContainText("$5.49");
  const queried = await readCanonicalBusinessEvidence(page);
  expect(queried.products).toEqual(before.products);
  expect(queried.approvals).toEqual(before.approvals);
  expect(queried.product_code_high_water).toBe(before.product_code_high_water);
  await dialog
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const saved = await readCanonicalBusinessEvidence(page);
  expect(
    saved.products.find((item) => item.package_of_product_id === parent.code)
      ?.branch_prices?.["Branch 1"],
  ).toBe("5.49");
  expect(
    saved.sales?.find((item) => item.product_code === parent.code)?.sale_price,
  ).toBe("4.99");
  expect(saved.invoices).toEqual(before.invoices);
  expect(saved.ledger).toEqual(before.ledger);
});
