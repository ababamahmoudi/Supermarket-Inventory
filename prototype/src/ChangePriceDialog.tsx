import { useEffect, useId, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { useDemo } from "./store";
import { lookupBranch, regularPrice } from "./catalog";
import { branchLabel } from "./settings";
import { productEditSnapshot } from "./product-editor";
import { ProductName, DateText, LtrText, Money } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import { weightPriceDisplay, weighedSettings } from "./weighed";
import { formatMoney } from "./formatters";
import {
  activeSaleAt,
  sellingSaleBranches,
  pendingSaleRequest,
  quickSalePrices,
  saleDateAfter,
  saleGroup,
  saleStoreDate,
  salesSettings,
  savePriceChange,
  requestSale,
  editSaleRequest,
  resolveSaleRequest,
  decideSaleCostAlert,
  SalesError,
  type ChangePriceInput,
  type SalesValidationIssue,
} from "./sales";
import { salesText, saleCalendarDate } from "./sales-locale";
import { SalePrice, SaleStatus } from "./sales-presentation";
import {
  WhatsMissing,
  focusValidationField,
  type ValidationIssue,
} from "./WhatsMissing";
import {
  Button,
  Checkbox,
  DateField,
  Dialog,
  DialogActions,
  Field,
  NumberField,
  Radio,
  SegmentedControl,
} from "./ui";
import type { Branch } from "./types";
import type { Capability, ResourceScope } from "./authority-types";
import { proposeRegularPrice } from "./approvals";
import {
  queryPriceChangePreview,
  type PriceChangePreviewDTO,
} from "./price-change-read-model";

export interface ChangePriceDialogProps {
  product_code: string;
  onClose: () => void;
  branch?: Branch;
  mode?: "sale" | "regular";
  existing_sale_id?: string;
  request_id?: string;
  approve_request_id?: string;
  sale_alert_id?: string;
  hold_delivery?: boolean;
  onSaved?: (snapshots: {
    before_product_snapshot: string;
    after_product_snapshot: string;
  }) => void;
}

export function ChangePriceDialog(props: ChangePriceDialogProps) {
  const {
    state,
    branch,
    actor: context,
    can,
    command,
    query,
    businessRevision,
    lang,
    t,
  } = useDemo();
  const id = useId();
  const location = lookupBranch(props.branch ?? branch);
  const mayManageSale = can("sales.manage");
  const mayManageRegular = can("pricing.regular_manage");
  const mayProposeRegular = can("pricing.propose_manual");
  const allowRegular = mayManageRegular || mayProposeRegular;
  const worker = !mayManageSale;
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === props.product_code,
  );
  const eligible = context
    ? sellingSaleBranches(state).filter((id) =>
        context.allowed_branches.includes(id),
      )
    : [];
  const today = saleStoreDate(state.config, location);
  const settings = salesSettings(state);
  const [originalRequest] = useState(() => {
    const explicit = props.approve_request_id ?? props.request_id;
    return explicit
      ? (state.sale_requests ?? []).find(
          (item) =>
            item.company_id === state.config.company.seed_key &&
            item.id === explicit,
        )
      : worker
        ? (() => {
            const request = pendingSaleRequest(
              state,
              props.product_code,
              location,
            );
            return request?.requester_user_id === context?.user_id
              ? request
              : null;
          })()
        : null;
  });
  const [originalSale] = useState(() => {
    if (props.mode === "regular") return null;
    const explicit =
      props.existing_sale_id ?? originalRequest?.existing_sale_id;
    return explicit
      ? (state.sales ?? []).find(
          (item) =>
            item.company_id === state.config.company.seed_key &&
            item.id === explicit,
        )
      : (activeSaleAt(state, props.product_code, location) ??
          (state.sales ?? []).find(
            (item) =>
              item.company_id === state.config.company.seed_key &&
              item.product_code === props.product_code &&
              item.branch === location &&
              item.status !== "ended",
          ));
  });
  const [originalGroup] = useState(() =>
    originalSale ? saleGroup(state, originalSale) : [],
  );
  const [input, setInput] = useState<ChangePriceInput>(() => {
    const existingBranches = originalRequest
      ? [originalRequest.branch]
      : originalGroup.map((item) => item.branch);
    const targets = worker
      ? eligible.filter((item) => item === location)
      : existingBranches.length
        ? existingBranches
        : eligible;
    const start =
      originalRequest?.starts_on ?? originalSale?.starts_on ?? today;
    return {
      product_code: props.product_code,
      mode:
        (worker && !allowRegular) || props.approve_request_id
          ? "sale"
          : (props.mode ?? "sale"),
      scope: worker
        ? "current"
        : existingBranches.length
          ? targets.length === eligible.length
            ? "all"
            : targets.length === 1 && targets[0] === location
              ? "current"
              : "selected"
          : "all",
      price: originalRequest?.requested_price ?? originalSale?.sale_price ?? "",
      price_unit:
        originalRequest?.price_unit ??
        originalSale?.price_unit ??
        (product?.sold_by === "weight"
          ? weighedSettings(state.config).main_display_unit
          : "each"),
      branches: targets,
      starts_on: props.approve_request_id && start < today ? today : start,
      last_day: originalRequest
        ? originalRequest.last_day
        : originalSale
          ? originalSale.last_day
          : saleDateAfter(today, Math.max(0, settings.default_length_days - 1)),
      accept_below_margin: false,
      below_cost_reason: "",
      add_labels:
        originalRequest?.add_promo_labels ??
        originalSale?.add_promo_labels ??
        (props.mode === "regular" || settings.add_promo_labels_on_start),
      why: originalRequest?.why ?? "",
      existing_sale_id: originalSale?.id,
      expected_revision: originalSale?.revision,
      expected_revisions: Object.fromEntries(
        originalGroup.map((item) => [item.id, item.revision]),
      ),
    };
  });
  const [startChoice, setStartChoice] = useState(
    input.starts_on === today
      ? "today"
      : input.starts_on === saleDateAfter(today, 1)
        ? "tomorrow"
        : "date",
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [transactionError, setTransactionError] = useState("");
  const fieldId = (field: string) => `${id}-${field}`;
  const patch = <K extends keyof ChangePriceInput>(
    field: K,
    value: ChangePriceInput[K],
  ) => {
    setInput((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "price" || field === "branches"
        ? { accept_below_margin: false }
        : {}),
    }));
    setIssues((previous) =>
      previous.filter((issue) => issue.fieldId !== fieldId(field)),
    );
    setTransactionError("");
  };
  const inputKey = JSON.stringify([
    input,
    context?.user_id,
    context?.authority_epoch,
    businessRevision,
    location,
  ]);
  const [previewRecord, setPreviewRecord] = useState<{
    key: string;
    value: PriceChangePreviewDTO;
  } | null>(null);
  const capability = (): Capability => {
    if (props.sale_alert_id) return "sales.cost_alert_decide";
    if (props.approve_request_id) return "approvals.decide";
    if (input.mode === "regular")
      return mayManageRegular
        ? "pricing.regular_manage"
        : "pricing.propose_manual";
    if (worker && originalRequest) return "sales.request_edit_own";
    return worker ? "sales.request" : "sales.manage";
  };
  const writeCapability = capability();
  const queryScope = useMemo<ResourceScope>(
    () => ({
      company_id: state.config.company.seed_key,
      kind: "location_record",
      location_ids: input.branches,
      entity_id: originalRequest?.id ?? originalSale?.id ?? product?.code,
      owner_user_id: originalRequest?.requester_user_id,
    }),
    [
      state.config.company.seed_key,
      input.branches,
      originalRequest?.id,
      originalRequest?.requester_user_id,
      originalSale?.id,
      product?.code,
    ],
  );
  useEffect(() => {
    let current = true;
    if (!context) return;
    void query(writeCapability, queryScope, (freshState, freshActor) =>
      queryPriceChangePreview(freshState, freshActor, input, location),
    )
      .then((value) => {
        if (current) setPreviewRecord({ key: inputKey, value });
      })
      .catch(() => {
        if (current) setPreviewRecord(null);
      });
    return () => {
      current = false;
    };
  }, [
    input,
    inputKey,
    writeCapability,
    context,
    queryScope,
    businessRevision,
    location,
    query,
  ]);
  const preview = previewRecord?.key === inputKey ? previewRecord.value : null;
  const current =
    preview?.effects.find((effect) => effect.branch === location) ??
    preview?.effects[0];
  const regular = product ? regularPrice(state, product, location) : null;
  const regularDisplay =
    regular && product?.sold_by === "weight"
      ? weightPriceDisplay(regular, state.config).main.amount
      : regular;
  const message = (issue: SalesValidationIssue) => {
    const messages: Record<string, [string, string]> = {
      permission: [
        "Your role cannot save this price change.",
        "نقش شما اجازهٔ ذخیرهٔ این تغییر قیمت را ندارد.",
      ],
      company: [
        "This product is outside your company.",
        "این محصول خارج از شرکت شما است.",
      ],
      product: [
        "Choose an active product with an approved regular price.",
        "یک محصول فعال با قیمت عادی تأییدشده انتخاب کنید.",
      ],
      stores: [
        "Choose a store that sells to customers.",
        "فروشگاهی انتخاب کنید که به مشتریان می‌فروشد.",
      ],
      price: [
        "Enter a price greater than zero, with at most two decimals.",
        "قیمتی بزرگ‌تر از صفر با حداکثر دو رقم اعشار وارد کنید.",
      ],
      price_unit: [
        "Choose the selling unit for this price.",
        "واحد فروش این قیمت را انتخاب کنید.",
      ],
      start_date: [
        "Choose a valid start date.",
        "یک تاریخ شروع معتبر انتخاب کنید.",
      ],
      last_day: ["Choose a valid last day.", "یک آخرین روز معتبر انتخاب کنید."],
      end_before_start: [
        "The last day cannot be before the start date.",
        "آخرین روز نمی‌تواند پیش از تاریخ شروع باشد.",
      ],
      elapsed: [
        "The last day has passed. Choose a new last day.",
        "آخرین روز گذشته است. آخرین روز جدیدی انتخاب کنید.",
      ],
      sale_overlap: [
        "A sale already covers these dates at this store. Change that sale.",
        "در این فروشگاه حراجی برای این تاریخ‌ها وجود دارد. همان حراج را تغییر دهید.",
      ],
      request_exists: [
        "A sale request is already waiting for this product at this store.",
        "درخواست حراج این محصول در این فروشگاه از قبل در انتظار است.",
      ],
      below_margin: [
        "Confirm Use this price anyway before saving.",
        "پیش از ذخیره، استفاده از این قیمت را تأیید کنید.",
      ],
      below_cost_reason: [
        "Add a reason for the price below cost.",
        "برای قیمت زیر هزینه دلیلی اضافه کنید.",
      ],
      reason: ["Add a reason.", "دلیلی اضافه کنید."],
      revision: [
        "This sale changed. Close the dialog and open it again.",
        "این حراج تغییر کرده است. پنجره را ببندید و دوباره باز کنید.",
      ],
      request_decided: [
        "This request has already been decided. Close the dialog and refresh.",
        "این درخواست قبلاً تصمیم‌گیری شده است. پنجره را ببندید و تازه‌سازی کنید.",
      ],
      identity: [
        "Only the requester can change this request.",
        "فقط درخواست‌کننده می‌تواند این درخواست را تغییر دهد.",
      ],
    };
    if (issue.code === "sale_price_not_lower") {
      const amount = issue.regular_price
        ? formatMoney(issue.regular_price, {
            currency: state.config.company.currency,
          })
        : t("the regular price", "قیمت عادی");
      return t(
        `A sale price must be lower than ${amount}. To raise the price, choose New regular price.`,
        `قیمت حراج باید کمتر از ${amount} باشد. برای افزایش قیمت، قیمت عادی جدید را انتخاب کنید.`,
      );
    }
    return t(...messages[issue.code]);
  };
  const validation = (problems: readonly SalesValidationIssue[]) => {
    const seen = new Set<string>();
    return problems.flatMap((problem) => {
      if (seen.has(problem.field)) return [];
      seen.add(problem.field);
      return [
        {
          id: problem.field,
          fieldId: fieldId(problem.field),
          message: message(problem),
        },
      ];
    });
  };
  const submit = async () => {
    if (!context || !product) return;
    const missing = validation(preview?.issues ?? []);
    if (missing.length) {
      setIssues(missing);
      requestAnimationFrame(() => focusValidationField(missing[0].fieldId));
      return;
    }
    try {
      let snapshots:
        | Parameters<NonNullable<ChangePriceDialogProps["onSaved"]>>[0]
        | undefined;
      const checked = await query(
        writeCapability,
        queryScope,
        (freshState, freshActor) =>
          queryPriceChangePreview(freshState, freshActor, input, location),
      );
      const currentMissing = validation(checked.issues);
      if (currentMissing.length) {
        setIssues(currentMissing);
        requestAnimationFrame(() =>
          focusValidationField(currentMissing[0].fieldId),
        );
        return;
      }
      await command(
        writeCapability,
        { ...queryScope, mutation: true },
        (next, freshActor) => {
          const before =
            props.onSaved && mayManageRegular
              ? productEditSnapshot(next, freshActor, props.product_code)
              : "";
          if (props.sale_alert_id) {
            if (!originalSale) throw new SalesError("revision");
            decideSaleCostAlert(next, freshActor, props.sale_alert_id, {
              decision: "change",
              expected_sale_revision: originalSale.revision,
              input,
              hold_delivery: props.hold_delivery ?? false,
            });
          } else if (props.approve_request_id && originalRequest)
            resolveSaleRequest(
              next,
              freshActor,
              originalRequest.id,
              "approve",
              {
                expected_revision: originalRequest.revision,
                input,
              },
            );
          else if (worker && originalRequest && input.mode === "sale")
            editSaleRequest(
              next,
              freshActor,
              originalRequest.id,
              input,
              originalRequest.revision,
            );
          else if (input.mode === "regular" && !mayManageRegular)
            proposeRegularPrice(
              next,
              freshActor,
              props.product_code,
              input.branches[0],
              input.price,
              input.price_unit,
            );
          else if (worker) requestSale(next, freshActor, input);
          else savePriceChange(next, freshActor, input);
          if (props.onSaved && mayManageRegular)
            snapshots = {
              before_product_snapshot: before,
              after_product_snapshot: productEditSnapshot(
                next,
                freshActor,
                props.product_code,
              ),
            };
        },
      );
      if (snapshots) props.onSaved?.(snapshots);
      props.onClose();
    } catch (cause) {
      if (cause instanceof SalesError && cause.issues.length) {
        const missing = validation(cause.issues);
        setIssues(missing);
        requestAnimationFrame(() =>
          focusValidationField(missing[0]?.fieldId ?? fieldId("price")),
        );
      } else
        setTransactionError(
          cause instanceof SalesError
            ? message({ code: cause.code, field: "price" })
            : t(
                "This price could not be saved. Refresh and try again.",
                "این قیمت ذخیره نشد. تازه‌سازی کنید و دوباره تلاش کنید.",
              ),
        );
    }
  };
  if (
    !product ||
    !context ||
    (!can("sales.request") && !mayManageSale && !allowRegular)
  )
    return null;
  const isSale = input.mode === "sale";
  const title =
    worker && !allowRegular
      ? salesText(t, "request")
      : originalSale && isSale
        ? salesText(t, "changeSale")
        : salesText(t, "change");
  const error = (field: string) =>
    issues.find((issue) => issue.fieldId === fieldId(field))?.message;
  const belowMargin =
    mayManageRegular &&
    preview?.effects.some((effect) => effect.below_minimum_margin);
  const belowCost =
    mayManageRegular && preview?.effects.some((effect) => effect.below_cost);
  const uniformRegular =
    preview?.effects.length &&
    preview.effects.every(
      (effect) =>
        effect.regular_display_price ===
        preview.effects[0].regular_display_price,
    )
      ? preview.effects[0].regular_display_price
      : null;
  const regularWaitsForSale =
    !isSale &&
    input.branches.some((store) =>
      Boolean(activeSaleAt(state, product, store)),
    );
  const storeNames = input.branches
    .map((item) => branchLabel(state.config, item, lang))
    .join(" · ");
  const price = /^\d+(?:\.\d{1,2})?$/.test(input.price) ? input.price : null;
  const summaryPrice =
    !isSale && current?.proposed_price
      ? product.sold_by === "weight"
        ? weightPriceDisplay(current.proposed_price, state.config).main.amount
        : current.proposed_price
      : price;
  const chooseScope = (scope: ChangePriceInput["scope"]) => {
    setInput((previous) => ({
      ...previous,
      scope,
      branches:
        scope === "all"
          ? eligible
          : scope === "current"
            ? eligible.filter((item) => item === location)
            : previous.branches,
      accept_below_margin: false,
    }));
    setIssues((previous) =>
      previous.filter((issue) => issue.fieldId !== fieldId("stores")),
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      title={title}
      className="change-price-dialog"
      description={<ProductName product={product} language={lang} />}
    >
      <form
        className="stack change-price-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="change-price-body stack">
          <WhatsMissing issues={issues} />
          {transactionError && (
            <p className="form-error" role="alert">
              {transactionError}
            </p>
          )}
          <section
            className="change-price-current"
            aria-label={t("Current price", "قیمت فعلی")}
          >
            <p className="muted">
              {t("Current price at", "قیمت فعلی در")}{" "}
              {branchLabel(state.config, location, lang)}
            </p>
            <strong>
              <SalePrice product={product} branch={location} />
            </strong>
            <SaleStatus product={product} branch={location} />
            {preview?.provenance?.invoice_number && (
              <p className="helper">
                {t("Calculated from invoice", "محاسبه‌شده از فاکتور")}{" "}
                <LtrText>{preview.provenance.invoice_number}</LtrText>:{" "}
                <ProductPrice
                  value={preview.provenance.calculated_price}
                  product={product}
                  config={state.config}
                />
              </p>
            )}
          </section>
          {allowRegular && !props.approve_request_id && (
            <div
              className="change-price-choices"
              role="radiogroup"
              aria-label={t("Price change", "تغییر قیمت")}
            >
              {(["sale", "regular"] as const).map((mode) => (
                <Radio
                  key={mode}
                  checked={input.mode === mode}
                  onChange={() =>
                    setInput((previous) => ({
                      ...previous,
                      mode,
                      add_labels:
                        mode === "regular" ||
                        settings.add_promo_labels_on_start,
                      accept_below_margin: false,
                    }))
                  }
                >
                  <strong>
                    {salesText(
                      t,
                      mode === "sale" ? "saleChoice" : "newRegular",
                    )}
                  </strong>
                  <span className="muted">
                    {salesText(t, mode === "sale" ? "saleHint" : "regularHint")}
                  </span>
                </Radio>
              ))}
            </div>
          )}
          <Field
            label={
              input.price_unit === "each"
                ? salesText(t, "price")
                : t(
                    `Price (per ${input.price_unit})`,
                    `قیمت (هر ${input.price_unit === "kg" ? "کیلوگرم" : "پوند"})`,
                  )
            }
            error={error("price")}
            className="change-price-amount-field"
          >
            <NumberField
              id={fieldId("price")}
              value={input.price}
              onChange={(value) => patch("price", value)}
              min="0"
              step="0.01"
              autoFocus
            />
          </Field>
          <div className="change-price-quick-picks actions">
            {regularDisplay &&
              quickSalePrices(regularDisplay, state).map((pick) => (
                <Button
                  key={pick.percentage}
                  variant="neutral"
                  size="sm"
                  onClick={() => {
                    if (pick.price) patch("price", pick.price);
                  }}
                  aria-label={t(
                    `${pick.percentage}% off`,
                    `${pick.percentage}% تخفیف`,
                  )}
                >
                  {pick.percentage}% {t("off", "تخفیف")}
                  {pick.price && (
                    <Money
                      value={pick.price}
                      currency={state.config.company.currency}
                    />
                  )}
                </Button>
              ))}
          </div>
          {current?.savings && price && new Decimal(current.savings).gt(0) && (
            <p className="helper">
              {t("Customers save", "صرفه‌جویی مشتریان")}{" "}
              <Money
                value={current.savings}
                currency={state.config.company.currency}
              />{" "}
              (<LtrText>{current.percentage_off}%</LtrText> {t("off", "تخفیف")})
            </p>
          )}
          {mayManageRegular &&
            current?.margin !== null &&
            current?.margin !== undefined && (
              <p className="helper">
                {t("Margin at this price", "حاشیهٔ سود با این قیمت")}{" "}
                <LtrText>
                  {new Decimal(current.margin).times(100).toFixed(0)}%
                </LtrText>
              </p>
            )}
          <Field label={salesText(t, "stores")} error={error("stores")}>
            <div
              id={fieldId("stores")}
              className="change-price-stores stack"
              tabIndex={-1}
            >
              {!worker && !props.approve_request_id && (
                <SegmentedControl
                  value={input.scope}
                  onChange={(value) =>
                    chooseScope(value as ChangePriceInput["scope"])
                  }
                  aria-label={salesText(t, "stores")}
                  options={[
                    { value: "all", label: salesText(t, "allStores") },
                    {
                      value: "current",
                      label: t(
                        `Only ${branchLabel(state.config, location, "en")}`,
                        `فقط ${branchLabel(state.config, location, "fa")}`,
                      ),
                    },
                    { value: "selected", label: salesText(t, "chooseStores") },
                  ]}
                />
              )}
              {worker || props.approve_request_id ? (
                <p>
                  {branchLabel(
                    state.config,
                    originalRequest?.branch ?? location,
                    lang,
                  )}
                </p>
              ) : (
                input.scope === "selected" && (
                  <div className="actions">
                    {eligible.map((store) => (
                      <Checkbox
                        key={store}
                        checked={input.branches.includes(store)}
                        onChange={(checked) =>
                          patch(
                            "branches",
                            checked
                              ? [...input.branches, store]
                              : input.branches.filter((item) => item !== store),
                          )
                        }
                      >
                        {branchLabel(state.config, store, lang)}
                      </Checkbox>
                    ))}
                  </div>
                )
              )}
              {!eligible.length && (
                <p className="form-error">
                  {t(
                    "Choose a store that sells to customers.",
                    "فروشگاهی انتخاب کنید که به مشتریان می‌فروشد.",
                  )}
                </p>
              )}
            </div>
          </Field>
          {isSale && (
            <section className="change-price-dates stack">
              <Field label={salesText(t, "starts")} error={error("starts_on")}>
                <div id={fieldId("starts_on")} className="stack">
                  {originalSale?.status === "active" && !worker ? (
                    <DateText value={input.starts_on} />
                  ) : (
                    <>
                      <SegmentedControl
                        aria-label={salesText(t, "starts")}
                        value={startChoice}
                        onChange={(value) => {
                          setStartChoice(value);
                          if (value !== "date")
                            patch(
                              "starts_on",
                              saleDateAfter(
                                today,
                                value === "tomorrow" ? 1 : 0,
                              ),
                            );
                        }}
                        options={[
                          { value: "today", label: salesText(t, "today") },
                          {
                            value: "tomorrow",
                            label: salesText(t, "tomorrow"),
                          },
                          { value: "date", label: salesText(t, "date") },
                        ]}
                      />
                      {startChoice === "date" && (
                        <DateField
                          value={input.starts_on}
                          onChange={(value) => patch("starts_on", value)}
                        />
                      )}
                    </>
                  )}
                </div>
              </Field>
              <Field label={salesText(t, "ends")} error={error("last_day")}>
                <div className="stack" id={fieldId("last_day")}>
                  <SegmentedControl
                    aria-label={salesText(t, "ends")}
                    value={input.last_day === null ? "manual" : "date"}
                    onChange={(value) =>
                      patch(
                        "last_day",
                        value === "manual"
                          ? null
                          : saleDateAfter(
                              input.starts_on,
                              Math.max(0, settings.default_length_days - 1),
                            ),
                      )
                    }
                    options={[
                      { value: "date", label: salesText(t, "lastDay") },
                      { value: "manual", label: salesText(t, "whenEnded") },
                    ]}
                  />
                  {input.last_day !== null && (
                    <>
                      <DateField
                        aria-label={salesText(t, "lastDay")}
                        value={input.last_day}
                        onChange={(value) => patch("last_day", value)}
                      />
                      <div className="actions">
                        {[7, 14].map((days) => (
                          <Button
                            key={days}
                            variant="neutral"
                            size="sm"
                            onClick={() =>
                              patch(
                                "last_day",
                                saleDateAfter(input.starts_on, days - 1),
                              )
                            }
                          >
                            {salesText(t, days === 7 ? "oneWeek" : "twoWeeks")}
                          </Button>
                        ))}
                        <Button
                          variant="neutral"
                          size="sm"
                          onClick={() => {
                            const date = new Date(
                              `${input.starts_on}T12:00:00Z`,
                            );
                            date.setUTCMonth(date.getUTCMonth() + 1, 0);
                            patch("last_day", date.toISOString().slice(0, 10));
                          }}
                        >
                          {salesText(t, "endMonth")}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Field>
            </section>
          )}
          {belowMargin && (
            <section className="banner pending change-price-margin-warning">
              <p>
                {t(
                  "This price is below the minimum margin.",
                  "این قیمت کمتر از حداقل حاشیهٔ سود است.",
                )}
              </p>
              <Checkbox
                id={fieldId("accept_below_margin")}
                checked={input.accept_below_margin}
                onChange={(value) => patch("accept_below_margin", value)}
              >
                {salesText(t, "useAnyway")}
              </Checkbox>
              {error("accept_below_margin") && (
                <p className="form-error">{error("accept_below_margin")}</p>
              )}
            </section>
          )}
          {belowCost && (
            <section className="banner danger change-price-cost-warning">
              <p>
                {t("This price is below cost.", "این قیمت کمتر از هزینه است.")}
              </p>
              <Field
                label={salesText(t, "reason")}
                error={error("below_cost_reason")}
              >
                <textarea
                  id={fieldId("below_cost_reason")}
                  value={input.below_cost_reason}
                  onChange={(event) =>
                    patch("below_cost_reason", event.target.value)
                  }
                  rows={2}
                />
              </Field>
            </section>
          )}
          {worker && isSale && (
            <Field label={salesText(t, "why")}>
              <textarea
                id={fieldId("why")}
                value={input.why}
                onChange={(event) => patch("why", event.target.value)}
                rows={2}
              />
            </Field>
          )}
          {(!worker || isSale) && (
            <Checkbox
              checked={input.add_labels}
              onChange={(value) => patch("add_labels", value)}
            >
              {salesText(t, isSale ? "promoLabels" : "regularLabels")}
            </Checkbox>
          )}
          <section className="change-price-summary" aria-live="polite">
            <p>
              {isSale && (
                <>
                  {t("From", "از")}{" "}
                  <bdi dir="auto" className="sale-calendar-date">
                    {input.starts_on === today
                      ? salesText(t, "today")
                      : saleCalendarDate(input.starts_on, lang, true)}
                  </bdi>
                  {input.last_day && (
                    <>
                      {" "}
                      {t("until", "تا")}{" "}
                      <bdi dir="auto" className="sale-calendar-date">
                        {saleCalendarDate(input.last_day, lang, true)}
                      </bdi>
                    </>
                  )}
                </>
              )}{" "}
              {input.branches.length === eligible.length && !worker ? (
                t(
                  `all ${eligible.length} stores`,
                  `همهٔ ${eligible.length} فروشگاه`,
                )
              ) : (
                <bdi dir="auto">{storeNames}</bdi>
              )}{" "}
              {!isSale ? salesText(t, "newRegular") : t("sell", "می‌فروشند")}{" "}
              <ProductName product={product} language={lang} />{" "}
              {t("at", "به قیمت")}{" "}
              {price ? (
                <LtrText>
                  <Money
                    value={summaryPrice ?? price}
                    currency={state.config.company.currency}
                  />
                  {input.price_unit !== "each" && `/${input.price_unit}`}
                </LtrText>
              ) : (
                "—"
              )}
              {uniformRegular && (
                <>
                  {" "}
                  {t("instead of", "به‌جای")}{" "}
                  <Money
                    value={uniformRegular}
                    currency={state.config.company.currency}
                  />
                </>
              )}
              .
            </p>
            {isSale && input.last_day && uniformRegular && (
              <p>
                {t("On", "در")}{" "}
                <bdi dir="auto" className="sale-calendar-date">
                  {saleCalendarDate(
                    saleDateAfter(input.last_day, 1),
                    lang,
                    true,
                  )}
                </bdi>
                {t(", it goes back to", "، قیمت برمی‌گردد به")}{" "}
                <Money
                  value={uniformRegular}
                  currency={state.config.company.currency}
                />{" "}
                {t("by itself.", "به‌صورت خودکار.")}
              </p>
            )}
            {isSale && input.last_day === null && (
              <p>{salesText(t, "whenEnded")}</p>
            )}
            {!isSale && (
              <>
                <p>{salesText(t, "regularHint")}</p>
                {regularWaitsForSale && (
                  <p>
                    {salesText(t, "afterSale")} ·{" "}
                    {salesText(t, "saleChargeStays")}
                  </p>
                )}
                {regularWaitsForSale && input.add_labels && !worker && (
                  <p>{salesText(t, "deferredLabels")}</p>
                )}
              </>
            )}
            {worker && <p>{salesText(t, "approvalHint")}</p>}
          </section>
        </div>
        <DialogActions>
          <Button variant="neutral" onClick={props.onClose}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit" disabled={!preview}>
            {worker
              ? salesText(t, "sendRequest")
              : props.approve_request_id
                ? salesText(t, "changeApprove")
                : isSale
                  ? salesText(
                      t,
                      input.starts_on > today ? "scheduleSale" : "startSale",
                    )
                  : salesText(t, "saveRegular")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
