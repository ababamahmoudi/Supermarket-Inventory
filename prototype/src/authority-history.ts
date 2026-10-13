import type {
  AuthorityHistoryEntry,
  AuthorityHistorySummary,
  PersonRecord,
  RegisteredDevice,
} from "./authority-types";
import type { DirectoryAuditEvent } from "./authority-document";

/** Whitelist only business-relevant audit fields; never serialize a private record. */
function summary(
  record: PersonRecord | RegisteredDevice,
): AuthorityHistorySummary {
  if ("role" in record)
    return {
      kind: "person",
      id: record.id,
      name_en: record.name_en,
      name_fa: record.name_fa,
      username: record.username,
      role: record.role,
      location_scope: structuredClone(record.location_scope),
      status: record.status,
    };
  return {
    kind: "device",
    id: record.id,
    name: record.name,
    location_id: record.location_id,
    active: record.active,
  };
}
export function projectAuthorityHistory(
  events: readonly DirectoryAuditEvent[],
): readonly AuthorityHistoryEntry[] {
  return events.map((event) => ({
    id: event.id,
    company_id: event.company_id,
    actor_user_id: event.actor_user_id,
    actor_role_snapshot: event.actor_role_snapshot,
    actor_name_snapshot: event.actor_name_snapshot,
    device_id: event.device_id,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    action: event.action,
    reason: event.reason,
    at: event.at,
    before: event.before ? summary(event.before) : null,
    after: summary(event.after),
    reversible: false,
  }));
}
