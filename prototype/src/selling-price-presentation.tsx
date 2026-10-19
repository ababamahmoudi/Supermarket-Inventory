import type { HTMLAttributes } from "react";
import { LtrText, Money } from "./presentation";
import type { PriceSnapshot } from "./price-updates";
import "./selling-price.css";

import {
  isDiscountPrice,
  type SellingAmount,
  type SellingPriceDisplay,
} from "./selling-price-model";

/** Explicit values make this renderer safe for both live prices and retained targets. */
export function SellingPriceValue({
  current,
  regular,
  currency,
  comparison = true,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  current: SellingPriceDisplay;
  regular?: SellingPriceDisplay | null;
  currency?: string;
  comparison?: boolean;
}) {
  const discounted = comparison && isDiscountPrice(current, regular);
  const line = (amount: SellingAmount, previous?: SellingAmount | null) => (
    <LtrText className="selling-price-line">
      {discounted && previous && previous.unit === amount.unit && (
        <del className="selling-price-regular sale-regular-price">
          <Money value={previous.amount} currency={currency} decimals={2} />
          {previous.unit !== "each" && `/${previous.unit}`}
        </del>
      )}
      <strong className="selling-price-current">
        <Money value={amount.amount} currency={currency} decimals={2} />
        {amount.unit !== "each" && `/${amount.unit}`}
      </strong>
    </LtrText>
  );
  return (
    <span
      {...props}
      className={[
        "selling-price-value",
        current.secondary && "has-secondary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-sale-price={discounted || undefined}
    >
      {line(current.main, regular?.main)}
      {current.secondary && (
        <span className="selling-price-secondary weight-price-secondary">
          {line(current.secondary, regular?.secondary)}
        </span>
      )}
    </span>
  );
}

/** A task's old/new values must never be replaced with today's product price. */
export function SnapshotSellingPrice({
  value,
  currency,
}: {
  value: PriceSnapshot;
  currency?: string;
}) {
  if (value.price === null) return <LtrText>—</LtrText>;
  return (
    <SellingPriceValue
      current={{
        main: { amount: value.price, unit: value.unit },
        secondary: value.secondary_price
          ? {
              amount: value.secondary_price.price,
              unit: value.secondary_price.unit,
            }
          : undefined,
      }}
      regular={
        value.sale_id && value.regular_price !== null
          ? { main: { amount: value.regular_price, unit: value.unit } }
          : undefined
      }
      currency={currency}
    />
  );
}
