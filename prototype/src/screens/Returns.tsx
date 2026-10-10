import "../c3-tables.css";
import {
  branchLabel as configuredBranchLabel,
  configuredBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { useEffect, useState } from "react";
import { useListState } from "../navigation";
import { ArrowLeft } from "lucide-react";
import { ReturnMemoDocument, ReturnMemoPreview } from "../return-memo";
import { useOperationalPrint } from "../operational-print-hook";
import {
  returnUiStatus,
  returnUiStatusLabel,
  returnStatusLabel,
  returnFinancialFingerprint,
  type ReturnMemo,
} from "../return-workflow";
import "./returns-a2.css";
import policySource from "../../../docs/return-policy.md?raw";
import { useDemo } from "../store";
import { companyDate } from "../invoice";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  ConfirmDialog,
  Tabs,
  DataTable,
  DateField,
  Dropzone,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  useTableColumns,
} from "../ui";
import { DateText, demoUserLabel, LtrText, ProductName } from "../presentation";
import {
  cancelReturn,
  operationError,
  companyTimestamp,
  postReturnClaim,
  receiveReplacement,
  recordPickup,
  reviewCancellation,
  scopedRecords,
  submitFinancialClaim,
  type Disposition,
  type OperationalReturn,
  type OperationsContext,
  type ReturnClaim,
} from "../operations";

