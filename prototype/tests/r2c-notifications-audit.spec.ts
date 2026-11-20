import { expect, test, type Page } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { setLanguage, signIn } from "./helpers";

async function openInbox(page: Page, language: "en" | "fa" = "en") {
  await page.goto("/");
  await signIn(page, "manager");
  await page.goto("/#product?code=0004");
  await expect(page.locator(".product-header-actions")).toBeVisible();
  await setLanguage(page, language);
  await page.locator(".topbar .notifications-menu").click();
  await expect(
    page.locator(".notifications-popover .personal-notification").first(),
  ).toBeVisible();
}
async function proof(page: Page) {
  return inspect(
    page,
    "Notification inbox",
    test.info().project.name,
    "manager",
  );
}

for (const language of ["en", "fa"] as const)
  test(`C5 accepts only the real bounded inbox's two 44px header actions (${language})`, async ({
    page,
  }) => {
    await openInbox(page, language);
    const result = await proof(page);
    expect(result.failures).toEqual([]);
    const captions =
      language === "en"
        ? ["Mark all as read", "Clear all"]
        : ["همه را خوانده‌شده علامت بزن", "پاک کردن همه"];
    const measured = result.buttons.filter((button) =>
      captions.includes(button.label),
    );
    expect(measured).toHaveLength(2);
    expect(
      measured.every(
        (button) => button.kind === "action" && button.height === 44,
      ),
    ).toBe(true);
  });

test("C5 rejects a real inbox header shrunk below its explicit action height", async ({
  page,
}) => {
  await openInbox(page);
  await page
    .locator(".personal-notifications-actions > button")
    .first()
    .evaluate((element) => {
      for (const property of ["block-size", "min-block-size", "max-block-size"])
        element.style.setProperty(property, "40px", "important");
    });
  expect(
    (await proof(page)).failures.some((failure) =>
      /Notification header actions require/.test(failure),
    ),
  ).toBe(true);
});

test("C5 rejects a notification panel with its sticky header missing", async ({
  page,
}) => {
  await openInbox(page);
  await page
    .locator(".personal-notifications-header")
    .evaluate((element) => element.remove());
  expect(
    (await proof(page)).failures.some((failure) =>
      /Notification inbox requires/.test(failure),
    ),
  ).toBe(true);
});

test("C5 rejects a copied inbox class and structure without its real expanded bell", async ({
  page,
}) => {
  await openInbox(page);
  await page.locator(".notifications-popover").evaluate((element) => {
    const copied = element.cloneNode(true) as HTMLElement;
    document
      .querySelector(".topbar .notifications-menu")
      ?.setAttribute("aria-expanded", "false");
    element.replaceWith(copied);
  });
  const failures = (await proof(page)).failures;
  expect(
    failures.some((failure) => /Notification inbox requires/.test(failure)),
  ).toBe(true);
  expect(
    failures.some((failure) =>
      /Invalid notification header action composition/.test(failure),
    ),
  ).toBe(true);
});
