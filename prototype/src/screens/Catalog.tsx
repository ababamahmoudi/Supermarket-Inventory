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
import { useListState, useRouteParam } from "../navigation";
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
import {
  approvedWeightPricePerLb,
  weightPriceDisplay,
  weighedSettings,
  type WeightUnit,
} from "../weighed";
import {
  ProductPrice as SellingPrice,
  ProductCost,
} from "../weight-price-presentation";
import {
  ProductDateEditor,
  type ProductPendingDate,
} from "../ProductDateEditor";
import { ProductLotsSection } from "../ProductLotsSection";
import {
  productDateDrafts,
  productReminderDays,
  DateTrackingError,
  dateTrackingErrorMessage,
  validTrackedDate,
  validateProductTrackingDate,
  type ProductDateDraft,
  type StopTrackingChoice,
} from "../date-tracking";
import {
  WhatsMissing,
  focusValidationField,
  type ValidationIssue,
} from "../WhatsMissing";
import { effectiveProjectedClearanceOffers } from "../receipt-lots";
import { ProductDatesSection } from "../ProductDatesSection";
import { sellingMargin } from "../manual-prices";
import {
  ManualPriceDetails,
  ManualPricePill,
} from "../manual-price-presentation";
import { receivedLog } from "../received";
import { formatCasesAndUnits, formatQuantity } from "../formatters";
import "./manual-entry.css";
import "./c5-catalog-offers.css";
import "../catalog-c7.css";
import { ChangePriceDialog } from "../ChangePriceDialog";
import { SalePrice, SaleStatus, PendingSalePill } from "../sales-presentation";
import { salesText } from "../sales-locale";
import {
  activeSaleAt,
  pendingSaleRequest,
  endSale,
  withdrawSaleRequest,
} from "../sales";
import type { Branch } from "../types";
import { configuredRoleLabel } from "../role-config";
import type { ProductReadDTO as Product } from "../catalog-read-model";
import { projectProductReadDTO } from "../catalog-read-model";
import type { ResourceScope } from "../authority-types";
import {
  useCatalogQuery,
  productFinancialSnapshot,
  newProductPricePreview,
} from "../catalog-query";
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
  DialogActions,
  ConfirmDialog,
  TableRowLink,
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
  UnitText,
} from "../presentation";

const PAGE_SIZE = 25;

