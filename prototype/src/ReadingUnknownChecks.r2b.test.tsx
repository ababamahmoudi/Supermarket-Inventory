import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ReadingCheckProvider,
  ReadingUnknownChecks,
} from "./InvoiceReadingReview";
import { invoiceCheckTarget } from "./screens/invoice-review/review-attention";
vi.mock("./store", () => ({ useDemo: () => ({ t: (en: string) => en }) }));
afterEach(cleanup);
it.each([
  {
    field: "handwritten_notes",
    prefix: "invoice-check-header",
    record: { import_handwritten_notes: ["Invented receiving note"] },
    label: "Handwritten notes",
    line: undefined,
  },
  {
    field: "pack_size",
    prefix: "invoice-check-line-0",
    record: { pack_size: "Box of 12 x 454g" },
    label: "Pack description",
    line: 0,
  },
])(
  "renders a safe focus target for $field using public review values",
  ({ field, prefix, record, label, line }) => {
    render(
      <ReadingCheckProvider
        fields={[field]}
        idPrefix={prefix}
        onAcknowledge={() => {}}
      >
        <ReadingUnknownChecks fields={[field]} known={[]} record={record} />
      </ReadingCheckProvider>,
    );
    const input = screen.getByRole("textbox", { name: label });
    expect(input).toHaveAttribute("id", invoiceCheckTarget(field, line));
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveValue(
      field === "pack_size" ? "Box of 12 x 454g" : "Invented receiving note",
    );
  },
);

it("never renders a raw reading key in text, labels or help (R2c0.6)", () => {
  const fields = [
    "branch_hint",
    "private_reader_key",
    "pack_size",
    "delivery_reference",
  ];
  const { container } = render(
    <ReadingCheckProvider
      fields={fields}
      idPrefix="safe-labels"
      onAcknowledge={() => {}}
    >
      <ReadingUnknownChecks
        fields={fields}
        known={[]}
        record={{
          branch_hint: "Internal suggested destination",
          private_reader_key: "Internal metadata",
          pack_size: "12 x 500g",
          delivery_reference: "FICTIONAL-REF",
        }}
      />
    </ReadingCheckProvider>,
  );
  expect(screen.getByRole("textbox", { name: "Pack description" })).toHaveValue(
    "12 x 500g",
  );
  expect(
    screen.getByRole("textbox", { name: "Delivery reference" }),
  ).toHaveValue("FICTIONAL-REF");
  expect(container.textContent).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/);
  for (const node of container.querySelectorAll("[aria-label], [title]"))
    expect(
      `${node.getAttribute("aria-label") ?? ""} ${node.getAttribute("title") ?? ""}`,
    ).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/);
  expect(
    screen.queryByDisplayValue("Internal suggested destination"),
  ).not.toBeInTheDocument();
});
