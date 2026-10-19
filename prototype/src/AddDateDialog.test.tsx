import { useState } from "react";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { AddDateDialog, NextTrackedDate } from "./AddDateDialog";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { addTrackedDate, setProductDateTracking } from "./date-tracking";
import { companyDate } from "./invoice";
import { DemoProvider, initialState, useDemo } from "./store";
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
    command,
    authStage,
    actor,
    historyContext,
    switchDemoUser,
    undoToasts,
    undoActivity,
    setBranch,
  } = useDemo();
  const [open, setOpen] = useState(false);
  const [fixtureAction, setFixtureAction] = useState("idle");
  const product = state.products[0];
  return (
    <>
      <button onClick={async () => await switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button onClick={async () => await switchDemoUser("floorworker")}>
        Use Floor Worker
      </button>
      <button onClick={async () => await switchDemoUser("cashier")}>
        Use Cashier
      </button>
      <output data-testid="auth-stage">{authStage}</output>
      <output data-testid="actor-role">{actor?.role ?? "signed_out"}</output>
      <output data-testid="actor-name">{actor?.actor ?? ""}</output>
      <output data-testid="fixture-action-complete">{fixtureAction}</output>
      {product && (
        <>
          <button onClick={async () => await setBranch("all")}>
            Use all locations
          </button>
          <button
            onClick={async () => {
              setFixtureAction("enabling");
              await command(
                "catalog.tracking_preference_edit",
                {
                  company_id: state.config.company.seed_key,
                  kind: "company_shared",
                  mutation: true,
                },
                (next, freshActor) =>
                  setProductDateTracking(
                    next,
                    freshActor,
                    product!.code,
                    true,
                    "Branch 1",
                  ),
              );
              setFixtureAction("enabled");
            }}
          >
            Enable product tracking
          </button>
          <button
            onClick={async () => {
              if (!historyContext) throw new Error("Sign in first");
              setFixtureAction("seeding");
              await command(
                "dates.add",
                {
                  company_id: state.config.company.seed_key,
                  kind: "location_record",
                  location_ids: ["Branch 1"],
                  mutation: true,
                },
                (next, freshActor) =>
                  addTrackedDate(next, freshActor, {
                    product_code: product!.code,
                    branch: "Branch 1",
                    date_type: "expiry",
                    date: companyDate(next.config),
                    quantity: "2",
                    lot_number: "LOT-21",
                    note: "Checked shelf",
                  }),
              );
              setFixtureAction("seeded");
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
              onClick={async () => {
                setFixtureAction("undoing");
                await undoActivity(toast.id);
                setFixtureAction("undone");
              }}
            >{`Undo ${toast.action}`}</button>
          ))}
          <output data-testid="dates">
            {JSON.stringify(
              state.expiry.filter((entry) => entry.source === "manual"),
            )}
          </output>
          <output data-testid="preference">
            {String(product.date_tracking)}
          </output>
        </>
      )}
    </>
  );
}
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
async function show(standalone = false) {
  const fixture = await authenticatedProviderFixture({
    state: initialState,
    role: "manager",
  });
  fixtures.push(fixture);
  const user = userEvent.setup();
  render(
    <DemoProvider options={fixture.options}>
      <Harness standalone={standalone} />
    </DemoProvider>,
  );
  await waitFor(
    () =>
      expect(screen.getByTestId("auth-stage")).toHaveTextContent("complete"),
    { timeout: 3000 },
  );
  await waitFor(
    () => expect(screen.getByTestId("actor-role")).toHaveTextContent("manager"),
    { timeout: 3000 },
  );
  await screen.findByTestId("preference", {}, { timeout: 3000 });
  return user;
}
async function waitForFixtureAction(expected: string) {
  await waitFor(
    () => {
      if (
        screen.getByTestId("fixture-action-complete").textContent !== expected
      )
        throw new Error(
          "Waiting for the actual authenticated fixture command.",
        );
    },
    { timeout: 3000 },
  );
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
  await waitFor(
    () => expect(quantity).toHaveAttribute("aria-invalid", "true"),
    { timeout: 3000 },
  );
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
  await waitFor(
    () =>
      expect(
        screen.queryByRole("dialog", { name: "Add date" }),
      ).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
  expect(screen.getByTestId("dates")).toHaveTextContent('"quantity":"1.125"');
  expect(screen.getByTestId("dates")).toHaveTextContent('"note":"Shelf check"');
  expect(screen.getByTestId("dates")).toHaveTextContent(
    '"lot_number":"LOT-45"',
  );
  expect(
    screen.queryByRole("button", { name: "Undo Add date" }),
  ).not.toBeInTheDocument();
});
it("Remove requires a reason, retains Removed evidence and offers a working Undo", async () => {
  const user = await show();
  await user.click(screen.getByRole("button", { name: "Seed manual date" }));
  await waitForFixtureAction("seeded");
  const row = (
    await screen.findByText("Checked shelf", {}, { timeout: 3000 })
  ).closest("tr")!;
  await user.click(within(row).getByRole("button", { name: "Remove" }));
  const dialog = screen.getByRole("dialog", { name: "Remove date" });
  await user.click(within(dialog).getByRole("button", { name: "Remove" }));
  const reason = within(dialog).getByRole("combobox", { name: "Reason" });
  await waitFor(() => expect(reason).toHaveAttribute("aria-invalid", "true"), {
    timeout: 3000,
  });
  await user.click(reason);
  await user.click(within(dialog).getByRole("option", { name: "Sold out" }));
  expect(reason).toHaveAttribute("aria-invalid", "false");
  await user.click(within(dialog).getByRole("button", { name: "Remove" }));
  await waitFor(
    () =>
      expect(screen.getByTestId("dates")).toHaveTextContent(
        '"status":"removed"',
      ),
    { timeout: 3000 },
  );
  expect(screen.getByTestId("dates")).toHaveTextContent(
    '"removed_reason":"sold_out"',
  );
  expect(screen.queryByText("Checked shelf")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Removed" }));
  const removedRow = screen.getByText("Checked shelf").closest("tr")!;
  expect(within(removedRow).getByText("Sold out")).toBeInTheDocument();
  const removalStatus = within(removedRow).getByRole("cell", {
    name: /^Removed Sold out/,
  });
  expect(
    within(removalStatus).getByText(
      screen.getByTestId("actor-name").textContent!,
    ),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Undo Remove date" }));
  await waitForFixtureAction("undone");
  await waitFor(
    () =>
      expect(screen.getByTestId("dates")).toHaveTextContent(
        '"status":"active"',
      ),
    { timeout: 3000 },
  );
  expect(screen.queryByText("Checked shelf")).not.toBeInTheDocument();
});
it("Stop requires an explicit keep or clear choice, hides retained dates, and can be undone", async () => {
  const user = await show();
  await user.click(
    screen.getByRole("button", { name: "Enable product tracking" }),
  );
  await waitForFixtureAction("enabled");
  await user.click(screen.getByRole("button", { name: "Seed manual date" }));
  await waitForFixtureAction("seeded");
  const row = (
    await screen.findByText("Checked shelf", {}, { timeout: 3000 })
  ).closest("tr")!;
  await user.click(within(row).getByRole("button", { name: "More" }));
  await user.click(
    screen.getByRole("menuitem", { name: "Stop tracking this product" }),
  );
  let dialog = screen.getByRole("dialog", {
    name: "Stop tracking this product",
  });
  await user.click(
    within(dialog).getByRole("button", { name: "Stop tracking this product" }),
  );
  expect(screen.getByTestId("preference")).toHaveTextContent("true");
  const choice = within(dialog).getByRole("combobox", {
    name: "Stop tracking",
  });
  await waitFor(() => expect(choice).toHaveAttribute("aria-invalid", "true"), {
    timeout: 3000,
  });
  await user.click(choice);
  await user.click(
    within(dialog).getByRole("option", {
      name: "Stop tracking, keep the date on the product",
    }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Stop tracking this product" }),
  );
  await waitFor(
    () => expect(screen.getByTestId("preference")).toHaveTextContent("false"),
    { timeout: 3000 },
  );
  await waitFor(
    () =>
      expect(screen.getByTestId("dates")).toHaveTextContent(
        '"status":"active"',
      ),
    { timeout: 3000 },
  );
  expect(screen.queryByText("Checked shelf")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Undo Stop tracking this product" }),
  );
  await waitForFixtureAction("undone");
  const restoredRow = (
    await screen.findByText("Checked shelf", {}, { timeout: 3000 })
  ).closest("tr")!;
  await user.click(within(restoredRow).getByRole("button", { name: "More" }));
  await user.click(
    screen.getByRole("menuitem", { name: "Stop tracking this product" }),
  );
  dialog = screen.getByRole("dialog", { name: "Stop tracking this product" });
  await user.click(
    within(dialog).getByRole("combobox", { name: "Stop tracking" }),
  );
  await user.click(
    within(dialog).getByRole("option", {
      name: "Stop tracking and clear the dates",
    }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Stop tracking this product" }),
  );
  await waitFor(
    () =>
      expect(screen.getByTestId("dates")).toHaveTextContent(
        '"status":"removed"',
      ),
    { timeout: 3000 },
  );
  expect(screen.getByTestId("dates")).toHaveTextContent(
    '"removal_action":"stop_tracking"',
  );
});
it("workers can add and remove local dates while Cashiers add dates but only see their next scoped date", async () => {
  const user = await show();
  await user.click(screen.getByRole("button", { name: "Seed manual date" }));
  await waitForFixtureAction("seeded");
  await user.click(screen.getByRole("button", { name: "Use Floor Worker" }));
  await waitFor(
    () =>
      expect(screen.getByTestId("actor-role")).toHaveTextContent(
        "floor_worker",
      ),
    { timeout: 3000 },
  );
  expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  const row = (
    await screen.findByText("Checked shelf", {}, { timeout: 3000 })
  ).closest("tr")!;
  expect(
    within(row).getByRole("button", { name: "Remove" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Stop tracking this product" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Use Cashier" }));
  await waitFor(
    () => expect(screen.getByTestId("actor-role")).toHaveTextContent("cashier"),
    { timeout: 3000 },
  );
  // Ali's rule (Oct 2026): everyone adds dates; Cashiers still cannot remove
  // them or read other people's date evidence.
  expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Remove" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Checked shelf")).not.toBeInTheDocument();
  expect(screen.getByText(/Expires/)).toHaveTextContent("North York");
});
