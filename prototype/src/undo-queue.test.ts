import { describe, expect, it } from "vitest";
import {
  addUndoToast,
  expireUndoToasts,
  pauseUndoToast,
  remainingTime,
  type UndoToast,
} from "./undo-queue";
const add = (queue: UndoToast[], id: string, now: number) =>
  addUndoToast(queue, { id, action: "Stop offer" }, now);
describe("independently timed ten-second Undo queue", () => {
  it("new actions do not reset older timers, and newest is first", () => {
    let queue = add([], "old", 0);
    queue = add(queue, "new", 2000);
    expect(queue.map((item) => item.id)).toEqual(["new", "old"]);
    expect(remainingTime(queue[1], 4000)).toBe(6000);
    queue = expireUndoToasts(queue, 10000);
    expect(queue.map((item) => item.id)).toEqual(["new"]);
    expect(remainingTime(queue[0], 10000)).toBe(2000);
  });
  it("hover pauses only the targeted toast and resumes its remaining time", () => {
    let queue = add([], "old", 0);
    queue = add(queue, "new", 1000);
    queue = pauseUndoToast(queue, "old", true, 2000);
    expect(remainingTime(queue[1], 20000)).toBe(8000);
    queue = expireUndoToasts(queue, 11000);
    expect(queue.map((item) => item.id)).toEqual(["old"]);
    queue = pauseUndoToast(queue, "old", false, 20000);
    expect(expireUndoToasts(queue, 27999)).toHaveLength(1);
    expect(expireUndoToasts(queue, 28000)).toHaveLength(0);
  });
  it("hidden fourth and later items retain independent timers", () => {
    let queue: UndoToast[] = [];
    for (let i = 0; i < 5; i++) queue = add(queue, String(i), i * 500);
    expect(queue.slice(0, 3).map((item) => item.id)).toEqual(["4", "3", "2"]);
    expect(queue.length - 3).toBe(2);
    queue = expireUndoToasts(queue, 10000);
    expect(queue.map((item) => item.id)).toEqual(["4", "3", "2", "1"]);
    queue = expireUndoToasts(queue, 10500);
    expect(queue.map((item) => item.id)).toEqual(["4", "3", "2"]);
  });
  it("repeated hover events do not change the remaining duration", () => {
    let queue = add([], "one", 0);
    queue = pauseUndoToast(queue, "one", true, 1000);
    queue = pauseUndoToast(queue, "one", true, 4000);
    expect(remainingTime(queue[0], 50000)).toBe(9000);
    queue = pauseUndoToast(queue, "one", false, 50000);
    queue = pauseUndoToast(queue, "one", false, 51000);
    expect(remainingTime(queue[0], 53000)).toBe(6000);
  });
});
