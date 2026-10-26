import { createPortal } from "react-dom";
import { branchLabel } from "../settings";
import type { CompanyConfig } from "../types";
import type { TimesheetDayRead, TimesheetWeekRead } from "../timesheets";
import "./timesheet-print.css";

type Config = Pick<CompanyConfig, "company" | "branches">;
function Header({
  config,
  branch,
  date,
  week = false,
}: {
  config: Config;
  branch: string;
  date: string;
  week?: boolean;
}) {
  const dayEn = week
    ? "Monday–Sunday"
    : new Intl.DateTimeFormat("en-CA", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`));
  const dayFa = week
    ? "دوشنبه تا یکشنبه"
    : new Intl.DateTimeFormat("fa-IR", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`));
  return (
    <header className="timesheet-paper-header" dir="ltr">
      <div>
        <div>
          <strong>Date</strong>
          <span lang="fa" dir="rtl">
            تاریخ
          </span>
        </div>
        <bdi dir="ltr">{date}</bdi>
      </div>
      <div>
        <div>
          <strong>Branch</strong>
          <span lang="fa" dir="rtl">
            شعبه
          </span>
        </div>
        <span>
          {branchLabel(config, branch, "en")} ·{" "}
          <span lang="fa" dir="rtl">
            {branchLabel(config, branch, "fa")}
          </span>
        </span>
      </div>
      <div>
        <div>
          <strong>{week ? "Week" : "Day"}</strong>
          <span lang="fa" dir="rtl">
            {week ? "هفته" : "روز"}
          </span>
        </div>
        <span>
          {dayEn} ·{" "}
          <span lang="fa" dir="rtl">
            {dayFa}
          </span>
        </span>
      </div>
    </header>
  );
}
function DayPaper({
  data,
  config,
}: {
  data: TimesheetDayRead;
  config: Config;
}) {
  const paperLayout = data.departments.length === 8;
  return (
    <article className="timesheet-paper-document" data-print-date={data.date}>
      <Header config={config} branch={data.branch} date={data.date} />
      <div
        className={`timesheet-paper-grid${paperLayout ? " is-eight" : ""}`}
        dir="ltr"
      >
        {data.departments.map((department, index) => {
          const emptyRows = Math.max(
            0,
            (paperLayout ? (index < 3 ? 10 : index < 6 ? 3 : 8) : 4) -
              department.rows.length,
          );
          return (
            <section
              className="timesheet-paper-department"
              key={department.key}
              data-print-department={department.key}
            >
              <h2>
                <span lang="fa" dir="rtl">
                  {department.name_fa}
                </span>
                <span>{department.name_en}</span>
              </h2>
              <table dir="rtl">
                <thead>
                  <tr>
                    <th>
                      <span lang="fa">اسم</span>
                      <span>Name</span>
                    </th>
                    <th>
                      <span lang="fa">ورود</span>
                      <span>In</span>
                    </th>
                    <th>
                      <span lang="fa">خروج</span>
                      <span>Out</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {department.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span>{row.name_en}</span>
                        {row.name_fa && (
                          <small lang="fa" dir="rtl">
                            {row.name_fa}
                          </small>
                        )}
                      </td>
                      <td>
                        <bdi dir="ltr">{row.in_time || " "}</bdi>
                      </td>
                      <td>
                        <bdi dir="ltr">{row.out_time || " "}</bdi>
                        {row.overnight && (
                          <small>
                            +1 day · <span lang="fa">روز بعد</span>
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: emptyRows }, (_, i) => (
                    <tr key={`blank-${i}`} aria-hidden="true">
                      <td>{"\u00a0"}</td>
                      <td>{"\u00a0"}</td>
                      <td>{"\u00a0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
        <section className="timesheet-paper-notes">
          <h2>
            <span lang="fa" dir="rtl">
              توضیحات
            </span>
            <span>Notes</span>
          </h2>
          <p dir="auto">{data.day?.notes || " "}</p>
          {Array.from({ length: 7 }, (_, index) => (
            <div className="timesheet-paper-note-line" key={index} />
          ))}
        </section>
      </div>
      <footer>Made with Klead</footer>
    </article>
  );
}
function WeekPaper({
  data,
  config,
}: {
  data: TimesheetWeekRead;
  config: Config;
}) {
  const duration = (minutes: number) =>
    `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <article className="timesheet-paper-document is-week">
      <Header
        config={config}
        branch={data.branch}
        date={data.start_date}
        week
      />
      <p>
        {data.start_date} → {data.end_date}
      </p>
      <table className="timesheet-paper-week-table" dir="ltr">
        <thead>
          <tr>
            <th>
              Name · Department
              <br />
              <span lang="fa">نام · بخش</span>
            </th>
            {data.dates.map((date) => (
              <th key={date}>
                {new Intl.DateTimeFormat("en-CA", {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(`${date}T12:00:00Z`))}
                <br />
                {date.slice(5)}
              </th>
            ))}
            <th>
              Total
              <br />
              <span lang="fa">جمع</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.staff.map((person) => (
            <tr key={person.staff_id}>
              <td>
                {person.name_en}
                {person.name_fa && (
                  <small lang="fa" dir="rtl">
                    {person.name_fa}
                  </small>
                )}
                <small>
                  {person.department_name_en} ·{" "}
                  <span lang="fa">{person.department_name_fa}</span>
                </small>
              </td>
              {person.days.map((day) => (
                <td key={day.date}>{duration(day.minutes)}</td>
              ))}
              <td>
                <strong>{duration(person.minutes)}</strong>
              </td>
            </tr>
          ))}
          {data.departments.map((department) => (
            <tr key={department.key}>
              <th>
                {department.name_en} ·{" "}
                <span lang="fa">{department.name_fa}</span>
              </th>
              {department.days.map((minutes, index) => (
                <td key={data.dates[index]}>{duration(minutes)}</td>
              ))}
              <th>{duration(department.minutes)}</th>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>
              Week total · <span lang="fa">جمع هفته</span>
            </th>
            {data.days.map((minutes, index) => (
              <th key={data.dates[index]}>{duration(minutes)}</th>
            ))}
            <th>{duration(data.minutes)}</th>
          </tr>
        </tfoot>
      </table>
      <footer>Made with Klead</footer>
    </article>
  );
}
export default function TimesheetPrint({
  snapshot,
  config,
}: {
  snapshot: { day: TimesheetDayRead; week: TimesheetWeekRead | null };
  config: Config;
}) {
  return createPortal(
    <div
      className="timesheet-print-output"
      aria-label="Timesheet print document"
    >
      {snapshot.week ? (
        <WeekPaper data={snapshot.week} config={config} />
      ) : (
        <DayPaper data={snapshot.day} config={config} />
      )}
    </div>,
    document.body,
  );
}
