import { useState } from "react";
import { branchLabel } from "../settings";
import { useDemo } from "../store";
import { demoUserLabel, LtrText } from "../presentation";
import {
  resolveSupplierApproval,
  supplierApprovalSnapshot,
  supplierRecords,
} from "../supplier-editor";
import type { Approval } from "../types";
import { Badge, Button, Card, ConfirmDialog } from "../ui";
import "./supplier-approval.css";

/** Shared by the approvals page and the dashboard queue; supplier decisions have no price scope. */
export function SupplierApproval({
  approval,
  compact = false,
  onResolved,
}: {
  approval: Approval;
  compact?: boolean;
  onResolved?: (decision: "approve" | "reject") => void;
}) {
  const {
    state,
    role,
    branch,
    user,
    lang,
    t,
    update,
    needsReauthentication,
    navigate,
  } = useDemo();
  const [preview, setPreview] = useState<{
    decision: "approve" | "reject";
    snapshot: string;
  } | null>(null);
  const [error, setError] = useState("");
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === approval.supplier_id,
  );
  if (
    role !== "supervisor" ||
    !user ||
    !supplier ||
    approval.company_id !== state.config.company.seed_key ||
    approval.type !== "new_supplier" ||
    (branch !== "all" &&
      approval.branch !== "all" &&
      approval.branch !== branch)
  )
    return null;
  const details = [
    [t("Phone", "تلفن"), supplier.phone],
    [t("Email", "ایمیل"), supplier.email],
    [t("Sales representative", "نماینده فروش"), supplier.sales_rep_name],
    [t("Sales rep phone", "تلفن نماینده فروش"), supplier.sales_rep_phone],
    [t("Payment terms", "شرایط پرداخت"), supplier.payment_terms],
  ];
  const open = (decision: "approve" | "reject") => {
    if (needsReauthentication("approvals")) {
      navigate("approvals");
      return;
    }
    setError("");
    setPreview({
      decision,
      snapshot: supplierApprovalSnapshot(state, approval.id),
    });
  };
  const confirm = () => {
    if (!preview) return;
    if (needsReauthentication("approvals")) {
      setPreview(null);
      navigate("approvals");
      return;
    }
    try {
      update((draft) =>
        resolveSupplierApproval(
          draft,
          {
            company_id: state.config.company.seed_key,
            branch,
            role,
            actor: user.name,
          },
          approval.id,
          preview.decision,
          preview.snapshot,
        ),
      );
      onResolved?.(preview.decision);
      setPreview(null);
    } catch {
      setError(
        t(
          "Supplier changed. Review the supplier again.",
          "تأمین‌کننده تغییر کرده است. آن را دوباره بررسی کنید.",
        ),
      );
      setPreview(null);
    }
  };
  const status =
    approval.status === "pending"
      ? t("Supplier waiting for confirmation", "تأمین‌کننده در انتظار تأیید")
      : approval.status === "approved"
        ? t("Confirmed", "تأییدشده")
        : t("Rejected", "ردشده");
  const actions = approval.status === "pending" && (
    <div className={`actions${compact ? " dashboard-inline-actions" : ""}`}>
      <Button size={compact ? "sm" : "default"} onClick={() => open("approve")}>
        {compact
          ? t("Approve", "تأیید")
          : t("Confirm supplier", "تأیید تأمین‌کننده")}
      </Button>
      <Button
        size={compact ? "sm" : "default"}
        variant="secondary"
        onClick={() => open("reject")}
      >
        {t("Reject", "رد کردن")}
      </Button>
    </div>
  );
  return (
    <>
      {compact ? (
        <div className="dashboard-queue-row dashboard-supplier-approval">
          <div className="dashboard-queue-product">
            <strong role="heading" aria-level={3} dir="auto">
              {supplier.name}
            </strong>
            <span className="muted">{status}</span>
          </div>
          <Badge tone="pending">{t("Supplier", "تأمین‌کننده")}</Badge>
          <span aria-hidden="true">—</span>
          <span className="dashboard-queue-branch">
            {branchLabel(state.config, approval.branch, lang)}
          </span>
          {actions}
          {error && (
            <p className="banner supplier-approval-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <Card
          className="approval-card supplier-approval-card"
          title={supplier.name}
        >
          <div className="row">
            <Badge
              tone={
                approval.status === "pending"
                  ? "pending"
                  : approval.status === "approved"
                    ? "approved"
                    : "neutral"
              }
            >
              {status}
            </Badge>
            <span>{branchLabel(state.config, approval.branch, lang)}</span>
          </div>
          <dl className="supplier-approval-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ? <LtrText>{value}</LtrText> : "—"}</dd>
              </div>
            ))}
            <div>
              <dt>{t("Triggered by", "ایجادشده توسط")}</dt>
              <dd>
                {demoUserLabel(
                  approval.triggered_by ?? supplier.created_by,
                  lang,
                )}
              </dd>
            </div>
          </dl>
          {error && (
            <p className="banner" role="alert">
              {error}
            </p>
          )}
          {actions}
        </Card>
      )}
      {preview && (
        <ConfirmDialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setPreview(null);
          }}
          title={
            preview.decision === "approve"
              ? t("Confirm supplier", "تأیید تأمین‌کننده")
              : t("Reject proposal", "رد پیشنهاد")
          }
          description={supplier.name}
          confirmLabel={
            preview.decision === "approve"
              ? t("Confirm supplier", "تأیید تأمین‌کننده")
              : t("Reject proposal", "رد پیشنهاد")
          }
          onConfirm={confirm}
        >
          <dl className="supplier-approval-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ? <LtrText>{value}</LtrText> : "—"}</dd>
              </div>
            ))}
          </dl>
        </ConfirmDialog>
      )}
    </>
  );
}
