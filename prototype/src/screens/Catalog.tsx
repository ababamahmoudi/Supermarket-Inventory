import "../c3-tables.css";
import { translateCount } from "../i18n";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Decimal from "decimal.js";
import { Search, ScanLine, ArrowLeft, MoreHorizontal } from "lucide-react";
import "../catalog-a2.css";
import {
  effectiveOffer,
  effectivePrice,
  lookupBranch,
  pendingPrice,
  searchProducts,
} from "../catalog";
import { useDemo } from "../store";
import { useListState } from "../navigation";
import {
  configuredBranches,
  branchLabel as configuredBranchLabel,
  activePricingCategories,
  sellingBranches,
  branchSellsToCustomers,
} from "../settings";
import {
  supplierChoices,
  supplierRecords,
  supplierMatches,
} from "../supplier-editor";
import {
  addProduct,
  nextProductCode,
  similarProductNames,
  NewProductError,
  type NewProductEdits,
} from "../manual-product";
import { calculatePrice } from "../pricing";
import {
  approvedWeightPricePerLb,
  calculateWeighedPrice,
  weightCostPerLb,
  weightPriceDisplay,
  weighedSettings,
  type WeightUnit,
} from "../weighed";
import {
  ProductPrice as SellingPrice,
  ProductCost,
} from "../weight-price-presentation";
import { AddDateDialog } from "../AddDateDialog";
import { ProductDatesSection } from "../ProductDatesSection";
import { manualPrice, sellingMargin } from "../manual-prices";
import {
  ManualPriceDetails,
  ManualPricePill,
} from "../manual-price-presentation";
import { productCostHistory, productStoreCost } from "../product-costs";
import { lastReceivedByLocation } from "../received";
import "./manual-entry.css";
import "./c5-catalog-offers.css";
import type { Branch, Product } from "../types";
import {
  productEditSnapshot,
  saveProductEdits,
  recordProductBarcodeConflict,
  ProductEditError,
  type ProductEdits,
  type ProductEditErrorCode,
} from "../product-editor";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Dialog,
  PageHeader,
  FilterToolbar,
  Select,
  useTableColumns,
  Menu,
  MenuItem,
} from "../ui";

import {
  activityLabel,
  categoryLabel,
  demoUserLabel,
  DateText,
  LtrText,
  OfferLabel,
  UnitSize,
} from "../presentation";

const PAGE_SIZE = 8;

function ProductProvenance({ product }: { product: Product }) {
  const { branch, t, lang, state } = useDemo();
  const source =
    product.price_provenance?.[lookupBranch(branch)] ??
    product.price_provenance?.all;
  if (!source) return null;
  return (
    <p className="helper product-price-provenance">
      {t("Calculated from invoice", "محاسبه‌شده از فاکتور")}{" "}
      <LtrText>{source.invoice_number}</LtrText>:{" "}
      <SellingPrice
        value={source.calculated_price}
        product={product}
        config={state.config}
      />
      {source.changed_price && (
        <>
          {" "}
          · {t("Changed by", "تغییریافته توسط")}{" "}
          <bdi dir="auto">{demoUserLabel(source.changed_by ?? "", lang)}</bdi>{" "}
          {t("on", "در")} <DateText value={source.changed_at} />:{" "}
          <SellingPrice
            value={source.changed_price}
            product={product}
            config={state.config}
          />
        </>
      )}
    </p>
  );
}

function editorError(
  code: ProductEditErrorCode | NewProductError["code"],
  t: (en: string, fa: string) => string,
): string {
  const messages: Record<
    ProductEditErrorCode | NewProductError["code"],
    [string, string]
  > = {
    cost: [
      "Enter a unit cost with at most four decimals.",
      "هزینهٔ واحد را با حداکثر چهار رقم اعشار وارد کنید.",
    ],
    margin: [
      "Confirm the price below the minimum margin before saving.",
      "پیش از ذخیره، قیمت زیر حداقل حاشیه را تأیید کنید.",
    ],
    similar: [
      "Review the similar product before saving.",
      "پیش از ذخیره، محصول مشابه را بررسی کنید.",
    ],
    inventory_disabled: [
      "Opening counts are not available. Record a delivery through an invoice.",
      "ثبت موجودی اولیه در دسترس نیست. تحویل را از طریق فاکتور ثبت کنید.",
    ],
    permission: [
      "Only a Supervisor can edit products.",
      "فقط سرپرست می‌تواند محصول را ویرایش کند.",
    ],
    company: [
      "This product belongs to another company.",
      "این محصول متعلق به شرکت دیگری است.",
    ],
    branch: [
      "Choose an allowed branch for this price change.",
      "برای تغییر قیمت یک شعبهٔ مجاز انتخاب کنید.",
    ],
    not_found: ["Product not found.", "محصول یافت نشد."],
    stale: [
      "This product changed. Close the editor and open it again.",
      "این محصول تغییر کرده است. ویرایشگر را ببندید و دوباره باز کنید.",
    ],
    name_en: ["Add the English name.", "نام انگلیسی را وارد کنید."],
    name_fa: ["Add the Persian name.", "نام فارسی را وارد کنید."],
    unit_size: ["Add the unit size.", "اندازهٔ واحد را وارد کنید."],
    category: ["Choose a category.", "یک دسته انتخاب کنید."],
    pricing_category: [
      "Choose a configured pricing category.",
      "یک دستهٔ قیمت‌گذاری موجود انتخاب کنید.",
    ],
    supplier: ["Choose a supplier.", "یک تأمین‌کننده انتخاب کنید."],
    barcode_conflict: [
      "This barcode belongs to another product. Use a different barcode.",
      "این بارکد متعلق به محصول دیگری است. بارکد دیگری وارد کنید.",
    ],
    price: [
      "Enter a selling price greater than zero, with at most two decimals.",
      "قیمت فروش بزرگ‌تر از صفر و حداکثر با دو رقم اعشار وارد کنید.",
    ],
  };
  return t(...messages[code]);
}

