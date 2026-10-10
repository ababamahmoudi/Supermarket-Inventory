import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { applyApprovedPrice } from "../approvals";
import i18n from "../i18n";
import { DemoProvider, useDemo } from "../store";
import Alerts from "./Alerts";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});

function Harness() {
  const { state, update, switchDemoUser } = useDemo();
  const conflict = state.alerts.find(
    (alert) => alert.type === "price_conflict",
  );
  return (
    <>
      <button onClick={() => switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button
        onClick={() => {
          if (!conflict) throw new Error("The demo price conflict is missing");
          update((draft) =>
            applyApprovedPrice(
              draft,
              conflict.product_code,
              "2.49",
              "branch",
              "Branch 1",
            ),
          );
        }}
      >
        Record another employee's price change
      </button>
      <Alerts />
    </>
  );
}

it("announces a stale price comparison at its alert and clears it when a fresh price is chosen", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Use Supervisor" }));
  await user.click(
    screen.getAllByRole("button", { name: "Apply this price to all" })[0],
  );
  const dialog = screen.getByRole("dialog", {
    name: "Apply price to all branches",
  });
  expect(within(dialog).queryByText("Warehouse")).not.toBeInTheDocument();
  // Another employee can change the record while this user's confirmation is open.
  fireEvent.click(
    screen.getByRole("button", {
      name: "Record another employee's price change",
    }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Apply price to all branches" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Prices changed. Review the latest conflict and choose the price again.",
  );
  await user.click(
    screen.getAllByRole("button", { name: "Apply this price to all" })[0],
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
