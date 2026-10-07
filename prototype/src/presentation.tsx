/* eslint-disable react-refresh/only-export-components -- This stateless display API intentionally re-exports its shared text formatters. */
import type { HTMLAttributes, ReactNode } from "react";
import type Decimal from "decimal.js";
import i18n, { translate } from "./i18n";
import {
  formatDate,
  formatMoney,
  formatUnitSize,
  offerParts,
  type MoneyOptions,
} from "./formatters";
import type { Language } from "./types";

export {
  activityLabel,
  branchLabel,
  categoryLabel,
  demoUserLabel,
  formatDate,
  formatMoney,
  formatOffer,
  formatUnitSize,
} from "./formatters";

export function LtrText({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <bdi
      {...props}
      dir="ltr"
      className={["ltr-fragment", className].filter(Boolean).join(" ")}
    >
      {children}
    </bdi>
  );
}
export function Money({
  value,
  currency,
  decimals,
  compact,
  ...props
}: HTMLAttributes<HTMLElement> & MoneyOptions & { value: Decimal.Value }) {
  return (
    <LtrText {...props}>
      {formatMoney(value, { currency, decimals, compact })}
    </LtrText>
  );
}
export function DateText({
  value,
  ...props
}: HTMLAttributes<HTMLElement> & { value: string | Date | null | undefined }) {
  return <LtrText {...props}>{formatDate(value)}</LtrText>;
}
export function UnitSize({
  value,
  ...props
}: HTMLAttributes<HTMLElement> & { value: string }) {
  return <LtrText {...props}>{formatUnitSize(value)}</LtrText>;
}
export function ProductName({
  product,
  language = i18n.language as Language,
  className,
}: {
  product: { name_en: string; name_fa: string };
  language?: Language;
  className?: string;
}) {
  const primary = language === "fa" ? product.name_fa : product.name_en;
  const secondary = language === "fa" ? product.name_en : product.name_fa;
  return (
    <span className={["product-name", className].filter(Boolean).join(" ")}>
      <strong>
        <bdi dir={language === "fa" ? "rtl" : "ltr"} lang={language}>
          {primary}
        </bdi>
      </strong>
      {secondary && (
        <small>
          <bdi
            dir={language === "fa" ? "ltr" : "rtl"}
            lang={language === "fa" ? "en" : "fa"}
          >
            {secondary}
          </bdi>
        </small>
      )}
    </span>
  );
}
export function OfferLabel({
  label,
  language = i18n.language as Language,
  currency,
  className,
}: {
  label: string;
  language?: Language;
  currency?: string;
  className?: string;
}) {
  const parts = offerParts(label);
  if (!parts)
    return (
      <bdi dir="auto" className={className}>
        {label}
      </bdi>
    );
  const quantity = new Intl.NumberFormat(
    language === "fa" ? "fa-IR" : "en-US",
    { useGrouping: false },
  ).format(Number(parts.quantity));
  return (
    <span className={className} dir={language === "fa" ? "rtl" : "ltr"}>
      {quantity} {translate("for", "عدد", language)}{" "}
      <Money value={parts.price} currency={currency} compact />
    </span>
  );
}
