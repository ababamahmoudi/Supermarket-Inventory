import { useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { AUTHORITY_DATABASE_NAME } from "./authority-repository";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { initialState } from "./e1-bootstrap";
import { DemoProvider, useDemo } from "./store";
import { useProtectedQuery } from "./use-protected-query";
import type { ProviderOptions } from "./store";

// Real production Provider, SDK, directory, permission, query and selector.
// A live IDB lock controls response timing without a query/Context/actor mock.
let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
const locks: Array<{ release(): Promise<void> }> = [];
const reads: Array<{ code: string; user_id: string }> = [];
const shown: Array<{ code: string; cost: string | null }> = [];

async function holdActualReads(factory: IDBFactory, company: string) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(AUTHORITY_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction(
    ["companies", "business"],
    "readwrite",
  );
  let hold = true;
  const complete = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
  const started = new Promise<void>((resolve, reject) => {
    const keepAlive = () => {
      // No record is inspected, forged or written: genuine queued transactions
      // proceed normally after the final read request completes.
      const request = transaction.objectStore("business").get(company);
      request.onsuccess = () => {
        resolve();
        if (hold) keepAlive();
      };
      request.onerror = () => reject(request.error);
    };
    keepAlive();
  });
  await started;
  let released: Promise<void> | undefined;
  const lock = {
    release() {
      if (!released) {
        hold = false;
        released = complete.finally(() => database.close());
      }
      return released;
    },
  };
  locks.push(lock);
  return lock;
}

function Harness({
  code,
  enabled = true,
}: {
  code: string;
  enabled?: boolean;
}) {
  const { state, actor, locked, switchDemoUser, lock, unlock } = useDemo();
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const result = useProtectedQuery(
    enabled ? "catalog.cost_read" : null,
    scope,
    (canonical, currentActor) => {
      reads.push({ code, user_id: currentActor.user_id });
      const product = canonical.products.find((item) => item.code === code)!;
      return { code: product.code, cost: product.last_cost_before_tax };
    },
    code,
  );
  useEffect(() => {
    if (result.data) shown.push(result.data);
  }, [result.data]);
  return (
    <>
      <output data-testid="actor">{actor?.username ?? "no actor"}</output>
      <output data-testid="locked">{String(locked)}</output>
      <output data-testid="dto">{JSON.stringify(result.data)}</output>
      <output data-testid="pending">{String(result.pending)}</output>
      <button
        onClick={() => {
          void switchDemoUser("ny-floor");
        }}
      >
        Switch actual Floor Worker
      </button>
      <button
        onClick={() => {
          void lock();
        }}
      >
        Lock actual session
      </button>
      <button
        onClick={() => {
          void unlock("demo1234");
        }}
      >
        Unlock actual session
      </button>
    </>
  );
}
function app(options: ProviderOptions, code: string, enabled = true) {
  return (
    <DemoProvider options={options}>
      <Harness code={code} enabled={enabled} />
    </DemoProvider>
  );
}
async function setup() {
  const factory = new IDBFactory();
  fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
    factory,
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  const state = await fixture.readCanonical();
  const expected = (code: string) => ({
    code,
    cost: state.products.find((item) => item.code === code)!
      .last_cost_before_tax,
  });
  return { factory, company: state.config.company.seed_key, expected };
}
const dto = () => JSON.parse(screen.getByTestId("dto").textContent!);
const expectPendingWithoutDTO = () => {
  expect(dto()).toBeNull();
  expect(screen.getByTestId("pending")).toHaveTextContent("true");
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  reads.length = 0;
  shown.length = 0;
});
afterEach(async () => {
  await Promise.all(locks.splice(0).map((lock) => lock.release()));
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
});

it("a genuine key A→B→A cycle stays pending and never displays a previous-key or late nonmatching private DTO", async () => {
  const f = await setup(),
    view = render(app(fixture.options, "0001"));
  await waitFor(() => expect(dto()).toEqual(f.expected("0001")), {
    timeout: 5000,
  });
  const before = await fixture.readCanonical();
  const count = reads.length,
    displayedBefore = shown.length;
  const held = await holdActualReads(f.factory, f.company);
  view.rerender(app(fixture.options, "0002"));
  expectPendingWithoutDTO();
  view.rerender(app(fixture.options, "0001"));
  expectPendingWithoutDTO();
  await act(async () => {
    await held.release();
  });
  await waitFor(() => expect(reads.length).toBeGreaterThanOrEqual(count + 2), {
    timeout: 5000,
  });
  await waitFor(() => expect(dto()).toEqual(f.expected("0001")));
  expect(
    shown.slice(displayedBefore).every((value) => value.code === "0001"),
  ).toBe(true);
  expect(reads.every((value) => value.user_id === "demo-person-manager")).toBe(
    true,
  );
  expect(await fixture.readCanonical()).toEqual(before);
});

