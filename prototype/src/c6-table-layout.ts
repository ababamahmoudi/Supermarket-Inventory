import type { TableColumnDefinition } from "./c3-column-preferences";

export type ResponsiveColumn = Partial<TableColumnDefinition> & {
  hidden?: boolean;
};

const tablePriorities: Record<string, string[]> = {
  products: [
    "name",
    "price",
    "code",
    "status",
    "unit",
    "offer",
    "cost",
    "margin",
    "category",
  ],
  invoices: ["invoice", "status", "supplier", "date", "branch"],
  received: [
    "product",
    "quantity",
    "date",
    "invoice",
    "supplier",
    "location",
    "actor",
  ],
  suppliers: [
    "name",
    "status",
    "balance",
    "returns",
    "shorts",
    "last_delivery",
    "deliveries",
    "overdue",
  ],
  returns: ["reference", "supplier", "status", "items", "date", "location"],
  expiry: [
    "product",
    "date",
    "days",
    "location",
    "source",
    "type",
    "quantity",
    "lot",
  ],
  payables: ["supplier", "balance", "overdue", "due", "branch"],
  "payables.ledger": [
    "reference",
    "amount",
    "date",
    "type",
    "branch",
    "cheque",
    "allocations",
  ],
  orders: ["reference", "supplier", "status", "date", "branch", "total"],
};

export function tableResponsiveDefinition(
  table: string,
  column: TableColumnDefinition,
  index: number,
): TableColumnDefinition {
  const rank = tablePriorities[table]?.indexOf(column.key) ?? -1;
  return {
    ...column,
    priority:
      column.priority ??
      (column.actions ? 2 : rank < 0 ? index + 20 : rank + 1),
    mobilePrimary:
      column.mobilePrimary ??
      (column.required ||
        index === 0 ||
        (rank >= 0 && rank < 3) ||
        column.actions),
  };
}

export function fixedColumnWidth(column: ResponsiveColumn): number | null {
  return column.fixedWidth &&
    typeof column.width === "number" &&
    Number.isFinite(column.width) &&
    column.width > 0
    ? column.width
    : null;
}

export function columnMinimumWidth(
  column: ResponsiveColumn,
  index: number,
): number {
  const fixed = fixedColumnWidth(column);
  if (fixed !== null) return fixed;
  if (column.minWidth !== undefined) return Math.max(48, column.minWidth);
  if (column.actions) return 140;
  const key = column.key ?? "";
  if (/date|expiry|created|due|cheque/.test(key)) return 140;
  if (/location|branch/.test(key)) return 144;
  if (/status|days|type/.test(key)) return 160;
  if (
    /amount|balance|overdue|cost|price|margin|total/.test(key) ||
    column.align === "end"
  )
    return 124;
  if (
    /name|product|supplier|reference|invoice/.test(key) ||
    index === 0 ||
    column.required
  )
    return 180;
  return 128;
}

/** Width-hidden columns are temporary and never mutate saved user preferences. */
export function allocateTableColumns(
  columns: readonly ResponsiveColumn[],
  availableWidth: number,
  mobile: boolean,
  measuredMinimums: readonly number[] = [],
  reserveDetails = true,
): { visible: number[]; collapsed: number[]; minimums: number[] } {
  const minimums = columns.map(
    (column, index) =>
      fixedColumnWidth(column) ??
      (column.actions && (measuredMinimums[index] ?? 0) > 0
        ? measuredMinimums[index]
        : Math.max(
            columnMinimumWidth(column, index),
            measuredMinimums[index] ?? 0,
          )),
  );
  let visible = columns.flatMap((column, index) =>
    column.hidden ? [] : [index],
  );
  if (mobile) {
    visible = visible.filter(
      (index) =>
        columns[index].mobilePrimary ??
        (columns[index].required ||
          index === 0 ||
          columns[index].actions ||
          (columns[index].priority ?? index + 1) <= 3),
    );
  } else if (availableWidth > 0) {
    // A modest first-cell reserve holds the details disclosure without squeezing words.
    const budget = Math.max(0, availableWidth - (reserveDetails ? 36 : 0));
    const candidates = [...visible]
      .filter(
        (index) =>
          index !== 0 && !columns[index].required && !columns[index].actions,
      )
      .sort(
        (a, b) =>
          (columns[b].priority ?? b + 1) - (columns[a].priority ?? a + 1),
      );
    while (
      visible.reduce((total, index) => total + minimums[index], 0) > budget &&
      candidates.length
    ) {
      const omit = candidates.shift()!;
      visible = visible.filter((index) => index !== omit);
    }
  }
  const shown = new Set(visible);
  return {
    visible,
    collapsed: columns.flatMap((_, index) => (shown.has(index) ? [] : [index])),
    minimums,
  };
}
