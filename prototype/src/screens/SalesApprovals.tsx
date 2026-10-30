import { ApprovalNumbers } from "./ApprovalNumbers";
import { regularPrice } from "../catalog";
import { ProductPrice } from "../weight-price-presentation";
import { companyTimestampText } from "../company-time";
import { saleRequestTab, type SaleRequestTab } from "../sale-request-status";
import { SellingPriceValue } from "../selling-price-presentation";
import { salePriceDisplay } from "../sales";
import { useProtectedQuery } from "../use-protected-query";
import type { SaleRequestReadDTO } from "../offers-read-model";
import { domainScope } from "../domain-authority";
import { useState } from "react";
import Decimal from "decimal.js";
import { ChangePriceDialog } from "../ChangePriceDialog";
import { useDemo } from "../store";
import { branchLabel } from "../settings";
import {
  saleStoreDate,
  previewPriceChange,
  resolveSaleRequest,
  SalesError,
  type ChangePriceInput,
  type PriceChangePreview,
} from "../sales";
import {
  DateText,
  ProductName,
  LtrText,
  demoUserLabel,
  categoryLabel,
} from "../presentation";
import { WhatsMissing } from "../WhatsMissing";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  Field,
} from "../ui";
import "./sales-c8.css";
import "./approval-receiving.css";

