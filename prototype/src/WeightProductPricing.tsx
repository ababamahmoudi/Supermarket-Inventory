import Decimal from "decimal.js";
import { useDemo } from "./store";
import { Field, Select, SegmentedControl, Button, Badge } from "./ui";
import { Money, LtrText, categoryLabel } from "./presentation";
import { activePricingCategories } from "./settings";
import { weightConversionFactor, type WeightUnit } from "./weighed";
import type { weightEditorPricePreview } from "./weight-product-editor";

export function WeightProductPricing({
  formId,
  category,
  onCategoryChange,
  cost,
  onCostChange,
  unit,
  onUnitChange,
  calculation,
  pricePerLb,
  pendingPerLb,
  onChangePrice,
  costError,
  categoryError,
  newProduct,
  newManualPrice,
  onNewManualPriceChange,
}: {
  formId: string;
  category: string;
  onCategoryChange(value: string): void;
  cost: string;
  onCostChange(value: string): void;
  unit: WeightUnit;
  onUnitChange(unit: WeightUnit): void;
  calculation?: ReturnType<typeof weightEditorPricePreview>;
  pricePerLb: string | null;
  pendingPerLb?: string | null;
  onChangePrice(): void;
  costError?: string;
  categoryError?: string;
  newProduct: boolean;
  newManualPrice?: string;
  onNewManualPriceChange?(value: string): void;
}) {
  const { state, lang, t } = useDemo();
  const [currency, factor] = [
    state.config.company.currency,
    weightConversionFactor(state.config),
  ];
  let secondaryCost: string | null = null;
  try {
    if (/^\d+(?:\.\d{1,4})?$/.test(cost))
      secondaryCost = (
        unit === "lb"
          ? new Decimal(cost).times(factor)
          : new Decimal(cost).div(factor)
      ).toFixed(4);
  } catch {
    /* Invalid input is reported by the guarded preview/save. */
  }
  const categoryName = categoryLabel(
    state.config.pricing_categories.find((item) => item.key === category)
      ?.label ?? "",
    lang,
  );
  return (
    <>
      <div className="form-grid product-editor-fields">
        <Field
          label={t("Pricing category", "دسته قیمت‌گذاری")}
          error={categoryError}
        >
          <Select
            id={`${formId}-pricing_category`}
            value={category}
            onChange={onCategoryChange}
            options={activePricingCategories(state.config).map((item) => ({
              value: item.key,
              label: categoryLabel(item.label, lang),
            }))}
          />
        </Field>
        <Field
          label={t("Cost before tax", "هزینه پیش از مالیات")}
          error={costError}
        >
          <div
            className="weight-product-cost ui-control-row"
            data-alignment-row="weight-cost"
          >
            <input
              id={`${formId}-cost`}
              aria-label={t("Cost before tax", "هزینه پیش از مالیات")}
              dir="ltr"
              inputMode="decimal"
              value={cost}
              onChange={(event) => onCostChange(event.target.value)}
            />
            <SegmentedControl
              value={unit}
              onChange={(value) => onUnitChange(value as WeightUnit)}
              aria-label={t("Cost unit", "واحد هزینه")}
              options={[
                { value: "lb", label: t("per lb", "هر پوند") },
                { value: "kg", label: t("per kg", "هر کیلو") },
              ]}
            />
          </div>
          <p className="helper weight-product-price-preview">
            {secondaryCost ? (
              <>
                = <Money value={secondaryCost} currency={currency} />{" "}
                {unit === "lb"
                  ? t("per kg", "هر کیلوگرم")
                  : t("per lb", "هر پوند")}
              </>
            ) : (
              "\u00a0"
            )}
          </p>
        </Field>
      </div>
      <div className="weight-product-price-card">
        <div>
          <span className="weight-product-price-label">
            {t("Selling price", "قیمت فروش")}
          </span>
          <p className="weight-product-price-main">
            {pricePerLb ? (
              <Money value={pricePerLb} currency={currency} />
            ) : (
              "—"
            )}
            <span>{t("/lb", "/پوند")}</span>
          </p>
          <p className="muted weight-product-price-second">
            {pricePerLb ? (
              <>
                <Money
                  value={new Decimal(pricePerLb).times(factor).toFixed(2)}
                  currency={currency}
                />{" "}
                {t("/kg", "/کیلوگرم")} · {t("Before tax", "پیش از مالیات")}
              </>
            ) : (
              t("Before tax", "پیش از مالیات")
            )}
          </p>
        </div>
        <div className="weight-product-price-why">
          <p className="helper">
            {calculation ? (
              <>
                {t(`${categoryName} rule: `, `قاعده ${categoryName}: `)}
                <Money
                  value={calculation.canonical_cost_per_lb}
                  currency={currency}
                />{" "}
                <LtrText>
                  ÷ {calculation.divisor} ={" "}
                  <Money
                    value={new Decimal(calculation.raw_price).toFixed(2)}
                    currency={currency}
                  />
                </LtrText>{" "}
                → {t("rounded to", "گرد به")}{" "}
                <Money value={calculation.selling_price} currency={currency} />
              </>
            ) : (
              t(
                "Enter the cost to preview the pricing rule.",
                "برای پیش‌نمایش قاعده قیمت، هزینه را وارد کنید.",
              )
            )}
          </p>
          <Button variant="plain" onClick={onChangePrice}>
            {t("Change price", "تغییر قیمت")}
          </Button>
        </div>
      </div>
      {pendingPerLb && pendingPerLb !== pricePerLb && (
        <p className="weight-product-price-preview">
          <Badge tone="pending">{t("Pending", "در انتظار")}</Badge>{" "}
          <Money value={pendingPerLb} currency={currency} />
          <LtrText>/lb</LtrText> ·{" "}
          {t(
            "The approved price stays until this price is approved.",
            "قیمت تأییدشده تا تأیید این قیمت باقی می‌ماند.",
          )}
        </p>
      )}
      {newProduct && newManualPrice !== undefined && (
        <Field
          className="weight-product-price-edit"
          label={t("Draft selling price per lb", "قیمت پیش‌نویس هر پوند")}
        >
          <input
            id={`${formId}-price`}
            inputMode="decimal"
            dir="ltr"
            value={newManualPrice}
            onChange={(event) => onNewManualPriceChange?.(event.target.value)}
          />
        </Field>
      )}
    </>
  );
}
