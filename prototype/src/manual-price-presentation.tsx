import { useDemo } from "./store";
import { manualPrice, rulePrice, sellingMargin } from "./manual-prices";
import { Badge } from "./ui";
import { LtrText } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import type { Branch, Product } from "./types";

export function ManualPricePill({
  product,
  branch: selectedBranch,
  companyDefault = false,
}: {
  product: Product;
  branch?: Branch;
  companyDefault?: boolean;
}) {
  const { state, branch, t } = useDemo();
  return manualPrice(
    state,
    companyDefault ? { ...product, branch_prices: {} } : product,
    companyDefault ? "all" : (selectedBranch ?? branch),
  ) ? (
    <Badge tone="info" className="manual-price-pill">
      {t("Manual price", "قیمت دستی")}
    </Badge>
  ) : null;
}

export function ManualPriceDetails({
  product,
  branch: selectedBranch,
  cost = product.last_cost_before_tax,
}: {
  product: Product;
  branch?: Branch;
  cost?: string;
}) {
  const { state, branch, role, t } = useDemo();
  const marker = manualPrice(state, product, selectedBranch ?? branch);
  if (!marker) return null;
  const rule = rulePrice(state, product, cost) ?? marker.rule_price;
  const margin = sellingMargin(marker.price, cost);
  return (
    <div className="manual-price-details">
      <p className="helper manual-price-comparison">
        {t("Rule price", "قیمت طبق قاعده")}{" "}
        <ProductPrice value={rule} product={product} config={state.config} /> ·{" "}
        {t("Manual price", "قیمت دستی")}{" "}
        <ProductPrice
          value={marker.price}
          product={product}
          config={state.config}
        />
      </p>
      {role === "supervisor" && margin !== null && (
        <p className="helper manual-price-margin">
          {t("Margin %", "حاشیه سود %")}: <LtrText>{margin}%</LtrText>
        </p>
      )}
    </div>
  );
}
