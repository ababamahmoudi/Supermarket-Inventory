import {
  AuthenticatedUiProvider as DemoProvider,
  renderAuthenticatedUI as render,
  prepareSharedUiFixture,
  disposeSharedUiFixture,
  waitForSharedUiActor,
  sharedUiSessionId,
  sharedUiCanonical,
} from "../shared-ui-provider-test-fixture";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { useDemo } from "../store";
import BranchRequests from "./BranchRequests";
import { Notes } from "./Notes";
import SupplierItems from "./SupplierItems";
function SessionControls() {
  const { switchDemoUser, demoUsers, setBranch } = useDemo();
  const switchTo = (role: "manager" | "floor_worker") => {
    const user = demoUsers.find((person) => person.role === role);
    if (!user) throw new Error("Configured demo person is not ready");
    return switchDemoUser(user.username);
  };
  return (
    <>
      <button onClick={() => switchTo("floor_worker")}>Worker session</button>
      <button onClick={() => switchTo("manager")}>Supervisor session</button>
      <button onClick={() => setBranch("all")}>All locations</button>
    </>
  );
}
function AuthorizedSupplierItems() {
  const { can, state } = useDemo();
  return can("supplier_items.manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
  }) ? (
    <SupplierItems supplier="Fresh Valley Foods" editable />
  ) : null;
}
async function mount(content: React.ReactNode) {
  await render(
    <DemoProvider>
      <SessionControls />
      {content}
    </DemoProvider>,
  );
}
async function choose(field: HTMLElement, label: string) {
  await userEvent.click(field);
  await userEvent.click(screen.getByRole("option", { name: label }));
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "";
});
describe("C6 missing-field navigation across existing forms", () => {
  it("keeps empty request Send clickable and clears only the repaired issue", async () => {
    await mount(<BranchRequests />);
    const sessionBeforeSwitch1 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, sessionBeforeSwitch1);
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    const list = screen.getByRole("alert", { name: "What's missing" });
    expect(within(list).getAllByRole("link")).toHaveLength(2);
    await userEvent.click(
      within(list).getByRole("link", {
        name: /different active sending location/,
      }),
    );
    expect(screen.getByLabelText("Ask this location")).toHaveFocus();
    await choose(screen.getByLabelText("Ask this location"), "Warehouse");
    expect(
      within(
        screen.getByRole("alert", { name: "What's missing" }),
      ).getAllByRole("link"),
    ).toHaveLength(1);
    expect(
      screen.getByLabelText(
        "Add a product, or type an item that isn't in the catalog",
      ),
    ).toHaveAttribute("aria-invalid", "true");
    expect((await sharedUiCanonical()).branch_requests ?? []).toHaveLength(0);
  });
  it("collects store-use requirements without saving and keeps unrelated errors", async () => {
    await mount(<Notes />);
    const sessionBeforeSwitch2 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Worker session"));
    await waitForSharedUiActor("floor_worker", undefined, sessionBeforeSwitch2);
    await userEvent.click(screen.getByRole("tab", { name: /Store use/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    const list = screen.getByRole("alert", { name: "What's missing" });
    expect(within(list).getAllByRole("link")).toHaveLength(3);
    await userEvent.click(
      within(list).getByRole("link", { name: "Enter a note before saving." }),
    );
    expect(screen.getByLabelText("Note")).toHaveFocus();
    await userEvent.type(
      screen.getByLabelText("Note"),
      "Paper bags for the deli",
    );
    expect(
      within(
        screen.getByRole("alert", { name: "What's missing" }),
      ).getAllByRole("link"),
    ).toHaveLength(2);
    expect(screen.getByLabelText(/Actual quantity used/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
  it("collects supplier-item product, pack and cost errors and focuses actual fields", async () => {
    await mount(<AuthorizedSupplierItems />);
    const sessionBeforeSwitch3 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Supervisor session"));
    await waitForSharedUiActor("manager", undefined, sessionBeforeSwitch3);
    await userEvent.click(screen.getByRole("button", { name: /^Add item/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText("Units per case"));
    await userEvent.type(within(dialog).getByLabelText("Units per case"), "0");
    await userEvent.type(
      within(dialog).getByLabelText("Expected unit cost (optional)"),
      "bad",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^Add item/ }),
    );
    const list = within(dialog).getByRole("alert", { name: "What's missing" });
    expect(within(list).getAllByRole("link")).toHaveLength(3);
    await userEvent.click(
      within(list).getByRole("link", { name: "Choose a product." }),
    );
    expect(within(dialog).getByLabelText("Product")).toHaveFocus();
    await userEvent.clear(within(dialog).getByLabelText("Units per case"));
    await userEvent.type(within(dialog).getByLabelText("Units per case"), "12");
    expect(
      within(
        within(dialog).getByRole("alert", { name: "What's missing" }),
      ).getAllByRole("link"),
    ).toHaveLength(2);
  });
  it("lets a Supervisor choose the actual location for a built-in note at All locations", async () => {
    await mount(<Notes />);
    const sessionBeforeSwitch4 = sharedUiSessionId();
    fireEvent.click(screen.getByText("Supervisor session"));
    await waitForSharedUiActor("manager", undefined, sessionBeforeSwitch4);
    fireEvent.click(screen.getByText("All locations"));
    await waitForSharedUiActor("manager", "all");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    await userEvent.type(screen.getByLabelText("Note"), "Bread for tomorrow");
    expect(screen.getByRole("button", { name: "Save note" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    await userEvent.click(
      screen.getByRole("link", { name: "Choose a location for this note." }),
    );
    expect(screen.getByLabelText("Location")).toHaveFocus();
    await choose(screen.getByLabelText("Location"), "North York");
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(
      () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    const state = await sharedUiCanonical();
    expect(
      state.notes.find(
        (note: { text: string }) => note.text === "Bread for tomorrow",
      ),
    ).toMatchObject({ branch: "Branch 1", type: "to_order" });
  });
});
beforeEach(async () => {
  await prepareSharedUiFixture();
});
afterEach(() => {
  disposeSharedUiFixture();
});
