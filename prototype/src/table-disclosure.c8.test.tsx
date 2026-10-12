import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DemoProvider } from "./store";
import { Button, DataTable, TableRowLink } from "./ui";

function boundedWidth(width = 460) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.classList.contains("ui-data-table")
          ? width
          : this.classList.contains("ui-button") ||
              this.classList.contains("table-row-link")
            ? 36
            : 0,
        height: 36,
      } as DOMRect;
    },
  );
}
afterEach(() => vi.restoreAllMocks());
it("places the omitted-column expander at the row end, keeps name text untouched and exposes all omitted permitted facts, including a Columns preference", () => {
  boundedWidth();
  render(
    <DemoProvider>
      <DataTable
        columns={[
          {
            key: "product",
            label: "Product",
            required: true,
            minWidth: 240,
            priority: 1,
          },
          { key: "code", label: "Product Code", minWidth: 140, priority: 2 },
          { key: "supplier", label: "Supplier", minWidth: 240, priority: 4 },
          { key: "private", label: "Optional note", hidden: true },
        ]}
      >
        <thead>
          <tr>
            <th>Product</th>
            <th>Product Code</th>
            <th>Supplier</th>
            <th>Optional note</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Actual product name</td>
            <td>0001</td>
            <td>Actual supplier</td>
            <td>Optional note evidence</td>
          </tr>
        </tbody>
      </DataTable>
    </DemoProvider>,
  );
  const row = screen.getByText("Actual product name").closest("tr")!;
  const toggle = within(row).getByRole("button", { name: "Show details" });
  expect(toggle.closest("td")).toBe(row.lastElementChild);
  expect(row.firstElementChild).toHaveTextContent("Actual product name");
  expect(row.firstElementChild?.querySelector("button")).toBeNull();
  expect(screen.queryByText("Optional note evidence")).not.toBeInTheDocument();
  toggle.focus();
  fireEvent.click(toggle);
  expect(toggle).toHaveFocus();
  const detail = document.getElementById(
    toggle.getAttribute("aria-controls")!,
  )!;
  expect(detail).toHaveTextContent("SupplierActual supplier");
  expect(detail).toHaveTextContent("Optional note evidence");
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(detail.querySelector("td")?.colSpan).toBe(row.children.length);
});
it("adds no separate disclosure when every permitted column fits", () => {
  boundedWidth(1000);
  render(
    <DemoProvider>
      <DataTable
        columns={[
          { key: "product", label: "Product", required: true, minWidth: 240 },
          { key: "code", label: "Code", minWidth: 100 },
        ]}
      >
        <thead>
          <tr>
            <th>Product</th>
            <th>Code</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Visible name</td>
            <td>0001</td>
          </tr>
        </tbody>
      </DataTable>
    </DemoProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Show details" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("row").map((row) => row.children.length)).toEqual([
    2, 2,
  ]);
});
it("uses the existing final action group for a conditional expander and preserves row-link and Enter navigation", () => {
  boundedWidth(500);
  render(
    <DemoProvider>
      <DataTable
        columns={[
          {
            key: "product",
            label: "Product",
            required: true,
            minWidth: 240,
            priority: 1,
          },
          { key: "supplier", label: "Supplier", minWidth: 240, priority: 4 },
          { key: "actions", label: "Details", actions: true },
        ]}
      >
        <thead>
          <tr>
            <th>Product</th>
            <th>Supplier</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr data-row-href="#product?code=0001">
            <td>Name</td>
            <td>Supplier</td>
            <td>
              <div className="actions">
                <Button size="sm" variant="neutral">
                  Edit
                </Button>
                <TableRowLink
                  href="#product?code=0001"
                  aria-label="Open name"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </DataTable>
    </DemoProvider>,
  );
  const row = screen.getByText("Name").closest("tr")!;
  const end = row.lastElementChild!;
  expect(
    within(end as HTMLElement).getByRole("link", { name: "Open name" }),
  ).toBeInTheDocument();
  const toggle = within(row).getByRole("button", { name: "Show details" });
  expect(toggle.closest(".actions")).toBe(end.firstElementChild);
  fireEvent.click(toggle);
  expect(window.location.hash).not.toBe("#product?code=0001");
  expect(screen.getByText("Supplier", { selector: "dd" })).toBeVisible();
  act(() =>
    fireEvent.keyDown(screen.getByText("Name").closest("tr")!, {
      key: "Enter",
    }),
  );
  expect(window.location.hash).toBe("#product?code=0001");
});
