import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useFloatingFeedbackOffset } from "./use-floating-feedback-offset";

const callbacks: ResizeObserverCallback[] = [];
function Probe({ above }: { above?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFloatingFeedbackOffset(ref, "--measured-offset", above);
  return <div ref={ref} data-testid="feedback" />;
}
function measured(
  className: string,
  position: string,
  top: number,
  height: number,
) {
  const element = document.createElement("div");
  element.className = className;
  element.style.position = position;
  element.style.bottom = position === "fixed" ? "0px" : "auto";
  let bounds = { top, height };
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => ({
    x: 0,
    y: bounds.top,
    left: 0,
    top: bounds.top,
    width: 390,
    right: 390,
    height: bounds.height,
    bottom: bounds.top + bounds.height,
    toJSON: () => ({}),
  }));
  document.body.append(element);
  return {
    element,
    resize(top: number, height: number) {
      bounds = { top, height };
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  callbacks.length = 0;
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
    800,
  );
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function offset() {
  return screen
    .getByTestId("feedback")
    .style.getPropertyValue("--measured-offset");
}
it("reserves the actual fixed receiving footer and remeasures its changed height", () => {
  const footer = measured("receiving-progress", "fixed", 650, 150);
  render(<Probe />);
  expect(offset()).toBe("162px");
  footer.resize(602, 198);
  act(() => {
    for (const callback of callbacks) callback([], {} as ResizeObserver);
    vi.advanceTimersByTime(32);
  });
  expect(offset()).toBe("210px");
});
it("keeps desktop's sticky top receiving header out of bottom positioning", () => {
  measured("receiving-progress", "sticky", 60, 64);
  render(<Probe />);
  expect(offset()).toBe("24px");
});
it("stacks above the actual page Undo and returns to the footer when Undo disappears", async () => {
  measured("receiving-progress", "fixed", 700, 100);
  const peer = measured("undo-toast-stack", "fixed", 620, 68);
  render(<Probe above=".undo-toast-stack" />);
  expect(offset()).toBe("188px");
  await act(async () => {
    peer.element.remove();
    await Promise.resolve();
    vi.advanceTimersByTime(32);
  });
  expect(offset()).toBe("112px");
});
it("ignores hidden footer controls while preserving existing generic footer spacing", () => {
  const hidden = measured("receiving-progress", "fixed", 500, 300);
  hidden.element.style.display = "none";
  measured("labels-selection-bar", "fixed", 724, 76);
  render(<Probe />);
  expect(offset()).toBe("88px");
});

it("uses the actual fixed viewport when mobile scaling makes clientHeight smaller", () => {
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
    720,
  );
  measured("receiving-progress", "fixed", 650, 150);
  render(<Probe />);
  expect(offset()).toBe("162px");
});
