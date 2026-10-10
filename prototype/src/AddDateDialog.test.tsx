import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import i18n from "./i18n";
import { AddDateDialog, NextTrackedDate } from "./AddDateDialog";
import { addTrackedDate } from "./date-tracking";
import { companyDate } from "./invoice";
import { DemoProvider, useDemo } from "./store";
import Expiry from "./screens/Expiry";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
  window.location.hash = "expiry";
});

function Harness({ standalone = false }: { standalone?: boolean }) {
  const {
    state,
    update,
    historyContext,
    switchDemoUser,
    undoToasts,
    undoActivity,
    setBranch,
  } = useDemo();
  const [open, setOpen] = useState(false);
  const product = state.products[0];
  return (
    <>
      <button onClick={() => switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button onClick={() => switchDemoUser("floorworker")}>
        Use Floor Worker
      </button>
      <button onClick={() => switchDemoUser("cashier")}>Use Cashier</button>
      <button onClick={() => setBranch("all")}>Use all locations</button>
      <button
        onClick={() =>
          update((next) => {
            next.products[0].date_tracking = true;
          })
        }
      >
        Enable product tracking
      </button>
      <button
        onClick={() => {
          if (!historyContext) throw new Error("Sign in first");
          update((next) =>
            addTrackedDate(next, historyContext, {
              product_code: product.code,
              branch: "Branch 1",
              date_type: "expiry",
              date: companyDate(next.config),
              quantity: "2",
              lot_number: "LOT-21",
              note: "Checked shelf",
            }),
          );
        }}
      >
        Seed manual date
      </button>
      {standalone ? (
        <>
          <button onClick={() => setOpen(true)}>Open add date</button>
          <AddDateDialog open={open} onOpenChange={setOpen} />
        </>
      ) : (
        <Expiry />
      )}
      <NextTrackedDate productCode={product.code} />
      {undoToasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => undoActivity(toast.id)}
        >{`Undo ${toast.action}`}</button>
      ))}
      <output data-testid="dates">
        {JSON.stringify(
          state.expiry.filter((entry) => entry.source === "manual"),
        )}
      </output>
      <output data-testid="preference">{String(product.date_tracking)}</output>
    </>
  );
}
async function show(standalone = false) {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness standalone={standalone} />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Use Supervisor" }));
  return user;
}

it("clears only edited Add date fields and saves retained evidence using styled controls", async () => {
  const user = await show(true);
  await user.click(screen.getByRole("button", { name: "Open add date" }));
  const dialog = screen.getByRole("dialog", { name: "Add date" });
  await user.click(within(dialog).getByRole("button", { name: "Add date" }));
  const product = within(dialog).getByRole("combobox", { name: "Product" });
  const date = within(dialog).getByRole("button", {
    name: "Date",
  });
  expect(product).toHaveAttribute("aria-invalid", "true");
  expect(date).toHaveAttribute("aria-invalid", "true");
  await user.click(product);
  await user.click(within(dialog).getByRole("option", { name: /0001$/ }));
  expect(product).toHaveAttribute("aria-invalid", "false");
  expect(date).toHaveAttribute("aria-invalid", "true");
  await user.click(date);
  const day = within(within(dialog).getByRole("grid")).getAllByRole(
    "button",
  )[10];
  await user.click(day);
  expect(date).toHaveAttribute("aria-invalid", "false");
  const quantity = within(dialog).getByRole("textbox", {
    name: "Quantity (optional)",
  });
  await user.type(quantity, "0");
  await user.click(within(dialog).getByRole("button", { name: "Add date" }));
  expect(quantity).toHaveAttribute("aria-invalid", "true");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Note (optional)" }),
    "Shelf check",
  );
  expect(quantity).toHaveAttribute("aria-invalid", "true");
  await user.clear(quantity);
  await user.type(quantity, "1.125");
  expect(quantity).toHaveAttribute("aria-invalid", "false");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Lot (optional)" }),
    "LOT-45",
  );
  expect(
    dialog.querySelectorAll(
      'select,input[type="date"],input[type="number"],input[type="checkbox"]',
    ),
  ).toHaveLength(0);
  await user.click(within(dialog).getByRole("button", { name: "Add date" }));
  expect(
    screen.queryByRole("dialog", { name: "Add date" }),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId("dates")).toHaveTextContent('"quantity":"1.125"');
  expect(screen.getByTestId("dates")).toHaveTextContent('"note":"Shelf check"');
  expect(screen.getByTestId("dates")).toHaveTextContent(
    '"lot_number":"LOT-45"',
  );
  expect(
    screen.getByRole("button", { name: "Undo Add date" }),
  ).toBeInTheDocument();
});