function ProductProvenance({ product }: { product: Product }) {
  const { branch, t, lang, state } = useDemo();
  const financial = useCatalogQuery(
    "catalog.cost_read",
    {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    },
    product.code,
    (draft, actor) => productFinancialSnapshot(draft, actor, product.code),
  );
  const source =
    financial.data?.price_provenance?.[lookupBranch(branch)] ??
    financial.data?.price_provenance?.all;
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
      "You do not have permission for this action.",
      "اجازهٔ انجام این کار را ندارید.",
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
  const { state, branch, actor, can, command, query, lang, t, navigate } =
    useDemo();
  const branches = configuredBranches(state.config).filter((id) =>
    actor?.allowed_branches.includes(id),
  );
  const priceLocations = sellingBranches(state.config).filter((id) =>
    actor?.allowed_branches.includes(id),
  );
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
      ? (state.invoice?.supplier ?? "")
      : (supplierChoices(state)[0]?.name ?? ""),
    selling_price: "",
    offer: null,
    taxable: false,
    status: "active",
    tax_profile: "",
    date_tracking: false,
    manual_price_scopes: [],
    manual_price_comparisons: {},
  };
  const [cost, setCost] = useState("");
  const [costUnit, setCostUnit] = useState<WeightUnit>("lb");
  const formId = useId();
  const dateLocation = invoiceQuickAdd
    ? (state.invoice?.branch ?? branch)
    : lookupBranch(branch);
  const [chosenDateLocation, setChosenDateLocation] = useState("");
  const pendingDateLocation =
    dateLocation === "all" ? chosenDateLocation : dateLocation;
  const editorScope: ResourceScope = invoiceQuickAdd
    ? {
        company_id: product.company_id,
        location_ids: [dateLocation],
        kind: "location_record",
        entity_id: state.invoice?.id,
      }
    : {
        company_id: product.company_id,
        kind: "company_shared",
        entity_id: existingProduct?.code,
      };
  const editorCapability = isNew
    ? invoiceQuickAdd
      ? "invoices.product_propose"
      : "catalog.create_active"
    : "catalog.edit";
  const mayEdit = can(editorCapability, editorScope);
  const mayOverridePrice = can("catalog.create_active", {
    company_id: product.company_id,
    kind: "company_shared",
  });
  const editorBoot = useCatalogQuery(
    editorCapability,
    editorScope,
    existingProduct?.code ?? "new",
    (draft, freshActor) => ({
      expected: existingProduct
        ? productEditSnapshot(draft, freshActor, existingProduct.code)
        : "",
      dates: existingProduct
        ? productDateDrafts(
            draft,
            freshActor,
            existingProduct.code,
            dateLocation,
          )
        : [],
    }),
  );
  const [dates, setDates] = useState<ProductDateDraft[]>([]);
  const initializedBoot = useRef("");
  const initializationKey = `${actor?.user_id ?? ""}:${existingProduct?.code ?? "new"}:${dateLocation}`;
  const [reminderDays, setReminderDays] = useState(() =>
    String(productReminderDays(state, existingProduct)),
  );
  const [pendingDate, setPendingDate] = useState<ProductPendingDate>({
    date_type: "expiry",
    date: "",
    quantity: "",
    lot_number: "",
  });
  const [stopChoice, setStopChoice] = useState<StopTrackingChoice | "">("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const clearIssue = (id: string) =>
    setIssues((current) => current.filter((issue) => issue.fieldId !== id));
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
  const [expected, setExpected] = useState("");
  useEffect(() => {
    if (!editorBoot.data || initializedBoot.current === initializationKey)
      return;
    initializedBoot.current = initializationKey;
    setDates(editorBoot.data.dates);
    setExpected(editorBoot.data.expected);
  }, [editorBoot.data, initializationKey]);
  const [error, setError] = useState<
    ProductEditErrorCode | NewProductError["code"] | null
  >(null);
  const fieldIssue = (key: string) =>
    issues.find((issue) => issue.fieldId === `${formId}-${key}`)?.message;
  const patch = <K extends keyof ProductEdits>(
    key: K,
    value: ProductEdits[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    clearIssue(`${formId}-${key}`);
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
  const priceChanged = isNew && sellingPrice !== startingDisplayPrice;
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
  const pricingInput = {
    cost,
    costUnit,
    soldBy: values.sold_by,
    category: values.pricing_category,
    sellingPrice,
    manualPrice,
  };
  const pricePreview = useCatalogQuery(
    editorCapability,
    editorScope,
    JSON.stringify(pricingInput),
    (draft, freshActor) =>
      newProductPricePreview(draft, freshActor, pricingInput, invoiceQuickAdd),
  );
  const calculatedPrice = pricePreview.data?.displayCalculatedPrice ?? "";
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
    /* Save validates this draft field. */
  }
  const belowMinimum = isNew && pricePreview.data?.belowMinimum === true;
  const similar = isNew ? similarProductNames(state, values.name_en) : [];
  if (!actor || !mayEdit) return null;
  return (
    <>
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
        description={
          <span className="product-editor-caption">
            <bdi dir={lang === "fa" && values.name_fa ? "rtl" : "ltr"}>
              <UnitText>
                {lang === "fa"
                  ? values.name_fa || values.name_en
                  : values.name_en}
              </UnitText>
            </bdi>
            {" · "}
            {t("Product Code", "کد محصول")} <LtrText>{product.code}</LtrText>
          </span>
        }
        className={
          isNew
            ? "product-editor-dialog manual-entry-dialog"
            : "product-editor-dialog"
        }
      >
        <form
          className="stack product-editor-form"
          id={`${formId}-form`}
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            const missing: ValidationIssue[] = [];
            const datesToSave = [...dates];
            const addIssue = (key: string, message: string) =>
              !missing.some((item) => item.id === key) &&
              missing.push({ id: key, fieldId: `${formId}-${key}`, message });
            if (!values.name_en.trim())
              addIssue("name_en", editorError("name_en", t));
            if (!values.unit_size.trim())
              addIssue("unit_size", editorError("unit_size", t));
            if (
              !activePricingCategories(state.config).some(
                (category) => category.key === values.pricing_category,
              )
            )
              addIssue("pricing_category", editorError("pricing_category", t));
            if (!values.main_supplier)
              addIssue("main_supplier", editorError("supplier", t));
            if (isNew && !/^\d+(\.\d{1,4})?$/.test(cost))
              addIssue("cost", editorError("cost", t));
            if (
              (isNew || priceChanged) &&
              (!/^\d+(\.\d{1,2})?$/.test(canonicalSellingPrice) ||
                new Decimal(canonicalSellingPrice || 0).lte(0))
            )
              addIssue("price", editorError("price", t));
            if (values.date_tracking) {
              const hasPendingDate = Boolean(
                pendingDate.date.trim() ||
                pendingDate.quantity.trim() ||
                pendingDate.lot_number.trim(),
              );
              if (hasPendingDate) {
                if (!pendingDateLocation)
                  addIssue(
                    "date-location",
                    t("Choose location", "انتخاب مکان"),
                  );
                if (!validTrackedDate(pendingDate.date))
                  addIssue(
                    "new-date",
                    dateTrackingErrorMessage(new DateTrackingError("date"), t),
                  );
                if (pendingDate.quantity.trim())
                  try {
                    const quantity = new Decimal(pendingDate.quantity);
                    if (!quantity.isFinite() || quantity.lte(0))
                      throw new Error();
                  } catch {
                    addIssue(
                      "new-quantity",
                      dateTrackingErrorMessage(
                        new DateTrackingError("quantity"),
                        t,
                      ),
                    );
                  }
                datesToSave.push({
                  ...pendingDate,
                  product_code: product.code,
                  branch: pendingDateLocation,
                });
              }
              try {
                await query(editorCapability, editorScope, (draft) =>
                  validateProductTrackingDate(
                    draft,
                    product.company_id,
                    product.code,
                    true,
                    datesToSave,
                  ),
                );
              } catch (cause) {
                if (
                  cause instanceof DateTrackingError &&
                  cause.code === "required_date"
                )
                  addIssue("new-date", dateTrackingErrorMessage(cause, t));
              }
              if (
                !/^\d+$/.test(reminderDays) ||
                !Number.isSafeInteger(Number(reminderDays))
              )
                addIssue(
                  "reminder",
                  dateTrackingErrorMessage(
                    new DateTrackingError("reminder"),
                    t,
                  ),
                );
              dates.forEach((row, index) => {
                if (row.remove_reason !== undefined) {
                  if (!row.remove_reason)
                    addIssue(
                      `date-${index}-remove_reason`,
                      dateTrackingErrorMessage(
                        new DateTrackingError("reason"),
                        t,
                      ),
                    );
                  return;
                }
                if (!validTrackedDate(row.date))
                  addIssue(
                    `date-${index}-date`,
                    dateTrackingErrorMessage(new DateTrackingError("date"), t),
                  );
                if (row.quantity?.trim())
                  try {
                    if (
                      !new Decimal(row.quantity).isFinite() ||
                      new Decimal(row.quantity).lte(0)
                    )
                      throw new Error();
                  } catch {
                    addIssue(
                      `date-${index}-quantity`,
                      dateTrackingErrorMessage(
                        new DateTrackingError("quantity"),
                        t,
                      ),
                    );
                  }
              });
            }
            if (
              !isNew &&
              values.date_tracking === false &&
              product.date_tracking !== false &&
              !stopChoice
            )
              addIssue(
                "stop-choice",
                dateTrackingErrorMessage(
                  new DateTrackingError("stop_choice"),
                  t,
                ),
              );
            if (missing.length) {
              setIssues(missing);
              requestAnimationFrame(() =>
                focusValidationField(missing[0].fieldId),
              );
              return;
            }
            setIssues([]);
            const writeScope = { ...editorScope, mutation: true };
            try {
              if (isNew) {
                const created = await command(
                  editorCapability,
                  writeScope,
                  (draft, freshActor) => {
                    const result = addProduct(
                      draft,
                      freshActor,
                      {
                        ...values,
                        dates: datesToSave,
                        date_reminder_days: Number(reminderDays),
                        last_cost_before_tax: cost,
                        last_cost_unit: costUnit,
                        selling_price: !manualPrice
                          ? undefined
                          : canonicalSellingPrice || undefined,
                        minimum_margin_confirmed: marginConfirmed,
                        similar_name_confirmed: similarConfirmed,
                      } satisfies NewProductEdits,
                      invoiceQuickAdd,
                    );
                    return projectProductReadDTO(draft, freshActor, result);
                  },
                );
                onCreated?.(created);
                onClose();
                return;
              }
              await command(editorCapability, writeScope, (draft, freshActor) =>
                saveProductEdits(
                  draft,
                  freshActor,
                  product.code,
                  {
                    ...values,
                    dates: datesToSave,
                    date_reminder_days: Number(reminderDays),
                    date_tracking_stop: stopChoice || undefined,
                    ...(priceChanged
                      ? { selling_price: canonicalSellingPrice }
                      : {}),
                  },
                  expected,
                ),
              );
              onClose();
            } catch (cause) {
              if (cause instanceof DateTrackingError) {
                setIssues([
                  {
                    id: "dates",
                    fieldId: `${formId}-dates`,
                    message: dateTrackingErrorMessage(cause, t),
                  },
                ]);
                return;
              }
              const code =
                cause instanceof ProductEditError ||
                cause instanceof NewProductError
                  ? cause.code
                  : "stale";
              if (code === "barcode_conflict" && !isNew) {
                // The rejected catalog draft stays untouched. Its separate
                // approval is now part of the current editing snapshot, so the
                // user can correct this field without reopening the dialog.
                const nextSnapshot = await command(
                  "catalog.edit",
                  writeScope,
                  (draft, freshActor) => {
                    recordProductBarcodeConflict(
                      draft,
                      freshActor,
                      product.code,
                      values.barcode,
                    );
                    return productEditSnapshot(draft, freshActor, product.code);
                  },
                );
                setExpected(nextSnapshot);
              }
              setError(code);
              const key =
                code === "supplier"
                  ? "main_supplier"
                  : code === "barcode_conflict"
                    ? "barcode"
                    : code === "category"
                      ? "ai_category"
                      : code === "similar"
                        ? "similar"
                        : code === "margin"
                          ? "margin"
                          : code;
              if (
                [
                  "name_en",
                  "unit_size",
                  "pricing_category",
                  "supplier",
                  "barcode_conflict",
                  "cost",
                  "price",
                  "similar",
                  "margin",
                ].includes(code)
              )
                setIssues([
                  {
                    id: code,
                    fieldId: `${formId}-${key}`,
                    message: editorError(code, t),
                  },
                ]);
            }
          }}
        >
          <div className="product-editor-body">
            <WhatsMissing issues={issues} />
            <section
              className="product-editor-section"
              aria-label={t("Names", "نام‌ها")}
            >
              <h3 className="product-editor-section-title">
                {t("Names", "نام‌ها")}
              </h3>
              <div className="form-grid product-editor-fields">
                <Field
                  label={t("English name", "نام انگلیسی")}
                  error={
                    fieldIssue("name_en") ??
                    (error === "name_en" ? editorError(error, t) : undefined)
                  }
                >
                  <input
                    autoFocus
                    id={`${formId}-name_en`}
                    dir="ltr"
                    value={values.name_en}
                    onChange={(event) => {
                      patch("name_en", event.target.value);
                      setSimilarConfirmed(false);
                    }}
                  />
                </Field>
                <Field
                  label={t("Persian name (optional)", "نام فارسی (اختیاری)")}
                  error={
                    error === "name_fa" ? editorError(error, t) : undefined
                  }
                >
                  <input
                    dir="rtl"
                    value={values.name_fa}
                    onChange={(event) => patch("name_fa", event.target.value)}
                  />
                </Field>
              </div>
            </section>
            <section
              className="product-editor-section"
              aria-label={t("Pricing", "قیمت‌گذاری")}
            >
              <h3 className="product-editor-section-title">
                {t("Pricing", "قیمت‌گذاری")}
              </h3>
              <div className="form-grid product-editor-fields">
                <Field
                  label={t("Pricing category", "دستهٔ قیمت‌گذاری")}
                  error={
                    fieldIssue("pricing_category") ??
                    (error === "pricing_category"
                      ? editorError(error, t)
                      : undefined)
                  }
                >
                  <Select
                    id={`${formId}-pricing_category`}
                    value={values.pricing_category}
                    onChange={(value) => patch("pricing_category", value)}
                    options={activePricingCategories(state.config).map(
                      (item) => ({
                        value: item.key,
                        label: categoryLabel(item.label, lang),
                      }),
                    )}
                  />
                </Field>
                {isNew && (
                  <Field
                    label={t(
                      "Last unit cost before tax",
                      "آخرین هزینهٔ واحد پیش از مالیات",
                    )}
                    error={
                      fieldIssue("cost") ??
                      (error === "cost" ? editorError(error, t) : undefined)
                    }
                  >
                    <input
                      id={`${formId}-cost`}
                      dir="ltr"
                      inputMode="decimal"
                      className="control-narrow"
                      value={cost}
                      onChange={(event) => {
                        setCost(event.target.value);
                        clearIssue(`${formId}-cost`);
                        setMarginConfirmed(false);
                        if (error === "cost" || error === "margin")
                          setError(null);
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
                        if (error === "cost" || error === "margin")
                          setError(null);
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
                  error={
                    fieldIssue("price") ??
                    (error === "price" ? editorError(error, t) : undefined)
                  }
                  className="short-field"
                >
                  {isNew ? (
                    <input
                      id={`${formId}-price`}
                      dir="ltr"
                      inputMode="decimal"
                      value={effectiveSellingPrice}
                      readOnly={isNew && !mayOverridePrice}
                      onChange={(event) => {
                        setSellingPrice(event.target.value);
                        clearIssue(`${formId}-price`);
                        setManualPrice(true);
                        setMarginConfirmed(false);
                        if (error === "price" || error === "margin")
                          setError(null);
                      }}
                    />
                  ) : (
                    <div className="product-editor-current-price">
                      <SalePrice product={product} />
                      <Button
                        variant="plain"
                        onClick={() => setPriceDialogOpen(true)}
                      >
                        {salesText(t, "change")}
                      </Button>
                    </div>
                  )}
                </Field>
              </div>
            </section>
            <section
              className="product-editor-section"
              aria-label={t("Details", "جزئیات")}
            >
              <h3 className="product-editor-section-title">
                {t("Details", "جزئیات")}
              </h3>
              <div className="form-grid product-editor-fields">
                <Field
                  label={t("Unit size", "اندازهٔ واحد")}
                  error={
                    fieldIssue("unit_size") ??
                    (error === "unit_size" ? editorError(error, t) : undefined)
                  }
                >
                  <input
                    id={`${formId}-unit_size`}
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
                  label={t("Category (optional)", "دسته (اختیاری)")}
                  error={
                    error === "category" ? editorError(error, t) : undefined
                  }
                >
                  <Select
                    value={values.ai_category}
                    onChange={(value) => patch("ai_category", value)}
                    options={[
                      { value: "", label: t("No category", "بدون دسته") },
                      ...categories.map((value) => ({
                        value,
                        label: categoryLabel(value, lang),
                      })),
                    ]}
                  />
                </Field>
                <Field
                  label={t("Supplier", "تأمین‌کننده")}
                  error={
                    fieldIssue("main_supplier") ??
                    (error === "supplier" ? editorError(error, t) : undefined)
                  }
                >
                  <Select
                    id={`${formId}-main_supplier`}
                    value={values.main_supplier}
                    onChange={(value) => patch("main_supplier", value)}
                    options={suppliers.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </Field>
                <Field
                  label={t("Barcode", "بارکد")}
                  error={
                    error === "barcode_conflict"
                      ? editorError(error, t)
                      : undefined
                  }
                >
                  <input
                    id={`${formId}-barcode`}
                    dir="ltr"
                    value={values.barcode}
                    onChange={(event) => patch("barcode", event.target.value)}
                  />
                </Field>
                <Field
                  label={t(
                    "Description (English) (optional)",
                    "توضیحات (انگلیسی) (اختیاری)",
                  )}
                >
                  <textarea
                    dir="ltr"
                    value={values.description_en}
                    onChange={(event) =>
                      patch("description_en", event.target.value)
                    }
                    rows={2}
                  />
                </Field>
                <Field
                  label={t(
                    "Description (Persian) (optional)",
                    "توضیحات (فارسی) (اختیاری)",
                  )}
                >
                  <textarea
                    dir="rtl"
                    value={values.description_fa}
                    onChange={(event) =>
                      patch("description_fa", event.target.value)
                    }
                    rows={2}
                  />
                </Field>
              </div>
            </section>
            {values.date_tracking && dateLocation === "all" && (
              <Field
                label={t("Location", "مکان")}
                error={fieldIssue("date-location")}
              >
                <Select
                  id={`${formId}-date-location`}
                  value={chosenDateLocation}
                  onChange={(value) => {
                    setChosenDateLocation(value);
                    clearIssue(`${formId}-date-location`);
                  }}
                  options={[
                    { value: "", label: t("Choose location", "انتخاب مکان") },
                    ...branches.map((value) => ({
                      value,
                      label: configuredBranchLabel(state.config, value, lang),
                    })),
                  ]}
                />
              </Field>
            )}
            <ProductDateEditor
              productCode={product.code}
              location={pendingDateLocation}
              enabled={values.date_tracking}
              onEnabledChange={(value) => patch("date_tracking", value)}
              dates={dates}
              onDatesChange={setDates}
              pendingDate={pendingDate}
              onPendingDateChange={setPendingDate}
              reminderDays={reminderDays}
              onReminderDaysChange={setReminderDays}
              stopRequired={!isNew && product.date_tracking !== false}
              stopChoice={stopChoice}
              onStopChoiceChange={setStopChoice}
              idPrefix={formId}
              issues={issues}
              onFieldChange={clearIssue}
            />
            {isNew && belowMinimum && mayOverridePrice && (
              <div className="banner info" id={`${formId}-margin`}>
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
                    clearIssue(`${formId}-margin`);
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
              <div
                className="banner info manual-similar-warning"
                role="status"
                id={`${formId}-similar`}
              >
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
                    clearIssue(`${formId}-similar`);
                    if (error === "similar") setError(null);
                  }}
                >
                  {t(
                    "Continue with this product name",
                    "ادامه با این نام محصول",
                  )}
                </Checkbox>
              </div>
            )}
            {!isNew && priceChanged && (
              <div className="stack product-editor-price-scope">
                <Field label={t("Approval scope", "محدودهٔ تأیید")}>
                  <Select
                    value={values.scope}
                    onChange={(value) =>
                      patch("scope", value as "all" | "branch")
                    }
                    options={[
                      {
                        value: "all",
                        label: t("All branches", "همهٔ شعبه‌ها"),
                      },
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
                    {(values.scope === "all"
                      ? priceLocations
                      : [targetBranch]
                    ).map((item) => (
                      <tr key={item}>
                        <td>
                          {configuredBranchLabel(state.config, item, lang)}
                        </td>
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
                                product={{
                                  ...product,
                                  sold_by: values.sold_by,
                                }}
                                config={state.config}
                              />
                            ) : (
                              "—"
                            )}
                          </LtrText>
                        </td>
                      </tr>
                    ))}
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
          </div>
          <DialogActions className="product-editor-actions">
            <Button variant="neutral" onClick={onClose}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button
              type="submit"
              disabled={!editorBoot.ready || (isNew && !pricePreview.ready)}
            >
              {isNew
                ? t("Add product", "افزودن محصول")
                : t("Save product", "ذخیرهٔ محصول")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {priceDialogOpen && (
        <ChangePriceDialog
          product_code={product.code}
          onClose={() => setPriceDialogOpen(false)}
          onSaved={({ before_product_snapshot, after_product_snapshot }) =>
            setExpected((previous) =>
              previous === before_product_snapshot
                ? after_product_snapshot
                : previous,
            )
          }
        />
      )}
    </>
  );
}

function ProductEditButton({
  product,
  row = false,
}: {
  product: Product;
  row?: boolean;
}) {
  const { can, t } = useDemo();
  const [open, setOpen] = useState(false);
  if (
    !can("catalog.edit", {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    })
  )
    return null;
  return (
    <>
      <Button
        variant="neutral"
        size={row ? "sm" : "default"}
        aria-label={t(
          `Edit ${product.name_en}`,
          `ویرایش ${product.name_fa || product.name_en}`,
        )}
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

function ProductActionMenu({
  product,
  showChange = true,
}: {
  product: Product;
  showChange?: boolean;
}) {
  const { state, branch, actor, can, command, t, navigate } = useDemo();
  const [priceOpen, setPriceOpen] = useState(false);
  const [confirm, setConfirm] = useState<"end" | "withdraw" | null>(null);
  const [error, setError] = useState("");
  const location = lookupBranch(branch);
  const sale = activeSaleAt(state, product, location);
  const request = pendingSaleRequest(state, product, location);
  const scope: ResourceScope = {
    company_id: product.company_id,
    kind: "location_record",
    location_ids: location === "all" ? [] : [location],
    entity_id: product.code,
  };
  const mayManagePrice =
    can("pricing.regular_manage", scope) || can("sales.manage", scope);
  const mayRequestPrice =
    can("pricing.propose_manual", scope) || can("sales.request", scope);
  const mayChange = mayManagePrice || mayRequestPrice;
  const mayAddDate = can("dates.add", { ...scope, mutation: true });
  const requestScope: ResourceScope = {
    ...scope,
    entity_id: request?.id,
    owner_user_id: request?.requester_user_id,
    version: request?.revision,
  };
  const ownRequest =
    !!request &&
    request.requester_user_id === actor?.user_id &&
    can("sales.request_withdraw_own", requestScope);
  if (product.status !== "active" || !actor || (!mayChange && !mayAddDate))
    return <span className="product-row-menu-placeholder" aria-hidden="true" />;
  return (
    <>
      <Menu
        iconOnly
        showChevron={false}
        aria-label={t("Product actions", "اقدامات کالا")}
        label={
          <MoreHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
        }
      >
        {showChange && mayChange && (
          <MenuItem onClick={() => setPriceOpen(true)}>
            {salesText(
              t,
              mayManagePrice ? (sale ? "changeSale" : "change") : "request",
            )}
          </MenuItem>
        )}
        {mayAddDate && (
          <MenuItem
            onClick={() =>
              navigate(`expiry?product=${encodeURIComponent(product.code)}`)
            }
          >
            {t("Add date", "افزودن تاریخ")}
          </MenuItem>
        )}
        {sale &&
          can("sales.manage", {
            ...scope,
            entity_id: sale.id,
            version: sale.revision,
          }) && (
            <MenuItem className="danger" onClick={() => setConfirm("end")}>
              {salesText(t, "endNow")}
            </MenuItem>
          )}
        {ownRequest && (
          <MenuItem className="danger" onClick={() => setConfirm("withdraw")}>
            {salesText(t, "withdraw")}
          </MenuItem>
        )}
      </Menu>
      {priceOpen && (
        <ChangePriceDialog
          product_code={product.code}
          onClose={() => setPriceOpen(false)}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={salesText(t, confirm === "withdraw" ? "withdraw" : "endNow")}
        description={
          confirm === "withdraw"
            ? t("The regular price stays.", "قیمت عادی باقی می‌ماند.")
            : t(
                "The current regular price comes back now.",
                "قیمت عادی فعلی اکنون برمی‌گردد.",
              )
        }
        confirmLabel={salesText(
          t,
          confirm === "withdraw" ? "withdraw" : "endNow",
        )}
        onConfirm={async () => {
          try {
            if (confirm === "end" && sale)
              await command(
                "sales.manage",
                {
                  ...scope,
                  entity_id: sale.id,
                  version: sale.revision,
                  mutation: true,
                },
                (next, freshActor) =>
                  endSale(next, freshActor, sale.id, {
                    expected_revision: sale.revision,
                  }),
              );
            else if (confirm === "withdraw" && request)
              await command(
                "sales.request_withdraw_own",
                { ...requestScope, mutation: true },
                (next, freshActor) =>
                  withdrawSaleRequest(
                    next,
                    freshActor,
                    request.id,
                    request.revision,
                  ),
              );
            setConfirm(null);
            setError("");
          } catch {
            setError(
              t(
                "This sale or request changed. Close and try again.",
                "این حراج یا درخواست تغییر کرده است. ببندید و دوباره تلاش کنید.",
              ),
            );
          }
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function ProductHeaderActions({ product }: { product: Product }) {
  const { state, branch, can, t } = useDemo();
  const [priceOpen, setPriceOpen] = useState(false);
  const sale = activeSaleAt(state, product, lookupBranch(branch));
  const scope: ResourceScope = {
    company_id: product.company_id,
    kind: "location_record",
    location_ids: branch === "all" ? [] : [branch],
    entity_id: product.code,
  };
  const mayManagePrice =
    can("pricing.regular_manage", scope) || can("sales.manage", scope);
  const mayChange =
    mayManagePrice ||
    can("pricing.propose_manual", scope) ||
    can("sales.request", scope);
  if (
    !mayChange &&
    !can("catalog.edit", {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    }) &&
    !can("dates.add", { ...scope, mutation: true })
  )
    return null;
  return (
    <div className="actions product-header-actions">
      {product.status === "active" && mayChange && (
        <Button onClick={() => setPriceOpen(true)}>
          {salesText(
            t,
            mayManagePrice ? (sale ? "changeSale" : "change") : "request",
          )}
        </Button>
      )}
      <ProductEditButton product={product} />
      <ProductActionMenu product={product} showChange={false} />
      {priceOpen && (
        <ChangePriceDialog
          product_code={product.code}
          onClose={() => setPriceOpen(false)}
        />
      )}
    </div>
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
              approved ? (
                <SalePrice product={product} />
              ) : (
                <SellingPrice
                  value={pending!}
                  product={product}
                  config={state.config}
                />
              )
            ) : (
              "—"
            )}
          </strong>
          <ManualPricePill product={product} />
          {profile?.taxable && (
            <Badge tone="neutral">
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
                `Pending: confirm with a ${configuredRoleLabel(state.config.roles, "manager", "en")} before selling`,
                `در انتظار تأیید: پیش از فروش با ${configuredRoleLabel(state.config.roles, "manager", "fa")} تأیید کنید`,
              )}
            </span>
          )}
        </div>
      )}
      {!approved && !pending && (
        <div className="banner pending">
          {t(
            `No approved price in this branch. Confirm with a ${configuredRoleLabel(state.config.roles, "manager", "en")} before selling.`,
            `در این شعبه قیمت تأییدشده‌ای وجود ندارد. پیش از فروش با ${configuredRoleLabel(state.config.roles, "manager", "fa")} تأیید کنید.`,
          )}
        </div>
      )}
    </div>
  );
}

function ProductDates({ product }: { product: Product }) {
  return <ProductDatesSection product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const { state, branch, actor, can, setBranch, lang, t, navigate } = useDemo();
  const location = lookupBranch(branch);
  const financial = useCatalogQuery(
    "catalog.cost_read",
    {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    },
    product.code,
    (draft, freshActor) =>
      productFinancialSnapshot(draft, freshActor, product.code),
  );
  const mayReadCost = financial.allowed;
  const category =
    financial.data?.category ??
    state.config.pricing_categories.find(
      (item) => item.key === product.pricing_category,
    );
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  const firstAdded = product.first_added_branch;
  const cost = financial.data?.cost ?? null;
  const price = effectivePrice(state, product, location);
  const margin = cost && price ? sellingMargin(price, cost) : null;
  const deliveryQuery = useCatalogQuery(
    "received.read",
    {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    },
    product.code,
    (draft, freshActor) =>
      receivedLog(draft, freshActor, { product: product.code }),
  );
  const deliveries = deliveryQuery.data ?? [];
  const last = deliveries.find((entry) => entry.branch === location);
  const costs = financial.data?.costs ?? [];
  const locations = sellingBranches(state.config).filter(
    (item) =>
      actor?.allowed_branches.includes(item) &&
      (branch === "all" || item === branch),
  );
  const activity = state.activity.filter(
    (entry) =>
      entry.company_id === product.company_id &&
      entry.product_code === product.code,
  );
  const facts = [
    {
      label: t("Barcode", "بارکد"),
      value: product.barcode ? (
        <LtrText>{product.barcode}</LtrText>
      ) : (
        t("Not added", "اضافه نشده")
      ),
    },
    {
      label: t("AI category", "دستهٔ هوش مصنوعی"),
      value: categoryLabel(product.ai_category, lang),
    },
    {
      label: t("Pricing category", "دستهٔ قیمت‌گذاری"),
      value: categoryLabel(category?.label ?? product.pricing_category, lang),
    },
    {
      label: t("Tax", "مالیات"),
      value: profile
        ? t(profile.label_en, profile.label_fa)
        : t("Not set", "تنظیم نشده"),
    },
    {
      label: t("Supplier", "تأمین‌کننده"),
      value: <LtrText>{product.main_supplier}</LtrText>,
    },
    {
      label: t("Sold by", "روش فروش"),
      value:
        product.sold_by === "weight" ? t("Weight", "وزن") : t("Each", "عدد"),
    },
    {
      label: t("Unit size", "اندازهٔ واحد"),
      value:
        product.sold_by === "weight" ? (
          t("Sold by weight", "فروش وزنی")
        ) : (
          <UnitSize value={product.unit_size} />
        ),
    },
    {
      label: t("First added at", "اولین بار اضافه‌شده در"),
      value: firstAdded
        ? configuredBranchLabel(state.config, firstAdded, lang)
        : "—",
    },
  ];
  return (
    <>
      <div
        className={`product-page-top-cards${!mayReadCost ? " without-private-cost" : ""}`}
      >
        <Card className="product-page-price-card">
          <h2>
            {t("Price at", "قیمت در")}{" "}
            {configuredBranchLabel(state.config, location, lang)}
          </h2>
          {location === "all" ? (
            <Field label={t("Location", "مکان")}>
              <Select
                value=""
                onChange={(value) => {
                  if (locations.includes(value)) void setBranch(value);
                }}
                options={[
                  { value: "", label: t("Choose location", "انتخاب مکان") },
                  ...locations.map((value) => ({
                    value,
                    label: configuredBranchLabel(state.config, value, lang),
                  })),
                ]}
              />
            </Field>
          ) : (
            <>
              <ProductPrice product={product} />
              <SaleStatus product={product} />
              <PendingSalePill product={product} />
              <p className="muted">
                {product.branch_prices?.[location]
                  ? t("This branch only", "فقط این شعبه")
                  : t("Company default", "پیش‌فرض شرکت")}
              </p>
              <ProductProvenance product={product} />
            </>
          )}
          <div className="product-last-received-summary">
            <span className="muted">{t("Last received", "آخرین دریافت")}</span>
            {last ? (
              <>
                <DateText value={last.date} />
                <a href={`#invoices?id=${encodeURIComponent(last.invoice_id)}`}>
                  <LtrText>{last.invoice_number}</LtrText>
                </a>
              </>
            ) : (
              <span className="muted">
                {t("No deliveries yet", "هنوز تحویلی ثبت نشده است")}
              </span>
            )}
          </div>
        </Card>
        {mayReadCost && location !== "all" && (
          <Card className="product-page-cost-card">
            <h2>{t("Cost and margin", "هزینه و حاشیهٔ سود")}</h2>
            <dl className="product-card-facts">
              <div>
                <dt>{t("Store cost", "هزینهٔ فروشگاه")}</dt>
                <dd>
                  {cost ? (
                    <ProductCost
                      value={cost}
                      product={product}
                      config={state.config}
                    />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("Margin %", "حاشیه سود %")}</dt>
                <dd>{margin !== null ? <LtrText>{margin}%</LtrText> : "—"}</dd>
              </div>
              <div>
                <dt>{t("Pricing category", "دستهٔ قیمت‌گذاری")}</dt>
                <dd>
                  {categoryLabel(
                    category?.label ?? product.pricing_category,
                    lang,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("Cost divisor", "ضریب تقسیم هزینه")}</dt>
                <dd>
                  <LtrText>
                    {financial.data?.category?.cost_divisor ?? "—"}
                  </LtrText>
                </dd>
              </div>
              <div>
                <dt>{t("Minimum margin", "حداقل حاشیهٔ سود")}</dt>
                <dd>
                  {financial.data?.category?.minimum_margin ? (
                    <LtrText>
                      {new Decimal(financial.data.category.minimum_margin)
                        .times(100)
                        .toFixed()}
                      %
                    </LtrText>
                  ) : (
                    t("Not set", "تنظیم نشده")
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        )}
        <Card className="product-page-dates-card">
          <div className="card-heading">
            <h2>
              {t("Dates at", "تاریخ‌ها در")}{" "}
              {configuredBranchLabel(state.config, location, lang)}
            </h2>
            {can("dates.add", {
              company_id: product.company_id,
              kind: "location_record",
              location_ids: location === "all" ? [] : [location],
              mutation: true,
            }) && (
              <Button
                variant="plain"
                onClick={() =>
                  navigate(`expiry?product=${encodeURIComponent(product.code)}`)
                }
              >
                {t("Add date", "افزودن تاریخ")}
              </Button>
            )}
          </div>
          <ProductDatesSection product={product} showReceived={false} />
        </Card>
      </div>
      <Card className="product-page-details-card">
        <h2>{t("Details", "جزئیات")}</h2>
        <dl className="product-details-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {(product.description_en || product.description_fa) && (
          <div className="product-page-description">
            <h3>{t("Description", "توضیحات")}</h3>
            <p>
              {lang === "fa"
                ? product.description_fa || product.description_en
                : product.description_en || product.description_fa}
            </p>
          </div>
        )}
      </Card>
      <Card>
        <h2>{t("Prices by store", "قیمت‌ها در فروشگاه‌ها")}</h2>
        {locations.length ? (
          <DataTable
            columns={[
              {
                key: "location",
                label: t("Location", "مکان"),
                required: true,
                priority: 1,
              },
              {
                key: "price",
                label: t("Selling price", "قیمت فروش"),
                align: "end",
                priority: 2,
              },
              {
                key: "scope",
                label: t("Price scope", "محدودهٔ قیمت"),
                priority: 3,
              },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Location", "مکان")}</th>
                <th className="numeric">{t("Selling price", "قیمت فروش")}</th>
                <th>{t("Price scope", "محدودهٔ قیمت")}</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((store) => (
                <tr key={store}>
                  <td>{configuredBranchLabel(state.config, store, lang)}</td>
                  <td className="numeric">
                    <SalePrice product={product} branch={store} stacked />
                    <SaleStatus product={product} branch={store} compact />
                    <PendingSalePill product={product} branch={store} compact />
                    <ManualPricePill product={product} branch={store} />
                  </td>
                  <td>
                    {product.branch_prices?.[store]
                      ? t("This branch only", "فقط این شعبه")
                      : t("Company default", "پیش‌فرض شرکت")}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="muted">
            {t("No selling stores.", "فروشگاهی برای فروش وجود ندارد.")}
          </p>
        )}
      </Card>
      <Card>
        <h2>{t("Deliveries", "تحویل‌ها")}</h2>
        {deliveries.length ? (
          <DataTable
            className="product-last-received-table"
            columns={[
              {
                key: "date",
                label: t("Date", "تاریخ"),
                required: true,
                priority: 1,
              },
              { key: "location", label: t("Location", "مکان"), priority: 3 },
              {
                key: "quantity",
                label: t("Cases and units", "کارتن و واحد"),
                priority: 2,
              },
              {
                key: "supplier",
                label: t("Supplier", "تأمین‌کننده"),
                priority: 4,
              },
              {
                key: "invoice",
                label: t("Invoice number", "شمارهٔ فاکتور"),
                priority: 5,
              },
              {
                key: "actions",
                label: t("Details", "جزئیات"),
                actions: true,
                priority: 0,
              },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Date", "تاریخ")}</th>
                <th>{t("Location", "مکان")}</th>
                <th>{t("Cases and units", "کارتن و واحد")}</th>
                <th>{t("Supplier", "تأمین‌کننده")}</th>
                <th>{t("Invoice number", "شمارهٔ فاکتور")}</th>
                <th>{t("Details", "جزئیات")}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((entry) => (
                <tr
                  key={entry.id}
                  data-row-href={`#invoices?id=${encodeURIComponent(entry.invoice_id)}`}
                >
                  <td>
                    <DateText value={entry.date} />
                  </td>
                  <td>
                    {configuredBranchLabel(state.config, entry.branch, lang)}
                  </td>
                  <td>
                    <LtrText>
                      {entry.sold_by === "weight"
                        ? formatQuantity(
                            entry.source_quantity ?? String(entry.units),
                            entry.source_quantity_unit ?? "lb",
                            lang,
                          )
                        : formatCasesAndUnits(
                            entry.units,
                            entry.units_per_case,
                            lang,
                          )}
                    </LtrText>
                  </td>
                  <td>
                    <LtrText>{entry.supplier}</LtrText>
                  </td>
                  <td>
                    <LtrText>{entry.invoice_number}</LtrText>
                  </td>
                  <td>
                    <div className="actions">
                      <TableRowLink
                        href={`#invoices?id=${encodeURIComponent(entry.invoice_id)}`}
                        aria-label={t(
                          `Open ${entry.invoice_number}`,
                          `باز کردن ${entry.invoice_number}`,
                        )}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="muted">
            {t("No deliveries yet", "هنوز تحویلی ثبت نشده است")}
          </p>
        )}
      </Card>
      {mayReadCost && (
        <>
          <Card>
            <ProductLotsSection product={product} />
          </Card>
          <Card>
            <h2>{t("Cost history", "تاریخچهٔ هزینه")}</h2>
            {costs.length ? (
              <DataTable
                className="product-cost-history-table"
                columns={[
                  {
                    key: "supplier",
                    label: t("Supplier", "تأمین‌کننده"),
                    required: true,
                    priority: 1,
                  },
                  {
                    key: "location",
                    label: t("Location", "مکان"),
                    priority: 5,
                  },
                  { key: "date", label: t("Date", "تاریخ"), priority: 3 },
                  {
                    key: "invoice",
                    label: t("Invoice number", "شمارهٔ فاکتور"),
                    priority: 4,
                  },
                  {
                    key: "cost",
                    label: t(
                      "Unit cost before tax",
                      "هزینهٔ واحد پیش از مالیات",
                    ),
                    align: "end",
                    priority: 2,
                  },
                  {
                    key: "basis",
                    label: t("Price basis", "مبنای قیمت"),
                    priority: 6,
                  },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Supplier", "تأمین‌کننده")}</th>
                    <th>{t("Location", "مکان")}</th>
                    <th>{t("Date", "تاریخ")}</th>
                    <th>{t("Invoice number", "شمارهٔ فاکتور")}</th>
                    <th className="numeric">
                      {t("Unit cost before tax", "هزینهٔ واحد پیش از مالیات")}
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
                      <td className="numeric">
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
            ) : (
              <p className="muted">
                {t(
                  "No recorded cost history.",
                  "تاریخچهٔ هزینه‌ای ثبت نشده است.",
                )}
              </p>
            )}
          </Card>
        </>
      )}
      <Card>
        <h2>{t("History", "تاریخچه")}</h2>
        {activity.length ? (
          <ul className="product-history-list">
            {activity.map((entry) => (
              <li key={entry.id}>
                <span>{activityLabel(entry.action, lang)}</span>
                <span className="muted">
                  <bdi dir="auto">{demoUserLabel(entry.by, lang)}</bdi> ·{" "}
                  <DateText value={entry.at} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {t("No recorded changes.", "تغییری ثبت نشده است.")}
          </p>
        )}
      </Card>
    </>
  );
}

function LookupProductDetail({ product }: { product: Product }) {
  const { state, branch, t, lang } = useDemo();
  const approved = effectivePrice(state, product, branch);
  const pending = pendingPrice(state, product, branch);
  const offer = effectiveOffer(state, product, branch);
  const clearances = effectiveProjectedClearanceOffers(state, product, branch);
  const firstAdded = product.first_added_branch;
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  return (
    <Card className="lookup-detail">
      <div className="lookup-detail-header">
        <div>
          <h2 lang={lang} dir={lang === "fa" ? "rtl" : "ltr"}>
            <bdi dir={lang === "fa" && product.name_fa ? "rtl" : "ltr"}>
              <UnitText>
                {lang === "fa"
                  ? product.name_fa || product.name_en
                  : product.name_en}
              </UnitText>
            </bdi>
          </h2>
          {product.name_fa && (
            <p className="muted" lang={lang === "fa" ? "en" : "fa"}>
              <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                <UnitText>
                  {lang === "fa" ? product.name_en : product.name_fa}
                </UnitText>
              </bdi>
            </p>
          )}
          <p className="lookup-product-meta muted">
            <span>
              {t(state.config.terminology.product_code, "کد محصول")}{" "}
              <LtrText>{product.code}</LtrText>
            </span>
            <UnitSize value={product.unit_size} />
          </p>
          {firstAdded && (
            <p className="helper">
              {t("First added at", "نخستین ثبت در")}{" "}
              {configuredBranchLabel(state.config, firstAdded, lang)}
            </p>
          )}
        </div>
        <ProductHeaderActions product={product} />
      </div>
      <ProductProvenance product={product} />
      <div className="lookup-price-block">
        <div className="lookup-approved-price">
          {approved ? (
            <strong className="price" dir="ltr">
              <SalePrice product={product} />
            </strong>
          ) : (
            <p className="muted lookup-missing-price">
              {t("No approved price yet", "هنوز قیمت تأییدشده‌ای وجود ندارد")}
            </p>
          )}
          <div className="lookup-price-context">
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
            {offer && (
              <Badge tone="info" className="offer-pill">
                <OfferLabel label={offer.label} language={lang} />
              </Badge>
            )}
            <p className="helper">{t("Before tax", "پیش از مالیات")}</p>
            <ManualPricePill product={product} />
          </div>
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
      {clearances.map((clearance) => (
        <div key={clearance.id} className="lookup-clearance-row">
          <Badge tone="info">
            {t("Clearance price", "قیمت فروش ویژه")}{" "}
            <SellingPrice
              value={clearance.price}
              product={product}
              config={state.config}
            />
          </Badge>
          <span className="muted">
            {t("Expires", "انقضا")} <DateText value={clearance.expiry_date} /> ·{" "}
            {configuredBranchLabel(state.config, clearance.branch, lang)}
          </span>
        </div>
      ))}
      <SaleStatus product={product} />
      <PendingSalePill product={product} />
      <ProductDates product={product} />
      {profile?.taxable && (
        <div className="lookup-price-tags actions">
          <Badge tone="neutral">
            {t(state.config.tax.label_text_en, state.config.tax.label_text_fa)}
          </Badge>
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
                `Pending: confirm with a ${configuredRoleLabel(state.config.roles, "manager", "en")} before selling`,
                `در انتظار تأیید: پیش از فروش با ${configuredRoleLabel(state.config.roles, "manager", "fa")} تأیید کنید`,
              )}
        </p>
      )}
      {!approved && !pending && (
        <p className="helper">
          {t(
            `Confirm with a ${configuredRoleLabel(state.config.roles, "manager", "en")} before selling.`,
            `پیش از فروش با ${configuredRoleLabel(state.config.roles, "manager", "fa")} تأیید کنید.`,
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
  const { state, branch, actor, setBranch, t, lang } = useDemo();
  const allowedStores = sellingBranches(state.config).filter((id) =>
    actor?.allowed_branches.includes(id),
  );
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
    ...new Set(products.map((product) => product.ai_category).filter(Boolean)),
  ].sort(
    (a, b) =>
      products.filter((product) => product.ai_category === b).length -
        products.filter((product) => product.ai_category === a).length ||
      a.localeCompare(b),
  );

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
          <div
            className="lookup-category-chips"
            role="group"
            aria-label={t("AI category", "دستهٔ هوش مصنوعی")}
          >
            {["", ...categories.slice(0, 3)].map((value) => (
              <Button
                key={value}
                variant="neutral"
                className={`filter-chip${category === value ? " is-selected" : ""}`}
                aria-pressed={category === value}
                onClick={() => {
                  setCategory(value);
                  setSelectedCode("");
                  setActiveCode("");
                }}
              >
                {value ? categoryLabel(value, lang) : t("All", "همه")}
              </Button>
            ))}
            {categories.length > 3 && (
              <Menu
                label={
                  categories.slice(3).includes(category)
                    ? categoryLabel(category, lang)
                    : t("More", "بیشتر")
                }
                aria-label={t("More categories", "دسته‌های بیشتر")}
                className={`lookup-category-more${categories.slice(3).includes(category) ? " is-selected" : ""}`}
              >
                {categories.slice(3).map((value) => (
                  <MenuItem
                    key={value}
                    onClick={() => {
                      setCategory(value);
                      setSelectedCode("");
                      setActiveCode("");
                    }}
                  >
                    {categoryLabel(value, lang)}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </div>
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
        <Card>
          <Field label={t("Location", "مکان")}>
            <Select
              value=""
              onChange={(value) => {
                if (allowedStores.includes(value)) void setBranch(value);
              }}
              options={[
                { value: "", label: t("Choose location", "انتخاب مکان") },
                ...allowedStores.map((value) => ({
                  value,
                  label: configuredBranchLabel(state.config, value, lang),
                })),
              ]}
            />
          </Field>
        </Card>
      )}
      {branch === "all" ? null : !selected ? (
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
                        <bdi
                          dir={lang === "fa" && product.name_fa ? "rtl" : "ltr"}
                        >
                          <UnitText>
                            {lang === "fa"
                              ? product.name_fa || product.name_en
                              : product.name_en}
                          </UnitText>
                        </bdi>
                      </strong>
                      <span className="lookup-result-secondary muted">
                        {product.name_fa && (
                          <bdi
                            className="lookup-secondary-name"
                            lang={lang === "fa" ? "en" : "fa"}
                            dir={lang === "fa" ? "ltr" : "rtl"}
                          >
                            <UnitText>
                              {lang === "fa"
                                ? product.name_en
                                : product.name_fa}
                            </UnitText>
                          </bdi>
                        )}
                        <span className="lookup-result-meta">
                          {t(state.config.terminology.product_code, "کد محصول")}{" "}
                          <LtrText>{product.code}</LtrText>
                        </span>
                      </span>
                    </span>
                    <span className="lookup-result-price">
                      {price ? (
                        <SalePrice product={product} stacked />
                      ) : (
                        <span className="muted">
                          {t(
                            "No approved price yet",
                            "هنوز قیمت تأییدشده‌ای وجود ندارد",
                          )}
                        </span>
                      )}
                      <span className="lookup-result-pills actions">
                        <SaleStatus product={product} compact />
                        <PendingSalePill product={product} compact />
                        <ManualPricePill product={product} />
                        {pending && (
                          <Badge tone="pending">
                            {t("Pending", "در انتظار تأیید")}
                          </Badge>
                        )}
                        {taxable && (
                          <Badge tone="neutral">
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
  const { state, actor, can, branch, t, lang, navigate } = useDemo();
  const mayReadCost = can("catalog.cost_read", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
  });
  const financial = useCatalogQuery(
    "catalog.cost_read",
    { company_id: state.config.company.seed_key, kind: "company_shared" },
    "products",
    (draft, freshActor) =>
      Object.fromEntries(
        draft.products
          .filter((item) => item.company_id === freshActor.company_id)
          .map((item) => [
            item.code,
            productFinancialSnapshot(draft, freshActor, item.code).cost,
          ]),
      ),
  );
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
  const [onlySale, setOnlySale] = useListState("products.sale", false);
  const [onlyManual, setOnlyManual] = useListState("products.manual", false);
  const [sort, setSort] = useListState<SortColumn>("products.sort", "name");
  const [ascending, setAscending] = useListState("products.ascending", true);
  const [page, setPage] = useListState("products.page", 0);
  const tableColumns = useTableColumns("products", [
    {
      key: "name",
      label: t("Product", "محصول"),
      required: true,
      width: 270,
      priority: 1,
      minWidth: 200,
      mobilePrimary: true,
    },
    {
      key: "code",
      label: t("Product Code", "کد محصول"),
      width: 104,
      align: "end",
      priority: 3,
      minWidth: 104,
    },
    ...(mayReadCost
      ? [
          {
            key: "cost",
            label: t("Store cost", "هزینهٔ فروشگاه"),
            width: 104,
            align: "end" as const,
            priority: 6,
            minWidth: 110,
          },
          {
            key: "margin",
            label: t("Margin %", "حاشیه سود %"),
            width: 96,
            align: "end" as const,
            priority: 8,
            minWidth: 96,
          },
        ]
      : []),
    {
      key: "price",
      label: t("Approved price", "قیمت تأییدشده"),
      width: 112,
      align: "end",
      priority: 2,
      minWidth: 112,
    },
    {
      key: "status",
      label: t("Status and offer", "وضعیت و پیشنهاد"),
      width: 240,
      priority: 4,
      minWidth: 190,
    },
    {
      key: "actions",
      label: t("Details", "جزئیات"),
      width: 172,
      align: "end",
      actions: true,
      priority: 0,
      minWidth: 172,
    },
  ]);
  if (!can("catalog.read") && can("lookup.read")) return <Lookup />;
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
        (!onlyPending ||
          pendingPrice(state, product, branch) ||
          pendingSaleRequest(state, product, lookupBranch(branch))) &&
        (!onlyOffers ||
          effectiveOffer(state, product, branch) ||
          activeSaleAt(state, product, lookupBranch(branch)) ||
          effectiveProjectedClearanceOffers(state, product, branch).length >
            0) &&
        (!onlyManual ||
          product.manual_price_scopes.some(
            (scope) =>
              scope === "all" ||
              scope === branch ||
              (branch === "all" && actor?.allowed_branches.includes(scope)),
          )) &&
        (!onlySale || activeSaleAt(state, product, lookupBranch(branch))),
    )
    .sort((left, right) => {
      let comparison = 0;
      if (sort === "name")
        comparison = (
          lang === "fa" ? left.name_fa || left.name_en : left.name_en
        ).localeCompare(
          lang === "fa" ? right.name_fa || right.name_en : right.name_en,
          lang,
        );
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
    setOnlySale(false);
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
          can("catalog.create_active", {
            company_id: state.config.company.seed_key,
            kind: "company_shared",
          }) ? (
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
      <Card className="c8-products-list-card">
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
          count={
            <span className="filter-toolbar-end">
              <span>
                {translateCount(
                  "{{count}} product",
                  "{{count}} products",
                  "{{count}} محصول",
                  "{{count}} محصول",
                  results.length,
                  lang,
                )}
              </span>
              {tableColumns.chooser}
            </span>
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
          <Checkbox
            checked={onlySale}
            onChange={(value) => {
              setOnlySale(value);
              setPage(0);
            }}
            aria-label={salesText(t, "onSale")}
          >
            {salesText(t, "onSale")}
          </Checkbox>
          <Button variant="ghost" onClick={clear}>
            {t("Clear filters", "پاک کردن فیلترها")}
          </Button>
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
          <div>
            <div className="stack">
              <DataTable
                className={`catalog-products-table${mayReadCost ? " with-store-cost" : ""}`}
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
                    {mayReadCost && (
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
                    const cost = financial.data?.[product.code] ?? null;
                    const margin = cost ? sellingMargin(price, cost) : null;
                    return (
                      <tr
                        key={product.code}
                        data-row-href={`#product?code=${encodeURIComponent(product.code)}`}
                      >
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
                                <UnitText>
                                  {lang === "fa"
                                    ? product.name_fa || product.name_en
                                    : product.name_en}
                                </UnitText>
                              </bdi>
                            </strong>
                          </a>
                          <p className="muted catalog-product-secondary">
                            <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                              <UnitText>
                                {lang === "fa"
                                  ? product.name_en
                                  : product.name_fa}
                              </UnitText>
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
                        {mayReadCost && (
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
                          <div className="catalog-charge-and-request">
                            {price ? (
                              <SalePrice product={product} stacked />
                            ) : (
                              "—"
                            )}
                            <SaleStatus product={product} compact />
                            <PendingSalePill product={product} />
                          </div>
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
                                <OfferLabel
                                  label={offer.label}
                                  language={lang}
                                />
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="actions catalog-row-actions">
                            <ProductEditButton product={product} row />
                            <ProductActionMenu product={product} />
                            <TableRowLink
                              href={`#product?code=${encodeURIComponent(product.code)}`}
                              aria-label={t(
                                `Open ${product.name_en}`,
                                `باز کردن ${product.name_fa || product.name_en}`,
                              )}
                            />
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
          </div>
        )}
      </Card>
    </div>
  );
}

export function ProductPage() {
  const { state, can, lang, t } = useDemo();
  const code = useRouteParam("code");
  const product = state.products.find(
    (item) =>
      item.code === code && item.company_id === state.config.company.seed_key,
  );
  if (!can("catalog.read") && can("lookup.read")) return <Lookup />;
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
  const tax = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  return (
    <div className="stack product-page">
      <Button className="product-back" variant="plain" asChild>
        <a href="#products">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("Back to Products", "بازگشت به محصولات")}
        </a>
      </Button>
      <header className="page-header">
        <div>
          <h1>
            <bdi dir={lang === "fa" && product.name_fa ? "rtl" : "ltr"}>
              <UnitText>
                {lang === "fa"
                  ? product.name_fa || product.name_en
                  : product.name_en}
              </UnitText>
            </bdi>
          </h1>
          {product.name_fa && (
            <p className="muted product-other-name">
              <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                <UnitText>
                  {lang === "fa" ? product.name_en : product.name_fa}
                </UnitText>
              </bdi>
            </p>
          )}
          <div className="actions product-page-chips">
            <Badge tone="neutral">
              {t("Product Code", "کد محصول")} <LtrText>{product.code}</LtrText>
            </Badge>
            <Badge tone="neutral">
              {product.sold_by === "weight" ? (
                t("Sold by weight", "فروش وزنی")
              ) : (
                <UnitSize value={product.unit_size} />
              )}
            </Badge>
            {tax && (
              <Badge tone="neutral">{t(tax.label_en, tax.label_fa)}</Badge>
            )}
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
        </div>
        <ProductHeaderActions product={product} />
      </header>
      <ProductDetail product={product} />
    </div>
  );
}
