/* eslint-disable react-refresh/only-export-components -- This stateless display API intentionally re-exports its shared text formatters. */
import { Fragment, type HTMLAttributes, type ReactNode } from "react";
import "./quantity-presentation.css";
import type Decimal from "decimal.js";
import i18n, { translate } from "./i18n";
import { useConfiguredTimeZone } from "./store";
import {
  casesAndUnitsParts,
  quantityParts,
  type QuantityUnit,
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
/** Keep each translated label attached to its own isolated numeric value. */
export function QuantityText({
  value,
  unit,
  language = i18n.language as Language,
}: {
  value: string | number;
  unit: QuantityUnit;
  language?: Language;
}) {
  const parts = quantityParts(value, unit, language);
  return (
    <bdi className="quantity-pair" dir={language === "fa" ? "rtl" : "ltr"}>
      <LtrText className="quantity-number">{parts.value}</LtrText>{" "}
      <bdi className="quantity-label" dir="auto">
        {parts.label}
      </bdi>
    </bdi>
  );
}

/** A rich display of the same read-only decomposition as formatCasesAndUnits. */
export function CasesAndUnits({
  units,
  unitsPerCase,
  language = i18n.language as Language,
}: {
  units: Decimal.Value;
  unitsPerCase: Decimal.Value;
  language?: Language;
}) {
  return (
    <span className="cases-and-units" dir={language === "fa" ? "rtl" : "ltr"}>
      {casesAndUnitsParts(units, unitsPerCase).map((part, index) => (
        <Fragment key={part.unit}>
          {index > 0 && <span className="quantity-separator"> + </span>}
          <QuantityText
            value={part.value}
            unit={part.unit}
            language={language}
          />
        </Fragment>
      ))}
    </span>
  );
}

export function Money({
  value,
  currency,
  decimals,
  compact,
  fixedDecimals,
  ...props
}: HTMLAttributes<HTMLElement> & MoneyOptions & { value: Decimal.Value }) {
  return (
    <LtrText {...props}>
      {formatMoney(value, { currency, decimals, compact, fixedDecimals })}
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
  return (
    <LtrText {...props}>
      <UnitText>{formatUnitSize(value)}</UnitText>
    </LtrText>
  );
}
/** Keep physical sizes together in ordinary display text, including Activity. */
export function UnitText({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: string }) {
  return (
    <span
      {...props}
      className={["unit-text", className].filter(Boolean).join(" ")}
    >
      {productNameUnits(children)}
    </span>
  );
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
    /(\p{N}+(?:[.,\u066B\u066C]\p{N}+)*)(\s+)(kg|g|ml|mL|L|lb|lbs|oz|cm|mm|سانتی[\s\u200c]*متری?|میلی[\s\u200c]*متری?|units?|cases?|packs?|pieces?|گرمی?|کیلوگرمی?|لیتری?|پوندی?|واحد|کارتن|بسته)(?=$|[\s.,()])/gu;
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

/** True when a stored text value was actually filled in. */
export function isFilled(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
/** Foundation rule: a value that was never entered says so instead of leaving a gap. */
export function NotAdded({ language }: { language?: Language }) {
  return (
    <span className="value-empty">
      {translate(
        "Not added",
        "ثبت نشده",
        language ?? (i18n.language as Language),
      )}
    </span>
  );
}
/** Shows a filled value left-to-right, or "Not added". */
export function LtrValue({ value }: { value: string | null | undefined }) {
  return isFilled(value) ? <LtrText>{value}</LtrText> : <NotAdded />;
}
