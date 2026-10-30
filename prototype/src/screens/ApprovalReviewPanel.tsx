import { approvalPanelRead } from "../approval-board";
import { useProtectedQuery } from "../use-protected-query";
import { domainScope } from "../domain-authority";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { type PriceScope } from "../approvals";
import { formatMoney } from "../formatters";
import { weightPriceDisplay } from "../weighed";
import { WhatsMissing } from "../WhatsMissing";
import { branchLabel, branchSellsToCustomers } from "../settings";
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
  regularDecision = "rule",
  onRegularDecisionChange,
  regularReason = "",
  regularReasonError,
  onRegularReasonChange,
}: {
  approval: Approval;
  scope: PriceScope;
  target: Branch;
  onScopeChange: (scope: PriceScope) => void;
  showEffects?: boolean;
  regularDecision?: "rule" | "keep";
  onRegularDecisionChange?: (decision: "rule" | "keep") => void;
  regularReason?: string;
  regularReasonError?: string;
  onRegularReasonChange?: (reason: string) => void;
}) {
  const { state, can, lang, t } = useDemo();
  const panelRead = useProtectedQuery(
    can("approvals.decide") ? "approvals.decide" : null,
    domainScope(state, approval),
    (canonical, actor) =>
      approvalPanelRead(
        canonical,
        actor,
        approval.id,
        scope,
        target,
        regularDecision,
        showEffects,
      ),
    JSON.stringify([approval.id, scope, target, regularDecision, showEffects]),
  );
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === approval.product_code,
  );
  if (!product || !panelRead.data) return null;
  const {
    origin,
    oldPrice,
    cost,
    manualReview,
    proposedPrice,
    margin,
    effects,
  } = panelRead.data;
  const actualApproval = panelRead.data.approval;
  const allowsBranch = branchSellsToCustomers(
    state.config,
    origin === "all" ? target : origin,
  );
  const overridesRemoved = effects.some((effect) => effect.override_removed);
  const priceLabel = (price: string) => {
    const display =
      product.sold_by === "weight"
        ? weightPriceDisplay(price, state.config).main
        : { amount: price, unit: "each" };
    return `${formatMoney(display.amount, { currency: state.config.company.currency })}${display.unit === "each" ? "" : `/${display.unit}`}`;
  };
  return (
    <div className="approval-review-content">
      {showEffects &&
        actualApproval.manual_price_review &&
        onRegularDecisionChange && (
          <Field label={t("Selling price", "قیمت فروش")}>
            <Select
              value={regularDecision}
              onChange={(value) =>
                onRegularDecisionChange(value as "rule" | "keep")
              }
              options={[
                {
                  value: "rule",
                  label: `${t("Use the new calculated price", "از قیمت محاسبه‌شدهٔ جدید استفاده شود")} ${priceLabel(actualApproval.manual_price_review.calculated_price)}`,
                },
                {
                  value: "keep",
                  label: `${t("Keep", "حفظ شود")} ${priceLabel(actualApproval.manual_price_review.kept_price)}`,
                },
              ]}
            />
          </Field>
        )}
      {actualApproval.receiving_price && (
        <section className="list-box" data-testid="receiving-price-approval">
          <p>
            {t(
              `Set by ${actualApproval.receiving_price.set_by} during receiving`,
              `تعیین‌شده توسط ${actualApproval.receiving_price.set_by} هنگام دریافت`,
            )}
          </p>
          {actualApproval.receiving_price.entered_price &&
            actualApproval.receiving_price.price_unit === "kg" && (
              <p>
                {t("Entered price", "قیمت واردشده")}:{" "}
                <bdi dir="ltr">
                  {formatMoney(actualApproval.receiving_price.entered_price, {
                    currency: state.config.company.currency,
                  })}
                  /kg
                </bdi>
              </p>
            )}
          <p>
            {t("Requested price", "قیمت پیشنهادی")}:{" "}
            <bdi dir="ltr">
              {priceLabel(actualApproval.receiving_price.price)}
            </bdi>
            {" · "}
            {t("Calculated price", "قیمت محاسبه‌شده")}:{" "}
            <bdi dir="ltr">
              {priceLabel(actualApproval.receiving_price.calculated_price)}
            </bdi>
          </p>
        </section>
      )}
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
            {actualApproval.type !== "new_product" && (
              <>
                {" "}
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
                <ArrowRight
                  className="directional"
                  size={18}
                  aria-hidden="true"
                />
              </>
            )}
            <span>
              <small>
                {actualApproval.type === "new_product"
                  ? t("First price", "قیمت نخست")
                  : t("New price", "قیمت جدید")}
              </small>
              <strong>
                <ProductPrice
                  value={proposedPrice}
                  product={product}
                  config={state.config}
                />
              </strong>
            </span>
          </div>
          <div>
            <small>{t("Unit cost", "هزینه واحد")}</small>
            <strong>
              {cost !== null && cost !== undefined ? (
                <ProductCost
                  value={cost}
                  product={product}
                  config={state.config}
                />
              ) : (
                <span className="muted">—</span>
              )}
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
      {showEffects &&
        actualApproval.manual_price_review &&
        regularDecision === "keep" && (
          <>
            <p className="muted">
              {t("Keep", "حفظ شود")}{" "}
              {priceLabel(actualApproval.manual_price_review.kept_price)} ·{" "}
              {branchLabel(state.config, origin, lang)}
            </p>
          </>
        )}
      {showEffects &&
        (manualReview?.below_minimum_margin || manualReview?.below_cost) && (
          <section
            className={`banner ${manualReview.below_cost ? "danger" : "pending"} sale-request-margin-warning`}
          >
            <p>
              {t(
                manualReview.below_cost
                  ? "This price is below cost."
                  : "This price is below the minimum margin.",
                manualReview.below_cost
                  ? "این قیمت کمتر از هزینه است."
                  : "این قیمت کمتر از حداقل حاشیهٔ سود است.",
              )}
            </p>
            <WhatsMissing
              issues={
                regularReasonError
                  ? [
                      {
                        id: "manual-keep-reason",
                        fieldId: "manual-keep-reason",
                        message: regularReasonError,
                      },
                    ]
                  : []
              }
            />
            <Field label={t("Reason", "دلیل")} error={regularReasonError}>
              <textarea
                id="manual-keep-reason"
                value={regularReason}
                onChange={(event) =>
                  onRegularReasonChange?.(event.target.value)
                }
              />
            </Field>
          </section>
        )}
      {showEffects && regularDecision !== "keep" && (
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
                          t("No price yet", "هنوز قیمتی ندارد")
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
