import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import i18n from "./i18n";
import { DemoProvider, initialState } from "./store";
import { Approvals } from "./screens/Approvals";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "./test/rendered-ui-readiness";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.restoreAllMocks();
});

it("groups invoice approvals, reviews every product and approves only checked rows without an empty-list flash", async () => {
  const schedule = window.setTimeout.bind(window);
  vi.spyOn(window, "setTimeout").mockImplementation(
    (handler, delay, ...args) =>
      (delay === 180
        ? schedule(() => {}, 0)
        : schedule(handler, delay, ...args)) as unknown as ReturnType<
        typeof globalThis.setTimeout
      >,
  );
  const state = initialState();
  state.sale_requests = [];
  state.invoice.id = "r2-ui-fictional-invoice";
  state.invoice.supplier = "Fictional Fern Market";
  state.invoice.supplier_invoice_number = "R2-UI-25";
  state.approvals = state.products.slice(0, 2).map((product, index) => ({
    id: `r2-ui-approval-${index}`,
    company_id: state.config.company.seed_key,
    branch: "Branch 1",
    product_code: product.code,
    status: "pending" as const,
    type: "price_change" as const,
    proposed_price: "3.49",
    current_price: "",
    unit_cost: "2.0000",
    source_invoice_id: state.invoice.id,
    invoice_ids: [state.invoice.id],
    invoice_number: state.invoice.supplier_invoice_number,
  }));
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Approvals />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("button", { name: "Approve all (2)" })),
  );
  const bulkButton = screen.getByRole("button", {
    name: "Approve all (2)",
  });
  expect(screen.getAllByText("first price")).toHaveLength(2);
  fireEvent.click(bulkButton);
  const dialog = await screen.findByRole("dialog", {
    name: "Review invoice approvals",
  });
  const selectAll = within(dialog).getByRole("checkbox", {
    name: "Select all products",
  });
  expect(selectAll).toBeChecked();
  fireEvent.click(selectAll);
  expect(
    within(dialog).getByRole("button", { name: "Approve 0 products" }),
  ).toBeDisabled();
  fireEvent.click(selectAll);
  expect(
    within(dialog).getByRole("button", { name: "Approve 2 products" }),
  ).toBeEnabled();
  for (const label of ["Unit cost", "Price", "Margin"])
    expect(
      within(dialog).getByRole("columnheader", { name: label }),
    ).toBeVisible();
  expect(
    dialog.querySelectorAll(".table-row-link,.table-details-toggle"),
  ).toHaveLength(0);
  for (const product of state.products.slice(0, 2)) {
    const row = within(dialog)
      .getByRole("checkbox", { name: `Include ${product.name_en}` })
      .closest("tr")!;
    expect(row.querySelector(".batch-product")).toHaveTextContent(
      product.name_en,
    );
  }
  expect(
    within(dialog).getByRole("columnheader", { name: "Category" }),
  ).toBeVisible();
  fireEvent.click(
    within(dialog).getByRole("checkbox", {
      name: `Include ${state.products[1].name_en}`,
    }),
  );
  const flashes: string[] = [];
  const observe = new MutationObserver(() => {
    if (
      screen.queryByText(
        "No pending requests. Receive an invoice to create a proposal.",
      )
    )
      flashes.push("empty");
  });
  observe.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Approve 1 product" }),
  );
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).approvals.map((item) => item.status),
    ).toEqual(["approved", "pending"]),
  );
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Pending 1" })).toBeVisible(),
  );
  // Canonical publication precedes completion of the asynchronous command.
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    document.querySelector(".approval-departure.is-leaving"),
  ).not.toBeNull();
  expect(flashes).toEqual([]);
  observe.disconnect();
  fireEvent.click(
    await screen.findByRole("button", { name: "Approve all (1)" }),
  );
  const remainingDialog = await screen.findByRole("dialog", {
    name: "Review invoice approvals",
  });
  expect(within(remainingDialog).getAllByRole("row")).toHaveLength(2);
  expect(
    within(remainingDialog).getByRole("checkbox", {
      name: `Include ${state.products[1].name_en}`,
    }),
  ).toBeChecked();
  expect(
    within(remainingDialog).queryByRole("checkbox", {
      name: `Include ${state.products[0].name_en}`,
    }),
  ).not.toBeInTheDocument();
  expect(
    within(remainingDialog).getByRole("button", { name: "Approve 1 product" }),
  ).toHaveClass("button-primary");
  expect(
    screen.queryByText(
      "Approved price. Cashier lookup now shows the approved price.",
    ),
  ).not.toBeInTheDocument();
});

