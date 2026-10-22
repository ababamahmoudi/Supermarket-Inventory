import type { AuthenticatedActor } from "../../authority-types";
import type { DemoState } from "../../types";
import type { InvoicePurchaseReadDTO } from "../../invoice-projections";
import type { InvoiceEditableLine } from "../../invoice-edit-types";
import type { InvoiceWorkspaceRead } from "../../invoice-workspace-read";
export type ReviewUpdate = <T>(
  change: (draft: DemoState, actor: AuthenticatedActor) => T,
) => Promise<T | undefined>;
export type EditLine = (
  index: number,
  change: (
    line: InvoiceEditableLine,
    draft: DemoState,
    actor: AuthenticatedActor,
  ) => void,
  recalculate?: boolean,
) => void;
export interface ReviewProps {
  invoice: InvoicePurchaseReadDTO;
  workspace: InvoiceWorkspaceRead;
  update: ReviewUpdate;
  editLine: EditLine;
  onSupplierAdd(): void;
  onProductAdd(): void;
  onAttach(): void;
  onClose(): void;
  onPost(): void;
  onReceived(date: string, time: string): void;
  receivedLocal: { date: string; time: string };
  attemptedPost: boolean;
  onAttemptPost(): void;
  onQuantity(
    line: InvoiceEditableLine,
    value: string | number,
    unit: NonNullable<InvoiceEditableLine["quantity_unit"]>,
    pack?: number,
  ): void;
}
