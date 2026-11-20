import { useState, type InputHTMLAttributes, type Ref } from "react";
import { createPortal } from "react-dom";
import { Check, MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import type { BranchRequestItemInput } from "../branch-requests";
import type { ProductReadDTO as Product } from "../catalog-read-model";
import { useDemo } from "../store";
import {
  Button,
  Field,
  IconButton,
  NumberField,
  Select,
  usePopover,
} from "../ui";
import { LtrText, UnitSize, UnitText } from "../presentation";
import { searchProducts } from "../catalog";

function RequestSearchInput({
  wrapperRef,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  wrapperRef: Ref<HTMLDivElement>;
}) {
  return (
    <div className="filter-search-pill request-search-pill" ref={wrapperRef}>
      <Search size={18} aria-hidden="true" />
      <input {...props} />
    </div>
  );
}

export type RequestDraftLine = BranchRequestItemInput & { key: string };
const productName = (product: Product, language: string) =>
  language === "fa" && product.name_fa ? product.name_fa : product.name_en;

export function RequestDraftItem({
  line,
  product,
  onChange,
  onRemove,
  quantityError,
  packError,
}: {
  line: RequestDraftLine;
  product?: Product;
  onChange(patch: Partial<RequestDraftLine>): void;
  onRemove(): void;
  quantityError?: string;
  packError?: string;
}) {
  const { t, lang } = useDemo();
  const [noteOpen, setNoteOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const needsPack =
    line.quantity_unit === "cases" &&
    ((line.kind === "catalog" && line.units_per_case === undefined) ||
      !!packError);
  const name = product ? productName(product, lang) : (line.free_text ?? "");
  return (
    <li
      className="request-draft-line ui-control-row-grid"
      data-ui-control-size="page"
      data-product-code={line.product_code}
    >
      <div className="request-line-name">
        <strong>
          <UnitText>{name}</UnitText>
        </strong>
        <span className="muted request-line-meta">
          {product ? (
            <>
              <LtrText>{product.code}</LtrText>
              <span aria-hidden="true"> · </span>
              <UnitSize value={product.unit_size} />
            </>
          ) : (
            t("Not in the catalog", "در فهرست کالا نیست")
          )}
          {line.quantity_unit === "cases" && (
            <>
              <span aria-hidden="true"> · </span>{" "}
              <Button
                variant="plain"
                size="sm"
                className="request-line-pack-action"
                data-control-kind="disclosure"
                aria-expanded={packOpen || needsPack}
                aria-controls={`request-pack-editor-${line.key}`}
                onClick={() => setPackOpen((previous) => !previous)}
              >
                {line.units_per_case
                  ? t(
                      `${line.units_per_case}/case · Edit`,
                      `${line.units_per_case}/کارتن · ویرایش`,
                    )
                  : t("Pack details", "جزئیات بسته")}
              </Button>
            </>
          )}
        </span>
        {noteOpen ? (
          <div className="request-line-note-editor">
            <Field label={t("Note (optional)", "یادداشت (اختیاری)")}>
              <textarea
                autoFocus
                value={line.note ?? ""}
                onChange={(event) => onChange({ note: event.target.value })}
              />
            </Field>
            <div
              className="request-line-note-actions ui-control-row"
              data-ui-control-size="small"
            >
              <Button
                variant="plain"
                size="sm"
                onClick={() => setNoteOpen(false)}
              >
                {t("Done", "انجام شد")}
              </Button>
            </div>
          </div>
        ) : line.note?.trim() ? (
          <div className="request-line-note-summary">
            <MessageSquare size={16} aria-hidden="true" />
            <span title={line.note}>{line.note}</span>
            <Button
              variant="plain"
              size="sm"
              className="request-line-note-action"
              data-control-kind="disclosure"
              aria-expanded={false}
              onClick={() => setNoteOpen(true)}
            >
              {t("Edit", "ویرایش")}
            </Button>
          </div>
        ) : (
          <Button
            variant="plain"
            size="sm"
            className="request-line-note-action"
            data-control-kind="disclosure"
            aria-expanded={false}
            onClick={() => setNoteOpen(true)}
          >
            <Plus size={14} aria-hidden="true" />
            {t("Add note", "افزودن یادداشت")}
          </Button>
        )}
        {line.quantity_unit === "cases" && (
          <div className="request-line-pack">
            {(packOpen || needsPack) && (
              <div id={`request-pack-editor-${line.key}`}>
                <Field
                  label={t("Units per case", "تعداد در کارتن")}
                  error={packError}
                  hint={
                    line.kind === "free_text"
                      ? t(
                          "Leave blank if the pack is unknown.",
                          "اگر تعداد در کارتن مشخص نیست، خالی بگذارید.",
                        )
                      : undefined
                  }
                >
                  <NumberField
                    id={`request-pack-${line.key}`}
                    value={line.units_per_case ?? ""}
                    step={1}
                    onFocus={() => setPackOpen(true)}
                    onChange={(value) =>
                      onChange({
                        units_per_case: value ? Number(value) : undefined,
                      })
                    }
                  />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>
      <Field
        label={t("Quantity", "تعداد")}
        className="request-line-quantity request-line-sr-label"
        labelContent={<span className="sr-only">{t("Quantity", "تعداد")}</span>}
        error={quantityError}
      >
        <NumberField
          id={`request-quantity-${line.key}`}
          value={line.quantity}
          onChange={(quantity) => onChange({ quantity })}
        />
      </Field>
      <Field
        label={t("Units / Cases", "واحد / کارتن")}
        className="request-line-unit request-line-sr-label"
        labelContent={
          <span className="sr-only">{t("Units / Cases", "واحد / کارتن")}</span>
        }
      >
        <Select
          value={line.quantity_unit}
          onChange={(value) =>
            onChange({ quantity_unit: value as "units" | "cases" })
          }
          options={[
            { value: "units", label: t("Units", "واحد") },
            { value: "cases", label: t("Cases", "کارتن") },
          ]}
        />
      </Field>
      <IconButton
        variant="ghost"
        className="request-line-remove"
        aria-label={t(`Remove ${name}`, `حذف ${name}`)}
        onClick={onRemove}
      >
        <Trash2 size={18} aria-hidden="true" />
      </IconButton>
    </li>
  );
}

export function RequestProductSearch({
  query,
  onQuery,
  lines,
  onAddCatalog,
  onAddFree,
  error,
}: {
  query: string;
  onQuery(value: string): void;
  lines: readonly RequestDraftLine[];
  onAddCatalog(product: Product): void;
  onAddFree(): void;
  error?: string;
}) {
  const { state, actor, t, lang } = useDemo();
  const matches = searchProducts(
    state.products.filter(
      (product) =>
        product.company_id === actor?.company_id &&
        product.status !== "archived",
    ),
    query,
  ).slice(0, 8);
  const { open, show, close, position, portalTarget, triggerRef, popupRef } =
    usePopover<HTMLDivElement>(224, {
      minimumHeight: Math.min(360, matches.length * 56 + 56 + 14),
      gap: 8,
    });
  const resultId = "request-product-results";
  const focusInput = () => triggerRef.current?.querySelector("input")?.focus();
  return (
    <div className="request-product-search">
      <Field
        label={t(
          "Add a product, or type an item that isn't in the catalog",
          "کالایی اضافه کنید یا نام موردی خارج از فهرست را بنویسید",
        )}
        error={error}
        className="request-search-field"
      >
        <RequestSearchInput
          wrapperRef={triggerRef}
          id="request-products"
          className="ui-input"
          aria-label={t(
            "Add a product, or type an item that isn't in the catalog",
            "کالایی اضافه کنید یا نام موردی خارج از فهرست را بنویسید",
          )}
          aria-controls={resultId}
          aria-describedby={error ? "request-products-help" : undefined}
          aria-invalid={error ? true : undefined}
          placeholder={t(
            "Add a product, or type an item that isn't in the catalog",
            "کالایی اضافه کنید یا نام موردی خارج از فهرست را بنویسید",
          )}
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
            if (!open) show();
          }}
          onFocus={() => {
            if (query.trim()) show();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddFree();
              close();
            }
            if (event.key === "ArrowDown" && query.trim()) {
              event.preventDefault();
              show();
              requestAnimationFrame(() =>
                popupRef.current
                  ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
                  ?.focus(),
              );
            }
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        />
      </Field>
      {open &&
        query.trim() &&
        createPortal(
          <div
            className="ui-popover request-search-results"
            ref={popupRef}
            id={resultId}
            role="region"
            aria-label={t("Matching products", "کالاهای مطابق")}
            data-r2f-scene="D10"
            style={{
              ...position,
              maxHeight: Math.min(
                typeof position.maxHeight === "number"
                  ? position.maxHeight
                  : 360,
                360,
              ),
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
                focusInput();
              }
            }}
          >
            {matches.map((product) => {
              const added = lines.some(
                (line) =>
                  line.kind === "catalog" && line.product_code === product.code,
              );
              return (
                <div
                  className={`request-search-option ui-control-row${added ? " is-added" : ""}`}
                  data-ui-control-size="small"
                  key={product.code}
                  data-product-code={product.code}
                >
                  <div className="request-search-option-name">
                    <strong>
                      <UnitText>{productName(product, lang)}</UnitText>
                    </strong>
                    <span className="muted">
                      <LtrText>{product.code}</LtrText>
                      <span aria-hidden="true"> · </span>
                      <UnitSize value={product.unit_size} />
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="plain"
                    disabled={added}
                    onClick={() => onAddCatalog(product)}
                  >
                    {added ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Plus size={16} aria-hidden="true" />
                    )}
                    {added ? t("Added", "اضافه شد") : t("Add", "افزودن")}
                  </Button>
                </div>
              );
            })}
            <Button
              variant="plain"
              className="request-search-new ui-icon-text"
              aria-label={`${t("Add item", "افزودن مورد")}: ${query.trim()}`}
              aria-describedby="request-new-item-hint"
              onClick={() => {
                onAddFree();
                close();
              }}
            >
              <span
                className="request-search-new-icon"
                data-icon-text-icon
                aria-hidden="true"
              >
                <Plus size={18} />
              </span>
              <span className="request-search-new-text" data-icon-text-copy>
                <strong>
                  {t(
                    `Add “${query.trim()}” as a new item`,
                    `افزودن «${query.trim()}» به عنوان قلم جدید`,
                  )}
                </strong>
                <span className="muted" id="request-new-item-hint">
                  {t(
                    "For things that aren't in the catalog",
                    "برای چیزهایی که در فهرست کالا نیستند",
                  )}
                </span>
              </span>
            </Button>
          </div>,
          portalTarget ?? document.body,
        )}
    </div>
  );
}
