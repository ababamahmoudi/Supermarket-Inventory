import { useEffect, useState } from "react";
import type { TimesheetRowRead } from "../timesheets";

type LocalClock = { date: string; time: string };

/** Elapsed time is a display hint for today's open shift, never completed payroll. */
export function timesheetRowDisplay(
  row: Pick<TimesheetRowRead, "date" | "in_time" | "out_time" | "minutes">,
  clock: LocalClock,
): { minutes: number; so_far: boolean } {
  const timeMinutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]),
      minutes = Number(match[2]);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  };
  const start = timeMinutes(row.in_time),
    current = timeMinutes(clock.time);
  if (
    row.date === clock.date &&
    !row.out_time &&
    start !== null &&
    current !== null &&
    start <= current
  )
    return { minutes: current - start, so_far: true };
  return { minutes: row.minutes, so_far: false };
}

export function timesheetDisplaySummary(
  rows: Pick<
    TimesheetRowRead,
    "date" | "in_time" | "out_time" | "minutes" | "staff_id"
  >[],
  clock: LocalClock,
): { minutes: number; on_shift: number } {
  const current = new Set<string>();
  const minutes = rows.reduce((sum, row) => {
    const display = timesheetRowDisplay(row, clock);
    if (display.so_far) current.add(row.staff_id);
    return sum + display.minutes;
  }, 0);
  return { minutes, on_shift: current.size };
}

/** Refresh presentation at minute boundaries without writing a time or changing the selected day. */
export function useTimesheetDisplayClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 5,
      );
    };
    const refresh = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    schedule();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return now;
}
