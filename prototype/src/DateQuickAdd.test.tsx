import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import i18n from "./i18n";
import { addTrackedDate, stopProductDateTracking } from "./date-tracking";
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
  const {
    state,
    switchDemoUser,
    undoToasts,
    undoActivity,
    setBranch,
    setLang,
    update,
    historyContext,
    revertActivity,
  } = useDemo();
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
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <button onClick={() => setLang("en")}>Use English</button>
      <button
        onClick={() => {
          if (historyContext)
            update((next) =>
              addTrackedDate(next, historyContext, {
                product_code: next.products[0].code,
                branch: "Branch 1",
                date_type: "expiry",
                date: "2026-11-04",
              }),
            );
        }}
      >
        Add fixture date
      </button>
      <button
        onClick={() => {
          if (historyContext)
            update((next) =>
              stopProductDateTracking(
                next,
                historyContext,
                next.products[0].code,
                "keep",
              ),
            );
        }}
      >
        Keep fixture date
      </button>
      <button
        onClick={() => {
          const latest = [...state.activity]
            .reverse()
            .find((entry) => entry.action === "Add date");
          if (latest) revertActivity(latest.id);
        }}
      >
        Revert latest date
      </button>
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
  expect(screen.getByRole("tab", { name: "All dates" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const newRow = document.querySelector(
    '.expiry-table tbody tr[data-new-date="true"]',
  )!;
  expect(
    within(newRow as HTMLElement).getByText("Richmond Hill"),
  ).toBeInTheDocument();
  expect(within(newRow as HTMLElement).getByText("0001")).toBeInTheDocument();
});

it("the Products quick-add route validates the preselected product and preserves safe History reversion without a transient Add toast", async () => {
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
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(product).toHaveValue("برنج باسماتی ۴٫۵ کیلوگرمی");
  await user.click(screen.getByRole("button", { name: "Use English" }));
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await chooseToday(user, form);
  await user.click(within(form).getByRole("button", { name: "Add" }));
  expect(screen.getByTestId("date-preference")).toHaveTextContent("true");
  expect(
    screen.queryByRole("button", { name: "Undo Add date" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Revert latest date" }));
  expect(screen.getByTestId("date-preference")).toHaveTextContent("false");
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"status":"removed"',
  );
  expect(screen.getByTestId("manual-dates")).toHaveTextContent(
    '"removal_action":"undo"',
  );
});

it("selected product labels follow language changes while typed scanner text stays literal", async () => {
  const user = await show();
  const product = screen.getByRole("combobox", { name: "Product" });
  await user.type(product, "0001");
  await user.click(screen.getByRole("option", { name: /Basmati Rice 4.5 kg/ }));
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(product).toHaveValue("برنج باسماتی ۴٫۵ کیلوگرمی");
  await user.click(screen.getByRole("button", { name: "Use English" }));
  expect(product).toHaveValue("Basmati Rice 4.5 kg");
  await user.clear(product);
  await user.type(product, "DEMO-600000");
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  expect(product).toHaveValue("DEMO-600000");
});

it.each([false, true])(
  "renders retained quick-add success in the current language without adding another date (tracking already on: %s)",
  async (trackingAlreadyOn) => {
    const user = await show();
    if (trackingAlreadyOn)
      await user.click(
        screen.getByRole("button", { name: "Add fixture date" }),
      );
    const form = screen.getByRole("form", { name: "Add date" });
    await user.type(
      within(form).getByRole("combobox", { name: "Product" }),
      "0001",
    );
    await chooseToday(user, form);
    await user.click(within(form).getByRole("button", { name: "Add" }));
    const english = trackingAlreadyOn
      ? "Date added."
      : "Date added. Date tracking turned on.";
    const persian = trackingAlreadyOn
      ? "تاریخ اضافه شد."
      : "تاریخ اضافه شد. پیگیری تاریخ روشن شد.";
    expect(within(form).getByRole("status")).toHaveTextContent(english);
    const retainedDates = screen.getByTestId("manual-dates").textContent;
    await user.click(screen.getByRole("button", { name: "Use Persian" }));
    expect(within(form).getByRole("status")).toHaveTextContent(persian);
    expect(within(form).getByRole("status")).not.toHaveTextContent(
      "Date added.",
    );
    expect(screen.getByTestId("manual-dates").textContent).toBe(retainedDates);
    await user.click(screen.getByRole("button", { name: "Use English" }));
    expect(within(form).getByRole("status")).toHaveTextContent(english);
    expect(screen.getByTestId("manual-dates").textContent).toBe(retainedDates);
  },
);

it("C6 Lookup dates are read-only for every role and kept dates remain visible", async () => {
  const user = await show(true);
  await user.click(screen.getByRole("button", { name: "Add fixture date" }));
  await user.click(screen.getByRole("button", { name: "Keep fixture date" }));
  const section = screen.getByRole("region", { name: "Dates" });
  const retained = screen.getByTestId("manual-dates").textContent;
  for (const account of ["Use Supervisor", "Use Floor Worker", "Use Cashier"]) {
    await user.click(screen.getByRole("button", { name: account }));
    expect(within(section).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(section).queryByRole("form")).not.toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: "Add" }),
    ).not.toBeInTheDocument();
    expect(section).toHaveTextContent("Expires 2026-11-04 · North York");
    expect(screen.getByTestId("manual-dates")).toHaveTextContent(retained!);
  }
});
