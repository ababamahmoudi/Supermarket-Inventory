import { expect, test } from "@playwright/test";
import { setBranch, signIn } from "./helpers";

test("C9 offer suggestions use field tint and level desktop dates/actions", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  const { runCanonicalBusinessFixture } = await import("./business-fixture");
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      const product = state.products.find((row) => row.code === "0009")!;
      const mapping = state.config.promotions.price_to_offer.find(
        (row) => row.price === "3.99",
      )!;
      product.selling_price = "3.99";
      product.branch_prices = { ...product.branch_prices, "Branch 1": "3.99" };
      state.offers.push({
        id: "r2e-fictional-suggestion",
        company_id: product.company_id,
        branch: "Branch 1",
        product_code: product.code,
        label: mapping.offer,
        price: "3.99",
        pool: mapping.mix_and_match_pool,
        currency: state.config.company.currency,
        status: "suggested",
        mix_and_match: true,
        scope: "branch",
      });
    },
    undefined,
  );
  await page.goto("/#offers");
  await page.reload();
  const card = page.locator(".r2c-offer-task").first();
  await expect(card).toBeVisible();
  const colors = await card.evaluate((node) => {
    const style = getComputedStyle(node);
    const probe = document.createElement("span");
    probe.style.background = "var(--field-fill)";
    node.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      actual: style.backgroundColor,
      expected,
      border: style.borderTopWidth,
    };
  });
  expect(colors.actual).toBe(colors.expected);
  expect(colors.border).toBe("0px");
  if (testInfo.project.name === "desktop") {
    const controls = card.locator(
      ".r2e-offer-decision-row .ui-date, .r2e-offer-decision-row .actions > button",
    );
    const boxes = await controls.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { center: r.y + r.height / 2, height: r.height };
      }),
    );
    expect(boxes).toHaveLength(4);
    expect(
      Math.max(...boxes.map((b) => b.center)) -
        Math.min(...boxes.map((b) => b.center)),
    ).toBeLessThanOrEqual(1.5);
  }
});
