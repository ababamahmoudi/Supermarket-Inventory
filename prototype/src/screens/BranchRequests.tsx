import { useState } from "react";
import type { DemoState } from "../types";
import {
  branchRequestView,
  permittedLocationIdsView,
} from "../notes-dates-read";
import type { AuthenticatedActor } from "../authority-types";
import { actorAtLocation } from "../authority";
import Decimal from "decimal.js";
import { Plus, Printer, ArrowLeft } from "lucide-react";
import { useDemo } from "../store";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import { useListState, useRouteParam } from "../navigation";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  Tabs,
  TableRowLink,
} from "../ui";
import { configuredBranches, branchLabel } from "../settings";
import { searchProducts } from "../catalog";
import { DateText, LtrText, ProductName, UnitSize } from "../presentation";
import { createId } from "../ids";
import {
  availableBranchRequestResidual,
  BranchRequestError,
  cancelBranchRequest,
  closeBranchRequest,
  copyBranchRequestResidual,
  markBranchRequestReceived,
  markBranchRequestSent,
  saveBranchRequestDraft,
  sendBranchRequest,
  pickingListSnapshot,
  requestQuantityUnits,
  type BranchRequest,
  type BranchRequestItem,
  type BranchRequestItemInput,
  type BranchRequestStatus,
} from "../branch-requests";
import {
  BilingualPrintText,
  OperationalPrintDocument,
} from "../operational-print";
import { useOperationalPrint } from "../operational-print-hook";
import type { CompanyConfig, Language } from "../types";
import "./branch-requests.css";

