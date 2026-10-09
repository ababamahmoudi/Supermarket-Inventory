import {
  branchLabel as configuredBranchLabel,
  configuredBranches,
} from "../settings";
import { useState } from "react";
import Decimal from "decimal.js";
import {
  approvalSnapshot,
  keepApprovedPrice,
  proposeManualOverride,
  resolveApproval,
} from "../approvals";
import { effectiveOffer, effectivePrice } from "../catalog";
import { ManualPricePill } from "../manual-price-presentation";
import {
  demoUserLabel,
  LtrText,
  Money,
  OfferLabel,
  ProductName,
} from "../presentation";
import "./financial-polish.css";
import { useDemo } from "../store";
import { effectiveApprovalLocation } from "../received";
import { SupplierApproval } from "./SupplierApproval";
import type { Approval, Branch } from "../types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Tabs,
  NumberField,
} from "../ui";

export function Approvals() {
  const { state, update, role, branch, lang, t } = useDemo();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">(
    "pending",
  );
  const [scope, setScope] = useState<"all" | "branch">("all");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    approval: Approval;
    decision: "approve" | "reject";
    snapshot: string;
    target: Branch;
  } | null>(null);
  const company = state.config.company.seed_key;
  const branches = configuredBranches(state.config, true);
  const items = state.approvals
    .map((item) => ({
      ...item,
      branch: effectiveApprovalLocation(state, item),
    }))
    .filter(
      (item) =>
        item.company_id === company &&
        item.status === filter &&
        (branch === "all" || item.branch === branch || item.branch === "all"),
    );
  if (role !== "supervisor")
    return (
      <EmptyState>
        {t(
          "Switch to Supervisor to review approvals.",
          "برای بررسی تأییدها به سرپرست تغییر دهید.",
        )}
      </EmptyState>
    );
  const typeName = (item: Approval) =>
    item.manual_override
      ? t("Manual price override", "تغییر دستی قیمت")
      : {
          new_product: t("New product", "کالای جدید"),
          price_change: t("Price change", "تغییر قیمت"),
          margin_review: t("Below minimum margin", "کمتر از حداقل حاشیه سود"),
          barcode_conflict: t("Barcode conflict", "تداخل بارکد"),
          tax_profile: t("Tax profile change", "تغییر وضعیت مالیات"),
          new_supplier: t(
            "Supplier waiting for confirmation",
            "تأمین‌کننده در انتظار تأیید",
          ),
        }[item.type];
  const branchName = (value: Branch) =>
    configuredBranchLabel(state.config, value, lang);
  const openPreview = (item: Approval, decision: "approve" | "reject") => {
    setMessage("");
    const target =
      branch !== "all"
        ? branch
        : item.branch !== "all"
          ? item.branch
          : branches[0];
    setPreview({
      approval: item,
      decision,
      snapshot: approvalSnapshot(state, item.product_code),
      target,
    });
  };
  const confirm = () => {
    if (!preview) return;
    if (
      preview.snapshot !==
      approvalSnapshot(state, preview.approval.product_code)
    ) {
      setPreview(null);
      setMessage(
        t(
          "Prices changed. Open the approval again to review the latest prices before confirming.",
          "قیمت‌ها تغییر کردند. تأیید را دوباره باز کنید تا پیش از تأیید، تازه‌ترین قیمت‌ها را بررسی کنید.",
        ),
      );
      return;
    }
    update((draft) =>
      resolveApproval(
        draft,
        preview.approval.id,
        preview.decision,
        scope,
        preview.target,
        reasons[preview.approval.id],
        preview.snapshot,
      ),
    );
    setMessage(
      preview.approval.type === "barcode_conflict"
        ? t(
            preview.decision === "approve" ? "Approved" : "Rejected",
            preview.decision === "approve" ? "تأیید شد" : "رد شد",
          )
        : preview.decision === "approve"
          ? t(
              "Approved price. Cashier lookup now shows the approved price.",
              "قیمت تأیید شد. جستجوی صندوق‌دار اکنون قیمت تأییدشده را نشان می‌دهد.",
            )
          : t(
              "Rejected. The approved price was kept.",
              "رد شد. قیمت تأییدشده حفظ شد.",
            ),
    );
    setPreview(null);
  };
  const marginAction = (item: Approval, action: "keep" | "override") => {
    const reason = reasons[item.id]?.trim();
    if (!reason) {
      setMessage(
        t(
          "Add a reason before keeping the price or proposing an override.",
          "پیش از حفظ قیمت یا پیشنهاد تغییر دستی، دلیل را وارد کنید.",
        ),
      );
      return;
    }
    const amount = overrides[item.id] ?? "";
    if (action === "override" && !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setMessage(
        t(
          "Enter a nonnegative override price with at most two decimals.",
          "قیمت دستی غیرمنفی را با حداکثر دو رقم اعشار وارد کنید.",
        ),
      );
      return;
    }
    update((draft) =>
      action === "keep"
        ? keepApprovedPrice(draft, item.id, reason)
        : void proposeManualOverride(draft, item.id, amount, reason),
    );
    setMessage(
      action === "keep"
        ? t(
            "Kept approved price. The review is acknowledged.",
            "قیمت تأییدشده حفظ شد. بررسی ثبت شد.",
          )
        : t(
            "Proposed manual override. The cashier keeps the approved price until approval.",
            "تغییر دستی پیشنهاد شد. صندوق‌دار تا تأیید، قیمت قبلی را استفاده می‌کند.",
          ),
    );
  };
  return (
    <>
      <PageHeader
        title={t("Approvals", "تأییدها")}
        description={t(
          "Review new products and prices. Pending prices never replace approved prices.",
          "کالاها و قیمت‌های جدید را بررسی کنید. قیمت در انتظار، جایگزین قیمت تأییدشده نمی‌شود.",
        )}
      />
      <Tabs
        value={filter}
        aria-label={t("Approval status", "وضعیت تأیید")}
        onChange={(value) => {
          setFilter(value as typeof filter);
          setMessage("");
        }}
        options={[
          { value: "pending", label: t("Pending", "در انتظار") },
          { value: "approved", label: t("Approved", "تأییدشده") },
          { value: "rejected", label: t("Rejected", "ردشده") },
        ]}
      />
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {items.length === 0 && (
        <EmptyState>
          {t(
            "No approvals in this view. Receive an invoice to create a proposal.",
            "در این نما تأییدی وجود ندارد. برای ایجاد پیشنهاد، یک فاکتور دریافت کنید.",
          )}
        </EmptyState>
      )}
      {items.map((item) => {
        if (item.type === "new_supplier")
          return <SupplierApproval key={item.id} approval={item} />;
        const product = state.products.find(
          (value) =>
            value.company_id === company && value.code === item.product_code,
        );
        if (!product) return null;
        const approved =
          "current_price" in item
            ? item.current_price
            : effectivePrice(state, product, item.branch);
        const relatedInvoice = [state.invoice, ...(state.invoices ?? [])].find(
          (invoice) =>
            invoice.company_id === company &&
            item.invoice_ids?.includes(invoice.id),
        );
        const unitCost = item.unit_cost ?? product.last_cost_before_tax;
        const margin =
          item.margin ??
          (item.proposed_price && new Decimal(item.proposed_price).gt(0)
            ? new Decimal(item.proposed_price)
                .minus(unitCost)
                .div(item.proposed_price)
                .toFixed(4)
            : null);
        const triggeredBy =
          item.triggered_by ??
          (item.manual_override
            ? [...state.activity]
                .reverse()
                .find(
                  (entry) =>
                    entry.company_id === company &&
                    entry.product_code === item.product_code &&
                    entry.branch === item.branch &&
                    entry.action === "Propose manual override",
                )?.by
            : relatedInvoice?.receiving_employee);

        return (
          <Card
            key={item.id}
            className="approval-card"
            title={lang === "fa" ? product.name_fa : product.name_en}
          >
            <p className="muted approval-secondary-name">
              <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                {lang === "fa" ? product.name_en : product.name_fa}
              </bdi>
            </p>
            {item.type === "barcode_conflict" && (
              <div className="barcode-conflict-details">
                <LtrText>{item.barcode}</LtrText>
                <p>
                  {t("Product", "محصول")}:{" "}
                  <ProductName product={product} language={lang} />
                </p>
                {state.products
                  .filter(
                    (value) =>
                      value.company_id === company &&
                      value.code === item.conflicting_product_code,
                  )
                  .map((value) => (
                    <p key={value.code}>
                      {t("Existing barcode mapping", "محصول متصل به بارکد")}:{" "}
                      <ProductName product={value} language={lang} />
                    </p>
                  ))}
              </div>
            )}
            <div className="row">
              <Badge
                tone={
                  item.status === "pending"
                    ? "pending"
                    : item.status === "approved"
                      ? "approved"
                      : "neutral"
                }
              >
                {item.status === "pending"
                  ? t("Pending", "در انتظار")
                  : item.status === "approved"
                    ? t("Approved", "تأییدشده")
                    : t("Rejected", "ردشده")}
              </Badge>
              <Badge tone="info">{typeName(item)}</Badge>
              <span>
                {branchName(item.branch)} · {t("Product Code", "کد کالا")}{" "}
                <bdi>{item.product_code}</bdi>
              </span>
            </div>
            {item.type !== "barcode_conflict" && (
              <div className="approval-values">
                <div className="approval-value">
                  <span className="muted">{t("Old price", "قیمت قبلی")}</span>
                  {approved !== null && approved !== undefined ? (
                    <strong className="price">
                      <Money value={approved} />
                      <ManualPricePill product={product} branch={item.branch} />
                    </strong>
                  ) : (
                    <span className="muted approval-missing-price">
                      {t("No approved price yet", "هنوز قیمت تأییدشده ندارد")}
                    </span>
                  )}
                </div>
                <div className="approval-value">
                  <span className="muted">{t("New price", "قیمت جدید")}</span>
                  <strong className="price">
                    <Money value={item.proposed_price} />
                  </strong>
                </div>
                <div className="approval-value">
                  <span className="muted">{t("Unit cost", "هزینه واحد")}</span>
                  <strong>
                    <Money value={unitCost} />
                  </strong>
                </div>
                <div className="approval-value">
                  <span className="muted">{t("Margin", "حاشیه سود")}</span>
                  <strong>
                    <bdi dir="ltr">
                      {margin !== null
                        ? `${new Decimal(margin).times(100).toFixed(2)}%`
                        : "—"}
                    </bdi>
                  </strong>
                </div>
              </div>
            )}
            <div className="approval-meta">
              <span>
                {t("Branch", "شعبه")}: {branchName(item.branch)}
              </span>
              <span>
                {t("Triggered by", "ایجادشده توسط")}:{" "}
                {triggeredBy
                  ? demoUserLabel(triggeredBy, lang)
                  : t("Not recorded", "ثبت نشده")}
              </span>
              {item.threshold && (
                <span>
                  {t("Minimum margin", "حداقل حاشیه سود")}:{" "}
                  <bdi dir="ltr">
                    {new Decimal(item.threshold).times(100).toFixed(2)}%
                  </bdi>
                </span>
              )}
            </div>
            {item.manual_override && (
              <p>
                {t("Reason", "دلیل")}: {item.reason}
              </p>
            )}
            {(item.invoice_number || relatedInvoice) && (
              <p className="muted">
                {t("Invoice", "فاکتور")}:{" "}
                <bdi dir="ltr">
                  {item.invoice_number ??
                    relatedInvoice?.supplier_invoice_number}
                </bdi>
              </p>
            )}
            {item.status === "pending" && item.type === "margin_review" && (
              <>
                <p className="muted">
                  {t(
                    "Receiving continues. Keep this price with a reason, propose an override, or leave the review pending.",
                    "دریافت کالا ادامه دارد. قیمت را با دلیل حفظ کنید، تغییر دستی پیشنهاد دهید یا بررسی را در انتظار بگذارید.",
                  )}
                </p>
                <div className="form-grid approval-form">
                  <Field label={t("Reason", "دلیل")}>
                    <input
                      value={reasons[item.id] ?? ""}
                      onChange={(event) =>
                        setReasons({
                          ...reasons,
                          [item.id]: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label={t("Manual override price", "قیمت دستی")}>
                    <NumberField
                      value={overrides[item.id] ?? ""}
                      onChange={(value) =>
                        setOverrides({ ...overrides, [item.id]: value })
                      }
                    />
                  </Field>
                </div>
                <div className="actions">
                  <Button onClick={() => marginAction(item, "keep")}>
                    {t("Keep approved price", "حفظ قیمت تأییدشده")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => marginAction(item, "override")}
                  >
                    {t("Propose manual override", "پیشنهاد تغییر دستی")}
                  </Button>
                </div>
              </>
            )}
            {item.status === "pending" && item.type !== "margin_review" && (
              <div className="actions">
                <Button
                  onClick={() => {
                    setScope("all");
                    openPreview(item, "approve");
                  }}
                >
                  {item.type === "barcode_conflict"
                    ? t("Approve", "تأیید")
                    : item.type === "new_product"
                      ? t("Approve product", "تأیید کالا")
                      : t("Approve price", "تأیید قیمت")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openPreview(item, "reject")}
                >
                  {t("Reject", "رد کردن")}
                </Button>
              </div>
            )}
            {item.acknowledgment_reason && (
              <p>
                {t("Review reason", "دلیل بررسی")}: {item.acknowledgment_reason}
              </p>
            )}
          </Card>
        );
      })}
      {preview && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          title={
            preview.approval.type === "barcode_conflict"
              ? t("Existing barcode mapping", "محصول متصل به بارکد")
              : preview.decision === "approve"
                ? t("Review approval", "بررسی تأیید")
                : t("Reject proposal", "رد پیشنهاد")
          }
          description={
            preview.decision === "approve"
              ? t(
                  "Review every affected branch before confirming.",
                  "پیش از تأیید، همه شعبه‌های تحت تأثیر را بررسی کنید.",
                )
              : t(
                  "The current approved price stays unchanged. This proposal will be marked Rejected.",
                  "قیمت تأییدشده فعلی حفظ می‌شود. این پیشنهاد به وضعیت ردشده تغییر می‌کند.",
                )
          }
          confirmLabel={
            preview.decision === "reject"
              ? t("Reject proposal", "رد پیشنهاد")
              : preview.approval.type === "barcode_conflict"
                ? t("Approve", "تأیید")
                : preview.approval.type === "new_product"
                  ? t("Approve product", "تأیید کالا")
                  : t("Approve price", "تأیید قیمت")
          }
          onConfirm={confirm}
        >
          {preview.decision === "approve" &&
          preview.approval.type !== "barcode_conflict" ? (
            <>
              <Field label={t("Apply price to", "اعمال قیمت به")}>
                <Select
                  value={scope}
                  onChange={(value) => setScope(value as "all" | "branch")}
                  options={[
                    {
                      value: "all",
                      label: t("All branches", "همه شعبه‌ها"),
                    },
                    {
                      value: "branch",
                      label: t("This branch only", "فقط این شعبه"),
                    },
                  ]}
                />
              </Field>
              <p>
                {scope === "all"
                  ? t(
                      "All branch overrides will be removed, including intentional prices. Incompatible offers will stop; new offers wait for confirmation.",
                      "همه قیمت‌های ویژه شعبه‌ها، از جمله قیمت‌های عمدی، حذف می‌شوند. پیشنهادهای ناسازگار متوقف می‌شوند و پیشنهادهای جدید منتظر تأیید می‌مانند.",
                    )
                  : t(
                      "Only this branch changes. Other branches keep their prices and offers.",
                      "فقط این شعبه تغییر می‌کند. شعبه‌های دیگر قیمت‌ها و پیشنهادهای خود را حفظ می‌کنند.",
                    )}
              </p>
              <DataTable className="approval-scope-preview">
                <thead>
                  <tr>
                    <th>{t("Branch", "شعبه")}</th>
                    <th>{t("Price change", "تغییر قیمت")}</th>
                    <th>{t("Affected offer", "پیشنهاد مرتبط")}</th>
                    <th>{t("Override removed", "حذف قیمت ویژه")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(scope === "all" ? branches : [preview.target]).map(
                    (value) => {
                      const product = state.products.find(
                        (item) =>
                          item.code === preview.approval.product_code &&
                          item.company_id === company,
                      )!;
                      const price = effectivePrice(state, product, value);
                      const offer = effectiveOffer(state, product, value);
                      return (
                        <tr key={value}>
                          <td>{branchName(value)}</td>
                          <td>
                            <div className="price-change-values">
                              <ManualPricePill
                                product={product}
                                branch={value}
                              />
                              <span>
                                {t("Old", "قبلی")}{" "}
                                {price !== null && price !== undefined ? (
                                  <Money value={price} />
                                ) : (
                                  "—"
                                )}
                              </span>
                              <span>
                                {t("New", "جدید")}{" "}
                                <Money
                                  value={preview.approval.proposed_price}
                                />
                              </span>
                            </div>
                          </td>
                          <td>
                            {offer ? (
                              <OfferLabel label={offer.label} language={lang} />
                            ) : (
                              t("None", "ندارد")
                            )}
                            {offer &&
                              offer.price !==
                                preview.approval.proposed_price && (
                                <> · {t("Will stop", "متوقف می‌شود")}</>
                              )}
                          </td>
                          <td>
                            {scope === "all" && product.branch_prices?.[value]
                              ? t("Yes", "بله")
                              : t("No", "خیر")}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </DataTable>
            </>
          ) : null}
        </ConfirmDialog>
      )}
    </>
  );
}

export default Approvals;
