import {
  weightPriceCandidate,
  type WeightPriceCandidateInput,
} from "./weight-product-editor";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useLayoutEffect,
  useState,
  type ComponentProps,
} from "react";
import { TriangleAlert } from "lucide-react";
import { useReviewScrollAnchor } from "./screens/invoice-review/useReviewScrollAnchor";
import Decimal from "decimal.js";
import { useDemo } from "./store";
import { lookupBranch, regularPrice } from "./catalog";
import { branchLabel } from "./settings";
import { productEditSnapshot } from "./product-editor";
import { UnitText, DateText, LtrText, Money } from "./presentation";
import {
  weightPriceDisplay,
  weightConversionFactor,
  weighedSettings,
} from "./weighed";
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
  type RegularSaleConflict,
  type RegularSaleResolution,
} from "./sales";
import { salesText } from "./sales-locale";
import { SalePrice } from "./sales-presentation";
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
  onStage?: (input: ChangePriceInput) => void;
  weightCandidate?: WeightPriceCandidateInput;
  stagedInput?: ChangePriceInput;
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

function PriceAmountInput({
  currency,
  ...props
}: ComponentProps<typeof NumberField> & { currency: string }) {
  const symbol =
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  const wrapper = useRef<HTMLDivElement>(null);
  const prefix = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      if (wrapper.current && prefix.current)
        wrapper.current.style.setProperty(
          "--price-currency-width",
          `${prefix.current.getBoundingClientRect().width}px`,
        );
    };
    const observer = new ResizeObserver(measure);
    if (prefix.current) observer.observe(prefix.current);
    measure();
    return () => observer.disconnect();
  }, [symbol]);
  return (
    <div ref={wrapper} className="change-price-money" dir="ltr">
      <span ref={prefix} aria-hidden="true">
        {symbol}
      </span>
      <NumberField {...props} />
    </div>
  );
}

/** The approved Ends track scrolls sideways; fade only the edges with more choices. */
function PriceEndChoices(props: ComponentProps<typeof SegmentedControl>) {
  const frame = useRef<HTMLDivElement>(null);
  const label = props["aria-label"];
  useLayoutEffect(() => {
    const wrapper = frame.current;
    const track = wrapper?.querySelector<HTMLElement>(":scope > .ui-segments");
    if (!wrapper || !track) return;
    const measure = () => {
      const maximum = track.scrollWidth - track.clientWidth;
      const position = Math.abs(track.scrollLeft);
      wrapper.dataset.priceScrollStart = String(position > 1);
      wrapper.dataset.priceScrollEnd = String(maximum - position > 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const button of track.children) observer.observe(button);
    track.addEventListener("scroll", measure);
    measure();
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", measure);
    };
  }, [label]);
  return (
    <div
      ref={frame}
      className="change-price-ends-track"
      onFocusCapture={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        const track = button?.parentElement;
        if (!button || !track?.classList.contains("ui-segments")) return;
        // A masked scroll track can leave a focused button partly visible.
        // Reveal its complete native control without scrolling the body.
        const box = button.getBoundingClientRect();
        const bounds = track.getBoundingClientRect();
        const style = getComputedStyle(track);
        const start = box.left - bounds.left - parseFloat(style.paddingLeft);
        const end = box.right - bounds.right + parseFloat(style.paddingRight);
        if (start < 0 || end > 0)
          track.scrollBy({
            left: start < 0 ? start : end,
            behavior: "instant",
          });
      }}
    >
      <SegmentedControl {...props} />
    </div>
  );
}

function priceCalendarDate(
  value: string,
  language: "en" | "fa",
  style: "short" | "long" | "weekday" = "short",
) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    language === "fa" ? "fa-IR-u-ca-gregory-nu-latn" : "en-CA",
    {
      timeZone: "UTC",
      weekday: style === "short" ? "short" : "long",
      ...(style !== "weekday"
        ? {
            month: style === "short" ? ("short" as const) : ("long" as const),
            day: "numeric" as const,
          }
        : {}),
    },
  ).format(date);
}

const changePriceScrollParent = (control: HTMLElement) =>
  control.closest<HTMLElement>(".change-price-body");

