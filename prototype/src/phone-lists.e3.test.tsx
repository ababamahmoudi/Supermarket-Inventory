import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Checkbox, DataTable, TableRowLink } from "./ui";
const originalWidth = window.innerWidth;
afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: originalWidth,
  });
  window.location.hash = "";
});
function Presentation({
  selected = false,
  hidePrice = false,
}: {
  selected?: boolean;
  hidePrice?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <DataTable
      phoneList={{
        name: "name",
        value: "price",
        secondary: ["code", "secret"],
        selection: selected ? "selection" : undefined,
      }}
      columns={[
        ...(selected ? [{ key: "selection", required: true, width: 48 }] : []),
        { key: "name", required: true },
        { key: "price", hidden: hidePrice },
        { key: "code" },
        { key: "secret", hidden: true },
        { key: "actions", actions: true },
      ]}
    >
      <thead>
        <tr>
          {selected && <th>Select</th>}
          <th>Product</th>
          <th>Price</th>
          <th>Code</th>
          <th>Private field</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr data-row-href="#product?code=0009">
          {selected && (
            <td>
              <Checkbox
                checked={checked}
                onChange={setChecked}
                aria-label="Select product 0009"
              />
            </td>
          )}
          <td>
            <strong>Black Tea 450 g</strong>
            <small>چای سیاه</small>
          </td>
          <td>$6.99</td>
          <td>0009</td>
          <td>Never reveal private value</td>
          <td>
            <TableRowLink
              href="#product?code=0009"
              aria-label="Open Black Tea"
            />
          </td>
        </tr>
      </tbody>
    </DataTable>
  );
}
for (const width of [390, 430, 760]) {
  it(`renders one compact row with bilingual identity, right-side price and single route chevron at ${width}`, () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    render(<Presentation />);
    const row = document.querySelector(".phone-list-row")!;
    expect(row).not.toBeNull();
    expect(row.querySelector(".phone-list-name")).toHaveTextContent(
      "Black Tea 450 gچای سیاه",
    );
    expect(row.querySelector(".phone-list-value")).toHaveTextContent("$6.99");
    expect(row.querySelector(".phone-list-secondary")).toHaveTextContent(
      "0009",
    );
    expect(within(row as HTMLElement).getAllByRole("link")).toHaveLength(1);
    expect(
      within(row as HTMLElement).queryByRole("button", {
        name: "Show details",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Never reveal private value"),
    ).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(window.location.hash).toBe("#product?code=0009");
  });
}
it("keeps label selection independent from tapping the record, with one checkbox and one chevron", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  render(<Presentation selected />);
  const checkbox = screen.getByRole("checkbox", {
    name: "Select product 0009",
  });
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(window.location.hash).toBe("");
  const row = document.querySelector(".phone-list-row")!;
  expect(row.querySelector(".phone-list-selection")).toContainElement(checkbox);
  fireEvent.keyDown(row, { key: "Enter" });
  expect(window.location.hash).toBe("#product?code=0009");
});
it("honors user-hidden columns and preserves desktop table presentation", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  const mounted = render(<Presentation hidePrice />);
  expect(screen.queryByText("$6.99")).not.toBeInTheDocument();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1440,
  });
  fireEvent(window, new Event("resize"));
  expect(document.querySelector(".phone-list-row")).toBeNull();
  expect(screen.getByRole("table")).toBeInTheDocument();
  mounted.unmount();
});
