import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setLanguage, signIn } from "./helpers";

async function newItemOrder(page: Page, language: "en" | "fa" = "en") {
  const fa = language === "fa";
  await page.goto("/#orders");
  if (fa) await setLanguage(page, "fa");
  await page
    .getByRole("button", { name: fa ? "سفارش جدید" : "New order", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: fa ? "سفارش جدید" : "New order",
    exact: true,
  });
  await chooseOption(
    page,
    form.getByLabel(fa ? "تأمین‌کننده" : "Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  await form
    .getByRole("button", { name: fa ? "کالای جدید" : "New item", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: fa ? "کالای جدید" : "New item",
    exact: true,
  });
  await dialog
    .getByLabel(fa ? "نام" : "Name", { exact: true })
    .fill("Fictional delivery item");
  await dialog.getByLabel(fa ? "کارتن" : "Cases", { exact: true }).fill("2");
  await dialog
    .getByRole("button", { name: fa ? "افزودن کالا" : "Add item", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  return form;
}

async function assertOrderGeometry(page: Page) {
  const issues = await page
    .locator(".order-form-card,.order-items-table,.order-sheet-preview")
    .evaluateAll((panels) => {
      const failures: string[] = [];
      for (const panel of panels) {
        const element = panel as HTMLElement;
        const bounds = element.getBoundingClientRect();
        if (
          element.scrollWidth > element.clientWidth + 2 ||
          bounds.left < -1 ||
          bounds.right > window.innerWidth + 1
        )
          failures.push(`${element.className}: panel overflow`);
      }
      for (const cell of document.querySelectorAll<HTMLElement>(
        ".order-items-table td",
      )) {
        const bounds = cell.getBoundingClientRect();
        for (const element of cell.querySelectorAll<HTMLElement>(
          ".ui-number,.pill,.product-name strong,.product-name small,.money,button",
        )) {
          const content = element.getBoundingClientRect();
          if (
            content.width &&
            (content.left < bounds.left - 2 ||
              content.right > bounds.right + 2 ||
              element.scrollWidth > element.clientWidth + 2)
          )
            failures.push(`${element.textContent}: cell clipping`);
        }
      }
      return failures;
    });
  expect(issues).toEqual([]);
}

for (const width of [1280, 1440, 1920])
  test(`New order fits its fields, names and table at ${width}px in English and Persian`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop panel proof.");
    await page.setViewportSize({ width, height: 1080 });
    await signIn(page, "Supervisor");
    await newItemOrder(page);
    await assertOrderGeometry(page);
    await setLanguage(page, "fa");
    await assertOrderGeometry(page);
  });

for (const language of ["en", "fa"] as const)
  test(`New item phone cards and whole A4 preview keep the unknown estimate in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "Supervisor");
    const form = await newItemOrder(page, language);
    await assertOrderGeometry(page);
    const row = form.locator(".order-new-item-row");
    await expect(row).toContainText(
      language === "fa" ? "کالای جدید" : "New item",
    );
    expect(
      await row.evaluate((element) => getComputedStyle(element).display),
    ).toBe("grid");
    const cases = row.getByRole("textbox", {
      name: `${language === "fa" ? "کارتن" : "Cases"} — Fictional delivery item`,
      exact: true,
    });
    await cases.scrollIntoViewIfNeeded();
    await expect(cases).toBeVisible();
    await expect(cases).toHaveValue("2");
    await expect(
      row.getByRole("textbox", {
        name: `${language === "fa" ? "هزینهٔ مورد انتظار واحد" : "Expected unit cost"} — Fictional delivery item`,
        exact: true,
      }),
    ).toHaveValue("");
    await form
      .getByRole("button", {
        name: language === "fa" ? "ثبت سفارش" : "Place order",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: language === "fa" ? "چاپ سفارش" : "Print order",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: language === "fa" ? "چاپ سفارش" : "Print order",
      exact: true,
    });
    await expect(dialog.locator(".order-print-new-item")).toContainText(
      "New item",
    );
    await expect(dialog.locator(".order-print-total")).toContainText(
      "Estimate incomplete",
    );
    const geometry = await dialog.evaluate((element) => {
      const sheet = element.querySelector<HTMLElement>(
        ".operational-print-document",
      )!;
      const viewport = element.querySelector<HTMLElement>(
        ".order-sheet-preview",
      )!;
      const bounds = sheet.getBoundingClientRect();
      const allowed = viewport.getBoundingClientRect();
      return {
        width: sheet.offsetWidth,
        height: sheet.offsetHeight,
        fits:
          bounds.left >= allowed.left - 1 &&
          bounds.right <= allowed.right + 1 &&
          bounds.top >= allowed.top - 1 &&
          bounds.bottom <= allowed.bottom + 1,
        overflow: viewport.scrollWidth - viewport.clientWidth,
        headers: Array.from(sheet.querySelectorAll("th")).map((header) => [
          header.querySelector('[lang="en"]')?.textContent,
          header.querySelector('[lang="fa"]')?.textContent,
        ]),
      };
    });
    expect(geometry.width).toBeCloseTo((210 * 96) / 25.4, 0);
    expect(geometry.height).toBeGreaterThanOrEqual((297 * 96) / 25.4 - 1);
    expect(geometry.fits).toBe(true);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.headers).toContainEqual(["Cases", "کارتن"]);
    expect(geometry.headers).toContainEqual(["Units", "واحد"]);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    const order = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).orders.at(
        -1,
      ),
    );
    expect(order.lines[0]).toMatchObject({
      new_item: true,
      units_per_case: null,
      ordered_units: null,
      expected_unit_cost: null,
      ordered_cases: "2",
    });
  });
