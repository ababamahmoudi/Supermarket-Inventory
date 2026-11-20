import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummaryTile } from "./SummaryTile";
describe("shared R2c summary tile", () => {
  it("opens only when it has a destination and keeps a muted zero", () => {
    const open = vi.fn();
    const view = render(
      <SummaryTile
        label="Open alerts"
        value={0}
        detail="No open alerts"
        tone="approved"
        onClick={open}
      />,
    );
    const button = screen.getByRole("button", { name: "Open alerts: 0" });
    expect(button).toHaveClass("is-zero");
    fireEvent.click(button);
    expect(open).toHaveBeenCalledTimes(1);
    view.rerender(
      <SummaryTile
        label="Balance"
        value="$12.34"
        detail="No overdue invoices"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(view.container.querySelector(".kpi-arrow")).toBeNull();
    expect(screen.getByText("$12.34")).toBeVisible();
  });
});
