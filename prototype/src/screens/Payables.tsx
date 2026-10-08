import { useState } from "react";
import Decimal from "decimal.js";
import { branches, useDemo } from "../store";
import { companyDate } from "../invoice";
import {
  branchLabel,
  DateText,
  formatMoney,
  LtrText,
  Money,
} from "../presentation";
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
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? "Demo user",
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
  const [supplier, setSupplier] = useState("");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [withBalance, setWithBalance] = useState(false);
  const [mode, setMode] = useState<"ledger" | "month">("ledger");
  const [month, setMonth] = useState(() =>
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
  const [message, setMessage] = useState("");
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
  };
  const changeBranch = (value: string) => {
    setBranch(value as Branch);
    resetEntryForms();
  };
  const clearFilters = () => {
    setSearch("");
    setOverdueOnly(false);
    setWithBalance(false);
    changeBranch("all");
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
      setMessage(feedback);
      return true;
    } catch (caught) {
      setError(
        operationError(caught instanceof Error ? caught.message : "", t),
      );
      return false;
    }
  };
  const csv = () => {
    const blob = new Blob([supplierBalanceCsv(summary, supplier)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `demo-payables-${branch.replaceAll(" ", "-")}-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title={t("Payables", "پرداختنی‌ها")}
        description={t(
          "Fictional branch supplier balances for manual bookkeeping. Nothing is paid through this demo.",
          "مانده ساختگی تأمین‌کنندگان شعبه برای حسابداری دستی. هیچ پرداختی از طریق این نمایش انجام نمی‌شود.",
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
        count={t(
          `${overview.length} ${overview.length === 1 ? "supplier" : "suppliers"}`,
          `${overview.length} تأمین‌کننده`,
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
              label: branchLabel(value, lang),
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
      </FilterToolbar>
      <Card
        title={t("Suppliers", "تأمین‌کنندگان")}
        className="payables-overview"
      >
        <DataTable
          columns={[
            { width: "32%" },
            { width: "16%" },
            { width: "14%", align: "end" },
            { width: "14%", align: "end" },
            { width: 156 },
            { width: 96, actions: true },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Supplier", "تأمین‌کننده")}</th>
              <th>{t("Branch", "شعبه")}</th>
              <th className="numeric">{t("Balance", "مانده")}</th>
              <th className="numeric">{t("Overdue", "سررسید گذشته")}</th>
              <th>{t("Next due date", "سررسید بعدی")}</th>
              <th>{t("Action", "عملیات")}</th>
            </tr>
          </thead>
          <tbody>
            {overview.map((item) => (
              <tr key={item.supplier}>
                <td>
                  <LtrText>{item.supplier}</LtrText>
                </td>
                <td>{branchLabel(branch, lang)}</td>
                <td className="numeric">
                  <Money value={item.balance} />
                </td>
                <td className="numeric">
                  <Money value={item.overdue} />
                </td>
                <td>
                  <DateText value={item.next_due_date} />
                </td>
                <td>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSupplier(item.supplier);
                      setPaymentOpen(false);
                      setEntryOpen(false);
                      setAllocations(null);
                      setDisputeId(null);
                    }}
                  >
                    {t("View", "مشاهده")}
                  </Button>
                </td>
              </tr>
            ))}
            {overview.length === 0 && (
              <tr>
                <td colSpan={6}>
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
                    setAllocations(null);
                    setDisputeId(null);
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
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {paymentOpen && (
            <Card
              title={t("Record external payment", "ثبت پرداخت خارج از برنامه")}
              className="form-card"
            >
              <p className="muted">
                {t(
                  "Enter a fictional payment already made outside this app. Partial payments are allowed; overpayment stays unapplied.",
                  "یک پرداخت ساختگی انجام‌شده خارج از برنامه وارد کنید. پرداخت جزئی مجاز است؛ اضافه‌پرداخت تخصیص‌نیافته می‌ماند.",
                )}
              </p>
              <div className="form-grid">
                <Field label={t("Payment amount", "مبلغ پرداخت")}>
                  <NumberField
                    value={amount}
                    onChange={(value) => {
                      setAmount(value);
                      setAllocations(null);
                    }}
                  />
                </Field>
                <Field label={t("Payment date", "تاریخ پرداخت")}>
                  <DateField value={date} onChange={setDate} />
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
                  label={t(
                    "Fictional payment receipt reference",
                    "مرجع ساختگی رسید پرداخت",
                  )}
                >
                  <input
                    value={receipt}
                    onChange={(event) => setReceipt(event.target.value)}
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
                        label={`⁦${invoice.reference}⁩ · ${t("Outstanding", "مانده")}: ⁦${formatMoney(invoice.amount)}⁩`}
                      >
                        <NumberField
                          value={
                            allocations.find(
                              (item) => item.invoice_id === invoice.invoice_id,
                            )?.amount ?? "0.00"
                          }
                          onChange={(value) =>
                            setAllocations((current) => [
                              ...(current ?? []).filter(
                                (item) =>
                                  item.invoice_id !== invoice.invoice_id,
                              ),
                              {
                                invoice_id: invoice.invoice_id,
                                amount: value,
                              },
                            ])
                          }
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
                    onClick={() => {
                      if (
                        run(
                          (draft) =>
                            postPayment(draft, context, {
                              supplier,
                              amount,
                              date,
                              cheque,
                              receipt,
                              note,
                              allocations,
                            }),
                          t(
                            "Recorded external payment and allocations. No money was transferred.",
                            "پرداخت خارج از برنامه و تخصیص‌ها ثبت شد. هیچ پولی منتقل نشد.",
                          ),
                        )
                      ) {
                        setPaymentOpen(false);
                        setAllocations(null);
                        setReceipt("");
                      }
                    }}
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
                <Field label={t("Entry type", "نوع ردیف")}>
                  <Select
                    value={entryType}
                    onChange={(value) =>
                      setEntryType(value as typeof entryType)
                    }
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
                >
                  <NumberField value={adjustment} onChange={setAdjustment} />
                </Field>
                <Field label={t("Date", "تاریخ")}>
                  <DateField value={date} onChange={setDate} />
                </Field>
                <Field
                  label={t("Fictional evidence reference", "مرجع ساختگی مدرک")}
                >
                  <input
                    value={entryReference}
                    onChange={(event) => setEntryReference(event.target.value)}
                  />
                </Field>
                <Field
                  label={t(
                    "Reason / dispute note (required)",
                    "دلیل / یادداشت اختلاف (ضروری)",
                  )}
                >
                  <textarea
                    value={entryNote}
                    onChange={(event) => setEntryNote(event.target.value)}
                  />
                </Field>
              </div>
              <Button
                disabled={branch === "all"}
                onClick={() => {
                  if (
                    run(
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
                    )
                  ) {
                    setEntryOpen(false);
                    setAdjustment("");
                    setEntryReference("");
                    setEntryNote("");
                  }
                }}
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
              >
                <textarea
                  value={disputeNote}
                  onChange={(event) => setDisputeNote(event.target.value)}
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
                {branchLabel(branch, lang)} ·{" "}
                <LtrText>{state.config.company.currency}</LtrText> ·{" "}
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
                label={t("Open invoices", "فاکتورهای باز")}
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
                {t("Demo balance", "مانده نمایشی")}:{" "}
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
                  "No ledger entries yet. Post the demo invoice in Invoices to show the invoice and its short deduction here.",
                  "هنوز ردیفی در دفتر وجود ندارد. فاکتور نمونه را در فاکتورها ثبت کنید تا فاکتور و کسر کسری آن اینجا نمایش داده شوند.",
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
                <DataTable
                  columns={[
                    { width: 132 },
                    { width: 112 },
                    { width: 144 },
                    { width: "28%" },
                    { width: 116, align: "end" },
                    { width: 152 },
                    { width: 168 },
                    { width: 152, actions: true },
                  ]}
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
                        <td>{branchLabel(row.branch, lang)}</td>
                        <td>
                          <Badge
                            tone={
                              row.type === "payment" || row.type === "credit"
                                ? "approved"
                                : row.type === "short_deduction"
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
                            variant="ghost"
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
                        <td>{branchLabel(invoice.branch, lang)}</td>
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
    </>
  );
}
export default Payables;
