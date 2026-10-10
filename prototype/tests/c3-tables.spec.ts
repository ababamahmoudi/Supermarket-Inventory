import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setLanguage, signIn } from "./helpers";

const storage = "supermarket-prototype-v1";
test.setTimeout(180000);
test.use({ actionTimeout: 10000 });

async function newOrder(page: Page) {
  await page.goto("/#orders");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await chooseOption(
    page,
    form.getByLabel("Location", { exact: true }),
    "North York",
  );
  await chooseOption(
    page,
    form.getByLabel("Supplier", { exact: true }),
    "Fresh Valley Foods",
  );
  return form;
}

async function proveTables(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  return page.evaluate(() => {
    const failures: string[] = [];
    let cells = 0;
    let textFragments = 0;
    const wrappers = [
      ...document.querySelectorAll<HTMLElement>("main .ui-data-table"),
    ].filter((element) => element.getClientRects().length);
    for (const wrapper of wrappers) {
      const table = wrapper.querySelector("table")!;
      const box = wrapper.getBoundingClientRect();
      const tableBox = table.getBoundingClientRect();
      if (wrapper.scrollWidth > wrapper.clientWidth + 2)
        failures.push(
          `${wrapper.className}: horizontal scroll ${wrapper.scrollWidth}/${wrapper.clientWidth}`,
        );
      if (tableBox.left < box.left - 2 || tableBox.right > box.right + 2)
        failures.push(`${wrapper.className}: table outside its panel`);
      if (box.left < -2 || box.right > innerWidth + 2)
        failures.push(`${wrapper.className}: panel outside viewport`);
      for (const cell of table.querySelectorAll<HTMLElement>("th, td")) {
        if (!cell.getClientRects().length) continue;
        const headingGroup = cell.closest("thead");
        if (headingGroup && getComputedStyle(headingGroup).clipPath !== "none")
          continue;
        cells++;
        const bounds = cell.getBoundingClientRect();
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (
            !node.textContent?.trim() ||
            !parent?.getClientRects().length ||
            parent.closest(".sr-only, [aria-hidden=true], [hidden]")
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            textFragments++;
            if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
              failures.push(`Clipped cell text: ${node.textContent.trim()}`);
          }
        }
        const key = cell.dataset.columnKey;
        if (cell.tagName !== "TH" || !key) continue;
        const bodyCell = table.querySelector<HTMLElement>(
          `tbody [data-column-key="${key}"]`,
        );
        if (!bodyCell?.getClientRects().length) continue;
        const bodyBox = bodyCell.getBoundingClientRect();
        if (
          Math.abs(bounds.left - bodyBox.left) > 2 ||
          Math.abs(bounds.right - bodyBox.right) > 2
        )
          failures.push(`Heading is not above its values: ${key}`);
        const headerAlignment = getComputedStyle(cell).textAlign;
        const bodyAlignment = getComputedStyle(bodyCell).textAlign;
        if (headerAlignment !== bodyAlignment)
          failures.push(
            `Heading/value alignment differs: ${key} ${headerAlignment}/${bodyAlignment}`,
          );
      }
    }
    return { tables: wrappers.length, cells, textFragments, failures };
  });
}

