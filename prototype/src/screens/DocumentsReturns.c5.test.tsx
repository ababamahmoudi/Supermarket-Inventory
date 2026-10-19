import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { readStoredFile } from "../file-database";
import { useProtectedQuery } from "../use-protected-query";
import { domainScope } from "../domain-authority";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
import { demoSeed } from "../config";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "../test/rendered-ui-readiness";

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#returns";
  await i18n.changeLanguage("en");
});

function ProtectedOriginalSample() {
  const { state } = useDemo();
  return state.invoice_workspace ? (
    <OriginalInvoice invoice={state.invoice_workspace.invoice} />
  ) : null;
}
function ProtectedPostedSample() {
  const { state, authStage } = useDemo();
  const workspace = state.invoice_workspace;
  return (
    <>
      <output data-testid="posted-auth-stage">{authStage}</output>
      {workspace ? (
        <PostedInvoice
          original={workspace.invoice}
          invoice={workspace.invoice}
          versionId="original"
        />
      ) : null}
    </>
  );
}

it("keeps 25–400% zoom and returns to a whole-page fit without changing original bytes", async () => {
  // jsdom has no image decoder. The intentionally invalid legacy image must
  // emit an error, which preserves its exact original bytes through the real
  // production legacy fallback. Viewer geometry still uses the existing load event.
  vi.stubGlobal(
    "Image",
    class {
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
  const user = userEvent.setup(),
    state = initialState();
  Object.assign(state.invoice, {
    file_data: "data:image/png;base64,cmV0YWluZWQ=",
    file_type: "image/png",
    file_name: "retained-original.png",
  });
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { locations: ["Branch 1"] },
  });
  const original = (await fixture.readCanonical()).invoice;
  const sourceBefore = await readStoredFile(
    original.file_data!,
    original.company_id,
  );
  const bytesBefore = new Uint8Array(await sourceBefore.source.arrayBuffer());
  expect([...bytesBefore]).toEqual([...new TextEncoder().encode("retained")]);
  const mounted = render(
    <DemoProvider options={fixture.options}>
      <ProtectedOriginalSample />
    </DemoProvider>,
  );
  try {
    const image = await screen.findByRole("img", {
      name: "Original invoice image",
    });
    Object.defineProperties(image, {
      naturalWidth: { value: 1000 },
      naturalHeight: { value: 2000 },
    });
    fireEvent.load(image);
    const media = mounted.container.querySelector(".invoice-original-media")!;
    expect(media).toHaveAttribute("data-fit", "page");
    expect(Number(media.getAttribute("data-zoom"))).toBeCloseTo(0.525);
    expect(
      mounted.container.querySelector(".invoice-original-zoom"),
    ).toHaveTextContent("53%");
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
    const retained = (await fixture.readCanonical()).invoice;
    expect(retained).toEqual(original);
    // Protected source URLs replace exposed inline file_data; original bytes remain exact.
    expect(image.getAttribute("src")).toMatch(/^blob:/);
    const sourceAfter = await readStoredFile(
      retained.file_data!,
      retained.company_id,
    );
    expect(sourceAfter.sha256).toBe(sourceBefore.sha256);
    expect(new Uint8Array(await sourceAfter.source.arrayBuffer())).toEqual(
      bytesBefore,
    );
  } finally {
    mounted.unmount();
    fixture.dispose();
  }
});

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});
async function prepareReturns(workflow = false) {
  const state = returnFixture();
  if (workflow)
    state.returns = [
      { ...state.returns[0], id: "picked-up", status: "picked_up" },
      {
        ...structuredClone(state.returns[0]),
        id: "partial",
        status: "partially_resolved",
      },
    ];
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  return fixture;
}
function StatusSamples() {
  const { setLang, actor } = useDemo();
  return (
    <>
      <output data-testid="status-ready">{actor ? "ready" : "pending"}</output>
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
  const fixture = await prepareReturns();
  const { container } = render(
    <DemoProvider options={fixture.options}>
      <StatusSamples />
    </DemoProvider>,
  );
  await waitFor(() => {
    if (screen.getByTestId("status-ready").textContent !== "ready")
      throw new Error("Waiting for actual fixture session");
  });
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
  const { state, actor } = useDemo();
  const [loaded, setLoaded] = useState(false);
  const read = useProtectedQuery(
    supplier ? "suppliers.read" : null,
    domainScope(state),
    (canonical, freshActor) =>
      supplierPage(canonical, freshActor, "Fresh Valley Foods").returns,
    "Fresh Valley Foods",
  );
  return (
    <>
      {actor && (
        <button onClick={() => setLoaded(true)}>Load return states</button>
      )}
      <output data-testid="ledger">{JSON.stringify(state.ledger)}</output>
      {loaded &&
        (supplier ? (
          read.data && (
            <SupplierReturnsPanel
              supplier="Fresh Valley Foods"
              rows={read.data}
            />
          )
        ) : (
          <Returns />
        ))}
    </>
  );
}

for (const supplier of [false, true])
  it(`uses amber Waiting for credit for different retained workflow states in ${supplier ? "Supplier returns" : "Returns"}`, async () => {
    const user = userEvent.setup();
    const fixture = await prepareReturns(true);
    const { container } = render(
      <DemoProvider options={fixture.options}>
        <WorkflowHarness supplier={supplier} />
      </DemoProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Load return states" }),
    );
    await screen.findAllByText("Waiting for credit");
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
  const { state, actor } = useDemo();
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {actor && (
        <button
          onClick={() => {
            setLoaded(true);
            window.location.hash = "#return?id=c4-return";
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }}
        >
          Load detail
        </button>
      )}
      <output data-testid="retained-ledger">
        {JSON.stringify(state.ledger)}
      </output>
      {loaded && <Returns />}
    </>
  );
}

it("keeps status beside the return title, metadata below and policy as five clear numbered steps", async () => {
  window.location.hash = "#return?id=c4-return";
  const user = userEvent.setup();
  const fixture = await prepareReturns();
  const { container } = render(
    <DemoProvider options={fixture.options}>
      <DetailHarness />
    </DemoProvider>,
  );
  await user.click(await screen.findByRole("button", { name: "Load detail" }));
  await screen.findByRole("heading", { name: "Return #1" });
  const beforeLedger = screen.getByTestId("retained-ledger").textContent;
  const title = container.querySelector(".return-detail-title")!;
  expect(
    within(title as HTMLElement).getByRole("heading", { name: "Return #1" }),
  ).toBeInTheDocument();
  expect(
    within(title as HTMLElement).getByText("Waiting for pickup"),
  ).toHaveClass("info");
  expect(container.querySelector(".return-detail-subtitle")).toHaveTextContent(
    demoSeed.demo_users.find((person) => person.username === "ny-floor")!
      .name_en,
  );
  const trigger = screen.getByRole("button", {
    name: "Return policy",
  });
  expect(trigger).toHaveClass("button-neutral");
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
  ).toHaveClass("button-tinted");
  await user.click(
    within(dialog).getAllByRole("button", { name: "Close" }).at(-1)!,
  );
  expect(screen.getByTestId("retained-ledger").textContent).toBe(beforeLedger);
});

