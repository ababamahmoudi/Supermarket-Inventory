import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { DemoProvider, initialState } from "./store";
import { Approvals } from "./screens/Approvals";
import i18n from "./i18n";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "./test/rendered-ui-readiness";
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
it("presents first prices, margin warnings and one ordered action row without duplicate product names", async () => {
  const state = initialState();
  state.sale_requests = [];
  state.approvals = state.products
    .slice(0, 2)
    .map((product, index) => ({
      id: `r2c-row-${index}`,
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      product_code: product.code,
      status: "pending",
      type: index === 0 ? "new_product" : "price_change",
      proposed_price: "4.99",
      current_price: index === 0 ? "" : "3.99",
      unit_cost: "4.0000",
      margin: "0.1984",
      threshold: "0.25",
    }));
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  const { container } = render(
    <DemoProvider options={fixture.options}>
      <Approvals />
    </DemoProvider>,
  );
  await renderedUiReady(
    () => container.querySelectorAll(".approval-detail-row").length === 2,
  );
  const rows = container.querySelectorAll<HTMLElement>(".approval-detail-row");
  expect(screen.getByText("first price")).toBeVisible();
  expect(screen.queryByText("Old price")).not.toBeInTheDocument();
  for (const [index, row] of [...rows].entries()) {
    const heading = within(row).getByRole("heading", { level: 2 });
    expect(heading.querySelector("a")).toHaveAttribute(
      "href",
      `#product?code=${state.products[index].code}`,
    );
    expect(row.querySelectorAll(".approval-row-heading h2")).toHaveLength(1);
    expect(within(row).getByText("Below minimum")).toBeVisible();
    expect(row.querySelector(".approval-margin")).toHaveClass(
      "is-below-minimum",
    );
    const actions = Array.from(
      row.querySelectorAll<HTMLButtonElement>(
        ".approval-decision-actions > button",
      ),
    );
    expect(actions.map((button) => button.textContent)).toEqual([
      "Edit and approve",
      "Reject",
      "Approve",
    ]);
    expect(actions[0]).toHaveClass("button-secondary");
    expect(actions[1]).toHaveClass("button-danger");
    expect(actions[2]).toHaveClass("button-primary");
  }
});
