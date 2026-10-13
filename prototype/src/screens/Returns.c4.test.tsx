import { afterEach, beforeEach, expect, it } from "vitest";
import { useState } from "react";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { authenticatedTestActor } from "../authority-test-fixture";
import { useProtectedQuery } from "../use-protected-query";
import { domainScope } from "../domain-authority";
import type { DemoState } from "../types";
import type { AuthenticatedActor } from "../authority-types";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, useDemo } from "../store";
import { returnFixture } from "../return-test-fixture";
import {
  recordPickup,
  submitFinancialClaim,
  postLedgerAdjustment,
} from "../operations";
import { SettingsConfigurationGate } from "../SettingsConfigurationGate";
import { ReturnMemoDocument } from "../return-memo";
import { Returns } from "./Returns";
import { ReturnsSettings } from "./ReturnsSettings";
import Payables from "./Payables";
import { SupplierReturnsPanel } from "./SupplierReturnsPanel";
import { supplierPage } from "../suppliers";
import i18n from "../i18n";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#return?id=c4-return";
  await i18n.changeLanguage("en");
});
const worker = (state: DemoState) =>
  authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Demo Floor Worker",
  });
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
async function renderReturnCase(
  page: "returns" | "payables" | "supplier" | "settings" = "returns",
  weighted = false,
) {
  const state = returnFixture();
  if (weighted) {
    state.products.find((item) => item.code === "0003")!.sold_by = "weight";
    state.returns[0].lines[0].qty = 0.3;
    recordPickup(state, worker(state), "c4-return", {
      quantities: { "0003": 0.3 },
      representative: "Demo Driver",
      slip: "SIGNED-WEIGHT-C4",
    });
  }
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: {
      selection: { kind: "location", location_id: "Branch 1" },
      name_en: "Demo Supervisor",
    },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Harness page={page} />
    </DemoProvider>,
  );
  return fixture;
}
async function waitForFixture() {
  await waitFor(
    () => {
      const error = screen.queryByTestId("fixture-error")?.textContent;
      if (error) throw new Error(error);
      if (screen.queryByTestId("fixture-busy")?.textContent !== "ready")
        throw new Error("Waiting for lawful fixture command");
    },
    { timeout: 10000 },
  );
}
function Harness({
  page = "returns",
}: {
  page?: "returns" | "payables" | "supplier" | "settings";
}) {
  const { state, command, switchDemoUser, actor, setBranch, setLang } =
    useDemo();
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const supplierRead = useProtectedQuery(
    page === "supplier" ? "suppliers.read" : null,
    domainScope(state),
    (canonical, freshActor) =>
      supplierPage(canonical, freshActor, "Fresh Valley Foods").returns,
    "Fresh Valley Foods",
  );
  const returnScope = domainScope(
    state,
    {
      id: "c4-return",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
    },
    true,
  );
  const withWorker = async (
    action: (draft: DemoState, freshActor: AuthenticatedActor) => void,
  ) => {
    setBusy(true);
    setError("");
    try {
      await switchDemoUser("floorworker");
      await setBranch("Branch 1");
      await command("returns.operational_resolve", returnScope, action);
      await switchDemoUser("manager");
      await setBranch("Branch 1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  const evidencedPickup = async () => {
    setBusy(true);
    setError("");
    try {
      await switchDemoUser("floorworker");
      await setBranch("Branch 1");
      await command("returns.pickup_record", returnScope, (draft, freshActor) =>
        recordPickup(draft, freshActor, "c4-return", {
          quantities: { "0003": 3 },
          representative: "Demo Driver",
          slip: "SIGNED-C4-001",
        }),
      );
      await switchDemoUser("manager");
      await setBranch("Branch 1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {actor && (
        <button
          onClick={() => {
            setLoaded(true);
            if (page === "returns") {
              window.location.hash = "#return?id=c4-return";
              window.dispatchEvent(new HashChangeEvent("hashchange"));
            }
          }}
        >
          Load fictional return
        </button>
      )}
      <button
        onClick={() => {
          setBusy(true);
          void switchDemoUser("floorworker")
            .then(() => setBranch("Branch 1"))
            .catch((caught) => setError(String(caught)))
            .finally(() => setBusy(false));
        }}
      >
        Use worker
      </button>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <button onClick={() => void evidencedPickup()}>
        Record evidenced pickup
      </button>
      <button
        onClick={() =>
          void withWorker((draft, freshActor) =>
            submitFinancialClaim(draft, freshActor, "c4-return", {
              type: "credit_current_invoice",
              covers: { "0003": 3 },
              invoice_id: "c4-base-invoice",
              document: "C4-CREDIT-001",
              amount: "25.00",
            }),
          )
        }
      >
        Submit actual credit evidence
      </button>
      <button
        onClick={() => {
          setBusy(true);
          setError("");
          void command(
            "payables.write",
            domainScope(
              state,
              { company_id: state.config.company.seed_key, branch: "Branch 1" },
              true,
            ),
            (draft, freshActor) =>
              postLedgerAdjustment(draft, freshActor, {
                supplier: "Fresh Valley Foods",
                type: "adjustment",
                amount: "-1.00",
                date: "2026-10-01",
                reference: "C4-FICTIONAL-CONCURRENT-ADJUSTMENT",
                note: "Concurrent fictional correction",
              }),
          )
            .catch((caught) => setError(String(caught)))
            .finally(() => setBusy(false));
        }}
      >
        Concurrent financial change
      </button>
      <button onClick={() => setLoaded(true)}>Load weighed pickup</button>
      <output data-testid="fixture-busy">{busy ? "pending" : "ready"}</output>
      <output data-testid="fixture-error">{error}</output>
      <output data-testid="ledger-count">{state.ledger.length}</output>
      {loaded &&
        (page === "returns" ? (
          <Returns />
        ) : page === "payables" ? (
          <Payables />
        ) : page === "settings" ? (
          <SettingsConfigurationGate>
            <ReturnsSettings />
          </SettingsConfigurationGate>
        ) : (
          supplierRead.data && (
            <SupplierReturnsPanel
              supplier="Fresh Valley Foods"
              rows={supplierRead.data}
            />
          )
        ))}
    </>
  );
}

it("keeps an English-default retained RM memo available after pickup and shows no Returned to stock column", async () => {
  const user = userEvent.setup();
  await renderReturnCase();
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  expect(
    screen.queryByRole("columnheader", { name: "Returned to stock" }),
  ).not.toBeInTheDocument();
  await user.click(
    await screen.findByRole("button", { name: "Record evidenced pickup" }),
  );
  await waitForFixture();
  await user.click(await screen.findByRole("button", { name: "RM-0001" }));
  const dialog = await screen.findByRole("dialog", { name: "Return memo" });
  expect(within(dialog).getByText("Driver")).toBeInTheDocument();
  expect(within(dialog).queryByText("راننده")).not.toBeInTheDocument();
  expect(within(dialog).getByText("SIGNED-C4-001")).toBeInTheDocument();
  expect(within(dialog).getAllByText("$30.00")).toHaveLength(2);
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
});

it("renders an already recorded pickup success in Persian after a language change without changing the return", async () => {
  const user = userEvent.setup();
  const fixture = await renderReturnCase();
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Record pickup" }),
  );
  fireEvent.change(screen.getByLabelText("Actual pickup quantity"), {
    target: { value: "3" },
  });
  await user.type(
    screen.getByLabelText("Supplier representative name"),
    "Demo Driver",
  );
  await user.type(
    screen.getByLabelText("Signed paper pickup slip reference"),
    "SIGNED-LANGUAGE-SWITCH",
  );
  await user.click(
    screen.getAllByRole("button", { name: "Record pickup" }).at(-1)!,
  );
  const feedback = await screen.findByText(
    "Recorded pickup and retained Return memo.",
  );
  expect(feedback).toHaveAttribute("role", "status");
  const retainedState = await fixture.readSnapshot();
  await user.click(await screen.findByRole("button", { name: "Use Persian" }));
  expect(feedback).toHaveTextContent(
    "جمع‌آوری ثبت و یادداشت مرجوعی نگهداری شد.",
  );
  expect(feedback).not.toHaveTextContent("Recorded pickup");
  expect(await fixture.readSnapshot()).toEqual(retainedState);
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
});

it("requires confirmation for financial posting and blocks a concurrent balance change", async () => {
  const user = userEvent.setup();
  await renderReturnCase();
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Record evidenced pickup" }),
  );
  await waitForFixture();
  await user.click(
    await screen.findByRole("button", {
      name: "Submit actual credit evidence",
    }),
  );
  await waitForFixture();
  await user.click(
    await screen.findByRole("checkbox", {
      name: "I verified the document, covered quantities, and invoice allocation.",
    }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Verify and post claim" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Verify and post claim",
  });
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
  await user.click(
    await screen.findByRole("button", { name: "Concurrent financial change" }),
  );
  await waitForFixture();
  await user.click(
    within(dialog).getByRole("button", { name: "Verify and post claim" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This return or its payable changed",
  );
  await waitFor(() =>
    expect(screen.getByTestId("ledger-count")).toHaveTextContent("2"),
  );
});

it("lists a separate pending claim and a retained RM link in Supervisor Payables", async () => {
  const user = userEvent.setup();
  await renderReturnCase("payables");
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Record evidenced pickup" }),
  );
  await waitForFixture();
  await user.click(
    await screen.findByRole("link", { name: "Fresh Valley Foods" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Pending credit" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "RM-0001" })).toHaveAttribute(
    "href",
    "#return?id=c4-return&memo=RM-0001",
  );
  expect(screen.getByRole("link", { name: "View return" })).toBeInTheDocument();
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
});

it("uses Open/History in the supplier return tab and removes all money choices for a worker", async () => {
  const user = userEvent.setup();
  await renderReturnCase("supplier");
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Record evidenced pickup" }),
  );
  await waitForFixture();
  expect(
    await screen.findByRole("columnheader", { name: "Pending credit" }),
  ).toBeInTheDocument();
  await user.click(await screen.findByRole("tab", { name: "History" }));
  expect(
    screen.getByText("No returns match these filters."),
  ).toBeInTheDocument();
  await user.click(await screen.findByRole("tab", { name: "Open" }));
  expect(await screen.findByText("Waiting for credit")).toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Use worker" }));
  await waitForFixture();
  await screen.findByText("Waiting for credit");
  expect(
    screen.queryByRole("columnheader", { name: "Pending credit" }),
  ).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Columns" }));
  expect(
    screen.queryByRole("checkbox", { name: "Pending credit" }),
  ).not.toBeInTheDocument();
});

it("renders an English-default memo using frozen snapshots rather than live catalog names", () => {
  const state = returnFixture();
  recordPickup(state, worker(state), "c4-return", {
    quantities: { "0003": 3 },
    representative: "Demo Driver",
    slip: "SIGNED-C4-001",
  });
  const memo = state.returns[0].pickup_memos![0];
  state.products.find((product) => product.code === "0003")!.name_en =
    "Later catalog name";
  render(<ReturnMemoDocument memo={memo} language="fa" />);
  expect(screen.getByRole("article")).toHaveAttribute("dir", "ltr");
  expect(screen.getByText("Sour Cherry Juice 1 L")).toBeInTheDocument();
  expect(screen.queryByText("Later catalog name")).not.toBeInTheDocument();
  expect(screen.getAllByText("Signature")).toHaveLength(2);
  expect(screen.queryByText("امضا")).not.toBeInTheDocument();
});
it("clears the reminder field's validation on edit and saves return settings through the guarded action", async () => {
  const user = userEvent.setup();
  await renderReturnCase("settings");
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  const days = await screen.findByLabelText("Waiting-credit reminder (days)");
  await user.clear(days);
  await user.type(days, "0");
  await user.click(await screen.findByRole("button", { name: "Save changes" }));
  expect(
    screen.getAllByText("Enter a positive whole number of days."),
  ).toHaveLength(2);
  await user.clear(days);
  await user.type(days, "7");
  expect(
    screen.queryAllByText("Enter a positive whole number of days."),
  ).toHaveLength(0);
  await user.click(await screen.findByRole("button", { name: "Save changes" }));
  // React Activity keeps local feedback mounted while the protected config
  // refetches. Require the current screen to become visible, not merely text
  // retained in its hidden subtree.
  await waitFor(() => expect(screen.getByText("Changes saved.")).toBeVisible());
  expect(screen.getByText("Changes saved.")).toHaveAttribute("role", "status");
  expect(
    await screen.findByRole("link", { name: /Changed by/ }),
  ).toHaveAttribute("href", "#history");
});
it("posts confirmed actual credit only after the confirmation and preserves the retained memo", async () => {
  const user = userEvent.setup();
  await renderReturnCase();
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Record evidenced pickup" }),
  );
  await waitForFixture();
  await user.click(
    await screen.findByRole("button", {
      name: "Submit actual credit evidence",
    }),
  );
  await waitForFixture();
  await user.click(
    await screen.findByRole("checkbox", {
      name: "I verified the document, covered quantities, and invoice allocation.",
    }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Verify and post claim" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Verify and post claim",
  });
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
  await user.click(
    within(dialog).getByRole("button", { name: "Verify and post claim" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("ledger-count")).toHaveTextContent("2"),
  );
  expect(await screen.findByText("Closed (Credited)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "RM-0001" })).toBeInTheDocument();
});

it("accepts explicit three-decimal lb replacements and clears a precision error when that field changes", async () => {
  const user = userEvent.setup();
  const fixture = await renderReturnCase("returns", true);
  await user.click(
    await screen.findByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Load weighed pickup" }),
  );
  const items = screen.getByRole("table", { name: "" });
  expect(within(items).getAllByText("0.3 lb")).toHaveLength(2);
  await user.click(
    await screen.findByRole("button", { name: "Record resolution" }),
  );
  await user.click(await screen.findByRole("combobox", { name: "Outcome" }));
  await user.click(await screen.findByRole("option", { name: "Replaced" }));
  const covered = screen.getByLabelText("Original quantity covered");
  fireEvent.change(covered, { target: { value: "0.2" } });
  const replacement = screen.getByLabelText("Actual replacement quantity (lb)");
  expect(replacement).toHaveAttribute("step", "0.001");
  expect(replacement).toHaveAttribute("min", "0.001");
  fireEvent.change(replacement, { target: { value: "0.0001" } });
  await user.click(screen.getByLabelText("Remaining expected date"));
  await user.click(await screen.findByRole("button", { name: "2026-10-23" }));
  await user.type(
    screen.getByLabelText("Supplier representative name"),
    "Demo Driver",
  );
  await user.type(
    screen.getByLabelText("Replacement receipt reference"),
    "WEIGHED-REPLACEMENT-001",
  );
  await user.click(
    screen.getAllByRole("button", { name: "Record resolution" }).at(-1)!,
  );
  expect(
    screen
      .getAllByRole("alert")
      .some((alert) => alert.textContent?.includes("three decimal places")),
  ).toBe(true);
  fireEvent.change(replacement, { target: { value: "0.2" } });
  expect(
    screen
      .queryAllByRole("alert")
      .some((alert) => alert.textContent?.includes("three decimal places")),
  ).toBe(false);
  await user.click(
    screen.getAllByRole("button", { name: "Record resolution" }).at(-1)!,
  );
  // Waiting-for-credit already exists before this save. Wait for the actual
  // private repository settlement, then inspect the currently mounted read DTO.
  await waitFor(async () => {
    expect((await fixture.readCanonical()).returns[0].lines[0].settled).toBe(
      0.2,
    );
  });
  await waitFor(() =>
    expect(screen.getByText("Waiting for credit")).toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(
      within(screen.getByRole("table", { name: "" })).getByText("0.2 lb"),
    ).toBeInTheDocument(),
  );
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
  const saved = await fixture.readCanonical();
  expect(saved.returns[0].lines[0].settled).toBe(0.2);
  expect(saved.returns[0].pickup_memos![0].expected_credit).toBe("3.00");
});
