import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { DemoProvider, initialState } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import i18n from "./i18n";

let fixture:
  Awaited<ReturnType<typeof authenticatedProviderFixture>> | undefined;
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/#lookup");
  await i18n.changeLanguage("en");
});
afterEach(() => {
  window.history.replaceState(null, "", "/#products");
  cleanup();
  fixture?.dispose();
  fixture = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
it("retains typed Lookup through the actual accepted location-refresh remount and reads the new branch price", async () => {
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
  });
  const options = fixture.options;
  const tree = () => (
    <DemoProvider options={options}>
      <App />
    </DemoProvider>
  );
  const view = render(tree());
  const input = await screen.findByRole("combobox", {
    name: "Search products",
  });
  fireEvent.change(input, { target: { value: "0004" } });
  await screen.findByRole("heading", { name: "Black Tea 450 g" });
  await waitFor(() =>
    expect(document.querySelector(".price")).toHaveTextContent("$6.49"),
  );
  const before = await fixture.readCanonical();
  const entered = deferred(),
    release = deferred();
  const original = fixture.repository.queryBusiness.bind(fixture.repository);
  let holdNext = true;
  vi.spyOn(fixture.repository, "queryBusiness").mockImplementation(
    async (...args) => {
      if (holdNext) {
        holdNext = false;
        entered.resolve();
        await release.promise;
      }
      return original(...args);
    },
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
  fireEvent.click(await screen.findByRole("option", { name: "Richmond Hill" }));
  await entered.promise;
  // A normal render while the genuine accepted-location query is pending
  // removes the old protected workspace. No permissions or actor are mocked.
  view.rerender(tree());
  expect(input.isConnected).toBe(false);
  expect(document.querySelector(".price")).toBeNull();
  await act(async () => release.resolve());
  await waitFor(() => {
    const location = screen.getByRole("combobox", {
      name: "Location",
    });
    expect(location).toHaveTextContent("Richmond Hill");
    expect(location).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: "Search products" }),
    ).toHaveValue("0004");
    expect(document.querySelector(".price")).toHaveTextContent("$6.99");
  });
  expect(
    screen.queryByText("Store cost", { exact: false }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Margin %", { exact: false }),
  ).not.toBeInTheDocument();
  const after = await fixture.readCanonical();
  expect(after.products).toEqual(before.products);
  expect(after.approvals).toEqual(before.approvals);
  expect(after.sales).toEqual(before.sales);
  expect(after.price_update_tasks).toEqual(before.price_update_tasks);
  expect(after.ledger).toEqual(before.ledger);
});
it("keeps typed text on a duplicate hash event and applies genuine new search deep links", async () => {
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "cashier",
  });
  render(
    <DemoProvider options={fixture.options}>
      <App />
    </DemoProvider>,
  );
  const input = await screen.findByRole("combobox", {
    name: "Search products",
  });
  fireEvent.change(input, { target: { value: "0004" } });
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(input).toHaveValue("0004");
  act(() => {
    window.history.replaceState(null, "", "/#lookup?search=0009");
    fireEvent(window, new HashChangeEvent("hashchange"));
  });
  await waitFor(() => expect(input).toHaveValue("0009"));
  expect(input).toHaveFocus();
  await screen.findByRole("heading", {
    name: "Potato Chips 150 g",
  });
  act(() => {
    window.history.replaceState(null, "", "/#lookup");
    fireEvent(window, new HashChangeEvent("hashchange"));
  });
  await waitFor(() => expect(input).toHaveValue(""));
  expect(
    screen.queryByText("Store cost", { exact: false }),
  ).not.toBeInTheDocument();
});
