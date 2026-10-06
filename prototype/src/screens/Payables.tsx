import { useState } from "react";
import Decimal from "decimal.js";
import { demoUsers, useDemo } from "../store";
import { companyDate } from "../invoice";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
} from "../ui";
import {
  ledgerCsv,
  ledgerSummary,
  markLedgerDispute,
  monthEndDate,
  operationError,
  postLedgerAdjustment,
  postPayment,
  suggestAllocations,
  type Allocation,
  type OperationsContext,
} from "../operations";

export function Payables() {
  const { state, update, role, branch, t, money } = useDemo();
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: demoUsers.find((user) => user.role === role)?.name ?? "Demo user",
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
  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
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
  const endOfMonth = month ? monthEndDate(month) : undefined;
  const summary = ledgerSummary(
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
  const overdue = openInvoices.filter(
    (invoice) => invoice.due_date && invoice.due_date < today,
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
    const blob = new Blob([ledgerCsv(summary, supplier)], {
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
            onClick={() => {
              setPaymentOpen(!paymentOpen);
              setEntryOpen(false);
              setAllocations(null);
            }}
          >
            {t("Record external payment", "ثبت پرداخت خارج از برنامه")}
          </Button>
        }
      />
      <Card>
        <div className="form-grid">
          <Field label={t("Supplier", "تأمین‌کننده")}>
            <select
              value={supplier}
              onChange={(event) => {
                setSupplier(event.target.value);
                setAllocations(null);
              }}
            >
              {suppliers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("View", "نمایش")}>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="ledger">{t("Current ledger", "دفتر جاری")}</option>
              <option value="month">
                {t("Month-end summary", "خلاصه پایان ماه")}
              </option>
            </select>
          </Field>
          {mode === "month" && (
            <Field label={t("Month", "ماه")}>
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  if (event.target.value) setMonth(event.target.value);
                }}
              />
            </Field>
          )}
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={() => window.print()}>
            {t("Print summary", "چاپ خلاصه")}
          </Button>
          <Button variant="secondary" onClick={csv}>
            {t("Export CSV", "خروجی CSV")}
          </Button>
          <Button
            variant="ghost"
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
        <Card title={t("Record external payment", "ثبت پرداخت خارج از برنامه")}>
          <p className="muted">
            {t(
              "Enter a fictional payment already made outside this app. Partial payments are allowed; overpayment stays unapplied.",
              "یک پرداخت ساختگی انجام‌شده خارج از برنامه وارد کنید. پرداخت جزئی مجاز است؛ اضافه‌پرداخت تخصیص‌نیافته می‌ماند.",
            )}
          </p>
          <div className="form-grid">
            <Field label={t("Payment amount", "مبلغ پرداخت")}>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAllocations(null);
                }}
              />
            </Field>
            <Field label={t("Payment date", "تاریخ پرداخت")}>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label={t("Cheque number (optional)", "شماره چک (اختیاری)")}>
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
                {t("Review and edit allocations", "بررسی و ویرایش تخصیص‌ها")}
              </h3>
              {ledgerSummary(state, context, supplier)
                .invoices.filter((invoice) => new Decimal(invoice.amount).gt(0))
                .map((invoice) => (
                  <Field
                    key={invoice.invoice_id}
                    label={`${invoice.reference} · ${t("Outstanding", "مانده")}: ${money(invoice.amount)}`}
                  >
                    <input
                      inputMode="decimal"
                      value={
                        allocations.find(
                          (item) => item.invoice_id === invoice.invoice_id,
                        )?.amount ?? "0.00"
                      }
                      onChange={(event) =>
                        setAllocations((current) => [
                          ...(current ?? []).filter(
                            (item) => item.invoice_id !== invoice.invoice_id,
                          ),
                          {
                            invoice_id: invoice.invoice_id,
                            amount: event.target.value,
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
        <Card title={t("Record ledger entry", "ثبت ردیف دفتر")}>
          <div className="form-grid">
            <Field label={t("Entry type", "نوع ردیف")}>
              <select
                value={entryType}
                onChange={(event) =>
                  setEntryType(event.target.value as typeof entryType)
                }
              >
                <option value="opening_balance">
                  {t("Opening balance", "مانده افتتاحیه")}
                </option>
                <option value="adjustment">
                  {t("Manual adjustment", "تعدیل دستی")}
                </option>
                <option value="credit">
                  {t(
                    "Supplier credit (unallocated)",
                    "بستانکاری تأمین‌کننده (تخصیص‌نیافته)",
                  )}
                </option>
              </select>
            </Field>
            <Field
              label={t(
                "Signed amount (credits are negative)",
                "مبلغ علامت‌دار (بستانکاری منفی است)",
              )}
            >
              <input
                inputMode="decimal"
                value={adjustment}
                onChange={(event) => setAdjustment(event.target.value)}
              />
            </Field>
            <Field label={t("Date", "تاریخ")}>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
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
        <Card title={t("Record supplier dispute", "ثبت اختلاف تأمین‌کننده")}>
          <Field label={t("Dispute note (required)", "یادداشت اختلاف (ضروری)")}>
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
                      markLedgerDispute(draft, context, disputeId, disputeNote),
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
        aria-label={t("Supplier financial report", "گزارش مالی تأمین‌کننده")}
      >
        <header className="payables-report-heading">
          <h2>{supplier}</h2>
          <p>
            {branch} · {state.config.company.currency} ·{" "}
            {t("As of", "تا تاریخ")}{" "}
            <span dir="ltr">
              {mode === "month" ? endOfMonth : companyDate(state.config)}
            </span>
          </p>
        </header>
        <div className="stats-grid">
          <Card title={t("Supplier balance", "مانده تأمین‌کننده")}>
            <strong className="stat-number" dir="ltr">
              {money(summary.balance)}
            </strong>
            <p className="muted">
              {branch} · {state.config.company.currency}
            </p>
          </Card>
          <Card title={t("Open invoices", "فاکتورهای باز")}>
            <strong className="stat-number" dir="ltr">
              {openInvoices.length}
            </strong>
          </Card>
          <Card title={t("Overdue invoices", "فاکتورهای سررسید گذشته")}>
            <strong className="stat-number" dir="ltr">
              {overdue.length}
            </strong>
          </Card>
          <Card
            title={t("Unapplied supplier credit", "بستانکاری تخصیص‌نیافته")}
          >
            <strong className="stat-number" dir="ltr">
              {money(summary.unapplied_credit)}
            </strong>
            <p className="muted">
              {t(
                "Preserved for future allocation.",
                "برای تخصیص آینده حفظ شده است.",
              )}
            </p>
          </Card>
        </div>
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
                : t("Preserved supplier ledger", "دفتر تأمین‌کننده حفظ‌شده")
            }
          >
            <DataTable>
              <thead>
                <tr>
                  <th>{t("Date", "تاریخ")}</th>
                  <th>{t("Branch", "شعبه")}</th>
                  <th>{t("Type", "نوع")}</th>
                  <th>{t("Reference / note", "مرجع / یادداشت")}</th>
                  <th>{t("Amount", "مبلغ")}</th>
                  <th>{t("Cheque / payment date", "چک / تاریخ پرداخت")}</th>
                  <th>{t("Allocations", "تخصیص‌ها")}</th>
                  <th className="no-print">{t("Action", "عملیات")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.id}>
                    <td dir="ltr">{row.date}</td>
                    <td>{row.branch}</td>
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
                      <span dir="ltr">{row.reference}</span>
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
                    <td dir="ltr" className="price">
                      {money(row.amount)}
                    </td>
                    <td dir="ltr">
                      {row.cheque_number || "—"}
                      {row.payment_date && <div>{row.payment_date}</div>}
                    </td>
                    <td>
                      {(row.allocations ?? []).map((allocation) => (
                        <div key={allocation.invoice_id}>
                          <span dir="ltr">
                            {summary.invoices.find(
                              (invoice) =>
                                invoice.invoice_id === allocation.invoice_id,
                            )?.reference ?? allocation.invoice_id}{" "}
                            · {money(allocation.amount)}
                          </span>
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
            <DataTable>
              <thead>
                <tr>
                  <th>{t("Invoice", "فاکتور")}</th>
                  <th>{t("Branch", "شعبه")}</th>
                  <th>{t("Due date", "تاریخ سررسید")}</th>
                  <th>{t("Outstanding", "مانده")}</th>
                  <th>{t("Status", "وضعیت")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.invoices.map((invoice) => (
                  <tr key={invoice.invoice_id}>
                    <td>{invoice.reference}</td>
                    <td>{invoice.branch}</td>
                    <td dir="ltr">{invoice.due_date ?? "—"}</td>
                    <td dir="ltr">{money(invoice.amount)}</td>
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
              : <span dir="ltr">{money(summary.unallocated_debits)}</span>
            </p>
          </Card>
        )}
        <p className="muted">
          {t(
            "Balance = open invoice debits + unallocated opening/adjustment debits − unapplied credits. Payment and credit allocations are counted once.",
            "مانده = بدهی فاکتورهای باز + بدهی افتتاحیه/تعدیل تخصیص‌نیافته − بستانکاری تخصیص‌نیافته. تخصیص پرداخت و بستانکاری یک‌بار محاسبه می‌شود.",
          )}
        </p>
      </section>
    </>
  );
}
export default Payables;
