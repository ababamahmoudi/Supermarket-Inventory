import { useState } from "react";
import { useDemo } from "../store";
import { companyDate } from "../invoice";
import { configuredBranches, branchLabel } from "../settings";
import {
  saveSupplier,
  similarSupplierNames,
  SupplierEditError,
  type SupplierEdits,
  invoiceSupplierFields,
} from "../supplier-editor";
import type { SupplierRecord } from "../types";
import { Button, Checkbox, DateField, Dialog, Field } from "../ui";
import { LtrText } from "../presentation";
import "./manual-entry.css";
import { PaymentTermsControl } from "./PaymentTermsControl";
import { paymentTermsDays } from "../invoice-entry";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";

export function SupplierEditor({
  supplier,
  invoiceQuickAdd = false,
  completeForInvoice = false,
  onClose,
  onSaved,
}: {
  supplier?: SupplierRecord;
  invoiceQuickAdd?: boolean;
  completeForInvoice?: boolean;
  onClose: () => void;
  onSaved?: (supplier: SupplierRecord) => void;
}) {
  const { state, role, branch, user, lang, t, update, navigate } = useDemo();
  const supervisor = role === "supervisor";
  const [values, setValues] = useState<SupplierEdits>({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    sales_rep_name: supplier?.sales_rep_name ?? "",
    sales_rep_phone: supplier?.sales_rep_phone ?? "",
    payment_terms: supplier?.payment_terms ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
    opening_balances: configuredBranches(state.config).map((value) => ({
      branch: value,
      amount: "",
      date: companyDate(state.config),
    })),
  });
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [error, setError] = useState<SupplierEditError["code"] | null>(null);
  const matches = similarSupplierNames(state, values.name, supplier?.id);
  const patch = (key: keyof SupplierEdits, value: string | boolean) => {
    if (
      (key === "name" && (error === "name" || error === "similar")) ||
      (key === "email" && error === "email") ||
      (key === "similar_name_confirmed" && error === "similar")
    )
      setError(null);
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" ? { similar_name_confirmed: false } : {}),
    }));
  };
  const errors: Record<SupplierEditError["code"], string> = {
    permission: t(
      "Only a Supervisor can save this supplier.",
      "فقط سرپرست می‌تواند این تأمین‌کننده را ذخیره کند.",
    ),
    scope: t("Choose an allowed branch.", "یک شعبهٔ مجاز انتخاب کنید."),
    name: t("Add the supplier name.", "نام تأمین‌کننده را وارد کنید."),
    email: t(
      "Enter a valid email address or leave it blank.",
      "ایمیل معتبر وارد کنید یا آن را خالی بگذارید.",
    ),
    similar: t(
      "Review the similar supplier before saving.",
      "پیش از ذخیره، تأمین‌کنندهٔ مشابه را بررسی کنید.",
    ),
    balance: t(
      "Enter an opening balance with at most two decimals.",
      "ماندهٔ اولیه را با حداکثر دو رقم اعشار وارد کنید.",
    ),
    date: t(
      "Choose a valid as of date for each opening balance.",
      "برای هر ماندهٔ اولیه یک تاریخ معتبر انتخاب کنید.",
    ),
    not_found: t("Supplier not found.", "تأمین‌کننده پیدا نشد."),
  };
  const fieldNames: Record<string, [string, string]> = {
    name: ["Supplier name", "نام تأمین‌کننده"],
    phone: ["Phone", "تلفن"],
    email: ["Email", "ایمیل"],
    sales_rep_name: ["Sales representative", "نماینده فروش"],
    sales_rep_phone: ["Sales rep phone", "تلفن نماینده فروش"],
    payment_terms: ["Payment terms", "شرایط پرداخت"],
  };
  const missing: ValidationIssue[] = [
    "name",
    ...(completeForInvoice ? invoiceSupplierFields : []),
  ]
    .filter(
      (field) => !String(values[field as keyof SupplierEdits] ?? "").trim(),
    )
    .map((field) => ({
      id: `supplier-${field}-missing`,
      fieldId: `supplier-${field}`,
      message: `${t("Enter", "وارد کنید:")} ${t(...fieldNames[field])}.`,
    }));
  if (
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  )
    missing.push({
      id: "supplier-email-invalid",
      fieldId: "supplier-email",
      message: errors.email,
    });
  if (
    values.payment_terms &&
    /^net/i.test(values.payment_terms) &&
    paymentTermsDays(values.payment_terms) === undefined
  )
    missing.push({
      id: "supplier-payment-invalid",
      fieldId: "supplier-payment_terms",
      message: t(
        "Enter a nonnegative whole number of days.",
        "تعداد روزها را به صورت عدد صحیح غیرمنفی وارد کنید.",
      ),
    });
  if (matches.length && !values.similar_name_confirmed)
    missing.push({
      id: "supplier-similar-missing",
      fieldId: "supplier-similar",
      message: errors.similar,
    });
  for (const [index, row] of (supervisor && !supplier
    ? (values.opening_balances ?? [])
    : []
  ).entries()) {
    if (!row.amount.trim()) continue;
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(row.amount))
      missing.push({
        id: `supplier-balance-${index}-missing`,
        fieldId: `supplier-balance-${index}`,
        message: errors.balance,
      });
    const date = new Date(`${row.date}T12:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== row.date
    )
      missing.push({
        id: `supplier-balance-date-${index}-missing`,
        fieldId: `supplier-balance-date-${index}`,
        message: errors.date,
      });
  }
  const fieldError = (field: string) =>
    attemptedSave
      ? missing.find((item) => item.fieldId === `supplier-${field}`)?.message
      : undefined;
  if (!supervisor && !(role === "floor_worker" && invoiceQuickAdd && !supplier))
    return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        supplier
          ? t("Edit supplier", "ویرایش تأمین‌کننده")
          : t("Add supplier", "افزودن تأمین‌کننده")
      }
      className="manual-entry-dialog"
    >
      <form
        className="stack manual-entry-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setAttemptedSave(true);
          if (missing.length) return;
          try {
            let saved: SupplierRecord | undefined;
            update((draft) => {
              saved = structuredClone(
                saveSupplier(
                  draft,
                  {
                    company_id: state.config.company.seed_key,
                    role: role!,
                    branch,
                    actor: user!.name,
                  },
                  {
                    ...values,
                    opening_balances:
                      supervisor && !supplier ? values.opening_balances : [],
                  },
                  {
                    id: supplier?.id,
                    invoice_quick_add: invoiceQuickAdd,
                    complete_invoice_details: completeForInvoice,
                  },
                ),
              );
            });
            onSaved?.(saved!);
            onClose();
          } catch (cause) {
            setError(cause instanceof SupplierEditError ? cause.code : "scope");
          }
        }}
      >
        <WhatsMissing issues={attemptedSave ? missing : []} />
        <Field
          label={t("Supplier name", "نام تأمین‌کننده")}
          error={
            fieldError("name") || (error === "name" ? errors.name : undefined)
          }
        >
          <input
            id="supplier-name"
            autoFocus
            dir="auto"
            value={values.name}
            onChange={(event) => patch("name", event.target.value)}
          />
        </Field>
        <div className="manual-entry-pair">
          <Field
            label={
              completeForInvoice
                ? t("Phone", "تلفن")
                : t("Phone (optional)", "تلفن (اختیاری)")
            }
            error={fieldError("phone")}
          >
            <input
              dir="ltr"
              type="tel"
              id="supplier-phone"
              value={values.phone}
              onChange={(event) => patch("phone", event.target.value)}
            />
          </Field>
          <Field
            label={
              completeForInvoice
                ? t("Email", "ایمیل")
                : t("Email (optional)", "ایمیل (اختیاری)")
            }
            error={
              fieldError("email") ||
              (error === "email" ? errors.email : undefined)
            }
          >
            <input
              dir="ltr"
              type="email"
              id="supplier-email"
              value={values.email}
              onChange={(event) => patch("email", event.target.value)}
            />
          </Field>
          <Field
            label={
              completeForInvoice
                ? t("Sales representative", "نماینده فروش")
                : t("Sales representative (optional)", "نماینده فروش (اختیاری)")
            }
            error={fieldError("sales_rep_name")}
          >
            <input
              dir="auto"
              id="supplier-sales_rep_name"
              value={values.sales_rep_name}
              onChange={(event) => patch("sales_rep_name", event.target.value)}
            />
          </Field>
          <Field
            label={
              completeForInvoice
                ? t("Sales rep phone", "تلفن نماینده فروش")
                : t("Sales rep phone (optional)", "تلفن نماینده فروش (اختیاری)")
            }
            error={fieldError("sales_rep_phone")}
          >
            <input
              dir="ltr"
              type="tel"
              id="supplier-sales_rep_phone"
              value={values.sales_rep_phone}
              onChange={(event) => patch("sales_rep_phone", event.target.value)}
            />
          </Field>
        </div>
        <PaymentTermsControl
          id="supplier-payment_terms"
          label={
            completeForInvoice
              ? t("Payment terms", "شرایط پرداخت")
              : t("Payment terms (optional)", "شرایط پرداخت (اختیاری)")
          }
          value={values.payment_terms}
          error={fieldError("payment_terms")}
          onChange={(value) => patch("payment_terms", value)}
        />
        <Field label={t("Address (optional)", "نشانی (اختیاری)")}>
          <textarea
            rows={2}
            dir="auto"
            value={values.address}
            onChange={(event) => patch("address", event.target.value)}
          />
        </Field>
        <Field label={t("Notes (optional)", "یادداشت‌ها (اختیاری)")}>
          <textarea
            rows={2}
            dir="auto"
            value={values.notes}
            onChange={(event) => patch("notes", event.target.value)}
          />
        </Field>
        {supervisor && !supplier && (
          <fieldset className="manual-opening-fields">
            <legend>
              {t("Opening balance (optional)", "ماندهٔ اولیه (اختیاری)")}
            </legend>
            {values.opening_balances!.map((row, index) => (
              <div className="manual-opening-row" key={row.branch}>
                <span>{branchLabel(state.config, row.branch, lang)}</span>
                <Field
                  label={t("Opening balance", "ماندهٔ اولیه")}
                  error={
                    (attemptedSave
                      ? missing.find(
                          (item) =>
                            item.fieldId === `supplier-balance-${index}`,
                        )?.message
                      : undefined) ||
                    (error === "balance" &&
                    row.amount &&
                    !/^-?\d+(?:\.\d{1,2})?$/.test(row.amount)
                      ? errors.balance
                      : undefined)
                  }
                >
                  <input
                    id={`supplier-balance-${index}`}
                    dir="ltr"
                    inputMode="decimal"
                    className="control-narrow"
                    value={row.amount}
                    onChange={(event) => {
                      if (error === "balance") setError(null);
                      setValues((current) => ({
                        ...current,
                        opening_balances: current.opening_balances!.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: event.target.value }
                              : item,
                        ),
                      }));
                    }}
                  />
                </Field>
                <Field
                  label={t("As of", "در تاریخ")}
                  error={
                    (attemptedSave
                      ? missing.find(
                          (item) =>
                            item.fieldId === `supplier-balance-date-${index}`,
                        )?.message
                      : undefined) ||
                    (error === "date" ? errors.date : undefined)
                  }
                >
                  <DateField
                    id={`supplier-balance-date-${index}`}
                    value={row.date}
                    onChange={(date) => {
                      if (error === "date") setError(null);
                      setValues((current) => ({
                        ...current,
                        opening_balances: current.opening_balances!.map(
                          (item, itemIndex) =>
                            itemIndex === index ? { ...item, date } : item,
                        ),
                      }));
                    }}
                  />
                </Field>
              </div>
            ))}
          </fieldset>
        )}
        {!!matches.length && (
          <div className="banner info manual-similar-warning" role="status">
            {error === "similar" && (
              <p role="alert" className="form-error">
                {errors.similar}
              </p>
            )}
            <p>
              {t(
                "A similar supplier already exists.",
                "یک تأمین‌کنندهٔ مشابه وجود دارد.",
              )}
            </p>
            {matches.map((record) => (
              <Button
                key={record.id}
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigate(`suppliers?name=${encodeURIComponent(record.name)}`);
                }}
              >
                <LtrText>{record.name}</LtrText>
              </Button>
            ))}
            <Checkbox
              id="supplier-similar"
              checked={!!values.similar_name_confirmed}
              onChange={(checked) => patch("similar_name_confirmed", checked)}
            >
              {t(
                "Continue with this supplier name",
                "ادامه با این نام تأمین‌کننده",
              )}
            </Checkbox>
          </div>
        )}
        {error &&
          !["name", "email", "balance", "date", "similar"].includes(error) && (
            <p className="form-error" role="alert">
              {errors[error]}
            </p>
          )}
        <div className="actions">
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit">
            {supplier
              ? t("Save supplier", "ذخیرهٔ تأمین‌کننده")
              : t("Add supplier", "افزودن تأمین‌کننده")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
