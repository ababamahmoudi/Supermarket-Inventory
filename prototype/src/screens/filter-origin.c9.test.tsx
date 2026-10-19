import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AuthenticatedUiProvider,
  renderAuthenticatedUI,
  prepareSharedUiFixture,
  disposeSharedUiFixture,
  waitForSharedUiActor,
  sharedUiCanonical,
} from "../shared-ui-provider-test-fixture";
import Received from "./Received";
import Suppliers from "./Suppliers";
import Expiry from "./Expiry";
import Payables from "./Payables";
import { Offers } from "./Offers";
import { useDemo } from "../store";

function LocationControls() {
  const { branch, setBranch } = useDemo();
  return (
    <>
      <output data-testid="filter-actual-location">{branch}</output>
      <button onClick={() => setBranch("Branch 1")}>Choose North York</button>
      <button onClick={() => setBranch("Branch 2")}>
        Choose Richmond Hill
      </button>
    </>
  );
}

beforeEach(prepareSharedUiFixture);
afterEach(disposeSharedUiFixture);

describe("C9 location filter defaults", () => {
  for (const scenario of [
    {
      route: "received",
      content: <Received />,
      toolbar: "Received filters",
      location: "Location",
      search: "Search Received",
    },
    {
      route: "suppliers",
      content: <Suppliers />,
      toolbar: "Supplier filters",
      location: "Supplier branch",
      search: "Search suppliers",
    },
    {
      route: "expiry",
      content: <Expiry />,
      toolbar: "Date tracking filters",
      location: "Date tracking location",
      search: "Search products",
    },
    {
      route: "payables",
      content: <Payables />,
      toolbar: "Payables filters",
      location: "Payables branch",
      search: "Search suppliers",
    },
    {
      route: "offers",
      content: <Offers />,
      toolbar: "Offer filters",
      location: "Offer branch",
      search: "Search offers",
    },
  ]) {
    it(`${scenario.route} hides Clear on returning to its origin and restores the actual origin without stale saved filters`, async () => {
      window.location.hash = scenario.route;
      await renderAuthenticatedUI(
        <AuthenticatedUiProvider>
          <LocationControls />
          {scenario.content}
        </AuthenticatedUiProvider>,
      );
      const before = await sharedUiCanonical();
      const toolbar = () => within(screen.getByLabelText(scenario.toolbar));
      const chooseLocation = async (name: string, id: string) => {
        await userEvent.click(
          screen.getByRole("button", { name: `Choose ${name}` }),
        );
        await waitForSharedUiActor("manager", id);
        await screen.findByLabelText(scenario.toolbar);
      };
      expect(
        toolbar().queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument();
      await chooseLocation("Richmond Hill", "Branch 2");
      expect(
        toolbar().getByRole("button", { name: "Clear filters" }),
      ).toBeInTheDocument();
      await chooseLocation("North York", "Branch 1");
      expect(
        toolbar().queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument();
      await userEvent.type(toolbar().getByLabelText(scenario.search), "Oil");
      await chooseLocation("Richmond Hill", "Branch 2");
      await userEvent.click(
        toolbar().getByRole("button", { name: "Clear filters" }),
      );
      await waitForSharedUiActor("manager", "Branch 1");
      await screen.findByLabelText(scenario.toolbar);
      await waitFor(() =>
        expect(toolbar().getByLabelText(scenario.search)).toHaveValue(""),
      );
      expect(
        toolbar().queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("filter-actual-location")).toHaveTextContent(
        "Branch 1",
      );
      const after = await sharedUiCanonical();
      expect(after.ledger).toEqual(before.ledger);
      expect(after.stock).toEqual(before.stock);
    });
  }

  it("Offers Clear restores its actual origin after a protected location refresh", async () => {
    window.location.hash = "offers";
    await renderAuthenticatedUI(
      <AuthenticatedUiProvider>
        <LocationControls />
        <Offers />
      </AuthenticatedUiProvider>,
    );
    const before = await sharedUiCanonical();
    const toolbar = () => within(screen.getByLabelText("Offer filters"));
    await userEvent.click(toolbar().getByLabelText("Offer branch"));
    await userEvent.click(
      screen.getByRole("option", { name: "Richmond Hill" }),
    );
    await waitForSharedUiActor("manager", "Branch 2");
    await screen.findByLabelText("Offer filters");
    await userEvent.type(toolbar().getByLabelText("Search offers"), "Oil");
    await userEvent.click(
      toolbar().getByRole("button", { name: "Clear filters" }),
    );
    await waitForSharedUiActor("manager", "Branch 1");
    await screen.findByLabelText("Offer filters");
    expect(toolbar().getByLabelText("Search offers")).toHaveValue("");
    expect(
      toolbar().queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("filter-actual-location")).toHaveTextContent(
      "Branch 1",
    );
    const after = await sharedUiCanonical();
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock).toEqual(before.stock);
  });
});
