import { expect, it } from "vitest";
import { offerSuggestionAmounts } from "./offer-suggestion";

it("shows exact configured bundle savings against the approved unit price", () => {
  expect(offerSuggestionAmounts("2 for $7.00", "3.99")).toEqual({
    quantity: "2",
    total: "7.00",
    saving: "0.98",
  });
  expect(offerSuggestionAmounts("3 for $10.00", "3.99")).toEqual({
    quantity: "3",
    total: "10.00",
    saving: "1.97",
  });
});
it.each(["n/a", "0", "-1", "Infinity"])(
  "does not invent savings for invalid regular price %s",
  (price) => {
    expect(offerSuggestionAmounts("2 for $7.00", price)).toBeUndefined();
  },
);
it("does not advertise negative savings or reinterpret unsupported offer copy", () => {
  expect(offerSuggestionAmounts("2 for $7.00", "2.99")?.saving).toBeNull();
  expect(offerSuggestionAmounts("2 for $7.00", "3.50")?.saving).toBeNull();
  expect(offerSuggestionAmounts("Special deal", "3.99")).toBeUndefined();
});
