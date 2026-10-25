import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PostInvoiceControl } from "./ReviewHeader";
vi.mock("../../store", () => ({ useDemo: () => ({ t: (en: string) => en }) }));
it("keeps incomplete Post actionable to explain requirements without posting", () => {
  const onPost = vi.fn(),
    onAttemptPost = vi.fn();
  render(
    <PostInvoiceControl
      missing="Tax is empty. Enter the tax from the invoice (0.00 if there is none)."
      onPost={onPost}
      onAttemptPost={onAttemptPost}
    />,
  );
  const button = screen.getByRole("button", { name: "Post invoice" });
  expect(button).toBeEnabled();
  fireEvent.focus(button);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Tax is empty");
  fireEvent.click(button);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(onAttemptPost).toHaveBeenCalledTimes(1);
  expect(onPost).not.toHaveBeenCalled();
});
it("disables Post when authority denies posting", () => {
  const onPost = vi.fn(),
    onAttemptPost = vi.fn();
  render(
    <PostInvoiceControl
      missing="Ask an Owner or Manager"
      disabled
      onPost={onPost}
      onAttemptPost={onAttemptPost}
    />,
  );
  const button = screen.getByRole("button", { name: "Post invoice" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onPost).not.toHaveBeenCalled();
  expect(onAttemptPost).not.toHaveBeenCalled();
});
