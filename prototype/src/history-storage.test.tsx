import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { initialState, DemoProvider, STORAGE_KEY, useDemo } from "./store";
import {
  attachReversals,
  reverseActivity,
  type HistoryContext,
} from "./history";
import { configuredBranches } from "./settings";
import {
  encodeHistoryStorage,
  decodeHistoryStorage,
  HistoryStorageError,
  historyStorageChecksum,
} from "./history-storage";
import type { DemoState } from "./types";

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const context = (state: DemoState): HistoryContext => ({
  company_id: state.config.company.seed_key,
  branch: "Branch 1",
  role: "supervisor",
  actor: "Demo Supervisor",
  username: "supervisor",
  allowed_branches: configuredBranches(state.config, true),
});
function largeHistory() {
  const state = initialState();
  for (let index = 0; index < 20; index++)
    state.activity.push({
      id: `storage-fixture-${index}`,
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      action: "Save draft",
      by: "Demo Supervisor",
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
  const state = initialState();
  const before = structuredClone(state);
  state.products[0].name_en = "Changed name for codec proof";
  state.activity.push({
    id: "codec-name-edit",
    company_id: state.config.company.seed_key,
    branch: "all",
    action: "Save product",
    by: "Demo Supervisor",
    at: "2026-10-11T12:00:00.000Z",
    reversible: true,
  });
  attachReversals(before, state, context(state));
  state.activity.at(-1)!.reversal![0].guards!.push({
    path: ["config"],
    after: structuredClone(state.config),
    exists: true,
  });
  return { state, originalName: before.products[0].name_en };
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
    const { state, originalName } = validRevert();
    const decoded = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    reverseActivity(decoded, context(decoded), "codec-name-edit", "revert");
    expect(decoded.products[0].name_en).toBe(originalName);
    expect(decoded.activity).toHaveLength(state.activity.length + 1);
    const conflicting = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    conflicting.config.company.currency = "USD";
    expect(() =>
      reverseActivity(
        conflicting,
        context(conflicting),
        "codec-name-edit",
        "revert",
      ),
    ).toThrow();
    expect(conflicting.products[0].name_en).toBe(
      "Changed name for codec proof",
    );
  });
  it("retains company and branch guards and blocks a foreign company's reversal", () => {
    const { state } = validRevert();
    const decoded = decodeHistoryStorage(
      plain(encodeHistoryStorage(state)),
    ) as DemoState;
    expect(() =>
      reverseActivity(
        decoded,
        { ...context(decoded), company_id: "another-company" },
        "codec-name-edit",
        "revert",
      ),
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
  it("does not overwrite a malformed saved dictionary with fallback seed or subsequent in-memory edits", () => {
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
    function Probe() {
      const demo = useDemo();
      return (
        <button
          onClick={() => {
            demo.signIn("supervisor", "demo1234");
            demo.update((draft) => {
              draft.products[0].name_en = "In-memory edit";
            });
          }}
        >
          Attempt edit
        </button>
      );
    }
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "Attempt edit" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
