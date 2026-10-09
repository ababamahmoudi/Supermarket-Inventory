import { useState } from "react";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import {
  Badge,
  Card,
  DataTable,
  Field,
  NumberField,
  PageHeader,
  Select,
} from "../ui";
import "./invoice-settings-labels.css";
import {
  calculatePrice,
  type PricingErrorCode,
  type PricingResult,
  PricingValidationError,
  validatePricingConfig,
} from "../pricing";

type Translate = (en: string, fa: string) => string;

function errorText(code: PricingErrorCode, t: Translate): string {
  const messages: Record<PricingErrorCode, [string, string]> = {
    invalid_cost: [
      "Enter a cost of zero or more, with no more than four decimal places.",
      "هزینه صفر یا بیشتر، با حداکثر چهار رقم اعشار وارد کنید.",
    ],
    invalid_divisor: [
      "Enter a divisor greater than zero. The previous valid value is still in use.",
      "ضریب تقسیم بزرگ‌تر از صفر وارد کنید. مقدار معتبر قبلی همچنان استفاده می‌شود.",
    ],
    unknown_category: [
      "Choose a pricing category from the list.",
      "یک دسته قیمت‌گذاری از فهرست انتخاب کنید.",
    ],
    invalid_bands: [
      "Rounding bands must cover zero to one without gaps or overlaps.",
      "بازه‌های گرد کردن باید از صفر تا یک، بدون فاصله یا هم‌پوشانی باشند.",
    ],
    invalid_ending: [
      "Use a price ending from 0.00 to 0.99, with no more than two decimal places.",
      "پایان قیمت را بین 0.00 و 0.99، با حداکثر دو رقم اعشار وارد کنید.",
    ],
    invalid_correction: [
      "Corrections must use unique source prices and nonnegative two-decimal amounts.",
      "اصلاح قیمت باید مبدأ یکتا و مبلغ غیرمنفی با دو رقم اعشار داشته باشد.",
    ],
    invalid_minimum: [
      "Use a nonnegative minimum price with no more than two decimal places.",
      "حداقل قیمت غیرمنفی با حداکثر دو رقم اعشار وارد کنید.",
    ],
    invalid_margin: [
      "Use a minimum margin from zero to one, or leave it inactive.",
      "حداقل حاشیه سود بین صفر و یک باشد یا غیرفعال بماند.",
    ],
    invalid_rounding: [
      "Choose a supported rounding method.",
      "یک روش گرد کردن پشتیبانی‌شده انتخاب کنید.",
    ],
  };
  return t(...messages[code]);
}

function categoryLabel(key: string, label: string, t: Translate): string {
  const labels: Record<string, string> = {
    grocery: "مواد غذایی",
    grocery_taxable: "مواد غذایی (مشمول مالیات)",
    rice: "برنج",
    kitchenware: "لوازم آشپزخانه",
  };
  return t(label, labels[key] ?? label);
}

