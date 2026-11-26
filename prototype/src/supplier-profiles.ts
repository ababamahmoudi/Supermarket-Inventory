import type { DemoState, SupplierRecord } from "./types";
import { directoryRecipients } from "./permissions";
import {
  supplierRecords,
  supplierMatches,
  hydrateSuppliers,
} from "./supplier-editor";
import { createId } from "./ids";
import {
  BrowserAuthorityRepository,
  requireSystemReconciliation,
} from "./authority-repository";
import type { SystemAttribution } from "./authority-types";
import { sha256Bytes } from "./sha256";

export const supplierProfileFields = [
  "phone",
  "email",
  "sales_rep_name",
  "sales_rep_phone",
  "payment_terms",
  "address",
] as const;
export function missingSupplierProfileDetails(record: SupplierRecord) {
  return supplierProfileFields.filter((field) => !record[field]?.trim());
}

/** One retained event per supplier and recipient; completing a profile clears its live projection. */
export function syncSupplierProfileNotifications(
  state: DemoState,
  now = new Date(),
): void {
  const companyId = state.config.company.seed_key;
  for (const supplier of supplierRecords(state)) {
    if (
      supplier.company_id !== companyId ||
      !supplier.active ||
      !missingSupplierProfileDetails(supplier).length
    )
      continue;
    for (const person of directoryRecipients(state, {
      roles: ["owner", "manager"],
      capability: "suppliers.manage",
    })) {
      const eventKey = `supplier-profile:${supplier.id}:${person.user_id}`;
      state.notifications ??= [];
      if (
        state.notifications.some(
          (row) => row.company_id === companyId && row.event_key === eventKey,
        )
      )
        continue;
      state.notifications.push({
        id: createId("notification"),
        company_id: companyId,
        branch: "all",
        event_key: eventKey,
        recipient_user_id: person.user_id,
        target_username: person.username,
        kind: "supplier_profile_incomplete",
        supplier_id: supplier.id,
        href: `suppliers?name=${encodeURIComponent(supplier.name)}&edit=1`,
        created_at: now.toISOString(),
      });
    }
  }
}

/** A migration preserves source evidence and retires supplier approvals from active work. */
export function activatePendingSuppliersDraft(
  state: DemoState,
  attribution: SystemAttribution,
): void {
  requireSystemReconciliation(state, attribution, "price_updates");
  if (state.prototype_r2_supplier_schema === 1) return;
  hydrateSuppliers(state);
  const companyId = state.config.company.seed_key;
  for (const supplier of state.suppliers!) {
    if (supplier.company_id !== companyId || !supplier.active) continue;
    const before = structuredClone(supplier);
    const waiting = supplier.status === "proposed" && supplier.active;
    if (waiting) supplier.status = "confirmed";
    if (supplier.invoice_review_required)
      supplier.invoice_review_required = false;
    if (
      supplier.created_from_import &&
      supplier.notes === "Created from an imported reading"
    )
      supplier.notes = "";
    if (waiting)
      state.activity.push({
        id: createId("supplier-migration"),
        company_id: companyId,
        branch: "all",
        action: "Activate supplier without approval",
        by: "System",
        at: attribution.applied_at,
        entity_type: "supplier",
        entity_id: supplier.id,
        reversible: false,
        before,
        after: structuredClone(supplier),
      });
    for (const invoice of [state.invoice, ...(state.invoices ?? [])])
      if (
        invoice.company_id === companyId &&
        invoice.status !== "posted" &&
        supplier.active &&
        supplierMatches(supplier, invoice.supplier) &&
        (waiting ||
          invoice.supplier_review_required ||
          invoice.supplier_confirmed === false)
      ) {
        invoice.supplier_confirmed = true;
        invoice.supplier_review_required = false;
        invoice.supplier_review_confirmed = true;
      }
  }
  for (const approval of state.approvals)
    if (
      approval.company_id === companyId &&
      approval.type === "new_supplier" &&
      approval.status === "pending"
    )
      approval.status = "superseded";
  state.prototype_r2_supplier_schema = 1;
  syncSupplierProfileNotifications(state, new Date(attribution.applied_at));
}

/** The exact durable pre-migration source is archived and verified before publishing. */
export async function migrateSupplierProfiles(
  repository: BrowserAuthorityRepository,
  companyId: string,
): Promise<void> {
  const hash = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
  class ChangedDuringBackup extends Error {}
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await repository.loadBusiness<DemoState>(companyId);
    if (loaded.state.prototype_r2_supplier_schema === 1) return;
    const raw = JSON.stringify(loaded.state);
    await repository.archivePrivateBackup(
      {
        id: `r2-suppliers:${companyId}:${loaded.revision}:${hash(raw)}`,
        company_id: companyId,
        source_key: `business:${companyId}:revision:${loaded.revision}`,
        raw,
        sha256: hash(raw),
        created_at: new Date().toISOString(),
      },
      hash,
    );
    try {
      await repository.runSystemReconciliation<DemoState, void>(
        companyId,
        "price_updates",
        (state, attribution) => {
          if (state.prototype_r2_supplier_schema === 1) return;
          if (JSON.stringify(state) !== raw) throw new ChangedDuringBackup();
          activatePendingSuppliersDraft(state, attribution);
        },
      );
      return;
    } catch (cause) {
      if (!(cause instanceof ChangedDuringBackup)) throw cause;
    }
  }
  throw new Error("migration_conflict");
}
