import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import { can, requireCapability } from "./permissions";
import { productCostHistory, productStoreCost } from "./product-costs";
import { queryCatalogFinancialDetails } from "./catalog-read-model";
import { calculatePrice } from "./pricing";
import {
  approvedWeightPricePerLb,
  calculateWeighedPrice,
  weighedSettings,
  weightCostPerLb,
  weightPriceDisplay,
} from "./weighed";
import { requireInvoiceAuthority } from "./invoice-authority";

export function productFinancialSnapshot(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
) {
  const financial = queryCatalogFinancialDetails(state, actor, productCode);
  const product = state.products.find(
    (item) => item.company_id === actor.company_id && item.code === productCode,
  );
  if (!product) throw new Error("Product not found in this company");
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  );
  return {
    ...financial,
    cost: productStoreCost(state, actor, product),
    costs: productCostHistory(state, actor, product),
    category: category
      ? {
          key: category.key,
          label: category.label,
          label_fa: category.label_fa,
          cost_divisor: category.cost_divisor,
          minimum_margin: category.minimum_margin,
        }
      : null,
  };
}

export interface NewProductPricingInput {
  cost: string;
  costUnit: "lb" | "kg";
  soldBy: "each" | "weight" | undefined;
  category: string;
  sellingPrice: string;
  manualPrice: boolean;
}
/** Calculation stays canonical; request-only creators never receive rule/margin settings. */
export function newProductPricePreview(
  state: DemoState,
  actor: AuthenticatedActor,
  input: NewProductPricingInput,
  invoiceQuickAdd: boolean,
) {
  if (invoiceQuickAdd)
    requireInvoiceAuthority(
      state,
      actor,
      "invoices.product_propose",
      state.invoice.id,
    );
  else
    requireCapability(state, actor, "catalog.create_active", {
      company_id: actor.company_id,
      kind: "company_shared",
    });
  const weighed = input.soldBy === "weight";
  const calculation = weighed
    ? calculateWeighedPrice(
        input.cost,
        input.costUnit,
        input.category,
        state.config,
      )
    : calculatePrice(input.cost, input.category, state.config);
  const displayCalculatedPrice = weighed
    ? weightPriceDisplay(calculation.selling_price, state.config).main.amount
    : calculation.selling_price;
  const mayOverride = can(state, actor, "catalog.create_active", {
    company_id: actor.company_id,
    kind: "company_shared",
  }).allowed;
  if (!mayOverride) return { displayCalculatedPrice, belowMinimum: false };
  const canonicalCost = weighed
    ? weightCostPerLb(input.cost, input.costUnit, state.config)
    : input.cost;
  const price =
    input.manualPrice && input.sellingPrice
      ? weighed
        ? approvedWeightPricePerLb(
            input.sellingPrice,
            weighedSettings(state.config).main_display_unit,
            state.config,
          )
        : input.sellingPrice
      : calculation.selling_price;
  const minimum = state.config.pricing_categories.find(
    (item) => item.key === input.category,
  )?.minimum_margin;
  const belowMinimum =
    minimum !== null &&
    minimum !== undefined &&
    new Decimal(price)
      .minus(canonicalCost)
      .lt(new Decimal(price).times(minimum));
  return { displayCalculatedPrice, belowMinimum };
}
