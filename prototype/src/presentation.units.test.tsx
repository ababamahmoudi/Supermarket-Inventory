import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductName } from "./presentation";

describe("entered product sizes", () => {
  it("preserves the Persian decimal and grouping separators without isolating only the last digit", () => {
    const product = {
      name_en: "Rice 4.5 kg",
      name_fa: "برنج ۴٫۵ کیلوگرمی و ۱۲٬۰۰۰ گرمی",
    };
    const { container } = render(
      <ProductName product={product} language="fa" />,
    );
    expect(container.querySelector("small")?.textContent).toBe(product.name_en);
    expect(container.querySelector("strong")?.textContent).toBe(
      product.name_fa,
    );
    const sizes = container.querySelectorAll("strong .unit-fragment");
    expect([...sizes].map((element) => element.textContent)).toEqual([
      "۴٫۵ کیلوگرمی",
      "۱۲٬۰۰۰ گرمی",
    ]);
    expect(
      [...sizes].map((element) => element.querySelector("bdi")?.textContent),
    ).toEqual(["۴٫۵", "۱۲٬۰۰۰"]);
  });

  it("preserves the entered English name when it is the Persian fallback", () => {
    const product = { name_en: "Rice 4.5 kg", name_fa: "" };
    const { container } = render(
      <ProductName product={product} language="fa" />,
    );
    expect(container.querySelector("strong")?.textContent).toBe(
      product.name_en,
    );
    expect(container.querySelector("strong > bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    expect(container.querySelector(".unit-fragment")?.textContent).toBe(
      "4.5 kg",
    );
    expect(container.querySelector("small")).toBeNull();
  });
});
