import "../c3-tables.css";
import {
  branchLabel as configuredBranchLabel,
  configuredBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { useState } from "react";
import {
  useListState,
  navigationKey,
  saveNavigationValue,
} from "../navigation";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import { companyDate } from "../invoice";
import { DateText, formatMoney, LtrText, Money } from "../presentation";
import {
  supplierBalanceCsv,
  supplierBalanceOverview,
  supplierBalanceSummary,
} from "../supplier-balances";
import "./financial-polish.css";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Select,
  DateField,
  NumberField,
  SummaryTile,
  Tabs,
  ConfirmDialog,
  useTableColumns,
} from "../ui";
import {
  markLedgerDispute,
  monthEndDate,
  operationError,
  postLedgerAdjustment,
  postPayment,
  suggestAllocations,
  type Allocation,
  type OperationsContext,
} from "../operations";
import type { Branch } from "../types";
import "./filters-a2.css";

export function Payables() {
  const { state, update, role, branch, setBranch, user, lang, t } = useDemo();
  const branches = configuredBranches(state.config);
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? t("Supervisor", "سرپرست"),
  };
  const suppliers = [
    ...new Set([
      ...state.ledger
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.supplier),
      ...state.products
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.main_supplier),
    ]),
  ];
  const [supplier, setSupplier] = useListState("payables.supplier", "");
  const [search, setSearch] = useListState("payables.search", "");
  const [overdueOnly, setOverdueOnly] = useListState("payables.overdue", false);
  const [withBalance, setWithBalance] = useListState("payables.balance", false);
  const [mode, setMode] = useListState<"ledger" | "month">(
    "payables.mode",
    "ledger",
  );
  const [month, setMonth] = useListState("payables.month", () =>
    companyDate(state.config).slice(0, 7),
  );
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("50.00");
  const [date, setDate] = useState(() => companyDate(state.config));
  const [cheque, setCheque] = useState("DEMO-1001");
  const [receipt, setReceipt] = useState("");
  const [note, setNote] = useState("");
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [entryType, setEntryType] = useState<
    "opening_balance" | "adjustment" | "credit"
  >("adjustment");
  const [adjustment, setAdjustment] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [message, setMessage] = useState("");
  const [confirmMoney, setConfirmMoney] = useState<"payment" | "entry" | null>(
    null,
  );
  const tableColumns = useTableColumns("payables", [
    {
      key: "supplier",
      label: t("Supplier", "تأمین‌کننده"),
      required: true,
      width: "30%",
    },
    { key: "branch", label: t("Branch", "شعبه"), width: "17%" },
    {
      key: "balance",
      label: t("Balance", "مانده"),
      width: "14%",
      align: "end",
    },
    {
      key: "overdue",
      label: t("Overdue", "سررسید گذشته"),
      width: "14%",
      align: "end",
    },
    { key: "due", label: t("Next due date", "سررسید بعدی"), width: "15%" },
  ]);
  const ledgerColumns = useTableColumns("payables.ledger", [
    { key: "date", label: t("Date", "تاریخ"), width: 124 },
    { key: "branch", label: t("Branch", "شعبه"), width: 132 },
    { key: "type", label: t("Type", "نوع"), width: 156 },
    {
      key: "reference",
      label: t("Reference / note", "مرجع / یادداشت"),
      required: true,
      width: 240,
    },
    { key: "amount", label: t("Amount", "مبلغ"), width: 112, align: "end" },
    {
      key: "cheque",
      label: t("Cheque / payment date", "چک / تاریخ پرداخت"),
      width: 140,
    },
    { key: "allocations", label: t("Allocations", "تخصیص‌ها"), width: 176 },
    {
      key: "actions",
      label: t("Action", "عملیات"),
      width: 148,
      align: "end",
      actions: true,
    },
  ]);
  if (role !== "supervisor")
    return (
      <EmptyState>
        {t(
          "Payables are available to Supervisors only.",
          "پرداختنی‌ها فقط برای سرپرستان در دسترس است.",
        )}
      </EmptyState>
    );
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const endOfMonth = validMonth ? monthEndDate(month) : undefined;
  const overview = supplierBalanceOverview(state, context).filter(
    (item) =>
      item.supplier
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (!overdueOnly || new Decimal(item.overdue).gt(0)) &&
      (!withBalance || !new Decimal(item.balance).eq(0)),
  );
  const selectedVisible = overview.some((item) => item.supplier === supplier);
  const resetEntryForms = () => {
    setPaymentOpen(false);
    setEntryOpen(false);
    setAllocations(null);
    setDisputeId(null);
    setError("");
    setMessage("");
    setErrorKey("");
    setConfirmMoney(null);
  };
  const changeBranch = (value: string, clear = false) => {
    // This explicit filter change keeps the other filters and selected report.
    // A top-bar/session switch still reads its separately scoped preferences.
    for (const [field, retained] of Object.entries({
      "payables.supplier": supplier,
      "payables.search": clear ? "" : search,
      "payables.overdue": clear ? false : overdueOnly,
      "payables.balance": clear ? false : withBalance,
      "payables.mode": mode,
      "payables.month": month,
    }))
      saveNavigationValue(
        navigationKey(
          state.config.company.seed_key,
          user?.username ?? "signed-out",
          value,
          field,
        ),
        retained,
      );
    setBranch(value as Branch);
    resetEntryForms();
  };
  const clearFilters = () => {
    setSearch("");
    setOverdueOnly(false);
    setWithBalance(false);
    changeBranch("all", true);
  };
  const summary = supplierBalanceSummary(
    state,
    context,
    supplier,
    mode === "month" ? endOfMonth : undefined,
  );
  const today =
    mode === "month" && endOfMonth ? endOfMonth : companyDate(state.config);
  const openInvoices = summary.invoices.filter((invoice) =>
    new Decimal(invoice.amount).gt(0),
  );

  const typeLabel = (type: string) =>
    ({
      invoice: t("Invoice", "فاکتور"),
      short_deduction: t("Short deduction", "کسر کسری"),
      refused_deduction: t("Refused deduction", "کسر کالای نپذیرفته"),
      short_restoration: t("Short restoration", "بازگردانی کسری"),
      payment: t("Payment", "پرداخت"),
      credit: t("Credit", "بستانکاری"),
      opening_balance: t("Opening balance", "مانده افتتاحیه"),
      adjustment: t("Adjustment", "تعدیل"),
    })[type] ?? t("Adjustment", "تعدیل");
  const run = (action: (draft: typeof state) => void, feedback: string) => {
    try {
      update(action);
      setError("");
      setErrorKey("");
      setMessage(feedback);
      return true;
    } catch (caught) {
      const key = caught instanceof Error ? caught.message : "";
      const localKey =
        key === "payment_evidence"
          ? !date
            ? "payment_date"
            : "payment_receipt"
          : key === "adjustment_evidence"
            ? !date
              ? "entry_date"
              : !entryReference.trim()
                ? "entry_reference"
                : !entryNote.trim()
                  ? "entry_note"
                  : "amount"
            : key;
      setErrorKey(localKey);
      setError(
        operationError(caught instanceof Error ? caught.message : "", t),
      );
      return false;
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
  const confirmMoneyRecord = () => {
    const payment = confirmMoney === "payment";
    const saved = payment
      ? run(
          (draft) =>
            postPayment(draft, context, {
              supplier,
              amount,
              date,
              cheque,
              receipt,
              note,
              allocations: allocations ?? [],
            }),
          t(
            "Recorded external payment and allocations. No money was transferred.",
            "پرداخت خارج از برنامه و تخصیص‌ها ثبت شد. هیچ پولی منتقل نشد.",
          ),
        )
      : run(
          (draft) =>
            postLedgerAdjustment(draft, context, {
              supplier,
              type: entryType,
              amount: adjustment,
              date,
              reference: entryReference,
              note: entryNote,
            }),
          t(
            "Recorded ledger entry. Previous records were preserved.",
            "ردیف دفتر ثبت شد. سوابق قبلی حفظ شدند.",
          ),
        );
    setConfirmMoney(null);
    if (!saved) return;
    if (payment) {
      setPaymentOpen(false);
      setAllocations(null);
      setReceipt("");
    } else {
      setEntryOpen(false);
      setAdjustment("");
      setEntryReference("");
      setEntryNote("");
    }
  };
  const csv = () => {
    const blob = new Blob([supplierBalanceCsv(summary, supplier)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payables-${branch.replaceAll(" ", "-")}-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title={t("Payables", "پرداختنی‌ها")}
        description={t(
          "Supplier balances and payment records by branch.",
          "مانده تأمین‌کنندگان و سوابق پرداخت هر شعبه.",
        )}
        actions={
          <Button
            disabled={overview.length === 0}
            onClick={() => {
              if (!selectedVisible)
                setSupplier(overview[0]?.supplier ?? suppliers[0] ?? "");
              setPaymentOpen(!paymentOpen);
              setEntryOpen(false);
              setAllocations(null);
            }}
          >
            {t("Record external payment", "ثبت پرداخت خارج از برنامه")}
          </Button>
        }
      />
      <FilterToolbar
        className="payables-filters no-print"
        aria-label={t("Payables filters", "فیلترهای پرداختنی‌ها")}
        search={
          <input
            className="ui-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("Search suppliers", "جستجوی تأمین‌کنندگان")}
            placeholder={t("Search suppliers", "جستجوی تأمین‌کنندگان")}
          />
        }
        count={translateCount(
          "{{count}} supplier",
          "{{count}} suppliers",
          "{{count}} تأمین‌کننده",
          "{{count}} تأمین‌کننده",
          overview.length,
          lang,
        )}
      >
        <Select
          aria-label={t("Payables branch", "شعبه پرداختنی‌ها")}
          value={branch}
          onChange={changeBranch}
          options={[
            { value: "all", label: t("All branches", "همه شعبه‌ها") },
            ...branches.map((value) => ({
              value,
              label: configuredBranchLabel(state.config, value, lang),
            })),
          ]}
        />
        <Checkbox checked={overdueOnly} onChange={setOverdueOnly}>
          {t("Overdue only", "فقط سررسید گذشته")}
        </Checkbox>
        <Checkbox checked={withBalance} onChange={setWithBalance}>
          {t("With balance", "دارای مانده")}
        </Checkbox>
        <Button variant="ghost" onClick={clearFilters}>
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
        {tableColumns.chooser}
      </FilterToolbar>
      <Card
        title={t("Suppliers", "تأمین‌کنندگان")}
        className="payables-overview"
      >
        <DataTable
          className="payables-overview-table"
          columns={tableColumns.columns}
        >
          <thead>
            <tr>
              <th>{t("Supplier", "تأمین‌کننده")}</th>
              <th>{t("Branch", "شعبه")}</th>
              <th className="numeric">{t("Balance", "مانده")}</th>
              <th className="numeric">{t("Overdue", "سررسید گذشته")}</th>
              <th>{t("Next due date", "سررسید بعدی")}</th>
            </tr>
          </thead>
          <tbody>
            {overview.map((item) => (
              <tr key={item.supplier}>
                <td>
                  <a
                    href="#payables"
                    onClick={(event) => {
                      event.preventDefault();
                      setSupplier(item.supplier);
                      setPaymentOpen(false);
                      setEntryOpen(false);
                      setAllocations(null);
                      setDisputeId(null);
                    }}
                  >
                    <LtrText>{item.supplier}</LtrText>
                  </a>
                </td>
                <td className="branch-label">
                  {configuredBranchLabel(state.config, branch, lang)}
                </td>
                <td className="numeric">
                  <Money value={item.balance} />
                  {item.pending_credit !== "0.00" && (
                    <small className="muted payables-pending-note">
                      {t("Pending credit", "اعتبار در انتظار")}:{" "}
                      <Money value={item.pending_credit} />
                    </small>
                  )}
                </td>
                <td className="numeric">
                  <Money value={item.overdue} />
                </td>
                <td>
                  <DateText value={item.next_due_date} />
                </td>
              </tr>
            ))}
            {overview.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState>
                    {t(
                      "No suppliers match these filters. Clear filters to see all suppliers.",
                      "هیچ تأمین‌کننده‌ای با این فیلترها مطابقت ندارد. برای نمایش همه، فیلترها را پاک کنید.",
                    )}
                  </EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </Card>
      {supplier && selectedVisible && (
        <>
          <Card className="payables-toolbar no-print form-card">
            <div className="form-grid">
              <Field label={t("Supplier", "تأمین‌کننده")}>
                <Select
                  value={supplier}
                  onChange={(value) => {
                    setSupplier(value);
                    resetEntryForms();
                  }}
                  options={overview.map((item) => ({
                    value: item.supplier,
                    label: item.supplier,
                  }))}
                />
              </Field>
              {mode === "month" && (
                <Field label={t("Month (YYYY-MM)", "ماه (YYYY-MM)")}>
                  <input
                    type="text"
                    dir="ltr"
                    className="ui-input ui-number"
                    value={month}
                    placeholder="YYYY-MM"
                    pattern="[0-9]{4}-(0[1-9]|1[0-2])"
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </Field>
              )}
            </div>
            <Tabs
              value={mode}
              aria-label={t("View", "نمایش")}
              onChange={(value) => setMode(value as typeof mode)}
              options={[
                { value: "ledger", label: t("Current ledger", "دفتر جاری") },
                {
                  value: "month",
                  label: t("Month-end summary", "خلاصه پایان ماه"),
                },
              ]}
            />
            <div className="actions">
              <Button
                variant="secondary"
                disabled={mode === "month" && !validMonth}
                onClick={() => window.print()}
              >
                {t("Print summary", "چاپ خلاصه")}
              </Button>
              <Button
                variant="secondary"
                disabled={mode === "month" && !validMonth}
                onClick={csv}
              >
                {t("Export CSV", "خروجی CSV")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEntryOpen(!entryOpen);
                  setPaymentOpen(false);
                }}
              >
                {t(
                  "Record opening balance, credit, or adjustment",
                  "ثبت مانده افتتاحیه، بستانکاری یا تعدیل",
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSupplier("");
                  setPaymentOpen(false);
                  setEntryOpen(false);
                  setDisputeId(null);
                }}
              >
                {t("View all suppliers", "مشاهده همه تأمین‌کنندگان")}
              </Button>
            </div>
          </Card>
          {message && (
            <div className="banner approved" role="status">
              {message}
            </div>
          )}
          {error &&
            ![
              "amount",
              "credit_sign",
              "opening_exists",
              "payment_evidence",
              "payment_date",
              "payment_receipt",
              "duplicate_document",
              "adjustment_evidence",
              "entry_date",
              "entry_reference",
              "entry_note",
              "reason",
            ].includes(errorKey) && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
          {summary.pending_returns.length > 0 && (
            <Card
              title={t("Pending credit", "اعتبار در انتظار")}
              className="pending-return-credits"
            >
              <p className="muted">
                {t("Confirmed balance", "مانده تأییدشده")}:{" "}
                <Money value={summary.confirmed_balance} /> ·{" "}
                {t("Pending credit", "اعتبار در انتظار")}:{" "}
                <Money value={summary.pending_credit} /> · {t("Owed", "بدهی")}:{" "}
                <Money value={summary.balance} />
              </p>
              <DataTable
                columns={[
                  { width: "40%" },
                  { width: "35%" },
                  { width: "25%", align: "end" },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Return", "مرجوعی")}</th>
                    <th>{t("Return memo", "یادداشت مرجوعی")}</th>
                    <th>{t("Pending credit", "اعتبار در انتظار")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.pending_returns.map((claim) => (
                    <tr key={claim.memo_id}>
                      <td>
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={`#return?id=${encodeURIComponent(claim.return_id)}`}
                          >
                            {t("View return", "نمایش مرجوعی")}
                          </a>
                        </Button>
                      </td>
                      <td>
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={`#return?id=${encodeURIComponent(claim.return_id)}&memo=${encodeURIComponent(claim.reference)}`}
                          >
                            <LtrText>{claim.reference}</LtrText>
                          </a>
                        </Button>
                      </td>
                      <td>
                        <Money value={claim.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>
          )}
          {paymentOpen && (
            <Card
              title={t("Record external payment", "ثبت پرداخت خارج از برنامه")}
              className="form-card"
            >
              <p className="muted">
                {t(
                  "Enter a payment already made outside this app. Partial payments are allowed; overpayment stays unapplied.",
                  "یک پرداخت انجام‌شده خارج از برنامه وارد کنید. پرداخت جزئی مجاز است؛ اضافه‌پرداخت تخصیص‌نیافته می‌ماند.",
                )}
              </p>
              <div className="form-grid">
                <Field
                  label={t("Payment amount", "مبلغ پرداخت")}
                  error={fieldError("amount")}
                >
                  <NumberField
                    value={amount}
                    onChange={(value) => {
                      setAmount(value);
                      setAllocations(null);
                      clearFieldError("amount", "allocation");
                    }}
                  />
                </Field>
                <Field
                  label={t("Payment date", "تاریخ پرداخت")}
                  error={fieldError("payment_date")}
                >
                  <DateField
                    value={date}
                    onChange={(value) => {
                      setDate(value);
                      clearFieldError("payment_date");
                    }}
                  />
                </Field>
                <Field
                  label={t("Cheque number (optional)", "شماره چک (اختیاری)")}
                >
                  <input
                    value={cheque}
                    onChange={(event) => setCheque(event.target.value)}
                  />
                </Field>
                <Field
                  label={t("Payment receipt reference", "مرجع رسید پرداخت")}
                  error={fieldError("payment_receipt", "duplicate_document")}
                >
                  <input
                    value={receipt}
                    onChange={(event) => {
                      setReceipt(event.target.value);
                      clearFieldError("payment_receipt", "duplicate_document");
                    }}
                    placeholder="DEMO-PAYMENT-001"
                  />
                </Field>
                <Field label={t("Note (optional)", "یادداشت (اختیاری)")}>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </div>
              <Button
                variant="secondary"
                disabled={branch === "all"}
                onClick={() => {
                  try {
                    setAllocations(
                      suggestAllocations(state, context, supplier, amount),
                    );
                    setError("");
                  } catch (caught) {
                    setErrorKey(caught instanceof Error ? caught.message : "");
                    setError(
                      operationError(
                        caught instanceof Error ? caught.message : "",
                        t,
                      ),
                    );
                  }
                }}
              >
                {t(
                  "Preview oldest-due allocations",
                  "پیش‌نمایش تخصیص به قدیمی‌ترین سررسید",
                )}
              </Button>
              {allocations !== null && (
                <section className="form-section">
                  <h3>
                    {t(
                      "Review and edit allocations",
                      "بررسی و ویرایش تخصیص‌ها",
                    )}
                  </h3>
                  {supplierBalanceSummary(state, context, supplier)
                    .invoices.filter((invoice) =>
                      new Decimal(invoice.amount).gt(0),
                    )
                    .map((invoice) => (
                      <Field
                        key={invoice.invoice_id}
                        error={fieldError("allocation")}
                        label={`⁦${invoice.reference}⁩ · ${t("Outstanding", "مانده")}: ⁦${formatMoney(invoice.amount)}⁩`}
                      >
                        <NumberField
                          value={
                            allocations.find(
                              (item) => item.invoice_id === invoice.invoice_id,
                            )?.amount ?? "0.00"
                          }
                          onChange={(value) => {
                            clearFieldError("allocation");
                            setAllocations((current) => [
                              ...(current ?? []).filter(
                                (item) =>
                                  item.invoice_id !== invoice.invoice_id,
                              ),
                              {
                                invoice_id: invoice.invoice_id,
                                amount: value,
                              },
                            ]);
                          }}
                        />
                      </Field>
                    ))}
                  {openInvoices.length === 0 && (
                    <p>
                      {t(
                        "No open invoice. The full amount will remain unapplied supplier credit.",
                        "فاکتور بازی وجود ندارد. کل مبلغ به‌صورت بستانکاری تخصیص‌نیافته می‌ماند.",
                      )}
                    </p>
                  )}
                  <Button
                    disabled={branch === "all"}
                    onClick={() => setConfirmMoney("payment")}
                  >
                    {t("Confirm and record payment", "تأیید و ثبت پرداخت")}
                  </Button>
                </section>
              )}
            </Card>
          )}
          {entryOpen && (
            <Card
              title={t("Record ledger entry", "ثبت ردیف دفتر")}
              className="form-card"
            >
              <div className="form-grid">
                <Field
                  label={t("Entry type", "نوع ردیف")}
                  error={fieldError("opening_exists")}
                >
                  <Select
                    value={entryType}
                    onChange={(value) => {
                      setEntryType(value as typeof entryType);
                      clearFieldError("opening_exists", "credit_sign");
                    }}
                    options={[
                      {
                        value: "opening_balance",
                        label: t("Opening balance", "مانده افتتاحیه"),
                      },
                      {
                        value: "adjustment",
                        label: t("Manual adjustment", "تعدیل دستی"),
                      },
                      {
                        value: "credit",
                        label: t(
                          "Supplier credit (unallocated)",
                          "بستانکاری تأمین‌کننده (تخصیص‌نیافته)",
                        ),
                      },
                    ]}
                  />
                </Field>
                <Field
                  label={t(
                    "Signed amount (credits are negative)",
                    "مبلغ علامت‌دار (بستانکاری منفی است)",
                  )}
                  error={fieldError("amount", "credit_sign")}
                >
                  <NumberField
                    value={adjustment}
                    onChange={(value) => {
                      setAdjustment(value);
                      clearFieldError("amount", "credit_sign");
                    }}
                  />
                </Field>
                <Field
                  label={t("Date", "تاریخ")}
                  error={fieldError("entry_date")}
                >
                  <DateField
                    value={date}
                    onChange={(value) => {
                      setDate(value);
                      clearFieldError("entry_date");
                    }}
                  />
                </Field>
                <Field
                  label={t("Evidence reference", "مرجع مدرک")}
                  error={fieldError("entry_reference", "duplicate_document")}
                >
                  <input
                    value={entryReference}
                    onChange={(event) => {
                      setEntryReference(event.target.value);
                      clearFieldError("entry_reference", "duplicate_document");
                    }}
                  />
                </Field>
                <Field
                  error={fieldError("entry_note")}
                  label={t(
                    "Reason / dispute note (required)",
                    "دلیل / یادداشت اختلاف (ضروری)",
                  )}
                >
                  <textarea
                    value={entryNote}
                    onChange={(event) => {
                      setEntryNote(event.target.value);
                      clearFieldError("entry_note");
                    }}
                  />
                </Field>
              </div>
              <Button
                disabled={branch === "all"}
                onClick={() => setConfirmMoney("entry")}
              >
                {t("Record ledger entry", "ثبت ردیف دفتر")}
              </Button>
            </Card>
          )}
          {disputeId && (
            <Card
              title={t("Record supplier dispute", "ثبت اختلاف تأمین‌کننده")}
              className="form-card"
            >
              <Field
                label={t("Dispute note (required)", "یادداشت اختلاف (ضروری)")}
                error={fieldError("reason")}
              >
                <textarea
                  value={disputeNote}
                  onChange={(event) => {
                    setDisputeNote(event.target.value);
                    clearFieldError("reason");
                  }}
                />
              </Field>
              <div className="actions">
                <Button
                  disabled={branch === "all"}
                  onClick={() => {
                    if (
                      run(
                        (draft) =>
                          markLedgerDispute(
                            draft,
                            context,
                            disputeId,
                            disputeNote,
                          ),
                        t(
                          "Recorded supplier dispute. Financial amounts are unchanged.",
                          "اختلاف تأمین‌کننده ثبت شد. مبالغ مالی تغییر نکردند.",
                        ),
                      )
                    ) {
                      setDisputeId(null);
                      setDisputeNote("");
                    }
                  }}
                >
                  {t("Record dispute", "ثبت اختلاف")}
                </Button>
                <Button variant="secondary" onClick={() => setDisputeId(null)}>
                  {t("Close", "بستن")}
                </Button>
              </div>
            </Card>
          )}
          {branch === "all" && (
            <div className="banner info">
              {t(
                "Choose one branch before recording a payment, credit, or adjustment.",
                "پیش از ثبت پرداخت، بستانکاری یا تعدیل یک شعبه انتخاب کنید.",
              )}
            </div>
          )}
          <section
            className="payables-report"
            aria-label={t(
              "Supplier financial report",
              "گزارش مالی تأمین‌کننده",
            )}
          >
            <header className="payables-report-heading">
              <h2>
                <LtrText>{supplier}</LtrText>
              </h2>
              <p>
                <span className="branch-label">
                  {configuredBranchLabel(state.config, branch, lang)}
                </span>{" "}
                · <LtrText>{state.config.company.currency}</LtrText> ·{" "}
                {t("As of", "تا تاریخ")}{" "}
                <DateText
                  value={
                    mode === "month" ? endOfMonth : companyDate(state.config)
                  }
                />
              </p>
            </header>
            <div className="payables-summary-grid">
              <SummaryTile
                label={t("Supplier balance", "مانده تأمین‌کننده")}
                value={<Money value={summary.balance} />}
              />
              <SummaryTile
                label={translateCount(
                  "Open invoice",
                  "Open invoices",
                  "فاکتور باز",
                  "فاکتورهای باز",
                  openInvoices.length,
                  lang,
                )}
                value={<LtrText>{openInvoices.length}</LtrText>}
                tone="sky"
              />
              <SummaryTile
                label={t("Overdue", "سررسید گذشته")}
                value={<Money value={summary.overdue} />}
              />
              <SummaryTile
                label={t("Unapplied supplier credit", "بستانکاری تخصیص‌نیافته")}
                value={<Money value={summary.unapplied_credit} />}
                tone="sky"
              />
            </div>
            {!new Decimal(summary.snapshot_balance).eq(0) && (
              <p className="muted payables-snapshot">
                {t("Balance", "مانده")}:{" "}
                <Money value={summary.snapshot_balance} />
                {summary.snapshot_date && (
                  <>
                    {" "}
                    · <DateText value={summary.snapshot_date} />
                  </>
                )}
              </p>
            )}
            {summary.rows.length === 0 ? (
              <EmptyState>
                {t(
                  "No ledger entries yet. Post an invoice in Invoices to show the invoice and its short deduction here.",
                  "هنوز ردیفی در دفتر وجود ندارد. یک فاکتور را در فاکتورها ثبت کنید تا فاکتور و کسر کسری آن اینجا نمایش داده شوند.",
                )}
              </EmptyState>
            ) : (
              <Card
                title={
                  mode === "month"
                    ? t("Month-end ledger summary", "خلاصه دفتر پایان ماه")
                    : t("Supplier ledger", "دفتر تأمین‌کننده")
                }
              >
                <div className="table-column-actions">
                  {ledgerColumns.chooser}
                </div>
                <DataTable
                  className="payables-ledger-table"
                  columns={ledgerColumns.columns}
                >
                  <thead>
                    <tr>
                      <th>{t("Date", "تاریخ")}</th>
                      <th>{t("Branch", "شعبه")}</th>
                      <th>{t("Type", "نوع")}</th>
                      <th>{t("Reference / note", "مرجع / یادداشت")}</th>
                      <th className="numeric">{t("Amount", "مبلغ")}</th>
                      <th>{t("Cheque / payment date", "چک / تاریخ پرداخت")}</th>
                      <th>{t("Allocations", "تخصیص‌ها")}</th>
                      <th className="no-print">{t("Action", "عملیات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <DateText value={row.date} />
                        </td>
                        <td className="branch-label">
                          {configuredBranchLabel(
                            state.config,
                            row.branch,
                            lang,
                          )}
                        </td>
                        <td>
                          <Badge
                            tone={
                              row.type === "payment" || row.type === "credit"
                                ? "approved"
                                : row.type === "short_deduction" ||
                                    row.type === "refused_deduction"
                                  ? "danger"
                                  : "info"
                            }
                          >
                            {typeLabel(row.type)}
                          </Badge>
                        </td>
                        <td>
                          <LtrText>{row.reference}</LtrText>
                          {row.note && <div className="muted">{row.note}</div>}
                          {row.dispute_note && (
                            <p className="muted">{row.dispute_note}</p>
                          )}
                          {row.disputed && (
                            <Badge tone="danger">
                              {t("Disputed", "مورد اختلاف")}
                            </Badge>
                          )}
                        </td>
                        <td className="numeric">
                          <Money value={row.amount} />
                        </td>
                        <td>
                          <LtrText>{row.cheque_number || "—"}</LtrText>
                          {row.payment_date && (
                            <div>
                              <DateText value={row.payment_date} />
                            </div>
                          )}
                        </td>
                        <td>
                          {(row.allocations ?? []).map((allocation) => (
                            <div key={allocation.invoice_id}>
                              <LtrText>
                                {summary.invoices.find(
                                  (invoice) =>
                                    invoice.invoice_id ===
                                    allocation.invoice_id,
                                )?.reference ?? t("Invoice", "فاکتور")}
                              </LtrText>{" "}
                              · <Money value={allocation.amount} />
                            </div>
                          ))}
                        </td>
                        <td className="no-print">
                          <Button
                            variant="secondary"
                            disabled={branch === "all"}
                            onClick={() => {
                              setDisputeId(row.id);
                              setDisputeNote("");
                            }}
                          >
                            {t("Record dispute", "ثبت اختلاف")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </Card>
            )}
            {summary.invoices.length > 0 && (
              <Card title={t("Invoice outstanding amounts", "مانده فاکتورها")}>
                <DataTable
                  columns={[
                    { width: "30%" },
                    { width: "18%" },
                    { width: 144 },
                    { width: 144, align: "end" },
                    { width: "20%" },
                  ]}
                >
                  <thead>
                    <tr>
                      <th>{t("Invoice", "فاکتور")}</th>
                      <th>{t("Branch", "شعبه")}</th>
                      <th>{t("Due date", "تاریخ سررسید")}</th>
                      <th className="numeric">{t("Outstanding", "مانده")}</th>
                      <th>{t("Status", "وضعیت")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.invoices.map((invoice) => (
                      <tr key={invoice.invoice_id}>
                        <td>
                          <LtrText>{invoice.reference}</LtrText>
                        </td>
                        <td className="branch-label">
                          {configuredBranchLabel(
                            state.config,
                            invoice.branch,
                            lang,
                          )}
                        </td>
                        <td>
                          <DateText value={invoice.due_date} />
                        </td>
                        <td className="numeric">
                          <Money value={invoice.amount} />
                        </td>
                        <td>
                          <Badge
                            tone={
                              new Decimal(invoice.amount).lte(0)
                                ? "approved"
                                : invoice.due_date && invoice.due_date < today
                                  ? "danger"
                                  : "pending"
                            }
                          >
                            {new Decimal(invoice.amount).lte(0)
                              ? t("Resolved", "حل‌شده")
                              : invoice.due_date && invoice.due_date < today
                                ? t("Overdue", "سررسید گذشته")
                                : t("Open", "باز")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                <p className="muted">
                  {t(
                    "Unallocated opening balances and adjustments",
                    "مانده افتتاحیه و تعدیل‌های تخصیص‌نیافته",
                  )}
                  : <Money value={summary.unallocated_debits} />
                </p>
              </Card>
            )}
          </section>
        </>
      )}
      <ConfirmDialog
        open={confirmMoney !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmMoney(null);
        }}
        title={
          confirmMoney === "payment"
            ? t("Record external payment", "ثبت پرداخت خارج از برنامه")
            : t("Record ledger entry", "ثبت ردیف دفتر")
        }
        description=""
        confirmLabel={
          confirmMoney === "payment"
            ? t("Confirm and record payment", "تأیید و ثبت پرداخت")
            : t("Record ledger entry", "ثبت ردیف دفتر")
        }
        onConfirm={confirmMoneyRecord}
      >
        <dl className="money-confirmation-summary">
          <div>
            <dt>{t("Supplier", "تأمین‌کننده")}</dt>
            <dd>
              <LtrText>{supplier}</LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Branch", "شعبه")}</dt>
            <dd>{configuredBranchLabel(state.config, branch, lang)}</dd>
          </div>
          <div>
            <dt>{t("Amount", "مبلغ")}</dt>
            <dd>
              {/^[+-]?\d+(\.\d{1,2})?$/.test(
                confirmMoney === "payment" ? amount : adjustment,
              ) ? (
                <Money
                  value={confirmMoney === "payment" ? amount : adjustment}
                />
              ) : (
                <LtrText>
                  {(confirmMoney === "payment" ? amount : adjustment) || "—"}
                </LtrText>
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Date", "تاریخ")}</dt>
            <dd>
              <DateText value={date} />
            </dd>
          </div>
          <div>
            <dt>
              {confirmMoney === "payment"
                ? t("Payment receipt reference", "مرجع رسید پرداخت")
                : t("Evidence reference", "مرجع مدرک")}
            </dt>
            <dd>
              <LtrText>
                {(confirmMoney === "payment" ? receipt : entryReference) || "—"}
              </LtrText>
            </dd>
          </div>
        </dl>
      </ConfirmDialog>
    </>
  );
}
export default Payables;
