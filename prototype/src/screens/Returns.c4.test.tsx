import { beforeEach, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, useDemo } from "../store";
import { returnFixture } from "../return-test-fixture";
import { recordPickup, submitFinancialClaim } from "../operations";
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
const worker = {
  company_id: "super-arzon",
  branch: "Branch 1",
  role: "floor_worker" as const,
  actor: "Demo Floor Worker",
};
function Harness({
  page = "returns",
}: {
  page?: "returns" | "payables" | "supplier" | "settings";
}) {
  const { state, update, switchDemoUser, role, setBranch, setLang } = useDemo();
  return (
    <>
      <button
        onClick={() => {
          switchDemoUser("supervisor");
          setBranch("Branch 1");
          update((draft) => Object.assign(draft, returnFixture()));
          if (page === "returns") {
            window.location.hash = "#return?id=c4-return";
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }
        }}
      >
        Load fictional return
      </button>
      <button onClick={() => switchDemoUser("floorworker")}>Use worker</button>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <button
        onClick={() =>
          update((draft) =>
            recordPickup(draft, worker, "c4-return", {
              quantities: { "0003": 3 },
              representative: "Demo Driver",
              slip: "SIGNED-C4-001",
            }),
          )
        }
      >
        Record evidenced pickup
      </button>
      <button
        onClick={() =>
          update((draft) =>
            submitFinancialClaim(draft, worker, "c4-return", {
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
        onClick={() =>
          update((draft) => {
            draft.ledger[0].amount = "599.00";
          })
        }
      >
        Concurrent financial change
      </button>
      <button
        onClick={() =>
          update((draft) => {
            const fixture = returnFixture();
            fixture.products.find((item) => item.code === "0003")!.sold_by =
              "weight";
            fixture.returns[0].lines[0].qty = 0.3;
            recordPickup(fixture, worker, "c4-return", {
              quantities: { "0003": 0.3 },
              representative: "Demo Driver",
              slip: "SIGNED-WEIGHT-C4",
            });
            Object.assign(draft, fixture);
          })
        }
      >
        Load weighed pickup
      </button>
      <output data-testid="ledger-count">{state.ledger.length}</output>
      {page === "returns" ? (
        <Returns />
      ) : page === "payables" ? (
        <Payables />
      ) : page === "settings" ? (
        <ReturnsSettings />
      ) : (
        role && (
          <SupplierReturnsPanel
            supplier="Fresh Valley Foods"
            rows={
              supplierPage(state, { ...worker, role }, "Fresh Valley Foods")
                .returns
            }
          />
        )
      )}
    </>
  );
}

it("keeps a bilingual retained RM memo available after pickup and shows no Returned to stock column", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  expect(
    screen.queryByRole("columnheader", { name: "Returned to stock" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Record evidenced pickup" }),
  );
  await user.click(screen.getByRole("button", { name: "RM-0001" }));
  const dialog = screen.getByRole("dialog", { name: "Return memo" });
  expect(within(dialog).getByText("Driver name")).toBeInTheDocument();
  expect(within(dialog).getByText("نام راننده")).toBeInTheDocument();
  expect(within(dialog).getByText("SIGNED-C4-001")).toBeInTheDocument();
  expect(within(dialog).getAllByText("$30.00")).toHaveLength(2);
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
});

it("requires confirmation for financial posting and blocks a concurrent balance change", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Record evidenced pickup" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Submit actual credit evidence" }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: "I verified the document, covered quantities, and invoice allocation.",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and post claim" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Verify and post claim" });
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
  fireEvent.click(
    screen.getByRole("button", { name: "Concurrent financial change" }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Verify and post claim" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "This return or its payable changed",
  );
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
});

it("lists a separate pending claim and a retained RM link in Supervisor Payables", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness page="payables" />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Record evidenced pickup" }),
  );
  await user.click(screen.getByRole("link", { name: "Fresh Valley Foods" }));
  expect(
    screen.getByRole("heading", { name: "Pending credit" }),
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
  render(
    <DemoProvider>
      <Harness page="supplier" />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Record evidenced pickup" }),
  );
  expect(
    screen.getByRole("columnheader", { name: "Pending credit" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "History" }));
  expect(
    screen.getByText("No returns match these filters."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Open" }));
  expect(screen.getByText("Waiting for credit")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Use worker" }));
  expect(
    screen.queryByRole("columnheader", { name: "Pending credit" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Columns" }));
  expect(
    screen.queryByRole("checkbox", { name: "Pending credit" }),
  ).not.toBeInTheDocument();
});

it("renders a memo using frozen bilingual snapshots rather than live catalog names", () => {
  const state = returnFixture();
  recordPickup(state, worker, "c4-return", {
    quantities: { "0003": 3 },
    representative: "Demo Driver",
    slip: "SIGNED-C4-001",
  });
  const memo = state.returns[0].pickup_memos![0];
  state.products.find((product) => product.code === "0003")!.name_en =
    "Later catalog name";
  render(<ReturnMemoDocument memo={memo} language="fa" />);
  expect(screen.getByRole("article")).toHaveAttribute("dir", "rtl");
  expect(screen.getByText("Sour Cherry Juice 1 L")).toBeInTheDocument();
  expect(screen.queryByText("Later catalog name")).not.toBeInTheDocument();
  expect(screen.getByText("Signature")).toBeInTheDocument();
  expect(screen.getByText("امضا")).toBeInTheDocument();
});
it("clears the reminder field's validation on edit and saves return settings through the guarded action", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness page="settings" />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  const days = screen.getByLabelText("Waiting-credit reminder (days)");
  await user.clear(days);
  await user.type(days, "0");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    screen.getByText("Enter a positive whole number of days."),
  ).toBeInTheDocument();
  await user.clear(days);
  await user.type(days, "7");
  expect(
    screen.queryByText("Enter a positive whole number of days."),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByText("Changes saved.")).toHaveAttribute("role", "status");
  expect(screen.getByRole("link", { name: /Changed by/ })).toHaveAttribute(
    "href",
    "#history",
  );
});
it("posts confirmed actual credit only after the confirmation and preserves the retained memo", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Record evidenced pickup" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Submit actual credit evidence" }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: "I verified the document, covered quantities, and invoice allocation.",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Verify and post claim" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Verify and post claim" });
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
  await user.click(
    within(dialog).getByRole("button", { name: "Verify and post claim" }),
  );
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("2");
  expect(screen.getByText("Closed (Credited)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "RM-0001" })).toBeInTheDocument();
});

it("accepts explicit three-decimal lb replacements and clears a precision error when that field changes", async () => {
  const user = userEvent.setup();
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Load fictional return" }),
  );
  await user.click(screen.getByRole("button", { name: "Load weighed pickup" }));
  const items = screen.getByRole("table", { name: "" });
  expect(within(items).getAllByText("0.3 lb")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Record resolution" }));
  const covered = screen.getByLabelText(
    /Original units this settlement covers$/,
  );
  fireEvent.change(covered, { target: { value: "0.2" } });
  const replacement = screen.getByLabelText("Actual replacement quantity (lb)");
  expect(replacement).toHaveAttribute("step", "0.001");
  expect(replacement).toHaveAttribute("min", "0.001");
  fireEvent.change(replacement, { target: { value: "0.0001" } });
  await user.type(
    screen.getByLabelText("Supplier representative name"),
    "Demo Driver",
  );
  await user.type(
    screen.getByLabelText("Replacement receipt reference"),
    "WEIGHED-REPLACEMENT-001",
  );
  await user.click(screen.getByRole("button", { name: "Receive replacement" }));
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
  await user.click(screen.getByRole("button", { name: "Receive replacement" }));
  expect(screen.getByText("Waiting for credit")).toBeInTheDocument();
  expect(within(items).getByText("0.2 lb")).toBeInTheDocument();
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("1");
  const saved = JSON.parse(localStorage.getItem("supermarket-prototype-v1")!);
  expect(saved.returns[0].lines[0].settled).toBe(0.2);
  expect(saved.returns[0].pickup_memos[0].expected_credit).toBe("3.00");
});
