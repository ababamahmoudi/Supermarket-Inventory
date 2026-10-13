import type { HTMLAttributes } from "react";
import { useDemo } from "./store";
import { effectivePrice, lookupBranch, regularPrice } from "./catalog";
import { activeSaleAt, pendingSaleRequest, salePriceDisplay } from "./sales";
import { LtrText, Money } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import { Badge } from "./ui";
import { saleCalendarDate, salesText } from "./sales-locale";
import type { Branch, Product } from "./types";

export function SalePrice({
  product,
  branch: selected,
  stacked = false,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  product: Product;
  branch?: Branch;
  stacked?: boolean;
}) {
  const { state, branch } = useDemo();
  const location = lookupBranch(selected ?? branch);
  const sale = activeSaleAt(state, product, location);
  if (!sale) {
    const price = effectivePrice(state, product, location);
    return price ? (
      <ProductPrice
        value={price}
        product={product}
        config={state.config}
        stacked={stacked}
        className={className}
        {...props}
      />
    ) : (
      <span {...props} className={className}>
        —
      </span>
    );
  }
  const display = salePriceDisplay(sale, state.config);
  return (
    <span
      {...props}
      className={[
        "sale-price",
        product.sold_by === "weight" && "weight-price",
        stacked && "weight-price-stacked",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <LtrText
        className={
          product.sold_by === "weight" ? "weight-price-main" : undefined
        }
      >
        <Money
          value={display.main.amount}
          currency={state.config.company.currency}
        />
        {display.main.unit !== "each" && `/${display.main.unit}`}
      </LtrText>
      {display.secondary && (
        <LtrText className="weight-price-secondary">
          {!stacked && " · "}
          <Money
            value={display.secondary.amount}
            currency={state.config.company.currency}
          />
          /{display.secondary.unit}
        </LtrText>
      )}
    </span>
  );
}

export function SaleStatus({
  product,
  branch: selected,
  compact = false,
}: {
  product: Product;
  branch?: Branch;
  compact?: boolean;
}) {
  const { state, branch, lang, t } = useDemo();
  const location = lookupBranch(selected ?? branch);
  const sale = activeSaleAt(state, product, location);
  if (!sale) return null;
  const regular = regularPrice(state, product, location);
  return (
    <span className={`sale-status${compact ? " is-compact" : ""}`}>
      <Badge tone="info" className="sale-pill">
        {salesText(t, "sale")}
      </Badge>
      {regular && (
        <del className="sale-regular-price">
          {salesText(t, "regular")}{" "}
          <ProductPrice
            value={regular}
            product={product}
            config={state.config}
          />
        </del>
      )}
      <span className="muted sale-end-date">
        {sale.last_day ? (
          <>
            {salesText(t, "until")}{" "}
            <bdi dir="auto" className="sale-calendar-date">
              {saleCalendarDate(sale.last_day, lang)}
            </bdi>
          </>
        ) : (
          salesText(t, "noEnd")
        )}
      </span>
    </span>
  );
}

export function PendingSalePill({
  product,
  branch: selected,
  compact = false,
}: {
  product: Product;
  branch?: Branch;
  compact?: boolean;
}) {
  const { state, branch, lang, t } = useDemo();
  const request = pendingSaleRequest(
    state,
    product,
    lookupBranch(selected ?? branch),
  );
  if (!request) return null;
  const display = salePriceDisplay(
    { sale_price: request.requested_price, price_unit: request.price_unit },
    state.config,
  );
  return (
    <span className={`pending-sale-status${compact ? " is-compact" : ""}`}>
      <Badge tone="pending" className="sale-request-pill">
        {salesText(t, "requested")}{" "}
        <LtrText>
          <Money
            value={display.main.amount}
            currency={state.config.company.currency}
          />
          {display.main.unit !== "each" && `/${display.main.unit}`}
        </LtrText>{" "}
        ·{" "}
        <bdi dir="auto" className="sale-calendar-date">
          {saleCalendarDate(request.starts_on, lang)}
          {request.last_day && <>–{saleCalendarDate(request.last_day, lang)}</>}
        </bdi>
      </Badge>
      {!compact && <span className="muted">{salesText(t, "waiting")}</span>}
    </span>
  );
}