for (const width of [1280, 1440, 1920]) {
  for (const language of ["en", "fa"] as const) {
    test(`all seven table pages fit and retain their complete text at ${width}px (${language})`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name === "phone", "Desktop table geometry.");
      await page.setViewportSize({ width, height: 1080 });
      await signIn(page, "Supervisor");
      const form = await newOrder(page);
      await form
        .getByRole("textbox", { name: /^Cases —/ })
        .first()
        .fill("1");
      await form
        .getByRole("button", { name: "Save as draft", exact: true })
        .click();
      await expect(page).toHaveURL(/#orders\?id=/);
      const orderUrl = page.url();
      await setLanguage(page, language);
      const report: {
        scene: string;
        proof: Awaited<ReturnType<typeof proveTables>>;
      }[] = [];
      const check = async (scene: string) => {
        await expect(page.locator("main .ui-data-table").first()).toBeVisible();
        const proof = await proveTables(page);
        expect(proof.cells, `${scene}: nonempty table proof`).toBeGreaterThan(
          5,
        );
        expect(
          proof.textFragments,
          `${scene}: real visible text checked`,
        ).toBeGreaterThan(5);
        expect(proof.failures, scene).toEqual([]);
        report.push({ scene, proof });
      };
      for (const route of [
        "products",
        "suppliers",
        "received",
        "payables",
        "returns",
        "expiry",
        "orders",
      ]) {
        await page.goto(`/#${route}`);
        await check(route);
        if (route === "products") {
          const edit = page
            .locator(".catalog-products-table tbody tr")
            .first()
            .getByRole("button", {
              name: language === "en" ? /^Edit / : /^ویرایش /,
            });
          await edit.scrollIntoViewIfNeeded();
          const hit = await edit.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            return [0.2, 0.5, 0.8].every(
              (fraction) =>
                document
                  .elementFromPoint(
                    rect.left + rect.width * fraction,
                    rect.top + rect.height / 2,
                  )
                  ?.closest("button") === button,
            );
          });
          expect(
            hit,
            "The first Products Edit button must have no white overlay",
          ).toBe(true);
        }
        if (route === "suppliers") {
          await page
            .getByRole("button", {
              name: language === "en" ? "Columns" : "ستون‌ها",
              exact: true,
            })
            .click();
          const dialog = page.getByRole("dialog", {
            name: language === "en" ? "Columns" : "ستون‌ها",
            exact: true,
          });
          for (const checkbox of await dialog.getByRole("checkbox").all())
            if (!(await checkbox.isDisabled())) await checkbox.check();
          await dialog
            .getByRole("button", {
              name: language === "en" ? "Close" : "بستن",
              exact: true,
            })
            .click();
          await expect(page.locator(".suppliers-table")).toHaveAttribute(
            "data-visible-column-count",
            "11",
          );
          await check("suppliers with every optional column enabled");
        }
      }
      await page.goto(orderUrl);
      await check("saved order detail");
      await page.goto("/#payables");
      await page
        .locator(".payables-overview tbody tr")
        .filter({ hasText: "Fresh Valley Foods" })
        .getByRole("link", {
          name: "Fresh Valley Foods",
          exact: true,
        })
        .click();
      await check("supplier ledger");
      await page.goto("/#orders");
      await page
        .getByRole("button", {
          name: language === "en" ? "New order" : "سفارش جدید",
          exact: true,
        })
        .click();
      await chooseOption(
        page,
        page.getByLabel(language === "en" ? "Supplier" : "تأمین‌کننده", {
          exact: true,
        }),
        "Fresh Valley Foods",
      );
      await check("new order item and cost fields");
      await testInfo.attach(`tables-${width}-${language}.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
    });
  }
}

test("Columns keeps mandatory names, persists by user and never exposes Supervisor money to a Floor Worker", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Columns", exact: true });
  await expect(
    dialog.getByRole("checkbox", { name: "Product", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: "Approved price", exact: true })
    .uncheck();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(0);
  await signIn(page, "Floor Worker");
  await page.goto("/#products");
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toBeVisible();
  await page.goto("/#suppliers");
  await expect(
    page.locator(
      ".suppliers-table [data-column-key=balance], .suppliers-table [data-column-key=overdue], .suppliers-table [data-column-key=due]",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Columns", exact: true });
  await expect(
    dialog.getByRole("checkbox", { name: /Balance|Overdue|Next due date/ }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Columns", exact: true });
  await dialog
    .getByRole("button", { name: "Reset columns", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.locator(".catalog-products-table th[data-column-key=price]"),
  ).toBeVisible();
});

test("browser Back restores the Products search and Orders status without mutating data", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  const search = page.getByLabel("Search products", { exact: true });
  await search.fill("0004");
  await page
    .locator(".catalog-products-table tbody tr")
    .first()
    .getByRole("button", { name: /^View / })
    .click();
  await expect(page).toHaveURL(/#product\?code=/);
  await page.goBack();
  await expect(search).toHaveValue("0004");
  await expect(page.locator(".catalog-products-table tbody tr")).toHaveCount(1);
  const form = await newOrder(page);
  await form
    .getByRole("textbox", { name: /^Cases —/ })
    .first()
    .fill("1");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to Orders", exact: true })
    .click();
  await chooseOption(page, page.getByLabel("Status", { exact: true }), "Draft");
  const order = page.locator(".orders-list-table tbody tr").first();
  await order.getByRole("button").first().click();
  await expect(page).toHaveURL(/#orders\?id=/);
  await page.goBack();
  await expect(page.getByLabel("Status", { exact: true })).toHaveText("Draft");
  await expect(page.locator(".orders-list-table tbody tr")).toHaveCount(1);
});

test("an order error belongs to its invalid item and clears immediately only when that item changes", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const form = await newOrder(page);
  const costs = form.getByRole("textbox", { name: /^Expected unit cost —/ });
  const cases = form.getByRole("textbox", { name: /^Cases —/ });
  expect(await costs.count()).toBeGreaterThan(1);
  await cases.nth(0).fill("1");
  await cases.nth(1).fill("1");
  await costs.nth(0).fill("1.00001");
  await form
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(costs.nth(0)).toHaveAttribute("aria-invalid", "true");
  await expect(costs.nth(1)).toHaveAttribute("aria-invalid", "false");
  await costs.nth(1).fill("2.5000");
  await expect(costs.nth(0)).toHaveAttribute("aria-invalid", "true");
  await costs.nth(0).fill("1.0000");
  await expect(costs.nth(0)).toHaveAttribute("aria-invalid", "false");
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).orders,
    storage,
  );
  expect(saved).toHaveLength(0);
});

test("external payment is unchanged until explicit money confirmation, and cancellation records nothing", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#payables");
  await page
    .locator(".payables-overview tbody tr")
    .filter({ hasText: "Fresh Valley Foods" })
    .getByRole("link", { name: "Fresh Valley Foods", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record external payment", exact: true })
    .click();
  await page
    .getByLabel("Payment receipt reference", { exact: true })
    .fill("C3-CONFIRM-DEMO");
  await page
    .getByRole("button", {
      name: "Preview oldest-due allocations",
      exact: true,
    })
    .click();
  const ledger = () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).ledger,
      storage,
    );
  const before = await ledger();
  await page
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Record external payment",
    exact: true,
  });
  await expect(dialog).toContainText("C3-CONFIRM-DEMO");
  expect(await ledger()).toEqual(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await ledger()).toEqual(before);
  await page
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Record external payment",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  const after = await ledger();
  expect(after).toHaveLength(before.length + 1);
  expect(after.at(-1)).toMatchObject({
    type: "payment",
    reference: "C3-CONFIRM-DEMO",
    amount: "-50.00",
  });
  await expect(page.getByTestId("undo-toast")).toHaveCount(0);
});
