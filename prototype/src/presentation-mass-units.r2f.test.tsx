import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { massUnitLabel } from "./formatters";
import { MassSize, UnitSize } from "./presentation";
import { SellingPriceValue } from "./selling-price-presentation";

it.each([
  ["g", "گرم"],
  ["kg", "کیلوگرم"],
  ["lb", "پوند"],
  ["oz", "اونس"],
] as const)("R2f localizes %s only as a display label", (unit, label) => {
  expect(massUnitLabel(unit, "fa")).toBe(label);
  expect(massUnitLabel(unit, "en")).toBe(unit);
  expect(massUnitLabel(unit)).toBe(unit);
});
it("R2f isolates the unchanged entered mass quantity from its Persian label, while ordinary UnitSize stays Latin", () => {
  const { container } = render(
    <>
      <MassSize value="0.375" unit="lb" language="fa" />
      <UnitSize value="100 g" />
    </>,
  );
  expect(container.querySelector(".mass-size")?.textContent).toBe("0.375 پوند");
  expect(container.querySelector(".mass-size")?.getAttribute("dir")).toBe(
    "rtl",
  );
  expect(
    container.querySelector(".mass-size .quantity-number")?.getAttribute("dir"),
  ).toBe("ltr");
  expect(container.lastElementChild?.textContent).toBe("100 g");
});
it("R2f opt-in price-unit labels preserve current/regular and converted monetary amounts", () => {
  const current = {
    main: { amount: "7.49", unit: "lb" as const },
    secondary: { amount: "16.51", unit: "kg" as const },
  };
  const regular = {
    main: { amount: "7.99", unit: "lb" as const },
    secondary: { amount: "17.61", unit: "kg" as const },
  };
  const { container, rerender } = render(
    <SellingPriceValue
      current={current}
      regular={regular}
      currency="CAD"
      unitLanguage="fa"
    />,
  );
  expect(
    container.querySelectorAll(".selling-price-current")[0].textContent,
  ).toBe("$7.49/پوند");
  expect(
    container.querySelectorAll(".selling-price-current")[1].textContent,
  ).toBe("$16.51/کیلوگرم");
  expect(container.querySelectorAll("del")[0].textContent).toBe("$7.99/پوند");
  expect(container.querySelectorAll("del")[1].textContent).toBe(
    "$17.61/کیلوگرم",
  );
  rerender(
    <SellingPriceValue current={current} regular={regular} currency="CAD" />,
  );
  expect(
    container.querySelectorAll(".selling-price-current")[0].textContent,
  ).toBe("$7.49/lb");
  expect(
    container.querySelectorAll(".selling-price-current")[1].textContent,
  ).toBe("$16.51/kg");
});
