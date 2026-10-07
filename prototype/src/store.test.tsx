import { StrictMode, useState } from "react";
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
      <button onClick={() => demo.signIn("floorworker", "demo1234")}>
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
  it("uses the company's configured light and dark brand colors", () => {
    const state = initialState();
    state.config.company.branding.primary_color = "#0F766E";
    state.config.company.branding.dark_primary_color = "#5EEAD4";
    state.config.company.branding.kpi_accent_end_color = "#0D9488";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--company-primary")).toBe("#0F766E");
    expect(style.getPropertyValue("--company-dark-primary")).toBe("#5EEAD4");
    expect(style.getPropertyValue("--company-kpi-accent-end")).toBe("#0D9488");
  });
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

function TransactionProbe() {
  const demo = useDemo();
  const [error, setError] = useState("");
  return (
    <>
      <output data-testid="transaction-name">
        {demo.state.products[0].name_en}
      </output>
      <output data-testid="transaction-stock">
        {demo.state.stock["Branch 1:0001"]}
      </output>
      <output data-testid="caught-error">{error}</output>
      <button
        onClick={() => {
          try {
            demo.update((draft) => {
              draft.products[0].name_en = "A change that must not publish";
              draft.stock["Branch 1:0001"] += 100;
              throw new Error(
                "The supplied quantity exceeds the remaining units.",
              );
            });
          } catch (caught) {
            setError((caught as Error).message);
          }
        }}
      >
        Attempt invalid action
      </button>
      <button
        onClick={() => {
          demo.update((draft) => {
            draft.products[0].name_en = "First successful update";
            draft.stock["Branch 1:0001"] += 2;
          });
          demo.update((draft) => {
            draft.stock["Branch 1:0001"] += 3;
          });
        }}
      >
        Receive two deliveries
      </button>
      <button
        onClick={() => {
          demo.reset();
          demo.update((draft) => {
            draft.products[0].name_en += " after reset";
            draft.stock["Branch 1:0001"] += 1;
          });
        }}
      >
        Reset and receive
      </button>
    </>
  );
}
function showTransactions() {
  render(
    <StrictMode>
      <DemoProvider>
        <TransactionProbe />
      </DemoProvider>
    </StrictMode>,
  );
}
describe("atomic synchronous demo actions", () => {
  it("allows the caller to catch a rejected mutation without publishing partial changes", () => {
    showTransactions();
    const original = initialState();
    fireEvent.click(screen.getByText("Attempt invalid action"));
    expect(screen.getByTestId("caught-error")).toHaveTextContent(
      "The supplied quantity exceeds the remaining units.",
    );
    expect(screen.getByTestId("transaction-name")).toHaveTextContent(
      original.products[0].name_en,
    );
    expect(screen.getByTestId("transaction-stock")).toHaveTextContent("1");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.products[0].name_en).toBe(original.products[0].name_en);
    expect(saved.stock["Branch 1:0001"]).toBe(1);
    fireEvent.click(screen.getByText("Receive two deliveries"));
    expect(screen.getByTestId("transaction-stock")).toHaveTextContent("6");
  });
  it("conserves both successful deliveries submitted in the same event", () => {
    showTransactions();
    fireEvent.click(screen.getByText("Receive two deliveries"));
    expect(screen.getByTestId("transaction-name")).toHaveTextContent(
      "First successful update",
    );
    expect(screen.getByTestId("transaction-stock")).toHaveTextContent("6");
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).stock["Branch 1:0001"],
    ).toBe(6);
  });
  it("starts the next same-event mutation from the reset seed rather than stale state", () => {
    showTransactions();
    fireEvent.click(screen.getByText("Receive two deliveries"));
    fireEvent.click(screen.getByText("Reset and receive"));
    expect(screen.getByTestId("transaction-name")).toHaveTextContent(
      initialState().products[0].name_en + " after reset",
    );
    expect(screen.getByTestId("transaction-stock")).toHaveTextContent("2");
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).stock["Branch 1:0001"],
    ).toBe(2);
  });
});

function AuthProbe() {
  const demo = useDemo();
  const [error, setError] = useState("");
  return (
    <>
      <output data-testid="username">{demo.user?.username}</output>
      <output data-testid="must-change">
        {String(demo.mustChangePassword)}
      </output>
      <output data-testid="locked">{String(demo.locked)}</output>
      <output data-testid="actor">{demo.state.activity.at(-1)?.by}</output>
      <output data-testid="auth-error">{error}</output>
      <output data-testid="stored-product">
        {demo.state.products[0].name_en}
      </output>
      <button onClick={() => demo.signIn("newemployee", "temp1234")}>
        New employee
      </button>
      <button
        onClick={() => setError(demo.choosePassword("summer orchard") ?? "")}
      >
        Choose password
      </button>
      <button onClick={() => setError(demo.choosePassword("short") ?? "")}>
        Short password
      </button>
      <button
        onClick={() => {
          try {
            demo.update((draft) => {
              draft.activity.push({
                id: `probe-${draft.activity.length}`,
                company_id: draft.config.company.seed_key,
                branch: "Branch 1",
                action: "Added note",
                by: "Demo Floor Worker",
                at: new Date().toISOString(),
              });
            });
            setError("");
          } catch (caught) {
            setError((caught as Error).message);
          }
        }}
      >
        Record action
      </button>
      <button onClick={demo.lock}>Lock session</button>
    </>
  );
}
describe("password gates and employee identity", () => {
  it("blocks business mutations until the new employee chooses a password, then records that employee as the actor", () => {
    render(
      <DemoProvider>
        <AuthProbe />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByText("New employee"));
    expect(screen.getByTestId("username")).toHaveTextContent("newemployee");
    fireEvent.click(screen.getByText("Record action"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent(
      "choose your password",
    );
    expect(screen.getByTestId("actor")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByText("Choose password"));
    expect(screen.getByTestId("must-change")).toHaveTextContent("false");
    fireEvent.click(screen.getByText("Record action"));
    expect(screen.getByTestId("actor")).toHaveTextContent("Demo New Employee");
    fireEvent.click(screen.getByText("Lock session"));
    fireEvent.click(screen.getByText("Record action"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent("Sign in");
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity,
    ).toHaveLength(1);
  });
  it("keeps old business edits and applies the new password policy when restoring PIN-era state", () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    old.products[0].name_en = "Existing browser edit";
    old.config.session = { idle_lock_minutes: 5, pins: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    render(
      <DemoProvider>
        <AuthProbe />
      </DemoProvider>,
    );
    expect(screen.getByTestId("stored-product")).toHaveTextContent(
      "Existing browser edit",
    );
    fireEvent.click(screen.getByText("New employee"));
    fireEvent.click(screen.getByText("Short password"));
    expect(screen.getByTestId("auth-error")).toHaveTextContent("too_short");
    expect(screen.getByTestId("must-change")).toHaveTextContent("true");
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).config.session.pins,
    ).toBe(false);
  });
});
