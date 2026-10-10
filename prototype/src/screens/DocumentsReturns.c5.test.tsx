import { beforeEach, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider, initialState, useDemo } from "../store";
import { ReturnStatusBadge } from "../ReturnStatusBadge";
import { returnStatusTone } from "../return-status";
import { returnUiStatus } from "../return-workflow";
import { returnFixture } from "../return-test-fixture";
import { supplierPage } from "../suppliers";
import { OriginalInvoice } from "./OriginalInvoice";
import { PostedInvoice } from "./PostedInvoice";
import { Returns } from "./Returns";
import { SupplierReturnsPanel } from "./SupplierReturnsPanel";
import i18n from "../i18n";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#returns";
  await i18n.changeLanguage("en");
});

it("keeps 25–400% zoom and returns to a whole-page fit without changing original bytes", async () => {
  const user = userEvent.setup();
  const invoice = initialState().invoice;
  Object.assign(invoice, {
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
    file_type: "image/png",
    file_name: "retained-original.png",
  });
  const original = structuredClone(invoice);
  const { container } = render(
    <DemoProvider>
      <OriginalInvoice invoice={invoice} />
    </DemoProvider>,
  );
  const image = screen.getByRole("img", { name: "Original invoice image" });
  Object.defineProperties(image, {
    naturalWidth: { value: 1000 },
    naturalHeight: { value: 2000 },
  });
  fireEvent.load(image);
  const media = container.querySelector(".invoice-original-media")!;
  expect(media).toHaveAttribute("data-fit", "page");
  expect(Number(media.getAttribute("data-zoom"))).toBeCloseTo(0.525);
  expect(container.querySelector(".invoice-original-zoom")).toHaveTextContent(
    "53%",
  );
  await user.click(screen.getByRole("button", { name: "Fit width" }));
  expect(media).toHaveAttribute("data-zoom", "1");
  for (let index = 0; index < 3; index++)
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
  expect(media).toHaveAttribute("data-zoom", "0.25");
  expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  for (let index = 0; index < 15; index++)
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(media).toHaveAttribute("data-zoom", "4");
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Fit page" }));
  expect(media).toHaveAttribute("data-fit", "page");
  expect(Number(media.getAttribute("data-zoom"))).toBeCloseTo(0.525);
  expect(invoice).toEqual(original);
  expect(image).toHaveAttribute("src", original.file_data);
});

function StatusSamples() {
  const { setLang } = useDemo();
  return (
    <>
      <button onClick={() => setLang("fa")}>Use Persian</button>
      <ReturnStatusBadge status="waiting_for_pickup" />
      <ReturnStatusBadge status="waiting_for_credit" />
      <ReturnStatusBadge status="closed" outcome="credited" />
      <ReturnStatusBadge status="closed" outcome="replaced" />
      <ReturnStatusBadge status="closed" outcome="written_off" />
      <ReturnStatusBadge status="closed" />
      <ReturnStatusBadge status="cancelled" />
    </>
  );
}

it("assigns one status tone in English and Persian including closed outcomes", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <DemoProvider>
      <StatusSamples />
    </DemoProvider>,
  );
  const tones = [
    "info",
    "pending",
    "approved",
    "approved",
    "neutral",
    "approved",
    "neutral",
  ];
  const assertTones = () => {
    const badges = [...container.querySelectorAll("[data-return-status]")];
    expect(badges).toHaveLength(tones.length);
    badges.forEach((badge, index) => expect(badge).toHaveClass(tones[index]));
  };
  assertTones();
  expect(screen.getByText("Waiting for credit")).toHaveClass("pending");
  await user.click(screen.getByRole("button", { name: "Use Persian" }));
  assertTones();
  expect(screen.getByText("در انتظار اعتبار")).toHaveClass("pending");
  expect(screen.getByText("بسته‌شده (سوخت‌شده)")).toHaveClass("neutral");
});

function WorkflowHarness({ supplier = false }: { supplier?: boolean }) {
  const { state, update, switchDemoUser, setBranch } = useDemo();
  return (
    <>
      <button
        onClick={() => {
          switchDemoUser("supervisor");
          setBranch("Branch 1");
          update((draft) => {
            const fixture = returnFixture();
            fixture.returns = [
              { ...fixture.returns[0], id: "picked-up", status: "picked_up" },
              {
                ...structuredClone(fixture.returns[0]),
                id: "partial",
                status: "partially_resolved",
              },
            ];
            Object.assign(draft, fixture);
          });
        }}
      >
        Load return states
      </button>
      <output data-testid="ledger">{JSON.stringify(state.ledger)}</output>
      {supplier ? (
        <SupplierReturnsPanel
          supplier="Fresh Valley Foods"
          rows={
            supplierPage(
              state,
              {
                company_id: state.config.company.seed_key,
                branch: "Branch 1",
                role: "supervisor",
                actor: "Demo Supervisor",
              },
              "Fresh Valley Foods",
            ).returns
          }
        />
      ) : (
        <Returns />
      )}
    </>
  );
}

