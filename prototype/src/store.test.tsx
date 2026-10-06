import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
function Probe() {
  const demo = useDemo();
  return (
    <>
      <output data-testid="branch">{demo.branch}</output>
      <output data-testid="role">{demo.role}</output>
      <output data-testid="name">{demo.state.products[0].name_en}</output>
      <output data-testid="money">{demo.money("169.79")}</output>
      <button onClick={() => demo.signIn("floor_worker", "2222")}>
        Worker
      </button>
      <button onClick={() => demo.setBranch("Branch 2")}>Branch 2</button>
      <button
        onClick={() =>
          demo.update((draft) => {
            draft.products[0].name_en = "Changed only in browser";
          })
        }
      >
        Edit
      </button>
      <button onClick={demo.reset}>Reset</button>
    </>
  );
}
describe("fictional data and storage", () => {
  it("seeds approvals, scoped returns and the existing replacement once", () => {
    const state = initialState();
    expect(state.approvals).toHaveLength(2);
    expect(
      state.products.find((product) => product.code === "0006")?.pending_price,
    ).toBe("2.99");
    expect(state.templates).toEqual([]);
    expect(state.ledger).toEqual([]);
    expect(state.stock["Branch 1:0001"]).toBe(1);
    expect(state.stock["Branch 2:0001"]).toBe(0);
    expect(
      state.returns.every(
        (record) => record.company_id === state.config.company.seed_key,
      ),
    ).toBe(true);
  });
  it("persists updates, restores after reload, and resets without changing the role", () => {
    const view = render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Worker"));
    fireEvent.click(screen.getByText("Edit"));
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).products[0].name_en,
    ).toBe("Changed only in browser");
    view.unmount();
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    expect(screen.getByTestId("name")).toHaveTextContent(
      "Changed only in browser",
    );
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("name")).toHaveTextContent(
      initialState().products[0].name_en,
    );
    expect(screen.getByTestId("role")).toHaveTextContent("floor_worker");
    expect(screen.getByTestId("money")).toHaveTextContent("$169.79");
  });
  it("does not let assigned workers change branches", () => {
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("Worker"));
    fireEvent.click(screen.getByText("Branch 2"));
    expect(screen.getByTestId("branch")).toHaveTextContent("Branch 1");
  });
  it("recovers from corrupt or outdated browser state", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    expect(screen.getByTestId("name")).toHaveTextContent(
      initialState().products[0].name_en,
    );
  });
});
