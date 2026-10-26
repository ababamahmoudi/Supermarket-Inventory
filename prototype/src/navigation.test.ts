import { beforeEach, describe, expect, it } from "vitest";
import {
  navigationKey,
  readNavigationValue,
  saveNavigationValue,
  rememberInvoiceReturnRoute,
  readInvoiceReturnRoute,
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

describe("posted invoice Done destination (R2c0.2)", () => {
  it("returns list entries to Posted and retains external entry through review/posting", () => {
    rememberInvoiceReturnRoute(
      "market",
      "owner",
      "north",
      "#invoices?tab=needs_review",
      "#invoices?id=review-one",
    );
    expect(
      readInvoiceReturnRoute("market", "owner", "north", "review-one"),
    ).toBe("#invoices?tab=posted");
    rememberInvoiceReturnRoute(
      "market",
      "owner",
      "north",
      "#suppliers?name=Fictional",
      "#invoices?id=external-one",
    );
    rememberInvoiceReturnRoute(
      "market",
      "owner",
      "north",
      "#invoices?id=external-one",
      "#invoices?id=external-one&version=latest",
    );
    expect(
      readInvoiceReturnRoute("market", "owner", "north", "external-one"),
    ).toBe("#suppliers?name=Fictional");
    for (const args of [
      ["other", "owner", "north"],
      ["market", "cashier", "north"],
      ["market", "owner", "south"],
    ])
      expect(
        readInvoiceReturnRoute(
          ...(args as [string, string, string]),
          "external-one",
        ),
      ).toBe("#invoices?tab=posted");
  });
  it("uses Posted for direct links and rejects external URL destinations", () => {
    expect(readInvoiceReturnRoute("market", "owner", "north", "direct")).toBe(
      "#invoices?tab=posted",
    );
    rememberInvoiceReturnRoute(
      "market",
      "owner",
      "north",
      "https://example.invalid/",
      "#invoices?id=direct",
    );
    expect(readInvoiceReturnRoute("market", "owner", "north", "direct")).toBe(
      "#invoices?tab=posted",
    );
  });
});
