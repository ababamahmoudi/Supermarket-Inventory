import Decimal from "decimal.js";
import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { requireCapability } from "./permissions";
import { branchId, configuredBranches } from "./settings";
import {
  createInvoice,
  dateAfter,
  rememberInvoiceSupplierItem,
} from "./invoice";
import { paymentTermsDays } from "./invoice-entry";
import { importedReadingReceived } from "./invoice-reading-dates";
import {
  saveSupplier,
  supplierMatches,
  supplierRecords,
} from "./supplier-editor";
import { regularPrice } from "./catalog";
import { invoiceLineCalculation, refreshInvoiceWeight } from "./invoice-weight";
import { trackingChoiceForProduct } from "./date-tracking";
import {
  fillCalculatedInvoiceTotals,
  invoiceCheckCount,
} from "./invoice-checks";
import { storeUploadedFile, type FileRepository } from "./file-database";
import { createId } from "./ids";
import type {
  DemoInvoice,
  DemoState,
  InvoiceLine,
  Product,
  SupplierRecord,
} from "./types";

export type ImportMode = "ai" | "checked";
type Scalar = string | number | boolean | null;
export interface InvoiceReadingLine {
  [key: string]: Scalar | string[] | undefined;
  line_type?: string | null;
}
export interface InvoiceReading {
  [key: string]: Scalar | string[] | InvoiceReadingLine[] | undefined;
  lines?: InvoiceReadingLine[];
}
export interface ExportedInvoiceReading {
  id: string;
  file_name: string;
  pages: { page: number; mime: string; data: string }[];
  original_sha256: string[];
  ai_reading: InvoiceReading | null;
  ai_statuses: Record<string, "auto" | "check">;
  ai_source: string;
  ai_models: string[];
  checked_answer: InvoiceReading | null;
  reading_cost_usd: string;
}
export interface InvoiceReadingsExport {
  format: "super-arzon-invoice-readings";
  version: 1;
  reading_schema: "invoice-reading-v2";
  exported_at: string;
  invoices: ExportedInvoiceReading[];
}
export type ReadingImportErrorCode =
  | "invalid_json"
  | "format"
  | "version"
  | "schema"
  | "invalid_file"
  | "invalid_number"
  | "pages";