export function ChangePriceDialog(props: ChangePriceDialogProps) {
  const { anchor } = useReviewScrollAnchor(changePriceScrollParent);
  const retainControl = (control: HTMLElement) => {
    const dialog = control.closest<HTMLDialogElement>(
      "dialog.change-price-dialog",
    );
    if (dialog) {
      const box = dialog.getBoundingClientRect();
      if (window.innerWidth <= 760) {
        dialog.style.blockSize = `${box.height}px`;
      } else {
        dialog.style.removeProperty("block-size");
        dialog.style.setProperty("--price-desktop-frame-top", `${box.top}px`);
        dialog.style.setProperty(
          "--price-desktop-frame-max",
          `calc(100dvh - ${box.top}px - 16px)`,
        );
      }
      const content = dialog.querySelector<HTMLElement>(
        ".change-price-content",
      );
      if (content)
        content.style.minBlockSize = `${Math.max(parseFloat(content.style.minBlockSize) || 0, content.getBoundingClientRect().height)}px`;
    }
    anchor(control);
  };
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
  const allowRegular =
    (mayManageRegular || mayProposeRegular) &&
    !state.products.find(
      (item) =>
        item.company_id === state.config.company.seed_key &&
        item.code === props.product_code,
    )?.package_of_product_id;
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
    if (props.onStage && props.stagedInput?.product_code === props.product_code)
      return structuredClone(props.stagedInput);
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
  const monthEnd = (start: string) => {
    const date = new Date(`${start}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
  };
  const [endChoice, setEndChoice] = useState(() =>
    input.last_day === null
      ? "manual"
      : input.last_day === saleDateAfter(input.starts_on, 6)
        ? "week"
        : input.last_day === saleDateAfter(input.starts_on, 13)
          ? "fortnight"
          : input.last_day === monthEnd(input.starts_on)
            ? "month"
            : "date",
  );
  const [selectedQuickPick, setSelectedQuickPick] = useState<number | null>(
    null,
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [transactionError, setTransactionError] = useState("");
  const fieldId = (field: string) => `${id}-${field}`;
  const patch = <K extends keyof ChangePriceInput>(
    field: K,
    value: ChangePriceInput[K],
  ) => {
    if (field === "price") setSelectedQuickPick(null);
    setInput((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "starts_on" &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      saleDateAfter(value, 0) === value
        ? {
            last_day:
              endChoice === "week"
                ? saleDateAfter(value, 6)
                : endChoice === "fortnight"
                  ? saleDateAfter(value, 13)
                  : endChoice === "month"
                    ? monthEnd(value)
                    : previous.last_day,
          }
        : {}),
      ...(field === "price" || field === "branches"
        ? { accept_below_margin: false }
        : {}),
    }));
    setIssues((previous) =>
      previous.filter((issue) => issue.fieldId !== fieldId(field)),
    );
    setTransactionError("");
  };
  const moneyKey = JSON.stringify([
    input.price,
    input.price_unit,
    input.mode,
    input.branches,
    input.regular_sale_resolutions,
    props.weightCandidate,
    context?.user_id,
    context?.authority_epoch,
    businessRevision,
  ]);
  const inputKey = JSON.stringify([
    input,
    context?.user_id,
    context?.authority_epoch,
    businessRevision,
    location,
    props.weightCandidate,
  ]);
  const [previewRecord, setPreviewRecord] = useState<{
    key: string;
    moneyKey: string;
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
      queryPriceChangePreview(
        props.weightCandidate
          ? weightPriceCandidate(freshState, freshActor, props.weightCandidate)
          : freshState,
        freshActor,
        input,
        location,
      ),
    )
      .then((value) => {
        if (!current) return;
        setPreviewRecord({ key: inputKey, moneyKey, value });
        if (input.mode === "regular") {
          const missing = value.effects.flatMap((effect) => {
            const conflict = effect.regular_sale_conflict;
            return conflict &&
              !input.regular_sale_resolutions?.some(
                (item) => item.sale_id === conflict.sale_id,
              )
              ? [conflict]
              : [];
          });
          if (missing.length)
            setInput((previous) => ({
              ...previous,
              regular_sale_resolutions: [
                ...(previous.regular_sale_resolutions ?? []),
                ...missing.map((conflict) => ({
                  sale_id: conflict.sale_id,
                  expected_revision: conflict.revision,
                  action: "end" as const,
                })),
              ],
            }));
        }
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
    moneyKey,
    writeCapability,
    context,
    queryScope,
    businessRevision,
    location,
    query,
    props.weightCandidate,
  ]);
  const preview = previewRecord?.key === inputKey ? previewRecord.value : null;
  // Retain the controls while their next protected preview is being checked.
  const displayedEffects = (preview ?? previewRecord?.value)?.effects ?? [];
  const changeRegularResolution = (
    conflict: RegularSaleConflict,
    update: Partial<RegularSaleResolution>,
  ) => {
    setInput((previous) => {
      const existing = previous.regular_sale_resolutions?.find(
        (item) => item.sale_id === conflict.sale_id,
      );
      return {
        ...previous,
        accept_below_margin: false,
        regular_sale_resolutions: [
          ...(previous.regular_sale_resolutions ?? []).filter(
            (item) => item.sale_id !== conflict.sale_id,
          ),
          {
            sale_id: conflict.sale_id,
            expected_revision: conflict.revision,
            action: "end",
            price_unit: previous.price_unit,
            ...existing,
            ...update,
          },
        ],
      };
    });
    setIssues((previous) =>
      previous.filter(
        (issue) =>
          issue.fieldId !== fieldId(`sale_price_${conflict.sale_id}`) &&
          issue.fieldId !== fieldId("price"),
      ),
    );
    setTransactionError("");
  };
  // Non-monetary edits keep their verified facts, so typing a reason cannot
  // remove and recreate its warning fields while the next query completes.
  const moneyPreview =
    preview ??
    (previewRecord?.moneyKey === moneyKey ? previewRecord.value : null);
  const current =
    moneyPreview?.effects.find((effect) => effect.branch === location) ??
    moneyPreview?.effects[0];
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
      regular_sale_conflict: [
        "Choose how to update the running sale.",
        "روش تغییر حراج در حال اجرا را انتخاب کنید.",
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
    if (issue.code === "replacement_sale_price_not_lower")
      return t(
        `The sale price must be lower than the new regular price ${formatMoney(issue.regular_price ?? input.price, { currency: state.config.company.currency })}.`,
        `قیمت حراج باید کمتر از قیمت عادی جدید ${formatMoney(issue.regular_price ?? input.price, { currency: state.config.company.currency })} باشد.`,
      );
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
          queryPriceChangePreview(
            props.weightCandidate
              ? weightPriceCandidate(
                  freshState,
                  freshActor,
                  props.weightCandidate,
                )
              : freshState,
            freshActor,
            input,
            location,
          ),
      );
      const currentMissing = validation(checked.issues);
      if (currentMissing.length) {
        setIssues(currentMissing);
        requestAnimationFrame(() =>
          focusValidationField(currentMissing[0].fieldId),
        );
        return;
      }
      if (props.onStage) {
        props.onStage(structuredClone(input));
        props.onClose();
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
    moneyPreview?.effects.some((effect) => effect.below_minimum_margin);
  const belowCost =
    mayManageRegular &&
    moneyPreview?.effects.some((effect) => effect.below_cost);
  const uniformRegular =
    moneyPreview?.effects.length &&
    moneyPreview.effects.every(
      (effect) =>
        effect.regular_display_price ===
        moneyPreview.effects[0].regular_display_price,
    )
      ? moneyPreview.effects[0].regular_display_price
      : null;
  const regularWaitsForSale =
    !isSale &&
    displayedEffects.some(
      (effect) =>
        Boolean(effect.existing_sale_id) &&
        (!effect.regular_sale_conflict ||
          input.regular_sale_resolutions?.find(
            (item) => item.sale_id === effect.regular_sale_conflict?.sale_id,
          )?.action === "change"),
    );
  const endingSale =
    !isSale &&
    displayedEffects.some(
      (effect) =>
        effect.regular_sale_conflict &&
        input.regular_sale_resolutions?.find(
          (item) => item.sale_id === effect.regular_sale_conflict?.sale_id,
        )?.action !== "change",
    );
  const storeNames = input.branches
    .map((item) => branchLabel(state.config, item, lang))
    .join(" · ");
  const price =
    /^\d+(?:\.\d{1,2})?$/.test(input.price) && new Decimal(input.price).gt(0)
      ? input.price
      : null;
  const displayedCost =
    price && current?.cost != null
      ? new Decimal(current.cost)
          .times(
            input.price_unit === "kg"
              ? weightConversionFactor(state.config)
              : 1,
          )
          .toFixed(4)
      : null;
  const marginPercent =
    price && current?.margin != null
      ? new Decimal(current.margin).times(100).toDecimalPlaces(0).toFixed(0)
      : null;
  const factsNeedLocation = Boolean(
    current &&
    (current.branch !== location ||
      moneyPreview?.effects.some(
        (effect) =>
          effect.cost !== current.cost ||
          effect.margin !== current.margin ||
          effect.savings !== current.savings ||
          effect.percentage_off !== current.percentage_off,
      )),
  );
  const uniformCost = Boolean(
    current?.cost != null &&
    moneyPreview?.effects.length &&
    moneyPreview.effects.every((effect) => effect.cost === current.cost),
  );
  const warningLoss =
    price &&
    current?.below_cost &&
    uniformCost &&
    displayedCost &&
    new Decimal(displayedCost).gt(price)
      ? new Decimal(displayedCost).minus(price).toFixed(4)
      : null;
  const belowCostStores =
    moneyPreview?.effects
      .filter((effect) => effect.below_cost)
      .map((effect) => branchLabel(state.config, effect.branch, lang))
      .join(" · ") ?? "";
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
      description={
        <>
          <UnitText
            dir={lang === "fa" && product.name_fa.trim() ? "rtl" : "ltr"}
          >
            {lang === "fa" && product.name_fa.trim()
              ? product.name_fa
              : product.name_en}
          </UnitText>{" "}
          · {t("now", "اکنون")}{" "}
          <strong>
            <SalePrice product={product} branch={location} comparison={false} />
          </strong>{" "}
          {t("at", "در")} {branchLabel(state.config, location, lang)}
        </>
      }
    >
      <form
        className="stack change-price-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div
          className="change-price-body stack"
          onPointerDownCapture={(event) => {
            const control = (event.target as HTMLElement).closest<HTMLElement>(
              "input,textarea,button",
            );
            if (control) retainControl(control);
          }}
          onFocusCapture={(event) => retainControl(event.target as HTMLElement)}
          onKeyDownCapture={(event) =>
            retainControl(event.target as HTMLElement)
          }
        >
          <div className="change-price-content stack">
            <WhatsMissing issues={issues} />
            {transactionError && (
              <p className="form-error" role="alert">
                {transactionError}
              </p>
            )}
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
                        existing_sale_id:
                          mode === "sale" ? originalSale?.id : undefined,
                        expected_revision:
                          mode === "sale" ? originalSale?.revision : undefined,
                        expected_revisions:
                          mode === "sale"
                            ? Object.fromEntries(
                                originalGroup.map((sale) => [
                                  sale.id,
                                  sale.revision,
                                ]),
                              )
                            : undefined,
                        regular_sale_resolutions: [],
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
                      {salesText(
                        t,
                        mode === "sale" ? "saleHint" : "regularHint",
                      )}
                    </span>
                  </Radio>
                ))}
              </div>
            )}
            <section className="change-price-pricing">
              <div className="change-price-price-row">
                <Field
                  label={
                    input.price_unit === "each"
                      ? isSale
                        ? t("Sale price", "قیمت حراج")
                        : salesText(t, "price")
                      : t(
                          `Price (per ${input.price_unit})`,
                          `قیمت (هر ${input.price_unit === "kg" ? "کیلوگرم" : "پوند"})`,
                        )
                  }
                  error={error("price")}
                  className="change-price-amount-field"
                >
                  <PriceAmountInput
                    currency={state.config.company.currency}
                    id={fieldId("price")}
                    value={input.price}
                    onChange={(value) => patch("price", value)}
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                </Field>
                <div
                  className="change-price-quick-picks"
                  role="group"
                  aria-label={t("Quick picks", "انتخاب سریع")}
                >
                  {regularDisplay &&
                    quickSalePrices(regularDisplay, state).map((pick) => (
                      <Button
                        key={pick.percentage}
                        variant="neutral"
                        size="sm"
                        disabled={!pick.price}
                        title={
                          !pick.price
                            ? t(
                                "No lower price is available with the configured price endings.",
                                "با رقم‌های پایانی تنظیم‌شده، قیمت پایین‌تری موجود نیست.",
                              )
                            : undefined
                        }
                        onClick={() => {
                          if (pick.price) {
                            patch("price", pick.price);
                            setSelectedQuickPick(pick.percentage);
                          }
                        }}
                        aria-pressed={Boolean(
                          selectedQuickPick === pick.percentage &&
                          pick.price &&
                          price &&
                          new Decimal(pick.price).eq(price),
                        )}
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
              </div>
              {!isSale &&
                displayedEffects.map((effect) => {
                  const conflict = effect.regular_sale_conflict;
                  if (!conflict) return null;
                  const resolution = input.regular_sale_resolutions?.find(
                    (item) => item.sale_id === conflict.sale_id,
                  );
                  const regularAmount = effect.proposed_price
                    ? new Decimal(effect.proposed_price)
                        .times(
                          input.price_unit === "kg"
                            ? weightConversionFactor(state.config)
                            : 1,
                        )
                        .toFixed(2)
                    : input.price;
                  const saleAmount = formatMoney(conflict.display_price, {
                    currency: state.config.company.currency,
                  });
                  const newRegular = formatMoney(regularAmount, {
                    currency: state.config.company.currency,
                  });
                  return (
                    <section
                      key={conflict.sale_id}
                      className="stack"
                      aria-label={t(
                        "Sale and regular price",
                        "قیمت حراج و عادی",
                      )}
                    >
                      {input.branches.length > 1 && (
                        <strong>
                          {branchLabel(state.config, effect.branch, lang)}
                        </strong>
                      )}
                      <p>
                        {t("The sale price", "قیمت حراج")}{" "}
                        <LtrText>{saleAmount}</LtrText>{" "}
                        {t(
                          "isn't lower than the new regular price",
                          "کمتر از قیمت عادی جدید",
                        )}{" "}
                        <LtrText>{newRegular}</LtrText>
                        {t(".", " نیست.")}
                      </p>
                      <div
                        role="radiogroup"
                        aria-label={t(
                          "Update the running sale",
                          "تغییر حراج در حال اجرا",
                        )}
                        className="stack"
                      >
                        <Radio
                          checked={resolution?.action !== "change"}
                          onChange={() =>
                            changeRegularResolution(conflict, { action: "end" })
                          }
                        >
                          {t("End the sale now", "حراج را اکنون پایان بده")}
                        </Radio>
                        <Radio
                          checked={resolution?.action === "change"}
                          onChange={() =>
                            changeRegularResolution(conflict, {
                              action: "change",
                            })
                          }
                        >
                          {t("Change the sale price", "تغییر قیمت حراج")}
                        </Radio>
                      </div>
                      {resolution?.action === "change" && (
                        <Field
                          label={t("New sale price", "قیمت جدید حراج")}
                          error={error(`sale_price_${conflict.sale_id}`)}
                        >
                          <NumberField
                            id={fieldId(`sale_price_${conflict.sale_id}`)}
                            value={resolution.sale_price ?? ""}
                            min="0"
                            step="0.01"
                            onChange={(value) =>
                              changeRegularResolution(conflict, {
                                sale_price: value,
                                price_unit: input.price_unit,
                              })
                            }
                          />
                        </Field>
                      )}
                    </section>
                  );
                })}
              {price && (
                <div className="change-price-facts">
                  {factsNeedLocation && current && (
                    <span>
                      {t(
                        `At ${branchLabel(state.config, current.branch, "en")}`,
                        `در ${branchLabel(state.config, current.branch, "fa")}`,
                      )}
                    </span>
                  )}
                  {current?.savings && new Decimal(current.savings).gt(0) && (
                    <span>
                      {t("Customers save", "صرفه‌جویی مشتریان")}{" "}
                      <strong>
                        <Money
                          value={current.savings}
                          currency={state.config.company.currency}
                        />{" "}
                        (<LtrText>{current.percentage_off}%</LtrText>)
                      </strong>
                    </span>
                  )}
                  {mayManageRegular && marginPercent !== null && (
                    <span className={belowMargin ? "is-bad" : undefined}>
                      {t("Margin", "حاشیهٔ سود")}{" "}
                      <strong>
                        <LtrText>{marginPercent}%</LtrText>
                      </strong>
                    </span>
                  )}
                  {mayManageRegular && displayedCost !== null && (
                    <span>
                      {t("Cost", "هزینه")}{" "}
                      <strong>
                        <Money
                          value={displayedCost}
                          currency={state.config.company.currency}
                          decimals={4}
                        />
                      </strong>
                    </span>
                  )}
                </div>
              )}
              {(belowMargin || belowCost) && price && (
                <section
                  className={`change-price-warning${belowMargin ? " change-price-margin-warning" : ""}${belowCost ? " change-price-cost-warning" : ""}`}
                  role="alert"
                >
                  <div className="change-price-warning-heading">
                    <TriangleAlert size={18} aria-hidden="true" />
                    <div>
                      <strong>
                        {belowCost
                          ? t(
                              "This price is below cost.",
                              "این قیمت کمتر از هزینه است.",
                            )
                          : t(
                              "This price is below the minimum margin.",
                              "این قیمت کمتر از حداقل حاشیهٔ سود است.",
                            )}
                      </strong>
                      {belowCost && warningLoss && (
                        <span>
                          {t("Each one sold loses", "زیان هر فروش")}{" "}
                          <Money
                            value={warningLoss}
                            currency={state.config.company.currency}
                          />
                          {belowMargin && current?.minimum_margin != null
                            ? t(
                                `, and it's below the ${new Decimal(current.minimum_margin).times(100).toFixed(0)}% minimum margin.`,
                                `، و کمتر از حداقل حاشیهٔ سود ${new Decimal(current.minimum_margin).times(100).toFixed(0)}٪ است.`,
                              )
                            : "."}
                        </span>
                      )}
                      {belowCost && !warningLoss && belowCostStores && (
                        <span>
                          {t("Below cost in", "زیر هزینه در")}{" "}
                          <bdi dir="auto">{belowCostStores}</bdi>.
                        </span>
                      )}
                    </div>
                  </div>
                  {(belowCost || belowMargin) && (
                    <Field
                      label={
                        belowCost
                          ? salesText(t, "reason")
                          : t("Reason (optional)", "دلیل (اختیاری)")
                      }
                      error={error("below_cost_reason")}
                    >
                      <input
                        className="ui-input"
                        id={fieldId("below_cost_reason")}
                        value={input.below_cost_reason}
                        onChange={(event) =>
                          patch("below_cost_reason", event.target.value)
                        }
                      />
                    </Field>
                  )}
                  {belowMargin && (
                    <>
                      <Checkbox
                        id={fieldId("accept_below_margin")}
                        checked={input.accept_below_margin}
                        onChange={(value) =>
                          patch("accept_below_margin", value)
                        }
                      >
                        {salesText(t, "useAnyway")}
                      </Checkbox>
                      {error("accept_below_margin") && (
                        <p className="form-error">
                          {error("accept_below_margin")}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}
            </section>
            <section className="change-price-when">
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
                        {
                          value: "selected",
                          label: salesText(t, "chooseStores"),
                        },
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
                                  : input.branches.filter(
                                      (item) => item !== store,
                                    ),
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
                <>
                  <Field
                    label={salesText(t, "starts")}
                    error={error("starts_on")}
                  >
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
                  <Field
                    className="change-price-ends"
                    label={salesText(t, "ends")}
                    error={error("last_day")}
                  >
                    <div className="stack" id={fieldId("last_day")}>
                      <div className="change-price-ends-row">
                        <PriceEndChoices
                          aria-label={salesText(t, "ends")}
                          value={input.last_day === null ? "manual" : endChoice}
                          onChange={(value) => {
                            setEndChoice(value);
                            patch(
                              "last_day",
                              value === "manual"
                                ? null
                                : value === "week"
                                  ? saleDateAfter(input.starts_on, 6)
                                  : value === "fortnight"
                                    ? saleDateAfter(input.starts_on, 13)
                                    : value === "month"
                                      ? monthEnd(input.starts_on)
                                      : (input.last_day ??
                                        saleDateAfter(
                                          input.starts_on,
                                          Math.max(
                                            0,
                                            settings.default_length_days - 1,
                                          ),
                                        )),
                            );
                          }}
                          options={[
                            { value: "week", label: salesText(t, "oneWeek") },
                            {
                              value: "fortnight",
                              label: salesText(t, "twoWeeks"),
                            },
                            { value: "month", label: salesText(t, "endMonth") },
                            { value: "date", label: t("Date…", "تاریخ…") },
                            {
                              value: "manual",
                              label: t("No end", "بدون پایان"),
                            },
                          ]}
                        />
                        {input.last_day && (
                          <span className="muted change-price-until">
                            {t("until", "تا")}{" "}
                            <bdi dir="auto">
                              {priceCalendarDate(input.last_day, lang)}
                            </bdi>
                          </span>
                        )}
                      </div>
                      {endChoice === "date" && input.last_day !== null && (
                        <DateField
                          aria-label={salesText(t, "lastDay")}
                          value={input.last_day}
                          onChange={(value) => patch("last_day", value)}
                        />
                      )}
                    </div>
                  </Field>
                </>
              )}
            </section>
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
            <section className="change-price-summary" aria-live="polite">
              {price && (
                <p>
                  <strong>
                    {input.branches.length === eligible.length && !worker ? (
                      t(
                        `All ${eligible.length} stores`,
                        `همهٔ ${eligible.length} فروشگاه`,
                      )
                    ) : (
                      <bdi dir="auto">{storeNames}</bdi>
                    )}{" "}
                    {isSale
                      ? t("sell it for", "می‌فروشند به")
                      : salesText(t, "newRegular")}{" "}
                    <LtrText>
                      <Money
                        value={summaryPrice ?? price}
                        currency={state.config.company.currency}
                      />
                      {input.price_unit !== "each" && `/${input.price_unit}`}
                    </LtrText>
                  </strong>
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
                  {isSale && (
                    <>
                      ,{" "}
                      {input.starts_on === today
                        ? t("today", "امروز")
                        : priceCalendarDate(input.starts_on, lang, "long")}
                      {input.last_day && (
                        <>
                          {" "}
                          {t("until", "تا")}{" "}
                          <bdi dir="auto" className="sale-calendar-date">
                            {priceCalendarDate(input.last_day, lang, "long")}
                          </bdi>
                        </>
                      )}
                    </>
                  )}
                  .
                  {isSale && input.last_day && uniformRegular && (
                    <>
                      {" "}
                      {t("On", "در")}{" "}
                      <bdi dir="auto" className="sale-calendar-date">
                        {priceCalendarDate(
                          saleDateAfter(input.last_day, 1),
                          lang,
                          "weekday",
                        )}
                      </bdi>
                      {t(", it goes back to", "، قیمت برمی‌گردد به")}{" "}
                      <Money
                        value={uniformRegular}
                        currency={state.config.company.currency}
                      />{" "}
                      {t("by itself.", "به‌صورت خودکار.")}
                    </>
                  )}
                </p>
              )}
              {price && isSale && input.last_day === null && (
                <p>{salesText(t, "whenEnded")}</p>
              )}
              {price && !isSale && (
                <>
                  <p>{salesText(t, "regularHint")}</p>
                  {endingSale && (
                    <p>
                      {t(
                        "The sale ends now. Customers pay the new regular price.",
                        "حراج اکنون پایان می‌یابد. مشتریان قیمت عادی جدید را پرداخت می‌کنند.",
                      )}
                    </p>
                  )}
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
              {(!worker || isSale) && (
                <Checkbox
                  checked={input.add_labels}
                  onChange={(value) => patch("add_labels", value)}
                >
                  {salesText(t, isSale ? "promoLabels" : "regularLabels")}
                </Checkbox>
              )}
            </section>
          </div>
        </div>
        <DialogActions>
          <Button variant="neutral" onClick={props.onClose}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit" disabled={!preview}>
            {props.onStage
              ? t("Apply to draft", "اعمال در پیش‌نویس")
              : worker
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
