import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataTable, TableRowAction } from "./ui";
import { allocateTableColumns } from "./c6-table-layout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

for (const width of [390, 1000, 1440]) {
  it(`uses one record-details control with independent product and secondary actions at ${width}px`, () => {
    vi.stubGlobal("innerWidth", width);
    const open = vi.fn(),
      secondary = vi.fn();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: this.classList.contains("table-wrap") ? 600 : 40,
          bottom: 44,
          width: this.classList.contains("table-wrap") ? 600 : 40,
          height: 44,
          toJSON: () => ({}),
        };
      },
    );
    const presentation = (recordDetails: boolean) => (
      <DataTable
        recordDetails={recordDetails}
        phoneList={{ name: "product", value: "price", secondary: ["actions"] }}
        columns={[
          { key: "product", required: true, minWidth: 300 },
          { key: "price", width: 160 },
          { key: "other", width: 300 },
          { key: "actions", actions: true },
        ]}
      >
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Additional facts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            data-row-href="#product?code=fictional"
            onClick={(event) => {
              if (!(event.target as Element).closest("a,button")) {
                event.preventDefault();
                open();
              }
            }}
          >
            <td>
              <a className="entity-link" href="#product?code=fictional">
                Cedarberry Jam
              </a>
            </td>
            <td>$4.49</td>
            <td>Retained extra facts</td>
            <td>
              <div className="actions">
                <button onClick={secondary}>Stop offer</button>
                <TableRowAction aria-label="Open offer" onClick={open} />
              </div>
            </td>
          </tr>
        </tbody>
      </DataTable>
    );
    const mounted = render(presentation(true));
    const row = screen.getByText("Cedarberry Jam").closest("tr")!;
    expect(row.querySelectorAll(".table-row-link")).toHaveLength(1);
    expect(
      within(row).queryByRole("button", { name: "Show details" }),
    ).not.toBeInTheDocument();
    const details = within(row).getByRole("button", { name: "Open offer" });
    if (width < 760)
      expect(details.closest("td")).toHaveClass("phone-list-chevron");
    expect(
      within(row).getByRole("link", { name: "Cedarberry Jam" }),
    ).toHaveAttribute("href", "#product?code=fictional");
    fireEvent.click(details);
    expect(open).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    fireEvent.click(within(row).getByRole("button", { name: "Stop offer" }));
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(row);
    expect(open).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe("");
    if (width >= 760) {
      mounted.rerender(presentation(false));
      const disclosure = screen.getByRole("button", { name: "Show details" });
      fireEvent.click(disclosure);
      expect(screen.getByText("Retained extra facts")).toBeVisible();
    }
  });
}
it("uses record-row space for real columns while retaining the ordinary disclosure reserve", () => {
  const columns = [
    { key: "name", required: true, width: 200, fixedWidth: true },
    { key: "status", width: 200, fixedWidth: true },
    { key: "actions", actions: true, width: 100, fixedWidth: true },
  ];
  expect(allocateTableColumns(columns, 520, false).visible).toEqual([0, 2]);
  expect(allocateTableColumns(columns, 520, false, [], false).visible).toEqual([
    0, 1, 2,
  ]);
});

it("reserves quiet next-action text beside the single record control instead of overflowing the table", () => {
  vi.stubGlobal("innerWidth", 1000);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const width = this.classList.contains("table-wrap")
        ? 600
        : this.hasAttribute("data-action-fact")
          ? 130
          : 40;
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 44,
        width,
        height: 44,
        toJSON: () => ({}),
      };
    },
  );
  render(
    <DataTable
      recordDetails
      columns={[
        { key: "name", required: true },
        { key: "actions", actions: true },
      ]}
    >
      <thead>
        <tr>
          <th>Return</th>
          <th>Next action</th>
        </tr>
      </thead>
      <tbody>
        <tr data-row-href="#returns?id=fictional">
          <td>Fictional return</td>
          <td style={{ paddingInlineStart: 12, paddingInlineEnd: 12 }}>
            <div className="actions" style={{ columnGap: 8 }}>
              <span data-action-fact>Record resolution</span>
              <TableRowAction aria-label="Open return" />
            </div>
          </td>
        </tr>
      </tbody>
    </DataTable>,
  );
  const columns = document.querySelectorAll("col");
  expect(columns).toHaveLength(2);
  expect(parseFloat((columns[1] as HTMLElement).style.width)).toBe(202);
  expect(screen.getByRole("button", { name: "Open return" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Show details" }),
  ).not.toBeInTheDocument();
});
