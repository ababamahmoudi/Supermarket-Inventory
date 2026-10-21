import { useLayoutEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { shellProviderFixture } from "./shell-provider-test-fixture";
import { addNote, updateNoteStatus } from "./operations";
import type { DemoState } from "./types";

let fixture: ReturnType<typeof shellProviderFixture> | undefined;
let live: ReturnType<typeof useDemo> | undefined;
function Probe() {
  const context = useDemo();
  useLayoutEffect(() => {
    live = context;
  }, [context]);
  return null;
}
function current() {
  if (!live) throw new Error("Provider not mounted");
  return live;
}
function physicalAndMoney(state: DemoState) {
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
  });
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  fixture = undefined;
  live = undefined;
  vi.unstubAllGlobals();
});
it("links the real Manager's new note status audit to its exact source and safely Undoes only that action on another author's note", async () => {
  const state = initialState();
  fixture = shellProviderFixture(state);
  const repository = fixture.repository;
  const company = state.config.company.seed_key;
  const read = async () =>
    (await repository.loadBusiness<DemoState>(company)).state;
  render(
    <DemoProvider options={fixture.options}>
      <Probe />
    </DemoProvider>,
  );
  await waitFor(() => expect(current().authStage).toBe("signed_out"), {
    timeout: 10000,
  });
  await act(async () => {
    expect(await current().signIn("ny-floor", "demo1234")).toBeNull();
  });
  await waitFor(() =>
    expect(current().actor?.user_id).toBe("demo-person-ny-floor"),
  );
  await act(async () => {
    await current().command(
      "notes.entry_add",
      {
        company_id: company,
        kind: "location_record",
        location_ids: ["Branch 1"],
      },
      (draft, actor) =>
        addNote(draft, actor, {
          type: "note_to_supervisor",
          text: "Actual other-author note",
        }),
    );
  });
  const created = (await read()).notes.find(
    (note) => note.text === "Actual other-author note",
  )!;
  expect(created).toMatchObject({ actor_user_id: "demo-person-ny-floor" });
  const beforeDenied = await read();
  await act(async () => {
    await expect(
      current().command(
        "notes.status_manage",
        {
          company_id: company,
          kind: "location_record",
          location_ids: [created.branch],
        },
        (draft, actor) =>
          updateNoteStatus(draft, actor, created.id, "resolved"),
      ),
    ).rejects.toThrow();
  });
  expect(await read()).toEqual(beforeDenied);
  await act(async () => {
    expect(await current().switchDemoUser("manager")).toBeNull();
  });
  await waitFor(() =>
    expect(current().actor?.user_id).toBe("demo-person-manager"),
  );
  await act(async () => {
    await current().setLocation({ kind: "location", location_id: "Branch 1" });
  });
  const before = await read();
  await act(async () => {
    await current().command(
      "notes.status_manage",
      {
        company_id: company,
        kind: "location_record",
        location_ids: [created.branch],
      },
      (draft, actor) => updateNoteStatus(draft, actor, created.id, "resolved"),
    );
  });
  const done = await read();
  const action = done.activity.find(
    (entry) =>
      entry.action === "note_resolved" && entry.entity_id === created.id,
  )!;
  expect(action).toMatchObject({
    entity_type: "note",
    entity_id: created.id,
    branch: created.branch,
    actor_user_id: "demo-person-manager",
    reversible: true,
  });
  expect(done.notes.find((note) => note.id === created.id)).toMatchObject({
    status: "resolved",
    actor_user_id: "demo-person-ny-floor",
  });
  expect(physicalAndMoney(done)).toBe(physicalAndMoney(before));
  await act(async () => {
    await current().undoActivity(action.id);
  });
  const undone = await read();
  expect(undone.notes.find((note) => note.id === created.id)).toEqual(created);
  expect(undone.activity.find((entry) => entry.id === action.id)).toEqual(
    action,
  );
  expect(undone.activity.length).toBe(done.activity.length + 1);
  expect(physicalAndMoney(undone)).toBe(physicalAndMoney(before));
});

