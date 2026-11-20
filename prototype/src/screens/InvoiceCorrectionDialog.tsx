import {
  correctionLineChanges,
  invalidateCorrectionCaseBasis,
} from "../invoice-correction-fields";
import { useEffect, useRef, useState } from "react";
import { PencilLine } from "lucide-react";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import { createId } from "../ids";
import { InvoiceCorrectionError } from "../invoice-corrections";
import {
  type InvoiceReadDTO,
  type InvoicePurchaseReadDTO,
} from "../invoice-projections";
import { useProtectedQuery } from "../use-protected-query";
import {
  invoiceCorrectionReview,
  applyReviewedInvoiceCorrection,
  discardInvoiceCorrectionReview,
  type InvoiceCorrectionReview,
} from "../invoice-correction-read";
import type { InvoiceEditableLine } from "../invoice-edit-types";
import { recalculateInvoice, setInvoiceLineQuantity } from "../invoice";
import {
  initializeInvoiceWeight,
  setInvoiceWeightQuantity,
  selectInvoiceWeightUnit,
} from "../invoice-weight";
import { trackingChoiceForProduct } from "../date-tracking";
import { Button, Dialog, Field } from "../ui";
import {
  DateText,
  LtrText,
  Money,
  NotAdded,
  ProductName,
} from "../presentation";
import {
  invoiceWorkspaceRead,
  type InvoiceWorkspaceRead,
} from "../invoice-workspace-read";
import { LinesTable } from "./invoice-review/LinesTable";
import { useReviewScrollAnchor } from "./invoice-review/useReviewScrollAnchor";
import "./invoice-document-c4.css";
import "./invoice-correction-r2b.css";

function correctionScrollParent(element: HTMLElement) {
  return element.closest<HTMLElement>(".ui-dialog-body");
}

