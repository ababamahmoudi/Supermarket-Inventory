import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button, FilterChip, FilterToolbar, Tabs } from "./ui";

describe("C9 shared list controls", () => {
  it("keeps segments before search and the count beside trailing actions", () => {
    render(
      <FilterToolbar
        leading={
          <Tabs
            value="open"
            onChange={() => {}}
            showZeroCounts
            options={[
              { value: "open", label: "Open", count: 0 },
              { value: "done", label: "Done", count: 2 },
            ]}
          />
        }
        search={<input aria-label="Find records" />}
        count="2 records"
        actions={<Button>Columns</Button>}
      />,
    );
    const tabs = screen.getByRole("tablist");
    expect(screen.getByRole("tab", { name: "Open 0" })).toHaveTextContent("0");
    expect(
      tabs.compareDocumentPosition(screen.getByLabelText("Find records")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("2 records").closest(".filter-toolbar-trailing"),
    ).toContainElement(screen.getByRole("button", { name: "Columns" }));
  });
  it("changes a filter chip with the keyboard and exposes its selected state", async () => {
    function Example() {
      const [checked, setChecked] = useState(false);
      return (
        <FilterChip checked={checked} onChange={setChecked}>
          On sale
        </FilterChip>
      );
    }
    render(<Example />);
    const chip = screen.getByRole("button", {
      name: "On sale",
      pressed: false,
    });
    expect(chip).toHaveTextContent("On sale");
    expect(chip.querySelector(".filter-chip-check, svg")).toBeNull();
    chip.focus();
    await userEvent.keyboard(" ");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Enter}");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip.querySelector(".filter-chip-check, svg")).toBeNull();
    expect(chip).toHaveTextContent("On sale");
  });
});