const statusText: Record<BranchRequestStatus, [string, string]> = {
  draft: ["Draft", "پیش‌نویس"],
  requested: ["Requested", "درخواست‌شده"],
  sent: ["Sent", "ارسال‌شده"],
  received: ["Received", "دریافت‌شده"],
  closed: ["Closed", "بسته‌شده"],
  cancelled: ["Cancelled", "لغوشده"],
};
const errorText: Record<BranchRequestError["code"], [string, string]> = {
  permission: [
    "You do not have access to Branch requests.",
    "به درخواست‌های شعب دسترسی ندارید.",
  ],
  scope: [
    "This request is not available at this location.",
    "این درخواست در این محل در دسترس نیست.",
  ],
  location: [
    "Choose an active location for this action.",
    "برای این اقدام یک محل فعال انتخاب کنید.",
  ],
  stale: [
    "This request has changed. Open it again before continuing.",
    "این درخواست تغییر کرده است. پیش از ادامه دوباره آن را باز کنید.",
  ],
  status: [
    "This action is not available for this request status.",
    "این اقدام برای وضعیت این درخواست در دسترس نیست.",
  ],
  items: [
    "Add a catalog product or enter an item.",
    "یک کالای فهرست اضافه کنید یا نام مورد را وارد کنید.",
  ],
  quantity: [
    "Enter a positive whole number of units. Cases must convert to whole units; without a pack, enter whole cases.",
    "تعداد واحد باید یک عدد صحیح مثبت باشد. کارتن باید به واحد صحیح تبدیل شود؛ بدون تعداد در کارتن، کارتن کامل وارد کنید.",
  ],
  pack: [
    "Enter a positive whole number for Units per case.",
    "برای تعداد در کارتن یک عدد صحیح مثبت وارد کنید.",
  ],
  decision: [
    "Confirm every item as sent or Short, or as received or Missing.",
    "وضعیت هر مورد را به‌صورت ارسال‌شده یا کسری، یا دریافت‌شده یا نرسیده تأیید کنید.",
  ],
  reason: [
    "Enter a reason for cancelling this request.",
    "دلیل لغو این درخواست را وارد کنید.",
  ],
  residual: [
    "There are no short or missing items left to copy.",
    "مورد کسری یا نرسیده‌ای برای کپی باقی نمانده است.",
  ],
};
function RequestItemName({ item }: { item: BranchRequestItem }) {
  return item.kind === "catalog" ? (
    <span>
      <ProductName product={item} />
      <span className="helper">
        <LtrText>{item.product_code}</LtrText> ·{" "}
        <UnitSize value={item.unit_size ?? ""} />
      </span>
    </span>
  ) : (
    <bdi dir="auto">{item.free_text}</bdi>
  );
}
export function RequestPickingList({
  request,
  config,
  language,
}: {
  request: BranchRequest;
  config: CompanyConfig;
  language: Language;
}) {
  return (
    <OperationalPrintDocument
      title_en="Picking list"
      title_fa="فهرست آماده‌سازی"
      company_name={
        language === "fa" ? config.company.name_fa : config.company.name_en
      }
      reference={request.reference}
      language={language}
    >
      <div className="operational-print-meta">
        <div>
          <BilingualPrintText en="Requesting location" fa="محل درخواست‌کننده" />
          <BilingualPrintText
            en={branchLabel(config, request.from_branch, "en")}
            fa={branchLabel(config, request.from_branch, "fa")}
          />
        </div>
        <div>
          <BilingualPrintText en="Sending location" fa="محل ارسال‌کننده" />
          <BilingualPrintText
            en={branchLabel(config, request.to_branch, "en")}
            fa={branchLabel(config, request.to_branch, "fa")}
          />
        </div>
        <div>
          <BilingualPrintText en="Requested by" fa="درخواست‌کننده" />
          <bdi>{request.requested_by ?? request.created_by}</bdi>
        </div>
        <div>
          <BilingualPrintText en="Date" fa="تاریخ" />
          <bdi dir="ltr">
            <DateText value={request.requested_at ?? request.created_at} />
          </bdi>
        </div>
      </div>
      <table>
        <colgroup>
          <col style={{ width: "7%" }} />
          <col style={{ width: "45%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "26%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>
              <BilingualPrintText en="Sent" fa="ارسال" />
            </th>
            <th>
              <BilingualPrintText en="Item" fa="مورد" />
            </th>
            <th>
              <BilingualPrintText en="Quantity" fa="تعداد" />
            </th>
            <th>
              <BilingualPrintText en="Note" fa="یادداشت" />
            </th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr key={item.id}>
              <td>
                <span
                  className={`operational-print-check${item.sent_quantity && new Decimal(item.sent_quantity).gt(0) ? " is-checked" : ""}`}
                  aria-hidden="true"
                />
              </td>
              <td>
                {item.kind === "catalog" ? (
                  <>
                    <BilingualPrintText en={item.name_en} fa={item.name_fa} />
                    <bdi dir="ltr">
                      {item.product_code} · {item.unit_size}
                    </bdi>
                  </>
                ) : (
                  <bdi dir="auto">{item.free_text}</bdi>
                )}
              </td>
              <td>
                <bdi dir="ltr">{item.sent_quantity ?? item.quantity}</bdi>{" "}
                <BilingualPrintText
                  en={item.quantity_unit === "cases" ? "Cases" : "Units"}
                  fa={item.quantity_unit === "cases" ? "کارتن" : "واحد"}
                />
                {item.sent_quantity !== undefined && (
                  <small>
                    <BilingualPrintText
                      en={`Requested: ${item.quantity}`}
                      fa={`درخواست‌شده: ${item.quantity}`}
                    />
                  </small>
                )}
                {item.units_per_case && (
                  <small>
                    <BilingualPrintText
                      en={`${item.units_per_case} units per case`}
                      fa={`${item.units_per_case} واحد در کارتن`}
                    />
                  </small>
                )}
              </td>
              <td>
                <bdi dir="auto">{item.note}</bdi>
                {item.sending_decision === "short" && (
                  <BilingualPrintText
                    en={`Short: ${item.short_quantity}`}
                    fa={`کسری: ${item.short_quantity}`}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {request.sent_by && (
        <p>
          <BilingualPrintText en="Sent by" fa="ارسال‌کننده" />
          <bdi>{request.sent_by}</bdi> · <DateText value={request.sent_at} />
        </p>
      )}
    </OperationalPrintDocument>
  );
}

type DraftLine = BranchRequestItemInput & { key: string };
export default function BranchRequests() {
  const {
    state,
    command,
    query: protectedQuery,
    actor,
    can,
    branch,
    lang,
    t,
    tCount,
    navigate,
  } = useDemo();
  const active = configuredBranches(state.config);
  const allowed = permittedLocationIdsView(
    state,
    actor,
    can,
    "branch_requests.read",
    { includeInactive: true },
  );
  const context = actor;
  const [tab, setTab] = useListState("requests.tab", "outgoing"),
    [query, setQuery] = useListState("requests.search", ""),
    [statusFilter, setStatusFilter] = useListState("requests.status", "open"),
    [locationFilter, setLocationFilter] = useListState("requests.location", "");
  const routeId = useRouteParam("id");
  const [selected, setSelected] = useState<string | null>(routeId);
  const [selectionRoute, setSelectionRoute] = useState(routeId);
  const [editing, setEditing] = useState<BranchRequest | null>(null),
    [formOpen, setFormOpen] = useState(false),
    [source, setSource] = useState(branch === "all" ? "" : branch),
    [destination, setDestination] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]),
    [productSearch, setProductSearch] = useState("");
  const [actingLocation, setActingLocation] = useState(""),
    [decisions, setDecisions] = useState<
      Record<string, { decision: string; quantity: string }>
    >({}),
    [decisionRevision, setDecisionRevision] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState<string>("");
  const [missing, setMissing] = useState<ValidationIssue[]>([]);
  const missingFor = (id: string) =>
    missing.find((issue) => issue.fieldId === id)?.message;
  const [errorField, setErrorField] = useState<
    BranchRequestError["code"] | null
  >(null);
  if (selectionRoute !== routeId) {
    setSelectionRoute(routeId);
    setSelected(routeId);
    setFormOpen(false);
  }
  const openRequest = (id: string | null) => {
    setSelected(id);
    navigate(id ? `requests?id=${encodeURIComponent(id)}` : "requests");
  };
  const clearError = (...fields: BranchRequestError["code"][]) => {
    if (errorField && fields.includes(errorField)) {
      setError("");
      setErrorField(null);
    }
  };
  const clearMissingField = (fieldId: string) =>
    setMissing((previous) =>
      previous.filter((issue) => issue.fieldId !== fieldId),
    );
  const fieldError = (field: BranchRequestError["code"]) =>
    errorField === field ? error : undefined;
  const currentSessionKey = `${context?.company_id}:${context?.role}:${branch}:${context?.username ?? ""}`;
  const [sessionKey, setSessionKey] = useState(currentSessionKey);
  if (sessionKey !== currentSessionKey) {
    setSessionKey(currentSessionKey);
    setFormOpen(false);
    setEditing(null);
    setLines([]);
    setSelected(null);
    setProductSearch("");
    setError("");
    setMessage("");
  }
  const { printDocument, printOutput } = useOperationalPrint();
  const readable = branchRequestView(state, context),
    request = readable.find((item) => item.id === selected);
  const [selectionKey, setSelectionKey] = useState("");
  const currentSelectionKey = `${request?.id ?? ""}:${request?.revision ?? ""}:${branch}`;
  if (selectionKey !== currentSelectionKey) {
    setSelectionKey(currentSelectionKey);
    setDecisions({});
    setDecisionRevision(request?.revision ?? null);
    setActingLocation("");
    setCancelOpen(false);
    setError("");
  }
  const actionLocation = branch === "all" ? actingLocation : branch;
  const sourceAction = Boolean(
    request &&
    actionLocation === request.from_branch &&
    active.includes(request.from_branch) &&
    allowed.includes(request.from_branch),
  );
  const targetAction = Boolean(
    request &&
    actionLocation === request.to_branch &&
    active.includes(request.to_branch) &&
    allowed.includes(request.to_branch),
  );
  const run = async (
    work: (draft: DemoState, actor: AuthenticatedActor) => void,
    success: string,
    checklist?: "send" | "receive",
    location = actionLocation,
  ) => {
    if (checklist && request) {
      const next: ValidationIssue[] = [];
      for (const item of request.items) {
        if (
          checklist === "receive" &&
          new Decimal(item.sent_quantity ?? "0").lte(0)
        )
          continue;
        const chosen = decisions[item.id];
        const fieldId = `request-decision-${item.id}`;
        if (!chosen)
          next.push({
            id: `decision:${item.id}`,
            fieldId,
            message: t(...errorText.decision),
          });
        else {
          try {
            const maximum = new Decimal(
              checklist === "send"
                ? item.quantity
                : (item.sent_quantity ?? "0"),
            );
            const value = new Decimal(chosen.quantity);
            if (!value.isFinite() || value.lt(0) || value.gt(maximum))
              throw new Error("quantity");
            if (
              (chosen.decision === "short" || chosen.decision === "missing") &&
              value.eq(maximum)
            ) {
              next.push({
                id: `decision:${item.id}`,
                fieldId,
                message: t(...errorText.decision),
              });
              continue;
            }
            if (value.gt(0))
              requestQuantityUnits(
                chosen.quantity,
                item.quantity_unit,
                item.units_per_case,
              );
          } catch {
            next.push({
              id: `quantity:${item.id}`,
              fieldId,
              message: t(...errorText.quantity),
            });
          }
        }
      }
      setMissing(next);
      if (next.length) return;
    }
    try {
      await command(
        checklist === "receive"
          ? "branch_requests.receive"
          : "branch_requests.send",
        {
          company_id: state.config.company.seed_key,
          kind: "location_record",
          location_ids: [location],
          mutation: true,
        },
        (draft, freshActor) =>
          work(draft, actorAtLocation(draft, freshActor, location)),
      );
      setError("");
      setMessage(success);
      setErrorField(null);
      setMissing([]);
      return true;
    } catch (failure) {
      setErrorField(
        failure instanceof BranchRequestError ? failure.code : null,
      );
      setError(
        failure instanceof BranchRequestError
          ? t(...errorText[failure.code])
          : t("Could not save. Try again.", "ذخیره نشد. دوباره تلاش کنید."),
      );
      return false;
    }
  };
  const openDraft = (value?: BranchRequest) => {
    setMissing([]);
    setEditing(value ? structuredClone(value) : null);
    setSource(value?.from_branch ?? (branch === "all" ? "" : branch));
    setDestination(value?.to_branch ?? "");
    setLines(
      value ? value.items.map((item) => ({ ...item, key: item.id })) : [],
    );
    setFormOpen(true);
    setSelected(null);
    setError("");
    setMessage("");
    setProductSearch("");
  };
  const addFreeItem = () => {
    if (!productSearch.trim()) return;
    clearError("items");
    clearMissingField("request-products");
    setLines((previous) => [
      ...previous,
      {
        key: createId("request-form-item"),
        kind: "free_text",
        free_text: productSearch.trim(),
        quantity: "1",
        quantity_unit: "units",
      },
    ]);
    setProductSearch("");
  };
  const save = async (send: boolean) => {
    const next: ValidationIssue[] = [];
    if (!active.includes(source) || !allowed.includes(source))
      next.push({
        id: "location:source",
        fieldId: "request-source",
        message: t(
          "Choose an allowed requesting location.",
          "یک محل درخواست‌کننده مجاز انتخاب کنید.",
        ),
      });
    if (!active.includes(destination) || destination === source)
      next.push({
        id: "location:destination",
        fieldId: "request-destination",
        message: t(
          "Choose a different active sending location.",
          "یک محل ارسال‌کننده فعال و متفاوت انتخاب کنید.",
        ),
      });
    if (!lines.length)
      next.push({
        id: "items",
        fieldId: "request-products",
        message: t(...errorText.items),
      });
    for (const line of lines) {
      try {
        if (
          line.kind === "catalog" &&
          line.quantity_unit === "cases" &&
          line.units_per_case === undefined
        )
          throw new BranchRequestError("pack");
        requestQuantityUnits(
          line.quantity,
          line.quantity_unit,
          line.units_per_case,
        );
      } catch (cause) {
        const code =
          cause instanceof BranchRequestError && cause.code === "pack"
            ? "pack"
            : "quantity";
        next.push({
          id: `${code}:${line.key}`,
          fieldId: `request-${code}-${line.key}`,
          message: t(...errorText[code]),
        });
      }
    }
    setMissing(next);
    setError("");
    setErrorField(null);
    if (next.length) return;
    let id = "";
    const savedSuccessfully = await run(
      (draft, freshActor) => {
        const saved = saveBranchRequestDraft(
          draft,
          actorAtLocation(draft, freshActor, source),
          {
            id: editing?.id,
            expected_revision: editing?.revision,
            from_branch: source,
            to_branch: destination,
            items: lines.map((line) => ({
              id: line.id,
              kind: line.kind,
              product_code: line.product_code,
              free_text: line.free_text,
              quantity: line.quantity,
              quantity_unit: line.quantity_unit,
              units_per_case: line.units_per_case,
              note: line.note,
            })),
          },
        );
        id = saved.id;
        if (send)
          sendBranchRequest(
            draft,
            actorAtLocation(draft, freshActor, source),
            saved.id,
            saved.revision,
          );
      },
      send
        ? t("Request sent.", "درخواست ارسال شد.")
        : t("Draft saved.", "پیش‌نویس ذخیره شد."),
      undefined,
      source,
    );
    if (savedSuccessfully && id) {
      setFormOpen(false);
      openRequest(id);
    }
  };
  if (!can("branch_requests.read"))
    return <EmptyState>{t(...errorText.permission)}</EmptyState>;
  const listed = branchRequestView(state, context, {
    tab: tab as "incoming" | "outgoing",
    query,
    status: statusFilter as BranchRequestStatus | "open" | "all",
  }).filter(
    (item) =>
      !locationFilter ||
      item.from_branch === locationFilter ||
      item.to_branch === locationFilter,
  );
  const translatedStatus = (value: BranchRequestStatus) =>
    t(...statusText[value]);
  const quantityLabel = (item: Pick<BranchRequestItem, "quantity_unit">) =>
    item.quantity_unit === "cases" ? t("Cases", "کارتن") : t("Units", "واحد");
  return (
    <div className="branch-requests-screen">
      <PageHeader
        title={t("Branch requests", "درخواست‌های شعب")}
        actions={
          !formOpen &&
          !request && (
            <Button onClick={() => openDraft()}>
              <Plus size={16} />
              {t("New request", "درخواست جدید")}
            </Button>
          )
        }
      />
      {message && (
        <p role="status" className="helper">
          {message}
        </p>
      )}
      {error &&
        (!formOpen ||
          !["location", "quantity", "pack", "items"].includes(
            errorField ?? "",
          )) &&
        errorField !== "reason" && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      {formOpen && (
        <Button
          variant="plain"
          onClick={() => {
            setFormOpen(false);
            openRequest(null);
          }}
        >
          <ArrowLeft size={16} />
          {t("Back to requests", "بازگشت به درخواست‌ها")}
        </Button>
      )}
      {formOpen ? (
        <Card
          title={
            editing
              ? t("Edit draft", "ویرایش پیش‌نویس")
              : t("New request", "درخواست جدید")
          }
          className="request-form"
        >
          <WhatsMissing issues={missing} />
          <div className="request-location-fields">
            <Field
              label={t("Ask this location", "درخواست از این مکان")}
              error={
                missingFor("request-destination") ??
                (!active.includes(destination) || destination === source
                  ? fieldError("location")
                  : undefined)
              }
            >
              <Select
                id="request-destination"
                value={destination}
                onChange={(value) => {
                  setDestination(value);
                  clearMissingField("request-destination");
                  clearError("location");
                }}
                options={[
                  { value: "", label: t("Choose location", "انتخاب محل") },
                  ...active
                    .filter((location) => location !== source)
                    .map((location) => ({
                      value: location,
                      label: branchLabel(state.config, location, lang),
                    })),
                ]}
              />
            </Field>
            <Field
              label={t("Deliver to", "تحویل به")}
              error={
                missingFor("request-source") ??
                (!active.includes(source) ? fieldError("location") : undefined)
              }
            >
              <Select
                id="request-source"
                value={source}
                onChange={(value) => {
                  setSource(value);
                  clearMissingField("request-source");
                  clearError("location");
                }}
                disabled={branch !== "all" || Boolean(editing)}
                options={[
                  { value: "", label: t("Choose location", "انتخاب محل") },
                  ...active
                    .filter((location) => allowed.includes(location))
                    .map((location) => ({
                      value: location,
                      label: branchLabel(state.config, location, lang),
                    })),
                ]}
              />
            </Field>
          </div>
          <div className="request-items-section">
            <h3>{t("Items", "موارد")}</h3>
            <div className="request-draft-lines">
              {lines.map((line, index) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === context?.company_id &&
                    item.code === line.product_code,
                );
                const change = (patch: Partial<DraftLine>) => {
                  if (
                    "quantity" in patch ||
                    "quantity_unit" in patch ||
                    "units_per_case" in patch
                  )
                    clearMissingField(`request-quantity-${line.key}`);
                  if ("units_per_case" in patch)
                    clearMissingField(`request-pack-${line.key}`);
                  if ("quantity" in patch || "quantity_unit" in patch)
                    clearError("quantity");
                  if ("units_per_case" in patch) clearError("pack", "quantity");
                  setLines(
                    lines.map((entry, i) =>
                      i === index ? { ...entry, ...patch } : entry,
                    ),
                  );
                };
                return (
                  <div className="request-draft-line" key={line.key}>
                    <div className="request-line-heading">
                      {product ? (
                        <span>
                          <ProductName product={product} />
                          <span className="helper">
                            <LtrText>{product.code}</LtrText> ·{" "}
                            <UnitSize value={product.unit_size} />
                          </span>
                        </span>
                      ) : (
                        <bdi dir="auto">{line.free_text}</bdi>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setLines(lines.filter((_, i) => i !== index))
                        }
                      >
                        {t("Remove", "حذف")}
                      </Button>
                    </div>
                    <div className="request-quantity-fields">
                      <Field
                        label={t("Quantity", "تعداد")}
                        error={
                          missingFor(`request-quantity-${line.key}`) ??
                          fieldError("quantity")
                        }
                      >
                        <NumberField
                          id={`request-quantity-${line.key}`}
                          value={line.quantity}
                          onChange={(quantity) => change({ quantity })}
                        />
                      </Field>
                      <Field label={t("Units / Cases", "واحد / کارتن")}>
                        <Select
                          value={line.quantity_unit}
                          onChange={(value) =>
                            change({
                              quantity_unit: value as "units" | "cases",
                            })
                          }
                          options={[
                            { value: "units", label: t("Units", "واحد") },
                            { value: "cases", label: t("Cases", "کارتن") },
                          ]}
                        />
                      </Field>
                      {line.quantity_unit === "cases" && (
                        <Field
                          label={t("Units per case", "تعداد در کارتن")}
                          error={
                            missingFor(`request-pack-${line.key}`) ??
                            fieldError("pack")
                          }
                          hint={
                            line.kind === "free_text"
                              ? t(
                                  "Leave blank if the pack is unknown.",
                                  "اگر تعداد در کارتن مشخص نیست، خالی بگذارید.",
                                )
                              : undefined
                          }
                        >
                          <NumberField
                            id={`request-pack-${line.key}`}
                            value={line.units_per_case ?? ""}
                            step={1}
                            onChange={(value) =>
                              change({
                                units_per_case: value
                                  ? Number(value)
                                  : undefined,
                              })
                            }
                          />
                        </Field>
                      )}
                    </div>
                    <Field label={t("Note (optional)", "یادداشت (اختیاری)")}>
                      <input
                        className="ui-input"
                        value={line.note ?? ""}
                        onChange={(event) =>
                          change({ note: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
            <Field
              label={t(
                "Add a product, or type an item that isn't in the catalog",
                "کالایی اضافه کنید یا نام موردی خارج از فهرست را بنویسید",
              )}
              error={missingFor("request-products") ?? fieldError("items")}
            >
              <input
                id="request-products"
                className="ui-input"
                placeholder={t(
                  "Add a product, or type an item that isn't in the catalog",
                  "کالایی اضافه کنید یا نام موردی خارج از فهرست را بنویسید",
                )}
                value={productSearch}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  clearMissingField("request-products");
                  clearError("items");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addFreeItem();
                  }
                }}
              />
            </Field>
            {productSearch.trim() && (
              <div className="request-search-results">
                {searchProducts(
                  state.products.filter(
                    (product) =>
                      product.company_id === context?.company_id &&
                      product.status !== "archived",
                  ),
                  productSearch,
                )
                  .slice(0, 8)
                  .map((product) => (
                    <div key={product.code}>
                      <span>
                        <ProductName product={product} />
                        <span className="helper">
                          <LtrText>{product.code}</LtrText> ·{" "}
                          <UnitSize value={product.unit_size} />
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="plain"
                        onClick={() => {
                          const packs = [
                            ...new Set(
                              (state.supplier_items ?? [])
                                .filter(
                                  (item) =>
                                    item.company_id === context?.company_id &&
                                    item.product_code === product.code &&
                                    !item.archived,
                                )
                                .map((item) => item.units_per_case),
                            ),
                          ];
                          clearError("items");
                          clearMissingField("request-products");
                          setLines([
                            ...lines,
                            {
                              key: createId("request-form-item"),
                              kind: "catalog",
                              product_code: product.code,
                              quantity: "1",
                              quantity_unit: "units",
                              units_per_case:
                                packs.length === 1 ? packs[0] : undefined,
                            },
                          ]);
                          setProductSearch("");
                        }}
                      >
                        {t("Add", "افزودن")}
                      </Button>
                    </div>
                  ))}
                <Button variant="plain" onClick={addFreeItem}>
                  {t("Add item", "افزودن مورد")}:{" "}
                  <bdi dir="auto">{productSearch.trim()}</bdi>
                </Button>
              </div>
            )}
          </div>
          <div className="dialog-actions request-form-actions">
            <Button variant="neutral" onClick={() => setFormOpen(false)}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button variant="neutral" onClick={() => save(false)}>
              {t("Save as draft", "ذخیره پیش‌نویس")}
            </Button>
            <Button onClick={() => save(true)}>
              {t("Send request", "ارسال درخواست")}
            </Button>
          </div>
        </Card>
      ) : request ? (
        <>
          <Button
            variant="plain"
            onClick={() => {
              openRequest(null);
              setMessage("");
            }}
          >
            <ArrowLeft size={16} />
            {t("Back to requests", "بازگشت به درخواست‌ها")}
          </Button>
          <Card className="request-detail" title={request.reference}>
            <div className="request-detail-heading">
              <Badge
                tone={
                  request.status === "requested" || request.status === "sent"
                    ? "info"
                    : request.status === "received" ||
                        request.status === "closed"
                      ? "approved"
                      : "neutral"
                }
              >
                {translatedStatus(request.status)}
              </Badge>
              <Button
                variant="tinted"
                onClick={async () => {
                  try {
                    const snapshot = await protectedQuery(
                      "branch_requests.read",
                      {
                        company_id: request.company_id,
                        kind: "request_endpoints",
                        location_ids: request.requested_at
                          ? [request.from_branch, request.to_branch]
                          : [request.from_branch],
                        entity_id: request.id,
                        location_policy: "retained_read",
                      },
                      (freshState, freshActor) => ({
                        request: pickingListSnapshot(
                          freshState,
                          freshActor,
                          request.id,
                        ),
                        config: structuredClone(freshState.config),
                      }),
                    );
                    printDocument(
                      <RequestPickingList
                        request={snapshot.request}
                        config={snapshot.config}
                        language={lang}
                      />,
                    );
                  } catch (failure) {
                    setError(
                      failure instanceof BranchRequestError
                        ? t(...errorText[failure.code])
                        : t("Could not print.", "چاپ نشد."),
                    );
                  }
                }}
              >
                <Printer size={16} />
                {t("Print picking list", "چاپ فهرست آماده‌سازی")}
              </Button>
            </div>
            <dl className="request-metadata">
              <div>
                <dt>{t("Requesting location", "محل درخواست‌کننده")}</dt>
                <dd>{branchLabel(state.config, request.from_branch, lang)}</dd>
              </div>
              <div>
                <dt>{t("Sending location", "محل ارسال‌کننده")}</dt>
                <dd>{branchLabel(state.config, request.to_branch, lang)}</dd>
              </div>
              <div>
                <dt>{t("Requested by", "درخواست‌کننده")}</dt>
                <dd>{request.requested_by ?? request.created_by}</dd>
              </div>
              <div>
                <dt>{t("Date", "تاریخ")}</dt>
                <dd>
                  <DateText
                    value={request.requested_at ?? request.created_at}
                  />
                </dd>
              </div>
            </dl>
            {request.source_request_id && (
              <p className="helper">
                {t("Copied from", "کپی از")}{" "}
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => openRequest(request.source_request_id!)}
                >
                  {readable.find(
                    (item) => item.id === request.source_request_id,
                  )?.reference ?? request.source_request_id}
                </Button>
              </p>
            )}
            {branch === "all" &&
              !["closed", "cancelled"].includes(request.status) && (
                <Field
                  label={t("Acting location", "محل انجام اقدام")}
                  error={fieldError("location")}
                  className="request-acting-location"
                >
                  <Select
                    value={actingLocation}
                    onChange={(value) => {
                      setActingLocation(value);
                      clearError("location");
                    }}
                    options={[
                      { value: "", label: t("Choose location", "انتخاب محل") },
                      ...[request.from_branch, request.to_branch]
                        .filter(
                          (location) =>
                            active.includes(location) &&
                            allowed.includes(location),
                        )
                        .map((location) => ({
                          value: location,
                          label: branchLabel(state.config, location, lang),
                        })),
                    ]}
                  />
                </Field>
              )}
            <WhatsMissing issues={missing} />
            <div className="request-checklist">
              {request.items.map((item) => {
                const sendSide = request.status === "requested" && targetAction;
                const receiveSide =
                  request.status === "sent" &&
                  sourceAction &&
                  new Decimal(item.sent_quantity ?? "0").gt(0);
                const current = decisions[item.id];
                const mark = (decision: string) =>
                  setDecisions({
                    ...decisions,
                    [item.id]: {
                      decision,
                      quantity:
                        decision === "sent"
                          ? item.quantity
                          : decision === "received"
                            ? item.sent_quantity!
                            : "0",
                    },
                  });
                return (
                  <div
                    className="request-checklist-item"
                    id={`request-decision-${item.id}`}
                    key={item.id}
                  >
                    {missingFor(`request-decision-${item.id}`) && (
                      <p className="form-error" role="alert">
                        {missingFor(`request-decision-${item.id}`)}
                      </p>
                    )}
                    <div className="request-checklist-heading">
                      <RequestItemName item={item} />
                      <strong>
                        <LtrText>{item.quantity}</LtrText> {quantityLabel(item)}
                      </strong>
                    </div>
                    {item.units_per_case && item.quantity_unit === "cases" && (
                      <p className="helper">
                        <LtrText>{item.units_per_case}</LtrText>{" "}
                        {t("Units per case", "تعداد در کارتن")} ·{" "}
                        <LtrText>{item.normalized_units}</LtrText>{" "}
                        {t("Units", "واحد")}
                      </p>
                    )}
                    {item.note && (
                      <p className="helper">
                        <bdi dir="auto">{item.note}</bdi>
                      </p>
                    )}
                    {item.sending_decision && (
                      <p className="helper">
                        {t("Sent", "ارسال‌شده")}:{" "}
                        <LtrText>{item.sent_quantity}</LtrText>{" "}
                        {quantityLabel(item)}
                        {new Decimal(item.short_quantity ?? "0").gt(0) && (
                          <>
                            {" "}
                            ·{" "}
                            <Badge tone="danger">
                              {t("Short", "کسری")}:{" "}
                              <LtrText>{item.short_quantity}</LtrText>
                            </Badge>
                          </>
                        )}
                      </p>
                    )}
                    {item.receiving_decision && (
                      <p className="helper">
                        {t("Received", "دریافت‌شده")}:{" "}
                        <LtrText>{item.received_quantity}</LtrText>{" "}
                        {quantityLabel(item)}
                        {new Decimal(item.missing_quantity ?? "0").gt(0) && (
                          <>
                            {" "}
                            ·{" "}
                            <Badge tone="danger">
                              {t("Missing", "نرسیده")}:{" "}
                              <LtrText>{item.missing_quantity}</LtrText>
                            </Badge>
                          </>
                        )}
                      </p>
                    )}
                    {(sendSide || receiveSide) && (
                      <div className="request-decisions">
                        <Checkbox
                          checked={
                            current?.decision ===
                            (sendSide ? "sent" : "received")
                          }
                          onChange={(checked) => {
                            clearError("decision", "quantity");
                            clearMissingField(`request-decision-${item.id}`);
                            if (checked) mark(sendSide ? "sent" : "received");
                            else {
                              const next = { ...decisions };
                              delete next[item.id];
                              setDecisions(next);
                            }
                          }}
                        >
                          {sendSide
                            ? t("Being sent", "در حال ارسال")
                            : t("Arrived", "رسیده")}
                        </Checkbox>
                        <Button
                          variant={
                            current?.decision ===
                            (sendSide ? "short" : "missing")
                              ? "tinted"
                              : "neutral"
                          }
                          size="sm"
                          onClick={() => {
                            clearError("decision", "quantity");
                            clearMissingField(`request-decision-${item.id}`);
                            mark(sendSide ? "short" : "missing");
                          }}
                        >
                          {sendSide
                            ? t("Short", "کسری")
                            : t("Missing", "نرسیده")}
                        </Button>
                        {current?.decision ===
                          (sendSide ? "short" : "missing") && (
                          <Field
                            label={
                              sendSide
                                ? t("Quantity being sent", "تعداد در حال ارسال")
                                : t("Quantity arrived", "تعداد رسیده")
                            }
                          >
                            <NumberField
                              value={current.quantity}
                              onChange={(quantity) => {
                                clearError("quantity", "decision");
                                clearMissingField(
                                  `request-decision-${item.id}`,
                                );
                                setDecisions({
                                  ...decisions,
                                  [item.id]: { ...current, quantity },
                                });
                              }}
                            />
                          </Field>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {request.cancellation_reason && (
              <p>
                <strong>{t("Cancellation reason", "دلیل لغو")}</strong>:{" "}
                <bdi dir="auto">{request.cancellation_reason}</bdi>
              </p>
            )}
            {request.sent_by && (
              <p className="helper">
                {t("Sent by", "ارسال‌کننده")}: {request.sent_by} ·{" "}
                <DateText value={request.sent_at} />
              </p>
            )}
            {request.received_by && (
              <p className="helper">
                {t("Received by", "دریافت‌کننده")}: {request.received_by} ·{" "}
                <DateText value={request.received_at} />
              </p>
            )}
            <div className="actions">
              {request.status === "draft" && sourceAction && (
                <>
                  <Button
                    onClick={() =>
                      run(
                        (draft, freshActor) => {
                          sendBranchRequest(
                            draft,
                            freshActor,
                            request.id,
                            request.revision,
                          );
                        },
                        t("Request sent.", "درخواست ارسال شد."),
                      )
                    }
                  >
                    {t("Send", "ارسال")}
                  </Button>
                  <Button variant="neutral" onClick={() => openDraft(request)}>
                    {t("Edit draft", "ویرایش پیش‌نویس")}
                  </Button>
                </>
              )}
              {request.status === "requested" && targetAction && (
                <Button
                  onClick={() =>
                    run(
                      (draft, freshActor) => {
                        markBranchRequestSent(
                          draft,
                          freshActor,
                          request.id,
                          decisionRevision ?? -1,
                          request.items.flatMap((item) =>
                            decisions[item.id]
                              ? [
                                  {
                                    item_id: item.id,
                                    decision: decisions[item.id].decision as
                                      "sent" | "short",
                                    sent_quantity: decisions[item.id].quantity,
                                  },
                                ]
                              : [],
                          ),
                        );
                      },
                      t(
                        "Request marked as sent.",
                        "درخواست به‌عنوان ارسال‌شده ثبت شد.",
                      ),
                      "send",
                    )
                  }
                >
                  {t("Mark as sent", "ثبت ارسال")}
                </Button>
              )}
              {request.status === "sent" && sourceAction && (
                <Button
                  onClick={() =>
                    run(
                      (draft, freshActor) => {
                        markBranchRequestReceived(
                          draft,
                          freshActor,
                          request.id,
                          decisionRevision ?? -1,
                          request.items
                            .filter((item) =>
                              new Decimal(item.sent_quantity ?? "0").gt(0),
                            )
                            .flatMap((item) =>
                              decisions[item.id]
                                ? [
                                    {
                                      item_id: item.id,
                                      decision: decisions[item.id].decision as
                                        "received" | "missing",
                                      received_quantity:
                                        decisions[item.id].quantity,
                                    },
                                  ]
                                : [],
                            ),
                        );
                      },
                      t(
                        "Request marked as received.",
                        "درخواست به‌عنوان دریافت‌شده ثبت شد.",
                      ),
                      "receive",
                    )
                  }
                >
                  {t("Mark as received", "ثبت دریافت")}
                </Button>
              )}
              {request.status === "received" && sourceAction && (
                <Button
                  onClick={() =>
                    run(
                      (draft, freshActor) => {
                        closeBranchRequest(
                          draft,
                          freshActor,
                          request.id,
                          request.revision,
                        );
                      },
                      t("Request closed.", "درخواست بسته شد."),
                    )
                  }
                >
                  {t("Close request", "بستن درخواست")}
                </Button>
              )}
              {sourceAction &&
                availableBranchRequestResidual(state, request).length > 0 && (
                  <Button
                    variant="neutral"
                    onClick={async () => {
                      let copied: BranchRequest | undefined;
                      const saved = await run(
                        (draft, freshActor) => {
                          copied = structuredClone(
                            copyBranchRequestResidual(
                              draft,
                              freshActor,
                              request.id,
                              request.revision,
                            ),
                          );
                        },
                        t(
                          "Short or missing items copied to a new draft.",
                          "موارد کسری یا نرسیده در پیش‌نویس جدید کپی شدند.",
                        ),
                      );
                      if (saved && copied) openRequest(copied.id);
                    }}
                  >
                    {t(
                      "Copy short or missing items",
                      "کپی موارد کسری یا نرسیده",
                    )}
                  </Button>
                )}
              {sourceAction &&
                ["draft", "requested"].includes(request.status) && (
                  <Button
                    variant="destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    {t("Cancel request", "لغو درخواست")}
                  </Button>
                )}
            </div>
            {cancelOpen && (
              <div className="request-cancel">
                <Field label={t("Reason", "دلیل")} error={fieldError("reason")}>
                  <input
                    className="ui-input"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      clearError("reason");
                    }}
                  />
                </Field>
                <Button
                  variant="destructive"
                  onClick={() =>
                    run(
                      (draft, freshActor) => {
                        cancelBranchRequest(
                          draft,
                          freshActor,
                          request.id,
                          request.revision,
                          reason,
                        );
                      },
                      t("Request cancelled.", "درخواست لغو شد."),
                    )
                  }
                >
                  {t("Confirm cancellation", "تأیید لغو")}
                </Button>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="requests-list-card">
          <FilterToolbar
            aria-label={t("Branch request filters", "فیلترهای درخواست شعب")}
            count={tCount(
              "{{count}} request",
              "{{count}} requests",
              "{{count}} درخواست",
              "{{count}} درخواست",
              listed.length,
            )}
            leading={
              <Tabs
                value={tab}
                onChange={setTab}
                options={[
                  {
                    value: "incoming",
                    label: t("Incoming", "ورودی"),
                    count: branchRequestView(state, context, {
                      tab: "incoming",
                      status: "open",
                    }).length,
                  },
                  {
                    value: "outgoing",
                    label: t("Outgoing", "خروجی"),
                    count: branchRequestView(state, context, {
                      tab: "outgoing",
                      status: "open",
                    }).length,
                  },
                ]}
              />
            }
            search={
              <input
                aria-label={t("Search requests", "جستجوی درخواست‌ها")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Search requests", "جستجوی درخواست‌ها")}
              />
            }
          >
            <Select
              aria-label={t("Status", "وضعیت")}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "open", label: t("Open", "باز") },
                { value: "all", label: t("All statuses", "همه وضعیت‌ها") },
                ...Object.keys(statusText).map((value) => ({
                  value,
                  label: translatedStatus(value as BranchRequestStatus),
                })),
              ]}
            />
            <Select
              aria-label={t("Location", "محل")}
              value={locationFilter}
              onChange={setLocationFilter}
              options={[
                { value: "", label: t("All locations", "همه محل‌ها") },
                ...configuredBranches(state.config, true).map((location) => ({
                  value: location,
                  label: branchLabel(state.config, location, lang),
                })),
              ]}
            />
            {(query ||
              statusFilter !== "open" ||
              locationFilter ||
              tab !== "outgoing") && (
              <Button
                variant="plain"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("open");
                  setLocationFilter("");
                  setTab("outgoing");
                }}
              >
                {t("Clear filters", "پاک کردن فیلترها")}
              </Button>
            )}
          </FilterToolbar>
          {listed.length ? (
            <DataTable
              className="requests-list-table"
              phoneList={{
                name: "request",
                value: "status",
                secondary: ["route", "date"],
              }}
              columns={[
                {
                  key: "request",
                  required: true,
                  width: 320,
                  minWidth: 240,
                  priority: 1,
                },
                { key: "route", width: 300, minWidth: 210, priority: 4 },
                { key: "status", width: 150, minWidth: 120, priority: 2 },
                { key: "date", width: 140, minWidth: 120, priority: 5 },
                {
                  key: "action",
                  actions: true,
                  width: 48,
                  minWidth: 48,
                  priority: 3,
                },
              ]}
            >
              <thead>
                <tr>
                  <th>{t("Request", "درخواست")}</th>
                  <th>{t("From → To", "از ← به")}</th>
                  <th>{t("Status", "وضعیت")}</th>
                  <th>{t("Date", "تاریخ")}</th>
                  <th aria-label={t("Open request", "باز کردن درخواست")} />
                </tr>
              </thead>
              <tbody>
                {listed.map((item) => (
                  <tr
                    key={item.id}
                    data-row-href={`#requests?id=${encodeURIComponent(item.id)}`}
                    className="clickable-row"
                    tabIndex={0}
                    onClick={(event) => {
                      if (
                        (event.target as HTMLElement).closest(
                          "button, a, input, select, textarea, [role='menuitem']",
                        )
                      )
                        return;
                      openRequest(item.id);
                      setError("");
                      setMessage("");
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        openRequest(item.id);
                        setError("");
                        setMessage("");
                      }
                    }}
                  >
                    <td>
                      <strong>
                        <LtrText>{item.reference}</LtrText>
                      </strong>
                      <span className="helper">
                        {tCount(
                          "{{count}} item",
                          "{{count}} items",
                          "{{count}} مورد",
                          "{{count}} مورد",
                          item.items.length,
                        )}
                        {item.items[0] && (
                          <>
                            {" "}
                            ·{" "}
                            <bdi dir="auto">
                              {item.items[0].kind === "free_text"
                                ? item.items[0].free_text
                                : lang === "fa"
                                  ? item.items[0].name_fa ||
                                    item.items[0].name_en
                                  : item.items[0].name_en}
                            </bdi>
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <bdi dir="auto">
                        {branchLabel(state.config, item.from_branch, lang)}
                      </bdi>
                      <span className="request-route-arrow" aria-hidden="true">
                        {" "}
                        →{" "}
                      </span>
                      <bdi dir="auto">
                        {branchLabel(state.config, item.to_branch, lang)}
                      </bdi>
                    </td>
                    <td>
                      <Badge
                        tone={
                          item.status === "requested" || item.status === "sent"
                            ? "info"
                            : item.status === "received" ||
                                item.status === "closed"
                              ? "approved"
                              : "neutral"
                        }
                      >
                        {translatedStatus(item.status)}
                      </Badge>
                      {item.items.some(
                        (line) =>
                          new Decimal(line.short_quantity ?? "0").gt(0) ||
                          new Decimal(line.missing_quantity ?? "0").gt(0),
                      ) && (
                        <span className="helper">
                          {t("Short or missing items", "موارد کسری یا نرسیده")}
                        </span>
                      )}
                    </td>
                    <td>
                      <DateText value={item.created_at} />
                    </td>
                    <td className="table-actions">
                      <TableRowLink
                        aria-label={item.reference}
                        href={`#requests?id=${encodeURIComponent(item.id)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openRequest(item.id);
                          setError("");
                          setMessage("");
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState>
              {t("No requests", "درخواستی وجود ندارد")}.{" "}
              {t(
                "Requests for this location appear here.",
                "درخواست‌های این محل اینجا نمایش داده می‌شوند.",
              )}
            </EmptyState>
          )}
        </Card>
      )}
      {printOutput}
    </div>
  );
}
