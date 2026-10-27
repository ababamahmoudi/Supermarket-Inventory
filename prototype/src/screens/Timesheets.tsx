import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Printer,
  History,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useDemo } from "../store";
import { branchId, branchLabel } from "../settings";
import { companyTimestampText } from "../company-time";
import { historyActionLabel, historyFieldLabel } from "../history-copy";
import { validTrackedDate } from "../date-tracking";
import {
  addTimesheetRow,
  addTimesheetStaff,
  archiveTimesheetStaff,
  configuredTimesheetDepartments,
  editTimesheetStaff,
  exportTimesheetCsv,
  listTimesheetPeople,
  patchTimesheetRow,
  readTimesheetDay,
  readTimesheetDayView,
  readTimesheetWeek,
  readTimesheetWeekView,
  removeTimesheetRow,
  saveTimesheetNotes,
  timesheetClock,
  timesheetDateAfter,
  timesheetCompactHours,
  timesheetScope,
  type TimesheetDepartmentRead,
  type TimesheetRowRead,
  type TimesheetStaff,
  type TimesheetDayRead,
  type TimesheetWeekRead,
} from "../timesheets";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DateField,
  Dialog,
  Field,
  PageHeader,
  Select,
} from "../ui";
import { TimesheetSavedField } from "./timesheet-autosave";
import {
  TimesheetSaveContext,
  requireTimesheetSaveActor,
  registerTimesheetNavigationGuard,
  deferTimesheetNavigation,
} from "./timesheet-save-context";
import "./timesheets-r2d.css";
import type { Activity, Language } from "../types";
import TimesheetWeek from "./TimesheetWeek";
import TimesheetPrint from "./TimesheetPrint";

type Translate = (en: string, fa: string) => string;
const timesheetErrorText = (t: Translate) =>
  t(
    "This could not be saved. Check your location and permissions, then try again.",
    "ذخیره نشد. مکان و مجوزها را بررسی کنید و دوباره تلاش کنید.",
  );
