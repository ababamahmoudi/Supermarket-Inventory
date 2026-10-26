import { useDemo } from "../store";
import { Button, Card, DataTable } from "../ui";
import { timesheetMinutesText, type TimesheetWeekRead } from "../timesheets";

function hours(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}
export default function TimesheetWeek({
  data,
  openDay,
}: {
  data: TimesheetWeekRead;
  openDay: (date: string) => void;
}) {
  const { t, lang } = useDemo();
  const weekday = (date: string) =>
    new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-CA", {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  const name = (item: { name_en: string; name_fa?: string }) =>
    lang === "fa" ? item.name_fa || item.name_en : item.name_en;
  return (
    <Card className="timesheet-week" title={t("Week view", "نمای هفتگی")}>
      <p className="muted">
        <bdi dir="ltr">
          {data.start_date} → {data.end_date}
        </bdi>{" "}
        · {t("Hours by day", "ساعت‌های هر روز")}
      </p>
      <div className="timesheet-week-wide">
        <DataTable
          className="timesheet-week-table"
          columns={[
            { key: "person", required: true, width: "24%" },
            ...data.dates.map((date) => ({ key: date, required: true })),
            { key: "total", required: true },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Name / department", "نام / بخش")}</th>
              {data.dates.map((date) => (
                <th key={date}>
                  <span>{weekday(date)}</span>
                  <small>
                    <bdi dir="ltr">{date.slice(5)}</bdi>
                  </small>
                </th>
              ))}
              <th>{t("Total", "جمع")}</th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map((person) => (
              <tr key={`${person.department_key}:${person.staff_id}`}>
                <td>
                  <strong>{name(person)}</strong>
                  <small className="muted">
                    {lang === "fa"
                      ? person.department_name_fa
                      : person.department_name_en}
                  </small>
                </td>
                {person.days.map((day) => (
                  <td key={day.date}>
                    <Button
                      variant="plain"
                      className="timesheet-week-cell"
                      aria-label={`${name(person)} · ${day.date} · ${timesheetMinutesText(day.minutes, lang)}`}
                      onClick={() => openDay(day.date)}
                    >
                      <bdi dir="ltr">{hours(day.minutes)}</bdi>
                    </Button>
                  </td>
                ))}
                <td>
                  <strong>
                    <bdi dir="ltr">{hours(person.minutes)}</bdi>
                  </strong>
                </td>
              </tr>
            ))}
            {data.departments.map((department) => (
              <tr key={department.key} className="timesheet-week-subtotal">
                <td>{name(department)}</td>
                {department.days.map((minutes, index) => (
                  <td key={data.dates[index]}>
                    <bdi dir="ltr">{hours(minutes)}</bdi>
                  </td>
                ))}
                <td>
                  <strong>
                    <bdi dir="ltr">{hours(department.minutes)}</bdi>
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>{t("Week total", "جمع هفته")}</th>
              {data.days.map((minutes, index) => (
                <th key={data.dates[index]}>
                  <bdi dir="ltr">{hours(minutes)}</bdi>
                </th>
              ))}
              <th data-week-total-minutes={data.minutes}>
                <bdi dir="ltr">{hours(data.minutes)}</bdi>
              </th>
            </tr>
          </tfoot>
        </DataTable>
      </div>
      <div className="timesheet-week-phone">
        {data.staff.map((person) => (
          <section
            key={`${person.department_key}:${person.staff_id}`}
            className="timesheet-week-person"
          >
            <header>
              <div>
                <strong>{name(person)}</strong>
                <small className="muted">
                  {lang === "fa"
                    ? person.department_name_fa
                    : person.department_name_en}
                </small>
              </div>
              <strong>{timesheetMinutesText(person.minutes, lang)}</strong>
            </header>
            <div className="timesheet-week-days">
              {person.days.map((day) => (
                <Button
                  variant="plain"
                  key={day.date}
                  className="timesheet-week-cell"
                  onClick={() => openDay(day.date)}
                  aria-label={`${name(person)} · ${day.date} · ${timesheetMinutesText(day.minutes, lang)}`}
                >
                  <span>
                    {weekday(day.date)} <bdi dir="ltr">{day.date.slice(5)}</bdi>
                  </span>
                  <strong>
                    <bdi dir="ltr">{hours(day.minutes)}</bdi>
                  </strong>
                </Button>
              ))}
            </div>
          </section>
        ))}
        <div className="timesheet-week-summary">
          {data.departments.map((department) => (
            <p key={department.key}>
              <span>{name(department)}</span>
              <strong>{timesheetMinutesText(department.minutes, lang)}</strong>
            </p>
          ))}
          <p>
            <strong>{t("Week total", "جمع هفته")}</strong>
            <strong data-week-total-minutes={data.minutes}>
              {timesheetMinutesText(data.minutes, lang)}
            </strong>
          </p>
        </div>
      </div>
      {!data.staff.length && (
        <p className="muted">
          {t(
            "No shifts this week. Open a day to add someone.",
            "شیفتی در این هفته نیست. برای افزودن فرد یک روز را باز کنید.",
          )}
        </p>
      )}
    </Card>
  );
}