export default function Settings() {
  const { state, update, t, money } = useDemo();
  const [categoryKey, setCategoryKey] = useState(
    state.config.pricing_categories[0]?.key ?? "",
  );
  const [cost, setCost] = useState("1.00");
  const [invalidDivisors, setInvalidDivisors] = useState<
    Record<string, string>
  >({});
  const [divisorErrors, setDivisorErrors] = useState<
    Record<string, PricingErrorCode>
  >({});
  let result: PricingResult | null = null;
  let costError: string | undefined;
  try {
    result = calculatePrice(cost, categoryKey, state.config);
  } catch (error) {
    costError = errorText(
      error instanceof PricingValidationError ? error.code : "invalid_cost",
      t,
    );
  }

  function editDivisor(key: string, value: string) {
    const candidate = structuredClone(state.config);
    candidate.pricing_categories.find(
      (entry) => entry.key === key,
    )!.cost_divisor = value;
    try {
      validatePricingConfig(candidate);
      update((draft) => {
        draft.config = candidate;
      });
      setInvalidDivisors((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      setDivisorErrors((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    } catch (error) {
      setInvalidDivisors((previous) => ({ ...previous, [key]: value }));
      setDivisorErrors((previous) => ({
        ...previous,
        [key]:
          error instanceof PricingValidationError
            ? error.code
            : "invalid_divisor",
      }));
    }
  }

  return (
    <>
      <PageHeader
        title={t("Settings", "تنظیمات")}
        description={t(
          "Change pricing rules and see calculated prices update immediately.",
          "قواعد قیمت‌گذاری را تغییر دهید و نتیجه محاسبه را بلافاصله ببینید.",
        )}
      />
      <Card title={t("Pricing categories", "دسته‌های قیمت‌گذاری")}>
        <p className="muted">
          {t(
            "Valid divisor changes save automatically in this demo. Approved selling prices still require Supervisor approval.",
            "تغییر معتبر ضریب تقسیم در این دمو خودکار ذخیره می‌شود. تغییر قیمت فروش تأییدشده همچنان به تأیید سرپرست نیاز دارد.",
          )}
        </p>
        <DataTable>
          <thead>
            <tr>
              <th scope="col">{t("Category", "دسته")}</th>
              <th scope="col">{t("Cost divisor", "ضریب تقسیم هزینه")}</th>
              <th scope="col">{t("Rounding", "گرد کردن")}</th>
              <th scope="col">{t("Tax", "مالیات")}</th>
              <th scope="col">
                {t("Date tracking prompt", "پرسش پیگیری تاریخ")}
              </th>
              <th scope="col">{t("Minimum margin", "حداقل حاشیه سود")}</th>
            </tr>
          </thead>
          <tbody>
            {state.config.pricing_categories.map((category) => (
              <tr key={category.key}>
                <th scope="row">
                  {categoryLabel(category.key, category.label, t)}
                </th>
                <td>
                  <label
                    className="sr-only"
                    htmlFor={`divisor-${category.key}`}
                  >
                    {t("Cost divisor for", "ضریب تقسیم برای")}{" "}
                    {categoryLabel(category.key, category.label, t)}
                  </label>
                  <NumberField
                    id={`divisor-${category.key}`}
                    dir="ltr"
                    className="numeric control-narrow"
                    value={
                      invalidDivisors[category.key] ?? category.cost_divisor
                    }
                    onChange={(value) => editDivisor(category.key, value)}
                    aria-invalid={Boolean(divisorErrors[category.key])}
                    aria-describedby={
                      divisorErrors[category.key]
                        ? `divisor-error-${category.key}`
                        : undefined
                    }
                  />
                  {divisorErrors[category.key] && (
                    <p
                      id={`divisor-error-${category.key}`}
                      className="form-error"
                      role="alert"
                    >
                      {errorText(divisorErrors[category.key], t)}
                    </p>
                  )}
                </td>
                <td>
                  {category.rounding === "bands"
                    ? t("Configured bands", "بازه‌های تنظیم‌شده")
                    : t(
                        "Round up to configured ending",
                        "گرد کردن رو به بالا تا پایان تنظیم‌شده",
                      )}
                </td>
                <td>
                  {category.taxable ? (
                    <Badge tone="info">{t("Taxable", "مشمول مالیات")}</Badge>
                  ) : (
                    t("Non-taxable", "غیرمشمول مالیات")
                  )}
                </td>
                <td>
                  {category.date_tracking_prompt
                    ? t("Yes", "بله")
                    : t("No", "خیر")}
                </td>
                <td>
                  <bdi dir="ltr">
                    {category.minimum_margin === null
                      ? t("Inactive", "غیرفعال")
                      : `${new Decimal(category.minimum_margin).times("100").toFixed(0)}%`}
                  </bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>

      <Card
        title={t("Price tester", "آزمایش قیمت")}
        className="settings-price-tester"
      >
        <p className="muted">
          {t(
            "Use a cost before tax. This preview uses the current rules and does not change an approved price.",
            "هزینه پیش از مالیات را وارد کنید. این پیش‌نمایش از قواعد فعلی استفاده می‌کند و قیمت تأییدشده را تغییر نمی‌دهد.",
          )}
        </p>
        <div className="form-grid settings-tester-fields">
          <Field label={t("Pricing category", "دسته قیمت‌گذاری")}>
            <Select
              value={categoryKey}
              onChange={setCategoryKey}
              options={state.config.pricing_categories.map((category) => ({
                value: category.key,
                label: categoryLabel(category.key, category.label, t),
              }))}
            />
          </Field>
          <Field
            label={t("Unit cost before tax", "هزینه هر واحد پیش از مالیات")}
            error={costError}
          >
            <NumberField
              dir="ltr"
              value={cost}
              onChange={setCost}
              aria-invalid={Boolean(costError)}
            />
          </Field>
        </div>
        {result && (
          <div aria-live="polite">
            <div className="price-display">
              <bdi dir="ltr" className="numeric">
                {money(result.selling_price)}
              </bdi>
            </div>
            <p className="muted">
              {t(
                "Calculated selling price before tax",
                "قیمت فروش محاسبه‌شده پیش از مالیات",
              )}
            </p>
            <dl className="detail-list settings-calculation-steps">
              <dt>{t("Raw cost ÷ divisor", "هزینه ÷ ضریب تقسیم")}</dt>
              <dd dir="ltr" className="numeric">
                {new Decimal(result.raw_price).toFixed(6)}
              </dd>
              <dt>{t("Cent-rounded raw", "مقدار خام گرد‌شده به سنت")}</dt>
              <dd dir="ltr" className="numeric">
                {result.rounded_raw}
              </dd>
              <dt>{t("After band rounding", "پس از گرد کردن بازه‌ای")}</dt>
              <dd dir="ltr" className="numeric">
                {result.after_band_rounding ?? t("Not used", "استفاده نمی‌شود")}
              </dd>
              <dt>{t("Special correction applied", "اصلاح ویژه اعمال شد")}</dt>
              <dd>
                {result.special_correction_applied
                  ? t("Yes", "بله")
                  : t("No", "خیر")}
              </dd>
              <dt>{t("Calculated margin", "حاشیه سود محاسبه‌شده")}</dt>
              <dd dir="ltr" className="numeric">
                {result.margin === null
                  ? t("Cannot calculate", "قابل محاسبه نیست")
                  : `${new Decimal(result.margin).times("100").toFixed(2)}%`}
              </dd>
            </dl>
            {result.below_minimum_margin && (
              <Badge tone="pending">
                {t("Below minimum margin", "کمتر از حداقل حاشیه سود")}
              </Badge>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
