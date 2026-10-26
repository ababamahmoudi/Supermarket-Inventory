import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ReadingCheckProvider,
  ReadingField,
  ReadingUnknownChecks,
} from "./InvoiceReadingReview";
const locale = vi.hoisted(() => ({ language: "en" as "en" | "fa" }));

vi.mock("./store", () => ({
  useDemo: () => ({
    t: (english: string, persian: string) =>
      locale.language === "fa" ? persian : english,
  }),
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
        <ReadingField
          readingField="line_total"
          label="Line total"
          labelAdornment={<span>Calculated</span>}
        >
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
  it("decorates the existing field and allows a full correction after its first keystroke clears the marker", async () => {
    const user = userEvent.setup();
    render(<EditableCheck />);
    const input = screen.getByLabelText("Unit cost before tax");
    expect(
      screen.getAllByRole("img", { name: "Check this against the original" }),
    ).toHaveLength(3);
    expect(input.closest(".field")).toHaveClass("please-check-field");
    await user.clear(input);
    await user.type(input, "12.50");
    expect(screen.getByLabelText("Unit cost before tax")).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("12.50");
    expect(
      screen.getAllByRole("img", { name: "Check this against the original" }),
    ).toHaveLength(2);
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
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "The AI wasn't sure about this. Compare it with the photo.",
    );
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const marker = screen.getAllByRole("img", {
      name: "Check this against the original",
    })[0];
    await user.hover(marker);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Compare it with the photo.",
    );
    await user.unhover(marker);
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
    expect(screen.getByText("Calculated")).toBeInTheDocument();
    expect(
      screen.queryAllByRole("img", { name: "Check this against the original" }),
    ).toHaveLength(0);
    expect(document.querySelectorAll(".please-check-field")).toHaveLength(0);
  });
});

it("localizes a retained delivery-reference reading without exposing an internal key", () => {
  locale.language = "fa";
  try {
    render(
      <ReadingCheckProvider
        fields={["delivery_reference"]}
        idPrefix="unknown-field"
        onAcknowledge={vi.fn()}
      >
        <ReadingUnknownChecks
          fields={["delivery_reference"]}
          known={[]}
          record={{ delivery_reference: "LOT-FICTIONAL-025" }}
        />
      </ReadingCheckProvider>,
    );
    const input = screen.getByRole("textbox", { name: "مرجع تحویل" });
    expect(input).toHaveValue("LOT-FICTIONAL-025");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAccessibleDescription(
      "این خوانش را با اصل فاکتور مقایسه کنید، سپس ردیف یا درست است را تأیید کنید.",
    );
    expect(screen.queryByText("delivery_reference")).not.toBeInTheDocument();
    expect(input.closest(".field")).toHaveClass("please-check-field");
    expect(
      screen.getByRole("img", { name: "با اصل فاکتور بررسی کنید" }),
    ).toBeInTheDocument();
  } finally {
    locale.language = "en";
  }
});
