/** Configured role captions and one-time legacy ACL decoding; never authority grants. */
import { ALL_CAPABILITIES } from "./capability-names";
import type { Capability, RoleId } from "./authority-types";
export type Role = RoleId;
export interface RoleDefinition {
  key: Role;
  label: string;
  label_fa?: string;
  summary: string;
  /** Descriptive metadata only; canonical grants are evaluated separately. */
  capabilities?: Capability[];
}

function configuredCapabilities(value: unknown): Capability[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((item) => !ALL_CAPABILITIES.includes(item))
  )
    throw new Error("Invalid configured capability");
  return [...new Set(value)] as Capability[];
}

const currentKeys: readonly Role[] = [
  "owner",
  "manager",
  "branch_supervisor",
  "floor_worker",
  "cashier",
];
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
export function decodeCurrentRole(value: unknown): Role | null {
  if (value === "supervisor") return "manager";
  return currentKeys.includes(value as Role) ? (value as Role) : null;
}
/** Optional source metadata must be a configured current role key. */
export function readConfiguredOptionalRole(value: unknown): Role | undefined {
  if (value === undefined) return undefined;
  const role = decodeCurrentRole(value);
  if (!role || role !== value) throw new Error("Invalid configured role key");
  return role;
}
/** Current configured labels are validated data, never cast from arbitrary JSON. */
export function readConfiguredRoleDefinitions(
  supplied: unknown,
): RoleDefinition[] {
  if (!Array.isArray(supplied))
    throw new Error("Missing configured role definition");
  const rows = supplied.map((value): RoleDefinition => {
    const row = object(value);
    const role = row && decodeCurrentRole(row.key);
    if (
      !row ||
      !role ||
      row.key !== role ||
      typeof row.label !== "string" ||
      !row.label.trim() ||
      typeof row.summary !== "string" ||
      (row.label_fa !== undefined && typeof row.label_fa !== "string")
    )
      throw new Error("Missing configured role definition");
    return {
      key: role,
      label: row.label.trim(),
      label_fa:
        typeof row.label_fa === "string" ? row.label_fa.trim() : undefined,
      summary: row.summary,
      ...(row.capabilities === undefined
        ? {}
        : { capabilities: configuredCapabilities(row.capabilities) }),
    };
  });
  if (
    rows.length !== currentKeys.length ||
    new Set(rows.map((row) => row.key)).size !== currentKeys.length
  )
    throw new Error("Missing configured role definition");
  return rows;
}
/** Fresh configured ACL rows already use current role keys; preserve their exact policy. */
export function readConfiguredRoleACL(supplied: unknown): Role[] {
  if (!Array.isArray(supplied))
    throw new Error("Missing configured role definition");
  return [
    ...new Set(
      supplied.map((value): Role => {
        const role = decodeCurrentRole(value);
        if (!role || role !== value)
          throw new Error("Missing configured role definition");
        return role;
      }),
    ),
  ];
}
/** Not a permission evaluator. Existing configured label/summary customization survives. */
export function normalizeRoleDefinitions(
  supplied: unknown,
  configuredDefaults: readonly RoleDefinition[],
): RoleDefinition[] {
  const suppliedRows = Array.isArray(supplied)
    ? supplied.flatMap((value) => {
        const row = object(value);
        return row ? [row] : [];
      })
    : [];
  return currentKeys.map((key) => {
    const fallback = configuredDefaults.find((row) => row.key === key);
    if (!fallback?.label.trim())
      throw new Error("Missing configured role definition");
    const direct = suppliedRows.find((row) => row.key === key);
    const legacy =
      key === "manager"
        ? suppliedRows.find((row) => row.key === "supervisor")
        : undefined;
    const row = direct ?? legacy;
    const text = (field: string) =>
      typeof row?.[field] === "string"
        ? (row[field] as string).trim()
        : undefined;
    // Only known old default labels are upgraded; Boss/custom translations remain.
    const label =
      legacy && !direct && text("label") === "Supervisor"
        ? fallback.label
        : text("label") || fallback.label;
    const label_fa =
      legacy && !direct && text("label_fa") === "سرپرست"
        ? fallback.label_fa
        : text("label_fa") || fallback.label_fa;
    return {
      key,
      label,
      label_fa,
      summary: text("summary") ?? fallback.summary,
      ...((row?.capabilities ?? fallback.capabilities) === undefined
        ? {}
        : {
            capabilities: configuredCapabilities(
              row?.capabilities ?? fallback.capabilities,
            ),
          }),
    };
  });
}
export function configuredRoleLabel(
  definitions: readonly RoleDefinition[],
  role: Role,
  language: "en" | "fa",
): string {
  const definition = definitions.find((row) => row.key === role);
  if (!definition?.label.trim())
    throw new Error("Missing configured role definition");
  return language === "fa"
    ? definition.label_fa || definition.label
    : definition.label;
}
/** One-time legacy role-list decoding, without inheriting worker capabilities. */
export function migrateLegacyRoleACL(supplied: unknown): Role[] {
  if (!Array.isArray(supplied)) return [];
  const migrated = new Set<Role>();
  for (const value of supplied) {
    if (value === "supervisor") {
      migrated.add("owner");
      migrated.add("manager");
    } else {
      const role = decodeCurrentRole(value);
      if (role) migrated.add(role);
    }
  }
  return currentKeys.filter((role) => migrated.has(role));
}
/** ACL migration only: legacy Supervisor access expands; no role inheritance. */
export function normalizeNotebookACL(supplied: unknown): Role[] {
  const values = Array.isArray(supplied) ? supplied : [];
  const migrated = new Set<Role>();
  for (const value of values) {
    if (value === "supervisor") {
      migrated.add("owner");
      migrated.add("manager");
    } else if (currentKeys.includes(value as Role)) migrated.add(value as Role);
  }
  if (migrated.has("owner") || migrated.has("manager")) {
    migrated.add("owner");
    migrated.add("manager");
  }
  if (migrated.has("floor_worker")) migrated.add("branch_supervisor");
  return currentKeys.filter((role) => migrated.has(role));
}
export interface NotebookACLResult {
  read_roles: Role[];
  add_roles: Role[];
  notify_roles: Role[];
  notify_supervisor: boolean;
}
export function migrateNotebookACLs(input: {
  read_roles?: unknown;
  add_roles?: unknown;
  notify_roles?: unknown;
  notify_supervisor?: unknown;
}): NotebookACLResult {
  const read_roles = normalizeNotebookACL(input.read_roles);
  const add_roles = normalizeNotebookACL(input.add_roles).filter((role) =>
    read_roles.includes(role),
  );
  const notify_supervisor = input.notify_supervisor === true;
  const configuredNotifyRoles = Array.isArray(input.notify_roles)
    ? input.notify_roles.flatMap((value) => {
        if (value === "supervisor") return ["owner", "manager"] as Role[];
        const role = decodeCurrentRole(value);
        return role ? [role] : [];
      })
    : null;
  const notify_roles = configuredNotifyRoles
    ? currentKeys.filter(
        (role) =>
          configuredNotifyRoles.includes(role) && read_roles.includes(role),
      )
    : notify_supervisor
      ? (["owner", "manager", "branch_supervisor"] as Role[]).filter((role) =>
          read_roles.includes(role),
        )
      : [];
  return { read_roles, add_roles, notify_roles, notify_supervisor };
}
