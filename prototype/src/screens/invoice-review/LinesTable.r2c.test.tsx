import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LinesTable } from "./LinesTable";
import type { ReviewProps } from "./types";
const pending = vi.hoisted(() => ({
  settle: undefined as undefined | ((ok: boolean) => void),
}));
vi.mock("../../store", () => ({
  useDemo: () => ({
    state: {
      products: [],
      config: {
        company: { currency: "CAD" },
        pricing_categories: [{ key: "grocery", label: "Grocery" }],
      },
    },
    t: (en: string) => en,
    tCount: (
      one: string,
      many: string,
      _faOne: string,
      _faMany: string,
      count: number,
    ) => (count === 1 ? one : many).replace("{{count}}", String(count)),
    lang: "en",
  }),
}));
vi.mock("../../InvoiceReadingReview", () => ({
  ReadingMoney: ({ value }: { value: string }) => <>{value}</>,
}));
vi.mock("./LineEditor", () => ({
  LineEditor: ({
    onConfirmationStart,
  }: {
    onConfirmationStart?(): (ok: boolean) => void;
  }) => (
    <button
      onClick={() => {
        pending.settle = onConfirmationStart?.();
      }}
    >
      Confirm line
    </button>
  ),
}));
const invoice = {
  company_id: "market",
  lines: [0, 1].map((i) => ({
    id: `line-${i}`,
    description: `Invented item ${i}`,
    new_name_en: `Invented item ${i}`,
    product_code: "NEW",
    pricing_category: "grocery",
    qty_invoiced: 2,
    qty_received_at_posting: 2,
    unit_cost_before_tax: "1.0000",
    line_total: "2.00",
    review_confirmed: false,
    low_confidence_fields: ["description"],
  })),
} as unknown as ReviewProps["invoice"];
function Harness() {
  const [openLine, setOpen] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<ReadonlySet<string>>(new Set());
  return (
    <LinesTable
      invoice={invoice}
      workspace={{} as ReviewProps["workspace"]}
      update={async () => undefined}
      editLine={() => {}}
      onQuantity={() => {}}
      openLine={openLine}
      onOpen={setOpen}
      anchor={() => {}}
      attemptedPost={false}
      optimisticConfirmed={optimistic}
      onOptimisticConfirmation={(id, ok) =>
        setOptimistic((current) => {
          const next = new Set(current);
          if (ok) next.add(id);
          else next.delete(id);
          return next;
        })
      }
    />
  );
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  pending.settle = undefined;
});
it("updates counts immediately, removes a confirmed attention row before save, and focuses the next row", async () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /Needs attention/ }));
  fireEvent.click(screen.getByTestId("invoice-line-row-0"));
  fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
  expect(
    within(screen.getByRole("button", { name: /Needs attention/ })).getByText(
      "1",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("button", { name: /Confirmed/ })).getByText("1"),
  ).toBeVisible();
  // No server acknowledgment has been delivered; the presentation already moved.
  await act(async () => {
    vi.advanceTimersByTime(150);
  });
  expect(screen.queryByTestId("invoice-line-row-0")).not.toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(30);
  });
  expect(screen.getByTestId("invoice-line-row-1")).toHaveFocus();
  act(() => pending.settle?.(true));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("restores a failed row, its attention count and an actionable error after it faded", async () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /Needs attention/ }));
  fireEvent.click(screen.getByTestId("invoice-line-row-0"));
  fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
  await act(async () => {
    vi.advanceTimersByTime(150);
  });
  act(() => pending.settle?.(false));
  expect(screen.getByTestId("invoice-line-row-0")).toBeVisible();
  expect(
    within(screen.getByRole("button", { name: /Needs attention/ })).getByText(
      "2",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("button", { name: /Confirmed/ })).getByText("0"),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "It still needs attention. Try confirming again.",
  );
  expect(screen.getByRole("button", { name: "Confirm line" })).toBeVisible();
});

it("does not steal focus or close a different line opened during the confirmation fade", async () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.click(screen.getByTestId("invoice-line-row-0"));
  fireEvent.click(screen.getByRole("button", { name: "Confirm line" }));
  fireEvent.click(screen.getByTestId("invoice-line-row-1"));
  const next = screen.getByRole("button", { name: "Confirm line" });
  next.focus();
  await act(async () => {
    vi.advanceTimersByTime(180);
  });
  expect(screen.getByTestId("invoice-line-row-1")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(next).toHaveFocus();
});
