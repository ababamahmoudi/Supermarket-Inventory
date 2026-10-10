import { expect, test, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import { chooseOption, setLanguage, signIn, uploadInvoice } from "./helpers";

async function userAction(page: Page, action: string) {
  if (await page.evaluate(() => window.innerWidth <= 760))
    await page.locator("#menu-toggle").click();
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
  if (await page.locator(".sidebar.is-open").count())
    await page.keyboard.press("Escape");
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function expectStyledControls(page: Page) {
  const visibleNative = await page
    .locator(
      'select, input[type="file"], input[type="checkbox"], input[type="radio"], input[type="date"], input[type="time"], input[type="number"]',
    )
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          const style = getComputedStyle(control);
          const bounds = control.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            style.clipPath === "none" &&
            bounds.width > 4 &&
            bounds.height > 4
          );
        })
        .map((control) => control.outerHTML),
    );
  expect(visibleNative).toEqual([]);
}

async function expectBorderlessCards(page: Page) {
  const cards = await page.locator(".card").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        border: Math.max(
          parseFloat(style.borderTopWidth),
          parseFloat(style.borderRightWidth),
          parseFloat(style.borderBottomWidth),
          parseFloat(style.borderLeftWidth),
        ),
        shadow: style.boxShadow,
        radius: parseFloat(style.borderRadius),
      };
    }),
  );
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    expect(card.border).toBe(0);
    expect(card.shadow).toBe("none");
    expect(card.radius).toBeGreaterThanOrEqual(16);
  }
}

test("keyboard sign-in explains a wrong password and opens the cashier's approved price lookup", async ({
  page,
}) => {
  await page.goto("/");
  await expectStyledControls(page);
  const username = page.getByLabel("Username", { exact: true });
  await expect(username).toBeFocused();
  await username.fill("cashier");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type("incorrect-password");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toHaveText(
    "The username or password is incorrect. Try again.",
  );
  await expect(username).toHaveValue("cashier");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "Cashier lookup", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Search products", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Payables", exact: true }),
  ).toHaveCount(0);
});

