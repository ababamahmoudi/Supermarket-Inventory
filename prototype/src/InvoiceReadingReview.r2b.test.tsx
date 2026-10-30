import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingCheckProvider, ReadingField } from "./InvoiceReadingReview";

const locale = vi.hoisted(() => ({ language: "en" as "en" | "fa" }));
vi.mock("./store", () => ({
  useDemo: () => ({
    t: (en: string, fa: string) => (locale.language === "en" ? en : fa),
  }),
}));
afterEach(() => {
  cleanup();
  locale.language = "en";
});

function OptionalReview() {
  const [fields, setFields] = useState([
    "supplier_tax_number",
    "barcode",
    "supplier_invoice_number",
  ]);
  const [tax, setTax] = useState("");
  return (
    <ReadingCheckProvider
      fields={fields}
      record={{
        supplier_tax_number: tax,
        barcode: "9785550001123",
        supplier_invoice_number: "",
      }}
      idPrefix="optional-test"
      onAcknowledge={() => {}}
      onNotOnInvoice={(field) => {
        setFields((current) => current.filter((key) => key !== field));
        return true;
      }}
    >
      <ReadingField
        readingField="supplier_tax_number"
        label="Supplier tax number (optional)"
      >
        <input value={tax} onChange={(event) => setTax(event.target.value)} />
      </ReadingField>
      <ReadingField readingField="barcode" label="Barcode">
        <input defaultValue="9785550001123" />
      </ReadingField>
      <ReadingField
        readingField="supplier_invoice_number"
        label="Invoice number"
      >
        <input defaultValue="" />
      </ReadingField>
    </ReadingCheckProvider>
  );
}

it.each(["en", "fa"] as const)(
  "offers absence only for an explicitly flagged empty optional field in %s and preserves its input",
  async (language) => {
    locale.language = language;
    const user = userEvent.setup();
    render(<OptionalReview />);
    const input = screen.getByLabelText("Supplier tax number (optional)");
    const actions = screen.getAllByRole("button", {
      name: language === "en" ? /^Not on the invoice:/ : /^در فاکتور نیست:/,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveClass("button-label-action");
    expect(actions[0]).toHaveAttribute("data-control-kind", "label-action");
    expect(input.closest(".field")).toHaveClass("please-check-field");
    await user.click(actions[0]);
    expect(screen.getByLabelText("Supplier tax number (optional)")).toBe(input);
    expect(input).toHaveValue("");
    expect(input.closest(".field")).not.toHaveClass("please-check-field");
    expect(actions[0]).toBeDisabled();
    expect(document.querySelectorAll(".reading-check-marker")).toHaveLength(2);
    await user.type(input, "TAX-FAKE");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("TAX-FAKE");
    expect(
      screen.queryByRole("button", {
        name: language === "en" ? /^Not on the invoice:/ : /^در فاکتور نیست:/,
      }),
    ).not.toBeInTheDocument();
  },
);
