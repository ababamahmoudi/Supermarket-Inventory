import type { HTMLAttributes, ReactNode } from "react";
import { LtrText, Money } from "./presentation";
import { weightPriceDisplay } from "./weighed";
import { SellingPriceValue } from "./selling-price-presentation";
import type { CompanyConfig, Product, Language } from "./types";
import "./weight-price.css";

export function ProductPrice({
  value,
  product,
  config,
  stacked = false,
  className,
  secondaryNote,
  unitLanguage,
  ...props
}: HTMLAttributes<HTMLElement> & {
  value: string;
  product: Pick<Product, "sold_by">;
  config: Pick<CompanyConfig, "company" | "weighed_items">;
  stacked?: boolean;
  secondaryNote?: ReactNode;
  unitLanguage?: Language;
}) {
  const display =
    product.sold_by === "weight"
      ? weightPriceDisplay(value, config)
      : { main: { amount: value, unit: "each" as const } };
  return (
    <SellingPriceValue
      {...props}
      className={[
        product.sold_by === "weight" && "weight-price",
        product.sold_by === "weight" && stacked && "weight-price-stacked",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      current={display}
      secondaryNote={secondaryNote}
      unitLanguage={unitLanguage}
      currency={config.company.currency}
    />
  );
}

export function ProductCost({
  value,
  product,
  config,
}: {
  value: string;
  product: Pick<Product, "sold_by">;
  config: Pick<CompanyConfig, "company" | "weighed_items">;
}) {
  if (product.sold_by !== "weight")
    return (
      <Money value={value} currency={config.company.currency} decimals={2} />
    );
  return (
    <LtrText className="weight-cost">
      <span className="weight-price-main">
        <Money value={value} currency={config.company.currency} decimals={2} />
        /lb
      </span>
    </LtrText>
  );
}
