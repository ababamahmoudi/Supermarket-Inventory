import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialState } from "./e1-bootstrap";
import {
  SalePrice,
  SaleStatus,
  ProductOfferStatus,
} from "./sales-presentation";
import { salePriceDisplay } from "./sales";
import type { DemoState } from "./types";

let view: {
  state: DemoState;
  branch: string;
  lang: string;
  t: (en: string) => string;
};
vi.mock("./store", () => ({ useDemo: () => view }));
afterEach(cleanup);

it.each(["lb", "kg"] as const)(
  "keeps exact entered kg cents while hiding equal-price Sale advertising in main unit %s",
  (mainUnit) => {
    for (const entered of ["22.01", "22.02", "22.03"]) {
      const state = initialState();
      state.config.weighed_items!.main_display_unit = mainUnit;
      state.config.weighed_items!.show_second_unit = true;
      const source = state.products.find((item) => item.code === "0016")!;
      source.selling_price = "9.99";
      source.branch_prices = { "Branch 1": "9.99" };
      const product = {
        ...source,
        manual_price_scopes: [],
        manual_price_comparisons: {},
      };
      state.offers = [];
      state.sale_requests = [];
      state.sales = [
        {
          ...state.sales![0],
          product_code: product.code,
          sale_price: entered,
          price_unit: "kg",
          regular_price_snapshot: "9.99",
        },
      ];
      view = { state, branch: "Branch 1", lang: "en", t: (en) => en };
      const retained = JSON.stringify(state);
      const expected = salePriceDisplay(state.sales[0], state.config);
      const { container, unmount } = render(
        <>
          <SalePrice product={product} />
          <SaleStatus product={product} />
          <ProductOfferStatus product={product} />
        </>,
      );
      expect(
        container.querySelector(".sale-price .selling-price-current"),
      ).toHaveTextContent(`$${expected.main.amount}/${mainUnit}`);
      expect(container.querySelector(".sale-price")).toHaveClass(
        "weight-price",
      );
      expect(
        container.querySelector(".sale-price .weight-price-main"),
      ).toHaveAttribute("dir", "ltr");
      expect(
        container.querySelector(".sale-price .selling-price-secondary"),
      ).toHaveTextContent(
        `$${expected.secondary!.amount}/${expected.secondary!.unit}`,
      );
      if (entered === "22.01") {
        expect(container.querySelector(".sale-pill")).toHaveTextContent("Sale");
        expect(
          container.querySelector(".product-offer-line"),
        ).toHaveTextContent("Sale");
        expect(
          container.querySelector(".selling-price-regular"),
        ).not.toBeNull();
      } else {
        expect(container.querySelector(".sale-pill")).toBeNull();
        expect(container.querySelector(".product-offer-line")).toBeNull();
        expect(container.querySelector(".selling-price-regular")).toBeNull();
      }
      expect(JSON.stringify(state)).toBe(retained);
      unmount();
    }
  },
);
