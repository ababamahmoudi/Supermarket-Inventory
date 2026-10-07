import { expect, test, type Page } from "@playwright/test";
import { setLanguage, signIn, uploadInvoice } from "./helpers";

const routes = [
  "dashboard",
  "lookup",
  "products",
  "invoices",
  "approvals",
  "alerts",
  "offers",
  "returns",
  "expiry",
  "notes",
  "labels",
  "payables",
  "settings",
];

async function assertPresentation(page: Page) {
  const failures = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        style.clipPath === "none" &&
        rect.width > 4 &&
        rect.height > 4
      );
    };
    const native = [
      ...document.querySelectorAll(
        'select, details, input[type="file"], input[type="checkbox"], input[type="radio"], input[type="date"], input[type="time"], input[type="month"], input[type="number"]',
      ),
    ]
      .filter(visible)
      .map((element) => element.outerHTML.slice(0, 160));
    const resize = [...document.querySelectorAll("textarea")]
      .filter(visible)
      .filter((element) => getComputedStyle(element).resize !== "none")
      .map((element) => element.outerHTML.slice(0, 160));
    const cards = [...document.querySelectorAll(".card")]
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ].some((width) => parseFloat(width) !== 0) ||
          style.boxShadow !== "none"
        );
      })
      .map((element) => element.className);
    return {
      native,
      resize,
      cards,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(failures).toEqual({
    native: [],
    resize: [],
    cards: [],
    overflow: false,
  });
}

for (const variant of ["light", "dark", "Persian"] as const) {
  test(`all existing screens use styled controls and bounded layout in ${variant}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await assertPresentation(page);
    await signIn(page, "Supervisor");
    if (variant === "dark")
      await page
        .getByRole("button", { name: "Switch to dark theme", exact: true })
        .click();
    if (variant === "Persian") await setLanguage(page, "fa");
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator("#main-content h1")).toBeVisible();
      await assertPresentation(page);
      expect(
        await page
          .locator(".topbar")
          .evaluate((element) => getComputedStyle(element).position),
      ).toBe("sticky");
    }
    expect(errors).toEqual([]);
  });
}

test("Persian lookup preserves unit order and makes the Persian name primary", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  await setLanguage(page, "fa");
  await page.getByLabel("جست‌وجوی محصولات", { exact: true }).fill("0003");
  const primary = page
    .locator(".lookup-result-row .lookup-result-name > strong")
    .first();
  await expect(primary).toContainText("آلبالو");
  const units = page.locator(".lookup-detail bdi").filter({ hasText: /^1 L$/ });
  await expect(units).toHaveText("1 L");
  await expect(units).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".lookup-detail .price")).toHaveText("$2.99");
});

test("re-check dialog is centered and the top bar remains visible while Settings scrolls", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#settings");
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const top = await page.locator(".topbar").boundingBox();
  expect(top!.y).toBeGreaterThanOrEqual(0);
  expect(top!.y).toBeLessThanOrEqual(2);
  await page.evaluate(() => {
    const key = "supermarket-prototype-session-v2";
    const session = JSON.parse(sessionStorage.getItem(key)!);
    session.authenticatedAt = Date.now() - 16 * 60 * 1000;
    session.lastActivityAt = Date.now();
    sessionStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  const dialog = page.getByRole("dialog", {
    name: "Confirm your password",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
  ).toBeLessThan(3);
  expect(
    Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2),
  ).toBeLessThan(3);
  await expect(dialog.getByLabel("Password", { exact: true })).toBeFocused();
  await dialog.getByLabel("Password", { exact: true }).fill("demo1234");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("invoice review retains styled controls after simulated extraction", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await uploadInvoice(page);
  await assertPresentation(page);
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await assertPresentation(page);
  await setLanguage(page, "fa");
  await assertPresentation(page);
});