export function ProductEditor({
  product: existingProduct,
  onClose,
  invoiceQuickAdd = false,
  onCreated,
}: {
  product?: Product;
  onClose: () => void;
  invoiceQuickAdd?: boolean;
  onCreated?: (product: Product) => void;
}) {
  const { state, branch, role, user, lang, t, update, navigate } = useDemo();
  const branches = configuredBranches(state.config);
  const priceLocations = sellingBranches(state.config);
  const isNew = !existingProduct;
  const product: Product = existingProduct ?? {
    company_id: state.config.company.seed_key,
    code: nextProductCode(state),
    name_en: "",
    name_fa: "",
    unit_size: "",
    pricing_category: activePricingCategories(state.config)[0]?.key ?? "",
    ai_category:
      state.products.find(
        (item) => item.company_id === state.config.company.seed_key,
      )?.ai_category ?? "",
    barcode: "",
    main_supplier: invoiceQuickAdd
      ? state.invoice.supplier
      : (supplierChoices(state)[0]?.name ?? ""),
    last_cost_before_tax: "",
    selling_price: "",
    offer: null,
    taxable: false,
    status: "active",
    tax_profile: "",
    date_tracking: false,
  };
  const [cost, setCost] = useState("");
  const [costUnit, setCostUnit] = useState<WeightUnit>("lb");
  const [addDateNow, setAddDateNow] = useState(false);
  const [dateProduct, setDateProduct] = useState<string>();
  const [manualPrice, setManualPrice] = useState(false);
  const [similarConfirmed, setSimilarConfirmed] = useState(false);
  const [marginConfirmed, setMarginConfirmed] = useState(false);
  const startingPrice = effectivePrice(state, product, branch) ?? "";
  const [values, setValues] = useState<ProductEdits>({
    name_en: product.name_en,
    name_fa: product.name_fa,
    description_en: product.description_en ?? "",
    description_fa: product.description_fa ?? "",
    unit_size: product.unit_size,
    ai_category: product.ai_category,
    pricing_category: product.pricing_category,
    barcode: product.barcode,
    main_supplier: product.main_supplier,
    date_tracking: product.date_tracking,
    sold_by: product.sold_by ?? "each",
    scope: "all",
  });
  const [sellingPrice, setSellingPrice] = useState(() =>
    product.sold_by === "weight" && startingPrice
      ? weightPriceDisplay(startingPrice, state.config).main.amount
      : startingPrice,
  );
  const [targetBranch, setTargetBranch] = useState<Branch>(
    lookupBranch(branch),
  );
  const [expected, setExpected] = useState(() =>
    isNew ? "" : productEditSnapshot(state, product.code),
  );
  const [error, setError] = useState<
    ProductEditErrorCode | NewProductError["code"] | null
  >(null);
  const patch = <K extends keyof ProductEdits>(
    key: K,
    value: ProductEdits[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    const related =
      error === key ||
      (key === "barcode" && error === "barcode_conflict") ||
      (key === "ai_category" && error === "category") ||
      (key === "pricing_category" && error === "pricing_category") ||
      (key === "main_supplier" && error === "supplier") ||
      (key === "name_en" && error === "similar") ||
      (key === "scope" && error === "branch");
    if (related) setError(null);
  };
  const weightProduct = values.sold_by === "weight";
  const displayUnit = weighedSettings(state.config).main_display_unit;
  const startingDisplayPrice =
    weightProduct && startingPrice
      ? weightPriceDisplay(startingPrice, state.config).main.amount
      : startingPrice;
  const priceChanged = sellingPrice !== startingDisplayPrice;
  const categories = [
    ...new Set(
      state.products
        .filter((item) => item.company_id === product.company_id)
        .map((item) => item.ai_category),
    ),
  ].sort();
  const suppliers = supplierChoices(state).map((item) => item.name);
  if (
    !suppliers.includes(values.main_supplier) &&
    supplierRecords(state).some((item) =>
      supplierMatches(item, values.main_supplier),
    )
  )
    suppliers.push(values.main_supplier);
  let calculatedPrice = "";
  let canonicalCost = cost;
  try {
    const calculation = weightProduct
      ? calculateWeighedPrice(
          cost,
          costUnit,
          values.pricing_category,
          state.config,
        )
      : calculatePrice(cost, values.pricing_category, state.config);
    calculatedPrice = weightProduct
      ? weightPriceDisplay(calculation.selling_price, state.config).main.amount
      : calculation.selling_price;
    canonicalCost = weightProduct
      ? weightCostPerLb(cost, costUnit, state.config)
      : cost;
  } catch {
    /* Invalid draft cost is explained on Save. */
  }
  const effectiveSellingPrice =
    isNew && !manualPrice ? calculatedPrice : sellingPrice;
  let canonicalSellingPrice = effectiveSellingPrice;
  try {
    if (weightProduct && effectiveSellingPrice)
      canonicalSellingPrice = approvedWeightPricePerLb(
        effectiveSellingPrice,
        displayUnit,
        state.config,
      );
  } catch {
    /* Save validates the same draft field. */
  }
  const minimum = state.config.pricing_categories.find(
    (item) => item.key === values.pricing_category,
  )?.minimum_margin;
  const belowMinimum =
    isNew &&
    /^\d+(\.\d{1,4})?$/.test(cost) &&
    /^\d+(\.\d{1,2})?$/.test(canonicalSellingPrice) &&
    minimum !== null &&
    minimum !== undefined &&
    new Decimal(canonicalSellingPrice)
      .minus(canonicalCost)
      .lt(new Decimal(canonicalSellingPrice).times(minimum));
  const similar = isNew ? similarProductNames(state, values.name_en) : [];
  if (
    isNew &&
    role !== "supervisor" &&
    !(role === "floor_worker" && invoiceQuickAdd)
  )
    return null;
  if (dateProduct)
    return (
      <AddDateDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        productCode={dateProduct}
        defaultLocation={lookupBranch(branch)}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        isNew
          ? t("Add product", "افزودن محصول")
          : t("Edit product", "ویرایش محصول")
      }
      className={
        isNew
          ? "product-editor-dialog manual-entry-dialog"
          : "product-editor-dialog"
      }
    >
      <form
        className="stack product-editor-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const context = {
            company_id: state.config.company.seed_key,
            role: role!,
            actor: user!.name,
            branch: values.scope === "branch" ? targetBranch : branch,
            allowed_branches: branches,
          };
          try {
            if (isNew) {
              let created: Product | undefined;
              update((draft) => {
                created = structuredClone(
                  addProduct(
                    draft,
                    context,
                    {
                      ...values,
                      last_cost_before_tax: cost,
                      last_cost_unit: costUnit,
                      selling_price:
                        isNew && !manualPrice
                          ? undefined
                          : canonicalSellingPrice || undefined,
                      minimum_margin_confirmed: marginConfirmed,
                      similar_name_confirmed: similarConfirmed,
                    } as NewProductEdits,
                    invoiceQuickAdd,
                  ),
                );
              });
              onCreated?.(created!);
              if (addDateNow && values.date_tracking) {
                setDateProduct(created!.code);
                return;
              }
              onClose();
              return;
            }
            update((draft) =>
              saveProductEdits(
                draft,
                context,
                product.code,
                {
                  ...values,
                  ...(priceChanged
                    ? { selling_price: canonicalSellingPrice }
                    : {}),
                },
                expected,
              ),
            );
            if (addDateNow && values.date_tracking)
              setDateProduct(product.code);
            else onClose();
          } catch (cause) {
            const code =
              cause instanceof ProductEditError ||
              cause instanceof NewProductError
                ? cause.code
                : "stale";
            if (code === "barcode_conflict" && !isNew) {
              // The rejected catalog draft stays untouched. Its separate
              // approval is now part of the current editing snapshot, so the
              // user can correct this field without reopening the dialog.
              let nextSnapshot = expected;
              update((draft) => {
                recordProductBarcodeConflict(
                  draft,
                  context,
                  product.code,
                  values.barcode,
                );
                nextSnapshot = productEditSnapshot(draft, product.code);
              });
              setExpected(nextSnapshot);
            }
            setError(code);
          }
        }}
      >
        <p className="helper">
          {t("Product Code", "کد محصول")}: <LtrText>{product.code}</LtrText>
        </p>
        <div className="form-grid product-editor-fields">
          <Field
            label={t("English name", "نام انگلیسی")}
            error={error === "name_en" ? editorError(error, t) : undefined}
          >
            <input
              autoFocus
              dir="ltr"
              value={values.name_en}
              onChange={(event) => {
                patch("name_en", event.target.value);
                setSimilarConfirmed(false);
              }}
            />
          </Field>
          <Field
            label={t("Persian name", "نام فارسی")}
            error={error === "name_fa" ? editorError(error, t) : undefined}
          >
            <input
              dir="rtl"
              value={values.name_fa}
              onChange={(event) => patch("name_fa", event.target.value)}
            />
          </Field>
          <Field label={t("Description (English)", "توضیحات (انگلیسی)")}>
            <textarea
              dir="ltr"
              value={values.description_en}
              onChange={(event) => patch("description_en", event.target.value)}
              rows={2}
            />
          </Field>
          <Field label={t("Description (Persian)", "توضیحات (فارسی)")}>
            <textarea
              dir="rtl"
              value={values.description_fa}
              onChange={(event) => patch("description_fa", event.target.value)}
              rows={2}
            />
          </Field>
          <Field
            label={t("Unit size", "اندازهٔ واحد")}
            error={error === "unit_size" ? editorError(error, t) : undefined}
          >
            <input
              dir="ltr"
              value={values.unit_size}
              onChange={(event) => patch("unit_size", event.target.value)}
            />
          </Field>
          <Field label={t("Sold by", "روش فروش")}>
            <Select
              value={values.sold_by ?? "each"}
              onChange={(value) => {
                patch("sold_by", value as "each" | "weight");
                setSellingPrice(
                  value === "weight" && startingPrice
                    ? weightPriceDisplay(startingPrice, state.config).main
                        .amount
                    : startingPrice,
                );
                setManualPrice(false);
                setMarginConfirmed(false);
              }}
              options={[
                { value: "each", label: t("Each", "عدد") },
                { value: "weight", label: t("Weight", "وزن") },
              ]}
            />
          </Field>
          <Field
            label={t("Category", "دسته")}
            error={error === "category" ? editorError(error, t) : undefined}
          >
            <Select
              value={values.ai_category}
              onChange={(value) => patch("ai_category", value)}
              options={categories.map((value) => ({
                value,
                label: categoryLabel(value, lang),
              }))}
            />
          </Field>
          <Field
            label={t("Pricing category", "دستهٔ قیمت‌گذاری")}
            error={
              error === "pricing_category" ? editorError(error, t) : undefined
            }
          >
            <Select
              value={values.pricing_category}
              onChange={(value) => patch("pricing_category", value)}
              options={activePricingCategories(state.config).map((item) => ({
                value: item.key,
                label: categoryLabel(item.label, lang),
              }))}
            />
          </Field>
          <Field
            label={t("Supplier", "تأمین‌کننده")}
            error={error === "supplier" ? editorError(error, t) : undefined}
          >
            <Select
              value={values.main_supplier}
              onChange={(value) => patch("main_supplier", value)}
              options={suppliers.map((value) => ({ value, label: value }))}
            />
          </Field>
          <Field
            label={t("Barcode", "بارکد")}
            error={
              error === "barcode_conflict" ? editorError(error, t) : undefined
            }
          >
            <input
              dir="ltr"
              value={values.barcode}
              onChange={(event) => patch("barcode", event.target.value)}
            />
          </Field>
          {isNew && (
            <Field
              label={t(
                "Last unit cost before tax",
                "آخرین هزینهٔ واحد پیش از مالیات",
              )}
              error={error === "cost" ? editorError(error, t) : undefined}
            >
              <input
                dir="ltr"
                inputMode="decimal"
                className="control-narrow"
                value={cost}
                onChange={(event) => {
                  setCost(event.target.value);
                  setMarginConfirmed(false);
                  if (error === "cost" || error === "margin") setError(null);
                }}
              />
            </Field>
          )}
          {isNew && weightProduct && (
            <Field label={t("Cost unit", "واحد هزینه")}>
              <Select
                value={costUnit}
                onChange={(value) => {
                  setCostUnit(value as WeightUnit);
                  setMarginConfirmed(false);
                  if (error === "cost" || error === "margin") setError(null);
                }}
                options={[
                  { value: "lb", label: "lb" },
                  { value: "kg", label: "kg" },
                ]}
              />
            </Field>
          )}
          <Field
            label={
              weightProduct
                ? displayUnit === "lb"
                  ? t("Selling price (per lb)", "قیمت فروش (هر پوند)")
                  : t("Selling price (per kg)", "قیمت فروش (هر کیلوگرم)")
                : t("Selling price (per unit)", "قیمت فروش (هر واحد)")
            }
            error={error === "price" ? editorError(error, t) : undefined}
            className="short-field"
          >
            <input
              dir="ltr"
              inputMode="decimal"
              value={effectiveSellingPrice}
              readOnly={isNew && role !== "supervisor"}
              onChange={(event) => {
                setSellingPrice(event.target.value);
                setManualPrice(true);
                setMarginConfirmed(false);
                if (error === "price" || error === "margin") setError(null);
              }}
            />
          </Field>
          <Field label={t("Date tracking", "پیگیری تاریخ")}>
            <Select
              value={
                values.date_tracking === undefined
                  ? "unset"
                  : values.date_tracking
                    ? "yes"
                    : "no"
              }
              onChange={(value) => {
                patch(
                  "date_tracking",
                  value === "unset" ? undefined : value === "yes",
                );
                if (value !== "yes") setAddDateNow(false);
              }}
              options={[
                { value: "unset", label: t("Not set", "تنظیم نشده") },
                { value: "yes", label: t("Yes", "بله") },
                { value: "no", label: t("No", "خیر") },
              ]}
            />
          </Field>
          {values.date_tracking && !product.date_tracking && (
            <Checkbox checked={addDateNow} onChange={setAddDateNow}>
              {t("Add a date now", "اکنون یک تاریخ اضافه کنید")}
            </Checkbox>
          )}
        </div>
        {isNew && belowMinimum && role === "supervisor" && (
          <div className="banner info">
            <p>
              {t(
                "This price is below the minimum margin.",
                "این قیمت کمتر از حداقل حاشیه است.",
              )}
            </p>
            <Checkbox
              checked={marginConfirmed}
              onChange={(value) => {
                setMarginConfirmed(value);
                if (error === "margin") setError(null);
              }}
            >
              {t(
                "Confirm price below minimum margin",
                "تأیید قیمت زیر حداقل حاشیه",
              )}
            </Checkbox>
          </div>
        )}
        {!!similar.length && (
          <div className="banner info manual-similar-warning" role="status">
            <p>
              {t(
                "A similar product already exists.",
                "یک محصول مشابه وجود دارد.",
              )}
            </p>
            {similar.map((item) => (
              <Button
                key={item.code}
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigate(`product?code=${item.code}`);
                }}
              >
                {lang === "fa" ? (
                  item.name_fa
                ) : (
                  <LtrText>{item.name_en}</LtrText>
                )}
              </Button>
            ))}
            <Checkbox
              checked={similarConfirmed}
              onChange={(value) => {
                setSimilarConfirmed(value);
                if (error === "similar") setError(null);
              }}
            >
              {t("Continue with this product name", "ادامه با این نام محصول")}
            </Checkbox>
          </div>
        )}
        {!isNew && priceChanged && (
          <div className="stack product-editor-price-scope">
            <Field label={t("Approval scope", "محدودهٔ تأیید")}>
              <Select
                value={values.scope}
                onChange={(value) => patch("scope", value as "all" | "branch")}
                options={[
                  { value: "all", label: t("All branches", "همهٔ شعبه‌ها") },
                  ...(branch === "all" ||
                  branchSellsToCustomers(state.config, branch)
                    ? [
                        {
                          value: "branch",
                          label: t("This branch only", "فقط این شعبه"),
                        },
                      ]
                    : []),
                ]}
              />
            </Field>
            {values.scope === "branch" && branch === "all" && (
              <Field label={t("Branch", "شعبه")}>
                <Select
                  value={targetBranch}
                  onChange={(value) => {
                    setTargetBranch(value as Branch);
                    if (error === "branch") setError(null);
                  }}
                  options={priceLocations.map((value) => ({
                    value,
                    label: configuredBranchLabel(state.config, value, lang),
                  }))}
                />
              </Field>
            )}
            <DataTable
              columns={[
                { width: "40%" },
                { width: "30%", align: "end" },
                { width: "30%", align: "end" },
              ]}
            >
              <thead>
                <tr>
                  <th>{t("Branch", "شعبه")}</th>
                  <th>{t("Old", "قبلی")}</th>
                  <th>{t("New", "جدید")}</th>
                </tr>
              </thead>
              <tbody>
                {(values.scope === "all" ? priceLocations : [targetBranch]).map(
                  (item) => (
                    <tr key={item}>
                      <td>{configuredBranchLabel(state.config, item, lang)}</td>
                      <td>
                        {effectivePrice(state, product, item) ? (
                          <SellingPrice
                            value={effectivePrice(state, product, item)!}
                            product={product}
                            config={state.config}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <LtrText>
                          {/^\d+(\.\d{1,2})?$/.test(sellingPrice) ? (
                            <SellingPrice
                              value={canonicalSellingPrice}
                              product={{ ...product, sold_by: values.sold_by }}
                              config={state.config}
                            />
                          ) : (
                            "—"
                          )}
                        </LtrText>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </DataTable>
          </div>
        )}
        {error &&
          ![
            "name_en",
            "name_fa",
            "unit_size",
            "category",
            "pricing_category",
            "supplier",
            "barcode_conflict",
            "cost",
            "price",
          ].includes(error) && (
            <p className="form-error" role="alert">
              {editorError(error, t)}
            </p>
          )}
        <div className="actions product-editor-actions">
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit">
            {isNew
              ? t("Add product", "افزودن محصول")
              : t("Save product", "ذخیرهٔ محصول")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ProductEditButton({
  product,
  row = false,
}: {
  product: Product;
  row?: boolean;
}) {
  const { role, t } = useDemo();
  const [open, setOpen] = useState(false);
  if (role !== "supervisor") return null;
  return (
    <>
      <Button
        variant="secondary"
        size={row ? "sm" : "default"}
        aria-label={t(`Edit ${product.name_en}`, `ویرایش ${product.name_fa}`)}
        onClick={() => setOpen(true)}
      >
        {t("Edit", "ویرایش")}
      </Button>
      {open && (
        <ProductEditor product={product} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ProductPrice({ product }: { product: Product }) {
  const { state, branch, t, lang } = useDemo();
  const approved = effectivePrice(state, product, branch);
  const pending = pendingPrice(state, product, branch);
  const offer = effectiveOffer(state, product, branch);
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  return (
    <div className="stack">
      <div>
        <p className="muted">
          {!approved && pending
            ? t("Proposed price before tax", "قیمت پیشنهادی پیش از مالیات")
            : product.sold_by === "weight"
              ? weighedSettings(state.config).main_display_unit === "lb"
                ? t("Selling price (per lb)", "قیمت فروش (هر پوند)")
                : t("Selling price (per kg)", "قیمت فروش (هر کیلوگرم)")
              : t("Selling price before tax", "قیمت فروش پیش از مالیات")}
        </p>
        <div className="actions">
          <strong className="price" dir="ltr">
            {approved || pending ? (
              <SellingPrice
                value={approved || pending!}
                product={product}
                config={state.config}
              />
            ) : (
              "—"
            )}
          </strong>
          <ManualPricePill product={product} />
          {profile?.taxable && (
            <Badge tone="info">
              {t(
                state.config.tax.label_text_en,
                state.config.tax.label_text_fa,
              )}
            </Badge>
          )}
          {offer && (
            <Badge tone="info" className="offer-pill">
              <OfferLabel label={offer.label} language={lang} />
            </Badge>
          )}
        </div>
      </div>
      <ManualPriceDetails product={product} />
      {pending && (
        <div className="banner pending" role="status">
          <Badge tone="pending">
            {approved
              ? t("New price pending", "قیمت جدید در انتظار تأیید")
              : t("Pending", "در انتظار تأیید")}
          </Badge>{" "}
          {approved ? (
            <span>
              {t("Proposed price", "قیمت پیشنهادی")}:{" "}
              <strong>
                <SellingPrice
                  value={pending}
                  product={product}
                  config={state.config}
                />
              </strong>
              .{" "}
              {t(
                "Keep charging the approved price shown above.",
                "تا زمان تأیید، قیمت تأییدشدهٔ بالا را دریافت کنید.",
              )}
            </span>
          ) : (
            <span>
              {t(
                "Pending: confirm with a Supervisor before selling",
                "در انتظار تأیید: پیش از فروش با سرپرست تأیید کنید",
              )}
            </span>
          )}
        </div>
      )}
      {!approved && !pending && (
        <div className="banner pending">
          {t(
            "No approved price in this branch. Confirm with a Supervisor before selling.",
            "در این شعبه قیمت تأییدشده‌ای وجود ندارد. پیش از فروش با سرپرست تأیید کنید.",
          )}
        </div>
      )}
    </div>
  );
}

function ProductDates({ product }: { product: Product }) {
  return <ProductDatesSection product={product} />;
}

function ProductDetail({
  product,
  operational = false,
  showName = true,
}: {
  product: Product;
  operational?: boolean;
  showName?: boolean;
}) {
  const { state, branch, role, user, lang, t } = useDemo();
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  );
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  const canSeeOperations = operational && role !== "cashier";
  const branches = configuredBranches(state.config, true);
  const visibleBranches =
    role === "supervisor" && branch === "all"
      ? branches
      : [lookupBranch(branch)];
  const context = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? "",
  };
  const costs =
    role === "supervisor" ? productCostHistory(state, context, product) : [];
  const storeCost = productStoreCost(state, context, product);
  const received = canSeeOperations
    ? lastReceivedByLocation(state, context, product.code)
    : [];
  return (
    <Card
      title={
        showName
          ? lang === "fa"
            ? product.name_fa
            : product.name_en
          : undefined
      }
      className="product-detail-card product-page-detail"
    >
      <div className="stack">
        {showName && (
          <p
            className="muted product-other-name"
            lang={lang === "fa" ? "en" : "fa"}
          >
            <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
              {lang === "fa" ? product.name_en : product.name_fa}
            </bdi>
          </p>
        )}
        <div className="actions">
          <UnitSize value={product.unit_size} />
          <Badge
            tone={
              product.status === "pending_approval"
                ? "pending"
                : product.status === "archived"
                  ? "neutral"
                  : "approved"
            }
          >
            {product.status === "pending_approval"
              ? t("Pending", "در انتظار تأیید")
              : product.status === "archived"
                ? t("Archived", "بایگانی‌شده")
                : t("Approved", "تأییدشده")}
          </Badge>
        </div>
        <ProductPrice product={product} />
        <ProductDates product={product} />
        <ProductProvenance product={product} />
        <dl className="form-grid">
          <div>
            <dt className="muted">
              {t(state.config.terminology.product_code, "کد محصول")}
            </dt>
            <dd>
              <LtrText>{product.code}</LtrText>
            </dd>
          </div>
          <div>
            <dt className="muted">{t("Barcode", "بارکد")}</dt>
            <dd>
              {product.barcode ? (
                <LtrText>{product.barcode}</LtrText>
              ) : (
                t("Not added", "اضافه نشده")
              )}
            </dd>
          </div>
          <div>
            <dt className="muted">{t("AI category", "دستهٔ هوش مصنوعی")}</dt>
            <dd>{categoryLabel(product.ai_category, lang)}</dd>
          </div>
          <div>
            <dt className="muted">
              {product.status === "pending_approval"
                ? t("Proposed tax profile", "وضعیت مالیات پیشنهادی")
                : t("Approved tax profile", "وضعیت مالیات تأییدشده")}
            </dt>
            <dd>
              {profile
                ? t(profile.label_en, profile.label_fa)
                : t("Pending Supervisor review", "در انتظار بررسی سرپرست")}
              {profile && product.status === "pending_approval" && (
                <p className="muted">
                  {t("Pending Supervisor review", "در انتظار بررسی سرپرست")}
                </p>
              )}
            </dd>
          </div>
          {(product.description_en || product.description_fa) && (
            <div>
              <dt className="muted">{t("Description", "توضیحات")}</dt>
              <dd>
                {lang === "fa"
                  ? product.description_fa || product.description_en
                  : product.description_en || product.description_fa}
              </dd>
            </div>
          )}
        </dl>
        {canSeeOperations && (
          <>
            <dl className="form-grid">
              <div>
                <dt className="muted">
                  {t("Pricing category", "دستهٔ قیمت‌گذاری")}
                </dt>
                <dd>
                  {categoryLabel(
                    category?.label || product.pricing_category,
                    lang,
                  )}
                </dd>
              </div>
              <div>
                <dt className="muted">{t("Supplier", "تأمین‌کننده")}</dt>
                <dd>
                  <LtrText>{product.main_supplier}</LtrText>
                </dd>
              </div>
            </dl>
            {role === "supervisor" && (
              <div className="stack">
                <h3>
                  {t(
                    "Approved prices by branch",
                    "قیمت‌های تأییدشده در شعبه‌ها",
                  )}
                </h3>
                <DataTable
                  columns={[
                    { width: "40%" },
                    { width: "30%", align: "end" },
                    { width: "30%" },
                  ]}
                >
                  <thead>
                    <tr>
                      <th>{t("Branch", "شعبه")}</th>
                      <th className="numeric">
                        {t("Approved price", "قیمت تأییدشده")}
                      </th>
                      <th>{t("Price scope", "محدودهٔ قیمت")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellingBranches(state.config).map((item) => {
                      const price = effectivePrice(state, product, item);
                      return (
                        <tr key={item}>
                          <td>
                            {configuredBranchLabel(state.config, item, lang)}
                          </td>
                          <td className="numeric">
                            {price ? (
                              <SellingPrice
                                value={price}
                                product={product}
                                config={state.config}
                              />
                            ) : (
                              "—"
                            )}
                            <ManualPricePill product={product} branch={item} />
                          </td>
                          <td>
                            {product.branch_prices?.[item]
                              ? t("This branch only", "فقط این شعبه")
                              : t("Company default", "پیش‌فرض شرکت")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
                <p>
                  {t("Store cost", "هزینهٔ فروشگاه")}:{" "}
                  <strong>
                    {storeCost ? (
                      <ProductCost
                        value={storeCost}
                        product={product}
                        config={state.config}
                      />
                    ) : (
                      "—"
                    )}
                  </strong>
                </p>
                <div className="stack">
                  <h3>{t("Cost history", "تاریخچهٔ هزینه")}</h3>
                  {!costs.length ? (
                    <p className="muted">
                      {t(
                        "No recorded cost history.",
                        "تاریخچهٔ هزینه‌ای ثبت نشده است.",
                      )}
                    </p>
                  ) : (
                    <DataTable
                      className="product-cost-history-table"
                      columns={[
                        { width: "200px" },
                        { width: "150px" },
                        { width: "128px" },
                        { width: "150px" },
                        { width: "130px", align: "end" },
                        { width: "160px" },
                      ]}
                    >
                      <thead>
                        <tr>
                          <th>{t("Supplier", "تأمین‌کننده")}</th>
                          <th>{t("Location", "محل")}</th>
                          <th>{t("Date", "تاریخ")}</th>
                          <th>{t("Invoice number", "شمارهٔ فاکتور")}</th>
                          <th>
                            {t(
                              "Unit cost before tax",
                              "هزینهٔ واحد پیش از مالیات",
                            )}
                          </th>
                          <th>{t("Price basis", "مبنای قیمت")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costs.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <bdi dir="auto">{entry.supplier}</bdi>
                            </td>
                            <td>
                              {configuredBranchLabel(
                                state.config,
                                entry.branch,
                                lang,
                              )}
                            </td>
                            <td>
                              <DateText value={entry.date} />
                            </td>
                            <td>
                              <a
                                href={`#invoices?id=${encodeURIComponent(entry.invoice_id)}`}
                              >
                                <LtrText>{entry.invoice_number}</LtrText>
                              </a>
                            </td>
                            <td>
                              <ProductCost
                                value={entry.unit_cost_before_tax}
                                product={{ sold_by: entry.sold_by }}
                                config={state.config}
                              />
                            </td>
                            <td>
                              {entry.short_dated ? (
                                <Badge tone="pending">
                                  {t(
                                    "Short-dated (expiry discount)",
                                    "تاریخ نزدیک (تخفیف انقضا)",
                                  )}
                                </Badge>
                              ) : (
                                t("Regular", "عادی")
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  )}
                </div>
              </div>
            )}
            <div className="stack">
              <h3>{t("Last received", "آخرین دریافت")}</h3>
              <DataTable
                className="product-last-received-table"
                columns={[
                  { width: "160px" },
                  { width: "130px" },
                  { width: "120px", align: "end" },
                  { width: "150px" },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Location", "محل")}</th>
                    <th>{t("Date", "تاریخ")}</th>
                    <th>{t("Units", "واحد")}</th>
                    <th>{t("Invoice number", "شمارهٔ فاکتور")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBranches.map((item) => {
                    const latest = received.find(
                      (entry) => entry.branch === item,
                    );
                    return (
                      <tr key={item}>
                        <td>
                          {configuredBranchLabel(state.config, item, lang)}
                        </td>
                        <td>
                          {latest ? (
                            <DateText value={latest.date} />
                          ) : (
                            <span className="muted">
                              {t(
                                "No deliveries yet",
                                "هنوز تحویلی ثبت نشده است",
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {latest ? <LtrText>{latest.units}</LtrText> : "—"}
                        </td>
                        <td>
                          {latest ? (
                            <a
                              href={`#invoices?id=${encodeURIComponent(latest.invoice_id)}`}
                            >
                              <LtrText>{latest.invoice_number}</LtrText>
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>
            <div className="stack">
              <h3>{t("History", "تاریخچه")}</h3>
              {state.activity.filter(
                (item) =>
                  item.company_id === product.company_id &&
                  item.product_code === product.code &&
                  (branch === "all" ||
                    item.branch === "all" ||
                    item.branch === branch),
              ).length ? (
                <ul>
                  {state.activity
                    .filter(
                      (item) =>
                        item.company_id === product.company_id &&
                        item.product_code === product.code &&
                        (branch === "all" ||
                          item.branch === "all" ||
                          item.branch === branch),
                    )
                    .map((item) => (
                      <li key={item.id}>
                        {activityLabel(item.action, lang)} ·{" "}
                        {demoUserLabel(item.by, lang)}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="muted">
                  {t("No recorded changes.", "تغییری ثبت نشده است.")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function LookupProductDetail({ product }: { product: Product }) {
  const { state, branch, t, lang } = useDemo();
  const approved = effectivePrice(state, product, branch);
  const pending = pendingPrice(state, product, branch);
  const offer = effectiveOffer(state, product, branch);
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  return (
    <Card className="lookup-detail">
      <div className="lookup-detail-header">
        <div>
          <h2 lang={lang} dir={lang === "fa" ? "rtl" : "ltr"}>
            <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
              {lang === "fa" ? product.name_fa : product.name_en}
            </bdi>
          </h2>
          <p className="muted" lang={lang === "fa" ? "en" : "fa"}>
            <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
              {lang === "fa" ? product.name_en : product.name_fa}
            </bdi>
          </p>
          <p className="lookup-product-meta muted">
            <span>
              {t(state.config.terminology.product_code, "کد محصول")}{" "}
              <LtrText>{product.code}</LtrText>
            </span>
            <UnitSize value={product.unit_size} />
          </p>
        </div>
        <ProductEditButton product={product} />
      </div>
      <ProductProvenance product={product} />
      <div className="lookup-price-block">
        <div className="lookup-approved-price">
          <p className="muted">
            {product.sold_by === "weight"
              ? weighedSettings(state.config).main_display_unit === "lb"
                ? t("Selling price (per lb)", "قیمت فروش (هر پوند)")
                : t("Selling price (per kg)", "قیمت فروش (هر کیلوگرم)")
              : t(
                  state.config.terminology.selling_price.replace(
                    /^Selling Price$/,
                    "Selling price",
                  ),
                  "قیمت فروش",
                )}
          </p>
          {approved ? (
            <strong className="price" dir="ltr">
              <SellingPrice
                value={approved}
                product={product}
                config={state.config}
              />
            </strong>
          ) : (
            <p className="muted lookup-missing-price">
              {t("No approved price yet", "هنوز قیمت تأییدشده‌ای وجود ندارد")}
            </p>
          )}
          <p className="helper">{t("Before tax", "پیش از مالیات")}</p>
          <ManualPricePill product={product} />
        </div>
        {pending && (
          <div className="lookup-pending-price">
            <Badge tone="pending">
              {approved
                ? t("New price pending", "قیمت جدید در انتظار تأیید")
                : t("Pending", "در انتظار تأیید")}
            </Badge>
            <SellingPrice
              value={pending}
              product={product}
              config={state.config}
            />
          </div>
        )}
      </div>
      <ManualPriceDetails product={product} />
      <ProductDates product={product} />
      {(profile?.taxable || offer) && (
        <div className="lookup-price-tags actions">
          {profile?.taxable && (
            <Badge tone="info">
              {t(
                state.config.tax.label_text_en,
                state.config.tax.label_text_fa,
              )}
            </Badge>
          )}
          {offer && (
            <Badge tone="info" className="offer-pill">
              <OfferLabel label={offer.label} language={lang} />
            </Badge>
          )}
        </div>
      )}
      {pending && (
        <p className="helper" role="status">
          {approved
            ? t(
                "Keep charging the approved price shown above.",
                "تا زمان تأیید، قیمت تأییدشدهٔ بالا را دریافت کنید.",
              )
            : t(
                "Pending: confirm with a Supervisor before selling",
                "در انتظار تأیید: پیش از فروش با سرپرست تأیید کنید",
              )}
        </p>
      )}
      {!approved && !pending && (
        <p className="helper">
          {t(
            "Confirm with a Supervisor before selling.",
            "پیش از فروش با سرپرست تأیید کنید.",
          )}
        </p>
      )}
    </Card>
  );
}

function searchFromLookupHash() {
  const [route, query = ""] = window.location.hash.slice(1).split("?");
  return route === "lookup"
    ? (new URLSearchParams(query).get("search") ?? "")
    : "";
}

export function Lookup() {
  const { state, branch, t, lang } = useDemo();
  const [search, setSearch] = useState(searchFromLookupHash);
  const [category, setCategory] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const resultsId = useId();
  const searchHintId = useId();
  const products = state.products.filter(
    (product) =>
      product.company_id === state.config.company.seed_key &&
      product.status !== "archived",
  );
  const results = searchProducts(products, search).filter(
    (product) => !category || product.ai_category === category,
  );
  const selected =
    results.find((product) => product.code === selectedCode) ?? results[0];
  const active =
    results.find((product) => product.code === activeCode) ?? selected;
  const categories = [
    ...new Set(products.map((product) => product.ai_category)),
  ].sort();

  useEffect(() => {
    const syncSearch = () => {
      if (window.location.hash.slice(1).split("?")[0] !== "lookup") return;
      setSearch(searchFromLookupHash());
      setCategory("");
      setSelectedCode("");
      setActiveCode("");
      searchRef.current?.focus();
    };
    window.addEventListener("hashchange", syncSearch);
    return () => window.removeEventListener("hashchange", syncSearch);
  }, []);

  const selectProduct = (product: Product) => {
    setSelectedCode(product.code);
    setActiveCode(product.code);
    searchRef.current?.focus();
    searchRef.current?.select();
  };
  const moveActive = (direction: number) => {
    const index = results.findIndex((product) => product.code === active?.code);
    const next = results[(index + direction + results.length) % results.length];
    if (next) setActiveCode(next.code);
    return next;
  };
  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || !results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && active) {
      event.preventDefault();
      selectProduct(active);
    }
  };
  const clearSearch = () => {
    setSearch("");
    setCategory("");
    setSelectedCode("");
    setActiveCode("");
    searchRef.current?.focus();
  };

  return (
    <div className="stack lookup-page">
      <PageHeader
        title={t("Cashier lookup", "جست‌وجوی صندوق‌دار")}
        description={t(
          "Find the approved price to charge now. Search in English or Persian, or scan a barcode.",
          "قیمت تأییدشدهٔ فعلی را پیدا کنید. انگلیسی یا فارسی جست‌وجو کنید یا بارکد را اسکن کنید.",
        )}
      />
      <div className="lookup-hero">
        <label className="sr-only" htmlFor={searchId}>
          {t("Search products", "جست‌وجوی محصولات")}
        </label>
        <div className="lookup-search-pill">
          <Search size={24} strokeWidth={1.5} aria-hidden="true" />
          <input
            id={searchId}
            ref={searchRef}
            className="lookup-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={resultsId}
            aria-expanded={Boolean(results.length)}
            aria-activedescendant={
              active ? `${resultsId}-${active.code}` : undefined
            }
            aria-describedby={searchHintId}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedCode("");
              setActiveCode("");
            }}
            onKeyDown={handleSearchKey}
            placeholder={t(
              "Name, Product Code or barcode",
              "نام، کد محصول یا بارکد",
            )}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button
            type="button"
            className="lookup-scan-button"
            aria-label={t("Scan barcode", "اسکن بارکد")}
            title={t("Scan barcode", "اسکن بارکد")}
            onClick={() => {
              searchRef.current?.focus();
              searchRef.current?.select();
            }}
          >
            <ScanLine size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="lookup-filterbar filter-toolbar">
          <Select
            className="lookup-category"
            aria-label={t("AI category", "دستهٔ هوش مصنوعی")}
            value={category}
            onChange={(value) => {
              setCategory(value);
              setSelectedCode("");
              setActiveCode("");
            }}
            options={[
              {
                value: "",
                label: t("All AI categories", "همهٔ دسته‌های هوش مصنوعی"),
              },
              ...categories.map((value) => ({
                value,
                label: categoryLabel(value, lang),
              })),
            ]}
          />
          <span className="filter-count muted">
            {translateCount(
              "{{count}} product",
              "{{count}} products",
              "{{count}} محصول",
              "{{count}} محصول",
              results.length,
              lang,
            )}
          </span>
          <p id={searchHintId} className="helper lookup-keyboard-hint">
            {t(
              "Use ↑ ↓ and Enter to select a product.",
              "برای انتخاب محصول از ↑ ↓ و Enter استفاده کنید.",
            )}
          </p>
          {(search || category) && (
            <Button variant="ghost" onClick={clearSearch}>
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          )}
        </div>
      </div>
      {branch === "all" && (
        <p className="muted">
          {t(
            `Showing the price to charge in ${configuredBranchLabel(state.config, lookupBranch(branch), "en")}. Choose a branch above to compare.`,
            `قیمت فروش ${configuredBranchLabel(state.config, lookupBranch(branch), "fa")} نمایش داده می‌شود. برای مقایسه، شعبه را در بالا انتخاب کنید.`,
          )}
        </p>
      )}
      {!selected ? (
        <EmptyState
          action={
            <Button variant="secondary" onClick={clearSearch}>
              {t("Clear search", "پاک کردن جست‌وجو")}
            </Button>
          }
        >
          {t(
            "No products match. Check the name or barcode, or clear the category filter.",
            "محصولی یافت نشد. نام یا بارکد را بررسی کنید یا فیلتر دسته را پاک کنید.",
          )}
        </EmptyState>
      ) : (
        <>
          <LookupProductDetail product={selected} />
          <Card
            title={t("Search results", "نتایج جست‌وجو")}
            className="lookup-results-card"
          >
            <div
              id={resultsId}
              className="lookup-results-list"
              role="listbox"
              aria-label={t("Product results", "نتایج محصولات")}
            >
              {results.map((product) => {
                const price = effectivePrice(state, product, branch);
                const pending = pendingPrice(state, product, branch);
                const offer = effectiveOffer(state, product, branch);
                const taxable = state.config.tax.profiles.find(
                  (item) => item.key === product.tax_profile,
                )?.taxable;
                return (
                  <button
                    key={product.code}
                    id={`${resultsId}-${product.code}`}
                    type="button"
                    role="option"
                    className={`lookup-result-row${product.code === selected.code ? " is-selected" : ""}${product.code === active?.code ? " is-active" : ""}`}
                    aria-selected={product.code === selected.code}
                    onClick={() => selectProduct(product)}
                    onFocus={() => setActiveCode(product.code)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                        return;
                      event.preventDefault();
                      const next = moveActive(
                        event.key === "ArrowDown" ? 1 : -1,
                      );
                      if (next)
                        document
                          .getElementById(`${resultsId}-${next.code}`)
                          ?.focus();
                    }}
                  >
                    <span
                      className="lookup-result-name"
                      dir={lang === "fa" ? "rtl" : "ltr"}
                    >
                      <strong lang={lang}>
                        <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                          {lang === "fa" ? product.name_fa : product.name_en}
                        </bdi>
                      </strong>
                      <span className="lookup-result-secondary muted">
                        <bdi
                          className="lookup-secondary-name"
                          lang={lang === "fa" ? "en" : "fa"}
                          dir={lang === "fa" ? "ltr" : "rtl"}
                        >
                          {lang === "fa" ? product.name_en : product.name_fa}
                        </bdi>
                        <span className="lookup-result-meta">
                          {t(state.config.terminology.product_code, "کد محصول")}{" "}
                          <LtrText>{product.code}</LtrText>
                        </span>
                      </span>
                    </span>
                    <span className="lookup-result-price">
                      {price ? (
                        <SellingPrice
                          value={price}
                          product={product}
                          config={state.config}
                        />
                      ) : (
                        <span className="muted">
                          {t(
                            "No approved price yet",
                            "هنوز قیمت تأییدشده‌ای وجود ندارد",
                          )}
                        </span>
                      )}
                      <span className="lookup-result-pills actions">
                        <ManualPricePill product={product} />
                        {pending && (
                          <Badge tone="pending">
                            {t("Pending", "در انتظار تأیید")}
                          </Badge>
                        )}
                        {taxable && (
                          <Badge tone="info">
                            {t(
                              state.config.tax.label_text_en,
                              state.config.tax.label_text_fa,
                            )}
                          </Badge>
                        )}
                        {offer && (
                          <Badge tone="info" className="offer-pill">
                            <OfferLabel label={offer.label} language={lang} />
                          </Badge>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

type SortColumn = "name" | "code" | "price";

export function Products() {
  const { state, role, branch, t, lang, navigate } = useDemo();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useListState("products.search", "");
  const [pricingCategory, setPricingCategory] = useListState(
    "products.category",
    "",
  );
  const [aiCategory, setAiCategory] = useListState("products.ai-category", "");
  const [status, setStatus] = useListState("products.status", "");
  const [supplier, setSupplier] = useListState("products.supplier", "");
  const [onlyPending, setOnlyPending] = useListState("products.pending", false);
  const [onlyOffers, setOnlyOffers] = useListState("products.offers", false);
  const [onlyManual, setOnlyManual] = useListState("products.manual", false);
  const [sort, setSort] = useListState<SortColumn>("products.sort", "name");
  const [ascending, setAscending] = useListState("products.ascending", true);
  const [page, setPage] = useListState("products.page", 0);
  const tableColumns = useTableColumns("products", [
    { key: "name", label: t("Product", "محصول"), required: true, width: 270 },
    {
      key: "code",
      label: t("Product Code", "کد محصول"),
      width: 104,
      align: "end",
    },
    ...(role === "supervisor"
      ? [
          {
            key: "cost",
            label: t("Store cost", "هزینهٔ فروشگاه"),
            width: 104,
            align: "end" as const,
          },
          {
            key: "margin",
            label: t("Margin %", "حاشیه سود %"),
            width: 96,
            align: "end" as const,
          },
        ]
      : []),
    {
      key: "price",
      label: t("Approved price", "قیمت تأییدشده"),
      width: 112,
      align: "end",
    },
    {
      key: "status",
      label: t("Status and offer", "وضعیت و پیشنهاد"),
      width: 240,
    },
    {
      key: "actions",
      label: t("Details", "جزئیات"),
      width: 112,
      align: "end",
      actions: true,
    },
  ]);
  if (role === "cashier") return <Lookup />;
  const products = state.products.filter(
    (product) => product.company_id === state.config.company.seed_key,
  );
  const results = searchProducts(products, search)
    .filter(
      (product) =>
        (!pricingCategory || product.pricing_category === pricingCategory) &&
        (!aiCategory || product.ai_category === aiCategory) &&
        (!status || product.status === status) &&
        (!supplier || product.main_supplier === supplier) &&
        (!onlyPending || pendingPrice(state, product, branch)) &&
        (!onlyOffers || effectiveOffer(state, product, branch)) &&
        (!onlyManual || manualPrice(state, product, branch)),
    )
    .sort((left, right) => {
      let comparison = 0;
      if (sort === "name")
        comparison = (
          lang === "fa" ? left.name_fa : left.name_en
        ).localeCompare(lang === "fa" ? right.name_fa : right.name_en, lang);
      if (sort === "code")
        comparison = left.code.localeCompare(right.code, "en");
      if (sort === "price") {
        const leftPrice = effectivePrice(state, left, branch);
        const rightPrice = effectivePrice(state, right, branch);
        comparison =
          leftPrice && rightPrice
            ? new Decimal(leftPrice).comparedTo(rightPrice)
            : leftPrice
              ? -1
              : rightPrice
                ? 1
                : 0;
      }
      return ascending ? comparison : -comparison;
    });
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageResults = results.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const sortBy = (column: SortColumn) => {
    setSort(column);
    setAscending(column === sort ? !ascending : true);
  };
  const clear = () => {
    setSearch("");
    setPricingCategory("");
    setAiCategory("");
    setStatus("");
    setSupplier("");
    setOnlyPending(false);
    setOnlyOffers(false);
    setOnlyManual(false);
    setPage(0);
  };
  return (
    <div className="stack">
      <PageHeader
        title={t("Products", "محصولات")}
        description={t(
          "Approved prices, pending changes and branch details in one catalog.",
          "قیمت‌های تأییدشده، تغییرات در انتظار تأیید و جزئیات شعبه در یک فهرست.",
        )}
        actions={
          role === "supervisor" ? (
            <Button onClick={() => setAddOpen(true)}>
              {t("Add product", "افزودن محصول")}
            </Button>
          ) : undefined
        }
      />
      {addOpen && (
        <ProductEditor
          onClose={() => setAddOpen(false)}
          onCreated={(product) => navigate(`product?code=${product.code}`)}
        />
      )}
      {branch === "all" && (
        <p className="muted">
          {t(
            `Prices and offers below preview ${configuredBranchLabel(state.config, lookupBranch(branch), "en")}. Open product details to compare branch prices, or choose one branch above.`,
            `قیمت‌ها و پیشنهادهای زیر مربوط به ${configuredBranchLabel(state.config, lookupBranch(branch), "fa")} هستند. برای مقایسهٔ قیمت شعبه‌ها، جزئیات محصول را باز کنید یا یک شعبه را در بالا انتخاب کنید.`,
          )}
        </p>
      )}
      <FilterToolbar
        className="catalog-filter-toolbar"
        search={
          <input
            aria-label={t("Search products", "جست‌وجوی محصولات")}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={t(
              "Name, Product Code or barcode",
              "نام، کد محصول یا بارکد",
            )}
          />
        }
      >
        <Select
          aria-label={t("Pricing category", "دستهٔ قیمت‌گذاری")}
          value={pricingCategory}
          onChange={(value) => {
            setPricingCategory(value);
            setPage(0);
          }}
          options={[
            {
              value: "",
              label: t("All pricing categories", "همهٔ دسته‌های قیمت‌گذاری"),
            },
            ...state.config.pricing_categories.map((item) => ({
              value: item.key,
              label: categoryLabel(item.label, lang),
            })),
          ]}
        />
        <Select
          aria-label={t("AI category", "دستهٔ هوش مصنوعی")}
          value={aiCategory}
          onChange={(value) => {
            setAiCategory(value);
            setPage(0);
          }}
          options={[
            {
              value: "",
              label: t("All AI categories", "همهٔ دسته‌های هوش مصنوعی"),
            },
            ...[...new Set(products.map((product) => product.ai_category))]
              .sort()
              .map((value) => ({
                value,
                label: categoryLabel(value, lang),
              })),
          ]}
        />
        <Select
          aria-label={t("Status", "وضعیت")}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
          options={[
            { value: "", label: t("All statuses", "همهٔ وضعیت‌ها") },
            { value: "active", label: t("Approved", "تأییدشده") },
            {
              value: "pending_approval",
              label: t("Pending", "در انتظار تأیید"),
            },
            { value: "archived", label: t("Archived", "بایگانی‌شده") },
          ]}
        />
        <Select
          aria-label={t("Supplier", "تأمین‌کننده")}
          value={supplier}
          onChange={(value) => {
            setSupplier(value);
            setPage(0);
          }}
          options={[
            {
              value: "",
              label: t("All suppliers", "همهٔ تأمین‌کنندگان"),
            },
            ...[...new Set(products.map((product) => product.main_supplier))]
              .sort()
              .map((value) => ({
                value,
                label: value,
              })),
          ]}
        />

        <Checkbox
          checked={onlyPending}
          onChange={(value) => {
            setOnlyPending(value);
            setPage(0);
          }}
          aria-label={t("Has pending price", "دارای قیمت در انتظار تأیید")}
        >
          {t("Has pending price", "دارای قیمت در انتظار تأیید")}
        </Checkbox>
        <Checkbox
          checked={onlyOffers}
          onChange={(value) => {
            setOnlyOffers(value);
            setPage(0);
          }}
          aria-label={t("Has offer", "دارای پیشنهاد")}
        >
          {t("Has offer", "دارای پیشنهاد")}
        </Checkbox>
        <Checkbox
          checked={onlyManual}
          onChange={(value) => {
            setOnlyManual(value);
            setPage(0);
          }}
          aria-label={t("Manual prices", "قیمت‌های دستی")}
        >
          {t("Manual prices", "قیمت‌های دستی")}
        </Checkbox>
        <Button variant="ghost" onClick={clear}>
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
        {tableColumns.chooser}
        <span className="filter-count muted">
          {translateCount(
            "{{count}} product",
            "{{count}} products",
            "{{count}} محصول",
            "{{count}} محصول",
            results.length,
            lang,
          )}
        </span>
      </FilterToolbar>
      {!results.length ? (
        <EmptyState
          action={
            <Button variant="secondary" onClick={clear}>
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          }
        >
          {t(
            "No products match these filters. Clear a filter or check the search text.",
            "محصولی با این فیلترها یافت نشد. فیلتر را پاک کنید یا متن جست‌وجو را بررسی کنید.",
          )}
        </EmptyState>
      ) : (
        <Card>
          <div className="stack">
            <DataTable
              className={`catalog-products-table${role === "supervisor" ? " with-store-cost" : ""}`}
              columns={tableColumns.columns}
            >
              <thead>
                <tr>
                  <th
                    aria-sort={
                      sort === "name"
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button
                      variant="ghost"
                      data-control-kind="widget"
                      onClick={() => sortBy("name")}
                    >
                      {t("Product", "محصول")}
                      {sort === "name" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={
                      sort === "code"
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button
                      variant="ghost"
                      data-control-kind="widget"
                      onClick={() => sortBy("code")}
                    >
                      {t("Product Code", "کد محصول")}
                      {sort === "code" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
                  {role === "supervisor" && (
                    <>
                      <th>{t("Store cost", "هزینهٔ فروشگاه")}</th>
                      <th>{t("Margin %", "حاشیه سود %")}</th>
                    </>
                  )}
                  <th
                    className="numeric"
                    aria-sort={
                      sort === "price"
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button
                      variant="ghost"
                      data-control-kind="widget"
                      onClick={() => sortBy("price")}
                    >
                      {t("Approved price", "قیمت تأییدشده")}
                      {sort === "price" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
                  <th>{t("Status and offer", "وضعیت و پیشنهاد")}</th>
                  <th>{t("Details", "جزئیات")}</th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map((product) => {
                  const price = effectivePrice(state, product, branch);
                  const pending = pendingPrice(state, product, branch);
                  const offer = effectiveOffer(state, product, branch);
                  const cost = productStoreCost(
                    state,
                    {
                      company_id: state.config.company.seed_key,
                      role: role ?? "cashier",
                      branch,
                      actor: "",
                    },
                    product,
                  );
                  const margin = cost ? sellingMargin(price, cost) : null;
                  return (
                    <tr key={product.code}>
                      <td>
                        <a
                          className="catalog-product-link"
                          href={`#product?code=${encodeURIComponent(product.code)}`}
                          onClick={(event) => {
                            event.preventDefault();
                            navigate(
                              `product?code=${encodeURIComponent(product.code)}`,
                            );
                          }}
                        >
                          <strong className="catalog-product-name">
                            <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                              {lang === "fa"
                                ? product.name_fa
                                : product.name_en}
                            </bdi>
                          </strong>
                        </a>
                        <p className="muted catalog-product-secondary">
                          <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                            {lang === "fa" ? product.name_en : product.name_fa}
                          </bdi>
                        </p>
                        <p className="muted">
                          {product.sold_by === "weight" ? (
                            t("Sold by weight", "فروش وزنی")
                          ) : (
                            <UnitSize value={product.unit_size} />
                          )}
                        </p>
                      </td>
                      <td className="numeric">
                        <LtrText>{product.code}</LtrText>
                      </td>
                      {role === "supervisor" && (
                        <>
                          <td>
                            {cost ? (
                              <ProductCost
                                value={cost}
                                product={product}
                                config={state.config}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {margin !== null ? (
                              <LtrText>{margin}%</LtrText>
                            ) : (
                              "—"
                            )}
                          </td>
                        </>
                      )}
                      <td className="numeric">
                        {price ? (
                          <SellingPrice
                            value={price}
                            product={product}
                            config={state.config}
                            stacked
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <ManualPricePill product={product} />
                          {pending && (
                            <Badge tone="pending">
                              {t("Pending", "در انتظار تأیید")}{" "}
                              <SellingPrice
                                value={pending}
                                product={product}
                                config={state.config}
                              />
                            </Badge>
                          )}
                          {!pending && (
                            <Badge
                              tone={
                                product.status === "archived"
                                  ? "neutral"
                                  : "approved"
                              }
                            >
                              {product.status === "archived"
                                ? t("Archived", "بایگانی‌شده")
                                : t("Approved", "تأییدشده")}
                            </Badge>
                          )}
                          {offer && (
                            <Badge tone="info" className="offer-pill">
                              <OfferLabel label={offer.label} language={lang} />
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="actions catalog-row-actions">
                          <ProductEditButton product={product} row />
                          {product.status === "active" && (
                            <Menu
                              iconOnly
                              showChevron={false}
                              aria-label={t("Product actions", "اقدامات کالا")}
                              label={
                                <MoreHorizontal
                                  size={20}
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                />
                              }
                            >
                              <MenuItem
                                onClick={() =>
                                  navigate(
                                    `expiry?product=${encodeURIComponent(product.code)}`,
                                  )
                                }
                              >
                                {t("Add date", "افزودن تاریخ")}
                              </MenuItem>
                            </Menu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            <div className="actions">
              <Button
                variant="secondary"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("Previous", "قبلی")}
              </Button>
              <span>
                {t(
                  `Page ${currentPage + 1} of ${pageCount}`,
                  `صفحهٔ ${currentPage + 1} از ${pageCount}`,
                )}{" "}
                ·{" "}
                {translateCount(
                  "{{count}} product",
                  "{{count}} products",
                  "{{count}} محصول",
                  "{{count}} محصول",
                  results.length,
                  lang,
                )}
              </span>
              <Button
                variant="secondary"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("Next", "بعدی")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export function ProductPage() {
  const { state, role, lang, t } = useDemo();
  const query = window.location.hash.split("?")[1] ?? "";
  const code = new URLSearchParams(query).get("code");
  const product = state.products.find(
    (item) =>
      item.code === code && item.company_id === state.config.company.seed_key,
  );
  if (role === "cashier") return <Lookup />;
  if (!product)
    return (
      <EmptyState
        action={
          <Button variant="secondary" asChild>
            <a href="#products">
              <ArrowLeft size={16} aria-hidden="true" />
              {t("Back to Products", "بازگشت به محصولات")}
            </a>
          </Button>
        }
      >
        {t("Product not found.", "محصول یافت نشد.")}
      </EmptyState>
    );
  return (
    <div className="stack product-page">
      <Button className="product-back" variant="ghost" asChild>
        <a href="#products">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("Back to Products", "بازگشت به محصولات")}
        </a>
      </Button>
      <header className="page-header">
        <div>
          <h1>
            <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
              {lang === "fa" ? product.name_fa : product.name_en}
            </bdi>
          </h1>
          <p className="muted product-other-name">
            <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
              {lang === "fa" ? product.name_en : product.name_fa}
            </bdi>
          </p>
          <p className="helper">
            {t("Product Code", "کد محصول")} <LtrText>{product.code}</LtrText>
          </p>
        </div>
        <ProductEditButton product={product} />
      </header>
      <ProductDetail product={product} operational showName={false} />
    </div>
  );
}
