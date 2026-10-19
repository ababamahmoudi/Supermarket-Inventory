import { can } from "./permissions";
import {
  previewPriceChange,
  type ChangePriceInput,
  type PriceChangePreview,
  type SaleLocationEffect,
} from "./sales";
import {
  projectProductReadDTO,
  type ProductReadDTO,
} from "./catalog-read-model";
import { projectSaleReadDTO, type SaleReadDTO } from "./offers-read-model";
import type { AuthenticatedActor } from "./authority-types";
import type { Branch, DemoState } from "./types";
export type PriceChangeEffectDTO = Omit<
  SaleLocationEffect,
  "cost" | "margin" | "minimum_margin" | "below_minimum_margin" | "below_cost"
> &
  Partial<
    Pick<
      SaleLocationEffect,
      | "cost"
      | "margin"
      | "minimum_margin"
      | "below_minimum_margin"
      | "below_cost"
    >
  >;
export interface PriceChangePreviewDTO extends Omit<
  PriceChangePreview,
  "product" | "effects" | "existing_sales"
> {
  product: ProductReadDTO | null;
  effects: PriceChangeEffectDTO[];
  existing_sales: SaleReadDTO[];
  provenance?: { invoice_number: string; calculated_price: string };
}
/** A fresh query may calculate privately; its result explicitly masks every requester. */
export function queryPriceChangePreview(
  state: DemoState,
  actor: AuthenticatedActor,
  input: ChangePriceInput,
  location: Branch,
): PriceChangePreviewDTO {
  const preview = previewPriceChange(state, actor, input);
  const privateRead =
    can(state, actor, "catalog.cost_read").allowed &&
    can(
      state,
      actor,
      input.mode === "sale" ? "sales.manage" : "pricing.regular_manage",
    ).allowed;
  const source = privateRead
    ? preview.product?.price_provenance?.[location]
    : undefined;
  return {
    product: preview.product
      ? projectProductReadDTO(state, actor, preview.product)
      : null,
    branches: preview.branches,
    issues: preview.issues,
    can_save: preview.can_save,
    existing_sales: preview.existing_sales.map((sale) =>
      projectSaleReadDTO(sale),
    ),
    effects: preview.effects.map((effect) => ({
      branch: effect.branch,
      regular_price: effect.regular_price,
      regular_display_price: effect.regular_display_price,
      proposed_price: effect.proposed_price,
      savings: effect.savings,
      percentage_off: effect.percentage_off,
      existing_sale_id: effect.existing_sale_id,
      regular_sale_conflict: effect.regular_sale_conflict,
      ...(privateRead
        ? {
            cost: effect.cost,
            margin: effect.margin,
            minimum_margin: effect.minimum_margin,
            below_minimum_margin: effect.below_minimum_margin,
            below_cost: effect.below_cost,
          }
        : {}),
    })),
    ...(source?.invoice_number
      ? {
          provenance: {
            invoice_number: source.invoice_number,
            calculated_price: source.calculated_price,
          },
        }
      : {}),
  };
}
