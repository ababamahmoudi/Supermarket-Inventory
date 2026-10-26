import {
  branchLabel as configuredBranchLabel,
  branchSellsToCustomers,
  sellingBranches,
} from "../settings";
import { FitText } from "../FitText";
import { SummaryTile } from "../SummaryTile";
import { TimesheetOnShiftTile } from "../TimesheetOnShiftTile";
import { translateCount } from "../i18n";
import { useEffect, useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { formatMoney } from "../formatters";
import { historyActionLabel } from "../history-copy";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import { configuredRoleLabel } from "../role-config";
import { approvalSnapshot, resolveApproval } from "../approvals";
import { ApprovalReviewPanel } from "./ApprovalReviewPanel";
import {
  demoUserLabel,
  DateText,
  LtrText,
  Money,
  ProductName,
  NotAdded,
  categoryLabel,
  UnitText,
} from "../presentation";
import "./financial-polish.css";
import "./dashboard-a2.css";
import { dashboardSummary, type DashboardSummary } from "../dashboard-data";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Disclosure,
  Menu,
  MenuItem,
  TableRowLink,
} from "../ui";
import { companyTimestamp } from "../operations";
import { companyDateTime, companyTimestampText } from "../company-time";
import "./dashboard-r2c.css";
import type { Alert, Approval, Branch, DemoInvoice } from "../types";

