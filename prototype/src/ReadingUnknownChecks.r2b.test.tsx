import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  ReadingCheckProvider,
  ReadingUnknownChecks,
} from "./InvoiceReadingReview";
import { invoiceCheckTarget } from "./screens/invoice-review/review-attention";
vi.mock("./store", () => ({ useDemo: () => ({ t: (en: string) => en }) }));
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
