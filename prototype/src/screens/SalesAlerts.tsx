import { domainScope } from "../domain-authority";
import { useState } from "react";
import Decimal from "decimal.js";
import { regularPrice } from "../catalog";
import { ChangePriceDialog } from "../ChangePriceDialog";
import { decideSaleCostAlert, holdSaleDelivery, salesSettings } from "../sales";
import { setAlertStatus } from "../approvals";
import { branchLabel } from "../settings";
import { useDemo } from "../store";
import { DateText, LtrText, Money, ProductName } from "../presentation";
import { ProductCost, ProductPrice } from "../weight-price-presentation";
import { Badge, Button, Card, Checkbox, ConfirmDialog } from "../ui";
import type { Alert } from "../types";
import "./sales-c8.css";

export function SalesAlerts({
  showResolved = false,
}: {
  showResolved?: boolean;
}) {
  const { state, command, can, historyContext, branch, lang, t } = useDemo();
  const [holds, setHolds] = useState<Record<string, boolean>>({});
  const [changing, setChanging] = useState<Alert | null>(null);
  const [ending, setEnding] = useState<Alert | null>(null);
  const [error, setError] = useState("");
  if (!historyContext || !can("alerts.read")) return null;
  const canDecide = can("sales.cost_alert_decide");
  const canHold = can("sales.delivery_hold");
  const alerts = state.alerts.filter(
    (alert) =>
      alert.company_id === historyContext.company_id &&
      historyContext.allowed_branches.includes(alert.branch) &&
      alert.type.startsWith("sale_") &&
      (showResolved || alert.status === "pending") &&
      (branch === "all" || branch === alert.branch),
  );
  const decide = async (alert: Alert, decision: "keep" | "end") => {
    const sale = state.sales?.find(
      (item) =>
        item.company_id === alert.company_id && item.id === alert.sale_id,
    );
    if (!sale) return;
    try {
      await command(
        "sales.cost_alert_decide",
        domainScope(state, alert, true),
        (draft, freshActor) =>
          decideSaleCostAlert(draft, freshActor, alert.id, {
            decision,
            expected_sale_revision: sale.revision,
            hold_delivery: holds[alert.id],
          }),
      );
      setEnding(null);
      setError("");
    } catch {
      setError(
        t(
          "This sale changed. Review the alert again before deciding.",
          "این حراج تغییر کرده است. پیش از تصمیم، هشدار را دوباره بررسی کنید.",
        ),
      );
    }
  };
  const percent = (value?: string) =>
    value
      ? `${new Decimal(value).times(100).toFixed(0, Decimal.ROUND_HALF_UP)}%`
      : "—";
  return (
    <>
      {error && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      {alerts.map((alert) => {
        const product = state.products.find(
          (item) =>
            item.company_id === alert.company_id &&
            item.code === alert.product_code,
        );
        const sale = state.sales?.find(
          (item) =>
            item.company_id === alert.company_id && item.id === alert.sale_id,
        );
        const invoice = [
          ...(state.invoice ? [state.invoice] : []),
          ...(state.invoices ?? []),
        ].find(
          (item) =>
            item.company_id === alert.company_id &&
            item.id === alert.invoice_id,
        );
        const approval = state.approvals.find(
          (item) =>
            item.company_id === alert.company_id &&
            item.id === alert.approval_id,
        );
        const pendingApproval = approval?.status === "pending";
        const afterSalePrice = pendingApproval
          ? alert.proposed_regular_price
          : product
            ? regularPrice(state, product, alert.branch)
            : alert.proposed_regular_price;
        const held =
          state.sale_delivery_holds?.some(
            (item) =>
              item.company_id === alert.company_id &&
              item.invoice_id === alert.invoice_id &&
              item.sale_id === alert.sale_id &&
              item.product_code === alert.product_code,
          ) ?? false;
        const title =
          alert.type === "sale_cost_increase"
            ? t("Cost went up during a sale", "هزینه در طول حراج افزایش یافت")
            : alert.type === "sale_no_end_reminder"
              ? t("Sale with no end date", "حراج بدون تاریخ پایان")
              : alert.type === "sale_delivery_release"
                ? t("Sale ended", "حراج پایان یافت")
                : t(
                    "The new regular price would be lower than the sale price",
                    "قیمت عادی جدید از قیمت حراج کمتر خواهد بود",
                  );
        return (
          <Card
            key={alert.id}
            title={title}
            className="alert-card sales-alert-card"
            data-sale-alert-id={alert.id}
          >
            <div className="sales-title-row">
              {product && <ProductName product={product} language={lang} />}
              <Badge tone={alert.status === "pending" ? "pending" : "approved"}>
                {alert.status === "pending"
                  ? t("Still pending", "هنوز در انتظار")
                  : t("Resolved", "حل‌شده")}
              </Badge>
            </div>
            <p className="muted">
              {branchLabel(state.config, alert.branch, lang)}
              {invoice && (
                <>
                  {" "}
                  ·{" "}
                  <a href={`#invoices?id=${encodeURIComponent(invoice.id)}`}>
                    <LtrText>{invoice.supplier_invoice_number}</LtrText>
                  </a>
                </>
              )}
            </p>
            {!canDecide && sale && (
              <p>
                {t("Sale", "حراج")}:{" "}
                <LtrText>
                  <Money
                    value={sale.sale_price}
                    currency={state.config.company.currency}
                  />
                  {sale.price_unit !== "each" ? `/${sale.price_unit}` : ""}
                </LtrText>{" "}
                ·{" "}
                {sale.last_day ? (
                  <>
                    {t("Until", "تا")} <DateText value={sale.last_day} />
                  </>
                ) : (
                  t("No end date", "بدون تاریخ پایان")
                )}
              </p>
            )}
            {canDecide && alert.type === "sale_cost_increase" && (
              <>
                <p>
                  {t("Cost", "هزینه")}:{" "}
                  <LtrText>
                    {product && alert.previous_cost && (
                      <ProductCost
                        value={alert.previous_cost}
                        product={product}
                        config={state.config}
                      />
                    )}{" "}
                    →{" "}
                    {product && alert.new_cost && (
                      <ProductCost
                        value={alert.new_cost}
                        product={product}
                        config={state.config}
                      />
                    )}
                  </LtrText>{" "}
                  · {t("Sale", "حراج")}:{" "}
                  {alert.sale_price && (
                    <LtrText>
                      <Money
                        value={alert.sale_price}
                        currency={state.config.company.currency}
                      />
                      {alert.sale_price_unit && alert.sale_price_unit !== "each"
                        ? `/${alert.sale_price_unit}`
                        : ""}
                    </LtrText>
                  )}{" "}
                  {alert.sale_last_day ? (
                    <>
                      {t("Until", "تا")}{" "}
                      <DateText value={alert.sale_last_day} />
                    </>
                  ) : (
                    t("No end date", "بدون تاریخ پایان")
                  )}
                </p>
                <p>
                  {t("Margin at the sale price", "حاشیه سود در قیمت حراج")}{" "}
                  <LtrText>
                    {percent(alert.prior_margin)} → {percent(alert.new_margin)}
                  </LtrText>
                  {alert.minimum_margin && (
                    <>
                      {" "}
                      ({t("minimum", "حداقل")}{" "}
                      <LtrText>{percent(alert.minimum_margin)}</LtrText>)
                    </>
                  )}
                </p>
                <p>
                  {t("After the sale", "پس از حراج")}:{" "}
                  <LtrText>
                    {product && alert.regular_price_before && (
                      <ProductPrice
                        value={alert.regular_price_before}
                        product={product}
                        config={state.config}
                      />
                    )}{" "}
                    →{" "}
                    {product && afterSalePrice && (
                      <ProductPrice
                        value={afterSalePrice}
                        product={product}
                        config={state.config}
                      />
                    )}
                  </LtrText>{" "}
                  ·{" "}
                  {pendingApproval ? (
                    <a
                      href={`#approvals?approval=${encodeURIComponent(approval.id)}`}
                    >
                      {t("waiting in Approvals", "در انتظار در تأییدها")}
                    </a>
                  ) : (
                    t("Current regular price", "قیمت عادی فعلی")
                  )}
                </p>
              </>
            )}
            {alert.type === "sale_regular_not_above_sale" && (
              <p>
                {t("The new regular price", "قیمت عادی جدید")}{" "}
                {product && alert.proposed_regular_price && (
                  <ProductPrice
                    value={alert.proposed_regular_price}
                    product={product}
                    config={state.config}
                  />
                )}{" "}
                {t(
                  "would be lower than the sale price",
                  "از قیمت حراج کمتر خواهد بود",
                )}{" "}
                {alert.sale_price && (
                  <LtrText>
                    <Money
                      value={alert.sale_price}
                      currency={state.config.company.currency}
                    />
                    {alert.sale_price_unit && alert.sale_price_unit !== "each"
                      ? `/${alert.sale_price_unit}`
                      : ""}
                  </LtrText>
                )}
                .
              </p>
            )}
            {alert.type === "sale_no_end_reminder" && (
              <p>
                {product
                  ? lang === "fa"
                    ? product.name_fa || product.name_en
                    : product.name_en
                  : alert.product_code}{" "}
                {t("has been on sale at", "در حراج بوده است در")}{" "}
                {branchLabel(state.config, alert.branch, lang)}{" "}
                {t("for", "به مدت")}{" "}
                <LtrText>
                  {salesSettings(state).open_ended_reminder_days}
                </LtrText>{" "}
                {t("days.", "روز.")}
              </p>
            )}
            {alert.type === "sale_delivery_release" && (
              <p>
                {t(
                  "Sale ended: put the held",
                  "حراج پایان یافت: کالای نگه‌داشته‌شده",
                )}{" "}
                {product
                  ? lang === "fa"
                    ? product.name_fa || product.name_en
                    : product.name_en
                  : alert.product_code}{" "}
                {t("on the shelf.", "را در قفسه بگذارید.")}
              </p>
            )}
            {alert.status === "pending" && (
              <>
                {canHold && alert.type === "sale_cost_increase" && (
                  <Checkbox
                    checked={held || (holds[alert.id] ?? false)}
                    disabled={held}
                    onChange={(value) => {
                      if (canDecide)
                        setHolds((current) => ({
                          ...current,
                          [alert.id]: value,
                        }));
                      else if (value && sale)
                        void command(
                          "sales.delivery_hold",
                          domainScope(state, alert, true),
                          (draft, freshActor) =>
                            holdSaleDelivery(
                              draft,
                              freshActor,
                              alert.id,
                              sale.revision,
                            ),
                        ).catch(() =>
                          setError(
                            t(
                              "This sale changed. Review the alert again before deciding.",
                              "این حراج تغییر کرده است. پیش از تصمیم، هشدار را دوباره بررسی کنید.",
                            ),
                          ),
                        );
                    }}
                  >
                    {t(
                      "Keep this delivery in the back until the sale ends",
                      "این تحویل را تا پایان حراج در انبار پشت فروشگاه نگه دارید",
                    )}
                  </Checkbox>
                )}
                {canDecide && (
                  <div className="actions sale-alert-actions">
                    {alert.type === "sale_delivery_release" ? (
                      <Button
                        variant="neutral"
                        onClick={() =>
                          void command(
                            "alerts.decide",
                            domainScope(state, alert, true),
                            (draft, freshActor) =>
                              setAlertStatus(
                                draft,
                                freshActor,
                                alert.id,
                                "resolved",
                              ),
                          ).catch(() =>
                            setError(
                              t(
                                "This sale changed. Review the alert again before deciding.",
                                "این حراج تغییر کرده است. پیش از تصمیم، هشدار را دوباره بررسی کنید.",
                              ),
                            ),
                          )
                        }
                      >
                        {t("Taken care of", "رسیدگی شد")}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="neutral"
                          onClick={() => decide(alert, "keep")}
                        >
                          {alert.type === "sale_no_end_reminder"
                            ? t("Keep it", "ادامه بده")
                            : alert.type === "sale_cost_increase"
                              ? t(
                                  "Keep the sale as it is",
                                  "حراج به همین صورت ادامه یابد",
                                )
                              : t("Keep the sale", "حراج ادامه یابد")}
                        </Button>
                        {alert.type === "sale_cost_increase" && sale && (
                          <Button
                            variant="neutral"
                            onClick={() => setChanging(alert)}
                          >
                            {t("Change the sale", "تغییر حراج")}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={() => setEnding(alert)}
                        >
                          {t("End sale now", "پایان حراج اکنون")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            {held && (
              <p className="muted">
                <a href="#notes">{t("Notes", "یادداشت‌ها")}</a> ·{" "}
                {t(
                  "Keep this delivery in the back until the sale ends",
                  "این تحویل را تا پایان حراج در انبار پشت فروشگاه نگه دارید",
                )}
              </p>
            )}
          </Card>
        );
      })}
      {changing && canDecide && (
        <ChangePriceDialog
          product_code={changing.product_code}
          branch={changing.branch}
          existing_sale_id={changing.sale_id}
          sale_alert_id={changing.id}
          hold_delivery={holds[changing.id] ?? false}
          onClose={() => setChanging(null)}
        />
      )}
      {ending && canDecide && (
        <ConfirmDialog
          open
          title={t("End sale now", "پایان حراج اکنون")}
          description={t(
            "The current regular price comes back now.",
            "قیمت عادی فعلی اکنون برمی‌گردد.",
          )}
          confirmLabel={t("End sale now", "پایان حراج اکنون")}
          confirmVariant="danger"
          onOpenChange={(open) => {
            if (!open) setEnding(null);
          }}
          onConfirm={() => decide(ending, "end")}
        />
      )}
    </>
  );
}