export class ReadingImportError extends Error {
  constructor(
    readonly code: ReadingImportErrorCode,
    detail?: string,
  ) {
    super(
      detail ??
        {
          invalid_json: "This file isn't valid JSON.",
          format:
            "This isn't an invoice-readings file from the invoice-reader kit.",
          version:
            "This invoice-readings file uses an unsupported version. Version 1 is required.",
          schema:
            "This file doesn't use the invoice-reading-v2 reading schema.",
          invalid_file: "The invoice-readings file is incomplete or damaged.",
          invalid_number: "The file contains an invalid number.",
          pages:
            "An invoice page or its original SHA-256 is missing or invalid.",
        }[code],
    );
    this.name = "ReadingImportError";
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
function decimal(value: unknown, places?: number): string {
  if (value === null || value === undefined || value === "") return "";
  const string = text(value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(string))
    throw new ReadingImportError("invalid_number");
  const result = new Decimal(string);
  if (!result.isFinite()) throw new ReadingImportError("invalid_number");
  return places === undefined
    ? result.toString()
    : result.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}
const numericFields = new Set([
  "subtotal",
  "tax",
  "final_total",
  "quantity",
  "units_per_case",
  "unit_cost_before_tax",
  "line_total",
  "units_received",
  "cost_per_unit_before_tax",
  "cost_per_case_before_tax",
]);
function reading(value: unknown): InvoiceReading | null {
  if (value == null) return null;
  if (
    !object(value) ||
    (value.lines !== undefined && !Array.isArray(value.lines))
  )
    throw new ReadingImportError("invalid_file");
  const normalize = (source: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(source).map(([key, item]) => [
        key,
        numericFields.has(key) ? (item == null ? null : decimal(item)) : item,
      ]),
    );
  const result = normalize(value);
  if (value.lines !== undefined)
    result.lines = (value.lines as unknown[]).map((line) => {
      if (!object(line)) throw new ReadingImportError("invalid_file");
      return normalize(line);
    });
  return result as InvoiceReading;
}

/** Pure parsing runs in the import worker; monetary calculations always use Decimal. */
export function parseInvoiceReadings(source: string): InvoiceReadingsExport {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ReadingImportError("invalid_json");
  }
  if (!object(value) || value.format !== "super-arzon-invoice-readings")
    throw new ReadingImportError("format");
  if (value.version !== 1) throw new ReadingImportError("version");
  if (value.reading_schema !== "invoice-reading-v2")
    throw new ReadingImportError("schema");
  if (!Array.isArray(value.invoices) || !text(value.exported_at))
    throw new ReadingImportError("invalid_file");
  const ids = new Set<string>();
  const invoices = value.invoices.map((entry): ExportedInvoiceReading => {
    if (
      !object(entry) ||
      !text(entry.id) ||
      ids.has(text(entry.id)) ||
      !text(entry.file_name)
    )
      throw new ReadingImportError("invalid_file");
    ids.add(text(entry.id));
    if (
      !Array.isArray(entry.pages) ||
      !entry.pages.length ||
      !Array.isArray(entry.original_sha256) ||
      entry.pages.length !== entry.original_sha256.length
    )
      throw new ReadingImportError("pages");
    const originalHashes = entry.original_sha256;
    const pages = entry.pages.map((page, index) => {
      if (
        !object(page) ||
        page.page !== index + 1 ||
        typeof page.mime !== "string" ||
        !/^image\/(jpeg|png|webp|gif)$/.test(page.mime) ||
        typeof page.data !== "string" ||
        !page.data ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(page.data) ||
        page.data.length % 4 !== 0 ||
        !/^[a-f\d]{64}$/i.test(String(originalHashes[index]))
      )
        throw new ReadingImportError("pages");
      return { page: index + 1, mime: page.mime, data: page.data };
    });
    const statuses: Record<string, "auto" | "check"> = {};
    if (entry.ai_statuses != null && !object(entry.ai_statuses))
      throw new ReadingImportError("invalid_file");
    for (const [key, status] of Object.entries(entry.ai_statuses ?? {}))
      if (status === "auto" || status === "check") statuses[key] = status;
    return {
      id: text(entry.id),
      file_name: text(entry.file_name),
      pages,
      original_sha256: entry.original_sha256.map((hash) =>
        String(hash).toLowerCase(),
      ),
      ai_reading: reading(entry.ai_reading),
      checked_answer: reading(entry.checked_answer),
      ai_statuses: statuses,
      ai_source: text(entry.ai_source),
      ai_models: list(entry.ai_models),
      reading_cost_usd: decimal(entry.reading_cost_usd, 4),
    };
  });
  return {
    format: value.format,
    version: 1,
    reading_schema: value.reading_schema,
    exported_at: text(value.exported_at),
    invoices,
  };
}

/** An absent checked field retains both its AI value and its AI uncertainty. */
export function effectiveInvoiceReading(
  entry: ExportedInvoiceReading,
  mode: ImportMode,
): {
  reading: InvoiceReading | null;
  statuses: Record<string, "auto" | "check">;
  using_checked: boolean;
} {
  const statuses = { ...entry.ai_statuses };
  if (mode !== "checked" || !entry.checked_answer)
    return { reading: entry.ai_reading, statuses, using_checked: false };
  const checked = entry.checked_answer;
  const merged = { ...entry.ai_reading, ...checked };
  merged.lines = Array.from(
    {
      length: Math.max(
        entry.ai_reading?.lines?.length ?? 0,
        checked.lines?.length ?? 0,
      ),
    },
    (_, index) => {
      const line = entry.ai_reading?.lines?.[index];
      const answer = checked.lines?.[index],
        result = { ...line, ...answer };
      if (
        answer &&
        ["unit_cost_before_tax", "units_per_case", "cost_basis", "unit"].some(
          (field) => Object.hasOwn(answer, field),
        )
      ) {
        if (!Object.hasOwn(answer, "cost_per_unit_before_tax"))
          delete result.cost_per_unit_before_tax;
        if (!Object.hasOwn(answer, "cost_per_case_before_tax"))
          delete result.cost_per_case_before_tax;
      }
      if (
        answer &&
        (Object.hasOwn(answer, "quantity") ||
          Object.hasOwn(answer, "units_per_case") ||
          Object.hasOwn(answer, "unit")) &&
        !Object.hasOwn(answer, "units_received")
      )
        delete result.units_received;
      return result;
    },
  );
  for (const key of Object.keys(checked))
    if (key !== "lines") delete statuses[`header.${key}`];
  for (const [index, line] of (checked.lines ?? []).entries())
    for (const key of Object.keys(line))
      delete statuses[`lines[${index}].${key}`];
  return { reading: merged, statuses, using_checked: true };
}

export function normalizeReadingName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function normalizeSupplierName(value: string): string {
  return normalizeReadingName(value).replace(
    /(?:\s+(?:incorporated|inc|limited|ltd|company|co|corporation|corp))+$/g,
    "",
  );
}
export function matchReadingSupplier(
  state: DemoState,
  value: InvoiceReading,
): SupplierRecord | undefined {
  const records = supplierRecords(state).filter(
    (supplier) => supplier.company_id === state.config.company.seed_key,
  );
  const tax = normalizeReadingName(text(value.supplier_tax_number)).replace(
    / /g,
    "",
  );
  return (
    (tax
      ? records.find(
          (supplier) =>
            normalizeReadingName(supplier.tax_number ?? "").replace(
              / /g,
              "",
            ) === tax,
        )
      : undefined) ??
    records.find(
      (supplier) =>
        normalizeSupplierName(supplier.name) ===
          normalizeSupplierName(text(value.supplier_name)) ||
        supplier.previous_names?.some(
          (name) =>
            normalizeSupplierName(name) ===
            normalizeSupplierName(text(value.supplier_name)),
        ),
    )
  );
}
function allInvoices(state: DemoState): DemoInvoice[] {
  return [
    ...new Map(
      [...(state.invoices ?? []), state.invoice]
        .filter(
          (invoice) => invoice.company_id === state.config.company.seed_key,
        )
        .map((invoice) => [invoice.id, invoice]),
    ).values(),
  ];
}
export function matchReadingProduct(
  state: DemoState,
  supplier: SupplierRecord | undefined,
  line: InvoiceReadingLine,
): Product | undefined {
  const products = state.products.filter(
    (product) =>
      product.company_id === state.config.company.seed_key &&
      product.status !== "archived",
  );
  const code = text(line.supplier_sku),
    barcode = text(line.barcode),
    name = normalizeReadingName(text(line.description));
  if (supplier && code) {
    const binding = state.supplier_items?.find(
      (item) =>
        item.company_id === supplier.company_id &&
        item.supplier_id === supplier.id &&
        !item.archived &&
        item.supplier_item_code === code,
    );
    const existing =
      binding &&
      products.find((product) => product.code === binding.product_code);
    if (existing) return existing;
    for (const invoice of allInvoices(state).filter((invoice) =>
      supplierMatches(supplier, invoice.supplier),
    )) {
      const prior = invoice.lines.find(
        (item) => item.supplier_item_code === code,
      );
      const product =
        prior &&
        products.find((product) => product.code === prior.product_code);
      if (product) return product;
    }
  }
  if (barcode) {
    const product = products.find((product) => product.barcode === barcode);
    if (product) return product;
    for (const invoice of allInvoices(state)) {
      const prior = invoice.lines.find((item) => item.barcode === barcode);
      const matched =
        prior && products.find((item) => item.code === prior.product_code);
      if (matched) return matched;
    }
  }
  if (!name) return undefined;
  const direct = products.find((product) =>
    [product.name_en, product.name_fa].some(
      (value) => value && normalizeReadingName(value) === name,
    ),
  );
  if (direct) return direct;
  for (const invoice of allInvoices(state)) {
    const previous = invoice.lines.find(
      (item) => normalizeReadingName(item.description) === name,
    );
    const product =
      previous &&
      products.find((product) => product.code === previous.product_code);
    if (product) return product;
  }
  return undefined;
}
export function suggestReadingLocation(
  state: DemoState,
  value: InvoiceReading,
  currentLocation: string,
): string | null {
  const input = normalizeReadingName(
    `${text(value.branch_hint)} ${text(value.bill_to)}`,
  );
  const matches = state.config.branches.flatMap((branch, index) => {
    if (branch.active === false) return [];
    const labels = [
      branch.name_en,
      branch.name_fa,
      branch.address,
      branch.address?.split(/[,\n]/)[0],
    ]
      .filter(Boolean)
      .map((label) => normalizeReadingName(label!));
    return labels.some((label) => label && input.includes(label))
      ? [branchId(branch, index)]
      : [];
  });
  if (matches.length === 1) return matches[0];
  return currentLocation !== "all" &&
    configuredBranches(state.config).includes(currentLocation)
    ? currentLocation
    : null;
}
export function readingDuplicateReason(
  state: DemoState,
  entry: ExportedInvoiceReading,
  value: InvoiceReading,
): "invoice_number" | "page_sha256" | undefined {
  const invoices = allInvoices(state);
  if (
    invoices.some(
      (invoice) =>
        invoice.reading_record?.page_sha256s.some((hash) =>
          entry.original_sha256.includes(hash),
        ) ||
        invoice.original_pages?.some((page) =>
          entry.original_sha256.includes(page.original_sha256),
        ) ||
        entry.original_sha256.some((hash) =>
          invoice.file_data?.endsWith(`:${hash}`),
        ),
    )
  )
    return "page_sha256";
  const supplier = matchReadingSupplier(state, value),
    number = text(value.supplier_invoice_number);
  if (
    supplier &&
    number &&
    invoices.some(
      (invoice) =>
        invoice.supplier_invoice_number === number &&
        supplierMatches(supplier, invoice.supplier),
    )
  )
    return "invoice_number";
  return undefined;
}
function requireImport(
  state: DemoState,
  actor: AuthenticatedActor,
): AuthenticatedActor {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "settings.manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
  });
  if (!["owner", "manager"].includes(actor.role))
    throw new Error("Only an Owner or Manager can import invoice readings.");
  return actor;
}
export interface ImportPreviewRow {
  id: string;
  supplier: string;
  invoice_number: string;
  invoice_date: string;
  line_count: number;
  total: string;
  location: string | null;
  checked: boolean;
  using_checked: boolean;
  check_count: number;
  duplicate_reason?: "invoice_number" | "page_sha256";
  /** These rows are alternatives in this file, not invoices already stored in the app. */
  in_file_duplicate_group?: string;
  recommended: boolean;
  error?: "missing_reading";
}

