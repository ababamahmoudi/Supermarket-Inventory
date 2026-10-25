import Decimal from "decimal.js";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ReadingField as Field, ReadingMoney } from "../InvoiceReadingReview";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import type { AuthenticatedActor } from "../authority-types";
import {
  companyCalendarDate,
  companyDateTime,
  CompanyLocalTimeError,
  companyLocalToUtc,
} from "../company-time";
import { configSeed, demoSeed as demo } from "../config";
import { INCLUDED_COST_INVOICE_SHA256 } from "../file-database";
import {
  acceptedInvoiceUnits,
  addManualLine,
  companyDate,
  createInvoice,
  dateAfter,
  demoSaleCostInvoice,
  initializeInvoiceManualPriceDecisions,
  lineShort,
  markInvoiceSupplierReview,
  postInvoice,
  recalculateInvoice,
  receiveShort,
  refusedTotals,
  setInvoiceLineQuantity as setEachInvoiceLineQuantity,
  shortTotals,
} from "../invoice";
import {
  requireInvoiceAuthority,
  canInvoiceAuthority,
  type InvoiceCapability,
} from "../invoice-authority";
import {
  acknowledgeInvoiceCheck,
  normalizeInvoiceReceivingReview,
} from "../invoice-checks";
import { attachPostedInvoiceOriginal } from "../invoice-corrections";
import type { InvoiceEditableLine } from "../invoice-edit-types";
import { setInvoicePaymentTerms } from "../invoice-entry";
import {
  consumeInvoiceUpload,
  storeInvoiceUpload,
} from "../invoice-file-access";
import { clearInvoiceOrderLine } from "../invoice-orders";
import type { InvoiceReadDTO } from "../invoice-projections";
import { setInvoiceWeightQuantity } from "../invoice-weight";
import {
  applyReviewedInvoiceMove,
  invoiceMoveRead,
  invoiceWorkspaceRead,
  selectInvoiceWorkspace,
  type InvoiceWorkspaceRead,
} from "../invoice-workspace-read";
import { useListState, useRouteParam } from "../navigation";
import { DateText, LtrText } from "../presentation";
import { effectiveInvoiceLocation } from "../received";
import {
  configuredBranches,
  branchLabel as configuredBranchLabel,
} from "../settings";
import { sha256Bytes } from "../sha256";
import { useDemo } from "../store";
import { supplierMatches, supplierRecords } from "../supplier-editor";
import type { DemoState, SupplierRecord } from "../types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DateField,
  Dialog,
  DialogActions,
  Dropzone,
  EmptyState,
  NumberField,
  PageHeader,
  Select,
  TableRowLink,
  Tabs,
  useTableColumns,
} from "../ui";
import { useProtectedQuery } from "../use-protected-query";
import {
  validateWeightQuantity,
  weightQuantityFromLb,
  weightQuantityPerLb,
} from "../weighed";
import { ProductEditor } from "./Catalog";
import { InvoiceCorrectionDialog } from "./InvoiceCorrectionDialog";
import { InvoiceOrderReview } from "./InvoiceOrderReview";
import { OriginalInvoice } from "./OriginalInvoice";
import { PostedInvoice } from "./PostedInvoice";
import { SupplierEditor } from "./SupplierEditor";
import "./c5-catalog-offers.css";
import "./invoice-a2.css";
import "./invoice-c3.css";
import "./invoice-entry-c6.css";
import { InvoiceQueueTable } from "./InvoiceQueueTable";
import { InvoiceReviewPage } from "./invoice-review/InvoiceReviewPage";
import { ReviewHeader } from "./invoice-review/ReviewHeader";
import { OriginalViewer } from "./invoice-review/OriginalViewer";
import "./invoice-settings-labels.css";
import "./invoices-c7.css";
import "./manual-entry.css";
import "./received-c.css";

type InvoiceTab =
  | "drafts"
  | "processing"
  | "needs_review"
  | "ready_to_post"
  | "posted"
  | "cancelled";
/** Keep the previous workspace as a resumable record before opening another. */
function retainInvoiceWorkspace(draft: DemoState) {
  if (
    (draft.invoice.status === "empty" && !draft.invoice.file_data) ||
    draft.invoice.company_id !== draft.config.company.seed_key
  )
    return;
  draft.invoices ??= [];
  const index = draft.invoices.findIndex(
    (item) =>
      item.company_id === draft.invoice.company_id &&
      item.id === draft.invoice.id,
  );
  const saved = structuredClone(draft.invoice);
  if (index >= 0) draft.invoices[index] = saved;
  else draft.invoices.push(saved);
}

