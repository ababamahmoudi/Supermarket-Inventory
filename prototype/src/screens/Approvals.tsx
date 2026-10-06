import { useState } from "react";
import Decimal from "decimal.js";
import {
  approvalSnapshot,
  demoBranches,
  keepApprovedPrice,
  proposeManualOverride,
  resolveApproval,
} from "../approvals";
import { effectiveOffer, effectivePrice } from "../catalog";
import { useDemo } from "../store";
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
} from "../ui";

export function Approvals() {
  const { state, update, role, branch, lang, t, money } = useDemo();
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
  const items = state.approvals.filter(
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
        }[item.type];
  const branchName = (value: Branch) =>
    value === "all"
      ? t("All branches", "همه شعبه‌ها")
      : t(value, `شعبه ${demoBranches.indexOf(value) + 1}`);
  const openPreview = (item: Approval, decision: "approve" | "reject") => {
    setMessage("");
    const target =
      branch !== "all"
        ? branch
        : item.branch !== "all"
          ? item.branch
          : demoBranches[0];
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
      preview.decision === "approve"
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
      <div className="tabs" aria-label={t("Approval status", "وضعیت تأیید")}>
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "primary" : "secondary"}
            onClick={() => {
              setFilter(status);
              setMessage("");
            }}
          >
            {
              {
                pending: t("Pending", "در انتظار"),
                approved: t("Approved", "تأییدشده"),
                rejected: t("Rejected", "ردشده"),
              }[status]
            }
          </Button>
        ))}
      </div>
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
        const product = state.products.find(
          (value) =>
            value.company_id === company && value.code === item.product_code,
        );
        if (!product) return null;
        const approved = effectivePrice(state, product, item.branch);
        return (
          <Card
            key={item.id}
            title={lang === "fa" ? product.name_fa : product.name_en}
          >
            <div className="row">
              <Badge
                tone={
                  item.status === "pending"
                    ? "pending"
                    : item.status === "approved"
                      ? "approved"
                      : "danger"
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
            <div className="grid-2">
              <div>
                <p className="muted">
                  {t("Approved selling price", "قیمت فروش تأییدشده")}
                </p>
                <strong className="price">
                  {approved
                    ? money(approved)
                    : t("No approved price", "قیمت تأییدشده ندارد")}
                </strong>
              </div>
              <div>
                <p className="muted">
                  {item.type === "margin_review"
                    ? t("Price kept during review", "قیمت حفظ‌شده هنگام بررسی")
                    : t("Proposed selling price", "قیمت فروش پیشنهادی")}
                </p>
                <strong className="price">{money(item.proposed_price)}</strong>
              </div>
            </div>
            {item.unit_cost && (
              <p>
                {t("Received unit cost", "هزینه واحد دریافتی")}:{" "}
                {money(item.unit_cost)}
                {item.margin && (
                  <>
                    {" "}
                    · {t("Margin", "حاشیه سود")}:{" "}
                    <bdi>{new Decimal(item.margin).times(100).toFixed(2)}%</bdi>
                  </>
                )}
                {item.threshold && (
                  <>
                    {" "}
                    · {t("Minimum", "حداقل")}:{" "}
                    <bdi>
                      {new Decimal(item.threshold).times(100).toFixed(2)}%
                    </bdi>
                  </>
                )}
              </p>
            )}
            {item.manual_override && (
              <p>
                {t("Reason", "دلیل")}: {item.reason}
              </p>
            )}
            {item.invoice_ids?.length ? (
              <p className="muted">
                {t("Linked invoices", "فاکتورهای مرتبط")}:{" "}
                {item.invoice_ids.join(", ")}
              </p>
            ) : null}
            {item.status === "pending" && item.type === "margin_review" && (
              <>
                <p className="muted">
                  {t(
                    "Receiving continues. Keep this price with a reason, propose an override, or leave the review pending.",
                    "دریافت کالا ادامه دارد. قیمت را با دلیل حفظ کنید، تغییر دستی پیشنهاد دهید یا بررسی را در انتظار بگذارید.",
                  )}
                </p>
                <div className="grid-2">
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
                    <input
                      inputMode="decimal"
                      value={overrides[item.id] ?? ""}
                      onChange={(event) =>
                        setOverrides({
                          ...overrides,
                          [item.id]: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="row">
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
              <div className="row">
                <Button
                  onClick={() => {
                    setScope("all");
                    openPreview(item, "approve");
                  }}
                >
                  {item.type === "new_product"
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
            preview.decision === "approve"
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
              : preview.approval.type === "new_product"
                ? t("Approve product", "تأیید کالا")
                : t("Approve price", "تأیید قیمت")
          }
          onConfirm={confirm}
        >
          {preview.decision === "approve" ? (
            <>
              <Field label={t("Apply price to", "اعمال قیمت به")}>
                <select
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as "all" | "branch")
                  }
                >
                  <option value="all">
                    {t("All branches (default)", "همه شعبه‌ها (پیش‌فرض)")}
                  </option>
                  <option value="branch">
                    {t("This branch only", "فقط این شعبه")} —{" "}
                    {branchName(preview.target)}
                  </option>
                </select>
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
              <DataTable>
                <thead>
                  <tr>
                    <th>{t("Branch", "شعبه")}</th>
                    <th>{t("Current → approved", "فعلی ← تأییدشده")}</th>
                    <th>{t("Affected offer", "پیشنهاد مرتبط")}</th>
                    <th>{t("Override removed", "حذف قیمت ویژه")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(scope === "all" ? demoBranches : [preview.target]).map(
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
                            <bdi>
                              {price ? money(price) : "—"} →{" "}
                              {money(preview.approval.proposed_price)}
                            </bdi>
                          </td>
                          <td>
                            {offer
                              ? t(
                                  offer.label,
                                  offer.label.replace("for", "برای"),
                                )
                              : t("None", "ندارد")}
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
