import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import configuration from "../../seed/arzon-config.json";
import i18n from "./i18n";
import type { CompanyConfig } from "./types";
import { ProductCost } from "./weight-price-presentation";

const config = {
  ...configuration,
  company: { ...configuration.company, currency: "CAD" },
} as unknown as CompanyConfig;

it.each(["en", "fa"])(
  "retains a four-decimal weighed cost with its complete amount/unit isolated in %s",
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
    expect(cost).toHaveTextContent("$4.9895/lb");
    expect(cost).toHaveAttribute("dir", "ltr");
    expect(cost?.tagName).toBe("BDI");
    expect(screen.getByText("$4.9895")).toBeInTheDocument();
    expect(screen.queryByText("$4.99")).not.toBeInTheDocument();
  },
);