export function readingInvoiceIdentity(
  state: DemoState,
  value: InvoiceReading,
): string | undefined {
  const number = text(value.supplier_invoice_number);
  if (!number) return undefined;
  const supplier =
    matchReadingSupplier(state, value)?.id ||
    normalizeReadingName(text(value.supplier_tax_number)).replace(/ /g, "") ||
    normalizeSupplierName(text(value.supplier_name));
  return supplier ? `${supplier}:${number}` : undefined;
}

/** Optional blanks never generate a question, even when the AI marked them check. */
export function actionableReadingChecks(
  state: DemoState,
  value: InvoiceReading,
  statuses: Record<string, "auto" | "check">,
) {
  const checks = readingCheckFields(statuses, value);
  const header = {
    supplier: text(value.supplier_name),
    supplier_invoice_number: text(value.supplier_invoice_number),
    invoice_date: readingExpiryDate(text(value.invoice_date)) ?? "",
    received_at: importedReadingReceived(state.config, value).received_at,
    order_reference: text(value.order_reference),
    bill_to: text(value.bill_to),
    ship_to: text(value.ship_to) || text(value.branch_hint),
    subtotal: decimal(value.subtotal, 2),
    tax: decimal(value.tax, 2),
    final_total: decimal(value.final_total, 2),
    low_confidence_fields: [...checks.header, "received_at"],
  };
  for (const field of [
    "supplier",
    "supplier_invoice_number",
    "invoice_date",
    "final_total",
  ] as const)
    if (!header[field]) header.low_confidence_fields.push(field);
  header.low_confidence_fields = [...new Set(header.low_confidence_fields)];
  fillCalculatedInvoiceTotals(header);
  return {
    ...header,
    lines: (value.lines ?? []).map((line, index) =>
      !line.line_type || line.line_type === "item"
        ? mapReadingLine(
            state,
            matchReadingSupplier(state, value),
            line,
            index,
            checks.lines[index],
          )
        : {
            low_confidence_fields: chargeCheckFields(line, checks.lines[index]),
          },
    ),
  };
}

