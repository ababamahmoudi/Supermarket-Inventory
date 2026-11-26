import Decimal from "decimal.js";
import type { PriceSnapshot, PriceUpdateTask } from "./price-updates";

/** Quote a CSV cell; a leading formula character is neutralized for spreadsheets. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function money(snapshot: PriceSnapshot): string {
  try {
    return snapshot.price === null
      ? ""
      : new Decimal(snapshot.price).toFixed(2);
  } catch {
    return "";
  }
}

/**
 * PR 29 (Ali, 2026-11-20): Export CSV saves exactly the price updates the
 * filters show — product, code, old and new price, location, and who/when for
 * Seen and Done.
 */
export function priceUpdatesCsv(
  tasks: readonly PriceUpdateTask[],
  labels: {
    product(task: PriceUpdateTask): string;
    location(task: PriceUpdateTask): string;
    stamp(at: string): string;
  },
): string {
  const header = [
    "Product",
    "Code",
    "Old price",
    "New price",
    "Location",
    "Seen by",
    "Seen at",
    "Done by",
    "Done at",
  ];
  const rows = tasks.map((task) => {
    const seen = task.seen;
    return [
      labels.product(task),
      task.product_code,
      money(task.old_price),
      money(task.new_price),
      labels.location(task),
      seen?.by ?? "",
      seen ? labels.stamp(seen.at) : "",
      task.completed_by ?? "",
      task.completed_at ? labels.stamp(task.completed_at) : "",
    ];
  });
  return [header, ...rows]
    .map((row) => row.map((value) => cell(String(value))).join(","))
    .join("\r\n");
}
