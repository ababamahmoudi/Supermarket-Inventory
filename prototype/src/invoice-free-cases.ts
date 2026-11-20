import Decimal from "decimal.js";
import { businessFingerprint } from "./business-fingerprint";
import { normalizedPrintedItem } from "./invoice-printed-item";
import { requireInvoiceAuthority } from "./invoice-authority";
import { actorAudit } from "./domain-authority";
import { createId } from "./ids";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState, InvoiceLine } from "./types";

type FreeCaseLine = Omit<InvoiceLine, "demo_note">;

export type FreeCaseChoice = "bonus" | "two_for_one" | "mistake";
export interface FreeCaseMember {
  id: string;
  import_line_index?: number;
  description: string;
  printed_description?: string;
  supplier_item_code?: string;
  supplier_item_code_inferred?: boolean;
  barcode?: string;
  qty: number;
  received: number;
  refused: number;
  unit_cost: string;
  paper_amount: string;
  paper_tax: string;
  quantity_unit?: string;
  quantity_entered?: string | number;
  units_per_case: number;
  pack_size?: string;
  expiry_as_printed?: string;
  lot_number?: string;
  tax_profile: string;
  taxable: boolean;
  handwritten_note?: string;
  original_checks: string[];
  imported_cost_basis?: InvoiceLine["imported_unit_cost_basis"];
  free: boolean;
}
export interface InvoiceFreeCaseGroup {
  original_product_code: string;
  bound_product_code?: string;
  members: FreeCaseMember[];
  paid_units: number;
  free_units: number;
  paid_amount: string;
  paid_unit_cost: string;
  source_fingerprint: string;
  difference_note?: {
    text: string;
    by_user_id: string;
    by: string;
    at: string;
  };
  decision?: FreeCaseChoice;
  answer?: { by_user_id: string; by: string; at: string; basis: string };
  allocation: {
    member_id: string;
    received: number;
    refused: number;
    later: number;
  }[];
}
export interface FreeCaseView {
  free_units: number;
  free_cases?: string;
  decision?: FreeCaseChoice;
  answer?: { by_user_id: string; by: string; at: string };
  valid: boolean;
  paid_amount?: string;
  pricing_unit_cost?: string;
  physical_units: number;
  difference_note?: string;
  financial?: {
    amount: string;
    short: FreeCaseExclusion;
    open_short: FreeCaseExclusion;
    refused: FreeCaseExclusion;
  };
  members: {
    index: number;
    free: boolean;
    quantity: number;
    received: number;
    refused: number;
    later: number;
  }[];
}

const money = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value);
const positiveUnits = (value: number) =>
  Number.isSafeInteger(value) && value > 0;
const sourceFingerprint = (group: InvoiceFreeCaseGroup) =>
  businessFingerprint(group.members);
function groupBasis(line: FreeCaseLine): string {
  return businessFingerprint({
    group: line.free_case_group?.source_fingerprint,
    members: line.free_case_group?.members,
    decision: line.free_case_group?.decision,
    allocation: line.free_case_group?.allocation,
    company: line.company_id,
    product: line.product_code,
    name: line.new_name_en,
    code: line.supplier_item_code,
    barcode: line.barcode,
    qty: line.qty_invoiced,
    received: line.qty_received_at_posting,
    refused: line.refused_units ?? 0,
    later: line.qty_later_received ?? 0,
    pack: line.units_per_case,
    pack_size: line.pack_size,
    tax_profile: line.tax_profile,
    taxable: line.taxable,
    date: line.date_value,
    date_type: line.date_type,
    lot: line.lot_number,
    unit: line.quantity_unit,
    entered: line.quantity_entered,
    cost: line.unit_cost_before_tax,
    case_cost: line.case_cost_before_tax,
    sold_by: line.sold_by,
  });
}
export function validFreeCaseGroup(line: FreeCaseLine): boolean {
  const group = line.free_case_group;
  if (
    !group?.answer ||
    !group.decision ||
    group.source_fingerprint !== sourceFingerprint(group) ||
    ![group.original_product_code, group.bound_product_code].includes(
      line.product_code,
    ) ||
    line.sold_by === "weight" ||
    line.units_per_case !== group.members[0].units_per_case
  )
    return false;
  if (group.answer.basis !== groupBasis(line)) return false;
  const active = group.members.filter(
    (m) => group.decision !== "mistake" || !m.free,
  );
  if (
    !active.length ||
    !money(group.paid_amount) ||
    !positiveUnits(group.paid_units)
  )
    return false;
  return (
    active.every((member) => {
      const part = group.allocation.find((a) => a.member_id === member.id);
      return (
        part &&
        Number.isSafeInteger(part.received) &&
        Number.isSafeInteger(part.refused) &&
        Number.isSafeInteger(part.later) &&
        part.received >= 0 &&
        part.received <= member.qty &&
        part.refused >= 0 &&
        part.refused <= part.received &&
        part.later >= 0 &&
        part.later <= member.qty - part.received
      );
    }) &&
    active.reduce((sum, m) => sum + m.qty, 0) === line.qty_invoiced &&
    active.reduce(
      (sum, m) =>
        sum + group.allocation.find((a) => a.member_id === m.id)!.received,
      0,
    ) === line.qty_received_at_posting
  );
}

