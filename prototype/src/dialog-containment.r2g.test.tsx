import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Dialog } from "./ui";

afterEach(cleanup);

it("keeps a native dialog disclosure from opening the table row behind it", () => {
  const openRecord = vi.fn();
  const close = vi.fn();
  render(
    <section onClick={openRecord}>
      <Dialog open title="Edit fictional product" onOpenChange={close}>
        <details>
          <summary>More details</summary>
          <label>
            Description
            <textarea />
          </label>
        </details>
      </Dialog>
    </section>,
  );
  fireEvent.click(screen.getByText("More details"));
  fireEvent.click(screen.getByRole("textbox", { name: "Description" }));
  expect(openRecord).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeVisible();
});

it("still closes a real backdrop click without forwarding it to the row", () => {
  const openRecord = vi.fn();
  const close = vi.fn();
  render(
    <section onClick={openRecord}>
      <Dialog open title="Edit fictional product" onOpenChange={close} />
    </section>,
  );
  const dialog = screen.getByRole("dialog");
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    x: 20,
    y: 20,
    top: 20,
    left: 20,
    right: 420,
    bottom: 420,
    width: 400,
    height: 400,
    toJSON: () => ({}),
  });
  fireEvent.click(dialog, { clientX: 10, clientY: 10 });
  expect(close).toHaveBeenCalledExactlyOnceWith(false);
  expect(openRecord).not.toHaveBeenCalled();
});
