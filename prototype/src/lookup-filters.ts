import type { CompanyConfig } from "./types";
import type { ProductReadDTO } from "./catalog-read-model";
import type { LookupBranchProduct } from "./lookup-branch";

export interface LookupFilters {
  category: string;
  pricingCategory: string;
  taxable: boolean;
  unapproved: boolean;
}
export const emptyLookupFilters: LookupFilters = {
  category: "",
  pricingCategory: "",
  taxable: false,
  unapproved: false,
};

export function lookupTaxable(
  config: Pick<CompanyConfig, "tax">,
  product: ProductReadDTO,
) {
  return (
    config.tax.profiles.find((profile) => profile.key === product.tax_profile)
      ?.taxable ?? product.taxable
  );
}

export function matchesLookupFilters(
  config: Pick<CompanyConfig, "tax">,
  product: ProductReadDTO,
  filters: LookupFilters,
  facts: LookupBranchProduct | undefined,
  allLocations: boolean,
) {
  return (
    (!filters.category || product.ai_category === filters.category) &&
    (!filters.pricingCategory ||
      product.pricing_category === filters.pricingCategory) &&
    (!filters.taxable || lookupTaxable(config, product)) &&
    (!filters.unapproved ||
      (!allLocations && !!facts && !facts.price) ||
      (allLocations &&
        !product.selling_price &&
        !Object.values(product.branch_prices ?? {}).some(Boolean)))
  );
}