it("keeps an invalid resubmission open, then sends a corrected price as a linked pending request", async () => {
  const state = initialState();
  state.sale_requests = [];
  state.approvals = [
    {
      id: "r2-ui-rejected",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      product_code: state.products[0].code,
      status: "rejected",
      type: "price_change",
      proposed_price: "3.49",
      unit_cost: "2.0000",
    },
  ];
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Approvals />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("tab", { name: "Rejected 1" })),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Rejected 1" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Fix and resubmit" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Fix and resubmit",
  });
  fireEvent.change(within(dialog).getByLabelText("New price (optional)"), {
    target: { value: "0.01" },
  });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Resubmit" }),
    ).toBeEnabled(),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Resubmit" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Add a reason",
  );
  expect(
    screen.getByRole("dialog", { name: "Fix and resubmit" }),
  ).toBeVisible();
  fireEvent.change(
    within(dialog).getByLabelText("Reason (required below minimum margin)"),
    { target: { value: "Fictional clearance correction" } },
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Resubmit" }));
  await waitFor(async () => {
    const canonical = await fixture.readCanonical();
    expect(canonical.approvals).toHaveLength(2);
    expect(canonical.approvals[0].status).toBe("rejected");
    expect(canonical.approvals[1].resubmitted_from_id).toBe("r2-ui-rejected");
    expect(canonical.approvals[1].status).toBe("pending");
  });
});

it("leaves requests needing an individual price choice or reason unchecked while approving ordinary invoice rows", async () => {
  const state = initialState();
  state.sale_requests = [];
  state.approvals = state.products.slice(0, 4).map((product, index) => ({
    id: `r2-individual-review-${index}`,
    company_id: state.config.company.seed_key,
    branch: "Branch 1",
    product_code: product.code,
    status: "pending" as const,
    type: "price_change" as const,
    proposed_price: "3.49",
    unit_cost: "2.0000",
    source_invoice_id: state.invoice.id,
    invoice_ids: [state.invoice.id],
  }));
  state.approvals[1].manual_price_review = {
    kept_price: "1.49",
    calculated_price: "0.99",
    prior_cost: "0.6000",
    received_cost: "0.7900",
    receiver_recommendation: "rule",
  };
  state.approvals[1].proposed_price = "0.99";
  state.approvals[1].unit_cost = "0.7900";
  state.approvals[1].margin = "0.20202020";
  state.approvals[1].threshold = "0.25";
  state.approvals[2].type = "margin_review";
  state.approvals[3].source_manual_request = {
    requester_user_id: "fictional-requester",
    requester_name_snapshot: "Fictional Requester",
    requester_role_snapshot: "floor_worker",
    requested_at: "2026-10-22T12:00:00Z",
    entered_price: "3.49",
    price_unit: "each",
    regular_price_snapshot: state.products[3].selling_price,
  };
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Approvals />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("button", { name: "Approve all (4)" })),
  );
  fireEvent.click(screen.getByRole("button", { name: "Approve all (4)" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Review invoice approvals",
  });
  expect(
    within(dialog).getByRole("checkbox", {
      name: `Include ${state.products[0].name_en}`,
    }),
  ).toBeChecked();
  for (const product of state.products.slice(1, 4)) {
    const checkbox = within(dialog).getByRole("checkbox", {
      name: `Include ${product.name_en}`,
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeDisabled();
  }
  expect(within(dialog).getAllByText("Review individually")).toHaveLength(3);
  const before = await fixture.readCanonical();
  const original = fixture.repository.runBusinessCommand.bind(
    fixture.repository,
  );
  let release!: () => void;
  const resultHeld = new Promise<void>((resolve) => {
    release = resolve;
  });
  let committed!: () => void;
  let failed!: (cause: unknown) => void;
  const actualCommit = new Promise<void>((resolve, reject) => {
    committed = resolve;
    failed = reject;
  });
  type Run = typeof fixture.repository.runBusinessCommand;
  // Hold only delivery of the genuine accepted result: the real IDB command,
  // current actor/permission checks and selected-only domain write all run first.
  vi.spyOn(fixture.repository, "runBusinessCommand").mockImplementation((async (
    ...args: Parameters<Run>
  ) => {
    if (args[2]?.capability !== "approvals.decide") return original(...args);
    try {
      const result = await original(...args);
      committed();
      await resultHeld;
      return result;
    } catch (cause) {
      failed(cause);
      throw cause;
    }
  }) as Run);
  // Native publication is not command completion: reconciliation and a fresh
  // authorized view still precede the real modal close. Observe that completion
  // directly within the unchanged case budget rather than a 1s polling cutoff.
  const closed = renderedUiReady(
    () =>
      !screen.queryByRole("dialog", {
        name: "Review invoice approvals",
      }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Approve 1 product" }),
  );
  try {
    await actualCommit;
    const accepted = await fixture.readCanonical();
    expect(accepted.approvals.map((item) => item.status)).toEqual([
      "approved",
      "pending",
      "pending",
      "pending",
    ]);
    expect(accepted.approvals.slice(1)).toEqual(before.approvals.slice(1));
    expect(
      dialog.querySelector(".invoice-approval-table-wrap"),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      within(dialog).getByRole("button", { name: /^Approve / }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    for (const product of state.products.slice(1, 4)) {
      const checkbox = within(dialog).getByRole("checkbox", {
        name: `Include ${product.name_en}`,
      });
      expect(checkbox).toBeDisabled();
      expect(checkbox).not.toBeChecked();
    }
    expect(within(dialog).getAllByText("Review individually")).toHaveLength(3);
  } finally {
    release();
    await closed;
  }
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const completed = await fixture.readCanonical();
  expect(completed.approvals.map((item) => item.status)).toEqual([
    "approved",
    "pending",
    "pending",
    "pending",
  ]);
  expect(completed.approvals.slice(1)).toEqual(before.approvals.slice(1));
});
