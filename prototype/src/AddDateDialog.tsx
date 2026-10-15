import "./date-tracking.css";
import { useState } from "react";
import { companyDate } from "./invoice";
import {
  addTrackedDate,
  dateRemovalReasonLabel,
  dateRemovalReasons,
  DateTrackingError,
  dateTrackingErrorMessage,
  productReminderDays,
  removeTrackedDate,
  stopProductDateTracking,
  trackedDateDaysLeft,
  validTrackedDate,
  type AddTrackedDateInput,
  type DateRemovalReason,
} from "./date-tracking";
import { DateText, ProductName } from "./presentation";
import { branchLabel } from "./settings";
import {
  nextTrackedDateView,
  trackedDateView,
  permittedLocationIdsView,
} from "./notes-dates-read";
import { actorAtLocation } from "./authority";
import { useDemo } from "./store";
import type { Branch } from "./types";
import {
  Badge,
  Button,
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
  const { state, command, historyContext, can, branch, lang, t } = useDemo();
  const locations = permittedLocationIdsView(
    state,
    historyContext,
    can,
    "dates.add",
    { mutation: true },
  );
  const [draft, setDraft] = useState<AddTrackedDateInput>({
    product_code: productCode ?? "",
    branch: locations.includes(defaultLocation ?? branch)
      ? (defaultLocation ?? branch)
      : locations.length === 1
        ? locations[0]
        : "",
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
  const save = async () => {
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
      const id = await command(
        "dates.add",
        {
          company_id: state.config.company.seed_key,
          kind: "location_record",
          location_ids: [draft.branch],
          mutation: true,
        },
        (next, freshActor) =>
          addTrackedDate(
            next,
            actorAtLocation(next, freshActor, draft.branch),
            draft,
          ).id,
      );
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
          <Button type="submit" disabled={!can("dates.add")}>
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
    ? nextTrackedDateView(state, productCode)
    : undefined;
  if (!entry) return null;
  const days = trackedDateDaysLeft(entry.date, companyDate(state.config));
  const product = state.products.find(
    (item) => item.company_id === entry.company_id && item.code === productCode,
  );
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
      {days <= productReminderDays(state, product) ? (
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
  const { state, command, historyContext, lang, t } = useDemo();
  const entry = historyContext
    ? trackedDateView(state, true).find((item) => item.id === entryId)
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
          onClick={async () => {
            try {
              if (!historyContext) throw new DateTrackingError("permission");
              await command(
                "dates.remove",
                {
                  company_id: state.config.company.seed_key,
                  kind: "location_record",
                  location_ids: entry ? [entry.branch] : [],
                  entity_id: entryId,
                  mutation: true,
                  location_policy: "retained_correction",
                },
                (draft, freshActor) =>
                  removeTrackedDate(
                    draft,
                    freshActor,
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
  const { state, command, historyContext, t } = useDemo();
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === productCode,
  );
  const [choice, setChoice] = useState<"keep" | "clear" | "">("");
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
      <Field label={t("Stop tracking", "توقف پیگیری")} error={error}>
        <Select
          value={choice}
          onChange={(value) => {
            setChoice(value as "keep" | "clear");
            setError("");
          }}
          options={[
            {
              value: "",
              label: t(
                "Choose what to do with the dates",
                "انتخاب کنید با تاریخ‌ها چه شود",
              ),
            },
            {
              value: "keep",
              label: t(
                "Stop tracking, keep the date on the product",
                "توقف پیگیری، نگه‌داشتن تاریخ روی محصول",
              ),
            },
            {
              value: "clear",
              label: t(
                "Stop tracking and clear the dates",
                "توقف پیگیری و پاک‌کردن تاریخ‌ها",
              ),
            },
          ]}
        />
      </Field>
      <p className="muted">
        {t(
          "Either choice removes the product from Date tracking and stops reminders. Kept dates remain on Lookup.",
          "هر دو انتخاب محصول را از پیگیری تاریخ حذف می‌کنند و یادآوری را متوقف می‌کنند. تاریخ‌های نگه‌داشته‌شده در جست‌وجو باقی می‌مانند.",
        )}
      </p>
      <div className="c3-dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("Cancel", "لغو")}
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            try {
              if (!historyContext) throw new DateTrackingError("permission");
              if (!choice) throw new DateTrackingError("stop_choice");
              await command(
                "catalog.tracking_preference_edit",
                {
                  company_id: state.config.company.seed_key,
                  kind: "company_shared",
                  mutation: true,
                },
                (draft, freshActor) =>
                  stopProductDateTracking(
                    draft,
                    freshActor,
                    productCode,
                    choice,
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