export function previewInvoiceReadings(
  state: DemoState,
  actor: AuthenticatedActor,
  exported: InvoiceReadingsExport,
  mode: ImportMode,
  currentLocation: string,
): ImportPreviewRow[] {
  requireImport(state, actor);
  const rows = exported.invoices.map((entry): ImportPreviewRow => {
    const effective = effectiveInvoiceReading(entry, mode),
      value = effective.reading;
    const checked = value
      ? actionableReadingChecks(state, value, effective.statuses)
      : undefined;
    return {
      id: entry.id,
      supplier: text(value?.supplier_name),
      invoice_number: text(value?.supplier_invoice_number),
      invoice_date: text(value?.invoice_date),
      line_count:
        value?.lines?.filter(
          (line) => !line.line_type || line.line_type === "item",
        ).length ?? 0,
      total: checked?.final_total ?? "",
      location: value
        ? suggestReadingLocation(state, value, currentLocation)
        : null,
      checked: Boolean(entry.checked_answer),
      using_checked: effective.using_checked,
      check_count: checked ? invoiceCheckCount(checked) : 0,
      duplicate_reason: value
        ? readingDuplicateReason(state, entry, value)
        : undefined,
      in_file_duplicate_group: value
        ? readingInvoiceIdentity(state, value)
        : undefined,
      recommended: true,
      error: value ? undefined : "missing_reading",
    };
  });
  const groups = new Map<string, ImportPreviewRow[]>();
  for (const row of rows)
    if (row.in_file_duplicate_group) {
      const group = groups.get(row.in_file_duplicate_group) ?? [];
      group.push(row);
      groups.set(row.in_file_duplicate_group, group);
    }
  for (const group of groups.values()) {
    if (group.length < 2) {
      group[0].in_file_duplicate_group = undefined;
      continue;
    }
    const best = [...group].sort(
      (a, b) =>
        b.line_count - a.line_count ||
        Number(Boolean(b.total)) - Number(Boolean(a.total)),
    )[0];
    for (const row of group) row.recommended = row.id === best.id;
  }
  return rows;
}

/** Selecting another copy replaces the selected member of that duplicate group. */
export function selectInvoiceReading(
  rows: ImportPreviewRow[],
  selected: string[],
  id: string,
  checked: boolean,
): string[] {
  const row = rows.find((row) => row.id === id);
  if (!row || row.duplicate_reason || row.error) return selected;
  const others = selected.filter(
    (current) =>
      current !== id &&
      (!checked ||
        !row.in_file_duplicate_group ||
        rows.find((item) => item.id === current)?.in_file_duplicate_group !==
          row.in_file_duplicate_group),
  );
  return checked ? [...others, id] : others;
}

/** Gregorian or Persian full dates only; month-only printed dates remain text. */
export function readingExpiryDate(value: string): string | undefined {
  const normalized = value
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0
          ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
          : "٠١٢٣٤٥٦٧٨٩".indexOf(digit),
      ),
    )
    .trim();
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(normalized);
  if (iso) {
    const [, year, month, day] = iso;
    const y = Number(year),
      m = Number(month),
      d = Number(day);
    if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
    if (y >= 1200 && y <= 1600) {
      const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
        timeZone: "UTC",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      // A bounded search uses the runtime's Persian calendar, including leap years.
      const start = Date.UTC(y + 621, 2, 1);
      for (let offset = 0; offset < 400; offset++) {
        const date = new Date(start + offset * 86400000),
          parts = formatter.formatToParts(date);
        const part = (key: string) =>
          Number(parts.find((item) => item.type === key)?.value);
        if (part("year") === y && part("month") === m && part("day") === d)
          return date.toISOString().slice(0, 10);
      }
      return undefined;
    }
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) &&
      new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
      ? date
      : undefined;
  }
  const named = /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})$/.exec(normalized);
  if (!named) return undefined;
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
    ],
    month = months.indexOf(named[2].slice(0, 3).toLowerCase());
  return month < 0
    ? undefined
    : readingExpiryDate(`${named[3]}-${month + 1}-${named[1]}`);
}

