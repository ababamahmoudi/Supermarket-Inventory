import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { authenticatedTestActor } from "./authority-test-fixture";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { cloneWithAuthority } from "./authority";
import { saveProductEdits, productEditSnapshot } from "./product-editor";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { initialState, DemoProvider, STORAGE_KEY, useDemo } from "./store";
import {
  attachReversals,
  reverseActivity,
  type HistoryContext,
} from "./history";
import {
  encodeHistoryStorage,
  decodeHistoryStorage,
  HistoryStorageError,
  historyStorageChecksum,
} from "./history-storage";
import type { DemoState } from "./types";
import {
  renderedUiReady,
  clearRenderedUiReadiness,
} from "./test/rendered-ui-readiness";

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const context = (state: DemoState): HistoryContext =>
  authenticatedTestActor(state, "manager");
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
function largeHistory() {
  const state = initialState();
  const manager = context(state);
  for (let index = 0; index < 20; index++)
    state.activity.push({
      id: `storage-fixture-${index}`,
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      action: "Save draft",
      by: manager.actor,
      actor_user_id: manager.user_id,
      at: "2026-10-11T12:00:00.000Z",
      reversible: true,
      before: { invoice: structuredClone(state.invoice) },
      after: { invoices: structuredClone(state.invoices) },
      reversal: [
        {
          path: ["invoice"],
          before: structuredClone(state.invoice),
          after: structuredClone(state.invoice),
          before_exists: true,
          after_exists: true,
          guards: [
            {
              path: ["invoices"],
              after: structuredClone(state.invoices),
              exists: true,
            },
          ],
        },
      ],
    });
  return state;
}
function validRevert() {
  const state = initialState(),
    manager = context(state);
  const before = cloneWithAuthority(state),
    product = state.products[0];
  saveProductEdits(
    state,
    manager,
    product.code,
    {
      name_en: "Changed name for codec proof",
      name_fa: product.name_fa ?? "",
      description_en: product.description_en ?? "",
      description_fa: product.description_fa ?? "",
      unit_size: product.unit_size,
      ai_category: product.ai_category ?? "",
      pricing_category: product.pricing_category,
      barcode: product.barcode ?? "",
      main_supplier: product.main_supplier,
      date_tracking: product.date_tracking,
      scope: "all",
    },
    productEditSnapshot(state, manager, product.code),
  );
  const [entry] = attachReversals(before, state, manager);
  entry.reversal![0].guards!.push({
    path: ["config"],
    after: structuredClone(state.config),
    exists: true,
  });
  return { state, originalName: before.products[0].name_en, entryId: entry.id };
}
describe("lossless scoped History persistence", () => {
  it("deduplicates repeated large before/after/inverse/guard values without losing a single audit field", () => {
    const state = largeHistory();
    const encoded = encodeHistoryStorage(state);
    expect(JSON.stringify(encoded).length).toBeLessThan(
      JSON.stringify(state).length / 3,
    );
    const decoded = decodeHistoryStorage(plain(encoded)) as DemoState;
    expect(decoded).toEqual(plain(state));
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(plain(state)));
    expect(state.activity.at(-1)!.after).toHaveProperty("invoices");
    expect(decoded.activity.at(-1)!.reversal![0].guards![0].after).toEqual(
      plain(state.invoices),
    );
    expect(encodeHistoryStorage(decoded)).toEqual(encoded);
  });
  it("keeps decoded snapshots independent so a later edit cannot mutate other audit evidence", () => {
    const state = largeHistory();
    const decoded = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    const first = decoded.activity.at(-1)!.reversal![0].guards![0]
      .after as NonNullable<DemoState["invoices"]>;
    const second = decoded.activity.at(-2)!.reversal![0].guards![0]
      .after as NonNullable<DemoState["invoices"]>;
    expect(first).not.toBe(second);
    first[0].supplier = "Only this decoded snapshot";
    expect(second[0].supplier).not.toBe(first[0].supplier);
  });
  it("restores real Revert and rejects intervening config changes with the full large guard intact", () => {
    const { state, originalName, entryId } = validRevert();
    const decoded = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    reverseActivity(decoded, context(decoded), entryId, "revert");
    expect(decoded.products[0].name_en).toBe(originalName);
    expect(decoded.activity).toHaveLength(state.activity.length + 1);
    const conflicting = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    conflicting.config.company.currency = "USD";
    expect(() =>
      reverseActivity(conflicting, context(conflicting), entryId, "revert"),
    ).toThrow();
    expect(conflicting.products[0].name_en).toBe(
      "Changed name for codec proof",
    );
  });
  it("retains company and branch guards and blocks a foreign company's reversal", () => {
    const { state, entryId } = validRevert();
    const decoded = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    const foreignState = initialState();
    foreignState.config.company.seed_key = "another-company";
    const foreignManager = context(foreignState);
    expect(() =>
      reverseActivity(decoded, foreignManager, entryId, "revert"),
    ).toThrow();
    expect(decoded.activity.at(-1)!.reversal).toEqual(
      plain(state.activity.at(-1)!.reversal),
    );
  });
  it("never interprets legitimate user JSON as an archive reference outside explicit bound slots", () => {
    const state = largeHistory();
    state.activity[0].after = {
      __c6_history_ref: 0,
      legitimate: "User JSON ".repeat(300),
    };
    const decoded = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    expect(decoded.activity[0].after).toEqual(state.activity[0].after);
    expect(
      decodeHistoryStorage({ activity: [{ after: { __c6_history_ref: 0 } }] }),
    ).toEqual({ activity: [{ after: { __c6_history_ref: 0 } }] });
  });
  it.each([
    "dangling",
    "cycle",
    "tag",
    "binding",
    "duplicate",
    "slot",
    "integrity",
  ])("rejects a %s dictionary before any business logic reads it", (fault) => {
    const encoded = plain(encodeHistoryStorage(largeHistory())) as DemoState & {
      prototype_history_dictionary: {
        version: number;
        blocks: unknown[];
        bindings: (string | number)[][];
        integrity: string;
      };
    };
    const dictionary = encoded.prototype_history_dictionary;
    if (fault === "dangling")
      dictionary.blocks[0] = ["ref", dictionary.blocks.length + 3];
    if (fault === "cycle") dictionary.blocks[0] = ["ref", 0];
    if (fault === "tag") dictionary.blocks[0] = ["invented", 0];
    if (fault === "binding") dictionary.bindings[0] = [0, "company_id"];
    if (fault === "duplicate") dictionary.bindings.push(dictionary.bindings[0]);
    if (fault === "slot") dictionary.bindings[0] = [10000, "before"];
    if (fault !== "integrity")
      dictionary.integrity = historyStorageChecksum({
        blocks: dictionary.blocks,
        bindings: dictionary.bindings,
        activity: encoded.activity,
      });
    else dictionary.integrity = "invalid";
    expect(() => decodeHistoryStorage(encoded)).toThrow(HistoryStorageError);
  });
  it("does not overwrite a malformed saved dictionary with fallback seed or subsequent in-memory edits", async () => {
    localStorage.clear();
    sessionStorage.clear();
    const state = initialState();
    const invalid = {
      ...state,
      prototype_history_dictionary: {
        version: 1,
        blocks: [["ref", 0]],
        bindings: [],
      },
    };
    const raw = JSON.stringify(invalid);
    localStorage.setItem(STORAGE_KEY, raw);
    const fixture = await authenticatedProviderFixture({
      state: initialState(),
      role: "manager",
      initializeBusiness: false,
    });
    fixtures.push(fixture);
    let attemptCompleted: Promise<void> = Promise.resolve();
    function Probe() {
      const demo = useDemo(),
        [attempted, setAttempted] = useState(false);
      return (
        <>
          <button
            onClick={() => {
              attemptCompleted = (async () => {
                try {
                  await demo.signIn(fixture.actor.username, "demo1234");
                  await demo.completeSecondStep(
                    fixture.options.demoUsers.find(
                      (person) => person.id === fixture.actor.user_id,
                    )!.setup.second_step_method === "passkey"
                      ? "simulated-passkey"
                      : initialState().config.session
                          .simulated_authenticator_code!,
                  );
                  await demo.command(
                    "catalog.edit",
                    {
                      company_id: fixture.actor.company_id,
                      kind: "company_shared",
                      mutation: true,
                    },
                    (draft, actor) => {
                      const product = draft.products[0];
                      saveProductEdits(
                        draft,
                        actor,
                        product.code,
                        {
                          name_en: "In-memory edit",
                          name_fa: product.name_fa ?? "",
                          description_en: product.description_en ?? "",
                          description_fa: product.description_fa ?? "",
                          unit_size: product.unit_size,
                          ai_category: product.ai_category ?? "",
                          pricing_category: product.pricing_category,
                          barcode: product.barcode ?? "",
                          main_supplier: product.main_supplier,
                          date_tracking: product.date_tracking,
                          scope: "all",
                        },
                        productEditSnapshot(draft, actor, product.code),
                      );
                    },
                  );
                } catch {
                  /* A failed command cannot satisfy the canonical edit assertion below. */
                }
                setAttempted(true);
              })();
            }}
          >
            Attempt edit
          </button>
          <output data-testid="history-auth-stage">{demo.authStage}</output>
          <output data-testid="history-corrupt">
            {demo.historyLoadError ? "quarantined" : "loading"}
          </output>
          {attempted && <output>Attempt completed</output>}
        </>
      );
    }
    render(
      <DemoProvider options={fixture.options}>
        <Probe />
      </DemoProvider>,
    );
    // Quarantine publication precedes the real resumed-session projection.
    // Preserve the complete-stage assertion, awaiting actual bootstrap first.
    await renderedUiReady(
      () =>
        screen.queryByTestId("history-auth-stage")?.textContent === "complete",
    );
    await screen.findByText("quarantined");
    await waitFor(() =>
      expect(screen.getByTestId("history-auth-stage")).toHaveTextContent(
        "complete",
      ),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Attempt edit" }));
      await attemptCompleted;
    });
    await screen.findByText("Attempt completed");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    const separate = await fixture.readCanonical();
    expect(separate.products[0].name_en).toBe("In-memory edit");
    expect(separate.prototype_e1_history_recovery?.phase).toBe("quarantined");
  });
});
