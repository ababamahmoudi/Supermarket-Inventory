import { describe, expect, it } from "vitest";
import { translateCount } from "./i18n";

describe("localized count grammar", () => {
  it.each([
    [0, "0 notes"],
    [1, "1 note"],
    [2, "2 notes"],
  ])("uses the English plural rule for %i", (count, expected) => {
    expect(
      translateCount(
        "{{count}} note",
        "{{count}} notes",
        "{{count}} یادداشت",
        "{{count}} یادداشت",
        count as number,
        "en",
      ),
    ).toBe(expected);
  });
  it("uses Persian resource forms rather than English text", () => {
    expect(translateCount("note", "notes", "یادداشت", "یادداشت", 1, "fa")).toBe(
      "یادداشت",
    );
    expect(translateCount("note", "notes", "یادداشت", "یادداشت", 3, "fa")).toBe(
      "یادداشت",
    );
  });
});
