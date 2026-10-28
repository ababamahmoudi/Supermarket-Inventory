import type { Page } from "@playwright/test";

/** D7 only stretches the two real purchase cards while they occupy one grid row. */
export async function inspectDashboardCardLayout(page: Page) {
  return page.evaluate(() => {
    const failures: string[] = [];
    const pairs = [
      ...document.querySelectorAll(
        ".r2c-dashboard .dashboard-main > .dashboard-purchase-pair",
      ),
    ];
    if (pairs.length !== 1) failures.push("Expected one actual purchase grid");
    const pair = pairs[0];
    const purchases = pair ? [...pair.querySelectorAll(":scope > .card")] : [];
    const expectedChildren =
      purchases.length === 2 &&
      purchases[0].classList.contains("dashboard-supplier-purchases") &&
      purchases[1].classList.contains("dashboard-weekly-purchases");
    if (!expectedChildren) failures.push("Expected both actual purchase cards");
    const purchaseBounds = purchases.map((card) =>
      card.getBoundingClientRect(),
    );
    const columns = pair ? getComputedStyle(pair).gridTemplateColumns : "";
    const sameRow =
      expectedChildren &&
      getComputedStyle(pair).display === "grid" &&
      columns.split(/\s+/).length === 2 &&
      Math.abs(purchaseBounds[0].top - purchaseBounds[1].top) <= 1.5 &&
      Math.min(purchaseBounds[0].right, purchaseBounds[1].right) <=
        Math.max(purchaseBounds[0].left, purchaseBounds[1].left) + 1.5;
    const cards = [
      ...document.querySelectorAll(".r2c-dashboard .dashboard-layout .card"),
    ]
      .filter((card) => card.getBoundingClientRect().height > 0)
      .map((card) => {
        const bounds = card.getBoundingClientRect();
        const paired = sameRow && purchases.includes(card);
        const alignSelf = getComputedStyle(card).alignSelf;
        const title = card.querySelector("h2")?.textContent ?? card.className;
        if (alignSelf !== (paired ? "stretch" : "start"))
          failures.push(
            `${title}: ${paired ? "paired" : "natural"} card is ${alignSelf}`,
          );
        return {
          title,
          paired,
          alignSelf,
          height: bounds.height,
          top: bounds.top,
        };
      });
    if (!cards.length) failures.push("No actual dashboard cards measured");
    if (
      sameRow &&
      Math.abs(purchaseBounds[0].height - purchaseBounds[1].height) > 1.5
    )
      failures.push("Paired purchase card heights differ");
    return { cards, sameRow, columns, failures };
  });
}
