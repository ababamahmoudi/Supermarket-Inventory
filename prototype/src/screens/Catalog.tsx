import { translateCount } from "../i18n";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Decimal from "decimal.js";
import { Search, ScanLine, ArrowLeft } from "lucide-react";
import "../catalog-a2.css";
import {
  effectiveOffer,
  effectivePrice,
  lookupBranch,
  pendingPrice,
  searchProducts,
} from "../catalog";
import { useDemo } from "../store";
import {
  configuredBranches,
  branchLabel as configuredBranchLabel,
  activePricingCategories,
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
import "./manual-entry.css";
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
  Select,
} from "../ui";

import {
  activityLabel,
  categoryLabel,
  demoUserLabel,
  DateText,
  LtrText,
  Money,
  OfferLabel,
  UnitSize,
} from "../presentation";

const PAGE_SIZE = 8;

function ProductProvenance({ product }: { product: Product }) {
  const { branch, t, lang } = useDemo();
  const source =
    product.price_provenance?.[lookupBranch(branch)] ??
    product.price_provenance?.all;
  if (!source) return null;
  return (
    <p className="helper product-price-provenance">
      {t("Calculated from invoice", "محاسبه‌شده از فاکتور")}{" "}
      <LtrText>{source.invoice_number}</LtrText>:{" "}
      <Money value={source.calculated_price} />
      {source.changed_price && (
        <>
          {" "}
          · {t("Changed by", "تغییریافته توسط")}{" "}
          <bdi dir="auto">{demoUserLabel(source.changed_by ?? "", lang)}</bdi>{" "}
          {t("on", "در")} <DateText value={source.changed_at} />:{" "}
          <Money value={source.changed_price} />
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
    stock: [
      "Enter a whole starting stock count for each allowed branch.",
      "تعداد صحیح موجودی اولیه را برای هر شعبهٔ مجاز وارد کنید.",
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
  const [manualPrice, setManualPrice] = useState(false);
  const [startingCounts, setStartingCounts] = useState<Record<string, string>>(
    {},
  );
  const [similarConfirmed, setSimilarConfirmed] = useState(false);
  const [marginConfirmed, setMarginConfirmed] = useState(false);
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  );
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
    date_tracking:
      product.date_tracking ?? category?.date_tracking_prompt ?? false,
    scope: "all",
  });
  const [sellingPrice, setSellingPrice] = useState(startingPrice);
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
  ) => setValues((current) => ({ ...current, [key]: value }));
  const priceChanged = sellingPrice !== startingPrice;
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
  try {
    calculatedPrice = calculatePrice(
      cost,
      values.pricing_category,
      state.config,
    ).selling_price;
  } catch {
    /* Invalid draft cost is explained on Save. */
  }
  const effectiveSellingPrice =
    isNew && !manualPrice ? calculatedPrice : sellingPrice;
  const minimum = state.config.pricing_categories.find(
    (item) => item.key === values.pricing_category,
  )?.minimum_margin;
  const belowMinimum =
    isNew &&
    /^\d+(\.\d{1,4})?$/.test(cost) &&
    /^\d+(\.\d{1,2})?$/.test(effectiveSellingPrice) &&
    minimum !== null &&
    minimum !== undefined &&
    new Decimal(effectiveSellingPrice)
      .minus(cost)
      .lt(new Decimal(effectiveSellingPrice).times(minimum));
  const similar = isNew ? similarProductNames(state, values.name_en) : [];
  if (
    isNew &&
    role !== "supervisor" &&
    !(role === "floor_worker" && invoiceQuickAdd)
  )
    return null;
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
                      selling_price: effectiveSellingPrice || undefined,
                      minimum_margin_confirmed: marginConfirmed,
                      similar_name_confirmed: similarConfirmed,
                      opening_counts:
                        role === "supervisor"
                          ? Object.entries(startingCounts)
                              .filter(([, quantity]) => quantity.trim())
                              .map(([value, quantity]) => ({
                                branch: value,
                                quantity: Number(quantity),
                              }))
                          : [],
                    } as NewProductEdits,
                    invoiceQuickAdd,
                  ),
                );
              });
              onCreated?.(created!);
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
                  ...(priceChanged ? { selling_price: sellingPrice } : {}),
                },
                expected,
              ),
            );
            onClose();
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
          <Field label={t("Category", "دسته")}>
            <Select
              value={values.ai_category}
              onChange={(value) => patch("ai_category", value)}
              options={categories.map((value) => ({
                value,
                label: categoryLabel(value, lang),
              }))}
            />
          </Field>
          <Field label={t("Pricing category", "دستهٔ قیمت‌گذاری")}>
            <Select
              value={values.pricing_category}
              onChange={(value) => patch("pricing_category", value)}
              options={activePricingCategories(state.config).map((item) => ({
                value: item.key,
                label: categoryLabel(item.label, lang),
              }))}
            />
          </Field>
          <Field label={t("Supplier", "تأمین‌کننده")}>
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
                }}
              />
            </Field>
          )}
          <Field
            label={t("Selling price", "قیمت فروش")}
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
              }}
            />
          </Field>
          <Field label={t("Date tracking", "پیگیری تاریخ")}>
            <Select
              value={values.date_tracking ? "yes" : "no"}
              onChange={(value) => patch("date_tracking", value === "yes")}
              options={[
                { value: "yes", label: t("Yes", "بله") },
                { value: "no", label: t("No", "خیر") },
              ]}
            />
          </Field>
        </div>
        {isNew && role === "supervisor" && (
          <fieldset className="manual-opening-fields">
            <legend>
              {t(
                "Starting stock count (optional)",
                "تعداد موجودی اولیه (اختیاری)",
              )}
            </legend>
            {branches.map((value) => (
              <Field
                key={value}
                label={configuredBranchLabel(state.config, value, lang)}
              >
                <input
                  dir="ltr"
                  inputMode="numeric"
                  className="control-narrow"
                  value={startingCounts[value] ?? ""}
                  onChange={(event) =>
                    setStartingCounts((current) => ({
                      ...current,
                      [value]: event.target.value,
                    }))
                  }
                />
              </Field>
            ))}
          </fieldset>
        )}
        {isNew && belowMinimum && role === "supervisor" && (
          <div className="banner info">
            <p>
              {t(
                "This price is below the minimum margin.",
                "این قیمت کمتر از حداقل حاشیه است.",
              )}
            </p>
            <Checkbox checked={marginConfirmed} onChange={setMarginConfirmed}>
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
                variant="ghost"
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
            <Checkbox checked={similarConfirmed} onChange={setSimilarConfirmed}>
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
                  {
                    value: "branch",
                    label: t("This branch only", "فقط این شعبه"),
                  },
                ]}
              />
            </Field>
            {values.scope === "branch" && branch === "all" && (
              <Field label={t("Branch", "شعبه")}>
                <Select
                  value={targetBranch}
                  onChange={(value) => setTargetBranch(value as Branch)}
                  options={branches.map((value) => ({
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
                {(values.scope === "all" ? branches : [targetBranch]).map(
                  (item) => (
                    <tr key={item}>
                      <td>{configuredBranchLabel(state.config, item, lang)}</td>
                      <td>
                        {effectivePrice(state, product, item) ? (
                          <Money
                            value={effectivePrice(state, product, item)!}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <LtrText>
                          {/^\d+(\.\d{1,2})?$/.test(sellingPrice) ? (
                            <Money value={sellingPrice} />
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
        {error && (
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
            : t("Selling price before tax", "قیمت فروش پیش از مالیات")}
        </p>
        <div className="actions">
          <strong className="price" dir="ltr">
            {approved || pending ? <Money value={approved || pending!} /> : "—"}
          </strong>
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
                <Money value={pending} />
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

function ProductDetail({
  product,
  operational = false,
  showName = true,
}: {
  product: Product;
  operational?: boolean;
  showName?: boolean;
}) {
  const { state, branch, role, lang, t } = useDemo();
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  );
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  const canSeeOperations = operational && role !== "cashier";
  const branches = configuredBranches(state.config, true);
  const visibleBranches =
    role === "supervisor" ? branches : [lookupBranch(branch)];
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
                    {branches.map((item) => {
                      const price = effectivePrice(state, product, item);
                      return (
                        <tr key={item}>
                          <td>
                            {configuredBranchLabel(state.config, item, lang)}
                          </td>
                          <td className="numeric">
                            {price ? <Money value={price} /> : "—"}
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
                  {t(
                    "Last supplier unit cost before tax",
                    "آخرین هزینهٔ واحد از تأمین‌کننده پیش از مالیات",
                  )}
                  :{" "}
                  <strong>
                    <Money value={product.last_cost_before_tax} />
                  </strong>
                </p>
              </div>
            )}
            <div className="stack">
              <h3>{t("Stock estimate", "برآورد موجودی")}</h3>
              <p className="muted">
                {t(
                  "An estimate until a cash register is connected.",
                  "تا زمان اتصال صندوق فروش، این مقدار برآورد است.",
                )}
              </p>
              <dl className="form-grid">
                {visibleBranches.map((item) => (
                  <div key={item}>
                    <dt className="muted">
                      {configuredBranchLabel(state.config, item, lang)}
                    </dt>
                    <dd>
                      <LtrText>
                        {state.stock[`${item}:${product.code}`] ?? 0}
                      </LtrText>
                    </dd>
                  </div>
                ))}
              </dl>
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
            {t(
              state.config.terminology.selling_price.replace(
                /^Selling Price$/,
                "Selling price",
              ),
              "قیمت فروش",
            )}
          </p>
          {approved ? (
            <strong className="price" dir="ltr">
              <Money value={approved} />
            </strong>
          ) : (
            <p className="muted lookup-missing-price">
              {t("No approved price yet", "هنوز قیمت تأییدشده‌ای وجود ندارد")}
            </p>
          )}
          <p className="helper">{t("Before tax", "پیش از مالیات")}</p>
        </div>
        {pending && (
          <div className="lookup-pending-price">
            <Badge tone="pending">
              {approved
                ? t("New price pending", "قیمت جدید در انتظار تأیید")
                : t("Pending", "در انتظار تأیید")}
            </Badge>
            <Money value={pending} />
          </div>
        )}
      </div>
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
                        <Money value={price} />
                      ) : (
                        <span className="muted">
                          {t(
                            "No approved price yet",
                            "هنوز قیمت تأییدشده‌ای وجود ندارد",
                          )}
                        </span>
                      )}
                      <span className="lookup-result-pills actions">
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
  const [search, setSearch] = useState("");
  const [pricingCategory, setPricingCategory] = useState("");
  const [aiCategory, setAiCategory] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [sort, setSort] = useState<SortColumn>("name");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);
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
        (!onlyOffers || effectiveOffer(state, product, branch)),
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
      <div className="catalog-filter-toolbar filter-toolbar">
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
        <Button variant="ghost" onClick={clear}>
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
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
      </div>
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
              className="catalog-products-table"
              columns={[
                { width: "35%" },
                { width: "104px", align: "end" },
                { width: "120px", align: "end" },
                { width: "28%" },
                {
                  width: role === "supervisor" ? "156px" : "84px",
                  align: "end",
                  actions: true,
                },
              ]}
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
                    <Button variant="ghost" onClick={() => sortBy("name")}>
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
                    <Button variant="ghost" onClick={() => sortBy("code")}>
                      {t("Product Code", "کد محصول")}
                      {sort === "code" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
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
                    <Button variant="ghost" onClick={() => sortBy("price")}>
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
                  return (
                    <tr key={product.code}>
                      <td>
                        <strong className="catalog-product-name">
                          <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                            {lang === "fa" ? product.name_fa : product.name_en}
                          </bdi>
                        </strong>
                        <p className="muted catalog-product-secondary">
                          <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                            {lang === "fa" ? product.name_en : product.name_fa}
                          </bdi>
                        </p>
                        <p className="muted">
                          <UnitSize value={product.unit_size} />
                        </p>
                      </td>
                      <td className="numeric">
                        <LtrText>{product.code}</LtrText>
                      </td>
                      <td className="numeric">
                        {price ? <Money value={price} /> : "—"}
                      </td>
                      <td>
                        <div className="actions">
                          {pending && (
                            <Badge tone="pending">
                              {t("Pending", "در انتظار تأیید")}{" "}
                              <Money value={pending} />
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
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `product?code=${encodeURIComponent(product.code)}`,
                              )
                            }
                            aria-label={t(
                              `View ${product.name_en}`,
                              `نمایش ${product.name_fa}`,
                            )}
                          >
                            {t("View", "نمایش")}
                          </Button>
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
