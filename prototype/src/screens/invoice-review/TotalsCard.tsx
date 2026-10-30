import Decimal from "decimal.js";
import { useState } from "react";
import { useDemo } from "../../store";
import { BufferedInput, Button } from "../../ui";

import {
  ReadingMoney as Money,
  ReadingCheckProvider,
  ReadingField as Field,
} from "../../InvoiceReadingReview";
import {
  acknowledgeInvoiceCheck,
  acknowledgeInvoiceOtherChargeCheck,
  invoiceCheckField,
  invoiceTotalsCheck,
} from "../../invoice-checks";
import { validMoney } from "../../invoice";
import {
  invoiceDisplayShortTotals as shortTotals,
  invoiceDisplayRefusedTotals as refusedTotals,
} from "../../invoice-display-arithmetic";
import { setInvoiceAmount } from "../../invoice-entry";
import { invoiceAmountIssue } from "./amount-issue";
import type { ReviewProps } from "./types";
export function TotalsCard({
  invoice,
  update,
}: Pick<ReviewProps, "invoice" | "update" | "attemptedPost">) {
  const { t } = useDemo();
  const fields = (invoice.low_confidence_fields ?? []).filter((x) =>
    ["subtotal", "tax", "final_total"].includes(invoiceCheckField(x)),
  );
  const [editing, setEditing] = useState(() => fields.length > 0);
  const showEditor =
    editing ||
    (["subtotal", "tax", "final_total"] as const).some((field) =>
      invoiceAmountIssue(field, invoice[field], t),
    );
  const safe = (value?: string) => {
    try {
      return new Decimal(value || 0);
    } catch {
      return new Decimal(0);
    }
  };
  const items = invoice.lines.reduce(
    (sum, line) => sum.plus(safe(line.line_total)),
    new Decimal(0),
  );
  const charges = (invoice.other_charges ?? []).reduce(
    (sum, line) => sum.plus(safe(line.amount)),
    new Decimal(0),
  );
  const deduction = safe(shortTotals(invoice).total).plus(
    refusedTotals(invoice).total,
  );
  const differences = invoiceTotalsCheck(invoice);
  const amountRow = (key: "subtotal" | "tax" | "final_total") => {
    const labels: Record<string, [string, string]> = {
      subtotal: ["Subtotal", "جمع پیش از مالیات"],
      tax: ["Tax", "مالیات"],
      final_total: ["Invoice total", "جمع فاکتور"],
    };
    const calculated = invoice.calculated_fields?.includes(key);
    const difference =
      key === "subtotal"
        ? differences.subtotalDifference
        : key === "final_total"
          ? differences.totalDifference
          : undefined;
    const hasValue = validMoney(invoice[key]);
    const provenance = calculated
      ? t("Calculated", "محاسبه‌شده")
      : (invoice.reading_record || invoice.demo_original_snapshot) && hasValue
        ? key === "final_total" &&
          [invoice.subtotal, invoice.tax, invoice.final_total].every(
            validMoney,
          ) &&
          !differences.totalDifference &&
          !differences.subtotalDifference
          ? t("Matches paper", "مطابق کاغذ")
          : t("On paper", "روی کاغذ")
        : undefined;
    const provenanceTitle = calculated
      ? t(
          key === "subtotal" && invoice.calculated_from_lines
            ? "Calculated from the lines"
            : "Calculated · not on the paper",
          key === "subtotal" && invoice.calculated_from_lines
            ? "محاسبه‌شده از ردیف‌ها"
            : "محاسبه‌شده · روی کاغذ نیست",
        )
      : undefined;
    return (
      <div className={`receiving-total-edit receiving-total-${key}`} key={key}>
        {!showEditor ? (
          <div className="receiving-total-row">
            <span>
              {t(...labels[key])}
              {provenance && (
                <small
                  className="receiving-total-provenance"
                  title={provenanceTitle}
                >
                  {provenance}
                </small>
              )}
            </span>
            <Money value={invoice[key]} />
          </div>
        ) : (
          <Field
            readingField={key}
            label={t(...labels[key])}
            labelAdornment={
              provenance ? (
                <small
                  className="receiving-total-provenance"
                  title={provenanceTitle}
                >
                  {provenance}
                </small>
              ) : undefined
            }
            error={invoiceAmountIssue(key, invoice[key], t)}
          >
            <BufferedInput
              id={`invoice-${key.replaceAll("_", "-")}`}
              dir="ltr"
              inputMode="decimal"
              value={invoice[key]}
              onFocus={() => setEditing(true)}
              onChange={(e) => {
                const value = e.target.value;
                update((draft, actor) => {
                  setInvoiceAmount(draft.invoice, key, value);
                  for (const field of draft.invoice.low_confidence_fields ?? [])
                    if (invoiceCheckField(field) === key)
                      acknowledgeInvoiceCheck(draft, actor, field);
                });
              }}
            />
          </Field>
        )}
        {difference && (
          <span className="receiving-check-summary">
            {t("Paper:", "کاغذ:")} <Money value={invoice[key]} /> ·{" "}
            {t("Difference", "اختلاف")} <Money value={difference} />
          </span>
        )}
      </div>
    );
  };
  return (
    <section
      className="list-box receiving-totals ui-form-large"
      data-testid="invoice-totals-card"
    >
      <div className="receiving-card-title">
        <h2>{t("Totals", "جمع‌ها")}</h2>
        <div className="receiving-totals-actions">
          <Button
            variant="plain"
            size="sm"
            aria-label={t("Edit totals", "ویرایش جمع‌ها")}
            aria-expanded={showEditor}
            onClick={() => setEditing((value) => !value)}
          >
            {t("Edit", "ویرایش")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("Looks right: Totals", "درست است: جمع‌ها")}
            onClick={() =>
              update((draft, actor) => {
                for (const field of fields)
                  acknowledgeInvoiceCheck(draft, actor, field);
                for (const [index, charge] of (
                  draft.invoice.other_charges ?? []
                ).entries())
                  for (const field of [...(charge.low_confidence_fields ?? [])])
                    acknowledgeInvoiceOtherChargeCheck(
                      draft,
                      actor,
                      index,
                      field,
                    );
              })
            }
          >
            {t("Looks right", "درست است")}
          </Button>
        </div>
      </div>
      <ReadingCheckProvider
        fields={fields}
        idPrefix="invoice-check-header"
        onAcknowledge={() => {}}
      >
        <div
          id="invoice-totals"
          tabIndex={-1}
          className="receiving-totals-rows"
        >
          <div className="receiving-totals-group">
            <div className="receiving-total-row">
              <span>{t("Items", "کالاها")}</span>
              <Money value={items.toFixed(2)} />
            </div>
            <div className="receiving-total-row">
              <span>
                {t("Other charges and credits", "هزینه‌ها و اعتبارهای دیگر")}
              </span>
              <Money value={charges.toFixed(2)} />
            </div>
            {amountRow("subtotal")}
            {amountRow("tax")}
          </div>
          <div className="receiving-totals-group">
            {amountRow("final_total")}
            <div className="receiving-total-row receiving-total-deduction">
              <span>{t("Shorts and refused", "کسری‌ها و ردشده‌ها")}</span>
              <Money value={deduction.negated().toFixed(2)} />
            </div>
          </div>
          <div className="receiving-total-row receiving-total-payable">
            <strong>{t("Payable", "قابل پرداخت")}</strong>
            <strong>
              <Money
                value={safe(invoice.final_total).minus(deduction).toFixed(2)}
              />
            </strong>
          </div>
        </div>
      </ReadingCheckProvider>
    </section>
  );
}
