import { useState } from "react";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  NumberField,
  Dialog,
  Select,
  Switch,
} from "../ui";
import "./invoice-settings-labels.css";
import {
  calculatePrice,
  type PricingErrorCode,
  type PricingResult,
  PricingValidationError,
  validatePricingConfig,
} from "../pricing";
import { savePricingSettings, type PricingCategory } from "../settings";
import type { CompanyConfig } from "../types";
import {
  calculateWeighedPrice,
  weighedSettings,
  type WeightUnit,
} from "../weighed";
import { ProductPrice } from "../weight-price-presentation";

type Translate = (en: string, fa: string) => string;
type RuleArea = "bands" | "minimum" | "corrections";

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

function categoryLabel(
  key: string,
  label: string,
  t: Translate,
  labelFa?: string,
): string {
  const labels: Record<string, string> = {
    grocery: "مواد غذایی",
    grocery_taxable: "مواد غذایی (مشمول مالیات)",
    rice: "برنج",
    kitchenware: "لوازم آشپزخانه",
  };
  return t(label, labelFa || labels[key] || label);
}

export default function PricingSettings() {
  const { state, update, t, money, user, role } = useDemo();
  const [draft, setDraft] = useState<CompanyConfig>(() =>
    structuredClone(state.config),
  );
  const [editing, setEditing] = useState<PricingCategory | null>(null);
  const [newCategory, setNewCategory] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [categoryErrors, setCategoryErrors] = useState<
    Partial<Record<keyof PricingCategory, string>>
  >({});
  const [ruleErrors, setRuleErrors] = useState<
    Partial<Record<RuleArea, string>>
  >({});
  const [categoryKey, setCategoryKey] = useState(
    state.config.pricing_categories[0]?.key ?? "",
  );
  const [cost, setCost] = useState("1.00");
  const [soldBy, setSoldBy] = useState("each");
  const [costUnit, setCostUnit] = useState<WeightUnit>("kg");
  const [invalidDivisors, setInvalidDivisors] = useState<
    Record<string, string>
  >({});
  const [divisorErrors, setDivisorErrors] = useState<
    Record<string, PricingErrorCode>
  >({});
  let result: PricingResult | null = null;
  let costError: string | undefined;
  let categoryError: string | undefined;
  try {
    result =
      soldBy === "weight"
        ? calculateWeighedPrice(cost, costUnit, categoryKey, draft)
        : calculatePrice(cost, categoryKey, draft);
  } catch (error) {
    const code =
      error instanceof PricingValidationError ? error.code : "invalid_cost";
    if (code === "invalid_cost") costError = errorText(code, t);
    if (code === "unknown_category") categoryError = errorText(code, t);
  }

  function changeDraft(
    area: RuleArea,
    change: (previous: CompanyConfig) => CompanyConfig,
  ) {
    setDraft(change);
    setRuleErrors((previous) => {
      const next = { ...previous };
      delete next[area];
      return next;
    });
  }

  function changeCategory(changes: Partial<PricingCategory>) {
    if (!editing) return;
    setEditing({ ...editing, ...changes });
    setCategoryErrors((previous) => {
      const next = { ...previous };
      for (const field of Object.keys(changes) as (keyof PricingCategory)[])
        delete next[field];
      return next;
    });
  }

  function pricingRuleError(error: unknown): boolean {
    if (!(error instanceof PricingValidationError)) return false;
    const area =
      error.code === "invalid_bands" || error.code === "invalid_ending"
        ? "bands"
        : error.code === "invalid_minimum"
          ? "minimum"
          : error.code === "invalid_correction"
            ? "corrections"
            : undefined;
    if (!area) return false;
    setRuleErrors((previous) => ({
      ...previous,
      [area]: errorText(error.code, t),
    }));
    return true;
  }

  function editDivisor(key: string, value: string) {
    const candidate = structuredClone(draft);
    candidate.pricing_categories.find(
      (entry) => entry.key === key,
    )!.cost_divisor = value;
    try {
      // An unfinished rule field must not make a valid divisor look invalid.
      validatePricingConfig({
        ...candidate,
        rounding_bands: state.config.rounding_bands,
        special_corrections: state.config.special_corrections,
      });
      setDraft(candidate);
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

  const dirty =
    JSON.stringify([
      draft.pricing_categories,
      draft.rounding_bands,
      draft.special_corrections,
      weighedSettings(draft),
    ]) !==
    JSON.stringify([
      state.config.pricing_categories,
      state.config.rounding_bands,
      state.config.special_corrections,
      weighedSettings(state.config),
    ]);
  function save() {
    try {
      validatePricingConfig(draft);
      update((next) =>
        savePricingSettings(next, draft, {
          role: role ?? "cashier",
          company_id: state.config.company.seed_key,
          by: user?.name ?? "",
        }),
      );
      setSaveError(undefined);
      setRuleErrors({});
    } catch (error) {
      if (pricingRuleError(error)) return;
      setSaveError(
        error instanceof PricingValidationError
          ? errorText(error.code, t)
          : t(
              "Check the category names and try again.",
              "نام دسته‌ها را بررسی کنید و دوباره تلاش کنید.",
            ),
      );
    }
  }
  function editCategory(category: PricingCategory | null) {
    setNewCategory(!category);
    setEditing(
      category
        ? structuredClone(category)
        : {
            ...structuredClone(draft.pricing_categories[0]),
            key: "",
            label: "",
            label_fa: "",
            archived: false,
          },
    );
    setSaveError(undefined);
    setCategoryErrors({});
  }
  function confirmCategory() {
    if (!editing) return;
    const category = {
      ...editing,
      key: newCategory
        ? editing.label
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "") ||
          `category_${draft.pricing_categories.length + 1}`
        : editing.key,
    };
    if (
      !category.label.trim() ||
      (newCategory &&
        draft.pricing_categories.some((item) => item.key === category.key))
    ) {
      setCategoryErrors({
        label: t(
          "Use a category name that is not already in the list.",
          "نام دسته‌ای را وارد کنید که در فهرست وجود ندارد.",
        ),
      });
      return;
    }
    const candidate = structuredClone(draft);
    if (newCategory) candidate.pricing_categories.push(category);
    else
      candidate.pricing_categories = candidate.pricing_categories.map((item) =>
        item.key === category.key ? category : item,
      );
    try {
      validatePricingConfig(candidate);
      setDraft(candidate);
      setEditing(null);
      setSaveError(undefined);
      setCategoryErrors({});
    } catch (error) {
      const code =
        error instanceof PricingValidationError
          ? error.code
          : "invalid_divisor";
      const field =
        code === "invalid_divisor"
          ? "cost_divisor"
          : code === "invalid_margin"
            ? "minimum_margin"
            : code === "invalid_rounding"
              ? "rounding"
              : code === "invalid_ending" &&
                  editing.rounding === "always_up_to_next_99"
                ? "rounding_ending"
                : undefined;
      if (field)
        setCategoryErrors((previous) => ({
          ...previous,
          [field]: errorText(code, t),
        }));
      else setSaveError(errorText(code, t));
    }
  }

  return (
    <>
      <Card title={t("Pricing categories", "دسته‌های قیمت‌گذاری")}>
        <p className="muted">
          {t(
            "Preview pricing rules before saving. Approved selling prices stay unchanged.",
            "قواعد قیمت‌گذاری را پیش از ذخیره بررسی کنید. قیمت فروش تأییدشده تغییر نمی‌کند.",
          )}
        </p>
        <div className="settings-section-actions">
          <Button onClick={() => editCategory(null)}>
            {t("Add category", "افزودن دسته")}
          </Button>
        </div>
        <DataTable
          className="settings-pricing-table"
          columns={[
            { width: 210 },
            { width: 120 },
            { width: 135 },
            { width: 180 },
            { width: 75 },
            { width: 90 },
            { width: 180, actions: true },
          ]}
        >
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
              <th scope="col" className="actions-column">
                {t("Actions", "عملیات")}
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.pricing_categories.map((category) => (
              <tr key={category.key}>
                <th scope="row">
                  {categoryLabel(
                    category.key,
                    category.label,
                    t,
                    category.label_fa,
                  )}
                  {category.archived && (
                    <Badge>{t("Archived", "بایگانی‌شده")}</Badge>
                  )}
                </th>
                <td>
                  <label
                    className="sr-only"
                    htmlFor={`divisor-${category.key}`}
                  >
                    {t("Cost divisor for", "ضریب تقسیم برای")}{" "}
                    {categoryLabel(
                      category.key,
                      category.label,
                      t,
                      category.label_fa,
                    )}
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
                <td className="actions-column">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => editCategory(category)}
                  >
                    {t("Edit", "ویرایش")}
                  </Button>
                  <Button
                    variant={category.archived ? "secondary" : "danger"}
                    size="sm"
                    onClick={() =>
                      setDraft((previous) => ({
                        ...previous,
                        pricing_categories: previous.pricing_categories.map(
                          (item) =>
                            item.key === category.key
                              ? { ...item, archived: !item.archived }
                              : item,
                        ),
                      }))
                    }
                  >
                    {category.archived
                      ? t("Restore", "بازگردانی")
                      : t("Archive", "بایگانی")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>

      <Card
        title={t("Rounding rules", "قواعد گرد کردن")}
        className="settings-form-card"
      >
        <p className="muted">
          {t(
            "These bands apply to every category using configured bands.",
            "این بازه‌ها برای همه دسته‌هایی که از بازه‌های تنظیم‌شده استفاده می‌کنند اعمال می‌شوند.",
          )}
        </p>
        <div className="settings-bands">
          {draft.rounding_bands.bands.map((band, index) => (
            <div className="settings-band-row" key={index}>
              <Field
                label={t("From", "از")}
                error={index === 0 ? ruleErrors.bands : undefined}
              >
                <NumberField
                  dir="ltr"
                  value={band.lower_inclusive}
                  onChange={(value) =>
                    changeDraft("bands", (previous) => ({
                      ...previous,
                      rounding_bands: {
                        ...previous.rounding_bands,
                        bands: previous.rounding_bands.bands.map(
                          (entry, position) =>
                            position === index
                              ? { ...entry, lower_inclusive: value }
                              : entry,
                        ),
                      },
                    }))
                  }
                />
              </Field>
              <Field label={t("Below", "کمتر از")}>
                <NumberField
                  dir="ltr"
                  value={band.upper_exclusive}
                  onChange={(value) =>
                    changeDraft("bands", (previous) => ({
                      ...previous,
                      rounding_bands: {
                        ...previous.rounding_bands,
                        bands: previous.rounding_bands.bands.map(
                          (entry, position) =>
                            position === index
                              ? { ...entry, upper_exclusive: value }
                              : entry,
                        ),
                      },
                    }))
                  }
                />
              </Field>
              <Field label={t("Dollar offset", "تغییر دلار")}>
                <NumberField
                  dir="ltr"
                  value={String(band.dollar_offset)}
                  onChange={(value) =>
                    changeDraft("bands", (previous) => ({
                      ...previous,
                      rounding_bands: {
                        ...previous.rounding_bands,
                        bands: previous.rounding_bands.bands.map(
                          (entry, position) =>
                            position === index
                              ? { ...entry, dollar_offset: Number(value) }
                              : entry,
                        ),
                      },
                    }))
                  }
                />
              </Field>
              <Field label={t("Price ending", "پایان قیمت")}>
                <NumberField
                  dir="ltr"
                  value={band.ending}
                  onChange={(value) =>
                    changeDraft("bands", (previous) => ({
                      ...previous,
                      rounding_bands: {
                        ...previous.rounding_bands,
                        bands: previous.rounding_bands.bands.map(
                          (entry, position) =>
                            position === index
                              ? { ...entry, ending: value }
                              : entry,
                        ),
                      },
                    }))
                  }
                />
              </Field>
            </div>
          ))}
        </div>
        <Field
          label={t("Minimum result", "حداقل نتیجه")}
          className="settings-short-field"
          error={ruleErrors.minimum}
        >
          <NumberField
            dir="ltr"
            value={
              draft.rounding_bands
                .minimum_result_when_previous_dollar_does_not_exist
            }
            onChange={(value) =>
              changeDraft("minimum", (previous) => ({
                ...previous,
                rounding_bands: {
                  ...previous.rounding_bands,
                  minimum_result_when_previous_dollar_does_not_exist: value,
                },
              }))
            }
          />
        </Field>
      </Card>
      <Card
        title={t("Special corrections", "اصلاح‌های ویژه")}
        className="settings-form-card"
      >
        <div className="settings-correction-list">
          {draft.special_corrections.map((correction, index) => (
            <div className="settings-correction-row" key={index}>
              <Field
                label={t("From price", "از قیمت")}
                error={index === 0 ? ruleErrors.corrections : undefined}
              >
                <NumberField
                  dir="ltr"
                  value={correction.from}
                  onChange={(value) =>
                    changeDraft("corrections", (previous) => ({
                      ...previous,
                      special_corrections: previous.special_corrections.map(
                        (entry, position) =>
                          position === index
                            ? { ...entry, from: value }
                            : entry,
                      ),
                    }))
                  }
                />
              </Field>
              <Field label={t("To price", "به قیمت")}>
                <NumberField
                  dir="ltr"
                  value={correction.to}
                  onChange={(value) =>
                    changeDraft("corrections", (previous) => ({
                      ...previous,
                      special_corrections: previous.special_corrections.map(
                        (entry, position) =>
                          position === index ? { ...entry, to: value } : entry,
                      ),
                    }))
                  }
                />
              </Field>
              <Button
                variant="secondary"
                onClick={() =>
                  changeDraft("corrections", (previous) => ({
                    ...previous,
                    special_corrections: previous.special_corrections.filter(
                      (_, position) => position !== index,
                    ),
                  }))
                }
              >
                {t("Remove", "برداشتن")}
              </Button>
            </div>
          ))}
        </div>
        <div className="settings-section-actions">
          <Button
            variant="secondary"
            onClick={() =>
              changeDraft("corrections", (previous) => ({
                ...previous,
                special_corrections: [
                  ...previous.special_corrections,
                  { from: "0.00", to: "0.00" },
                ],
              }))
            }
          >
            {t("Add correction", "افزودن اصلاح")}
          </Button>
        </div>
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
          <Field label={t("Sold by", "روش فروش")}>
            <Select
              value={soldBy}
              onChange={setSoldBy}
              options={[
                { value: "each", label: t("Each", "عدد") },
                { value: "weight", label: t("Weight", "وزن") },
              ]}
            />
          </Field>
          {soldBy === "weight" && (
            <Field label={t("Cost unit", "واحد هزینه")}>
              <Select
                value={costUnit}
                onChange={(value) => setCostUnit(value as WeightUnit)}
                options={[
                  { value: "kg", label: "kg" },
                  { value: "lb", label: "lb" },
                ]}
              />
            </Field>
          )}
          <Field
            label={t("Pricing category", "دسته قیمت‌گذاری")}
            error={categoryError}
          >
            <Select
              value={categoryKey}
              onChange={setCategoryKey}
              options={draft.pricing_categories.map((category) => ({
                value: category.key,
                label: categoryLabel(
                  category.key,
                  category.label,
                  t,
                  category.label_fa,
                ),
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
                {soldBy === "weight" ? (
                  <ProductPrice
                    value={result.selling_price}
                    product={{ sold_by: "weight" }}
                    config={draft}
                  />
                ) : (
                  money(result.selling_price)
                )}
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
      {saveError && !editing && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      {dirty && (
        <div className="settings-save-bar">
          <span>{t("Unsaved changes", "تغییرات ذخیره‌نشده")}</span>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(structuredClone(state.config));
              setInvalidDivisors({});
              setDivisorErrors({});
              setSaveError(undefined);
              setRuleErrors({});
            }}
          >
            {t("Cancel", "لغو")}
          </Button>
          <Button
            disabled={Object.keys(divisorErrors).length > 0}
            onClick={save}
          >
            {t("Save changes", "ذخیره تغییرات")}
          </Button>
        </div>
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setSaveError(undefined);
            setCategoryErrors({});
          }
        }}
        title={
          newCategory
            ? t("Add category", "افزودن دسته")
            : t("Edit category", "ویرایش دسته")
        }
        className="settings-dialog"
      >
        {editing && (
          <>
            <div className="form-grid settings-dialog-fields">
              <Field
                label={t("Name (English)", "نام (انگلیسی)")}
                error={categoryErrors.label}
              >
                <input
                  value={editing.label}
                  onChange={(event) =>
                    changeCategory({ label: event.target.value })
                  }
                />
              </Field>
              <Field label={t("Name (Persian)", "نام (فارسی)")}>
                <input
                  dir="rtl"
                  value={editing.label_fa ?? ""}
                  onChange={(event) =>
                    changeCategory({ label_fa: event.target.value })
                  }
                />
              </Field>
              <Field
                label={t("Cost divisor", "ضریب تقسیم هزینه")}
                error={categoryErrors.cost_divisor}
              >
                <NumberField
                  dir="ltr"
                  value={editing.cost_divisor}
                  onChange={(value) => changeCategory({ cost_divisor: value })}
                />
              </Field>
              <Field
                label={t("Rounding rule", "قاعده گرد کردن")}
                error={categoryErrors.rounding}
              >
                <Select
                  value={editing.rounding}
                  onChange={(value) =>
                    changeCategory({
                      rounding: value,
                      rounding_ending: editing.rounding_ending ?? "0.99",
                    })
                  }
                  options={[
                    {
                      value: "bands",
                      label: t("Configured bands", "بازه‌های تنظیم‌شده"),
                    },
                    {
                      value: "always_up_to_next_99",
                      label: t(
                        "Always up to next .99",
                        "همیشه رو به بالا تا ‎.99",
                      ),
                    },
                  ]}
                />
              </Field>
              {editing.rounding === "always_up_to_next_99" && (
                <Field
                  label={t("Price ending", "پایان قیمت")}
                  error={categoryErrors.rounding_ending}
                >
                  <NumberField
                    dir="ltr"
                    value={editing.rounding_ending ?? "0.99"}
                    onChange={(value) =>
                      changeCategory({ rounding_ending: value })
                    }
                  />
                </Field>
              )}
              <Field label={t("Tax profile", "پروفایل مالیات")}>
                <Select
                  value={editing.default_tax_profile}
                  onChange={(value) =>
                    changeCategory({
                      default_tax_profile: value,
                      taxable:
                        draft.tax.profiles.find(
                          (profile) => profile.key === value,
                        )?.taxable ?? false,
                    })
                  }
                  options={draft.tax.profiles.map((profile) => ({
                    value: profile.key,
                    label: t(profile.label_en, profile.label_fa),
                  }))}
                />
              </Field>
              <Field
                label={t("Minimum margin", "حداقل حاشیه سود")}
                error={categoryErrors.minimum_margin}
                hint={t(
                  "A fraction from 0 to 1; for example, 0.25 means 25%.",
                  "کسر بین 0 و 1؛ برای نمونه 0.25 یعنی 25٪.",
                )}
              >
                <NumberField
                  dir="ltr"
                  value={editing.minimum_margin ?? ""}
                  disabled={editing.minimum_margin === null}
                  onChange={(value) =>
                    changeCategory({ minimum_margin: value })
                  }
                />
              </Field>
            </div>
            <div className="settings-switch-list">
              <Switch
                checked={editing.minimum_margin !== null}
                onChange={(value) =>
                  changeCategory({
                    minimum_margin: value ? "0.25" : null,
                  })
                }
              >
                {t("Minimum margin active", "حداقل حاشیه سود فعال")}
              </Switch>
              <Switch
                checked={editing.apply_special_correction}
                onChange={(value) =>
                  changeCategory({
                    apply_special_correction: value,
                    apply_2_49_3_49_correction: value,
                  })
                }
              >
                {t("Special corrections", "اصلاح‌های ویژه")}
              </Switch>
              <Switch
                checked={editing.date_tracking_prompt}
                onChange={(value) =>
                  changeCategory({ date_tracking_prompt: value })
                }
              >
                {t("Date tracking prompt", "پرسش پیگیری تاریخ")}
              </Switch>
            </div>
            {saveError && (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="settings-section-actions c3-dialog-actions">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                {t("Cancel", "لغو")}
              </Button>
              <Button onClick={confirmCategory}>
                {t("Apply category", "اعمال دسته")}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
