import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setLanguage, signIn } from "./helpers";

async function assertNoDesktopClipping(page: Page) {
  const failures = await page.evaluate(() => {
    const results: string[] = [];
    const visible = (element: Element) =>
      element.getBoundingClientRect().width > 0 &&
      element.getBoundingClientRect().height > 0;
    for (const element of document.querySelectorAll(
      "main .card, main .ui-data-table, main .filter-toolbar, dialog[open]",
    )) {
      if (!visible(element)) continue;
      if (element.scrollWidth > element.clientWidth + 2)
        results.push(
          `${element.className}: ${element.scrollWidth}px > ${element.clientWidth}px`,
        );
      const rect = element.getBoundingClientRect();
      if (rect.left < -2 || rect.right > innerWidth + 2)
        results.push(`${element.className}: outside viewport`);
    }
    for (const cell of document.querySelectorAll(
      "main .ui-data-table th, main .ui-data-table td",
    )) {
      if (!visible(cell)) continue;
      const rect = cell.getBoundingClientRect();
      for (const element of cell.querySelectorAll(
        ".product-name strong, .product-name small, .badge, .ltr, .ui-button",
      )) {
        if (!visible(element)) continue;
        const content = element.getBoundingClientRect();
        if (content.left < rect.left - 2 || content.right > rect.right + 2)
          results.push(`${cell.textContent?.trim()}: content outside column`);
        if (element.scrollWidth > element.clientWidth + 2)
          results.push(`${element.textContent?.trim()}: clipped text`);
      }
    }
    return results;
  });
  expect(failures).toEqual([]);
}

for (const width of [1280, 1440, 1920]) {
  test(`Labels, Notes and Offers panels fit at ${width}px, including their dialogs`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === "phone",
      "Desktop width acceptance is run in the desktop project.",
    );
    await page.setViewportSize({ width, height: 1080 });
    await signIn(page, "Supervisor");
    for (const language of ["en", "fa"] as const) {
      if (language === "fa") await setLanguage(page, "fa");
      await page.goto("/#labels");
      await assertNoDesktopClipping(page);
      await page.goto("/#notes");
      await assertNoDesktopClipping(page);
      await page
        .getByRole("button", {
          name: language === "en" ? "Add note" : "افزودن یادداشت",
          exact: true,
        })
        .click();
      await assertNoDesktopClipping(page);
      await page.keyboard.press("Escape");
      await page.goto("/#offers");
      await assertNoDesktopClipping(page);
      await page
        .getByRole("button", {
          name: language === "en" ? "Create offer" : "ایجاد پیشنهاد",
          exact: true,
        })
        .click();
      await assertNoDesktopClipping(page);
      await page.keyboard.press("Escape");
    }
  });
}

for (const language of ["en", "fa"] as const) {
  test(`Labels selects only filtered products and edits copies in Waitlist in ${language}`, async ({
    page,
  }) => {
    await signIn(page, "Floor Worker");
    await page.goto("/#labels");
    if (language === "fa") await setLanguage(page, "fa");
    const productTable = page.locator(".labels-product-table");
    await expect(productTable.locator(".ui-number-field")).toHaveCount(0);
    await expect(
      productTable.getByRole("button", {
        name: /Add to waitlist|افزودن به فهرست انتظار/,
      }),
    ).toHaveCount(0);
    await page
      .getByLabel(language === "en" ? "Search products" : "جستجوی کالاها", {
        exact: true,
      })
      .fill("Tea");
    await expect(productTable.locator("tbody tr")).toHaveCount(2);
    await page
      .getByRole("checkbox", {
        name:
          language === "en"
            ? "Select all filtered"
            : "انتخاب همه نتایج فیلترشده",
        exact: true,
      })
      .check();
    const bar = page.locator(".labels-selection-bar");
    await expect(bar).toBeVisible();
    await bar
      .getByLabel(language === "en" ? "Copies" : "تعداد", { exact: true })
      .fill("3");
    await bar
      .getByRole("button", {
        name:
          language === "en"
            ? "Add 2 products to waitlist"
            : "افزودن 2 کالا به فهرست انتظار",
        exact: true,
      })
      .click();
    await expect(bar).toHaveCount(0);
    await page
      .getByRole("tab", {
        name: language === "en" ? /^Waitlist/ : /^فهرست انتظار/,
      })
      .click();
    await expect(page.locator(".labels-waitlist-table tbody tr")).toHaveCount(
      2,
    );
    for (const code of ["0004", "0011"])
      await expect(
        page.getByLabel(
          language === "en" ? `Copies for ${code}` : `تعداد ${code}`,
          { exact: true },
        ),
      ).toHaveValue("3");
    const queue = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!)
          .label_waitlist,
    );
    expect(
      queue.map((item: { product_code: string }) => item.product_code).sort(),
    ).toEqual(["0004", "0011"]);
    await page
      .locator(".undo-toast")
      .first()
      .getByRole("button", {
        name: language === "en" ? "Undo" : "واگرد",
        exact: true,
      })
      .click();
    await expect(page.locator(".labels-waitlist-table")).toHaveCount(0);
  });
}

test("Notes is a list with a focused Add note dialog; field errors clear on edit and saved notes undo", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#notes");
  await expect(
    page.getByRole("form", { name: "Add note", exact: true }),
  ).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Add note", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add note", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "Save note", exact: true }).click();
  const note = dialog.getByLabel("Note", { exact: true });
  await expect(note).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.locator(".form-error")).toHaveText(
    "Add a short note before saving.",
  );
  await note.fill("Check tomorrow's delivery time");
  await expect(note).toHaveAttribute("aria-invalid", "false");
  await expect(dialog.locator(".form-error")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const entry = page
    .locator(".notebook-entry-card")
    .filter({ hasText: "Check tomorrow's delivery time" });
  await expect(entry).toContainText("Demo Supervisor");
  await page
    .locator(".undo-toast")
    .first()
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(entry).toHaveCount(0);
});

test("Offers creates from the top dialog, keeps pricing unchanged and excludes Warehouse", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#offers");
  const prices = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).products.map(
      (item: { code: string; selling_price: string }) => [
        item.code,
        item.selling_price,
      ],
    ),
  );
  const trigger = page.getByRole("button", {
    name: "Create offer",
    exact: true,
  });
  await expect(page.locator(".form-card")).toHaveCount(0);
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Create offer",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await chooseOption(
    page,
    dialog.getByLabel("Product", { exact: true }),
    "0003",
    "Sour Cherry Juice 1 L · \u20660003\u2069",
  );
  await dialog
    .getByRole("button", { name: "Create offer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).products.map(
      (item: { code: string; selling_price: string }) => [
        item.code,
        item.selling_price,
      ],
    ),
  );
  expect(after).toEqual(prices);
  await page
    .locator(".offers-filters")
    .getByLabel("Offer branch", { exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Warehouse", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
});