const lineStatusAliases: Record<string, string> = {
  supplier_sku: "supplier_item_code",
  quantity: "quantity_entered",
  unit: "quantity_unit",
  cost_per_unit_before_tax: "unit_cost_before_tax",
  cost_per_case_before_tax: "case_cost_before_tax",
  units_received: "qty_received_at_posting",
};
const headerStatusAliases: Record<string, string> = {
  supplier_name: "supplier",
  supplier_invoice_number: "supplier_invoice_number",
  invoice_date: "invoice_date",
  due_date: "due_date",
  subtotal: "subtotal",
  tax: "tax",
  final_total: "final_total",
};
const optionalReadingFields = new Set([
  "barcode",
  "lot_number",
  "expiry_as_printed",
  "handwritten_note",
  "handwritten_notes",
  "order_reference",
  "bill_to",
  "ship_to",
]);

/** Supplier pack sizes stay recognizable while ALL CAPS words become readable names. */
export function suggestInvoiceEnglishName(description: string): string {
  const normalizeSizes = (value: string) =>
    value.replace(
      /\b\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*\s*(?:kg|g|ml|l|lb|oz)\b/gi,
      (match) => match.toLowerCase(),
    );
  const source = description.trim();
  const words = source.replace(
    /\b\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*\s*(?:kg|g|ml|l|lb|oz)\b/gi,
    "",
  );
  // Preserve names that already use ordinary mixed case, including brand spelling.
  if (/\p{Ll}/u.test(words)) return normalizeSizes(source);
  return normalizeSizes(
    source
      .split(/(\s+)/)
      .map((word) => {
        if (!/\p{L}/u.test(word)) return word;
        if (
          /^(?:\d+(?:\.\d+)?\s*x\s*)*\d+(?:\.\d+)?(?:kg|g|ml|l|lb|oz)\b/i.test(
            word,
          ) ||
          /^x$/i.test(word)
        )
          return word.toLowerCase();
        return word
          .toLocaleLowerCase()
          .replace(
            /(^|[-/])([a-z])/g,
            (_match, separator: string, letter: string) =>
              separator + letter.toUpperCase(),
          );
      })
      .join(""),
  );
}

function chargeCheckFields(
  source: InvoiceReadingLine,
  statuses: string[] = [],
): string[] {
  const checks = statuses.filter((field) =>
    ["description", "line_total", "taxable"].includes(field),
  );
  if (!text(source.description)) checks.push("description");
  if (!decimal(source.line_total, 2)) checks.push("line_total");
  if (source.taxable == null) checks.push("taxable");
  return [...new Set(checks)];
}

