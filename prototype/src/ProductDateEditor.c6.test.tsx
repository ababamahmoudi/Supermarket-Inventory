import { useState } from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { ProductEditor } from "./screens/Catalog";
import i18n from "./i18n";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "./test/rendered-ui-readiness";
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "products";
  await i18n.changeLanguage("en");
});
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
function Harness() {
  const { state, actor, demoUsers, switchDemoUser } = useDemo();
  const [open, setOpen] = useState(false);
  const product = state.products[0];
  const switchRole = async (role: "manager" | "floor_worker") => {
    const account = demoUsers.find((person) => person.role === role);
    if (!account)
      throw new Error("Actual configured demo account was not loaded.");
    const result = await switchDemoUser(account.username);
    if (result) throw new Error(result);
  };
  return (
    <>
      <button onClick={() => switchRole("manager")}>Use Supervisor</button>
      <button onClick={() => switchRole("floor_worker")}>Use Worker</button>
      <output data-testid="current-role">{actor?.role ?? "signed_out"}</output>
      {actor && product && (
        <>
          <button onClick={() => setOpen(true)}>Open editor</button>
          {open && (
            <ProductEditor product={product} onClose={() => setOpen(false)} />
          )}
          <output data-testid="saved-product">{JSON.stringify(product)}</output>
          <output data-testid="saved-dates">
            {JSON.stringify(
              state.expiry.filter(
                (entry) => entry.product_code === product.code,
              ),
            )}
          </output>
        </>
      )}
    </>
  );
}
async function show() {
  const fixture = await authenticatedProviderFixture({
    state: initialState,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  const user = userEvent.setup();
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  await user.click(
    await screen.findByRole(
      "button",
      { name: "Open editor" },
      { timeout: 3000 },
    ),
  );
  await waitFor(
    () => {
      const save = screen.getByRole("button", { name: "Save product" });
      if (save.hasAttribute("disabled"))
        throw new Error("Waiting for the actual protected editor snapshot.");
    },
    { timeout: 3000 },
  );
  return user;
}
async function saveReadyProduct(
  user: ReturnType<typeof userEvent.setup>,
  root: HTMLElement = document.body,
) {
  const save = await waitFor(
    () => {
      const button = within(root).getByRole("button", { name: "Save product" });
      if (button.hasAttribute("disabled"))
        throw new Error(
          "Waiting for the protected product editor to be ready.",
        );
      return button;
    },
    { timeout: 3000 },
  );
  await user.click(save);
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
  await waitFor(
    () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
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
  await saveReadyProduct(user);
  // The click starts actual validation/read/write transactions. Wait for its
  // source onClose to remove the native editor before the original assertions.
  await renderedUiReady(
    () => screen.queryByRole("dialog", { name: "Edit product" }) === null,
  );
  await waitFor(
    () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
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
  await saveReadyProduct(user);
  const missing = await screen.findByRole(
    "alert",
    { name: "What's missing" },
    { timeout: 3000 },
  );
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
  await waitFor(
    () => {
      if (screen.getByTestId("current-role").textContent !== "floor_worker")
        throw new Error("Waiting for the genuine Floor Worker session.");
    },
    { timeout: 3000 },
  );
  await waitFor(
    () =>
      expect(
        screen.queryByRole("dialog", { name: "Edit product" }),
      ).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
});
it("C8 Save reports and focuses the missing expiry date instead of silently saving tracking Yes", async () => {
  const user = await show();
  const beforeProduct = screen.getByTestId("saved-product").textContent;
  const beforeDates = screen.getByTestId("saved-dates").textContent;
  const section = screen.getByRole("region", { name: "Date tracking" });
  await user.click(
    within(section).getByRole("switch", { name: "Date tracking" }),
  );
  await saveReadyProduct(user);
  const missing = await screen.findByRole(
    "alert",
    { name: "What's missing" },
    { timeout: 3000 },
  );
  const link = within(missing).getByRole("link", {
    name: "Add an expiry date, or turn off date tracking",
  });
  expect(screen.getByTestId("saved-product").textContent).toBe(beforeProduct);
  expect(screen.getByTestId("saved-dates").textContent).toBe(beforeDates);
  await user.click(link);
  expect(within(section).getByRole("button", { name: "Date" })).toHaveFocus();
  await user.click(within(section).getByRole("button", { name: "Date" }));
  await user.click(screen.getByRole("button", { name: "Today" }));
  // The selected date is deliberately not added to the staged rows first.
  await saveReadyProduct(user);
  await renderedUiReady(
    () => screen.queryByRole("dialog", { name: "Edit product" }) === null,
  );
  await waitFor(
    () =>
      expect(
        screen.queryByRole("dialog", { name: "Edit product" }),
      ).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
  expect(
    JSON.parse(screen.getByTestId("saved-dates").textContent ?? "[]"),
  ).toHaveLength(1);
});
it("C8 invalid unadded date evidence blocks the entire save and stays available to correct", async () => {
  const user = await show();
  const before = screen.getByTestId("saved-product").textContent;
  const section = screen.getByRole("region", { name: "Date tracking" });
  await user.click(
    within(section).getByRole("switch", { name: "Date tracking" }),
  );
  await user.click(within(section).getByRole("button", { name: "Date" }));
  await user.click(screen.getByRole("button", { name: "Today" }));
  const quantity = within(section).getByRole("textbox", {
    name: "Quantity (optional)",
  });
  await user.type(quantity, "-3");
  await saveReadyProduct(user);
  expect(
    await screen.findByRole(
      "alert",
      { name: "What's missing" },
      { timeout: 3000 },
    ),
  ).toHaveTextContent("quantity");
  expect(quantity).toHaveValue("-3");
  expect(screen.getByTestId("saved-product").textContent).toBe(before);
  expect(
    JSON.parse(screen.getByTestId("saved-dates").textContent ?? "[]"),
  ).toHaveLength(0);
  await user.clear(quantity);
  await user.type(quantity, "3");
  await saveReadyProduct(user);
  await renderedUiReady(
    () => screen.queryByRole("dialog", { name: "Edit product" }) === null,
  );
  await waitFor(
    () =>
      expect(
        JSON.parse(screen.getByTestId("saved-dates").textContent ?? "[]"),
      ).toEqual([expect.objectContaining({ quantity: "3", status: "active" })]),
    { timeout: 3000 },
  );
});
it("C8 separate price save preserves unsaved catalog fields and lets their later atomic Save use the reviewed snapshot", async () => {
  const user = await show();
  const editor = screen.getByRole("dialog", { name: "Edit product" });
  expect(
    within(editor).queryByRole("textbox", { name: /Selling price/ }),
  ).not.toBeInTheDocument();
  const name = within(editor).getByRole("textbox", { name: "English name" });
  await user.clear(name);
  await user.type(name, "Reviewed rice name");
  await user.click(
    within(editor).getByRole("button", { name: "Change price" }),
  );
  const priceDialog = screen.getByRole("dialog", { name: "Change price" });
  await user.click(
    within(priceDialog).getByRole("radio", { name: /^New regular price/ }),
  );
  await user.type(
    within(priceDialog).getByRole("textbox", { name: "Price" }),
    "24.99",
  );
  const savePrice = await waitFor(
    () => {
      const button = within(priceDialog).getByRole("button", {
        name: "Save new price",
      });
      if (button.hasAttribute("disabled"))
        throw new Error("Waiting for the genuine protected price preview.");
      return button;
    },
    { timeout: 3000 },
  );
  await user.click(savePrice);
  await renderedUiReady(
    () => screen.queryByRole("dialog", { name: "Change price" }) === null,
  );
  await waitFor(
    () =>
      expect(
        screen.queryByRole("dialog", { name: "Change price" }),
      ).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
  expect(screen.getByRole("dialog", { name: "Edit product" })).toBeVisible();
  expect(name).toHaveValue("Reviewed rice name");
  expect(screen.getByTestId("saved-product")).not.toHaveTextContent(
    '"name_en":"Reviewed rice name"',
  );
  expect(screen.getByTestId("saved-product")).toHaveTextContent(
    '"selling_price":"24.99"',
  );
  await saveReadyProduct(user, editor);
  await renderedUiReady(
    () => screen.queryByRole("dialog", { name: "Edit product" }) === null,
  );
  await waitFor(
    () =>
      expect(
        screen.queryByRole("dialog", { name: "Edit product" }),
      ).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
  expect(screen.getByTestId("saved-product")).toHaveTextContent(
    '"name_en":"Reviewed rice name"',
  );
  expect(screen.getByTestId("saved-product")).toHaveTextContent(
    '"selling_price":"24.99"',
  );
});