it("pairs each posted total label with its amount and retains all original invoice values", async () => {
  const state = initialState();
  state.invoice.status = "posted";
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { locations: ["Branch 1"] },
  });
  const original = (await fixture.readCanonical()).invoice;
  const mounted = render(
    <DemoProvider options={fixture.options}>
      <ProtectedPostedSample />
    </DemoProvider>,
  );
  try {
    // Fixture preparation commits storage; Provider startup still resumes the
    // real session and publishes its protected projection asynchronously.
    await renderedUiReady(
      () =>
        screen.queryByTestId("posted-auth-stage")?.textContent === "complete",
    );
    await screen.findByRole("heading", {
      name: original.supplier_invoice_number,
    });
    const rows = mounted.container.querySelectorAll(
      ".posted-invoice-totals > div",
    );
    expect(rows).toHaveLength(5);
    expect(
      [...rows].map((row) => row.querySelector("dt")?.textContent),
    ).toEqual(["Subtotal", "Tax", "Invoice total", "Deductions", "Payable"]);
    rows.forEach((row) => {
      expect(row.querySelectorAll("dt")).toHaveLength(1);
      expect(row.querySelectorAll("dd")).toHaveLength(1);
      expect(row.querySelector("dd")?.textContent).toMatch(/\$/);
    });
    expect(rows[4]).toHaveClass("posted-invoice-payable");
    const title = mounted.container.querySelector(".posted-invoice-title")!;
    expect(title).toHaveTextContent(original.supplier_invoice_number);
    expect(
      within(title as HTMLElement).getByText("Posted"),
    ).toBeInTheDocument();
    expect((await fixture.readCanonical()).invoice).toEqual(original);
  } finally {
    mounted.unmount();
    fixture.dispose();
  }
});
