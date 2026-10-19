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
  Money,
  DateText,
  ProductName,
  LtrText,
  demoUserLabel,
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

export function SaleRequestCards({ compact = false }: { compact?: boolean }) {
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
  const [message, setMessage] = useState("");
  const canDecide = Boolean(historyContext && can("approvals.decide"));
  const requests = (state.sale_requests ?? []).filter(
    (request) =>
      request.company_id === historyContext?.company_id &&
      historyContext.allowed_branches.includes(request.branch) &&
      request.status === "pending" &&
      (branch === "all" || request.branch === branch) &&
      (!request.last_day ||
        request.last_day >= saleStoreDate(state.config, request.branch)),
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
    requests.map((request) => ({
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
      setMessage(t("Approved", "تأیید شد"));
    } catch (error) {
      setMessage(
        error instanceof SalesError && error.code === "revision"
          ? t(
              "This request changed. Review it again.",
              "این درخواست تغییر کرده است. دوباره آن را بررسی کنید.",
            )
          : t(
              "Open the request again to review its price, stores and dates.",
              "برای بررسی قیمت، فروشگاه‌ها و تاریخ‌ها درخواست را دوباره باز کنید.",
            ),
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
      setMessage(t("Rejected", "رد شد"));
    } catch {
      setMessage(
        t(
          "This request changed. Review it again.",
          "این درخواست تغییر کرده است. دوباره آن را بررسی کنید.",
        ),
      );
    }
  };
  const content = (
    <>
      {message && <p role="status">{message}</p>}
      {requests.map((request) => {
        const product = state.products.find(
          (item) =>
            item.company_id === request.company_id &&
            item.code === request.product_code,
        );
        const preview = canDecide ? previews[request.id] : undefined;
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
          <section
            className={`sale-request-card${compact ? " is-compact" : ""}`}
            key={request.id}
            data-sale-request-id={request.id}
          >
            <div className="sales-title-row">
              <h3>
                {product ? (
                  <ProductName product={product} language={lang} />
                ) : (
                  <LtrText>{request.product_code}</LtrText>
                )}
              </h3>
              <Badge tone="pending">{t("Sale request", "درخواست حراج")}</Badge>
            </div>
            <WhatsMissing issues={issues} />
            <div className="sale-request-facts">
              <strong>
                <Money
                  value={request.requested_price}
                  currency={state.config.company.currency}
                />
                {request.price_unit !== "each" && (
                  <LtrText>/{request.price_unit}</LtrText>
                )}
              </strong>
              <span>{branchLabel(state.config, request.branch, lang)}</span>
              <span>
                <DateText value={request.starts_on} />
                {request.last_day ? (
                  <>
                    {" "}
                    – <DateText value={request.last_day} />
                  </>
                ) : (
                  <> · {t("No end date", "بدون تاریخ پایان")}</>
                )}
              </span>
            </div>
            {request.requester && (
              <p className="muted">
                {t("Requested by", "درخواست‌دهنده")}:{" "}
                {demoUserLabel(request.requester, lang)}
                {request.why && (
                  <>
                    {" "}
                    · {t("Why?", "چرا؟")} {request.why}
                  </>
                )}
              </p>
            )}
            {effect?.margin && (
              <p>
                {t("Margin at this price", "حاشیه سود در این قیمت")}{" "}
                <LtrText>
                  {new Decimal(effect.margin)
                    .times(100)
                    .toFixed(0, Decimal.ROUND_HALF_UP)}
                  %
                </LtrText>
              </p>
            )}
            {effect?.below_minimum_margin && (
              <div className="banner pending sale-request-margin-warning">
                <p>
                  {t(
                    "This price is below the minimum margin.",
                    "این قیمت کمتر از حداقل حاشیهٔ سود است.",
                  )}
                </p>
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
                    "Use this price anyway",
                    "با این حال از این قیمت استفاده شود",
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
            {canDecide && (
              <div className="actions sale-request-actions">
                <Button disabled={!preview} onClick={() => approve(request)}>
                  {t("Approve", "تأیید")}
                </Button>
                <Button
                  id={`sale-request-review-${request.id}`}
                  variant="neutral"
                  onClick={() => setChanging(request)}
                >
                  {t("Change and approve", "تغییر و تأیید")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setRejecting(request);
                    setReason("");
                    setRejectAttempted(false);
                  }}
                >
                  {t("Reject", "رد")}
                </Button>
              </div>
            )}
          </section>
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
    <Card title={t("Sale requests", "درخواست‌های حراج")}>{content}</Card>
  );
}
