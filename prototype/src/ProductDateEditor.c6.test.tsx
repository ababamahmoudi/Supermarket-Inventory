import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { DemoProvider, useDemo } from "./store";
import { ProductEditor } from "./screens/Catalog";
import i18n from "./i18n";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "products";
  await i18n.changeLanguage("en");
});
function Harness() {
  const { state, switchDemoUser } = useDemo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => switchDemoUser("supervisor")}>
        Use Supervisor
      </button>
      <button onClick={() => switchDemoUser("floorworker")}>Use Worker</button>
      <button onClick={() => setOpen(true)}>Open editor</button>
      {open && (
        <ProductEditor
          product={state.products[0]}
          onClose={() => setOpen(false)}
        />
      )}
      <output data-testid="saved-product">
        {JSON.stringify(state.products[0])}
      </output>
      <output data-testid="saved-dates">
        {JSON.stringify(
          state.expiry.filter(
            (entry) => entry.product_code === state.products[0].code,
          ),
        )}
      </output>
    </>
  );
}
async function show() {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Use Supervisor" }));
  await user.click(screen.getByRole("button", { name: "Open editor" }));
  return user;
}
async function draftDate(user: ReturnType<typeof userEvent.setup>) {
  const section = screen.getByRole("region", { name: "Date tracking" });
  await user.click(
    within(section).getByRole("switch", { name: "Date tracking" }),
  );
  await user.click(within(section).getByRole("button", { name: "Date" }));
  await user.click(screen.getByRole("button", { name: "Today" }));
  await user.type(
    within(section).getByRole("textbox", { name: "Quantity (optional)" }),
    "2",
  );
  await user.type(
    within(section).getByRole("textbox", { name: "Lot (optional)" }),
    "C6-LOT",
  );
  await user.click(within(section).getByRole("button", { name: "Add" }));
}
it("choosing tracking Yes exposes dates immediately; Cancel commits neither product nor local date", async () => {
  const user = await show();
  const beforeProduct = screen.getByTestId("saved-product").textContent;
  const beforeDates = screen.getByTestId("saved-dates").textContent;
  await user.clear(screen.getByRole("textbox", { name: "English name" }));
  await user.type(
    screen.getByRole("textbox", { name: "English name" }),
    "Unsaved rice",
  );
  await draftDate(user);
  expect(
    screen.getByRole("region", { name: "Date tracking" }),
  ).toHaveTextContent("C6-LOT");
  expect(screen.getByTestId("saved-dates").textContent).toBe(beforeDates);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("saved-product").textContent).toBe(beforeProduct);
  expect(screen.getByTestId("saved-dates").textContent).toBe(beforeDates);
});
it("Save product atomically retains blank optional Persian and the locally added date", async () => {
  const user = await show();
  await user.clear(
    screen.getByRole("textbox", { name: "Persian name (optional)" }),
  );
  await draftDate(user);
  expect(screen.getByTestId("saved-dates")).not.toHaveTextContent("C6-LOT");
  await user.click(screen.getByRole("button", { name: "Save product" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("saved-product")).toHaveTextContent('"name_fa":""');
  expect(screen.getByTestId("saved-dates")).toHaveTextContent(
    '"lot_number":"C6-LOT"',
  );
  expect(screen.getByTestId("saved-dates")).toHaveTextContent('"quantity":"2"');
});
it("an incomplete Save gives a linked top list and local error, cleared by the corresponding field", async () => {
  const user = await show();
  const name = screen.getByRole("textbox", { name: "English name" });
  await user.clear(name);
  await user.click(screen.getByRole("button", { name: "Save product" }));
  const missing = screen.getByRole("alert", { name: "What's missing" });
  expect(missing).toBeInTheDocument();
  expect(name).toHaveAttribute("aria-invalid", "true");
  await user.click(
    within(missing).getByRole("link", { name: "Add the English name." }),
  );
  expect(name).toHaveFocus();
  expect(name).toHaveClass("validation-field-highlight");
  await user.type(name, "Basmati Rice");
  expect(
    screen.queryByRole("alert", { name: "What's missing" }),
  ).not.toBeInTheDocument();
  expect(name).toHaveAttribute("aria-invalid", "false");
});
it("switching to Worker closes access to a Supervisor's existing catalog form", async () => {
  const user = await show();
  await user.click(screen.getByRole("button", { name: "Use Worker" }));
  expect(
    screen.queryByRole("dialog", { name: "Edit product" }),
  ).not.toBeInTheDocument();
});
