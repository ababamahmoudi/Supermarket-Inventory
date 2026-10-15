import { projectCatalogReadView } from "./catalog-read-model";
import { projectInvoiceState } from "./invoice-projections";
import { returnViews } from "./return-projections";
import {
  approvalViews,
  alertViews,
  projectSalesReadView,
} from "./sales-projections";
import { selectHistory } from "./history";
import { projectNotesDatesRequests } from "./notes-dates-projections";
import {
  projectPurchaseOperational,
  projectSuppliers,
  projectLedger,
} from "./purchase-projections";
import type { ReadModelProjectors } from "./e1-read-model";

/** Concrete guarded adapters only; no denied-data or missing-adapter fallback. */
export function completeReadModelProjectors(): ReadModelProjectors {
  return {
    catalog: projectCatalogReadView,
    invoices: projectInvoiceState,
    returns: returnViews,
    approvals: approvalViews,
    alerts: alertViews,
    history: selectHistory,
    operational: (state, actor) => ({
      ...projectPurchaseOperational(state, actor),
      ...projectNotesDatesRequests(state, actor),
    }),
    sales: projectSalesReadView,
    suppliers: projectSuppliers,
    ledger: projectLedger,
  };
}
