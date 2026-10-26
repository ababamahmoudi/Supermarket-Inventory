import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useDemo } from "../store";
import { useSettingsConfiguration } from "../settings-configuration";
import {
  configuredTimesheetDepartments,
  saveTimesheetSettings,
  type TimesheetDepartment,
} from "../timesheets";
import { Button, Card, Field } from "../ui";
import "./timesheets-r2d.css";

export default function TimesheetSettings() {
  const { actor, command, t } = useDemo();
  const config = useSettingsConfiguration();
  const [draft, setDraft] = useState<TimesheetDepartment[] | null>(null);
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false);
  const canonical = configuredTimesheetDepartments(config),
    rows = draft ?? canonical;
  const update = (index: number, key: "name_en" | "name_fa", value: string) => {
    setDraft(
      rows.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
    setError("");
    setSaved(false);
  };
  const move = (index: number, step: number) => {
    const next = [...rows];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setDraft(next.map((item, order) => ({ ...item, order })));
    setSaved(false);
  };
  const add = () => {
    const keys = new Set(rows.map((item) => item.key));
    let suffix = 1;
    while (keys.has(`department-${suffix}`)) suffix += 1;
    setDraft([
      ...rows,
      {
        key: `department-${suffix}`,
        name_en: "",
        name_fa: "",
        order: rows.length,
      },
    ]);
    setSaved(false);
  };
  const save = async () => {
    if (rows.some((row) => !row.name_en.trim() || !row.name_fa.trim())) {
      setError(
        t(
          "Add English and Persian names for every department.",
          "برای هر بخش نام انگلیسی و فارسی وارد کنید.",
        ),
      );
      return;
    }
    setPending(true);
    try {
      await command(
        "settings.manage",
        {
          company_id: actor!.company_id,
          kind: "company_shared",
          mutation: true,
        },
        (state, current) =>
          saveTimesheetSettings(state, current, {
            departments: rows.map((item, order) => ({ ...item, order })),
          }),
      );
      setDraft(null);
      setSaved(true);
      setError("");
    } catch {
      setError(
        t(
          "Settings could not be saved. Check the department names and try again.",
          "تنظیمات ذخیره نشد. نام بخش‌ها را بررسی و دوباره تلاش کنید.",
        ),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Card
      className="timesheet-settings ui-form-surface"
      title={t("Departments", "بخش‌ها")}
    >
      <p className="muted">
        {t(
          "Set the names and order used on every daily sheet. Removed departments keep their past shifts.",
          "نام و ترتیب بخش‌های برگه روزانه را تنظیم کنید. شیفت‌های گذشته بخش‌های برداشته‌شده حفظ می‌شوند.",
        )}
      </p>
      <div className="timesheet-settings-list">
        {rows.map((row, index) => (
          <div className="timesheet-settings-department" key={row.key}>
            <Field label={t("English name", "نام انگلیسی")}>
              <input
                aria-label={t(
                  `Department ${index + 1} English name`,
                  `نام انگلیسی بخش ${index + 1}`,
                )}
                value={row.name_en}
                onChange={(event) =>
                  update(index, "name_en", event.target.value)
                }
              />
            </Field>
            <Field label={t("Persian name", "نام فارسی")}>
              <input
                aria-label={t(
                  `Department ${index + 1} Persian name`,
                  `نام فارسی بخش ${index + 1}`,
                )}
                value={row.name_fa}
                onChange={(event) =>
                  update(index, "name_fa", event.target.value)
                }
              />
            </Field>
            <div className="actions">
              <Button
                variant="neutral"
                aria-label={t(
                  `Move ${row.name_en || "department"} up`,
                  `انتقال ${row.name_fa || "بخش"} به بالا`,
                )}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={18} />
              </Button>
              <Button
                variant="neutral"
                aria-label={t(
                  `Move ${row.name_en || "department"} down`,
                  `انتقال ${row.name_fa || "بخش"} به پایین`,
                )}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={18} />
              </Button>
              <Button
                variant="plain"
                aria-label={t(
                  `Remove ${row.name_en || "department"}`,
                  `برداشتن ${row.name_fa || "بخش"}`,
                )}
                onClick={() => {
                  setDraft(
                    rows
                      .filter((item) => item.key !== row.key)
                      .map((item, order) => ({ ...item, order })),
                  );
                  setSaved(false);
                }}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="plain" onClick={add}>
        <Plus size={18} />
        {t("Add department", "افزودن بخش")}
      </Button>
      <div
        className="timesheet-settings-feedback"
        role={error ? "alert" : "status"}
      >
        {error ||
          (saved
            ? t("Timesheet settings saved.", "تنظیمات کارکرد ذخیره شد.")
            : "")}
      </div>
      <div className="actions">
        <Button
          variant="neutral"
          disabled={pending || draft === null}
          onClick={() => {
            setDraft(null);
            setError("");
          }}
        >
          {t("Cancel", "انصراف")}
        </Button>
        <Button
          disabled={pending || draft === null}
          onClick={() => void save()}
        >
          {t("Save changes", "ذخیره تغییرات")}
        </Button>
      </div>
    </Card>
  );
}
