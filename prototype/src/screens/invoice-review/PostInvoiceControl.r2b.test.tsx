import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { PostInvoiceControl } from "./ReviewHeader";
const locale = vi.hoisted(() => ({ value: "en" }));
vi.mock("../../store", () => ({
  useDemo: () => ({
    t: (en: string, fa: string) => (locale.value === "fa" ? fa : en),
  }),
}));
afterEach(() => {
  cleanup();
  locale.value = "en";
});

const tax =
  "Tax is empty. Enter the tax from the invoice (0.00 if there is none).";
function pointer(
  element: Element,
  type: string,
  pointerType: string,
  buttons = 0,
) {
  const event = new MouseEvent(type, { bubbles: true, buttons });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(element, event);
}

it("keeps the exact single Tax reason and explains an incomplete Post without posting", async () => {
  const onPost = vi.fn(),
    onAttemptPost = vi.fn(),
    user = userEvent.setup();
  render(
    <PostInvoiceControl
      missing={tax}
      onPost={onPost}
      onAttemptPost={onAttemptPost}
    />,
  );
  const button = screen.getByRole("button", { name: "Post invoice" });
  expect(button).toBeEnabled();
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toHaveClass("button-neutral");
  await user.tab();
  expect(button).toHaveFocus();
  expect(screen.getByRole("tooltip").textContent).toBe(tax);
  await user.click(button);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(onAttemptPost).toHaveBeenCalledTimes(1);
  expect(onPost).not.toHaveBeenCalled();
});

it.each(["en", "fa"])(
  "summarizes all52 requirements and25 affected lines in %s without enumerating them",
  (language) => {
    locale.value = language;
    const prefix = language === "en" ? "Line" : "ردیف";
    const missing = [
      "Header check",
      "Tax check",
      ...Array.from({ length: 25 }, (_, index) => [
        `${prefix} ${index + 1}: Review the printed cost.`,
        `${prefix} ${index + 1}: Confirm the quantity.`,
      ]).flat(),
    ].join("\n");
    const onPost = vi.fn(),
      onAttemptPost = vi.fn();
    render(
      <PostInvoiceControl
        missing={missing}
        onPost={onPost}
        onAttemptPost={onAttemptPost}
      />,
    );
    const button = screen.getByRole("button", {
      name: language === "en" ? "Post invoice" : "ثبت فاکتور",
    });
    pointer(button, "pointermove", "mouse");
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("52");
    expect(tooltip).toHaveTextContent(
      language === "en" ? "25 lines" : "25 ردیف",
    );
    expect(tooltip).toHaveTextContent(
      language === "en"
        ? "Click Post invoice for the full What's missing list."
        : "برای دیدن فهرست کامل «موارد ناقص»، روی «ثبت فاکتور» بزنید.",
    );
    expect(tooltip.textContent!.length).toBeLessThan(180);
    expect(tooltip).not.toHaveTextContent(`${prefix} 25:`);
    fireEvent.click(button);
    expect(onAttemptPost).toHaveBeenCalledTimes(1);
    expect(onPost).not.toHaveBeenCalled();
  },
);

it("ignores compatibility hover and touch focus while retaining genuine mouse and keyboard help", async () => {
  const user = userEvent.setup();
  render(
    <PostInvoiceControl
      missing={tax}
      onPost={vi.fn()}
      onAttemptPost={vi.fn()}
    />,
  );
  const button = screen.getByRole("button", { name: "Post invoice" });
  fireEvent.mouseEnter(button);
  pointer(button, "pointerover", "mouse");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  pointer(button, "pointermove", "mouse");
  expect(screen.getByRole("tooltip")).toHaveTextContent(tax);
  pointer(button, "pointerover", "touch");
  pointer(button, "pointerdown", "touch", 1);
  button.focus();
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  pointer(button, "pointerup", "touch");
  button.blur();
  await user.tab();
  expect(button).toHaveFocus();
  expect(screen.getByRole("tooltip")).toHaveTextContent(tax);
  await user.keyboard("{Escape}");
  expect(button).toHaveFocus();
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it.each(["Ask an Owner or Manager", "Read the invoice before posting."])(
  "keeps denied or pending Post inert: %s",
  async (missing) => {
    const onPost = vi.fn(),
      onAttemptPost = vi.fn(),
      user = userEvent.setup();
    render(
      <PostInvoiceControl
        missing={missing}
        disabled
        onPost={onPost}
        onAttemptPost={onAttemptPost}
      />,
    );
    const button = screen.getByRole("button", { name: "Post invoice" });
    expect(button).toBeDisabled();
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent(missing);
    fireEvent.click(button);
    expect(onPost).not.toHaveBeenCalled();
    expect(onAttemptPost).not.toHaveBeenCalled();
  },
);

it("posts only the complete, permitted invoice", async () => {
  const onPost = vi.fn(),
    onAttemptPost = vi.fn(),
    user = userEvent.setup();
  render(
    <PostInvoiceControl
      missing=""
      onPost={onPost}
      onAttemptPost={onAttemptPost}
    />,
  );
  const button = screen.getByRole("button", { name: "Post invoice" });
  expect(button).toHaveAttribute("aria-disabled", "false");
  expect(button).toHaveClass("button-primary");
  await user.tab();
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(onPost).toHaveBeenCalledTimes(1);
  expect(onAttemptPost).not.toHaveBeenCalled();
});

it.each(["en", "fa"])(
  "never invites a multi-blocker disabled user to click Post in %s",
  (language) => {
    locale.value = language;
    const onPost = vi.fn(),
      onAttemptPost = vi.fn();
    render(
      <PostInvoiceControl
        missing={
          "Ask an Owner or Manager\nLine 1: Review quantity.\nLine 1: Check cost."
        }
        disabled
        onPost={onPost}
        onAttemptPost={onAttemptPost}
      />,
    );
    const button = screen.getByRole("button", {
      name: language === "en" ? "Post invoice" : "ثبت فاکتور",
    });
    pointer(button.parentElement!, "pointermove", "mouse");
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(
      language === "en" ? "Posting is unavailable." : "ثبت در دسترس نیست.",
    );
    expect(tooltip).not.toHaveTextContent(
      language === "en" ? "Click Post invoice" : "روی «ثبت فاکتور» بزنید",
    );
    fireEvent.click(button);
    expect(onPost).not.toHaveBeenCalled();
    expect(onAttemptPost).not.toHaveBeenCalled();
  },
);
