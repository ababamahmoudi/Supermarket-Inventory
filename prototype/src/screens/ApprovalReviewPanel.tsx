import Decimal from "decimal.js";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { approvalLocationEffects, type PriceScope } from "../approvals";
import { effectivePrice } from "../catalog";
import { branchLabel, branchSellsToCustomers } from "../settings";
import { effectiveApprovalLocation } from "../received";
import { OfferLabel, ProductName } from "../presentation";
import { useDemo } from "../store";
import type { Approval, Branch } from "../types";
import { Badge, EmptyState, Field, Select } from "../ui";
import "./approval-c3.css";
import { ProductPrice, ProductCost } from "../weight-price-presentation";

export function ApprovalReviewPanel({
  approval,
  scope,
  target,
  onScopeChange,
  showEffects = true,
}: {
  approval: Approval;
  scope: PriceScope;
  target: Branch;
  onScopeChange: (scope: PriceScope) => void;
  showEffects?: boolean;
}) {
  const { state, lang, t } = useDemo();
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === approval.product_code,
  );
  if (!product) return null;
  const origin = effectiveApprovalLocation(state, approval);
  const oldPrice = effectivePrice(
    state,
    product,
    origin === "all" ? target : origin,
  );
  const cost = approval.unit_cost ?? product.last_cost_before_tax;
  const margin = new Decimal(approval.proposed_price || 0).gt(0)
    ? new Decimal(approval.proposed_price)
        .minus(cost)
        .div(approval.proposed_price)
        .times(100)
        .toFixed(2)
    : null;
  const effects = showEffects
    ? approvalLocationEffects(state, approval, scope, target)
    : [];
  const allowsBranch = branchSellsToCustomers(
    state.config,
    origin === "all" ? target : origin,
  );
  const overridesRemoved = effects.some((effect) => effect.override_removed);
  return (
    <div className="approval-review-content">
      <section
        className="approval-review-summary"
        aria-label={t("Approval summary", "خلاصه تأیید")}
      >
        <div className="approval-review-product">
          <ProductName product={product} language={lang} />
          <span className="muted">
            {t("Product Code", "کد کالا")} <bdi dir="ltr">{product.code}</bdi>
          </span>
        </div>
        <div className="approval-review-facts">
          <div className="approval-review-price-pair">
            <span>
              <small>{t("Old price", "قیمت قبلی")}</small>
              <strong>
                {oldPrice ? (
                  <ProductPrice
                    value={oldPrice}
                    product={product}
                    config={state.config}
                  />
                ) : (
                  t("No approved price yet", "هنوز قیمت تأییدشده ندارد")
                )}
              </strong>
            </span>
            <ArrowRight className="directional" size={18} aria-hidden="true" />
            <span>
              <small>{t("New price", "قیمت جدید")}</small>
              <strong>
                <ProductPrice
                  value={approval.proposed_price}
                  product={product}
                  config={state.config}
                />
              </strong>
            </span>
          </div>
          <div>
            <small>{t("Unit cost", "هزینه واحد")}</small>
            <strong>
              <ProductCost
                value={cost}
                product={product}
                config={state.config}
              />
            </strong>
          </div>
          <div>
            <small>{t("Margin", "حاشیه سود")}</small>
            <strong>
              <bdi dir="ltr">{margin === null ? "—" : `${margin}%`}</bdi>
            </strong>
          </div>
        </div>
      </section>
      {showEffects && (
        <>
          <Field
            label={t("Apply price to", "اعمال قیمت به")}
            className="approval-review-scope"
          >
            <Select
              value={scope}
              onChange={(value) => onScopeChange(value as PriceScope)}
              options={[
                { value: "all", label: t("All branches", "همه شعبه‌ها") },
                ...(allowsBranch
                  ? [
                      {
                        value: "branch",
                        label: t("This branch only", "فقط این شعبه"),
                      },
                    ]
                  : []),
              ]}
            />
          </Field>
          {effects.length ? (
            <section aria-label={t("Effect per location", "تأثیر در هر مکان")}>
              <h3 className="approval-effects-heading">
                {t("Effect per location", "تأثیر در هر مکان")}
              </h3>
              <ul className="approval-scope-preview approval-effect-list">
                {effects.map((effect) => (
                  <li key={effect.locations.join(":")}>
                    <strong className="approval-effect-locations">
                      {effect.locations.map((location, index) => (
                        <span key={location}>
                          {index > 0 && (lang === "fa" ? "، " : ", ")}
                          {branchLabel(state.config, location, lang)}
                        </span>
                      ))}
                    </strong>
                    <div className="approval-effect-details">
                      <span className="approval-effect-price">
                        {effect.old_price ? (
                          <ProductPrice
                            value={effect.old_price}
                            product={product}
                            config={state.config}
                          />
                        ) : (
                          "—"
                        )}
                        <ArrowRight
                          className="directional"
                          size={16}
                          aria-hidden="true"
                        />
                        <ProductPrice
                          value={effect.new_price}
                          product={product}
                          config={state.config}
                        />
                      </span>
                      {effect.offer_label && (
                        <span>
                          <OfferLabel
                            label={effect.offer_label}
                            language={lang}
                          />{" "}
                          ·{" "}
                          {effect.offer_stops
                            ? t("Offer stops", "پیشنهاد متوقف می‌شود")
                            : t("Offer stays", "پیشنهاد حفظ می‌شود")}
                        </span>
                      )}
                      {effect.override_removed && (
                        <Badge tone="pending">
                          {t("Override removed", "قیمت ویژه حذف می‌شود")}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <EmptyState>
              {t(
                "Choose a location that sells to customers.",
                "مکانی را انتخاب کنید که به مشتریان فروش دارد.",
              )}
            </EmptyState>
          )}
          {effects.length > 0 && (
            <div className="approval-warning-callout" role="note">
              <AlertTriangle size={20} aria-hidden="true" />
              <p>
                {scope === "all" ? (
                  <>
                    {overridesRemoved && (
                      <>
                        {t(
                          "The shown branch overrides will be removed, including intentional prices.",
                          "قیمت‌های ویژه نمایش‌داده‌شده، از جمله قیمت‌های عمدی، حذف می‌شوند.",
                        )}{" "}
                      </>
                    )}
                    {t(
                      "Incompatible offers will stop; new offers wait for confirmation.",
                      "پیشنهادهای ناسازگار متوقف می‌شوند؛ پیشنهادهای جدید منتظر تأیید می‌مانند.",
                    )}
                  </>
                ) : (
                  t(
                    "Only this branch changes. Other branches keep their prices and offers.",
                    "فقط این شعبه تغییر می‌کند. شعبه‌های دیگر قیمت‌ها و پیشنهادهای خود را حفظ می‌کنند.",
                  )
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
