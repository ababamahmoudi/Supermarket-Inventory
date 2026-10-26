import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import Decimal from "decimal.js";
import { useDemo } from "../../store";
import { SegmentedControl, TableRowLink } from "../../ui";
import { LtrValue, QuantityText } from "../../presentation";
import { visibleInvoiceCheckFields } from "../../invoice-checks";
import { invoiceLineId } from "../../invoice-line-links";
import { categoryLabel } from "../../formatters";
import { weightQuantityFromLb } from "../../weighed";
import { ReadingMoney as Money } from "../../InvoiceReadingReview";
import { LineEditor } from "./LineEditor";
import type { LineCommands, ReviewProps } from "./types";

type LineFilter = "all" | "attention" | "confirmed";

export function LinesTable({
  invoice,
  workspace,
  update,
  editLine,
  correction,
  onQuantity,
  openLine,
  onOpen,
  anchor,
  attemptedPost,
  attentionNavigationKey,
  optimisticConfirmed = new Set<string>(),
  onOptimisticConfirmation,
}: {
  invoice: ReviewProps["invoice"];
  workspace: ReviewProps["workspace"];
  onQuantity: ReviewProps["onQuantity"];
  attemptedPost: boolean;
  openLine: number | null;
  attentionNavigationKey?: number;
  optimisticConfirmed?: ReadonlySet<string>;
  onOptimisticConfirmation?(id: string, confirmed: boolean): void;
  onOpen(index: number | null): void;
  anchor(element?: HTMLElement): void;
} & LineCommands) {
  const { state, t, tCount, lang } = useDemo();
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const [failedConfirmations, setFailedConfirmations] = useState<
    ReadonlySet<string>
  >(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  const isConfirmed = (
    line: ReviewProps["invoice"]["lines"][number],
    index: number,
  ) =>
    Boolean(
      line.review_confirmed ||
      optimisticConfirmed.has(invoiceLineId(line, index)),
    );
  const [filter, setFilter] = useState<LineFilter>("all");
  const [pinnedLine, setPinnedLine] = useState<{
    id: string;
    navigationKey?: number;
  } | null>(null);
  const visiblePin =
    pinnedLine?.navigationKey === attentionNavigationKey
      ? pinnedLine?.id
      : null;
  const confirmed = invoice.lines.filter((line, index) =>
    isConfirmed(line, index),
  ).length;
  const attention = invoice.lines.filter(
    (line, index) =>
      !isConfirmed(line, index) ||
      (!optimisticConfirmed.has(invoiceLineId(line, index)) &&
        line.low_confidence_fields?.length),
  ).length;
  const open = (index: number | null) => {
    // An ordinary Close retains position. Confirmation explicitly releases this pin.
    if (index === null && openLine !== null && filter !== "all")
      setPinnedLine({
        id: invoiceLineId(invoice.lines[openLine], openLine),
        navigationKey: attentionNavigationKey,
      });
    else setPinnedLine(null);
    onOpen(index);
  };
  const amount = (value: string) => {
    try {
      return new Decimal(value).toFixed(4);
    } catch {
      return value;
    }
  };
  return (
    <section className="list-box receiving-lines">
      <div className="receiving-lines-heading">
        <h2>{t("Invoice lines", "ردیف‌های فاکتور")}</h2>
        {correction ? (
          <span className="muted">
            {tCount(
              "{{count}} line changed",
              "{{count}} lines changed",
              "{{count}} ردیف تغییر کرده",
              "{{count}} ردیف تغییر کرده",
              correction.changed.size,
            )}
          </span>
        ) : (
          <SegmentedControl
            aria-label={t("Filter invoice lines", "فیلتر ردیف‌های فاکتور")}
            value={filter}
            showZeroCounts
            options={[
              {
                value: "all",
                label: t("All", "همه"),
                count: invoice.lines.length,
              },
              {
                value: "attention",
                label: t("Needs attention", "نیازمند بررسی"),
                count: attention,
              },
              {
                value: "confirmed",
                label: t("Confirmed", "تأییدشده"),
                count: confirmed,
              },
            ]}
            onChange={(value) => {
              setPinnedLine(null);
              setFilter(value as LineFilter);
              onOpen(null);
            }}
          />
        )}
      </div>
      <div
        className="receiving-lines-table"
        role="region"
        aria-label={t("Invoice lines", "ردیف‌های فاکتور")}
      >
        <table className="receiving-table">
          <colgroup>
            <col className="receiving-col-status" />
            <col className="receiving-col-product" />
            <col className="receiving-col-quantity" />
            <col className="receiving-col-cost" />
            <col className="receiving-col-total" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t("Product", "کالا")}</th>
              <th scope="col">{t("Quantity", "تعداد")}</th>
              <th scope="col" className="numeric">
                {t("Unit cost", "هزینه واحد")}
              </th>
              <th scope="col" className="numeric">
                {t("Line total", "جمع ردیف")}
              </th>
            </tr>
          </thead>
          {invoice.lines.map((line, index) => {
            const product = state.products.find(
              (x) =>
                x.company_id === invoice.company_id &&
                x.code === line.product_code,
            );
            const name = correction
              ? product?.name_en || line.new_name_en || line.description
              : line.new_name_en || product?.name_en || line.description;
            const category = state.config.pricing_categories.find(
              (x) =>
                x.key === (line.pricing_category ?? product?.pricing_category),
            );
            const count =
              correction || optimisticConfirmed.has(invoiceLineId(line, index))
                ? 0
                : visibleInvoiceCheckFields(line).length;
            const confirmedLine = correction
              ? !correction.changed.has(index)
              : isConfirmed(line, index);
            const lineId = invoiceLineId(line, index);
            const rowId = `invoice-line-row-${index}`;
            const expanded = openLine === index;
            const needsAttention = !confirmedLine || count > 0;
            if (
              !leaving.has(lineId) &&
              !expanded &&
              visiblePin !== lineId &&
              ((filter === "attention" && !needsAttention) ||
                (filter === "confirmed" && !confirmedLine))
            )
              return null;
            const status = confirmedLine
              ? "confirmed"
              : count || correction
                ? "check"
                : "unconfirmed";
            const statusLabel = correction
              ? confirmedLine
                ? t("Retained posted line", "ردیف ثبت‌شده بدون تغییر")
                : t("Changed in this correction", "در این اصلاح تغییر کرده")
              : line.review_confirmed
                ? t("Confirmed", "تأیید شد")
                : line.review_changed_after_confirmation
                  ? t(
                      "Changed after confirming: confirm again",
                      "پس از تأیید تغییر کرد: دوباره تأیید کنید",
                    )
                  : count
                    ? t(`${count} to check`, `${count} برای بررسی`)
                    : t("Not confirmed", "تأیید نشده");
            const toggle = (row?: HTMLElement) => {
              if (row) anchor(row);
              open(expanded ? null : index);
            };
            const weighted = line.sold_by === "weight";
            const sourceUnit = line.source_quantity_unit ?? "lb";
            let invoiced = String(line.qty_invoiced);
            let received = String(line.qty_received_at_posting);
            if (weighted) {
              try {
                const factor =
                  line.weight_conversion_factor ??
                  state.config.weighed_items?.conversion_factor;
                invoiced =
                  line.source_quantity ??
                  weightQuantityFromLb(line.qty_invoiced, sourceUnit, factor);
                received =
                  line.source_received_quantity ??
                  weightQuantityFromLb(
                    line.qty_received_at_posting,
                    sourceUnit,
                    factor,
                  );
              } catch {
                // Keep incomplete source readings visible for action-time validation.
                invoiced = line.source_quantity ?? invoiced;
                received = line.source_received_quantity ?? received;
              }
            }
            let short = "0";
            try {
              short = Decimal.max(
                0,
                new Decimal(invoiced).minus(received),
              ).toString();
            } catch {
              /* An incomplete quantity stays editable. */
            }
            const shortSummary =
              short !== "0"
                ? t(
                    `Delivered ${received}${weighted ? ` ${sourceUnit}` : ""} · short ${short}${weighted ? ` ${sourceUnit}` : ""}`,
                    `تحویل ${received}${weighted ? ` ${sourceUnit}` : ""} · کسری ${short}${weighted ? ` ${sourceUnit}` : ""}`,
                  )
                : "";
            const quantity = weighted ? (
              <QuantityText
                value={invoiced}
                unit={sourceUnit}
                language={lang}
              />
            ) : line.quantity_unit === "cases" ? (
              <>
                <QuantityText
                  value={line.quantity_entered ?? 0}
                  unit="cases"
                  language={lang}
                />{" "}
                × <LtrValue value={String(line.units_per_case ?? 1)} />
              </>
            ) : (
              <QuantityText
                value={line.qty_invoiced}
                unit="units"
                language={lang}
              />
            );
            const sourceCost = weighted
              ? (line.source_cost_before_tax ?? line.unit_cost_before_tax)
              : line.unit_cost_before_tax;
            const cost = (
              <>
                <Money
                  value={amount(sourceCost)}
                  decimals={4}
                  fixedDecimals
                  currency={state.config.company.currency}
                />
                {weighted && (
                  <LtrValue value={`/${line.source_cost_unit ?? "lb"}`} />
                )}
              </>
            );
            return (
              <tbody
                key={lineId}
                className="invoice-line"
                data-expanded={expanded}
                data-leaving={leaving.has(lineId) || undefined}
              >
                <tr
                  className={`invoice-line-summary receiving-row-${status}${expanded ? " is-expanded" : ""}`}
                  id={rowId}
                  data-testid={rowId}
                  data-line-id={lineId}
                  data-control-kind="disclosure"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest("button,a")
                    )
                      return;
                    toggle(event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      ["Enter", " "].includes(event.key)
                    ) {
                      event.preventDefault();
                      toggle(event.currentTarget);
                    }
                  }}
                >
                  <td
                    className="receiving-status-cell"
                    data-column-key="number"
                  >
                    <span className="receiving-status-number">
                      <span
                        className={`receiving-status-icon is-${status}`}
                        role="img"
                        aria-label={statusLabel}
                        title={statusLabel}
                      >
                        {confirmedLine ? (
                          <Check size={13} strokeWidth={3} aria-hidden="true" />
                        ) : count ? (
                          count
                        ) : correction ? (
                          "!"
                        ) : null}
                      </span>
                      <span className="receiving-line-number">
                        <LtrValue value={String(index + 1)} />
                      </span>
                    </span>
                  </td>
                  <td
                    className="receiving-product-cell"
                    data-column-key="product"
                  >
                    <a
                      href="#invoice-line-editor"
                      ref={(element) => {
                        if (correction && index === 0)
                          element?.setAttribute("autofocus", "");
                      }}
                      className="invoice-line-toggle"
                      data-control-kind="disclosure"
                      aria-expanded={expanded}
                      onClick={(event) => {
                        event.preventDefault();
                        toggle(document.getElementById(rowId) ?? undefined);
                      }}
                    >
                      <span className="receiving-product-name" title={name}>
                        <LtrValue value={name} />
                      </span>
                    </a>
                    <small className="receiving-product-meta">
                      {line.pack_size && (
                        <>
                          <LtrValue value={line.pack_size} />
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      {line.supplier_item_code &&
                        line.supplier_item_code.trim().toLocaleLowerCase() !==
                          name.trim().toLocaleLowerCase() && (
                          <>
                            <LtrValue value={line.supplier_item_code} />
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                      <span
                        className={
                          category ? undefined : "receiving-check-summary"
                        }
                      >
                        {category
                          ? categoryLabel(category.label, lang)
                          : t("Choose a category", "انتخاب دسته")}
                      </span>
                      {!product && (
                        <span className="receiving-new-product">
                          {t("New product", "کالای جدید")}
                        </span>
                      )}
                    </small>
                    <span className="receiving-phone-quantity">
                      {quantity} ·{" "}
                      <span className="receiving-phone-cost">{cost}</span>
                      {shortSummary && (
                        <span className="receiving-short-summary">
                          <LtrValue value={shortSummary} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td
                    className="receiving-quantity-cell"
                    data-column-key="quantity"
                  >
                    <span className="receiving-quantity-primary">
                      {quantity}
                    </span>
                    {line.quantity_unit === "cases" && !weighted && (
                      <small>
                        <QuantityText
                          value={line.qty_invoiced}
                          unit="units"
                          language={lang}
                        />
                      </small>
                    )}
                    {shortSummary && (
                      <small className="receiving-short-summary">
                        <LtrValue value={shortSummary} />
                      </small>
                    )}
                  </td>
                  <td
                    className="numeric receiving-cost-cell"
                    data-column-key="cost"
                  >
                    {cost}
                  </td>
                  <td
                    className="numeric receiving-total-cell"
                    data-column-key="total"
                  >
                    <Money value={line.line_total} />
                    <TableRowLink
                      className="receiving-phone-chevron"
                      href="#invoice-line-editor"
                      aria-label={t(
                        `Review line ${index + 1}`,
                        `بررسی ردیف ${index + 1}`,
                      )}
                      aria-expanded={expanded}
                      onClick={(event) => {
                        event.preventDefault();
                        toggle(document.getElementById(rowId) ?? undefined);
                      }}
                    />
                  </td>
                </tr>
                {failedConfirmations.has(lineId) && (
                  <tr className="receiving-confirmation-error">
                    <td colSpan={5}>
                      <p className="form-error" role="alert">
                        {t(
                          "The line could not be saved. It still needs attention. Try confirming again.",
                          "ردیف ذخیره نشد و هنوز نیازمند بررسی است. دوباره تأیید کنید.",
                        )}
                      </p>
                    </td>
                  </tr>
                )}
                {expanded && (
                  <tr className="table-expanded-row receiving-editor-row invoice-line-detail">
                    <td colSpan={5}>
                      <LineEditor
                        invoice={invoice}
                        workspace={workspace}
                        index={index}
                        attemptedPost={attemptedPost}
                        {...(correction
                          ? { correction }
                          : { update: update!, editLine: editLine! })}
                        onQuantity={onQuantity}
                        onClose={() => open(null)}
                        onConfirmationStart={
                          !correction && onOptimisticConfirmation
                            ? () => {
                                onOptimisticConfirmation(lineId, true);
                                setFailedConfirmations(
                                  (current) =>
                                    new Set(
                                      [...current].filter(
                                        (id) => id !== lineId,
                                      ),
                                    ),
                                );
                                setPinnedLine(null);
                                const nextIndex = invoice.lines.findIndex(
                                  (candidate, candidateIndex) =>
                                    candidateIndex > index &&
                                    !isConfirmed(candidate, candidateIndex),
                                );
                                const previousIndex = invoice.lines.findIndex(
                                  (candidate, candidateIndex) =>
                                    candidateIndex !== index &&
                                    !isConfirmed(candidate, candidateIndex),
                                );
                                const focusIndex =
                                  nextIndex >= 0 ? nextIndex : previousIndex;
                                if (filter === "attention")
                                  setLeaving(
                                    (current) => new Set([...current, lineId]),
                                  );
                                const timer = setTimeout(
                                  () => {
                                    timers.current.delete(timer);
                                    setLeaving(
                                      (current) =>
                                        new Set(
                                          [...current].filter(
                                            (id) => id !== lineId,
                                          ),
                                        ),
                                    );
                                    onOpen(null);
                                    requestAnimationFrame(() => {
                                      const target =
                                        focusIndex >= 0
                                          ? document.getElementById(
                                              `invoice-line-row-${focusIndex}`,
                                            )
                                          : document.querySelector<HTMLElement>(
                                              ".receiving-lines-heading button[aria-pressed]",
                                            );
                                      target?.focus({ preventScroll: true });
                                    });
                                  },
                                  typeof window.matchMedia === "function" &&
                                    window.matchMedia(
                                      "(prefers-reduced-motion: reduce)",
                                    ).matches
                                    ? 0
                                    : 120,
                                );
                                timers.current.add(timer);
                                return (success) => {
                                  if (success) return;
                                  clearTimeout(timer);
                                  timers.current.delete(timer);
                                  setLeaving(
                                    (current) =>
                                      new Set(
                                        [...current].filter(
                                          (id) => id !== lineId,
                                        ),
                                      ),
                                  );
                                  onOptimisticConfirmation(lineId, false);
                                  setFailedConfirmations(
                                    (current) => new Set([...current, lineId]),
                                  );
                                  onOpen(index);
                                  requestAnimationFrame(() =>
                                    document
                                      .getElementById(
                                        `invoice-line-${index}-confirm`,
                                      )
                                      ?.focus({ preventScroll: true }),
                                  );
                                };
                              }
                            : undefined
                        }
                        anchor={() => {
                          const row = document.getElementById(rowId);
                          if (row) anchor(row);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}