export function readingCheckFields(
  statuses: Record<string, "auto" | "check">,
  value?: InvoiceReading,
): { header: string[]; lines: Record<number, string[]> } {
  const header: string[] = [],
    lines: Record<number, string[]> = {};
  for (const [key, status] of Object.entries(statuses)) {
    if (status !== "check") continue;
    if (key.startsWith("header.")) {
      const field = key.slice(7);
      if (field === "currency" && value && !text(value.currency)) continue;
      if (!value || !optionalReadingFields.has(field) || text(value[field]))
        header.push(headerStatusAliases[field] ?? field);
    }
    const line = /^lines\[(\d+)\]\.(.+)$/.exec(key);
    if (
      line &&
      (!value ||
        !optionalReadingFields.has(line[2]) ||
        text(value.lines?.[Number(line[1])]?.[line[2]]))
    )
      (lines[Number(line[1])] ??= []).push(
        lineStatusAliases[line[2]] ?? line[2],
      );
  }
  return {
    header: [...new Set(header)],
    lines: Object.fromEntries(
      Object.entries(lines).map(([index, keys]) => [index, [...new Set(keys)]]),
    ),
  };
}
export function mapReadingLine(
  state: DemoState,
  supplier: SupplierRecord | undefined,
  source: InvoiceReadingLine,
  index: number,
  statuses: string[] = [],
): InvoiceLine {
  const product = matchReadingProduct(state, supplier, source),
    company = state.config.company.seed_key;
  const category = product?.pricing_category ?? "",
    configCategory =
      state.config.pricing_categories.find((item) => item.key === category) ??
      state.config.pricing_categories[0];
  const defaultProfile = configCategory?.default_tax_profile ?? "non_taxable";
  const taxable =
    source.taxable === true || source.taxable === false
      ? source.taxable
      : Boolean(
          state.config.tax.profiles.find(
            (profile) => profile.key === defaultProfile,
          )?.rate &&
          new Decimal(
            state.config.tax.profiles.find(
              (profile) => profile.key === defaultProfile,
            )!.rate,
          ).gt(0),
        );
  const taxProfile =
    source.taxable == null
      ? defaultProfile
      : taxable
        ? (state.config.tax.profiles.find((profile) =>
            new Decimal(profile.rate).gt(0),
          )?.key ?? defaultProfile)
        : "non_taxable";
  const unit = text(source.unit),
    pack = decimal(source.units_per_case) || "1",
    quantity = decimal(source.quantity),
    received =
      decimal(source.units_received) ||
      (quantity
        ? new Decimal(quantity).times(unit === "case" ? pack : 1).toString()
        : "");
  if (
    !new Decimal(pack).isInteger() ||
    new Decimal(pack).lte(0) ||
    new Decimal(pack).gt(Number.MAX_SAFE_INTEGER)
  )
    throw new ReadingImportError("invalid_number");
  const printedCost = decimal(source.unit_cost_before_tax, 4);
  const derivedCost =
    printedCost && text(source.cost_basis) === "case"
      ? new Decimal(printedCost).div(pack).toFixed(4)
      : printedCost;
  const cost = decimal(source.cost_per_unit_before_tax ?? derivedCost, 4),
    caseCost =
      decimal(source.cost_per_case_before_tax, 4) ||
      (cost ? new Decimal(cost).times(pack).toFixed(4) : "");
  const checks = statuses.filter(
    (field) => !optionalReadingFields.has(field) || text(source[field]),
  );
  for (const [field, value] of Object.entries({
    description: text(source.description),
    quantity_entered: quantity,
    unit_cost_before_tax: cost,
  }))
    if (!value) checks.push(field);
  if (source.taxable == null) checks.push("taxable");
  if (unit === "other" || !["case", "each", "kg", "lb"].includes(unit))
    checks.push("quantity_unit");
  if (unit === "case" && !decimal(source.units_per_case))
    checks.push("units_per_case");
  const line: InvoiceLine = {
    id: createId("invoice-line"),
    company_id: company,
    product_code: product?.code ?? "NEW",
    description: text(source.description),
    qty_invoiced: quantity
      ? new Decimal(quantity).times(unit === "case" ? pack : 1).toNumber()
      : 0,
    qty_received_at_posting: received ? new Decimal(received).toNumber() : 0,
    qty_later_received: 0,
    unit_cost_before_tax: cost,
    line_total:
      decimal(source.line_total, 2) ||
      (cost && quantity
        ? new Decimal(cost)
            .times(quantity)
            .times(unit === "case" ? pack : 1)
            .toFixed(2)
        : ""),
    taxable,
    taxable_inferred: source.taxable == null,
    tax_profile: taxProfile,
    calculated_selling_price: "",
    current_selling_price: product ? regularPrice(state, product, "all") : null,
    demo_note: "",
    low_confidence_fields: [...new Set(checks)],
    pricing_category: category,
    review_confirmed: false,
    new_name_en: product
      ? undefined
      : suggestInvoiceEnglishName(text(source.description)),
    new_name_fa: product ? undefined : "",
    supplier_item_code: text(source.supplier_sku),
    barcode: text(source.barcode),
    pack_size: text(source.pack_size),
    units_per_case: new Decimal(pack).toNumber(),
    quantity_unit:
      unit === "case"
        ? "cases"
        : unit === "kg" || unit === "lb"
          ? unit
          : "units",
    quantity_entered: quantity,
    case_cost_before_tax: unit === "case" ? caseCost : undefined,
    sold_by: unit === "kg" || unit === "lb" ? "weight" : "each",
    lot_number: text(source.lot_number),
    handwritten_note: text(source.handwritten_note),
    expiry_as_printed: text(source.expiry_as_printed),
    import_line_index: index,
    date_tracking: trackingChoiceForProduct(product) === "yes",
    date_confirmed: true,
    line_tax: decimal(source.line_total, 2)
      ? new Decimal(decimal(source.line_total, 2))
          .times(
            state.config.tax.profiles.find(
              (profile) => profile.key === taxProfile,
            )?.rate ?? 0,
          )
          .toFixed(2)
      : "",
  };
  const expiry = readingExpiryDate(text(source.expiry_as_printed));
  if (expiry) {
    line.date_value = expiry;
    line.date_type = "expiry";
  }
  if (line.sold_by === "weight") {
    line.source_quantity = quantity;
    line.source_quantity_unit = unit as "kg" | "lb";
    line.source_received_quantity = received;
    line.source_cost_before_tax = decimal(
      source.unit_cost_before_tax ?? source.cost_per_unit_before_tax,
      4,
    );
    line.source_cost_unit = ["kg", "lb"].includes(text(source.cost_basis))
      ? (text(source.cost_basis) as "kg" | "lb")
      : (unit as "kg" | "lb");
    if (quantity && received && cost) {
      const printed = line.line_total;
      refreshInvoiceWeight(line, state.config);
      line.line_total = printed;
    }
  }
  if (category && cost)
    line.calculated_selling_price = invoiceLineCalculation(
      line,
      category,
      state.config,
    ).selling_price;
  return line;
}

export interface PreparedReadingPages {
  readonly count: number;
}
const preparedPages = new WeakMap<
  object,
  {
    company_id: string;
    invoices: Record<string, NonNullable<DemoInvoice["original_pages"]>>;
  }
