import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { DemoProvider, initialState, useDemo } from "./store";
import { shellProviderFixture } from "./shell-provider-test-fixture";
import i18n from "./i18n";

let live: ReturnType<typeof useDemo> | undefined;
let fixture: ReturnType<typeof shellProviderFixture> | undefined;
function Probe() {
  const context = useDemo();
  useLayoutEffect(() => {
    live = context;
  }, [context]);
  return null;
}
function current() {
  if (!live) throw new Error("Provider not mounted");
  return live;
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = undefined;
  live = undefined;
  vi.unstubAllGlobals();
});
async function signIn(kind: "normal" | "archived" | "foreign" = "normal") {
  const state = initialState();
  const product = state.products.find((row) => row.code === "0009")!;
  if (kind === "archived") product.status = "archived";
  if (kind === "foreign") product.company_id = "other-company";
  fixture = shellProviderFixture(state);
  render(
    <DemoProvider options={fixture.options}>
      <Probe />
      <App />
    </DemoProvider>,
  );
  await screen.findByRole("heading", { name: "Sign in" }, { timeout: 10000 });
  let result: string | null = null;
  await act(async () => {
    result = await current().signIn("cashier", "demo1234");
  });
  expect(result).toBeNull();
  await screen.findByRole("heading", { name: "Cashier lookup" });
  expect(current().actor?.user_id).toBe("demo-person-cashier");
}
async function visit(route: string) {
  await act(async () => {
    window.location.hash = route;
  });
}
function noPrivateProduct() {
  expect(
    screen.queryByText("Store cost", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Margin %", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Cost history", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit product" }),
  ).not.toBeInTheDocument();
  expect(document.querySelector(".product-history-list")).toBeNull();
}
it("retains the genuine Cashier's exact public product-code link through Lookup without mounting private details", async () => {
  await signIn();
  await visit("product?code=0009");
  await waitFor(() => expect(window.location.hash).toBe("#lookup?search=0009"));
  expect(
    await screen.findByRole("heading", { name: "Cashier lookup" }),
  ).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Search products" })).toHaveValue(
    "0009",
  );
  expect(document.querySelectorAll(".lookup-result-row")).toHaveLength(1);
  expect(document.querySelector(".lookup-detail")).toBeVisible();
  noPrivateProduct();
});
it("retains an aggregate Cashier's explicit Store requirement before displaying the public product's customer charge", async () => {
  await signIn();
  await act(async () => {
    await current().setLocation({ kind: "all_my_locations" });
  });
  await waitFor(() => expect(current().branch).toBe("all"));
  await visit("product?code=0009");
  await waitFor(() => expect(window.location.hash).toBe("#lookup?search=0009"));
  expect(
    await screen.findByRole("heading", { name: "Cashier lookup" }),
  ).toBeVisible();
  expect(
    within(screen.getByRole("main")).getByRole("combobox", {
      name: "Location",
    }),
  ).toHaveTextContent("Choose location");
  expect(document.querySelector(".lookup-detail")).toBeNull();
  await act(async () => {
    await current().setLocation({ kind: "location", location_id: "Branch 1" });
  });
  await waitFor(() =>
    expect(document.querySelector(".lookup-detail")).toBeVisible(),
  );
  noPrivateProduct();
});
it.each([
  ["product?code=0009&cost=1", "normal"],
  ["product?code=0009&location=Warehouse", "normal"],
  ["product?code=0009&company=other-company", "normal"],
  ["product?code=0009&code=0003", "normal"],
  ["product?code=unknown-product", "normal"],
  ["product?private_id=0009", "normal"],
  ["product?code=0009", "archived"],
  ["product?code=0009", "foreign"],
] as const)(
  "denies private, extra or unavailable product route %s (%s)",
  async (route, kind) => {
    await signIn(kind);
    await visit(route);
    expect(
      await screen.findByText("You do not have permission for this action."),
    ).toBeVisible();
    expect(window.location.hash).toBe(`#${route}`);
    expect(
      screen.queryByRole("heading", { name: "Cashier lookup" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".lookup-detail")).toBeNull();
    noPrivateProduct();
  },
);
