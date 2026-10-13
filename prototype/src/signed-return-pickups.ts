import Decimal from "decimal.js";
import type { ReturnRecord } from "./types";
import type { EvidenceEvent, OperationalReturn } from "./operations";
import type { ReturnMemo } from "./return-workflow";

export type SignedPickupMemo = Pick<
  ReturnMemo,
  | "id"
  | "company_id"
  | "branch"
  | "return_id"
  | "signed_evidence_reference"
  | "representative"
  | "correction_of"
> & {
  lines: Pick<
    ReturnMemo["lines"][number],
    "product_code" | "quantity" | "quantity_unit"
  >[];
};
export type SignedPickupRecord = Omit<ReturnRecord, "pickup_memos"> & {
  pickup_memos?: SignedPickupMemo[];
} & Pick<OperationalReturn, "evidence" | "claims" | "recovered">;

const validQuantity = (value: unknown, weighted = false) => {
  try {
    if (typeof value !== "number") return undefined;
    const number = new Decimal(value);
    return number.isFinite() &&
      number.gte(0) &&
      number.lte(Number.MAX_SAFE_INTEGER) &&
      number.eq(number.toDecimalPlaces(weighted ? 3 : 0))
      ? number
      : undefined;
  } catch {
    return undefined;
  }
};
const memoQuantities = (memo: SignedPickupMemo) => {
  if (!Array.isArray(memo.lines)) return undefined;
  const result = new Map<string, Decimal>();
  for (const line of memo.lines) {
    const quantity = validQuantity(line.quantity, line.quantity_unit === "lb");
    if (!quantity || result.has(line.product_code)) return undefined;
    result.set(line.product_code, quantity);
  }
  return result;
};
const sameQuantities = (
  left: Map<string, Decimal>,
  right: Record<string, number>,
  record: SignedPickupRecord,
) => {
  const codes = new Set([...left.keys(), ...Object.keys(right)]);
  return [...codes].every((code) => {
    const line = record.lines.find((line) => line.product_code === code);
    const actual = validQuantity(
      right[code] ?? 0,
      line?.quantity_unit === "lb",
    );
    return !!actual && actual.eq(left.get(code) ?? 0);
  });
};
/** Actual signed per-item pickup evidence, never an imported aggregate projection. */
export function signedReturnPickupQuantities(
  record: SignedPickupRecord,
): Map<string, number> {
  const operational = record;
  const events = operational.evidence ?? [];
  const memos = record.pickup_memos ?? [];
  const valid = new Map<
    string,
    { memo: SignedPickupMemo; quantities: Map<string, Decimal> }
  >();
  const superseded = new Set<string>();
  const ambiguous = new Set<string>();
  const rootPapers = new Map<string, string>();
  const markAmbiguousChain = (id: string) => {
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      ambiguous.add(current);
      current = memos.find((item) => item.id === current)?.correction_of;
    }
  };
  for (const memo of memos) {
    if (
      memo.company_id !== record.company_id ||
      memo.branch !== record.branch ||
      memo.return_id !== record.id ||
      !memo.id ||
      valid.has(memo.id) ||
      !memo.signed_evidence_reference?.trim() ||
      !memo.representative?.trim()
    )
      continue;
    const quantities = memoQuantities(memo);
    if (
      !quantities ||
      [...quantities.keys()].some(
        (code) => !record.lines.some((line) => line.product_code === code),
      )
    )
      continue;
    if (memo.correction_of) {
      const previous = valid.get(memo.correction_of);
      const correction = record.pickup_corrections?.find(
        (item) =>
          item.memo_id === memo.id &&
          item.previous_memo_id === memo.correction_of &&
          item.company_id === record.company_id &&
          item.branch === record.branch &&
          item.return_id === record.id &&
          item.reason.trim(),
      );
      if (
        !previous ||
        superseded.has(memo.correction_of) ||
        !correction ||
        memo.signed_evidence_reference !==
          previous.memo.signed_evidence_reference ||
        memo.representative !== previous.memo.representative ||
        !sameQuantities(previous.quantities, correction.before, record) ||
        !sameQuantities(quantities, correction.after, record)
      ) {
        markAmbiguousChain(memo.correction_of);
        continue;
      }
      superseded.add(memo.correction_of);
    } else {
      const samePaper = rootPapers.get(memo.signed_evidence_reference.trim());
      if (samePaper) {
        const prior = valid.get(samePaper);
        if (
          !prior ||
          !sameQuantities(
            prior.quantities,
            Object.fromEntries(
              [...quantities].map(([code, number]) => [
                code,
                number.toNumber(),
              ]),
            ),
            record,
          )
        )
          markAmbiguousChain(samePaper);
        continue;
      }
      const matching = events.filter(
        (event) =>
          event.kind === "pickup" &&
          event.document?.trim() === memo.signed_evidence_reference.trim(),
      );
      if (
        matching.some(
          (event) =>
            event.representative?.trim() !== memo.representative.trim() ||
            !sameQuantities(quantities, event.quantities ?? {}, record),
        )
      )
        continue;
    }
    valid.set(memo.id, { memo, quantities });
    if (!memo.correction_of)
      rootPapers.set(memo.signed_evidence_reference.trim(), memo.id);
  }
  const totals = new Map<string, Decimal>();
  const hasAmbiguousAncestor = (id: string) => {
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current && !seen.has(current)) {
      if (ambiguous.has(current)) return true;
      seen.add(current);
      current = valid.get(current)?.memo.correction_of;
    }
    return false;
  };
  for (const [id, item] of valid)
    if (!superseded.has(id) && !hasAmbiguousAncestor(id))
      for (const [code, quantity] of item.quantities)
        totals.set(code, (totals.get(code) ?? new Decimal(0)).plus(quantity));
  // Older retained signed events may have no memo. The same paper is never counted twice.
  const memoPapers = new Set(
    memos.map((memo) => memo.signed_evidence_reference?.trim()).filter(Boolean),
  );
  const seenPapers = new Set<string>();
  for (const event of events as EvidenceEvent[]) {
    const paper = event.document?.trim();
    if (
      event.kind !== "pickup" ||
      !paper ||
      !event.representative?.trim() ||
      memoPapers.has(paper) ||
      seenPapers.has(paper)
    )
      continue;
    seenPapers.add(paper);
    const samePaperEvents = events.filter(
      (other) => other.kind === "pickup" && other.document?.trim() === paper,
    );
    const eventQuantities = new Map(
      Object.entries(event.quantities ?? {}).flatMap(([code, value]) => {
        const line = record.lines.find((line) => line.product_code === code);
        const quantity = validQuantity(value, line?.quantity_unit === "lb");
        return quantity ? [[code, quantity] as const] : [];
      }),
    );
    if (
      samePaperEvents.some(
        (other) =>
          other.representative?.trim() !== event.representative?.trim() ||
          !sameQuantities(eventQuantities, other.quantities ?? {}, record),
      )
    )
      continue;
    for (const [code, value] of Object.entries(event.quantities ?? {})) {
      const line = record.lines.find((line) => line.product_code === code);
      if (!line) continue;
      const quantity = validQuantity(value, line.quantity_unit === "lb");
      if (quantity)
        totals.set(code, (totals.get(code) ?? new Decimal(0)).plus(quantity));
    }
  }
  return new Map(
    [...totals].flatMap(([code, quantity]) => {
      const line = record.lines.find((line) => line.product_code === code);
      // Conflicting/excess retained evidence needs review, never an inflated credit ceiling.
      return line && quantity.gt(0) && quantity.lte(line.qty)
        ? [[code, quantity.toNumber()] as const]
        : [];
    }),
  );
}

