import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDemo } from "../../store";
import {
  BufferedInput,
  Button,
  Disclosure,
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
import { ReceivedField } from "./ReceivedField";
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
  const { state, t, lang, can, command } = useDemo();
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTarget, setLocationTarget] = useState(invoice.branch);
  const [locationError, setLocationError] = useState("");
  const [phoneOpen, setPhoneOpen] = useState(false);
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
      className="list-box receiving-details ui-form-large"
      data-testid="invoice-details-card"
      data-phone-open={phoneOpen}
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
        {/* Phone (reference screen 05): the closed card still says what to check. */}
        {fields.length > 0 && (
          <span className="receiving-details-phone-check">
            {t(`${fields.length} to check`, `${fields.length} برای بررسی`)}
          </span>
        )}
        <Button
          variant="plain"
          size="sm"
          className="receiving-details-phone-toggle"
          aria-label={t("Expand invoice details", "باز کردن اطلاعات فاکتور")}
          aria-expanded={phoneOpen}
          aria-controls="invoice-details-content"
          onClick={() => setPhoneOpen((value) => !value)}
        >
          <ChevronDown size={18} aria-hidden="true" />
        </Button>
      </div>
      <div className="receiving-details-phone-summary">
        <LtrValue value={invoice.supplier} />
        {" · "}
        <LtrValue value={invoice.supplier_invoice_number} />
      </div>
      <div className="receiving-details-content" id="invoice-details-content">
        <ReadingCheckProvider
          fields={fields}
          idPrefix="invoice-check-header"
          onAcknowledge={() => {}}
        >
          <div
            className="detail-grid receiving-details-grid"
            id="invoice-details-fields"
            tabIndex={-1}
          >
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
              <BufferedInput
                id="invoice-number"
                dir="ltr"
                value={invoice.supplier_invoice_number}
                onChange={(e) =>
                  edit("supplier_invoice_number", e.target.value)
                }
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
              <div id="invoice-location" className="receiving-readonly-field">
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
            <ReceivedField
              date={receivedLocal.date}
              time={receivedLocal.time}
              employee={invoice.receiving_employee ?? ""}
              source={invoice.imported_received_source}
              onReceived={onReceived}
              onEmployee={(value) => {
                void edit("receiving_employee", value);
              }}
            />
            <Field label={t("Order (optional)", "سفارش (اختیاری)")}>
              <Select
                id="invoice-order"
                value={invoice.order_id ?? ""}
                onChange={(value) =>
                  update((draft, actor) => setInvoiceOrder(draft, actor, value))
                }
                options={[
                  {
                    value: "",
                    label: t("No linked order", "بدون سفارش مرتبط"),
                  },
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
          <Disclosure
            className="receiving-more"
            summary={t("More details", "جزئیات بیشتر")}
            open={more}
            onToggle={(e) => setMore(e.currentTarget.open)}
          >
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
                    <BufferedInput
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
          </Disclosure>
        </ReadingCheckProvider>
      </div>
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
