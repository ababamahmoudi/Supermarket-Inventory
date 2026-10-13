import { requireCapability } from "./permissions";
import { createId } from "./ids";
import { OperationError, type OperationsContext } from "./operations";
import type { DemoState } from "./types";

export function saveSupplierDocumentSettings(
  state: DemoState,
  context: OperationsContext,
  settings: NonNullable<DemoState["config"]["supplier_documents"]>,
): void {
  requireCapability(state, context, "settings.manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  if (
    !["en", "bilingual"].includes(settings.return_memo) ||
    !["en", "bilingual"].includes(settings.supplier_order)
  )
    throw new Error("Choose English or bilingual for each supplier document.");
  const before = structuredClone(
    state.config.supplier_documents ?? {
      return_memo: "en",
      supplier_order: "en",
    },
  );
  if (JSON.stringify(before) === JSON.stringify(settings)) return;
  state.config.supplier_documents = structuredClone(settings);
  state.activity.unshift({
    id: createId("supplier-document-settings"),
    company_id: context.company_id,
    branch: "all",
    scope: "all",
    action: "Supplier document settings changed",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at: new Date().toISOString(),
    reversible: true,
    entity_type: "settings",
    entity_id: "supplier_documents",
    before,
    after: structuredClone(settings),
  });
}