export function bindFreeCaseProduct(line: FreeCaseLine): void {
  if (line.free_case_group)
    line.free_case_group.bound_product_code = line.product_code;
  refreshFreeCaseAnswer(line);
}

export function refreshFreeCaseAnswer(line: FreeCaseLine): void {
  if (line.free_case_group?.answer)
    line.free_case_group.answer.basis = groupBasis(line);
}

export function freeCasePaperAmount(line: FreeCaseLine): string | undefined {
  const group = line.free_case_group;
  if (!group) return undefined;
  if (validFreeCaseGroup(line)) return group.paid_amount;
  if (
    !group.answer &&
    group.source_fingerprint === sourceFingerprint(group) &&
    line.qty_invoiced === group.paid_units + group.free_units &&
    line.unit_cost_before_tax === group.paid_unit_cost
  )
    return group.paid_amount;
  return undefined;
}

export function freeCasePrintedDescriptions(line: FreeCaseLine): string[] {
  return line.free_case_group && validFreeCaseGroup(line)
    ? line.free_case_group.members
        .filter((member) => {
          const group = line.free_case_group!;
          const part = group.allocation.find(
            (item) => item.member_id === member.id,
          )!;
          return (
            (group.decision !== "mistake" || !member.free) &&
            part.received - part.refused + part.later > 0
          );
        })
        .flatMap((member) =>
          member.printed_description ? [member.printed_description] : [],
        )
    : line.printed_description
      ? [line.printed_description]
      : [];
}

interface FreeCaseExclusion {
  quantity: number;
  beforeTax: string;
  tax: string;
  total: string;
}
/** Exact member amounts, independent of the chosen regular pricing cost. */
export function freeCaseExclusion(
  line: FreeCaseLine,
  kind: "short" | "open_short" | "refused",
) {
  if (!validFreeCaseGroup(line)) return undefined;
  const group = line.free_case_group!;
  let amount = new Decimal(0),
    tax = new Decimal(0),
    quantity = 0;
  const totalTax = new Decimal(line.line_tax || "0");
  for (const member of group.members) {
    if (group.decision === "mistake" && member.free) continue;
    const part = group.allocation.find((a) => a.member_id === member.id)!;
    const missing = member.qty - part.received;
    const count =
      kind === "refused"
        ? part.refused
        : missing - (kind === "open_short" ? part.later : 0);
    quantity += count;
    const original = new Decimal(member.paper_amount);
    const cumulative = (q: number, value: Decimal) =>
      value.times(q).div(member.qty).toDecimalPlaces(2);
    amount = amount.plus(
      kind !== "refused"
        ? cumulative(missing, original).minus(
            cumulative(kind === "open_short" ? part.later : 0, original),
          )
        : cumulative(missing + part.refused, original).minus(
            cumulative(missing, original),
          ),
    );
    const memberTax =
      group.paid_amount === "0.00"
        ? new Decimal(0)
        : totalTax.times(original).div(group.paid_amount);
    tax = tax.plus(
      kind !== "refused"
        ? cumulative(missing, memberTax).minus(
            cumulative(kind === "open_short" ? part.later : 0, memberTax),
          )
        : cumulative(missing + part.refused, memberTax).minus(
            cumulative(missing, memberTax),
          ),
    );
  }
  return {
    quantity,
    beforeTax: amount.toFixed(2),
    tax: tax.toFixed(2),
    total: amount.plus(tax).toFixed(2),
  };
}

