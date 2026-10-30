import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { paintLiveReadingStage } from "./live-reading-paint";
let frames: FrameRequestCallback[];
beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("gives a visible stage a genuine two-frame paint opportunity", async () => {
  const completed = vi.fn();
  const task = paintLiveReadingStage(new AbortController().signal).then(
    completed,
  );
  expect(completed).not.toHaveBeenCalled();
  frames.shift()!(0);
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  frames.shift()!(16);
  await task;
  expect(completed).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it("does not wait for a hidden tab's suspended frame scheduler", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await paintLiveReadingStage(new AbortController().signal);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("finishes if a visible tab becomes hidden before the next frame", async () => {
  const completed = vi.fn();
  const task = paintLiveReadingStage(new AbortController().signal).then(
    completed,
  );
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  await task;
  expect(completed).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it("bounds a throttled frame scheduler without a fabricated progress delay", async () => {
  const completed = vi.fn();
  const task = paintLiveReadingStage(new AbortController().signal).then(
    completed,
  );
  await vi.advanceTimersByTimeAsync(49);
  expect(completed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await task;
  expect(completed).toHaveBeenCalledTimes(1);
});
it("cancels a pending phase yield and removes its timers", async () => {
  const controller = new AbortController();
  const task = paintLiveReadingStage(controller.signal);
  controller.abort();
  await expect(task).rejects.toThrow("Cancelled");
  expect(vi.getTimerCount()).toBe(0);
});
