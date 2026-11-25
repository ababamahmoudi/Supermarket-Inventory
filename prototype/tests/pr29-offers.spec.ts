import { expect, test, type Page } from "@playwright/test";
import { setLanguage } from "./helpers";
import { createOfferSuggestion } from "./pr29-price-updates-helpers";

test.setTimeout(120_000);

const englishMonths =
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d/;
const persianMonthNames =
  "ژانویه|فوریه|مارس|آوریل|مه|ژوئن|ژوئیه|اوت|سپتامبر|اکتبر|نوامبر|دسامبر";
/** A Gregorian month name written next to a day number ("۵ دسامبر", "Dec 5"). */
const persianMonths = new RegExp(
  `[0-9۰-۹]\\s*(${persianMonthNames})(?![\\u0600-\\u06FF])|(?<![\\u0600-\\u06FF])(${persianMonthNames})\\s*[0-9۰-۹]`,
);

async function offerText(page: Page) {
  const texts: string[] = [];
  for (const tab of [0, 1, 2]) {
    await page.locator("main").getByRole("tab").nth(tab).click();
    await page.waitForTimeout(200);
    texts.push(await page.locator("main").innerText());
  }
  await page.locator("main").getByRole("tab").first().click();
  return texts.join("\n");
}

test.describe("PR 29 Offers", () => {
  test.beforeEach(async ({ page }, info) => {
    void page;
    test.skip(info.project.name !== "desktop", "One walk is enough.");
  });

  test("each suggestion is its own box with its own Dismiss and Confirm; the empty state sits inside the card", async ({
    page,
  }) => {
    await createOfferSuggestion(page);
    await page.goto("/#offers");
    const card = page.locator(".offer-suggestions-card");
    await expect(card).toHaveCount(1);
    await expect(
      card.getByRole("heading", { name: "Offer suggestions" }),
    ).toBeVisible();
    const boxes = card.locator(".offer-suggestion-row");
    await expect(boxes).toHaveCount(1);
    for (const box of await boxes.all()) {
      await expect(box.getByRole("button", { name: "Dismiss" })).toHaveCount(1);
      await expect(
        box.getByRole("button", { name: /^Confirm offer/ }),
      ).toHaveCount(1);
      // Dismiss comes before the one primary Confirm.
      const order = await box
        .locator(".offer-suggestion-actions > button")
        .allInnerTexts();
      expect(order).toEqual(["Dismiss", "Confirm offer"]);
    }
    for (const width of [1440, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      // One row: what it is, its options, then the actions, side by side.
      const tops = await boxes
        .first()
        .evaluate((box) =>
          [
            ".offer-suggestion-what",
            ".offer-suggestion-options",
            ".offer-suggestion-actions",
          ].map((selector) =>
            box.querySelector(selector)!.getBoundingClientRect(),
          ),
        );
      expect(tops[1].left).toBeGreaterThanOrEqual(tops[0].right - 1);
      expect(tops[2].left).toBeGreaterThanOrEqual(tops[1].right - 1);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    const stacked = await boxes.first().evaluate((box) => {
      const what = box
        .querySelector(".offer-suggestion-what")!
        .getBoundingClientRect();
      const actions = box
        .querySelector(".offer-suggestion-actions")!
        .getBoundingClientRect();
      return actions.top >= what.bottom - 1;
    });
    expect(stacked).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await boxes.first().getByRole("button", { name: "Dismiss" }).click();
    await expect(card.locator(".offers-empty-suggestions")).toContainText(
      "No suggestions waiting",
    );
    await expect(page.locator("main .offers-empty-suggestions")).toHaveCount(1);
  });

  test("every Offers date is YYYY-MM-DD in English and Persian; pools show chips under a one-line caption", async ({
    page,
  }) => {
    await createOfferSuggestion(page);
    await page.goto("/#offers");
    await expect(page.locator(".current-offers-table")).toBeVisible();
    const english = await offerText(page);
    expect(english).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(english).not.toMatch(englishMonths);
    await page
      .locator("main")
      .getByRole("tab", { name: "Mix-and-match pools" })
      .click();
    const caption = page.locator(".offer-pools-caption");
    await expect(caption).toBeVisible();
    const lines = await caption.evaluate((node) => {
      const style = getComputedStyle(node);
      return Math.round(
        node.getBoundingClientRect().height / parseFloat(style.lineHeight),
      );
    });
    expect(lines).toBe(1);
    const pool = page.locator(".offer-pool").filter({
      has: page.getByRole("heading", { name: "2 for $5.00", exact: true }),
    });
    await expect(pool.locator(".offer-pool-chip")).toHaveCount(2);
    await expect(pool.locator(".offer-pool-chip").first()).toHaveCSS(
      "color",
      await page
        .locator("a.entity-link")
        .first()
        .evaluate((node) => getComputedStyle(node).color),
    );
    await setLanguage(page, "fa");
    await page.locator("main").getByRole("tab").first().click();
    await expect(page.locator(".current-offers-table")).toBeVisible();
    const persian = await offerText(page);
    expect(persian).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(persian).not.toMatch(persianMonths);
    expect(persian).not.toMatch(englishMonths);
  });
});