/** Safe display facts only: member/source fingerprints never leave the domain. */
export function freeCaseView(
  line: FreeCaseLine,
  costs: boolean,
): FreeCaseView | undefined {
  const group = line.free_case_group;
  if (!group) return undefined;
  return {
    free_units: group.free_units,
    ...(line.units_per_case && group.free_units % line.units_per_case === 0
      ? { free_cases: String(group.free_units / line.units_per_case) }
      : {}),
    decision: group.decision,
    ...(group.answer
      ? {
          answer: {
            by_user_id: group.answer.by_user_id,
            by: group.answer.by,
            at: group.answer.at,
          },
        }
      : {}),
    valid: validFreeCaseGroup(line),
    physical_units: line.qty_invoiced,
    ...(group.difference_note
      ? { difference_note: group.difference_note.text }
      : {}),
    members: group.members.map((member, index) => ({
      index,
      free: member.free,
      quantity: member.qty,
      ...(() => {
        const part = group.allocation.find((a) => a.member_id === member.id)!;
        return {
          received: part.received,
          refused: part.refused,
          later: part.later,
        };
      })(),
    })),
    ...(costs
      ? {
          paid_amount: group.paid_amount,
          pricing_unit_cost: line.unit_cost_before_tax,
          ...(validFreeCaseGroup(line)
            ? {
                financial: {
                  amount: group.paid_amount,
                  short: freeCaseExclusion(line, "short")!,
                  open_short: freeCaseExclusion(line, "open_short")!,
                  refused: freeCaseExclusion(line, "refused")!,
                },
              }
            : {}),
        }
      : {}),
  };
}

function identity(line: FreeCaseLine): string | undefined {
  if (
    line.sold_by === "weight" ||
    !positiveUnits(line.qty_invoiced) ||
    !positiveUnits(line.units_per_case ?? 0) ||
    line.reading_product_match?.identity_requires_check
  )
    return undefined;
  const name =
    line.product_code === "NEW"
      ? normalizedPrintedItem(line.new_name_en ?? "")
      : line.product_code;
  if (!name) return undefined;
  return JSON.stringify([
    line.company_id,
    line.product_code === "NEW" ? "new" : "known",
    name,
    line.sold_by ?? "each",
    line.units_per_case,
    normalizedPrintedItem(line.pack_size ?? ""),
    line.barcode ?? "",
    line.supplier_item_code_inferred ? "" : (line.supplier_item_code ?? ""),
    line.tax_profile,
    line.taxable,
    line.date_value ?? "",
    line.lot_number ?? "",
  ]);
}