/** Retained settlements outrank stale UI projections. Matching event/claim snapshots count once. */
export function retainedReturnSettlementEvidence(record: SignedPickupRecord) {
  const operational = record;
  const quantities = new Map<string, Decimal>();
  const replacements = new Map<string, Decimal>();
  const otherSettlements = new Map<string, Decimal>();
  const blocked = new Set<string>();
  const known = new Set(record.lines.map((line) => line.product_code));
  const mark = (codes: Iterable<string>) => {
    for (const code of codes) if (known.has(code)) blocked.add(code);
  };
  const parse = (covers: Record<string, number> | undefined) => {
    const parsed = new Map<string, Decimal>();
    if (!covers || typeof covers !== "object" || Array.isArray(covers)) {
      mark(known);
      return undefined;
    }
    for (const [code, value] of Object.entries(covers ?? {})) {
      const line = record.lines.find((line) => line.product_code === code);
      const quantity = validQuantity(value, line?.quantity_unit === "lb");
      if (!line || !quantity) {
        mark(known);
        return undefined;
      }
      if (quantity.gt(0)) parsed.set(code, quantity);
    }
    if (!parsed.size) {
      mark(known);
      return undefined;
    }
    return parsed;
  };
  const add = (covers: Map<string, Decimal>, replacement = false) => {
    for (const [code, count] of covers) {
      quantities.set(
        code,
        (quantities.get(code) ?? new Decimal(0)).plus(count),
      );
      const kind = replacement ? replacements : otherSettlements;
      kind.set(code, (kind.get(code) ?? new Decimal(0)).plus(count));
    }
  };
  const signature = (covers: Map<string, Decimal>) =>
    JSON.stringify(
      [...covers]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, count]) => [code, count.toString()]),
    );
  const posted = new Map<
    string,
    {
      covers: Map<string, Decimal>;
      signature: string;
      document?: string;
      id: string;
      type: string;
    }
  >();
  const buckets = new Map<string, number>();
  for (const claim of operational.claims ?? []) {
    if (claim.status !== "posted") continue;
    const covers = parse(claim.covers);
    if (!covers) continue;
    const document = claim.document?.trim();
    const key = document ? `document:${document}` : `claim:${claim.id}`;
    const evidence = `${claim.type}:${signature(covers)}:${claim.amount ?? ""}`;
    const previous = posted.get(key);
    if (previous) {
      if (previous.signature !== evidence)
        mark([...previous.covers.keys(), ...covers.keys()]);
      continue;
    }
    posted.set(key, {
      covers,
      signature: evidence,
      document,
      id: claim.id,
      type: claim.type,
    });
    add(covers);
    const bucket = `${document ?? ""}:${signature(covers)}`;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const seenEvents = new Map<string, string>();
  const matchedEvents = new Map<string, number>();
  for (const event of operational.evidence ?? []) {
    if (event.kind !== "claim_posted" && event.kind !== "replacement") continue;
    const covers = parse(event.quantities);
    if (!covers) continue;
    const document = event.document?.trim();
    const key = document
      ? `${event.kind}:document:${document}`
      : `${event.kind}:event:${event.id}`;
    const evidence = signature(covers);
    const previous = seenEvents.get(key);
    if (previous) {
      if (previous !== evidence) mark(known);
      continue;
    }
    seenEvents.set(key, evidence);
    if (event.kind === "replacement") {
      add(covers, true);
      continue;
    }
    const bucket = `${document ?? ""}:${evidence}`;
    if (buckets.has(bucket)) {
      const matches = (matchedEvents.get(bucket) ?? 0) + 1;
      matchedEvents.set(bucket, matches);
      if (matches > buckets.get(bucket)!) mark(covers.keys());
      continue;
    }
    // A reused note with different covered items is ambiguous rather than a second financial posting.
    if (
      document &&
      [...posted.values()].some((claim) => claim.document === document)
    ) {
      mark(covers.keys());
      continue;
    }
    add(covers);
  }
  const hasRetainedCredit =
    (operational.claims ?? []).some(
      (claim) => claim.status === "posted" && claim.type !== "no_compensation",
    ) ||
    (operational.evidence ?? []).some((event) => event.kind === "claim_posted");
  if (
    (record.credit_document || record.compensation_amount) &&
    !hasRetainedCredit
  )
    mark(known);
  if (record.replacement_received) {
    const snapshot = record.replacement_received;
    const events = (operational.evidence ?? []).filter(
      (event) => event.kind === "replacement",
    );
    const snapshotCovered = validQuantity(snapshot.covers_original_qty, true);
    const represented = events.some((event) => {
      const covers = parse(event.quantities);
      return (
        !!covers &&
        !!snapshotCovered &&
        event.product_code === snapshot.product_code &&
        event.actual_qty === snapshot.qty &&
        [...covers.values()]
          .reduce((total, value) => total.plus(value), new Decimal(0))
          .eq(snapshotCovered)
      );
    });
    if (!snapshotCovered) mark(known);
    if (
      !represented &&
      (events.length > 0 ||
        record.lines.length > 1 ||
        posted.size > 0 ||
        hasRetainedCredit)
    )
      // An orphan snapshot cannot silently overlap different replacement events
      // or other retained settlement kinds. Preserve that legacy history for review.
      mark(known);
  }
  for (const line of record.lines) {
    const values = [
      line.settled ?? 0,
      line.replaced ?? 0,
      record.replacement_received && record.lines.length === 1
        ? record.replacement_received.covers_original_qty
        : 0,
    ];
    const projected = values.map((value) =>
      validQuantity(value, line.quantity_unit === "lb"),
    );
    if (projected.some((value) => !value)) mark([line.product_code]);
    if (
      (otherSettlements.get(line.product_code) ?? new Decimal(0)).gt(0) &&
      (projected[1] ?? new Decimal(0)).gt(
        replacements.get(line.product_code) ?? 0,
      )
    )
      // A replacement-only legacy projection cannot be treated as an aggregate
      // settlement when another retained outcome is also present.
      mark([line.product_code]);
    const retained = Decimal.max(
      quantities.get(line.product_code) ?? 0,
      ...projected.map((value) => value ?? new Decimal(0)),
    );
    if (retained.gt(line.qty)) mark([line.product_code]);
    quantities.set(line.product_code, retained);
  }
  return {
    quantities: new Map(
      [...quantities].map(([code, amount]) => [code, amount.toNumber()]),
    ),
    blocked,
  };
}
