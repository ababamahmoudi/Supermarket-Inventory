import Decimal from "decimal.js";
import { useState } from "react";
import { useDemo } from "../../store";
import { Badge, BufferedInput, Button } from "../../ui";

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
import { shortTotals, refusedTotals } from "../../invoice";
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
  const [editing, setEditing] = useState(() =>
    fields.some((field) => !field.startsWith("calculated:")),
  );
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
          {(["subtotal", "tax", "final_total"] as const).map((key) => {
            const labels: Record<string, [string, string]> = {
              subtotal: ["Subtotal", "جمع پیش از مالیات"],
              tax: ["Tax", "مالیات"],
              final_total: ["Invoice total", "جمع فاکتور"],
            };
            const calculated = fields.some(
              (x) =>
                x.startsWith("calculated:") && invoiceCheckField(x) === key,
            );
            const difference =
              key === "subtotal"
                ? differences.subtotalDifference
                : key === "final_total"
                  ? differences.totalDifference
                  : undefined;
            return (
              <div className="receiving-total-edit" key={key}>
                {!showEditor ? (
                  <div className="receiving-total-row">
                    <span>
                      {t(...labels[key])}
                      {calculated && (
                        <Badge tone="pending" wrap>
                          {t(
                            "Calculated · not on the paper",
                            "محاسبه‌شده · روی کاغذ نیست",
                          )}
                        </Badge>
                      )}
                    </span>
                    <Money value={invoice[key]} />
                  </div>
                ) : (
                  <Field
                    readingField={key}
                    label={t(...labels[key])}
                    error={invoiceAmountIssue(key, invoice[key], t)}
                    hint={
                      calculated ? (
                        <Badge tone="pending" wrap>
                          {t(
                            "Calculated · not on the paper",
                            "محاسبه‌شده · روی کاغذ نیست",
                          )}
                        </Badge>
                      ) : undefined
                    }
                  >
                    <BufferedInput
                      id={`invoice-${key.replaceAll("_", "-")}`}
                      dir="ltr"
                      inputMode="decimal"
                      value={invoice[key]}
                      onChange={(e) => {
                        const value = e.target.value;
                        update((draft, actor) => {
                          setInvoiceAmount(draft.invoice, key, value);
                          for (const field of draft.invoice
                            .low_confidence_fields ?? [])
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
          })}
          <div className="receiving-total-row">
            <span>{t("Shorts and refused", "کسری‌ها و ردشده‌ها")}</span>
            <Money value={deduction.negated().toFixed(2)} />
          </div>
          <div className="receiving-total-row">
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
