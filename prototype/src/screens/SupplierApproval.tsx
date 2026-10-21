import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { branchLabel } from "../settings";
import { useDemo } from "../store";
import { demoUserLabel, LtrText } from "../presentation";
import {
  resolveSupplierApproval,
  supplierApprovalSnapshot,
  missingInvoiceSupplierDetails,
} from "../supplier-editor";
import type { Approval } from "../types";
import { Badge, Button, Card, ConfirmDialog, Menu, MenuItem } from "../ui";
import "./supplier-approval.css";
import "./suppliers-c7.css";
import { SupplierEditor } from "./SupplierEditor";

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
    actor,
    branch,
    can,
    authorityGeneration,
    businessRevision,
    authorityDirectoryVersion,
    locationSelection,
    lang,
    t,
    command,
    query,
    needsReauthentication,
    navigate,
  } = useDemo();
  const [preview, setPreview] = useState<{
    decision: "approve" | "reject";
    snapshot: string;
    key: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const supplier = state.suppliers?.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === approval.supplier_id,
  );
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
    entity_id: approval.id,
  };
  const key = JSON.stringify([
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    authorityGeneration,
    businessRevision,
    authorityDirectoryVersion,
    locationSelection,
    approval.id,
  ]);
  const visiblePreview = preview?.key === key ? preview : null;
  if (
    !actor ||
    !can("suppliers.confirm", scope) ||
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
  const open = async (decision: "approve" | "reject") => {
    if (needsReauthentication("approvals")) {
      navigate("approvals");
      return;
    }
    setError("");
    if (
      decision === "approve" &&
      supplier.invoice_review_required &&
      missingInvoiceSupplierDetails(supplier).length
    ) {
      setEditorOpen(true);
      return;
    }
    setPending(true);
    try {
      const snapshot = await query(
        "suppliers.confirm",
        scope,
        (canonical, currentActor) =>
          supplierApprovalSnapshot(canonical, currentActor, approval.id),
      );
      setPreview({ decision, snapshot, key });
    } catch {
      setError(
        t(
          "Supplier changed. Review the supplier again.",
          "تأمین‌کننده تغییر کرده است. آن را دوباره بررسی کنید.",
        ),
      );
      setPreview(null);
    } finally {
      setPending(false);
    }
  };
  const confirm = async () => {
    if (!visiblePreview || pending) return;
    if (needsReauthentication("approvals")) {
      setPreview(null);
      navigate("approvals");
      return;
    }
    setPending(true);
    try {
      await command("suppliers.confirm", scope, (draft, currentActor) =>
        resolveSupplierApproval(
          draft,
          currentActor,
          approval.id,
          visiblePreview.decision,
          visiblePreview.snapshot,
        ),
      );
      onResolved?.(visiblePreview.decision);
      setPreview(null);
    } catch {
      setError(
        t(
          "Supplier changed. Review the supplier again.",
          "تأمین‌کننده تغییر کرده است. آن را دوباره بررسی کنید.",
        ),
      );
      setPreview(null);
    } finally {
      setPending(false);
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
      <Button
        disabled={pending}
        size={compact ? "sm" : "default"}
        onClick={() => void open("approve")}
      >
        {compact
          ? t("Approve", "تأیید")
          : t("Confirm supplier", "تأیید تأمین‌کننده")}
      </Button>
      {compact ? (
        <Menu
          label={t("More", "بیشتر")}
          icon={<MoreHorizontal size={18} />}
          iconOnly
        >
          <MenuItem
            className="supplier-destructive-action"
            onClick={() => void open("reject")}
          >
            {t("Reject", "رد کردن")}
          </MenuItem>
        </Menu>
      ) : (
        <Button
          disabled={pending}
          variant="destructive"
          onClick={() => void open("reject")}
        >
          {t("Reject", "رد کردن")}
        </Button>
      )}
    </div>
  );
  return (
    <>
      {editorOpen && (
        <SupplierEditor
          supplier={supplier}
          completeForInvoice
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            setError("");
          }}
        />
      )}
      {compact ? (
        <div className="dashboard-queue-row dashboard-supplier-approval list-box">
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
      {visiblePreview && (
        <ConfirmDialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setPreview(null);
          }}
          title={
            visiblePreview.decision === "approve"
              ? t("Confirm supplier", "تأیید تأمین‌کننده")
              : t("Reject proposal", "رد پیشنهاد")
          }
          description={supplier.name}
          confirmLabel={
            visiblePreview.decision === "approve"
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
