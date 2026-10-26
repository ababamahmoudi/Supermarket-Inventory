import type { NotificationReadDTO } from "./sales-projections";
import type { CompanyConfig, Language } from "./types";
import { companyDateTime } from "./company-time";

export interface NotificationGroup {
  id: string;
  notification: NotificationReadDTO;
  members: NotificationReadDTO[];
  branches: string[];
  unread: boolean;
}

/** The protected projection has already removed foreign, handled and dismissed sources. */
export function groupedNotifications(
  rows: readonly NotificationReadDTO[],
): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const row of [...rows].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )) {
    const key = row.group_key || row.id;
    const group = groups.get(key);
    if (group) {
      group.members.push(row);
      if (!group.branches.includes(row.branch)) group.branches.push(row.branch);
      group.unread ||= !row.read_at;
    } else
      groups.set(key, {
        id: row.id,
        notification: row,
        members: [row],
        branches: [row.branch],
        unread: !row.read_at,
      });
  }
  return [...groups.values()];
}

/** Gregorian weekday in the configured company zone, always a 24-hour clock. */
export function notificationTimestamp(
  config: Pick<CompanyConfig, "company">,
  value: string,
  lang: Language,
  now = new Date(),
): string {
  const date = companyDateTime(config, value);
  if (!date.date) return "—";
  const today = companyDateTime(config, now).date;
  const day =
    date.date === today
      ? lang === "fa"
        ? "امروز"
        : "Today"
      : new Intl.DateTimeFormat(
          lang === "fa" ? "fa-IR-u-ca-gregory" : "en-CA",
          { timeZone: config.company.timezone, weekday: "short" },
        ).format(new Date(value));
  return `${day} ${date.time}`;
}
