import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLookupSearchDraft } from "./lookup-search-draft";

const actor = {
  company_id: "fictional-company",
  user_id: "fictional-manager",
  session_id: "fictional-session",
  role: "manager" as const,
  authority_epoch: 1,
  person_version: 1,
};
const initial = () =>
  new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("search") ??
  "";
beforeEach(() => window.history.replaceState(null, "", "/#lookup"));
afterEach(() => {
  window.history.replaceState(null, "", "/#products");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  cleanup();
  vi.restoreAllMocks();
});
it("retains only typed text across a same-identity protected Lookup remount", () => {
  const first = renderHook(() => useLookupSearchDraft(actor, initial));
  act(() => first.result.current[1]("0004"));
  first.unmount();
  const next = renderHook(() => useLookupSearchDraft(actor, initial));
  expect(next.result.current[0]).toBe("0004");
  act(() => next.result.current[1](""));
  next.unmount();
  expect(
    renderHook(() => useLookupSearchDraft(actor, initial)).result.current[0],
  ).toBe("");
});
it.each([
  { company_id: "other-company" },
  { user_id: "other-person" },
  { session_id: "other-session" },
  { role: "cashier" as const },
  { authority_epoch: 2 },
  { person_version: 2 },
])("does not restore another identity or authority draft: %j", (patch) => {
  const first = renderHook(() => useLookupSearchDraft(actor, initial));
  act(() => first.result.current[1]("0004"));
  first.unmount();
  expect(
    renderHook(() => useLookupSearchDraft({ ...actor, ...patch }, initial))
      .result.current[0],
  ).toBe("");
});
it("uses a genuine new hash query instead of the retained draft", () => {
  const first = renderHook(() => useLookupSearchDraft(actor, initial));
  act(() => first.result.current[1]("0004"));
  first.unmount();
  window.history.replaceState(null, "", "/#lookup?search=0009");
  expect(
    renderHook(() => useLookupSearchDraft(actor, initial)).result.current[0],
  ).toBe("0009");
});
it("discards the draft after leaving Lookup", () => {
  const first = renderHook(() => useLookupSearchDraft(actor, initial));
  act(() => first.result.current[1]("0004"));
  window.history.replaceState(null, "", "/#products");
  first.unmount();
  window.history.replaceState(null, "", "/#lookup");
  expect(
    renderHook(() => useLookupSearchDraft(actor, initial)).result.current[0],
  ).toBe("");
});

it("clears an in-place authority change and rejects the old input callback", () => {
  const view = renderHook(
    ({ identity }) => useLookupSearchDraft(identity, initial),
    {
      initialProps: { identity: actor },
    },
  );
  act(() => view.result.current[1]("0004"));
  const oldInput = view.result.current[1];
  view.rerender({ identity: { ...actor, user_id: "replacement-person" } });
  expect(view.result.current[0]).toBe("");
  act(() => oldInput("old-scope-query"));
  expect(view.result.current[0]).toBe("");
  view.rerender({ identity: actor });
  expect(view.result.current[0]).toBe("");
});
it("discards a draft when navigation leaves and returns while Lookup is unmounted", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const first = renderHook(() => useLookupSearchDraft(actor, initial));
  act(() => first.result.current[1]("0004"));
  first.unmount();
  const observer = add.mock.calls.find(([name]) => name === "hashchange")?.[1];
  expect(observer).toBeDefined();
  expect(remove).not.toHaveBeenCalledWith("hashchange", observer);
  window.history.replaceState(null, "", "/#products");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  expect(remove).toHaveBeenCalledWith("hashchange", observer);
  window.history.replaceState(null, "", "/#lookup");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  expect(
    renderHook(() => useLookupSearchDraft(actor, initial)).result.current[0],
  ).toBe("");
});

it("observes a queued exit even when the current hash has already returned", () => {
  const first = renderHook(() => useLookupSearchDraft(actor, initial));
  act(() => first.result.current[1]("0004"));
  first.unmount();
  const base = window.location.origin + "/";
  window.history.replaceState(null, "", "/#products");
  window.history.replaceState(null, "", "/#lookup");
  window.dispatchEvent(
    new HashChangeEvent("hashchange", {
      oldURL: base + "#lookup",
      newURL: base + "#products",
    }),
  );
  window.dispatchEvent(
    new HashChangeEvent("hashchange", {
      oldURL: base + "#products",
      newURL: base + "#lookup",
    }),
  );
  expect(
    renderHook(() => useLookupSearchDraft(actor, initial)).result.current[0],
  ).toBe("");
});
