import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { configSeed } from "./config";
import i18n from "./i18n";
import { ProductCost } from "./weight-price-presentation";

const config = {
  ...configSeed,
  company: { ...configSeed.company, currency: "CAD" },
};

it.each(["en", "fa"])(
  "shows cents for a weighed read-only cost with its complete amount/unit isolated in %s",
  async (language) => {
    await i18n.changeLanguage(language);
    const { container } = render(
      <div dir={language === "fa" ? "rtl" : "ltr"}>
        <ProductCost
          value="4.9895"
          product={{ sold_by: "weight" }}
          config={config}
        />
      </div>,
    );
    const cost = container.querySelector(".weight-cost");
    expect(cost).toHaveTextContent("$4.99/lb");
    expect(cost).toHaveAttribute("dir", "ltr");
    expect(cost?.tagName).toBe("BDI");
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.queryByText("$4.9895")).not.toBeInTheDocument();
  },
);
