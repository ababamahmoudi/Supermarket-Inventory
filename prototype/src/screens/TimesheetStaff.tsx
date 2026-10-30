import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Plus, Search, UserRound, Users } from "lucide-react";
import { useDemo } from "../store";
import { branchLabel } from "../settings";
import {
  addTimesheetStaff,
  archiveTimesheetStaff,
  configuredTimesheetDepartments,
  editTimesheetStaff,
  listTimesheetPeople,
  timesheetScope,
  type TimesheetStaff,
} from "../timesheets";
import { Button, Dialog, Field, Menu, MenuItem, Select, Tabs } from "../ui";
import { requireTimesheetSaveActor } from "./timesheet-save-context";

type Translate = (en: string, fa: string) => string;
type AppPerson = ReturnType<typeof listTimesheetPeople>[number];
const staffError = (caught: unknown, t: Translate) =>
  caught instanceof Error && caught.message === "staff_changed"
    ? t(
        "This person changed while the form was open. Close it and try again.",
        "این فرد هنگام باز بودن فرم تغییر کرد. فرم را ببندید و دوباره تلاش کنید.",
      )
    : t(
        "This could not be saved. Check your location and permissions, then try again.",
        "ذخیره نشد. مکان و مجوزها را بررسی کنید و دوباره تلاش کنید.",
      );

function StaffForm({
  person,
  location,
  people,
  close,
  pendingChanged,
}: {
  person: TimesheetStaff | null;
  location: string;
  people: AppPerson[] | null;
  close: (created?: boolean) => void;
  pendingChanged: (pending: boolean) => void;
}) {
  const { state, actor, command, t, lang } = useDemo();
  const [name, setName] = useState(person?.name_en ?? "");
  const [persian, setPersian] = useState(person?.name_fa ?? "");
  const departments = configuredTimesheetDepartments(state.config);
  const [department, setDepartment] = useState(
    person?.usual_department_key ?? departments[0]?.key ?? "",
  );
  const [appPerson, setAppPerson] = useState(person?.app_person_id ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInput.current?.focus();
  }, []);
  const save = async () => {
    if (pending) return;
    if (!name.trim() || !department) {
      setError(
        t(
          "Add an English name and choose a department.",
          "نام انگلیسی را وارد کرده و بخش را انتخاب کنید.",
        ),
      );
      nameInput.current?.focus();
      return;
    }
    setPending(true);
    pendingChanged(true);
    setError("");
    try {
      await command(
        "timesheets.edit",
        timesheetScope(actor!.company_id, location, true, person?.id),
        (draft, current) => {
          requireTimesheetSaveActor(actor!, current);
          const patch = {
            name_en: name,
            name_fa: persian,
            usual_department_key: department,
            ...(appPerson !== (person?.app_person_id ?? "") || !person
              ? { app_person_id: appPerson }
              : {}),
          };
          if (person) {
            const canonical = draft.timesheet_staff?.find(
              (entry) =>
                entry.company_id === current.company_id &&
                entry.branch === location &&
                entry.id === person.id,
            );
            if (!canonical || canonical.version !== person.version)
              throw new Error("staff_changed");
            editTimesheetStaff(draft, current, person.id, patch);
          } else
            addTimesheetStaff(draft, current, { branch: location, ...patch });
        },
      );
      close(!person);
    } catch (caught) {
      setError(staffError(caught, t));
    } finally {
      setPending(false);
      pendingChanged(false);
    }
  };
  const fields = (
    <>
      <div className="form-grid timesheet-new-person-fields">
        <Field label={t("Name (English)", "نام (انگلیسی)")}>
          <input
            ref={nameInput}
            dir="ltr"
            value={name}
            disabled={pending}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </Field>
        <Field label={t("Name (Persian) (optional)", "نام (فارسی) (اختیاری)")}>
          <input
            dir="rtl"
            value={persian}
            disabled={pending}
            onChange={(event) => setPersian(event.target.value)}
          />
        </Field>
        <Field label={t("Usual department", "بخش معمول")}>
          <Select
            value={department}
            disabled={pending}
            onChange={setDepartment}
            options={departments.map((entry) => ({
              value: entry.key,
              label:
                lang === "fa" ? entry.name_fa || entry.name_en : entry.name_en,
            }))}
          />
        </Field>
        <Field label={t("App login (optional)", "ورود به برنامه (اختیاری)")}>
          <Select
            value={appPerson}
            disabled={pending || people === null}
            onChange={setAppPerson}
            options={[
              { value: "", label: t("No app login", "بدون ورود به برنامه") },
              ...(appPerson && !people?.some((entry) => entry.id === appPerson)
                ? [
                    {
                      value: appPerson,
                      label: t(
                        "Linked account unavailable",
                        "حساب پیوندخورده در دسترس نیست",
                      ),
                      disabled: true,
                    },
                  ]
                : []),
              ...(people ?? []).map((entry) => ({
                value: entry.id,
                label: `${lang === "fa" ? entry.name_fa || entry.name_en : entry.name_en} · ${entry.username}`,
              })),
            ]}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
  const actions = (
    <>
      <Button variant="secondary" onClick={() => close()} disabled={pending}>
        {t("Cancel", "لغو")}
      </Button>
      <Button onClick={() => void save()} disabled={pending}>
        {pending
          ? t("Saving…", "در حال ذخیره…")
          : person
            ? t("Save staff member", "ذخیره فرد")
            : t("Add person", "افزودن فرد")}
      </Button>
    </>
  );
  return person ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
      title={t("Edit staff member", "ویرایش فرد")}
      description={t(
        "A staff member does not need an app login.",
        "فرد ثبت‌شده نیازی به حساب ورود برنامه ندارد.",
      )}
      icon={<Users size={20} />}
      className="timesheet-staff-editor ui-form-surface"
      footer={actions}
    >
      {fields}
    </Dialog>
  ) : (
    <section
      className="timesheet-new-person"
      aria-label={t("New person", "فرد جدید")}
    >
      <h3>{t("New person", "فرد جدید")}</h3>
      {fields}
      <div
        className="actions timesheet-new-person-actions ui-control-row"
        data-ui-control-size="small"
      >
        {actions}
      </div>
    </section>
  );
}