export function Returns() {
  const { state, update, role, user, branch, t, lang } = useDemo();
  const usesPounds = (line: OperationalReturn["lines"][number]) =>
    line.quantity_unit === "lb" ||
    (!line.quantity_unit &&
      state.products.find(
        (item) =>
          item.company_id === state.config.company.seed_key &&
          item.code === line.product_code,
      )?.sold_by === "weight");
  const branches = configuredBranches(state.config);
  const [hash, setHash] = useState(() => window.location.hash);
  const detailId = hash.startsWith("#return?")
    ? new URLSearchParams(hash.split("?")[1]).get("id")
    : null;
  const overviewContext: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch: role === "supervisor" ? "all" : (user?.branch ?? branch),
    role: role ?? "cashier",
    actor: user?.name ?? t("Floor Worker", "کارمند فروشگاه"),
  };
  const scopedReturns = scopedRecords(
    state.returns,
    overviewContext,
  ) as OperationalReturn[];
  const selected = detailId
    ? scopedReturns.find((record) => record.id === detailId)
    : undefined;
  const context: OperationsContext = {
    ...overviewContext,
    branch: selected?.branch ?? overviewContext.branch,
  };
  const suppliers = [
    ...new Set([
      ...state.returns
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.supplier),
      ...state.products
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.main_supplier),
    ]),
  ];
  const [supplier, setSupplier] = useListState("returns.supplier", "all");
  const [returnTab, setReturnTab] = useListState("returns.tab", "open");
  const [status, setStatus] = useListState("returns.status", "all");
  const [returnBranch, setReturnBranch] = useListState(
    "returns.location",
    "all",
  );
  const [search, setSearch] = useListState("returns.search", "");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<"pickup" | "resolve" | "cancel">("pickup");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [representative, setRepresentative] = useState("");
  const [slip, setSlip] = useState("");
  const [photo, setPhoto] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("replacement_received");
  const [replacement, setReplacement] = useState("");
  const [replacementQty, setReplacementQty] = useState("1");
  const [date, setDate] = useState(() => companyDate(state.config));
  const [fully, setFully] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>(
    {},
  );
  const [safe, setSafe] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [retainSettlement, setRetainSettlement] = useState(false);
  const [manualMemo, setMemo] = useState<ReturnMemo | null>(null);
  const [dismissedMemoHash, setDismissedMemoHash] = useState("");
  const [confirmation, setConfirmation] = useState<{
    returnId: string;
    claimId: string;
    amount: string;
    fingerprint: string;
  } | null>(null);
  const { printDocument, printOutput } = useOperationalPrint();
  const memoReference = new URLSearchParams(hash.split("?")[1] ?? "").get(
    "memo",
  );
  const visibleManualMemo =
    manualMemo &&
    scopedReturns.some(
      (record) =>
        record.id === manualMemo.return_id &&
        record.pickup_memos?.some((item) => item.id === manualMemo.id),
    )
      ? manualMemo
      : null;
  const memo =
    visibleManualMemo ??
    (dismissedMemoHash !== hash
      ? (selected?.pickup_memos?.find(
          (item) => item.reference === memoReference,
        ) ?? null)
      : null);
  const tableColumns = useTableColumns("returns", [
    {
      key: "reference",
      label: t("Return #", "شماره مرجوعی"),
      required: true,
      width: 108,
    },
    {
      key: "supplier",
      label: t("Supplier", "تأمین‌کننده"),
      required: true,
      width: 220,
    },
    { key: "location", label: t("Branch", "شعبه"), width: 144 },
    { key: "date", label: t("Created", "ایجادشده"), width: 128 },
    { key: "items", label: t("Items", "اقلام"), width: 76, align: "end" },
    { key: "status", label: t("Status", "وضعیت"), width: 172 },
    {
      key: "actions",
      label: t("Next action", "اقدام بعدی"),
      width: 144,
      align: "end",
      actions: true,
    },
  ]);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setActive(null);
      setMemo(null);
      setError("");
      setErrorKey("");
      setFeedback("");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const returnNumber = (record: OperationalReturn) =>
    state.returns
      .filter((item) => item.company_id === context.company_id)
      .findIndex((item) => item.id === record.id) + 1;
  const detailHref = (record: OperationalReturn) =>
    `#return?id=${encodeURIComponent(record.id)}`;
  const query = search.trim().toLocaleLowerCase();
  const overviewReturns = scopedReturns.filter((record) => {
    const displayedStatus = returnUiStatus(record);
    const matchesStatus =
      (returnTab === "open"
        ? displayedStatus === "waiting_for_pickup" ||
          displayedStatus === "waiting_for_credit"
        : displayedStatus === "closed" || displayedStatus === "cancelled") &&
      (status === "all" || status === "pending" || displayedStatus === status);
    const productText = record.lines
      .map((line) => {
        const product = state.products.find(
          (item) =>
            item.company_id === context.company_id &&
            item.code === line.product_code,
        );
        return [line.product_code, product?.name_en, product?.name_fa].join(
          " ",
        );
      })
      .join(" ");
    const searchableText = [
      returnNumber(record),
      record.supplier,
      record.branch,
      productText,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      matchesStatus &&
      (supplier === "all" || record.supplier === supplier) &&
      (returnBranch === "all" || record.branch === returnBranch) &&
      (!query || searchableText.includes(query))
    );
  });
  const returns = selected ? [selected] : [];
  const productName = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return product ? (lang === "fa" ? product.name_fa : product.name_en) : code;
  };
  const statusLabel = (status: string) => returnUiStatusLabel(status, t);
  const returnStatus = (record: OperationalReturn) => (
    <Badge
      tone={
        record.status === "cancelled"
          ? "neutral"
          : record.status === "resolved" || record.status === "picked_up"
            ? "approved"
            : record.status === "open"
              ? "info"
              : record.status === "partially_resolved" ||
                  record.status === "cancellation_review"
                ? "progress"
                : "pending"
      }
    >
      {returnStatusLabel(record, t)}
    </Badge>
  );
  const run = (action: (draft: typeof state) => void, message: string) => {
    try {
      update(action);
      setError("");
      setErrorKey("");
      setFeedback(message);
    } catch (caught) {
      setErrorKey(caught instanceof Error ? caught.message : "");
      setError(
        operationError(caught instanceof Error ? caught.message : "", t),
      );
      setFeedback("");
    }
  };
  const clearFieldError = (...keys: string[]) => {
    if (keys.includes(errorKey)) {
      setError("");
      setErrorKey("");
    }
  };
  const fieldError = (...keys: string[]) =>
    keys.includes(errorKey) ? error : undefined;
  const counts = (record: OperationalReturn) =>
    Object.fromEntries(
      record.lines.map((line) => [
        line.product_code,
        Number(quantities[line.product_code] ?? "0"),
      ]),
    );
  const openPanel = (record: OperationalReturn, nextPanel: typeof panel) => {
    setActive(record.id);
    setPanel(nextPanel);
    setQuantities({});
    setRepresentative("");
    setSlip("");
    setPhoto("");
    setPhotoName("");
    setNote("");
    setAmount("");
    setInvoiceId("");
    setDispositions({});
    setSafe(false);
    setVerified(false);
    setFully(false);
    setReplacement(record.lines[0]?.product_code ?? "");
    setError("");
    setFeedback("");
  };
  const loadPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };
  const eligibleInvoices = state.ledger.filter(
    (row) =>
      row.company_id === context.company_id &&
      row.branch === context.branch &&
      row.supplier === selected?.supplier &&
      row.type === "invoice",
  );
  if (!role || role === "cashier")
    return (
      <EmptyState>
        {t(
          "Cashiers can only use price lookup.",
          "صندوق‌دار فقط می‌تواند قیمت را جستجو کند.",
        )}
      </EmptyState>
    );
  return (
    <>
      {!detailId ? (
        <>
          <PageHeader
            title={t("Returns", "مرجوعی‌ها")}
            description={t(
              "Supplier returns and credits",
              "مرجوعی و بستانکاری تأمین‌کنندگان",
            )}
          />
          <Card className="returns-overview">
            <Tabs
              value={returnTab}
              onChange={(value) => {
                setReturnTab(value);
                setStatus("all");
              }}
              aria-label={t("Returns view", "نمایش مرجوعی‌ها")}
              options={[
                { value: "open", label: t("Open", "باز") },
                { value: "history", label: t("History", "تاریخچه") },
              ]}
            />
            <FilterToolbar
              className="returns-toolbar"
              aria-label={t("Filter returns", "فیلتر مرجوعی‌ها")}
              count={
                <span aria-live="polite">
                  <LtrText>{overviewReturns.length}</LtrText>{" "}
                  {translateCount(
                    "result",
                    "results",
                    "نتیجه",
                    "نتیجه",
                    overviewReturns.length,
                    lang,
                  )}
                </span>
              }
              search={
                <input
                  aria-label={t("Search returns", "جستجوی مرجوعی‌ها")}
                  placeholder={t("Search returns", "جستجوی مرجوعی‌ها")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              }
            >
              <Select
                aria-label={t("Supplier", "تأمین‌کننده")}
                value={supplier}
                onChange={setSupplier}
                searchable
                options={[
                  {
                    value: "all",
                    label: t("All suppliers", "همه تأمین‌کنندگان"),
                  },
                  ...suppliers.map((name) => ({ value: name, label: name })),
                ]}
              />
              <Select
                aria-label={t("Status", "وضعیت")}
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: t("All statuses", "همه وضعیت‌ها") },
                  ...(returnTab === "open"
                    ? ["waiting_for_pickup", "waiting_for_credit"]
                    : ["closed", "cancelled"]
                  ).map((value) => ({ value, label: statusLabel(value) })),
                ]}
              />
              <Select
                aria-label={t("Return branch", "شعبه مرجوعی")}
                value={returnBranch}
                onChange={setReturnBranch}
                options={[
                  {
                    value: "all",
                    label:
                      role === "supervisor"
                        ? t("All branches", "همه شعب")
                        : configuredBranchLabel(
                            state.config,
                            overviewContext.branch,
                            lang,
                          ),
                  },
                  ...(role === "supervisor" ? branches : []).map((value) => ({
                    value,
                    label: configuredBranchLabel(state.config, value, lang),
                  })),
                ]}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSupplier("all");
                  setStatus("all");
                  setReturnBranch("all");
                  setSearch("");
                }}
              >
                {t("Clear filters", "پاک کردن فیلترها")}
              </Button>
            </FilterToolbar>
            <div className="table-column-actions">{tableColumns.chooser}</div>
            <DataTable
              className="returns-overview-table"
              columns={tableColumns.columns}
            >
              <thead>
                <tr>
                  <th>{t("Return #", "شماره مرجوعی")}</th>
                  <th>{t("Supplier", "تأمین‌کننده")}</th>
                  <th>{t("Branch", "شعبه")}</th>
                  <th>{t("Created", "ایجادشده")}</th>
                  <th className="number-cell">{t("Items", "اقلام")}</th>
                  <th>{t("Status", "وضعیت")}</th>
                  <th className="action-cell">
                    {t("Next action", "اقدام بعدی")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {overviewReturns.map((record) => {
                  const action =
                    record.status === "open"
                      ? t("Record pickup", "ثبت جمع‌آوری")
                      : record.status === "cancellation_review"
                        ? t("Review cancellation", "بررسی لغو")
                        : record.status === "claim_pending"
                          ? t("Review claim", "بررسی ادعا")
                          : record.status === "cancelled" ||
                              record.status === "resolved"
                            ? t("View", "مشاهده")
                            : t("Record resolution", "ثبت حل‌وفصل");
                  return (
                    <tr
                      key={record.id}
                      className="returns-clickable-row"
                      tabIndex={0}
                      aria-label={`${t("Return", "مرجوعی")} #${returnNumber(record)} · ${record.supplier}`}
                      onClick={(event) => {
                        if (!(event.target as HTMLElement).closest("a,button"))
                          window.location.hash = detailHref(record);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          window.location.hash = detailHref(record);
                        }
                      }}
                    >
                      <td>
                        <a
                          href={detailHref(record)}
                          className="returns-number-link"
                        >
                          <LtrText>#{returnNumber(record)}</LtrText>
                        </a>
                      </td>
                      <td>
                        <LtrText>{record.supplier}</LtrText>
                      </td>
                      <td className="branch-label">
                        {configuredBranchLabel(
                          state.config,
                          record.branch,
                          lang,
                        )}
                      </td>
                      <td>
                        <DateText value={record.created_at} />
                      </td>
                      <td className="number-cell">
                        <LtrText>
                          {record.lines.reduce(
                            (sum, line) => sum + line.qty,
                            0,
                          )}
                        </LtrText>
                      </td>
                      <td>{returnStatus(record)}</td>
                      <td className="action-cell">
                        <Button asChild variant="secondary" size="sm">
                          <a href={detailHref(record)}>{action}</a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            {overviewReturns.length === 0 && (
              <EmptyState>
                {t(
                  "No returns match these filters.",
                  "مرجوعی‌ای با این فیلترها وجود ندارد.",
                )}
              </EmptyState>
            )}
          </Card>
        </>
      ) : (
        <a className="returns-back-link" href="#returns">
          <ArrowLeft size={16} strokeWidth={1.5} />
          {t("Back to Returns", "بازگشت به مرجوعی‌ها")}
        </a>
      )}
      {detailId && !selected && (
        <EmptyState>
          {t(
            "This return is not available in your branch.",
            "این مرجوعی در شعبه شما در دسترس نیست.",
          )}
        </EmptyState>
      )}
      <Dialog
        open={memo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMemo(null);
            setDismissedMemoHash(hash);
          }
        }}
        title={t("Return memo", "یادداشت مرجوعی")}
        description={memo?.reference}
      >
        {memo && (
          <>
            <ReturnMemoPreview memo={memo} language={lang} />
            <p className="muted">
              {t(
                "Choose Save as PDF in the print window to download a copy.",
                "برای بارگیری نسخه، در پنجره چاپ گزینه ذخیره به صورت PDF را انتخاب کنید.",
              )}
            </p>
            <Button
              onClick={() => {
                update((draft) => {
                  draft.activity.unshift({
                    id: `memo-print-${Date.now()}`,
                    company_id: context.company_id,
                    branch: memo.branch,
                    action: "Return memo printed",
                    by: context.actor,
                    at: new Date().toISOString(),
                    reversible: false,
                  });
                });
                printDocument(
                  <ReturnMemoDocument memo={memo} language={lang} />,
                );
              }}
            >
              {t("Print", "چاپ")}
            </Button>
          </>
        )}
      </Dialog>
      {printOutput}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={t("Verify and post claim", "تأیید و ثبت ادعا")}
        description={t(
          "Confirm the credit note, actual amount and covered quantities. The financial record is kept in History.",
          "یادداشت اعتبار، مبلغ واقعی و تعداد پوشش‌داده‌شده را تأیید کنید. سابقه مالی در تاریخچه نگهداری می‌شود.",
        )}
        confirmLabel={t("Verify and post claim", "تأیید و ثبت ادعا")}
        onConfirm={() => {
          if (!confirmation) return;
          if (
            returnFinancialFingerprint(state, confirmation.returnId) !==
            confirmation.fingerprint
          ) {
            setErrorKey("return_changed");
            setError(
              t(
                "This return or its payable changed. Review it again before posting.",
                "این مرجوعی یا پرداختنی آن تغییر کرده است. پیش از ثبت دوباره بررسی کنید.",
              ),
            );
            setConfirmation(null);
            return;
          }
          run(
            (draft) =>
              postReturnClaim(
                draft,
                context,
                confirmation.returnId,
                confirmation.claimId,
                confirmation.amount,
              ),
            t("Verified and posted claim once.", "ادعا تأیید و یک‌بار ثبت شد."),
          );
          setConfirmation(null);
          setVerified(false);
        }}
      />
      <Dialog
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        title={t("Return policy", "سیاست مرجوعی")}
        description={t(
          "Keep the signed pickup slip and record only what actually happened.",
          "رسید جمع‌آوری امضاشده را نگهداری و فقط رویداد واقعی را ثبت کنید.",
        )}
      >
        <div className="return-policy-content">
          <ol>
            <li>
              {t(
                "Count originals, record condition and location, and keep damaged goods off the sales floor.",
                "اصل کالاها را بشمارید، وضعیت و محل را ثبت و کالای آسیب‌دیده را از فروش خارج کنید.",
              )}
            </li>
            <li>
              {t(
                "Check actual pickup quantities with the representative. Obtain a signed paper slip before handing over goods.",
                "تعداد واقعی را با نماینده بررسی کنید. پیش از تحویل، رسید کاغذی امضاشده بگیرید.",
              )}
            </li>
            <li>
              {t(
                "Retain the signed original and record its reference. A pickup does not require a new invoice.",
                "اصل امضاشده را نگهداری و مرجع آن را ثبت کنید. جمع‌آوری به فاکتور جدید نیاز ندارد.",
              )}
            </li>
            <li>
              {t(
                "Workers submit claims and evidence; Supervisors verify and post money. Replacements record actual receipts.",
                "کارکنان ادعا و مدرک ارسال می‌کنند؛ سرپرست پول را تأیید و ثبت می‌کند. جایگزین دریافت واقعی را ثبت می‌کند.",
              )}
            </li>
            <li>
              {t(
                "Cancellation never restores supplier-held or unsafe goods, and never automatically reverses compensation.",
                "لغو هرگز کالای نزد تأمین‌کننده یا ناسالم را به موجودی بازنمی‌گرداند و جبران را خودکار معکوس نمی‌کند.",
              )}
            </li>
          </ol>
          <div className="actions">
            <Button
              variant="secondary"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([policySource], {
                    type: "text/markdown;charset=utf-8",
                  }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "return-policy.md";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t("Download the full return policy", "دریافت سیاست کامل مرجوعی")}
            </Button>
            <Button onClick={() => setPolicyOpen(false)}>
              {t("Close", "بستن")}
            </Button>
          </div>
        </div>
      </Dialog>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {feedback && (
        <div className="banner approved" role="status">
          {feedback}
        </div>
      )}
      {returns.map((record) => {
        const creation = record as OperationalReturn & {
          created_at?: string;
          created_by?: string;
          by?: string;
        };
        const number =
          state.returns
            .filter((item) => item.company_id === context.company_id)
            .findIndex((item) => item.id === record.id) + 1;
        return (
          <div key={record.id} className="return-detail">
            <Card className="return-header-card">
              <div className="return-detail-header">
                <div>
                  <h1>
                    {t("Return", "مرجوعی")} <LtrText>#{number}</LtrText> ·{" "}
                    {t("created", "ایجادشده در")}{" "}
                    <DateText value={creation.created_at} /> {t("by", "توسط")}{" "}
                    <bdi>
                      {creation.created_by || creation.by
                        ? demoUserLabel(
                            creation.created_by ?? creation.by ?? "",
                            lang,
                          )
                        : "—"}
                    </bdi>
                  </h1>
                  <p className="muted">
                    <LtrText>{record.supplier}</LtrText> ·{" "}
                    <span className="branch-label">
                      {configuredBranchLabel(state.config, record.branch, lang)}
                    </span>
                  </p>
                </div>
                <div className="return-header-actions">
                  {returnStatus(record)}
                  <Button variant="ghost" onClick={() => setPolicyOpen(true)}>
                    {t("Return policy", "سیاست مرجوعی")}
                  </Button>
                  {record.status !== "cancelled" &&
                    record.status !== "cancellation_review" &&
                    record.status !== "resolved" &&
                    record.status !== "claim_pending" && (
                      <Button
                        onClick={() =>
                          openPanel(
                            record,
                            record.status === "open" ? "pickup" : "resolve",
                          )
                        }
                      >
                        {record.status === "open"
                          ? t("Record pickup", "ثبت جمع‌آوری")
                          : t("Record resolution", "ثبت حل‌وفصل")}
                      </Button>
                    )}
                  {record.status === "cancellation_review" &&
                    role === "supervisor" && (
                      <Button
                        onClick={() =>
                          document
                            .getElementById("return-cancellation-review")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            })
                        }
                      >
                        {t("Review cancellation", "بررسی لغو")}
                      </Button>
                    )}
                  {record.status === "claim_pending" &&
                    role === "supervisor" && (
                      <Button
                        onClick={() =>
                          document
                            .getElementById("return-claims")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            })
                        }
                      >
                        {t("Review claim", "بررسی ادعا")}
                      </Button>
                    )}
                </div>
              </div>
            </Card>
            {!!record.pickup_memos?.length && (
              <Card
                title={t("Return memo", "یادداشت مرجوعی")}
                className="return-memos-card"
              >
                <div className="actions">
                  {record.pickup_memos.map((item) => (
                    <Button
                      key={item.id}
                      variant="secondary"
                      onClick={() => setMemo(item)}
                    >
                      <LtrText>{item.reference}</LtrText>
                    </Button>
                  ))}
                </div>
              </Card>
            )}
            <Card title={t("Items", "اقلام")} className="return-lines-card">
              <DataTable
                className="return-lines-table"
                columns={[
                  { width: "28%" },
                  { width: "100px", align: "end" },
                  { width: "110px", align: "end" },
                  { width: "110px", align: "end" },
                  { width: "23%" },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Product", "محصول")}</th>
                    <th className="number-cell">{t("Quantity", "تعداد")}</th>
                    <th className="number-cell">
                      {t("Picked up", "جمع‌آوری‌شده")}
                    </th>
                    <th className="number-cell">{t("Resolved", "حل‌شده")}</th>
                    <th>{t("Reason / location", "دلیل / محل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {record.lines.map((line) => {
                    const product = state.products.find(
                      (item) =>
                        item.company_id === context.company_id &&
                        item.code === line.product_code,
                    );
                    return (
                      <tr key={line.product_code}>
                        <td>
                          {product ? (
                            <ProductName product={product} language={lang} />
                          ) : (
                            <LtrText>{line.product_code}</LtrText>
                          )}
                        </td>
                        <td className="number-cell">
                          <LtrText>
                            {line.qty}
                            {usesPounds(line) ? " lb" : ""}
                          </LtrText>
                        </td>
                        <td className="number-cell">
                          <LtrText>
                            {line.picked_up ??
                              (record.replacement_received ? line.qty : 0)}
                            {usesPounds(line) ? " lb" : ""}
                          </LtrText>
                        </td>
                        <td className="number-cell">
                          <LtrText>
                            {line.settled ??
                              line.replaced ??
                              record.replacement_received
                                ?.covers_original_qty ??
                              0}
                            {usesPounds(line) ? " lb" : ""}
                          </LtrText>
                        </td>
                        <td>
                          {line.reason === "Leaking"
                            ? t("Leaking", "نشتی")
                            : line.reason === "Torn bag"
                              ? t("Torn bag", "کیسه پاره")
                              : line.reason}
                          {line.location && (
                            <div className="muted">
                              {line.location === "Walk-in cooler"
                                ? t("Walk-in cooler", "سردخانه")
                                : line.location}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
              {record.replacement_received && (
                <div className="banner info">
                  {t("Replacement received", "جایگزین دریافت‌شده")}:{" "}
                  <bdi>
                    {productName(record.replacement_received.product_code)}
                  </bdi>{" "}
                  <LtrText>× {record.replacement_received.qty}</LtrText>.{" "}
                  {t(
                    "No amount was added to Payables.",
                    "هیچ مبلغی به پرداختنی‌ها اضافه نشده است.",
                  )}
                </div>
              )}
              {record.cancellation_demo_note && (
                <p className="muted">
                  {t(
                    "Two originals remain with the supplier; one replacement was received. Cancellation restores zero supplier-held units and needs Supervisor review.",
                    "دو اصل کالا نزد تأمین‌کننده است؛ یک جایگزین دریافت شده است. لغو هیچ کالایی از نزد تأمین‌کننده به موجودی بازنمی‌گرداند و نیازمند بررسی سرپرست است.",
                  )}
                </p>
              )}
              {record.signed_pickup_slip_reference && (
                <p>
                  {t("Signed pickup slip", "رسید جمع‌آوری امضاشده")}:{" "}
                  <LtrText>{record.signed_pickup_slip_reference}</LtrText> ·{" "}
                  <bdi>{record.supplier_rep_name}</bdi>
                </p>
              )}
              {record.status !== "cancelled" &&
                record.status !== "cancellation_review" && (
                  <div className="return-secondary-actions">
                    {record.status !== "open" &&
                      record.status !== "resolved" && (
                        <Button
                          variant="secondary"
                          onClick={() => openPanel(record, "pickup")}
                        >
                          {t("Record pickup", "ثبت جمع‌آوری")}
                        </Button>
                      )}
                    <Button
                      variant="danger"
                      onClick={() => openPanel(record, "cancel")}
                    >
                      {record.replacement_received ||
                      record.lines.some(
                        (line) => (line.settled ?? line.replaced ?? 0) > 0,
                      )
                        ? t("Request cancellation", "درخواست لغو")
                        : t("Cancel return", "لغو مرجوعی")}
                    </Button>
                  </div>
                )}
            </Card>
            {active === record.id &&
              record.status !== "cancelled" &&
              record.status !== "cancellation_review" && (
                <Card className="return-action-card form-section">
                  <h3>
                    {panel === "pickup"
                      ? t("Record actual pickup", "ثبت جمع‌آوری واقعی")
                      : panel === "resolve"
                        ? t("Record resolution", "ثبت حل‌وفصل")
                        : t(
                            "Actual original-goods disposition",
                            "وضعیت واقعی اصل کالا",
                          )}
                  </h3>
                  {panel === "resolve" && (
                    <Field label={t("Resolution type", "نوع حل‌وفصل")}>
                      <Select
                        value={resolution}
                        onChange={(value) => {
                          setResolution(value);
                          setError("");
                          setErrorKey("");
                        }}
                        options={[
                          {
                            value: "replacement_received",
                            label: t("Replaced", "جایگزین‌شده"),
                          },
                          {
                            value: "credit_current_invoice",
                            label: t("Credited", "اعتبار دریافت‌شده"),
                          },
                          {
                            value: "cash_or_other",
                            label: t(
                              "Cash or other compensation",
                              "نقد یا جبران دیگر",
                            ),
                          },
                          ...(role === "supervisor"
                            ? [
                                {
                                  value: "no_compensation",
                                  label: t("Written off", "سوخت‌شده"),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </Field>
                  )}
                  <div className="form-grid">
                    {record.lines.map((line) => (
                      <div
                        className="return-quantity-fields"
                        key={line.product_code}
                      >
                        <Field
                          className="field-short"
                          error={fieldError(
                            "quantity",
                            "weight_quantity",
                            "pickup_cap",
                            "coverage",
                            "recovery_cap",
                          )}
                          label={`${productName(line.product_code)}${usesPounds(line) ? " (lb)" : ""} · ${panel === "pickup" ? t("Actual pickup units", "تعداد واقعی جمع‌آوری") : panel === "cancel" ? t("Actual safe originals recovered (zero is valid)", "اصل کالای سالم واقعاً بازیابی‌شده (صفر مجاز است)") : t("Original units this settlement covers", "تعداد اصلی تحت پوشش این تسویه")}`}
                        >
                          <NumberField
                            min="0"
                            max={line.qty}
                            step={usesPounds(line) ? "0.001" : "1"}
                            value={quantities[line.product_code] ?? "0"}
                            onChange={(value) => {
                              clearFieldError(
                                "quantity",
                                "weight_quantity",
                                "pickup_cap",
                                "coverage",
                                "recovery_cap",
                              );
                              setQuantities((current) => ({
                                ...current,
                                [line.product_code]: value,
                              }));
                            }}
                          />
                        </Field>
                        {panel === "cancel" && (
                          <Field
                            label={t("Actual disposition", "وضعیت واقعی")}
                            error={fieldError("disposition")}
                          >
                            <Select
                              value={dispositions[line.product_code] ?? ""}
                              onChange={(value) => {
                                clearFieldError("disposition", "safe");
                                setDispositions((current) => ({
                                  ...current,
                                  [line.product_code]: value as Disposition,
                                }));
                              }}
                              options={[
                                {
                                  value: "",
                                  label: t(
                                    "Choose disposition",
                                    "انتخاب وضعیت",
                                  ),
                                },
                                {
                                  value: "supplier_held",
                                  label: t(
                                    "Supplier still holds originals — restore zero",
                                    "اصل کالا نزد تأمین‌کننده است — بازیابی صفر",
                                  ),
                                },
                                {
                                  value: "unsafe_on_site",
                                  label: t(
                                    "Damaged or unsafe on site — restore zero",
                                    "کالای آسیب‌دیده یا ناسالم در محل — بازیابی صفر",
                                  ),
                                },
                                {
                                  value: "recovered_sellable",
                                  label: t(
                                    "Originals physically recovered and safe to sell",
                                    "اصل کالا واقعاً بازیابی‌شده و سالم برای فروش",
                                  ),
                                },
                              ]}
                            />
                          </Field>
                        )}
                      </div>
                    ))}
                  </div>
                  {panel === "pickup" ||
                  (panel === "resolve" &&
                    resolution === "replacement_received") ? (
                    <div className="form-grid">
                      <Field
                        error={
                          !representative.trim()
                            ? fieldError(
                                "pickup_evidence",
                                "replacement_evidence",
                              )
                            : undefined
                        }
                        label={t(
                          "Supplier representative name",
                          "نام نماینده تأمین‌کننده",
                        )}
                      >
                        <input
                          value={representative}
                          onChange={(event) => {
                            setRepresentative(event.target.value);
                            clearFieldError(
                              "pickup_evidence",
                              "replacement_evidence",
                            );
                          }}
                          placeholder={t(
                            "Type the representative name",
                            "نام نماینده را وارد کنید",
                          )}
                        />
                      </Field>
                      <Field
                        error={
                          !slip.trim()
                            ? fieldError(
                                "pickup_evidence",
                                "replacement_evidence",
                                "duplicate_document",
                              )
                            : undefined
                        }
                        label={
                          panel === "pickup"
                            ? t(
                                "Signed paper pickup slip reference",
                                "مرجع رسید کاغذی امضاشده جمع‌آوری",
                              )
                            : t(
                                "Replacement receipt reference",
                                "مرجع رسید جایگزین",
                              )
                        }
                      >
                        <input
                          value={slip}
                          onChange={(event) => {
                            setSlip(event.target.value);
                            clearFieldError(
                              "pickup_evidence",
                              "replacement_evidence",
                              "duplicate_document",
                            );
                          }}
                          placeholder={
                            panel === "pickup"
                              ? "DEMO-SIGNED-SLIP-001"
                              : "DEMO-REPLACEMENT-001"
                          }
                        />
                      </Field>
                      <Field
                        label={t("Optional item photo", "عکس اختیاری کالا")}
                      >
                        <Dropzone
                          accept="image/*"
                          fileName={
                            photo
                              ? photoName || t("Item photo", "عکس کالا")
                              : undefined
                          }
                          onChange={loadPhoto}
                          onRemove={() => {
                            setPhoto("");
                            setPhotoName("");
                          }}
                        />
                      </Field>
                      {photo && (
                        <img
                          className="evidence-photo"
                          src={photo}
                          alt={t("Evidence photo", "عکس مدرک")}
                        />
                      )}
                    </div>
                  ) : null}
                  {panel === "resolve" &&
                    resolution === "replacement_received" && (
                      <div className="form-grid">
                        <Field
                          error={
                            !replacement
                              ? fieldError("replacement_evidence", "product")
                              : undefined
                          }
                          label={t(
                            "Replacement product actually received",
                            "کالای جایگزین واقعاً دریافت‌شده",
                          )}
                        >
                          <Select
                            value={replacement}
                            onChange={(value) => {
                              setReplacement(value);
                              clearFieldError(
                                "replacement_evidence",
                                "product",
                                "quantity",
                                "weight_quantity",
                              );
                            }}
                            options={state.products
                              .filter(
                                (item) =>
                                  item.company_id === context.company_id &&
                                  item.status === "active",
                              )
                              .map((product) => ({
                                value: product.code,
                                label: productName(product.code),
                              }))}
                          />
                        </Field>
                        <Field
                          className="field-short"
                          error={fieldError("quantity", "weight_quantity")}
                          label={`${t(
                            "Actual replacement quantity",
                            "تعداد واقعی جایگزین",
                          )}${usesPounds({ product_code: replacement, qty: 0, reason: "" }) ? " (lb)" : ""}`}
                        >
                          <NumberField
                            min={
                              usesPounds({
                                product_code: replacement,
                                qty: 0,
                                reason: "",
                              })
                                ? "0.001"
                                : "1"
                            }
                            step={
                              usesPounds({
                                product_code: replacement,
                                qty: 0,
                                reason: "",
                              })
                                ? "0.001"
                                : "1"
                            }
                            value={replacementQty}
                            onChange={(value) => {
                              setReplacementQty(value);
                              clearFieldError(
                                "quantity",
                                "weight_quantity",
                                "coverage",
                              );
                            }}
                          />
                        </Field>
                        <Field
                          label={t("Received date", "تاریخ دریافت")}
                          error={
                            !date
                              ? fieldError("replacement_evidence")
                              : undefined
                          }
                        >
                          <DateField
                            value={date}
                            onChange={(value) => {
                              setDate(value);
                              clearFieldError("replacement_evidence");
                            }}
                          />
                        </Field>
                        <Checkbox checked={fully} onChange={setFully}>
                          {t(
                            "Fully resolves the original return (otherwise partial)",
                            "مرجوعی اصلی را کامل حل می‌کند (در غیر این صورت جزئی)",
                          )}
                        </Checkbox>
                      </div>
                    )}
                  {panel === "resolve" &&
                    resolution !== "replacement_received" && (
                      <>
                        <p className="banner info">
                          {t(
                            "Workers submit evidence and covered quantities. Only a Supervisor verifies and posts financial amounts.",
                            "کارکنان مدرک و تعداد پوشش‌داده‌شده ارسال می‌کنند. فقط سرپرست مبالغ مالی را تأیید و ثبت می‌کند.",
                          )}
                        </p>
                        {role === "supervisor" &&
                          resolution !== "no_compensation" && (
                            <Field
                              className="field-short"
                              label={t(
                                "Actual credit amount",
                                "مبلغ واقعی اعتبار",
                              )}
                              error={fieldError("amount")}
                            >
                              <NumberField
                                value={amount}
                                onChange={(value) => {
                                  setAmount(value);
                                  clearFieldError("amount");
                                }}
                              />
                            </Field>
                          )}
                        {resolution !== "no_compensation" && (
                          <Field
                            error={fieldError(
                              "credit_document",
                              "duplicate_document",
                            )}
                            label={t(
                              "Credit note number",
                              "شماره یادداشت اعتبار",
                            )}
                          >
                            <input
                              value={slip}
                              onChange={(event) => {
                                setSlip(event.target.value);
                                clearFieldError(
                                  "credit_document",
                                  "duplicate_document",
                                );
                              }}
                              placeholder="DEMO-CREDIT-001"
                            />
                          </Field>
                        )}
                        {resolution.startsWith("credit_") && (
                          <Field
                            error={fieldError("invoice", "single_invoice")}
                            label={t(
                              "One posted invoice to credit",
                              "یک فاکتور ثبت‌شده برای بستانکاری",
                            )}
                          >
                            <Select
                              value={invoiceId}
                              onChange={(value) => {
                                setInvoiceId(value);
                                clearFieldError("invoice", "single_invoice");
                              }}
                              options={[
                                {
                                  value: "",
                                  label: t(
                                    "Choose an invoice",
                                    "انتخاب فاکتور",
                                  ),
                                },
                                ...eligibleInvoices.map((row) => ({
                                  value: row.invoice_id ?? row.id,
                                  label: row.reference,
                                })),
                              ]}
                            />
                          </Field>
                        )}
                      </>
                    )}
                  <Field
                    error={fieldError("reason")}
                    label={
                      panel === "cancel"
                        ? t(
                            "Cancellation reason (required)",
                            "دلیل لغو (ضروری)",
                          )
                        : resolution === "no_compensation"
                          ? t(
                              "Reason for no compensation (required)",
                              "دلیل بدون جبران (ضروری)",
                            )
                          : panel === "resolve" &&
                              resolution === "no_compensation"
                            ? t(
                                "Write-off reason (required)",
                                "دلیل سوخت‌کردن (ضروری)",
                              )
                            : t("Optional note", "یادداشت اختیاری")
                    }
                  >
                    <textarea
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        clearFieldError("reason");
                      }}
                    />
                  </Field>
                  {panel === "cancel" && (
                    <>
                      <div className="banner info">
                        {t(
                          "Leave recovered quantity at zero for supplier-held or unsafe goods. Existing replacements and credits are preserved for Supervisor review.",
                          "برای کالای نزد تأمین‌کننده یا ناسالم، تعداد بازیابی را صفر نگه دارید. جایگزین‌ها و بستانکاری‌های قبلی برای بررسی سرپرست حفظ می‌شوند.",
                        )}
                      </div>
                      <Checkbox
                        checked={safe}
                        onChange={(value) => {
                          setSafe(value);
                          clearFieldError("safe");
                        }}
                      >
                        {t(
                          "I inspected these physically recovered originals and confirm they are safe and sellable.",
                          "اصل کالاهای واقعاً بازیابی‌شده را بررسی و سالم و قابل‌فروش بودن آن‌ها را تأیید می‌کنم.",
                        )}
                      </Checkbox>
                    </>
                  )}
                  <p className="muted">
                    {t("Recorded by", "ثبت‌کننده")}:{" "}
                    {demoUserLabel(context.actor, lang)} ·{" "}
                    <span className="branch-label">
                      {configuredBranchLabel(
                        state.config,
                        context.branch,
                        lang,
                      )}
                    </span>
                  </p>
                  <div className="actions">
                    <Button
                      disabled={context.branch === "all"}
                      onClick={() => {
                        if (panel === "pickup")
                          run(
                            (draft) =>
                              recordPickup(draft, context, record.id, {
                                quantities: counts(record),
                                representative,
                                slip,
                                photo,
                                note,
                              }),
                            t(
                              "Recorded pickup and retained Return memo.",
                              "جمع‌آوری ثبت و یادداشت مرجوعی نگهداری شد.",
                            ),
                          );
                        else if (panel === "cancel")
                          run(
                            (draft) =>
                              cancelReturn(draft, context, record.id, {
                                reason: note,
                                dispositions,
                                recovered: counts(record),
                                safe,
                              }),
                            t(
                              "Recorded cancellation disposition. Existing compensation remains unchanged.",
                              "وضعیت لغو ثبت شد. جبران قبلی بدون تغییر باقی ماند.",
                            ),
                          );
                        else if (resolution === "replacement_received")
                          run(
                            (draft) =>
                              receiveReplacement(draft, context, record.id, {
                                product_code: replacement,
                                qty: Number(replacementQty),
                                covers: counts(record),
                                date,
                                representative,
                                note,
                                photo,
                                receipt: slip,
                                invoice_id: invoiceId || undefined,
                                fully,
                              }),
                            t(
                              "Replacement received. Pending credit was released for the covered quantities.",
                              "جایگزین دریافت شد. اعتبار در انتظار تعداد پوشش‌داده‌شده آزاد شد.",
                            ),
                          );
                        else
                          run(
                            (draft) =>
                              submitFinancialClaim(draft, context, record.id, {
                                type: resolution as ReturnClaim["type"],
                                covers: counts(record),
                                document: slip,
                                invoice_id: invoiceId,
                                reason: note,
                                amount:
                                  role === "supervisor" &&
                                  resolution !== "no_compensation"
                                    ? amount
                                    : undefined,
                              }),
                            t(
                              "Submitted claim for Supervisor verification.",
                              "ادعا برای تأیید سرپرست ارسال شد.",
                            ),
                          );
                      }}
                    >
                      {panel === "pickup"
                        ? t("Record pickup", "ثبت جمع‌آوری")
                        : panel === "cancel"
                          ? t(
                              "Record cancellation disposition",
                              "ثبت وضعیت لغو",
                            )
                          : resolution === "replacement_received"
                            ? t("Receive replacement", "دریافت جایگزین")
                            : t("Submit claim", "ارسال ادعا")}
                    </Button>
                    <Button variant="secondary" onClick={() => setActive(null)}>
                      {t("Close", "بستن")}
                    </Button>
                  </div>
                </Card>
              )}
            <div id="return-claims">
              {(record.claims ?? []).map((claim) => (
                <Card key={claim.id} className="form-section return-claim-card">
                  <div className="row-between">
                    <strong>
                      {claim.type.startsWith("credit_")
                        ? t("Credit claim", "ادعای بستانکاری")
                        : claim.type === "cash_or_other"
                          ? t("Compensation claim", "ادعای جبران")
                          : t("No compensation claim", "ادعای بدون جبران")}
                    </strong>
                    <Badge
                      tone={claim.status === "posted" ? "approved" : "pending"}
                    >
                      {claim.status === "posted"
                        ? t("Posted", "ثبت‌شده")
                        : t("Pending", "در انتظار")}
                    </Badge>
                  </div>
                  <p>
                    {t("Evidence", "مدرک")}:{" "}
                    <bdi>{claim.document || claim.reason}</bdi> ·{" "}
                    {t("Submitted by", "ارسال‌کننده")}:{" "}
                    {demoUserLabel(claim.submitted_by, lang)}
                  </p>
                  {role === "supervisor" && claim.status === "submitted" && (
                    <>
                      <Field
                        className="field-short"
                        error={fieldError("amount")}
                        label={t(
                          "Verified financial amount (Supervisor only)",
                          "مبلغ مالی تأییدشده (فقط سرپرست)",
                        )}
                      >
                        <NumberField
                          value={amount || claim.amount || ""}
                          onChange={(value) => {
                            setAmount(value);
                            clearFieldError("amount");
                          }}
                          disabled={claim.type === "no_compensation"}
                        />
                      </Field>
                      <Checkbox checked={verified} onChange={setVerified}>
                        {t(
                          "I verified the document, covered quantities, and invoice allocation.",
                          "سند، تعداد پوشش‌داده‌شده و تخصیص فاکتور را تأیید کردم.",
                        )}
                      </Checkbox>
                      <Button
                        disabled={!verified || context.branch === "all"}
                        onClick={() =>
                          setConfirmation({
                            returnId: record.id,
                            claimId: claim.id,
                            amount: amount || claim.amount || "",
                            fingerprint: returnFinancialFingerprint(
                              state,
                              record.id,
                            ),
                          })
                        }
                      >
                        {t("Verify and post claim", "تأیید و ثبت ادعا")}
                      </Button>
                    </>
                  )}
                </Card>
              ))}
            </div>
            {record.status === "cancellation_review" && (
              <Card
                className="form-section return-review-card"
                id="return-cancellation-review"
              >
                <div className="banner pending">
                  {t(
                    "Supervisor review required. Supplier-held originals are not recorded as recovered. Existing settlement has not been reversed.",
                    "بررسی سرپرست ضروری است. اصل کالای نزد تأمین‌کننده به عنوان بازیابی‌شده ثبت نمی‌شود. تسویه قبلی معکوس نشده است.",
                  )}
                </div>
                {role === "supervisor" && (
                  <>
                    <Field
                      label={t(
                        "Settlement review and reason",
                        "بررسی تسویه و دلیل",
                      )}
                    >
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                      />
                    </Field>
                    <Checkbox
                      checked={retainSettlement}
                      onChange={setRetainSettlement}
                    >
                      {t(
                        "I reviewed the history. Existing replacement or compensation is retained; no reversal is needed.",
                        "سابقه را بررسی کردم. جایگزین یا جبران قبلی حفظ می‌شود؛ معکوس‌سازی لازم نیست.",
                      )}
                    </Checkbox>
                    <div className="actions">
                      <Button
                        disabled={context.branch === "all"}
                        onClick={() =>
                          run(
                            (draft) =>
                              reviewCancellation(draft, context, record.id, {
                                accept: true,
                                settlement_retained: retainSettlement,
                                note: reviewNote,
                              }),
                            t(
                              "Approved cancellation; retained existing settlement.",
                              "لغو تأیید شد؛ تسویه قبلی حفظ شد.",
                            ),
                          )
                        }
                      >
                        {t("Approve cancellation", "تأیید لغو")}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={context.branch === "all"}
                        onClick={() =>
                          run(
                            (draft) =>
                              reviewCancellation(draft, context, record.id, {
                                accept: false,
                                settlement_retained: false,
                                note: reviewNote,
                              }),
                            t(
                              "Declined cancellation; preserved return history.",
                              "لغو رد شد؛ سابقه مرجوعی حفظ شد.",
                            ),
                          )
                        }
                      >
                        {t("Decline cancellation", "رد لغو")}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            )}
            <Card
              title={t("Evidence and history", "مدارک و سوابق")}
              className="return-evidence-card"
            >
              <div id={`return-history-${record.id}`}>
                {(record.evidence ?? []).length === 0 ? (
                  <p className="muted">
                    {t(
                      "No additional events yet.",
                      "رویداد دیگری ثبت نشده است.",
                    )}
                  </p>
                ) : (
                  (record.evidence ?? []).map((event) => (
                    <div className="history-row" key={event.id}>
                      <strong>
                        {event.kind === "pickup"
                          ? t("Recorded pickup", "جمع‌آوری ثبت‌شده")
                          : event.kind === "replacement"
                            ? t("Received replacement", "جایگزین دریافت‌شده")
                            : event.kind === "original_recovery"
                              ? t(
                                  "Received safe original goods",
                                  "اصل کالای سالم دریافت شد",
                                )
                              : event.kind.startsWith("cancellation")
                                ? t("Cancellation review", "بررسی لغو")
                                : t("Resolution claim", "ادعای حل‌وفصل")}
                      </strong>
                      <p>
                        <LtrText>
                          {companyTimestamp(state.config, event.at)}
                        </LtrText>{" "}
                        · {demoUserLabel(event.by, lang)} ·{" "}
                        <LtrText>{event.document}</LtrText>
                      </p>
                      {event.note && <p>{event.note}</p>}
                      {event.photo && (
                        <img
                          className="evidence-photo"
                          src={event.photo}
                          alt={t(
                            "Retained local evidence photo",
                            "عکس مدرک محلی حفظ‌شده",
                          )}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        );
      })}
    </>
  );
}
export default Returns;
