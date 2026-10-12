import { beforeEach, expect, it } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, useDemo } from "../store";
import { SESSION_KEY } from "../auth";
import i18n from "../i18n";
import Payables from "./Payables";
import Orders from "./Orders";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#payables";
  await i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
});
function Harness({ page }: { page: "payables" | "orders" }) {
  const { state } = useDemo();
  return (
    <>
      {page === "payables" ? <Payables /> : <Orders />}
      <output data-testid="ledger-json">{JSON.stringify(state.ledger)}</output>
      <output data-testid="orders-json">{JSON.stringify(state.orders)}</output>
    </>
  );
}
it("blocks incomplete payment without a ledger write, links to the missing field and posts once after confirmation", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness page="payables" />
    </DemoProvider>,
  );
  const before = screen.getByTestId("ledger-json").textContent!;
  await user.click(
    screen.getByRole("button", { name: "Record external payment" }),
  );
  await user.clear(screen.getByLabelText("Payment amount"));
  await user.click(
    screen.getByRole("button", { name: "Preview oldest-due allocations" }),
  );
  const amountList = screen.getByRole("alert", { name: "What's missing" });
  await user.click(within(amountList).getByRole("link"));
  expect(screen.getByLabelText("Payment amount")).toHaveFocus();
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
  await user.type(screen.getByLabelText("Payment amount"), "10.00");
  await user.click(
    screen.getByRole("button", { name: "Preview oldest-due allocations" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Confirm and record payment" }),
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
    screen.getByRole("button", { name: "Confirm and record payment" }),
  );
  const confirm = screen.getByRole("dialog", {
    name: "Record external payment",
  });
  await user.click(
    within(confirm).getByRole("button", { name: "Confirm and record payment" }),
  );
  const ledger = JSON.parse(screen.getByTestId("ledger-json").textContent!);
  expect(ledger).toHaveLength(JSON.parse(before).length + 1);
  expect(ledger.at(-1)).toMatchObject({
    type: "payment",
    amount: "-10.00",
    reference: "C6-EXTERNAL-PAYMENT",
    branch: "Branch 1",
  });
});
it("lists every missing ledger field and clears only the edited hint before a guarded confirmed save", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness page="payables" />
    </DemoProvider>,
  );
  const before = screen.getByTestId("ledger-json").textContent!;
  await user.click(
    screen.getByRole("button", { name: "Record external payment" }),
  );
  await user.click(
    screen.getByRole("button", {
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
  expect(
    JSON.parse(screen.getByTestId("ledger-json").textContent!).at(-1),
  ).toMatchObject({
    type: "adjustment",
    amount: "-5.00",
    reference: "C6-ADJUSTMENT-VALIDATION",
  });
});
it("explains missing order supplier and invalid selected quantity without saving, then places valid cases without changing money", async () => {
  const user = userEvent.setup();
  window.location.hash = "#orders";
  render(
    <DemoProvider>
      <Harness page="orders" />
    </DemoProvider>,
  );
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
  const cases = screen.getAllByRole("textbox", { name: /^Cases —/ })[0];
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
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "all",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
  render(
    <DemoProvider>
      <Harness page="payables" />
    </DemoProvider>,
  );
  const before = screen.getByTestId("ledger-json").textContent!;
  await user.click(
    screen.getByRole("button", { name: "Record external payment" }),
  );
  const preview = screen.getByRole("button", {
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
    screen.getByRole("combobox", { name: "Payables branch" }),
  ).toHaveFocus();
  expect(screen.getByTestId("ledger-json").textContent).toBe(before);
});