/** Preserve the original mapped members while displaying one conservative paid/free candidate. */
export function groupInvoiceFreeCases(lines: InvoiceLine[]): InvoiceLine[] {
  const buckets = new Map<string, InvoiceLine[]>();
  for (const line of lines) {
    const key = identity(line);
    if (key && !line.free_case_group)
      buckets.set(key, [...(buckets.get(key) ?? []), line]);
  }
  const grouped = new Map<InvoiceLine, InvoiceLine>(),
    removed = new Set<InvoiceLine>();
  for (const candidates of buckets.values()) {
    if (candidates.length !== 2) continue;
    const paid = candidates.find(
      (line) =>
        money(line.line_total) &&
        new Decimal(line.line_total).gt(0) &&
        /^\d+(?:\.\d{1,4})?$/.test(line.unit_cost_before_tax) &&
        new Decimal(line.unit_cost_before_tax).gt(0),
    );
    const free = candidates.find(
      (line) =>
        line !== paid &&
        (!line.unit_cost_before_tax ||
          new Decimal(line.unit_cost_before_tax).isZero()) &&
        (!line.line_total ||
          (money(line.line_total) && new Decimal(line.line_total).isZero())),
    );
    if (!paid || !free) continue;
    const printedFreeCost = free.imported_unit_cost_basis;
    if (
      [
        printedFreeCost?.printed_unit_cost_before_tax,
        printedFreeCost?.printed_case_cost_before_tax,
      ].some((value) => value && new Decimal(value).gt(0))
    )
      continue;
    // Missing/uncertain packs or arbitrary source arithmetic are not a free-case fact.
    if (
      [paid, free].some(
        (line) =>
          line.units_per_case_inferred ||
          (line.low_confidence_fields ?? []).some((f) =>
            [
              "units_per_case",
              "quantity_unit",
              "quantity_entered",
              "product_code",
            ].includes(f),
          ),
      )
    )
      continue;
    const result = structuredClone(paid);
    const members = [paid, free].map((line): FreeCaseMember => ({
      id: line.id!,
      import_line_index: line.import_line_index,
      description: line.description,
      printed_description: line.printed_description,
      supplier_item_code: line.supplier_item_code,
      supplier_item_code_inferred: line.supplier_item_code_inferred,
      barcode: line.barcode,
      qty: line.qty_invoiced,
      received: line.qty_received_at_posting,
      refused: line.refused_units ?? 0,
      unit_cost: line.unit_cost_before_tax,
      paper_amount: line.line_total || "0.00",
      paper_tax: line.line_tax || "0.00",
      quantity_unit: line.quantity_unit,
      quantity_entered: line.quantity_entered,
      units_per_case: line.units_per_case!,
      pack_size: line.pack_size,
      expiry_as_printed: line.expiry_as_printed,
      lot_number: line.lot_number,
      tax_profile: line.tax_profile,
      taxable: line.taxable,
      handwritten_note: line.handwritten_note,
      original_checks: [...(line.low_confidence_fields ?? [])],
      imported_cost_basis: structuredClone(line.imported_unit_cost_basis),
      free: line === free,
    }));
    const group: InvoiceFreeCaseGroup = {
      original_product_code: paid.product_code,
      members,
      paid_units: paid.qty_invoiced,
      free_units: free.qty_invoiced,
      paid_amount: paid.line_total,
      paid_unit_cost: paid.unit_cost_before_tax,
      source_fingerprint: "",
      allocation: members.map((m) => ({
        member_id: m.id,
        received: m.received,
        refused: m.refused,
        later: 0,
      })),
    };
    group.source_fingerprint = sourceFingerprint(group);
    result.free_case_group = group;
    result.qty_invoiced += free.qty_invoiced;
    result.qty_received_at_posting += free.qty_received_at_posting;
    result.quantity_entered =
      result.quantity_unit === "cases"
        ? String(result.qty_invoiced / result.units_per_case!)
        : String(result.qty_invoiced);
    result.low_confidence_fields = [
      ...new Set([
        ...(paid.low_confidence_fields ?? []),
        ...(free.low_confidence_fields ?? []).filter(
          (f) =>
            ![
              "unit_cost_before_tax",
              "case_cost_before_tax",
              "line_total",
            ].includes(f),
        ),
        "free_case_decision",
      ]),
    ];
    result.review_confirmed = false;
    delete result.known_delivery;
    grouped.set(paid, result);
    removed.add(free);
  }
  return lines
    .filter((line) => !removed.has(line))
    .map((line) => grouped.get(line) ?? line);
}

export function freeCaseActionQuote(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
): string {
  actor = requireInvoiceAuthority(state, actor, "invoices.cost_read");
  const invoice = state.invoice;
  return businessFingerprint({
    actor: {
      company: actor.company_id,
      user: actor.user_id,
      session: actor.session_id,
      epoch: actor.authority_epoch,
      version: actor.person_version,
      selection: actor.selection,
      scope: actor.location_scope,
      locations: actor.allowed_branches,
    },
    invoice,
    index,
    config: state.config,
    products: state.products.filter(
      (product) =>
        product.company_id === invoice.company_id &&
        invoice.lines.some((line) => line.product_code === product.code),
    ),
    history: state.activity.filter(
      (entry) =>
        entry.company_id === invoice.company_id &&
        entry.entity_id === invoice.id,
    ),
    last_action: state.activity.at(-1)?.id,
  });
}