>();
export async function prepareInvoiceReadingPages(
  exported: InvoiceReadingsExport,
  selectedIds: string[],
  companyId: string,
  repository?: FileRepository,
): Promise<PreparedReadingPages> {
  const invoices: Record<
    string,
    NonNullable<DemoInvoice["original_pages"]>
  > = {};
  for (const entry of exported.invoices.filter((invoice) =>
    selectedIds.includes(invoice.id),
  )) {
    invoices[entry.id] = [];
    for (const [index, page] of entry.pages.entries()) {
      const raw = atob(page.data),
        bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
      const file = Object.assign(new Blob([bytes], { type: page.mime }), {
        name:
          entry.pages.length === 1
            ? entry.file_name
            : `${entry.file_name.replace(/\.[^.]+$/, "")}-page-${index + 1}.${page.mime.split("/")[1]}`,
      });
      const stored = await storeUploadedFile(
        file,
        companyId,
        { purpose: "invoice" },
        repository,
      );
      invoices[entry.id].push({
        file_name: stored.name,
        file_type: stored.type,
        file_data: stored.reference,
        file_size: stored.size,
        original_sha256: entry.original_sha256[index],
      });
    }
  }
  const handle = Object.freeze({
    count: Object.values(invoices).reduce(
      (sum, pages) => sum + pages.length,
      0,
    ),
  });
  preparedPages.set(handle, { company_id: companyId, invoices });
  return handle;
}
export interface ImportSummary {
  imported: string[];
  skipped: { id: string; reason: string }[];
  new_suppliers: string[];
  needs_location: string[];
  other_locations?: number;
}
export interface ImportReadingsInput {
  exported: InvoiceReadingsExport;
  fileName: string;
  mode: ImportMode;
  locations: Record<string, string>;
  selectedIds: string[];
  pages: PreparedReadingPages;
  currentLocation?: string;
}
export function importInvoiceReadings(
  state: DemoState,
  actor: AuthenticatedActor,
  input: ImportReadingsInput,
  now = new Date(),
): ImportSummary {
  actor = requireImport(state, actor);
  const prepared = preparedPages.get(input.pages);
  if (!prepared || prepared.company_id !== actor.company_id)
    throw new Error("Original pages must be saved before importing.");
  const summary: ImportSummary = {
    imported: [],
    skipped: [],
    new_suppliers: [],
    needs_location: [],
    other_locations: 0,
  };
  const existingCurrent = state.invoice;
  state.invoices ??= [];
  if (existingCurrent.status !== "empty") {
    const index = state.invoices.findIndex(
      (invoice) => invoice.id === existingCurrent.id,
    );
    if (index < 0) state.invoices.push(existingCurrent);
    else state.invoices[index] = existingCurrent;
  }
  const preview = previewInvoiceReadings(
    state,
    actor,
    input.exported,
    input.mode,
    "all",
  );
  const selected = new Set(input.selectedIds);
  for (const row of preview)
    if (
      row.in_file_duplicate_group &&
      !row.recommended &&
      selected.has(row.id)
    ) {
      const recommendation = preview.find(
        (other) =>
          other.in_file_duplicate_group === row.in_file_duplicate_group &&
          other.recommended,
      );
      if (recommendation && selected.has(recommendation.id))
        selected.delete(row.id);
    }
  for (const entry of input.exported.invoices) {
    const effective = effectiveInvoiceReading(entry, input.mode),
      value = effective.reading;
    const duplicate = value && readingDuplicateReason(state, entry, value);
    if (duplicate) {
      summary.skipped.push({ id: entry.id, reason: duplicate });
      continue;
    }
    if (!value) {
      summary.skipped.push({ id: entry.id, reason: "missing_reading" });
      continue;
    }
    if (!selected.has(entry.id)) {
      summary.skipped.push({ id: entry.id, reason: "not_selected" });
      continue;
    }
    const location = input.locations[entry.id];
    if (
      !location ||
      !configuredBranches(state.config).includes(location) ||
      location === "all"
    ) {
      summary.needs_location.push(entry.id);
      continue;
    }
    const pages = prepared.invoices[entry.id];
    if (
      !pages?.length ||
      pages.length !== entry.pages.length ||
      pages.some(
        (page, index) => page.original_sha256 !== entry.original_sha256[index],
      )
    )
      throw new Error("Original pages changed. Choose the file again.");
    const invoice = createInvoice(state, actor, location, true);
    invoice.entry_mode = "upload";
    invoice.status = "review";
    state.invoice = invoice;
    let supplier = matchReadingSupplier(state, value);
    if (!supplier && text(value.supplier_name)) {
      supplier = saveSupplier(
        state,
        actor,
        {
          name: text(value.supplier_name),
          address: text(value.supplier_address),
          phone: "",
          email: "",
          sales_rep_name: "",
          sales_rep_phone: "",
          payment_terms: text(value.payment_terms),
          notes: "",
          similar_name_confirmed: true,
        },
        { invoice_quick_add: true },
        now,
      );
      supplier.tax_number = text(value.supplier_tax_number);
      supplier.created_from_import = true;
      summary.new_suppliers.push(supplier.name);
    }
    const checks = readingCheckFields(effective.statuses, value);
    invoice.supplier = supplier?.name ?? text(value.supplier_name);
    invoice.supplier_confirmed = Boolean(supplier?.active);
    invoice.supplier_review_required = false;
    invoice.supplier_review_confirmed = true;
    invoice.supplier_invoice_number = text(value.supplier_invoice_number);
    invoice.number_is_system_assigned = false;
    invoice.invoice_date = readingExpiryDate(text(value.invoice_date)) ?? "";
    invoice.payment_terms = text(value.payment_terms);
    invoice.payment_term_days = paymentTermsDays(invoice.payment_terms);
    invoice.due_date =
      text(value.due_date) ||
      (invoice.invoice_date && invoice.payment_term_days !== undefined
        ? dateAfter(invoice.invoice_date, invoice.payment_term_days)
        : "");
    invoice.due_date_manual = Boolean(text(value.due_date));
    invoice.ship_to = text(value.ship_to) || text(value.branch_hint);
    invoice.bill_to = text(value.bill_to);
    invoice.supplier_tax_number = text(value.supplier_tax_number);
    invoice.order_reference = text(value.order_reference);
    invoice.import_currency =
      text(value.currency) || state.config.company.currency;
    invoice.subtotal = decimal(value.subtotal, 2);
    invoice.tax = decimal(value.tax, 2);
    invoice.final_total = decimal(value.final_total, 2);
    invoice.final_total_manual = true;
    invoice.payable_after_open_shorts = invoice.final_total;
    invoice.short_lines = [];
    const received = importedReadingReceived(state.config, value);
    invoice.received_at = received.received_at;
    invoice.imported_received_source = received.source;
    invoice.receiving_employee = actor.actor;
    invoice.import_warnings = list(value.warnings);
    invoice.import_handwritten_notes = list(value.handwritten_notes);
    invoice.low_confidence_fields = [...checks.header, "received_at"];
    for (const field of [
      "supplier",
      "supplier_invoice_number",
      "invoice_date",
      "final_total",
    ] as const)
      if (!invoice[field]) invoice.low_confidence_fields.push(field);
    invoice.low_confidence_fields = [...new Set(invoice.low_confidence_fields)];
    fillCalculatedInvoiceTotals(invoice);
    invoice.payable_after_open_shorts = invoice.final_total;
    invoice.lines = [];
    invoice.other_charges = [];
    for (const [index, line] of (value.lines ?? []).entries()) {
      const type = text(line.line_type) || "item";
      if (type === "item") {
        const mapped = rememberInvoiceSupplierItem(
          state,
          actor,
          invoice,
          mapReadingLine(state, supplier, line, index, checks.lines[index]),
        );
        mapped.current_selling_price = regularPrice(
          state,
          mapped.product_code,
          location,
        );
        invoice.lines.push(mapped);
      } else {
        const amount = decimal(line.line_total, 2);
        const chargeChecks = chargeCheckFields(line, checks.lines[index]);
        invoice.other_charges.push({
          line_type: ([
            "deposit",
            "fee",
            "discount",
            "credit",
            "other",
          ].includes(type)
            ? type
            : "other") as "deposit" | "fee" | "discount" | "credit" | "other",
          description: text(line.description),
          amount:
            amount && ["discount", "credit"].includes(type)
              ? new Decimal(amount).abs().negated().toFixed(2)
              : amount,
          taxable: line.taxable === true,
          line_no: index + 1,
          low_confidence_fields: [...new Set(chargeChecks)],
        });
      }
    }
    invoice.original_pages = structuredClone(pages);
    invoice.file_name = pages[0].file_name;
    invoice.file_type = pages[0].file_type;
    invoice.file_data = pages[0].file_data;
    invoice.file_size = pages[0].file_size;
    invoice.reading_record = {
      source: "imported",
      file_name: input.fileName,
      page_sha256s: [...entry.original_sha256],
      models: [...entry.ai_models],
      reading_cost_usd: entry.reading_cost_usd,
      exported_at: input.exported.exported_at,
      ai_source: entry.ai_source,
    };
    state.invoices.push(invoice);
    summary.imported.push(invoice.id);
    if (
      input.currentLocation &&
      input.currentLocation !== "all" &&
      location !== input.currentLocation
    )
      summary.other_locations = (summary.other_locations ?? 0) + 1;
    state.activity.push({
      id: createId("invoice-import-draft"),
      company_id: actor.company_id,
      branch: location,
      action: "Create invoice draft",
      by: actor.actor,
      actor_user_id: actor.user_id,
      actor_username: actor.username,
      actor_role_snapshot: actor.role,
      at: now.toISOString(),
      reversible: false,
      entity_type: "invoice",
      entity_id: invoice.id,
      after: structuredClone(invoice),
    });
  }
  state.invoice = existingCurrent;
  state.activity.push({
    id: createId("reading-import"),
    company_id: actor.company_id,
    branch: "all",
    action: `Imported ${summary.imported.length} invoice readings from ${input.fileName}`,
    by: actor.actor,
    actor_user_id: actor.user_id,
    actor_username: actor.username,
    actor_role_snapshot: actor.role,
    at: now.toISOString(),
    reversible: false,
    entity_type: "invoice_import",
    entity_id: createId("import"),
    after: {
      file_name: input.fileName,
      imported: summary.imported,
      skipped: summary.skipped,
      needs_location: summary.needs_location,
    },
  });
  return summary;
}