it("nullable source capability hides the old DTO immediately and a newly permitted request requires its own actual read", async () => {
  const f = await setup(),
    view = render(app(fixture.options, "0001"));
  await waitFor(() => expect(dto()).toEqual(f.expected("0001")), {
    timeout: 5000,
  });
  const held = await holdActualReads(f.factory, f.company),
    count = reads.length;
  view.rerender(app(fixture.options, "0001", false));
  expect(dto()).toBeNull();
  expect(screen.getByTestId("pending")).toHaveTextContent("false");
  expect(reads).toHaveLength(count);
  view.rerender(app(fixture.options, "0001", true));
  expectPendingWithoutDTO();
  await act(async () => {
    await held.release();
  });
  await waitFor(() => expect(reads.length).toBeGreaterThan(count), {
    timeout: 5000,
  });
  await waitFor(() => expect(dto()).toEqual(f.expected("0001")));
});

it("actual Demo role switching discards a blocked Manager response and Floor Worker never receives a private cost projection", async () => {
  const f = await setup(),
    view = render(app(fixture.options, "0001"));
  await waitFor(() => expect(dto()).toEqual(f.expected("0001")), {
    timeout: 5000,
  });
  const before = await fixture.readCanonical();
  const held = await holdActualReads(f.factory, f.company),
    displayedBefore = shown.length;
  view.rerender(app(fixture.options, "0002"));
  expectPendingWithoutDTO();
  fireEvent.click(
    screen.getByRole("button", { name: "Switch actual Floor Worker" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("actor")).toHaveTextContent("no actor"),
  );
  expect(dto()).toBeNull();
  await act(async () => {
    await held.release();
  });
  await waitFor(
    () => expect(screen.getByTestId("actor")).toHaveTextContent("ny-floor"),
    { timeout: 5000 },
  );
  expect(dto()).toBeNull();
  expect(screen.getByTestId("pending")).toHaveTextContent("false");
  expect(shown.slice(displayedBefore)).toEqual([]);
  expect(reads.every((value) => value.user_id === "demo-person-manager")).toBe(
    true,
  );
  const authority = await fixture.repository.load(f.company);
  expect(
    authority.sessions.find(
      (session) => session.id === fixture.identity.session_id,
    )?.state,
  ).toBe("revoked");
  const after = await fixture.readCanonical();
  expect({
    ledger: after.ledger,
    invoices: after.invoices,
    stock: after.stock,
  }).toEqual({
    ledger: before.ledger,
    invoices: before.invoices,
    stock: before.stock,
  });
});

it("actual lock clears private data before the durable lock completes and genuine unlock gets a fresh canonical response", async () => {
  const f = await setup(),
    view = render(app(fixture.options, "0001"));
  await waitFor(() => expect(dto()).toEqual(f.expected("0001")), {
    timeout: 5000,
  });
  const held = await holdActualReads(f.factory, f.company),
    displayedBefore = shown.length;
  view.rerender(app(fixture.options, "0002"));
  expectPendingWithoutDTO();
  fireEvent.click(screen.getByRole("button", { name: "Lock actual session" }));
  await waitFor(() =>
    expect(screen.getByTestId("locked")).toHaveTextContent("true"),
  );
  expect(dto()).toBeNull();
  await act(async () => {
    await held.release();
  });
  await waitFor(async () => {
    const authority = await fixture.repository.load(f.company);
    expect(
      authority.sessions.find(
        (session) => session.id === fixture.identity.session_id,
      )?.state,
    ).toBe("locked");
  });
  expect(shown.slice(displayedBefore)).toEqual([]);
  fireEvent.click(
    screen.getByRole("button", { name: "Unlock actual session" }),
  );
  await waitFor(
    () => expect(screen.getByTestId("actor")).toHaveTextContent("manager"),
    { timeout: 5000 },
  );
  await waitFor(() => expect(dto()).toEqual(f.expected("0002")));
  expect(reads.every((value) => value.user_id === "demo-person-manager")).toBe(
    true,
  );
});