export function answerInvoiceFreeCases(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  choice: FreeCaseChoice,
  quote: string,
  now = new Date(),
): void {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  requireInvoiceAuthority(state, actor, "invoices.cost_read", state.invoice.id);
  const invoice = state.invoice,
    line = invoice.lines[index],
    group = line?.free_case_group;
  if (
    !["review", "draft"].includes(invoice.status) ||
    !group ||
    !["bonus", "two_for_one", "mistake"].includes(choice) ||
    quote !== freeCaseActionQuote(state, actor, index) ||
    group.source_fingerprint !== sourceFingerprint(group) ||
    line.product_code !== group.original_product_code ||
    line.sold_by === "weight" ||
    line.units_per_case !== group.members[0].units_per_case
  )
    throw new Error("The invoice changed. Open the free-case question again.");
  const source = group.members[0];
  if (
    normalizedPrintedItem(line.pack_size ?? "") !==
      normalizedPrintedItem(source.pack_size ?? "") ||
    (line.barcode ?? "") !== (source.barcode ?? "") ||
    (!line.supplier_item_code_inferred &&
      !source.supplier_item_code_inferred &&
      (line.supplier_item_code ?? "") !== (source.supplier_item_code ?? "")) ||
    (line.lot_number ?? "") !== (source.lot_number ?? "")
  )
    throw new Error(
      "The grouped source identity changed. Restore its pack and identifiers before answering.",
    );
  const before = structuredClone(invoice);
  group.decision = choice;
  group.difference_note =
    choice === "mistake"
      ? {
          text: "The duplicate zero/blank-cost printed member was a mistake; only the paid quantity was accepted.",
          by_user_id: actor.user_id,
          by: actor.actor,
          at: now.toISOString(),
        }
      : undefined;
  const active = group.members.filter((m) => choice !== "mistake" || !m.free);
  line.qty_invoiced = active.reduce((sum, m) => sum + m.qty, 0);
  line.qty_received_at_posting = active.reduce(
    (sum, m) =>
      sum + group.allocation.find((a) => a.member_id === m.id)!.received,
    0,
  );
  line.refused_units = active.reduce(
    (sum, m) =>
      sum + group.allocation.find((a) => a.member_id === m.id)!.refused,
    0,
  );
  line.qty_later_received = active.reduce(
    (sum, m) => sum + group.allocation.find((a) => a.member_id === m.id)!.later,
    0,
  );
  line.quantity_entered =
    line.quantity_unit === "cases"
      ? String(line.qty_invoiced / line.units_per_case!)
      : String(line.qty_invoiced);
  line.unit_cost_before_tax =
    choice === "two_for_one"
      ? new Decimal(group.paid_amount).div(line.qty_invoiced).toFixed(4)
      : group.paid_unit_cost;
  if (line.quantity_unit === "cases")
    line.case_cost_before_tax = new Decimal(line.unit_cost_before_tax)
      .times(line.units_per_case!)
      .toFixed(4);
  line.line_total = group.paid_amount;
  delete line.known_delivery;
  line.review_changed_after_confirmation ||= line.review_confirmed;
  line.review_confirmed = false;
  group.answer = {
    by_user_id: actor.user_id,
    by: actor.actor,
    at: now.toISOString(),
    basis: groupBasis(line),
  };
  line.low_confidence_fields = line.low_confidence_fields?.filter(
    (f) => f !== "free_case_decision",
  );
  invoice.version = (invoice.version ?? 0) + 1;
  state.activity.push({
    id: createId("free-case-answer"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Answer free-case question",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    entity_type: "invoice",
    entity_id: invoice.id,
    before,
    after: structuredClone(invoice),
    reversible: true,
  });
}

/** A delivery edit identifies the paid/free member rather than averaging its paper value. */
export function setFreeCaseMemberDelivery(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  memberIndex: number,
  received: number,
  refused: number,
  quote: string,
  now = new Date(),
): void {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  const line = state.invoice.lines[index],
    group = line?.free_case_group,
    member = group?.members[memberIndex];
  if (
    !group ||
    !validFreeCaseGroup(line) ||
    !member ||
    !["draft", "review"].includes(state.invoice.status) ||
    quote !== freeCaseActionQuote(state, actor, index) ||
    !Number.isSafeInteger(received) ||
    !Number.isSafeInteger(refused) ||
    received < 0 ||
    received > member.qty ||
    refused < 0 ||
    refused > received
  )
    throw new Error("Check the paid and free delivered quantities.");
  const before = structuredClone(state.invoice);
  const part = group.allocation.find((a) => a.member_id === member.id)!;
  part.received = received;
  part.refused = refused;
  const active = group.members.filter(
    (m) => group.decision !== "mistake" || !m.free,
  );
  line.qty_received_at_posting = active.reduce(
    (sum, m) =>
      sum + group.allocation.find((a) => a.member_id === m.id)!.received,
    0,
  );
  line.refused_units = active.reduce(
    (sum, m) =>
      sum + group.allocation.find((a) => a.member_id === m.id)!.refused,
    0,
  );
  refreshFreeCaseAnswer(line);
  line.review_confirmed = false;
  state.invoice.version = (state.invoice.version ?? 0) + 1;
  state.activity.push({
    id: createId("free-case-delivery"),
    company_id: state.invoice.company_id,
    branch: state.invoice.branch,
    action: "Set paid/free delivery quantities",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    entity_type: "invoice",
    entity_id: state.invoice.id,
    before,
    after: structuredClone(state.invoice),
    reversible: true,
  });
}
