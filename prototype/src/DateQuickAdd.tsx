import "./date-tracking.css";
import { useId, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { normalizeSearch, searchProducts } from "./catalog";
import {
  addTrackedDate,
  allowedDateLocations,
  DateTrackingError,
  dateTrackingErrorMessage,
  validTrackedDate,
  type AddTrackedDateInput,
} from "./date-tracking";
import { LtrText, ProductName } from "./presentation";
import { branchLabel } from "./settings";
import { useDemo } from "./store";
import type { Branch, Product } from "./types";
import { Button, DateField, Field, NumberField, Select } from "./ui";

type DateQuickAddProps = {
  productCode?: string;
  defaultLocation?: Branch;
  inline?: boolean;
  onAdded?: (id: string, location: Branch, trackingEnabled: boolean) => void;
};

/** The same guarded action powers shelf entry and the Lookup inline form. */
export function DateQuickAdd({
  productCode,
  defaultLocation,
  inline = false,
  onAdded,
}: DateQuickAddProps) {
  const { state, update, historyContext, role, branch, lang, t } = useDemo();
  const products = state.products.filter(
    (product) =>
      product.company_id === state.config.company.seed_key &&
      product.status !== "archived",
  );
  const locations = historyContext
    ? allowedDateLocations(state, historyContext)
    : [];
  const initialProduct = products.find((item) => item.code === productCode);
  const [query, setQuery] = useState(
    initialProduct
      ? lang === "fa"
        ? initialProduct.name_fa || initialProduct.name_en
        : initialProduct.name_en
      : "",
  );
  const [selectedCode, setSelectedCode] = useState(initialProduct?.code ?? "");
  const [activeCode, setActiveCode] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Omit<AddTrackedDateInput, "product_code">>(
    {
      branch: locations.includes(defaultLocation ?? branch)
        ? (defaultLocation ?? branch)
        : (locations[0] ?? ""),
      date: "",
      date_type: "expiry",
      quantity: "",
      lot_number: "",
      note: "",
    },
  );
  const currentDefault = defaultLocation ?? branch;
  const [draftLocationDefault, setDraftLocationDefault] =
    useState(currentDefault);
  // A page-level location change updates its concrete default without
  // remounting the shelf form and losing the date just used for an addition.
  if (draftLocationDefault !== currentDefault) {
    setDraftLocationDefault(currentDefault);
    const location = locations.includes(currentDefault)
      ? currentDefault
      : locations.includes(draft.branch)
        ? draft.branch
        : (locations[0] ?? "");
    if (draft.branch !== location) setDraft({ ...draft, branch: location });
  }
  const productRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const suggestionsId = useId();
  const moreId = useId();
  const results = query.trim()
    ? searchProducts(products, query).slice(0, 8)
    : [];
  const active = results.find((item) => item.code === activeCode) ?? results[0];
  const showSuggestions = !inline && searchOpen && Boolean(query.trim());
  const setField = <K extends keyof typeof draft>(
    field: K,
    value: (typeof draft)[K],
  ) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };
  const choose = (product: Product) => {
    setSelectedCode(product.code);
    setActiveCode(product.code);
    setQuery(
      lang === "fa" ? product.name_fa || product.name_en : product.name_en,
    );
    setSearchOpen(false);
    setErrors((previous) => ({ ...previous, product_code: "" }));
    dateRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  };
  const resolveProduct = () => {
    if (inline) return products.find((item) => item.code === productCode);
    const selected = products.find((item) => item.code === selectedCode);
    if (selected) return selected;
    const text = normalizeSearch(query);
    if (!text) return undefined;
    const exact = products.filter((item) =>
      [item.code, item.barcode ?? "", item.name_en, item.name_fa].some(
        (value) => normalizeSearch(value) === text,
      ),
    );
    if (exact.length === 1) return exact[0];
    const matching = searchProducts(products, query);
    return matching.length === 1 ? matching[0] : undefined;
  };
  const save = (selected?: Product) => {
    const product = selected ?? resolveProduct();
    const required: Record<string, string> = {};
    if (!product)
      required.product_code = dateTrackingErrorMessage(
        new DateTrackingError("product"),
        t,
      );
    if (!locations.includes(draft.branch))
      required.branch = dateTrackingErrorMessage(
        new DateTrackingError("location"),
        t,
      );
    if (!validTrackedDate(draft.date))
      required.date = dateTrackingErrorMessage(
        new DateTrackingError("date"),
        t,
      );
    if (Object.keys(required).length) {
      setErrors(required);
      return;
    }
    try {
      if (!historyContext) throw new DateTrackingError("permission");
      let recordId = "";
      let trackingEnabled = false;
      update((next) => {
        const current = next.products.find(
          (item) =>
            item.company_id === historyContext.company_id &&
            item.code === product!.code,
        );
        trackingEnabled = current?.date_tracking !== true;
        recordId = addTrackedDate(next, historyContext, {
          ...draft,
          product_code: product!.code,
        }).id;
      });
      setErrors({});
      setMessage(
        trackingEnabled
          ? t(
              "Date added. Date tracking turned on.",
              "تاریخ اضافه شد. پیگیری تاریخ روشن شد.",
            )
          : t("Date added.", "تاریخ اضافه شد."),
      );
      setDraft((previous) => ({
        ...previous,
        quantity: "",
        lot_number: "",
        note: "",
      }));
      if (!inline) {
        setQuery("");
        setSelectedCode("");
        setActiveCode("");
        setSearchOpen(false);
        productRef.current?.focus();
      }
      onAdded?.(recordId, draft.branch, trackingEnabled);
    } catch (error) {
      const code = error instanceof DateTrackingError ? error.code : "scope";
      const field =
        code === "product"
          ? "product_code"
          : code === "location"
            ? "branch"
            : ["date", "date_type", "quantity"].includes(code)
              ? code
              : "form";
      if (field === "quantity" || field === "date_type") setExpanded(true);
      setErrors((previous) => ({
        ...previous,
        [field]: dateTrackingErrorMessage(error, t),
      }));
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save();
  };
  if (role !== "supervisor" && role !== "floor_worker") return null;
  return (
    <form
      className={`date-quick-add${inline ? " date-quick-add-inline" : ""}`}
      aria-label={t("Add date", "افزودن تاریخ")}
      onSubmit={submit}
    >
      <div className="date-quick-main">
        {!inline && (
          <div className="date-product-picker">
            <Field label={t("Product", "محصول")} error={errors.product_code}>
              <input
                ref={productRef}
                className="ui-input date-product-input"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                aria-controls={suggestionsId}
                aria-activedescendant={
                  showSuggestions && active
                    ? `${suggestionsId}-${active.code}`
                    : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedCode("");
                  setActiveCode("");
                  setSearchOpen(true);
                  setMessage("");
                  setErrors((previous) => ({ ...previous, product_code: "" }));
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setSearchOpen(true);
                    const index = results.findIndex(
                      (item) => item.code === active?.code,
                    );
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    const next =
                      results[
                        (index + direction + results.length) % results.length
                      ];
                    if (next) setActiveCode(next.code);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setSearchOpen(false);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const product =
                      resolveProduct() ??
                      (showSuggestions ? active : undefined);
                    if (product && !validTrackedDate(draft.date))
                      choose(product);
                    else save(product);
                  }
                }}
                placeholder={t(
                  "Name, Product Code or barcode",
                  "نام، کد محصول یا بارکد",
                )}
                autoComplete="off"
                spellCheck={false}
                autoFocus={!initialProduct}
              />
            </Field>
            <Search
              className="date-product-search-icon"
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {showSuggestions && (
              <div
                id={suggestionsId}
                role="listbox"
                aria-label={t("Product results", "نتایج محصولات")}
                className="date-product-options"
              >
                {results.length ? (
                  results.map((product) => (
                    <button
                      key={product.code}
                      id={`${suggestionsId}-${product.code}`}
                      type="button"
                      role="option"
                      aria-selected={product.code === active?.code}
                      className="date-product-option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(product)}
                    >
                      <ProductName product={product} language={lang} />
                      <LtrText>{product.code}</LtrText>
                    </button>
                  ))
                ) : (
                  <p className="muted">
                    {t(
                      "Choose an active product.",
                      "یک محصول فعال انتخاب کنید.",
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={dateRef} className="date-quick-date">
          <Field label={t("Date", "تاریخ")} error={errors.date}>
            <DateField
              value={draft.date}
              onChange={(value) => setField("date", value)}
            />
          </Field>
        </div>
        {!inline && (
          <Field label={t("Location", "مکان")} error={errors.branch}>
            <Select
              value={draft.branch}
              onChange={(value) => setField("branch", value)}
              options={locations.map((location) => ({
                value: location,
                label: branchLabel(state.config, location, lang),
              }))}
            />
          </Field>
        )}
        <div className="date-quick-actions">
          {!inline && (
            <Button
              variant="secondary"
              aria-expanded={expanded}
              aria-controls={moreId}
              onClick={() => setExpanded(!expanded)}
            >
              {t("More", "بیشتر")}
            </Button>
          )}
          <Button type="submit" disabled={!historyContext}>
            {t("Add", "افزودن")}
          </Button>
        </div>
      </div>
      {!inline && expanded && (
        <div id={moreId} className="date-quick-more">
          <Field label={t("Type", "نوع")} error={errors.date_type}>
            <Select
              value={draft.date_type}
              onChange={(value) =>
                setField("date_type", value as AddTrackedDateInput["date_type"])
              }
              options={[
                { value: "expiry", label: t("Expiry", "انقضا") },
                {
                  value: "best_before",
                  label: t("Best before", "بهترین زمان مصرف"),
                },
              ]}
            />
          </Field>
          <Field
            label={t("Quantity (optional)", "مقدار (اختیاری)")}
            error={errors.quantity}
          >
            <NumberField
              value={draft.quantity ?? ""}
              onChange={(value) => setField("quantity", value)}
            />
          </Field>
          <Field label={t("Lot (optional)", "سری ساخت (اختیاری)")}>
            <input
              className="ui-input"
              value={draft.lot_number ?? ""}
              onChange={(event) => setField("lot_number", event.target.value)}
            />
          </Field>
          <Field
            label={t("Note (optional)", "یادداشت (اختیاری)")}
            className="date-quick-note"
          >
            <input
              className="ui-input"
              value={draft.note ?? ""}
              onChange={(event) => setField("note", event.target.value)}
            />
          </Field>
        </div>
      )}
      {(errors.form || (inline && (errors.product_code || errors.branch))) && (
        <p className="form-error" role="alert">
          {errors.form || errors.product_code || errors.branch}
        </p>
      )}
      {message && (
        <p className="date-quick-feedback" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
