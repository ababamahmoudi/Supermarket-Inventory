import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";

test.setTimeout(60000);
const storage = "supermarket-prototype-v1";
async function addOilItem(page: Page, quote = "3.55") {
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await chooseOption(
    page,
    dialog.getByLabel("Product", { exact: true }),
    "0008",
    "0008 · Sunflower Oil 1.8 L",
  );
  await dialog.getByLabel("Supplier code", { exact: true }).fill("ORDER-OIL");
  await dialog.getByLabel("Units per case", { exact: true }).fill("12");
  if (quote)
    await dialog.getByLabel("Expected unit cost", { exact: true }).fill(quote);
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function newOrder(page: Page, location = "North York") {
  await page.goto("/#orders");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await chooseOption(
    page,
    form.getByLabel("Location", { exact: true }),
    location,
  );
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  return form;
}
async function savedOrders(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).orders,
    storage,
  );
}

test("Supervisor creates a Warehouse fractional-case draft, places it, filters it and prints the bilingual retained estimate", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await addOilItem(page);
  const before = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    return { ledger: state.ledger, movements: state.stock_movements };
  }, storage);
  const form = await newOrder(page, "Warehouse");
  expect(
    await form
      .locator(".order-heading-fields")
      .getByLabel("Location", { exact: true })
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(320);
  const row = form
    .locator(".order-items-table tbody tr")
    .filter({ hasText: "ORDER-OIL" });
  await row
    .getByLabel("Cases — Sunflower Oil 1.8 L", { exact: true })
    .fill("0.1");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("whole units");
  await row
    .getByLabel("Cases — Sunflower Oil 1.8 L", { exact: true })
    .fill("0.5");
  await expect(row.locator("td").nth(3)).toHaveText("6");
  await expect(row.locator("td").last()).toHaveText("$21.30");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ORD-0001", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => await savedOrders(page)).toHaveLength(1);
  const draft = (await savedOrders(page))[0];
  expect(draft).toMatchObject({
    status: "draft",
    expected_total_before_tax: "21.30",
  });
  expect(draft.branch).not.toBe("all");
  expect(draft.lines[0]).toMatchObject({
    ordered_units: 6,
    units_per_case: 12,
    ordered_cases: "0.5",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ORD-0001", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Order placed.");
  await page.getByRole("button", { name: "Print order", exact: true }).click();
  const print = page.getByRole("dialog", { name: "Print order", exact: true });
  await expect(print.locator(".order-print-output")).toContainText(
    "روغن آفتابگردان",
  );
  await expect(print.locator(".order-print-total")).toContainText("$21.30");
  await expect(print).toContainText("ORDER-OIL");
  await page.evaluate(() => {
    window.print = () => {
      (window as unknown as { printRequested: boolean }).printRequested = true;
    };
  });
  await print.getByRole("button", { name: "Print", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { printRequested: boolean }).printRequested,
    ),
  ).toBe(true);
  const output = page.locator(
    "body > .operational-print-output .order-print-output",
  );
  await expect(output).toHaveCount(1);
  await expect(output.locator(".order-print-total")).toContainText("$21.30");
  await page.emulateMedia({ media: "print" });
  const geometry = await output
    .locator(".operational-print-document")
    .evaluate((el) => ({
      page: getComputedStyle(el).getPropertyValue("page"),
      repeat: getComputedStyle(el.querySelector("thead")!).display,
      break: getComputedStyle(el.querySelector("tbody tr")!).breakInside,
    }));
  expect(geometry).toEqual({
    page: "operational-document",
    repeat: "table-header-group",
    break: "avoid",
  });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(output).toHaveCount(0);
  await print.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "All orders", exact: true }).click();
  await chooseOption(
    page,
    page.getByLabel("Status", { exact: true }),
    "Ordered",
  );
  await expect(page.locator(".orders-list-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".orders-list-table")).toContainText("Warehouse");
  await setLanguage(page, "fa");
  await expect(
    page.getByRole("heading", { name: "سفارش‌ها", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".orders-list-table")).toContainText("$21.30");
  await expect(
    page.locator(
      ".orders-page select,.orders-page input[type=number],.orders-page input[type=date],.orders-page input[type=checkbox]",
    ),
  ).toHaveCount(0);
  const after = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    return { ledger: state.ledger, movements: state.stock_movements };
  }, storage);
  expect(after).toEqual(before);
});

