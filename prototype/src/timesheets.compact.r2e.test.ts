import { expect, it } from "vitest";
import { timesheetCompactHours, timesheetMinutesText } from "./timesheets";
it.each([
  [0, "0:00"],
  [480, "8:00"],
  [1290, "21:30"],
])("C13 compact operational hours %i retain minutes", (minutes, expected) => {
  expect(timesheetCompactHours(minutes)).toBe(expected);
});
it("C13 preserves bilingual paper wording separately", () => {
  expect(timesheetMinutesText(480, "fa")).toContain("ساعت");
  expect(timesheetMinutesText(480, "en")).toBe("8 h 00 m");
});
