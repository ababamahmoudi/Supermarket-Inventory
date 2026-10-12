import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProvider, STORAGE_KEY, useDemo } from "../store";
import BranchRequests from "./BranchRequests";
import { Notes } from "./Notes";
import SupplierItems from "./SupplierItems";

function SessionControls() {
  const { signIn, setBranch } = useDemo();
  return (
    <>
      <button onClick={() => signIn("floorworker", "demo1234")}>
        Worker session
      </button>
      <button onClick={() => signIn("supervisor", "demo1234")}>
        Supervisor session
      </button>
      <button onClick={() => setBranch("all")}>All locations</button>
    </>
  );
}
function AuthorizedSupplierItems() {
  const { role } = useDemo();
  return role === "supervisor" ? (
    <SupplierItems supplier="Fresh Valley Foods" editable />
  ) : null;
}
function mount(content: React.ReactNode) {
  render(
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
    mount(<BranchRequests />);
    fireEvent.click(screen.getByText("Worker session"));
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const list = screen.getByRole("alert", { name: "What's missing" });
    expect(within(list).getAllByRole("link")).toHaveLength(2);
    await userEvent.click(
      within(list).getByRole("link", {
        name: /different active sending location/,
      }),
    );
    expect(screen.getByLabelText("Sending location")).toHaveFocus();
    await choose(screen.getByLabelText("Sending location"), "Warehouse");
    expect(
      within(
        screen.getByRole("alert", { name: "What's missing" }),
      ).getAllByRole("link"),
    ).toHaveLength(1);
    expect(screen.getByLabelText("Search products")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).branch_requests ?? [],
    ).toHaveLength(0);
  });

  it("collects store-use requirements without saving and keeps unrelated errors", async () => {
    mount(<Notes />);
    fireEvent.click(screen.getByText("Worker session"));
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
    mount(<AuthorizedSupplierItems />);
    fireEvent.click(screen.getByText("Supervisor session"));
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText("Units per case"));
    await userEvent.type(within(dialog).getByLabelText("Units per case"), "0");
    await userEvent.type(
      within(dialog).getByLabelText("Expected unit cost (optional)"),
      "bad",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add item" }),
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
    mount(<Notes />);
    fireEvent.click(screen.getByText("Supervisor session"));
    fireEvent.click(screen.getByText("All locations"));
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(
      state.notes.find(
        (note: { text: string }) => note.text === "Bread for tomorrow",
      ),
    ).toMatchObject({ branch: "Branch 1", type: "to_order" });
  });
});