function historyChanges(
  event: Activity,
  lang: Language,
  departments: TimesheetDepartmentRead[],
) {
  const before =
    event.before && typeof event.before === "object"
      ? (event.before as Record<string, unknown>)
      : {};
  const after =
    event.after && typeof event.after === "object"
      ? (event.after as Record<string, unknown>)
      : {};
  return [
    "name_en",
    "name_fa",
    "department_name_en",
    "department_name_fa",
    "usual_department_key",
    "removed_at",
    "app_person_id",
    "in_time",
    "out_time",
    "notes",
    "date",
    "status",
  ].flatMap((key) => {
    const left = typeof before[key] === "string" ? String(before[key]) : "";
    const right = typeof after[key] === "string" ? String(after[key]) : "";
    if (left === right) return [];
    const empty = lang === "fa" ? "ثبت نشده" : "Not added";
    const format = (value: string, previous = false) => {
      if (!value) return empty;
      if (key === "usual_department_key") {
        const department = departments.find((item) => item.key === value);
        return department
          ? lang === "fa"
            ? department.name_fa
            : department.name_en
          : lang === "fa"
            ? "بخش پیشین"
            : "Past department";
      }
      if (key === "removed_at") return lang === "fa" ? "برداشته شد" : "Removed";
      if (key === "app_person_id")
        return previous
          ? lang === "fa"
            ? "حساب قبلی پیوندخورده"
            : "Previously linked app account"
          : lang === "fa"
            ? "حساب ورود پیوند داده شده"
            : "Linked app account";
      if (key === "status")
        return value === "archived"
          ? lang === "fa"
            ? "بایگانی‌شده"
            : "Archived"
          : value === "active"
            ? lang === "fa"
              ? "فعال"
              : "Active"
            : value;
      return value;
    };
    const label =
      key === "removed_at"
        ? lang === "fa"
          ? "شیفت"
          : "Shift"
        : key === "app_person_id"
          ? lang === "fa"
            ? "حساب برنامه"
            : "App account"
          : key === "date"
            ? lang === "fa"
              ? "تاریخ"
              : "Date"
            : historyFieldLabel(key, lang);
    return [
      <p key={key}>
        <span className="muted">{label}: </span>
        <bdi dir="auto">{format(left, true)}</bdi> →{" "}
        <bdi dir="auto">{format(right)}</bdi>
      </p>,
    ];
  });
}
function requestedDate(fallback: string) {
  const value =
    new URLSearchParams(window.location.hash.split("?")[1]).get("date") ?? "";
  return validTrackedDate(value) ? value : fallback;
}
function dayName(date: string, lang: "en" | "fa") {
  return new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-CA", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
const displayName = (
  staff: { name_en: string; name_fa?: string },
  lang: string,
) => (lang === "fa" ? staff.name_fa || staff.name_en : staff.name_en);

function AddTimesheetPerson({
  department,
  date,
  location,
  staff,
  onAdded,
}: {
  department: TimesheetDepartmentRead;
  date: string;
  location: string;
  staff: TimesheetStaff[];
  onAdded: (id: string) => void;
}) {
  const { actor, command, t, lang } = useDemo();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [active, setActive] = useState(0);
  const listId = useId(),
    input = useRef<HTMLInputElement>(null);
  const choices = staff
    .filter(
      (person) =>
        person.status === "active" &&
        `${person.name_en} ${person.name_fa ?? ""}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.usual_department_key === department.key) -
          Number(a.usual_department_key === department.key) ||
        a.name_en.localeCompare(b.name_en),
    );
  const createName = search.trim();
  const canCreate =
    createName.length > 0 &&
    !staff.some(
      (person) =>
        person.status === "active" &&
        person.name_en.toLocaleLowerCase() === createName.toLocaleLowerCase(),
    );
  const add = async (person?: TimesheetStaff) => {
    if (!actor || pending) return;
    setPending(true);
    setError("");
    try {
      const rowId = await command(
        "timesheets.edit",
        timesheetScope(actor.company_id, location, true),
        (draft, current) => {
          const member =
            person ??
            addTimesheetStaff(draft, current, {
              branch: location,
              name_en: createName,
              usual_department_key: department.key,
            });
          return addTimesheetRow(draft, current, {
            branch: location,
            date,
            department_key: department.key,
            staff_id: member.id,
          }).id;
        },
      );
      setSearch("");
      setOpen(false);
      onAdded(rowId);
    } catch {
      setError(timesheetErrorText(t));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="timesheet-add-person">
      <Button
        variant="plain"
        onClick={() => {
          setOpen((value) => !value);
          requestAnimationFrame(() => input.current?.focus());
        }}
        aria-expanded={open}
      >
        <Plus size={16} />
        {t("Add person", "افزودن فرد")}
      </Button>
      {open && (
        <div className="timesheet-staff-search">
          <Field label={t("Name", "نام")}>
            <input
              ref={input}
              value={search}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-label={t(
                "Search staff or type a new name",
                "جستجوی کارکنان یا نوشتن نام جدید",
              )}
              onChange={(event) => {
                setSearch(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                  event.preventDefault();
                  setActive(
                    (value) =>
                      (value +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        choices.length +
                        Number(canCreate)) %
                      Math.max(1, choices.length + Number(canCreate)),
                  );
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (choices[active]) void add(choices[active]);
                  else if (canCreate) void add();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
            />
          </Field>
          <div
            role="listbox"
            id={listId}
            aria-label={t("Branch staff", "کارکنان شعبه")}
            className="timesheet-staff-options"
          >
            {choices.map((person, index) => (
              <button
                type="button"
                key={person.id}
                role="option"
                aria-selected={active === index}
                disabled={pending}
                onClick={() => void add(person)}
              >
                <span>{displayName(person, lang)}</span>
                {person.usual_department_key === department.key && (
                  <small className="muted">
                    {t("Usually here", "بخش معمول")}
                  </small>
                )}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                role="option"
                aria-selected={active === choices.length}
                disabled={pending}
                onClick={() => void add()}
              >
                {t(
                  `Add “${createName}” to staff`,
                  `افزودن «${createName}» به کارکنان`,
                )}
              </button>
            )}
            {!choices.length && !canCreate && (
              <p className="muted">
                {t(
                  "Type a name to add someone.",
                  "برای افزودن فرد، نام را بنویسید.",
                )}
              </p>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TimesheetRow({
  row,
  location,
}: {
  row: TimesheetRowRead;
  location: string;
}) {
  const { state, actor, command, t, lang } = useDemo();
  const [remove, setRemove] = useState(false),
    [error, setError] = useState("");
  const save = (field: "in_time" | "out_time", value: string) =>
    command(
      "timesheets.edit",
      timesheetScope(actor!.company_id, location, true, row.id),
      (draft, current) => {
        requireTimesheetSaveActor(actor!, current);
        patchTimesheetRow(draft, current, row.id, { [field]: value });
      },
    );
  const name = displayName(row, lang);
  return (
    <div className="timesheet-row" data-row-id={row.id} role="row">
      <div className="timesheet-person" role="cell">
        <strong>{name}</strong>
        <Button
          variant="plain"
          aria-label={t(
            `Remove ${row.name_en} from this day`,
            `برداشتن ${name} از این روز`,
          )}
          onClick={() => setRemove(true)}
        >
          <Trash2 size={16} />
          <span className="timesheet-remove-copy">
            {t("Remove", "برداشتن")}
          </span>
        </Button>
      </div>
      {(["in_time", "out_time"] as const).map((field) => (
        <div className="timesheet-time-cell" role="cell" key={field}>
          <span className="timesheet-mobile-label">
            {field === "in_time" ? t("In", "ورود") : t("Out", "خروج")}
          </span>
          <TimesheetSavedField
            id={`timesheet-${row.id}-${field}`}
            value={row[field]}
            save={(value) => save(field, value)}
            time
            label={t(
              `${field === "in_time" ? "In" : "Out"} time for ${row.name_en}`,
              `زمان ${field === "in_time" ? "ورود" : "خروج"} ${name}`,
            )}
            now={() => timesheetClock(state.config, location).time}
          />
        </div>
      ))}
      <div className="timesheet-hours" role="cell">
        <span className="timesheet-mobile-label">{t("Hours", "ساعت")}</span>
        <strong>{timesheetCompactHours(row.minutes)}</strong>
        {row.overnight && <small>{t("+1 day", "+۱ روز")}</small>}
        {row.on_shift && !row.warning && (
          <Badge tone="info">{t("On shift", "در حال کار")}</Badge>
        )}
        {row.warning && (
          <small className="timesheet-warning">
            {row.warning === "out_missing"
              ? t("Out time missing", "زمان خروج ثبت نشده")
              : t("Shift over 16 hours", "شیفت بیش از ۱۶ ساعت")}
          </small>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title={t("Remove this shift?", "این شیفت برداشته شود؟")}
        description={t(
          "The change stays in History.",
          "این تغییر در تاریخچه حفظ می‌شود.",
        )}
        confirmLabel={t("Remove shift", "برداشتن شیفت")}
        onConfirm={async () => {
          try {
            await command(
              "timesheets.edit",
              timesheetScope(actor!.company_id, location, true, row.id),
              (draft, current) => {
                removeTimesheetRow(draft, current, row.id);
              },
            );
            setRemove(false);
          } catch {
            setError(timesheetErrorText(t));
          }
        }}
      />
    </div>
  );
}

function StaffEditor({
  person,
  location,
  close,
}: {
  person: TimesheetStaff | null;
  location: string;
  close: () => void;
}) {
  const { state, actor, command, query, t } = useDemo();
  const [name, setName] = useState(person?.name_en ?? ""),
    [persian, setPersian] = useState(person?.name_fa ?? "");
  const departments = configuredTimesheetDepartments(state.config);
  const [department, setDepartment] = useState(
    person?.usual_department_key ?? departments[0]?.key ?? "",
  );
  const [appPerson, setAppPerson] = useState(person?.app_person_id ?? ""),
    [people, setPeople] = useState<ReturnType<typeof listTimesheetPeople>>([]);
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    let current = true;
    void query(
      "timesheets.read",
      timesheetScope(actor!.company_id, location),
      (draft, fresh) => listTimesheetPeople(draft, fresh, location),
    )
      .then((result) => {
        if (current) setPeople(result);
      })
      .catch(() => {
        if (current) setError(timesheetErrorText(t));
      });
    return () => {
      current = false;
    };
  }, [actor, location, query, t]);
  const save = async () => {
    if (!name.trim() || !department) {
      setError(
        t(
          "Add an English name and choose a department.",
          "نام انگلیسی را وارد کرده و بخش را انتخاب کنید.",
        ),
      );
      return;
    }
    setPending(true);
    try {
      await command(
        "timesheets.edit",
        timesheetScope(actor!.company_id, location, true, person?.id),
        (draft, current) => {
          const patch = {
            name_en: name,
            name_fa: persian,
            usual_department_key: department,
            app_person_id: appPerson,
          };
          if (person) editTimesheetStaff(draft, current, person.id, patch);
          else
            addTimesheetStaff(draft, current, { branch: location, ...patch });
        },
      );
      close();
    } catch {
      setError(timesheetErrorText(t));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !pending) close();
      }}
      title={
        person
          ? t("Edit staff member", "ویرایش فرد")
          : t("Add staff member", "افزودن فرد")
      }
      icon={<Users />}
      description={t(
        "A staff member does not need an app login.",
        "فرد ثبت‌شده نیازی به حساب ورود برنامه ندارد.",
      )}
      className="timesheet-staff-editor ui-form-surface"
      footer={
        <>
          <Button variant="neutral" onClick={close} disabled={pending}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            {t("Save staff member", "ذخیره فرد")}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t("English name", "نام انگلیسی")}>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </Field>
        <Field label={t("Persian name (optional)", "نام فارسی (اختیاری)")}>
          <input
            value={persian}
            onChange={(event) => setPersian(event.target.value)}
          />
        </Field>
        <Field label={t("Usual department", "بخش معمول")}>
          <Select
            value={department}
            onChange={setDepartment}
            options={departments.map((item) => ({
              value: item.key,
              label: `${item.name_en} · ${item.name_fa}`,
            }))}
          />
        </Field>
        <Field label={t("App person (optional)", "حساب برنامه (اختیاری)")}>
          <Select
            value={appPerson}
            onChange={setAppPerson}
            options={[
              { value: "", label: t("No app login", "بدون حساب ورود") },
              ...people.map((item) => ({
                value: item.id,
                label: `${item.name_en} · ${item.username}`,
              })),
            ]}
          />
        </Field>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
function ManageStaff({
  location,
  staff,
  close,
}: {
  location: string;
  staff: TimesheetStaff[];
  close: () => void;
}) {
  const { actor, command, t, lang } = useDemo();
  const [archived, setArchived] = useState(false),
    [edit, setEdit] = useState<TimesheetStaff | null | undefined>();
  const [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [archive, setArchive] = useState<TimesheetStaff | null>(null);
  const visible = staff.filter(
    (item) =>
      item.status === (archived ? "archived" : "active") &&
      `${item.name_en} ${item.name_fa ?? ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const changeStatus = async (person: TimesheetStaff, next: boolean) => {
    try {
      await command(
        "timesheets.edit",
        timesheetScope(actor!.company_id, location, true, person.id),
        (draft, current) => {
          archiveTimesheetStaff(draft, current, person.id, next);
        },
      );
      setArchive(null);
    } catch {
      setError(timesheetErrorText(t));
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(value) => {
          if (!value) close();
        }}
        title={t("Manage branch staff", "مدیریت کارکنان شعبه")}
        description={t(
          "Names are kept when archived, together with their past shifts.",
          "نام افراد بایگانی‌شده همراه شیفت‌های گذشته حفظ می‌شود.",
        )}
        icon={<Users />}
        className="timesheet-manage-staff ui-form-surface"
        footer={
          <Button variant="neutral" onClick={close}>
            {t("Close", "بستن")}
          </Button>
        }
      >
        <div className="timesheet-staff-toolbar">
          <Field label={t("Search staff", "جستجوی کارکنان")}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Button
            variant="neutral"
            onClick={() => setArchived((value) => !value)}
          >
            {archived
              ? t("Show active", "نمایش فعال‌ها")
              : t("Show archived", "نمایش بایگانی")}
          </Button>
          <Button onClick={() => setEdit(null)}>
            <Plus size={16} />
            {t("Add staff", "افزودن فرد")}
          </Button>
        </div>
        <div className="timesheet-managed-list">
          {visible.map((person) => (
            <div key={person.id} className="timesheet-managed-person">
              <strong>{displayName(person, lang)}</strong>
              <div className="actions">
                <Button variant="neutral" onClick={() => setEdit(person)}>
                  {t("Edit", "ویرایش")}
                </Button>
                <Button
                  variant="plain"
                  onClick={() =>
                    archived
                      ? void changeStatus(person, false)
                      : setArchive(person)
                  }
                >
                  {archived
                    ? t("Restore", "بازگردانی")
                    : t("Archive", "بایگانی")}
                </Button>
              </div>
            </div>
          ))}
          {!visible.length && (
            <p className="muted">
              {t("No staff match this view.", "فردی در این نما پیدا نشد.")}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </Dialog>
      {edit !== undefined && (
        <StaffEditor
          person={edit}
          location={location}
          close={() => setEdit(undefined)}
        />
      )}
      <ConfirmDialog
        open={Boolean(archive)}
        onOpenChange={(value) => {
          if (!value) setArchive(null);
        }}
        title={t("Archive this staff member?", "این فرد بایگانی شود؟")}
        description={t(
          "Past shifts and History stay available.",
          "شیفت‌های گذشته و تاریخچه حفظ می‌شوند.",
        )}
        confirmLabel={t("Archive", "بایگانی")}
        onConfirm={() => {
          if (archive) void changeStatus(archive, true);
        }}
      />
    </>
  );
}

export default function Timesheets() {
  const { actor, state, can, t, branch } = useDemo();
  if (
    !actor ||
    state.config.modules.timesheets === false ||
    !can("timesheets.read")
  )
    return (
      <p role="alert">
        {t(
          "You do not have permission to open Timesheets.",
          "اجازه باز کردن کارکرد را ندارید.",
        )}
      </p>
    );
  return (
    <TimesheetsContent
      key={`${actor.company_id}:${actor.user_id}:${actor.session_id}:${actor.authority_epoch}:${actor.person_version}`}
      initialBranch={branch}
    />
  );
}
function TimesheetsContent({ initialBranch }: { initialBranch: string }) {
  const { state, actor, command, query, branch, t, lang } = useDemo();
  const [chosenBranch, setChosenBranch] = useState(""),
    [date, setDate] = useState(() =>
      requestedDate(timesheetClock(state.config, initialBranch).date),
    );
  const [view, setView] = useState<"day" | "week">(() =>
    new URLSearchParams(window.location.hash.split("?")[1]).get("view") ===
    "week"
      ? "week"
      : "day",
  );
  const location = branch === "all" ? chosenBranch : branch;
  const [printSnapshot, setPrintSnapshot] = useState<{
    intent: string;
    day: TimesheetDayRead;
    week: TimesheetWeekRead | null;
  } | null>(null);
  const [manage, setManage] = useState(false),
    [history, setHistory] = useState(false),
    [error, setError] = useState("");
  const intent = `${actor!.company_id}:${actor!.user_id}:${actor!.session_id}:${actor!.authority_epoch}:${location}:${date}:${view}`;
  const currentIntent = useRef(intent);
  useLayoutEffect(() => {
    currentIntent.current = intent;
  }, [intent]);
  useEffect(
    () => () => {
      currentIntent.current = "";
    },
    [],
  );
  const saves = useRef(new Map<string, () => Promise<boolean>>());
  const navigationVersion = useRef(0);
  const register = useCallback((id: string, flush: () => Promise<boolean>) => {
    saves.current.set(id, flush);
    return () => {
      saves.current.delete(id);
    };
  }, []);
  const registry = useMemo(() => ({ register }), [register]);
  const flush = useCallback(
    async () =>
      (
        await Promise.all([...saves.current.values()].map((save) => save()))
      ).every(Boolean),
    [],
  );
  const acceptedHash = useRef(window.location.hash);
  useLayoutEffect(() => {
    if (window.location.hash.startsWith("#timesheets"))
      acceptedHash.current = window.location.hash;
  }, [intent]);
  useEffect(() => {
    let active = true,
      replaying = false,
      latestNavigation = 0;
    const guard = (event: HashChangeEvent) => {
      if (replaying || window.location.hash === acceptedHash.current)
        return false;
      const destination = window.location.hash,
        ownNavigation = ++latestNavigation;
      ++navigationVersion.current;
      // Browser Back and script/hash navigation need not blur a focused field.
      // Keep its error and typed value mounted until the real save is accepted.
      event.stopImmediatePropagation();
      void flush().then((saved) => {
        if (
          !active ||
          ownNavigation !== latestNavigation ||
          window.location.hash !== destination
        )
          return;
        if (!saved) {
          // Restore the displayed sheet while retaining Back's destination for
          // a later retry, rather than replacing that earlier history entry.
          window.history.pushState(null, "", acceptedHash.current);
          return;
        }
        acceptedHash.current = destination;
        replaying = true;
        try {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        } finally {
          replaying = false;
        }
      });
      return true;
    };
    const unregister = registerTimesheetNavigationGuard(guard);
    return () => {
      active = false;
      unregister();
    };
  }, [flush]);
  const changeDate = async (next: string, nextView = view) => {
    if (!validTrackedDate(next)) return;
    const expected = intent,
      hash = window.location.hash,
      ownNavigation = ++navigationVersion.current;
    if (!(await flush())) {
      setError(
        t(
          "Check the entries that could not be saved.",
          "ورودی‌هایی را که ذخیره نشدند بررسی کنید.",
        ),
      );
      return;
    }
    if (
      currentIntent.current !== expected ||
      window.location.hash !== hash ||
      ownNavigation !== navigationVersion.current
    )
      return;
    setDate(next);
    setView(nextView);
    window.history.replaceState(
      null,
      "",
      `#timesheets?date=${next}&view=${nextView}`,
    );
  };
  const changeView = async (next: "day" | "week") => {
    const expected = intent,
      hash = window.location.hash,
      ownNavigation = ++navigationVersion.current;
    if (!(await flush())) {
      setError(
        t(
          "Check the entries that could not be saved.",
          "ورودی‌هایی را که ذخیره نشدند بررسی کنید.",
        ),
      );
      return;
    }
    if (
      currentIntent.current !== expected ||
      window.location.hash !== hash ||
      ownNavigation !== navigationVersion.current
    )
      return;
    setView(next);
    window.history.replaceState(
      null,
      "",
      `#timesheets?date=${date}&view=${next}`,
    );
  };
  const exportCsv = async () => {
    const expected = intent;
    if (!(await flush())) {
      setError(
        t(
          "Check the entries that could not be saved.",
          "ورودی‌هایی را که ذخیره نشدند بررسی کنید.",
        ),
      );
      return;
    }
    if (currentIntent.current !== expected) return;
    try {
      const result = await query(
        "timesheets.read",
        timesheetScope(actor!.company_id, location),
        (canonical, current) =>
          exportTimesheetCsv(canonical, current, {
            branch: location,
            date,
            view,
          }),
      );
      if (currentIntent.current !== expected) return;
      const href = URL.createObjectURL(
        new Blob([result.text], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = href;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(href);
      setError("");
    } catch {
      if (currentIntent.current === expected)
        setError(
          t(
            "The export could not be prepared. Check your access and try again.",
            "فایل خروجی آماده نشد. مجوزها را بررسی و دوباره تلاش کنید.",
          ),
        );
    }
  };
  const print = async () => {
    const expected = intent;
    if (!(await flush())) {
      setError(
        t(
          "Check the entries that could not be saved.",
          "ورودی‌هایی را که ذخیره نشدند بررسی کنید.",
        ),
      );
      return;
    }
    if (currentIntent.current !== expected) return;
    try {
      const result = await query(
        "timesheets.read",
        timesheetScope(actor!.company_id, location),
        (canonical, current) => ({
          day: readTimesheetDay(canonical, current, location, date),
          week:
            view === "week"
              ? readTimesheetWeek(canonical, current, location, date)
              : null,
        }),
      );
      if (currentIntent.current === expected)
        setPrintSnapshot({ intent: expected, ...result });
    } catch {
      if (currentIntent.current === expected)
        setError(
          t(
            "The print sheet could not be prepared. Check your access and try again.",
            "برگه چاپ آماده نشد. مجوزها را بررسی و دوباره تلاش کنید.",
          ),
        );
    }
  };
  useEffect(() => {
    if (!printSnapshot || printSnapshot.intent !== intent) return;
    let active = true;
    const clear = () => setPrintSnapshot(null);
    window.addEventListener("afterprint", clear);
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        if (active && currentIntent.current === printSnapshot.intent)
          window.print();
      });
    });
    return () => {
      active = false;
      window.removeEventListener("afterprint", clear);
    };
  }, [printSnapshot, intent]);
  const allowed = state.config.branches
    .map((item, index) => ({ id: branchId(item, index), item }))
    .filter(
      ({ id, item }) =>
        actor!.allowed_branches.includes(id) && item.active !== false,
    );
  const clockLocation = useRef<string | null>(null);
  useEffect(() => {
    const sync = () => {
      if (window.location.hash.startsWith("#timesheets")) {
        setDate(requestedDate(timesheetClock(state.config, location).date));
        setView(
          new URLSearchParams(window.location.hash.split("?")[1]).get(
            "view",
          ) === "week"
            ? "week"
            : "day",
        );
      }
    };
    // An implicit day follows a newly selected branch's clock. Ordinary config
    // publications must not move an already open working paper at midnight.
    if (clockLocation.current !== location) {
      clockLocation.current = location;
      sync();
    }
    const onHash = (event: HashChangeEvent) => {
      if (deferTimesheetNavigation(event)) return;
      sync();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [state.config, location]);
  if (!location || !allowed.some((item) => item.id === location))
    return (
      <div className="timesheets-page">
        <PageHeader
          title={t("Timesheets", "کارکرد")}
          description={t(
            "Choose a branch to view or edit its daily sheet.",
            "برای دیدن یا ویرایش برگه روزانه، یک شعبه را انتخاب کنید.",
          )}
        />
        <Card className="timesheet-choose-branch ui-form-surface">
          <Field label={t("Branch", "شعبه")}>
            <Select
              value=""
              onChange={setChosenBranch}
              options={[
                {
                  value: "",
                  label: t("Choose a branch", "انتخاب شعبه"),
                  disabled: true,
                },
                ...allowed.map(({ id }) => ({
                  value: id,
                  label: branchLabel(state.config, id, lang),
                })),
              ]}
            />
          </Field>
        </Card>
      </div>
    );
  const data = readTimesheetDayView(state, location, date);
  const week =
    view === "week" ? readTimesheetWeekView(state, location, date) : null;
  const added = (id: string) => {
    requestAnimationFrame(() => {
      document
        .getElementById(`timesheet-${id}-in_time`)
        ?.focus({ preventScroll: true });
    });
  };
  return (
    <TimesheetSaveContext.Provider value={registry}>
      <div
        className="timesheets-page ui-form-surface"
        data-timesheet-branch={location}
        data-timesheet-date={date}
      >
        <PageHeader
          title={t("Timesheets", "کارکرد")}
          description={`${branchLabel(state.config, location, lang)} · ${dayName(date, lang)}`}
          actions={
            <Button variant="neutral" onClick={() => setManage(true)}>
              <Users size={18} />
              {t("Manage staff", "مدیریت کارکنان")}
            </Button>
          }
        />
        <div className="timesheet-toolbar">
          <div className="timesheet-date-controls">
            <Button
              variant="neutral"
              aria-label={t("Previous day", "روز قبل")}
              onClick={() =>
                void changeDate(
                  timesheetDateAfter(date, view === "week" ? -7 : -1),
                )
              }
            >
              {lang === "fa" ? (
                <ArrowRight size={18} />
              ) : (
                <ArrowLeft size={18} />
              )}
            </Button>
            <DateField
              value={date}
              onChange={(value) => void changeDate(value)}
              aria-label={t("Timesheet date", "تاریخ کارکرد")}
            />
            <Button
              variant="neutral"
              aria-label={t("Next day", "روز بعد")}
              onClick={() =>
                void changeDate(
                  timesheetDateAfter(date, view === "week" ? 7 : 1),
                )
              }
            >
              {lang === "fa" ? (
                <ArrowLeft size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
            </Button>
            <Button
              variant="neutral"
              onClick={() =>
                void changeDate(timesheetClock(state.config, location).date)
              }
            >
              {t("Today", "امروز")}
            </Button>
          </div>
          <div className="timesheet-view-actions">
            <Button variant="neutral" onClick={() => void print()}>
              <Printer size={18} />
              {t("Print", "چاپ")}
            </Button>
            <Button variant="neutral" onClick={() => void exportCsv()}>
              <Download size={18} />
              {t("Export CSV", "خروجی CSV")}
            </Button>
            <Button
              variant="neutral"
              onClick={() => void changeView(view === "day" ? "week" : "day")}
            >
              {view === "day"
                ? t("Week view", "نمای هفتگی")
                : t("Day view", "نمای روزانه")}
            </Button>
          </div>
          <span className="timesheet-day-total">
            {data.people_count}{" "}
            {t(data.people_count === 1 ? "person" : "people", "نفر")} ·{" "}
            {timesheetCompactHours(data.minutes)}
          </span>
        </div>
        {branch === "all" && (
          <Field
            label={t("Branch", "شعبه")}
            className="timesheet-inline-branch"
          >
            <Select
              value={location}
              onChange={async (value) => {
                const expected = intent,
                  hash = window.location.hash,
                  ownNavigation = ++navigationVersion.current;
                if (
                  (await flush()) &&
                  currentIntent.current === expected &&
                  window.location.hash === hash &&
                  ownNavigation === navigationVersion.current
                )
                  setChosenBranch(value);
              }}
              options={allowed.map(({ id }) => ({
                value: id,
                label: branchLabel(state.config, id, lang),
              }))}
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {week ? (
          <TimesheetWeek
            data={week}
            openDay={(next) => {
              void changeDate(next, "day");
            }}
          />
        ) : (
          <>
            <div className="timesheet-departments" key={`${location}:${date}`}>
              {data.departments.map((department) => (
                <Card className="timesheet-department" key={department.key}>
                  <header className="timesheet-department-heading">
                    <div>
                      <h2>
                        {lang === "fa"
                          ? department.name_fa || department.name_en
                          : department.name_en}
                      </h2>
                    </div>
                    <small className="muted">
                      {department.people_count}{" "}
                      {t(
                        department.people_count === 1 ? "person" : "people",
                        "نفر",
                      )}{" "}
                      · {timesheetCompactHours(department.minutes)}
                    </small>
                  </header>
                  <div
                    className="timesheet-table"
                    role="table"
                    aria-label={`${lang === "fa" ? department.name_fa || department.name_en : department.name_en} ${t("timesheet", "کارکرد")}`}
                  >
                    <div className="timesheet-table-head" role="row">
                      {[
                        t("Name", "نام"),
                        t("In", "ورود"),
                        t("Out", "خروج"),
                        t("Hours", "ساعت"),
                      ].map((label) => (
                        <span role="columnheader" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                    {department.rows.map((row) => (
                      <TimesheetRow
                        row={row}
                        location={location}
                        key={row.id}
                      />
                    ))}
                  </div>
                  {!department.retained && (
                    <AddTimesheetPerson
                      department={department}
                      date={date}
                      location={location}
                      staff={data.staff}
                      onAdded={added}
                    />
                  )}
                  {department.retained && (
                    <p className="muted">
                      {t(
                        "Past department · existing shifts are retained.",
                        "بخش پیشین · شیفت‌های موجود حفظ شده‌اند.",
                      )}
                    </p>
                  )}
                </Card>
              ))}
            </div>
            <Card className="timesheet-notes" title={t("Notes", "توضیحات")}>
              <TimesheetSavedField
                key={`${location}:${date}`}
                id="timesheet-day-notes"
                value={data.day?.notes ?? ""}
                label={t("Notes for this day", "توضیحات این روز")}
                multiline
                save={(value) =>
                  command(
                    "timesheets.edit",
                    timesheetScope(actor!.company_id, location, true),
                    (draft, current) => {
                      requireTimesheetSaveActor(actor!, current);
                      saveTimesheetNotes(draft, current, {
                        branch: location,
                        date,
                        notes: value,
                      });
                    },
                  )
                }
              />
            </Card>
            <Card className="timesheet-history">
              <Button
                variant="plain"
                onClick={() => setHistory((value) => !value)}
                aria-expanded={history}
              >
                <History size={18} />
                {t("History", "تاریخچه")}
              </Button>
              {history && (
                <div className="timesheet-history-list">
                  {data.history.map((event) => (
                    <div key={event.id}>
                      <strong>{historyActionLabel(event.action, lang)}</strong>
                      <small className="muted">
                        {event.by} ·{" "}
                        <bdi dir="ltr">
                          {companyTimestampText(state.config, event.at)}
                        </bdi>
                      </small>
                      {historyChanges(event, lang, data.departments)}
                    </div>
                  ))}
                  {!data.history.length && (
                    <p className="muted">
                      {t(
                        "No changes on this day yet.",
                        "هنوز تغییری در این روز ثبت نشده است.",
                      )}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
        {printSnapshot?.intent === intent && (
          <TimesheetPrint snapshot={printSnapshot} config={state.config} />
        )}
        {manage && (
          <ManageStaff
            key={location}
            location={location}
            staff={data.staff}
            close={() => setManage(false)}
          />
        )}
      </div>
    </TimesheetSaveContext.Provider>
  );
}
