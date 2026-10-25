import { useLayoutEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "../store";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import i18n from "../i18n";
import Invoices from "./Invoices";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "../test/rendered-ui-readiness";
import { authenticatedTestActor } from "../authority-test-fixture";
import { cloneWithAuthority } from "../authority";
import { invoiceBlockers } from "../invoice";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
let currentDemo: ReturnType<typeof useDemo>;
let releaseSelection: (() => void) | undefined;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/#invoices");
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  // A failed assertion must not leave a real accepted command pending at teardown.
  releaseSelection?.();
  clearRenderedUiReadiness();
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
  releaseSelection = undefined;
});

it.each(["workspace", "picker"])(
  "counts only other-location Needs review invoices in the %s list",
  async (list) => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager", {
      selection: { kind: "location", location_id: "Branch 1" },
    });
    const product = state.products[0];
    const ready = structuredClone(state.invoice);
    Object.assign(ready, {
      id: "r2-fictional-other-ready",
      branch: "Branch 2",
      handling_branch: "Branch 2",
      reviewer_origin_location_id: "Branch 2",
      status: "review",
      entry_mode: "manual",
      supplier: state.suppliers![0].name,
      supplier_invoice_number: "R2-OTHER-READY",
      invoice_date: "2026-10-21",
      received_at: "2026-10-21T12:00:00Z",
      receiving_employee: "Fictional Receiver",
      low_confidence_fields: [],
      subtotal: "2.00",
      tax: "0.00",
      final_total: "2.00",
      other_charges: [],
      order_id: undefined,
      lower_price_answers: { same_expiry: "no_previous_stock" },
    });
    ready.lines = [
      {
        ...ready.lines[0],
        product_code: product.code,
        description: product.name_en,
        quantity_unit: "units",
        quantity_entered: "1",
        sold_by: "each",
        units_per_case: 1,
        qty_invoiced: 1,
        qty_received_at_posting: 1,
        refused_units: 0,
        unit_cost_before_tax: "2.0000",
        line_total: "2.00",
        date_tracking: false,
        date_confirmed: true,
        review_confirmed: true,
        low_confidence_fields: [],
        manual_price_decision: "rule",
      },
    ];
    const needsReview = structuredClone(ready);
    needsReview.id = "r2-fictional-other-needs-review";
    needsReview.supplier_invoice_number = "R2-OTHER-NEEDS";
    needsReview.lines[0].review_confirmed = false;
    const localReady = structuredClone(ready);
    localReady.id = "r2-fictional-local-ready";
    localReady.branch = "Branch 1";
    localReady.handling_branch = "Branch 1";
    localReady.reviewer_origin_location_id = "Branch 1";
    state.invoices = [localReady, ready, needsReview];
    if (list === "picker") state.invoice.company_id = "another-company";
    const evidence = cloneWithAuthority(state);
    evidence.invoice = ready;
    expect(invoiceBlockers(evidence, actor)).toEqual([]);
    evidence.invoice = needsReview;
    expect(invoiceBlockers(evidence, actor)).not.toEqual([]);
    fixture = await authenticatedProviderFixture({
      state,
      role: "manager",
      actorOptions: {
        selection: { kind: "location", location_id: "Branch 1" },
      },
    });
    render(
      <DemoProvider options={fixture.options}>
        <ActualInvoices />
      </DemoProvider>,
    );
    await renderedUiReady(() =>
      Boolean(screen.queryByRole("tab", { name: "Ready to post 1" })),
    );
    expect(
      screen.getByText("1 more need review at other locations."),
    ).toBeVisible();
    expect(
      screen.queryByText("2 more need review at other locations."),
    ).not.toBeInTheDocument();
    await act(async () => {
      await currentDemo.command(
        "invoices.edit",
        {
          company_id: ready.company_id,
          kind: "company_shared",
          entity_id: needsReview.id,
          mutation: true,
        },
        (canonical) => {
          canonical.invoices!.find(
            (invoice) => invoice.id === needsReview.id,
          )!.lines[0].review_confirmed = true;
        },
      );
    });
    await renderedUiReady(
      () => !screen.queryByText(/^\d+ more need review at other locations\.$/),
    );
    expect(
      screen.queryByRole("button", { name: "Show all locations" }),
    ).not.toBeInTheDocument();
  },
);

function ActualInvoices() {
  const context = useDemo();
  useLayoutEffect(() => {
    currentDemo = context;
  }, [context]);
  return context.actor && context.authStage === "complete" ? (
    <Invoices />
  ) : null;
}

