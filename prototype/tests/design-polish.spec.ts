import { expect, test, type Page } from "@playwright/test";
import configuration from "../../seed/arzon-config.json" with { type: "json" };
import { setLanguage, signIn, uploadInvoice, openShellAction } from "./helpers";

const routes = [
  "dashboard",
  "lookup",
  "products",
  "product?code=0006",
  "suppliers",
  "suppliers?name=Fresh%20Valley%20Foods",
  "return?id=demo-return-1",
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
    const shadowProbe = document.createElement("div");
    shadowProbe.style.boxShadow = "var(--shadow-card)";
    document.body.append(shadowProbe);
    const approvedCardShadow = getComputedStyle(shadowProbe).boxShadow;
    shadowProbe.remove();
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
          style.boxShadow !== approvedCardShadow
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
    await signIn(page, "Manager");
    if (variant === "dark")
      await (await openShellAction(page, "Switch to dark theme")).click();
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
  await page.clock.install({ time: new Date() });
  await signIn(page, "Manager");
  await page.goto("/#settings");
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const top = await page.locator(".topbar").boundingBox();
  expect(top!.y).toBeGreaterThanOrEqual(0);
  expect(top!.y).toBeLessThanOrEqual(2);
  // Advance the real browser source clock beyond the configured freshness
  // window, keeping activity inside the idle-lock window. No identity, role,
  // session timestamp or authority record is manufactured or overwritten.
  for (
    let minute = 0;
    minute <= configuration.session.reprompt_password_after_minutes;
    minute++
  ) {
    await page.mouse.move(48 + minute, 8);
    await page.clock.fastForward(60_000);
  }
  await page.mouse.move(80, 8);
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
  await (await openShellAction(page, "Switch to dark theme")).click();
  await assertPresentation(page);
  await setLanguage(page, "fa");
  await assertPresentation(page);
});
