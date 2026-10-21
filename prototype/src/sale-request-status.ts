import type { SaleRequest } from "./sales";

export type SaleRequestTab = "pending" | "approved" | "rejected" | "superseded";
export function saleRequestTab(status: SaleRequest["status"]): SaleRequestTab {
  return status === "expired" || status === "withdrawn" ? "superseded" : status;
}
