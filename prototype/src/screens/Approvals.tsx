import { approvalBoard } from "../approval-board";
import { useProtectedQuery } from "../use-protected-query";
import { domainScope } from "../domain-authority";
import {
  branchLabel as configuredBranchLabel,
  branchSellsToCustomers,
  sellingBranches,
} from "../settings";
import { useState } from "react";
import Decimal from "decimal.js";
import {
  approvalSnapshot,
  keepApprovedPrice,
  proposeManualOverride,
  resolveApproval,
} from "../approvals";
import { regularPrice } from "../catalog";
import { ManualPricePill } from "../manual-price-presentation";
import { demoUserLabel, LtrText, ProductName } from "../presentation";
import { ProductCost, ProductPrice } from "../weight-price-presentation";
import "./financial-polish.css";
import { useDemo } from "../store";
import { SupplierApproval } from "./SupplierApproval";
import { ApprovalReviewPanel } from "./ApprovalReviewPanel";
import { SaleRequestCards } from "./SalesApprovals";
import type { Approval, Branch } from "../types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  Tabs,
  NumberField,
} from "../ui";

export function Approvals() {
  const {
    state,
    command,
    query,
    actor,
    can,
    branch,
    lang,
    t,
    authorityGeneration,
    authorityDirectoryVersion,
  } = useDemo();
  const canDecide = can("approvals.decide");
  const boardRead = useProtectedQuery(
    can("approvals.read") ? "approvals.read" : null,
    domainScope(state),
    approvalBoard,
    branch,
  );
  const accessKey = `${authorityGeneration}:${authorityDirectoryVersion}:${actor?.user_id}:${actor?.session_id}:${actor?.authority_epoch}:${branch}`;
  const [filter, setFilter] = useState<Approval["status"]>("pending");
  const [scope, setScope] = useState<"all" | "branch">("all");
  const [regularDecision, setRegularDecision] = useState<"rule" | "keep">(
    "rule",
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({});
  const [overrideErrors, setOverrideErrors] = useState<Record<string, string>>(
    {},
  );
  const [previewState, setPreview] = useState<{
    approval: Approval;
    accessKey: string;
    user_id: string;
    session_id: string;
    decision: "approve" | "reject";
    snapshot: string;
    target: Branch;
    company: string;
    branch: Branch;
  } | null>(null);
  const preview = previewState?.accessKey === accessKey ? previewState : null;
  const company = state.config.company.seed_key;
  const branches = sellingBranches(state.config);
  const viewStatus = canDecide ? filter : "pending";
  const rows = (boardRead.data ?? []).filter(
    (row) => row.approval.status === viewStatus,
  );
  const items = rows.map((row) => row.approval);
  if (!actor || !can("approvals.read"))
    return <EmptyState>{t("Approvals", "تأییدها")}</EmptyState>;
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
  const openPreview = async (
    item: Approval,
    decision: "approve" | "reject",
  ) => {
    if (!canDecide || !actor) return;
    setMessage("");
    setRegularDecision("rule");
    const target = branchSellsToCustomers(state.config, item.branch)
      ? item.branch
      : branchSellsToCustomers(state.config, branch)
        ? branch
        : (branches[0] ?? "all");
    try {
      const source = await query(
        "approvals.decide",
        domainScope(state, item),
        (canonical, actualActor) => ({
          snapshot: approvalSnapshot(canonical, actualActor, item.product_code),
        }),
      );
      setPreview({
        approval: item,
        decision,
        ...source,
        user_id: actor.user_id,
        session_id: actor.session_id,
        target,
        company,
        branch,
        accessKey,
      });
    } catch {
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
    }
  };
  const confirm = async () => {
    if (!preview) return;
    if (
      preview.company !== company ||
      preview.branch !== branch ||
      !canDecide
    ) {
      setPreview(null);
      return;
    }
    try {
      await command(
        "approvals.decide",
        domainScope(state, preview.approval, true),
        (draft, freshActor) => {
          if (
            freshActor.user_id !== preview.user_id ||
            freshActor.session_id !== preview.session_id
          )
            throw new Error("Approval changed. Refresh the preview");
          resolveApproval(
            draft,
            freshActor,
            preview.approval.id,
            preview.decision,
            scope,
            preview.target,
            reasons[preview.approval.id],
            preview.snapshot,
            preview.approval.manual_price_review ? regularDecision : undefined,
          );
        },
      );
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("reason")) {
        setReasonErrors((current) => ({
          ...current,
          [preview.approval.id]: t("Add a reason.", "یک دلیل اضافه کنید."),
        }));
        return;
      }
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
      setPreview(null);
      return;
    }
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
  const marginAction = async (item: Approval, action: "keep" | "override") => {
    if (!canDecide) return;
    const reason = reasons[item.id]?.trim();
    if (!reason) {
      setReasonErrors((current) => ({
        ...current,
        [item.id]: t(
          "Add a reason before keeping the price or proposing an override.",
          "پیش از حفظ قیمت یا پیشنهاد تغییر دستی، دلیل را وارد کنید.",
        ),
      }));
      return;
    }
    const amount = overrides[item.id] ?? "";
    if (action === "override" && !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setOverrideErrors((current) => ({
        ...current,
        [item.id]: t(
          "Enter a nonnegative override price with at most two decimals.",
          "قیمت دستی غیرمنفی را با حداکثر دو رقم اعشار وارد کنید.",
        ),
      }));
      return;
    }
    try {
      await command(
        "approvals.decide",
        domainScope(state, item, true),
        (draft, freshActor) =>
          action === "keep"
            ? keepApprovedPrice(draft, freshActor, item.id, reason)
            : void proposeManualOverride(
                draft,
                freshActor,
                item.id,
                amount,
                reason,
              ),
      );
    } catch {
      setMessage(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
      return;
    }
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
        value={viewStatus}
        aria-label={t("Approval status", "وضعیت تأیید")}
        onChange={(value) => {
          setFilter(value as typeof filter);
          setMessage("");
        }}
        options={
          canDecide
            ? [
                { value: "pending", label: t("Pending", "در انتظار") },
                { value: "approved", label: t("Approved", "تأییدشده") },
                { value: "rejected", label: t("Rejected", "ردشده") },
                { value: "superseded", label: t("Superseded", "جایگزین‌شده") },
              ]
            : [{ value: "pending", label: t("Pending", "در انتظار") }]
        }
      />
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {viewStatus === "pending" && <SaleRequestCards />}
      {items.length === 0 &&
        !(
          viewStatus === "pending" &&
          (state.sale_requests ?? []).some(
            (request) =>
              request.company_id === company &&
              request.status === "pending" &&
              (branch === "all" || request.branch === branch),
          )
        ) && (
          <EmptyState>
            {t(
              "No approvals in this view. Receive an invoice to create a proposal.",
              "در این نما تأییدی وجود ندارد. برای ایجاد پیشنهاد، یک فاکتور دریافت کنید.",
            )}
          </EmptyState>
        )}
      {items.map((item) => {
        if (item.type === "new_supplier")
          return canDecide ? (
            <SupplierApproval key={item.id} approval={item} />
          ) : (
            <Card key={item.id} title={item.supplier_name}>
              {t(
                "Supplier waiting for confirmation",
                "تأمین‌کننده در انتظار تأیید",
              )}
            </Card>
          );
        const product = state.products.find(
          (value) =>
            value.company_id === company && value.code === item.product_code,
        );
        if (!product) return null;
        const approved =
          "current_price" in item
            ? item.current_price
            : regularPrice(state, product, item.branch);
        const details = rows.find((row) => row.approval.id === item.id)!;
        const { unitCost, margin, triggeredBy } = details;
        const invoiceNumber = details.invoiceNumber;

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
                    : item.status === "superseded"
                      ? t("Superseded", "جایگزین‌شده")
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
                      <ProductPrice
                        value={approved}
                        product={product}
                        config={state.config}
                      />
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
                    <ProductPrice
                      value={item.proposed_price}
                      product={product}
                      config={state.config}
                    />
                  </strong>
                </div>
                {canDecide && (
                  <>
                    <div className="approval-value">
                      <span className="muted">
                        {t("Unit cost", "هزینه واحد")}
                      </span>
                      <strong>
                        {unitCost !== null && unitCost !== undefined ? (
                          <ProductCost
                            value={unitCost}
                            product={product}
                            config={state.config}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
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
                  </>
                )}
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
              {canDecide && item.threshold && (
                <span>
                  {t("Minimum margin", "حداقل حاشیه سود")}:{" "}
                  <bdi dir="ltr">
                    {new Decimal(item.threshold).times(100).toFixed(2)}%
                  </bdi>
                </span>
              )}
            </div>
            {canDecide && item.manual_override && (
              <p>
                {t("Reason", "دلیل")}: {item.reason}
              </p>
            )}
            {invoiceNumber && (
              <p className="muted">
                {t("Invoice", "فاکتور")}: <bdi dir="ltr">{invoiceNumber}</bdi>
              </p>
            )}
            {canDecide &&
              item.status === "pending" &&
              item.type === "margin_review" && (
                <>
                  <p className="muted">
                    {t(
                      "Receiving continues. Keep this price with a reason, propose an override, or leave the review pending.",
                      "دریافت کالا ادامه دارد. قیمت را با دلیل حفظ کنید، تغییر دستی پیشنهاد دهید یا بررسی را در انتظار بگذارید.",
                    )}
                  </p>
                  <div className="form-grid approval-form">
                    <Field
                      label={t("Reason", "دلیل")}
                      error={reasonErrors[item.id]}
                    >
                      <input
                        value={reasons[item.id] ?? ""}
                        onChange={(event) => {
                          setReasons({
                            ...reasons,
                            [item.id]: event.target.value,
                          });
                          setReasonErrors((current) => ({
                            ...current,
                            [item.id]: "",
                          }));
                        }}
                      />
                    </Field>
                    <Field
                      label={t("Manual override price", "قیمت دستی")}
                      error={overrideErrors[item.id]}
                    >
                      <NumberField
                        value={overrides[item.id] ?? ""}
                        onChange={(value) => {
                          setOverrides({ ...overrides, [item.id]: value });
                          setOverrideErrors((current) => ({
                            ...current,
                            [item.id]: "",
                          }));
                        }}
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
            {canDecide &&
              item.status === "pending" &&
              item.type !== "margin_review" && (
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
                    variant="danger"
                    onClick={() => openPreview(item, "reject")}
                  >
                    {t("Reject", "رد کردن")}
                  </Button>
                </div>
              )}
            {canDecide && item.acknowledgment_reason && (
              <p>
                {t("Review reason", "دلیل بررسی")}: {item.acknowledgment_reason}
              </p>
            )}
            {item.applies_after_sale && (
              <Badge tone="info">
                {t("Applies after the sale", "پس از حراج اعمال می‌شود")}
              </Badge>
            )}
          </Card>
        );
      })}
      {canDecide && preview && (
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
          confirmVariant={preview.decision === "reject" ? "danger" : "primary"}
          confirmDisabled={
            preview.decision === "approve" &&
            preview.approval.type !== "barcode_conflict" &&
            !branches.length
          }
        >
          {preview.approval.type !== "barcode_conflict" && (
            <ApprovalReviewPanel
              approval={preview.approval}
              scope={scope}
              target={preview.target}
              onScopeChange={setScope}
              showEffects={preview.decision === "approve"}
              regularDecision={regularDecision}
              onRegularDecisionChange={(decision) => {
                setRegularDecision(decision);
                if (decision === "keep") setScope("branch");
                setReasonErrors((current) => ({
                  ...current,
                  [preview.approval.id]: "",
                }));
              }}
              regularReason={reasons[preview.approval.id] ?? ""}
              regularReasonError={reasonErrors[preview.approval.id]}
              onRegularReasonChange={(reason) => {
                setReasons((current) => ({
                  ...current,
                  [preview.approval.id]: reason,
                }));
                setReasonErrors((current) => ({
                  ...current,
                  [preview.approval.id]: "",
                }));
              }}
            />
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

export default Approvals;
