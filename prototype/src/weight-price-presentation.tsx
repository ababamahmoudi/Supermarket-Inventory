import type { HTMLAttributes } from "react";
import { LtrText, Money } from "./presentation";
import { weightPriceDisplay } from "./weighed";
import type { CompanyConfig, Product } from "./types";
import "./weight-price.css";

export function ProductPrice({
  value,
  product,
  config,
  stacked = false,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  value: string;
  product: Pick<Product, "sold_by">;
  config: CompanyConfig;
  stacked?: boolean;
}) {
  if (product.sold_by !== "weight")
    return (
      <Money
        value={value}
        currency={config.company.currency}
        className={className}
        {...props}
      />
    );
  const display = weightPriceDisplay(value, config);
  return (
    <span
      {...props}
      className={["weight-price", stacked && "weight-price-stacked", className]
        .filter(Boolean)
        .join(" ")}
    >
      <LtrText className="weight-price-main">
        <Money value={display.main.amount} currency={config.company.currency} />
        /{display.main.unit}
      </LtrText>
      {display.secondary && (
        <LtrText className="weight-price-secondary">
          {!stacked && <> · </>}
          <Money
            value={display.secondary.amount}
            currency={config.company.currency}
          />
          /{display.secondary.unit}
        </LtrText>
      )}
    </span>
  );
}

export function ProductCost({
  value,
  product,
  config,
}: {
  value: string;
  product: Pick<Product, "sold_by">;
  config: CompanyConfig;
}) {
  if (product.sold_by !== "weight")
    return <Money value={value} currency={config.company.currency} />;
  return (
    <span className="weight-cost">
      <Money value={value} currency={config.company.currency} decimals={4} />
      <LtrText>/lb</LtrText>
    </span>
  );
}
