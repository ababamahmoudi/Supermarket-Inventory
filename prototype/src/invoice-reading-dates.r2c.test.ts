import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { companyDateTime, companyTimestampText } from "./company-time";
import { importedReadingReceived } from "./invoice-reading-dates";

describe("R2c 0.7 delivery time interpretation", () => {
  it.each(["en", "fa"] as const)(
    "formats %s timestamps with a 24-hour Western-digit clock",
    () => {
      const { config } = initialState();
      config.company.timezone = "UTC";
      expect(companyTimestampText(config, "2026-08-11T14:15:00Z")).toBe(
        "2026-08-11 14:15",
      );
      expect(companyTimestampText(config, "2026-08-11T01:15:00Z")).toBe(
        "2026-08-11 01:15",
      );
    },
  );
  it.each([1, 2, 3, 4, 5, 6])(
    "reads unqualified %s in the afternoon and retains the other choice",
    (hour) => {
      const { config } = initialState();
      const result = importedReadingReceived(config, {
        invoice_date: "2026-08-10",
        handwritten_notes: [`Aug 11 ${hour}:15`],
      });
      expect(companyDateTime(config, result.received_at)).toEqual({
        date: "2026-08-11",
        time: `${hour + 12}:15`,
      });
      expect(companyDateTime(config, result.alternative_received_at).time).toBe(
        `0${hour}:15`,
      );
      expect(result.source).toBe("handwriting");
    },
  );
  it.each([
    ["2:15 am", "02:15"],
    ["2:15 pm", "14:15"],
    ["13:15", "13:15"],
    ["23:15", "23:15"],
    ["07:15", "07:15"],
  ])("honours explicit %s", (written, clock) => {
    const { config } = initialState();
    const result = importedReadingReceived(config, {
      invoice_date: "2026-08-10",
      handwritten_notes: [`Aug 11 ${written}`],
    });
    expect(companyDateTime(config, result.received_at).time).toBe(clock);
    expect(result.alternative_received_at).toBeUndefined();
  });
  it("uses configurable delivery expectations and never consults opening hours", () => {
    const { config } = initialState();
    config.invoices.delivery_window = { start: "00:00", end: "05:00" };
    config.branches[0].opening_hours = "Open 24 hours";
    const result = importedReadingReceived(config, {
      invoice_date: "2026-08-10",
      handwritten_notes: ["Aug 11 2:15"],
    });
    expect(companyDateTime(config, result.received_at).time).toBe("02:15");
    expect(companyDateTime(config, result.alternative_received_at).time).toBe(
      "14:15",
    );
  });
});
