import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Decimal from "decimal.js";
import {
  ImportedReadingNote,
  InvoiceOtherCharges,
  InvoiceTotalsWarnings,
  ReadingField as Field,
  ReadingCheckProvider,
  ReadingUnknownChecks,
  ReadingMoney,
} from "../InvoiceReadingReview";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
  invoiceCheckCount,
  invoiceTotalsCheck,
  setInvoiceLineCategory,
} from "../invoice-checks";
import { conflictingBarcodeProduct } from "../catalog";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { configSeed, demoSeed as demo } from "../config";
import { sha256Bytes } from "../sha256";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import {
  invoiceWorkspaceRead,
  selectInvoiceWorkspace,
  invoiceMoveRead,
  applyReviewedInvoiceMove,
  type InvoiceWorkspaceRead,
} from "../invoice-workspace-read";
import {
  requireInvoiceAuthority,
  type InvoiceCapability,
} from "../invoice-authority";
import {
  storeInvoiceUpload,
  consumeInvoiceUpload,
} from "../invoice-file-access";
import type { AuthenticatedActor } from "../authority-types";
import type { InvoiceReadDTO } from "../invoice-projections";
import type { InvoiceEditableLine } from "../invoice-edit-types";
import {
  configuredBranches,
  branchLabel as configuredBranchLabel,
} from "../settings";
import {
  supplierChoices,
  supplierRecords,
  supplierMatches,
  missingInvoiceSupplierDetails,
} from "../supplier-editor";
import { SupplierEditor } from "./SupplierEditor";
import { PaymentTermsControl } from "./PaymentTermsControl";
import {
  companyDateTime,
  companyLocalToUtc,
  CompanyLocalTimeError,
  companyCalendarDate,
} from "../company-time";
import {
  invoiceTotalDiffers,
  setInvoiceAmount,
  setInvoicePaymentTerms,
  refreshInvoiceDueDate,
} from "../invoice-entry";
import {
  WhatsMissing,
  FieldError,
  focusValidationField,
  type ValidationIssue,
} from "../WhatsMissing";
import { INCLUDED_COST_INVOICE_SHA256 } from "../file-database";
import { ProductEditor } from "./Catalog";
import "./manual-entry.css";
import "./invoice-entry-c6.css";
import "./c5-catalog-offers.css";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Checkbox,
  DateField,
  Dropzone,
  Dialog,
  DialogActions,
  TableRowLink,
  ConfirmDialog,
  NumberField,
  Select,
  SegmentedControl,
  SummaryTile,
  Tabs,
  useTableColumns,
} from "../ui";
import { useListState, useRouteParam } from "../navigation";
import {
  DateText,
  demoUserLabel,
  LtrText,
  LtrValue,
  NotAdded,
  ProductName,
  UnitSize,
  UnitText,
} from "../presentation";
import "./invoice-settings-labels.css";
import "./invoice-a2.css";
import {
  initializeInvoiceWeight,
  setInvoiceWeightQuantity,
  setInvoiceWeightReceived,
  setInvoiceWeightCost,
} from "../invoice-weight";
import {
  weightQuantityFromLb,
  weightQuantityPerLb,
  validateWeightQuantity,
} from "../weighed";
import { ProductPrice } from "../weight-price-presentation";
import { trackingChoiceForProduct, validTrackedDate } from "../date-tracking";
import { OriginalInvoice } from "./OriginalInvoice";
import { PostedInvoice } from "./PostedInvoice";
import { InvoiceCorrectionDialog } from "./InvoiceCorrectionDialog";
import { attachPostedInvoiceOriginal } from "../invoice-corrections";
import {
  addManualLine,
  companyDate,
  createInvoice,
  demoSaleCostInvoice,
  dateAfter,
  lineShort,
  postInvoice,
  recalculateInvoice,
  receiveShort,
  shortTotals,
  refusedTotals,
  lineRefused,
  acceptedInvoiceUnits,
  setInvoiceLineQuantity as setEachInvoiceLineQuantity,
  type InvoiceBlocker,
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
  removeInvoiceLine,
  markInvoiceSupplierReview,
  confirmInvoiceSupplierReview,
  initializeInvoiceManualPriceDecisions,
} from "../invoice";
import {
  ManualPriceDetails,
  ManualPricePill,
} from "../manual-price-presentation";
import { effectiveInvoiceLocation, setInvoiceLocation } from "../received";
import "./received-c.css";
import {
  costPerCase,
  costPerUnit,
  resolveSupplierItem,
} from "../supplier-items";
import { clearInvoiceOrder, clearInvoiceOrderLine } from "../invoice-orders";
import { InvoiceOrderReview } from "./InvoiceOrderReview";
import "./invoice-c3.css";
import "./invoices-c7.css";
import type { DemoState, Language, Product, SupplierRecord } from "../types";

type Translate = (en: string, fa: string) => string;
function invoiceProductOption(
  item: Pick<Product, "code" | "name_en" | "name_fa">,
  language: Language,
) {
  const label = `\u2066${item.code}\u2069 · ${language === "fa" ? item.name_fa : `\u2066${item.name_en}\u2069`}`;
  return {
    value: item.code,
    label,
    content: (
      <>
        {`\u2066${item.code}\u2069 · `}
        {language === "fa" ? (
          <UnitText>{item.name_fa}</UnitText>
        ) : (
          <>
            {"\u2066"}
            <UnitText>{item.name_en}</UnitText>
            {"\u2069"}
          </>
        )}
      </>
    ),
  };
}
type InvoiceTab =
  | "drafts"
  | "processing"
  | "needs_review"
  | "ready_to_post"
  | "posted"
  | "cancelled";
const blockerCopy: Record<InvoiceBlocker, [string, string]> = {
  barcode: [
    "This barcode already belongs to another product. Correct it before posting.",
    "این بارکد به کالای دیگری تعلق دارد. پیش از ثبت آن را اصلاح کنید.",
  ],
  checks: ["Fields still need checking", "هنوز فیلدهایی نیاز به بررسی دارند"],
  permission: [
    "Sign in as a Floor Worker, Branch Supervisor, Owner or Manager to receive invoices.",
    "برای دریافت فاکتور به عنوان کارمند فروشگاه، سرپرست شعبه، مالک یا مدیر وارد شوید.",
  ],
  branch: [
    "Select the invoice branch in the top bar before posting.",
    "پیش از ثبت، شعبه فاکتور را در نوار بالا انتخاب کنید.",
  ],
  company: [
    "Use an invoice and products belonging to this company.",
    "از فاکتور و کالاهای همین شرکت استفاده کنید.",
  ],
  supplier: [
    "Choose a supplier before posting.",
    "پیش از ثبت، تأمین‌کننده را انتخاب کنید.",
  ],
  payment_terms: [
    "Enter nonnegative whole payment-term days that produce a valid due date.",
    "روزهای شرایط پرداخت را به صورت عدد صحیح غیرمنفی وارد کنید تا تاریخ سررسید معتبر باشد.",
  ],
  supplier_details: [
    "Complete the supplier’s phone, email, sales representative, representative phone and payment terms.",
    "تلفن، ایمیل، نماینده فروش، تلفن نماینده و شرایط پرداخت تأمین‌کننده را تکمیل کنید.",
  ],
  supplier_review: [
    "An Owner or Manager must review and confirm the supplier before posting.",
    "مالک یا مدیر باید پیش از ثبت تأمین‌کننده را بررسی و تأیید کند.",
  ],
  supplier_pending: [
    "Waiting for Owner or Manager to confirm supplier.",
    "در انتظار تأیید تأمین‌کننده توسط مالک یا مدیر.",
  ],
  header: [
    "Add the invoice date, received time, and receiving employee.",
    "تاریخ فاکتور، زمان دریافت و کارمند دریافت‌کننده را وارد کنید.",
  ],
  money: [
    "Enter nonnegative totals with no more than two decimal places.",
    "مبالغ غیرمنفی با حداکثر دو رقم اعشار وارد کنید.",
  ],
  file: [
    "Add the original invoice (PDF or photo) before posting.",
    "پیش از ثبت، اصل فاکتور (PDF یا عکس) را اضافه کنید.",
  ],
  lines: ["Add at least one invoice line.", "حداقل یک ردیف فاکتور اضافه کنید."],
  matching: [
    "Match every line to a product, or enter an English name for a new product.",
    "هر ردیف را به کالا وصل کنید یا نام انگلیسی کالای جدید را وارد کنید.",
  ],
  quantity: [
    "Use positive whole Units, or Cases that convert exactly to whole units; delivered units must be between zero and invoiced units.",
    "واحد صحیح مثبت یا کارتن قابل تبدیل دقیق به واحد صحیح وارد کنید؛ تحویل باید بین صفر و واحدهای فاکتور باشد.",
  ],
  cost: [
    "Enter a nonnegative unit cost with no more than four decimal places.",
    "هزینه هر واحد غیرمنفی با حداکثر چهار رقم اعشار وارد کنید.",
  ],
  review: [
    "Review and confirm every invoice line.",
    "همه ردیف‌های فاکتور را بررسی و تأیید کنید.",
  ],
  date: [
    "Choose Yes or No for date tracking on every line; add a date when tracking is on.",
    "برای پیگیری تاریخ هر ردیف بله یا خیر را انتخاب کنید؛ در صورت فعال بودن تاریخ را وارد کنید.",
  ],
  manual_price: [
    "Choose Keep manual price or Use rule price for each manual-priced product.",
    "برای هر کالای دارای قیمت دستی، حفظ قیمت دستی یا استفاده از قیمت قاعده را انتخاب کنید.",
  ],
  lower_price: [
    "Answer the lower-price questions; add a note if information is unknown.",
    "به پرسش‌های کاهش هزینه پاسخ دهید؛ اگر اطلاعات نامعلوم است یادداشت اضافه کنید.",
  ],
  order: [
    "The linked order changed or no longer matches this supplier and receiving location. Refresh the comparison or choose another order.",
    "سفارش مرتبط تغییر کرده یا با تأمین‌کننده و مکان دریافت سازگار نیست. مقایسه را تازه کنید یا سفارش دیگری انتخاب کنید.",
  ],
  order_decisions: [
    "Choose a decision for every order difference before posting.",
    "پیش از ثبت، برای همه اختلاف‌های سفارش تصمیم انتخاب کنید.",
  ],
};

