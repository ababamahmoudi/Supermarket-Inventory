import { beforeEach, describe, expect, it } from "vitest";
import {
  navigationKey,
  readNavigationValue,
  saveNavigationValue,
} from "./navigation";

beforeEach(() => sessionStorage.clear());
describe("scoped list navigation preferences", () => {
  it("keeps tabs, filters and scroll together without leaking between companies, users or locations", () => {
    const key = navigationKey("market-a", "employee", "north", "returns");
    const filters = {
      tab: "history",
      supplier: "Fresh Valley Foods",
      scroll: 490,
    };
    saveNavigationValue(key, filters);
    expect(readNavigationValue(key, {})).toEqual(filters);
    for (const changed of [
      ["market-b", "employee", "north"],
      ["market-a", "supervisor", "north"],
      ["market-a", "employee", "warehouse"],
    ]) {
      expect(
        readNavigationValue(
          navigationKey(...(changed as [string, string, string]), "returns"),
          {},
        ),
      ).toEqual({});
    }
  });
  it("treats damaged browser preferences as defaults", () => {
    const key = navigationKey(
      "damaged",
      "employee",
      "north",
      "products.search",
    );
    sessionStorage.setItem(key, "{damaged");
    expect(readNavigationValue(key, "")).toBe("");
  });
});
