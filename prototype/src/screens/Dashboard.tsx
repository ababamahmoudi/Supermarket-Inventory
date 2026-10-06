import Decimal from "decimal.js";
import { ArrowRight, Bell, ClipboardCheck, Clock3 } from "lucide-react";
import { demoUsers, useDemo } from "../store";
import { companyDate } from "../invoice";
import { Badge, Button, Card, EmptyState, PageHeader } from "../ui";
import {
  ledgerSummary,
  companyTimestamp,
  scopedRecords,
  type OperationalReturn,
  type OperationsContext,
} from "../operations";

export function Dashboard() {
  const { state, role, branch, t, lang, money, navigate } = useDemo();
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: demoUsers.find((user) => user.role === role)?.name ?? "Demo user",
  };
  if (role !== "supervisor")
    return (
      <EmptyState>
        {t(
          "The Supervisor dashboard is available to Supervisors only.",
          "داشبورد سرپرست فقط برای سرپرستان در دسترس است.",
        )}
      </EmptyState>
    );
  const today = companyDate(state.config);
  const approvals = scopedRecords(state.approvals, context).filter(
    (item) => item.status === "pending",
  );
  const alerts = state.alerts
    .filter(
      (item) =>
        item.company_id === context.company_id &&
        (branch === "all" || item.branch === branch || item.branch === "all"),
    )
    .filter((item) => item.status === "pending");
  const returns = scopedRecords(state.returns, context) as OperationalReturn[];
  const invoices = scopedRecords(state.invoices ?? [], context);
  const currentInvoiceVisible =
    state.invoice.company_id === context.company_id &&
    (branch === "all" || state.invoice.branch === branch);
  const posted = invoices.filter((item) => item.status === "posted");
  if (
    currentInvoiceVisible &&
    state.invoice.status === "posted" &&
    !posted.some((item) => item.id === state.invoice.id)
  )
    posted.push(state.invoice);
  const expiry = scopedRecords(state.expiry, context).filter(
    (item) =>
      item.status === "active" &&
      item.date >= today &&
      Math.ceil((Date.parse(item.date) - Date.parse(today)) / 86_400_000) <=
        state.config.expiry.expiring_soon_days,
  );
  const activity = state.activity
    .filter(
      (item) =>
        item.company_id === context.company_id &&
        (branch === "all" || item.branch === branch || item.branch === "all"),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const suppliers = [
    ...new Set(
      state.ledger
        .filter((item) => item.company_id === context.company_id)
        .map((item) => item.supplier),
    ),
  ];
  const ledgers = suppliers.map((supplier) => ({
    supplier,
    summary: ledgerSummary(state, context, supplier),
  }));
  const balance = ledgers
    .reduce((sum, item) => sum.plus(item.summary.balance), new Decimal(0))
    .toFixed(2);
  const overdue = ledgers
    .flatMap((item) => item.summary.invoices)
    .filter(
      (invoice) =>
        new Decimal(invoice.amount).gt(0) &&
        invoice.due_date &&
        invoice.due_date < today,
    );
  const shorts = posted.flatMap((invoice) =>
    invoice.lines.filter(
      (line) =>
        line.qty_invoiced -
          line.qty_received_at_posting -
          (line.qty_later_received ?? 0) >
        0,
    ),
  );
  const lowerPrice = alerts.filter((item) => item.type === "lower_price");
  const returnCredits = returns.filter(
    (item) =>
      item.status === "claim_pending" ||
      item.claims?.some((claim) => claim.status === "submitted"),
  );
  const metrics: Record<
    string,
    {
      label: string;
      number: string | number;
      page: string;
      tone: string;
      detail?: string;
    }
  > = {
    approvals_waiting: {
      label: t("Approvals waiting", "تأییدهای در انتظار"),
      number: approvals.length,
      page: "approvals",
      tone: "pending",
    },
    same_supplier_lower_price_alerts: {
      label: t(
        "Same-supplier lower-price alerts",
        "هشدار کاهش قیمت همان تأمین‌کننده",
      ),
      number: lowerPrice.length,
      page: "alerts",
      tone: "pending",
    },
    cross_branch_price_conflicts: {
      label: t("Cross-branch price conflicts", "اختلاف قیمت میان شعب"),
      number: alerts.filter((item) => item.type === "price_conflict").length,
      page: "alerts",
      tone: "danger",
    },
    tax_discrepancies: {
      label: t("Tax discrepancies", "مغایرت مالیات"),
      number: alerts.filter((item) => item.type === "tax_discrepancy").length,
      page: "alerts",
      tone: "danger",
    },
    barcode_conflicts: {
      label: t("Barcode conflicts", "تعارض بارکد"),
      number:
        alerts.filter((item) => item.type === "barcode_conflict").length +
        approvals.filter((item) => item.type === "barcode_conflict").length,
      page: "approvals",
      tone: "danger",
    },
    ai_invoices_waiting_review: {
      label: t("Invoices waiting for review", "فاکتورهای منتظر بررسی"),
      number:
        currentInvoiceVisible && state.invoice.status === "review" ? 1 : 0,
      page: "invoices",
      tone: "pending",
    },
    ai_processing_failures: {
      label: t("Invoice reading failures", "خطاهای خواندن فاکتور"),
      number: 0,
      page: "invoices",
      tone: "danger",
      detail: t(
        "AI reading is simulated",
        "خواندن هوش مصنوعی شبیه‌سازی شده است",
      ),
    },
    open_shorts: {
      label: t("Open shorts", "کسری‌های باز"),
      number: shorts.length,
      page: "invoices",
      tone: "danger",
    },
    open_supplier_returns: {
      label: t("Open supplier returns", "مرجوعی‌های باز تأمین‌کنندگان"),
      number: returns.filter(
        (item) => item.status !== "resolved" && item.status !== "cancelled",
      ).length,
      page: "returns",
      tone: "pending",
    },
    returns_waiting_for_credit: {
      label: t("Returns waiting for credit", "مرجوعی‌های منتظر بستانکاری"),
      number: returnCredits.length,
      page: "returns",
      tone: "pending",
    },
    upcoming_expiries: {
      label: t("Upcoming expiries", "انقضاهای نزدیک"),
      number: expiry.length,
      page: "expiry",
      tone: "pending",
    },
    overdue_invoices: {
      label: t("Overdue invoices", "فاکتورهای سررسید گذشته"),
      number: overdue.length,
      page: "payables",
      tone: "danger",
    },
    supplier_balances: {
      label: t("Supplier balances", "مانده تأمین‌کنندگان"),
      number: money(balance),
      page: "payables",
      tone: "info",
    },
    recent_posted_invoices: {
      label: t("Recent posted invoices", "فاکتورهای اخیراً ثبت‌شده"),
      number: posted.length,
      page: "invoices",
      tone: "approved",
    },
    employee_activity: {
      label: t("Employee activity", "فعالیت کارکنان"),
      number: activity.length,
      page: "dashboard",
      tone: "info",
      detail: t("Recent activity below", "فعالیت اخیر در پایین"),
    },
  };
  const productName = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return lang === "fa" ? product?.name_fa : product?.name_en;
  };
  const actionLabel = (action: string) =>
    ({
      "Approve product": t("Approve product", "تأیید محصول"),
      "Approve price": t("Approve price", "تأیید قیمت"),
      "Reject proposal": t("Reject proposal", "رد پیشنهاد"),
      "Apply price to all branches": t(
        "Apply price to all branches",
        "اعمال قیمت به همه شعب",
      ),
      "Keep approved price": t("Keep approved price", "حفظ قیمت تأییدشده"),
      "Propose manual override": t(
        "Propose manual override",
        "پیشنهاد تغییر دستی قیمت",
      ),
      "Mark as intentional": t(
        "Mark as intentional",
        "علامت‌گذاری به‌عنوان عمدی",
      ),
      "Confirm offer": t("Confirm offer", "تأیید پیشنهاد ویژه"),
      "Create offer": t("Create offer", "ایجاد پیشنهاد ویژه"),
      Dismiss: t("Dismiss", "نادیده گرفتن"),
      "Stop offer": t("Stop offer", "توقف پیشنهاد ویژه"),
      "Keep as pending": t("Keep as pending", "نگه داشتن در انتظار"),
      "Mark as taken care of": t(
        "Mark as taken care of",
        "علامت‌گذاری به‌عنوان رسیدگی‌شده",
      ),
      "Posted invoice": t("Posted invoice", "فاکتور ثبت شد"),
      "Received short delivery": t(
        "Received short delivery",
        "تحویل کسری دریافت شد",
      ),
      supplier_dispute_recorded: t(
        "Recorded supplier dispute",
        "اختلاف تأمین‌کننده ثبت شد",
      ),
      return_original_recovered: t(
        "Received safe original goods",
        "اصل کالای سالم دریافت شد",
      ),
      return_pickup: t("Recorded return pickup", "جمع‌آوری مرجوعی ثبت شد"),
      replacement_received: t("Received replacement", "جایگزین دریافت شد"),
      return_claim_submitted: t(
        "Submitted return claim",
        "ادعای مرجوعی ارسال شد",
      ),
      return_claim_posted: t("Posted return claim", "ادعای مرجوعی ثبت شد"),
      return_cancelled: t("Cancelled return", "مرجوعی لغو شد"),
      return_cancellation_review: t(
        "Requested cancellation review",
        "بررسی لغو درخواست شد",
      ),
      return_cancellation_approved: t("Approved cancellation", "لغو تأیید شد"),
      return_cancellation_declined: t("Declined cancellation", "لغو رد شد"),
      store_use_recorded: t("Recorded store use", "مصرف فروشگاه ثبت شد"),
      note_added: t("Added note", "یادداشت افزوده شد"),
      note_seen: t("Marked note seen", "یادداشت دیده‌شده علامت‌گذاری شد"),
      note_resolved: t("Completed note", "یادداشت انجام شد"),
      expiry_cleared: t("Cleared date entry", "تاریخ پاک شد"),
      payment_recorded: t(
        "Recorded external payment",
        "پرداخت خارج از برنامه ثبت شد",
      ),
      ledger_adjustment_recorded: t(
        "Recorded ledger adjustment",
        "تعدیل دفتر ثبت شد",
      ),
    })[action] ?? t("Recorded activity", "فعالیت ثبت‌شده");
  return (
    <>
      <PageHeader
        title={t("Supervisor dashboard", "داشبورد سرپرست")}
        description={t(
          "Your branch priorities, approvals, and recent activity — in the configured order.",
          "اولویت‌های شعبه، تأییدها و فعالیت اخیر — با ترتیب تنظیم‌شده.",
        )}
        actions={
          <Button onClick={() => navigate("approvals")}>
            {t("Review approvals", "بررسی تأییدها")}
          </Button>
        }
      />
      <div className="stats-grid">
        {state.config.dashboard_order.map((key) => {
          const metric = metrics[key];
          return metric ? (
            <button
              type="button"
              key={key}
              className="stat-card"
              onClick={() =>
                key === "employee_activity"
                  ? document
                      .getElementById("recent-activity")
                      ?.scrollIntoView({ behavior: "instant" })
                  : navigate(metric.page)
              }
              aria-label={`${metric.label}: ${metric.number}`}
            >
              <span className={`icon-tile ${metric.tone}`}>
                <ClipboardCheck size={20} aria-hidden="true" />
              </span>
              <span className="stat-label">{metric.label}</span>
              <strong className="stat-number" dir="ltr">
                {metric.number}
              </strong>
              {metric.detail && <span className="muted">{metric.detail}</span>}
              <ArrowRight
                size={16}
                className="directional"
                aria-hidden="true"
              />
            </button>
          ) : null;
        })}
      </div>
      <div className="form-grid">
        <Card title={t("Approvals queue", "صف تأییدها")}>
          {approvals.length === 0 ? (
            <EmptyState>
              {t("No approvals waiting.", "تأییدی در انتظار نیست.")}
            </EmptyState>
          ) : (
            approvals.slice(0, 6).map((item) => (
              <div className="row-between history-row" key={item.id}>
                <div>
                  <strong>{productName(item.product_code)}</strong>
                  <p className="muted">
                    {item.branch} ·{" "}
                    {item.type === "new_product"
                      ? t("New product", "محصول جدید")
                      : item.type === "margin_review"
                        ? t("Below margin", "حاشیه سود پایین")
                        : t("Price change", "تغییر قیمت")}
                  </p>
                </div>
                <div>
                  <Badge tone="pending">{t("Pending", "در انتظار")}</Badge>
                  <Button variant="ghost" onClick={() => navigate("approvals")}>
                    {t("Review", "بررسی")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
        <Card title={t("Alerts", "هشدارها")}>
          {alerts.length === 0 ? (
            <EmptyState>
              {t("No pending alerts.", "هشداری در انتظار نیست.")}
            </EmptyState>
          ) : (
            alerts.slice(0, 6).map((item) => (
              <div className="row-between history-row" key={item.id}>
                <div>
                  <strong>{productName(item.product_code)}</strong>
                  <p className="muted">
                    {item.type === "price_conflict"
                      ? t("Cross-branch price conflict", "اختلاف قیمت میان شعب")
                      : item.type === "lower_price"
                        ? t(
                            "Same-supplier lower price",
                            "کاهش قیمت همان تأمین‌کننده",
                          )
                        : item.type === "other_supplier"
                          ? t(
                              "Different supplier price",
                              "قیمت تأمین‌کننده دیگر",
                            )
                          : item.type === "tax_discrepancy"
                            ? t("Tax discrepancy", "مغایرت مالیات")
                            : t("Barcode conflict", "تعارض بارکد")}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => navigate("alerts")}>
                  <Bell size={16} aria-hidden="true" />
                  {t("Review", "بررسی")}
                </Button>
              </div>
            ))
          )}
        </Card>
      </div>
      <Card title={t("Recent posted invoices", "فاکتورهای اخیراً ثبت‌شده")}>
        {posted.length === 0 ? (
          <EmptyState
            action={
              <Button variant="secondary" onClick={() => navigate("invoices")}>
                {t("Receive an invoice", "دریافت فاکتور")}
              </Button>
            }
          >
            {t(
              "No posted invoices. Receive the fictional demo delivery to connect this dashboard.",
              "فاکتور ثبت‌شده‌ای نیست. تحویل ساختگی نمونه را دریافت کنید تا داشبورد کامل شود.",
            )}
          </EmptyState>
        ) : (
          posted
            .slice(-5)
            .reverse()
            .map((invoice) => (
              <div className="row-between history-row" key={invoice.id}>
                <div>
                  <strong>{invoice.supplier_invoice_number}</strong>
                  <p className="muted">
                    {invoice.supplier} · {invoice.branch} ·{" "}
                    {invoice.invoice_date}
                  </p>
                </div>
                <Badge tone="approved">{t("Posted", "ثبت‌شده")}</Badge>
                <Button variant="ghost" onClick={() => navigate("invoices")}>
                  {t("View", "مشاهده")}
                </Button>
              </div>
            ))
        )}
      </Card>
      <section id="recent-activity">
        <Card title={t("Recent activity", "فعالیت اخیر")}>
          {activity.length === 0 ? (
            <EmptyState>
              {t(
                "No new activity yet. Actions throughout the demo appear here.",
                "هنوز فعالیت جدیدی نیست. کارهای نمایش اینجا ظاهر می‌شوند.",
              )}
            </EmptyState>
          ) : (
            activity.slice(0, 12).map((item) => (
              <div className="history-row" key={item.id}>
                <div className="row-between">
                  <strong>
                    <Clock3 size={16} aria-hidden="true" />{" "}
                    {actionLabel(item.action)}
                  </strong>
                  {item.product_code && (
                    <span>{productName(item.product_code)}</span>
                  )}
                </div>
                <p className="muted">
                  {item.by} · {item.branch} ·{" "}
                  <span dir="ltr">
                    {companyTimestamp(state.config, item.at)}
                  </span>
                </p>
              </div>
            ))
          )}
        </Card>
      </section>
    </>
  );
}
export default Dashboard;
