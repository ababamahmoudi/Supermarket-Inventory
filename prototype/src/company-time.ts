import type { CompanyConfig } from "./types";

export class CompanyLocalTimeError extends Error {
  constructor(public readonly code: "date" | "time" | "nonexistent") {
    super(code);
  }
}

/** Formatting and entry use the configured store zone; persisted instants stay UTC. */
export function companyDateTime(
  config: CompanyConfig,
  value: string | Date | undefined,
): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function companyTimestampText(
  config: CompanyConfig,
  value?: string,
): string {
  const local = companyDateTime(config, value);
  return local.date ? `${local.date} ${local.time}` : "—";
}

export function companyCalendarDate(
  config: CompanyConfig,
  value?: string,
): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : companyDateTime(config, value).date;
}

/** Reject DST gaps. Preserve a retained ambiguous instant, otherwise use the earlier occurrence. */
export function companyLocalToUtc(
  config: CompanyConfig,
  date: string,
  time: string,
  preferred?: string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new CompanyLocalTimeError("date");
  const noon = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(noon.getTime()) ||
    noon.toISOString().slice(0, 10) !== date
  )
    throw new CompanyLocalTimeError("date");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new CompanyLocalTimeError("time");
  const matches = (value: string | Date) => {
    const local = companyDateTime(config, value);
    return local.date === date && local.time === time;
  };
  if (preferred && matches(preferred)) return preferred;
  const wall = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = new Date(wall + hours * 3_600_000);
    const local = companyDateTime(config, probe);
    offsets.add(
      Date.parse(`${local.date}T${local.time}:00Z`) - probe.getTime(),
    );
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wall - offset))
    .filter(matches)
    .sort((left, right) => left.getTime() - right.getTime());
  if (!candidates.length) throw new CompanyLocalTimeError("nonexistent");
  return candidates[0].toISOString();
}
