import { useState } from "react";
import { useDemo } from "../../store";
import {
  Button,
  DateField,
  Select,
  Dialog,
  DialogActions,
  Field as BaseField,
} from "../../ui";
import { LtrValue } from "../../presentation";
import { branchLabel, configuredBranches } from "../../settings";
import { setInvoiceLocation } from "../../received";
import { selectInvoiceWorkspace } from "../../invoice-workspace-read";
import { supplierChoices, supplierMatches } from "../../supplier-editor";
import {
  ReadingField as Field,
  ReadingCheckProvider,
} from "../../InvoiceReadingReview";
import {
  invoiceCheckField,
  acknowledgeInvoiceCheck,
} from "../../invoice-checks";
import {
  setInvoicePaymentTerms,
  refreshInvoiceDueDate,
} from "../../invoice-entry";
import { clearInvoiceOrder, setInvoiceOrder } from "../../invoice-orders";
import { PaymentTermsControl } from "../PaymentTermsControl";
import type { ReviewProps } from "./types";
export function InvoiceDetailsCard({
  invoice,
  update,
  onSupplierAdd,
  onReceived,
  receivedLocal,
  attemptedPost,
}: Pick<
  ReviewProps,
  | "invoice"
  | "update"
  | "onSupplierAdd"
  | "onReceived"
  | "receivedLocal"
  | "attemptedPost"
>) {
  const { state, t, lang, demoUsers, can, command } = useDemo();
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTarget, setLocationTarget] = useState(invoice.branch);
  const [locationError, setLocationError] = useState("");
  const scope = {
    company_id: invoice.company_id,
    kind: "company_shared" as const,
    entity_id: invoice.id,
  };
  const fields = (invoice.low_confidence_fields ?? []).filter(
    (x) => !["subtotal", "tax", "final_total"].includes(invoiceCheckField(x)),
  );
  const moreKeys = [
    "order_reference",
    "bill_to",
    "ship_to",
    "currency",
    "supplier_tax_number",
  ];
  const [more, setMore] = useState(() =>
    fields.some((x) => moreKeys.includes(invoiceCheckField(x))),
  );
  const edit = (field: string, value: string) =>
    update((draft, actor) => {
      (draft.invoice as unknown as Record<string, unknown>)[field] = value;
      for (const key of draft.invoice.low_confidence_fields ?? [])
        if (
          invoiceCheckField(key) === field ||
          (field === "import_currency" && invoiceCheckField(key) === "currency")
        )
          acknowledgeInvoiceCheck(draft, actor, key);
      if (field === "invoice_date") refreshInvoiceDueDate(draft.invoice);
    });
  const readingRecord = invoice as unknown as Record<
    string,
    string | undefined
  >;
  return (
    <section
      className="list-box receiving-details"
      data-testid="invoice-details-card"
    >
      <div className="receiving-card-title">
        <h2>{t("Invoice details", "اطلاعات فاکتور")}</h2>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t(
            "Looks right: Invoice details",
            "درست است: اطلاعات فاکتور",
          )}
          onClick={() =>
            update((draft, actor) => {
              for (const field of fields)
                acknowledgeInvoiceCheck(draft, actor, field);
            })
          }
        >
          {t("Looks right", "درست است")}
        </Button>
      </div>
      <ReadingCheckProvider
        fields={fields}
        idPrefix="invoice-check-header"
        onAcknowledge={() => {}}
      >
        <div className="detail-grid" id="invoice-details-fields" tabIndex={-1}>
          <Field
            readingField="supplier"
            label={t("Supplier", "تأمین‌کننده")}
            error={
              attemptedPost && !invoice.supplier.trim()
                ? t("Choose a supplier.", "تأمین‌کننده را انتخاب کنید.")
                : undefined
            }
          >
            <Select
              id="invoice-supplier"
              value={invoice.supplier}
              options={[
                {
                  value: "",
                  label: t("Choose supplier", "انتخاب تأمین‌کننده"),
                },
                ...supplierChoices(state).map((s) => ({
                  value: s.name,
                  label: s.name,
                })),
                ...(!supplierChoices(state).some((s) =>
                  supplierMatches(s, invoice.supplier),
                ) && invoice.supplier
                  ? [{ value: invoice.supplier, label: invoice.supplier }]
                  : []),
                {
                  value: "__add_supplier",
                  label: t("+ Add supplier", "+ افزودن تأمین‌کننده"),
                },
              ]}
              onChange={(value) => {
                if (value === "__add_supplier") {
                  onSupplierAdd();
                  return;
                }
                update((draft, actor) => {
                  draft.invoice.supplier = value;
                  clearInvoiceOrder(draft.invoice);
                  for (const field of fields)
                    if (invoiceCheckField(field) === "supplier")
                      acknowledgeInvoiceCheck(draft, actor, field);
                });
              }}
            />
          </Field>
          <Field
            readingField="supplier_invoice_number"
            label={t("Invoice number", "شماره فاکتور")}
            error={
              attemptedPost && !invoice.supplier_invoice_number.trim()
                ? t("Enter the invoice number.", "شماره فاکتور را وارد کنید.")
                : undefined
            }
          >
            <input
              id="invoice-number"
              dir="ltr"
              value={invoice.supplier_invoice_number}
              onChange={(e) => edit("supplier_invoice_number", e.target.value)}
            />
          </Field>
          <Field
            readingField="invoice_date"
            label={t("Invoice date", "تاریخ فاکتور")}
            error={
              attemptedPost &&
              !/^\d{4}-\d{2}-\d{2}$/.test(invoice.invoice_date ?? "")
                ? t("Choose an invoice date.", "تاریخ فاکتور را انتخاب کنید.")
                : undefined
            }
          >
            <DateField
              id="invoice-date"
              value={invoice.invoice_date ?? ""}
              onChange={(value) => edit("invoice_date", value)}
            />
          </Field>
          <PaymentTermsControl
            id="invoice-payment-terms"
            label={t("Payment terms (optional)", "شرایط پرداخت (اختیاری)")}
            value={invoice.payment_terms ?? ""}
            onChange={(value) =>
              update((draft) => setInvoicePaymentTerms(draft.invoice, value))
            }
          />
          <Field
            readingField="due_date"
            label={t("Due date (optional)", "تاریخ سررسید (اختیاری)")}
          >
            <DateField
              id="invoice-due-date"
              value={invoice.due_date ?? ""}
              onChange={(value) =>
                update((draft) => {
                  draft.invoice.due_date = value;
                  draft.invoice.due_date_manual = true;
                })
              }
            />
          </Field>
          <Field label={t("Location", "مکان")}>
            <div id="invoice-location">
              <LtrValue
                value={branchLabel(state.config, invoice.branch, lang)}
              />
              {can("invoices.assign_receiving_location", scope) && (
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => {
                    setLocationTarget(invoice.branch);
                    setLocationOpen(true);
                  }}
                >
                  {t("Change location", "تغییر مکان")}
                </Button>
              )}
            </div>
          </Field>
          <Field label={t("Received date and time", "تاریخ و زمان دریافت")}>
            <div className="receiving-date-time">
              <DateField
                id="invoice-received-date"
                value={receivedLocal.date}
                onChange={(value) => onReceived(value, receivedLocal.time)}
              />
              <input
                id="invoice-received-time"
                aria-label={t("Received time", "زمان دریافت")}
                dir="ltr"
                value={receivedLocal.time}
                onChange={(e) => onReceived(receivedLocal.date, e.target.value)}
              />
            </div>
          </Field>
          <Field label={t("Received by", "دریافت‌کننده")}>
            <Select
              id="invoice-employee"
              value={invoice.receiving_employee ?? ""}
              onChange={(value) => edit("receiving_employee", value)}
              options={demoUsers
                .filter((x) => x.role !== "cashier")
                .map((x) => ({ value: x.name, label: x.name }))}
            />
          </Field>
          <Field label={t("Order (optional)", "سفارش (اختیاری)")}>
            <Select
              id="invoice-order"
              value={invoice.order_id ?? ""}
              onChange={(value) =>
                update((draft, actor) => setInvoiceOrder(draft, actor, value))
              }
              options={[
                { value: "", label: t("No linked order", "بدون سفارش مرتبط") },
                ...(state.orders ?? [])
                  .filter(
                    (o) =>
                      o.supplier === invoice.supplier &&
                      o.branch === invoice.branch &&
                      o.status !== "cancelled",
                  )
                  .map((o) => ({ value: o.id, label: o.reference })),
              ]}
            />
          </Field>
        </div>
        <details
          className="receiving-more"
          open={more}
          onToggle={(e) => setMore(e.currentTarget.open)}
        >
          <summary>{t("More details", "جزئیات بیشتر")}</summary>
          <div className="detail-grid">
            {moreKeys.map((key) => {
              const labels: Record<string, [string, string]> = {
                order_reference: [
                  "Order reference (optional)",
                  "مرجع سفارش (اختیاری)",
                ],
                bill_to: ["Bill to (optional)", "صورتحساب به (اختیاری)"],
                ship_to: ["Ship to (optional)", "ارسال به (اختیاری)"],
                currency: ["Currency", "ارز"],
                supplier_tax_number: [
                  "Supplier tax number (optional)",
                  "شماره مالیاتی تأمین‌کننده (اختیاری)",
                ],
              };
              return (
                <Field key={key} readingField={key} label={t(...labels[key])}>
                  <input
                    dir="ltr"
                    value={
                      key === "currency"
                        ? (invoice.import_currency ?? "")
                        : (readingRecord[key] ?? "")
                    }
                    onChange={(e) =>
                      edit(
                        key === "currency" ? "import_currency" : key,
                        e.target.value,
                      )
                    }
                  />
                </Field>
              );
            })}
          </div>
        </details>
      </ReadingCheckProvider>
      <Dialog
        open={locationOpen}
        onOpenChange={setLocationOpen}
        title={t("Change receiving location", "تغییر مکان دریافت")}
      >
        <BaseField label={t("Location", "مکان")}>
          <Select
            id="invoice-location-target"
            value={locationTarget}
            options={configuredBranches(state.config).map((branch) => ({
              value: branch,
              label: branchLabel(state.config, branch, lang),
            }))}
            onChange={setLocationTarget}
          />
        </BaseField>
        {locationError && (
          <p className="form-error" role="alert">
            {locationError}
          </p>
        )}
        <DialogActions>
          <Button variant="secondary" onClick={() => setLocationOpen(false)}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            onClick={async () => {
              try {
                await command(
                  "invoices.assign_receiving_location",
                  scope,
                  (draft, actor) => {
                    if (draft.invoice.id !== invoice.id)
                      selectInvoiceWorkspace(draft, actor, invoice.id);
                    setInvoiceLocation(draft, actor, locationTarget);
                  },
                );
                setLocationError("");
                setLocationOpen(false);
              } catch {
                setLocationError(
                  t(
                    "Choose an allowed receiving location for your draft.",
                    "مکان دریافت مجاز برای پیش‌نویس انتخاب کنید.",
                  ),
                );
              }
            }}
          >
            {t("Save location", "ذخیره مکان")}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
