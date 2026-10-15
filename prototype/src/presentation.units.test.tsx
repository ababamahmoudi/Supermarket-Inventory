import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CasesAndUnits, ProductName, UnitSize, UnitText } from "./presentation";
import { formatCasesAndUnits } from "./formatters";

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

it("retains an ordinary Activity name while keeping its size together", () => {
  const text = "Dried Red Kidney Beans 900 g";
  const { container } = render(<UnitText>{text}</UnitText>);
  expect(container.textContent).toBe(text);
  expect(container.querySelector(".unit-fragment")?.textContent).toBe("900 g");
});

describe("scalar unit sizes inside RTL display text", () => {
  it.each([
    ["400 g", "400 g", "400"],
    [" 400   g ", "400 g", "400"],
    ["150 گرمی", "150 گرمی", "150"],
    ["۱۵۰ گرمی", "۱۵۰ گرمی", "۱۵۰"],
    ["۴٫۵ کیلوگرمی", "۴٫۵ کیلوگرمی", "۴٫۵"],
    ["1 L", "1 L", "1"],
    ["24 cm", "24 cm", "24"],
    ["2 mm", "2 mm", "2"],
  ])(
    "keeps %s together without changing its text or unit order",
    (value, text, number) => {
      const { container } = render(
        <div dir="rtl">
          <UnitSize value={value} data-testid="physical-size" />
        </div>,
      );
      const size = container.querySelector('[data-testid="physical-size"]');
      expect(size).toHaveAttribute("dir", "ltr");
      expect(size?.textContent).toBe(text);
      const group = size?.querySelector(".unit-text .unit-fragment");
      expect(group?.textContent).toBe(text);
      expect(group?.querySelector("bdi")).toHaveAttribute("dir", "ltr");
      expect(group?.querySelector("bdi")?.textContent).toBe(number);
    },
  );
});

describe("Persian centimetre and millimetre compound units", () => {
  it.each([
    ["۲۴ سانتی‌متری", "۲۴"],
    ["۲۴ سانتی متری", "۲۴"],
    ["۲۴ سانتیمتری", "۲۴"],
    ["24 سانتی‌متر", "24"],
    ["۲۴ سانتی متر", "۲۴"],
    ["٢٤ سانتیمتر", "٢٤"],
    ["۲ میلی‌متری", "۲"],
    ["۲ میلی متری", "۲"],
    ["۲ میلیمتری", "۲"],
    ["۲٫۵ میلی‌متر", "۲٫۵"],
    ["۱۲٬۰۰۰ میلی متر", "۱۲٬۰۰۰"],
    ["2 میلیمتر", "2"],
  ])(
    "keeps the complete entered %s phrase and numeric direction",
    (phrase, number) => {
      const product = {
        name_en: "Stainless Steel Pot",
        name_fa: `قابلمه استیل ${phrase}`,
      };
      const instruction = `حراج پایان یافت: کالای نگه‌داشته‌شده ${product.name_fa} را در قفسه بگذارید.`;
      const { container } = render(
        <div dir="rtl">
          <ProductName product={product} language="fa" />
          <UnitText>{instruction}</UnitText>
        </div>,
      );
      expect(container.querySelector("strong > bdi")).toHaveAttribute(
        "dir",
        "rtl",
      );
      expect(container.querySelector("strong")?.textContent).toBe(
        product.name_fa,
      );
      expect(container.querySelector(".unit-text")?.textContent).toBe(
        instruction,
      );
      const groups = [...container.querySelectorAll(".unit-fragment")];
      expect(groups.map((group) => group.textContent)).toEqual([
        phrase,
        phrase,
      ]);
      for (const group of groups) {
        expect(group.querySelector("bdi")).toHaveAttribute("dir", "ltr");
        expect(group.querySelector("bdi")?.textContent).toBe(number);
      }
    },
  );

  it.each(["۲۴ سانتی‌متریزه", "۲ میلی‌مترها"])(
    "does not isolate a partial unit inside %s",
    (text) => {
      const { container } = render(<UnitText>{text}</UnitText>);
      expect(container.textContent).toBe(text);
      expect(container.querySelector(".unit-fragment")).toBeNull();
    },
  );
});

describe("translated case and loose-unit display", () => {
  it.each([
    [
      30,
      4,
      [
        ["7", "کارتن"],
        ["2", "واحد"],
      ],
    ],
    [
      40,
      12,
      [
        ["3", "کارتن"],
        ["4", "واحد"],
      ],
    ],
    [
      "9007199254740993",
      12,
      [
        ["750599937895082", "کارتن"],
        ["9", "واحد"],
      ],
    ],
  ] as const)(
    "keeps every quantity paired with its own Persian unit for %s actual units",
    (units, pack, expected) => {
      const { container } = render(
        <CasesAndUnits units={units} unitsPerCase={pack} language="fa" />,
      );
      const expression = container.querySelector(".cases-and-units");
      expect(expression).toHaveAttribute("dir", "rtl");
      const pairs = [...container.querySelectorAll(".quantity-pair")];
      expect(
        pairs.map((pair) => [
          pair.querySelector(".quantity-number")?.textContent,
          pair.querySelector(".quantity-label")?.textContent,
        ]),
      ).toEqual(expected);
      for (const pair of pairs) {
        expect(pair).toHaveAttribute("dir", "rtl");
        expect(pair.querySelector(".quantity-number")).toHaveAttribute(
          "dir",
          "ltr",
        );
      }
      expect(container.textContent).toBe(
        formatCasesAndUnits(units, pack, "fa"),
      );
    },
  );
});
