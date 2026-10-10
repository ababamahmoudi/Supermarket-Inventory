import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import i18n from "./i18n";
import { ProductDatesSection } from "./ProductDatesSection";
import { DemoProvider, useDemo } from "./store";
import Expiry from "./screens/Expiry";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
  window.location.hash = "expiry";
});

function Harness({ lookup = false }: { lookup?: boolean }) {
  const { state, switchDemoUser, undoToasts, undoActivity, setBranch } =
    useDemo();
  return (
    <>
      <button onClick={() => switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button onClick={() => switchDemoUser("floorworker")}>
        Use Floor Worker
      </button>
      <button onClick={() => switchDemoUser("cashier")}>Use Cashier</button>
      <button onClick={() => setBranch("Branch 1")}>Use North York</button>
      {lookup ? (
        <ProductDatesSection product={state.products[0]} />
      ) : (
        <Expiry />
      )}
      {undoToasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => undoActivity(toast.id)}
        >{`Undo ${toast.action}`}</button>
      ))}
      <output data-testid="manual-dates">
        {JSON.stringify(
          state.expiry.filter((entry) => entry.source === "manual"),
        )}
      </output>
      <output data-testid="date-preference">
        {String(state.products[0].date_tracking)}
      </output>
    </>
  );
}

async function show(lookup = false) {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness lookup={lookup} />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Use Supervisor" }));
  return user;
}

async function chooseToday(
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
) {
  await user.click(within(form).getByRole("button", { name: "Date" }));
  await user.click(screen.getByRole("button", { name: "Today" }));
}

it("quick-add validates edited fields, saves optional evidence, pins the date and clears/refocuses the scanner for Enter", async () => {
  const user = await show();
  const form = screen.getByRole("form", { name: "Add date" });
  const product = within(form).getByRole("combobox", { name: "Product" });
  const date = within(form).getByRole("button", { name: "Date" });
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(product).toHaveAttribute("aria-invalid", "true");
  expect(date).toHaveAttribute("aria-invalid", "true");
  await user.type(product, "0001");
  expect(product).toHaveAttribute("aria-invalid", "false");
  expect(date).toHaveAttribute("aria-invalid", "true");
  await chooseToday(user, form);
  await user.click(within(form).getByRole("button", { name: "More" }));
  const quantity = within(form).getByRole("textbox", {
    name: "Quantity (optional)",
  });
  await user.type(quantity, "0");
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(quantity).toHaveAttribute("aria-invalid", "true");
  await user.type(
    within(form).getByRole("textbox", { name: "Note (optional)" }),
    "Shelf check",
  );
  expect(quantity).toHaveAttribute("aria-invalid", "true");
  await user.clear(quantity);
  await user.type(quantity, "1.250");
  expect(quantity).toHaveAttribute("aria-invalid", "false");
  await user.type(
    within(form).getByRole("textbox", { name: "Lot (optional)" }),
    "LOT-C5",
  );
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"quantity":"1.25"',
  );
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"note":"Shelf check"',
  );
  expect(screen.getByTestId("date-preference")).toHaveTextContent("true");
  expect(
    screen.getByText("Date added. Date tracking turned on."),
  ).toBeInTheDocument();
  expect(product).toHaveValue("");
  expect(product).toHaveFocus();
  expect(quantity).toHaveValue("");
  const firstRow = document.querySelector(".expiry-table tbody tr")!;
  expect(firstRow).toHaveAttribute("data-new-date", "true");
  expect(within(firstRow as HTMLElement).getByText("0001")).toBeInTheDocument();
  const retainedDate = date.textContent;
  await user.type(product, "۰۰۰۲{Enter}");
  expect(product).toHaveValue("");
  expect(product).toHaveFocus();
  expect(date).toHaveTextContent(retainedDate!);
  const nextRow = document.querySelector(".expiry-table tbody tr")!;
  expect(within(nextRow as HTMLElement).getByText("0002")).toBeInTheDocument();
  expect(nextRow).toHaveAttribute("data-new-date", "true");
  expect(
    document.querySelectorAll(
      'select,input[type="date"],input[type="number"],input[type="checkbox"]',
    ),
  ).toHaveLength(0);
  expect(
    screen.queryByRole("dialog", { name: "Add date" }),
  ).not.toBeInTheDocument();
});

it("adding in another allowed location keeps the date and chosen location while revealing the new row", async () => {
  const user = await show();
  await user.click(screen.getByRole("button", { name: "Use North York" }));
  const form = screen.getByRole("form", { name: "Add date" });
  const product = within(form).getByRole("combobox", { name: "Product" });
  const location = within(form).getByRole("combobox", { name: "Location" });
  await user.type(product, "0001");
  await chooseToday(user, form);
  const retainedDate = within(form).getByRole("button", {
    name: "Date",
  }).textContent;
  await user.click(location);
  await user.click(screen.getByRole("option", { name: "Richmond Hill" }));
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(product).toHaveValue("");
  expect(product).toHaveFocus();
  expect(within(form).getByRole("button", { name: "Date" })).toHaveTextContent(
    retainedDate!,
  );
  expect(location).toHaveTextContent("Richmond Hill");
  expect(
    screen.getByRole("combobox", { name: "Time window" }),
  ).toHaveTextContent("All active dates");
  const newRow = document.querySelector(
    '.expiry-table tbody tr[data-new-date="true"]',
  )!;
  expect(
    within(newRow as HTMLElement).getByText("Richmond Hill"),
  ).toBeInTheDocument();
  expect(within(newRow as HTMLElement).getByText("0001")).toBeInTheDocument();
});

it("the Products quick-add route validates the preselected product and preserves a working Add date Undo", async () => {
  const user = await show();
  window.location.hash = "expiry?product=0001";
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Product" })).toHaveValue(
      "Basmati Rice 4.5 kg",
    ),
  );
  const form = screen.getByRole("form", { name: "Add date" });
  const product = within(form).getByRole("combobox", { name: "Product" });
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await chooseToday(user, form);
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(screen.getByTestId("date-preference")).toHaveTextContent("true");
  await user.click(screen.getByRole("button", { name: "Undo Add date" }));
  expect(screen.getByTestId("date-preference")).toHaveTextContent("false");
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"status":"removed"',
  );
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"removal_action":"undo"',
  );
});

it("Lookup permits worker On/Off and inline Add, preserves existing dates when Off and denies Cashier mutations", async () => {
  const user = await show(true);
  const section = screen.getByRole("region", { name: "Dates" });
  const toggle = within(section).getByRole("switch", { name: "Date tracking" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  await user.click(screen.getByRole("button", { name: "Use Floor Worker" }));
  const form = within(section).getByRole("form", { name: "Add date" });
  await chooseToday(user, form);
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(
    screen.getByText("Date added. Date tracking turned on."),
  ).toBeInTheDocument();
  const originalDates = screen.getByTestId("manual-dates").textContent;
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(originalDates!);
  await user.click(
    screen.getByRole("button", {
      name: "Undo Turn off date tracking",
    }),
  );
  expect(toggle).toHaveAttribute("aria-checked", "true");
  await user.click(screen.getByRole("button", { name: "Use Cashier" }));
  expect(within(section).queryByRole("switch")).not.toBeInTheDocument();
  expect(
    within(section).queryByRole("button", { name: "Add" }),
  ).not.toBeInTheDocument();
  expect(within(section).getByText("North York")).toBeInTheDocument();
  expect(within(section).getByText("Expiry")).toBeInTheDocument();
});
