import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingCheckProvider, ReadingField } from "./InvoiceReadingReview";

vi.mock("./store", () => ({
  useDemo: () => ({ t: (english: string) => english }),
}));

function EditableCheck() {
  const [value, setValue] = useState("4.00");
  const [fields, setFields] = useState([
    "unit_cost_before_tax",
    "description",
    "line_total",
  ]);
  return (
    <>
      <ReadingCheckProvider
        fields={fields}
        idPrefix="test-line"
        onAcknowledge={(field) =>
          setFields((current) => current.filter((item) => item !== field))
        }
        onEdit={(field, change) => {
          change();
          setFields((current) => current.filter((item) => item !== field));
        }}
      >
        <ReadingField
          readingField="unit_cost_before_tax"
          label="Unit cost before tax"
        >
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </ReadingField>
        <ReadingField readingField="line_total" label="Line total">
          <input defaultValue="8.00" />
        </ReadingField>
        <ReadingField readingField="description" label="Description">
          <input defaultValue="Fictional" />
        </ReadingField>
      </ReadingCheckProvider>
      <button onClick={() => setFields([])}>Confirm line</button>
    </>
  );
}

describe("R1 fields needing a human check", () => {
  it("decorates the existing field and allows a full correction after its first keystroke clears the chip", async () => {
    const user = userEvent.setup();
    render(<EditableCheck />);
    const input = screen.getByLabelText("Unit cost before tax");
    expect(screen.getAllByText("?")).toHaveLength(3);
    expect(input.closest(".field")).toHaveClass("please-check-field");
    await user.clear(input);
    await user.type(input, "12.50");
    expect(screen.getByLabelText("Unit cost before tax")).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("12.50");
    expect(screen.getAllByText("?")).toHaveLength(2);
    expect(input.closest(".field")).not.toHaveClass("please-check-field");
    expect(screen.getByLabelText("Line total").closest(".field")).toHaveClass(
      "please-check-field",
    );
  });
  it("exposes the explanation without per-field buttons and keeps all fields after whole-line confirmation", async () => {
    const user = userEvent.setup();
    render(<EditableCheck />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "The AI wasn't sure about this. Compare it with the photo.",
    );
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const chip = document.querySelector(".reading-check-chip")!;
    await user.hover(chip);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Compare it with the photo.",
    );
    await user.unhover(chip);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Unit cost before tax");
    expect(
      screen.queryAllByRole("button", { name: /^Looks right/ }),
    ).toHaveLength(0);
    const total = screen.getByLabelText("Line total");
    await user.click(screen.getByRole("button", { name: "Confirm line" }));
    expect(screen.getByLabelText("Unit cost before tax")).toBe(input);
    expect(screen.getByLabelText("Line total")).toBe(total);
    expect(screen.getByLabelText("Description")).toHaveValue("Fictional");
    expect(screen.queryAllByText("?")).toHaveLength(0);
    expect(document.querySelectorAll(".please-check-field")).toHaveLength(0);
  });
});
