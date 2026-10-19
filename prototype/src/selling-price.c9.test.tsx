import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  SellingPriceValue,
  SnapshotSellingPrice,
} from "./selling-price-presentation";
import { isDiscountPrice } from "./selling-price-model";

afterEach(cleanup);

it.each(["en", "fa"])(
  "places the genuine regular comparison before the charge within one atomic price line in %s",
  (language) => {
    const { container } = render(
      <div dir={language === "fa" ? "rtl" : "ltr"}>
        <SellingPriceValue
          current={{ main: { amount: "16.99", unit: "each" } }}
          regular={{ main: { amount: "20.99", unit: "each" } }}
        />
      </div>,
    );
    const line = container.querySelector(".selling-price-line")!;
    expect(line).toHaveAttribute("dir", "ltr");
    expect(line).not.toHaveClass("weight-price-main");
    expect(line.children[0]).toHaveClass("selling-price-regular");
    expect(line.children[1]).toHaveClass("selling-price-current");
    expect(line.children[0]).toHaveTextContent("$20.99");
    expect(line.children[1]).toHaveTextContent("$16.99");
    expect(container.querySelectorAll(".selling-price-line")).toHaveLength(1);
  },
);

it.each(["20.99", "21.49"])(
  "never advertises a discount when the sale is %s against regular 20.99",
  (amount) => {
    const current = { main: { amount, unit: "each" as const } };
    const regular = { main: { amount: "20.99", unit: "each" as const } };
    expect(isDiscountPrice(current, regular)).toBe(false);
    const { container } = render(
      <SellingPriceValue current={current} regular={regular} />,
    );
    expect(container.querySelector("del")).toBeNull();
    expect(container.querySelector("[data-sale-price]")).toBeNull();
  },
);

it("renders frozen task values and both unit lines directly from their snapshot", () => {
  const { container, rerender } = render(
    <SnapshotSellingPrice
      value={{
        price: "6.99",
        regular_price: "7.49",
        unit: "lb",
        sale_id: "retained-sale",
        secondary_price: { price: "15.41", unit: "kg" },
      }}
    />,
  );
  expect(container).toHaveTextContent("$7.49/lb$6.99/lb$15.41/kg");
  expect(container.querySelectorAll(".selling-price-line")).toHaveLength(2);
  expect(container.querySelectorAll(".weight-price-main")).toHaveLength(1);
  expect(container.querySelector(".weight-price-main")).toHaveAttribute(
    "dir",
    "ltr",
  );
  expect(container.querySelector(".weight-price-main")).toHaveTextContent(
    "$7.49/lb$6.99/lb",
  );
  expect(container.querySelector(".weight-price-secondary")).not.toHaveClass(
    "weight-price-main",
  );
  // A different target is explicit input, rather than a lookup of a live product.
  rerender(
    <SnapshotSellingPrice
      value={{
        price: "8.99",
        regular_price: "8.99",
        unit: "lb",
        secondary_price: { price: "19.82", unit: "kg" },
      }}
    />,
  );
  expect(container).toHaveTextContent("$8.99/lb$19.82/kg");
  expect(container.querySelector("del")).toBeNull();
});

it("identifies each complete price once without named or role-bearing nested copies", () => {
  const { getAllByTestId } = render(
    <>
      <SellingPriceValue current={{ main: { amount: "2.99", unit: "each" } }} />
      <SellingPriceValue current={{ main: { amount: "3.29", unit: "each" } }} />
    </>,
  );
  const prices = getAllByTestId("selling-price");
  expect(prices).toHaveLength(2);
  expect(prices.map((price) => price.textContent)).toEqual(["$2.99", "$3.29"]);
  for (const price of prices) {
    expect(price.querySelector("[data-testid]")).toBeNull();
    expect(
      price.querySelector("[aria-label], [aria-labelledby], [role]"),
    ).toBeNull();
    expect(price.querySelectorAll("strong")).toHaveLength(1);
  }
});
