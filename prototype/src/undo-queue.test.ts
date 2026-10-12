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
describe("single eight-second Undo display", () => {
  it("replaces the prior message and gives the new action its own eight seconds", () => {
    const queue = add(add([], "old", 0), "new", 2000);
    expect(queue.map((item) => item.id)).toEqual(["new"]);
    expect(remainingTime(queue[0], 4000)).toBe(6000);
    expect(expireUndoToasts(queue, 9999)).toHaveLength(1);
    expect(expireUndoToasts(queue, 10000)).toEqual([]);
  });
  it("pauses the displayed message and resumes the remaining duration", () => {
    let queue = add([], "one", 0);
    queue = pauseUndoToast(queue, "one", true, 1000);
    expect(remainingTime(queue[0], 50000)).toBe(7000);
    queue = pauseUndoToast(queue, "one", false, 50000);
    expect(expireUndoToasts(queue, 56999)).toHaveLength(1);
    expect(expireUndoToasts(queue, 57000)).toEqual([]);
  });
  it("a new action replaces a hovered message instead of retaining a hidden timer", () => {
    let queue = pauseUndoToast(add([], "old", 0), "old", true, 1000);
    queue = add(queue, "new", 2000);
    expect(queue).toHaveLength(1);
    expect(queue[0].running_since).toBe(2000);
    expect(expireUndoToasts(queue, 10000)).toEqual([]);
  });
  it("repeat pause/resume notifications do not extend the display window", () => {
    let queue = add([], "one", 0);
    queue = pauseUndoToast(queue, "one", true, 1000);
    queue = pauseUndoToast(queue, "one", true, 4000);
    expect(remainingTime(queue[0], 50000)).toBe(7000);
    queue = pauseUndoToast(queue, "one", false, 50000);
    queue = pauseUndoToast(queue, "one", false, 51000);
    expect(remainingTime(queue[0], 53000)).toBe(4000);
  });
});
