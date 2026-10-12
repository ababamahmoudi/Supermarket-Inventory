import "./date-tracking.css";
import { useState } from "react";
import { companyDate } from "./invoice";
import {
  addTrackedDate,
  allowedDateLocations,
  dateRemovalReasonLabel,
  dateRemovalReasons,
  DateTrackingError,
  dateTrackingErrorMessage,
  nextTrackedDate,
  removeTrackedDate,
  scopedTrackedDates,
  stopProductDateTracking,
  trackedDateDaysLeft,
  validTrackedDate,
  type AddTrackedDateInput,
  type DateRemovalReason,
} from "./date-tracking";
import { DateText, ProductName } from "./presentation";
import { branchLabel } from "./settings";
import { useDemo } from "./store";
import type { Branch } from "./types";
import {
  Badge,
  Button,
  Checkbox,
  DateField,
  Dialog,
  Field,
  NumberField,
  Select,
} from "./ui";

type AddDateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productCode?: string;
  defaultLocation?: Branch;
  onAdded?: (recordId: string, location: Branch) => void;
};

export function AddDateDialog(props: AddDateDialogProps) {
  return props.open ? <AddDateForm {...props} /> : null;
}

function AddDateForm({
  onOpenChange,
  productCode,
  defaultLocation,
  onAdded,
}: AddDateDialogProps) {
  const { state, update, historyContext, branch, lang, t } = useDemo();
  const locations = historyContext
    ? allowedDateLocations(state, historyContext)
    : [];
  const [draft, setDraft] = useState<AddTrackedDateInput>({
    product_code: productCode ?? "",
    branch: locations.includes(defaultLocation ?? branch)
      ? (defaultLocation ?? branch)
      : (locations[0] ?? ""),
    date_type: "expiry",
    date: "",
    quantity: "",
    lot_number: "",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setField = <K extends keyof AddTrackedDateInput>(
    field: K,
    value: AddTrackedDateInput[K],
  ) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };
  const products = state.products.filter(
    (product) =>
      product.company_id === state.config.company.seed_key &&
      product.status !== "archived",
  );
  const save = () => {
    const required: Record<string, string> = {};
    if (!products.some((product) => product.code === draft.product_code))
      required.product_code = dateTrackingErrorMessage(
        new DateTrackingError("product"),
        t,
      );
    if (!locations.includes(draft.branch))
      required.branch = dateTrackingErrorMessage(
        new DateTrackingError("location"),
        t,
      );
    if (!validTrackedDate(draft.date))
      required.date = dateTrackingErrorMessage(
        new DateTrackingError("date"),
        t,
      );
    if (Object.keys(required).length) {
      setErrors(required);
      return;
    }
    try {
      if (!historyContext) throw new DateTrackingError("permission");
      let id = "";
      update((next) => {
        id = addTrackedDate(next, historyContext, draft).id;
      });
      onAdded?.(id, draft.branch);
      onOpenChange(false);
    } catch (error) {
      const code = error instanceof DateTrackingError ? error.code : "scope";
      const field =
        code === "product"
          ? "product_code"
          : code === "location"
            ? "branch"
            : ["date", "date_type", "quantity"].includes(code)
              ? code
              : "form";
      setErrors({ [field]: dateTrackingErrorMessage(error, t) });
    }
  };
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t("Add date", "افزودن تاریخ")}
      className="date-operation-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="date-form-grid">
          <Field
            label={t("Product", "محصول")}
            error={errors.product_code}
            className="date-form-wide"
          >
            <Select
              value={draft.product_code}
              onChange={(value) => setField("product_code", value)}
              searchable
              options={[
                {
                  value: "",
                  label: t("Choose product", "محصول را انتخاب کنید"),
                },
                ...products.map((product) => ({
                  value: product.code,
                  label: `${lang === "fa" ? product.name_fa || product.name_en : product.name_en} · ${lang === "fa" ? product.name_en : product.name_fa} · ${product.code}`,
                })),
              ]}
            />
          </Field>
          <Field label={t("Location", "مکان")} error={errors.branch}>
            <Select
              value={draft.branch}
              onChange={(value) => setField("branch", value)}
              options={locations.map((location) => ({
                value: location,
                label: branchLabel(state.config, location, lang),
              }))}
            />
          </Field>
          <Field label={t("Type", "نوع")} error={errors.date_type}>
            <Select
              value={draft.date_type}
              onChange={(value) =>
                setField("date_type", value as AddTrackedDateInput["date_type"])
              }
              options={[
                { value: "expiry", label: t("Expiry", "انقضا") },
                {
                  value: "best_before",
                  label: t("Best before", "بهترین زمان مصرف"),
                },
              ]}
            />
          </Field>
          <Field label={t("Date", "تاریخ")} error={errors.date}>
            <DateField
              value={draft.date}
              onChange={(value) => setField("date", value)}
            />
          </Field>
          <Field
            label={t("Quantity (optional)", "مقدار (اختیاری)")}
            error={errors.quantity}
            hint={t(
              "Evidence only, not stock on hand.",
              "فقط مدرک است، نه موجودی کالا.",
            )}
          >
            <NumberField
              value={draft.quantity ?? ""}
              onChange={(value) => setField("quantity", value)}
            />
          </Field>
          <Field label={t("Lot (optional)", "سری ساخت (اختیاری)")}>
            <input
              className="ui-input"
              value={draft.lot_number ?? ""}
              onChange={(event) => setField("lot_number", event.target.value)}
            />
          </Field>
          <Field
            label={t("Note (optional)", "یادداشت (اختیاری)")}
            className="date-form-wide"
          >
            <textarea
              className="ui-input"
              rows={3}
              value={draft.note ?? ""}
              onChange={(event) => setField("note", event.target.value)}
            />
          </Field>
        </div>
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="c3-dialog-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel", "لغو")}
          </Button>
          <Button
            type="submit"
            disabled={!historyContext || historyContext.role === "cashier"}
          >
            {t("Add date", "افزودن تاریخ")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function NextTrackedDate({
  productCode,
  className,
}: {
  productCode: string;
  className?: string;
}) {
  const { state, historyContext, lang, t } = useDemo();
  const entry = historyContext
    ? nextTrackedDate(state, historyContext, productCode)
    : undefined;
  if (!entry) return null;
  const days = trackedDateDaysLeft(entry.date, companyDate(state.config));
  const label = (
    <>
      {entry.date_type === "best_before"
        ? t("Best before", "بهترین زمان مصرف")
        : t("Expires", "انقضا")}{" "}
      <DateText value={entry.date} /> ·{" "}
      {branchLabel(state.config, entry.branch, lang)}
    </>
  );
  return (
    <div className={["next-tracked-date", className].filter(Boolean).join(" ")}>
      {days <= state.config.expiry.expiring_soon_days ? (
        <Badge tone={days < 0 ? "danger" : "pending"}>{label}</Badge>
      ) : (
        <span className="muted">{label}</span>
      )}
    </div>
  );
}

type DateActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};
export function RemoveDateDialog(
  props: DateActionDialogProps & { entryId: string },
) {
  return props.open ? <RemoveDateForm {...props} /> : null;
}
function RemoveDateForm({
  entryId,
  onOpenChange,
  onSaved,
}: DateActionDialogProps & { entryId: string }) {
  const { state, update, historyContext, lang, t } = useDemo();
  const entry = historyContext
    ? scopedTrackedDates(state, historyContext, true).find(
        (item) => item.id === entryId,
      )
    : undefined;
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === entry?.product_code,
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t("Remove date", "حذف تاریخ")}
      className="date-operation-dialog date-small-dialog"
    >
      <div className="date-action-summary">
        {product && <ProductName product={product} />}
        {entry && (
          <p>
            <DateText value={entry.date} /> ·{" "}
            {branchLabel(state.config, entry.branch, lang)}
          </p>
        )}
      </div>
      <Field label={t("Reason", "دلیل")} error={error}>
        <Select
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError("");
          }}
          options={[
            { value: "", label: t("Choose reason", "دلیل را انتخاب کنید") },
            ...dateRemovalReasons.map((value) => ({
              value,
              label: dateRemovalReasonLabel(value, t),
            })),
          ]}
        />
      </Field>
      <p className="muted">
        {t(
          "Removing a date does not change stock or supplier balances.",
          "حذف تاریخ موجودی یا مانده تأمین‌کننده را تغییر نمی‌دهد.",
        )}
      </p>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <div className="c3-dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("Cancel", "لغو")}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            try {
              if (!historyContext) throw new DateTrackingError("permission");
              update((draft) =>
                removeTrackedDate(
                  draft,
                  historyContext,
                  entryId,
                  reason as DateRemovalReason,
                ),
              );
              onSaved?.();
              onOpenChange(false);
            } catch (caught) {
              if (
                caught instanceof DateTrackingError &&
                caught.code === "reason"
              )
                setError(dateTrackingErrorMessage(caught, t));
              else setFormError(dateTrackingErrorMessage(caught, t));
            }
          }}
        >
          {t("Remove", "حذف")}
        </Button>
      </div>
    </Dialog>
  );
}

