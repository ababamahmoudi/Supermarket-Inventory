import { expect, it } from "vitest";
import { differingLookupLocations } from "./lookup-location-comparison";
it("D5 compares actual Decimal-equivalent public prices and marks the unique minority", () => {
  expect(
    differingLookupLocations([
      { location: "north", price: "6.49" },
      { location: "east", price: "6.4900" },
      { location: "west", price: "6.99" },
      { location: "depot", price: null },
    ]),
  ).toEqual(["west"]);
});
it("D5 a tie marks all different prices without silently taking the first location as authority", () => {
  expect(
    differingLookupLocations([
      { location: "a", price: "1.99" },
      { location: "b", price: "2.49" },
    ]),
  ).toEqual(["a", "b"]);
  expect(
    differingLookupLocations([
      { location: "a", price: "1.99" },
      { location: "b", price: null },
    ]),
  ).toEqual([]);
});
