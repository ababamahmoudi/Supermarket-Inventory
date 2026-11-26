import { afterEach, beforeEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, initialState, useDemo } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";

import i18n from "../i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";
import Payables from "./Payables";
import Orders from "./Orders";

// Vitest stubs CSS imports, so mount the actual production visibility rules.
const payablesStyles = readFileSync(
  resolve(process.cwd(), "src/screens/payables-klead.css"),
  "utf8",
);
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#payables";
  await i18n.changeLanguage("en");
});
async function renderFinance(page: "payables" | "orders", all = false) {
  const fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
    actorOptions: {
      selection: all
        ? { kind: "all_locations" }
        : { kind: "location", location_id: "Branch 1" },
    },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Harness page={page} />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(
      screen.queryByRole("button", {
        name: page === "payables" ? "Record external payment" : "New order",
      }),
    ),
  );
  await screen.findByRole("button", {
    name: page === "payables" ? "Record external payment" : "New order",
  });
  return fixture;
}

function Harness({ page }: { page: "payables" | "orders" }) {
  const { state } = useDemo();
  return (
    <>
      {page === "payables" ? (
        <>
          <style>{payablesStyles}</style>
          <Payables />
        </>
      ) : (
        <Orders />
      )}
      <output data-testid="ledger-json">{JSON.stringify(state.ledger)}</output>
      <output data-testid="orders-json">{JSON.stringify(state.orders)}</output>
    </>
  );
}
it("blocks incomplete payment without a ledger write, links to the missing field and posts once after confirmation", async () => {
  const user = userEvent.setup();
  await renderFinance("payables");
  const before = screen.getByTestId("ledger-json").textContent!;
  await user.click(
    screen.getByRole("button", { name: "Record external payment" }),
  );
  await user.clear(await screen.findByLabelText("Payment amount"));
  await user.click(
    await screen.findByRole("button", {
      name: "Preview oldest-due allocations",
    }),
  );
  const amountList = screen.getByRole("alert", { name: "What's missing" });
  await user.click(within(amountList).getByRole("link"));
  expect(await screen.findByLabelText("Payment amount")).toHaveFocus();
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
  await user.type(await screen.findByLabelText("Payment amount"), "10.00");
  await user.click(
    await screen.findByRole("button", {
      name: "Preview oldest-due allocations",
    }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Confirm and record payment" }),
  );
  const receiptList = screen.getByRole("alert", { name: "What's missing" });
  await user.click(
    within(receiptList).getByRole("link", {
      name: "Enter the payment receipt reference.",
    }),
  );
  expect(screen.getByLabelText("Payment receipt reference")).toHaveFocus();
  expect(screen.getByLabelText("Payment receipt reference")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
  await user.type(
    screen.getByLabelText("Payment receipt reference"),
    "C6-EXTERNAL-PAYMENT",
  );
  await user.click(
    await screen.findByRole("button", { name: "Confirm and record payment" }),
  );
  const confirm = await screen.findByRole("dialog", {
    name: "Record external payment",
  });
  await user.click(
    within(confirm).getByRole("button", { name: "Confirm and record payment" }),
  );
  await waitFor(() => {
    const ledger = JSON.parse(screen.getByTestId("ledger-json").textContent!);
    expect(ledger).toHaveLength(JSON.parse(before).length + 1);
    expect(ledger.at(-1)).toMatchObject({
      type: "payment",
      amount: "-10.00",
      reference: "C6-EXTERNAL-PAYMENT",
      branch: "Branch 1",
    });
  });
});
it("lists every missing ledger field and clears only the edited hint before a guarded confirmed save", async () => {
  const user = userEvent.setup();
  await renderFinance("payables");
  const before = screen.getByTestId("ledger-json").textContent!;
  await user.click(
    screen.getByRole("button", { name: "Record external payment" }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Record opening balance, credit, or adjustment",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Record ledger entry" }));
  const missing = screen.getByRole("alert", { name: "What's missing" });
  expect(within(missing).getAllByRole("link")).toHaveLength(3);
  await user.click(
    within(missing).getByRole("link", {
      name: "Enter the evidence reference.",
    }),
  );
  expect(screen.getByLabelText("Evidence reference")).toHaveFocus();
  await user.type(
    screen.getByLabelText("Evidence reference"),
    "C6-ADJUSTMENT-VALIDATION",
  );
  expect(within(missing).getAllByRole("link")).toHaveLength(2);
  expect(
    screen.getByLabelText("Signed amount (credits are negative)"),
  ).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
  await user.type(
    screen.getByLabelText("Signed amount (credits are negative)"),
    "-5.00",
  );
  await user.type(
    screen.getByLabelText("Reason / dispute note (required)"),
    "Fictional supported supplier correction",
  );
  await user.click(screen.getByRole("button", { name: "Record ledger entry" }));
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Record ledger entry" }),
    ).getByRole("button", { name: "Record ledger entry" }),
  );
  await waitFor(() => {
    expect(
      JSON.parse(screen.getByTestId("ledger-json").textContent!).at(-1),
    ).toMatchObject({
      type: "adjustment",
      amount: "-5.00",
      reference: "C6-ADJUSTMENT-VALIDATION",
    });
  });
});
it("explains missing order supplier and invalid selected quantity without saving, then places valid cases without changing money", async () => {
  const user = userEvent.setup();
  window.location.hash = "#orders";
  await renderFinance("orders");
  const ledgerBefore = screen.getByTestId("ledger-json").textContent!,
    ordersBefore = screen.getByTestId("orders-json").textContent!;
  await user.click(screen.getByRole("button", { name: "New order" }));
  await user.click(screen.getByRole("button", { name: "Save as draft" }));
  const supplierList = screen.getByRole("alert", { name: "What's missing" });
  await user.click(within(supplierList).getByRole("link"));
  expect(screen.getByLabelText("Supplier")).toHaveFocus();
  expect(screen.getByTestId("orders-json").textContent).toBe(ordersBefore);
  await user.click(screen.getByLabelText("Supplier"));
  await user.click(screen.getByRole("option", { name: "Fresh Valley Foods" }));
  await user.click(screen.getByRole("button", { name: "Place order" }));
  const emptyList = screen.getByRole("alert", { name: "What's missing" });
  await user.click(within(emptyList).getByRole("link"));
  expect(document.getElementById("order-items")).toHaveFocus();
  const cases = (
    await screen.findAllByRole("textbox", { name: /^Cases —/ })
  )[0];
  fireEvent.change(cases, { target: { value: "0.1" } });
  await user.click(screen.getByRole("button", { name: "Place order" }));
  const quantityList = screen.getByRole("alert", { name: "What's missing" });
  await user.click(within(quantityList).getByRole("link"));
  expect(cases).toHaveFocus();
  expect(cases).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByTestId("orders-json").textContent).toBe(ordersBefore);
  fireEvent.change(cases, { target: { value: "1" } });
  await user.click(screen.getByRole("button", { name: "Place order" }));
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByTestId("orders-json").textContent!).at(-1).status,
    ).toBe("ordered"),
  );
  expect(screen.getByTestId("ledger-json").textContent).toBe(ledgerBefore);
});
it("explains All branches on payment preview and links to the actual branch chooser without writing money", async () => {
  const user = userEvent.setup();
  await renderFinance("payables", true);
  const before = screen.getByTestId("ledger-json").textContent!;
  await user.click(
    screen.getByRole("button", { name: "Record external payment" }),
  );
  const preview = await screen.findByRole("button", {
    name: "Preview oldest-due allocations",
  });
  expect(preview).not.toBeDisabled();
  await user.click(preview);
  const missing = screen.getByRole("alert", { name: "What's missing" });
  await user.click(
    within(missing).getByRole("link", {
      name: "Choose one branch before recording this action.",
    }),
  );
  expect(
    screen.getByRole("combobox", { name: "Statement location" }),
  ).toHaveFocus();
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
});

