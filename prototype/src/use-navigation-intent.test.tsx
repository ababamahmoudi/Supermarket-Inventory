import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useNavigationIntent } from "./use-navigation-intent";

beforeEach(() => {
  window.history.replaceState(null, "", "/#invoices?id=fictional-invoice");
});
afterEach(cleanup);
function delayedPost(isCurrent: () => boolean, navigate: () => void) {
  let finish!: () => void;
  const saving = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return {
    finish,
    settled: (async () => {
      await saving;
      if (isCurrent()) navigate();
    })(),
  };
}
it("keeps the ordinary post route when its actual command settles", async () => {
  const { result } = renderHook(() =>
    useNavigationIntent("company:manager:session:branch:invoice"),
  );
  const navigate = vi.fn();
  const post = delayedPost(result.current(), navigate);
  await act(async () => {
    post.finish();
    await post.settled;
  });
  expect(navigate).toHaveBeenCalledOnce();
});
it.each(["#suppliers", "#invoices?tab=posted"])(
  "does not override a newer Done or Suppliers destination %s",
  async (destination) => {
    const { result } = renderHook(() =>
      useNavigationIntent("company:manager:session:branch:invoice"),
    );
    const navigate = vi.fn();
    const post = delayedPost(result.current(), navigate);
    act(() => {
      window.history.replaceState(null, "", destination);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await act(async () => {
      post.finish();
      await post.settled;
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(destination);
  },
);
it("rejects a leave-and-return intent even when the final invoice hash matches", async () => {
  const { result } = renderHook(() =>
    useNavigationIntent("company:manager:session:branch:invoice"),
  );
  const navigate = vi.fn();
  const post = delayedPost(result.current(), navigate);
  act(() => {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await act(async () => {
    post.finish();
    await post.settled;
  });
  expect(navigate).not.toHaveBeenCalled();
});
it("rejects actor, company, location or invoice changes before the post continuation", async () => {
  const { result, rerender } = renderHook(
    ({ context }) => useNavigationIntent(context),
    { initialProps: { context: "first-authority-and-invoice" } },
  );
  const navigate = vi.fn();
  const post = delayedPost(result.current(), navigate);
  rerender({ context: "different-authority-or-invoice" });
  await act(async () => {
    post.finish();
    await post.settled;
  });
  expect(navigate).not.toHaveBeenCalled();
});
it("rejects the continuation after its view unmounts", async () => {
  const { result, unmount } = renderHook(() =>
    useNavigationIntent("company:manager:session:branch:invoice"),
  );
  const navigate = vi.fn();
  const post = delayedPost(result.current(), navigate);
  unmount();
  await act(async () => {
    post.finish();
    await post.settled;
  });
  expect(navigate).not.toHaveBeenCalled();
});
