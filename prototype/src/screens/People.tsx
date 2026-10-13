import { useEffect, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  Menu,
  MenuItem,
  Select,
} from "../ui";
import { DateText, LtrText } from "../presentation";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import type {
  PeopleDirectoryRow,
  PersonInput,
  RoleId,
} from "../authority-types";
import {
  configuredRoleLabel,
  peopleErrorText,
  personLocationLabel,
} from "../people-presentation.e1";
import { branchLabel } from "../settings";
import "./people-e1.css";

type StatusAction = {
  person: PeopleDirectoryRow;
  kind: "deactivate" | "reactivate" | "reset";
};
const codeOf = (error: unknown) =>
  error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "permission";

function PersonEditor({
  person,
  onClose,
  onSaved,
}: {
  person: PeopleDirectoryRow | null;
  onClose: () => void;
  onSaved: (code?: string) => void;
}) {
  const { state, actor, people, lang, t } = useDemo();
  const [form, setForm] = useState<PersonInput>(() => ({
    name_en: person?.name_en ?? "",
    name_fa: person?.name_fa ?? "",
    username: person?.username ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    role: person?.role ?? "floor_worker",
    location_scope: person?.location_scope ?? {
      kind: "assigned",
      location_ids: [],
    },
  }));
  const [reason, setReason] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const companyRole = form.role === "owner" || form.role === "manager";
  const locations = state.config.branches.filter(
    (location) =>
      location.active !== false &&
      (form.role !== "cashier" || location.type !== "warehouse"),
  );
  const ids =
    form.location_scope.kind === "assigned"
      ? form.location_scope.location_ids
      : [];
  const updateField = <K extends keyof PersonInput>(
    key: K,
    value: PersonInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => current.filter((issue) => issue.id !== key));
    setError("");
  };
  const submit = async () => {
    const next: ValidationIssue[] = [];
    const missing = (id: string, message: string) =>
      next.push({ id, fieldId: `person-${id}`, message });
    if (!form.name_en.trim()) missing("name_en", peopleErrorText("name", t));
    if (!form.username.trim())
      missing("username", peopleErrorText("username", t));
    if (!form.phone?.trim() && !form.email?.trim())
      missing("phone", peopleErrorText("contact", t));
    if (
      form.email?.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    )
      missing("email", t("Enter a valid email.", "ایمیل معتبر وارد کنید."));
    if (
      form.role === "cashier" &&
      ids.some((id) =>
        state.config.branches.some(
          (location) =>
            (location.id ?? location.code) === id &&
            location.type === "warehouse",
        ),
      )
    )
      missing("location_scope", peopleErrorText("cashier_warehouse", t));
    if (!companyRole && !ids.length)
      missing("location_scope", peopleErrorText("locations", t));
    if (person && !reason.trim())
      missing("reason", peopleErrorText("reason", t));
    setIssues(next);
    if (next.length) return;
    setPending(true);
    setError("");
    const input: PersonInput = {
      ...form,
      location_scope: companyRole
        ? { kind: "company" }
        : { kind: "assigned", location_ids: [...ids] },
    };
    try {
      if (person) {
        await people.edit({
          ...input,
          person_id: person.id,
          expected_version: person.version,
          reason: reason.trim(),
        });
        onSaved();
      } else {
        const result = await people.add(input);
        onSaved(result.one_time_setup_code);
      }
    } catch (failure) {
      setError(peopleErrorText(codeOf(failure), t));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      title={
        person ? t("Edit person", "ویرایش شخص") : t("Add person", "افزودن شخص")
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      className="person-editor-dialog"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <WhatsMissing issues={issues} />
        {error && (
          <p className="banner danger" role="alert">
            {error}
          </p>
        )}
        <div className="person-editor-fields">
          <Field
            label={t("English name", "نام انگلیسی")}
            error={issues.find((item) => item.id === "name_en")?.message}
          >
            <input
              id="person-name_en"
              className="ui-input"
              value={form.name_en}
              onChange={(event) => updateField("name_en", event.target.value)}
            />
          </Field>
          <Field label={t("Persian name (optional)", "نام فارسی (اختیاری)")}>
            <input
              id="person-name_fa"
              className="ui-input"
              value={form.name_fa ?? ""}
              onChange={(event) => updateField("name_fa", event.target.value)}
              dir="rtl"
            />
          </Field>
          <Field
            label={t("Username", "نام کاربری")}
            error={issues.find((item) => item.id === "username")?.message}
          >
            <input
              id="person-username"
              className="ui-input"
              autoComplete="off"
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              dir="ltr"
            />
          </Field>
          <Field
            label={t("Phone", "تلفن")}
            error={issues.find((item) => item.id === "phone")?.message}
          >
            <input
              id="person-phone"
              className="ui-input"
              type="tel"
              value={form.phone ?? ""}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </Field>
          <Field
            label={t("Email", "ایمیل")}
            error={issues.find((item) => item.id === "email")?.message}
          >
            <input
              id="person-email"
              className="ui-input"
              type="email"
              value={form.email ?? ""}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </Field>
          <Field label={t("Role", "نقش")}>
            <Select
              id="person-role"
              value={form.role}
              disabled={person?.id === actor?.user_id}
              options={state.config.roles.map((role) => ({
                value: role.key,
                label: configuredRoleLabel(
                  state.config,
                  role.key as RoleId,
                  lang,
                ),
              }))}
              onChange={(value) => updateField("role", value as RoleId)}
            />
          </Field>
        </div>
        {!companyRole && (
          <fieldset
            id="person-location_scope"
            className="people-location-options"
            tabIndex={-1}
          >
            <legend>{t("Locations", "مکان‌ها")}</legend>
            {locations.map((location) => (
              <Checkbox
                key={location.code}
                checked={ids.includes(location.id ?? location.code)}
                onChange={(checked) =>
                  updateField("location_scope", {
                    kind: "assigned",
                    location_ids: checked
                      ? [...ids, location.id ?? location.code]
                      : ids.filter(
                          (id) => id !== (location.id ?? location.code),
                        ),
                  })
                }
              >
                {branchLabel(state.config, location.id ?? location.code, lang)}
              </Checkbox>
            ))}
            {issues.find((item) => item.id === "location_scope") && (
              <p className="form-error" role="alert">
                {issues.find((item) => item.id === "location_scope")!.message}
              </p>
            )}
          </fieldset>
        )}
        {person && (
          <>
            <p className="muted">
              {personLocationLabel(
                state.config,
                person.location_scope,
                lang,
                t,
              )}{" "}
              →{" "}
              {personLocationLabel(
                state.config,
                companyRole ? { kind: "company" } : form.location_scope,
                lang,
                t,
              )}
            </p>
            <Field
              label={t("Reason", "دلیل")}
              error={issues.find((item) => item.id === "reason")?.message}
            >
              <textarea
                id="person-reason"
                className="ui-input"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setIssues((current) =>
                    current.filter((item) => item.id !== "reason"),
                  );
                }}
              />
            </Field>
          </>
        )}
        <DialogActions>
          <Button variant="neutral" disabled={pending} onClick={onClose}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit" disabled={pending}>
            {t("Save", "ذخیره")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function People() {
  const { actor, can, t, authorityGeneration } = useDemo();
  if (!actor || !can("people.read"))
    return (
      <EmptyState>
        {t(
          "You do not have permission for this action.",
          "اجازهٔ انجام این کار را ندارید.",
        )}
      </EmptyState>
    );
  const identity = JSON.stringify([
    actor.company_id,
    actor.user_id,
    actor.session_id,
    actor.authority_epoch,
    actor.person_version,
    authorityGeneration,
  ]);
  return <PeopleContent key={identity} identity={identity} />;
}

function PeopleContent({ identity }: { identity: string }) {
  const {
    state,
    actor,
    can,
    people,
    lang,
    t,
    authorityGeneration,
    authorityDirectoryVersion,
  } = useDemo();
  const [snapshot, setSnapshot] = useState<{
    key: string;
    rows: readonly PeopleDirectoryRow[];
    error: string;
    denied: boolean;
  }>({ key: "", rows: [], error: "", denied: false });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [location, setLocation] = useState("all");
  const [editor, setEditor] = useState<PeopleDirectoryRow | "new" | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [setupCode, setSetupCode] = useState<string | null>(null);
  const [statusIssues, setStatusIssues] = useState<ValidationIssue[]>([]);
  const [copyError, setCopyError] = useState("");
  const [version, setVersion] = useState(0);
  const listKey = JSON.stringify([
    identity,
    authorityGeneration,
    authorityDirectoryVersion,
    version,
  ]);
  const readable = can("people.read");
  useEffect(() => {
    let active = true;
    if (readable)
      void people
        .list()
        .then((value) => {
          if (active)
            setSnapshot({
              key: listKey,
              rows: value,
              error: "",
              denied: false,
            });
        })
        .catch((failure) => {
          if (active && codeOf(failure) !== "session_changed")
            setSnapshot({
              key: listKey,
              rows: [],
              error: peopleErrorText(codeOf(failure), t),
              denied: true,
            });
        });
    return () => {
      active = false;
    };
  }, [people, listKey, readable, t]);
  const denied = snapshot.key === listKey && snapshot.denied;
  if (!readable || denied)
    return (
      <EmptyState>
        {denied
          ? snapshot.error
          : t(
              "You do not have permission for this action.",
              "اجازهٔ انجام این کار را ندارید.",
            )}
      </EmptyState>
    );
  const rows = snapshot.key === listKey ? snapshot.rows : [];
  const visible = rows.filter(
    (person) =>
      (role === "all" || person.role === role) &&
      (location === "all" ||
        person.location_scope.kind === "company" ||
        person.location_scope.location_ids.includes(location)) &&
      `${person.name_en} ${person.name_fa ?? ""} ${person.username}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const finish = async () => {
    if (!action) return;
    if (!reason.trim()) {
      setStatusIssues([
        {
          id: "reason",
          fieldId: "person-status-reason",
          message: peopleErrorText("reason", t),
        },
      ]);
      return;
    }
    setStatusIssues([]);
    setPending(true);
    setError("");
    try {
      const input = {
        person_id: action.person.id,
        expected_version: action.person.version,
        reason: reason.trim(),
      };
      if (action.kind === "deactivate") await people.deactivate(input);
      else if (action.kind === "reactivate") await people.reactivate(input);
      else {
        const result = await people.resetSetup(input);
        setSetupCode(result.one_time_setup_code);
      }
      setAction(null);
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(peopleErrorText(codeOf(failure), t));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="people-e1">
      <Card>
        <div className="card-heading">
          <h2>{t("People", "کارکنان")}</h2>
          <Button onClick={() => setEditor("new")}>
            <Plus size={16} />
            {t("Add person", "افزودن شخص")}
          </Button>
        </div>
        <FilterToolbar
          search={
            <input
              aria-label={t("Search people", "جستجوی کارکنان")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
        >
          <Select
            aria-label={t("Role", "نقش")}
            value={role}
            onChange={setRole}
            options={[
              { value: "all", label: t("All roles", "همه نقش‌ها") },
              ...state.config.roles.map((item) => ({
                value: item.key,
                label: configuredRoleLabel(
                  state.config,
                  item.key as RoleId,
                  lang,
                ),
              })),
            ]}
          />
          <Select
            aria-label={t("Location", "مکان")}
            value={location}
            onChange={setLocation}
            options={[
              { value: "all", label: t("All locations", "همه مکان‌ها") },
              ...state.config.branches.map((item) => ({
                value: item.id ?? item.code,
                label: branchLabel(state.config, item.id ?? item.code, lang),
              })),
            ]}
          />
        </FilterToolbar>
        {error && !action && (
          <p className="banner danger" role="alert">
            {error}
          </p>
        )}
        <DataTable
          columns={[
            { key: "name", required: true, priority: 1, minWidth: 240 },
            { key: "role", priority: 2 },
            { key: "locations", priority: 4 },
            { key: "status", priority: 3 },
            { key: "last_sign_in", priority: 5, minWidth: 140 },
            { key: "actions", actions: true, required: true },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Name", "نام")}</th>
              <th>{t("Role", "نقش")}</th>
              <th>{t("Locations", "مکان‌ها")}</th>
              <th>{t("Status", "وضعیت")}</th>
              <th>{t("Last sign-in", "آخرین ورود")}</th>
              <th>{t("Actions", "عملیات")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => (
              <tr key={person.id}>
                <td>
                  <bdi dir="auto">
                    {lang === "fa"
                      ? person.name_fa || person.name_en
                      : person.name_en}
                  </bdi>
                  <small className="muted">
                    <LtrText>{person.username}</LtrText>
                  </small>
                </td>
                <td>{configuredRoleLabel(state.config, person.role, lang)}</td>
                <td>
                  {personLocationLabel(
                    state.config,
                    person.location_scope,
                    lang,
                    t,
                  )}
                </td>
                <td>
                  <Badge
                    tone={
                      person.status === "active"
                        ? "approved"
                        : person.status === "invited"
                          ? "pending"
                          : "neutral"
                    }
                  >
                    {person.status === "active"
                      ? t("Active", "فعال")
                      : person.status === "invited"
                        ? t("Invited", "دعوت‌شده")
                        : t("Deactivated", "غیرفعال")}
                  </Badge>
                </td>
                <td>
                  {person.last_sign_in_at ? (
                    <DateText value={person.last_sign_in_at} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="actions">
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={() => setEditor(person)}
                    >
                      {t("Edit", "ویرایش")}
                    </Button>
                    <Menu
                      label={t("More actions", "کارهای بیشتر")}
                      iconOnly
                      icon={<MoreHorizontal size={20} />}
                    >
                      <MenuItem
                        disabled={person.id === actor?.user_id}
                        onClick={() => {
                          setReason("");
                          setError("");
                          setStatusIssues([]);
                          setAction({
                            person,
                            kind:
                              person.status === "deactivated"
                                ? "reactivate"
                                : "deactivate",
                          });
                        }}
                      >
                        {person.status === "deactivated"
                          ? t("Reactivate", "فعال‌سازی دوباره")
                          : t("Deactivate", "غیرفعال کردن")}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setReason("");
                          setError("");
                          setStatusIssues([]);
                          setAction({ person, kind: "reset" });
                        }}
                      >
                        {t("Reset setup", "بازنشانی راه‌اندازی")}
                      </MenuItem>
                    </Menu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
      {editor && (
        <PersonEditor
          person={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={(code) => {
            setEditor(null);
            if (code) setSetupCode(code);
            setVersion((value) => value + 1);
          }}
        />
      )}
      {action && (
        <Dialog
          open
          title={
            action.kind === "deactivate"
              ? t("Deactivate", "غیرفعال کردن")
              : action.kind === "reactivate"
                ? t("Reactivate", "فعال‌سازی دوباره")
                : t("Reset setup", "بازنشانی راه‌اندازی")
          }
          onOpenChange={(open) => {
            if (!open && !pending) setAction(null);
          }}
        >
          <WhatsMissing issues={statusIssues} />
          {error && (
            <p className="banner danger" role="alert">
              {error}
            </p>
          )}
          <Field
            label={t("Reason", "دلیل")}
            error={statusIssues.find((item) => item.id === "reason")?.message}
          >
            <textarea
              id="person-status-reason"
              className="ui-input"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
                setStatusIssues([]);
              }}
            />
          </Field>
          <DialogActions>
            <Button
              variant="neutral"
              disabled={pending}
              onClick={() => setAction(null)}
            >
              {t("Cancel", "انصراف")}
            </Button>
            <Button disabled={pending} onClick={() => void finish()}>
              {t("Confirm", "تأیید")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog
        open={setupCode !== null}
        title={t("One-time setup code", "کد یک‌بارمصرف راه‌اندازی")}
        onOpenChange={(open) => {
          if (!open) {
            setSetupCode(null);
            setCopyError("");
          }
        }}
      >
        {setupCode && (
          <>
            <p className="muted">
              {t(
                "This code is shown only once.",
                "این کد فقط یک بار نمایش داده می‌شود.",
              )}
            </p>
            <LtrText className="one-time-setup-code">{setupCode}</LtrText>
            <DialogActions>
              <Button
                variant="tinted"
                onClick={() => {
                  setCopyError("");
                  void navigator.clipboard
                    .writeText(setupCode)
                    .catch(() =>
                      setCopyError(
                        t(
                          "Copy failed. Select and copy the code.",
                          "کپی انجام نشد. کد را انتخاب و کپی کنید.",
                        ),
                      ),
                    );
                }}
              >
                {t("Copy", "کپی")}
              </Button>
              <Button variant="neutral" onClick={() => setSetupCode(null)}>
                {t("Close", "بستن")}
              </Button>
            </DialogActions>
            {copyError && (
              <p className="form-error" role="alert">
                {copyError}
              </p>
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}
