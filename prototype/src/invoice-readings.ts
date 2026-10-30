import {
  freeCasePrintedDescriptions,
  groupInvoiceFreeCases,
} from "./invoice-free-cases";
import { LIVE_READER_MAX_PDF_PAGES } from "./live-reader-limits";
import { invoicePackWeight } from "./invoice-case-weight";
import { selectInvoiceWeightUnit } from "./invoice-weight";
import Decimal from "decimal.js";
import { freshActor } from "./authority";
import { canInvoiceAuthority } from "./invoice-authority";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { branchId, configuredBranches } from "./settings";
import { createInvoice, rememberInvoiceSupplierItem } from "./invoice";
import { paymentTermsDays, paymentTermsDueDate } from "./invoice-entry";
import { receivingDefaultPaymentTerms } from "./invoice-payment-default";
import { importedReadingReceived } from "./invoice-reading-dates";
import { extractSupplierContactText } from "./invoice-reading-supplier-contacts";
import {
  splitInvoiceProductDescription,
  readingProductUnitSize,
  suggestInvoiceEnglishName,
  suggestInvoiceSupplierName,
} from "./invoice-reading-products";
export { suggestInvoiceEnglishName } from "./invoice-reading-products";
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
import {
  liveOriginalPages,
  requireLiveReadingTarget,
} from "./invoice-live-reading-state";
import type { LiveReadingProvenance } from "./invoice-live-reading-types";
import { isUsableLiveReadingItem } from "./live-reading-content";
import { compareKnownDelivery } from "./invoice-known-delivery";
import { normalizedPrintedItem } from "./invoice-printed-item";
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
interface ReadingLineEvidence {
  printedDescription?: string;
  checkedName?: string;
}
function lineReadingEvidence(
  entry: ExportedInvoiceReading,
  index: number,
  usingChecked: boolean,
): ReadingLineEvidence {
  return {
    printedDescription: printedReadingDescription(
      entry.ai_reading?.lines?.[index]?.description,
    ),
    checkedName:
      usingChecked &&
      Object.hasOwn(entry.checked_answer?.lines?.[index] ?? {}, "description")
        ? text(entry.checked_answer!.lines![index].description)
        : undefined,
  };
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
const printedReadingDescription = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : undefined;
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
        [
          "quantity",
          "units_per_case",
          "unit",
          "cost_basis",
          "unit_cost_before_tax",
          "cost_per_unit_before_tax",
          "cost_per_case_before_tax",
        ].some((field) => Object.hasOwn(answer, field)) &&
        !Object.hasOwn(answer, "line_total")
      )
        delete result.line_total;
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
type MatchProvenance = NonNullable<InvoiceLine["reading_product_match"]>;
export interface ReadingProductMatch {
  product: Product;
  provenance: MatchProvenance;
}

