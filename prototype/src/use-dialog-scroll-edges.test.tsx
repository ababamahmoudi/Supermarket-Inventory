import { useRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useDialogScrollEdges } from "./use-dialog-scroll-edges";

afterEach(cleanup);

function ScrollableDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogScrollEdges(ref, true);
  return (
    <dialog ref={ref} open>
      <div data-testid="body" style={{ overflowY: "auto" }}>
        <label>
          Notes
          <textarea style={{ overflowY: "auto" }} />
        </label>
      </div>
    </dialog>
  );
}

it("marks only edges with remaining scrollable dialog content", async () => {
  render(<ScrollableDialog />);
  const body = screen.getByTestId("body");
  Object.defineProperties(body, {
    scrollHeight: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 100 },
  });
  fireEvent(window, new Event("resize"));
  await waitFor(() =>
    expect(body).toHaveAttribute("data-dialog-scroll-end", "true"),
  );
  expect(body).toHaveAttribute("data-dialog-scroll-start", "false");
  body.scrollTop = 80;
  fireEvent.scroll(body);
  await waitFor(() =>
    expect(body).toHaveAttribute("data-dialog-scroll-start", "true"),
  );
  expect(body).toHaveAttribute("data-dialog-scroll-end", "true");
  body.scrollTop = 400;
  fireEvent.scroll(body);
  await waitFor(() =>
    expect(body).toHaveAttribute("data-dialog-scroll-end", "false"),
  );
  expect(body).toHaveAttribute("data-dialog-scroll-start", "true");
  expect(screen.getByRole("textbox", { name: "Notes" })).not.toHaveAttribute(
    "data-dialog-scroll",
  );
});

it("removes edge decoration when the dialog closes", () => {
  const { unmount } = render(<ScrollableDialog />);
  const body = screen.getByTestId("body");
  expect(body).toHaveAttribute("data-dialog-scroll");
  unmount();
  expect(body).not.toHaveAttribute("data-dialog-scroll");
  expect(body).not.toHaveAttribute("data-dialog-scroll-start");
  expect(body).not.toHaveAttribute("data-dialog-scroll-end");
});
