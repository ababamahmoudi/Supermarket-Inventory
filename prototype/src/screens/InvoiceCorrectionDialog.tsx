import { useState } from "react";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import { createId } from "../ids";
import {
  correctPostedInvoice,
  invoiceContentCorrectionPreview,
  InvoiceCorrectionError,
  type InvoiceCorrectionPreview,
} from "../invoice-corrections";
import { effectiveInvoiceVersion } from "../invoice-version";
import { setInvoiceLineQuantity } from "../invoice";
import {
  initializeInvoiceWeight,
  setInvoiceWeightQuantity,
  setInvoiceWeightReceived,
  setInvoiceWeightCost,
} from "../invoice-weight";
import { trackingChoiceForProduct } from "../date-tracking";
import {
  Button,
  DateField,
  Dialog,
  Field,
  NumberField,
  Select,
  SegmentedControl,
} from "../ui";
import { LtrText, Money, ProductName } from "../presentation";
import type { DemoInvoice, InvoiceLine } from "../types";
import "./invoice-document-c4.css";

export function InvoiceCorrectionDialog({
  original,
  onClose,
  onSaved,
}: {
  original: DemoInvoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { state, update, role, branch, user, t, lang } = useDemo();
  const [lines, setLines] = useState(() =>
    structuredClone(effectiveInvoiceVersion(state, original).lines),
  );
  const [reason, setReason] = useState("");
  const [requestId] = useState(() => createId("invoice-correction-request"));
  const [preview, setPreview] = useState<InvoiceCorrectionPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<{ code: string; line?: number } | null>(
    null,
  );
  const context = {
    company_id: state.config.company.seed_key,
    role: role!,
    branch,
    actor: user?.name ?? "",
  };
  const copy: Record<string, string> = {
    reason: t("Give a reason for the correction.", "دلیل اصلاح را وارد کنید."),
    product: t("Choose a product.", "کالا را انتخاب کنید."),
    quantity: t(
      "Enter valid invoice and delivered quantities.",
      "تعداد معتبر فاکتور و تحویل را وارد کنید.",
    ),
    cost: t(
      "Enter a nonnegative cost with up to four decimal places.",
      "هزینه غیرمنفی با حداکثر چهار رقم اعشار وارد کنید.",
    ),
    date: t("Enter the tracked date.", "تاریخ پیگیری‌شده را وارد کنید."),
    unchanged: t(
      "Change an invoice line before previewing the correction.",
      "پیش از پیش‌نمایش اصلاح، یک ردیف فاکتور را تغییر دهید.",
    ),
    scope: t(
      "Choose the invoice's current receiving location.",
      "مکان دریافت فعلی فاکتور را انتخاب کنید.",
    ),
    stale: t(
      "The invoice or allocations changed. Review the correction again.",
      "فاکتور یا تخصیص‌ها تغییر کرده‌اند. اصلاح را دوباره بررسی کنید.",
    ),
    downstream: t(
      "Resolve the highlighted downstream conflict before correcting this line.",
      "پیش از اصلاح این ردیف، تعارض مشخص‌شده را برطرف کنید.",
    ),
    lines: t(
      "Keep each original invoice line in the correction.",
      "همه ردیف‌های اصل فاکتور را در اصلاح حفظ کنید.",
    ),
  };
  function report(caught: unknown) {
    if (caught instanceof InvoiceCorrectionError) {
      const number = /line (\d+)/i.exec(caught.message)?.[1];
      setError({
        code: caught.code,
        line: number ? Number(number) - 1 : undefined,
      });
    } else setError({ code: "stale" });
  }
  function edit(index: number, change: (line: InvoiceLine) => void) {
    setLines((current) => {
      const next = structuredClone(current);
      change(next[index]);
      return next;
    });
    setPreview(null);
    setConfirmed(false);
    if (
      error?.line === index ||
      error?.code === "unchanged" ||
      error?.code === "stale"
    )
      setError(null);
  }
  function fieldError(index: number, code: string) {
    return error?.code === code &&
      (error.line === undefined || error.line === index)
      ? copy[code]
      : undefined;
  }
  function inspect() {
    if (!reason.trim()) {
      setError({ code: "reason" });
      return;
    }
    try {
      setPreview(
        invoiceContentCorrectionPreview(state, context, original.id, {
          lines,
          reason,
        }),
      );
      setError(null);
    } catch (caught) {
      report(caught);
    }
  }
  function save() {
    if (!preview) return;
    try {
      update((draft) => {
        correctPostedInvoice(
          draft,
          context,
          original.id,
          { lines, reason },
          preview.snapshot,
          requestId,
        );
      });
      onSaved();
    } catch (caught) {
      setPreview(null);
      setConfirmed(false);
      report(caught);
    }
  }
  function blockerText(blocker: string) {
    const index = Number(/Line (\d+)/.exec(blocker)?.[1] ?? 1);
    const detail = blocker.includes("later short")
      ? t(
          "has a later short delivery. Keep its quantity, product, pack and cost; correct its date separately.",
          "تحویل بعدی کسری دارد. تعداد، کالا، بسته و هزینه را حفظ کنید؛ تاریخ را جداگانه اصلاح کنید.",
        )
      : blocker.includes("merged pending")
        ? t(
            "has a merged pending approval with other invoices. Keep the product until that approval is resolved; cost and date corrections are available.",
            "تأیید در انتظار مشترک با فاکتورهای دیگر دارد. تا تعیین تکلیف تأیید، کالا را حفظ کنید؛ هزینه و تاریخ قابل اصلاح‌اند.",
          )
        : blocker.includes("order receipt")
          ? t(
              "has a retained order receipt. Keep its quantity, product and pack; a cost or date correction is available.",
              "سند دریافت سفارش دارد. تعداد، کالا و بسته را حفظ کنید؛ هزینه یا تاریخ قابل اصلاح است.",
            )
          : t(
              "has picked-up supplier return evidence. Keep the product and accepted quantity sufficient to cover the retained return.",
              "سند مرجوعی دریافت‌شده توسط تأمین‌کننده دارد. کالا و تعداد پذیرفته‌شده کافی برای پوشش مرجوعی را حفظ کنید.",
            );
    return (
      <>
        <span>
          {t("Line", "ردیف")} <LtrText>{index}</LtrText> {detail}
        </span>
      </>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("Correct invoice", "اصلاح فاکتور")}
      className="invoice-correction-dialog"
    >
      {preview ? (
        <>
          <p>
            {t(
              "Review the correction before confirming. The original invoice and payment allocations are retained.",
              "پیش از تأیید، اصلاح را بررسی کنید. اصل فاکتور و تخصیص پرداخت‌ها حفظ می‌شوند.",
            )}
          </p>
          <dl className="posted-invoice-totals">
            <div>
              <dt>{t("Current payable", "قابل پرداخت فعلی")}</dt>
              <dd>
                <Money value={preview.payable_before} />
              </dd>
            </div>
            <div>
              <dt>{t("Corrected payable", "قابل پرداخت اصلاح‌شده")}</dt>
              <dd>
                <Money value={preview.payable_after} />
              </dd>
            </div>
            <div>
              <dt>{t("Payable delta", "تغییر قابل پرداخت")}</dt>
              <dd>
                <Money value={preview.payable_delta} />
              </dd>
            </div>
            <div>
              <dt>
                {t(
                  "Allocated payments and credits",
                  "پرداخت‌ها و اعتبارهای تخصیص‌یافته",
                )}
              </dt>
              <dd>
                <Money value={preview.allocated_amount} />
              </dd>
            </div>
            {new Decimal(preview.excess_allocated_credit).gt(0) && (
              <div>
                <dt>
                  {t("Excess allocated credit", "اعتبار تخصیص‌یافته اضافی")}
                </dt>
                <dd>
                  <Money value={preview.excess_allocated_credit} />
                </dd>
              </div>
            )}
          </dl>
          <h3>{t("Received", "دریافت‌شده‌ها")}</h3>
          {preview.receipts.length ? (
            preview.receipts.map((receipt) => (
              <p key={receipt.line_index}>
                <LtrText>
                  {receipt.before_product}: {receipt.before_quantity}
                </LtrText>{" "}
                →{" "}
                <LtrText>
                  {receipt.after_product}: {receipt.after_quantity}
                </LtrText>
              </p>
            ))
          ) : (
            <p className="muted">
              {t("No receipt quantity changes", "تعداد دریافت تغییر نمی‌کند")}
            </p>
          )}
          <h3>{t("Pending approvals", "تأییدهای در انتظار")}</h3>
          {preview.approval_changes.length ? (
            preview.approval_changes.map((change) => (
              <p key={change.line_index}>
                <LtrText>{change.product_code}</LtrText> ·{" "}
                <Money value={change.selling_price} />
              </p>
            ))
          ) : (
            <p className="muted">
              {t(
                "No pending approval changes",
                "تأییدهای در انتظار تغییر نمی‌کنند",
              )}
            </p>
          )}
          <h3>{t("Date tracking", "پیگیری تاریخ")}</h3>
          {preview.date_changes.length ? (
            preview.date_changes.map((change) => (
              <p key={change.line_index}>
                <LtrText>
                  {change.product_code}: {change.before ?? "—"}
                </LtrText>{" "}
                → <LtrText>{change.after ?? "—"}</LtrText>
              </p>
            ))
          ) : (
            <p className="muted">
              {t(
                "No tracked date changes",
                "تاریخ‌های پیگیری‌شده تغییر نمی‌کنند",
              )}
            </p>
          )}
          <p>
            {t("Reason", "دلیل")}: {reason}
          </p>
          {!!preview.blockers.length && (
            <div className="banner danger" role="alert">
              {preview.blockers.map((blocker, index) => (
                <p key={index}>{blockerText(blocker)}</p>
              ))}
            </div>
          )}
          {confirmed && (
            <p className="banner pending">
              {t(
                "Confirm correction? This appends a new invoice version and applies the displayed delta once.",
                "اصلاح تأیید شود؟ نسخه جدیدی از فاکتور افزوده می‌شود و تغییر نمایش‌داده‌شده یک‌بار اعمال می‌شود.",
              )}
            </p>
          )}
          <div className="actions">
            <Button
              variant="secondary"
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
              }}
            >
              {t("Back", "بازگشت")}
            </Button>
            <Button
              disabled={!!preview.blockers.length}
              onClick={() => (confirmed ? save() : setConfirmed(true))}
            >
              {confirmed
                ? t("Confirm correction", "تأیید اصلاح")
                : t("Continue", "ادامه")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {lines.map((line, index) => {
            const weight = line.sold_by === "weight";
            const product = state.products.find(
              (product) =>
                product.company_id === original.company_id &&
                product.code === line.product_code,
            );
            return (
              <section key={index} className="invoice-correction-line">
                <h3>
                  {t("Line", "ردیف")} <LtrText>{index + 1}</LtrText> ·{" "}
                  {product ? (
                    <ProductName product={product} language={lang} />
                  ) : (
                    <LtrText>{line.description}</LtrText>
                  )}
                </h3>
                <div className="invoice-correction-fields">
                  <Field
                    label={t("Product", "کالا")}
                    error={fieldError(index, "product")}
                  >
                    <Select
                      value={line.product_code}
                      options={state.products
                        .filter(
                          (product) =>
                            product.company_id === original.company_id &&
                            product.status !== "archived",
                        )
                        .map((product) => ({
                          value: product.code,
                          label: `${product.code} · ${lang === "fa" ? product.name_fa : product.name_en}`,
                        }))}
                      onChange={(code) =>
                        edit(index, (item) => {
                          const target = state.products.find(
                            (product) =>
                              product.company_id === original.company_id &&
                              product.code === code,
                          )!;
                          item.product_code = code;
                          item.sold_by = target.sold_by ?? "each";
                          item.pricing_category = target.pricing_category;
                          item.tax_profile = target.tax_profile;
                          item.taxable = target.taxable;
                          const preference = trackingChoiceForProduct(target);
                          item.date_tracking = preference === "yes";
                          item.date_confirmed = preference !== undefined;
                          if (item.sold_by === "weight")
                            initializeInvoiceWeight(item, state.config);
                          else {
                            item.quantity_unit = "units";
                            item.quantity_entered = item.qty_invoiced;
                            item.source_quantity = undefined;
                            item.source_received_quantity = undefined;
                            item.source_cost_before_tax = undefined;
                          }
                        })
                      }
                    />
                  </Field>
                  <Field label={t("Quantity unit", "واحد تعداد")}>
                    <Select
                      value={line.quantity_unit ?? "units"}
                      options={
                        weight
                          ? [
                              { value: "kg", label: "kg" },
                              { value: "lb", label: "lb" },
                              { value: "cases", label: t("Cases", "کارتن") },
                            ]
                          : [
                              { value: "units", label: t("Units", "واحد") },
                              { value: "cases", label: t("Cases", "کارتن") },
                            ]
                      }
                      onChange={(unit) =>
                        edit(index, (item) =>
                          weight
                            ? setInvoiceWeightQuantity(
                                item,
                                item.quantity_entered ??
                                  item.source_quantity ??
                                  "1",
                                unit as "kg" | "lb" | "cases",
                                state.config,
                              )
                            : setInvoiceLineQuantity(
                                item,
                                item.quantity_entered ?? item.qty_invoiced,
                                unit as "units" | "cases",
                              ),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label={t("Invoiced quantity", "تعداد فاکتور")}
                    error={fieldError(index, "quantity")}
                  >
                    <NumberField
                      min="0"
                      step={weight ? "0.001" : "1"}
                      value={
                        weight
                          ? line.quantity_unit === "cases"
                            ? (line.quantity_entered ?? "")
                            : (line.source_quantity ?? "")
                          : (line.quantity_entered ?? line.qty_invoiced)
                      }
                      onChange={(value) =>
                        edit(index, (item) =>
                          weight
                            ? setInvoiceWeightQuantity(
                                item,
                                value,
                                (item.quantity_unit ?? "lb") as
                                  "kg" | "lb" | "cases",
                                state.config,
                              )
                            : setInvoiceLineQuantity(
                                item,
                                value,
                                (item.quantity_unit ?? "units") as
                                  "units" | "cases",
                              ),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label={t("Delivered quantity", "تعداد تحویل‌شده")}
                    error={fieldError(index, "quantity")}
                  >
                    <NumberField
                      min="0"
                      step={weight ? "0.001" : "1"}
                      value={
                        weight
                          ? (line.source_received_quantity ?? "")
                          : line.qty_received_at_posting
                      }
                      onChange={(value) =>
                        edit(index, (item) =>
                          weight
                            ? setInvoiceWeightReceived(
                                item,
                                value,
                                state.config,
                              )
                            : (item.qty_received_at_posting = Number(value)),
                        )
                      }
                    />
                    {weight && (
                      <small className="muted">
                        <LtrText>{line.source_quantity_unit}</LtrText>
                      </small>
                    )}
                  </Field>
                  {weight ? (
                    <>
                      <Field label={t("Case weight", "وزن کارتن")}>
                        <NumberField
                          min="0"
                          step="0.001"
                          value={line.case_weight ?? ""}
                          onChange={(value) =>
                            edit(index, (item) => {
                              item.case_weight = value;
                              if (item.quantity_unit === "cases")
                                setInvoiceWeightQuantity(
                                  item,
                                  item.quantity_entered ?? "1",
                                  "cases",
                                  state.config,
                                );
                            })
                          }
                        />
                      </Field>
                      <Field label={t("Case weight unit", "واحد وزن کارتن")}>
                        <Select
                          value={line.case_weight_unit ?? "kg"}
                          options={[
                            { value: "kg", label: "kg" },
                            { value: "lb", label: "lb" },
                          ]}
                          onChange={(unit) =>
                            edit(index, (item) => {
                              item.case_weight_unit = unit as "kg" | "lb";
                              if (item.quantity_unit === "cases")
                                setInvoiceWeightQuantity(
                                  item,
                                  item.quantity_entered ?? "1",
                                  "cases",
                                  state.config,
                                );
                            })
                          }
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label={t("Units per case", "واحد در هر کارتن")}>
                      <NumberField
                        min="1"
                        step="1"
                        value={line.units_per_case ?? 1}
                        onChange={(value) =>
                          edit(index, (item) =>
                            setInvoiceLineQuantity(
                              item,
                              item.quantity_entered ?? item.qty_invoiced,
                              (item.quantity_unit ?? "units") as
                                "units" | "cases",
                              Number(value),
                            ),
                          )
                        }
                      />
                    </Field>
                  )}
                  <Field
                    label={
                      weight
                        ? t(
                            "Source cost before tax",
                            "هزینه منبع پیش از مالیات",
                          )
                        : t(
                            "Unit cost before tax",
                            "هزینه هر واحد پیش از مالیات",
                          )
                    }
                    error={fieldError(index, "cost")}
                  >
                    <NumberField
                      min="0"
                      step="0.0001"
                      value={
                        weight
                          ? (line.source_cost_before_tax ?? "")
                          : line.unit_cost_before_tax
                      }
                      onChange={(value) =>
                        edit(index, (item) =>
                          weight
                            ? setInvoiceWeightCost(
                                item,
                                value,
                                item.source_cost_unit ?? "lb",
                                state.config,
                              )
                            : (item.unit_cost_before_tax = value),
                        )
                      }
                    />
                  </Field>
                  {weight && (
                    <Field label={t("Cost unit", "واحد هزینه")}>
                      <Select
                        value={line.source_cost_unit ?? "lb"}
                        options={[
                          { value: "kg", label: "kg" },
                          { value: "lb", label: "lb" },
                        ]}
                        onChange={(unit) =>
                          edit(index, (item) =>
                            setInvoiceWeightCost(
                              item,
                              item.source_cost_before_tax ?? "0",
                              unit as "kg" | "lb",
                              state.config,
                            ),
                          )
                        }
                      />
                    </Field>
                  )}
                  <Field label={t("Track date?", "پیگیری تاریخ؟")}>
                    <SegmentedControl
                      value={line.date_tracking ? "yes" : "no"}
                      options={[
                        { value: "yes", label: t("Yes", "بله") },
                        { value: "no", label: t("No", "خیر") },
                      ]}
                      onChange={(value) =>
                        edit(index, (item) => {
                          item.date_tracking = value === "yes";
                          item.date_confirmed = true;
                        })
                      }
                    />
                  </Field>
                  {line.date_tracking && (
                    <>
                      <Field label={t("Date type", "نوع تاریخ")}>
                        <Select
                          value={line.date_type ?? "expiry"}
                          options={[
                            { value: "expiry", label: t("Expiry", "انقضا") },
                            {
                              value: "best_before",
                              label: t("Best before", "بهترین زمان مصرف"),
                            },
                          ]}
                          onChange={(value) =>
                            edit(index, (item) => {
                              item.date_type = value as
                                "expiry" | "best_before";
                            })
                          }
                        />
                      </Field>
                      <Field
                        label={t("Tracked date", "تاریخ پیگیری‌شده")}
                        error={fieldError(index, "date")}
                      >
                        <DateField
                          value={line.date_value ?? ""}
                          onChange={(value) =>
                            edit(index, (item) => {
                              item.date_value = value;
                            })
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "Lot number (optional)",
                          "شماره سری ساخت (اختیاری)",
                        )}
                      >
                        <input
                          value={line.lot_number ?? ""}
                          onChange={(event) =>
                            edit(index, (item) => {
                              item.lot_number = event.target.value;
                            })
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
              </section>
            );
          })}
          <Field
            label={t("Reason (required)", "دلیل (الزامی)")}
            error={error?.code === "reason" ? copy.reason : undefined}
          >
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (error?.code === "reason") setError(null);
              }}
            />
          </Field>
          {error &&
            !error.line &&
            !["reason", "product", "quantity", "cost", "date"].includes(
              error.code,
            ) && (
              <p role="alert" className="form-error">
                {copy[error.code]}
              </p>
            )}
          <div className="actions">
            <Button variant="secondary" onClick={onClose}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button onClick={inspect}>
              {t("Preview correction", "پیش‌نمایش اصلاح")}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