/** Matching uses printed evidence; generated display names are never supplier SKUs. */
export function resolveReadingProductMatch(
  state: DemoState,
  supplier: SupplierRecord | undefined,
  line: InvoiceReadingLine,
  actor?: AuthenticatedActor,
): ReadingProductMatch | undefined {
  const company = state.config.company.seed_key;
  if (actor) freshActor(state, actor);
  if (supplier && (supplier.company_id !== company || !supplier.active))
    return undefined;
  const products = state.products.filter(
    (product) =>
      product.company_id === company && product.status !== "archived",
  );
  const history = allInvoices(state)
    .filter(
      (invoice) =>
        !actor ||
        canInvoiceAuthority(state, actor, "invoices.read", invoice.id),
    )
    .sort(
      (left, right) =>
        Number(right.status === "posted") - Number(left.status === "posted") ||
        (Date.parse(
          right.received_at || right.posted_at || right.invoice_date || "",
        ) || 0) -
          (Date.parse(
            left.received_at || left.posted_at || left.invoice_date || "",
          ) || 0),
    )
    .flatMap((invoice) =>
      invoice.lines
        .filter((prior) => prior.company_id === company)
        .map((prior) => ({
          invoice,
          line: prior,
          product: products.find(
            (product) => product.code === prior.product_code,
          ),
        })),
    )
    .filter((entry): entry is typeof entry & { product: Product } =>
      Boolean(entry.product),
    );
  const ownHistory = supplier
    ? history.filter((entry) =>
        supplierMatches(supplier, entry.invoice.supplier),
      )
    : [];
  const bindings = (state.supplier_items ?? []).filter(
    (item) =>
      item.company_id === company &&
      item.supplier_id === supplier?.id &&
      !item.archived,
  );
  const split = splitInvoiceProductDescription({
    description: text(line.description),
    supplierCode: text(line.supplier_sku),
    unitsPerCase: text(line.units_per_case),
    packSize: text(line.pack_size),
    unit: text(line.unit),
  });
  const printedName = normalizedPrintedItem(text(line.description));
  const names = new Set(
    [
      normalizeReadingName(text(line.description)),
      normalizeReadingName(split.name),
    ].filter(Boolean),
  );
  const code = text(line.supplier_sku),
    barcode = text(line.barcode);
  const individualSize = readingProductUnitSize(split.name);
  if (individualSize && split.name.endsWith(individualSize))
    names.add(
      normalizeReadingName(split.name.slice(0, -individualSize.length).trim()),
    );
  const inferredCode = (value: {
    supplier_item_code?: string;
    supplier_item_code_inferred?: boolean;
  }) => value.supplier_item_code_inferred === true;
  const size = (value: string) => {
    const parts = [
      ...value.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|lb|oz|ml|l)\b/gi),
    ];
    const last = parts.at(-1);
    return last
      ? `${new Decimal(last[1]).toString()}${last[2].toLowerCase()}`
      : "";
  };
  const sourceSize = size(split.pack_size) || size(split.name);
  const sourceCount =
    /^(case|cases|cs|ctn|box)$/i.test(text(line.unit)) || split.pack_size
      ? split.units_per_case
      : undefined;
  const packQuestion = (product: Product) => {
    const counts = [
      ...bindings
        .filter((item) => item.product_code === product.code)
        .map((item) => item.units_per_case),
      ...ownHistory
        .filter((entry) => entry.product.code === product.code)
        .map((entry) => entry.line.units_per_case),
    ].filter(
      (count): count is number => typeof count === "number" && count > 0,
    );
    const productSize = size(product.unit_size);
    return Boolean(
      (sourceCount && counts.length && !counts.includes(sourceCount)) ||
      (sourceSize && productSize && sourceSize !== productSize),
    );
  };
  const sameSupplier = (product: Product) =>
    Boolean(
      supplier &&
      (supplierMatches(supplier, product.main_supplier) ||
        bindings.some((item) => item.product_code === product.code) ||
        ownHistory.some((entry) => entry.product.code === product.code)),
    );
  const match = (
    product: Product,
    basis: MatchProvenance["basis"],
    evidence?: (typeof history)[number],
    uncertain = false,
  ): ReadingProductMatch => {
    const earlier =
      evidence ??
      ownHistory.find(
        (entry) =>
          entry.product.code === product.code &&
          entry.invoice.status === "posted",
      );
    return {
      product,
      provenance: {
        product_code: product.code,
        basis,
        earlier_delivery: earlier?.invoice.status === "posted",
        requires_check:
          uncertain ||
          !sameSupplier(product) ||
          packQuestion(product) ||
          Boolean(
            barcode &&
            products.some(
              (candidate) =>
                candidate.barcode === barcode &&
                candidate.code !== product.code,
            ),
          ),
        identity_requires_check:
          uncertain ||
          !sameSupplier(product) ||
          Boolean(
            barcode &&
            products.some(
              (candidate) =>
                candidate.barcode === barcode &&
                candidate.code !== product.code,
            ),
          ),
        ...(earlier ? { source_invoice_id: earlier.invoice.id } : {}),
      },
    };
  };
  const fromHistory = (
    entries: typeof history,
    basis: MatchProvenance["basis"],
  ) => {
    const ordered = [...entries].sort(
      (a, b) =>
        Number(packQuestion(a.product)) - Number(packQuestion(b.product)),
    );
    const first = ordered[0];
    if (!first) return undefined;
    const equallyPlausible = new Set(
      ordered
        .filter(
          (entry) =>
            packQuestion(entry.product) === packQuestion(first.product),
        )
        .map((entry) => entry.product.code),
    );
    return match(
      first.product,
      basis,
      first,
      equallyPlausible.size > 1 ||
        first.invoice.status !== "posted" ||
        basis === "other_supplier_description",
    );
  };
  if (code && supplier) {
    const candidates = bindings
      .filter((item) => !inferredCode(item) && item.supplier_item_code === code)
      .flatMap((item) =>
        products.filter((product) => product.code === item.product_code),
      );
    if (candidates.length)
      return match(
        candidates[0],
        "supplier_code",
        undefined,
        new Set(candidates.map((product) => product.code)).size > 1,
      );
    const prior = fromHistory(
      ownHistory.filter(
        (entry) =>
          !inferredCode(entry.line) && entry.line.supplier_item_code === code,
      ),
      "supplier_code",
    );
    if (prior) return prior;
  }
  if (printedName) {
    const learned = bindings.flatMap((binding) =>
      binding.printed_description_keys?.some(
        (key) =>
          key.product_code === binding.product_code &&
          key.key === printedName &&
          key.source_invoice_ids?.some((id) =>
            ownHistory.some(
              (entry) =>
                entry.invoice.status === "posted" &&
                entry.invoice.id === id &&
                entry.product.code === binding.product_code &&
                freeCasePrintedDescriptions(entry.line).some(
                  (raw) => normalizedPrintedItem(raw) === key.key,
                ),
            ),
          ),
      )
        ? products.filter((product) => product.code === binding.product_code)
        : [],
    );
    if (learned.length)
      return match(
        learned[0],
        "supplier_description",
        undefined,
        new Set(learned.map((product) => product.code)).size > 1,
      );
    const prior = fromHistory(
      ownHistory.filter(
        (entry) =>
          normalizedPrintedItem(
            entry.line.printed_description ?? entry.line.description,
          ) === printedName,
      ),
      "supplier_description",
    );
    if (prior) return prior;
  }
  if (barcode) {
    const product = products.find((item) => item.barcode === barcode);
    if (product) return match(product, "barcode");
    const prior = fromHistory(
      history.filter((entry) => entry.line.barcode === barcode),
      "barcode",
    );
    if (prior) return prior;
  }
  const named = products
    .filter((product) =>
      [product.name_en, product.name_fa].some(
        (name) => name && names.has(normalizeReadingName(name)),
      ),
    )
    .sort(
      (a, b) =>
        Number(!sameSupplier(a)) - Number(!sameSupplier(b)) ||
        Number(packQuestion(a)) - Number(packQuestion(b)),
    );
  if (named.length) {
    const first = named[0];
    const plausible = named.filter(
      (product) =>
        sameSupplier(product) === sameSupplier(first) &&
        packQuestion(product) === packQuestion(first),
    );
    return match(first, "catalog_name", undefined, plausible.length > 1);
  }
  return printedName
    ? fromHistory(
        history.filter(
          (entry) =>
            normalizedPrintedItem(
              entry.line.printed_description ?? entry.line.description,
            ) === printedName,
        ),
        "other_supplier_description",
      )
    : undefined;
}

