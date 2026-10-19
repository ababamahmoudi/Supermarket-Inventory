import { configuredRoleLabel } from "../role-config";
import { domainScope } from "../domain-authority";
import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DateField,
  Dropzone,
  DialogActions,
  Field,
  NumberField,
  Select,
} from "../ui";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import type { OperationalReturnRead } from "../return-projections";
import {
  uploadReturnPhoto,
  type ReturnPhotoAttachment,
} from "../return-file-access";
import { companyDate } from "../invoice";
import {
  cancelReturn,
  correctReturnPickup,
  operationError,
  recordPickup,
  returnUnpickedQuantity,
  type OperationsContext,
  type Disposition,
} from "../operations";
import {
  recordItemResolutions,
  type ItemResolutionInput,
  type ItemResolutionKind,
} from "../return-item-resolutions";
import type { ReturnLine } from "../types";
import { LtrText } from "../presentation";
import { branchLabel } from "../settings";

type ShortfallOutcome = NonNullable<ReturnLine["pickup_shortfall"]>["outcome"];
type ItemDraft = {
  kind: ItemResolutionKind;
  quantity: string;
  document: string;
  amount: string;
  invoice_id: string;
  expected_date: string;
  note: string;
  replacement_product_code: string;
  replacement_quantity: string;
  received_date: string;
  representative: string;
};
export function ReturnActionForms({
  record,
  context,
  mode,
  onClose,
  onSaved,
}: {
  record: OperationalReturnRead;
  context: OperationsContext;
  mode: "pickup" | "correct" | "resolve";
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { state, command, query, can, t, lang } = useDemo();
  const financialRoles = {
    en: ["owner", "manager"]
      .map((role) =>
        configuredRoleLabel(
          state.config.roles,
          role as "owner" | "manager",
          "en",
        ),
      )
      .join(" / "),
    fa: ["owner", "manager"]
      .map((role) =>
        configuredRoleLabel(
          state.config.roles,
          role as "owner" | "manager",
          "fa",
        ),
      )
      .join(" / "),
  };
  const latest = record.pickup_memos?.at(-1);
  const [photoPreview, setPhotoPreview] = useState<string>();
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      record.lines.map((line) => [
        line.product_code,
        String(
          mode === "correct"
            ? (latest?.lines.find(
                (item) => item.product_code === line.product_code,
              )?.quantity ?? 0)
            : 0,
        ),
      ]),
    ),
  );
  const [shortfalls, setShortfalls] = useState<
    Record<string, { reason: string; outcome: ShortfallOutcome | "" }>
  >(() =>
    Object.fromEntries(
      record.lines.map((line) => [
        line.product_code,
        {
          reason:
            mode === "correct" ? (line.pickup_shortfall?.reason ?? "") : "",
          outcome:
            mode === "correct" ? (line.pickup_shortfall?.outcome ?? "") : "",
        },
      ]),
    ),
  );
  const [representative, setRepresentative] = useState("");
  const [slip, setSlip] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<ReturnPhotoAttachment | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [items, setItems] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(
      record.lines.map((line) => [
        line.product_code,
        {
          kind: "outstanding",
          quantity: String(record.line_progress[line.product_code].available),
          document: "",
          amount: "",
          invoice_id: record.linked_invoice ?? "",
          expected_date: line.outstanding_expected_date ?? "",
          note: line.outstanding_note ?? "",
          replacement_product_code: line.product_code,
          replacement_quantity: "1",
          received_date: companyDate(state.config),
          representative: "",
        },
      ]),
    ),
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [domainError, setDomainError] = useState("");
  const [review, setReview] = useState(false);
  const title =
    mode === "pickup"
      ? t("Record actual pickup", "ثبت جمع‌آوری واقعی")
      : mode === "correct"
        ? t("Correct pickup", "اصلاح جمع‌آوری")
        : t("Record resolution", "ثبت حل‌وفصل");
  const fieldId = (code: string, field: string) =>
    `return-${mode}-${code}-${field}`;
  const fieldError = (id: string) =>
    issues.find((issue) => issue.fieldId === id)?.message;
  const clear = (id: string) => {
    setIssues((current) => current.filter((issue) => issue.fieldId !== id));
    setDomainError("");
  };
  const name = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return product
      ? lang === "fa"
        ? product.name_fa || product.name_en
        : product.name_en
      : code;
  };
  const weighted = (line: ReturnLine) =>
    line.quantity_unit === "lb" ||
    (!line.quantity_unit &&
      state.products.find(
        (product) =>
          product.company_id === context.company_id &&
          product.code === line.product_code,
      )?.sold_by === "weight");
  const remaining = (line: ReturnLine) =>
    mode === "correct"
      ? new Decimal(returnUnpickedQuantity(record, line))
          .plus(
            latest?.lines.find(
              (item) => item.product_code === line.product_code,
            )?.quantity ?? 0,
          )
          .plus(
            line.pickup_shortfall &&
              line.pickup_shortfall.outcome !== "keep_for_next_pickup"
              ? line.pickup_shortfall.quantity
              : 0,
          )
          .toNumber()
      : returnUnpickedQuantity(record, line);
  const updateItem = (code: string, field: keyof ItemDraft, value: string) => {
    setItems((current) => ({
      ...current,
      [code]: { ...current[code], [field]: value },
    }));
    clear(fieldId(code, field));
  };
  const invoices = state.ledger.filter(
    (row) =>
      row.company_id === context.company_id &&
      row.branch === record.branch &&
      row.supplier === record.supplier &&
      row.type === "invoice",
  );
  const photoUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const saved = await uploadReturnPhoto(query, {
        company_id: context.company_id,
        return_id: record.id,
        capability:
          mode === "pickup"
            ? "returns.pickup_record"
            : mode === "correct"
              ? "returns.pickup_correct"
              : "returns.operational_resolve",
        file,
      });
      setPhotoPreview(URL.createObjectURL(file));
      setPhoto(saved);
      setPhotoName(saved.name);
    } catch {
      setUploadError(
        t(
          "The photo could not be saved. Allow browser storage and try again.",
          "عکس ذخیره نشد. ذخیره‌سازی مرورگر را مجاز کنید و دوباره تلاش کنید.",
        ),
      );
    } finally {
      setUploading(false);
    }
  };
  const validQuantity = (
    value: string,
    max: number,
    line: ReturnLine,
    zero = false,
  ) => {
    try {
      const amount = new Decimal(value);
      return (
        amount.isFinite() &&
        amount.gte(zero ? 0 : weighted(line) ? "0.001" : 1) &&
        amount.lte(max) &&
        amount.eq(amount.toDecimalPlaces(weighted(line) ? 3 : 0))
      );
    } catch {
      return false;
    }
  };
  const validate = () => {
    const missing: ValidationIssue[] = [];
    const add = (id: string, message: string) =>
      missing.push({ id: `${id}-error`, fieldId: id, message });
    if (mode !== "resolve") {
      for (const line of record.lines) {
        const code = line.product_code;
        if (!validQuantity(quantities[code], remaining(line), line, true))
          add(
            fieldId(code, "quantity"),
            t(
              `Check the actual pickup quantity for ${name(code)}.`,
              `تعداد واقعی جمع‌آوری ${name(code)} را بررسی کنید.`,
            ),
          );
        if (Number(quantities[code]) < remaining(line)) {
          if (!shortfalls[code]?.reason.trim())
            add(
              fieldId(code, "shortfall-reason"),
              t(
                `Enter a shortfall reason for ${name(code)}.`,
                `دلیل کسری ${name(code)} را وارد کنید.`,
              ),
            );
          if (!shortfalls[code]?.outcome)
            add(
              fieldId(code, "shortfall-outcome"),
              t(
                `Choose an outcome for the leftover ${name(code)}.`,
                `نتیجه باقی‌مانده ${name(code)} را انتخاب کنید.`,
              ),
            );
        }
      }
      if (mode === "pickup") {
        if (!representative.trim())
          add(
            "return-pickup-representative",
            t(
              "Enter the supplier representative name.",
              "نام نماینده تأمین‌کننده را وارد کنید.",
            ),
          );
        if (!slip.trim())
          add(
            "return-pickup-slip",
            t(
              "Enter the signed paper pickup slip reference.",
              "مرجع رسید کاغذی امضاشده جمع‌آوری را وارد کنید.",
            ),
          );
        if (uploading)
          add(
            "return-pickup-photo",
            t(
              "Wait for the photo to finish saving.",
              "تا پایان ذخیره عکس صبر کنید.",
            ),
          );
      } else if (!reason.trim())
        add(
          "return-correct-reason",
          t(
            "Enter a reason for correcting the pickup.",
            "دلیل اصلاح جمع‌آوری را وارد کنید.",
          ),
        );
    } else {
      for (const line of record.lines.filter(
        (item) => record.line_progress[item.product_code].available > 0,
      )) {
        const code = line.product_code,
          item = items[code];
        if (item.kind === "outstanding") {
          if (!item.expected_date)
            add(
              fieldId(code, "expected_date"),
              t(
                `Enter an expected date for ${name(code)}.`,
                `تاریخ مورد انتظار ${name(code)} را وارد کنید.`,
              ),
            );
          continue;
        }
        if (
          !validQuantity(
            item.quantity,
            record.line_progress[line.product_code].available,
            line,
          )
        )
          add(
            fieldId(code, "quantity"),
            t(
              `Check the original quantity covered for ${name(code)}.`,
              `تعداد اصلی تحت پوشش ${name(code)} را بررسی کنید.`,
            ),
          );
        if (
          Number(item.quantity) <
            record.line_progress[line.product_code].available &&
          !item.expected_date
        )
          add(
            fieldId(code, "expected_date"),
            t(
              `Enter an expected date for the remaining ${name(code)}.`,
              `تاریخ مورد انتظار باقی‌مانده ${name(code)} را وارد کنید.`,
            ),
          );
        if (item.kind === "credited" || item.kind === "cash_or_other") {
          if (!item.document.trim())
            add(
              fieldId(code, "document"),
              t(
                "Enter the credit note number.",
                "شماره یادداشت اعتبار را وارد کنید.",
              ),
            );
          if (item.kind === "credited" && !item.invoice_id)
            add(
              fieldId(code, "invoice_id"),
              t(
                "Choose the posted invoice to credit.",
                "فاکتور ثبت‌شده برای بستانکاری را انتخاب کنید.",
              ),
            );
          if (can("returns.credit_post", domainScope(state, record, true))) {
            try {
              const amount = new Decimal(item.amount);
              if (
                !amount.isFinite() ||
                !amount.gt(0) ||
                !amount.eq(amount.toDecimalPlaces(2))
              )
                throw new Error();
            } catch {
              add(
                fieldId(code, "amount"),
                t(
                  "Enter a valid actual credit amount.",
                  "مبلغ واقعی اعتبار معتبر وارد کنید.",
                ),
              );
            }
          }
        } else if (item.kind === "replaced") {
          const product = state.products.find(
            (product) =>
              product.code === item.replacement_product_code &&
              product.company_id === context.company_id,
          );
          if (!product)
            add(
              fieldId(code, "replacement_product_code"),
              t(
                "Choose the replacement product.",
                "کالای جایگزین را انتخاب کنید.",
              ),
            );
          if (
            !validQuantity(item.replacement_quantity, Number.MAX_SAFE_INTEGER, {
              ...line,
              product_code: item.replacement_product_code,
              quantity_unit: product?.sold_by === "weight" ? "lb" : "units",
            })
          )
            add(
              fieldId(code, "replacement_quantity"),
              product?.sold_by === "weight"
                ? t(
                    "Enter a positive weight in lb with up to three decimal places.",
                    "وزن مثبت بر حسب پوند با حداکثر سه رقم اعشار وارد کنید.",
                  )
                : t(
                    "Enter the actual replacement quantity.",
                    "تعداد واقعی جایگزین را وارد کنید.",
                  ),
            );
          if (!item.document.trim())
            add(
              fieldId(code, "document"),
              t(
                "Enter the replacement receipt reference.",
                "مرجع رسید جایگزین را وارد کنید.",
              ),
            );
          if (!item.representative.trim())
            add(
              fieldId(code, "representative"),
              t(
                "Enter the supplier representative name.",
                "نام نماینده تأمین‌کننده را وارد کنید.",
              ),
            );
          if (!item.received_date)
            add(
              fieldId(code, "received_date"),
              t("Enter the received date.", "تاریخ دریافت را وارد کنید."),
            );
        } else if (!item.note.trim())
          add(
            fieldId(code, "note"),
            t("Enter a write-off reason.", "دلیل سوخت‌کردن را وارد کنید."),
          );
      }
    }
    setIssues(missing);
    return !missing.length;
  };
  const perform = async () => {
    try {
      await command(
        mode === "resolve"
          ? "returns.operational_resolve"
          : mode === "correct"
            ? "returns.pickup_correct"
            : "returns.pickup_record",
        domainScope(state, record, true),
        (draft, freshActor) => {
          if (mode === "resolve") {
            const inputs: ItemResolutionInput[] = record.lines
              .filter(
                (line) => record.line_progress[line.product_code].available > 0,
              )
              .map((line) => ({
                ...items[line.product_code],
                product_code: line.product_code,
                quantity: Number(items[line.product_code].quantity),
                amount:
                  can(
                    "returns.credit_post",
                    domainScope(state, record, true),
                  ) &&
                  (items[line.product_code].kind === "credited" ||
                    items[line.product_code].kind === "cash_or_other")
                    ? items[line.product_code].amount
                    : undefined,
                replacement_quantity: Number(
                  items[line.product_code].replacement_quantity,
                ),
              }));
            recordItemResolutions(draft, freshActor, record.id, inputs);
          } else {
            const picked = Object.fromEntries(
              record.lines.map((line) => [
                line.product_code,
                Number(quantities[line.product_code]),
              ]),
            );
            const decisions = Object.fromEntries(
              Object.entries(shortfalls)
                .filter(([, value]) => value.outcome)
                .map(([code, value]) => [
                  code,
                  {
                    reason: value.reason,
                    outcome: value.outcome as ShortfallOutcome,
                  },
                ]),
            );
            if (mode === "correct")
              correctReturnPickup(draft, freshActor, record.id, {
                memo_id: latest?.id ?? "",
                quantities: picked,
                shortfalls: decisions,
                reason,
              });
            else
              recordPickup(draft, freshActor, record.id, {
                quantities: picked,
                shortfalls: decisions,
                representative,
                slip,
                photo: photo || undefined,
                note,
              });
          }
        },
      );
      onSaved(
        mode === "pickup"
          ? t(
              "Recorded pickup and retained Return memo.",
              "جمع‌آوری ثبت و یادداشت مرجوعی نگهداری شد.",
            )
          : mode === "correct"
            ? t(
                "Corrected pickup. The original signed record is retained.",
                "جمع‌آوری اصلاح شد. سابقه امضاشده اصلی نگهداری می‌شود.",
              )
            : t(
                `Recorded item resolutions. Credit claims require ${financialRoles.en} verification.`,
                `حل‌وفصل اقلام ثبت شد. ادعای اعتبار به تأیید ${financialRoles.fa} نیاز دارد.`,
              ),
      );
    } catch (error) {
      setDomainError(
        operationError(
          error instanceof Error ? error.message : "",
          t,
          state.config,
        ),
      );
    }
    setReview(false);
  };
  return (
    <Card className="return-action-card form-section">
      <h3>{title}</h3>
      <p className="return-action-caption muted">
        <LtrText>{record.supplier}</LtrText> ·{" "}
        {branchLabel(state.config, record.branch, lang)}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (validate()) {
            if (mode === "correct") setReview(true);
            else perform();
          }
        }}
      >
        <WhatsMissing issues={issues} />
        {domainError && (
          <div className="banner danger" role="alert">
            {domainError}
          </div>
        )}
        {mode !== "resolve" ? (
          <>
            <div className="return-item-form-list">
              {record.lines.map((line) => (
                <section className="return-item-form" key={line.product_code}>
                  <h4>
                    <bdi dir="auto">{name(line.product_code)}</bdi>
                  </h4>
                  <p className="muted">
                    {t("Return quantity", "تعداد مرجوعی")}:{" "}
                    <bdi>
                      {line.qty}
                      {weighted(line) ? " lb" : ""}
                    </bdi>
                  </p>
                  <Field
                    className="field-short"
                    label={t("Actual pickup quantity", "تعداد واقعی جمع‌آوری")}
                    error={fieldError(fieldId(line.product_code, "quantity"))}
                  >
                    <NumberField
                      id={fieldId(line.product_code, "quantity")}
                      min="0"
                      max={remaining(line)}
                      step={weighted(line) ? "0.001" : "1"}
                      value={quantities[line.product_code]}
                      onChange={(value) => {
                        setQuantities((current) => ({
                          ...current,
                          [line.product_code]: value,
                        }));
                        clear(fieldId(line.product_code, "quantity"));
                      }}
                    />
                  </Field>
                  {Number(quantities[line.product_code]) < remaining(line) && (
                    <div className="form-grid">
                      <Field
                        label={t("Shortfall reason", "دلیل کسری")}
                        error={fieldError(
                          fieldId(line.product_code, "shortfall-reason"),
                        )}
                      >
                        <input
                          dir="auto"
                          id={fieldId(line.product_code, "shortfall-reason")}
                          value={shortfalls[line.product_code]?.reason ?? ""}
                          onChange={(event) => {
                            setShortfalls((current) => ({
                              ...current,
                              [line.product_code]: {
                                ...current[line.product_code],
                                reason: event.target.value,
                              },
                            }));
                            clear(
                              fieldId(line.product_code, "shortfall-reason"),
                            );
                          }}
                        />
                      </Field>
                      <Field
                        label={t("Leftover outcome", "نتیجه باقی‌مانده")}
                        error={fieldError(
                          fieldId(line.product_code, "shortfall-outcome"),
                        )}
                      >
                        <Select
                          id={fieldId(line.product_code, "shortfall-outcome")}
                          value={shortfalls[line.product_code]?.outcome ?? ""}
                          onChange={(value) => {
                            setShortfalls((current) => ({
                              ...current,
                              [line.product_code]: {
                                ...current[line.product_code],
                                outcome: value as ShortfallOutcome,
                              },
                            }));
                            clear(
                              fieldId(line.product_code, "shortfall-outcome"),
                            );
                          }}
                          options={[
                            {
                              value: "",
                              label: t("Choose an outcome", "انتخاب نتیجه"),
                            },
                            {
                              value: "keep_for_next_pickup",
                              label: t(
                                "Keep for next pickup",
                                "نگهداری برای جمع‌آوری بعدی",
                              ),
                            },
                            {
                              value: "put_back_on_shelf",
                              label: t(
                                "Put back on the shelf",
                                "بازگرداندن به قفسه",
                              ),
                            },
                            {
                              value: "throw_away",
                              label: t("Throw away", "دور ریختن"),
                            },
                          ]}
                        />
                      </Field>
                    </div>
                  )}
                </section>
              ))}
            </div>
            {mode === "pickup" ? (
              <>
                <div className="form-grid">
                  <Field
                    label={t(
                      "Supplier representative name",
                      "نام نماینده تأمین‌کننده",
                    )}
                    error={fieldError("return-pickup-representative")}
                  >
                    <input
                      id="return-pickup-representative"
                      value={representative}
                      onChange={(event) => {
                        setRepresentative(event.target.value);
                        clear("return-pickup-representative");
                      }}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Signed paper pickup slip reference",
                      "مرجع رسید کاغذی امضاشده جمع‌آوری",
                    )}
                    error={fieldError("return-pickup-slip")}
                  >
                    <input
                      id="return-pickup-slip"
                      value={slip}
                      onChange={(event) => {
                        setSlip(event.target.value);
                        clear("return-pickup-slip");
                      }}
                    />
                  </Field>
                </div>
                <div id="return-pickup-photo">
                  <Field
                    label={t("Item photo (optional)", "عکس کالا (اختیاری)")}
                    error={uploadError || fieldError("return-pickup-photo")}
                  >
                    <Dropzone
                      accept="image/*"
                      fileName={photoName || undefined}
                      onChange={(file) => {
                        void photoUpload(file);
                      }}
                      onRemove={() => {
                        setPhoto(null);
                        setPhotoName("");
                        setUploadError("");
                      }}
                    />
                  </Field>
                </div>
                {photo && (
                  <img
                    className="evidence-photo"
                    src={photoPreview}
                    alt={t("Evidence photo", "عکس مدرک")}
                  />
                )}
                <Field label={t("Note (optional)", "یادداشت (اختیاری)")}>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </>
            ) : (
              <Field
                label={t("Correction reason", "دلیل اصلاح")}
                error={fieldError("return-correct-reason")}
              >
                <textarea
                  id="return-correct-reason"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    clear("return-correct-reason");
                  }}
                />
              </Field>
            )}
          </>
        ) : (
          <>
            <p className="muted">
              {t(
                "Pickup quantities are locked. Record each item's outcome below.",
                "تعداد جمع‌آوری قفل است. نتیجه هر قلم را در زیر ثبت کنید.",
              )}
            </p>
            <div className="return-item-form-list">
              {record.lines.map((line) => {
                const code = line.product_code,
                  item = items[code],
                  progress = record.line_progress[line.product_code];
                return (
                  <section className="return-item-form" key={code}>
                    <h4>
                      <bdi dir="auto">{name(code)}</bdi>
                    </h4>
                    <p className="muted">
                      {t("Picked up", "جمع‌آوری‌شده")}:{" "}
                      <bdi>{progress.picked_up}</bdi> ·{" "}
                      {t("Resolved", "حل‌شده")}: <bdi>{progress.resolved}</bdi>{" "}
                      · {t("Still outstanding", "هنوز باقی‌مانده")}:{" "}
                      <bdi>{progress.outstanding}</bdi>
                    </p>
                    {progress.available > 0 ? (
                      <>
                        <Field label={t("Outcome", "نتیجه")}>
                          <Select
                            value={item.kind}
                            onChange={(value) =>
                              updateItem(code, "kind", value)
                            }
                            options={[
                              {
                                value: "credited",
                                label: t("Credited", "اعتبار دریافت‌شده"),
                              },
                              {
                                value: "cash_or_other",
                                label: t(
                                  "Cash or other compensation",
                                  "نقد یا جبران دیگر",
                                ),
                              },
                              {
                                value: "replaced",
                                label: t("Replaced", "جایگزین‌شده"),
                              },
                              {
                                value: "outstanding",
                                label: t(
                                  "Still outstanding",
                                  "هنوز باقی‌مانده",
                                ),
                              },
                              ...(can(
                                "returns.credit_post",
                                domainScope(state, record, true),
                              )
                                ? [
                                    {
                                      value: "written_off",
                                      label: t("Written off", "سوخت‌شده"),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </Field>
                        {item.kind === "outstanding" ? (
                          <Field
                            label={t("Expected date", "تاریخ مورد انتظار")}
                            error={fieldError(fieldId(code, "expected_date"))}
                          >
                            <DateField
                              id={fieldId(code, "expected_date")}
                              value={item.expected_date}
                              onChange={(value) =>
                                updateItem(code, "expected_date", value)
                              }
                            />
                          </Field>
                        ) : (
                          <Field
                            className="field-short"
                            label={t(
                              "Original quantity covered",
                              "تعداد اصلی تحت پوشش",
                            )}
                            error={fieldError(fieldId(code, "quantity"))}
                          >
                            <NumberField
                              id={fieldId(code, "quantity")}
                              value={item.quantity}
                              min={weighted(line) ? "0.001" : "1"}
                              max={progress.available}
                              step={weighted(line) ? "0.001" : "1"}
                              onChange={(value) =>
                                updateItem(code, "quantity", value)
                              }
                            />
                          </Field>
                        )}
                        {item.kind !== "outstanding" &&
                          Number(item.quantity) < progress.available && (
                            <Field
                              label={t(
                                "Remaining expected date",
                                "تاریخ مورد انتظار باقی‌مانده",
                              )}
                              error={fieldError(fieldId(code, "expected_date"))}
                            >
                              <DateField
                                id={fieldId(code, "expected_date")}
                                value={item.expected_date}
                                onChange={(value) =>
                                  updateItem(code, "expected_date", value)
                                }
                              />
                            </Field>
                          )}
                        {(item.kind === "credited" ||
                          item.kind === "cash_or_other") && (
                          <div className="form-grid">
                            <Field
                              label={t(
                                "Credit note number",
                                "شماره یادداشت اعتبار",
                              )}
                              error={fieldError(fieldId(code, "document"))}
                            >
                              <input
                                id={fieldId(code, "document")}
                                value={item.document}
                                onChange={(event) =>
                                  updateItem(
                                    code,
                                    "document",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                            {can(
                              "returns.credit_post",
                              domainScope(state, record, true),
                            ) && (
                              <Field
                                className="field-short"
                                label={t(
                                  "Actual credit amount",
                                  "مبلغ واقعی اعتبار",
                                )}
                                error={fieldError(fieldId(code, "amount"))}
                              >
                                <NumberField
                                  id={fieldId(code, "amount")}
                                  value={item.amount}
                                  onChange={(value) =>
                                    updateItem(code, "amount", value)
                                  }
                                />
                              </Field>
                            )}
                            {item.kind === "credited" && (
                              <Field
                                label={t(
                                  "One posted invoice to credit",
                                  "یک فاکتور ثبت‌شده برای بستانکاری",
                                )}
                                error={fieldError(fieldId(code, "invoice_id"))}
                              >
                                <Select
                                  id={fieldId(code, "invoice_id")}
                                  value={item.invoice_id}
                                  onChange={(value) =>
                                    updateItem(code, "invoice_id", value)
                                  }
                                  options={[
                                    {
                                      value: "",
                                      label: t(
                                        "Choose an invoice",
                                        "انتخاب فاکتور",
                                      ),
                                    },
                                    ...invoices.map((row) => ({
                                      value: row.invoice_id ?? row.id,
                                      label: row.reference,
                                    })),
                                  ]}
                                />
                              </Field>
                            )}
                          </div>
                        )}
                        {item.kind === "replaced" && (
                          <div className="form-grid">
                            <Field
                              label={t(
                                "Replacement product actually received",
                                "کالای جایگزین واقعاً دریافت‌شده",
                              )}
                              error={fieldError(
                                fieldId(code, "replacement_product_code"),
                              )}
                            >
                              <Select
                                id={fieldId(code, "replacement_product_code")}
                                value={item.replacement_product_code}
                                onChange={(value) =>
                                  updateItem(
                                    code,
                                    "replacement_product_code",
                                    value,
                                  )
                                }
                                options={state.products
                                  .filter(
                                    (product) =>
                                      product.company_id ===
                                        context.company_id &&
                                      product.status === "active",
                                  )
                                  .map((product) => ({
                                    value: product.code,
                                    label: name(product.code),
                                  }))}
                              />
                            </Field>
                            <Field
                              className="field-short"
                              label={`${t("Actual replacement quantity", "تعداد واقعی جایگزین")}${state.products.find((product) => product.company_id === context.company_id && product.code === item.replacement_product_code)?.sold_by === "weight" ? " (lb)" : ""}`}
                              error={fieldError(
                                fieldId(code, "replacement_quantity"),
                              )}
                            >
                              <NumberField
                                id={fieldId(code, "replacement_quantity")}
                                value={item.replacement_quantity}
                                min={
                                  state.products.find(
                                    (product) =>
                                      product.company_id ===
                                        context.company_id &&
                                      product.code ===
                                        item.replacement_product_code,
                                  )?.sold_by === "weight"
                                    ? "0.001"
                                    : "1"
                                }
                                step={
                                  state.products.find(
                                    (product) =>
                                      product.company_id ===
                                        context.company_id &&
                                      product.code ===
                                        item.replacement_product_code,
                                  )?.sold_by === "weight"
                                    ? "0.001"
                                    : "1"
                                }
                                onChange={(value) =>
                                  updateItem(
                                    code,
                                    "replacement_quantity",
                                    value,
                                  )
                                }
                              />
                            </Field>
                            <Field
                              label={t("Received date", "تاریخ دریافت")}
                              error={fieldError(fieldId(code, "received_date"))}
                            >
                              <DateField
                                id={fieldId(code, "received_date")}
                                value={item.received_date}
                                onChange={(value) =>
                                  updateItem(code, "received_date", value)
                                }
                              />
                            </Field>
                            <Field
                              label={t(
                                "Supplier representative name",
                                "نام نماینده تأمین‌کننده",
                              )}
                              error={fieldError(
                                fieldId(code, "representative"),
                              )}
                            >
                              <input
                                id={fieldId(code, "representative")}
                                value={item.representative}
                                onChange={(event) =>
                                  updateItem(
                                    code,
                                    "representative",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                            <Field
                              label={t(
                                "Replacement receipt reference",
                                "مرجع رسید جایگزین",
                              )}
                              error={fieldError(fieldId(code, "document"))}
                            >
                              <input
                                id={fieldId(code, "document")}
                                value={item.document}
                                onChange={(event) =>
                                  updateItem(
                                    code,
                                    "document",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                          </div>
                        )}
                        <Field
                          label={
                            item.kind === "written_off"
                              ? t("Write-off reason", "دلیل سوخت‌کردن")
                              : t("Note (optional)", "یادداشت (اختیاری)")
                          }
                          error={fieldError(fieldId(code, "note"))}
                        >
                          <textarea
                            dir="auto"
                            id={fieldId(code, "note")}
                            value={item.note}
                            onChange={(event) =>
                              updateItem(code, "note", event.target.value)
                            }
                          />
                        </Field>
                      </>
                    ) : (
                      <p className="muted">
                        {progress.pending > 0
                          ? t(
                              `Pending ${financialRoles.en} verification`,
                              `در انتظار تأیید ${financialRoles.fa}`,
                            )
                          : t("Resolved", "حل‌شده")}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
        <DialogActions>
          <Button type="button" variant="neutral" onClick={onClose}>
            {t("Close", "بستن")}
          </Button>
          <Button type="submit">
            {mode === "pickup"
              ? t("Record pickup", "ثبت جمع‌آوری")
              : mode === "correct"
                ? t("Review correction", "بررسی اصلاح")
                : t("Record resolution", "ثبت حل‌وفصل")}
          </Button>
        </DialogActions>
      </form>
      <ConfirmDialog
        open={review}
        onOpenChange={setReview}
        title={t("Correct pickup", "اصلاح جمع‌آوری")}
        description={t(
          "The original signed pickup stays in History. This correction appends the quantities and reason below.",
          "جمع‌آوری امضاشده اصلی در تاریخچه می‌ماند. این اصلاح تعدادها و دلیل زیر را اضافه می‌کند.",
        )}
        confirmLabel={t("Correct pickup", "اصلاح جمع‌آوری")}
        onConfirm={() => {
          if (
            can("returns.pickup_correct", {
              ...domainScope(state, record, true),
              location_policy: "retained_correction",
            })
          )
            perform();
          else
            setDomainError(operationError("pickup_authority", t, state.config));
        }}
      >
        {record.lines.map((line) => (
          <p key={line.product_code}>
            {name(line.product_code)} ·{" "}
            <bdi>
              {latest?.lines.find(
                (item) => item.product_code === line.product_code,
              )?.quantity ?? 0}{" "}
              → {quantities[line.product_code]}
            </bdi>
          </p>
        ))}
        <p>{reason}</p>
      </ConfirmDialog>
    </Card>
  );
}

export function ReturnCancellationForm({
  record,
  context,
  onClose,
  onSaved,
}: {
  record: OperationalReturnRead;
  context: OperationsContext;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { state, command, t, lang } = useDemo();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>(
    {},
  );
  const [reason, setReason] = useState("");
  const [safe, setSafe] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState("");
  const clear = (fieldId: string) => {
    setIssues((current) =>
      current.filter((issue) => issue.fieldId !== fieldId),
    );
    setError("");
  };
  const errorFor = (fieldId: string) =>
    issues.find((issue) => issue.fieldId === fieldId)?.message;
  const submit = async () => {
    const missing: ValidationIssue[] = [];
    const add = (fieldId: string, message: string) => {
      if (!missing.some((issue) => issue.fieldId === fieldId))
        missing.push({ id: `${fieldId}-error`, fieldId, message });
    };
    if (!reason.trim())
      add(
        "return-cancel-reason",
        t("Enter a cancellation reason.", "دلیل لغو را وارد کنید."),
      );
    for (const line of record.lines) {
      if (!dispositions[line.product_code])
        add(
          `return-cancel-${line.product_code}-disposition`,
          t(
            "Choose the actual disposition for every original line.",
            "وضعیت واقعی هر ردیف اصلی را انتخاب کنید.",
          ),
        );
      const count = Number(quantities[line.product_code] ?? "0");
      const weight =
        line.quantity_unit === "lb" ||
        (!line.quantity_unit &&
          state.products.find(
            (product) =>
              product.company_id === context.company_id &&
              product.code === line.product_code,
          )?.sold_by === "weight");
      if (
        !Number.isFinite(count) ||
        count < 0 ||
        count > line.qty ||
        !new Decimal(count).eq(
          new Decimal(count).toDecimalPlaces(weight ? 3 : 0),
        )
      )
        add(
          `return-cancel-${line.product_code}-quantity`,
          t(
            "Check the quantity physically recovered.",
            "تعداد واقعاً بازیابی‌شده را بررسی کنید.",
          ),
        );
      if (
        count > 0 &&
        (dispositions[line.product_code] !== "recovered_sellable" || !safe)
      )
        add(
          "return-cancel-safe",
          t(
            "Confirm the recovered originals are safe and sellable.",
            "سالم و قابل‌فروش بودن اصل کالای بازیابی‌شده را تأیید کنید.",
          ),
        );
    }
    setIssues(missing);
    if (missing.length) return;
    try {
      await command(
        "returns.operational_resolve",
        domainScope(state, record, true),
        (draft, freshActor) =>
          cancelReturn(draft, freshActor, record.id, {
            reason,
            dispositions,
            recovered: Object.fromEntries(
              record.lines.map((line) => [
                line.product_code,
                Number(quantities[line.product_code] ?? "0"),
              ]),
            ),
            safe,
          }),
      );
      onSaved(
        t(
          "Recorded cancellation disposition. Existing compensation remains unchanged.",
          "وضعیت لغو ثبت شد. جبران قبلی بدون تغییر باقی ماند.",
        ),
      );
    } catch (caught) {
      setError(
        operationError(
          caught instanceof Error ? caught.message : "",
          t,
          state.config,
        ),
      );
    }
  };
  return (
    <Card className="return-action-card form-section">
      <h3>{t("Actual original-goods disposition", "وضعیت واقعی اصل کالا")}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <WhatsMissing issues={issues} />
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="return-item-form-list">
          {record.lines.map((line) => {
            const product = state.products.find(
              (product) =>
                product.code === line.product_code &&
                product.company_id === context.company_id,
            );
            const name = product
              ? lang === "fa"
                ? product.name_fa || product.name_en
                : product.name_en
              : line.product_code;
            return (
              <section className="return-item-form" key={line.product_code}>
                <h4>
                  <bdi dir="auto">{name}</bdi>
                </h4>
                <div className="form-grid">
                  <Field
                    className="field-short"
                    label={t(
                      "Actual safe originals recovered (zero is valid)",
                      "اصل کالای سالم واقعاً بازیابی‌شده (صفر مجاز است)",
                    )}
                    error={errorFor(
                      `return-cancel-${line.product_code}-quantity`,
                    )}
                  >
                    <NumberField
                      id={`return-cancel-${line.product_code}-quantity`}
                      value={quantities[line.product_code] ?? "0"}
                      min="0"
                      max={line.qty}
                      step={line.quantity_unit === "lb" ? "0.001" : "1"}
                      onChange={(value) => {
                        setQuantities((current) => ({
                          ...current,
                          [line.product_code]: value,
                        }));
                        clear(`return-cancel-${line.product_code}-quantity`);
                      }}
                    />
                  </Field>
                  <Field
                    label={t("Actual disposition", "وضعیت واقعی")}
                    error={errorFor(
                      `return-cancel-${line.product_code}-disposition`,
                    )}
                  >
                    <Select
                      id={`return-cancel-${line.product_code}-disposition`}
                      value={dispositions[line.product_code] ?? ""}
                      onChange={(value) => {
                        setDispositions((current) => ({
                          ...current,
                          [line.product_code]: value as Disposition,
                        }));
                        clear(`return-cancel-${line.product_code}-disposition`);
                      }}
                      options={[
                        {
                          value: "",
                          label: t("Choose disposition", "انتخاب وضعیت"),
                        },
                        {
                          value: "supplier_held",
                          label: t(
                            "Supplier still holds originals — restore zero",
                            "اصل کالا نزد تأمین‌کننده است — بازیابی صفر",
                          ),
                        },
                        {
                          value: "unsafe_on_site",
                          label: t(
                            "Damaged or unsafe on site — restore zero",
                            "کالای آسیب‌دیده یا ناسالم در محل — بازیابی صفر",
                          ),
                        },
                        {
                          value: "recovered_sellable",
                          label: t(
                            "Originals physically recovered and safe to sell",
                            "اصل کالا واقعاً بازیابی‌شده و سالم برای فروش",
                          ),
                        },
                      ]}
                    />
                  </Field>
                </div>
              </section>
            );
          })}
        </div>
        <Field
          label={t("Cancellation reason (required)", "دلیل لغو (ضروری)")}
          error={errorFor("return-cancel-reason")}
        >
          <textarea
            dir="auto"
            id="return-cancel-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              clear("return-cancel-reason");
            }}
          />
        </Field>
        <Field
          label={t("Recovered originals", "اصل کالای بازیابی‌شده")}
          error={errorFor("return-cancel-safe")}
        >
          <Checkbox
            id="return-cancel-safe"
            checked={safe}
            onChange={(value) => {
              setSafe(value);
              clear("return-cancel-safe");
            }}
          >
            {t(
              "I inspected these physically recovered originals and confirm they are safe and sellable.",
              "اصل کالاهای واقعاً بازیابی‌شده را بررسی و سالم و قابل‌فروش بودن آن‌ها را تأیید می‌کنم.",
            )}
          </Checkbox>
        </Field>
        <DialogActions>
          <Button type="button" variant="neutral" onClick={onClose}>
            {t("Close", "بستن")}
          </Button>
          <Button type="submit">
            {t("Record cancellation disposition", "ثبت وضعیت لغو")}
          </Button>
        </DialogActions>
      </form>
    </Card>
  );
}