export function InvoiceCorrectionDialog({
  original,
  onClose,
  onSaved,
}: {
  original: InvoiceReadDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { state, actor, can, authorityGeneration } = useDemo();
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
    entity_id: original.id,
  };
  const read = useProtectedQuery(
    "invoices.correct",
    scope,
    (canonical, currentActor) =>
      invoiceWorkspaceRead(canonical, currentActor, original.id),
    original.id,
  );
  const current =
    state.invoice_workspace?.invoice.id === original.id
      ? state.invoice_workspace
      : read.data;
  if (!actor || !can("invoices.correct", scope) || !current) return null;
  return (
    <InvoiceCorrectionWorkspace
      key={JSON.stringify([
        actor.session_id,
        actor.authority_epoch,
        authorityGeneration,
        original.id,
      ])}
      original={current.invoice}
      workspace={current}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
function InvoiceCorrectionWorkspace({
  original,
  workspace,
  onClose,
  onSaved,
}: {
  original: InvoicePurchaseReadDTO;
  workspace: InvoiceWorkspaceRead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    state,
    actor,
    query,
    command,
    authorityGeneration,
    businessRevision,
    t,
    lang,
  } = useDemo();
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
    entity_id: original.id,
  };
  const key = JSON.stringify([
    actor?.session_id,
    actor?.authority_epoch,
    authorityGeneration,
    businessRevision,
    original.id,
  ]);
  const [lines, setLines] = useState(() => structuredClone(original.lines));
  const [unitCostReentered, setUnitCostReentered] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const { anchor, clear: clearAnchor } = useReviewScrollAnchor(
    correctionScrollParent,
  );
  const onOpen = (index: number | null) => {
    if (index === null && openLine !== null)
      setReservedHeight(content.current?.scrollHeight ?? 0);
    else setReservedHeight(0);
    setOpenLine(index);
  };
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [requestId] = useState(() => createId("invoice-correction-request"));
  const [previewState, setPreview] = useState<{
    key: string;
    value: InvoiceCorrectionReview;
  } | null>(null);
  const preview = previewState?.key === key ? previewState.value : null;
  const stalePreview = Boolean(previewState && previewState.key !== key);
  const reviewToken = previewState?.value.snapshot;
  useEffect(
    () => () => {
      if (reviewToken) discardInvoiceCorrectionReview(reviewToken);
    },
    [reviewToken],
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<{ code: string; line?: number } | null>(
    null,
  );
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
      const index = number ? Number(number) - 1 : undefined;
      setError({ code: caught.code, line: index });
      if (index !== undefined) setOpenLine(index);
    } else setError({ code: "stale" });
  }
  function edit(
    index: number,
    change: (line: InvoiceEditableLine) => void,
    field?: string,
  ) {
    const costEdit =
      field === "unit_cost_before_tax" || field === "case_cost_before_tax";
    if (costEdit)
      setUnitCostReentered((current) => {
        const next = new Set(current);
        if (field === "unit_cost_before_tax") next.add(index);
        else next.delete(index);
        return next;
      });
    setLines((current) => {
      const next = structuredClone(current);
      change(next[index]);
      invalidateCorrectionCaseBasis(current[index], next[index], costEdit);
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
  async function inspect() {
    if (!reason.trim()) {
      setError({ code: "reason" });
      document.getElementById("invoice-correction-reason")?.focus();
      return;
    }
    if (pending) return;
    setPending(true);
    try {
      const value = await query(
        "invoices.correct",
        scope,
        (canonical, currentActor) =>
          invoiceCorrectionReview(canonical, currentActor, original.id, {
            lines,
            reason,
            unit_cost_reentered: [...unitCostReentered],
          }),
      );
      setPreview({ key, value });
      setError(null);
    } catch (caught) {
      report(caught);
    } finally {
      setPending(false);
    }
  }
  async function save() {
    if (!preview) return;
    if (pending) return;
    setPending(true);
    try {
      await command("invoices.correct", scope, (draft, currentActor) =>
        applyReviewedInvoiceCorrection(
          draft,
          currentActor,
          original.id,
          { lines, reason, unit_cost_reentered: [...unitCostReentered] },
          preview.snapshot,
          requestId,
        ),
      );
      onSaved();
    } catch (caught) {
      setPreview(null);
      setConfirmed(false);
      report(caught);
    } finally {
      setPending(false);
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
  const pendingProposalChanges =
    preview?.approval_changes.filter(
      (change) => change.creates_pending_proposal,
    ) ?? [];
  const supersededApprovals = [
    ...new Set(
      preview?.approval_changes.flatMap(
        (change) => change.superseded_approval_ids,
      ) ?? [],
    ),
  ].flatMap((id) => {
    const approval = state.approvals.find(
      (approval) =>
        approval.company_id === original.company_id && approval.id === id,
    );
    return approval ? [approval] : [];
  });
  const localInvoice = structuredClone({ ...original, lines });
  recalculateInvoice(localInvoice, state.config);
  localInvoice.lines = localInvoice.lines.map((line) => ({
    ...line,
    low_confidence_fields: [],
  }));
  const changed = new Set(
    correctionLineChanges(original.lines, localInvoice.lines).map(
      (line) => line.line_index,
    ),
  );
  const onQuantity = (
    line: InvoiceEditableLine,
    value: string | number,
    unit: NonNullable<InvoiceEditableLine["quantity_unit"]>,
    pack?: number,
  ) => {
    if (unit === "kg" || unit === "lb") {
      selectInvoiceWeightUnit(line, unit, state.config);
      setInvoiceWeightQuantity(line, value, unit, state.config);
    } else if (line.sold_by === "weight" && unit === "cases")
      setInvoiceWeightQuantity(
        line,
        value,
        unit as "kg" | "lb" | "cases",
        state.config,
      );
    else {
      line.sold_by = "each";
      setInvoiceLineQuantity(line, value, unit as "units" | "cases", pack);
    }
  };
  const selectProduct = (index: number, code: string) => {
    const target = state.products.find(
      (product) =>
        product.company_id === original.company_id &&
        product.code === code &&
        (product.status !== "archived" ||
          code === original.lines[index].product_code),
    );
    if (!target) return;
    edit(index, (item) => {
      item.product_code = code;
      item.new_name_en = target.name_en;
      item.new_name_fa = target.name_fa;
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
    });
  };
  const fieldLabels: Record<string, [string, string]> = {
    product_code: ["Product", "کالا"],
    quantity_unit: ["Quantity unit", "واحد تعداد"],
    quantity_entered: ["Invoiced quantity", "تعداد فاکتور"],
    qty_invoiced: ["Total invoiced units", "کل واحدهای فاکتور"],
    qty_received_at_posting: ["Delivered units", "واحدهای تحویل‌شده"],
    units_per_case: ["Units per case", "واحد در هر کارتن"],
    unit_cost_before_tax: ["Unit cost", "هزینه واحد"],
    case_cost_before_tax: ["Case cost", "هزینه کارتن"],
    source_quantity: ["Invoiced weight", "وزن فاکتور"],
    source_quantity_unit: ["Weight unit", "واحد وزن"],
    source_received_quantity: ["Delivered weight", "وزن تحویل‌شده"],
    source_cost_before_tax: ["Source cost", "هزینه منبع"],
    source_cost_unit: ["Cost unit", "واحد هزینه"],
    case_weight: ["Case weight", "وزن کارتن"],
    case_weight_unit: ["Case weight unit", "واحد وزن کارتن"],
    date_tracking: ["Track dates", "پیگیری تاریخ‌ها"],
    date_type: ["Date type", "نوع تاریخ"],
    date_value: ["Date", "تاریخ"],
    lot_number: ["Lot number", "شماره سری ساخت"],
    taxable: ["Taxable", "مشمول مالیات"],
    line_total: ["Line total", "جمع ردیف"],
    line_tax: ["Line tax", "مالیات ردیف"],
  };
  const value = (field: string, text: string) => {
    if (!text) return <NotAdded />;
    if (["taxable", "date_tracking"].includes(field))
      return text === "true" ? t("Yes", "بله") : t("No", "خیر");
    if (
      [
        "unit_cost_before_tax",
        "case_cost_before_tax",
        "source_cost_before_tax",
      ].includes(field)
    )
      return <Money value={text} decimals={4} fixedDecimals />;
    if (["line_total", "line_tax"].includes(field))
      return <Money value={text} />;
    if (field === "product_code") {
      const product = state.products.find(
        (item) => item.company_id === original.company_id && item.code === text,
      );
      return product ? (
        <ProductName product={product} language={lang} />
      ) : (
        <LtrText>{text}</LtrText>
      );
    }
    if (field === "date_value") return <DateText value={text} />;
    if (field === "date_type")
      return text === "best_before"
        ? t("Best before", "بهترین زمان مصرف")
        : t("Expiry", "انقضا");
    if (field === "quantity_unit" && ["units", "cases"].includes(text))
      return text === "cases" ? t("Cases", "کارتن") : t("Units", "واحد");
    return <LtrText>{text}</LtrText>;
  };
  const difference = preview && (
    <section
      className="invoice-correction-changes"
      aria-label={t("What will change", "چه چیزی تغییر می‌کند")}
    >
      <h3>{t("What will change", "چه چیزی تغییر می‌کند")}</h3>
      {preview.line_changes.map((change) => (
        <div className="list-box" key={change.line_index}>
          <h4>
            {t("Line", "ردیف")} <LtrText>{change.line_index + 1}</LtrText>
          </h4>
          <dl>
            {change.fields.map((field) => (
              <div key={field.field}>
                <dt>
                  {t(
                    ...(fieldLabels[field.field] ?? [
                      "Invoice detail",
                      "جزئیات فاکتور",
                    ]),
                  )}
                </dt>
                <dd>
                  {value(field.field, field.before)}
                  <span aria-hidden="true">→</span>
                  {value(field.field, field.after)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
  const footer = preview ? (
    <>
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
        disabled={pending || !!preview.blockers.length}
        onClick={() => {
          if (confirmed) void save();
          else setConfirmed(true);
        }}
      >
        {confirmed
          ? t("Confirm correction", "تأیید اصلاح")
          : t("Continue", "ادامه")}
      </Button>
    </>
  ) : stalePreview && confirmed ? (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setPreview(null);
          setConfirmed(false);
        }}
      >
        {t("Back", "بازگشت")}
      </Button>
      <Button disabled>{t("Confirm correction", "تأیید اصلاح")}</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t("Cancel", "انصراف")}
      </Button>
      <Button disabled={pending} onClick={() => void inspect()}>
        {t("Preview correction", "پیش‌نمایش اصلاح")}
      </Button>
    </>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("Correct invoice", "اصلاح فاکتور")}
      description={t(
        "Review line changes; the original is retained.",
        "تغییر ردیف‌ها را بررسی کنید؛ اصل حفظ می‌شود.",
      )}
      icon={<PencilLine size={20} />}
      footer={footer}
      className={`invoice-correction-dialog ui-form-surface${openLine !== null ? " has-open-line" : ""}`}
      bodyClassName="invoice-correction-body"
    >
      {stalePreview && (
        <p role="alert" className="form-error">
          {copy.stale}
        </p>
      )}
      {preview ? (
        <>
          <p>
            {t(
              "Review the correction before confirming. The original invoice and payment allocations are retained.",
              "پیش از تأیید، اصلاح را بررسی کنید. اصل فاکتور و تخصیص پرداخت‌ها حفظ می‌شوند.",
            )}
          </p>
          {difference}
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
          <div className="invoice-correction-pending">
            {pendingProposalChanges.map((change) => (
              <p key={change.line_index}>
                <LtrText>{change.product_code}</LtrText> ·{" "}
                <Money value={change.selling_price} />
              </p>
            ))}
            {supersededApprovals.map((approval) => (
              <p key={approval.id}>
                <LtrText>{approval.product_code}</LtrText> ·{" "}
                <Money value={approval.proposed_price} /> ·{" "}
                {t("Superseded", "جایگزین‌شده")}
              </p>
            ))}
            {!pendingProposalChanges.length && !supersededApprovals.length && (
              <p className="muted">
                {t(
                  "No pending approval changes",
                  "تأییدهای در انتظار تغییر نمی‌کنند",
                )}
              </p>
            )}
          </div>
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
        </>
      ) : stalePreview && confirmed ? null : (
        <div
          className="invoice-correction-form ui-form-large ui-form-surface"
          ref={content}
          style={{ minBlockSize: reservedHeight || undefined }}
          onWheelCapture={() => {
            setReservedHeight(0);
            clearAnchor();
          }}
          onTouchMoveCapture={() => {
            setReservedHeight(0);
            clearAnchor();
          }}
        >
          <p className="muted">
            {t(
              "Posted lines are retained. Edit a line, give a reason, then preview the changes before saving.",
              "ردیف‌های ثبت‌شده حفظ می‌شوند. ردیفی را ویرایش کنید، دلیل بنویسید و پیش از ذخیره تغییرات را بررسی کنید.",
            )}
          </p>
          <LinesTable
            invoice={localInvoice}
            workspace={workspace}
            correction={{
              onEdit: edit,
              onSelectProduct: selectProduct,
              changed,
              retainedProductCodes: original.lines.map(
                (line) => line.product_code,
              ),
            }}
            onQuantity={onQuantity}
            openLine={openLine}
            onOpen={onOpen}
            anchor={anchor}
            attemptedPost={error?.line !== undefined}
          />
          <Field
            label={t("Reason (required)", "دلیل (الزامی)")}
            error={error?.code === "reason" ? copy.reason : undefined}
          >
            <textarea
              id="invoice-correction-reason"
              rows={2}
              value={reason}
              onChange={(event) => {
                setReason(event.currentTarget.value);
                if (error?.code === "reason") setError(null);
              }}
            />
          </Field>
          {error && error.code !== "reason" && (
            <p role="alert" className="form-error">
              {error.line !== undefined && (
                <>
                  {t("Line", "ردیف")} <LtrText>{error.line + 1}</LtrText>:{" "}
                </>
              )}
              {copy[error.code] ?? copy.stale}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
