/* eslint-disable react-refresh/only-export-components -- This stateless display API intentionally re-exports its shared text formatters. */
import type { HTMLAttributes, ReactNode } from "react";
import type Decimal from "decimal.js";
import i18n, { translate } from "./i18n";
import { useConfiguredTimeZone } from "./store";
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
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { value: string | Date | null | undefined }) {
  const timeZone = useConfiguredTimeZone();
  return (
    <LtrText
      {...props}
      className={["date-text", className].filter(Boolean).join(" ")}
    >
      {formatDate(value, timeZone)}
    </LtrText>
  );
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
  const hasPersian = Boolean(product.name_fa.trim());
  const primaryLanguage = language === "fa" && hasPersian ? "fa" : "en";
  const primary = primaryLanguage === "fa" ? product.name_fa : product.name_en;
  const secondary =
    primaryLanguage === "fa" ? product.name_en : product.name_fa;
  return (
    <span className={["product-name", className].filter(Boolean).join(" ")}>
      <strong>
        <bdi
          dir={primaryLanguage === "fa" ? "rtl" : "ltr"}
          lang={primaryLanguage}
        >
          {productNameUnits(primary)}
        </bdi>
      </strong>
      {secondary.trim() && (
        <small>
          <bdi
            dir={primaryLanguage === "fa" ? "ltr" : "rtl"}
            lang={primaryLanguage === "fa" ? "en" : "fa"}
          >
            {productNameUnits(secondary)}
          </bdi>
        </small>
      )}
    </span>
  );
}
/** Bind an entered size to its unit without changing names or stored data. */
function productNameUnits(value: string): ReactNode[] {
  const fragments: ReactNode[] = [];
  const units =
    /(\p{N}+(?:[.,\u066B\u066C]\p{N}+)*)(\s+)(kg|g|ml|mL|L|lb|lbs|oz|units?|cases?|packs?|pieces?|گرمی?|کیلوگرمی?|لیتری?|پوندی?|واحد|کارتن|بسته)(?=$|[\s.,()])/gu;
  let start = 0;
  for (const match of value.matchAll(units)) {
    fragments.push(value.slice(start, match.index));
    fragments.push(
      <span className="unit-fragment" key={match.index}>
        <bdi dir="ltr">{match[1]}</bdi>
        {match[2]}
        {match[3]}
      </span>,
    );
    start = match.index + match[0].length;
  }
  fragments.push(value.slice(start));
  return fragments;
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
