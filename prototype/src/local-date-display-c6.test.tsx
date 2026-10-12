import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { formatDate, formatQuantity } from "./formatters";
import { DateText, ProductName } from "./presentation";

afterEach(cleanup);

describe("store-local dates and untranslated product names", () => {
  it("uses singular quantities without rounding recorded weight precision", () => {
    expect(formatQuantity(1, "units", "en")).toBe("1 unit");
    expect(formatQuantity("1.0000", "units", "en")).toBe("1.0000 unit");
    expect(formatQuantity(2, "units", "en")).toBe("2 units");
    expect(formatQuantity("1", "cases", "en")).toBe("1 case");
    expect(formatQuantity("1.2345", "lb", "en")).toBe("1.2345 lb");
    expect(formatQuantity("1", "units", "fa")).toBe("1 واحد");
  });
  it("shows an evening Toronto receipt on its store day across UTC midnight", () => {
    expect(formatDate("2026-10-11T00:10:00.000Z", "America/Toronto")).toBe(
      "2026-10-10",
    );
  });

  it("uses the configured zone for Date objects, including winter offsets", () => {
    expect(
      formatDate(new Date("2026-01-11T03:10:00.000Z"), "America/Toronto"),
    ).toBe("2026-01-10");
    expect(formatDate("2026-10-11T00:10:00.000Z", "Asia/Tehran")).toBe(
      "2026-10-11",
    );
  });

  it("keeps invoice calendar dates independent of timezone", () => {
    expect(formatDate("2026-10-10", "America/Toronto")).toBe("2026-10-10");
    expect(formatDate("2026-10-10", "Pacific/Auckland")).toBe("2026-10-10");
    expect(formatDate(new Date("invalid"))).toBe("—");
  });

  it("uses the configured fallback when a date display has no demo provider", () => {
    render(<DateText value="2026-10-11T00:10:00.000Z" />);
    expect(screen.getByText("2026-10-10")).toHaveAttribute("dir", "ltr");
  });

  it("shows the English name once and isolates its direction when Persian is empty", () => {
    const { container } = render(
      <ProductName
        product={{ name_en: "Customer's new product", name_fa: "" }}
        language="fa"
      />,
    );
    expect(screen.getAllByText("Customer's new product")).toHaveLength(1);
    expect(screen.getByText("Customer's new product")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(container.querySelector("small")).toBeNull();
  });
});
