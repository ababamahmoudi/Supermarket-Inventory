import type { HTMLAttributes } from "react";
import { useDemo } from "./store";
import {
  effectiveOffer,
  effectivePrice,
  lookupBranch,
  regularPrice,
} from "./catalog";
import {
  activeSaleAt,
  discountSaleAt,
  pendingSaleRequest,
  salePriceDisplay,
} from "./sales";
import { LtrText, Money } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import { weightPriceDisplay } from "./weighed";
import { SellingPriceValue } from "./selling-price-presentation";
import { OfferLabel } from "./presentation";
import { Badge } from "./ui";
import { saleCalendarDate, salesText } from "./sales-locale";
import type { Branch } from "./types";
import type { ProductReadDTO } from "./catalog-read-model";

export function SalePrice({
  product,
  branch: selected,
  stacked = false,
  comparison = true,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  product: ProductReadDTO;
  branch?: Branch;
  stacked?: boolean;
  comparison?: boolean;
}) {
  const { state, branch } = useDemo();
  const location = lookupBranch(selected ?? branch);
  const sale = activeSaleAt(state, product, location);
  const advertisedSale = discountSaleAt(state, product, location);
  const regular = regularPrice(state, product, location);
  const current = sale ? salePriceDisplay(sale, state.config) : null;
  if (!current) {
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
  return (
    <SellingPriceValue
      {...props}
      className={["sale-price", stacked && "weight-price-stacked", className]
        .filter(Boolean)
        .join(" ")}
      current={current}
      regular={
        regular && advertisedSale
          ? product.sold_by === "weight"
            ? weightPriceDisplay(regular, state.config)
            : { main: { amount: regular, unit: "each" } }
          : undefined
      }
      comparison={comparison}
      currency={state.config.company.currency}
    />
  );
}

export function SaleStatus({
  product,
  branch: selected,
  compact = false,
}: {
  product: ProductReadDTO;
  branch?: Branch;
  compact?: boolean;
}) {
  const { state, branch, lang, t } = useDemo();
  const sale = discountSaleAt(state, product, lookupBranch(selected ?? branch));
  if (!sale) return null;
  return (
    <span className={`sale-status${compact ? " is-compact" : ""}`}>
      <Badge tone="info" className="sale-pill">
        {salesText(t, "sale")}
      </Badge>
      <span className="muted sale-end-date">
        {sale.last_day ? (
          <>
            {t("Ends", "پایان")}{" "}
            <bdi dir="auto">{saleCalendarDate(sale.last_day, lang)}</bdi>
          </>
        ) : (
          t("No end date", "بدون تاریخ پایان")
        )}
      </span>
    </span>
  );
}

/** Terms sit in their own Offer column, independently of approval status. */
export function ProductOfferStatus({
  product,
  branch: selected,
  empty = true,
}: {
  product: ProductReadDTO;
  branch?: Branch;
  empty?: boolean;
}) {
  const { state, branch, lang, t } = useDemo();
  const location = lookupBranch(selected ?? branch);
  const sale = discountSaleAt(state, product, location);
  const request = pendingSaleRequest(state, product, location);
  const offer = effectiveOffer(state, product, location);
  if (!sale && !request && !offer)
    return empty ? <span className="muted">—</span> : null;
  return (
    <span className="product-offer-lines">
      {sale && (
        <span className="product-offer-line">
          {t("Sale", "حراج")} ·{" "}
          {sale.last_day ? (
            <>
              {t("ends", "پایان")}{" "}
              <bdi dir="auto">{saleCalendarDate(sale.last_day, lang)}</bdi>
            </>
          ) : (
            t("no end date", "بدون تاریخ پایان")
          )}
        </span>
      )}
      {request && (
        <span className="product-offer-line is-requested">
          {salesText(t, "requested")} ·{" "}
          <SellingPriceValue
            current={salePriceDisplay(
              {
                sale_price: request.requested_price,
                price_unit: request.price_unit,
              },
              state.config,
            )}
            currency={state.config.company.currency}
          />
        </span>
      )}
      {offer && (
        <span className="product-offer-line">
          <OfferLabel
            label={offer.label}
            language={lang}
            currency={state.config.company.currency}
          />
        </span>
      )}
    </span>
  );
}

export function PendingSalePill({
  product,
  branch: selected,
  compact = false,
}: {
  product: ProductReadDTO;
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