test("temporary-password users cannot bypass the new password form through routes or a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("newemployee");
  await page.getByLabel("Password", { exact: true }).fill("temp1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const route of ["dashboard", "lookup", "invoices", "payables"]) {
    await page.goto(`/#${route}`);
    await expect(
      page.getByRole("heading", { name: "Choose a new password", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Pages", exact: true }),
    ).toHaveCount(0);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose a new password", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Pages", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("New password", { exact: true }).fill("password123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("password123");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("too common");
  await page
    .getByLabel("New password", { exact: true })
    .fill("NewStorePass2026!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("NewStorePass2026!");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Demo", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Demo", exact: true }),
  ).toBeVisible();
  await userAction(page, "Sign out");
  await page.getByLabel("Username", { exact: true }).fill("newemployee");
  await page.getByLabel("Password", { exact: true }).fill("temp1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Password", { exact: true }).fill("NewStorePass2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Invoices", exact: true }),
  ).toBeVisible();
});

test("locking hides the app, and recent users fill a username without retaining a password", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  await userAction(page, "Lock");
  await page.goto("/#payables");
  await expect(
    page.getByRole("heading", { name: "Screen locked", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Pages", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Password", { exact: true }).fill("bad-password");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cashier lookup", exact: true }),
  ).toBeVisible();
  await userAction(page, "Sign out");
  await expect(
    page.getByText("Recent users on this computer", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("not-retained");
  await page.getByRole("button", { name: "Cashier", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "cashier",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Cashier", exact: true }),
  ).toBeVisible();
});

test("dark theme, comfortable text and Persian RTL persist when the page reloads", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  const textSize = page.getByRole("button", {
    name: "Comfortable text size",
    exact: true,
  });
  await expect(textSize).toBeVisible();
  await textSize.click();
  await setLanguage(page, "fa");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-text-size",
    "comfortable",
  );
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-text-size",
    "comfortable",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(
    page.getByRole("heading", { name: "جست‌وجوی صندوق‌دار", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
});

test("lookup supports keyboard results and a second barcode without adding it to the first", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  const search = page.getByLabel("Search products", { exact: true });
  const rows = page
    .getByRole("listbox", { name: "Product results" })
    .getByRole("option");
  const nextId = await rows.nth(1).getAttribute("id");
  await search.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", nextId!);
  await search.press("Enter");
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  await search.fill("0006");
  await search.press("Enter");
  const sumac = demoSeed.products.find((product) =>
    product.name_en.includes("Sumac"),
  )!;
  await page.keyboard.type(sumac.barcode);
  await page.keyboard.press("Enter");
  await expect(search).toHaveValue(sumac.barcode);
  await expect(page.locator(".price")).toHaveText("$1.99");
  await expect(search).toBeFocused();
  await search.fill("0015");
  await expect(page.locator(".lookup-detail")).toContainText(
    "No approved price yet",
  );
  await expect(page.locator(".lookup-pending-price")).toContainText("$5.49");
  await expect(page.locator(".price")).toHaveCount(0);
});

test("the topbar product search opens an encoded English or Persian lookup query", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "The phone uses the hero product search.",
  );
  await signIn(page, "Supervisor");
  await page.locator("#main-content").focus();
  await page.keyboard.press("/");
  const shellSearch = page.getByLabel("Search all products", { exact: true });
  await expect(shellSearch).toBeFocused();
  for (const query of ["sumac", "سماق"]) {
    await shellSearch.fill(query);
    await shellSearch.press("Enter");
    await expect(
      page.getByLabel("Search products", { exact: true }),
    ).toHaveValue(query);
    await expect(page.locator(".price")).toHaveText("$1.99");
  }
});

test("the four redesigned screens use styled controls and borderless cards without page overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expectStyledControls(page);
  await expectBorderlessCards(page);
  await expectNoPageOverflow(page);
  await signIn(page, "Supervisor");
  for (const route of ["dashboard", "lookup", "invoices"]) {
    await page.goto(`/#${route}`);
    if (route === "invoices") {
      await uploadInvoice(page);
      await page
        .getByRole("button", { name: "Invoice details", exact: true })
        .click();
    }
    await expectStyledControls(page);
    await expectBorderlessCards(page);
    await expectNoPageOverflow(page);
    await setLanguage(page, "fa");
    await expectStyledControls(page);
    await expectNoPageOverflow(page);
    await setLanguage(page, "en");
  }
});

test("the 1080p sidebar fits while compound invoice forms use the available width and individual fields stay bounded", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "Desktop layout is checked at 1920 by 1080.",
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  expect(
    (await page.locator(".signin-card").boundingBox())!.width,
  ).toBeLessThanOrEqual(420);
  await signIn(page, "Supervisor");
  await expect(page.locator(".dashboard-kpis > .kpi-card")).toHaveCount(4);
  await expect(page.locator(".kpi-label")).toHaveText([
    "Approvals waiting",
    "Open alerts",
    "Open shorts",
    "Expiring soon",
  ]);
  expect(
    await page
      .locator(".sidebar")
      .evaluate((sidebar) => sidebar.scrollHeight <= sidebar.clientHeight),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "User menu", exact: true }),
  ).toBeInViewport();
  const main = (await page.locator("#main-content").boundingBox())!;
  const sidebar = (await page.locator(".sidebar").boundingBox())!;
  expect(main.width).toBe(1920 - sidebar.width);
  expect(main.x + main.width).toBeLessThanOrEqual(1920);
  await page.goto("/#lookup");
  expect(
    (await page.locator(".lookup-page").boundingBox())!.width,
  ).toBeLessThanOrEqual(880);
  expect(
    (await page.locator(".lookup-search-pill").boundingBox())!.height,
  ).toBe(56);
  await page.goto("/#invoices");
  await uploadInvoice(page);
  await page
    .getByRole("button", { name: "Invoice details", exact: true })
    .click();
  for (const form of await page
    .locator(".invoice-details-form, .invoice-line-form")
    .all())
    expect(
      await form.evaluate((element) => {
        const pane = element
          .closest(".invoice-review-pane")!
          .getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= pane.left - 2 &&
          rect.right <= pane.right + 2 &&
          element.scrollWidth <= element.clientWidth + 2
        );
      }),
    ).toBe(true);
  for (const input of await page
    .locator(".invoice-details-form input, .invoice-line-form input")
    .all())
    expect((await input.boundingBox())!.width).toBeLessThanOrEqual(640);
  const documentPane = (await page
    .locator(".invoice-document-pane")
    .boundingBox())!;
  const reviewPane = (await page
    .locator(".invoice-review-pane")
    .boundingBox())!;
  expect(documentPane.x + documentPane.width).toBeLessThan(reviewPane.x);
  await page
    .getByLabel("Unit cost before tax", { exact: true })
    .last()
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeInViewport();
});

test("dashboard approvals and notes have actions that change the actual records and navigate to their lists", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  for (const heading of [
    "Approvals queue",
    "Alerts",
    "Recent invoices",
    "Returns",
    "Supplier balances",
    "Notes for Supervisor",
    "Activity",
  ])
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  const notes = page.locator(".dashboard-aside .card").filter({
    has: page.getByRole("heading", {
      name: "Notes for Supervisor",
      exact: true,
    }),
  });
  await notes
    .getByRole("button", { name: "View", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true, level: 1 }),
  ).toBeVisible();
  await page.goto("/#dashboard");
  const lavash = page
    .locator(".dashboard-queue-row")
    .filter({ hasText: "Lavash Bread 500 g" });
  await lavash.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Review approval",
    exact: true,
  });
  await chooseOption(
    page,
    dialog.getByLabel("Apply price to", { exact: true }),
    "all",
    "All branches",
  );
  await dialog
    .getByRole("button", { name: "Approve price", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Approved price");
  await page.goto("/#lookup?search=0006");
  await expect(page.locator(".price")).toHaveText("$2.99");
  await expect(
    page
      .locator(".lookup-detail")
      .getByText("New price pending", { exact: true }),
  ).toHaveCount(0);
});
