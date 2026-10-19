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
import { renderedUiReady } from "../test/rendered-ui-readiness";

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
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
  releaseSelection = undefined;
});

function ActualInvoices() {
  const context = useDemo();
  useLayoutEffect(() => {
    currentDemo = context;
  }, [context]);
  return context.actor && context.authStage === "complete" ? (
    <Invoices />
  ) : null;
}

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
  fireEvent.click(await screen.findByRole("tab", { name: "Posted" }));
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
  await screen.findByRole("link", { name: "Back to Invoices" });
  expect((await fixture.readCanonical()).invoice.id).toBe(target.id);

  await act(async () => {
    window.history.back();
  });
  await waitFor(() => expect(window.location.hash).toBe("#invoices"));
  await waitFor(() => expect(table()).not.toBeNull());
  expect(screen.getByRole("tab", { name: "Posted" })).toHaveAttribute(
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
  expect(screen.getByRole("tab", { name: "Posted" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(table()).not.toBeNull();
  expect(table().querySelector("th[data-column-key=supplier]")).toBeNull();
  expect((await fixture.readCanonical()).invoice.id).toBe(target.id);
});
