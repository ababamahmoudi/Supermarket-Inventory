import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReviewScrollAnchor } from "./useReviewScrollAnchor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function AnchorHarness({ revision }: { revision: number }) {
  const { anchor } = useReviewScrollAnchor();
  return (
    <button
      data-revision={revision}
      onClick={(event) => anchor(event.currentTarget)}
    >
      Used control
    </button>
  );
}

function viewport() {
  let scrollY = 1957;
  let documentTop = 858;
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
  const scroll = vi
    .spyOn(window, "scrollBy")
    .mockImplementation((options: ScrollToOptions | number, y?: number) => {
      scrollY += typeof options === "object" ? (options.top ?? 0) : (y ?? 0);
    });
  const rendered = render(<AnchorHarness revision={0} />);
  const control = screen.getByRole("button", { name: "Used control" });
  vi.spyOn(control, "getBoundingClientRect").mockImplementation(
    () => ({ top: documentTop - scrollY }) as DOMRect,
  );
  fireEvent.click(control);
  return {
    control,
    scroll,
    externalScroll(next: number) {
      scrollY = next;
    },
    moveContent(amount: number) {
      documentTop += amount;
    },
    render(revision: number) {
      rendered.rerender(<AnchorHarness revision={revision} />);
    },
  };
}

it("does not restore a previous control after programmatic scrolling before its scroll event arrives", () => {
  const view = viewport();
  // Match the CI race: a pending edit renders after scrolling to Confirm,
  // before the browser has delivered the native scroll event.
  view.externalScroll(1473);
  view.render(1);
  expect(window.scrollY).toBe(1473);
  expect(view.control.getBoundingClientRect().top).toBe(-615);
  expect(view.scroll).not.toHaveBeenCalled();
  fireEvent.scroll(window);
  view.moveContent(36);
  view.render(2);
  expect(view.scroll).not.toHaveBeenCalled();
});

it("retains an offscreen row through content changes and its own delayed scroll events", () => {
  const view = viewport();
  view.moveContent(36);
  view.render(1);
  expect(window.scrollY).toBe(1993);
  expect(view.control.getBoundingClientRect().top).toBe(-1099);
  // A second layout can happen before the first compensation event arrives.
  view.moveContent(12);
  view.render(2);
  fireEvent.scroll(window);
  view.moveContent(8);
  view.render(3);
  expect(view.control.getBoundingClientRect().top).toBe(-1099);
  expect(view.scroll).toHaveBeenCalledTimes(3);
});

it("clears a pending own-scroll exemption when a different external scroll is delivered", () => {
  const view = viewport();
  view.moveContent(36);
  view.render(1);
  view.externalScroll(1473);
  fireEvent.scroll(window);
  view.moveContent(12);
  view.render(2);
  expect(window.scrollY).toBe(1473);
  expect(view.scroll).toHaveBeenCalledTimes(1);
});

it("retains a fresh capture when the previous setup scroll event arrives late", () => {
  const view = viewport();
  view.externalScroll(1473);
  fireEvent.click(view.control);
  fireEvent.scroll(window);
  view.moveContent(36);
  view.render(1);
  expect(window.scrollY).toBe(1509);
  expect(view.control.getBoundingClientRect().top).toBe(-615);
  expect(view.scroll).toHaveBeenCalledTimes(1);
});
