import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDemo } from "../store";
import {
  AuthenticatedUiProvider as DemoProvider,
  renderAuthenticatedUI as render,
  prepareSharedUiFixture,
  disposeSharedUiFixture,
  waitForSharedUiActor,
  sharedUiSessionId,
  sharedUiCanonical,
} from "../shared-ui-provider-test-fixture";
import BranchRequests from "./BranchRequests";

function SessionControls() {
  const { switchDemoUser, demoUsers, setBranch } = useDemo();
  const switchTo = (role: "manager" | "floor_worker" | "cashier") => {
    const person = demoUsers.find((row) => row.role === role);
    if (!person) throw new Error("Configured demo person is not ready");
    return switchDemoUser(person.username);
  };
  return (
    <>
      <button onClick={() => switchTo("floor_worker")}>Worker session</button>
      <button onClick={() => switchTo("manager")}>Supervisor session</button>
      <button onClick={() => switchTo("cashier")}>Cashier session</button>
      <button onClick={() => setBranch("Branch 2")}>
        Choose other location
      </button>
    </>
  );
}
async function mount() {
  await render(
    <DemoProvider>
      <SessionControls />
      <BranchRequests />
    </DemoProvider>,
  );
}
async function choose(label: string, option: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.click(screen.getByRole("option", { name: option }));
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "requests";
});
describe("Branch requests presentation", () => {
  it("creates and sends free-text requests without inventing catalog units or costs", async () => {
    await mount();
    const sessionBeforeSwitch1 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, sessionBeforeSwitch1);
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await choose("Ask this location", "Warehouse");
    await userEvent.type(
      screen.getByLabelText(
        "Add a product, or type an item that isn't in the catalog",
      ),
      "Small paper bags",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Add item/ }));
    await choose("Units / Cases", "Cases");
    await userEvent.clear(screen.getByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() =>
      expect(screen.getByText("Requested")).toBeInTheDocument(),
    );
    expect(screen.getByText("Small paper bags")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark as sent" }),
    ).not.toBeInTheDocument();
    const state = await sharedUiCanonical();
    expect(state.branch_requests?.at(-1)).toMatchObject({
      status: "requested",
      to_branch: "Warehouse",
      items: [
        {
          free_text: "Small paper bags",
          quantity: "3",
          quantity_unit: "cases",
          normalized_units: null,
        },
      ],
    });
    expect(
      screen.queryByText(/Store cost|Selling price|Balance/),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to requests" }),
    );
    const reference = state.branch_requests!.at(-1)!.reference;
    const rowLink = screen.getByRole("link", { name: reference });
    const row = rowLink.closest("tr")!;
    expect(row).toHaveTextContent("1 item · Small paper bags");
    expect(rowLink.closest("td")).toBe(row.lastElementChild);
    const desktopWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    fireEvent(window, new Event("resize"));
    try {
      for (const key of ["{Enter}", " "]) {
        const phoneRow = screen
          .getByRole("link", { name: reference })
          .closest("tr")!;
        expect(phoneRow).toHaveClass("phone-list-row");
        expect(phoneRow).toHaveAttribute("tabindex", "0");
        phoneRow.focus();
        expect(phoneRow).toHaveFocus();
        await userEvent.keyboard(key);
        await waitFor(() =>
          expect(
            screen.getByRole("heading", { name: reference }),
          ).toBeInTheDocument(),
        );
        if (key === "{Enter}")
          await userEvent.click(
            screen.getByRole("button", { name: "Back to requests" }),
          );
      }
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: desktopWidth,
      });
      fireEvent(window, new Event("resize"));
    }
  });
  it("keeps invalid quantities unposted and explains the blocker", async () => {
    await mount();
    const sessionBeforeSwitch2 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, sessionBeforeSwitch2);
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await choose("Ask this location", "Warehouse");
    await userEvent.type(
      screen.getByLabelText(
        "Add a product, or type an item that isn't in the catalog",
      ),
      "Bread",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Add item/ }));
    await userEvent.clear(screen.getByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      screen.getByRole("alert", { name: "What's missing" }),
    ).toHaveTextContent("positive whole number of units");
    expect((await sharedUiCanonical()).branch_requests ?? []).toHaveLength(0);
    expect(screen.getByLabelText("Quantity")).toHaveValue("1.5");
    expect(screen.getByLabelText("Quantity")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const link = screen.getByRole("link", {
      name: /positive whole number of units/,
    });
    expect(link).toHaveAttribute(
      "href",
      `#${screen.getByLabelText("Quantity").id}`,
    );
    await userEvent.click(link);
    expect(screen.getByLabelText("Quantity")).toHaveFocus();
  });
  it("clears draft editor when the acting user or endpoint changes, and blocks Cashier", async () => {
    await mount();
    const sessionBeforeSwitch3 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Supervisor session"));
    await waitForSharedUiActor("manager", undefined, sessionBeforeSwitch3);
    fireEvent.click(screen.getByText("Choose other location"));
    await waitForSharedUiActor("manager", "Branch 2");
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await userEvent.type(
      screen.getByLabelText(
        "Add a product, or type an item that isn't in the catalog",
      ),
      "Other location private draft",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Add item/ }));
    expect(
      screen.getByText("Other location private draft"),
    ).toBeInTheDocument();
    const sessionBeforeSwitch4 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, sessionBeforeSwitch4);
    expect(
      screen.queryByText("Other location private draft"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(
        "Add a product, or type an item that isn't in the catalog",
      ),
    ).not.toBeInTheDocument();
    const sessionBeforeSwitch5 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Cashier session"));
    await waitForSharedUiActor("cashier", undefined, sessionBeforeSwitch5);
    expect(
      screen.getByText("You do not have access to Branch requests."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New request" }),
    ).not.toBeInTheDocument();
  });
  it("keeps Added non-selectable and saves genuine pack and note details once", async () => {
    await mount();
    const previousSession = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, previousSession);
    const baseline = await sharedUiCanonical();
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await choose("Ask this location", "Warehouse");
    const search = screen.getByLabelText(
      "Add a product, or type an item that isn't in the catalog",
    );
    await userEvent.type(search, "0001");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Added" })).toBeDisabled();
    expect(document.querySelectorAll(".request-draft-line")).toHaveLength(1);
    await choose("Units / Cases", "Cases");
    await userEvent.click(
      document.querySelector<HTMLButtonElement>(".request-line-pack-action")!,
    );
    await userEvent.clear(screen.getByLabelText("Units per case"));
    await userEvent.type(screen.getByLabelText("Units per case"), "12");
    await userEvent.clear(screen.getByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    await userEvent.type(
      screen.getByLabelText("Note (optional)"),
      "For the prepared shelf",
    );
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByLabelText("Note (optional)")).not.toBeInTheDocument();
    expect(screen.getByText("For the prepared shelf")).toBeInTheDocument();
    const save = screen.getByRole("button", {
      name: "Save as draft",
    });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(async () =>
      expect((await sharedUiCanonical()).branch_requests).toHaveLength(1),
    );
    const saved = (await sharedUiCanonical()).branch_requests![0];
    expect(saved).toMatchObject({
      status: "draft",
      from_branch: "Branch 1",
      to_branch: "Warehouse",
      items: [
        {
          product_code: "0001",
          quantity: "2",
          quantity_unit: "cases",
          units_per_case: 12,
          normalized_units: 24,
          note: "For the prepared shelf",
        },
      ],
    });
    const after = await sharedUiCanonical();
    expect(after.stock).toEqual(baseline.stock);
    expect(after.ledger).toEqual(baseline.ledger);
  });
  it("cancels local new-item edits without writing a request or History event", async () => {
    await mount();
    const previousSession = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, previousSession);
    const before = await sharedUiCanonical();
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await userEvent.type(
      screen.getByLabelText(
        "Add a product, or type an item that isn't in the catalog",
      ),
      "Fictional baking tray",
    );
    expect(
      screen.getByText("For things that aren't in the catalog"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Add item:/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "New request" }),
    ).not.toBeInTheDocument();
    const after = await sharedUiCanonical();
    expect(after.branch_requests).toEqual(before.branch_requests);
    expect(after.activity).toEqual(before.activity);
    expect(after.stock).toEqual(before.stock);
    expect(after.ledger).toEqual(before.ledger);
  });
});

beforeEach(async () => {
  await prepareSharedUiFixture();
});
afterEach(() => {
  disposeSharedUiFixture();
});
