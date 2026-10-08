import { useState } from "react";
import { useDemo } from "../store";
import { companyDate } from "../invoice";
import { configuredBranches, branchLabel } from "../settings";
import {
  saveSupplier,
  similarSupplierNames,
  SupplierEditError,
  type SupplierEdits,
} from "../supplier-editor";
import type { SupplierRecord } from "../types";
import { Button, Checkbox, DateField, Dialog, Field } from "../ui";
import { LtrText } from "../presentation";
import "./manual-entry.css";

export function SupplierEditor({
  supplier,
  invoiceQuickAdd = false,
  onClose,
  onSaved,
}: {
  supplier?: SupplierRecord;
  invoiceQuickAdd?: boolean;
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
  const [error, setError] = useState<SupplierEditError["code"] | null>(null);
  const matches = similarSupplierNames(state, values.name, supplier?.id);
  const patch = (key: keyof SupplierEdits, value: string | boolean) =>
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" ? { similar_name_confirmed: false } : {}),
    }));
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
                  { id: supplier?.id, invoice_quick_add: invoiceQuickAdd },
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
        <Field
          label={t("Supplier name", "نام تأمین‌کننده")}
          error={error === "name" ? errors.name : undefined}
        >
          <input
            autoFocus
            dir="auto"
            value={values.name}
            onChange={(event) => patch("name", event.target.value)}
          />
        </Field>
        <div className="manual-entry-pair">
          <Field label={t("Phone", "تلفن")}>
            <input
              dir="ltr"
              type="tel"
              value={values.phone}
              onChange={(event) => patch("phone", event.target.value)}
            />
          </Field>
          <Field
            label={t("Email", "ایمیل")}
            error={error === "email" ? errors.email : undefined}
          >
            <input
              dir="ltr"
              type="email"
              value={values.email}
              onChange={(event) => patch("email", event.target.value)}
            />
          </Field>
          <Field label={t("Sales representative", "نماینده فروش")}>
            <input
              dir="auto"
              value={values.sales_rep_name}
              onChange={(event) => patch("sales_rep_name", event.target.value)}
            />
          </Field>
          <Field label={t("Sales rep phone", "تلفن نماینده فروش")}>
            <input
              dir="ltr"
              type="tel"
              value={values.sales_rep_phone}
              onChange={(event) => patch("sales_rep_phone", event.target.value)}
            />
          </Field>
        </div>
        <Field label={t("Payment terms", "شرایط پرداخت")}>
          <input
            dir="auto"
            value={values.payment_terms}
            onChange={(event) => patch("payment_terms", event.target.value)}
            placeholder={t("Payment terms", "شرایط پرداخت")}
          />
        </Field>
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
                <Field label={t("Opening balance", "ماندهٔ اولیه")}>
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    className="control-narrow"
                    value={row.amount}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        opening_balances: current.opening_balances!.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: event.target.value }
                              : item,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label={t("As of", "در تاریخ")}>
                  <DateField
                    value={row.date}
                    onChange={(date) =>
                      setValues((current) => ({
                        ...current,
                        opening_balances: current.opening_balances!.map(
                          (item, itemIndex) =>
                            itemIndex === index ? { ...item, date } : item,
                        ),
                      }))
                    }
                  />
                </Field>
              </div>
            ))}
          </fieldset>
        )}
        {!!matches.length && (
          <div className="banner info manual-similar-warning" role="status">
            <p>
              {t(
                "A similar supplier already exists.",
                "یک تأمین‌کنندهٔ مشابه وجود دارد.",
              )}
            </p>
            {matches.map((record) => (
              <Button
                key={record.id}
                variant="ghost"
                onClick={() => {
                  onClose();
                  navigate(`suppliers?name=${encodeURIComponent(record.name)}`);
                }}
              >
                <LtrText>{record.name}</LtrText>
              </Button>
            ))}
            <Checkbox
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
        {error && (
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
