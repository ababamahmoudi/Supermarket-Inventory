import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProvider, STORAGE_KEY, useDemo } from "../store";
import BranchRequests from "./BranchRequests";

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
      <button onClick={() => signIn("cashier", "demo1234")}>
        Cashier session
      </button>
      <button onClick={() => setBranch("Branch 2")}>
        Choose other location
      </button>
    </>
  );
}
function mount() {
  render(
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
    mount();
    fireEvent.click(screen.getByText("Worker session"));
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await choose("Sending location", "Warehouse");
    await userEvent.type(
      screen.getByLabelText("Free-text item"),
      "Small paper bags",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    await choose("Units / Cases", "Cases");
    await userEvent.clear(screen.getByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("Small paper bags")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark as sent" }),
    ).not.toBeInTheDocument();
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(state.branch_requests.at(-1)).toMatchObject({
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
  });
  it("keeps invalid quantities unposted and explains the blocker", async () => {
    mount();
    fireEvent.click(screen.getByText("Worker session"));
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await choose("Sending location", "Warehouse");
    await userEvent.type(screen.getByLabelText("Free-text item"), "Bread");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    await userEvent.clear(screen.getByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "positive whole number of units",
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).branch_requests ?? [],
    ).toHaveLength(0);
    expect(screen.getByLabelText("Quantity")).toHaveValue("1.5");
  });
  it("clears draft editor when the acting user or endpoint changes, and blocks Cashier", async () => {
    mount();
    fireEvent.click(screen.getByText("Supervisor session"));
    fireEvent.click(screen.getByText("Choose other location"));
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    await userEvent.type(
      screen.getByLabelText("Free-text item"),
      "Other location private draft",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(
      screen.getByText("Other location private draft"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Worker session"));
    expect(
      screen.queryByText("Other location private draft"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Free-text item")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Cashier session"));
    expect(
      screen.getByText("You do not have access to Branch requests."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New request" }),
    ).not.toBeInTheDocument();
  });
});
