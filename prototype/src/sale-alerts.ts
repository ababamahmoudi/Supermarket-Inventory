import type { Alert } from "./types";

export function saleAlertsFor(
  state: { readonly alerts: readonly Alert[] },
  historyContext: {
    readonly company_id: string;
    readonly allowed_branches: readonly string[];
  } | null,
  branch: string,
  showResolved: boolean,
) {
  if (!historyContext) return [];
  return state.alerts.filter(
    (alert) =>
      alert.company_id === historyContext.company_id &&
      historyContext.allowed_branches.includes(alert.branch) &&
      alert.type.startsWith("sale_") &&
      (showResolved || alert.status === "pending") &&
      (branch === "all" || branch === alert.branch),
  );
}
