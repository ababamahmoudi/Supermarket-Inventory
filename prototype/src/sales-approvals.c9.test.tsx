import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { initialState } from "./e1-bootstrap";
import { DemoProvider, useDemo } from "./store";
import { Approvals } from "./screens/Approvals";
import i18n from "./i18n";
import type { SaleRequest } from "./sales";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
afterEach(() => {
  cleanup();
  fixture?.dispose();
});
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "approvals";
  await i18n.changeLanguage("en");
});
function Harness() {
  const { actor } = useDemo();
  return actor ? <Approvals /> : null;
}

async function prepare(statuses: SaleRequest["status"][]) {
  const state = initialState();
  const base = state.sale_requests![0];
  state.approvals = [];
  state.sales = [];
  state.sale_requests = statuses.map((status, index) => ({
    ...base,
    id: `c9-sale-request-${index}`,
    status,
    revision: 2,
    requested_price: "7.99",
    starts_on: "2026-10-10",
    last_day: "2026-10-28",
    decided_by: "Demo Manager",
    decided_at: "2026-10-17T19:02:00Z",
    decision_reason:
      status === "rejected" ? "Keep the regular price this week." : undefined,
    approved_terms:
      status === "approved"
        ? {
            sale_id: "c9-approved-sale",
            sale_revision: 1,
            sale_price: "6.99",
            price_unit: "each",
            starts_on: "2026-10-17",
            last_day: "2026-10-29",
          }
        : undefined,
  }));
  fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  await screen.findByRole("tab", { name: /Approved/ });
}

it("keeps approved terms, rejection evidence and expired/withdrawn outcomes in their counted tabs without actions", async () => {
  await prepare(["approved", "rejected", "expired", "withdrawn"]);
  const user = userEvent.setup();
  expect(screen.getByRole("tab", { name: "Pending 0" })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Approved 1" }));
  const approved = document.querySelector(
    '[data-sale-request-id="c9-sale-request-0"]',
  ) as HTMLElement;
  expect(approved).toHaveTextContent("$6.99");
  expect(approved).not.toHaveTextContent("$7.99");
  expect(approved).toHaveTextContent("2026-10-29");
  expect(approved).toHaveTextContent("Demo Manager");
  expect(within(approved).queryAllByRole("button")).toHaveLength(0);
  await user.click(screen.getByRole("tab", { name: "Rejected 1" }));
  const rejected = document.querySelector(
    '[data-sale-request-id="c9-sale-request-1"]',
  ) as HTMLElement;
  expect(rejected).toHaveTextContent("Keep the regular price this week.");
  expect(rejected).toHaveTextContent("Rejected by");
  expect(rejected).toHaveTextContent("Demo Manager");
  expect(within(rejected).queryAllByRole("button")).toHaveLength(0);
  await user.click(screen.getByRole("tab", { name: "Superseded 2" }));
  expect(screen.getByText("Withdrawn", { exact: true })).toBeInTheDocument();
  expect(
    screen.getAllByText("Expired", { exact: true }).length,
  ).toBeGreaterThan(0);
  expect(
    document.querySelectorAll(".sale-request-actions button"),
  ).toHaveLength(0);
});

it("reserves the invoice proposal hint for an empty Pending tab", async () => {
  await prepare([]);
  const user = userEvent.setup();
  expect(
    screen.getByText(/Receive an invoice to create a proposal/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Rejected 0" }));
  expect(screen.getByText("No rejected requests yet.")).toBeInTheDocument();
  expect(screen.queryByText(/Receive an invoice/)).not.toBeInTheDocument();
});
