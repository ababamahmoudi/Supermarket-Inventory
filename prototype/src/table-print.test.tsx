import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DataTable } from "./ui";

let printMatches = false;
let printMedia: MediaQueryList;

beforeEach(() => {
  vi.stubGlobal("innerWidth", 390);
  printMatches = false;
  printMedia = new EventTarget() as MediaQueryList;
  Object.defineProperties(printMedia, {
    matches: { get: () => printMatches },
    media: { value: "print" },
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => printMedia),
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.classList.contains("ui-data-table") ? 358 : 36,
        height: 36,
      } as DOMRect;
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ledger() {
  return (
    <DataTable
      className="payables-ledger-table"
      columns={[
        { key: "date", label: "Date", required: true, priority: 1 },
        { key: "reference", label: "Reference", required: true, priority: 2 },
        { key: "amount", label: "Amount", priority: 3, align: "end" },
        { key: "cheque", label: "Cheque / payment date", priority: 8 },
        { key: "optional", label: "Optional note", hidden: true, priority: 9 },
      ]}
    >
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference</th>
          <th>Amount</th>
          <th>Cheque / payment date</th>
          <th>Optional note</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>2026-10-15</td>
          <td>DEMO-PAY-001</td>
          <td>-$50.00</td>
          <td>DEMO-1001</td>
          <td>Hidden optional column</td>
        </tr>
      </tbody>
    </DataTable>
  );
}

function changePrintMedia(matches: boolean) {
  printMatches = matches;
  const event = new Event("change");
  Object.defineProperty(event, "matches", { value: matches });
  act(() => printMedia.dispatchEvent(event));
}

it("includes the retained cheque and exact payment synchronously before native printing, then restores the phone columns", () => {
  const view = render(ledger());
  const table = view.container.querySelector(".ui-data-table")!;
  expect(table).toHaveClass("is-mobile", "is-responsive");
  expect(screen.queryByText("DEMO-1001")).not.toBeInTheDocument();
  expect(screen.getByText("-$50.00")).toBeInTheDocument();
  let retainedAtPrintBoundary = false;
  act(() => {
    window.dispatchEvent(new Event("beforeprint"));
    // A browser may capture the document as soon as this event returns.
    retainedAtPrintBoundary =
      view.container.querySelector('td[data-column-key="cheque"]')
        ?.textContent === "DEMO-1001";
  });
  expect(retainedAtPrintBoundary).toBe(true);
  expect(table).toHaveClass("is-printing");
  expect(table).not.toHaveClass("is-mobile", "is-responsive");
  expect(
    [...view.container.querySelectorAll("tbody tr:first-child > td")].map(
      (cell) => cell.textContent,
    ),
  ).toEqual(["2026-10-15", "DEMO-PAY-001", "-$50.00", "DEMO-1001"]);
  expect(screen.queryByText("Hidden optional column")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show details" })).toBeNull();
  for (const column of view.container.querySelectorAll("col"))
    expect(column.style.width).toBe("");
  act(() => window.dispatchEvent(new Event("afterprint")));
  expect(table).toHaveClass("is-mobile", "is-responsive");
  expect(table).not.toHaveClass("is-printing");
  expect(screen.queryByText("DEMO-1001")).not.toBeInTheDocument();
  expect(screen.getByText("-$50.00")).toBeInTheDocument();
  expect(screen.queryByText("Hidden optional column")).not.toBeInTheDocument();
});

it("responds to real print media changes without losing an expanded screen row", () => {
  const view = render(ledger());
  fireEvent.click(screen.getByRole("button", { name: "Show details" }));
  expect(screen.getByText("DEMO-1001", { selector: "dd" })).toBeInTheDocument();
  changePrintMedia(true);
  expect(screen.getByText("DEMO-1001", { selector: "td" })).toBeInTheDocument();
  expect(screen.getByText("-$50.00", { selector: "td" })).toBeInTheDocument();
  expect(view.container.querySelector(".table-expanded-row")).toBeNull();
  expect(screen.queryByText("Hidden optional column")).not.toBeInTheDocument();
  changePrintMedia(false);
  expect(screen.getByRole("button", { name: "Hide details" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByText("DEMO-1001", { selector: "dd" })).toBeInTheDocument();
  expect(screen.getByText("-$50.00", { selector: "td" })).toBeInTheDocument();
});

it("removes print lifecycle and media subscriptions when the table is unmounted", () => {
  const removeWindow = vi.spyOn(window, "removeEventListener");
  const removeMedia = vi.spyOn(printMedia, "removeEventListener");
  const view = render(ledger());
  view.unmount();
  expect(removeWindow).toHaveBeenCalledWith(
    "beforeprint",
    expect.any(Function),
  );
  expect(removeWindow).toHaveBeenCalledWith("afterprint", expect.any(Function));
  expect(removeMedia).toHaveBeenCalledWith("change", expect.any(Function));
});
