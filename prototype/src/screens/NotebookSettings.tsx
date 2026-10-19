import { useState } from "react";
import { Plus, Archive, RotateCcw, Pencil, MoreHorizontal } from "lucide-react";
import { useDemo } from "../store";
import { WhatsMissing } from "../WhatsMissing";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  Radio,
  Select,
  Menu,
  MenuItem,
} from "../ui";
import { DateText, demoUserLabel, LtrText } from "../presentation";
import { companyTimestamp } from "../operations";
import {
  archiveNotebook,
  createNotebook,
  editNotebook,
  newNotebookInput,
  notebookError,
  NotebookError,
  saveBuiltInNoteDoneRule,
  type NotebookDefinition,
  type NotebookInput,
} from "../notebooks";
import type { NoteDoneRule } from "../note-engagement";
import type { Role } from "../types";
import { visibleNotebookView } from "../notes-dates-read";
import { configuredRoleLabel } from "../role-config";
import { branchId, branchLabel } from "../settings";
import "./notebooks-b.css";

/** Shared "Who can mark notes done" choice for notebooks and built-in notes. */
export function DoneRuleFields({
  value,
  onChange,
  error,
}: {
  value: NoteDoneRule | undefined;
  onChange: (value: NoteDoneRule | undefined) => void;
  error?: string;
}) {
  const { state, demoUsers, lang, t } = useDemo();
  const chosen = value?.mode === "chosen";
  const rule: NoteDoneRule = value ?? {
    mode: "chosen",
    roles: [],
    user_ids: [],
  };
  const configuredRoles = state.config.roles.map((item) => item.key);
  const toggle = <K extends "roles" | "user_ids">(
    key: K,
    item: NoteDoneRule[K][number],
    checked: boolean,
  ) =>
    onChange({
      ...rule,
      mode: "chosen",
      [key]: checked
        ? [...new Set([...(rule[key] as string[]), item])]
        : (rule[key] as string[]).filter((entry) => entry !== item),
    });
  return (
    <fieldset className="done-rule-fields" id="notebook-done-rule">
      <legend>
        {t("Who can mark notes done", "چه کسی می‌تواند انجام‌شده علامت بزند")}
      </legend>
      <div role="radiogroup" className="done-rule-modes">
        <Radio checked={!chosen} onChange={() => onChange(undefined)}>
          {t(
            "Anyone who can add notes",
            "هر کسی که می‌تواند یادداشت اضافه کند",
          )}
        </Radio>
        <Radio
          checked={chosen}
          onChange={() =>
            onChange({
              mode: "chosen",
              roles: rule.roles,
              user_ids: rule.user_ids,
            })
          }
        >
          {t(
            "Only the roles and people I choose",
            "فقط نقش‌ها و افرادی که انتخاب می‌کنم",
          )}
        </Radio>
      </div>
      {chosen && (
        <div className="done-rule-choices">
          <div>
            <p className="helper">{t("Roles", "نقش‌ها")}</p>
            {configuredRoles.map((role) => (
              <Checkbox
                key={role}
                checked={rule.roles.includes(role)}
                onChange={(checked) => toggle("roles", role, checked)}
              >
                {configuredRoleLabel(state.config.roles, role, lang)}
              </Checkbox>
            ))}
          </div>
          <div>
            <p className="helper">{t("People", "افراد")}</p>
            {demoUsers.map((person) => (
              <Checkbox
                key={person.id}
                checked={rule.user_ids.includes(person.id)}
                onChange={(checked) => toggle("user_ids", person.id, checked)}
              >
                {demoUserLabel(person.name, lang)}{" "}
                <span className="muted">
                  · {configuredRoleLabel(state.config.roles, person.role, lang)}
                </span>
              </Checkbox>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
/** Owners and Managers choose who may mark a built-in notebook's notes done. */
export function BuiltInNoteSettings({
  kind,
  title,
  onOpenChange,
}: {
  kind: string;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, command, t } = useDemo();
  const current = state.config.notebooks?.built_in?.find(
    (item) => item.kind === kind,
  )?.done_rule;
  const [rule, setRule] = useState<NoteDoneRule | undefined>(() =>
    current ? structuredClone(current) : undefined,
  );
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t("Notebook settings", "تنظیمات دفترچه")}
      description={title}
      className="notebook-editor-dialog"
    >
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await command(
              "notebooks.definition_manage",
              {
                company_id: state.config.company.seed_key,
                kind: "company_shared",
                mutation: true,
              },
              (draft, freshActor) =>
                saveBuiltInNoteDoneRule(draft, freshActor, kind, rule),
            );
            onOpenChange(false);
          } catch (caught) {
            setError(notebookError(caught, t, state.config));
          }
        }}
      >
        <DoneRuleFields
          value={rule}
          onChange={(value) => {
            setRule(value);
            setError("");
          }}
          error={error}
        />
        <DialogActions>
          <Button
            type="button"
            variant="neutral"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit">{t("Save settings", "ذخیره تنظیمات")}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
export function NotebookEditor({
  notebook,
  onOpenChange,
  onSaved,
}: {
  notebook: NotebookDefinition | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const { state, command, lang, t } = useDemo();
  const [form, setForm] = useState<NotebookInput>(() =>
    notebook ? structuredClone(notebook) : newNotebookInput(),
  );
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const field = <K extends keyof NotebookInput>(
    key: K,
    value: NotebookInput[K],
  ) => {
    if (
      (errorField === "name" && key === "name_en") ||
      (errorField === "duplicate" &&
        (key === "name_en" || key === "name_fa")) ||
      (errorField === "unit" && key === "fields") ||
      (["branch", "location_unavailable"].includes(errorField) &&
        key === "branch") ||
      (errorField === "roles" && (key === "read_roles" || key === "add_roles"))
    ) {
      setError("");
      setErrorField("");
    }
    setForm((current) => ({ ...current, [key]: value }));
  };
  const configuredRoles = state.config.roles.map(
    (definition) => definition.key,
  );
  const labels = Object.fromEntries(
    configuredRoles.map((role) => [
      role,
      configuredRoleLabel(state.config.roles, role, lang),
    ]),
  );
  const toggleRole = (
    kind: "read_roles" | "add_roles",
    value: Role,
    checked: boolean,
  ) => {
    if (errorField === "roles") {
      setError("");
      setErrorField("");
    }
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
  };
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
      description={
        notebook
          ? lang === "fa"
            ? notebook.name_fa
            : notebook.name_en
          : t(
              "Custom notebooks, permissions and entry fields.",
              "دفترهای سفارشی، مجوزها و فیلدهای ثبت یادداشت.",
            )
      }
    >
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            let id = notebook?.id ?? "";
            id = await command(
              "notebooks.definition_manage",
              {
                company_id: state.config.company.seed_key,
                kind: "company_shared",
                mutation: true,
              },
              (draft, freshActor) => {
                if (notebook) {
                  editNotebook(draft, freshActor, notebook.id, form);
                  return notebook.id;
                }
                return createNotebook(draft, freshActor, form).id;
              },
            );
            onSaved?.(id);
            onOpenChange(false);
          } catch (caught) {
            setError(notebookError(caught, t, state.config));
            setErrorField(
              caught instanceof NotebookError ? caught.key : "scope",
            );
          }
        }}
      >
        <WhatsMissing
          issues={
            error
              ? [
                  {
                    id: errorField,
                    message: error,
                    fieldId:
                      errorField === "branch"
                        ? "notebook-branch"
                        : errorField === "unit"
                          ? "notebook-unit"
                          : errorField === "roles"
                            ? "notebook-roles"
                            : "notebook-name",
                  },
                ]
              : []
          }
        />
        <div className="form-grid notebook-definition-fields">
          <Field
            label={t("Name (English)", "نام (انگلیسی)")}
            error={
              errorField === "duplicate" ||
              (errorField === "name" && !form.name_en.trim())
                ? error
                : undefined
            }
          >
            <input
              id="notebook-name"
              dir="ltr"
              value={form.name_en}
              onChange={(event) => field("name_en", event.target.value)}
              autoFocus
            />
          </Field>
          <Field
            label={t("Name (Persian) (optional)", "نام (فارسی) (اختیاری)")}
          >
            <input
              dir="rtl"
              value={form.name_fa}
              onChange={(event) => field("name_fa", event.target.value)}
            />
          </Field>
          <Field
            label={t("Branch", "شعبه")}
            error={errorField === "branch" ? error : undefined}
          >
            <Select
              id="notebook-branch"
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
        <div
          id="notebook-roles"
          tabIndex={-1}
          className="notebook-permission-grid"
        >
          <fieldset>
            <legend>{t("Who can read", "چه کسی می‌تواند بخواند")}</legend>
            {configuredRoles.map((item) => (
              <Checkbox
                key={item}
                checked={form.read_roles.includes(item)}
                disabled={item === "owner" || item === "manager"}
                onChange={(checked) => toggleRole("read_roles", item, checked)}
              >
                {labels[item]}
              </Checkbox>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t("Who can add", "چه کسی می‌تواند اضافه کند")}</legend>
            {configuredRoles.map((item) => (
              <Checkbox
                key={item}
                checked={form.add_roles.includes(item)}
                disabled={item === "owner" || item === "manager"}
                onChange={(checked) => toggleRole("add_roles", item, checked)}
              >
                {labels[item]}
              </Checkbox>
            ))}
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
            error={errorField === "unit" ? error : undefined}
            className="field-short"
          >
            <input
              id="notebook-unit"
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
            {t(
              `Notify ${["owner", "manager", "branch_supervisor"].map((role) => configuredRoleLabel(state.config.roles, role as Role, "en")).join(" / ")}`,
              `اطلاع به ${["owner", "manager", "branch_supervisor"].map((role) => configuredRoleLabel(state.config.roles, role as Role, "fa")).join(" / ")}`,
            )}
          </Checkbox>
        </div>
        {form.status_enabled && (
          <DoneRuleFields
            value={form.done_rule}
            onChange={(value) => {
              if (errorField === "done_rule") {
                setError("");
                setErrorField("");
              }
              setForm((current) => ({ ...current, done_rule: value }));
            }}
            error={errorField === "done_rule" ? error : undefined}
          />
        )}
        {error &&
          !["name", "duplicate", "branch", "unit", "done_rule"].includes(
            errorField,
          ) && (
            <p className="banner danger" role="alert">
              {error}
            </p>
          )}
        <DialogActions>
          <Button
            type="button"
            variant="neutral"
            onClick={() => onOpenChange(false)}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit">{t("Save notebook", "ذخیره دفترچه")}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
export function NotebookSettings() {
  const { state, command, can, lang, t } = useDemo();
  const [editor, setEditor] = useState<NotebookDefinition | "new" | null>(null);
  const [archive, setArchive] = useState<NotebookDefinition | null>(null);
  const [error, setError] = useState("");
  const records = visibleNotebookView(state, { includeArchived: true });
  if (!can("notebooks.definition_manage"))
    return (
      <EmptyState>
        {t(
          `Only an ${configuredRoleLabel(state.config.roles, "owner", "en")} or ${configuredRoleLabel(state.config.roles, "manager", "en")} can change notebook settings.`,
          `فقط ${configuredRoleLabel(state.config.roles, "owner", "fa")} یا ${configuredRoleLabel(state.config.roles, "manager", "fa")} می‌تواند تنظیمات دفترچه را تغییر دهد.`,
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
                    {lang === "fa"
                      ? item.name_fa || item.name_en
                      : item.name_en}
                  </bdi>
                </strong>
                <p className="muted">
                  {item.branch === "all"
                    ? t("All branches", "همه شعبه‌ها")
                    : branchLabel(state.config, item.branch, lang)}{" "}
                  ·{" "}
                  {item.read_roles
                    .map((value) =>
                      configuredRoleLabel(state.config.roles, value, lang),
                    )
                    .join(" · ")}
                </p>
                <small className="muted">
                  {t("Changed by", "تغییریافته توسط")}{" "}
                  {demoUserLabel(item.by, lang)} ·{" "}
                  <DateText value={item.updated_at} />{" "}
                  <LtrText>
                    {
                      companyTimestamp(state.config, item.updated_at).split(
                        " ",
                      )[1]
                    }
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
                  variant="neutral"
                  size="sm"
                  onClick={() => setEditor(item)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  {t("Edit notebook", "ویرایش دفترچه")}
                </Button>
                <Menu
                  label={t("More actions", "کارهای بیشتر")}
                  icon={<MoreHorizontal size={18} aria-hidden="true" />}
                  iconOnly
                >
                  <MenuItem
                    className={item.archived ? undefined : "menu-item-danger"}
                    onClick={async () => {
                      if (!item.archived) {
                        setArchive(item);
                        return;
                      }
                      try {
                        await command(
                          "notebooks.definition_manage",
                          {
                            company_id: item.company_id,
                            kind: "company_shared",
                            mutation: true,
                          },
                          (draft, freshActor) =>
                            archiveNotebook(draft, freshActor, item.id, false),
                        );
                        setError("");
                      } catch (caught) {
                        setError(notebookError(caught, t, state.config));
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
                  </MenuItem>
                </Menu>
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
        onConfirm={async () => {
          if (!archive) return;
          try {
            await command(
              "notebooks.definition_manage",
              {
                company_id: archive.company_id,
                kind: "company_shared",
                mutation: true,
              },
              (draft, freshActor) =>
                archiveNotebook(draft, freshActor, archive.id),
            );
            setArchive(null);
            setError("");
          } catch (caught) {
            setError(notebookError(caught, t, state.config));
          }
        }}
      />
    </div>
  );
}
export default NotebookSettings;