export function SaleRequestCards({
  compact = false,
  status = "pending",
}: {
  compact?: boolean;
  status?: SaleRequestTab;
}) {
  const { state, command, query, can, branch, historyContext, lang, t } =
    useDemo();
  const [acknowledgments, setAcknowledgments] = useState<
    Record<string, boolean>
  >({});
  const [costReasons, setCostReasons] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState<Record<string, boolean>>({});
  const [changing, setChanging] = useState<SaleRequestReadDTO | null>(null);
  const [rejecting, setRejecting] = useState<SaleRequestReadDTO | null>(null);
  const [reason, setReason] = useState("");
  const [rejectAttempted, setRejectAttempted] = useState(false);
  const [message, setMessage] = useState<[string, string] | null>(null);
  const canDecide = Boolean(historyContext && can("approvals.decide"));
  const requests = (state.sale_requests ?? []).filter(
    (request) =>
      request.company_id === historyContext?.company_id &&
      historyContext.allowed_branches.includes(request.branch) &&
      saleRequestTab(request.status) === status &&
      (branch === "all" || request.branch === branch),
  );
  const requestInput = (request: SaleRequestReadDTO): ChangePriceInput => ({
    product_code: request.product_code,
    mode: "sale",
    scope: "current",
    price: request.requested_price,
    price_unit: request.price_unit,
    branches: [request.branch],
    starts_on:
      request.starts_on < saleStoreDate(state.config, request.branch)
        ? saleStoreDate(state.config, request.branch)
        : request.starts_on,
    last_day: request.last_day,
    accept_below_margin: acknowledgments[request.id] ?? false,
    below_cost_reason: costReasons[request.id] ?? "",
    add_labels: request.add_promo_labels ?? false,
    why: request.why,
    existing_sale_id: request.existing_sale_id,
    expected_revision: request.expected_sale_revision,
  });
  const previewInputs = JSON.stringify(
    requests
      .filter((request) => request.status === "pending")
      .map((request) => ({
        id: request.id,
        revision: request.revision,
        input: requestInput(request),
      })),
  );
  const requestPreviews = useProtectedQuery(
    canDecide ? "approvals.decide" : null,
    domainScope(state),
    (canonical, actor) => {
      const inputs = JSON.parse(previewInputs) as {
        id: string;
        revision: number;
        input: ChangePriceInput;
      }[];
      return Object.fromEntries(
        inputs.flatMap(({ id, revision, input }) => {
          const request = canonical.sale_requests?.find(
            (item) => item.id === id && item.company_id === actor.company_id,
          );
          return request &&
            request.revision === revision &&
            request.status === "pending"
            ? [[id, previewPriceChange(canonical, actor, input)]]
            : [];
        }),
      ) as Record<string, PriceChangePreview>;
    },
    previewInputs,
  );
  const previews = requestPreviews.data ?? {};
  if (!historyContext || !can("approvals.read") || !requests.length)
    return null;
  const approve = async (request: SaleRequestReadDTO) => {
    setAttempted((current) => ({ ...current, [request.id]: true }));
    const input = requestInput(request);
    try {
      const preview = await query(
        "approvals.decide",
        domainScope(state, request),
        (canonical, actor) => previewPriceChange(canonical, actor, input),
      );
      if (!preview.can_save) {
        requestPreviews.reload();
        return;
      }
      await command(
        "approvals.decide",
        domainScope(state, request, true),
        (draft, freshActor) =>
          resolveSaleRequest(draft, freshActor, request.id, "approve", {
            expected_revision: request.revision,
            input,
          }),
      );
      setMessage(["Approved", "تأیید شد"]);
    } catch (error) {
      setMessage(
        error instanceof SalesError && error.code === "revision"
          ? [
              "This request changed. Review it again.",
              "این درخواست تغییر کرده است. دوباره آن را بررسی کنید.",
            ]
          : [
              "Open the request again to review its price, stores and dates.",
              "برای بررسی قیمت، فروشگاه‌ها و تاریخ‌ها درخواست را دوباره باز کنید.",
            ],
      );
    }
  };
  const reject = async () => {
    setRejectAttempted(true);
    if (!rejecting || !reason.trim()) return;
    try {
      await command(
        "approvals.decide",
        domainScope(state, rejecting, true),
        (draft, freshActor) =>
          resolveSaleRequest(draft, freshActor, rejecting.id, "reject", {
            expected_revision: rejecting.revision,
            reason,
          }),
      );
      setRejecting(null);
      setReason("");
      setMessage(["Rejected", "رد شد"]);
    } catch {
      setMessage([
        "This request changed. Review it again.",
        "این درخواست تغییر کرده است. دوباره آن را بررسی کنید.",
      ]);
    }
  };
  const content = (
    <>
      {message && <p role="status">{t(...message)}</p>}
      {requests.map((request) => {
        const product = state.products.find(
          (item) =>
            item.company_id === request.company_id &&
            item.code === request.product_code,
        );
        const pending = request.status === "pending";
        const terms =
          request.status === "approved" ? request.approved_terms : undefined;
        const preview = canDecide && pending ? previews[request.id] : undefined;
        const effect = preview?.effects[0];
        const issues = attempted[request.id]
          ? (preview?.issues ?? []).map((issue) => ({
              id: issue.code,
              fieldId:
                issue.code === "below_margin"
                  ? `sale-request-margin-${request.id}`
                  : issue.code === "below_cost_reason"
                    ? `sale-request-cost-${request.id}`
                    : `sale-request-review-${request.id}`,
              message:
                issue.code === "below_margin"
                  ? t(
                      "Below the minimum margin. Tick Use this price anyway to approve it.",
                      "کمتر از حداقل حاشیه سود است. برای تأیید، «با این حال از این قیمت استفاده شود» را انتخاب کنید.",
                    )
                  : issue.code === "below_cost_reason"
                    ? t(
                        "Below cost: add a reason.",
                        "کمتر از هزینه: یک دلیل اضافه کنید.",
                      )
                    : t(
                        "Review the sale price, stores and dates.",
                        "قیمت، فروشگاه‌ها و تاریخ‌های حراج را بررسی کنید.",
                      ),
            }))
          : [];
        return (
          <Card
            className={`sale-request-card approval-detail-row${compact ? " is-compact" : ""}`}
            key={request.id}
            data-sale-request-id={request.id}
          >
            <div className="approval-row-heading">
              <h3>
                {product ? (
                  <a href={`#product?code=${encodeURIComponent(product.code)}`}>
                    <ProductName product={product} language={lang} />
                  </a>
                ) : (
                  <LtrText>{request.product_code}</LtrText>
                )}
              </h3>
              {product && (
                <p className="muted approval-product-context">
                  <bdi dir="ltr">{product.unit_size}</bdi> ·{" "}
                  {categoryLabel(
                    state.config.pricing_categories.find(
                      (row) => row.key === product.pricing_category,
                    )?.label ?? product.pricing_category,
                    lang,
                  )}{" "}
                  · <bdi dir="auto">{product.main_supplier}</bdi> ·{" "}
                  <bdi dir="ltr">{product.code}</bdi>
                </p>
              )}
              <div className="approval-row-badges">
                {pending && (
                  <Badge tone="pending">{t("Pending", "در انتظار")}</Badge>
                )}
                <Badge
                  tone={
                    pending
                      ? "pending"
                      : request.status === "approved"
                        ? "approved"
                        : request.status === "expired"
                          ? "danger"
                          : "neutral"
                  }
                >
                  {pending
                    ? t("Sale request", "درخواست حراج")
                    : request.status === "approved"
                      ? t("Approved sale request", "درخواست حراج تأییدشده")
                      : request.status === "rejected"
                        ? t("Rejected", "ردشده")
                        : request.status === "expired"
                          ? t("Expired", "منقضی‌شده")
                          : t("Withdrawn", "پس‌گرفته‌شده")}
                </Badge>
              </div>
            </div>
            <ApprovalNumbers
              financial={canDecide}
              leadingLabel={t("Regular price", "قیمت عادی")}
              leading={
                product &&
                (effect?.regular_price ??
                  regularPrice(state, product, request.branch)) ? (
                  <ProductPrice
                    value={
                      (effect?.regular_price ??
                        regularPrice(state, product, request.branch))!
                    }
                    product={product}
                    config={state.config}
                  />
                ) : (
                  t("Not added", "اضافه نشده")
                )
              }
              leadingNote={
                pending
                  ? t("until now", "تا الان")
                  : t("Current regular price", "قیمت عادی فعلی")
              }
              priceLabel={t("Sale price", "قیمت حراج")}
              price={
                <SellingPriceValue
                  current={salePriceDisplay(
                    {
                      sale_price: terms?.sale_price ?? request.requested_price,
                      price_unit: terms?.price_unit ?? request.price_unit,
                    },
                    state.config,
                  )}
                  currency={state.config.company.currency}
                />
              }
              priceNote={
                <>
                  <LtrText>
                    <DateText value={terms?.starts_on ?? request.starts_on} />
                    {(terms ? terms.last_day : request.last_day) && (
                      <>
                        {" "}
                        –{" "}
                        <DateText
                          value={(terms ? terms.last_day : request.last_day)!}
                        />
                      </>
                    )}
                  </LtrText>
                  {!(terms ? terms.last_day : request.last_day) && (
                    <> · {t("No end date", "بدون تاریخ پایان")}</>
                  )}
                </>
              }
              marginLabel={t("Margin", "حاشیه سود")}
              margin={
                effect?.margin ? (
                  <LtrText>
                    {new Decimal(effect.margin).times(100).toFixed(1)}%
                  </LtrText>
                ) : (
                  t("Not added", "اضافه نشده")
                )
              }
              marginNote={
                effect?.minimum_margin
                  ? effect.below_minimum_margin
                    ? t(
                        `Below ${new Decimal(effect.minimum_margin).times(100).toString()}% minimum`,
                        `کمتر از حداقل ${new Decimal(effect.minimum_margin).times(100).toString()}٪`,
                      )
                    : t(
                        `Min. ${new Decimal(effect.minimum_margin).times(100).toString()}%`,
                        `حداقل ${new Decimal(effect.minimum_margin).times(100).toString()}٪`,
                      )
                  : undefined
              }
              warning={Boolean(effect?.below_minimum_margin)}
            />
            <WhatsMissing issues={issues} />
            {!pending && (
              <div className="sale-request-decision">
                <p className="muted">
                  {request.status === "rejected"
                    ? t("Rejected by", "ردشده توسط")
                    : request.status === "approved"
                      ? t("Approved by", "تأییدشده توسط")
                      : request.status === "withdrawn"
                        ? t("Withdrawn by", "پس‌گرفته‌شده توسط")
                        : t("Expired", "منقضی‌شده")}
                  {request.decided_by && (
                    <>
                      {" "}
                      <bdi>{demoUserLabel(request.decided_by, lang)}</bdi>
                    </>
                  )}
                  {request.decided_at && (
                    <>
                      {" "}
                      ·{" "}
                      <LtrText>
                        {companyTimestampText(state.config, request.decided_at)}
                      </LtrText>
                    </>
                  )}
                </p>
                {request.decision_reason && (
                  <p>
                    {t("Reason", "دلیل")}: {request.decision_reason}
                  </p>
                )}
              </div>
            )}
            {effect?.below_minimum_margin && (
              <div className="approval-margin-warning">
                <Checkbox
                  id={`sale-request-margin-${request.id}`}
                  checked={acknowledgments[request.id] ?? false}
                  onChange={(value) =>
                    setAcknowledgments((current) => ({
                      ...current,
                      [request.id]: value,
                    }))
                  }
                >
                  {t(
                    "Use this price anyway — it's below the minimum margin.",
                    "با وجود حاشیه کمتر از حداقل، این قیمت را استفاده کن.",
                  )}
                </Checkbox>
              </div>
            )}
            {effect?.below_cost && (
              <section className="banner danger sale-request-margin-warning">
                <p>
                  {t(
                    "This price is below cost.",
                    "این قیمت کمتر از هزینه است.",
                  )}
                </p>
                <Field
                  label={t("Reason", "دلیل")}
                  error={
                    attempted[request.id] && !costReasons[request.id]?.trim()
                      ? t(
                          "Below cost: add a reason.",
                          "کمتر از هزینه: یک دلیل اضافه کنید.",
                        )
                      : undefined
                  }
                >
                  <input
                    id={`sale-request-cost-${request.id}`}
                    value={costReasons[request.id] ?? ""}
                    onChange={(event) =>
                      setCostReasons((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                  />
                </Field>
              </section>
            )}
            <div className="approval-card-footer">
              <p className="approval-meta muted">
                {branchLabel(state.config, request.branch, lang)}
                {request.requester && (
                  <>
                    {" "}
                    · {t("Requested by", "درخواست از")}{" "}
                    <bdi>{demoUserLabel(request.requester, lang)}</bdi>
                  </>
                )}
                {request.why && (
                  <>
                    {" "}
                    · {t("Why", "دلیل")}: {request.why}
                  </>
                )}
              </p>
              {canDecide && pending && (
                <div className="actions sale-request-actions" data-control-row>
                  <Button
                    id={`sale-request-review-${request.id}`}
                    variant="secondary"
                    onClick={() => setChanging(request)}
                  >
                    {t("Change and approve", "تغییر و تأیید")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setRejecting(request);
                      setReason("");
                      setRejectAttempted(false);
                    }}
                  >
                    {t("Reject", "رد کردن")}
                  </Button>
                  <Button disabled={!preview} onClick={() => approve(request)}>
                    {t("Approve", "تأیید")}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
      {changing && canDecide && (
        <ChangePriceDialog
          product_code={changing.product_code}
          branch={changing.branch}
          approve_request_id={changing.id}
          onClose={() => setChanging(null)}
        />
      )}
      {rejecting && canDecide && (
        <Dialog
          open
          title={t("Reject sale request", "رد درخواست حراج")}
          onOpenChange={(open) => {
            if (!open) setRejecting(null);
          }}
        >
          <WhatsMissing
            issues={
              rejectAttempted && !reason.trim()
                ? [
                    {
                      id: "reason",
                      fieldId: "sale-rejection-reason",
                      message: t("Add a reason.", "یک دلیل اضافه کنید."),
                    },
                  ]
                : []
            }
          />
          <Field
            label={t("Reason", "دلیل")}
            error={
              rejectAttempted && !reason.trim()
                ? t("Add a reason.", "یک دلیل اضافه کنید.")
                : undefined
            }
          >
            <textarea
              id="sale-rejection-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <DialogActions>
            <Button variant="neutral" onClick={() => setRejecting(null)}>
              {t("Cancel", "لغو")}
            </Button>
            <Button variant="danger" onClick={reject}>
              {t("Reject", "رد")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
  return compact ? (
    content
  ) : (
    <div className="approval-sale-list">
      <h2>{t("Sale requests", "درخواست‌های حراج")}</h2>
      {content}
    </div>
  );
}