export default function Invoices() {
  const { state, actor, can, command, navigate, t, authorityGeneration } =
    useDemo();
  const routeId = useRouteParam("id"),
    routeVersion = useRouteParam("version");
  const [entryPending, setEntryPending] = useState<{
    targetId: string | null;
  } | null>(null);
  const entryPendingRef = useRef(false);
  useLayoutEffect(() => {
    entryPendingRef.current = entryPending !== null;
  }, [entryPending]);
  const startEntry = useCallback(
    async (operation: () => Promise<string | null>) => {
      if (entryPendingRef.current) return;
      entryPendingRef.current = true;
      setEntryPending({ targetId: null });
      try {
        const targetId = await operation();
        if (targetId) setEntryPending({ targetId });
        else {
          entryPendingRef.current = false;
          setEntryPending(null);
        }
      } catch (error) {
        entryPendingRef.current = false;
        setEntryPending(null);
        throw error;
      }
    },
    [],
  );
  const [entryChoiceOpen, setEntryChoiceOpen] = useState(false);
  const id = routeId ?? state.invoice?.id;
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
    entity_id: id,
  };
  useEffect(() => {
    if (entryPending || !routeId || !actor || state.invoice?.id === routeId)
      return;
    // The protected read below renders the same canonical denial without retaining a prior workspace.
    void command(
      "invoices.read",
      {
        company_id: state.config.company.seed_key,
        kind: "company_shared",
        entity_id: routeId,
      },
      (draft, currentActor) =>
        selectInvoiceWorkspace(draft, currentActor, routeId),
    ).catch(() => undefined);
  }, [
    entryPending,
    routeId,
    state.invoice?.id,
    state.config.company.seed_key,
    actor,
    command,
  ]);
  const read = useProtectedQuery(
    id && routeVersion ? "invoices.cost_read" : null,
    scope,
    (canonical, currentActor) =>
      invoiceWorkspaceRead(canonical, currentActor, id, routeVersion),
    `${id ?? ""}:${routeVersion ?? ""}`,
  );
  const projected =
    state.invoice_workspace?.invoice.id === id ? state.invoice_workspace : null;
  const workspace = routeVersion ? read.data : projected;
  // Clear only when the accepted route and both current projections agree.
  // This render-time adjustment does not retain an obsolete protected DTO.
  if (
    entryPending?.targetId &&
    routeId === entryPending.targetId &&
    state.invoice?.id === entryPending.targetId &&
    workspace?.invoice.id === entryPending.targetId
  )
    setEntryPending(null);
  const startFallback = async (manual: boolean) => {
    if (!actor || actor.selection.kind !== "location") return;
    const location = actor.selection.location_id;
    await startEntry(async () => {
      const newId = await command(
        manual ? "invoices.enter_manual" : "invoices.enter",
        {
          company_id: actor.company_id,
          kind: "location_record",
          location_ids: [location],
          mutation: true,
          location_policy: "active_only",
        },
        (draft, currentActor) => {
          retainInvoiceWorkspace(draft);
          draft.invoice = createInvoice(draft, currentActor, location, manual);
          draft.invoice.receiving_employee = currentActor.actor;
          return draft.invoice.id;
        },
      );
      navigate(`invoices?id=${encodeURIComponent(newId)}`);
      return newId;
    });
  };
  if (!actor || !can("invoices.read", scope))
    return (
      <EmptyState>
        {t(
          "Sign in as a Floor Worker, Branch Supervisor, Owner or Manager to receive invoices.",
          "برای دریافت فاکتور به عنوان کارمند فروشگاه، سرپرست شعبه، مالک یا مدیر وارد شوید.",
        )}
      </EmptyState>
    );
  if (!workspace)
    return (
      <>
        <PageHeader
          title={t("Invoices", "فاکتورها")}
          actions={
            <Button
              disabled={
                entryPending !== null ||
                actor.selection.kind !== "location" ||
                !can("invoices.enter", scope)
              }
              onClick={() => setEntryChoiceOpen(true)}
            >
              {t("New invoice", "فاکتور جدید")}
            </Button>
          }
        />
        <InvoiceEntryChoices
          open={entryChoiceOpen}
          onClose={() => setEntryChoiceOpen(false)}
          onSelect={startFallback}
          disabled={entryPending !== null}
        />
        {!read.pending && (
          <InvoicePickerList
            onNew={(manual) => void startFallback(manual)}
            pending={entryPending !== null}
            chooserOpen={entryChoiceOpen}
          />
        )}
      </>
    );
  return (
    <div aria-busy={entryPending !== null} inert={entryPending !== null}>
      <InvoiceWorkspace
        key={`${actor.session_id}:${actor.authority_epoch}:${authorityGeneration}:${workspace.invoice.id}`}
        workspace={workspace}
        startEntry={startEntry}
        entryPending={entryPending !== null}
      />
    </div>
  );
}
function InvoiceEntryChoices({
  open,
  onClose,
  onSelect,
  disabled,
}: {
  open: boolean;
  onClose(): void;
  onSelect(manual: boolean): void;
  disabled: boolean;
}) {
  const { t, can } = useDemo();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={t("New invoice", "فاکتور جدید")}
      description={t(
        "Upload an original or enter the invoice yourself.",
        "اصل فاکتور را بارگذاری کنید یا اطلاعات آن را وارد کنید.",
      )}
    >
      <div className="actions">
        <Button
          disabled={disabled}
          onClick={() => {
            onClose();
            onSelect(false);
          }}
        >
          {t("Upload", "بارگذاری")}
        </Button>
        {can("invoices.enter_manual") && (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              onClose();
              onSelect(true);
            }}
          >
            {t("Manual entry", "ورود دستی")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
/** Invoices the person may open when no invoice workspace is selected yet. */
function InvoicePickerList({
  onNew,
  pending,
  chooserOpen,
}: {
  onNew(manual: boolean): void;
  pending: boolean;
  chooserOpen: boolean;
}) {
  const { state, branch, setBranch, can, t } = useDemo();
  const [selected, setSelected] = useState<InvoiceTab | null>(null);
  const classification = useProtectedQuery(
    "invoices.read",
    { company_id: state.config.company.seed_key, kind: "company_shared" },
    (canonical, actor) => {
      const candidate = [canonical.invoice, ...(canonical.invoices ?? [])].find(
        (invoice) =>
          canInvoiceAuthority(
            canonical,
            actor,
            "invoices.cost_read",
            invoice.id,
          ),
      );
      return candidate
        ? invoiceWorkspaceRead(canonical, actor, candidate.id).blockersById
        : {};
    },
    "invoice-picker-classification",
  );
  const all = state.invoices ?? [];
  const located = (invoice: InvoiceReadDTO) =>
    branch === "all" ||
    effectiveInvoiceLocation(state, invoice) === branch ||
    (invoice.status !== "posted" &&
      invoice.reviewer_origin_location_id === branch);
  const stage = (invoice: InvoiceReadDTO): InvoiceTab | null => {
    if (invoice.status === "posted") return "posted";
    if (invoice.status === "reading") return "processing";
    if (
      invoice.status === "draft" ||
      (invoice.status === "empty" && invoice.original_available)
    )
      return "drafts";
    if (invoice.status !== "review") return null;
    return classification.data?.[invoice.id]?.length === 0
      ? "ready_to_post"
      : "needs_review";
  };
  const count = (tab: InvoiceTab) =>
    all.filter((invoice) => located(invoice) && stage(invoice) === tab).length;
  const tab =
    selected ??
    (["needs_review", "ready_to_post", "drafts", "processing"] as const).find(
      (value) => count(value),
    ) ??
    "posted";
  const invoices = all.filter(
    (invoice) => located(invoice) && stage(invoice) === tab,
  );
  const elsewhere =
    branch === "all"
      ? 0
      : all.filter(
          (invoice) => !located(invoice) && stage(invoice) === "needs_review",
        ).length;
  return (
    <>
      <Tabs
        showZeroCounts
        aria-label={t("Invoice views", "نمای فاکتورها")}
        value={tab}
        onChange={(value) => setSelected(value as InvoiceTab)}
        options={[
          {
            value: "drafts",
            count: count("drafts"),
            label: t("Drafts", "پیش‌نویس‌ها"),
          },
          {
            value: "processing",
            count: count("processing"),
            label: t("Processing", "در حال پردازش"),
          },
          {
            value: "needs_review",
            count: count("needs_review"),
            label: t("Needs review", "نیازمند بررسی"),
          },
          {
            value: "ready_to_post",
            count: count("ready_to_post"),
            label: t("Ready to post", "آماده ثبت"),
          },
          {
            value: "posted",
            count: count("posted"),
            label: t("Posted", "ثبت‌شده"),
          },
          { value: "cancelled", count: 0, label: t("Cancelled", "لغوشده") },
        ]}
      />
      <Card className="invoice-picker">
        <h2>{t("Invoices in your locations", "فاکتورهای مکان‌های شما")}</h2>
        {invoices.length ? (
          <InvoiceQueueTable invoices={invoices} />
        ) : (
          <EmptyState>
            {t(
              "No invoices in this view. Start a new invoice.",
              "در این نما فاکتوری نیست. فاکتور جدید شروع کنید.",
            )}
          </EmptyState>
        )}
        {elsewhere > 0 && (
          <p className="muted">
            {t(
              `${elsewhere} more need review at other locations.`,
              `${elsewhere} فاکتور دیگر در مکان‌های دیگر نیاز به بررسی دارند.`,
            )}{" "}
            <Button variant="plain" onClick={() => void setBranch("all")}>
              {t("Show all locations", "نمایش همه مکان‌ها")}
            </Button>
          </p>
        )}
      </Card>
      {tab === "drafts" && (
        <Card title={t("New invoice", "فاکتور جدید")}>
          <div
            className="actions"
            hidden={chooserOpen}
            inert={chooserOpen || undefined}
          >
            <Button disabled={pending} onClick={() => onNew(false)}>
              {t("Upload", "بارگذاری")}
            </Button>
            {can("invoices.enter_manual") && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => onNew(true)}
              >
                {t("Manual entry", "ورود دستی")}
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
function InvoiceWorkspace({
  workspace,
  startEntry,
  entryPending,
}: {
  workspace: InvoiceWorkspaceRead;
  startEntry: (operation: () => Promise<string | null>) => Promise<void>;
  entryPending: boolean;
}) {
  const {
    state,
    actor,
    command,
    query,
    can,
    branch,
    setBranch,
    lang,
    t,
    money,
    user,
    navigate,
  } = useDemo();
  const routeId = useRouteParam("id");
  const supplierFilter = useRouteParam("supplier");
  const fromFilter = useRouteParam("from");
  const toFilter = useRouteParam("to");
  const tabFilter = useRouteParam("tab");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [entryChoiceOpen, setEntryChoiceOpen] = useState(false);
  const originalInput = useRef<HTMLInputElement>(null);
  const postedColumns = useTableColumns("invoices", [
    {
      key: "invoice",
      label: t("Invoice", "فاکتور"),
      required: true,
      width: "18%",
      priority: 1,
      minWidth: 160,
      mobilePrimary: true,
    },
    {
      key: "supplier",
      label: t("Supplier", "تأمین‌کننده"),
      width: "30%",
      priority: 3,
      minWidth: 240,
    },
    {
      key: "branch",
      label: t("Branch", "شعبه"),
      width: "20%",
      priority: 5,
      minWidth: 130,
    },
    {
      key: "date",
      label: t("Date", "تاریخ"),
      width: "17%",
      priority: 4,
      minWidth: 122,
    },
    {
      key: "status",
      label: t("Status", "وضعیت"),
      width: "15%",
      priority: 2,
      minWidth: 110,
    },
    {
      key: "actions",
      label: t("Action", "عملیات"),
      width: 60,
      actions: true,
      priority: 0,
      required: true,
      align: "end",
    },
  ]);
  const branches = configuredBranches(state.config);
  const invoiceLocation = workspace.invoice.branch;
  const [supplierEditorOpen, setSupplierEditorOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<SupplierRecord>();
  const [attemptedPost, setAttemptedPost] = useState(false);
  const [receivedEdit, setReceivedEdit] = useState<{
    invoiceId: string;
    date: string;
    time: string;
  }>();
  const [, setReceivedError] = useState<CompanyLocalTimeError["code"]>();
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const invoice = workspace.invoice;
  const scope = {
    company_id: invoice.company_id,
    kind: "company_shared" as const,
    entity_id: invoice.id,
  };
  const [message, setMessage] = useState("");
  const readingEdit = useRef<{ field: string; lineIndex?: number } | null>(
    null,
  );
  const updateInvoice = useCallback(
    async <T,>(
      mutator: (draft: DemoState, currentActor: AuthenticatedActor) => T,
      capability: InvoiceCapability | "suppliers.confirm" = "invoices.edit",
      targetId = invoice.id,
    ): Promise<T | undefined> => {
      const editedCheck = readingEdit.current;
      try {
        return await command(
          capability,
          {
            company_id: invoice.company_id,
            kind: "company_shared",
            entity_id: targetId,
          },
          (draft, currentActor) => {
            if (draft.invoice.id !== targetId)
              selectInvoiceWorkspace(draft, currentActor, targetId);
            requireInvoiceAuthority(
              draft,
              currentActor,
              capability === "suppliers.confirm" ? "invoices.read" : capability,
              targetId,
              capability !== "suppliers.confirm",
            );
            const result = mutator(draft, currentActor);
            if (editedCheck && capability === "invoices.edit")
              acknowledgeInvoiceCheck(
                draft,
                currentActor,
                editedCheck.field,
                editedCheck.lineIndex,
              );
            if (draft.invoice.status !== "posted") {
              if (capability === "invoices.edit")
                initializeInvoiceManualPriceDecisions(draft, currentActor);
              normalizeInvoiceReceivingReview(draft.invoice);
            }
            return result;
          },
        );
      } catch (cause) {
        setMessage(
          cause instanceof Error
            ? cause.message
            : t("The invoice changed.", "فاکتور تغییر کرد."),
        );
        return undefined;
      }
    },
    [command, invoice.id, invoice.company_id, t, setMessage],
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moveAttempted, setMoveAttempted] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadPending, setUploadPending] = useState(false);
  const [deliveryQuantities, setDeliveryQuantities] = useState<
    Record<string, number>
  >({});
  const [deliveryRefs, setDeliveryRefs] = useState<Record<string, string>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<
    Record<string, { quantity?: string; reference?: string }>
  >({});
  const blockers = workspace.blockers;
  const currentTab: InvoiceTab =
    invoice.status === "reading"
      ? "processing"
      : invoice.status === "posted"
        ? "posted"
        : invoice.status === "review"
          ? blockers.length
            ? "needs_review"
            : "ready_to_post"
          : "drafts";
  const [selectedView, setSelectedView] = useListState<{
    invoiceId: string;
    stage: InvoiceTab;
    tab: InvoiceTab;
    postedDetail: boolean;
  } | null>("invoices.tab", null);
  const validSelection =
    selectedView?.invoiceId === invoice.id && selectedView.stage === currentTab;
  const allInvoiceRecords = [
    ...new Map(
      [...(state.invoices ?? []), invoice]
        .filter((item) => item.company_id === state.config.company.seed_key)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const atCurrentLocations = (item: InvoiceReadDTO) =>
    branch === "all" ||
    effectiveInvoiceLocation(state, item) === branch ||
    (item.status !== "posted" && item.reviewer_origin_location_id === branch);
  const stageOf = (item: InvoiceReadDTO): InvoiceTab | null => {
    if (item.status === "posted") return "posted";
    if (item.status === "reading") return "processing";
    if (
      item.status === "draft" ||
      (item.status === "empty" && item.original_available)
    )
      return "drafts";
    if (item.status !== "review") return null;
    const checks = workspace.blockersById[item.id];
    return !checks || checks.length ? "needs_review" : "ready_to_post";
  };
  const tabCount = (value: InvoiceTab) =>
    allInvoiceRecords.filter(
      (item) => atCurrentLocations(item) && stageOf(item) === value,
    ).length;
  const firstWorkTab =
    (["needs_review", "ready_to_post", "drafts", "processing"] as const).find(
      (value) => tabCount(value) > 0,
    ) ?? "posted";
  const [savedListTab, setListTab] = useListState<InvoiceTab | null>(
    "invoices.r2-list-tab",
    null,
  );
  const listTab = savedListTab ?? firstWorkTab;
  const routeTab =
    !routeId &&
    [
      "drafts",
      "processing",
      "needs_review",
      "ready_to_post",
      "posted",
      "cancelled",
    ].includes(tabFilter ?? "")
      ? (tabFilter as InvoiceTab)
      : null;
  const tab = routeId
    ? validSelection
      ? selectedView.tab
      : currentTab
    : (routeTab ?? listTab);
  const showPostedDetail = routeId === invoice.id;

  function chooseTab(nextTab: InvoiceTab, postedDetail = false) {
    setListTab(nextTab);
    setSelectedView({
      invoiceId: invoice.id,
      stage: currentTab,
      tab: nextTab,
      postedDetail,
    });
    if (!postedDetail && routeId) navigate("invoices");
    else if (!postedDetail && tabFilter) {
      const parameters = new URLSearchParams(
        window.location.hash.split("?")[1] ?? "",
      );
      parameters.delete("tab");
      navigate(`invoices${parameters.size ? `?${parameters}` : ""}`);
    }
  }
  const totals = shortTotals(invoice);
  const refused = refusedTotals(invoice);
  const payable = /^[0-9]+(?:\.[0-9]{1,2})?$/.test(invoice.final_total)
    ? new Decimal(invoice.final_total)
        .minus(totals.total)
        .minus(refused.total)
        .toFixed(2)
    : "0.00";
  const lowerLines = workspace.lowerLineIndexes.map((index) => ({
    line: invoice.lines[index],
    index,
  }));
  const locked = invoice.status === "posted";
  const displayedVersion = workspace.displayedVersion;
  const active = invoice.status !== "empty";
  const moveRead = useProtectedQuery(
    moveOpen && moveTarget ? "invoices.relocate" : null,
    scope,
    (canonical, currentActor) =>
      invoiceMoveRead(canonical, currentActor, invoice.id, moveTarget),
    `${invoice.id}:${moveTarget}`,
  );
  const movePreview = moveRead.data;
  const moveIssues: ValidationIssue[] = moveAttempted
    ? [
        ...(!movePreview
          ? [
              {
                id: "invoice-move-location-missing",
                fieldId: "invoice-move-target",
                message: t(
                  "Choose a different allowed location.",
                  "مکان مجاز دیگری انتخاب کنید.",
                ),
              },
            ]
          : []),
        ...(!moveReason.trim()
          ? [
              {
                id: "invoice-move-reason-missing",
                fieldId: "invoice-move-reason",
                message: t(
                  "Enter a reason for moving the invoice.",
                  "دلیل انتقال فاکتور را وارد کنید.",
                ),
              },
            ]
          : []),
      ]
    : [];
  const receivedLocal =
    receivedEdit?.invoiceId === invoice.id
      ? receivedEdit
      : companyDateTime(state.config, invoice.received_at);
  function editReceived(date: string, time: string) {
    setReceivedEdit({ invoiceId: invoice.id, date, time });
    try {
      const instant = companyLocalToUtc(
        state.config,
        date,
        time,
        invoice.received_at,
      );
      setReceivedError(undefined);
      updateInvoice((draft, actor) => {
        draft.invoice.received_at = instant;
        acknowledgeInvoiceCheck(draft, actor, "received_at");
      });
    } catch (cause) {
      setReceivedError(
        cause instanceof CompanyLocalTimeError ? cause.code : "time",
      );
      updateInvoice((draft) => {
        draft.invoice.received_at = "";
      });
    }
  }
  // Refreshing a processing draft resumes the honest simulated reading state.
  useEffect(() => {
    if (invoice.status !== "reading") return;
    const id = invoice.id;
    const timer = window.setTimeout(
      () =>
        updateInvoice((draft) => {
          if (draft.invoice.id === id && draft.invoice.status === "reading")
            draft.invoice.status = "review";
        }),
      2500,
    );
    return () => window.clearTimeout(timer);
  }, [invoice.id, invoice.status, updateInvoice]);

  useEffect(() => {
    const applyDemoAnswer = () => {
      if (!active || locked || !lowerLines.length) return;
      updateInvoice((draft) => {
        const today = companyDate(draft.config);
        draft.invoice.lower_price_answers = {
          same_expiry: "no",
          old_expiry: dateAfter(
            today,
            demo.same_supplier_lower_price_alert.example_answer
              .old_expiry_relative_days,
          ),
          new_expiry: dateAfter(
            today,
            demo.same_supplier_lower_price_alert.example_answer
              .new_expiry_relative_days,
          ),
          units_left:
            demo.same_supplier_lower_price_alert.example_answer
              .units_left_at_old_cost,
        };
      });
    };
    window.addEventListener("arzon:demo-invoice-answer", applyDemoAnswer);
    return () =>
      window.removeEventListener("arzon:demo-invoice-answer", applyDemoAnswer);
  }, [active, locked, lowerLines.length, updateInvoice]);

  async function start(manual = false) {
    if (!actor || actor.selection.kind !== "location") return;
    const location = actor.selection.location_id;
    try {
      await startEntry(async () => {
        const id = await command(
          manual ? "invoices.enter_manual" : "invoices.enter",
          {
            company_id: actor.company_id,
            kind: "location_record",
            location_ids: [location],
            mutation: true,
            location_policy: "active_only",
          },
          (draft, currentActor) => {
            retainInvoiceWorkspace(draft);
            draft.invoice = createInvoice(
              draft,
              currentActor,
              location,
              manual,
            );
            draft.invoice.receiving_employee = currentActor.actor;
            initializeInvoiceManualPriceDecisions(draft, currentActor);
            return draft.invoice.id;
          },
        );
        setSelectedView(null);
        navigate(`invoices?id=${encodeURIComponent(id)}`);

        setMessage("");
        setUploadError("");

        setAttemptedPost(false);
        setReceivedEdit(undefined);
        setReceivedError(undefined);
        return id;
      });
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : t("The invoice changed.", "فاکتور تغییر کرد."),
      );
    }
  }

  async function attachFile(file: File, fromList = false) {
    let targetInvoiceId = invoice.id;
    setUploadPending(true);
    try {
      await startEntry(async () => {
        const includedSvg =
          file.type === "image/svg+xml" &&
          sha256Bytes(new Uint8Array(await file.arrayBuffer())) ===
            INCLUDED_COST_INVOICE_SHA256;
        if (
          !includedSvg &&
          !/^image\/(png|jpeg|webp|gif)$/.test(file.type) &&
          file.type !== "application/pdf"
        ) {
          setUploadError(
            t(
              "Choose a PDF, PNG, JPEG, WebP, or GIF file.",
              "فایل PDF، PNG، JPEG، WebP یا GIF انتخاب کنید.",
            ),
          );
          return null;
        }
        if (fromList) {
          if (!actor || actor.selection.kind !== "location") {
            setUploadError(
              t(
                "Choose one receiving location before uploading.",
                "پیش از بارگذاری یک مکان دریافت انتخاب کنید.",
              ),
            );
            return null;
          }
          const location = actor.selection.location_id;
          targetInvoiceId = await command(
            "invoices.enter",
            {
              company_id: actor.company_id,
              kind: "location_record",
              location_ids: [location],
              mutation: true,
              location_policy: "active_only",
            },
            (draft, currentActor) => {
              retainInvoiceWorkspace(draft);
              draft.invoice = createInvoice(draft, currentActor, location);
              draft.invoice.receiving_employee = currentActor.actor;
              return draft.invoice.id;
            },
          );
        }
        const retained = await storeInvoiceUpload(query, file, {
          company_id: invoice.company_id,
          invoice_id: targetInvoiceId,
        });
        const attachedId = await updateInvoice(
          (draft, currentActor) => {
            const stored = consumeInvoiceUpload(draft, currentActor, retained);
            const data = stored.file_data;
            const existing = draft.invoice;
            if (existing.id !== targetInvoiceId)
              throw new Error(
                "The invoice changed while the original was saving.",
              );
            if (existing.status === "posted") {
              attachPostedInvoiceOriginal(
                draft,
                currentActor,
                existing.id,
                stored,
              );
              return existing.id;
            }
            const recognizedOriginal =
              data.endsWith(`:${INCLUDED_COST_INVOICE_SHA256}`) &&
              draft.config.company.seed_key === configSeed.company.seed_key;
            let next = existing;
            if (recognizedOriginal && existing.entry_mode !== "manual") {
              const retainedInvoice = [
                draft.invoice,
                ...(draft.invoices ?? []),
              ].find(
                (item) =>
                  item.company_id === draft.config.company.seed_key &&
                  item.id === demo.sales_demo.cost_increase_invoice.id,
              );
              if (retainedInvoice) {
                requireInvoiceAuthority(
                  draft,
                  currentActor,
                  "invoices.cost_read",
                  retainedInvoice.id,
                );
                if (retainedInvoice.id !== existing.id)
                  retainInvoiceWorkspace(draft);
                next = structuredClone(retainedInvoice);
                if (next.status === "posted") {
                  draft.invoice = next;
                  return next.id;
                }
              } else {
                retainInvoiceWorkspace(draft);
                next = demoSaleCostInvoice(
                  draft,
                  currentActor,
                  existing.branch,
                );
                next.receiving_employee = user?.name;
              }
            } else if (existing.status === "empty") {
              retainInvoiceWorkspace(draft);
              next = createInvoice(draft, currentActor, existing.branch);
            }
            if (existing.status === "empty")
              next.receiving_employee = user?.name;
            next.file_name = file.name;
            next.file_type = file.type;
            next.file_data = data;
            next.file_size = stored.file_size;
            // Existing manual entries stay intact when their original is attached.
            next.status =
              next.entry_mode === "manual"
                ? "review"
                : next.lines.length
                  ? "reading"
                  : "draft";
            draft.invoice = next;
            return next.id;
          },
          !fromList && invoice.status === "posted"
            ? "invoices.attach_posted_original"
            : "invoices.edit",
          targetInvoiceId,
        );
        if (!attachedId) return null;
        setUploadError("");
        setMessage("");
        setSelectedView(null);

        // The retained original and its review have a distinct browser-history entry.
        if (attachedId)
          navigate(`invoices?id=${encodeURIComponent(attachedId)}`);
        return attachedId ?? null;
      });
    } catch {
      setUploadError(
        t(
          "The original could not be saved. Allow browser storage and try again.",
          "اصل فایل ذخیره نشد. ذخیره‌سازی مرورگر را فعال کنید و دوباره تلاش کنید.",
        ),
      );
    } finally {
      setUploadPending(false);
    }
  }

  function setInvoiceLineQuantity(
    line: InvoiceEditableLine,
    value: string | number,
    unit: NonNullable<InvoiceEditableLine["quantity_unit"]>,
    pack?: number,
  ) {
    if (
      unit === "kg" ||
      unit === "lb" ||
      (line.sold_by === "weight" && unit === "cases")
    )
      setInvoiceWeightQuantity(line, value, unit, state.config);
    else {
      line.sold_by = "each";
      setEachInvoiceLineQuantity(
        line,
        value,
        unit === "cases" ? "cases" : "units",
        pack,
      );
    }
  }

  function editLine(
    index: number,
    change: (
      line: InvoiceEditableLine,
      draft: DemoState,
      currentActor: AuthenticatedActor,
    ) => void,
    recalculate = false,
  ) {
    updateInvoice((draft, currentActor) => {
      if (draft.invoice.status === "posted") return;
      const before = draft.invoice.lines[index];
      const wasConfirmed = before.review_confirmed;
      const fingerprint = (line: InvoiceEditableLine) =>
        JSON.stringify([
          line.product_code,
          line.supplier_item_id,
          line.supplier_item_code,
          line.qty_invoiced,
          line.qty_received_at_posting,
          line.unit_cost_before_tax,
          line.case_cost_before_tax,
          line.units_per_case,
          line.quantity_unit,
          line.quantity_entered,
          line.source_quantity,
          line.source_received_quantity,
          line.source_quantity_unit,
          line.source_cost_before_tax,
          line.source_cost_unit,
          line.case_weight,
          line.case_weight_unit,
        ]);
      const old = fingerprint(before);
      change(draft.invoice.lines[index], draft, currentActor);
      if (fingerprint(before) !== old) {
        clearInvoiceOrderLine(before);
        draft.invoice.order_missing_decisions = undefined;
        draft.invoice.lower_price_answers = undefined;
        before.short_dated = false;
      }
      draft.invoice.lines[index].review_changed_after_confirmation ||=
        wasConfirmed;
      draft.invoice.lines[index].review_confirmed = false;
      if (recalculate) recalculateInvoice(draft.invoice, draft.config);
    });
    setMessage("");
  }

  async function post() {
    if (blockers.length) {
      setAttemptedPost(true);

      setMessage(
        t(
          "Complete the highlighted requirements before posting.",
          "پیش از ثبت، موارد مشخص‌شده را کامل کنید.",
        ),
      );
      return;
    }
    const posted = await updateInvoice(
      (draft, currentActor) => postInvoice(draft, currentActor),
      "invoices.post",
    );
    if (!posted) return;
    setSelectedView(null);
    navigate(`invoices?id=${encodeURIComponent(invoice.id)}`);
    setMessage("");
  }

  function sourceDeliveryQuantity(
    line: InvoiceEditableLine,
    canonical: number,
  ) {
    return line.sold_by === "weight"
      ? new Decimal(
          weightQuantityFromLb(
            canonical,
            line.source_quantity_unit ?? "lb",
            line.weight_conversion_factor ?? state.config,
          ),
        )
          .toDecimalPlaces(3, Decimal.ROUND_DOWN)
          .toNumber()
      : canonical;
  }

  async function receive(index: number) {
    const line = invoice.lines[index];
    const code = line.product_code;
    const remaining = lineShort(line).quantity - (line.qty_later_received ?? 0);
    const enteredQuantity =
      deliveryQuantities[index] ??
      Math.min(2, sourceDeliveryQuantity(line, remaining));
    let quantity = enteredQuantity;
    let validQuantity = Number.isSafeInteger(enteredQuantity);
    if (line.sold_by === "weight") {
      try {
        const validated = validateWeightQuantity(enteredQuantity);
        quantity = new Decimal(
          weightQuantityPerLb(
            validated,
            line.source_quantity_unit ?? "lb",
            line.weight_conversion_factor ?? state.config,
          ),
        ).toNumber();
        validQuantity = true;
      } catch {
        validQuantity = false;
      }
    }
    const receipt =
      deliveryRefs[index] ??
      `DEMO-DELIVERY-${(line.qty_later_received ?? 0) + 1}`;
    if (
      !receipt.trim() ||
      !validQuantity ||
      quantity <= 0 ||
      quantity > remaining
    ) {
      setDeliveryErrors((current) => ({
        ...current,
        [index]: {
          reference: !receipt.trim()
            ? t("Enter a delivery reference.", "مرجع تحویل را وارد کنید.")
            : undefined,
          quantity:
            !validQuantity || quantity <= 0 || quantity > remaining
              ? t(
                  "Enter no more than the remaining missing units.",
                  "تعداد نباید از واحدهای کمبود باقی‌مانده بیشتر باشد.",
                )
              : undefined,
        },
      }));
      return;
    }
    const outcome = await updateInvoice((draft, currentActor) => {
      const oldIds = new Set(draft.ledger.map((row) => row.id));
      const restored = receiveShort(
        draft,
        code,
        quantity,
        receipt,
        currentActor,
        index,
      );
      return {
        restored,
        duplicate: draft.ledger.every((row) => oldIds.has(row.id)),
      };
    }, "invoices.short_resolve");
    if (!outcome) return;
    const restored = outcome.restored;
    if (outcome.duplicate) {
      setMessage(
        t(
          "This delivery reference was already recorded. No delivery or money was added.",
          "این مرجع تحویل قبلاً ثبت شده است. تحویل یا مبلغی اضافه نشد.",
        ),
      );
      return;
    }
    setMessage(
      `${t("Received short delivery. Payable restored:", "تحویل کسری دریافت شد. مبلغ بدهی بازگردانده‌شده:")} \u2066${money(restored)}\u2069`,
    );
    setDeliveryRefs((current) => ({ ...current, [index]: "" }));
    setDeliveryErrors((current) => ({ ...current, [index]: {} }));
  }

  const branchInvoices =
    state.invoices?.filter(
      (item) =>
        item.company_id === state.config.company.seed_key &&
        item.status === "posted" &&
        (branch === "all" ||
          effectiveInvoiceLocation(state, item) === branch) &&
        (!supplierFilter ||
          item.supplier === supplierFilter ||
          supplierRecords(state).some(
            (record) =>
              record.name === supplierFilter &&
              supplierMatches(record, item.supplier),
          )) &&
        (!fromFilter ||
          companyCalendarDate(
            state.config,
            item.received_at ?? item.invoice_date,
          ) >= fromFilter) &&
        (!toFilter ||
          companyCalendarDate(
            state.config,
            item.received_at ?? item.invoice_date,
          ) <= toFilter),
    ) ?? [];
  const savedDrafts = allInvoiceRecords.filter(
    (item) =>
      atCurrentLocations(item) &&
      stageOf(item) === tab &&
      item.status !== "posted",
  );
  const otherLocationReviewCount =
    branch === "all"
      ? 0
      : allInvoiceRecords.filter(
          (item) =>
            !atCurrentLocations(item) && stageOf(item) === "needs_review",
        ).length;
  const resume = async (saved: InvoiceReadDTO) => {
    await command(
      "invoices.read",
      {
        company_id: saved.company_id,
        kind: "company_shared",
        entity_id: saved.id,
      },
      (draft, currentActor) =>
        selectInvoiceWorkspace(draft, currentActor, saved.id),
    );

    setSelectedView(null);
    navigate(`invoices?id=${encodeURIComponent(saved.id)}`);
  };
  const draftList = savedDrafts.length ? (
    <Card
      title={
        tab === "drafts"
          ? t("Drafts", "پیش‌نویس‌ها")
          : tab === "processing"
            ? t("Processing", "در حال پردازش")
            : tab === "needs_review"
              ? t("Needs review", "نیازمند بررسی")
              : t("Ready to post", "آماده ثبت")
      }
      className="invoice-saved-drafts"
    >
      <InvoiceQueueTable invoices={savedDrafts} onOpen={resume} />
    </Card>
  ) : null;
  const laterShortDeliveries = (
    <>
      {locked &&
        invoice.lines
          .map((line, index) => ({ line, index }))
          .filter(({ line }) => lineShort(line).quantity > 0)
          .map(({ line, index }) => {
            const remaining =
              lineShort(line).quantity - (line.qty_later_received ?? 0);
            const product = state.products.find(
              (item) => item.code === line.product_code,
            )!;
            return (
              <Card
                key={`${invoice.id}:${index}`}
                title={`${t("Later short delivery", "تحویل بعدی کسری")} · ${lang === "fa" ? (product?.name_fa ?? line.new_name_fa ?? line.description) : `\u2066${product?.name_en ?? line.description}\u2069`} · ${line.supplier_item_code ?? ""}`}
                className="invoice-short-receipt"
              >
                <p>
                  <Badge tone={remaining ? "danger" : "approved"}>
                    {remaining ? t("Short", "کسری") : t("Resolved", "رفع شد")}
                  </Badge>{" "}
                  {t("Still missing:", "کمبود باقی‌مانده:")}{" "}
                  {sourceDeliveryQuantity(line, remaining)}{" "}
                  {line.sold_by === "weight" && (
                    <LtrText>{line.source_quantity_unit}</LtrText>
                  )}{" "}
                  · {t("Received later:", "دریافت بعدی:")}{" "}
                  {sourceDeliveryQuantity(line, line.qty_later_received ?? 0)}
                </p>
                <p>
                  {t(
                    "Received from this invoice:",
                    "دریافت‌شده از این فاکتور:",
                  )}{" "}
                  {sourceDeliveryQuantity(
                    line,
                    new Decimal(acceptedInvoiceUnits(line))
                      .plus(line.qty_later_received ?? 0)
                      .toNumber(),
                  )}
                </p>
                {remaining > 0 && (
                  <>
                    <div className="form-grid invoice-details-form">
                      <Field
                        label={t(
                          "Actual units received now",
                          "واحدهای واقعاً دریافت‌شده اکنون",
                        )}
                        error={deliveryErrors[index]?.quantity}
                      >
                        <NumberField
                          className="control-narrow"
                          dir="ltr"

                          min={line.sold_by === "weight" ? "0.001" : "1"}
                          max={sourceDeliveryQuantity(line, remaining)}
                          step={line.sold_by === "weight" ? "0.001" : "1"}
                          value={
                            deliveryQuantities[index] ??
                            Math.min(2, sourceDeliveryQuantity(line, remaining))
                          }
                          onChange={(value) => {
                            setDeliveryQuantities((current) => ({
                              ...current,
                              [index]: Number(value),
                            }));
                            setDeliveryErrors((current) => ({
                              ...current,
                              [index]: {
                                ...current[index],
                                quantity: undefined,
                              },
                            }));
                          }}
                        />
                      </Field>
                      <Field
                        label={t(
                          "Delivery document reference",
                          "مرجع سند تحویل",
                        )}
                        error={deliveryErrors[index]?.reference}
                      >
                        <input
                          dir="ltr"
                          value={
                            deliveryRefs[index] ??
                            `DEMO-DELIVERY-${(line.qty_later_received ?? 0) + 1}`
                          }
                          onChange={(event) => {
                            setDeliveryRefs((current) => ({
                              ...current,
                              [index]: event.target.value,
                            }));
                            setDeliveryErrors((current) => ({
                              ...current,
                              [index]: {
                                ...current[index],
                                reference: undefined,
                              },
                            }));
                          }}
                        />
                      </Field>
                    </div>
                    <Button
                      variant="neutral"
                      onClick={() => receive(index)}
                      disabled={!can("invoices.short_resolve", scope)}
                    >
                      {t("Receive short delivery", "دریافت تحویل کسری")}
                    </Button>
                  </>
                )}
                {state.ledger
                  .filter(
                    (entry) =>
                      entry.invoice_id === invoice.id &&
                      entry.type === "short_restoration" &&
                      (entry.invoice_line_index === index ||
                        (entry.invoice_line_index === undefined &&
                          invoice.lines.filter(
                            (item) => lineShort(item).quantity > 0,
                          ).length === 1)),
                  )
                  .map((entry) => (
                    <p key={entry.id}>
                      <LtrText>{entry.reference}</LtrText> ·{" "}
                      {t("Restored:", "بازگردانده شد:")}{" "}
                      <ReadingMoney
                        value={entry.amount}
                        currency={state.config.company.currency}
                      />
                    </p>
                  ))}
              </Card>
            );
          })}
    </>
  );
  return (
    <>
      <InvoiceEntryChoices
        open={entryChoiceOpen}
        onClose={() => setEntryChoiceOpen(false)}
        onSelect={(manual) => void start(manual)}
        disabled={uploadPending || entryPending}
      />
      {correctionOpen && (
        <InvoiceCorrectionDialog
          original={invoice}
          onClose={() => setCorrectionOpen(false)}
          onSaved={() => {
            setCorrectionOpen(false);
            navigate(`invoices?id=${encodeURIComponent(invoice.id)}`);
            setMessage(t("Invoice corrected.", "فاکتور اصلاح شد."));
          }}
        />
      )}
      {supplierEditorOpen && (
        <SupplierEditor
          invoiceQuickAdd={!supplierToEdit}
          supplier={supplierToEdit}
          completeForInvoice={
            !!supplierToEdit &&
            (invoice.entry_mode === "manual" ||
              !!supplierToEdit.invoice_review_required)
          }
          onClose={() => {
            setSupplierEditorOpen(false);
            setSupplierToEdit(undefined);
          }}
          onSaved={(record) =>
            updateInvoice((draft) => {
              draft.invoice.supplier = record.name;
              draft.invoice.supplier_confirmed = record.status === "confirmed";
              setInvoicePaymentTerms(draft.invoice, record.payment_terms);
              if (!supplierToEdit)
                markInvoiceSupplierReview(draft.invoice, record);
              draft.invoice.lower_price_answers = undefined;
            })
          }
        />
      )}
      {productEditorOpen && (
        <ProductEditor
          invoiceQuickAdd
          onClose={() => setProductEditorOpen(false)}
          onCreated={(product) =>
            updateInvoice((draft, currentActor) => {
              addManualLine(draft, currentActor, product.code);
            })
          }
        />
      )}
      {!routeId && (
        <>
          <PageHeader
            title={t("Invoices", "فاکتورها")}
            description={t(
              "Deliveries and supplier invoices",
              "تحویل‌ها و فاکتورهای تأمین‌کننده",
            )}
            actions={
              <Button
                variant={active && !locked ? "neutral" : "primary"}
                onClick={() => setEntryChoiceOpen(true)}
                disabled={
                  uploadPending ||
                  entryPending ||
                  actor?.selection.kind !== "location"
                }
                aria-busy={uploadPending || entryPending}
              >
                {t("New invoice", "فاکتور جدید")}
              </Button>
            }
          />
          <Tabs
            showZeroCounts
            aria-label={t("Invoice views", "نمای فاکتورها")}
            value={tab}
            onChange={(value) => {
              chooseTab(value as InvoiceTab);
            }}
            options={[
              {
                value: "drafts",
                count: tabCount("drafts"),
                label: t("Drafts", "پیش‌نویس‌ها"),
              },
              {
                value: "processing",
                count: tabCount("processing"),
                label: t("Processing", "در حال پردازش"),
              },
              {
                value: "needs_review",
                count: tabCount("needs_review"),
                label: t("Needs review", "نیازمند بررسی"),
              },
              {
                value: "ready_to_post",
                count: tabCount("ready_to_post"),
                label: t("Ready to post", "آماده ثبت"),
              },
              {
                value: "posted",
                count: tabCount("posted"),
                label: t("Posted", "ثبت‌شده"),
              },
              {
                value: "cancelled",
                count: tabCount("cancelled"),
                label: t("Cancelled", "لغوشده"),
              },
            ]}
          />
        </>
      )}
      {!routeId && (supplierFilter || fromFilter || toFilter) && (
        <div className="invoice-list-scope">
          <span>
            {supplierFilter && <LtrText>{supplierFilter}</LtrText>}{" "}
            {fromFilter && (
              <>
                {t("From", "از")} <DateText value={fromFilter} />
              </>
            )}{" "}
            {toFilter && (
              <>
                {t("To", "تا")} <DateText value={toFilter} />
              </>
            )}
          </span>
          <Button variant="plain" onClick={() => navigate("invoices")}>
            {t("Clear filters", "پاک کردن فیلترها")}
          </Button>
        </div>
      )}
      {message && (
        <div role="status" className="banner info">
          {message}
        </div>
      )}
      {!routeId && tab !== "posted" && draftList}
      {!routeId && otherLocationReviewCount > 0 && (
        <p className="muted">
          {t(
            `${otherLocationReviewCount} more need review at other locations.`,
            `${otherLocationReviewCount} فاکتور دیگر در مکان‌های دیگر نیاز به بررسی دارند.`,
          )}{" "}
          <Button variant="plain" onClick={() => void setBranch("all")}>
            {t("Show all locations", "نمایش همه مکان‌ها")}
          </Button>
        </p>
      )}
      {tab === "posted" && !showPostedDetail ? (
        <Card className="invoice-posted-list">
          <div className="c5-card-title-row">
            <h2>{t("Posted invoices", "فاکتورهای ثبت‌شده")}</h2>
            {postedColumns.chooser}
          </div>
          {!branchInvoices.length ? (
            <EmptyState>
              {t(
                "No posted invoices. Review and post a delivery first.",
                "فاکتور ثبت‌شده‌ای نیست. ابتدا یک تحویل را بررسی و ثبت کنید.",
              )}
            </EmptyState>
          ) : (
            <DataTable
              className="invoice-posted-table"
              columns={postedColumns.columns}
            >
              <thead>
                <tr>
                  <th scope="col">{t("Invoice", "فاکتور")}</th>
                  <th scope="col">{t("Supplier", "تأمین‌کننده")}</th>
                  <th scope="col">{t("Branch", "شعبه")}</th>
                  <th scope="col">{t("Date", "تاریخ")}</th>
                  <th scope="col">{t("Status", "وضعیت")}</th>
                  <th scope="col">{t("Action", "عملیات")}</th>
                </tr>
              </thead>
              <tbody>
                {branchInvoices.map((item) => (
                  <tr
                    key={item.id}
                    data-row-href={`#invoices?id=${encodeURIComponent(item.id)}`}
                  >
                    <td>
                      <div className="table-identity invoice-list-identity">
                        <a
                          className="invoice-list-number-link"
                          href={`#invoices?id=${encodeURIComponent(item.id)}`}
                          onClick={(event) => {
                            event.preventDefault();
                            // The route effect selects the protected workspace.
                            // Starting resume() here also navigated after its
                            // async command, which could undo browser Back.
                            chooseTab("posted", true);

                            navigate(
                              `invoices?id=${encodeURIComponent(item.id)}`,
                            );
                          }}
                        >
                          <LtrText>{item.supplier_invoice_number}</LtrText>
                        </a>
                      </div>
                    </td>
                    <td>
                      <LtrText>{item.supplier}</LtrText>
                    </td>
                    <td>
                      {configuredBranchLabel(state.config, item.branch, lang)}
                    </td>
                    <td>
                      <DateText value={item.invoice_date} />
                    </td>
                    <td>
                      <Badge tone="approved">{t("Posted", "ثبت‌شده")}</Badge>
                    </td>
                    <td className="action-cell">
                      <TableRowLink
                        href={`#invoices?id=${encodeURIComponent(item.id)}`}
                        aria-label={`${t("Invoice", "فاکتور")} ${item.supplier_invoice_number}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      ) : !routeId && tab === "drafts" ? (
        <Card title={t("New invoice", "فاکتور جدید")}>
          <div
            className="invoice-entry-choices"
            hidden={entryChoiceOpen}
            inert={entryChoiceOpen || undefined}
          >
            <Button onClick={() => start(false)} disabled={entryPending}>
              {t("Upload", "بارگذاری")}
            </Button>
            {can("invoices.enter_manual", scope) && (
              <Button
                variant="secondary"
                onClick={() => start(true)}
                disabled={entryPending}
              >
                {t("Manual entry", "ورود دستی")}
              </Button>
            )}
          </div>
          <Field
            label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
            error={uploadError}
          >
            <Dropzone
              id="invoice-original"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={(file) => void attachFile(file, true)}
              disabled={uploadPending || entryPending}
            />
          </Field>
          <p className="helper">
            {t(
              "AI invoice reading is simulated",
              "خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
            )}
          </p>
        </Card>
      ) : !routeId && savedDrafts.length ? null : (!routeId && active) ||
        tab !== currentTab ? (
        <Card className="invoice-view-empty">
          <EmptyState>
            {tab === "cancelled"
              ? t("No cancelled invoices.", "فاکتور لغوشده‌ای نیست.")
              : tab === "processing"
                ? t(
                    "No invoices are processing.",
                    "فاکتوری در حال پردازش نیست.",
                  )
                : tab === "ready_to_post"
                  ? t(
                      "No invoices are ready to post.",
                      "فاکتوری آماده ثبت نیست.",
                    )
                  : tab === "needs_review"
                    ? t(
                        "No invoices need review.",
                        "فاکتوری نیازمند بررسی نیست.",
                      )
                    : t(
                        "No drafts. Start a new invoice.",
                        "پیش‌نویسی نیست. فاکتور جدید شروع کنید.",
                      )}
          </EmptyState>
        </Card>
      ) : locked ? (
        <div className="invoice-workspace invoice-posted-workspace">
          <div className="invoice-review-pane">
            <PostedInvoice
              original={invoice}
              invoice={displayedVersion.invoice}
              versionId={displayedVersion.version_id}
              onCorrect={() => setCorrectionOpen(true)}
              onMove={() => {
                setMoveTarget("");
                setMoveReason("");
                setMoveError("");
                setMoveOpen(true);
              }}
            >
              {displayedVersion.version_id === workspace.latestVersionId &&
                laterShortDeliveries}
            </PostedInvoice>
          </div>
          <aside
            className="invoice-document-pane"
            aria-label={t("Original invoice", "اصل فاکتور")}
          >
            <OriginalInvoice
              invoice={invoice}
              onAttach={
                !invoice.original_available &&
                can("invoices.attach_posted_original", scope)
                  ? () => originalInput.current?.click()
                  : undefined
              }
            />
            {uploadError && (
              <p role="alert" className="form-error">
                {uploadError}
              </p>
            )}
          </aside>
        </div>
      ) : routeId &&
        invoice.entry_mode === "upload" &&
        invoice.status === "draft" &&
        !invoice.original_available ? (
        <div className="receiving-review" data-testid="invoice-upload-entry">
          <PageHeader
            title={t("New invoice", "فاکتور جدید")}
            actions={
              <Button variant="secondary" onClick={() => navigate("invoices")}>
                {t("Save and close", "ذخیره و بستن")}
              </Button>
            }
          />
          <Card>
            <Field
              label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
              error={uploadError}
            >
              <Dropzone
                id="invoice-original"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={(file) => void attachFile(file)}
                disabled={uploadPending || entryPending}
              />
            </Field>
            <p className="helper">
              {t(
                "AI invoice reading is simulated",
                "خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
              )}
            </p>
          </Card>
        </div>
      ) : routeId &&
        invoice.original_available &&
        (invoice.status === "empty" || invoice.status === "reading") ? (
        <div className="receiving-review">
          <ReviewHeader
            invoice={invoice}
            postDisabled
            missing={t(
              "Read the invoice before posting.",
              "پیش از ثبت، فاکتور را بخوانید.",
            )}
            onClose={() => navigate("invoices")}
            onPost={() => setPostOpen(true)}
            onAttemptPost={() => setAttemptedPost(true)}
          />
          {uploadError && (
            <p role="alert" className="form-error">
              {uploadError}
            </p>
          )}
          <div className="receiving-layout">
            <Card>
              {invoice.status === "reading" ? (
                <p role="status">
                  {t("Reading invoice…", "در حال خواندن فاکتور…")}
                </p>
              ) : (
                <Button
                  onClick={() =>
                    updateInvoice((draft) => {
                      draft.invoice.status = "reading";
                    })
                  }
                >
                  {t("Read invoice", "خواندن فاکتور")}
                </Button>
              )}
            </Card>
            <OriginalViewer
              invoice={invoice}
              onAttach={() => originalInput.current?.click()}
            />
          </div>
        </div>
      ) : routeId && active && invoice.status !== "reading" ? (
        <>
          {uploadError && (
            <p role="alert" className="form-error">
              {uploadError}
            </p>
          )}
          <InvoiceReviewPage
            invoice={invoice}
            workspace={workspace}
            update={updateInvoice}
            editLine={editLine}
            onSupplierAdd={() => {
              setSupplierToEdit(undefined);
              setSupplierEditorOpen(true);
            }}
            onProductAdd={() => setProductEditorOpen(true)}
            onAttach={() => originalInput.current?.click()}
            onClose={() => navigate("invoices")}
            onPost={() => setPostOpen(true)}
            onAttemptPost={() => setAttemptedPost(true)}
            onReceived={editReceived}
            receivedLocal={receivedLocal}
            attemptedPost={attemptedPost}
            onQuantity={setInvoiceLineQuantity}
            extras={
              <>
                {invoice.order_id && (
                  <div id="invoice-order-review">
                    <InvoiceOrderReview />
                  </div>
                )}
                {lowerLines.length > 0 && (
                  <Card
                    title={t(
                      "Same-supplier lower price",
                      "کاهش هزینه همان تأمین‌کننده",
                    )}
                    className="invoice-lower-price-card"
                  >
                    {lowerLines.map(({ line, index }) => {
                      const product = state.products.find(
                        (item) => item.code === line.product_code,
                      )!;
                      return (
                        <p key={`${line.product_code}:${index}`}>
                          <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                            {lang === "fa" ? product.name_fa : product.name_en}
                          </bdi>{" "}
                          · <LtrText>{invoice.supplier}</LtrText> ·{" "}
                          {t("Old", "قبلی")}{" "}
                          {workspace.lineDetails[index]?.previous ? (
                            <ReadingMoney
                              value={
                                workspace.lineDetails[index]!.previous!.cost
                              }
                              currency={state.config.company.currency}
                            />
                          ) : (
                            <span className="muted">—</span>
                          )}{" "}
                          · {t("New", "جدید")}{" "}
                          <ReadingMoney
                            value={line.unit_cost_before_tax}
                            currency={state.config.company.currency}
                          />
                        </p>
                      );
                    })}
                    <p className="muted">
                      {t(
                        "Your answers create an Owner or Manager alert when you post. Unknown information is allowed with a note.",
                        "پاسخ‌های شما هنگام ثبت هشدار مالک یا مدیر ایجاد می‌کند. اطلاعات نامعلوم با یادداشت پذیرفته می‌شود.",
                      )}
                    </p>
                    <fieldset
                      disabled={locked}
                      className="form-grid invoice-details-form"
                    >
                      <Field
                        label={t(
                          "Is the expiry date the same as the goods already in the store?",
                          "آیا تاریخ انقضا با کالاهای موجود در فروشگاه یکسان است؟",
                        )}
                      >
                        <Select
                          id="invoice-lower-answer"
                          value={invoice.lower_price_answers?.same_expiry ?? ""}
                          onChange={(value) =>
                            updateInvoice((draft) => {
                              draft.invoice.lower_price_answers = {
                                same_expiry: value,
                              };
                            })
                          }

                          disabled={locked}
                          options={[
                            {
                              value: "",
                              label: t(
                                "Choose an answer",
                                "پاسخ را انتخاب کنید",
                              ),
                            },
                            {
                              value: "yes",
                              label: t("Yes, same date", "بله، تاریخ یکسان"),
                            },
                            {
                              value: "no",
                              label: t(
                                "No, different dates",
                                "خیر، تاریخ‌های متفاوت",
                              ),
                            },
                            {
                              value: "no_previous_stock",
                              label: t("No previous goods", "کالای قبلی نیست"),
                            },
                            {
                              value: "dates_not_tracked",
                              label: t(
                                "Dates not tracked",
                                "تاریخ‌ها پیگیری نمی‌شوند",
                              ),
                            },
                            {
                              value: "unknown",
                              label: t(
                                "Unknown — add a note",
                                "نامعلوم — یادداشت اضافه کنید",
                              ),
                            },
                          ]}
                        />
                      </Field>
                      {invoice.lower_price_answers?.same_expiry === "yes" && (
                        <Field
                          label={t(
                            "Units left at the higher cost",
                            "واحدهای باقی‌مانده با هزینه بالاتر",
                          )}
                          error={
                            attemptedPost &&
                            (!Number.isSafeInteger(
                              invoice.lower_price_answers.units_left,
                            ) ||
                              (invoice.lower_price_answers.units_left ?? -1) <
                                0)
                              ? t(
                                  "Enter a whole number of zero or more.",
                                  "عدد صحیح صفر یا بیشتر وارد کنید.",
                                )
                              : undefined
                          }
                        >
                          <NumberField
                            className="control-narrow"

                            min="0"
                            step="1"
                            dir="ltr"
                            id="invoice-lower-units-left"
                            value={invoice.lower_price_answers.units_left ?? ""}
                            onChange={(value) =>
                              updateInvoice((draft) => {
                                draft.invoice.lower_price_answers!.units_left =
                                  value === "" ? undefined : Number(value);
                              })
                            }
                          />
                        </Field>
                      )}
                      {invoice.lower_price_answers?.same_expiry === "no" && (
                        <>
                          <Field
                            label={t(
                              "Previous goods expiry",
                              "انقضای کالاهای قبلی",
                            )}
                            error={
                              attemptedPost &&
                              !invoice.lower_price_answers.old_expiry
                                ? t(
                                    "Choose the previous goods expiry.",
                                    "تاریخ انقضای موجودی قبلی را انتخاب کنید.",
                                  )
                                : undefined
                            }
                          >
                            <DateField
                              id="invoice-lower-old-expiry"
                              dir="ltr"
                              value={
                                invoice.lower_price_answers.old_expiry ?? ""
                              }
                              onChange={(value) =>
                                updateInvoice((draft) => {
                                  draft.invoice.lower_price_answers!.old_expiry =
                                    value;
                                })
                              }
                            />
                          </Field>
                          <Field
                            label={t(
                              "New delivery expiry",
                              "انقضای تحویل جدید",
                            )}
                            error={
                              attemptedPost &&
                              !invoice.lower_price_answers.new_expiry
                                ? t(
                                    "Choose the new delivery expiry.",
                                    "تاریخ انقضای تحویل جدید را انتخاب کنید.",
                                  )
                                : undefined
                            }
                          >
                            <DateField
                              id="invoice-lower-new-expiry"
                              dir="ltr"
                              value={
                                invoice.lower_price_answers.new_expiry ?? ""
                              }
                              onChange={(value) =>
                                updateInvoice((draft) => {
                                  draft.invoice.lower_price_answers!.new_expiry =
                                    value;
                                })
                              }
                            />
                          </Field>
                        </>
                      )}
                      {invoice.lower_price_answers?.same_expiry ===
                        "unknown" && (
                        <Field
                          label={t(
                            "What information is unknown? (required)",
                            "چه اطلاعاتی نامعلوم است؟ (الزامی)",
                          )}
                          error={
                            attemptedPost &&
                            !invoice.lower_price_answers.note?.trim()
                              ? t(
                                  "Explain what information is unknown.",
                                  "توضیح دهید چه اطلاعاتی نامعلوم است.",
                                )
                              : undefined
                          }
                        >
                          <textarea
                            id="invoice-lower-note"
                            value={
                              invoice.lower_price_answers.note ===
                              "Previous goods label cannot be read."
                                ? t(
                                    "Previous goods label cannot be read.",
                                    "برچسب موجودی قبلی خوانا نیست.",
                                  )
                                : (invoice.lower_price_answers.note ?? "")
                            }
                            onChange={(event) => {
                              const inputValue = event.currentTarget.value;
                              updateInvoice((draft) => {
                                draft.invoice.lower_price_answers!.note =
                                  inputValue;
                              });
                            }}
                          />
                        </Field>
                      )}
                    </fieldset>
                  </Card>
                )}
              </>
            }
          />
        </>
      ) : !routeId && tab !== "drafts" ? null : (
        <Card title={t("New invoice", "فاکتور جدید")}>
          <div
            className="invoice-entry-choices"
            hidden={entryChoiceOpen}
            inert={entryChoiceOpen || undefined}
          >
            <Button onClick={() => start(false)} disabled={entryPending}>
              {t("Upload", "بارگذاری")}
            </Button>
            {can("invoices.enter_manual", scope) && (
              <Button
                variant="secondary"
                onClick={() => start(true)}
                disabled={entryPending}
              >
                {t("Manual entry", "ورود دستی")}
              </Button>
            )}
          </div>
          {!invoice.original_available && (
            <Field
              label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
              error={uploadError}
            >
              <Dropzone
                id="invoice-original"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={(file) => {
                  void attachFile(file);
                }}
                disabled={uploadPending || entryPending}
              />
            </Field>
          )}
          <p className="helper">
            {t(
              "AI invoice reading is simulated",
              "خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
            )}
          </p>
          {invoice.status === "reading" && (
            <p role="status">
              {t("Reading invoice…", "در حال خواندن فاکتور…")}
            </p>
          )}
        </Card>
      )}
      <input
        ref={originalInput}
        className="ui-file-input"
        hidden
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        aria-label={
          invoice.original_available
            ? t("Replace file", "جایگزینی فایل")
            : t("Attach original", "پیوست اصل فاکتور")
        }
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void attachFile(file);
          event.target.value = "";
        }}
      />
      <ConfirmDialog
        open={postOpen}
        onOpenChange={setPostOpen}
        title={t("Post invoice", "ثبت فاکتور")}
        description={t(
          "Received, approvals, alerts, and supplier ledger are updated.",
          "دریافت‌شده‌ها، تأییدها، هشدارها و دفتر تأمین‌کننده به‌روز می‌شوند.",
        )}
        confirmLabel={t("Post invoice", "ثبت فاکتور")}
        confirmDisabled={blockers.length > 0}
        onConfirm={post}
      >
        <p>
          <LtrText>{invoice.supplier_invoice_number}</LtrText> ·{" "}
          <LtrText>{invoice.supplier}</LtrText>
        </p>
        <p>
          {t("Payable", "قابل پرداخت")}:{" "}
          <ReadingMoney
            value={payable}
            currency={state.config.company.currency}
          />
        </p>
      </ConfirmDialog>
      <Dialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={t("Move invoice", "انتقال فاکتور")}
        description={t(
          "Record a correction to the receiving location.",
          "ثبت اصلاح مکان دریافت فاکتور.",
        )}
        className="invoice-move-form"
      >
        <WhatsMissing issues={moveIssues} />
        <Field
          label={t("Location", "مکان")}
          error={
            moveIssues.find((item) => item.fieldId === "invoice-move-target")
              ?.message
          }
        >
          <Select
            id="invoice-move-target"
            value={moveTarget}
            onChange={(value) => {
              setMoveTarget(value);
              setMoveError("");
            }}
            options={branches
              .filter((location) => location !== invoiceLocation)
              .map((location) => ({
                value: location,
                label: configuredBranchLabel(state.config, location, lang),
              }))}
          />
        </Field>
        <Field
          label={t("Reason", "دلیل")}
          error={
            moveIssues.find((item) => item.fieldId === "invoice-move-reason")
              ?.message
          }
        >
          <textarea
            id="invoice-move-reason"
            value={moveReason}
            onChange={(event) => {
              setMoveReason(event.target.value);
              setMoveError("");
            }}
          />
        </Field>
        {movePreview && (
          <>
            <dl className="invoice-move-summary">
              <div>
                <dt>{t("From", "از")}</dt>
                <dd>
                  {configuredBranchLabel(
                    state.config,
                    movePreview.from_branch,
                    lang,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("To", "به")}</dt>
                <dd>
                  {configuredBranchLabel(
                    state.config,
                    movePreview.to_branch,
                    lang,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("Outstanding", "مانده پرداخت")}</dt>
                <dd>
                  <ReadingMoney
                    value={movePreview.outstanding_amount}
                    currency={movePreview.currency}
                  />
                </dd>
              </div>
              <div>
                <dt>{t("Received", "دریافت‌شده‌ها")}</dt>
                <dd>
                  <LtrText>
                    {movePreview.receipts.reduce(
                      (sum, receipt) => sum + receipt.units,
                      0,
                    )}
                  </LtrText>{" "}
                  {t("units", "واحد")}
                </dd>
              </div>
            </dl>
            <p className="helper">
              {t(
                "Previous payments and credits stay at their recorded location. Only the outstanding amount moves.",
                "پرداخت‌ها و اعتبارهای قبلی در مکان ثبت‌شده می‌مانند. فقط مانده پرداخت منتقل می‌شود.",
              )}
            </p>
            {movePreview.allocations.length > 0 && (
              <ul>
                {movePreview.allocations.map((allocation) => (
                  <li key={allocation.ledger_id}>
                    <ReadingMoney
                      value={allocation.amount}
                      currency={movePreview.currency}
                    />{" "}
                    ·{" "}
                    {configuredBranchLabel(
                      state.config,
                      allocation.branch,
                      lang,
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="helper">
              {t("Pending approvals", "تأییدهای در انتظار")}:{" "}
              <LtrText>{movePreview.approval_ids.length}</LtrText>
            </p>
          </>
        )}
        {moveError && (
          <p role="alert" className="form-error">
            {moveError}
          </p>
        )}
        <DialogActions>
          <Button variant="neutral" onClick={() => setMoveOpen(false)}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            onClick={async () => {
              setMoveAttempted(true);
              if (!movePreview || !moveReason.trim()) return;
              try {
                const moved = await updateInvoice((draft, currentActor) => {
                  applyReviewedInvoiceMove(
                    draft,
                    currentActor,
                    invoice.id,
                    moveTarget,
                    moveReason,
                    movePreview.snapshot,
                  );
                  return true;
                }, "invoices.relocate");
                if (!moved) return;
                setMoveOpen(false);
                setMessage(
                  t(
                    "Invoice moved. The correction is recorded in History.",
                    "فاکتور منتقل شد. اصلاح در سابقه ثبت شد.",
                  ),
                );
              } catch {
                setMoveError(
                  t(
                    "The invoice or allocations changed. Review the move again.",
                    "فاکتور یا تخصیص‌ها تغییر کردند. انتقال را دوباره بررسی کنید.",
                  ),
                );
              }
            }}
          >
            {t("Move invoice", "انتقال فاکتور")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
