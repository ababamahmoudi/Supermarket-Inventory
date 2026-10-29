import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InvoiceReadDTO } from "../../invoice-projections";
import type { InvoiceChargeField } from "../../invoice-other-charges";
import { OtherChargesEditor } from "./OtherChargesEditor";
import { initialState } from "../../e1-bootstrap";

const locale = vi.hoisted(() => ({ language: "en" as "en" | "fa" }));
vi.mock("../../store", () => ({
  useDemo: () => ({
    t: (en: string, fa: string) => (locale.language === "fa" ? fa : en),
    state: { config: { company: { currency: "CAD" } } },
  }),
}));
afterEach(() => {
  cleanup();
  locale.language = "en";
});

it.each(["en", "fa"] as const)(
  "edits the single inline fields, toggles tax and removes a charge in %s",
  async (language) => {
    locale.language = language;
    const user = userEvent.setup();
    const edits = vi.fn();
    const removals = vi.fn();
    function Editor() {
      const [invoice, setInvoice] = useState(() => ({
        ...initialState().invoice,
        other_charges: [
          {
            line_type: "fee" as const,
            description: "Fictional delivery",
            amount: "5.00",
            taxable: true,
            low_confidence_fields: ["description", "taxable"],
          },
          {
            line_type: "credit" as const,
            description: "Fictional credit",
            amount: "-1.20",
            taxable: false,
            low_confidence_fields: [] as string[],
          },
        ],
      }));
      return (
        <OtherChargesEditor
          invoice={invoice as unknown as InvoiceReadDTO}
          onEdit={(index, field: InvoiceChargeField, value) => {
            edits(index, field, value);
            setInvoice((current) => ({
              ...current,
              other_charges: current.other_charges.map((charge, i) =>
                i === index
                  ? {
                      ...charge,
                      ...(field === "description"
                        ? { description: value }
                        : field === "line_total"
                          ? { amount: value }
                          : { taxable: value === "true" }),
                      low_confidence_fields:
                        charge.low_confidence_fields.filter(
                          (key) => key !== field,
                        ),
                    }
                  : charge,
              ),
            }));
          }}
          onRemove={(index) => {
            removals(index);
            setInvoice((current) => ({
              ...current,
              other_charges: current.other_charges.filter(
                (_, i) => i !== index,
              ),
            }));
          }}
        />
      );
    }
    render(<Editor />);
    expect(document.querySelectorAll(".receiving-charge")).toHaveLength(2);
    expect(document.querySelectorAll("#invoice-charge-editor")).toHaveLength(0);
    const description = screen.getByLabelText(
      language === "en" ? "Charge 1 description" : "شرح هزینه 1",
    );
    expect(description.closest(".field")).toHaveClass("please-check-field");
    await user.clear(description);
    await user.type(description, "Fictional freight");
    expect(
      screen.getByLabelText(
        language === "en" ? "Charge 1 description" : "شرح هزینه 1",
      ),
    ).toBe(description);
    expect(description).toHaveFocus();
    expect(description).toHaveValue("Fictional freight");
    expect(description.closest(".field")).not.toHaveClass("please-check-field");
    expect(edits).toHaveBeenLastCalledWith(
      0,
      "description",
      "Fictional freight",
    );
    const tax = screen.getByRole("group", {
      name: language === "en" ? "Charge 1 tax" : "مالیات هزینه 1",
    });
    const noTax = within(tax).getByRole("button", {
      name: language === "en" ? "No tax" : "بدون مالیات",
    });
    await user.click(noTax);
    expect(noTax).toHaveAttribute("aria-pressed", "true");
    expect(edits).toHaveBeenLastCalledWith(0, "taxable", "false");
    const amount = screen.getByLabelText(
      language === "en" ? "Charge 2 amount" : "مبلغ هزینه 2",
    );
    await user.clear(amount);
    await user.type(amount, "-2.35");
    expect(amount).toHaveValue("-2.35");
    expect(edits).toHaveBeenLastCalledWith(1, "line_total", "-2.35");
    await user.click(
      screen.getByRole("button", {
        name: language === "en" ? "Remove charge 1" : "حذف هزینه 1",
      }),
    );
    expect(removals).toHaveBeenLastCalledWith(0);
    expect(screen.getByDisplayValue("Fictional credit")).toBeInTheDocument();
    expect(screen.getByDisplayValue("-2.35")).toBeInTheDocument();
    expect(document.querySelectorAll(".receiving-charge")).toHaveLength(1);
  },
);

it("keeps the unused charges section absent without inventing a row", () => {
  render(
    <OtherChargesEditor
      invoice={
        {
          ...initialState().invoice,
          other_charges: [],
        } as unknown as InvoiceReadDTO
      }
      onEdit={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
