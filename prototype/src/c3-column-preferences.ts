export interface TableColumnDefinition {
  key: string;
  label: string;
  required?: boolean;
  defaultVisible?: boolean;
  width?: string | number;
  align?: "start" | "end";
  actions?: boolean;
}

export interface TablePreferenceScope {
  company: string;
  user: string;
  table: string;
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function tablePreferenceKey(scope: TablePreferenceScope): string {
  return `supermarket-table-columns-v1:${[
    scope.company,
    scope.user,
    scope.table,
  ]
    .map(encodeURIComponent)
    .join(":")}`;
}

export function normaliseHiddenColumns(
  columns: readonly TableColumnDefinition[],
  requested: readonly string[],
): string[] {
  const hidden = new Set(requested);
  return columns
    .filter(
      (column, index) =>
        index > 0 && !column.required && hidden.has(column.key),
    )
    .map((column) => column.key);
}

export function defaultHiddenColumns(
  columns: readonly TableColumnDefinition[],
): string[] {
  return normaliseHiddenColumns(
    columns,
    columns
      .filter((column) => column.defaultVisible === false)
      .map((column) => column.key),
  );
}

export function readTableColumns(
  storage: PreferenceStorage | undefined,
  scope: TablePreferenceScope,
  columns: readonly TableColumnDefinition[],
): string[] {
  try {
    const saved = storage?.getItem(tablePreferenceKey(scope));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "version" in parsed &&
        parsed.version === 1 &&
        "hidden" in parsed &&
        Array.isArray(parsed.hidden) &&
        parsed.hidden.every((key) => typeof key === "string")
      )
        return normaliseHiddenColumns(columns, parsed.hidden);
    }
  } catch {
    // Browser preferences are optional; blocked or damaged storage uses defaults.
  }
  return defaultHiddenColumns(columns);
}

export function saveTableColumns(
  storage: PreferenceStorage | undefined,
  scope: TablePreferenceScope,
  columns: readonly TableColumnDefinition[],
  hidden: readonly string[],
): void {
  try {
    storage?.setItem(
      tablePreferenceKey(scope),
      JSON.stringify({
        version: 1,
        hidden: normaliseHiddenColumns(columns, hidden),
      }),
    );
  } catch {
    // The current page still works when browser storage is unavailable.
  }
}

export function resetTableColumns(
  storage: PreferenceStorage | undefined,
  scope: TablePreferenceScope,
): void {
  try {
    storage?.removeItem(tablePreferenceKey(scope));
  } catch {
    // Reset the current page even when browser storage is unavailable.
  }
}
