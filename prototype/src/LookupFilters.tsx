import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { LookupFilters as Filters } from "./lookup-filters";
import type { ProductReadDTO } from "./catalog-read-model";
import { activePricingCategories } from "./settings";
import { categoryLabel } from "./presentation";
import { useDemo } from "./store";
import { Button, Field, FilterChip, Select, usePopover } from "./ui";

/** Quick choices stay in place; secondary choices use the shared bounded popup. */
export function LookupFilters({
  filters,
  products,
  categories,
  searchActive,
  onChange,
  onClear,
}: {
  filters: Filters;
  products: readonly ProductReadDTO[];
  categories: readonly string[];
  searchActive: boolean;
  onChange: (filters: Filters) => void;
  onClear: () => void;
}) {
  const { state, t, lang } = useDemo();
  const id = useId();
  const { open, show, close, position, portalTarget, triggerRef, popupRef } =
    usePopover(320);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      popupRef.current
        ?.querySelector<HTMLElement>('[role="combobox"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, popupRef]);
  const choices = [
    ["onOffer", t("On offer", "دارای پیشنهاد")],
    ["expiringSoon", t("Expiring soon", "به‌زودی منقضی")],
    ["arrivedToday", t("Arrived today", "رسیده امروز")],
    [
      "priceChangedRecently",
      t("Price changed recently", "قیمت به‌تازگی تغییر کرده"),
    ],
    ["taxable", t("Taxable", "مشمول مالیات")],
    ["unapproved", t("Not approved here yet", "هنوز در این مکان تأیید نشده")],
  ] as const;
  const pricingCategories = activePricingCategories(state.config);
  const selectedPricing = pricingCategories.find(
    (row) => row.key === filters.pricingCategory,
  );
  const active = [
    filters.category ? categoryLabel(filters.category, lang) : "",
    selectedPricing
      ? lang === "fa" && selectedPricing.label_fa
        ? selectedPricing.label_fa
        : categoryLabel(selectedPricing.label, lang)
      : "",
    ...choices.filter(([key]) => filters[key]).map(([, label]) => label),
  ].filter(Boolean);
  const secondaryCount =
    Number(Boolean(filters.category)) +
    Number(Boolean(filters.pricingCategory));
  const filtersLabel = t("Filters", "فیلترها");
  return (
    <div className="lookup-filterbar filter-toolbar">
      <div className="lookup-filters-row">
        <Button
          variant="neutral"
          className="lookup-filters-trigger"
          ref={triggerRef}
          aria-label={filtersLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => (open ? close() : show())}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="lookup-filters-label">{filtersLabel}</span>
          <span
            className={`tab-count${secondaryCount ? "" : " is-empty"}`}
            aria-hidden={secondaryCount === 0}
          >
            {secondaryCount}
          </span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <div
          className="lookup-pricing-filters"
          role="group"
          aria-label={t("Quick filters", "فیلترهای سریع")}
        >
          {choices.map(([key, label]) => (
            <FilterChip
              appearance="neutral"
              key={key}
              checked={Boolean(filters[key])}
              onChange={(value) => onChange({ ...filters, [key]: value })}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="lookup-active-filters muted" aria-live="polite">
        {active.length > 0 && <span>{active.join(" · ")}</span>}
        {(searchActive || active.length > 0) && (
          <Button variant="plain" onClick={onClear}>
            {t("Clear filters", "پاک کردن فیلترها")}
          </Button>
        )}
      </div>
      {open &&
        createPortal(
          <div
            id={id}
            ref={popupRef}
            className="ui-popover lookup-filters-popover"
            data-popover-root
            role="dialog"
            aria-label={filtersLabel}
            style={position}
          >
            <Field label={t("Pricing category", "دستهٔ قیمت‌گذاری")}>
              <Select
                aria-label={t("Pricing category", "دستهٔ قیمت‌گذاری")}
                value={filters.pricingCategory}
                onChange={(value) =>
                  onChange({ ...filters, pricingCategory: value })
                }
                options={[
                  {
                    value: "",
                    label: t(
                      "All pricing categories",
                      "همهٔ دسته‌های قیمت‌گذاری",
                    ),
                  },
                  ...pricingCategories.map((row) => ({
                    value: row.key,
                    label: `${lang === "fa" && row.label_fa ? row.label_fa : categoryLabel(row.label, lang)} (${products.filter((product) => product.pricing_category === row.key).length})`,
                  })),
                ]}
              />
            </Field>
            <Field label={t("AI category", "دستهٔ هوش مصنوعی")}>
              <Select
                aria-label={t("AI category", "دستهٔ هوش مصنوعی")}
                value={filters.category}
                onChange={(value) => onChange({ ...filters, category: value })}
                options={[
                  { value: "", label: t("All", "همه") },
                  ...categories.map((category) => ({
                    value: category,
                    label: categoryLabel(category, lang),
                  })),
                ]}
              />
            </Field>
            <Button variant="neutral" onClick={() => close(true)}>
              {t("Done", "تمام")}
            </Button>
          </div>,
          portalTarget ?? document.body,
        )}
    </div>
  );
}
