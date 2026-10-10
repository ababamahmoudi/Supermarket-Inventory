import { useCallback, useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { demoSeed as demo } from "../config";
import { useDemo, demoUsers } from "../store";
import {
  configuredBranches,
  branchLabel as configuredBranchLabel,
} from "../settings";
import {
  supplierChoices,
  supplierRecords,
  supplierMatches,
} from "../supplier-editor";
import { SupplierEditor } from "./SupplierEditor";
import { ProductEditor } from "./Catalog";
import "./manual-entry.css";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  Checkbox,
  DateField,
  Dropzone,
  Dialog,
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
  Money,
  ProductName,
  UnitSize,
} from "../presentation";
import "./invoice-settings-labels.css";
import "./invoice-a2.css";
import {
  invoiceLineCalculation,
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
import { trackingChoiceForProduct } from "../date-tracking";
import {
  invoiceVersion,
  invoiceContentVersions,
  effectiveInvoiceVersion,
} from "../invoice-version";
import { OriginalInvoice } from "./OriginalInvoice";
import { PostedInvoice } from "./PostedInvoice";
import { InvoiceCorrectionDialog } from "./InvoiceCorrectionDialog";
import { attachPostedInvoiceOriginal } from "../invoice-corrections";
import {
  addManualLine,
  companyDate,
  createInvoice,
  dateAfter,
  invoiceBlockers,
  lineShort,
  lowerPriceLines,
  postInvoice,
  previousReceiptCost,
  recalculateInvoice,
  receiveShort,
  shortTotals,
  refusedTotals,
  lineRefused,
  acceptedInvoiceUnits,
  setInvoiceLineQuantity as setEachInvoiceLineQuantity,
  type InvoiceBlocker,
} from "../invoice";
import { manualPrice } from "../manual-prices";
import {
  ManualPriceDetails,
  ManualPricePill,
} from "../manual-price-presentation";
import {
  effectiveInvoiceLocation,
  invoiceLocationMovePreview,
  movePostedInvoice,
  setInvoiceLocation,
  suggestedInvoiceLocation,
  type InvoiceMovePreview,
} from "../received";
import "./received-c.css";
import {
  costPerCase,
  costPerUnit,
  resolveSupplierItem,
  supplierItemFacts,
} from "../supplier-items";
import { clearInvoiceOrder, clearInvoiceOrderLine } from "../invoice-orders";
import { InvoiceOrderReview } from "./InvoiceOrderReview";
import "./invoice-c3.css";
import type {
  Branch,
  DemoInvoice,
  DemoState,
  InvoiceLine,
  Role,
} from "../types";

type Translate = (en: string, fa: string) => string;
type InvoiceTab =
  | "drafts"
  | "processing"
  | "needs_review"
  | "ready_to_post"
  | "posted"
  | "cancelled";
const blockerCopy: Record<InvoiceBlocker, [string, string]> = {
  permission: [
    "Sign in as a Floor Worker or Supervisor to receive invoices.",
    "برای دریافت فاکتور به عنوان کارمند فروشگاه یا سرپرست وارد شوید.",
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
  supplier_pending: [
    "Waiting for Supervisor to confirm supplier.",
    "در انتظار تأیید تأمین‌کننده توسط سرپرست.",
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
    "Match every line to a product, or give a new product both names.",
    "هر ردیف را به کالا وصل کنید یا هر دو نام کالای جدید را وارد کنید.",
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

type InvoiceReader = { role: Role | null; branch?: Branch };
function readableInvoice(
  invoice: DemoInvoice,
  company: string,
  reader: InvoiceReader,
  state: DemoState,
) {
  return (
    invoice.company_id === company &&
    (reader.role === "supervisor" ||
      (reader.role === "floor_worker" &&
        (invoice.status === "posted"
          ? effectiveInvoiceLocation(state, invoice)
          : (invoice.handling_branch ?? invoice.branch)) === reader.branch))
  );
}
/** Keep the previous workspace as a resumable record before opening another. */
function retainInvoiceWorkspace(draft: DemoState) {
  if (
    draft.invoice.status === "empty" ||
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
  const { state, update, role, branch, lang, t, money, user, navigate } =
    useDemo();
  const routeId = useRouteParam("id");
  const routeVersion = useRouteParam("version");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const originalInput = useRef<HTMLInputElement>(null);
  const postedColumns = useTableColumns("invoices", [
    {
      key: "invoice",
      label: t("Invoice", "فاکتور"),
      required: true,
      width: "18%",
    },
    { key: "supplier", label: t("Supplier", "تأمین‌کننده"), width: "23%" },
    { key: "branch", label: t("Branch", "شعبه"), width: "16%" },
    { key: "date", label: t("Date", "تاریخ"), width: "15%" },
    { key: "status", label: t("Status", "وضعیت"), width: "13%" },
    { key: "review", label: t("Review", "بررسی"), width: "15%", actions: true },
  ]);
  const branches = configuredBranches(state.config);
  const invoiceLocation = effectiveInvoiceLocation(state, state.invoice);
  const locationSuggestion = suggestedInvoiceLocation(state, state.invoice);
  const [supplierEditorOpen, setSupplierEditorOpen] = useState(false);
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const invoice = state.invoice;
  const reader = { role, branch: user?.branch };
  const readerRef = useRef<InvoiceReader>(reader);
  useEffect(() => {
    readerRef.current = { role, branch: user?.branch };
  }, [role, user]);
  const canReadWorkspace = readableInvoice(
    invoice,
    state.config.company.seed_key,
    reader,
    state,
  );
  const updateInvoice = useCallback(
    (mutator: (draft: DemoState) => void) => {
      update((draft) => {
        if (
          !readableInvoice(
            draft.invoice,
            draft.config.company.seed_key,
            readerRef.current,
            draft,
          )
        )
          throw new Error("Choose an invoice in your allowed branch.");
        mutator(draft);
      });
    },
    [update],
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveError, setMoveError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(!invoice.file_data);
  const [message, setMessage] = useState("");
  const [postOpen, setPostOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [manualCode, setManualCode] = useState("0002");
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({});
  const [deliveryQuantities, setDeliveryQuantities] = useState<
    Record<string, number>
  >({});
  const [deliveryRefs, setDeliveryRefs] = useState<Record<string, string>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<
    Record<string, { quantity?: string; reference?: string }>
  >({});
  const blockers = role ? invoiceBlockers(state, role, branch) : [];
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
  const lowerLines = lowerPriceLines(state);
  const locked = invoice.status === "posted";
  const displayedVersion = invoiceVersion(state, invoice, routeVersion);
  const active = invoice.status !== "empty";
  let movePreview: InvoiceMovePreview | null = null;
  if (moveOpen && role === "supervisor" && moveTarget) {
    try {
      movePreview = invoiceLocationMovePreview(
        state,
        {
          company_id: state.config.company.seed_key,
          role,
          branch,
          actor: user?.name ?? "",
        },
        invoice.id,
        moveTarget,
      );
    } catch {
      movePreview = null;
    }
  }
  const fileSize = invoice.file_data
    ? Math.floor(
        ((invoice.file_data.split(",")[1] ?? "").replace(/=+$/, "").length *
          3) /
          4,
      )
    : undefined;

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

  useEffect(() => {
    const loadLinkedInvoice = () => {
      const [, query = ""] = window.location.hash.split("?");
      const id = new URLSearchParams(query).get("id");
      const linked = state.invoices?.find(
        (item) =>
          item.id === id &&
          item.company_id === state.config.company.seed_key &&
          (branch === "all" ||
            effectiveInvoiceLocation(state, item) === branch) &&
          readableInvoice(
            item,
            state.config.company.seed_key,
            readerRef.current,
            state,
          ),
      );
      if (!linked || linked.id === invoice.id) return;
      update((draft) => {
        if (
          !readableInvoice(
            linked,
            draft.config.company.seed_key,
            readerRef.current,
            draft,
          )
        )
          return;
        retainInvoiceWorkspace(draft);
        draft.invoice = structuredClone(linked);
      });
      setDetailsOpen(false);
    };
    loadLinkedInvoice();
    window.addEventListener("hashchange", loadLinkedInvoice);
    return () => window.removeEventListener("hashchange", loadLinkedInvoice);
  }, [state, branch, invoice.id, update]);

  if (role === "cashier" || !role)
    return (
      <EmptyState>
        {t(
          "Sign in as a Floor Worker or Supervisor to receive invoices.",
          "برای دریافت فاکتور به عنوان کارمند فروشگاه یا سرپرست وارد شوید.",
        )}
      </EmptyState>
    );

  function start(manual = false) {
    let id = "";
    update((draft) => {
      const currentReader = readerRef.current;
      if (
        currentReader.role !== "supervisor" &&
        currentReader.role !== "floor_worker"
      )
        return;
      const targetBranch =
        currentReader.role === "supervisor"
          ? currentReader.branch && currentReader.branch !== "all"
            ? currentReader.branch
            : branch === "all"
              ? configuredBranches(draft.config)[0]
              : branch
          : currentReader.branch;
      if (
        !targetBranch ||
        !configuredBranches(draft.config).includes(targetBranch)
      )
        return;
      retainInvoiceWorkspace(draft);
      draft.invoice = createInvoice(draft, targetBranch, manual);
      draft.invoice.receiving_employee = user?.name;
      id = draft.invoice.id;
    });
    setSelectedView(null);
    if (id) navigate(`invoices?id=${encodeURIComponent(id)}`);
    setDetailsOpen(manual);
    setMessage("");
    setUploadError("");
    setOpenLines({});
  }

  async function attachFile(file: File) {
    if (
      !/^image\/(png|jpeg|webp|gif)$/.test(file.type) &&
      file.type !== "application/pdf"
    ) {
      setUploadError(
        t(
          "Choose a PDF, PNG, JPEG, WebP, or GIF file.",
          "فایل PDF، PNG، JPEG، WebP یا GIF انتخاب کنید.",
        ),
      );
      return;
    }
    if (file.size > 2_500_000) {
      setUploadError(
        t(
          "Choose a file smaller than 2.5 MB so the original can be saved.",
          "برای ذخیره اصل فاکتور در این دموی مرورگر، فایل کوچک‌تر از 2.5 مگابایت انتخاب کنید.",
        ),
      );
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      let attachedId = "";
      updateInvoice((draft) => {
        const existing = draft.invoice;
        if (existing.status === "posted") {
          attachPostedInvoiceOriginal(
            draft,
            {
              company_id: draft.config.company.seed_key,
              role: role!,
              branch,
              actor: user?.name ?? "",
            },
            existing.id,
            { file_name: file.name, file_type: file.type, file_data: data },
          );
          attachedId = existing.id;
          return;
        }
        const next =
          existing.status === "empty"
            ? createInvoice(
                draft,
                user?.branch && user.branch !== "all"
                  ? user.branch
                  : branch === "all"
                    ? branches[0]
                    : branch,
              )
            : existing;
        if (existing.status === "empty") next.receiving_employee = user?.name;
        next.file_name = file.name;
        next.file_type = file.type;
        next.file_data = data;
        // Existing manual entries stay intact when their original is attached.
        next.status =
          next.entry_mode === "manual"
            ? "review"
            : next.lines.length
              ? "reading"
              : "draft";
        draft.invoice = next;
        attachedId = next.id;
      });
      setUploadError("");
      setMessage("");
      setSelectedView(null);
      setDetailsOpen(false);
      // The retained original and its review have a distinct browser-history entry.
      if (attachedId) navigate(`invoices?id=${encodeURIComponent(attachedId)}`);
    } catch {
      setUploadError(
        t(
          "The file could not be read. Choose it again or save a manual draft.",
          "فایل خوانده نشد. دوباره انتخاب کنید یا پیش‌نویس دستی ذخیره کنید.",
        ),
      );
    }
  }

  function setInvoiceLineQuantity(
    line: InvoiceLine,
    value: string | number,
    unit: NonNullable<InvoiceLine["quantity_unit"]>,
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
    change: (line: InvoiceLine) => void,
    recalculate = false,
  ) {
    updateInvoice((draft) => {
      if (draft.invoice.status === "posted") return;
      const before = draft.invoice.lines[index];
      const fingerprint = (line: InvoiceLine) =>
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
      change(draft.invoice.lines[index]);
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

  function post() {
    if (blockers.length) {
      setMessage(
        t(
          "Complete the highlighted requirements before posting.",
          "پیش از ثبت، موارد مشخص‌شده را کامل کنید.",
        ),
      );
      return;
    }
    updateInvoice((draft) => {
      postInvoice(draft, role!, branch, user?.name);
    });
    setSelectedView(null);
    navigate(`invoices?id=${encodeURIComponent(invoice.id)}`);
    setMessage(
      t(
        "Posted. Received, approvals, alerts, and supplier ledger are updated.",
        "ثبت شد. دریافت‌شده‌ها، تأییدها، هشدارها و دفتر تأمین‌کننده به‌روز شدند.",
      ),
    );
  }

  function sourceDeliveryQuantity(line: InvoiceLine, canonical: number) {
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

  function receive(index: number) {
    const line = effectiveInvoiceVersion(state, invoice).lines[index];
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
    // The amount is a pure allocation preview; posting stores the same result once.
    const oldLedgerIds = new Set(state.ledger.map((entry) => entry.id));
    const preview = structuredClone(state);
    const restored = receiveShort(
      preview,
      code,
      quantity,
      receipt,
      role!,
      branch,
      index,
      user?.name ?? "",
    );
    if (preview.ledger.every((entry) => oldLedgerIds.has(entry.id))) {
      setMessage(
        t(
          "This delivery reference was already recorded. No delivery or money was added.",
          "این مرجع تحویل قبلاً ثبت شده است. تحویل یا مبلغی اضافه نشد.",
        ),
      );
      return;
    }
    updateInvoice((draft) => {
      receiveShort(
        draft,
        code,
        quantity,
        receipt,
        role!,
        branch,
        index,
        user?.name ?? "",
      );
    });
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
        readableInvoice(item, state.config.company.seed_key, reader, state) &&
        (branch === "all" || effectiveInvoiceLocation(state, item) === branch),
    ) ?? [];
  const savedDrafts = [
    ...(state.invoices?.filter(
      (item) =>
        item.id !== invoice.id &&
        item.status !== "empty" &&
        item.status !== "posted" &&
        readableInvoice(item, state.config.company.seed_key, reader, state) &&
        (role === "floor_worker" || branch === "all" || item.branch === branch),
    ) ?? []),
    ...(!routeId &&
    active &&
    !locked &&
    canReadWorkspace &&
    (branch === "all" || invoiceLocation === branch)
      ? [invoice]
      : []),
  ].filter((saved) => {
    if (tab === "drafts") return saved.status === "draft";
    if (tab === "processing") return saved.status === "reading";
    if (saved.status !== "review") return false;
    const needsReview =
      invoiceBlockers({ ...state, invoice: saved }, role!, branch).length > 0;
    return tab === "needs_review"
      ? needsReview
      : tab === "ready_to_post" && !needsReview;
  });
  const resume = (saved: DemoInvoice) => {
    update((draft) => {
      if (
        !readableInvoice(
          saved,
          draft.config.company.seed_key,
          readerRef.current,
          draft,
        )
      )
        return;
      retainInvoiceWorkspace(draft);
      draft.invoice = structuredClone(saved);
    });
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
      {savedDrafts.map((saved) => (
        <div className="dialog-actions" key={saved.id}>
          <LtrText>
            {saved.supplier_invoice_number || t("Draft", "پیش‌نویس")}
          </LtrText>
          <LtrText>{saved.supplier}</LtrText>
          <Button variant="secondary" onClick={() => resume(saved)}>
            {t("Resume draft", "ادامه پیش‌نویس")}
          </Button>
        </div>
      ))}
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
        effectiveInvoiceVersion(state, invoice)
          .lines.map((line, index) => ({ line, index }))
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
                      variant="secondary"
                      onClick={() => receive(index)}
                      disabled={branch !== invoiceLocation}
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
                      <Money
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
          invoiceQuickAdd
          onClose={() => setSupplierEditorOpen(false)}
          onSaved={(record) =>
            updateInvoice((draft) => {
              draft.invoice.supplier = record.name;
              draft.invoice.supplier_confirmed = record.status === "confirmed";
              draft.invoice.payment_terms = record.payment_terms;
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
            updateInvoice((draft) => {
              addManualLine(draft, product.code);
            })
          }
        />
      )}
      {routeId === invoice.id && active && (
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
            variant={active && !locked ? "secondary" : "primary"}
            onClick={() => start()}
            disabled={active && !locked}
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
      {message && (
        <div role="status" className="banner info">
          {message}
        </div>
      )}
      {!routeId && tab !== "posted" && draftList}
      {tab === "posted" && !showPostedDetail ? (
        <Card
          title={t("Posted invoices", "فاکتورهای ثبت‌شده")}
          className="invoice-posted-list"
        >
          <div className="table-column-actions">{postedColumns.chooser}</div>
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
                  <th scope="col">{t("Review", "بررسی")}</th>
                </tr>
              </thead>
              <tbody>
                {branchInvoices.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <LtrText>{item.supplier_invoice_number}</LtrText>
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
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          updateInvoice((draft) => {
                            retainInvoiceWorkspace(draft);
                            draft.invoice = structuredClone(item);
                          });
                          chooseTab("posted", true);
                          setDetailsOpen(false);
                          navigate(
                            `invoices?id=${encodeURIComponent(item.id)}`,
                          );
                        }}
                      >
                        {t("View invoice", "مشاهده فاکتور")}
                      </Button>
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
              {displayedVersion.version_id ===
                invoiceContentVersions(state, invoice).at(-1)!.version_id &&
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
                !invoice.file_data && role === "supervisor"
                  ? () => originalInput.current?.click()
                  : undefined
              }
            />
            <input
              ref={originalInput}
              className="ui-file-input"
              hidden
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
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
          className={`invoice-workspace${!active || tab === "drafts" ? " invoice-start-stack" : ""}`}
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
                  {!invoice.file_data &&
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
                              ? "secondary"
                              : "primary"
                          }
                          onClick={() => start(false)}
                        >
                          {t("Upload", "بارگذاری")}
                        </Button>
                        {role === "supervisor" && (
                          <Button
                            variant={
                              invoice.entry_mode === "manual"
                                ? "primary"
                                : "secondary"
                            }
                            onClick={() => start(true)}
                          >
                            {t("Manual entry", "ورود دستی")}
                          </Button>
                        )}
                      </div>
                    )}
                  <Field
                    label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
                    error={uploadError}
                  >
                    <Dropzone
                      accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                      fileName={invoice.file_name}
                      fileSize={fileSize}
                      onChange={(file) => {
                        void attachFile(file);
                      }}
                      disabled={invoice.status === "reading"}
                      onRemove={() => {
                        updateInvoice((draft) => {
                          if (draft.invoice.status === "posted") return;
                          draft.invoice.file_name = undefined;
                          draft.invoice.file_type = undefined;
                          draft.invoice.file_data = undefined;
                        });
                        setUploadError("");
                      }}
                    />
                  </Field>
                </>
              )}
              <OriginalInvoice
                invoice={invoice}
                bare
                onAttach={
                  !invoice.file_data && invoice.entry_mode === "manual"
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
                    <DataTable>
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
                            <LtrText>
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
                      value={
                        <Money
                          value={invoice.subtotal}
                          currency={state.config.company.currency}
                        />
                      }
                      tone="lavender"
                    />
                    <SummaryTile
                      label={t("Tax", "مالیات")}
                      value={
                        <Money
                          value={invoice.tax}
                          currency={state.config.company.currency}
                        />
                      }
                      tone="sky"
                    />
                    <SummaryTile
                      label={t(
                        "Shorts and refused deduction",
                        "کسر کسری و اقلام برگشتی",
                      )}
                      value={
                        <Money
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
                        <Money
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
                    <LtrText>{invoice.supplier}</LtrText> ·{" "}
                    <LtrText>{invoice.supplier_invoice_number || "—"}</LtrText>{" "}
                    ·{" "}
                    {configuredBranchLabel(state.config, invoiceLocation, lang)}{" "}
                    · <DateText value={invoice.invoice_date} />
                  </p>
                  {locked && role === "supervisor" && (
                    <div className="invoice-location-correction">
                      <Button
                        variant="secondary"
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
                          variant="secondary"
                          onClick={() =>
                            updateInvoice((draft) =>
                              setInvoiceLocation(
                                draft,
                                role!,
                                user?.branch ?? branch,
                                locationSuggestion,
                              ),
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
                  <p>
                    <Badge tone={locked ? "approved" : "progress"}>
                      {locked
                        ? t("Posted", "ثبت‌شده")
                        : blockers.length
                          ? t("Needs review", "نیازمند بررسی")
                          : t("Ready to post", "آماده ثبت")}
                    </Badge>{" "}
                    <span className="muted">
                      {t(
                        "Changes save automatically in this browser.",
                        "تغییرات در این مرورگر خودکار ذخیره می‌شوند.",
                      )}
                    </span>
                  </p>
                  {detailsOpen && (
                    <fieldset
                      id="invoice-details-fields"
                      disabled={locked}
                      className="form-grid invoice-details-form"
                    >
                      <Field label={t("Supplier", "تأمین‌کننده")}>
                        <Select
                          value={invoice.supplier}
                          onChange={(value) => {
                            if (value === "__add_supplier") {
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
                              draft.invoice.supplier = value;
                              clearInvoiceOrder(draft.invoice);
                              draft.invoice.supplier_confirmed =
                                supplier?.status === "confirmed";
                              draft.invoice.payment_terms =
                                supplier?.payment_terms ?? "";
                              draft.invoice.lower_price_answers = undefined;
                            });
                          }}

                          disabled={locked}
                          options={[
                            {
                              value: "",
                              label: t("Choose supplier", "انتخاب تأمین‌کننده"),
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
                          dir="ltr"
                          value={invoice.supplier_invoice_number}
                          onChange={(event) =>
                            updateInvoice((draft) => {
                              draft.invoice.supplier_invoice_number =
                                event.target.value;
                            })
                          }
                          placeholder={t(
                            "Assigned on posting if blank",
                            "اگر خالی باشد هنگام ثبت تعیین می‌شود",
                          )}
                        />
                      </Field>
                      <Field label={t("Invoice date", "تاریخ فاکتور")}>
                        <DateField
                          dir="ltr"
                          value={invoice.invoice_date ?? ""}
                          onChange={(value) =>
                            updateInvoice((draft) => {
                              draft.invoice.invoice_date = value;
                            })
                          }
                        />
                      </Field>
                      <div className="invoice-received-fields">
                        <Field
                          label={t("Received date (UTC)", "تاریخ دریافت (UTC)")}
                        >
                          <DateField
                            value={invoice.received_at?.slice(0, 10) ?? ""}
                            disabled={locked}
                            onChange={(value) =>
                              updateInvoice((draft) => {
                                const time =
                                  draft.invoice.received_at?.slice(11, 16) ||
                                  "00:00";
                                draft.invoice.received_at = value
                                  ? `${value}T${time}:00Z`
                                  : "";
                              })
                            }
                          />
                        </Field>
                        <Field
                          label={t("Received time (UTC)", "زمان دریافت (UTC)")}
                          hint={t(
                            "24-hour time, HH:mm",
                            "زمان ۲۴ ساعته، HH:mm",
                          )}
                        >
                          <input
                            className="control-narrow"
                            type="text"
                            dir="ltr"
                            inputMode="numeric"
                            placeholder="HH:mm"
                            value={invoice.received_at?.slice(11, 16) ?? ""}
                            onChange={(event) =>
                              updateInvoice((draft) => {
                                const date =
                                  draft.invoice.received_at?.slice(0, 10) || "";
                                draft.invoice.received_at = event.target.value
                                  ? `${date}T${event.target.value}:00Z`
                                  : "";
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field
                        label={t("Receiving employee", "کارمند دریافت‌کننده")}
                      >
                        <Select
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
                      <Field label={t("Location", "مکان")}>
                        <Select
                          value={invoiceLocation}
                          disabled={locked}
                          onChange={(value) => {
                            updateInvoice((draft) => {
                              setInvoiceLocation(
                                draft,
                                role!,
                                user?.branch ?? branch,
                                value,
                              );
                            });
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
                        label={t("Ship to (optional)", "نشانی تحویل (اختیاری)")}
                      >
                        <input
                          value={invoice.ship_to ?? ""}
                          disabled={locked}
                          onChange={(event) =>
                            updateInvoice((draft) => {
                              draft.invoice.ship_to = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label={t("Subtotal", "جمع پیش از مالیات")}>
                        <input
                          dir="ltr"
                          className="control-narrow"
                          inputMode="decimal"
                          value={invoice.subtotal}
                          onChange={(event) =>
                            updateInvoice((draft) => {
                              draft.invoice.subtotal = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label={t("Tax", "مالیات")}>
                        <input
                          dir="ltr"
                          className="control-narrow"
                          inputMode="decimal"
                          value={invoice.tax}
                          onChange={(event) =>
                            updateInvoice((draft) => {
                              draft.invoice.tax = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field label={t("Final total", "جمع نهایی")}>
                        <input
                          dir="ltr"
                          className="control-narrow"
                          inputMode="decimal"
                          value={invoice.final_total}
                          onChange={(event) =>
                            updateInvoice((draft) => {
                              draft.invoice.final_total = event.target.value;
                            })
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "Due date (optional)",
                          "تاریخ سررسید (اختیاری)",
                        )}
                      >
                        <DateField
                          dir="ltr"
                          value={invoice.due_date ?? ""}
                          onChange={(value) =>
                            updateInvoice((draft) => {
                              draft.invoice.due_date = value;
                            })
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "Payment terms (optional)",
                          "شرایط پرداخت (اختیاری)",
                        )}
                      >
                        <input
                          value={invoice.payment_terms}
                          onChange={(event) =>
                            updateInvoice((draft) => {
                              draft.invoice.payment_terms = event.target.value;
                            })
                          }
                        />
                      </Field>
                    </fieldset>
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
                <InvoiceOrderReview />
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
                        ? manualPrice(state, product, invoice.branch)
                        : null;
                      let price: string | null = null;
                      let costValid = true;
                      try {
                        price = locked
                          ? line.calculated_selling_price
                          : invoiceLineCalculation(
                              line,
                              category.key,
                              state.config,
                            ).selling_price;
                      } catch {
                        costValid = false;
                      }
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
                      const lineKey = `${invoice.id}:${index}`;
                      const needsDecision =
                        !locked &&
                        (!line.review_confirmed ||
                          !line.date_confirmed ||
                          (line.date_tracking && !line.date_value) ||
                          (manual &&
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
                                    <ChevronDown size={16} aria-hidden="true" />
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
                                      <LtrText>{refusedLine.quantity}</LtrText>
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
                                <LtrText>
                                  {line.sold_by === "weight"
                                    ? line.source_received_quantity
                                    : line.qty_received_at_posting}{" "}
                                  /{" "}
                                  {line.sold_by === "weight"
                                    ? `${line.source_quantity} ${line.source_quantity_unit}`
                                    : line.qty_invoiced}
                                </LtrText>
                              )}
                              {expanded && (
                                <>
                                  <Field
                                    label={t(
                                      "Invoiced quantity",
                                      "تعداد فاکتور",
                                    )}
                                  >
                                    <NumberField
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
                                    label={t(
                                      "Delivered quantity",
                                      "تعداد تحویل‌شده",
                                    )}
                                  >
                                    <NumberField
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
                                  <Money
                                    value={
                                      line.sold_by === "weight"
                                        ? (line.source_cost_before_tax ??
                                          line.unit_cost_before_tax)
                                        : line.unit_cost_before_tax
                                    }
                                    decimals={line.sold_by === "weight" ? 4 : 2}
                                    currency={state.config.company.currency}
                                  />
                                  {line.sold_by === "weight" && (
                                    <LtrText>/{line.source_cost_unit}</LtrText>
                                  )}
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
                                    disabled={locked}
                                    dir="ltr"
                                    className="control-narrow"
                                    inputMode="decimal"
                                    value={
                                      line.sold_by === "weight"
                                        ? (line.source_cost_before_tax ?? "")
                                        : line.unit_cost_before_tax
                                    }
                                    onChange={(event) =>
                                      editLine(
                                        index,
                                        (item) => {
                                          if (item.sold_by === "weight") {
                                            setInvoiceWeightCost(
                                              item,
                                              event.target.value,
                                              item.source_cost_unit ?? "lb",
                                              state.config,
                                            );
                                            return;
                                          }
                                          item.unit_cost_before_tax =
                                            event.target.value;
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
                                      )
                                    }
                                  />
                                </Field>
                              )}
                            </td>
                            <td className="numeric">
                              <Money
                                value={line.line_total}
                                currency={state.config.company.currency}
                              />
                            </td>
                            <td className="numeric">
                              {" "}
                              <div className="field invoice-line-price">
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
                                      <Money
                                        value={oldPrice}
                                        currency={state.config.company.currency}
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
                                  <fieldset
                                    disabled={locked}
                                    className="form-grid invoice-line-form"
                                  >
                                    <Field
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
                                                          .div(item.case_weight)
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
                                                    : String(item.qty_invoiced);
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
                                          label={t("Case weight", "وزن کارتن")}
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
                                                  item.quantity_unit ?? "units",
                                                  Number(value),
                                                ),
                                              true,
                                            )
                                          }
                                        />
                                      </Field>
                                    )}
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
                                        value={line.supplier_item_code ?? ""}
                                        onChange={(event) =>
                                          editLine(index, (item) => {
                                            item.supplier_item_code =
                                              event.target.value;
                                            item.supplier_item_id =
                                              resolveSupplierItem(
                                                state,
                                                invoice.company_id,
                                                invoice.supplier,
                                                invoice.branch,
                                                {
                                                  product_code:
                                                    item.product_code,
                                                  supplier_item_code:
                                                    event.target.value,
                                                },
                                              )?.id;
                                          })
                                        }
                                      />
                                    </Field>
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
                                            onChange={(event) =>
                                              editLine(
                                                index,
                                                (item) => {
                                                  item.case_cost_before_tax =
                                                    event.target.value;
                                                  try {
                                                    item.unit_cost_before_tax =
                                                      costPerUnit(
                                                        event.target.value,
                                                        item.units_per_case ??
                                                          1,
                                                      );
                                                  } catch {
                                                    item.unit_cost_before_tax =
                                                      "";
                                                  }
                                                },
                                                true,
                                              )
                                            }
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
                                        t("units", "واحد")}
                                    </p>
                                    <Field
                                      label={t(
                                        "Matched product",
                                        "کالای تطبیق‌یافته",
                                      )}
                                    >
                                      <Select
                                        value={line.product_code}
                                        onChange={(value) =>
                                          editLine(
                                            index,
                                            (item) => {
                                              item.product_code = value;
                                              const chosen =
                                                state.products.find(
                                                  (entry) =>
                                                    entry.code === value,
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
                                                  state.config,
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
                                            .map((item) => ({
                                              value: item.code,
                                              label: `\u2066${item.code}\u2069 · ${lang === "fa" ? item.name_fa : `\u2066${item.name_en}\u2069`}`,
                                            })),
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
                                        value={category.key}
                                        onChange={(value) =>
                                          editLine(index, (item) => {
                                            item.pricing_category = value;
                                            item.date_confirmed = false;
                                          })
                                        }

                                        disabled={locked}
                                        options={state.config.pricing_categories.map(
                                          (item) => ({
                                            value: item.key,
                                            label: categoryText(
                                              item.key,
                                              item.label,
                                              t,
                                            ),
                                          }),
                                        )}
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
                                            onChange={(event) =>
                                              editLine(index, (item) => {
                                                item.new_name_en =
                                                  event.target.value;
                                              })
                                            }
                                          />
                                        </Field>
                                        <Field
                                          label={t(
                                            "New product name (Persian)",
                                            "نام کالای جدید (فارسی)",
                                          )}
                                        >
                                          <input
                                            dir="rtl"
                                            value={line.new_name_fa ?? ""}
                                            onChange={(event) =>
                                              editLine(index, (item) => {
                                                item.new_name_fa =
                                                  event.target.value;
                                              })
                                            }
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
                                                : (item.source_quantity ?? "0"),
                                              state.config,
                                            );
                                            return;
                                          }
                                          item.qty_received_at_posting = checked
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
                                      <Money
                                        value={short.total}
                                        currency={state.config.company.currency}
                                      />{" "}
                                      <LtrText>
                                        (
                                        <Money
                                          value={short.beforeTax}
                                          currency={
                                            state.config.company.currency
                                          }
                                        />{" "}
                                        +{" "}
                                        <Money
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
                                    const previous = previousReceiptCost(
                                      state,
                                      line.product_code,
                                      line,
                                    );
                                    const lower =
                                      previous &&
                                      /^\d+(?:\.\d{1,4})?$/.test(
                                        line.unit_cost_before_tax,
                                      ) &&
                                      new Decimal(line.unit_cost_before_tax).lt(
                                        previous.cost,
                                      );
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
                                      <Money
                                        value={refusedLine.total}
                                        currency={state.config.company.currency}
                                      />
                                    </p>
                                  )}
                                  {
                                    <fieldset
                                      disabled={locked}
                                      className="date-review"
                                    >
                                      <div className="invoice-date-choice">
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
                                      {line.date_tracking && (
                                        <div className="form-grid invoice-details-form">
                                          <Field
                                            label={t(
                                              "Date tracking",
                                              "پیگیری تاریخ",
                                            )}
                                          >
                                            <Select
                                              value={line.date_type ?? "expiry"}
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
                                          <Field label={t("Date", "تاریخ")}>
                                            <DateField
                                              dir="ltr"
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
                                              onChange={(event) =>
                                                editLine(index, (item) => {
                                                  item.lot_number =
                                                    event.target.value;
                                                })
                                              }
                                            />
                                          </Field>
                                        </div>
                                      )}
                                    </fieldset>
                                  }
                                  {manual &&
                                    !locked &&
                                    !line.short_dated &&
                                    acceptedInvoiceUnits(line) > 0 && (
                                      <div className="invoice-manual-choice">
                                        <Field
                                          label={t("Manual price", "قیمت دستی")}
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
                                                  "Keep manual price",
                                                  "حفظ قیمت دستی",
                                                ),
                                              },
                                              {
                                                value: "rule",
                                                label: t(
                                                  "Use rule price",
                                                  "استفاده از قیمت قاعده",
                                                ),
                                              },
                                            ]}
                                          />
                                        </Field>
                                      </div>
                                    )}
                                  <Checkbox
                                    disabled={
                                      locked ||
                                      (!!manual &&
                                        acceptedInvoiceUnits(line) > 0 &&
                                        !line.short_dated &&
                                        !line.manual_price_decision)
                                    }
                                    checked={line.review_confirmed ?? false}
                                    onChange={(checked) => {
                                      updateInvoice((draft) => {
                                        draft.invoice.lines[
                                          index
                                        ].review_confirmed = checked;
                                      });
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
                              </td>
                            </tr>
                          )}
                        </tbody>
                      );
                    })}
                  </DataTable>
                  {!locked && (
                    <div className="invoice-manual-line">
                      <Field
                        label={t(
                          "Add a product to the invoice",
                          "افزودن کالا به فاکتور",
                        )}
                      >
                        <Select
                          value={manualCode}
                          onChange={(value) => {
                            if (value === "__add_product")
                              setProductEditorOpen(true);
                            else setManualCode(value);
                          }}

                          disabled={locked}
                          options={[
                            ...supplierItemFacts(
                              state,
                              invoice.company_id,
                              invoice.supplier,
                              invoice.branch,
                            ).map((item) => ({
                              value: `supplier-item:${item.id}`,
                              label: `${lang === "fa" ? item.name_fa : `\u2066${item.name_en}\u2069`} · \u2066${item.supplier_item_code || item.product_code}\u2069 · ${t("Case of", "کارتنِ")} ${item.units_per_case}`,
                            })),
                            ...state.products
                              .filter(
                                (item) =>
                                  item.company_id === invoice.company_id &&
                                  item.status !== "archived",
                              )
                              .map((item) => ({
                                value: item.code,
                                label: `\u2066${item.code}\u2069 · ${lang === "fa" ? item.name_fa : `\u2066${item.name_en}\u2069`}`,
                              })),
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
                        variant="secondary"
                        onClick={() =>
                          updateInvoice((draft) => {
                            const selectedItem = manualCode.startsWith(
                              "supplier-item:",
                            )
                              ? resolveSupplierItem(
                                  draft,
                                  draft.invoice.company_id,
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
                              selectedItem?.product_code ?? manualCode,
                              selectedItem?.id,
                            );
                          })
                        }
                      >
                        {t("Add line", "افزودن ردیف")}
                      </Button>
                      <Button
                        variant="secondary"
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
                    {lowerLines.map((line, index) => {
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
                          <Money
                            value={
                              previousReceiptCost(state, product.code, line)
                                ?.cost ?? product.last_cost_before_tax
                            }
                            currency={state.config.company.currency}
                          />{" "}
                          · {t("New", "جدید")}{" "}
                          <Money
                            value={line.unit_cost_before_tax}
                            currency={state.config.company.currency}
                          />
                        </p>
                      );
                    })}
                    <p className="muted">
                      {t(
                        "Your answers create a Supervisor alert when you post. Unknown information is allowed with a note.",
                        "پاسخ‌های شما هنگام ثبت هشدار سرپرست ایجاد می‌کند. اطلاعات نامعلوم با یادداشت پذیرفته می‌شود.",
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
                            onChange={(event) =>
                              updateInvoice((draft) => {
                                draft.invoice.lower_price_answers!.note =
                                  event.target.value;
                              })
                            }
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
              {blockers.length > 0 && (
                <div className="banner pending invoice-blockers" role="alert">
                  <ul>
                    {blockers.map((blocker) => (
                      <li key={blocker}>{t(...blockerCopy[blocker])}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bottom-bar">
                <Button
                  variant="secondary"
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
                  onClick={() => setPostOpen(true)}
                  disabled={blockers.length > 0}
                >
                  {t("Post invoice", "ثبت فاکتور")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
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
          <Money value={payable} currency={state.config.company.currency} />
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
        <Field label={t("Location", "مکان")}>
          <Select
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
        <Field label={t("Reason", "دلیل")}>
          <textarea
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
                  <Money
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
                    <Money
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
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setMoveOpen(false)}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            disabled={!movePreview || !moveReason.trim()}
            onClick={() => {
              if (!movePreview) return;
              try {
                updateInvoice((draft) =>
                  movePostedInvoice(
                    draft,
                    {
                      company_id: draft.config.company.seed_key,
                      role: readerRef.current.role ?? "cashier",
                      branch,
                      actor: user?.name ?? "",
                    },
                    invoice.id,
                    moveTarget,
                    moveReason,
                    movePreview.snapshot,
                  ),
                );
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
        </div>
      </Dialog>
    </>
  );
}