test("free-text To order note saves unresolved selection but needs explicit item and Cases before placement; new unbought items need Expected unit cost", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "North York");
  await page.goto("/#notes");
  await page.getByRole("tab", { name: "To order", exact: true }).click();
  const noteText = "Order cooking oil for the next delivery.";
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  const noteForm = page.getByRole("form", { name: "Add note", exact: true });
  await noteForm.getByLabel("Note", { exact: true }).fill(noteText);
  await expect(
    noteForm.getByLabel("Product (optional)", { exact: true }),
  ).toContainText("Choose product");
  await expect(
    noteForm.getByLabel("Quantity (optional)", { exact: true }),
  ).toHaveValue("");
  await noteForm
    .getByRole("button", { name: "Save note", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved note.");
  const freeTextNote = await page.evaluate(
    ({ key, text }) =>
      JSON.parse(localStorage.getItem(key)!).notes.find(
        (item: { text: string }) => item.text === text,
      ),
    { key: storage, text: noteText },
  );
  expect(freeTextNote).toMatchObject({
    type: "to_order",
    status: "open",
    branch: "Branch 1",
  });
  expect(freeTextNote.product_code).toBeUndefined();
  expect(freeTextNote.qty).toBeUndefined();
  await setBranch(page, "all");
  await addOilItem(page, "");
  const form = await newOrder(page);
  const note = page.locator(".order-source-note").filter({ hasText: noteText });
  await note.getByRole("button", { name: "Add to order", exact: true }).click();
  await expect(note.getByLabel("Supplier item", { exact: true })).toContainText(
    "Choose item",
  );
  const row = form
    .locator(".order-items-table tbody tr")
    .filter({ hasText: "ORDER-OIL" });
  await expect(
    row.getByLabel("Cases — Sunflower Oil 1.8 L", { exact: true }),
  ).toHaveValue("");
  await expect(
    row.getByLabel("Expected unit cost — Sunflower Oil 1.8 L", { exact: true }),
  ).toHaveValue("");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect.poll(async () => await savedOrders(page)).toHaveLength(1);
  const draft = (await savedOrders(page))[0];
  expect(draft.lines).toHaveLength(0);
  expect(draft.source_note_ids).toEqual([freeTextNote.id]);
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  const editing = page.getByRole("form", { name: "New order", exact: true });
  await editing
    .getByLabel("Cases — Sunflower Oil 1.8 L", { exact: true })
    .fill("0.5");
  await editing
    .getByRole("button", { name: "Place order", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Expected unit cost");
  await editing
    .getByLabel("Expected unit cost — Sunflower Oil 1.8 L", { exact: true })
    .fill("3.55");
  await editing
    .getByRole("button", { name: "Place order", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "every selected To order note",
  );
  await chooseOption(
    page,
    note.getByLabel("Supplier item", { exact: true }),
    "Sunflower Oil 1.8 L · ORDER-OIL",
  );
  await editing
    .getByRole("button", { name: "Place order", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Order placed.");
  await expect
    .poll(
      async () =>
        await page.evaluate((key) => {
          const state = JSON.parse(localStorage.getItem(key)!);
          return state.notes.find(
            (item: { id: string }) =>
              item.id === state.orders[0].source_note_ids[0],
          ).status;
        }, storage),
    )
    .toBe("ordered");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ORD-0001", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place order", exact: true }),
  ).toHaveCount(0);
  expect((await savedOrders(page))[0].lines[0]).toMatchObject({
    ordered_units: 6,
    expected_line_total: "21.30",
  });
  await page.goto("/#notes");
  await expect(
    page.locator(".notebook-entry-card").filter({ hasText: noteText }),
  ).toHaveCount(0);
});

test("worker ordering is opt-in and location scoped; switching location discards unsaved supplier costs and print state", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await addOilItem(page);
  let form = await newOrder(page, "Warehouse");
  await form
    .getByLabel("Cases — Sunflower Oil 1.8 L", { exact: true })
    .fill("1");
  await form.getByRole("button", { name: "Place order", exact: true }).click();
  await page.getByRole("button", { name: "Print order", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Print order", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "All orders", exact: true }).click();
  await page.getByRole("button", { name: "New order", exact: true }).click();
  form = page.getByRole("form", { name: "New order", exact: true });
  await chooseOption(
    page,
    form.getByLabel("Location", { exact: true }),
    "Warehouse",
  );
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  await form
    .getByLabel("Expected unit cost — Sunflower Oil 1.8 L", { exact: true })
    .fill("99");
  await setBranch(page, "North York");
  await expect(form).toHaveCount(0);
  await expect(page.locator(".orders-list-table")).toHaveCount(0);
  await signIn(page, "Floor Worker");
  await expect(page.locator('.sidebar a[href="#orders"]')).toHaveCount(0);
  await signIn(page, "Supervisor");
  await page.goto("/#settings?group=modules");
  await page.getByRole("button", { name: "Modules", exact: true }).click();
  await page
    .getByRole("switch", {
      name: "Allow Floor Workers to use Orders",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await signIn(page, "Floor Worker");
  await page.goto("/#orders");
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ORD-0001", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "New order", exact: true }).click();
  form = page.getByRole("form", { name: "New order", exact: true });
  await expect(form.getByLabel("Location", { exact: true })).toContainText(
    "North York",
  );
  await form.getByLabel("Location", { exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Warehouse", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  await expect(
    form.getByLabel("Expected unit cost — Sunflower Oil 1.8 L", {
      exact: true,
    }),
  ).toHaveValue("3.5500");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  await expect(
    page
      .locator(".supplier-items-table")
      .getByRole("columnheader", { name: /Last bought \/ (unit|case)/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "History", exact: true }),
  ).toHaveCount(0);
});