for (const supplier of [false, true])
  it(`uses amber Waiting for credit for different retained workflow states in ${supplier ? "Supplier returns" : "Returns"}`, async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DemoProvider>
        <WorkflowHarness supplier={supplier} />
      </DemoProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Load return states" }),
    );
    const badges = container.querySelectorAll(
      '[data-return-status="waiting_for_credit"]',
    );
    expect(badges).toHaveLength(2);
    badges.forEach((badge) => expect(badge).toHaveClass("pending"));
    if (supplier) {
      expect(
        screen.queryByRole("button", { name: "View" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "#1" })).toHaveAttribute(
        "href",
        "#return?id=picked-up",
      );
    }
  });

it("maps waiting-for-credit by visible status rather than picked-up or partial internals", () => {
  const fixture = returnFixture();
  for (const status of [
    "picked_up",
    "partially_resolved",
    "claim_pending",
    "cancellation_review",
  ] as const) {
    const record = { ...fixture.returns[0], status };
    expect(returnUiStatus(record)).toBe("waiting_for_credit");
    expect(returnStatusTone(returnUiStatus(record))).toBe("pending");
  }
});

function DetailHarness() {
  const { state, update, switchDemoUser, setBranch } = useDemo();
  return (
    <>
      <button
        onClick={() => {
          switchDemoUser("supervisor");
          setBranch("Branch 1");
          update((draft) => Object.assign(draft, returnFixture()));
          window.location.hash = "#return?id=c4-return";
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }}
      >
        Load detail
      </button>
      <output data-testid="retained-ledger">
        {JSON.stringify(state.ledger)}
      </output>
      <Returns />
    </>
  );
}

it("keeps status beside the return title, metadata below and policy as five clear numbered steps", async () => {
  window.location.hash = "#return?id=c4-return";
  const user = userEvent.setup();
  const { container } = render(
    <DemoProvider>
      <DetailHarness />
    </DemoProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Load detail" }));
  const beforeLedger = screen.getByTestId("retained-ledger").textContent;
  const title = container.querySelector(".return-detail-title")!;
  expect(
    within(title as HTMLElement).getByRole("heading", { name: "Return #1" }),
  ).toBeInTheDocument();
  expect(
    within(title as HTMLElement).getByText("Waiting for pickup"),
  ).toHaveClass("info");
  expect(container.querySelector(".return-detail-subtitle")).toHaveTextContent(
    "Demo Floor Worker",
  );
  const trigger = screen.getByRole("button", {
    name: "Return policy",
  });
  expect(trigger).toHaveClass("button-secondary");
  expect(screen.getByRole("button", { name: "Record pickup" })).toHaveClass(
    "button-primary",
  );
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Return policy" });
  const steps = within(dialog).getAllByRole("listitem");
  expect(steps).toHaveLength(5);
  steps.forEach((step) => {
    expect(step.querySelectorAll("strong")).toHaveLength(1);
    expect(step.querySelectorAll("p")).toHaveLength(1);
  });
  expect(dialog.querySelector(".card")).toBeNull();
  expect(
    within(dialog).getByRole("button", { name: "Download full policy" }),
  ).toHaveClass("button-secondary");
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByTestId("retained-ledger").textContent).toBe(beforeLedger);
});

it("pairs each posted total label with its amount and retains all original invoice values", () => {
  const invoice = initialState().invoice;
  const original = structuredClone(invoice);
  const { container } = render(
    <DemoProvider>
      <PostedInvoice
        original={invoice}
        invoice={invoice}
        versionId="original"
      />
    </DemoProvider>,
  );
  const rows = container.querySelectorAll(".posted-invoice-totals > div");
  expect(rows).toHaveLength(5);
  expect([...rows].map((row) => row.querySelector("dt")?.textContent)).toEqual([
    "Subtotal",
    "Tax",
    "Invoice total",
    "Deductions",
    "Payable",
  ]);
  rows.forEach((row) => {
    expect(row.querySelectorAll("dt")).toHaveLength(1);
    expect(row.querySelectorAll("dd")).toHaveLength(1);
    expect(row.querySelector("dd")?.textContent).toMatch(/\$/);
  });
  expect(rows[4]).toHaveClass("posted-invoice-payable");
  const title = container.querySelector(".posted-invoice-title")!;
  expect(title).toHaveTextContent(invoice.supplier_invoice_number);
  expect(within(title as HTMLElement).getByText("Posted")).toBeInTheDocument();
  expect(invoice).toEqual(original);
});
