import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { discardInvoice, invoiceDiscardRead } from "../invoice-discard";
import { clearLiveReadingActive } from "../live-reading-activity";
import { useDemo } from "../store";
import type { InvoiceReadDTO } from "../invoice-projections";
import {
  Button,
  Dialog,
  DialogActions,
  Field,
  Menu,
  MenuItem,
  AutoTextarea,
} from "../ui";

/** The domain rechecks identity, current authority, version and real emptiness. */
export function DiscardInvoice({
  invoice,
  menu = false,
  onDiscarded,
}: {
  invoice: InvoiceReadDTO;
  menu?: boolean;
  onDiscarded?(): void;
}) {
  const { query, command, can, t } = useDemo();
  const [confirmation, setConfirmation] = useState<{ version: number } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (invoice.status === "posted" || invoice.status === "cancelled")
    return null;
  const scope = {
    company_id: invoice.company_id,
    kind: "location_record" as const,
    location_ids: [invoice.branch],
    entity_id: invoice.id,
    mutation: true,
    status: invoice.status,
    owner_user_id: invoice.created_by_user_id,
    handling_user_ids: [
      ...(invoice.handler_user_ids ?? []),
      ...(invoice.reviewer_user_ids ?? []),
    ],
    invoice_reviewer_origin_location_id:
      invoice.reviewer_origin_location_id ?? invoice.branch,
  };
  if (!can("invoices.edit", scope)) return null;
  const commit = async (version: number, why: string) => {
    setPending(true);
    setError("");
    try {
      const result = await command("invoices.edit", scope, (draft, actor) =>
        discardInvoice(draft, actor, {
          invoice_id: invoice.id,
          expected_version: version,
          reason: why,
        }),
      );
      clearLiveReadingActive(invoice.company_id, invoice.id, result.attempt_id);
      setConfirmation(null);
      onDiscarded?.();
    } catch {
      setError(
        t(
          "Could not discard this invoice. Add a reason and check that it has not changed.",
          "فاکتور کنار گذاشته نشد. دلیل را وارد کنید و مطمئن شوید فاکتور تغییر نکرده است.",
        ),
      );
    } finally {
      setPending(false);
    }
  };
  const begin = async () => {
    setError("");
    try {
      const preview = await query("invoices.edit", scope, (draft, actor) =>
        invoiceDiscardRead(draft, actor, invoice.id),
      );
      if (preview.empty) await commit(preview.version, "");
      else {
        setReason("");
        setConfirmation({ version: preview.version });
      }
    } catch {
      setError(
        t(
          "This invoice cannot be discarded. Check access and open it again.",
          "این فاکتور قابل کنار گذاشتن نیست. دسترسی را بررسی و دوباره باز کنید.",
        ),
      );
    }
  };
  return (
    <>
      {menu ? (
        <Menu
          label={t("More", "بیشتر")}
          icon={<MoreHorizontal size={18} />}
          iconOnly
          showChevron={false}
        >
          <MenuItem onClick={() => void begin()}>
            {t("Discard invoice", "کنار گذاشتن فاکتور")}
          </MenuItem>
        </Menu>
      ) : (
        <Button
          variant="neutral"
          disabled={pending}
          onClick={() => void begin()}
        >
          {t("Discard invoice", "کنار گذاشتن فاکتور")}
        </Button>
      )}
      {error && !confirmation && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(null);
        }}
        title={t("Discard invoice?", "فاکتور کنار گذاشته شود؟")}
        description={t(
          "The invoice moves to Cancelled. Its original and history are kept. You can Undo this action.",
          "فاکتور به لغوشده منتقل می‌شود. اصل فایل و تاریخچه حفظ می‌شوند و می‌توانید این کار را برگردانید.",
        )}
      >
        <Field label={t("Reason", "دلیل")} error={error}>
          <AutoTextarea
            id={`discard-reason-${invoice.id}`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
            disabled={pending}
          />
        </Field>
        <DialogActions>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirmation(null)}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!reason.trim())
                setError(t("Add a reason.", "یک دلیل اضافه کنید."));
              else if (confirmation) void commit(confirmation.version, reason);
            }}
          >
            {t("Discard invoice", "کنار گذاشتن فاکتور")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
