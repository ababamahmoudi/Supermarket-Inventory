import Decimal from "decimal.js";
import type { HistoryPath } from "./history";
import type { Activity, Language, Product } from "./types";

export interface HistoryDisplayChange {
  path: HistoryPath;
  field: string;
  before?: unknown;
  after?: unknown;
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Audit identity, storage and timestamps remain recorded, but are not a useful
// replacement for the business values that changed.
const metadata = new Set([
  "id",
  "company_id",
  "branch_id",
  "actor_username",
  "device",
  "version",
  "revision",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "at",
  "source_keys",
  "source_invoice_id",
  "invoice_ids",
  "linked_invoice_ids",
  "file",
  "files",
  "file_data",
  "file_name",
  "file_type",
  "file_size",
  "original",
  "original_file",
  "original_file_invoice_id",
  "demo_original_snapshot",
  "legacy_demo_original",
  "photo",
  "photos",
  "attachment",
  "attachments",
  "data_url",
  "preview_data_url",
  "blob",
  "logo_data",
  "prototype_history_dictionary",
  "__c6_history_ref",
]);

function fieldFor(path: HistoryPath): string {
  const names = path.filter((part): part is string => typeof part === "string");
  const last = names.at(-1) ?? "record";
  return names.at(-2) === "branch_prices" ? "branch_prices" : last;
}

export function historyChangeIsMoney(change: HistoryDisplayChange): boolean {
  return /(?:^|_)(?:price|prices|cost|amount|total)(?:_|$)/.test(change.field);
}

function equalValue(before: unknown, after: unknown, field: string): boolean {
  if (Object.is(before, after)) return true;
  if (
    /(?:^|_)(?:price|prices|cost|amount|total)(?:_|$)/.test(field) &&
    typeof before === "string" &&
    typeof after === "string" &&
    /^-?\d+(?:\.\d+)?$/.test(before) &&
    /^-?\d+(?:\.\d+)?$/.test(after)
  )
    return new Decimal(before).eq(after);
  return false;
}

function collect(
  before: unknown,
  after: unknown,
  path: HistoryPath,
  changes: HistoryDisplayChange[],
): void {
  const last = String(path.at(-1));
  if (
    path.length > 10 ||
    metadata.has(last) ||
    /_ids?$|_username$|_at$/.test(last)
  )
    return;
  if (Object.is(before, after)) return;
  if (record(before) || record(after)) {
    const previous = record(before) ? before : {};
    const next = record(after) ? after : {};
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)]))
      collect(
        previous[key],
        next[key],
        [...path, ...key.split(" · ")],
        changes,
      );
    return;
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    const previous = Array.isArray(before) ? before : [];
    const next = Array.isArray(after) ? after : [];
    const all = [...previous, ...next];
    const identity = ["id", "key", "code"].find(
      (key) =>
        all.length > 0 &&
        all.every((item) => record(item) && typeof item[key] === "string"),
    );
    if (identity) {
      const ids = new Set(all.map((item) => String(item[identity])));
      for (const id of ids)
        collect(
          previous.find((item) => item[identity] === id),
          next.find((item) => item[identity] === id),
          [...path, { key: identity, value: id }],
          changes,
        );
    } else {
      for (
        let index = 0;
        index < Math.max(previous.length, next.length);
        index++
      )
        collect(
          previous[index],
          next[index],
          [...path, String(index)],
          changes,
        );
    }
    return;
  }
  const field = fieldFor(path);
  if (equalValue(before, after, field)) return;
  if (before === undefined && after === undefined) return;
  changes.push({ path, field, before, after });
}

function priority(change: HistoryDisplayChange): number {
  if (
    /^(selling_price|branch_prices|sale_price|regular_price|price)$/.test(
      change.field,
    )
  )
    return 0;
  if (historyChangeIsMoney(change)) return 1;
  if (/^(name|name_en|name_fa|text)$/.test(change.field)) return 2;
  if (change.field === "status") return 3;
  return 4;
}

/** Display evidence never grants Undo/Revert or reads a present-day old price. */
export function historyDisplayChanges(entry: Activity): HistoryDisplayChange[] {
  const changes: HistoryDisplayChange[] = [];
  for (const patch of entry.reversal ?? [])
    collect(patch.before, patch.after, patch.path, changes);
  if (!changes.length) {
    const scalarField = /price|sale|offer/i.test(entry.action)
      ? "price"
      : "record";
    collect(entry.before, entry.after, [scalarField], changes);
  }
  return changes.sort((a, b) => priority(a) - priority(b));
}

export function historyProductName(
  products: readonly Pick<
    Product,
    "company_id" | "code" | "name_en" | "name_fa"
  >[],
  entry: Activity,
  company: string,
  language: Language,
): string | undefined {
  if (entry.company_id !== company) return undefined;
  for (const snapshot of [entry.after, entry.before]) {
    const candidate =
      record(snapshot) && record(snapshot.product)
        ? snapshot.product
        : record(snapshot) && snapshot.code === entry.product_code
          ? snapshot
          : undefined;
    if (
      !candidate ||
      (candidate.company_id && candidate.company_id !== company) ||
      (candidate.code && candidate.code !== entry.product_code)
    )
      continue;
    const name =
      language === "fa"
        ? candidate.name_fa || candidate.name_en
        : candidate.name_en;
    if (typeof name === "string" && name) return name;
  }
  const product = products.find(
    (item) => item.company_id === company && item.code === entry.product_code,
  );
  return product
    ? language === "fa"
      ? product.name_fa || product.name_en
      : product.name_en
    : undefined;
}
