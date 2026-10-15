import { useEffect, useState } from "react";
import { useDemo } from "./store";
import { lookupBranch } from "./catalog";
import { Badge } from "./ui";
import { LtrText } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import type { Branch } from "./types";
import {
  queryManualPricePresentation,
  type ManualPricePresentationDTO,
} from "./manual-price-read-model";
import type { ProductReadDTO } from "./catalog-read-model";

export function ManualPricePill({
  product,
  branch: selectedBranch,
  companyDefault = false,
}: {
  product: ProductReadDTO;
  branch?: Branch;
  companyDefault?: boolean;
}) {
  const { branch, t } = useDemo();
  const location = companyDefault
    ? "all"
    : lookupBranch(selectedBranch ?? branch);
  return product.manual_price_scopes.includes(location) ? (
    <Badge tone="info" className="manual-price-pill">
      {t("Manual price", "قیمت دستی")}
    </Badge>
  ) : null;
}
export function ManualPriceDetails({
  product,
  branch: selectedBranch,
}: {
  product: ProductReadDTO;
  branch?: Branch;
  /** Kept as a compatibility prop; current private cost is resolved by the query. */
  cost?: string;
}) {
  const { state, branch, actor, query, can, businessRevision, t } = useDemo();
  const location = lookupBranch(selectedBranch ?? branch);
  const scope = {
    company_id: product.company_id,
    kind: "company_shared" as const,
    entity_id: product.code,
  };
  const permitted = can("catalog.cost_read", scope);
  const readKey = JSON.stringify([
    product.company_id,
    product.code,
    location,
    actor?.user_id,
    actor?.authority_epoch,
    businessRevision,
  ]);
  const [detailsRecord, setDetailsRecord] = useState<{
    key: string;
    value: ManualPricePresentationDTO | null;
  } | null>(null);
  const privateDetails =
    detailsRecord?.key === readKey ? detailsRecord.value : null;
  // The fresh public product DTO contains only the two permitted selling
  // amounts for the selected Store. Costs and margins stay in the private query.
  const publicDetails = product.manual_price_comparisons[location];
  const details = permitted ? privateDetails : publicDetails;
  useEffect(() => {
    let current = true;
    if (!permitted) return;
    void query(
      "catalog.cost_read",
      {
        company_id: product.company_id,
        kind: "company_shared",
        entity_id: product.code,
      },
      (freshState, freshActor) =>
        queryManualPricePresentation(
          freshState,
          freshActor,
          product.code,
          location,
        ),
    )
      .then((value) => {
        if (current) setDetailsRecord({ key: readKey, value });
      })
      .catch(() => {
        if (current) setDetailsRecord(null);
      });
    return () => {
      current = false;
    };
  }, [
    readKey,
    permitted,
    product.company_id,
    product.code,
    location,
    actor?.user_id,
    businessRevision,
    query,
  ]);
  if (!details) return null;
  return (
    <div className="manual-price-details">
      <p className="helper manual-price-comparison">
        {t("Rule price", "قیمت طبق قاعده")}{" "}
        <ProductPrice
          value={details.rule_price}
          product={product}
          config={state.config}
        />{" "}
        · {t("Manual price", "قیمت دستی")}{" "}
        <ProductPrice
          value={details.manual_price}
          product={product}
          config={state.config}
        />
      </p>
      {permitted && privateDetails && privateDetails.margin !== null && (
        <p className="helper manual-price-margin">
          {t("Margin %", "حاشیه سود %")}:{" "}
          <LtrText>{privateDetails.margin}%</LtrText>
        </p>
      )}
    </div>
  );
}