it("lists the active posted invoice once at its location and in All locations", async () => {
  const state = initialState();
  const posted = structuredClone(
    state.invoices!.find(
      (invoice) => invoice.status === "posted" && invoice.branch === "Branch 1",
    )!,
  );
  state.invoice = posted;
  const locationCount = state.invoices!.filter(
    (invoice) => invoice.status === "posted" && invoice.branch === "Branch 1",
  ).length;
  const allCount = state.invoices!.filter(
    (invoice) => invoice.status === "posted",
  ).length;
  fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <ActualInvoices />
    </DemoProvider>,
  );
  await renderedUiReady(() => currentDemo?.authStage === "complete");
  fireEvent.click(
    await screen.findByRole("tab", { name: `Posted ${locationCount}` }),
  );
  const postedTable = () =>
    document.querySelector<HTMLDivElement>(".invoice-posted-table")!;
  await waitFor(() => expect(postedTable()).not.toBeNull());
  expect(
    within(postedTable()).getAllByRole("link", {
      name: posted.supplier_invoice_number,
    }),
  ).toHaveLength(1);
  expect(
    currentDemo.state.invoices.some((invoice) => invoice.id === posted.id),
  ).toBe(false);
  expect(currentDemo.state.invoice?.id).toBe(posted.id);
  await act(async () => {
    await currentDemo.setBranch("all");
  });
  await screen.findByRole("tab", { name: `Posted ${allCount}` });
  expect(
    within(postedTable()).getAllByRole("link", {
      name: posted.supplier_invoice_number,
    }),
  ).toHaveLength(1);
});

it("browser Back retains the Posted list after an accepted invoice workspace read finishes late", async () => {
  const state = initialState();
  const target = state.invoices!.find(
    (invoice) => invoice.status === "posted" && invoice.branch === "Branch 1",
  )!;
  expect(target.company_id).toBe(state.config.company.seed_key);
  expect(target.id).not.toBe(state.invoice.id);
  fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  render(
    <DemoProvider options={fixture.options}>
      <ActualInvoices />
    </DemoProvider>,
  );
  await renderedUiReady(() => currentDemo?.authStage === "complete");
  fireEvent.click(await screen.findByRole("tab", { name: /^Posted \d+$/ }));
  const table = () =>
    document.querySelector<HTMLDivElement>(".invoice-posted-table")!;
  await waitFor(() => expect(table()).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Columns" }));
  const chooser = screen.getByRole("dialog", { name: "Columns" });
  fireEvent.click(within(chooser).getByRole("checkbox", { name: "Supplier" }));
  fireEvent.click(within(chooser).getByRole("button", { name: "Close" }));
  expect(table().querySelector("th[data-column-key=supplier]")).toBeNull();

  const gate = new Promise<void>((resolve) => {
    releaseSelection = resolve;
  });
  const actualCommand = fixture.repository.runBusinessCommand.bind(
    fixture.repository,
  );
  let acceptedSelection = false;
  // Delay only completion delivery of the actual permission checked IDB command.
  // Its actor, mutation, durable write and invalidation remain unmodified.
  const delayedCommand: typeof fixture.repository.runBusinessCommand = async (
    identity,
    operation,
    precheck,
    now,
  ) => {
    const result = await actualCommand(identity, operation, precheck, now);
    if (
      !acceptedSelection &&
      precheck?.capability === "invoices.read" &&
      precheck.resource.entity_id === target.id
    ) {
      acceptedSelection = true;
      await gate;
    }
    return result;
  };
  fixture.repository.runBusinessCommand = delayedCommand;
  fireEvent.click(
    within(table()).getByRole("link", {
      name: target.supplier_invoice_number,
    }),
  );
  await waitFor(() =>
    expect(window.location.hash).toBe(
      `#invoices?id=${encodeURIComponent(target.id)}`,
    ),
  );
  await waitFor(() => expect(acceptedSelection).toBe(true));
  await screen.findByRole("link", { name: "Invoices" });
  expect((await fixture.readCanonical()).invoice.id).toBe(target.id);

  await act(async () => {
    window.history.back();
  });
  await waitFor(() => expect(window.location.hash).toBe("#invoices"));
  await waitFor(() => expect(table()).not.toBeNull());
  expect(screen.getByRole("tab", { name: /^Posted \d+$/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(table().querySelector("th[data-column-key=supplier]")).toBeNull();
  await act(async () => {
    releaseSelection!();
    // A subsequent real queued command proves the earlier controller command,
    // its reconciliation and late continuation have finished before asserting.
    await currentDemo.command(
      "invoices.read",
      {
        company_id: target.company_id,
        kind: "company_shared",
        entity_id: target.id,
      },
      (canonical) => canonical.invoice.id,
    );
  });
  expect(window.location.hash).toBe("#invoices");
  expect(screen.getByRole("tab", { name: /^Posted \d+$/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(table()).not.toBeNull();
  expect(table().querySelector("th[data-column-key=supplier]")).toBeNull();
  expect((await fixture.readCanonical()).invoice.id).toBe(target.id);
});
