import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { LEGACY_AUTH_STORAGE_KEY } from "./authority-initialization";
import {
  shellProviderFixture,
  legacyEmployee,
  retainedCashierLocationFixture,
} from "./shell-provider-test-fixture";
import type { ProviderOptions } from "./store";
import type { DemoState } from "./types";
const fixtures: { dispose(): void }[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.dispose());
  vi.unstubAllGlobals();
});
async function authenticated(
  state = initialState(),
  role: Parameters<typeof authenticatedProviderFixture>[0]["role"] = "manager",
) {
  const fixture = await authenticatedProviderFixture({ state, role });
  fixtures.push(fixture);
  return fixture;
}
let probeCompleted: Promise<unknown> = Promise.resolve();
function Probe() {
  const demo = useDemo();
  const [error, setError] = useState("");
  const scope = {
    company_id: demo.state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const run = (operation: () => Promise<unknown>) => {
    probeCompleted = Promise.resolve()
      .then(operation)
      .then(() => setError(""))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : String(caught)),
      );
  };
  return (
    <>
      <output data-testid="stage">{demo.authStage}</output>
      <output data-testid="branch">{demo.branch}</output>
      <output data-testid="role">{demo.role}</output>
      <output data-testid="name">{demo.state.products[0]?.name_en}</output>
      <output data-testid="money">{demo.money("169.79")}</output>
      <output data-testid="error">{error}</output>
      <output data-testid="storage-error">{String(demo.storageError)}</output>
      <button onClick={() => run(() => demo.switchDemoUser("ny-floor"))}>
        Worker
      </button>
      <button onClick={() => run(() => demo.setBranch("Branch 2"))}>
        Branch 2
      </button>
      <button
        onClick={() =>
          run(() =>
            demo.command("catalog.edit", scope, (draft) => {
              draft.products[0].name_en = "Changed only in browser";
            }),
          )
        }
      >
        Edit
      </button>
      <button onClick={() => run(() => demo.reset())}>Reset</button>
    </>
  );
}
async function show(options: ProviderOptions, child = <Probe />) {
  const view = render(<DemoProvider options={options}>{child}</DemoProvider>);
  await waitFor(
    () => expect(screen.getByTestId("stage")).not.toHaveTextContent("loading"),
    { timeout: 10000 },
  );
  return view;
}
describe("fictional data and storage", () => {
  it("uses the company configured light and dark brand colors", async () => {
    const state = initialState();
    state.config.company.branding.primary_color = "#0F766E";
    state.config.company.branding.dark_primary_color = "#5EEAD4";
    state.config.company.branding.kpi_accent_end_color = "#0D9488";
    const fixture = await authenticated(state);
    await show(fixture.options);
    const style = document.documentElement.style;
    await waitFor(() => {
      expect(style.getPropertyValue("--company-primary")).toBe("#0F766E");
      expect(style.getPropertyValue("--company-dark-primary")).toBe("#5EEAD4");
      expect(style.getPropertyValue("--company-kpi-accent-end")).toBe(
        "#0D9488",
      );
    });
  });
  it("seeds approvals, scoped returns and the existing replacement once", () => {
    const state = initialState();
    expect(state.approvals).toHaveLength(2);
    expect(
      state.products.find((product) => product.code === "0006")?.pending_price,
    ).toBe("2.99");
    expect(
      state.templates.map(({ name, built_in, width, height }) => ({
        name,
        built_in,
        width,
        height,
      })),
    ).toEqual([
      { name: "Regular", built_in: "regular", width: 60, height: 40 },
      { name: "Promo", built_in: "promo", width: 210, height: 148.5 },
    ]);
    expect(state.ledger).toHaveLength(24);
    expect(state.stock["Branch 1:0001"]).toBe(61);
    expect(state.stock["Branch 2:0001"]).toBe(18);
    expect(
      state.returns.every(
        (record) => record.company_id === state.config.company.seed_key,
      ),
    ).toBe(true);
  });
  it("persists updates, restores after reload, and resets without changing the role", async () => {
    const fixture = await authenticated();
    const view = await show(fixture.options);
    fireEvent.click(screen.getByText("Edit"));
    await act(async () => {
      await probeCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent(
        "Changed only in browser",
      ),
    );
    expect((await fixture.readCanonical()).products[0].name_en).toBe(
      "Changed only in browser",
    );
    fireEvent.click(screen.getByText("Worker"));
    await act(async () => {
      await probeCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("floor_worker"),
    );
    view.unmount();
    await show(fixture.options);
    expect(screen.getByTestId("name")).toHaveTextContent(
      "Changed only in browser",
    );
    fireEvent.click(screen.getByText("Reset"));
    await act(async () => {
      await probeCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent(
        initialState().products[0].name_en,
      ),
    );
    expect(screen.getByTestId("role")).toHaveTextContent("floor_worker");
    expect(screen.getByTestId("money")).toHaveTextContent("$169.79");
  });
  it("does not let assigned workers change to unrelated branches", async () => {
    const fixture = await authenticated(initialState(), "floor_worker");
    await show(fixture.options);
    fireEvent.click(screen.getByText("Branch 2"));
    await act(async () => {
      await probeCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("error")).not.toBeEmptyDOMElement(),
    );
    expect(screen.getByTestId("branch")).toHaveTextContent("Branch 1");
    expect(
      (await fixture.repository.load(fixture.actor.company_id)).sessions.find(
        (session) => session.id === fixture.identity.session_id,
      )?.selected_location,
    ).toEqual({ kind: "location", location_id: "Branch 1" });
  });
  it("preserves corrupt browser state and blocks replacement instead of manufacturing fallback data", async () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    const fixture = shellProviderFixture();
    fixtures.push(fixture);
    await show(fixture.options);
    expect(screen.getByTestId("storage-error")).toHaveTextContent("true");
    expect(screen.getByTestId("name")).toBeEmptyDOMElement();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
    expect(screen.getByTestId("role")).toBeEmptyDOMElement();
  });
});
let transactionCompleted: Promise<unknown> = Promise.resolve();
function TransactionProbe() {
  const demo = useDemo();
  const [error, setError] = useState("");
  const scope = {
    company_id: demo.state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const command = (mutate: (draft: DemoState) => void) =>
    demo.command("catalog.edit", scope, mutate);
  const run = (operation: () => Promise<unknown>) => {
    transactionCompleted = Promise.resolve()
      .then(operation)
      .then(() => setError(""))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : String(caught)),
      );
  };
  return (
    <>
      <output data-testid="stage">{demo.authStage}</output>
      <output data-testid="transaction-name">
        {demo.state.products[0]?.name_en}
      </output>
      <output data-testid="transaction-stock">
        {demo.state.stock["Branch 1:0001"]}
      </output>
      <output data-testid="caught-error">{error}</output>
      <button
        onClick={() =>
          run(() =>
            command((draft) => {
              draft.products[0].name_en = "A change that must not publish";
              draft.stock["Branch 1:0001"] += 100;
              throw new Error(
                "The supplied quantity exceeds the remaining units.",
              );
            }),
          )
        }
      >
        Attempt invalid action
      </button>
      <button
        onClick={() =>
          run(async () => {
            await command((draft) => {
              draft.products[0].name_en = "First successful update";
              draft.stock["Branch 1:0001"] += 2;
            });
            await command((draft) => {
              draft.stock["Branch 1:0001"] += 3;
            });
          })
        }
      >
        Receive two deliveries
      </button>
      <button
        onClick={() =>
          run(async () => {
            await demo.reset();
            await command((draft) => {
              draft.products[0].name_en += " after reset";
              draft.stock["Branch 1:0001"] += 1;
            });
          })
        }
      >
        Reset and receive
      </button>
    </>
  );
}
describe("atomic fresh authorized demo actions", () => {
  it("rejects a retained Cashier session after its assigned store becomes a warehouse before any mutation", async () => {
    const fixture = await retainedCashierLocationFixture();
    fixtures.push(fixture);
    const before = await fixture.readCanonical();
    await show(fixture.options, <TransactionProbe />);
    fireEvent.click(screen.getByText("Attempt invalid action"));
    await act(async () => {
      await transactionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("caught-error")).not.toBeEmptyDOMElement(),
    );
    expect(screen.getByTestId("stage")).toHaveTextContent("signed_out");
    expect(screen.getByTestId("transaction-name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("transaction-stock")).toBeEmptyDOMElement();
    const saved = await fixture.readCanonical();
    expect(saved.products).toEqual(before.products);
    expect(saved.stock).toEqual(before.stock);
    expect(saved.stock_movements).toEqual(before.stock_movements);
    expect(saved.activity).toEqual(before.activity);
  });
  it("allows the caller to catch a rejected mutation without publishing partial changes", async () => {
    const fixture = await authenticated();
    const original = await fixture.readCanonical();
    await show(fixture.options, <TransactionProbe />);
    fireEvent.click(screen.getByText("Attempt invalid action"));
    await act(async () => {
      await transactionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("caught-error")).toHaveTextContent(
        "The supplied quantity exceeds the remaining units.",
      ),
    );
    expect(screen.getByTestId("transaction-name")).toHaveTextContent(
      original.products[0].name_en,
    );
    expect(screen.getByTestId("transaction-stock")).toHaveTextContent(
      String(original.stock["Branch 1:0001"]),
    );
    const saved = await fixture.readCanonical();
    expect(saved.products[0].name_en).toBe(original.products[0].name_en);
    expect(saved.stock["Branch 1:0001"]).toBe(original.stock["Branch 1:0001"]);
    fireEvent.click(screen.getByText("Receive two deliveries"));
    await act(async () => {
      await transactionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("transaction-stock")).toHaveTextContent(
        String(original.stock["Branch 1:0001"] + 5),
      ),
    );
  });
  it("conserves both successful deliveries submitted in the same event", async () => {
    const fixture = await authenticated();
    await show(fixture.options, <TransactionProbe />);
    fireEvent.click(screen.getByText("Receive two deliveries"));
    await act(async () => {
      await transactionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("transaction-stock")).toHaveTextContent(
        String(initialState().stock["Branch 1:0001"] + 5),
      ),
    );
    expect(screen.getByTestId("transaction-name")).toHaveTextContent(
      "First successful update",
    );
    expect((await fixture.readCanonical()).stock["Branch 1:0001"]).toBe(
      initialState().stock["Branch 1:0001"] + 5,
    );
  });
  it("starts the next same-event mutation from the reset seed rather than stale state", async () => {
    const fixture = await authenticated();
    await show(fixture.options, <TransactionProbe />);
    fireEvent.click(screen.getByText("Receive two deliveries"));
    await act(async () => {
      await transactionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("transaction-stock")).toHaveTextContent(
        String(initialState().stock["Branch 1:0001"] + 5),
      ),
    );
    fireEvent.click(screen.getByText("Reset and receive"));
    await act(async () => {
      await transactionCompleted;
    });
    await waitFor(() =>
      expect(screen.getByTestId("transaction-name")).toHaveTextContent(
        initialState().products[0].name_en + " after reset",
      ),
    );
    expect(screen.getByTestId("transaction-stock")).toHaveTextContent(
      String(initialState().stock["Branch 1:0001"] + 1),
    );
    expect((await fixture.readCanonical()).stock["Branch 1:0001"]).toBe(
      initialState().stock["Branch 1:0001"] + 1,
    );
  });
});
let authProbeCompleted: Promise<unknown> = Promise.resolve();
function AuthProbe() {
  const demo = useDemo();
  const [error, setError] = useState("");
  const run = (operation: () => Promise<unknown>) => {
    authProbeCompleted = Promise.resolve()
      .then(operation)
      .then((value) => setError(typeof value === "string" ? value : ""))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : String(caught)),
      );
  };
  return (
    <>
      <output data-testid="stage">{demo.authStage}</output>
      <output data-testid="username">{demo.user?.username}</output>
      <output data-testid="must-change">
        {String(demo.mustChangePassword)}
      </output>
      <output data-testid="locked">{String(demo.locked)}</output>
      <output data-testid="actor">{demo.state.activity.at(-1)?.by}</output>
      <output data-testid="auth-error">{error}</output>
      <output data-testid="stored-product">
        {demo.state.products[0]?.name_en}
      </output>
      <button onClick={() => run(() => demo.signIn("newemployee", "temp1234"))}>
        New employee
      </button>
      <button onClick={() => run(() => demo.choosePassword("summer orchard"))}>
        Choose password
      </button>
      <button onClick={() => run(() => demo.choosePassword("short"))}>
        Short password
      </button>
      <button
        onClick={() =>
          run(() =>
            demo.command(
              "notes.entry_add",
              {
                company_id: demo.state.config.company.seed_key,
                kind: "location_record",
                location_ids: ["Branch 1"],
              },
              (draft, actor) => {
                draft.activity.push({
                  id: `probe-${draft.activity.length}`,
                  company_id: actor.company_id,
                  branch: actor.branch,
                  action: "Added note",
                  by: actor.actor,
                  actor_user_id: actor.user_id,
                  at: new Date().toISOString(),
                });
              },
            ),
          )
        }
      >
        Record action
      </button>
      <button onClick={() => run(() => demo.lock())}>Lock session</button>
    </>
  );
}
async function completeAuthProbeAction(label: string) {
  fireEvent.click(screen.getByText(label));
  // Wait for the actual SDK operation, canonical publication and test probe
  // error/result update. No timer, actor, permission or source is replaced.
  await act(async () => {
    await authProbeCompleted;
  });
}
describe("password gates and employee identity", () => {
  it("blocks business mutations until the new employee chooses a password then records that employee as the actor", async () => {
    localStorage.setItem(LEGACY_AUTH_STORAGE_KEY, legacyEmployee);
    const fixture = shellProviderFixture();
    fixtures.push(fixture);
    await show(fixture.options, <AuthProbe />);
    const original = (
      await fixture.repository.loadBusiness<DemoState>(
        fixture.options.companyId,
      )
    ).state;
    await completeAuthProbeAction("New employee");
    await waitFor(() =>
      expect(screen.getByTestId("must-change")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("username")).toHaveTextContent("newemployee");
    await completeAuthProbeAction("Record action");
    await waitFor(() =>
      expect(screen.getByTestId("auth-error")).not.toBeEmptyDOMElement(),
    );
    expect(screen.getByTestId("actor")).toBeEmptyDOMElement();
    expect(
      (
        await fixture.repository.loadBusiness<DemoState>(
          fixture.options.companyId,
        )
      ).state.activity,
    ).toEqual(original.activity);
    await completeAuthProbeAction("Choose password");
    await waitFor(() =>
      expect(screen.getByTestId("must-change")).toHaveTextContent("false"),
    );
    await completeAuthProbeAction("Record action");
    await waitFor(() =>
      expect(screen.getByTestId("actor")).toHaveTextContent(
        "Demo New Employee",
      ),
    );
    await completeAuthProbeAction("Lock session");
    await waitFor(() =>
      expect(screen.getByTestId("locked")).toHaveTextContent("true"),
    );
    await completeAuthProbeAction("Record action");
    await waitFor(() =>
      expect(screen.getByTestId("auth-error")).not.toBeEmptyDOMElement(),
    );
    expect(
      (
        await fixture.repository.loadBusiness<DemoState>(
          fixture.options.companyId,
        )
      ).state.activity,
    ).toHaveLength(original.activity.length + 1);
  });
  it("keeps old business edits and applies the new password policy when restoring PIN-era state", async () => {
    const old = initialState();
    old.products[0].name_en = "Existing browser edit";
    old.config.session.pins = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    localStorage.setItem(LEGACY_AUTH_STORAGE_KEY, legacyEmployee);
    const fixture = shellProviderFixture();
    fixtures.push(fixture);
    await show(fixture.options, <AuthProbe />);
    expect(
      (
        await fixture.repository.loadBusiness<DemoState>(
          fixture.options.companyId,
        )
      ).state.products[0].name_en,
    ).toBe("Existing browser edit");
    fireEvent.click(screen.getByText("New employee"));
    await waitFor(() =>
      expect(screen.getByTestId("must-change")).toHaveTextContent("true"),
    );
    fireEvent.click(screen.getByText("Short password"));
    await waitFor(() =>
      expect(screen.getByTestId("auth-error")).toHaveTextContent("too_short"),
    );
    expect(screen.getByTestId("must-change")).toHaveTextContent("true");
    expect(
      (
        await fixture.repository.loadBusiness<DemoState>(
          fixture.options.companyId,
        )
      ).state.config.session.pins,
    ).toBe(false);
  });
});
