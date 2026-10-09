import { useState } from "react";
import { Plus, Archive, RotateCcw, Pencil } from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Select,
} from "../ui";
import { demoUserLabel, LtrText } from "../presentation";
import { companyTimestamp } from "../operations";
import {
  archiveNotebook,
  createNotebook,
  editNotebook,
  newNotebookInput,
  notebookError,
  visibleNotebooks,
  type NotebookDefinition,
  type NotebookInput,
  type NotebookContext,
} from "../notebooks";
import type { Role } from "../types";
import { branchId, branchLabel } from "../settings";
import "./notebooks-b.css";

export function NotebookEditor({
  notebook,
  onOpenChange,
  onSaved,
}: {
  notebook: NotebookDefinition | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const { state, update, role, user, branch, lang, t } = useDemo();
  const [form, setForm] = useState<NotebookInput>(() =>
    notebook ? structuredClone(notebook) : newNotebookInput(),
  );
  const [error, setError] = useState("");
  const context: NotebookContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? "",
  };
  const field = <K extends keyof NotebookInput>(
    key: K,
    value: NotebookInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const labels: Record<Role, string> = {
    supervisor: t("Supervisor", "سرپرست"),
    floor_worker: t("Floor Worker", "کارمند فروشگاه"),
    cashier: t("Cashier", "صندوق‌دار"),
  };
  const toggleRole = (
    kind: "read_roles" | "add_roles",
    value: Role,
    checked: boolean,
  ) =>
    setForm((current) => {
      const chosen = checked
        ? [...current[kind], value]
        : current[kind].filter((item) => item !== value);
      return {
        ...current,
        [kind]: chosen,
        ...(kind === "read_roles" && !checked
          ? { add_roles: current.add_roles.filter((item) => item !== value) }
          : {}),
        ...(kind === "add_roles" && checked
          ? { read_roles: [...new Set([...current.read_roles, value])] }
          : {}),
      };
    });
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={
        notebook
          ? t("Edit notebook", "ویرایش دفترچه")
          : t("New notebook", "دفترچه جدید")
      }
      className="notebook-editor-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            let id = notebook?.id ?? "";
            update((draft) => {
              if (notebook) editNotebook(draft, context, notebook.id, form);
              else id = createNotebook(draft, context, form).id;
            });
            onSaved?.(id);
            onOpenChange(false);
          } catch (caught) {
            setError(notebookError(caught, t));
          }
        }}
      >
        <div className="form-grid notebook-definition-fields">
          <Field label={t("Name (English)", "نام (انگلیسی)")}>
            <input
              dir="ltr"
              value={form.name_en}
              onChange={(event) => field("name_en", event.target.value)}
              autoFocus
            />
          </Field>
          <Field label={t("Name (Persian)", "نام (فارسی)")}>
            <input
              dir="rtl"
              value={form.name_fa}
              onChange={(event) => field("name_fa", event.target.value)}
            />
          </Field>
          <Field label={t("Branch", "شعبه")}>
            <Select
              value={form.branch}
              onChange={(value) => field("branch", value)}
              options={[
                { value: "all", label: t("All branches", "همه شعبه‌ها") },
                ...state.config.branches.map((item) => ({
                  value: branchId(item),
                  label:
                    lang === "fa"
                      ? item.name_fa
                      : item.name_en.replace(/ \(PLACEHOLDER.*$/, ""),
                })),
              ]}
            />
          </Field>
        </div>
        <div className="notebook-permission-grid">
          <fieldset>
            <legend>{t("Who can read", "چه کسی می‌تواند بخواند")}</legend>
            {(["supervisor", "floor_worker", "cashier"] as Role[]).map(
              (item) => (
                <Checkbox
                  key={item}
                  checked={form.read_roles.includes(item)}
                  disabled={item === "supervisor"}
                  onChange={(checked) =>
                    toggleRole("read_roles", item, checked)
                  }
                >
                  {labels[item]}
                </Checkbox>
              ),
            )}
          </fieldset>
          <fieldset>
            <legend>{t("Who can add", "چه کسی می‌تواند اضافه کند")}</legend>
            {(["supervisor", "floor_worker", "cashier"] as Role[]).map(
              (item) => (
                <Checkbox
                  key={item}
                  checked={form.add_roles.includes(item)}
                  disabled={item === "supervisor"}
                  onChange={(checked) => toggleRole("add_roles", item, checked)}
                >
                  {labels[item]}
                </Checkbox>
              ),
            )}
          </fieldset>
        </div>
        <fieldset className="notebook-field-options">
          <legend>{t("Entry fields", "فیلدهای یادداشت")}</legend>
          {(["product", "quantity", "date", "measurement"] as const).map(
            (item) => (
              <Checkbox
                key={item}
                checked={form.fields[item]}
                onChange={(checked) =>
                  field("fields", { ...form.fields, [item]: checked })
                }
              >
                {item === "product"
                  ? t("Product", "کالا")
                  : item === "quantity"
                    ? t("Quantity", "تعداد")
                    : item === "date"
                      ? t("Date", "تاریخ")
                      : t("Measurement", "اندازه‌گیری")}
              </Checkbox>
            ),
          )}
        </fieldset>
        {form.fields.measurement && (
          <Field
            label={t("Measurement unit", "واحد اندازه‌گیری")}
            className="field-short"
          >
            <input
              value={form.fields.measurement_unit}
              placeholder="°C"
              onChange={(event) =>
                field("fields", {
                  ...form.fields,
                  measurement_unit: event.target.value,
                })
              }
            />
          </Field>
        )}
        <div className="notebook-behavior-options">
          <Checkbox
            checked={form.status_enabled}
            onChange={(value) => field("status_enabled", value)}
          >
            {t("Use Open / Done statuses", "استفاده از وضعیت باز / انجام‌شده")}
          </Checkbox>
          <Checkbox
            checked={form.notify_supervisor}
            onChange={(value) => field("notify_supervisor", value)}
          >
            {t("Notify Supervisor", "اطلاع به سرپرست")}
          </Checkbox>
        </div>
        {error && (
          <p className="banner danger" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit">{t("Save notebook", "ذخیره دفترچه")}</Button>
        </div>
      </form>
    </Dialog>
  );
}
export function NotebookSettings() {
  const { state, update, branch, role, user, lang, t } = useDemo();
  const [editor, setEditor] = useState<NotebookDefinition | "new" | null>(null);
  const [archive, setArchive] = useState<NotebookDefinition | null>(null);
  const [error, setError] = useState("");
  const context: NotebookContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? "",
  };
  const records = visibleNotebooks(state, context, { includeArchived: true });
  if (role !== "supervisor")
    return (
      <EmptyState>
        {t(
          "Only the Supervisor can change notebook settings.",
          "فقط سرپرست می‌تواند تنظیمات دفترچه را تغییر دهد.",
        )}
      </EmptyState>
    );
  return (
    <div className="notebook-settings">
      <Card>
        <div className="row-between">
          <h2>{t("Notebooks", "دفترچه‌ها")}</h2>
          <Button onClick={() => setEditor("new")}>
            <Plus size={16} aria-hidden="true" />
            {t("New notebook", "دفترچه جدید")}
          </Button>
        </div>
        <p className="muted">
          {t(
            "Choose each notebook's branches, readers, contributors and entry fields.",
            "شعبه‌ها، خوانندگان، نویسندگان و فیلدهای هر دفترچه را انتخاب کنید.",
          )}
        </p>
        {error && (
          <p className="banner danger" role="alert">
            {error}
          </p>
        )}
        {!records.length && (
          <EmptyState>
            {t(
              "No custom notebooks. Create a notebook for the team.",
              "دفترچه سفارشی وجود ندارد. یک دفترچه برای تیم ایجاد کنید.",
            )}
          </EmptyState>
        )}
        <div className="notebook-definition-list">
          {records.map((item) => (
            <article key={item.id} className="notebook-definition-row">
              <div>
                <strong>
                  <bdi dir="auto">
                    {lang === "fa" ? item.name_fa : item.name_en}
                  </bdi>
                </strong>
                <p className="muted">
                  {item.branch === "all"
                    ? t("All branches", "همه شعبه‌ها")
                    : branchLabel(state.config, item.branch, lang)}{" "}
                  ·{" "}
                  {item.read_roles
                    .map((value) =>
                      value === "supervisor"
                        ? t("Supervisor", "سرپرست")
                        : value === "floor_worker"
                          ? t("Floor Worker", "کارمند فروشگاه")
                          : t("Cashier", "صندوق‌دار"),
                    )
                    .join(" · ")}
                </p>
                <small className="muted">
                  {t("Changed by", "تغییریافته توسط")}{" "}
                  {demoUserLabel(item.by, lang)} ·{" "}
                  <LtrText>
                    {companyTimestamp(state.config, item.updated_at)}
                  </LtrText>{" "}
                  ·{" "}
                  <a href={`#history?item=${encodeURIComponent(item.id)}`}>
                    {t("History", "تاریخچه")}
                  </a>
                </small>
              </div>
              <div className="actions">
                <Badge tone={item.archived ? "neutral" : "approved"}>
                  {item.archived
                    ? t("Archived", "بایگانی‌شده")
                    : t("Active", "فعال")}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditor(item)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  {t("Edit notebook", "ویرایش دفترچه")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!item.archived) {
                      setArchive(item);
                      return;
                    }
                    try {
                      update((draft) =>
                        archiveNotebook(draft, context, item.id, false),
                      );
                      setError("");
                    } catch (caught) {
                      setError(notebookError(caught, t));
                    }
                  }}
                >
                  {item.archived ? (
                    <RotateCcw size={14} aria-hidden="true" />
                  ) : (
                    <Archive size={14} aria-hidden="true" />
                  )}
                  {item.archived
                    ? t("Restore notebook", "بازیابی دفترچه")
                    : t("Archive notebook", "بایگانی دفترچه")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Card>
      {editor && (
        <NotebookEditor
          key={editor === "new" ? "new" : editor.id}
          notebook={editor === "new" ? null : editor}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(archive)}
        onOpenChange={(open) => {
          if (!open) setArchive(null);
        }}
        title={t("Archive notebook", "بایگانی دفترچه")}
        description={t(
          "Keep its entries searchable. Restore the notebook whenever the team needs it again.",
          "یادداشت‌ها قابل جستجو می‌مانند. هر زمان تیم دوباره نیاز داشت، دفترچه را بازیابی کنید.",
        )}
        confirmLabel={t("Archive notebook", "بایگانی دفترچه")}
        onConfirm={() => {
          if (!archive) return;
          try {
            update((draft) => archiveNotebook(draft, context, archive.id));
            setArchive(null);
            setError("");
          } catch (caught) {
            setError(notebookError(caught, t));
          }
        }}
      />
    </div>
  );
}
export default NotebookSettings;