export default function TimesheetManageStaff({
  location,
  staff,
  close,
}: {
  location: string;
  staff: TimesheetStaff[];
  close: () => void;
}) {
  const { state, actor, command, query, t, lang } = useDemo();
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<TimesheetStaff | null | undefined>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archive, setArchive] = useState<TimesheetStaff | null>(null);
  const [people, setPeople] = useState<AppPerson[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);
  const [peopleRead, setPeopleRead] = useState(0);
  useEffect(() => {
    let active = true;
    void query(
      "timesheets.read",
      timesheetScope(actor!.company_id, location),
      (draft, current) => listTimesheetPeople(draft, current, location),
    )
      .then((result) => {
        if (active) {
          setPeople(result);
          setPeopleError(false);
        }
      })
      .catch(() => {
        if (active) setPeopleError(true);
      });
    return () => {
      active = false;
    };
  }, [actor, location, query, peopleRead]);
  const departments = configuredTimesheetDepartments(state.config);
  const displayName = (person: TimesheetStaff) =>
    lang === "fa" ? person.name_fa || person.name_en : person.name_en;
  const visible = staff.filter(
    (person) =>
      person.status === (archived ? "archived" : "active") &&
      `${person.name_en} ${person.name_fa ?? ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const activeCount = staff.filter(
    (person) => person.status === "active",
  ).length;
  const archivedCount = staff.filter(
    (person) => person.status === "archived",
  ).length;
  const adding = editing === null;
  const changeStatus = async (person: TimesheetStaff, next: boolean) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await command(
        "timesheets.edit",
        timesheetScope(actor!.company_id, location, true, person.id),
        (draft, current) => {
          requireTimesheetSaveActor(actor!, current);
          const canonical = draft.timesheet_staff?.find(
            (entry) =>
              entry.company_id === current.company_id &&
              entry.branch === location &&
              entry.id === person.id,
          );
          if (!canonical || canonical.version !== person.version)
            throw new Error("staff_changed");
          archiveTimesheetStaff(draft, current, person.id, next);
        },
      );
      setArchive(null);
    } catch (caught) {
      setError(staffError(caught, t));
    } finally {
      setSaving(false);
    }
  };
  const formClosed = (created = false) => {
    setEditing(undefined);
    if (created) {
      setSearch("");
      setArchived(false);
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !saving) close();
        }}
        title={t(
          `Staff · ${branchLabel(state.config, location, "en")}`,
          `کارکنان · ${branchLabel(state.config, location, "fa")}`,
        )}
        description={t(
          "People who appear on this branch's timesheets. Archived people keep their past shifts.",
          "افرادی که در کارکرد این شعبه می‌آیند. افراد بایگانی‌شده شیفت‌های گذشته‌شان را نگه می‌دارند.",
        )}
        icon={<Users size={20} />}
        className="timesheet-manage-staff ui-form-surface"
        bodyClassName="timesheet-staff-body"
        footer={
          <>
            <Button onClick={close} disabled={saving}>
              {t("Done", "تمام")}
            </Button>
          </>
        }
      >
        <div className="timesheet-staff-toolbar ui-control-row">
          <div className="filter-search-pill timesheet-staff-search-pill">
            <Search size={16} aria-hidden="true" />
            <input
              className="ui-input"
              aria-label={t("Search staff", "جستجوی کارکنان")}
              placeholder={t("Search staff", "جستجوی کارکنان")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Tabs
            value={archived ? "archived" : "active"}
            onChange={(value) => setArchived(value === "archived")}
            aria-label={t("Staff status", "وضعیت کارکنان")}
            showZeroCounts
            options={[
              {
                value: "active",
                label: t("Active", "فعال"),
                count: activeCount,
                disabled: saving,
              },
              {
                value: "archived",
                label: t("Archived", "بایگانی"),
                count: archivedCount,
                disabled: saving,
              },
            ]}
          />
          {!adding && (
            <Button onClick={() => setEditing(null)} disabled={saving}>
              <Plus size={16} />
              {t("Add person", "افزودن فرد")}
            </Button>
          )}
        </div>
        {adding && (
          <StaffForm
            person={null}
            location={location}
            people={people}
            close={formClosed}
            pendingChanged={setSaving}
          />
        )}
        <div className="timesheet-managed-head" aria-hidden="true">
          <span />
          <span>{t("Name", "نام")}</span>
          <span>{t("Usual department", "بخش معمول")}</span>
          <span>{t("App login", "ورود به برنامه")}</span>
          <span />
        </div>
        <ul className="timesheet-managed-list">
          {visible.map((person) => {
            const department = departments.find(
              (entry) => entry.key === person.usual_department_key,
            );
            const linked = people?.find(
              (entry) => entry.id === person.app_person_id,
            );
            const primary = displayName(person);
            const secondary = lang === "fa" ? person.name_en : person.name_fa;
            return (
              <li
                className="timesheet-managed-person"
                key={person.id}
                data-staff-id={person.id}
              >
                <span className="timesheet-staff-avatar" aria-hidden="true">
                  {person.name_en
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => Array.from(word)[0])
                    .join("")}
                </span>
                <span className="timesheet-staff-names">
                  <strong title={primary}>{primary}</strong>
                  {secondary && secondary !== primary && (
                    <span className="muted" title={secondary}>
                      {secondary}
                    </span>
                  )}
                </span>
                <span className="timesheet-staff-department">
                  {department
                    ? lang === "fa"
                      ? department.name_fa || department.name_en
                      : department.name_en
                    : t("Past department", "بخش پیشین")}
                </span>
                <span
                  className={`timesheet-staff-login${linked ? "" : " muted"}`}
                >
                  {linked ? (
                    <>
                      <UserRound size={16} aria-hidden="true" />
                      <bdi dir="ltr">{linked.username}</bdi>
                    </>
                  ) : !person.app_person_id ? (
                    t("No app login", "بدون ورود به برنامه")
                  ) : people === null && !peopleError ? (
                    t("Loading app login…", "در حال بارگذاری ورود…")
                  ) : peopleError ? (
                    t("Could not load login", "بارگذاری ورود انجام نشد")
                  ) : (
                    t(
                      "Linked account unavailable",
                      "حساب پیوندخورده در دسترس نیست",
                    )
                  )}
                </span>
                <Menu
                  label={t(
                    `Actions for ${person.name_en}`,
                    `کارها برای ${primary}`,
                  )}
                  icon={<MoreHorizontal size={16} />}
                  iconOnly
                  showChevron={false}
                  className="button-plain timesheet-staff-menu"
                >
                  <MenuItem
                    disabled={saving}
                    onClick={() => setEditing(person)}
                  >
                    {t("Edit", "ویرایش")}
                  </MenuItem>
                  <MenuItem
                    disabled={saving}
                    onClick={() =>
                      archived
                        ? void changeStatus(person, false)
                        : setArchive(person)
                    }
                  >
                    {archived
                      ? t("Restore", "بازگردانی")
                      : t("Archive", "بایگانی")}
                  </MenuItem>
                </Menu>
              </li>
            );
          })}
        </ul>
        {!visible.length && (
          <p className="muted">
            {t("No staff match this view.", "فردی در این نما پیدا نشد.")}
          </p>
        )}
        {peopleError && (
          <p className="form-error" role="alert">
            {t(
              "The app-login list could not be loaded.",
              "فهرست ورود به برنامه بارگذاری نشد.",
            )}{" "}
            <Button
              variant="plain"
              onClick={() => setPeopleRead((value) => value + 1)}
            >
              {t("Try again", "تلاش دوباره")}
            </Button>
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="muted timesheet-staff-footnote">
          {t("Changes save as you go.", "تغییرات خودکار ذخیره می‌شوند.")}
        </p>
      </Dialog>
      {editing && (
        <StaffForm
          key={editing.id}
          person={editing}
          location={location}
          people={people}
          close={formClosed}
          pendingChanged={setSaving}
        />
      )}
      <Dialog
        open={Boolean(archive)}
        onOpenChange={(open) => {
          if (!open && !saving) setArchive(null);
        }}
        title={t("Archive this staff member?", "این فرد بایگانی شود؟")}
        description={t(
          "Past shifts and History stay available.",
          "شیفت‌های گذشته و تاریخچه حفظ می‌شوند.",
        )}
        icon={<Users size={20} />}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setArchive(null)}
            >
              {t("Cancel", "لغو")}
            </Button>
            <Button
              disabled={saving}
              onClick={() => {
                if (archive) void changeStatus(archive, true);
              }}
            >
              {saving ? t("Saving…", "در حال ذخیره…") : t("Archive", "بایگانی")}
            </Button>
          </>
        }
      >
        {archive && error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
