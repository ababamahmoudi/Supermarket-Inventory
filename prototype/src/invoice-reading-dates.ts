import { companyLocalToUtc } from "./company-time";
import type { CompanyConfig } from "./types";

export type ImportedReceivedSource =
  "handwriting" | "invoice_date" | "unresolved";

/** Imported papers describe a past delivery; never invent an import-time delivery. */
export function importedReadingReceived(
  config: Pick<CompanyConfig, "company">,
  reading: Record<string, unknown>,
): { received_at: string; source: ImportedReceivedSource } {
  const invoiceDate = String(reading.invoice_date ?? "").trim();
  const notes = Array.isArray(reading.handwritten_notes)
    ? reading.handwritten_notes
        .filter((value): value is string => typeof value === "string")
        .join("\n")
    : "";
  const normalized = notes.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(
      "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0
        ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
        : "٠١٢٣٤٥٦٧٨٩".indexOf(digit),
    ),
  );
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const candidates: { date: string; end: number; start: number }[] = [];
  for (const match of normalized.matchAll(
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,
  ))
    candidates.push({
      date: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
      start: match.index!,
      end: match.index! + match[0].length,
    });
  const named =
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
  for (const match of normalized.matchAll(named)) {
    const year =
      match[3] ?? (/^\d{4}-/.test(invoiceDate) ? invoiceDate.slice(0, 4) : "");
    const month = months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
    if (year && month)
      candidates.push({
        date: `${year}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`,
        start: match.index!,
        end: match.index! + match[0].length,
      });
  }
  const instants = new Set<string>();
  for (const candidate of candidates.sort(
    (left, right) => left.start - right.start,
  )) {
    const lineStart = normalized.lastIndexOf("\n", candidate.start) + 1;
    const lineEnd = normalized.indexOf("\n", candidate.end);
    const context = normalized.slice(
      lineStart,
      lineEnd < 0 ? undefined : lineEnd,
    );
    if (
      /\b(?:expir\w*|best\s*(?:before|by)|due\s*date|phone|tel(?:ephone)?|call)\b/i.test(
        context,
      )
    )
      continue;
    const time = normalized
      .slice(candidate.end, candidate.end + 64)
      .match(/^\s*(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    let hour = time ? Number(time[1]) : 12;
    if (time?.[3]) {
      if (hour < 1 || hour > 12) continue;
      hour = (hour % 12) + (time[3].toLowerCase() === "pm" ? 12 : 0);
    }
    try {
      instants.add(
        companyLocalToUtc(
          config,
          candidate.date,
          `${String(hour).padStart(2, "0")}:${time?.[2] ?? "00"}`,
        ),
      );
    } catch {
      /* Invalid/ambiguous paper evidence stays reviewable through the fallback. */
    }
  }
  if (instants.size === 1)
    return { received_at: [...instants][0], source: "handwriting" };
  try {
    return {
      received_at: companyLocalToUtc(config, invoiceDate, "12:00"),
      source: "invoice_date",
    };
  } catch {
    return { received_at: "", source: "unresolved" };
  }
}