/** Compatibility for callers that only need the selected product. */
export function matchReadingProduct(
  state: DemoState,
  supplier: SupplierRecord | undefined,
  line: InvoiceReadingLine,
): Product | undefined {
  return resolveReadingProductMatch(state, supplier, line)?.product;
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
  return readingDuplicateReasonIgnoring(state, entry, value);
}
function readingDuplicateReasonIgnoring(
  state: DemoState,
  entry: ExportedInvoiceReading,
  value: InvoiceReading,
  excludedInvoiceId?: string,
): "invoice_number" | "page_sha256" | undefined {
  const invoices = allInvoices(state).filter(
    (invoice) => invoice.id !== excludedInvoiceId,
  );
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

function readingPaymentTerms(state: DemoState, value: InvoiceReading) {
  const printedTerms = text(value.payment_terms);
  const terms = printedTerms || receivingDefaultPaymentTerms(state.config);
  const defaulted = !printedTerms && Boolean(terms);
  const days = paymentTermsDays(terms);
  const computedDue = paymentTermsDueDate(
    readingExpiryDate(text(value.invoice_date)) ?? "",
    terms,
    days,
  );
  const suppliedDue = text(value.due_date);
  const paperDue = readingExpiryDate(suppliedDue) ?? "";
  return { terms, defaulted, days, computedDue, suppliedDue, paperDue };
}

function paymentTermReadingChecks(
  fields: string[],
  terms: ReturnType<typeof readingPaymentTerms>,
): string[] {
  const checks = fields.filter(
    (field) =>
      !terms.defaulted ||
      (field !== "payment_terms" &&
        !(field === "due_date" && !terms.suppliedDue && terms.computedDue)),
  );
  if (!terms.terms) checks.push("payment_terms");
  if (
    (terms.suppliedDue && !terms.paperDue) ||
    (terms.computedDue &&
      terms.paperDue &&
      terms.computedDue !== terms.paperDue)
  )
    checks.push("due_date");
  return [...new Set(checks)];
}

/** Configured defaults are quiet; genuine printed questions remain actionable. */
export function actionableReadingChecks(
  state: DemoState,
  value: InvoiceReading,
  statuses: Record<string, "auto" | "check">,
  context?: {
    actor: AuthenticatedActor;
    branch: string;
    invoiceId?: string;
    lineEvidence?: ReadingLineEvidence[];
  },
) {
  const checks = readingCheckFields(statuses, value);
  const terms = readingPaymentTerms(state, value);
  const received = importedReadingReceived(state.config, value);
  const header = {
    supplier: text(value.supplier_name),
    supplier_invoice_number: text(value.supplier_invoice_number),
    invoice_date: readingExpiryDate(text(value.invoice_date)) ?? "",
    received_at: received.received_at,
    order_reference: text(value.order_reference),
    bill_to: text(value.bill_to),
    ship_to: text(value.ship_to),
    subtotal: decimal(value.subtotal, 2),
    tax: decimal(value.tax, 2),
    final_total: decimal(value.final_total, 2),
    low_confidence_fields: [
      ...paymentTermReadingChecks(checks.header, terms),
      ...(received.source !== "invoice_date" ? ["received_at"] : []),
    ],
    calculated_fields: [] as string[],
  };
  for (const field of [
    "supplier",
    "supplier_invoice_number",
    "invoice_date",
    "final_total",
  ] as const)
    if (!header[field]) header.low_confidence_fields.push(field);
  header.low_confidence_fields = [...new Set(header.low_confidence_fields)];
  const lines = (value.lines ?? []).map((line, index) => {
    if (!line.line_type || line.line_type === "item") {
      const mapped = mapReadingLine(
        state,
        matchReadingSupplier(state, value),
        line,
        index,
        checks.lines[index],
        context?.actor,
        context?.lineEvidence?.[index],
      );
      if (context && context.branch !== "all")
        compareKnownDelivery(
          state,
          context.actor,
          mapped,
          matchReadingSupplier(state, value)?.name ?? text(value.supplier_name),
          context.invoiceId
            ? { invoiceId: context.invoiceId }
            : { previewBranch: context.branch },
        );
      return mapped;
    }
    return {
      low_confidence_fields: chargeCheckFields(line, checks.lines[index]),
    };
  });
  const totals = {
    ...header,
    calculated_from_lines: false,
    lines: lines.filter((line): line is InvoiceLine => "line_total" in line),
    other_charges: (value.lines ?? [])
      .filter((line) => line.line_type && line.line_type !== "item")
      .map((line) => {
        const value = decimal(line.line_total, 2);
        return {
          amount:
            value && ["discount", "credit"].includes(text(line.line_type))
              ? new Decimal(value).abs().negated().toFixed(2)
              : value,
        };
      }),
  };
  fillCalculatedInvoiceTotals(totals);
  return {
    ...header,
    subtotal: totals.subtotal,
    tax: totals.tax,
    final_total: totals.final_total,
    low_confidence_fields: totals.low_confidence_fields,
    calculated_fields: totals.calculated_fields,
    calculated_from_lines: totals.calculated_from_lines,
    lines: [
      ...groupInvoiceFreeCases(
        lines.filter((line): line is InvoiceLine => "line_total" in line),
      ),
      ...lines.filter((line) => !("line_total" in line)),
    ],
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
  return previewInvoiceReadingsAuthorized(
    state,
    actor,
    exported,
    mode,
    currentLocation,
  );
}
function previewInvoiceReadingsAuthorized(
  state: DemoState,
  actor: AuthenticatedActor,
  exported: InvoiceReadingsExport,
  mode: ImportMode,
  currentLocation: string,
  excludedInvoiceId?: string,
): ImportPreviewRow[] {
  const rows = exported.invoices.map((entry): ImportPreviewRow => {
    const effective = effectiveInvoiceReading(entry, mode),
      value = effective.reading;
    const checked = value
      ? actionableReadingChecks(state, value, effective.statuses, {
          actor,
          branch:
            suggestReadingLocation(state, value, currentLocation) ??
            currentLocation,
          invoiceId: excludedInvoiceId,
          lineEvidence: (value.lines ?? []).map((_, index) =>
            lineReadingEvidence(entry, index, effective.using_checked),
          ),
        })
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
        ? readingDuplicateReasonIgnoring(state, entry, value, excludedInvoiceId)
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
  handwritten_notes: "import_handwritten_notes",
};
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
      if (
        ![
          ...Object.keys(headerStatusAliases),
          "payment_terms",
          "order_reference",
          "bill_to",
          "ship_to",
          "currency",
          "supplier_tax_number",
          "received_at",
          "receiving_employee",
          "order_id",
          "delivery_reference",
          "import_handwritten_notes",
        ].includes(field)
      )
        continue;
      if (field === "currency" && value && !text(value.currency)) continue;
      header.push(headerStatusAliases[field] ?? field);
    }
    const line = /^lines\[(\d+)\]\.(.+)$/.exec(key);
    if (line)
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
  actor?: AuthenticatedActor,
  evidence?: ReadingLineEvidence,
): InvoiceLine {
  const matched = resolveReadingProductMatch(
    state,
    supplier,
    evidence?.printedDescription
      ? { ...source, description: evidence.printedDescription }
      : source,
    actor,
  );
  const product = matched?.product,
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
  const effectiveDescription =
    typeof source.description === "string"
      ? source.description
      : text(source.description);
  const printedDescription = evidence
    ? evidence.printedDescription
    : effectiveDescription;
  const split = splitInvoiceProductDescription({
    description: effectiveDescription,
    supplierCode: text(source.supplier_sku),
    unitsPerCase: text(source.units_per_case),
    packSize: text(source.pack_size),
    unit: text(source.unit),
  });
  const swappedName =
    !product &&
    evidence?.checkedName === undefined &&
    !split.name &&
    split.suggested_name
      ? split.suggested_name
      : undefined;
  const inferredCode = !text(source.supplier_sku)
    ? (evidence?.checkedName ?? (split.name || product?.name_en || ""))
    : "";
  const inferredPack =
    !text(source.units_per_case) && split.units_per_case !== undefined;
  const printedUnit = text(source.unit).toLocaleLowerCase();
  const unit = /^(?:case|cases|cs\d*|ctn\d*|carton|cartons|box|boxes)$/.test(
    printedUnit,
  )
    ? "case"
    : /^(?:each|ea|unit|units|piece|pieces|pcs)$/.test(printedUnit)
      ? "each"
      : printedUnit;
  const printedPack = decimal(source.units_per_case ?? split.units_per_case);
  const validPack =
    printedPack &&
    new Decimal(printedPack).isInteger() &&
    new Decimal(printedPack).gt(0) &&
    new Decimal(printedPack).lte(Number.MAX_SAFE_INTEGER);
  const pack = validPack ? printedPack : "1",
    quantity = decimal(source.quantity),
    received =
      decimal(source.units_received) ||
      (quantity
        ? new Decimal(quantity).times(unit === "case" ? pack : 1).toString()
        : "");
  const printedCost = decimal(source.unit_cost_before_tax, 4);
  const printedCaseCost =
    decimal(source.cost_per_case_before_tax, 4) ||
    (text(source.cost_basis).toLowerCase() === "case" ? printedCost : "");
  const derivedCost =
    printedCost && text(source.cost_basis).toLowerCase() !== "case"
      ? printedCost
      : printedCaseCost
        ? new Decimal(pack).gt(0)
          ? new Decimal(printedCaseCost).div(pack).toFixed(4)
          : ""
        : printedCost;
  const roundedUnits =
    unit === "case" && quantity
      ? new Decimal(quantity).times(pack).toNearest(1)
      : undefined;
  const closeWholeUnits =
    roundedUnits &&
    roundedUnits.gt(0) &&
    roundedUnits.minus(new Decimal(quantity).times(pack)).abs().lte("0.01")
      ? roundedUnits
      : undefined;
  const costUnits =
    closeWholeUnits ??
    (quantity
      ? new Decimal(quantity).times(unit === "case" ? pack : 1)
      : undefined);
  const printedLineTotal = decimal(source.line_total, 2);
  const cost =
      printedLineTotal && costUnits?.gt(0)
        ? new Decimal(printedLineTotal).div(costUnits).toFixed(4)
        : decimal(source.cost_per_unit_before_tax ?? derivedCost, 4),
    caseCost =
      cost && quantity && printedLineTotal && unit === "case"
        ? new Decimal(printedLineTotal).div(quantity).toFixed(4)
        : printedCaseCost ||
          (cost ? new Decimal(cost).times(pack).toFixed(4) : "");
  const checks = statuses.filter(
    (field) =>
      !(field === "supplier_item_code" && inferredCode) &&
      !(field === "units_per_case" && inferredPack && !split.uncertain),
  );
  for (const [field, value] of Object.entries({
    description: text(source.description),
    quantity_entered: quantity,
    unit_cost_before_tax: cost,
  }))
    if (!value) checks.push(field);
  if (unit === "other" || !["case", "each", "kg", "lb"].includes(unit))
    checks.push("quantity_unit");
  if (split.uncertain) checks.push("description");
  const missingPack = unit === "case" && !validPack;
  if (missingPack) checks.push("units_per_case");
  if (matched?.provenance.requires_check) checks.push("product_code");
  const line: InvoiceLine = {
    id: createId("invoice-line"),
    ...(matched ? { reading_product_match: matched.provenance } : {}),
    company_id: company,
    product_code: product?.code ?? "NEW",
    description: printedDescription ?? effectiveDescription,
    ...(printedDescription !== undefined
      ? { printed_description: printedDescription }
      : {}),
    qty_invoiced: quantity
      ? new Decimal(quantity).times(unit === "case" ? pack : 1).toNumber()
      : 0,
    qty_received_at_posting: received ? new Decimal(received).toNumber() : 0,
    qty_later_received: 0,
    unit_cost_before_tax: cost,
    paper_line_total: printedLineTotal || undefined,
    line_total:
      decimal(source.line_total, 2) ||
      (unit === "case" && caseCost && quantity
        ? new Decimal(caseCost).times(quantity).toFixed(2)
        : cost && quantity
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
      : (evidence?.checkedName ??
        (swappedName ||
          split.name ||
          suggestInvoiceEnglishName(effectiveDescription))),
    ...(swappedName
      ? {
          new_name_swap: {
            name: printedDescription ?? effectiveDescription,
            supplier_item_code: text(source.supplier_sku),
          },
        }
      : {}),
    new_name_suggestion:
      product || evidence?.checkedName !== undefined
        ? undefined
        : split.suggested_name,
    new_name_fa: product ? undefined : "",
    supplier_item_code: swappedName
      ? (printedDescription ?? effectiveDescription)
      : text(source.supplier_sku) || inferredCode,
    ...(inferredCode ? { supplier_item_code_inferred: true } : {}),
    barcode: text(source.barcode),
    pack_size: split.pack_size || text(source.pack_size),
    units_per_case: new Decimal(pack).toNumber(),
    ...(missingPack ? { units_per_case_inferred: true } : {}),
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
    ...(split.supplier_promotion ? { reading_supplier_promotion: true } : {}),
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
  if (unit === "case" && quantity && !new Decimal(quantity).isInteger()) {
    const units = closeWholeUnits ?? new Decimal(quantity).times(pack);
    if (closeWholeUnits && units.lte(Number.MAX_SAFE_INTEGER)) {
      line.quantity_unit = "units";
      line.quantity_entered = units.toString();
      line.case_cost_before_tax = undefined;
      line.qty_invoiced = units.toNumber();
      if (!text(source.units_received))
        line.qty_received_at_posting = units.toNumber();
      if (caseCost) {
        line.converted_case_cost_before_tax = caseCost;
        line.converted_case_units_per_case = new Decimal(pack).toNumber();
      }
    } else {
      // Retain paper quantities visibly while the non-whole conversion remains blocked.
      line.quantity_unit = "units";
      line.quantity_entered = units.toString();
      line.low_confidence_fields = [
        ...new Set([
          ...(line.low_confidence_fields ?? []),
          "quantity_entered",
          "units_per_case",
        ]),
      ];
    }
  }
  if (line.sold_by !== "weight" && printedLineTotal && costUnits?.gt(0)) {
    line.imported_unit_cost_basis = {
      amount: printedLineTotal,
      units: costUnits.toString(),
      unit_cost_before_tax: cost,
      units_per_case: line.units_per_case!,
      product_code: line.product_code,
      printed_unit_cost_before_tax: decimal(
        source.cost_per_unit_before_tax ?? source.unit_cost_before_tax,
        4,
      ),
      printed_cost_basis:
        text(source.cost_per_unit_before_tax) ||
        text(source.cost_basis).toLowerCase() !== "case"
          ? "unit"
          : "case",
      printed_case_cost_before_tax: printedCaseCost,
    };
  }
  const expiry = readingExpiryDate(text(source.expiry_as_printed));
  if (expiry) {
    line.date_value = expiry;
    line.date_type = "expiry";
  }
  const measuredCase =
    text(source.cost_basis).toLowerCase() === "case"
      ? invoicePackWeight(
          text(source.pack_size) || printedDescription || effectiveDescription,
        )
      : undefined;
  if (measuredCase) {
    line.case_weight = measuredCase.weight;
    line.case_weight_unit = measuredCase.unit;
    if (product?.sold_by === "weight" && unit === "case")
      selectInvoiceWeightUnit(line, measuredCase.unit, state.config);
  }
  if (line.sold_by === "weight" && (unit === "kg" || unit === "lb")) {
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
const liveImportTargets = new WeakMap<
  object,
  {
    invoice_id: string;
    attempt_id: string;
    provenance: LiveReadingProvenance;
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
  liveContext?: object,
): ImportSummary {
  const live = liveContext ? liveImportTargets.get(liveContext) : undefined;
  if (liveContext && !live) throw new Error("Live reading access changed.");
  const target = live
    ? requireLiveReadingTarget(state, actor, live)
    : undefined;
  actor = target?.actor ?? requireImport(state, actor);
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
  let existingCurrent = state.invoice;
  state.invoices ??= [];
  if (existingCurrent.status !== "empty") {
    const index = state.invoices.findIndex(
      (invoice) =>
        invoice.id === existingCurrent.id &&
        invoice.company_id === existingCurrent.company_id,
    );
    if (index < 0) state.invoices.push(existingCurrent);
    else state.invoices[index] = existingCurrent;
  }
  const preview = previewInvoiceReadingsAuthorized(
    state,
    actor,
    input.exported,
    input.mode,
    "all",
    live?.invoice_id,
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
    const duplicate =
      value &&
      readingDuplicateReasonIgnoring(state, entry, value, live?.invoice_id);
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
    const invoice = target
      ? structuredClone(target.invoice)
      : createInvoice(state, actor, location, true);
    invoice.entry_mode = "upload";
    invoice.status = "review";
    invoice.lines = [];
    state.invoice = invoice;
    let supplier = matchReadingSupplier(state, value);
    const printedAddress = text(value.supplier_address);
    const contacts = extractSupplierContactText(printedAddress);
    if (!supplier && text(value.supplier_name)) {
      supplier = saveSupplier(
        state,
        actor,
        {
          name: suggestInvoiceSupplierName(text(value.supplier_name)),
          address: contacts.address,
          phone: contacts.phone,
          email: contacts.email,
          website: contacts.website,
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
    } else if (
      supplier &&
      can(state, actor, "suppliers.manage", {
        company_id: state.config.company.seed_key,
        kind: "company_shared",
      }).allowed
    ) {
      const address =
        !supplier.address || supplier.address === printedAddress
          ? contacts.address
          : supplier.address;
      const phone = supplier.phone || contacts.phone;
      const email = supplier.email || contacts.email;
      const website = supplier.website || contacts.website;
      if (
        address !== (supplier.address ?? "") ||
        phone !== supplier.phone ||
        email !== supplier.email ||
        website !== (supplier.website ?? "")
      ) {
        supplier = saveSupplier(
          state,
          actor,
          {
            ...supplier,
            address,
            phone,
            email,
            website,
            notes: supplier.notes ?? "",
            similar_name_confirmed: true,
          },
          { id: supplier.id },
          now,
        );
      }
    }
    const checks = readingCheckFields(effective.statuses, value);
    invoice.supplier = supplier?.name ?? text(value.supplier_name);
    invoice.supplier_confirmed = Boolean(supplier?.active);
    invoice.supplier_review_required = false;
    invoice.supplier_review_confirmed = true;
    invoice.supplier_invoice_number = text(value.supplier_invoice_number);
    invoice.number_is_system_assigned = false;
    invoice.invoice_date = readingExpiryDate(text(value.invoice_date)) ?? "";
    const terms = readingPaymentTerms(state, value);
    invoice.payment_terms = terms.terms;
    invoice.payment_terms_inferred = false;
    invoice.payment_terms_defaulted = terms.defaulted;
    invoice.payment_term_days = terms.days;
    const { paperDue, computedDue } = terms;
    invoice.due_date = computedDue || paperDue;
    invoice.due_date_manual = Boolean(
      paperDue && (!computedDue || paperDue === computedDue),
    );
    checks.header = paymentTermReadingChecks(checks.header, terms);
    invoice.ship_to = text(value.ship_to);
    invoice.bill_to = text(value.bill_to);
    invoice.supplier_tax_number = text(value.supplier_tax_number);
    invoice.order_reference = text(value.order_reference);
    invoice.import_currency =
      text(value.currency) || state.config.company.currency;
    invoice.import_currency_inferred = !text(value.currency);
    invoice.calculated_fields = computedDue && !paperDue ? ["due_date"] : [];
    invoice.subtotal = decimal(value.subtotal, 2);
    invoice.tax = decimal(value.tax, 2);
    invoice.final_total = decimal(value.final_total, 2);
    invoice.final_total_manual = true;
    invoice.payable_after_open_shorts = invoice.final_total;
    invoice.short_lines = [];
    const received = importedReadingReceived(state.config, value);
    invoice.received_at = target
      ? target.invoice.received_at
      : received.received_at;
    if (!target) {
      invoice.imported_received_source = received.source;
      invoice.imported_received_alternative = received.alternative_received_at;
    }
    invoice.receiving_employee = target
      ? target.invoice.receiving_employee
      : actor.actor;
    invoice.import_warnings = list(value.warnings);
    invoice.import_handwritten_notes = list(value.handwritten_notes);
    invoice.low_confidence_fields = [
      ...checks.header,
      ...(!target && received.source !== "invoice_date" ? ["received_at"] : []),
    ];
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
          mapReadingLine(
            state,
            supplier,
            line,
            index,
            checks.lines[index],
            actor,
            lineReadingEvidence(entry, index, effective.using_checked),
          ),
        );
        mapped.current_selling_price = regularPrice(
          state,
          mapped.product_code,
          location,
        );
        compareKnownDelivery(state, actor, mapped, invoice.supplier, {
          invoiceId: invoice.id,
        });
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
    invoice.lines = groupInvoiceFreeCases(invoice.lines);
    fillCalculatedInvoiceTotals(invoice);
    invoice.payable_after_open_shorts = invoice.final_total;
    invoice.original_pages = structuredClone(pages);
    invoice.file_name = pages[0].file_name;
    invoice.file_type = pages[0].file_type;
    invoice.file_data = pages[0].file_data;
    invoice.file_size = pages[0].file_size;
    invoice.reading_record = {
      source: live ? "live" : "imported",
      file_name: input.fileName,
      page_sha256s: [...entry.original_sha256],
      models: [...entry.ai_models],
      reading_cost_usd: entry.reading_cost_usd,
      exported_at: input.exported.exported_at,
      ai_source: entry.ai_source,
      supplier_name_as_printed: text(value.supplier_name),
      ...(live ? { seconds: live.provenance.seconds } : {}),
    };
    if (live && target) {
      delete invoice.simulated_reading;
      const originals = structuredClone(liveOriginalPages(target.invoice));
      invoice.original_pages = originals;
      if (target.invoice.retained_original_pages)
        invoice.retained_original_pages = structuredClone(
          target.invoice.retained_original_pages,
        );
      if (target.invoice.pdf_page_selection)
        invoice.pdf_page_selection = [...target.invoice.pdf_page_selection];
      Object.assign(invoice, originals[0]);
      invoice.reading_record.models = [...live.provenance.models];
      invoice.reading_record.reading_cost_usd = live.provenance.costUSD;
      if (live.provenance.modelDetails)
        invoice.reading_record.model_details = structuredClone(
          live.provenance.modelDetails,
        );
      invoice.live_reading!.phase = "complete";
      invoice.live_reading!.completed_at = now.toISOString();
      const index = state.invoices.findIndex(
        (record) =>
          record.id === invoice.id && record.company_id === invoice.company_id,
      );
      if (index >= 0) state.invoices[index] = invoice;
      else state.invoices.push(invoice);
      if (existingCurrent.id === invoice.id) existingCurrent = invoice;
    } else state.invoices.push(invoice);
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
      action: live ? "Read invoice with AI" : "Create invoice draft",
      by: actor.actor,
      actor_user_id: actor.user_id,
      actor_username: actor.username,
      actor_role_snapshot: actor.role,
      at: now.toISOString(),
      reversible: false,
      entity_type: "invoice",
      entity_id: invoice.id,
      after: live
        ? {
            invoice_id: invoice.id,
            line_count: invoice.lines.length,
            source: "live",
          }
        : structuredClone(invoice),
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

/** A verified pre-saved live draft enters the exact JSON-import mapping above. */
export function importLiveInvoiceReading(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    invoice_id: string;
    attempt_id: string;
    exported: InvoiceReadingsExport;
    provenance: LiveReadingProvenance;
  },
  now = new Date(),
) {
  const { invoice } = requireLiveReadingTarget(state, actor, input);
  const exported = parseInvoiceReadings(JSON.stringify(input.exported));
  if (exported.invoices.length !== 1)
    throw new Error("One live reading must describe one invoice.");
  const entry = exported.invoices[0];
  if (!entry.ai_reading?.lines?.some(isUsableLiveReadingItem))
    throw new Error("The live reading contains no usable lines.");
  const originals = liveOriginalPages(invoice);
  const pdf =
    originals.length === 1 && originals[0].file_type === "application/pdf";
  if (
    (pdf && entry.pages.length > LIVE_READER_MAX_PDF_PAGES) ||
    (pdf &&
      invoice.pdf_page_selection !== undefined &&
      entry.pages.length !== invoice.pdf_page_selection.length) ||
    (!pdf && entry.pages.length !== originals.length)
  )
    throw new Error("The live reading pages changed.");
  const pages = entry.pages.map((_, index) =>
    structuredClone(originals[pdf ? 0 : index]),
  );
  if (
    pages.some(
      (page, index) => page.original_sha256 !== entry.original_sha256[index],
    )
  )
    throw new Error("The live reading originals changed.");
  const handle = Object.freeze({ count: pages.length });
  preparedPages.set(handle, {
    company_id: invoice.company_id,
    invoices: { [entry.id]: pages },
  });
  const context = Object.freeze({});
  liveImportTargets.set(context, {
    invoice_id: input.invoice_id,
    attempt_id: input.attempt_id,
    provenance: structuredClone(input.provenance),
  });
  return importInvoiceReadings(
    state,
    actor,
    {
      exported,
      fileName: invoice.file_name ?? "",
      mode: "ai",
      locations: { [entry.id]: invoice.branch },
      selectedIds: [entry.id],
      pages: handle,
      currentLocation: invoice.branch,
    },
    now,
    context,
  );
}