it("C7 supplier rows open their ledger by keyboard and chevron without posting money", async () => {
  const user = userEvent.setup();
  await renderFinance("payables");
  const before = screen.getByTestId("ledger-json").textContent!;
  const row = screen.getByRole("row", { name: "Fresh Valley Foods" });
  row.focus();
  await user.keyboard("{Enter}");
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("heading", { name: "Fresh Valley Foods" })),
  );
  expect(
    await screen.findByRole("heading", { name: "Fresh Valley Foods" }),
  ).toBeVisible();
  expect(window.location.hash).toMatch(/^#payables\?supplier=/);
  expect(document.querySelector(".payables-overview")).toBeNull();
  await user.click(screen.getByRole("button", { name: "All suppliers" }));
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("row", { name: "Golden Grain Distributors" })),
  );
  const next = screen.getByRole("row", { name: "Golden Grain Distributors" });
  await user.click(
    within(next).getByRole("link", { name: "View Golden Grain Distributors" }),
  );
  await renderedUiReady(() =>
    Boolean(
      screen.queryByRole("heading", { name: "Golden Grain Distributors" }),
    ),
  );
  expect(
    await screen.findByRole("heading", { name: "Golden Grain Distributors" }),
  ).toBeVisible();
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
});

it("C7 order rows navigate to the saved order by keyboard without replacing its data", async () => {
  const user = userEvent.setup();
  window.location.hash = "#orders";
  await renderFinance("orders");
  await user.click(screen.getByRole("button", { name: "New order" }));
  await user.click(screen.getByLabelText("Supplier"));
  await user.click(screen.getByRole("option", { name: "Fresh Valley Foods" }));
  fireEvent.change(
    (await screen.findAllByRole("textbox", { name: /^Cases —/ }))[0],
    {
      target: { value: "1" },
    },
  );
  await user.click(screen.getByRole("button", { name: "Save as draft" }));
  await renderedUiReady(() => /#orders\?id=/.test(window.location.hash));
  await waitFor(() => expect(window.location.hash).toMatch(/#orders\?id=/));
  const retained = screen.getByTestId("orders-json").textContent!;
  const ledger = screen.getByTestId("ledger-json").textContent!;
  const order = JSON.parse(retained).at(-1);
  await user.click(
    await screen.findByRole("button", { name: "Back to Orders" }),
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("row", { name: order.reference })),
  );
  const row = await screen.findByRole("row", { name: order.reference });
  expect(
    within(row).getByRole("link", { name: `View ${order.reference}` }),
  ).toBeVisible();
  expect(
    within(row).queryByRole("button", { name: order.reference }),
  ).toBeNull();
  row.focus();
  await user.keyboard("{Enter}");
  await renderedUiReady(
    () => window.location.hash === `#orders?id=${encodeURIComponent(order.id)}`,
  );
  await waitFor(() =>
    expect(window.location.hash).toBe(
      `#orders?id=${encodeURIComponent(order.id)}`,
    ),
  );
  expect(screen.getByTestId("orders-json").textContent).toBe(retained);
  expect(screen.getByTestId("ledger-json").textContent).toBe(ledger);
});