function DashboardHeading({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="dashboard-card-header">
      <div className="dashboard-card-title">
        <h2>{title}</h2>
        {count !== undefined && (
          <span className="dashboard-count">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}
function QuietEmpty({ children }: { children: ReactNode }) {
  return <p className="dashboard-empty muted">{children}</p>;
}

export function Dashboard() {
  const [hoveredPurchaseWeek, setHoveredPurchaseWeek] = useState<number | null>(
    null,
  );
  const {
    state,
    actor,
    can,
    command,
    query,
    branch,
    t,
    lang,
    navigate,
    needsReauthentication,
  } = useDemo();
  const [scope, setScope] = useState<"all" | "branch">("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const [wideDashboard, setWideDashboard] = useState(
    () => window.innerWidth >= 1440,
  );
  useEffect(() => {
    const resize = () => setWideDashboard(window.innerWidth >= 1440);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [preview, setPreview] = useState<{
    approval: Approval;
    decision: "approve" | "reject";
    snapshot: string;
    target: Branch;
    company: string;
    branch: Branch;
  } | null>(null);
  const result = useProtectedQuery(
    "dashboard.company",
    { company_id: state.config.company.seed_key, kind: "company_shared" },
    (canonical, current) => dashboardSummary(canonical, current, new Date(now)),
    `dashboard:${Math.floor(now / 60_000)}`,
  );
  const context = actor;
  if (!context || !can("dashboard.company")) return null;
  if (result.error)
    return (
      <EmptyState>
        {t(
          "Browser storage could not be read or updated. Your original data is retained. Allow browser storage, then reload.",
          "فضای ذخیره‌سازی مرورگر قابل خواندن یا به‌روزرسانی نیست. داده‌های اصلی شما حفظ شده‌اند. ذخیره‌سازی مرورگر را مجاز کنید، سپس صفحه را دوباره بارگذاری کنید.",
        )}
      </EmptyState>
    );
  if (!result.data)
    return <EmptyState>{t("Loading", "در حال بارگذاری")}</EmptyState>;
  const {
    approvalRows,
    priceUpdates,
    purchaseMonthTotal,
    today,
    recentInvoices,
    shortCount,
    expiryCount,
    notes,
    activity,
    balances,
    purchases,
    arrivals,
    weeklyChanges,
  } = result.data;

  const branches = sellingBranches(state.config);
  const alertPriority: Record<Alert["type"], number> = {
    lower_price: 0,
    price_conflict: 1,
    tax_discrepancy: 2,
    other_supplier: 3,
    barcode_conflict: 4,
    order_differences: 5,
    return_credit_overdue: 6,
    date_reminder: 7,
    sale_cost_increase: 2,
    sale_regular_not_above_sale: 2,
    sale_no_end_reminder: 8,
    sale_delivery_release: 8,
  };
  const alerts = state.alerts
    .filter(
      (item) =>
        item.company_id === context.company_id &&
        (branch === "all" || item.branch === branch || item.branch === "all") &&
        item.status === "pending",
    )
    .sort(
      (left, right) => alertPriority[left.type] - alertPriority[right.type],
    );
  const openReturns = state.returns.filter(
    (item) =>
      item.company_id === context.company_id &&
      item.status !== "resolved" &&
      item.status !== "cancelled" &&
      (branch === "all" || item.branch === branch),
  );
  const productName = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return (lang === "fa" ? product?.name_fa : product?.name_en) ?? code;
  };
  const productLabel = (code: string) => {
    const product = state.products.find(
      (item) => item.company_id === context.company_id && item.code === code,
    );
    return product ? (
      <ProductName product={product} language={lang} />
    ) : (
      <LtrText>{code}</LtrText>
    );
  };
  const branchName = (value: Branch) =>
    configuredBranchLabel(state.config, value, lang);
  const approvalType = (item: Approval) =>
    item.manual_override
      ? t("Manual price override", "تغییر دستی قیمت")
      : {
          new_supplier: t("New supplier", "تأمین‌کننده جدید"),
          new_product: t("New product", "محصول جدید"),
          price_change: t("Price change", "تغییر قیمت"),
          margin_review: t("Below minimum margin", "کمتر از حداقل حاشیه سود"),
          barcode_conflict: t("Barcode conflict", "تعارض بارکد"),
          tax_profile: t("Tax profile change", "تغییر وضعیت مالیات"),
        }[item.type];
  const alertType = (type: Alert["type"]) =>
    ({
      lower_price: t("Same-supplier lower price", "کاهش قیمت همان تأمین‌کننده"),
      price_conflict: t("Cross-branch price conflict", "اختلاف قیمت میان شعب"),
      tax_discrepancy: t("Tax discrepancy", "مغایرت مالیات"),
      other_supplier: t("Different supplier price", "قیمت تأمین‌کننده دیگر"),
      barcode_conflict: t("Barcode conflict", "تعارض بارکد"),
      order_differences: t("Order differences", "اختلاف‌های سفارش"),
      return_credit_overdue: t(
        "Return waiting for credit",
        "مرجوعی در انتظار اعتبار",
      ),
      date_reminder: t("Date tracking", "پیگیری تاریخ"),
      sale_cost_increase: t(
        "Cost went up during a sale",
        "هزینه هنگام تخفیف افزایش یافت",
      ),
      sale_regular_not_above_sale: t(
        "The new regular price would be lower than the sale price",
        "قیمت عادی جدید کمتر از قیمت تخفیف خواهد بود",
      ),
      sale_no_end_reminder: t("Sale", "تخفیف"),
      sale_delivery_release: t("Sale ended", "تخفیف پایان یافت"),
    })[type];
  const invoiceStatus = (status: DemoInvoice["status"]) =>
    ({
      empty: t("Draft", "پیش‌نویس"),
      draft: t("Draft", "پیش‌نویس"),
      reading: t("Processing", "در حال پردازش"),
      review: t("Needs review", "نیاز به بررسی"),
      posted: t("Posted", "ثبت‌شده"),
    })[status];
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase();
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
    })[action] ?? historyActionLabel(action, lang);
  const openPreview = async (
    approval: Approval,
    decision: "approve" | "reject",
  ) => {
    setMessage("");
    setError("");
    if (needsReauthentication("approvals")) {
      navigate("approvals");
      return;
    }
    const reviewed = {
      company: context.company_id,
      branch,
      approval,
      decision,
    };
    try {
      const snapshot = await query(
        "approvals.decide",
        {
          company_id: context.company_id,
          kind: "company_shared",
          entity_id: approval.id,
        },
        (canonical, current) =>
          approvalSnapshot(canonical, current, approval.product_code),
      );
      setScope("all");
      setPreview({
        ...reviewed,
        snapshot,
        target: branchSellsToCustomers(state.config, approval.branch)
          ? approval.branch
          : branchSellsToCustomers(state.config, branch)
            ? branch
            : "all",
      });
    } catch {
      setError(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
    }
  };
  const confirm = async () => {
    if (!preview) return;
    if (needsReauthentication("approvals")) {
      setPreview(null);
      navigate("approvals");
      return;
    }
    if (preview.company !== context.company_id || preview.branch !== branch) {
      setError(
        t(
          "Prices or branch changed. Open the approval again to review the latest prices before confirming.",
          "قیمت یا شعبه تغییر کرد. برای بررسی تازه‌ترین قیمت‌ها، تأیید را دوباره باز کنید.",
        ),
      );
      setPreview(null);
      return;
    }
    try {
      await command(
        "approvals.decide",
        {
          company_id: context.company_id,
          kind: "company_shared",
          entity_id: preview.approval.id,
          mutation: true,
        },
        (draft, current) =>
          resolveApproval(
            draft,
            current,
            preview.approval.id,
            preview.decision,
            scope,
            preview.target,
            undefined,
            preview.snapshot,
          ),
      );
      setMessage(
        preview.decision === "reject"
          ? t(
              "Rejected proposal. The approved price was kept.",
              "پیشنهاد رد شد. قیمت تأییدشده حفظ شد.",
            )
          : preview.approval.type === "new_product"
            ? t("Approved product.", "محصول تأیید شد.")
            : t(
                "Approved price. Cashier lookup now shows the approved price.",
                "قیمت تأیید شد. جستجوی صندوق‌دار اکنون قیمت تأییدشده را نشان می‌دهد.",
              ),
      );
    } catch {
      setError(
        t(
          "This proposal changed. Open the approval again before confirming.",
          "این پیشنهاد تغییر کرد. پیش از تأیید، آن را دوباره باز کنید.",
        ),
      );
    }
    setPreview(null);
  };
  const newProducts = approvalRows.filter(
    (row) => row.kind === "new_product",
  ).length;
  const priceChanges = approvalRows.filter(
    (row) => row.kind === "price_change",
  ).length;
  const saleRequests = approvalRows.filter(
    (row) => row.kind === "sale_request",
  ).length;
  const conflicts = alerts.filter(
    (row) => row.type === "price_conflict",
  ).length;
  const dateChecks = alerts.filter(
    (row) => row.type === "date_reminder",
  ).length;
  const count = (value: number, en: string, plural: string, fa: string) =>
    translateCount(en, plural, fa, fa, value, lang);
  const approvalCount = approvalRows.length;
  const hasTimesheets =
    state.config.modules.timesheets !== false && can("timesheets.read");
  const kpis = [
    {
      label: t("Approvals waiting", "تأییدهای در انتظار"),
      value: approvalCount,
      detail:
        [
          newProducts
            ? count(
                newProducts,
                "{{count}} new product",
                "{{count}} new products",
                "{{count}} محصول جدید",
              )
            : "",
          priceChanges
            ? count(
                priceChanges,
                "{{count}} price change",
                "{{count}} price changes",
                "{{count}} تغییر قیمت",
              )
            : "",
          saleRequests
            ? count(
                saleRequests,
                "{{count}} sale request",
                "{{count}} sale requests",
                "{{count}} درخواست تخفیف",
              )
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || t("You're all caught up", "همه کارها انجام شده"),
      page: "approvals",
      tone: "accent",
    },
    {
      label: t("Price updates to apply", "به‌روزرسانی قیمت‌های قابل اجرا"),
      value: priceUpdates.length,
      detail: t("Shelf labels to change", "برچسب‌های قفسه برای تغییر"),
      page: "price-updates",
      tone: "accent",
    },
    {
      label: t("Open alerts", "هشدارهای باز"),
      value: alerts.length,
      detail: `${count(conflicts, "{{count}} conflict", "{{count}} conflicts", "{{count}} اختلاف")} · ${count(dateChecks, "{{count}} date check", "{{count}} date checks", "{{count}} بررسی تاریخ")}`,
      page: "alerts",
      tone: "pending",
    },
    {
      label: t("Open shorts", "کسری‌های باز"),
      value: shortCount,
      detail: shortCount
        ? t("Items waiting for delivery", "کالاهای در انتظار تحویل")
        : t("Nothing waiting for delivery", "کالایی در انتظار تحویل نیست"),
      page: "invoices",
      tone: "approved",
    },
    {
      label: t("Expiring soon", "انقضای نزدیک"),
      value: expiryCount,
      detail: t("Within reminder window", "در بازهٔ یادآوری"),
      page: "expiry",
      tone: "pending",
    },
  ];
  const link = (code: string) => (
    <a
      className="entity-link"
      href={`#product?code=${encodeURIComponent(code)}`}
    >
      {productLabel(code)}
    </a>
  );
  const viewAll = (route: string, label = t("View all", "مشاهده همه")) => (
    <Button variant="plain" onClick={() => navigate(route)}>
      {label}
      <ArrowRight size={16} className="directional" aria-hidden="true" />
    </Button>
  );
  const margin = (row: DashboardSummary["approvalRows"][number]) =>
    row.margin === null ? (
      <NotAdded />
    ) : (
      <LtrText className={row.belowMinimum ? "dashboard-warning" : ""}>
        {new Decimal(row.margin).times(100).toFixed(0, Decimal.ROUND_HALF_UP)}%
      </LtrText>
    );
  const longDate = new Intl.DateTimeFormat(
    lang === "fa" ? "fa-IR-u-ca-gregory" : "en-CA",
    { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" },
  ).format(new Date(`${today}T12:00:00Z`));
  const groupedActivity = new Map<string, typeof activity>();
  for (const entry of activity.slice(0, 8)) {
    const date = companyDateTime(state.config, entry.at).date;
    groupedActivity.set(date, [...(groupedActivity.get(date) ?? []), entry]);
  }
  return (
    <div
      className="r2c-dashboard"
      data-timesheets-access={hasTimesheets ? "allowed" : "denied"}
      data-timesheets-module={
        state.config.modules.timesheets === false ? "off" : "on"
      }
    >
      <PageHeader
        title={t(
          `${configuredRoleLabel(state.config.roles, "manager", "en")} dashboard`,
          `داشبورد ${configuredRoleLabel(state.config.roles, "manager", "fa")}`,
        )}
        description={`${branchName(branch)} · ${longDate} · ${t("What needs you today", "امروز به چه چیزی نیاز دارید")}`}
        actions={
          <Button onClick={() => navigate("approvals")}>
            {t(
              `Review ${approvalCount} approvals`,
              `بررسی ${approvalCount} تأیید`,
            )}
            <ArrowRight size={16} className="directional" aria-hidden="true" />
          </Button>
        }
      />
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="banner approved" role="status">
          {message}
        </div>
      )}
      <div
        className={`dashboard-kpis${hasTimesheets ? " has-timesheets" : ""}`}
      >
        {kpis.map((item) => (
          <SummaryTile
            key={item.page}
            className="dashboard-summary-tile"
            label={item.label}
            value={item.value}
            detail={item.detail}
            tone={item.tone as "accent" | "pending" | "approved"}
            onClick={() => navigate(item.page)}
          />
        ))}
        <TimesheetOnShiftTile />
      </div>
      <div className="dashboard-layout">
        <div className="dashboard-main">
          <Card className="dashboard-approvals">
            <DashboardHeading
              title={t("Approvals waiting", "تأییدهای در انتظار")}
              count={approvalCount}
              action={viewAll("approvals")}
            />
            {approvalRows.length ? (
              <>
                <DataTable
                  className="dashboard-approval-table"
                  phoneList={{
                    name: "product",
                    value: "price",
                    secondary: ["type", "actions"],
                  }}
                  columns={[
                    {
                      key: "product",
                      required: true,
                      width: wideDashboard ? 190 : 150,
                      fixedWidth: true,
                      minWidth: wideDashboard ? 190 : 150,
                      priority: 1,
                    },
                    { key: "type", width: 140, minWidth: 140, priority: 4 },
                    {
                      key: "price",
                      required: true,
                      width: 145,
                      minWidth: 115,
                      align: "end",
                      priority: 2,
                    },
                    {
                      key: "margin",
                      width: 65,
                      minWidth: 60,
                      align: "end",
                      priority: 3,
                    },
                    {
                      key: "actions",
                      width: 140,
                      minWidth: 132,
                      actions: true,
                      priority: 0,
                    },
                  ]}
                >
                  <thead>
                    <tr>
                      <th>{t("Product", "محصول")}</th>
                      <th>{t("Type", "نوع")}</th>
                      <th>{t("Price", "قیمت")}</th>
                      <th>{t("Margin", "حاشیه سود")}</th>
                      <th>{t("Action", "عملیات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalRows.slice(0, 6).map((row) => {
                      const approval = state.approvals.find(
                        (item) => item.id === row.id,
                      );
                      return (
                        <tr
                          className="dashboard-queue-row"
                          key={row.id}
                          data-approval-id={row.id}
                        >
                          <td>
                            <div className="dashboard-queue-product">
                              {link(row.productCode)}
                              <span className="dashboard-compact-type muted">
                                {row.kind === "sale_request"
                                  ? t("Sale request", "درخواست تخفیف")
                                  : approval
                                    ? approvalType(approval)
                                    : t("Review", "بررسی")}
                              </span>
                              <FitText
                                className="dashboard-product-context muted"
                                value={[
                                  row.productCode,
                                  row.category
                                    ? categoryLabel(
                                        state.config.pricing_categories.find(
                                          (category) =>
                                            category.key === row.category,
                                        )?.label ?? row.category,
                                        lang,
                                      )
                                    : "",
                                  row.supplier,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              />
                            </div>
                          </td>
                          <td>
                            <Badge
                              className={
                                row.kind === "price_change"
                                  ? "is-price-change"
                                  : undefined
                              }
                              tone={
                                row.kind === "sale_request"
                                  ? "pending"
                                  : row.kind === "new_product"
                                    ? "info"
                                    : "neutral"
                              }
                            >
                              {row.kind === "sale_request"
                                ? t("Sale request", "درخواست تخفیف")
                                : approval
                                  ? approvalType(approval)
                                  : t("Review", "بررسی")}
                            </Badge>
                          </td>
                          <td>
                            <div className="dashboard-approval-price">
                              <strong dir="ltr">
                                {row.kind === "price_change" &&
                                  row.oldPrice && (
                                    <>
                                      <Money value={row.oldPrice} />{" "}
                                      <span aria-hidden="true">→</span>{" "}
                                    </>
                                  )}
                                <Money value={row.price} />
                              </strong>
                              <small className="muted">
                                {row.kind === "new_product" || !row.oldPrice ? (
                                  t("first price", "قیمت نخست")
                                ) : row.kind === "price_change" &&
                                  new Decimal(row.oldPrice).gt(0) ? (
                                  <LtrText>
                                    {new Decimal(row.price).gte(row.oldPrice)
                                      ? "+"
                                      : ""}
                                    {new Decimal(row.price)
                                      .minus(row.oldPrice)
                                      .div(row.oldPrice)
                                      .times(100)
                                      .toFixed(0)}
                                    %
                                  </LtrText>
                                ) : (
                                  <>
                                    {t("was", "قبلاً")}{" "}
                                    <Money value={row.oldPrice} />
                                  </>
                                )}
                              </small>
                              <small className="dashboard-phone-margin">
                                {margin(row)} {t("margin", "حاشیه سود")}
                              </small>
                            </div>
                          </td>
                          <td>{margin(row)}</td>
                          <td>
                            <div className="dashboard-inline-actions">
                              {row.requiresReview || !approval ? (
                                <Button
                                  variant={
                                    row.belowMinimum ? "tinted" : "secondary"
                                  }
                                  onClick={() =>
                                    navigate(
                                      `approvals?id=${encodeURIComponent(row.id)}`,
                                    )
                                  }
                                >
                                  {t("Review", "بررسی")}
                                </Button>
                              ) : (
                                <Button
                                  onClick={() =>
                                    openPreview(approval, "approve")
                                  }
                                >
                                  {t("Approve", "تأیید")}
                                </Button>
                              )}
                              <Menu
                                label={t("More", "بیشتر")}
                                iconOnly
                                icon={
                                  <MoreHorizontal
                                    size={20}
                                    aria-hidden="true"
                                  />
                                }
                              >
                                <MenuItem
                                  onClick={() =>
                                    navigate(
                                      `approvals?id=${encodeURIComponent(row.id)}`,
                                    )
                                  }
                                >
                                  {t("View approval", "مشاهده تأیید")}
                                </MenuItem>
                                {approval && (
                                  <MenuItem
                                    className="is-destructive"
                                    onClick={() =>
                                      openPreview(approval, "reject")
                                    }
                                  >
                                    {t("Reject", "رد کردن")}
                                  </MenuItem>
                                )}
                              </Menu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
                <p className="dashboard-table-caption muted">
                  {t(
                    `Showing ${Math.min(6, approvalCount)} of ${approvalCount} · New products show their first price. Price changes show old → new.`,
                    `نمایش ${Math.min(6, approvalCount)} از ${approvalCount} · محصول جدید قیمت نخست را نشان می‌دهد. تغییر قیمت به صورت قبلی ← جدید است.`,
                  )}
                </p>
              </>
            ) : (
              <QuietEmpty>
                {t("No approvals waiting.", "تأییدی در انتظار نیست.")}
              </QuietEmpty>
            )}
          </Card>
          <Card className="dashboard-invoices">
            <DashboardHeading
              title={t("Recent invoices", "فاکتورهای اخیر")}
              action={viewAll("invoices", t("All invoices", "همه فاکتورها"))}
            />
            {recentInvoices.length ? (
              <DataTable
                phoneList={{
                  name: "invoice",
                  value: "total",
                  secondary: ["supplier", "date", "status", "branch"],
                }}
                columns={[
                  { key: "invoice", required: true, minWidth: 90, priority: 1 },
                  { key: "supplier", minWidth: 140, priority: 4 },
                  { key: "branch", minWidth: 100, priority: 6 },
                  { key: "date", minWidth: 105, priority: 5 },
                  { key: "total", minWidth: 90, align: "end", priority: 2 },
                  { key: "status", minWidth: 100, priority: 3 },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Invoice", "فاکتور")}</th>
                    <th>{t("Supplier", "تأمین‌کننده")}</th>
                    <th>{t("Branch", "شعبه")}</th>
                    <th>{t("Date", "تاریخ")}</th>
                    <th>{t("Total", "جمع")}</th>
                    <th>{t("Status", "وضعیت")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      data-row-href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                    >
                      <td>
                        <a
                          className="entity-link dashboard-invoice-reference"
                          href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                        >
                          <LtrText>
                            {invoice.supplier_invoice_number || invoice.id}
                          </LtrText>
                        </a>
                      </td>
                      <td>
                        <bdi>{invoice.supplier}</bdi>
                      </td>
                      <td>{branchName(invoice.branch)}</td>
                      <td>
                        <DateText value={invoice.invoice_date} />
                      </td>
                      <td>
                        {invoice.total ? (
                          <span className="dashboard-invoice-amount">
                            <strong>
                              <Money
                                value={invoice.total}
                                currency={invoice.currency}
                              />
                            </strong>
                            {invoice.currency !==
                              state.config.company.currency && (
                              <small className="muted">
                                <LtrText>{invoice.currency}</LtrText>
                              </small>
                            )}
                          </span>
                        ) : (
                          <NotAdded />
                        )}
                      </td>
                      <td>
                        <Badge
                          tone={
                            invoice.status === "posted"
                              ? "approved"
                              : invoice.status === "review"
                                ? "pending"
                                : "info"
                          }
                        >
                          {invoiceStatus(invoice.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <QuietEmpty>
                {t(
                  "No invoices. Receive an invoice to get started.",
                  "فاکتوری نیست. برای شروع یک فاکتور دریافت کنید.",
                )}
              </QuietEmpty>
            )}
          </Card>
          <div className="dashboard-row dashboard-row-halves dashboard-purchase-pair">
            <Card className="dashboard-purchases dashboard-supplier-purchases">
              <DashboardHeading
                title={t("Purchases by supplier", "خرید از تأمین‌کنندگان")}
              />
              <div className="dashboard-chart-context muted">
                <span>
                  {new Intl.DateTimeFormat(
                    lang === "fa" ? "fa-IR-u-ca-gregory" : "en-CA",
                    { month: "long", timeZone: "UTC" },
                  ).format(new Date(`${today}T12:00:00Z`))}
                </span>
                <Money value={purchaseMonthTotal} />
              </div>
              {purchases.suppliers.length ? (
                <ol className="purchase-bars">
                  {purchases.suppliers.map((row, index) => {
                    const max = Decimal.max(
                      1,
                      ...purchases.suppliers.map((item) => item.amount),
                    );
                    return (
                      <li className="purchase-bar-row" key={row.supplier}>
                        <span className="purchase-rank muted">{index + 1}</span>
                        <div>
                          <div className="row-between">
                            <bdi>{row.supplier}</bdi>
                            <strong>
                              <Money value={row.amount} />
                            </strong>
                          </div>
                          <div
                            className="purchase-bar-track"
                            aria-hidden="true"
                          >
                            <span
                              style={{
                                inlineSize: `${Decimal.max(0, new Decimal(row.amount).div(max).times(100)).toNumber()}%`,
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <QuietEmpty>
                  {t("No purchases this month.", "این ماه خریدی ثبت نشده است.")}
                </QuietEmpty>
              )}
            </Card>
            <Card className="dashboard-purchases dashboard-weekly-purchases">
              <DashboardHeading
                title={t("Purchases by week", "خرید در هر هفته")}
              />
              <p className="dashboard-chart-context muted">
                {t("Last 8 weeks", "۸ هفته گذشته")}
              </p>
              {purchases.weeks.every((week) => week.amount === "0.00") ? (
                <QuietEmpty>
                  {t(
                    "No purchases in the last 8 weeks.",
                    "در ۸ هفته گذشته خریدی ثبت نشده است.",
                  )}
                </QuietEmpty>
              ) : (
                <div
                  className="purchase-week-chart"
                  role="group"
                  aria-label={t(
                    "Net purchases by week",
                    "خرید خالص در هر هفته",
                  )}
                >
                  <div className="purchase-week-bars">
                    {purchases.weeks.map((week, index) => {
                      const max = Decimal.max(
                        1,
                        ...purchases.weeks.map((row) =>
                          new Decimal(row.amount).abs(),
                        ),
                      );
                      return (
                        <div className="purchase-week-column" key={week.start}>
                          <small
                            className="muted"
                            title={formatMoney(week.amount, {
                              currency: state.config.company.currency,
                            })}
                          >
                            {new Decimal(week.amount).abs().gte(1000)
                              ? `${formatMoney(new Decimal(week.amount).div(1000).toDecimalPlaces(1), { currency: state.config.company.currency, decimals: 2 }).replace(/(\.\d)0$/, "$1")}k`
                              : formatMoney(
                                  new Decimal(week.amount).toDecimalPlaces(0),
                                  {
                                    currency: state.config.company.currency,
                                    decimals: 2,
                                  },
                                ).replace(/\.00$/, "")}
                          </small>
                          <span
                            role="img"
                            tabIndex={0}
                            className={`purchase-point purchase-week-bar${index === 7 ? " is-current" : ""}${new Decimal(week.amount).lt(0) ? " is-negative" : ""}`}
                            style={{
                              blockSize: `${Math.max(2, new Decimal(week.amount).abs().div(max).times(120).toNumber())}px`,
                            }}
                            aria-label={`${week.start} – ${week.end}: ${formatMoney(week.amount, { currency: state.config.company.currency })}`}
                            onMouseEnter={() => setHoveredPurchaseWeek(index)}
                            onMouseLeave={() => setHoveredPurchaseWeek(null)}
                            onFocus={() => setHoveredPurchaseWeek(index)}
                            onBlur={() => setHoveredPurchaseWeek(null)}
                          />
                          <time
                            dateTime={week.start}
                            className="date-text"
                            title={week.start}
                          >
                            <FitText
                              value={
                                lang === "fa"
                                  ? `${Number(week.start.slice(5, 7))}/${Number(week.start.slice(8))}`
                                  : new Intl.DateTimeFormat("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      timeZone: "UTC",
                                    })
                                      .format(
                                        new Date(`${week.start}T12:00:00Z`),
                                      )
                                      .replace(" ", "")
                              }
                            />
                          </time>
                        </div>
                      );
                    })}
                  </div>
                  {hoveredPurchaseWeek !== null && (
                    <div className="purchase-chart-tooltip" role="tooltip">
                      <DateText
                        value={purchases.weeks[hoveredPurchaseWeek].start}
                      />{" "}
                      –{" "}
                      <DateText
                        value={purchases.weeks[hoveredPurchaseWeek].end}
                      />
                      <strong>
                        <Money
                          value={purchases.weeks[hoveredPurchaseWeek].amount}
                        />
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
          <div className="dashboard-more-operations">
            <Disclosure summary={t("More operations", "عملیات بیشتر")}>
              <div className="dashboard-operation-cards">
                <Card
                  title={t("Returns", "مرجوعی‌ها")}
                  className="dashboard-returns"
                >
                  {openReturns.length ? (
                    openReturns.slice(0, 5).map((row) => (
                      <div className="dashboard-list-row" key={row.id}>
                        <div className="dashboard-list-copy">
                          <a
                            className="entity-link"
                            href={`#return?id=${encodeURIComponent(row.id)}`}
                          >
                            <bdi>{row.supplier}</bdi>
                          </a>
                          <small className="muted">
                            {branchName(row.branch)}
                          </small>
                        </div>
                        <div className="dashboard-list-pill">
                          <Badge tone="pending">{t("Open", "باز")}</Badge>
                        </div>
                        <div className="dashboard-list-action">
                          <TableRowLink
                            href={`#return?id=${encodeURIComponent(row.id)}`}
                            aria-label={t("View", "مشاهده")}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <QuietEmpty>
                      {t("No open returns.", "مرجوعی بازی نیست.")}
                    </QuietEmpty>
                  )}
                  {viewAll(
                    "returns",
                    t("View all returns", "مشاهده همه مرجوعی‌ها"),
                  )}
                </Card>
                <Card title={t("Arrived this week", "دریافتی‌های این هفته")}>
                  {arrivals.length ? (
                    arrivals.slice(0, 6).map((row) => (
                      <div className="dashboard-list-row" key={row.id}>
                        <div className="dashboard-list-copy">
                          {link(row.product_code)}
                          <small className="muted">
                            {branchName(row.branch)} ·{" "}
                            <DateText value={row.date} /> ·{" "}
                            <LtrText>{row.invoice_number}</LtrText>
                          </small>
                        </div>
                        <Badge tone="info">
                          {count(
                            row.units,
                            "{{count}} unit",
                            "{{count}} units",
                            "{{count}} واحد",
                          )}
                        </Badge>
                        <TableRowLink
                          href={`#received?product=${encodeURIComponent(row.product_code)}`}
                          aria-label={t("View", "مشاهده")}
                        />
                      </div>
                    ))
                  ) : (
                    <QuietEmpty>
                      {t(
                        "No deliveries this week.",
                        "این هفته تحویلی ثبت نشده است.",
                      )}
                    </QuietEmpty>
                  )}
                </Card>
                <Card
                  title={t(
                    "Price changes this week",
                    "تغییر قیمت‌های این هفته",
                  )}
                >
                  {weeklyChanges.length ? (
                    weeklyChanges.slice(0, 6).map((row) => (
                      <div className="dashboard-list-row" key={row.id}>
                        <div className="dashboard-list-copy">
                          {link(row.product_code!)}
                          <small className="muted">
                            {branchName(row.branch)} ·{" "}
                            <DateText value={row.at} />
                          </small>
                        </div>
                        {row.regular_price && (
                          <Money value={row.regular_price} />
                        )}
                      </div>
                    ))
                  ) : (
                    <QuietEmpty>
                      {t(
                        "No price changes this week.",
                        "این هفته تغییری در قیمت ثبت نشده است.",
                      )}
                    </QuietEmpty>
                  )}
                </Card>
              </div>
            </Disclosure>
          </div>
        </div>
        <aside
          className="dashboard-aside"
          aria-label={t("Notes and activity", "یادداشت‌ها و فعالیت")}
        >
          <Card className="price-update-dashboard-card">
            <DashboardHeading
              title={t(
                "Price updates to apply",
                "به‌روزرسانی قیمت‌های قابل اجرا",
              )}
              count={priceUpdates.length}
            />
            {priceUpdates.length ? (
              <div className="dashboard-task-list">
                {priceUpdates.slice(0, 4).map((task) => (
                  <a
                    className="dashboard-task-row"
                    href={`#price-update?id=${encodeURIComponent(task.id)}`}
                    key={task.id}
                  >
                    <span>
                      <strong>
                        <UnitText>{productName(task.productCode)}</UnitText>
                      </strong>
                      <small className="muted">
                        {branchName(task.branch)} ·{" "}
                        {task.oldPrice
                          ? t("approved", "تأییدشده")
                          : t("new product", "محصول جدید")}
                      </small>
                    </span>
                    <span className="dashboard-task-price">
                      <strong>
                        {task.price ? (
                          <Money value={task.price} />
                        ) : (
                          <NotAdded />
                        )}
                        {task.unit !== "each" && (
                          <LtrText>/{task.unit}</LtrText>
                        )}
                      </strong>
                      <small className="muted">
                        {task.oldPrice ? (
                          <>
                            {t("was", "قبلاً")} <Money value={task.oldPrice} />
                          </>
                        ) : (
                          t("first price", "قیمت نخست")
                        )}
                      </small>
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <QuietEmpty>
                {t(
                  "No pending price updates.",
                  "به‌روزرسانی قیمت در انتظار وجود ندارد.",
                )}
              </QuietEmpty>
            )}
            <Button
              variant="tinted"
              className="dashboard-open-tasks"
              onClick={() => navigate("price-updates")}
            >
              {t("Open price updates", "باز کردن به‌روزرسانی قیمت‌ها")}
            </Button>
          </Card>
          <Card className="dashboard-alerts">
            <DashboardHeading
              title={t("Alerts", "هشدارها")}
              count={alerts.length}
              action={viewAll("alerts")}
            />
            {alerts.length ? (
              <div className="dashboard-alert-list">
                {alerts.slice(0, 5).map((item) => (
                  <a
                    className="dashboard-alert-row"
                    href={`#alerts?id=${encodeURIComponent(item.id)}`}
                    key={item.id}
                  >
                    <span
                      className={`dashboard-status-dot tone-${item.type === "price_conflict" ? "danger" : "pending"}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>
                        {item.product_code ? (
                          <UnitText>{productName(item.product_code)}</UnitText>
                        ) : (
                          t("Invoice", "فاکتور")
                        )}
                      </strong>
                      <small className="muted">
                        {alertType(item.type)} · {branchName(item.branch)}
                      </small>
                    </span>
                    <ChevronRight
                      size={18}
                      className="directional"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <QuietEmpty>
                {t("No pending alerts.", "هشداری در انتظار نیست.")}
              </QuietEmpty>
            )}
          </Card>
          <Card className="dashboard-notes">
            <DashboardHeading
              title={t(
                `Notes for ${configuredRoleLabel(state.config.roles, "manager", "en")}`,
                `یادداشت‌های ${configuredRoleLabel(state.config.roles, "manager", "fa")}`,
              )}
              action={viewAll("notes", t("Notes", "یادداشت‌ها"))}
            />
            {notes.length ? (
              notes.slice(0, 5).map((note) => (
                <div className="dashboard-list-row" key={note.id}>
                  <div className="dashboard-list-copy">
                    <strong>{note.text}</strong>
                    <small className="muted">
                      {demoUserLabel(note.by, lang)} · {branchName(note.branch)}{" "}
                      ·{" "}
                      <LtrText>
                        {companyTimestampText(state.config, note.created_at)}
                      </LtrText>
                    </small>
                  </div>
                  <TableRowLink
                    href="#notes"
                    aria-label={t("View", "مشاهده")}
                  />
                </div>
              ))
            ) : (
              <p className="dashboard-empty muted">
                <CheckCircle2 size={16} aria-hidden="true" />
                {t(
                  "No open notes. You're all caught up.",
                  "یادداشت بازی نیست. همه کارها انجام شده است.",
                )}
              </p>
            )}
          </Card>
          <Card className="dashboard-balances">
            <DashboardHeading
              title={t("Supplier balances", "مانده تأمین‌کنندگان")}
              action={viewAll("payables", t("Payables", "حساب‌های پرداختنی"))}
            />
            {balances.length ? (
              balances.map((row) => (
                <div className="dashboard-balance-row" key={row.supplier}>
                  <a
                    className="entity-link"
                    href={`#payables?supplier=${encodeURIComponent(row.supplierId ?? row.supplier)}`}
                  >
                    <bdi>{row.supplier}</bdi>
                  </a>
                  <div>
                    <strong>
                      <Money value={row.balance} />
                    </strong>
                    <small
                      className={
                        new Decimal(row.overdue).gt(0)
                          ? "dashboard-overdue"
                          : "muted"
                      }
                    >
                      {new Decimal(row.overdue).gt(0) ? (
                        <>
                          <Money value={row.overdue} />{" "}
                          {t("overdue", "سررسید گذشته")}
                        </>
                      ) : row.nextDueDate ? (
                        <>
                          {t("Due", "سررسید")}{" "}
                          <DateText value={row.nextDueDate} />
                        </>
                      ) : (
                        t("No overdue invoices", "فاکتور سررسیدگذشته‌ای نیست")
                      )}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <QuietEmpty>
                {t(
                  "No supplier balances. Post an invoice to start the ledger.",
                  "مانده تأمین‌کننده‌ای نیست. برای شروع دفتر، یک فاکتور ثبت کنید.",
                )}
              </QuietEmpty>
            )}
          </Card>
          <Card className="dashboard-activity" id="recent-activity">
            <DashboardHeading title={t("Activity", "فعالیت")} />
            {groupedActivity.size ? (
              [...groupedActivity].map(([day, entries]) => (
                <div className="dashboard-activity-day" key={day}>
                  <h3 className="muted">
                    {day === today ? (
                      t("Today", "امروز")
                    ) : (
                      <DateText value={day} />
                    )}
                  </h3>
                  <ol className="dashboard-activity-list">
                    {entries.map((item) => (
                      <li className="dashboard-activity-item" key={item.id}>
                        <span className="initials-avatar" aria-hidden="true">
                          {initials(item.by)}
                        </span>
                        <div>
                          <strong>
                            {actionLabel(item.action)}
                            {item.product_code && (
                              <>
                                {" "}
                                ·{" "}
                                <UnitText>
                                  {productName(item.product_code)}
                                </UnitText>
                              </>
                            )}
                          </strong>
                          <small className="muted">
                            {demoUserLabel(item.by, lang)} ·{" "}
                            {branchName(item.branch)} ·{" "}
                            <time
                              dateTime={item.at}
                              title={companyTimestamp(state.config, item.at)}
                            >
                              <LtrText>
                                {companyDateTime(state.config, item.at).time}
                              </LtrText>
                            </time>
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            ) : (
              <QuietEmpty>
                {t(
                  "No recent activity. Your actions appear here.",
                  "فعالیت اخیری نیست. کارهای شما اینجا ظاهر می‌شوند.",
                )}
              </QuietEmpty>
            )}
          </Card>
        </aside>
      </div>
      {preview && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          title={
            preview.decision === "approve"
              ? t("Review approval", "بررسی تأیید")
              : t("Reject proposal", "رد پیشنهاد")
          }
          description={
            preview.decision === "approve"
              ? t(
                  "Review every affected branch before confirming.",
                  "پیش از تأیید، همه شعبه‌های تحت تأثیر را بررسی کنید.",
                )
              : t(
                  "The current approved price stays unchanged. This proposal will be marked Rejected.",
                  "قیمت تأییدشده فعلی حفظ می‌شود. این پیشنهاد به وضعیت ردشده تغییر می‌کند.",
                )
          }
          confirmLabel={
            preview.decision === "reject"
              ? t("Reject proposal", "رد پیشنهاد")
              : preview.approval.type === "new_product"
                ? t("Approve product", "تأیید محصول")
                : t("Approve price", "تأیید قیمت")
          }
          onConfirm={confirm}
          confirmVariant={preview.decision === "reject" ? "danger" : "primary"}
          confirmDisabled={preview.decision === "approve" && !branches.length}
        >
          <ApprovalReviewPanel
            approval={preview.approval}
            scope={scope}
            target={preview.target}
            onScopeChange={setScope}
            showEffects={preview.decision === "approve"}
          />
        </ConfirmDialog>
      )}
    </div>
  );
}

export default Dashboard;
