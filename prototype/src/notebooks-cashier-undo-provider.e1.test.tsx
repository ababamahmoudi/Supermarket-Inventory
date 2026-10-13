import { useLayoutEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { addNote } from "./operations";
import {
  addNotebookEntry,
  createNotebook,
  editNotebook,
  newNotebookInput,
  updateNotebookEntryStatus,
} from "./notebooks";
import { attachReversals, ownUndoResource, reverseActivity } from "./history";
import type { DemoState } from "./types";

let live: ReturnType<typeof useDemo> | null = null;
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>> | null =
  null;

function ActualProviderProbe() {
  const context = useDemo();
  useLayoutEffect(() => {
    live = context;
  }, [context]);
  return (
    <output data-testid="actual-cashier-stage">
      {context.authStage}:{context.actor?.role ?? "none"}
    </output>
  );
}
function current() {
  if (!live?.actor || live.authStage !== "complete")
    throw new Error("Actual Cashier session is not ready");
  return live;
}
function financialAndPhysical(state: DemoState) {
  return JSON.stringify({
    products: state.products,
    invoice: state.invoice,
    invoices: state.invoices,
    ledger: state.ledger,
    returns: state.returns,
    receipt_lots: state.receipt_lots,
    stock: state.stock,
    stock_movements: state.stock_movements,
    offers: state.offers,
    sales: state.sales,
    templates: state.templates,
    label_waitlist: state.label_waitlist,
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // Freeze only Date, keeping actual IndexedDB/crypto/Promise/timer work live.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T16:00:00Z"));
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = null;
  live = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("allows the Cashier's own audited custom-notebook status Undo on another author's entry, denies foreign/general History, and rechecks a changed ACL at commit without changing money or physical evidence", async () => {
  const state = initialState();
  const manager = authenticatedTestFixture(state, "manager", {
    selection: { kind: "location", location_id: "Branch 1" },
  });
  const beforeGeneral = cloneWithAuthority(state);
  addNote(state, manager.actor, {
    type: "to_order",
    text: "Retained management note",
  });
  const generalActivity = attachReversals(
    beforeGeneral,
    state,
    manager.actor,
  ).find((entry) => entry.action === "note_added");
  if (!generalActivity)
    throw new Error("Genuine management History was not created");

  const notebook = createNotebook(state, manager.actor, {
    ...newNotebookInput(),
    name_en: "Cashier handover",
    branch: "Branch 1",
    read_roles: ["manager", "cashier"],
    add_roles: ["manager", "cashier"],
  });
  const entry = addNotebookEntry(state, manager.actor, notebook.id, {
    text: "Check the receipt roll",
  });
  const foreign = initialState();
  foreign.config.company.seed_key = "other-company";
  const otherManager = authenticatedTestFixture(foreign, "manager");
  const foreignNotebook = createNotebook(foreign, otherManager.actor, {
    ...newNotebookInput(),
    name_en: "Foreign notebook",
  });
  const foreignEntry = addNotebookEntry(
    foreign,
    otherManager.actor,
    foreignNotebook.id,
    { branch: "Branch 1", text: "Foreign entry" },
  );
  const foreignActivity = foreign.activity.find(
    (row) => row.entity_id === foreignEntry.id,
  );
  if (!foreignActivity)
    throw new Error("Actual foreign-company activity was not created");
  state.activity.push(structuredClone(foreignActivity));

  fixture = await authenticatedProviderFixture({
    state,
    role: "cashier",
    actorOptions: {
      locations: ["Branch 1"],
      selection: { kind: "location", location_id: "Branch 1" },
    },
  });
  render(
    <DemoProvider options={fixture.options}>
      <ActualProviderProbe />
    </DemoProvider>,
  );
  await waitFor(
    () => {
      if (
        screen.getByTestId("actual-cashier-stage").textContent !==
        "complete:cashier"
      )
        throw new Error("Waiting for genuine Cashier Provider");
    },
    { timeout: 3000 },
  );
  const companyScope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const entryScope = {
    company_id: state.config.company.seed_key,
    kind: "location_record" as const,
    location_ids: ["Branch 1"],
    entity_id: entry.id,
    mutation: true,
  };
  const moneyBefore = financialAndPhysical(await fixture.readCanonical());
  expect(entry.by_user_id).toBe(manager.actor.user_id);
  expect(entry.by_user_id).not.toBe(current().actor!.user_id);
  expect(current().can("history.read_all", companyScope)).toBe(false);
  expect(current().state.activity).toEqual([]);
  await expect(
    current().query(
      "history.read_all",
      companyScope,
      (canonical) => canonical.activity,
    ),
  ).rejects.toThrow("capability");

  await act(async () => {
    await current().command(
      "notebooks.entry_add",
      entryScope,
      (canonical, actor) =>
        updateNotebookEntryStatus(canonical, actor, entry.id, "done"),
    );
  });
  const done = (await fixture.readCanonical()).activity.find(
    (row) => row.entity_id === entry.id && row.action === "notebook_entry_done",
  );
  if (!done) throw new Error("Actual Cashier status action was not committed");
  expect(done.actor_user_id).toBe(current().actor!.user_id);
  expect(current().undoToasts.map((row) => row.id)).toContain(done.id);
  await act(async () => {
    await current().undoActivity(done.id);
  });
  const undone = await fixture.readCanonical();
  expect(
    undone.notebook_entries?.find((row) => row.id === entry.id)?.status,
  ).toBe("open");
  expect(
    undone.notebook_entries?.find((row) => row.id === entry.id)?.by_user_id,
  ).toBe(manager.actor.user_id);
  expect(current().undoToasts.map((row) => row.id)).not.toContain(done.id);
  expect(financialAndPhysical(undone)).toBe(moneyBefore);
  const beforeDenied = JSON.stringify(undone);
  await expect(current().undoActivity(generalActivity.id)).rejects.toThrow(
    "permission",
  );
  await expect(current().undoActivity(foreignActivity.id)).rejects.toThrow(
    "permission",
  );
  expect(JSON.stringify(await fixture.readCanonical())).toBe(beforeDenied);

  await act(async () => {
    await current().command(
      "notebooks.entry_add",
      entryScope,
      (canonical, actor) =>
        updateNotebookEntryStatus(canonical, actor, entry.id, "done"),
    );
  });
  const secondDone = (await fixture.readCanonical()).activity.find(
    (row) =>
      row.entity_id === entry.id &&
      row.action === "notebook_entry_done" &&
      row.id !== done.id,
  );
  if (!secondDone || secondDone.id === done.id)
    throw new Error("Fresh second status action was not committed");
  // Capture only the real, canonical minimal scope while its ACL still allows Undo.
  const capturedScope = await current().query(
    "notebooks.read",
    companyScope,
    (canonical, actor) => ownUndoResource(canonical, actor, secondDone.id),
  );
  expect(capturedScope.status).toBe("custom_notebook_entry");
  expect(capturedScope.owner_user_id).toBe(current().actor!.user_id);
  expect(JSON.stringify(capturedScope)).not.toMatch(
    /cost|ledger|invoice|reversal|selling_price/,
  );
  await fixture.repository.runBusinessCommand<DemoState, void>(
    manager.identity,
    (canonical, actor) => {
      const definition = canonical.notebooks?.find(
        (row) => row.id === notebook.id,
      );
      if (!definition) throw new Error("Canonical notebook disappeared");
      editNotebook(canonical, actor, notebook.id, {
        ...definition,
        read_roles: ["manager"],
        add_roles: ["manager"],
      });
    },
    { capability: "notebooks.definition_manage", resource: companyScope },
  );
  const afterAcl = JSON.stringify(await fixture.readCanonical());
  // The actual private query already completed; the fresh command must reject
  // the now-stale scope using the current canonical notebook ACL independently.
  await expect(
    current().command("history.undo_own", capturedScope, (canonical, actor) =>
      reverseActivity(canonical, actor, secondDone.id, "undo"),
    ),
  ).rejects.toThrow("irreversible");
  await expect(current().undoActivity(secondDone.id)).rejects.toThrow(
    "permission",
  );
  const final = await fixture.readCanonical();
  expect(JSON.stringify(final)).toBe(afterAcl);
  expect(
    final.notebook_entries?.find((row) => row.id === entry.id)?.status,
  ).toBe("done");
  expect(financialAndPhysical(final)).toBe(moneyBefore);
  expect(current().can("history.read_all", companyScope)).toBe(false);
});
