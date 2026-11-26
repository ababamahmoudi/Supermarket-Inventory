import { useState } from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingCheckProvider, ReadingField } from "./InvoiceReadingReview";

vi.mock("./store", () => ({
  useDemo: () => ({ t: (english: string) => english }),
}));

/** PR 29 (Ali, 2026-11-20): the amber ! opens Looks right for one field. */
function FieldChecks({
  onAcknowledge,
}: {
  onAcknowledge(field: string): void;
}) {
  const [fields, setFields] = useState(["supplier_invoice_number", "due_date"]);
  return (
    <ReadingCheckProvider
      fields={fields}
      idPrefix="pr29"
      fieldLooksRight
      onAcknowledge={(field) => {
        onAcknowledge(field);
        setFields((current) => current.filter((item) => item !== field));
      }}
    >
      <ReadingField
        readingField="supplier_invoice_number"
        label="Invoice number"
      >
        <input id="pr29-number" defaultValue="FV-1" />
      </ReadingField>
      <ReadingField readingField="due_date" label="Due date">
        <input id="pr29-due" defaultValue="2026-12-18" />
      </ReadingField>
      <span data-testid="count">{fields.length}</span>
    </ReadingCheckProvider>
  );
}

it("clears only the tapped field from its popover", async () => {
  const user = userEvent.setup();
  const acknowledged: string[] = [];
  render(<FieldChecks onAcknowledge={(field) => acknowledged.push(field)} />);
  const markers = screen.getAllByRole("button", {
    name: "Check this against the original",
  });
  expect(markers).toHaveLength(2);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(markers[0]);
  const popover = screen.getByRole("dialog", { name: "Check Invoice number" });
  expect(markers[0]).toHaveAttribute("aria-expanded", "true");
  expect(popover).toHaveTextContent("Compare it with the photo.");
  await user.click(
    screen.getByRole("button", { name: "Looks right: Invoice number" }),
  );
  expect(acknowledged).toEqual(["supplier_invoice_number"]);
  expect(screen.getByTestId("count")).toHaveTextContent("1");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: "Check this against the original" }),
  ).toHaveLength(1);
  expect(document.querySelector("#pr29-due")!.closest(".field")).toHaveClass(
    "please-check-field",
  );
});

it("Change focuses the field and Escape closes without clearing", async () => {
  const user = userEvent.setup();
  const acknowledged: string[] = [];
  render(<FieldChecks onAcknowledge={(field) => acknowledged.push(field)} />);
  const [, due] = screen.getAllByRole("button", {
    name: "Check this against the original",
  });
  await user.click(due);
  await user.click(screen.getByRole("button", { name: "Change" }));
  expect(document.querySelector("#pr29-due")).toHaveFocus();
  await user.click(due);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(acknowledged).toEqual([]);
});