it("Remove requires a reason, retains Removed evidence and offers a working Undo", async () => {
  const user = await show();
  await user.click(screen.getByRole("button", { name: "Seed manual date" }));
  const row = screen.getByText("Checked shelf").closest("tr")!;
  await user.click(within(row).getByRole("button", { name: "Remove" }));
  const dialog = screen.getByRole("dialog", { name: "Remove date" });
  await user.click(within(dialog).getByRole("button", { name: "Remove" }));
  const reason = within(dialog).getByRole("combobox", { name: "Reason" });
  expect(reason).toHaveAttribute("aria-invalid", "true");
  await user.click(reason);
  await user.click(within(dialog).getByRole("option", { name: "Sold out" }));
  expect(reason).toHaveAttribute("aria-invalid", "false");
  await user.click(within(dialog).getByRole("button", { name: "Remove" }));
  expect(screen.getByTestId("dates")).toHaveTextContent('"status":"removed"');
  expect(screen.getByTestId("dates")).toHaveTextContent(
    '"removed_reason":"sold_out"',
  );
  expect(screen.queryByText("Checked shelf")).not.toBeInTheDocument();
  await user.click(screen.getByRole("combobox", { name: "Time window" }));
  await user.click(screen.getByRole("option", { name: "Removed" }));
  const removedRow = screen.getByText("Checked shelf").closest("tr")!;
  expect(within(removedRow).getByText("Sold out")).toBeInTheDocument();
  const removalStatus = within(removedRow).getByRole("cell", {
    name: /^Removed Sold out/,
  });
  expect(
    within(removalStatus).getByText("Demo Supervisor"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Undo Remove date" }));
  expect(screen.getByTestId("dates")).toHaveTextContent('"status":"active"');
  expect(screen.queryByText("Checked shelf")).not.toBeInTheDocument();
});

it("Stop asks whether to remove existing dates, defaults to keeping them and can be undone", async () => {
  const user = await show();
  await user.click(
    screen.getByRole("button", { name: "Enable product tracking" }),
  );
  await user.click(screen.getByRole("button", { name: "Seed manual date" }));
  const row = screen.getByText("Checked shelf").closest("tr")!;
  await user.click(
    within(row).getByRole("button", { name: "Stop tracking this product" }),
  );
  let dialog = screen.getByRole("dialog", {
    name: "Stop tracking this product",
  });
  expect(
    within(dialog).getByRole("checkbox", {
      name: "Remove existing open dates",
    }),
  ).toHaveAttribute("aria-checked", "false");
  await user.click(
    within(dialog).getByRole("button", { name: "Stop tracking this product" }),
  );
  expect(screen.getByTestId("preference")).toHaveTextContent("false");
  expect(screen.getByTestId("dates")).toHaveTextContent('"status":"active"');
  await user.click(
    screen.getByRole("button", { name: "Undo Stop tracking this product" }),
  );
  await user.click(
    within(row).getByRole("button", { name: "Stop tracking this product" }),
  );
  dialog = screen.getByRole("dialog", { name: "Stop tracking this product" });
  await user.click(
    within(dialog).getByRole("checkbox", {
      name: "Remove existing open dates",
    }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Stop tracking this product" }),
  );
  expect(screen.getByTestId("dates")).toHaveTextContent('"status":"removed"');
  expect(screen.getByTestId("dates")).toHaveTextContent(
    '"removal_action":"stop_tracking"',
  );
});

it("workers can add and remove local dates while Cashiers only see their next scoped date", async () => {
  const user = await show();
  await user.click(screen.getByRole("button", { name: "Seed manual date" }));
  await user.click(screen.getByRole("button", { name: "Use Floor Worker" }));
  expect(screen.getByRole("button", { name: "Add date" })).toBeInTheDocument();
  const row = screen.getByText("Checked shelf").closest("tr")!;
  expect(
    within(row).getByRole("button", { name: "Remove" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Stop tracking this product" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Use Cashier" }));
  expect(
    screen.queryByRole("button", { name: "Add date" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Expires/)).toHaveTextContent("North York");
});
