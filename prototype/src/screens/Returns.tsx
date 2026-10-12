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
  returnClosureSubtype,
  returnFinancialFingerprint,
  type ReturnMemo,
} from "../return-workflow";
import "./returns-a2.css";
import { ReturnStatusBadge } from "../ReturnStatusBadge";
import { ReturnActionForms, ReturnCancellationForm } from "./ReturnActionForms";
import { returnItemProgress } from "../return-item-resolutions";
import { StoredFileImage } from "../stored-file";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import policySource from "../../../docs/return-policy.md?raw";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  ConfirmDialog,
  Tabs,
  DataTable,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  DialogActions,
  TableRowLink,
  useTableColumns,
} from "../ui";
import { DateText, demoUserLabel, LtrText, ProductName } from "../presentation";
import {
  operationError,
  canCorrectReturnPickup,
  returnUnpickedQuantity,
  companyTimestamp,
  postReturnClaim,
  reviewCancellation,
  scopedRecords,
  type OperationalReturn,
  type OperationsContext,
} from "../operations";

const returnFeedback = {
  pickup: [
    "Recorded pickup and retained Return memo.",
    "جمع‌آوری ثبت و یادداشت مرجوعی نگهداری شد.",
  ],
  correct: [
    "Corrected pickup. The original signed record is retained.",
    "جمع‌آوری اصلاح شد. سابقه امضاشده اصلی نگهداری می‌شود.",
  ],
  resolve: [
    "Recorded item resolutions. Credit claims require Supervisor verification.",
    "حل‌وفصل اقلام ثبت شد. ادعای اعتبار به تأیید سرپرست نیاز دارد.",
  ],
  cancel: [
    "Recorded cancellation disposition. Existing compensation remains unchanged.",
    "وضعیت لغو ثبت شد. جبران قبلی بدون تغییر باقی ماند.",
  ],
  posted: ["Verified and posted claim once.", "ادعا تأیید و یک‌بار ثبت شد."],
  cancellationApproved: [
    "Approved cancellation; retained existing settlement.",
    "لغو تأیید شد؛ تسویه قبلی حفظ شد.",
  ],
  cancellationDeclined: [
    "Declined cancellation; preserved return history.",
    "لغو رد شد؛ سابقه مرجوعی حفظ شد.",
  ],
} as const;
type ReturnFeedbackKey = keyof typeof returnFeedback;

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
  const [active, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    "pickup" | "correct" | "resolve" | "cancel"
  >("pickup");
  const [claimAmounts, setClaimAmounts] = useState<Record<string, string>>({});
  const [verifiedClaims, setVerifiedClaims] = useState<Record<string, boolean>>(
    {},
  );
  const [claimItemAmounts, setClaimItemAmounts] = useState<
    Record<string, Record<string, string>>
  >({});
  const [claimIssues, setClaimIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [feedback, setFeedback] = useState<ReturnFeedbackKey | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [retainSettlement, setRetainSettlement] = useState(false);
  const [manualMemo, setMemo] = useState<ReturnMemo | null>(null);
  const [dismissedMemoHash, setDismissedMemoHash] = useState("");
  const [confirmation, setConfirmation] = useState<{
    returnId: string;
    claimId: string;
    amount: string;
    fingerprint: string;
    itemAmounts?: Record<string, string>;
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
      priority: 0,
      mobilePrimary: true,
    },
    {
      key: "supplier",
      label: t("Supplier", "تأمین‌کننده"),
      required: true,
      width: 220,
      priority: 0,
    },
    { key: "location", label: t("Branch", "شعبه"), width: 144, priority: 3 },
    { key: "date", label: t("Created", "ایجادشده"), width: 128, priority: 4 },
    {
      key: "items",
      label: t("Items", "اقلام"),
      width: 76,
      align: "end",
      priority: 5,
    },
    { key: "status", label: t("Status", "وضعیت"), width: 172, priority: 1 },
    {
      key: "actions",
      label: t("Next action", "اقدام بعدی"),
      width: 144,
      align: "end",
      actions: true,
      priority: 2,
    },
  ]);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setActive(null);
      setMemo(null);
      setError("");
      setErrorKey("");
      setFeedback(null);
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
  useEffect(() => {
    if (!hash.startsWith("#returns?")) return;
    const params = new URLSearchParams(hash.split("?")[1]);
    if (params.has("supplier")) {
      setSupplier(params.get("supplier") ?? "all");
      setReturnTab(params.get("tab") === "history" ? "history" : "open");
      setStatus("all");
      setReturnBranch("all");
      setSearch("");
    }
  }, [hash, setSupplier, setReturnTab, setStatus, setReturnBranch, setSearch]);
  const returns = selected ? [selected] : [];
  const productName = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return product
      ? lang === "fa"
        ? product.name_fa || product.name_en
        : product.name_en
      : code;
  };
  const statusLabel = (status: string) => returnUiStatusLabel(status, t);
  const returnStatus = (record: OperationalReturn) => (
    <ReturnStatusBadge
      status={returnUiStatus(record)}
      outcome={returnClosureSubtype(record)}
    />
  );
  const run = (
    action: (draft: typeof state) => void,
    message: ReturnFeedbackKey,
  ) => {
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
      setFeedback(null);
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
  const openPanel = (record: OperationalReturn, nextPanel: typeof panel) => {
    setActive(record.id);
    setPanel(nextPanel);
    setError("");
    setErrorKey("");
    setFeedback(null);
  };
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
                <span className="returns-toolbar-end">
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
                  {tableColumns.chooser}
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
                  <th className="number-cell returns-items-cell">
                    {t("Items", "اقلام")}
                  </th>
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
                      data-row-href={detailHref(record)}
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
                      <td className="number-cell returns-items-cell">
                        <LtrText>
                          {record.lines.reduce(
                            (sum, line) => sum + line.qty,
                            0,
                          )}
                        </LtrText>
                      </td>
                      <td>{returnStatus(record)}</td>
                      <td className="action-cell">
                        <div className="actions table-actions">
                          {record.status !== "cancelled" &&
                            record.status !== "resolved" && (
                              <Button asChild variant="neutral" size="sm">
                                <a href={detailHref(record)}>{action}</a>
                              </Button>
                            )}
                          <TableRowLink
                            href={detailHref(record)}
                            aria-label={`${t("View", "مشاهده")} ${t("Return", "مرجوعی")} #${returnNumber(record)}`}
                          />
                        </div>
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
            <ReturnMemoPreview
              memo={memo}
              language={lang}
              documentLanguage={
                state.config.supplier_documents?.return_memo ?? "en"
              }
            />
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
                  <ReturnMemoDocument
                    memo={memo}
                    language={lang}
                    documentLanguage={
                      state.config.supplier_documents?.return_memo ?? "en"
                    }
                  />,
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
                confirmation.itemAmounts,
              ),
            "posted",
          );
          setConfirmation(null);
          setVerifiedClaims((current) => ({
            ...current,
            [confirmation.claimId]: false,
          }));
        }}
      />
      <Dialog
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        title={t("Return policy", "سیاست مرجوعی")}
        className="return-policy-dialog"
        description={t(
          "Keep the signed pickup slip and record only what actually happened.",
          "رسید جمع‌آوری امضاشده را نگهداری و فقط رویداد واقعی را ثبت کنید.",
        )}
      >
        <div className="return-policy-content">
          <ol>
            <li>
              <strong>{t("Count and separate", "شمارش و جداسازی")}</strong>
              <p>
                {t(
                  "Count originals, record their condition and location, and keep damaged goods off the sales floor.",
                  "اصل کالاها را بشمارید، وضعیت و محل آن‌ها را ثبت و کالای آسیب‌دیده را از فروش خارج کنید.",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Confirm pickup", "تأیید جمع‌آوری")}</strong>
              <p>
                {t(
                  "Confirm actual quantities with the representative and obtain a signed paper slip before handing over goods.",
                  "تعداد واقعی را با نماینده تأیید کنید و پیش از تحویل کالا رسید کاغذی امضاشده بگیرید.",
                )}
              </p>
            </li>
            <li>
              <strong>
                {t("Keep signed evidence", "نگهداری مدرک امضاشده")}
              </strong>
              <p>
                {t(
                  "Keep the signed original and its reference; pickup does not require a new invoice.",
                  "اصل امضاشده و مرجع آن را نگهداری کنید؛ جمع‌آوری به فاکتور جدید نیاز ندارد.",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Record the outcome", "ثبت نتیجه")}</strong>
              <p>
                {t(
                  "Workers submit claims and evidence, Supervisors verify and post money, and replacements record actual receipts.",
                  "کارکنان ادعا و مدرک ارسال می‌کنند، سرپرستان پول را تأیید و ثبت می‌کنند و برای جایگزین دریافت واقعی ثبت می‌شود.",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Cancel safely", "لغو ایمن")}</strong>
              <p>
                {t(
                  "Cancellation never restores supplier-held or unsafe goods or automatically reverses compensation.",
                  "لغو هرگز کالای نزد تأمین‌کننده یا ناسالم را به موجودی بازنمی‌گرداند یا جبران را خودکار معکوس نمی‌کند.",
                )}
              </p>
            </li>
          </ol>
          <DialogActions>
            <Button variant="neutral" onClick={() => setPolicyOpen(false)}>
              {t("Close", "بستن")}
            </Button>
            <Button
              variant="tinted"
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
              {t("Download full policy", "دانلود سیاست کامل")}
            </Button>
          </DialogActions>
        </div>
      </Dialog>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {feedback && (
        <div className="banner approved" role="status">
          {t(returnFeedback[feedback][0], returnFeedback[feedback][1])}
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
                  <div className="return-detail-title">
                    <h1>
                      {t("Return", "مرجوعی")} <LtrText>#{number}</LtrText>
                    </h1>
                    {returnStatus(record)}
                  </div>
                  <p className="muted return-detail-subtitle">
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
                    {" · "}
                    <LtrText>{record.supplier}</LtrText>
                    {" · "}
                    <span className="branch-label">
                      {configuredBranchLabel(state.config, record.branch, lang)}
                    </span>
                  </p>
                </div>
                <div className="return-header-actions">
                  <Button variant="neutral" onClick={() => setPolicyOpen(true)}>
                    {t("Return policy", "سیاست مرجوعی")}
                  </Button>
                  {record.status !== "cancelled" &&
                    record.status !== "cancellation_review" &&
                    record.status !== "resolved" &&
                    (record.status !== "claim_pending" ||
                      record.lines.some(
                        (line) =>
                          returnItemProgress(record, line).available > 0,
                      )) && (
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
                        variant={
                          record.lines.some(
                            (line) =>
                              returnItemProgress(record, line).available > 0,
                          )
                            ? "neutral"
                            : "primary"
                        }
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
                      variant="tinted"
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
                          <div className="return-item-progress">
                            {returnItemProgress(record, line).credited > 0 && (
                              <span>
                                {t("Credited", "اعتبار دریافت‌شده")}:{" "}
                                <bdi>
                                  {returnItemProgress(record, line).credited}
                                </bdi>
                              </span>
                            )}
                            {returnItemProgress(record, line).replaced > 0 && (
                              <span>
                                {t("Replaced", "جایگزین‌شده")}:{" "}
                                <bdi>
                                  {returnItemProgress(record, line).replaced}
                                </bdi>
                              </span>
                            )}
                            {returnItemProgress(record, line).written_off >
                              0 && (
                              <span>
                                {t("Written off", "سوخت‌شده")}:{" "}
                                <bdi>
                                  {returnItemProgress(record, line).written_off}
                                </bdi>
                              </span>
                            )}
                            {returnItemProgress(record, line).outstanding >
                              0 && (
                              <span>
                                {t("Still outstanding", "هنوز باقی‌مانده")}:{" "}
                                <bdi>
                                  {returnItemProgress(record, line).outstanding}
                                </bdi>
                                {line.outstanding_expected_date && (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <DateText
                                      value={line.outstanding_expected_date}
                                    />
                                  </>
                                )}
                              </span>
                            )}
                          </div>
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
                      record.status !== "resolved" &&
                      record.lines.some(
                        (line) => returnUnpickedQuantity(record, line) > 0,
                      ) && (
                        <Button
                          variant="neutral"
                          onClick={() => openPanel(record, "pickup")}
                        >
                          {t("Record pickup", "ثبت جمع‌آوری")}
                        </Button>
                      )}
                    {record.pickup_memos?.length &&
                    canCorrectReturnPickup(context) ? (
                      <Button
                        variant="neutral"
                        onClick={() => openPanel(record, "correct")}
                      >
                        {t("Correct pickup", "اصلاح جمع‌آوری")}
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
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
              record.status !== "cancellation_review" &&
              (panel === "cancel" ? (
                <ReturnCancellationForm
                  key={`${record.id}-cancel`}
                  record={record}
                  context={context}
                  onClose={() => setActive(null)}
                  onSaved={() => {
                    setActive(null);
                    setFeedback("cancel");
                  }}
                />
              ) : (
                <ReturnActionForms
                  key={`${record.id}-${panel}`}
                  record={record}
                  context={context}
                  mode={panel}
                  onClose={() => setActive(null)}
                  onSaved={() => {
                    setActive(null);
                    setFeedback(panel);
                  }}
                />
              ))}
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
                      <WhatsMissing issues={claimIssues} />
                      <Field
                        className="field-short"
                        error={
                          fieldError("amount") ||
                          claimIssues.find(
                            (issue) =>
                              issue.fieldId === `claim-amount-${claim.id}`,
                          )?.message
                        }
                        label={t(
                          "Verified financial amount (Supervisor only)",
                          "مبلغ مالی تأییدشده (فقط سرپرست)",
                        )}
                      >
                        <NumberField
                          id={`claim-amount-${claim.id}`}
                          value={claimAmounts[claim.id] ?? claim.amount ?? ""}
                          onChange={(value) => {
                            setClaimAmounts((current) => ({
                              ...current,
                              [claim.id]: value,
                            }));
                            clearFieldError("amount");
                            setClaimIssues((current) =>
                              current.filter(
                                (issue) =>
                                  issue.fieldId !== `claim-amount-${claim.id}`,
                              ),
                            );
                          }}
                          disabled={claim.type === "no_compensation"}
                        />
                      </Field>
                      {claim.type !== "no_compensation" &&
                        Object.values(claim.covers).filter((count) => count > 0)
                          .length > 1 && (
                          <div className="form-grid">
                            {Object.entries(claim.covers)
                              .filter(([, count]) => count > 0)
                              .map(([code]) => (
                                <Field
                                  key={code}
                                  className="field-short"
                                  label={`${productName(code)} · ${t("Actual credit amount", "مبلغ واقعی اعتبار")}`}
                                  error={
                                    claimIssues.find(
                                      (issue) =>
                                        issue.fieldId ===
                                        `claim-item-${claim.id}-${code}`,
                                    )?.message
                                  }
                                >
                                  <NumberField
                                    id={`claim-item-${claim.id}-${code}`}
                                    value={
                                      claimItemAmounts[claim.id]?.[code] ??
                                      claim.item_amounts?.[code] ??
                                      ""
                                    }
                                    onChange={(value) => {
                                      setClaimItemAmounts((current) => ({
                                        ...current,
                                        [claim.id]: {
                                          ...current[claim.id],
                                          [code]: value,
                                        },
                                      }));
                                      setClaimIssues((current) =>
                                        current.filter(
                                          (issue) =>
                                            issue.fieldId !==
                                            `claim-item-${claim.id}-${code}`,
                                        ),
                                      );
                                    }}
                                  />
                                </Field>
                              ))}
                          </div>
                        )}
                      <Checkbox
                        id={`claim-verify-${claim.id}`}
                        checked={!!verifiedClaims[claim.id]}
                        onChange={(value) => {
                          setVerifiedClaims((current) => ({
                            ...current,
                            [claim.id]: value,
                          }));
                          setClaimIssues((current) =>
                            current.filter(
                              (issue) =>
                                issue.fieldId !== `claim-verify-${claim.id}`,
                            ),
                          );
                        }}
                      >
                        {t(
                          "I verified the document, covered quantities, and invoice allocation.",
                          "سند، تعداد پوشش‌داده‌شده و تخصیص فاکتور را تأیید کردم.",
                        )}
                      </Checkbox>
                      <Button
                        onClick={() => {
                          const missing: ValidationIssue[] = [];
                          if (!verifiedClaims[claim.id])
                            missing.push({
                              id: `claim-verify-${claim.id}-error`,
                              fieldId: `claim-verify-${claim.id}`,
                              message: t(
                                "Verify the document, covered quantities and invoice allocation.",
                                "سند، تعداد تحت پوشش و تخصیص فاکتور را تأیید کنید.",
                              ),
                            });
                          if (
                            claim.type !== "no_compensation" &&
                            !(
                              Number(claimAmounts[claim.id] ?? claim.amount) > 0
                            )
                          )
                            missing.push({
                              id: `claim-amount-${claim.id}-error`,
                              fieldId: `claim-amount-${claim.id}`,
                              message: t(
                                "Enter a valid verified financial amount.",
                                "مبلغ مالی تأییدشده معتبر وارد کنید.",
                              ),
                            });
                          const coveredCodes = Object.keys(claim.covers).filter(
                            (code) => claim.covers[code] > 0,
                          );
                          const itemAmounts =
                            claim.type !== "no_compensation" &&
                            coveredCodes.length > 1
                              ? Object.fromEntries(
                                  coveredCodes.map((code) => [
                                    code,
                                    claimItemAmounts[claim.id]?.[code] ??
                                      claim.item_amounts?.[code] ??
                                      "",
                                  ]),
                                )
                              : undefined;
                          if (itemAmounts)
                            for (const code of coveredCodes)
                              if (!(Number(itemAmounts[code]) > 0))
                                missing.push({
                                  id: `claim-item-${claim.id}-${code}-error`,
                                  fieldId: `claim-item-${claim.id}-${code}`,
                                  message: t(
                                    `Enter the actual credit amount for ${productName(code)}.`,
                                    `مبلغ واقعی اعتبار ${productName(code)} را وارد کنید.`,
                                  ),
                                });
                          setClaimIssues(missing);
                          if (missing.length) return;
                          setConfirmation({
                            returnId: record.id,
                            claimId: claim.id,
                            amount:
                              claimAmounts[claim.id] ?? claim.amount ?? "",
                            itemAmounts,
                            fingerprint: returnFinancialFingerprint(
                              state,
                              record.id,
                            ),
                          });
                        }}
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
                            "cancellationApproved",
                          )
                        }
                      >
                        {t("Approve cancellation", "تأیید لغو")}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={context.branch === "all"}
                        onClick={() =>
                          run(
                            (draft) =>
                              reviewCancellation(draft, context, record.id, {
                                accept: false,
                                settlement_retained: false,
                                note: reviewNote,
                              }),
                            "cancellationDeclined",
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
                        {event.kind === "pickup_correction"
                          ? t("Corrected pickup", "جمع‌آوری اصلاح‌شده")
                          : event.kind === "outstanding"
                            ? t("Still outstanding", "هنوز باقی‌مانده")
                            : event.kind === "pickup"
                              ? t("Recorded pickup", "جمع‌آوری ثبت‌شده")
                              : event.kind === "replacement"
                                ? t(
                                    "Received replacement",
                                    "جایگزین دریافت‌شده",
                                  )
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
                        <StoredFileImage
                          className="evidence-photo"
                          value={event.photo}
                          companyId={context.company_id}
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