it("rechecks the original note's read location after a genuine Owner changes its reader's role and assignment", async () => {
  const state = initialState();
  fixture = shellProviderFixture(state);
  const repository = fixture.repository;
  const company = state.config.company.seed_key;
  const read = async () =>
    (await repository.loadBusiness<DemoState>(company)).state;
  render(
    <DemoProvider options={fixture.options}>
      <Probe />
    </DemoProvider>,
  );
  await waitFor(() => expect(current().authStage).toBe("signed_out"), {
    timeout: 10000,
  });
  await act(async () => {
    expect(await current().signIn("manager", "demo1234")).toBeNull();
  });
  await act(async () => {
    const response =
      current().secondStepMethod === "passkey"
        ? "simulated-passkey"
        : state.config.session.simulated_authenticator_code!;
    expect(await current().completeSecondStep(response)).toBeNull();
  });
  await waitFor(() => expect(current().actor?.role).toBe("manager"));
  await act(async () => {
    await current().setLocation({ kind: "location", location_id: "Branch 1" });
  });
  // Authors cannot mark their own note seen (Ali, Oct 2026), so a Floor
  // Worker writes the note and the Manager is its reader.
  await act(async () => {
    expect(await current().switchDemoUser("ny-floor")).toBeNull();
  });
  await waitFor(() => expect(current().actor?.role).toBe("floor_worker"));
  await act(async () => {
    await current().command(
      "notes.entry_add",
      {
        company_id: company,
        kind: "location_record",
        location_ids: ["Branch 1"],
      },
      (draft, actor) =>
        addNote(draft, actor, {
          type: "note_to_supervisor",
          text: "Genuine original status permission",
        }),
    );
  });
  await act(async () => {
    expect(await current().switchDemoUser("manager")).toBeNull();
  });
  await waitFor(() => expect(current().actor?.role).toBe("manager"));
  await act(async () => {
    await current().setLocation({ kind: "location", location_id: "Branch 1" });
  });
  const note = (await read()).notes.find(
    (row) => row.text === "Genuine original status permission",
  )!;
  await act(async () => {
    await current().command(
      "notes.mark_seen",
      {
        company_id: company,
        kind: "location_record",
        location_ids: [note.branch],
      },
      (draft, actor) => updateNoteStatus(draft, actor, note.id, "read"),
    );
  });
  const seen = await read();
  const action = seen.activity.find(
    (row) => row.action === "note_seen" && row.entity_id === note.id,
  )!;
  expect(action).toMatchObject({
    actor_user_id: "demo-person-manager",
    entity_id: note.id,
    reversible: true,
  });
  await act(async () => {
    expect(await current().switchDemoUser("owner")).toBeNull();
  });
  await waitFor(() => expect(current().actor?.role).toBe("owner"));
  let manager:
    | Awaited<ReturnType<ReturnType<typeof useDemo>["people"]["list"]>>[number]
    | undefined;
  await act(async () => {
    manager = (await current().people.list()).find(
      (row) => row.id === "demo-person-manager",
    );
  });
  expect(manager).toBeDefined();
  await act(async () => {
    await current().people.edit({
      person_id: manager!.id,
      expected_version: manager!.version,
      name_en: manager!.name_en,
      name_fa: manager!.name_fa,
      username: manager!.username,
      phone: manager!.phone,
      email: manager!.email,
      role: "floor_worker",
      location_scope: { kind: "assigned", location_ids: ["Branch 2"] },
      reason:
        "Verify current original-note read scope after a real role and location change",
    });
  });
  await act(async () => {
    await current().signOut();
  });
  await act(async () => {
    expect(await current().signIn("manager", "demo1234")).toBeNull();
  });
  await waitFor(() => expect(current().actor?.role).toBe("floor_worker"));
  expect(current().actor?.user_id).toBe("demo-person-manager");
  expect(current().can("notes.entry_add")).toBe(true);
  expect(current().can("notes.status_manage")).toBe(false);
  const beforeDenied = await read();
  await act(async () => {
    await expect(current().undoActivity(action.id)).rejects.toThrow();
  });
  expect(await read()).toEqual(beforeDenied);
  expect((await read()).activity.find((row) => row.id === action.id)).toEqual(
    action,
  );
  expect((await read()).notes.find((row) => row.id === note.id)).toMatchObject({
    status: "open",
    seen_receipts: [
      expect.objectContaining({ user_id: "demo-person-manager" }),
    ],
  });
  expect(physicalAndMoney(await read())).toBe(physicalAndMoney(seen));
});