export function StopTrackingDialog(
  props: DateActionDialogProps & { productCode: string },
) {
  return props.open ? <StopTrackingForm {...props} /> : null;
}
function StopTrackingForm({
  productCode,
  onOpenChange,
  onSaved,
}: DateActionDialogProps & { productCode: string }) {
  const { state, update, historyContext, t } = useDemo();
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === productCode,
  );
  const [removeOpen, setRemoveOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t("Stop tracking this product", "توقف پیگیری این محصول")}
      className="date-operation-dialog date-small-dialog"
    >
      {product && (
        <div className="date-action-summary">
          <ProductName product={product} />
        </div>
      )}
      <p>
        {t(
          "Date tracking will be set to No.",
          "پیگیری تاریخ روی خیر تنظیم می‌شود.",
        )}
      </p>
      <Checkbox
        checked={removeOpen}
        onChange={(value) => {
          setRemoveOpen(value);
          setError("");
        }}
      >
        {t("Remove existing open dates", "حذف تاریخ‌های باز موجود")}
      </Checkbox>
      <p className="muted">
        {t(
          "Existing dates stay active unless you choose to remove them.",
          "تاریخ‌های موجود فعال می‌مانند مگر حذف آن‌ها را انتخاب کنید.",
        )}
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="c3-dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("Cancel", "لغو")}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            try {
              if (!historyContext) throw new DateTrackingError("permission");
              update((draft) =>
                stopProductDateTracking(
                  draft,
                  historyContext,
                  productCode,
                  removeOpen,
                ),
              );
              onSaved?.();
              onOpenChange(false);
            } catch (caught) {
              setError(dateTrackingErrorMessage(caught, t));
            }
          }}
        >
          {t("Stop tracking this product", "توقف پیگیری این محصول")}
        </Button>
      </div>
    </Dialog>
  );
}
