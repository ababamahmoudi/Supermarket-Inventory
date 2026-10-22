import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticatedProviderFixture } from "../../authority-provider-test-fixture";
import { authenticatedTestActor } from "../../authority-test-fixture";
import {
  addManualLine,
  createInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "../../invoice";
import {
  invoiceWorkspaceRead,
  type InvoiceWorkspaceRead,
} from "../../invoice-workspace-read";
import { DemoProvider, initialState, useDemo } from "../../store";
import i18n from "../../i18n";
import { LineEditor } from "./LineEditor";
import type { EditLine, ReviewUpdate } from "./types";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
  vi.unstubAllGlobals();
});

function EditorWithDelayedProjection({
  workspace,
  acknowledgment,
  editStarted,
  closed,
}: {
  workspace: InvoiceWorkspaceRead;
  acknowledgment: Promise<void>;
  editStarted(operation: Promise<unknown>): void;
  closed(): void;
}) {
  const { actor, command } = useDemo();
  if (!actor) return null;
  const scope = {
    company_id: workspace.invoice.company_id,
    kind: "company_shared" as const,
    entity_id: workspace.invoice.id,
  };
  const update: ReviewUpdate = (change) =>
    command("invoices.edit", scope, change);
  const editLine: EditLine = (index, change, recalculate) => {
    const operation = command("invoices.edit", scope, (draft, current) => {
      change(draft.invoice.lines[index], draft, current);
      if (recalculate) recalculateInvoice(draft.invoice, draft.config);
    }).then(async () => acknowledgment);
    editStarted(operation);
  };
  // Keep the displayed read projection while the edit acknowledgment is delayed.
  // Commands still use the real controller, repository and canonical invoice.
  return (
    <LineEditor
      invoice={workspace.invoice}
      workspace={workspace}
      index={0}
      update={update}
      editLine={editLine}
      onQuantity={setInvoiceLineQuantity}
      onClose={closed}
      anchor={() => {}}
      attemptedPost={false}
      editorWidth={560}
    />
  );
}

async function setup(category = "") {
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  state.invoice = createInvoice(state, actor, "Branch 1", true);
  addManualLine(state, actor, "0002");
  const line = state.invoice.lines[0];
  line.product_code = "NEW";
  line.new_name_en = "Orchard Test Item";
  line.description = "ORCHARD TEST ITEM";
  line.pricing_category = category;
  const workspace = invoiceWorkspaceRead(state, actor);
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
  });
  fixtures.push(fixture);
  const closed = vi.fn();
  const edits: Promise<unknown>[] = [];
  let acknowledge = () => {};
  const acknowledgment = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  render(
    <DemoProvider options={fixture.options}>
      <EditorWithDelayedProjection
        workspace={workspace}
        acknowledgment={acknowledgment}
        editStarted={(operation) => edits.push(operation)}
        closed={closed}
      />
    </DemoProvider>,
  );
  await screen.findByLabelText("Pricing category");
  return { fixture, closed, edits, acknowledge };
}

it("confirms a category change with one click while its UI acknowledgment is delayed", async () => {
  const { fixture, closed, edits, acknowledge } = await setup();
  try {
    fireEvent.click(screen.getByLabelText("Pricing category"));
    fireEvent.click(await screen.findByRole("option", { name: "Grocery" }));
    expect(edits).toHaveLength(1);
    // No wait for a new category projection or the category command's acknowledgment.
    fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    const line = (await fixture.readCanonical()).invoice.lines[0];
    expect(line.pricing_category).toBe("grocery");
    expect(line.review_confirmed).toBe(true);
  } finally {
    acknowledge();
    await Promise.all(edits);
  }
});

it("validates a just-cleared canonical cost and focuses its field despite the delayed projection", async () => {
  const { fixture, closed, edits, acknowledge } = await setup("grocery");
  try {
    const cost = screen.getByLabelText("Unit cost before tax", { exact: true });
    fireEvent.change(cost, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
    await waitFor(() => expect(cost).toHaveFocus());
    expect(cost).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(
        "Enter a cost of zero or more with up to four decimal places.",
      ),
    ).toBeVisible();
    expect(closed).not.toHaveBeenCalled();
    expect(
      (await fixture.readCanonical()).invoice.lines[0].review_confirmed,
    ).toBe(false);
  } finally {
    acknowledge();
    await Promise.all(edits);
  }
});

it("keeps an actually missing category unconfirmed and focuses the required category", async () => {
  const { fixture, closed, acknowledge } = await setup();
  try {
    fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
    const category = screen.getByLabelText("Pricing category");
    await waitFor(() => expect(category).toHaveFocus());
    expect(category).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Choose a pricing category.")).toBeVisible();
    expect(closed).not.toHaveBeenCalled();
    expect(
      (await fixture.readCanonical()).invoice.lines[0].review_confirmed,
    ).toBe(false);
  } finally {
    acknowledge();
  }
});