function categoryText(key: string, label: string, t: Translate) {
  const fa: Record<string, string> = {
    grocery: "مواد غذایی",
    grocery_taxable: "مواد غذایی (مشمول مالیات)",
    rice: "برنج",
    kitchenware: "لوازم آشپزخانه",
  };
  return t(label, fa[key] ?? label);
}

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
              onClick={async () => {
                if (actor.selection.kind !== "location") return;
                const location = actor.selection.location_id;
                await startEntry(async () => {
                  const newId = await command(
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
                      draft.invoice = createInvoice(
                        draft,
                        currentActor,
                        location,
                      );
                      draft.invoice.receiving_employee = currentActor.actor;
                      return draft.invoice.id;
                    },
                  );
                  navigate(`invoices?id=${encodeURIComponent(newId)}`);
                  return newId;
                });
              }}
            >
              {t("New invoice", "فاکتور جدید")}
            </Button>
          }
        />
        {!read.pending && <InvoicePickerList />}
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
/** Invoices the person may open when no invoice workspace is selected yet. */
function InvoicePickerList() {
  const { state, t, lang } = useDemo();
  const invoices = state.invoices ?? [];
  const statusLabel = (status: InvoiceReadDTO["status"]) =>
    status === "posted"
      ? t("Posted", "ثبت‌شده")
      : status === "review"
        ? t("Needs review", "نیاز به بررسی")
        : status === "reading"
          ? t("Processing", "در حال پردازش")
          : t("Draft", "پیش‌نویس");
  return (
    <Card className="invoice-picker">
      <h2>{t("Invoices in your locations", "فاکتورهای مکان‌های شما")}</h2>
      {!invoices.length ? (
        <EmptyState>
          {t(
            "No invoices yet. Start a new invoice.",
            "هنوز فاکتوری نیست. فاکتور جدید شروع کنید.",
          )}
        </EmptyState>
      ) : (
        <DataTable
          className="invoice-picker-table"
          columns={[
            {
              key: "invoice",
              label: t("Invoice", "فاکتور"),
              required: true,
              priority: 1,
            },
            {
              key: "supplier",
              label: t("Supplier", "تأمین‌کننده"),
              priority: 2,
            },
            { key: "location", label: t("Location", "مکان"), priority: 3 },
            {
              key: "date",
              label: t("Invoice date", "تاریخ فاکتور"),
              priority: 3,
            },
            { key: "status", label: t("Status", "وضعیت"), priority: 2 },
            { key: "action", label: t("Action", "عملیات"), actions: true },
          ]}
          phoneList={{
            name: "invoice",
            value: "status",
            secondary: ["supplier", "location", "date"],
          }}
        >
          <thead>
            <tr>
              <th scope="col">{t("Invoice", "فاکتور")}</th>
              <th scope="col">{t("Supplier", "تأمین‌کننده")}</th>
              <th scope="col">{t("Location", "مکان")}</th>
              <th scope="col">{t("Invoice date", "تاریخ فاکتور")}</th>
              <th scope="col">{t("Status", "وضعیت")}</th>
              <th scope="col">{t("Action", "عملیات")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const href = `#invoices?id=${encodeURIComponent(invoice.id)}`;
              return (
                <tr key={invoice.id} data-row-href={href}>
                  <td>
                    <a className="entity-link" href={href}>
                      {invoice.supplier_invoice_number ? (
                        <LtrText>{invoice.supplier_invoice_number}</LtrText>
                      ) : (
                        t("Draft", "پیش‌نویس")
                      )}
                    </a>
                  </td>
                  <td>
                    <LtrValue value={invoice.supplier} />
                  </td>
                  <td>
                    {configuredBranchLabel(state.config, invoice.branch, lang)}
                  </td>
                  <td>
                    {invoice.invoice_date ? (
                      <DateText value={invoice.invoice_date} />
                    ) : (
                      <NotAdded />
                    )}
                  </td>
                  <td>
                    <Badge>{statusLabel(invoice.status)}</Badge>
                  </td>
                  <td>
                    <TableRowLink
                      href={href}
                      aria-label={`${t("Open invoice", "باز کردن فاکتور")} ${invoice.supplier_invoice_number}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Card>
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
    demoUsers,
    branch,
    lang,
    t,
    tCount,
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
  const locationSuggestion = workspace.locationSuggestion;
  const [supplierEditorOpen, setSupplierEditorOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<SupplierRecord>();
  const [attemptedPost, setAttemptedPost] = useState(false);
  const [receivedEdit, setReceivedEdit] = useState<{
    invoiceId: string;
    date: string;
    time: string;
  }>();
  const [receivedError, setReceivedError] =
    useState<CompanyLocalTimeError["code"]>();
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const invoice = workspace.invoice;
  const scope = {
    company_id: invoice.company_id,
    kind: "company_shared" as const,
    entity_id: invoice.id,
  };
  const canReadWorkspace = true;
  const [message, setMessage] = useState("");
  const readingEdit = useRef<{ field: string; lineIndex?: number } | null>(
    null,
  );
  const updateInvoice = useCallback(
    async <T,>(
      mutator: (draft: DemoState, currentActor: AuthenticatedActor) => T,
      capability: InvoiceCapability | "suppliers.confirm" = "invoices.edit",
    ): Promise<T | undefined> => {
      const editedCheck = readingEdit.current;
      try {
        return await command(
          capability,
          {
            company_id: invoice.company_id,
            kind: "company_shared",
            entity_id: invoice.id,
          },
          (draft, currentActor) => {
            if (draft.invoice.id !== invoice.id)
              selectInvoiceWorkspace(draft, currentActor, invoice.id);
            requireInvoiceAuthority(
              draft,
              currentActor,
              capability === "suppliers.confirm" ? "invoices.read" : capability,
              invoice.id,
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
            if (
              draft.invoice.status !== "posted" &&
              capability === "invoices.edit"
            )
              initializeInvoiceManualPriceDecisions(draft, currentActor);
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
    [command, invoice.id, invoice.company_id, t],
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moveAttempted, setMoveAttempted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(!invoice.original_available);
  const [postOpen, setPostOpen] = useState(false);
  const [confirmChecksLine, setConfirmChecksLine] = useState<number | null>(
    null,
  );
  const [uploadError, setUploadError] = useState("");
  const [uploadPending, setUploadPending] = useState(false);
  const [manualCode, setManualCode] = useState("0002");
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({});
  const [deliveryQuantities, setDeliveryQuantities] = useState<
    Record<string, number>
  >({});
  const [deliveryRefs, setDeliveryRefs] = useState<Record<string, string>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<
    Record<string, { quantity?: string; reference?: string }>
  >({});
  const blockers = workspace.blockers;
  const readingTotals = invoiceTotalsCheck(invoice);
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
  const [listTab, setListTab] = useListState<InvoiceTab>(
    "invoices.list-tab",
    "drafts",
  );
  useEffect(() => {
    if (
      !routeId &&
      (tabFilter === "posted" || tabFilter === "needs_review") &&
      listTab !== tabFilter
    )
      setListTab(tabFilter);
  }, [routeId, tabFilter, listTab, setListTab]);
  const tab = routeId
    ? validSelection
      ? selectedView.tab
      : currentTab
    : listTab;
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
  const unreadOriginal = (item: InvoiceReadDTO) =>
    item.status === "empty" && item.original_available;
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
  const fileSize = invoice.file_size;
  const supplierRecord = supplierRecords(state).find(
    (record) =>
      record.company_id === invoice.company_id &&
      supplierMatches(record, invoice.supplier),
  );
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
      updateInvoice((draft) => {
        draft.invoice.received_at = instant;
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
  const issueTargets: Record<InvoiceBlocker, string> = {
    permission: "invoice-location",
    branch: "invoice-location",
    company: "invoice-location",
    payment_terms: "invoice-payment-terms",
    supplier: "invoice-supplier",
    supplier_pending: "invoice-supplier",
    supplier_details: "invoice-supplier",
    supplier_review: "invoice-supplier",
    header: !invoice.invoice_date
      ? "invoice-date"
      : !invoice.received_at
        ? "invoice-received-date"
        : "invoice-employee",
    money: !/^\d+(?:\.\d{1,2})?$/.test(invoice.subtotal)
      ? "invoice-subtotal"
      : !/^\d+(?:\.\d{1,2})?$/.test(invoice.tax)
        ? "invoice-tax"
        : "invoice-final-total",
    file: "invoice-original-field",
    lines: "invoice-add-product",
    matching: "invoice-line-0-detail",
    quantity: "invoice-line-0-detail",
    cost: "invoice-line-0-detail",
    review: "invoice-line-0-detail",
    date: "invoice-line-0-detail",
    lower_price: "invoice-lower-answer",
    manual_price: "invoice-line-0-detail",
    order: "invoice-order-review",
    order_decisions: "invoice-order-review",
    checks: "invoice-check-summary",
    barcode: "invoice-line-0-detail",
  };
  const postIssues: ValidationIssue[] = [];
  if (attemptedPost) {
    const lineBlockers = new Set<InvoiceBlocker>([
      "matching",
      "quantity",
      "cost",
      "review",
      "date",
      "manual_price",
      "barcode",
    ]);
    for (const blocker of blockers) {
      if (
        lineBlockers.has(blocker) ||
        blocker === "money" ||
        blocker === "header" ||
        blocker === "checks"
      )
        continue;
      if (
        (blocker === "supplier_pending" || blocker === "supplier_review") &&
        blockers.includes("supplier_details")
      )
        continue;
      postIssues.push({
        id: `invoice-${blocker}-missing`,
        message: t(...blockerCopy[blocker]),
        fieldId: issueTargets[blocker],
      });
    }
    if (invoiceCheckCount(invoice)) {
      const count = invoiceCheckCount(invoice);
      postIssues.push({
        id: "invoice-check-summary",
        fieldId: "invoice-details-fields",
        message: t(
          `${count} fields still need checking`,
          `هنوز ${count} فیلد نیاز به بررسی دارد`,
        ),
      });
      for (const field of invoice.low_confidence_fields ?? [])
        postIssues.push({
          id: `header-check-${field}`,
          fieldId: `invoice-check-header-${field}`,
          message: `${t("Please check", "لطفاً بررسی کنید")}: ${field.replaceAll("_", " ")}`,
        });
      invoice.lines.forEach((line, index) => {
        for (const field of line.low_confidence_fields ?? [])
          postIssues.push({
            id: `line-check-${index}-${field}`,
            fieldId: `invoice-check-line-${index}-${field}`,
            message: `${t("Line", "ردیف")} ${index + 1}: ${t("Please check", "لطفاً بررسی کنید")} ${field.replaceAll("_", " ")}`,
          });
      });
      (invoice.other_charges ?? []).forEach((charge, index) => {
        for (const field of charge.low_confidence_fields ?? [])
          postIssues.push({
            id: `charge-check-${index}-${field}`,
            fieldId: `invoice-check-charge-${index}-${field}`,
            message: `${t("Other charges and credits", "هزینه‌ها و اعتبارهای دیگر")}: ${t("Please check", "لطفاً بررسی کنید")} ${field.replaceAll("_", " ")}`,
          });
      });
    }
    for (const [field, label] of [
      ["subtotal", t("Subtotal", "جمع پیش از مالیات")],
      ["tax", t("Tax", "مالیات")],
      ["final_total", t("Final total", "جمع نهایی")],
    ] as const) {
      if (!/^\d+(?:\.\d{1,2})?$/.test(invoice[field]))
        postIssues.push({
          id: `invoice-${field}-missing`,
          fieldId: `invoice-${field.replaceAll("_", "-")}`,
          message: `${label}: ${t(...blockerCopy.money)}`,
        });
    }
    if (!validTrackedDate(invoice.invoice_date ?? ""))
      postIssues.push({
        id: "invoice-date-missing",
        fieldId: "invoice-date",
        message: t("Choose an invoice date.", "تاریخ فاکتور را انتخاب کنید."),
      });
    if (!invoice.received_at || Number.isNaN(Date.parse(invoice.received_at))) {
      if (!receivedLocal.date || receivedError === "date")
        postIssues.push({
          id: "invoice-received-date-missing",
          fieldId: "invoice-received-date",
          message: t(
            "Choose a valid received date.",
            "تاریخ دریافت معتبر انتخاب کنید.",
          ),
        });
      if (
        !receivedLocal.time ||
        receivedError === "time" ||
        receivedError === "nonexistent"
      )
        postIssues.push({
          id: "invoice-received-time-missing",
          fieldId: "invoice-received-time",
          message: t(
            "Enter a valid store-local time using HH:mm.",
            "زمان معتبر محلی فروشگاه را به صورت HH:mm وارد کنید.",
          ),
        });
    }
    if (!invoice.receiving_employee?.trim())
      postIssues.push({
        id: "invoice-employee-missing",
        fieldId: "invoice-employee",
        message: t(
          "Choose the receiving employee.",
          "کارمند دریافت‌کننده را انتخاب کنید.",
        ),
      });
    for (const [index, line] of invoice.lines.entries()) {
      const product = state.products.find(
        (item) =>
          item.company_id === invoice.company_id &&
          item.code === line.product_code,
      );
      const add = (kind: InvoiceBlocker, field: string) =>
        postIssues.push({
          id: `invoice-${index}-${kind}-missing`,
          fieldId: `invoice-line-${index}-${field}`,
          message: `${t("Line", "ردیف")} ${index + 1}: ${t(...blockerCopy[kind])}`,
        });
      if (
        !product &&
        !(line.product_code === "NEW" && line.new_name_en?.trim()) &&
        acceptedInvoiceUnits(line) > 0
      )
        add("matching", "matching");
      if (!validInvoiceLineQuantity(line)) add("quantity", "invoiced");
      else if (!validInvoiceLineReceived(line)) add("quantity", "delivered");
      if (
        !state.config.pricing_categories.some(
          (category) =>
            category.key ===
            (line.pricing_category ?? product?.pricing_category),
        )
      )
        postIssues.push({
          id: `invoice-${index}-category-missing`,
          fieldId: `invoice-line-${index}-category`,
          message: `${t("Line", "ردیف")} ${index + 1}: ${t("Choose a pricing category.", "دسته قیمت‌گذاری را انتخاب کنید.")}`,
        });
      else if (!workspace.lineDetails[index]?.costValid) add("cost", "cost");
      if (
        line.product_code === "NEW" &&
        line.barcode &&
        conflictingBarcodeProduct(
          state.products,
          invoice.company_id,
          line.barcode,
        )
      )
        add("barcode", "barcode");
      if (!line.review_confirmed) add("review", "confirm");
      if (!line.date_confirmed) add("date", "track");
      else if (line.date_tracking && !line.date_value) add("date", "date");
      if (
        product &&
        workspace.lineDetails[index]?.manual &&
        acceptedInvoiceUnits(line) > 0 &&
        !line.short_dated &&
        !line.manual_price_decision
      )
        add("manual_price", "manual");
    }
  }
  const issue = (fieldId: string) =>
    postIssues.find((item) => item.fieldId === fieldId)?.message;
  const previewMoney = (value: string) =>
    /^\d+(?:\.\d{1,2})?$/.test(value) ? (
      <ReadingMoney value={value} currency={state.config.company.currency} />
    ) : (
      <span className="muted">—</span>
    );

  // Refreshing a processing draft resumes the honest simulated reading state.
  useEffect(() => {
    if (!canReadWorkspace || invoice.status !== "reading") return;
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
  }, [invoice.id, invoice.status, canReadWorkspace, updateInvoice]);

  useEffect(() => {
    const applyDemoAnswer = () => {
      if (!canReadWorkspace || !active || locked || !lowerLines.length) return;
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
  }, [active, locked, lowerLines.length, canReadWorkspace, updateInvoice]);

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
        setDetailsOpen(manual);
        setMessage("");
        setUploadError("");
        setOpenLines({});
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

  async function attachFile(file: File) {
    const targetInvoiceId = invoice.id;
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
          invoice.status === "posted"
            ? "invoices.attach_posted_original"
            : "invoices.edit",
        );
        if (!attachedId) return null;
        setUploadError("");
        setMessage("");
        setSelectedView(null);
        setDetailsOpen(false);
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
    if (line.sold_by === "weight")
      setInvoiceWeightQuantity(
        line,
        value,
        unit === "units" ? "lb" : unit,
        state.config,
      );
    else
      setEachInvoiceLineQuantity(
        line,
        value,
        unit === "cases" ? "cases" : "units",
        pack,
      );
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
      draft.invoice.lines[index].review_confirmed = false;
      if (recalculate) recalculateInvoice(draft.invoice, draft.config);
    });
    setMessage("");
  }

  async function post() {
    if (blockers.length) {
      setAttemptedPost(true);
      setDetailsOpen(true);
      setOpenLines(
        Object.fromEntries(
          invoice.lines.map((_, index) => [`${invoice.id}:${index}`, true]),
        ),
      );
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
    setMessage(
      t(
        "Posted. Received, approvals, alerts, and supplier ledger are updated.",
        "ثبت شد. دریافت‌شده‌ها، تأییدها، هشدارها و دفتر تأمین‌کننده به‌روز شدند.",
      ),
    );
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
  const savedDrafts = [
    ...(state.invoices?.filter(
      (item) =>
        item.id !== invoice.id &&
        (item.status !== "empty" || unreadOriginal(item)) &&
        item.status !== "posted" &&
        (branch === "all" ||
          item.branch === branch ||
          item.reviewer_origin_location_id === branch),
    ) ?? []),
    ...(!routeId &&
    (active || unreadOriginal(invoice)) &&
    !locked &&
    canReadWorkspace &&
    (branch === "all" || invoiceLocation === branch)
      ? [invoice]
      : []),
  ].filter((saved) => {
    if (tab === "drafts")
      return saved.status === "draft" || unreadOriginal(saved);
    if (tab === "processing") return saved.status === "reading";
    if (saved.status !== "review") return false;
    const needsReview = (workspace.blockersById[saved.id] ?? []).length > 0;
    return tab === "needs_review"
      ? needsReview
      : tab === "ready_to_post" && !needsReview;
  });
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
    setDetailsOpen(true);
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
      <DataTable
        className="invoice-saved-table"
        columns={[
          {
            key: "invoice",
            label: t("Invoice", "فاکتور"),
            required: true,
            priority: 1,
          },
          {
            key: "supplier",
            label: t("Supplier", "تأمین‌کننده"),
            priority: 2,
          },
          { key: "file", label: t("Original file", "فایل اصلی"), priority: 3 },
          {
            key: "status",
            label: t("Status", "وضعیت"),
            required: true,
            priority: 1,
          },
          { key: "action", label: t("Action", "عملیات"), actions: true },
        ]}
        // Not a phone list: a draft opens with its button (Resume draft /
        // Continue), not a row link. Invoice, status and the button always
        // stay visible; supplier and file fold into the row details.
      >
        <thead>
          <tr>
            <th scope="col">{t("Invoice", "فاکتور")}</th>
            <th scope="col">{t("Supplier", "تأمین‌کننده")}</th>
            <th scope="col">{t("Original file", "فایل اصلی")}</th>
            <th scope="col">{t("Status", "وضعیت")}</th>
            <th scope="col">{t("Action", "عملیات")}</th>
          </tr>
        </thead>
        <tbody>
          {savedDrafts.map((saved) => (
            <tr key={saved.id}>
              <td>
                <strong>
                  {saved.supplier_invoice_number ? (
                    <LtrText>{saved.supplier_invoice_number}</LtrText>
                  ) : (
                    t("Draft", "پیش‌نویس")
                  )}
                </strong>
              </td>
              <td>
                <LtrValue value={saved.supplier} />
              </td>
              <td>
                {saved.file_name ? (
                  <LtrText>{saved.file_name}</LtrText>
                ) : (
                  <NotAdded />
                )}
              </td>
              <td>
                <Badge tone={unreadOriginal(saved) ? "info" : "neutral"}>
                  {unreadOriginal(saved)
                    ? t("Not read yet", "هنوز خوانده نشده")
                    : saved.status === "reading"
                      ? t("Processing", "در حال پردازش")
                      : saved.status === "review"
                        ? t("In review", "در حال بررسی")
                        : t("Draft", "پیش‌نویس")}
                </Badge>
              </td>
              <td>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={() => resume(saved)}
                >
                  {unreadOriginal(saved)
                    ? t("Continue", "ادامه")
                    : t("Resume draft", "ادامه پیش‌نویس")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Card>
  ) : null;
  if (!canReadWorkspace)
    return (
      <>
        <PageHeader
          title={t("Invoices", "فاکتورها")}
          description={t(
            "Deliveries and supplier invoices",
            "تحویل‌ها و فاکتورهای تأمین‌کننده",
          )}
          actions={
            <Button onClick={() => start()}>
              {t("New invoice", "فاکتور جدید")}
            </Button>
          }
        />
        <EmptyState>
          {t(
            "Choose an invoice in your branch, or start a new invoice.",
            "فاکتوری در شعبه خود انتخاب کنید یا فاکتور جدید شروع کنید.",
          )}
        </EmptyState>
        {draftList}
      </>
    );
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
      {routeId === invoice.id && (active || unreadOriginal(invoice)) && (
        <a
          className="back-link invoice-back-link"
          href="#invoices"
          onClick={(event) => {
            event.preventDefault();
            chooseTab(listTab);
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t("Back to Invoices", "بازگشت به فاکتورها")}
        </a>
      )}
      <PageHeader
        title={t("Invoices", "فاکتورها")}
        description={t(
          "Deliveries and supplier invoices",
          "تحویل‌ها و فاکتورهای تأمین‌کننده",
        )}
        actions={
          <Button
            variant={active && !locked ? "neutral" : "primary"}
            onClick={() => start()}
            disabled={uploadPending || entryPending}
            aria-busy={uploadPending || entryPending}
          >
            {t("New invoice", "فاکتور جدید")}
          </Button>
        }
      />
      <Tabs
        aria-label={t("Invoice views", "نمای فاکتورها")}
        value={tab}
        onChange={(value) => {
          chooseTab(value as InvoiceTab);
        }}
        options={[
          { value: "drafts", label: t("Drafts", "پیش‌نویس‌ها") },
          { value: "processing", label: t("Processing", "در حال پردازش") },
          { value: "needs_review", label: t("Needs review", "نیازمند بررسی") },
          { value: "ready_to_post", label: t("Ready to post", "آماده ثبت") },
          { value: "posted", label: t("Posted", "ثبت‌شده") },
          { value: "cancelled", label: t("Cancelled", "لغوشده") },
        ]}
      />
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
                            setDetailsOpen(false);
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
            <input
              ref={originalInput}
              className="ui-file-input"
              hidden
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              aria-label={t("Attach original", "پیوست اصل فاکتور")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void attachFile(file);
                event.target.value = "";
              }}
            />
            {uploadError && (
              <p role="alert" className="form-error">
                {uploadError}
              </p>
            )}
          </aside>
        </div>
      ) : (
        <div
          className={`invoice-workspace${!active ? " invoice-start-stack" : " invoice-review-workspace"}`}
        >
          <aside
            className="invoice-document-pane"
            aria-label={t("Original invoice", "اصل فاکتور")}
          >
            <Card
              title={t("Original invoice", "اصل فاکتور")}
              className="invoice-document-card"
            >
              {!locked && (
                <>
                  <p className="muted">
                    {t(
                      "AI invoice reading is simulated",
                      "خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
                    )}
                  </p>
                  {!invoice.original_available &&
                    (invoice.entry_mode !== "manual" ||
                      !invoice.lines.length) && (
                      <div
                        className="invoice-entry-choices"
                        aria-label={t(
                          "New invoice entry method",
                          "روش ورود فاکتور جدید",
                        )}
                      >
                        <Button
                          variant={
                            invoice.entry_mode === "manual"
                              ? "neutral"
                              : "primary"
                          }
                          onClick={() => start(false)}
                          disabled={entryPending}
                          aria-busy={entryPending}
                        >
                          {t("Upload", "بارگذاری")}
                        </Button>
                        {can("invoices.enter_manual", scope) && (
                          <Button
                            variant={
                              invoice.entry_mode === "manual"
                                ? "primary"
                                : "neutral"
                            }
                            onClick={() => start(true)}
                            disabled={entryPending}
                            aria-busy={entryPending}
                          >
                            {t("Manual entry", "ورود دستی")}
                          </Button>
                        )}
                      </div>
                    )}
                  <div id="invoice-original-field">
                    <Field
                      label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
                      error={uploadError || issue("invoice-original-field")}
                      hint={
                        uploadPending
                          ? t("Saving original…", "در حال ذخیره اصل فایل…")
                          : undefined
                      }
                    >
                      <Dropzone
                        id="invoice-original"
                        accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        fileName={invoice.file_name}
                        fileSize={fileSize}
                        onChange={(file) => {
                          void attachFile(file);
                        }}
                        disabled={invoice.status === "reading" || entryPending}
                        onRemove={() => {
                          updateInvoice((draft) => {
                            if (draft.invoice.status === "posted") return;
                            draft.invoice.file_name = undefined;
                            draft.invoice.file_type = undefined;
                            draft.invoice.file_data = undefined;
                            draft.invoice.file_size = undefined;
                          });
                          setUploadError("");
                        }}
                      />
                    </Field>
                  </div>
                </>
              )}
              <OriginalInvoice
                invoice={invoice}
                bare
                onAttach={
                  !invoice.original_available && invoice.entry_mode === "manual"
                    ? () =>
                        window.document
                          .querySelector<HTMLInputElement>(
                            ".invoice-document-card input[type=file]",
                          )
                          ?.click()
                    : undefined
                }
              />
            </Card>
          </aside>
          <div className="invoice-review-pane">
            <ImportedReadingNote invoice={invoice} />
            <div id="invoice-missing-list" tabIndex={-1}>
              <WhatsMissing issues={postIssues} />
            </div>
            {invoice.status === "reading" ? (
              <Card className="invoice-reading-state">
                <p role="status">
                  {t("Reading invoice…", "در حال خواندن فاکتور…")}
                </p>
                <p className="muted">
                  {t(
                    "AI invoice reading is simulated",
                    "خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
                  )}
                </p>
              </Card>
            ) : !active ? (
              <Card title={t("Drafts", "پیش‌نویس‌ها")}>
                <EmptyState>
                  {t(
                    "No drafts. Upload a file or start a manual invoice.",
                    "پیش‌نویسی نیست. فایل بارگذاری کنید یا فاکتور دستی شروع کنید.",
                  )}
                </EmptyState>
              </Card>
            ) : (
              <>
                {tab === "drafts" && (
                  <Card
                    title={t("Drafts", "پیش‌نویس‌ها")}
                    className="invoice-draft-list"
                  >
                    <DataTable
                      columns={[
                        {
                          key: "invoice",
                          required: true,
                          priority: 0,
                          minWidth: 240,
                          mobilePrimary: true,
                        },
                        { key: "supplier", priority: 2, mobilePrimary: true },
                        { key: "branch", priority: 4 },
                        { key: "date", priority: 3 },
                        { key: "status", priority: 1, mobilePrimary: true },
                      ]}
                    >
                      <thead>
                        <tr>
                          <th>{t("Invoice", "فاکتور")}</th>
                          <th>{t("Supplier", "تأمین‌کننده")}</th>
                          <th>{t("Branch", "شعبه")}</th>
                          <th>{t("Date", "تاریخ")}</th>
                          <th>{t("Status", "وضعیت")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <LtrText className="invoice-draft-reference">
                              {invoice.supplier_invoice_number || "—"}
                            </LtrText>
                          </td>
                          <td>
                            <LtrText>{invoice.supplier || "—"}</LtrText>
                          </td>
                          <td>
                            {configuredBranchLabel(
                              state.config,
                              invoice.branch,
                              lang,
                            )}
                          </td>
                          <td>
                            <DateText value={invoice.invoice_date} />
                          </td>
                          <td>
                            <Badge tone="neutral">
                              {t("Draft", "پیش‌نویس")}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </DataTable>
                  </Card>
                )}
                <section className="invoice-summary-section">
                  <div
                    className="invoice-summary-grid"
                    aria-label={t("Delivery summary", "خلاصه تحویل")}
                  >
                    <SummaryTile
                      label={t("Subtotal", "جمع پیش از مالیات")}
                      value={previewMoney(invoice.subtotal)}
                      tone="lavender"
                    />
                    <SummaryTile
                      label={t("Tax", "مالیات")}
                      value={previewMoney(invoice.tax)}
                      tone="sky"
                    />
                    <SummaryTile
                      label={t(
                        "Shorts and refused deduction",
                        "کسر کسری و اقلام برگشتی",
                      )}
                      value={
                        <ReadingMoney
                          value={new Decimal(totals.total)
                            .plus(refused.total)
                            .negated()
                            .toFixed(2)}
                          currency={state.config.company.currency}
                        />
                      }
                      tone="lavender"
                    />
                    <SummaryTile
                      label={t("Payable", "قابل پرداخت")}
                      value={
                        <ReadingMoney
                          currency={state.config.company.currency}
                          value={
                            /^[0-9]+(?:\.[0-9]{1,2})?$/.test(
                              invoice.final_total,
                            )
                              ? new Decimal(invoice.final_total)
                                  .minus(totals.total)
                                  .minus(refused.total)
                                  .toFixed(2)
                              : "0"
                          }
                        />
                      }
                      tone="sky"
                    />
                  </div>
                  <p className="muted invoice-summary-note">
                    {t(
                      "This is the amount of this invoice, not a supplier balance. Received records only physically delivered units.",
                      "این مبلغ همین فاکتور است، نه مانده تأمین‌کننده. دریافت‌شده‌ها فقط واحدهای واقعاً تحویل‌شده را ثبت می‌کند.",
                    )}
                  </p>
                </section>
                <Card className="invoice-header-card">
                  <h2>
                    <button
                      type="button"
                      className={`invoice-details-toggle${detailsOpen ? " is-open" : ""}`}
                      aria-expanded={detailsOpen}
                      aria-controls="invoice-details-fields"
                      onClick={() => setDetailsOpen((current) => !current)}
                    >
                      {t("Invoice details", "جزئیات فاکتور")}
                      <ChevronDown
                        size={20}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </button>
                  </h2>
                  <p className="muted invoice-details-meta">
                    <span>
                      <LtrText>{invoice.supplier}</LtrText>
                    </span>
                    <span>
                      <LtrText>
                        {invoice.supplier_invoice_number || "—"}
                      </LtrText>
                    </span>
                    <span>
                      {configuredBranchLabel(
                        state.config,
                        invoiceLocation,
                        lang,
                      )}
                    </span>
                    <span>
                      <DateText value={invoice.invoice_date} />
                    </span>
                  </p>
                  {locked && can("invoices.relocate", scope) && (
                    <div className="invoice-location-correction">
                      <Button
                        variant="neutral"
                        onClick={() => {
                          setMoveTarget(
                            branches.find(
                              (location) => location !== invoiceLocation,
                            ) ?? "",
                          );
                          setMoveReason("");
                          setMoveError("");
                          setMoveOpen(true);
                        }}
                      >
                        {t("Move invoice", "انتقال فاکتور")}
                      </Button>
                    </div>
                  )}
                  {!locked &&
                    locationSuggestion &&
                    locationSuggestion !== invoiceLocation && (
                      <div className="banner info">
                        <p>
                          {t(
                            "Suggested location from Ship to:",
                            "مکان پیشنهادی از نشانی تحویل:",
                          )}{" "}
                          {configuredBranchLabel(
                            state.config,
                            locationSuggestion,
                            lang,
                          )}
                        </p>
                        <Button
                          variant="neutral"
                          onClick={() =>
                            updateInvoice(
                              (draft, currentActor) =>
                                setInvoiceLocation(
                                  draft,
                                  currentActor,
                                  locationSuggestion,
                                ),
                              "invoices.assign_receiving_location",
                            )
                          }
                        >
                          {t(
                            "Use suggested location",
                            "استفاده از مکان پیشنهادی",
                          )}
                        </Button>
                      </div>
                    )}
                  <div className="invoice-details-status">
                    <Badge tone={locked ? "approved" : "progress"}>
                      {locked
                        ? t("Posted", "ثبت‌شده")
                        : blockers.length
                          ? t("Needs review", "نیازمند بررسی")
                          : t("Ready to post", "آماده ثبت")}
                    </Badge>
                    <span className="muted">
                      {t(
                        "Changes save automatically in this browser.",
                        "تغییرات در این مرورگر خودکار ذخیره می‌شوند.",
                      )}
                    </span>
                  </div>
                  {detailsOpen && (
                    <ReadingCheckProvider
                      fields={invoice.low_confidence_fields}
                      idPrefix="invoice-check-header"
                      onEdit={(field, change) => {
                        readingEdit.current = { field };
                        try {
                          change();
                        } finally {
                          readingEdit.current = null;
                        }
                      }}
                      onAcknowledge={(field) => {
                        updateInvoice((draft, currentActor) =>
                          acknowledgeInvoiceCheck(draft, currentActor, field),
                        );
                      }}
                    >
                      <fieldset
                        id="invoice-details-fields"
                        disabled={locked}
                        className="form-grid invoice-details-form invoice-details-sections"
                      >
                        <div className="invoice-details-group">
                          <h3>{t("Invoice", "فاکتور")}</h3>
                          <ReadingUnknownChecks
                            fields={invoice.low_confidence_fields}
                            record={invoice}
                            known={[
                              "supplier",
                              "supplier_invoice_number",
                              "invoice_date",
                              "due_date",
                              "subtotal",
                              "tax",
                              "final_total",
                            ]}
                          />
                          <Field
                            label={t("Supplier", "تأمین‌کننده")}
                            error={issue("invoice-supplier")}
                          >
                            <Select
                              id="invoice-supplier"
                              value={invoice.supplier}
                              onChange={(value) => {
                                if (value === "__add_supplier") {
                                  setSupplierToEdit(undefined);
                                  setSupplierEditorOpen(true);
                                  return;
                                }
                                updateInvoice((draft) => {
                                  const supplier = supplierRecords(draft).find(
                                    (record) =>
                                      record.company_id ===
                                        draft.config.company.seed_key &&
                                      supplierMatches(record, value),
                                  );
                                  const previousSupplier =
                                    draft.invoice.supplier;
                                  draft.invoice.supplier = value;
                                  clearInvoiceOrder(draft.invoice);
                                  draft.invoice.supplier_confirmed =
                                    supplier?.status === "confirmed";
                                  setInvoicePaymentTerms(
                                    draft.invoice,
                                    supplier?.payment_terms ?? "",
                                  );
                                  if (supplier)
                                    markInvoiceSupplierReview(
                                      draft.invoice,
                                      supplier,
                                      previousSupplier,
                                    );
                                  draft.invoice.lower_price_answers = undefined;
                                });
                              }}

                              disabled={locked}
                              options={[
                                {
                                  value: "",
                                  label: t(
                                    "Choose supplier",
                                    "انتخاب تأمین‌کننده",
                                  ),
                                },
                                ...supplierChoices(state).map((supplier) => ({
                                  value: supplier.name,
                                  label: `\u2066${supplier.name}\u2069`,
                                })),
                                ...(!supplierChoices(state).some((record) =>
                                  supplierMatches(record, invoice.supplier),
                                ) && invoice.supplier
                                  ? [
                                      {
                                        value: invoice.supplier,
                                        label: invoice.supplier,
                                      },
                                    ]
                                  : []),
                                {
                                  value: "__add_supplier",
                                  label: t(
                                    "+ Add supplier",
                                    "+ افزودن تأمین‌کننده",
                                  ),
                                },
                              ]}
                            />
                          </Field>
                          <Field
                            label={t(
                              "Supplier invoice number (optional)",
                              "شماره فاکتور تأمین‌کننده (اختیاری)",
                            )}
                          >
                            <input
                              id="invoice-number"
                              dir="ltr"
                              value={invoice.supplier_invoice_number}
                              onChange={(event) => {
                                const inputValue = event.currentTarget.value;
                                updateInvoice((draft) => {
                                  draft.invoice.supplier_invoice_number =
                                    inputValue;
                                });
                              }}
                              placeholder={t(
                                "Assigned on posting if blank",
                                "اگر خالی باشد هنگام ثبت تعیین می‌شود",
                              )}
                            />
                          </Field>
                          <Field
                            label={t(
                              "Order reference (optional)",
                              "مرجع سفارش (اختیاری)",
                            )}
                          >
                            <input
                              dir="ltr"
                              value={invoice.order_reference ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateInvoice((draft) => {
                                  draft.invoice.order_reference = value;
                                });
                              }}
                            />
                          </Field>
                          <Field
                            label={t("Invoice date", "تاریخ فاکتور")}
                            error={issue("invoice-date")}
                          >
                            <DateField
                              id="invoice-date"
                              dir="ltr"
                              value={invoice.invoice_date ?? ""}
                              onChange={(value) =>
                                updateInvoice((draft) => {
                                  draft.invoice.invoice_date = value;
                                  refreshInvoiceDueDate(draft.invoice);
                                })
                              }
                            />
                          </Field>
                        </div>
                        <div className="invoice-details-group">
                          <h3>{t("Receiving", "دریافت")}</h3>
                          <Field
                            label={t("Received date", "تاریخ دریافت")}
                            error={
                              receivedError === "date"
                                ? t(
                                    "Choose a valid received date.",
                                    "تاریخ دریافت معتبر انتخاب کنید.",
                                  )
                                : issue("invoice-received-date")
                            }
                          >
                            <DateField
                              id="invoice-received-date"
                              value={receivedLocal.date}
                              disabled={locked}
                              onChange={(value) =>
                                editReceived(value, receivedLocal.time)
                              }
                            />
                          </Field>
                          <Field
                            label={t("Received time", "زمان دریافت")}
                            hint={t(
                              "Store local time, 24-hour HH:mm",
                              "زمان محلی فروشگاه، ۲۴ ساعته HH:mm",
                            )}
                            error={
                              receivedError === "nonexistent"
                                ? t(
                                    "This time does not exist when daylight saving starts. Choose another time.",
                                    "این زمان هنگام شروع ساعت تابستانی وجود ندارد. زمان دیگری انتخاب کنید.",
                                  )
                                : receivedError === "time"
                                  ? t(
                                      "Enter a valid time using HH:mm.",
                                      "زمان معتبر به صورت HH:mm وارد کنید.",
                                    )
                                  : undefined
                            }
                          >
                            <input
                              id="invoice-received-time"
                              className="control-narrow"
                              type="text"
                              dir="ltr"
                              inputMode="numeric"
                              placeholder="HH:mm"
                              value={receivedLocal.time}
                              onChange={(event) =>
                                editReceived(
                                  receivedLocal.date,
                                  event.target.value,
                                )
                              }
                            />
                          </Field>
                          <Field
                            label={t(
                              "Receiving employee",
                              "کارمند دریافت‌کننده",
                            )}
                            error={issue("invoice-employee")}
                          >
                            <Select
                              id="invoice-employee"
                              value={invoice.receiving_employee ?? ""}
                              onChange={(value) =>
                                updateInvoice((draft) => {
                                  draft.invoice.receiving_employee = value;
                                })
                              }

                              disabled={locked}
                              options={demoUsers
                                .filter((user) => user.role !== "cashier")
                                .map((user) => ({
                                  value: user.name,
                                  label: demoUserLabel(user.name, lang),
                                }))}
                            />
                          </Field>
                          <Field
                            label={t("Location", "مکان")}
                            error={issue("invoice-location")}
                          >
                            <Select
                              id="invoice-location"
                              value={invoiceLocation}
                              disabled={
                                locked ||
                                !can(
                                  "invoices.assign_receiving_location",
                                  scope,
                                )
                              }
                              onChange={(value) => {
                                updateInvoice((draft, currentActor) => {
                                  setInvoiceLocation(
                                    draft,
                                    currentActor,
                                    value,
                                  );
                                }, "invoices.assign_receiving_location");
                              }}

                              options={branches.map((item) => ({
                                value: item,
                                label: configuredBranchLabel(
                                  state.config,
                                  item,
                                  lang,
                                ),
                              }))}
                            />
                          </Field>
                          <Field
                            label={t(
                              "Ship to (optional)",
                              "نشانی تحویل (اختیاری)",
                            )}
                          >
                            <input
                              value={invoice.ship_to ?? ""}
                              disabled={locked}
                              onChange={(event) => {
                                const inputValue = event.currentTarget.value;
                                updateInvoice((draft) => {
                                  draft.invoice.ship_to = inputValue;
                                });
                              }}
                            />
                          </Field>
                        </div>
                        <div className="invoice-details-group">
                          <h3>
                            {t("Amounts and payment", "مبلغ‌ها و پرداخت")}
                          </h3>
                          <Field
                            label={t("Subtotal", "جمع پیش از مالیات")}
                            className={
                              readingTotals.subtotalDifference
                                ? "please-check-field"
                                : undefined
                            }
                            error={issue("invoice-subtotal")}
                          >
                            <input
                              id="invoice-subtotal"
                              dir="ltr"
                              className="control-narrow"
                              inputMode="decimal"
                              value={invoice.subtotal}
                              onChange={(event) => {
                                const inputValue = event.currentTarget.value;
                                updateInvoice((draft) => {
                                  setInvoiceAmount(
                                    draft.invoice,
                                    "subtotal",
                                    inputValue,
                                  );
                                });
                              }}
                            />
                          </Field>
                          <Field
                            label={t("Tax", "مالیات")}
                            error={issue("invoice-tax")}
                          >
                            <input
                              id="invoice-tax"
                              dir="ltr"
                              className="control-narrow"
                              inputMode="decimal"
                              value={invoice.tax}
                              onChange={(event) => {
                                const inputValue = event.currentTarget.value;
                                updateInvoice((draft) => {
                                  setInvoiceAmount(
                                    draft.invoice,
                                    "tax",
                                    inputValue,
                                  );
                                });
                              }}
                            />
                          </Field>
                          <Field
                            label={t("Final total", "جمع نهایی")}
                            className={
                              readingTotals.totalDifference
                                ? "please-check-field"
                                : undefined
                            }
                            error={issue("invoice-final-total")}
                          >
                            <input
                              id="invoice-final-total"
                              dir="ltr"
                              className="control-narrow"
                              inputMode="decimal"
                              value={invoice.final_total}
                              onChange={(event) => {
                                const inputValue = event.currentTarget.value;
                                updateInvoice((draft) => {
                                  setInvoiceAmount(
                                    draft.invoice,
                                    "final_total",
                                    inputValue,
                                  );
                                });
                              }}
                            />
                          </Field>
                          <Field
                            label={t(
                              "Due date (optional)",
                              "تاریخ سررسید (اختیاری)",
                            )}
                          >
                            <DateField
                              id="invoice-due-date"
                              dir="ltr"
                              value={invoice.due_date ?? ""}
                              onChange={(value) =>
                                updateInvoice((draft) => {
                                  draft.invoice.due_date = value;
                                  draft.invoice.due_date_manual = true;
                                })
                              }
                            />
                          </Field>
                          <PaymentTermsControl
                            key={`${invoice.id}:${invoice.supplier}`}
                            id="invoice-payment-terms"
                            error={issue("invoice-payment-terms")}
                            label={t(
                              "Payment terms (optional)",
                              "شرایط پرداخت (اختیاری)",
                            )}
                            value={invoice.payment_terms ?? ""}
                            disabled={locked}
                            onChange={(value) =>
                              updateInvoice((draft) =>
                                setInvoicePaymentTerms(draft.invoice, value),
                              )
                            }
                          />
                        </div>
                      </fieldset>
                    </ReadingCheckProvider>
                  )}
                  <InvoiceTotalsWarnings invoice={invoice} />
                  {!locked && invoiceTotalDiffers(invoice) && (
                    <p className="banner pending" role="status">
                      {t(
                        "Final total differs from Subtotal + Tax. Check the amount on the original invoice; this warning does not block posting.",
                        "جمع نهایی با جمع پیش از مالیات و مالیات متفاوت است. مبلغ اصل فاکتور را بررسی کنید؛ این هشدار مانع ثبت نیست.",
                      )}
                    </p>
                  )}
                  {!locked &&
                    supplierRecord &&
                    (blockers.includes("supplier_details") ||
                      blockers.includes("supplier_pending") ||
                      blockers.includes("supplier_review")) && (
                      <div className="invoice-supplier-review">
                        <p className="muted">
                          {t(
                            "Waiting for Owner or Manager to complete and confirm supplier details.",
                            "در انتظار تکمیل و تأیید اطلاعات تأمین‌کننده توسط مالک یا مدیر.",
                          )}
                        </p>
                        {can("suppliers.confirm", scope) && (
                          <div className="actions">
                            <Button
                              variant="neutral"
                              onClick={() => {
                                setSupplierToEdit(supplierRecord);
                                setSupplierEditorOpen(true);
                              }}
                            >
                              {t("Edit supplier", "ویرایش تأمین‌کننده")}
                            </Button>
                            <Button
                              variant="tinted"
                              onClick={() => {
                                if (
                                  missingInvoiceSupplierDetails(supplierRecord)
                                    .length
                                ) {
                                  setSupplierToEdit(supplierRecord);
                                  setSupplierEditorOpen(true);
                                  return;
                                }
                                updateInvoice(
                                  (draft, currentActor) =>
                                    confirmInvoiceSupplierReview(
                                      draft,
                                      currentActor,
                                    ),
                                  "suppliers.confirm",
                                );
                              }}
                            >
                              {t("Confirm supplier", "تأیید تأمین‌کننده")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  {supplierRecord?.created_from_import && (
                    <p className="muted">
                      {t(
                        "Created from an imported reading",
                        "از یک خوانش واردشده ایجاد شده است",
                      )}
                    </p>
                  )}
                  {invoice.number_is_system_assigned && (
                    <p className="muted">
                      {t(
                        "Invoice number was system-assigned.",
                        "شماره فاکتور توسط سیستم تعیین شده است.",
                      )}
                    </p>
                  )}
                </Card>
                <div id="invoice-order-review">
                  <InvoiceOrderReview />
                </div>
                <Card
                  title={t("Review invoice lines", "بررسی ردیف‌های فاکتور")}
                  className="invoice-lines-card"
                >
                  <p className="muted">
                    {t(
                      "Choose Cases or Units and confirm the product, pack, quantities, cost, and date decision on each line.",
                      "کارتن یا واحد را انتخاب کنید و کالا، اندازه کارتن، تعداد، هزینه و تصمیم پیگیری تاریخ هر ردیف را تأیید کنید.",
                    )}
                  </p>
                  {!invoice.lines.length && (
                    <EmptyState>
                      {t(
                        "No lines. Add a product below to start your manual draft.",
                        "ردیفی نیست. برای شروع پیش‌نویس دستی، کالا را در زیر اضافه کنید.",
                      )}
                    </EmptyState>
                  )}
                  <DataTable
                    className="invoice-lines-table"
                    responsive={false}
                    columns={[
                      { width: "34%" },
                      { width: "18%", align: "end" },
                      { width: "18%", align: "end" },
                      { width: "13%", align: "end" },
                      { width: "17%", align: "end" },
                    ]}
                  >
                    <thead>
                      <tr>
                        <th scope="col">{t("Product", "کالا")}</th>
                        <th scope="col">{t("Quantity", "تعداد")}</th>
                        <th scope="col">
                          {t(
                            "Unit cost before tax",
                            "هزینه هر واحد پیش از مالیات",
                          )}
                        </th>
                        <th scope="col">{t("Line total", "جمع ردیف")}</th>
                        <th scope="col">{t("Selling price", "قیمت فروش")}</th>
                      </tr>
                    </thead>
                    {invoice.lines.map((line, index) => {
                      const product = state.products.find(
                        (item) =>
                          item.code === line.product_code &&
                          item.company_id === invoice.company_id,
                      );
                      const category = state.config.pricing_categories.find(
                        (item) =>
                          item.key ===
                          (line.pricing_category ??
                            product?.pricing_category ??
                            "grocery"),
                      )!;
                      const short = lineShort(line);
                      const refusedLine = lineRefused(line);
                      const manual = product
                        ? workspace.lineDetails[index]?.manual
                        : null;
                      const manualReplacement =
                        workspace.lineDetails[index]?.manualReplacement;
                      const price = workspace.lineDetails[index]?.price ?? null;
                      const costValid =
                        workspace.lineDetails[index]?.costValid ?? false;
                      const oldPrice =
                        product?.branch_prices?.[invoice.branch] ||
                        product?.selling_price ||
                        null;
                      const name =
                        lang === "fa"
                          ? (product?.name_fa ??
                            line.new_name_fa ??
                            line.description)
                          : (product?.name_en ?? line.description);
                      const dateSuggestions =
                        workspace.lineDetails[index]?.dateSuggestions ?? [];
                      const lineKey = `${invoice.id}:${index}`;
                      const needsDecision =
                        !locked &&
                        (!line.review_confirmed ||
                          !line.date_confirmed ||
                          (line.date_tracking && !line.date_value) ||
                          (manualReplacement &&
                            acceptedInvoiceUnits(line) > 0 &&
                            !line.short_dated &&
                            !line.manual_price_decision) ||
                          !costValid);
                      const expanded =
                        needsDecision || (openLines[lineKey] ?? false);
                      const toggleLine = () =>
                        setOpenLines((current) => ({
                          ...current,
                          [lineKey]: !expanded,
                        }));
                      return (
                        <ReadingCheckProvider
                          key={`${index}-${line.product_code}`}
                          fields={line.low_confidence_fields}
                          idPrefix={`invoice-check-line-${index}`}
                          onEdit={(field, change) => {
                            readingEdit.current = { field, lineIndex: index };
                            try {
                              change();
                            } finally {
                              readingEdit.current = null;
                            }
                          }}
                          onAcknowledge={(field) => {
                            updateInvoice((draft, currentActor) =>
                              acknowledgeInvoiceCheck(
                                draft,
                                currentActor,
                                field,
                                index,
                              ),
                            );
                          }}
                        >
                          <tbody
                            className={`invoice-line${expanded ? " is-expanded" : " is-collapsed"}`}
                            data-expanded={expanded}
                            key={`${index}-${line.product_code}`}
                            aria-label={`${t("Line", "ردیف")} ${index + 1}: ${name}`}
                          >
                            <tr
                              className="invoice-line-summary"
                              onClick={(event) => {
                                if (
                                  (event.target as HTMLElement).closest(
                                    "button,input,textarea,[role=combobox],[role=checkbox]",
                                  )
                                )
                                  return;
                                toggleLine();
                              }}
                            >
                              <td>
                                {" "}
                                <div className="invoice-line-heading">
                                  <h3>
                                    <button
                                      type="button"
                                      className="invoice-line-toggle"
                                      aria-expanded={expanded}
                                      aria-controls={`invoice-line-${index}-detail`}
                                      onClick={toggleLine}
                                    >
                                      <LtrText>{index + 1}.</LtrText>{" "}
                                      <ProductName
                                        product={{
                                          name_en:
                                            product?.name_en ??
                                            line.new_name_en ??
                                            line.description,
                                          name_fa:
                                            product?.name_fa ??
                                            line.new_name_fa ??
                                            "",
                                        }}
                                        language={lang}
                                      />
                                      <ChevronDown
                                        size={16}
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </h3>

                                  <p className="muted">
                                    {line.product_code === "NEW" ? (
                                      t(
                                        "No Product Code yet",
                                        "هنوز کد کالا ندارد",
                                      )
                                    ) : (
                                      <LtrText>{line.product_code}</LtrText>
                                    )}
                                    {product?.unit_size && (
                                      <>
                                        {" "}
                                        · <UnitSize value={product.unit_size} />
                                      </>
                                    )}
                                  </p>
                                  <div className="inline-actions">
                                    {line.product_code === "NEW" ||
                                    product?.status === "pending_approval" ? (
                                      <Badge tone="pending">
                                        {t(
                                          "Pending new product",
                                          "کالای جدید در انتظار",
                                        )}
                                      </Badge>
                                    ) : (
                                      <Badge tone="info">
                                        {t("Matched", "تطبیق داده شد")}
                                      </Badge>
                                    )}
                                    {refusedLine.quantity > 0 && (
                                      <Badge tone="info">
                                        {t("Refused", "ردشده")}:{" "}
                                        <LtrText>
                                          {refusedLine.quantity}
                                        </LtrText>
                                      </Badge>
                                    )}
                                    {short.quantity > 0 && (
                                      <Badge tone="danger">
                                        {t("Short", "کسری")}: {short.quantity}
                                      </Badge>
                                    )}
                                    {line.taxable && (
                                      <Badge tone="info">
                                        {t("Taxable", "مشمول مالیات")}
                                      </Badge>
                                    )}
                                    {!!line.low_confidence_fields?.length && (
                                      <Badge tone="pending">
                                        {line.low_confidence_fields.length}{" "}
                                        {t("to check", "برای بررسی")}
                                      </Badge>
                                    )}
                                    {line.review_confirmed && (
                                      <Badge tone="approved">
                                        {t("Confirmed", "تأیید شد")}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="numeric">
                                {" "}
                                {!expanded && (
                                  <>
                                    <span className="invoice-line-mobile-caption">
                                      {t("Quantity", "تعداد")}
                                    </span>
                                    <LtrText>
                                      {line.sold_by === "weight"
                                        ? line.source_received_quantity
                                        : line.qty_received_at_posting}{" "}
                                      /{" "}
                                      {line.sold_by === "weight"
                                        ? `${line.source_quantity} ${line.source_quantity_unit}`
                                        : line.qty_invoiced}
                                    </LtrText>
                                  </>
                                )}
                                {expanded && (
                                  <>
                                    <Field
                                      label={t("Invoiced", "فاکتور شده")}
                                      error={issue(
                                        `invoice-line-${index}-invoiced`,
                                      )}
                                    >
                                      <NumberField
                                        id={`invoice-line-${index}-invoiced`}
                                        disabled={locked}
                                        className="control-narrow"

                                        min="1"
                                        step={
                                          line.sold_by === "weight"
                                            ? "0.001"
                                            : line.quantity_unit === "cases"
                                              ? "0.01"
                                              : "1"
                                        }
                                        dir="ltr"
                                        value={
                                          line.sold_by === "weight"
                                            ? line.quantity_unit === "cases"
                                              ? (line.quantity_entered ?? "")
                                              : (line.source_quantity ?? "")
                                            : (line.quantity_entered ??
                                              line.qty_invoiced)
                                        }
                                        onChange={(value) =>
                                          editLine(
                                            index,
                                            (item) => {
                                              setInvoiceLineQuantity(
                                                item,
                                                value,
                                                item.quantity_unit ?? "units",
                                              );
                                            },
                                            true,
                                          )
                                        }
                                      />
                                    </Field>{" "}
                                    <Field
                                      label={t("Delivered", "تحویل شده")}
                                      error={issue(
                                        `invoice-line-${index}-delivered`,
                                      )}
                                    >
                                      <NumberField
                                        id={`invoice-line-${index}-delivered`}
                                        disabled={locked}
                                        className="control-narrow"

                                        min="0"
                                        max={
                                          line.sold_by === "weight"
                                            ? line.source_quantity
                                            : line.qty_invoiced
                                        }
                                        step={
                                          line.sold_by === "weight"
                                            ? "0.001"
                                            : "1"
                                        }
                                        dir="ltr"
                                        value={
                                          line.sold_by === "weight"
                                            ? (line.source_received_quantity ??
                                              "")
                                            : line.qty_received_at_posting
                                        }
                                        onChange={(value) =>
                                          editLine(index, (item) => {
                                            if (item.sold_by === "weight")
                                              setInvoiceWeightReceived(
                                                item,
                                                value,
                                                state.config,
                                              );
                                            else
                                              item.qty_received_at_posting =
                                                Number(value);
                                          })
                                        }
                                      />
                                    </Field>
                                  </>
                                )}
                              </td>
                              <td className="numeric">
                                {!expanded && (
                                  <>
                                    <span className="invoice-line-mobile-caption">
                                      {t(
                                        "Unit cost before tax",
                                        "هزینه هر واحد پیش از مالیات",
                                      )}
                                    </span>
                                    <LtrText>
                                      <ReadingMoney
                                        value={
                                          line.sold_by === "weight"
                                            ? (line.source_cost_before_tax ??
                                              line.unit_cost_before_tax)
                                            : line.unit_cost_before_tax
                                        }

                                        currency={state.config.company.currency}
                                      />
                                      {line.sold_by === "weight" &&
                                        `/${line.source_cost_unit}`}
                                    </LtrText>
                                  </>
                                )}
                                {expanded && (
                                  <Field
                                    label={t(
                                      "Unit cost before tax",
                                      "هزینه هر واحد پیش از مالیات",
                                    )}
                                    error={
                                      !costValid
                                        ? t(
                                            "Enter a cost of zero or more with up to four decimal places.",
                                            "هزینه صفر یا بیشتر با حداکثر چهار رقم اعشار وارد کنید.",
                                          )
                                        : undefined
                                    }
                                  >
                                    <input
                                      id={`invoice-line-${index}-cost`}
                                      disabled={locked}
                                      dir="ltr"
                                      className="control-narrow"
                                      inputMode="decimal"
                                      value={
                                        line.sold_by === "weight"
                                          ? (line.source_cost_before_tax ?? "")
                                          : line.unit_cost_before_tax
                                      }
                                      onChange={(event) => {
                                        const inputValue =
                                          event.currentTarget.value;
                                        editLine(
                                          index,
                                          (item) => {
                                            if (item.sold_by === "weight") {
                                              setInvoiceWeightCost(
                                                item,
                                                inputValue,
                                                item.source_cost_unit ?? "lb",
                                                state.config,
                                              );
                                              return;
                                            }
                                            item.unit_cost_before_tax =
                                              inputValue;
                                            if (
                                              item.quantity_unit === "cases" &&
                                              /^\d+(?:\.\d{1,4})?$/.test(
                                                item.unit_cost_before_tax,
                                              )
                                            )
                                              item.case_cost_before_tax =
                                                costPerCase(
                                                  item.unit_cost_before_tax,
                                                  item.units_per_case ?? 1,
                                                );
                                          },
                                          true,
                                        );
                                      }}
                                    />
                                  </Field>
                                )}
                              </td>
                              <td className="numeric">
                                <span className="invoice-line-mobile-caption">
                                  {t("Line total", "جمع ردیف")}
                                </span>
                                <ReadingMoney
                                  value={line.line_total}
                                  currency={state.config.company.currency}
                                />
                              </td>
                              <td className="numeric">
                                {" "}
                                <div className="field invoice-line-price">
                                  <span className="invoice-line-mobile-caption">
                                    {t("Selling price", "قیمت فروش")}
                                  </span>
                                  <strong
                                    className="price-display numeric"
                                    dir="ltr"
                                  >
                                    {price ? (
                                      <ProductPrice
                                        product={{
                                          sold_by: line.sold_by ?? "each",
                                        }}
                                        config={state.config}
                                        value={
                                          line.short_dated
                                            ? (oldPrice ?? price)
                                            : (manual?.price ?? price)
                                        }
                                      />
                                    ) : (
                                      "—"
                                    )}
                                  </strong>

                                  {product && manual && (
                                    <>
                                      <ManualPricePill
                                        product={product}
                                        branch={invoice.branch}
                                      />
                                      <ManualPriceDetails
                                        product={product}
                                        branch={invoice.branch}
                                        cost={line.unit_cost_before_tax}
                                      />
                                    </>
                                  )}
                                  {line.short_dated && (
                                    <small className="muted">
                                      {t(
                                        "Regular cost and selling price stay unchanged.",
                                        "هزینه عادی و قیمت فروش بدون تغییر می‌مانند.",
                                      )}
                                    </small>
                                  )}
                                  {price &&
                                    !line.short_dated &&
                                    acceptedInvoiceUnits(line) > 0 &&
                                    (manual
                                      ? line.manual_price_decision === "rule"
                                      : oldPrice !== price) && (
                                      <>
                                        <Badge tone="pending">
                                          {t("Pending", "در انتظار")}
                                        </Badge>
                                        {!locked && (
                                          <small className="muted">
                                            {t(
                                              "Goes to approval when posted",
                                              "هنگام ثبت برای تأیید ارسال می‌شود",
                                            )}
                                          </small>
                                        )}
                                      </>
                                    )}
                                  {expanded &&
                                    (oldPrice ? (
                                      <p className="muted">
                                        {t("Approved:", "تأییدشده:")}{" "}
                                        <ReadingMoney
                                          value={oldPrice}
                                          currency={
                                            state.config.company.currency
                                          }
                                        />
                                      </p>
                                    ) : (
                                      <p className="muted">
                                        {t(
                                          "No approved price yet",
                                          "هنوز قیمت تأییدشده‌ای نیست",
                                        )}
                                      </p>
                                    ))}
                                </div>
                              </td>
                            </tr>
                            {expanded && (
                              <tr
                                className="invoice-line-detail"
                                id={`invoice-line-${index}-detail`}
                              >
                                <td colSpan={5}>
                                  <div className="invoice-line-review">
                                    {(line.handwritten_note ||
                                      line.expiry_as_printed ||
                                      line.lot_number ||
                                      line.barcode) && (
                                      <div className="list-box">
                                        <p>
                                          <LtrValue value={line.description} />
                                        </p>
                                        {line.handwritten_note && (
                                          <p>{line.handwritten_note}</p>
                                        )}
                                        {line.expiry_as_printed && (
                                          <p>
                                            {t(
                                              "Expiry as printed",
                                              "تاریخ چاپ‌شده",
                                            )}
                                            :{" "}
                                            <LtrValue
                                              value={line.expiry_as_printed}
                                            />
                                          </p>
                                        )}
                                        {line.lot_number && (
                                          <p>
                                            {t("Lot number", "شماره سری")}:{" "}
                                            <LtrValue value={line.lot_number} />
                                          </p>
                                        )}
                                        {line.barcode && (
                                          <p>
                                            {t("Barcode", "بارکد")}:{" "}
                                            <LtrValue value={line.barcode} />
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    <fieldset
                                      disabled={locked}
                                      className="form-grid invoice-line-form"
                                    >
                                      <ReadingUnknownChecks
                                        fields={line.low_confidence_fields}
                                        record={line}
                                        known={[
                                          "description",
                                          "barcode",
                                          "quantity_entered",
                                          "quantity_unit",
                                          ...(line.sold_by === "weight"
                                            ? []
                                            : ["units_per_case"]),
                                          "unit_cost_before_tax",
                                          "supplier_item_code",
                                          "line_total",
                                          "taxable",
                                        ]}
                                      />
                                      <Field
                                        readingField="description"
                                        label={t(
                                          "Printed description",
                                          "شرح چاپ‌شده",
                                        )}
                                      >
                                        <input
                                          value={line.description}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            editLine(index, (item) => {
                                              item.description = value;
                                              if (item.product_code === "NEW")
                                                item.new_name_en = value;
                                            });
                                          }}
                                        />
                                      </Field>
                                      <Field
                                        readingField="barcode"
                                        label={t(
                                          "Invoice barcode",
                                          "بارکد فاکتور",
                                        )}
                                      >
                                        <input
                                          id={`invoice-line-${index}-barcode`}
                                          dir="ltr"
                                          value={line.barcode ?? ""}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            editLine(index, (item) => {
                                              item.barcode = value;
                                            });
                                          }}
                                        />
                                      </Field>
                                      <Field
                                        readingField="line_total"
                                        label={t(
                                          "Printed line total",
                                          "جمع چاپ‌شده ردیف",
                                        )}
                                      >
                                        <input
                                          dir="ltr"
                                          inputMode="decimal"
                                          value={line.line_total}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            editLine(index, (item) => {
                                              item.line_total = value;
                                            });
                                          }}
                                        />
                                      </Field>
                                      <Field
                                        readingField="taxable"
                                        label={t(
                                          "Invoice taxable",
                                          "فاکتور مشمول مالیات",
                                        )}
                                      >
                                        <select
                                          value={String(line.taxable)}
                                          onChange={(event) => {
                                            const value =
                                              event.target.value === "true";
                                            editLine(index, (item, draft) => {
                                              item.taxable = value;
                                              item.taxable_inferred = false;
                                              item.tax_profile =
                                                draft.config.tax.profiles.find(
                                                  (profile) =>
                                                    new Decimal(
                                                      profile.rate,
                                                    ).gt(0) === value,
                                                )?.key ?? item.tax_profile;
                                              item.line_tax =
                                                /^\d+(?:\.\d{1,2})?$/.test(
                                                  item.line_total,
                                                )
                                                  ? new Decimal(item.line_total)
                                                      .times(
                                                        value
                                                          ? draft.config.tax
                                                              .rate
                                                          : "0",
                                                      )
                                                      .toFixed(2)
                                                  : "";
                                            });
                                          }}
                                        >
                                          <option value="true">
                                            {t("Yes", "بله")}
                                          </option>
                                          <option value="false">
                                            {t("No", "خیر")}
                                          </option>
                                        </select>
                                      </Field>

                                      <Field
                                        readingField="quantity_unit"
                                        label={t("Quantity unit", "واحد تعداد")}
                                      >
                                        <Select
                                          value={line.quantity_unit ?? "units"}
                                          disabled={locked}
                                          onChange={(value) =>
                                            editLine(
                                              index,
                                              (item) => {
                                                const quantity =
                                                  item.sold_by === "weight"
                                                    ? value === "cases"
                                                      ? item.case_weight
                                                        ? new Decimal(
                                                            weightQuantityFromLb(
                                                              item.qty_invoiced,
                                                              item.case_weight_unit ??
                                                                "kg",
                                                              item.weight_conversion_factor ??
                                                                state.config,
                                                            ),
                                                          )
                                                            .div(
                                                              item.case_weight,
                                                            )
                                                            .toString()
                                                        : "1"
                                                      : weightQuantityFromLb(
                                                          item.qty_invoiced,
                                                          value as "kg" | "lb",
                                                          item.weight_conversion_factor ??
                                                            state.config,
                                                        )
                                                    : value === "cases"
                                                      ? new Decimal(
                                                          item.qty_invoiced,
                                                        )
                                                          .div(
                                                            item.units_per_case ??
                                                              1,
                                                          )
                                                          .toString()
                                                      : String(
                                                          item.qty_invoiced,
                                                        );
                                                setInvoiceLineQuantity(
                                                  item,
                                                  quantity,
                                                  value as "cases" | "units",
                                                );
                                              },
                                              true,
                                            )
                                          }
                                          options={
                                            line.sold_by === "weight"
                                              ? [
                                                  { value: "kg", label: "kg" },
                                                  { value: "lb", label: "lb" },
                                                  {
                                                    value: "cases",
                                                    label: t("Cases", "کارتن"),
                                                  },
                                                ]
                                              : [
                                                  {
                                                    value: "units",
                                                    label: t("Units", "واحد"),
                                                  },
                                                  {
                                                    value: "cases",
                                                    label: t("Cases", "کارتن"),
                                                  },
                                                ]
                                          }
                                        />
                                      </Field>
                                      {line.sold_by === "weight" ? (
                                        <>
                                          <Field
                                            label={t(
                                              "Case weight",
                                              "وزن کارتن",
                                            )}
                                          >
                                            <NumberField
                                              step="0.001"
                                              min="0"
                                              value={line.case_weight ?? ""}
                                              onChange={(value) =>
                                                editLine(
                                                  index,
                                                  (item) => {
                                                    item.case_weight = value;
                                                    if (
                                                      item.quantity_unit ===
                                                      "cases"
                                                    )
                                                      setInvoiceWeightQuantity(
                                                        item,
                                                        item.quantity_entered ??
                                                          "1",
                                                        "cases",
                                                        state.config,
                                                      );
                                                  },
                                                  true,
                                                )
                                              }
                                            />
                                          </Field>
                                          <Field
                                            label={t(
                                              "Case weight unit",
                                              "واحد وزن کارتن",
                                            )}
                                          >
                                            <Select
                                              value={
                                                line.case_weight_unit ?? "kg"
                                              }
                                              options={[
                                                { value: "kg", label: "kg" },
                                                { value: "lb", label: "lb" },
                                              ]}
                                              onChange={(value) =>
                                                editLine(
                                                  index,
                                                  (item) => {
                                                    item.case_weight_unit =
                                                      value as "kg" | "lb";
                                                    if (
                                                      item.quantity_unit ===
                                                      "cases"
                                                    )
                                                      setInvoiceWeightQuantity(
                                                        item,
                                                        item.quantity_entered ??
                                                          "1",
                                                        "cases",
                                                        state.config,
                                                      );
                                                  },
                                                  true,
                                                )
                                              }
                                            />
                                          </Field>
                                          <Field
                                            label={t("Cost unit", "واحد هزینه")}
                                          >
                                            <Select
                                              value={
                                                line.source_cost_unit ?? "lb"
                                              }
                                              options={[
                                                { value: "kg", label: "kg" },
                                                { value: "lb", label: "lb" },
                                              ]}
                                              onChange={(value) =>
                                                editLine(
                                                  index,
                                                  (item) =>
                                                    setInvoiceWeightCost(
                                                      item,
                                                      item.source_cost_before_tax ??
                                                        "0",
                                                      value as "kg" | "lb",
                                                      state.config,
                                                    ),
                                                  true,
                                                )
                                              }
                                            />
                                          </Field>
                                        </>
                                      ) : (
                                        <Field
                                          readingField="units_per_case"
                                          label={t(
                                            "Units per case",
                                            "واحد در هر کارتن",
                                          )}
                                        >
                                          <NumberField
                                            className="control-narrow"
                                            min="1"
                                            step="1"
                                            value={line.units_per_case ?? 1}
                                            disabled={locked}
                                            onChange={(value) =>
                                              editLine(
                                                index,
                                                (item) =>
                                                  setInvoiceLineQuantity(
                                                    item,
                                                    item.quantity_entered ??
                                                      item.qty_invoiced,
                                                    item.quantity_unit ??
                                                      "units",
                                                    Number(value),
                                                  ),
                                                true,
                                              )
                                            }
                                          />
                                        </Field>
                                      )}
                                      {line.sold_by !== "weight" &&
                                        line.quantity_unit === "cases" && (
                                          <Field
                                            label={t(
                                              "Case cost before tax",
                                              "هزینه کارتن پیش از مالیات",
                                            )}
                                          >
                                            <input
                                              className="control-narrow"
                                              dir="ltr"
                                              inputMode="decimal"
                                              disabled={locked}
                                              value={
                                                line.case_cost_before_tax ?? ""
                                              }
                                              onChange={(event) => {
                                                const inputValue =
                                                  event.currentTarget.value;
                                                editLine(
                                                  index,
                                                  (item) => {
                                                    item.case_cost_before_tax =
                                                      inputValue;
                                                    try {
                                                      item.unit_cost_before_tax =
                                                        costPerUnit(
                                                          inputValue,
                                                          item.units_per_case ??
                                                            1,
                                                        );
                                                    } catch {
                                                      item.unit_cost_before_tax =
                                                        "";
                                                    }
                                                  },
                                                  true,
                                                );
                                              }}
                                            />
                                          </Field>
                                        )}
                                      <p className="invoice-pack-equation muted">
                                        <LtrText>
                                          {line.sold_by === "weight"
                                            ? line.quantity_unit === "cases"
                                              ? `${line.quantity_entered ?? ""} × ${line.case_weight ?? ""} ${line.case_weight_unit ?? "kg"} = ${line.source_quantity ?? ""} ${line.source_quantity_unit ?? ""}`
                                              : `${line.source_quantity ?? ""} ${line.source_quantity_unit ?? ""}`
                                            : line.quantity_unit === "cases"
                                              ? `${line.quantity_entered ?? ""} × ${line.units_per_case ?? 1} = ${line.qty_invoiced}`
                                              : line.qty_invoiced}
                                        </LtrText>{" "}
                                        {line.sold_by !== "weight" &&
                                          tCount(
                                            "unit",
                                            "units",
                                            "واحد",
                                            "واحد",
                                            line.qty_invoiced,
                                          )}
                                      </p>
                                      <Field
                                        error={issue(
                                          `invoice-line-${index}-matching`,
                                        )}
                                        label={t(
                                          "Matched product",
                                          "کالای تطبیق‌یافته",
                                        )}
                                      >
                                        <Select
                                          id={`invoice-line-${index}-matching`}
                                          value={line.product_code}
                                          onChange={(value) =>
                                            editLine(
                                              index,
                                              (item, draft) => {
                                                item.product_code = value;
                                                const chosen =
                                                  draft.products.find(
                                                    (entry) =>
                                                      entry.code === value &&
                                                      entry.company_id ===
                                                        draft.invoice
                                                          .company_id &&
                                                      entry.status !==
                                                        "archived",
                                                  );
                                                if (value !== "NEW" && !chosen)
                                                  throw new Error(
                                                    "Choose a product.",
                                                  );
                                                if (chosen) {
                                                  item.pricing_category =
                                                    chosen.pricing_category;
                                                  item.taxable = chosen.taxable;
                                                  item.tax_profile =
                                                    chosen.tax_profile;
                                                }
                                                item.sold_by =
                                                  chosen?.sold_by ?? "each";
                                                if (item.sold_by === "weight")
                                                  initializeInvoiceWeight(
                                                    item,
                                                    draft.config,
                                                  );
                                                else {
                                                  item.quantity_unit = "units";
                                                  item.quantity_entered =
                                                    item.qty_invoiced;
                                                }
                                                const preference =
                                                  trackingChoiceForProduct(
                                                    chosen,
                                                  );
                                                item.date_tracking =
                                                  preference === "yes";
                                                item.date_confirmed =
                                                  preference !== undefined;
                                              },
                                              true,
                                            )
                                          }

                                          disabled={locked}
                                          options={[
                                            {
                                              value: "NEW",
                                              label: t(
                                                "Create pending new product",
                                                "ایجاد کالای جدید در انتظار",
                                              ),
                                            },
                                            ...state.products
                                              .filter(
                                                (item) =>
                                                  item.company_id ===
                                                    invoice.company_id &&
                                                  item.status !== "archived",
                                              )
                                              .map((item) =>
                                                invoiceProductOption(
                                                  item,
                                                  lang,
                                                ),
                                              ),
                                          ]}
                                        />
                                      </Field>
                                      <Field
                                        label={t(
                                          "Pricing category",
                                          "دسته قیمت‌گذاری",
                                        )}
                                      >
                                        <Select
                                          id={`invoice-line-${index}-category`}
                                          value={category?.key ?? ""}
                                          onChange={(value) =>
                                            editLine(index, (item, draft) =>
                                              setInvoiceLineCategory(
                                                item,
                                                value,
                                                draft.config,
                                              ),
                                            )
                                          }

                                          disabled={locked}
                                          options={[
                                            {
                                              value: "",
                                              label: t(
                                                "Choose pricing category",
                                                "انتخاب دسته قیمت‌گذاری",
                                              ),
                                            },
                                            ...state.config.pricing_categories.map(
                                              (item) => ({
                                                value: item.key,
                                                label: categoryText(
                                                  item.key,
                                                  item.label,
                                                  t,
                                                ),
                                              }),
                                            ),
                                          ]}
                                        />
                                      </Field>
                                      <Field
                                        label={t(
                                          "Supplier item code (optional)",
                                          "کد کالای تأمین‌کننده (اختیاری)",
                                        )}
                                      >
                                        <input
                                          className="control-narrow"
                                          dir="ltr"
                                          disabled={locked}
                                          id={`invoice-line-${index}-supplier-code`}
                                          value={line.supplier_item_code ?? ""}
                                          onChange={(event) => {
                                            const inputValue =
                                              event.currentTarget.value;
                                            editLine(
                                              index,
                                              (item, draft, currentActor) => {
                                                item.supplier_item_code =
                                                  inputValue;
                                                item.supplier_item_id =
                                                  resolveSupplierItem(
                                                    draft,
                                                    currentActor,
                                                    draft.invoice.supplier,
                                                    draft.invoice.branch,
                                                    {
                                                      product_code:
                                                        item.product_code,
                                                      supplier_item_code:
                                                        inputValue,
                                                    },
                                                  )?.id;
                                              },
                                            );
                                          }}
                                        />
                                      </Field>
                                      {line.product_code === "NEW" && (
                                        <>
                                          <Field
                                            label={t(
                                              "New product name (English)",
                                              "نام کالای جدید (انگلیسی)",
                                            )}
                                          >
                                            <input
                                              value={line.new_name_en ?? ""}
                                              onChange={(event) => {
                                                const inputValue =
                                                  event.currentTarget.value;
                                                editLine(index, (item) => {
                                                  item.new_name_en = inputValue;
                                                });
                                              }}
                                            />
                                          </Field>
                                          <Field
                                            label={t(
                                              "New product name (Persian) (optional)",
                                              "نام کالای جدید (فارسی) (اختیاری)",
                                            )}
                                          >
                                            <input
                                              dir="rtl"
                                              value={line.new_name_fa ?? ""}
                                              onChange={(event) => {
                                                const inputValue =
                                                  event.currentTarget.value;
                                                editLine(index, (item) => {
                                                  item.new_name_fa = inputValue;
                                                });
                                              }}
                                            />
                                          </Field>
                                        </>
                                      )}
                                    </fieldset>
                                    {!locked && (
                                      <Checkbox
                                        checked={short.quantity > 0}
                                        onChange={(checked) =>
                                          editLine(index, (item) => {
                                            if (item.sold_by === "weight") {
                                              setInvoiceWeightReceived(
                                                item,
                                                checked
                                                  ? Decimal.max(
                                                      0,
                                                      new Decimal(
                                                        item.source_quantity ??
                                                          "0",
                                                      ).minus(
                                                        Decimal.min(
                                                          4,
                                                          item.source_quantity ??
                                                            "0",
                                                        ),
                                                      ),
                                                    ).toString()
                                                  : (item.source_quantity ??
                                                      "0"),
                                                state.config,
                                              );
                                              return;
                                            }
                                            item.qty_received_at_posting =
                                              checked
                                                ? Math.max(
                                                    0,
                                                    item.qty_invoiced -
                                                      Math.min(
                                                        4,
                                                        item.qty_invoiced,
                                                      ),
                                                  )
                                                : item.qty_invoiced;
                                          })
                                        }

                                        disabled={locked}
                                      >
                                        {t("Mark as short", "ثبت کسری")}
                                      </Checkbox>
                                    )}
                                    {short.quantity > 0 && (
                                      <p className="banner danger">
                                        {t("Missing units:", "واحدهای کمبود:")}{" "}
                                        {short.quantity} ·{" "}
                                        {t("Deduction:", "کسر مبلغ:")}{" "}
                                        <ReadingMoney
                                          value={short.total}
                                          currency={
                                            state.config.company.currency
                                          }
                                        />{" "}
                                        <LtrText>
                                          (
                                          <ReadingMoney
                                            value={short.beforeTax}
                                            currency={
                                              state.config.company.currency
                                            }
                                          />{" "}
                                          +{" "}
                                          <ReadingMoney
                                            value={short.tax}
                                            currency={
                                              state.config.company.currency
                                            }
                                          />{" "}
                                          )
                                        </LtrText>{" "}
                                        {t("tax", "مالیات")}
                                      </p>
                                    )}
                                    {(() => {
                                      const previous =
                                        workspace.lineDetails[index]?.previous;
                                      const lower =
                                        previous &&
                                        /^\d+(?:\.\d{1,4})?$/.test(
                                          line.unit_cost_before_tax,
                                        ) &&
                                        new Decimal(
                                          line.unit_cost_before_tax,
                                        ).lt(previous.cost);
                                      return lower &&
                                        acceptedInvoiceUnits(line) > 0 ? (
                                        <Field
                                          label={t(
                                            "Lower-cost receipt",
                                            "دریافت با هزینه کمتر",
                                          )}
                                        >
                                          <SegmentedControl
                                            aria-label={t(
                                              "Lower-cost receipt",
                                              "دریافت با هزینه کمتر",
                                            )}
                                            value={
                                              line.short_dated
                                                ? "short_dated"
                                                : "regular"
                                            }
                                            onChange={(value) =>
                                              editLine(index, (item) => {
                                                item.short_dated =
                                                  value === "short_dated";
                                                if (item.short_dated) {
                                                  item.date_tracking = true;
                                                  item.date_confirmed = true;
                                                  item.date_type = "expiry";
                                                  item.order_price_decision =
                                                    "short_dated";
                                                } else {
                                                  item.order_price_decision =
                                                    undefined;
                                                }
                                              })
                                            }
                                            options={[
                                              {
                                                value: "regular",
                                                label: t(
                                                  "Regular receipt",
                                                  "دریافت عادی",
                                                ),
                                                disabled: locked,
                                              },
                                              {
                                                value: "short_dated",
                                                label: t(
                                                  "Short-dated (expiry discount)",
                                                  "نزدیک انقضا (تخفیف انقضا)",
                                                ),
                                                disabled: locked,
                                              },
                                            ]}
                                          />
                                        </Field>
                                      ) : null;
                                    })()}
                                    {refusedLine.quantity > 0 && (
                                      <p className="banner info">
                                        {t(
                                          "Refused / sent back with the driver",
                                          "رد شد / با راننده برگشت",
                                        )}{" "}
                                        · {t("Deduction:", "کسر مبلغ:")}{" "}
                                        <ReadingMoney
                                          value={refusedLine.total}
                                          currency={
                                            state.config.company.currency
                                          }
                                        />
                                      </p>
                                    )}
                                    {
                                      <fieldset
                                        disabled={locked}
                                        className="date-review"
                                      >
                                        <div
                                          className="invoice-date-choice"
                                          id={`invoice-line-${index}-track`}
                                        >
                                          <span className="field-label">
                                            {t("Track date", "پیگیری تاریخ")}
                                          </span>
                                          <SegmentedControl
                                            aria-label={t(
                                              "Track date",
                                              "پیگیری تاریخ",
                                            )}
                                            value={
                                              line.date_confirmed
                                                ? line.date_tracking
                                                  ? "yes"
                                                  : "no"
                                                : ""
                                            }
                                            onChange={(value) =>
                                              editLine(index, (item) => {
                                                item.date_tracking =
                                                  value === "yes";
                                                item.date_confirmed = true;
                                              })
                                            }
                                            options={[
                                              {
                                                value: "yes",
                                                label: t("Yes", "بله"),
                                                disabled: locked,
                                              },
                                              {
                                                value: "no",
                                                label: t("No", "خیر"),
                                                disabled:
                                                  locked || !!line.short_dated,
                                              },
                                            ]}
                                          />
                                        </div>
                                        <FieldError>
                                          {issue(`invoice-line-${index}-track`)}
                                        </FieldError>
                                        {line.date_tracking && (
                                          <div className="form-grid invoice-details-form">
                                            <Field
                                              label={t(
                                                "Date tracking",
                                                "پیگیری تاریخ",
                                              )}
                                            >
                                              <Select
                                                value={
                                                  line.date_type ?? "expiry"
                                                }
                                                onChange={(value) =>
                                                  editLine(index, (item) => {
                                                    item.date_type = value as
                                                      "expiry" | "best_before";
                                                  })
                                                }

                                                disabled={
                                                  locked || !!line.short_dated
                                                }
                                                options={[
                                                  {
                                                    value: "expiry",
                                                    label: t("Expiry", "انقضا"),
                                                  },
                                                  {
                                                    value: "best_before",
                                                    label: t(
                                                      "Best before",
                                                      "بهترین زمان مصرف",
                                                    ),
                                                  },
                                                ]}
                                              />
                                            </Field>
                                            <Field
                                              label={t("Date", "تاریخ")}
                                              error={issue(
                                                `invoice-line-${index}-date`,
                                              )}
                                            >
                                              <DateField
                                                dir="ltr"
                                                id={`invoice-line-${index}-date`}
                                                value={line.date_value ?? ""}
                                                min="1900-01-01"
                                                onChange={(value) =>
                                                  editLine(index, (item) => {
                                                    item.date_value = value;
                                                    item.date_confirmed = true;
                                                  })
                                                }
                                              />
                                            </Field>
                                            <Field
                                              label={t(
                                                "Lot number (optional)",
                                                "شماره بچ (اختیاری)",
                                              )}
                                            >
                                              <input
                                                dir="ltr"
                                                value={line.lot_number ?? ""}
                                                onChange={(event) => {
                                                  const inputValue =
                                                    event.currentTarget.value;
                                                  editLine(index, (item) => {
                                                    item.lot_number =
                                                      inputValue;
                                                  });
                                                }}
                                              />
                                            </Field>
                                          </div>
                                        )}
                                        {dateSuggestions.length > 0 && (
                                          <div className="invoice-date-suggestions">
                                            {dateSuggestions.map((entry) => (
                                              <div
                                                key={entry.id}
                                                className="invoice-date-suggestion"
                                              >
                                                <span>
                                                  {configuredBranchLabel(
                                                    state.config,
                                                    entry.branch,
                                                    lang,
                                                  )}{" "}
                                                  ·{" "}
                                                  {entry.entered_date ===
                                                  companyDate(state.config) ? (
                                                    t("Today", "امروز")
                                                  ) : (
                                                    <DateText
                                                      value={entry.entered_date}
                                                    />
                                                  )}{" "}
                                                  ·{" "}
                                                  {entry.date_type ===
                                                  "best_before"
                                                    ? t(
                                                        "Best before",
                                                        "بهترین زمان مصرف",
                                                      )
                                                    : t(
                                                        "Expires",
                                                        "انقضا",
                                                      )}{" "}
                                                  <DateText
                                                    value={entry.date}
                                                  />
                                                </span>
                                                <Button
                                                  variant="plain"
                                                  size="sm"
                                                  onClick={() =>
                                                    editLine(index, (item) => {
                                                      item.date_type =
                                                        entry.date_type;
                                                      item.date_value =
                                                        entry.date;
                                                      item.lot_number =
                                                        entry.lot_number;
                                                      item.date_confirmed = true;
                                                    })
                                                  }
                                                >
                                                  {t(
                                                    "Use this date",
                                                    "استفاده از این تاریخ",
                                                  )}
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </fieldset>
                                    }
                                    {manualReplacement &&
                                      !locked &&
                                      !line.short_dated &&
                                      acceptedInvoiceUnits(line) > 0 && (
                                        <div
                                          className="invoice-manual-choice"
                                          id={`invoice-line-${index}-manual`}
                                        >
                                          <Field
                                            label={t(
                                              "Manual price",
                                              "قیمت دستی",
                                            )}
                                            error={issue(
                                              `invoice-line-${index}-manual`,
                                            )}
                                          >
                                            <SegmentedControl
                                              aria-label={t(
                                                "Manual price decision",
                                                "تصمیم قیمت دستی",
                                              )}
                                              value={
                                                line.manual_price_decision ?? ""
                                              }
                                              onChange={(value) =>
                                                editLine(index, (item) => {
                                                  item.manual_price_decision =
                                                    value as "keep" | "rule";
                                                })
                                              }
                                              options={[
                                                {
                                                  value: "keep",
                                                  label: t(
                                                    `Keep ${money(manualReplacement.price)}`,
                                                    `حفظ \u2066${money(manualReplacement.price)}\u2069`,
                                                  ),
                                                },
                                                {
                                                  value: "rule",
                                                  label: t(
                                                    `Use the new calculated price${price ? ` ${money(price)}` : ""}`,
                                                    `استفاده از قیمت محاسبه‌شده جدید${price ? ` \u2066${money(price)}\u2069` : ""}`,
                                                  ),
                                                },
                                              ]}
                                            />
                                          </Field>
                                        </div>
                                      )}
                                    <div className="invoice-line-actions">
                                      {!locked && (
                                        <Button
                                          variant="destructive"
                                          className="invoice-remove-line"
                                          size="sm"
                                          onClick={() => {
                                            updateInvoice(
                                              (draft, currentActor) =>
                                                removeInvoiceLine(
                                                  draft,
                                                  currentActor,
                                                  index,
                                                ),
                                            );
                                            setOpenLines({});
                                          }}
                                        >
                                          {t("Remove line", "حذف ردیف")}
                                        </Button>
                                      )}
                                      <Checkbox
                                        className="invoice-line-confirm"
                                        id={`invoice-line-${index}-confirm`}
                                        disabled={
                                          locked ||
                                          (!!manualReplacement &&
                                            acceptedInvoiceUnits(line) > 0 &&
                                            !line.short_dated &&
                                            !line.manual_price_decision)
                                        }
                                        checked={line.review_confirmed ?? false}
                                        onChange={(checked) => {
                                          if (
                                            checked &&
                                            line.low_confidence_fields?.length
                                          ) {
                                            setConfirmChecksLine(index);
                                            return;
                                          }
                                          updateInvoice(
                                            (draft, currentActor) => {
                                              if (checked)
                                                confirmInvoiceLineChecks(
                                                  draft,
                                                  currentActor,
                                                  index,
                                                );
                                              else
                                                draft.invoice.lines[
                                                  index
                                                ].review_confirmed = false;
                                            },
                                          );
                                          if (checked)
                                            setOpenLines((current) => ({
                                              ...current,
                                              [lineKey]: false,
                                            }));
                                        }}
                                      >
                                        {t(
                                          "Confirm this invoice line",
                                          "تأیید این ردیف فاکتور",
                                        )}
                                      </Checkbox>
                                    </div>
                                    <FieldError>
                                      {issue(`invoice-line-${index}-confirm`)}
                                    </FieldError>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </ReadingCheckProvider>
                      );
                    })}
                  </DataTable>
                  <InvoiceOtherCharges
                    invoice={invoice}
                    onAcknowledge={
                      locked
                        ? undefined
                        : (index, field) => {
                            updateInvoice((draft) => {
                              const charge =
                                draft.invoice.other_charges?.[index];
                              if (charge)
                                charge.low_confidence_fields =
                                  charge.low_confidence_fields?.filter(
                                    (key) => key !== field,
                                  );
                            });
                          }
                    }
                    onEdit={(index, field, value) => {
                      updateInvoice((draft) => {
                        const charge = draft.invoice.other_charges?.[index];
                        if (!charge) return;
                        if (field === "line_total") charge.amount = value;
                        else if (field === "taxable")
                          charge.taxable = value === "true";
                        else if (field === "description")
                          charge.description = value;
                        charge.low_confidence_fields =
                          charge.low_confidence_fields?.filter(
                            (key) => key !== field,
                          );
                      });
                    }}
                  />
                  {!locked && (
                    <div className="invoice-manual-line">
                      <Field
                        label={t(
                          "Add a product to the invoice",
                          "افزودن کالا به فاکتور",
                        )}
                      >
                        <Select
                          id="invoice-add-product"
                          value={manualCode}
                          onChange={(value) => {
                            if (value === "__add_product")
                              setProductEditorOpen(true);
                            else setManualCode(value);
                          }}

                          disabled={locked}
                          options={[
                            ...workspace.supplierItems.map((item) => ({
                              value: `supplier-item:${item.id}`,
                              label: `${lang === "fa" ? item.name_fa : `\u2066${item.name_en}\u2069`} · \u2066${item.supplier_item_code || item.product_code}\u2069 · ${t("Case of", "کارتنِ")} ${item.units_per_case}`,
                            })),
                            ...state.products
                              .filter(
                                (item) =>
                                  item.company_id === invoice.company_id &&
                                  item.status !== "archived",
                              )
                              .map((item) => invoiceProductOption(item, lang)),
                            {
                              value: "__add_product",
                              label: t(
                                "+ Add new product",
                                "+ افزودن کالای جدید",
                              ),
                            },
                          ]}
                        />
                      </Field>
                      <Button
                        variant="neutral"
                        onClick={() =>
                          updateInvoice((draft, currentActor) => {
                            const selectedItem = manualCode.startsWith(
                              "supplier-item:",
                            )
                              ? resolveSupplierItem(
                                  draft,
                                  currentActor,
                                  draft.invoice.supplier,
                                  draft.invoice.branch,
                                  {
                                    id: manualCode.slice(
                                      "supplier-item:".length,
                                    ),
                                  },
                                )
                              : null;
                            addManualLine(
                              draft,
                              currentActor,
                              selectedItem?.product_code ?? manualCode,
                              selectedItem?.id,
                            );
                          })
                        }
                      >
                        {t("Add line", "افزودن ردیف")}
                      </Button>
                      <Button
                        variant="neutral"
                        onClick={() => setProductEditorOpen(true)}
                      >
                        {t("+ Add new product", "+ افزودن کالای جدید")}
                      </Button>
                    </div>
                  )}
                </Card>
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
                        >
                          <NumberField
                            className="control-narrow"

                            min="0"
                            step="1"
                            dir="ltr"
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
                          >
                            <DateField
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
                          >
                            <DateField
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
                        >
                          <textarea
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
            )}
          </div>
          {active && invoice.status !== "reading" && !locked && (
            <div className="invoice-action-footer">
              <div className="bottom-bar">
                <Button
                  variant="neutral"
                  onClick={() => {
                    updateInvoice((draft) => {
                      draft.invoice.status = "draft";
                    });
                    setMessage(
                      t("Saved as draft", "به عنوان پیش‌نویس ذخیره شد"),
                    );
                  }}
                >
                  {t("Save as draft", "ذخیره به عنوان پیش‌نویس")}
                </Button>
                <Button
                  onClick={() => {
                    if (blockers.length) {
                      setAttemptedPost(true);
                      setDetailsOpen(true);
                      setOpenLines(
                        Object.fromEntries(
                          invoice.lines.map((_, index) => [
                            `${invoice.id}:${index}`,
                            true,
                          ]),
                        ),
                      );
                      requestAnimationFrame(() =>
                        focusValidationField("invoice-missing-list"),
                      );
                    } else setPostOpen(true);
                  }}
                >
                  {t("Post invoice", "ثبت فاکتور")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmChecksLine !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmChecksLine(null);
        }}
        title={t(
          "This line has fields to check. Confirm all of them?",
          "این ردیف فیلدهایی برای بررسی دارد. همه را تأیید می‌کنید؟",
        )}
        description={t(
          "Compare the highlighted fields with the original invoice before confirming.",
          "پیش از تأیید، فیلدهای مشخص‌شده را با اصل فاکتور مقایسه کنید.",
        )}
        confirmLabel={t("Confirm all fields", "تأیید همه فیلدها")}
        onConfirm={() => {
          if (confirmChecksLine === null) return;
          const index = confirmChecksLine;
          updateInvoice((draft, currentActor) =>
            confirmInvoiceLineChecks(draft, currentActor, index, true),
          );
          setOpenLines((current) => ({
            ...current,
            [`${invoice.id}:${index}`]: false,
          }));
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
