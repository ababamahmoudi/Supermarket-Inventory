import {
  branchLabel as configuredBranchLabel,
  branchSellsToCustomers,
  sellingBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { isValidElement, useEffect, useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { formatMoney } from "../formatters";
import { historyActionLabel } from "../history-copy";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  ClipboardCheck,
  PackageMinus,
  MoreHorizontal,
} from "lucide-react";
import { useDemo } from "../store";
import { PriceUpdatesDashboardCard } from "../price-update-presentation";
import { useProtectedQuery } from "../use-protected-query";
import { configuredRoleLabel } from "../role-config";
import { companyDate } from "../invoice";
import { approvalSnapshot, resolveApproval } from "../approvals";
import { ManualPricePill } from "../manual-price-presentation";
import { SupplierApproval } from "./SupplierApproval";
import { SaleRequestCards } from "./SalesApprovals";
import { ApprovalReviewPanel } from "./ApprovalReviewPanel";
import {
  demoUserLabel,
  DateText,
  LtrText,
  Money,
  ProductName,
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
  Menu,
  MenuItem,
  TableRowLink,
} from "../ui";
import { companyTimestamp } from "../operations";
import type { Alert, Approval, Branch, DemoInvoice } from "../types";

function DashboardListRow({
  title,
  secondary,
  pill,
  action,
}: {
  title: ReactNode;
  secondary: ReactNode;
  pill: ReactNode;
  action: ReactNode;
}) {
  const href = isValidElement<{ href?: string }>(action)
    ? action.props.href
    : undefined;
  return (
    <div
      className={`dashboard-list-row${href ? " is-navigable" : ""}`}
      tabIndex={href ? 0 : undefined}
      onClick={(event) => {
        if (
          href &&
          event.target instanceof Element &&
          !event.target.closest(
            "a,button,input,textarea,[role='checkbox'],[role='combobox']",
          )
        )
          window.location.hash = href;
      }}
      onKeyDown={(event) => {
        if (
          href &&
          event.target === event.currentTarget &&
          ["Enter", " "].includes(event.key)
        ) {
          event.preventDefault();
          window.location.hash = href;
        }
      }}
    >
      <div className="dashboard-list-copy">
        <strong>{title}</strong>
        <div className="muted">{secondary}</div>
      </div>
      <div className="dashboard-list-pill">{pill}</div>
      <div className="dashboard-list-action">{action}</div>
    </div>
  );
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
    approvalPrices,
  } = result.data;

  const branches = sellingBranches(state.config);
  const approvals = state.approvals.filter((item) => item.status === "pending");
  const pendingSaleRequests = (state.sale_requests ?? []).filter(
    (item) => item.status === "pending",
  );
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
    (item) => item.status !== "resolved" && item.status !== "cancelled",
  );
  const returnCredits = openReturns.filter(
    (item) =>
      item.status === "claim_pending" ||
      item.claims?.some((claim) => claim.status === "submitted"),
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
  const noteText = (item: DashboardSummary["notes"][number]) =>
    item.text ===
    "Customer asked about the tea glass set price; please confirm."
      ? t(
          "Customer asked about the tea glass set price; please confirm.",
          "مشتری درباره قیمت ست استکان پرسید؛ لطفاً تأیید کنید.",
        )
      : item.text;
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase();
  const relativeTime = (at: string) => {
    const elapsed = now - Date.parse(at);
    if (!Number.isFinite(elapsed)) return companyTimestamp(state.config, at);
    const minutes = Math.max(0, Math.floor(elapsed / 60_000));
    if (minutes < 1) return t("Just now", "همین حالا");
    if (minutes < 60) return t(`${minutes} min ago`, `${minutes} دقیقه پیش`);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t(`${hours} h ago`, `${hours} ساعت پیش`);
    const days = Math.floor(hours / 24);
    return t(`${days} d ago`, `${days} روز پیش`);
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
  const priceChanges = approvals.filter(
    (item) => item.type === "price_change",
  ).length;
  const newProducts = approvals.filter(
    (item) => item.type === "new_product",
  ).length;
  const lowerPrices = alerts.filter(
    (item) => item.type === "lower_price",
  ).length;
  const conflicts = alerts.filter(
    (item) => item.type === "price_conflict",
  ).length;
  const kpis = [
    {
      label: t("Approvals waiting", "تأییدهای در انتظار"),
      value: approvals.length + pendingSaleRequests.length,
      detail: `${translateCount("{{count}} price change", "{{count}} price changes", "{{count}} تغییر قیمت", "{{count}} تغییر قیمت", priceChanges, lang)} · ${translateCount("{{count}} new product", "{{count}} new products", "{{count}} محصول جدید", "{{count}} محصول جدید", newProducts, lang)}`,
      page: "approvals",
      icon: ClipboardCheck,
    },
    {
      label: t("Open alerts", "هشدارهای باز"),
      value: alerts.length,
      detail: `${translateCount("{{count}} lower price", "{{count}} lower prices", "{{count}} کاهش قیمت", "{{count}} کاهش قیمت", lowerPrices, lang)} · ${translateCount("{{count}} conflict", "{{count}} conflicts", "{{count}} اختلاف", "{{count}} اختلاف", conflicts, lang)}`,
      page: "alerts",
      icon: Bell,
    },
    {
      label: t("Open shorts", "کسری‌های باز"),
      value: shortCount,
      detail: t("Items waiting for delivery", "کالاهای در انتظار تحویل"),
      page: "invoices",
      icon: PackageMinus,
    },
    {
      label: t("Expiring soon", "انقضای نزدیک"),
      value: expiryCount,
      detail: t(
        "Within each product's reminder window",
        "در بازهٔ یادآوری هر محصول",
      ),
      page: "expiry",
      icon: CalendarClock,
    },
  ];

  return (
    <>
      <PageHeader
        title={t(
          `${configuredRoleLabel(state.config.roles, "manager", "en")} dashboard`,
          `داشبورد ${configuredRoleLabel(state.config.roles, "manager", "fa")}`,
        )}
        description={t(
          "Your branch priorities, approvals, and recent activity.",
          "اولویت‌های شعبه، تأییدها و فعالیت اخیر.",
        )}
        actions={
          <Button onClick={() => navigate("approvals")}>
            {t("Review approvals", "بررسی تأییدها")}
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
      <div className="dashboard-layout">
        <div className="dashboard-main">
          <div className="dashboard-kpis">
            {kpis.map((item, index) => (
              <button
                type="button"
                key={item.page}
                className={`kpi-card ${index % 2 === 0 ? "kpi-accent" : "kpi-charcoal"}`}
                onClick={() => navigate(item.page)}
                aria-label={`${item.label}: ${item.value}`}
              >
                <span className="kpi-label">{item.label}</span>
                <span className="kpi-icon">
                  <item.icon size={20} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <strong className="kpi-value" dir="ltr">
                  {item.value}
                </strong>
                <span className="kpi-detail" title={item.detail}>
                  {item.detail}
                </span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.5}
                  className="directional kpi-arrow"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <div className="dashboard-row">
            <Card
              title={t("Approvals queue", "صف تأییدها")}
              className="dashboard-approvals"
            >
              {approvals.length === 0 && pendingSaleRequests.length === 0 ? (
                <EmptyState>
                  {t("No approvals waiting.", "تأییدی در انتظار نیست.")}
                </EmptyState>
              ) : (
                <div className="dashboard-queue">
                  <SaleRequestCards compact />
                  {approvals.slice(0, 6).map((item) => {
                    if (item.type === "new_supplier")
                      return (
                        <SupplierApproval
                          key={item.id}
                          approval={item}
                          compact
                        />
                      );
                    const product = state.products.find(
                      (value) =>
                        value.company_id === context.company_id &&
                        value.code === item.product_code,
                    );
                    if (!product) return null;
                    const approved =
                      approvalPrices.find((row) => row.id === item.id)
                        ?.regular_price ?? null;
                    const inline =
                      !item.manual_override &&
                      (item.type === "new_product" ||
                        item.type === "price_change");
                    return (
                      <div
                        className={`dashboard-queue-row list-box${inline ? "" : " has-review-action"}`}
                        key={item.id}
                      >
                        <div className="dashboard-queue-product">
                          {productLabel(item.product_code)}
                          <span className="muted">
                            <bdi>{item.product_code}</bdi>
                          </span>
                        </div>
                        <Badge
                          tone={
                            item.type === "margin_review" ||
                            item.type === "barcode_conflict"
                              ? "danger"
                              : "info"
                          }
                        >
                          {approvalType(item)}
                        </Badge>
                        <span className="dashboard-price-change">
                          <ManualPricePill
                            product={product}
                            branch={item.branch}
                          />
                          <span>
                            {t("Old", "قبلی")}{" "}
                            {approved !== null && approved !== undefined ? (
                              <Money value={approved} />
                            ) : (
                              <span className="muted approval-missing-price">
                                <span
                                  title={t(
                                    "No approved price yet",
                                    "هنوز قیمت تأییدشده ندارد",
                                  )}
                                >
                                  —
                                </span>
                              </span>
                            )}
                          </span>
                          <span>
                            {t("New", "جدید")}{" "}
                            {item.proposed_price?.trim() ? (
                              <Money value={item.proposed_price} />
                            ) : (
                              <span
                                className="muted"
                                title={t("Pending", "در انتظار")}
                              >
                                —
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="dashboard-queue-branch muted">
                          {branchName(item.branch)}
                          {item.applies_after_sale && (
                            <small className="dashboard-after-sale-note">
                              {t(
                                "Applies after the sale",
                                "پس از تخفیف اعمال می‌شود",
                              )}
                            </small>
                          )}
                        </span>
                        <div className="dashboard-inline-actions">
                          {inline ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => openPreview(item, "approve")}
                              >
                                {t("Approve", "تأیید")}
                              </Button>
                              <Menu
                                label={t("More", "بیشتر")}
                                iconOnly
                                icon={
                                  <MoreHorizontal
                                    size={20}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />
                                }
                              >
                                <MenuItem
                                  className="is-destructive"
                                  onClick={() => openPreview(item, "reject")}
                                >
                                  {t("Reject", "رد کردن")}
                                </MenuItem>
                              </Menu>
                            </>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate("approvals")}
                            >
                              {t("Review", "بررسی")}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {approvals.length > 6 && (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("approvals")}
                    >
                      {t("View all approvals", "مشاهده همه تأییدها")}
                    </Button>
                  )}
                </div>
              )}
            </Card>
            <Card title={t("Alerts", "هشدارها")} className="dashboard-alerts">
              {alerts.length === 0 ? (
                <EmptyState>
                  {t("No pending alerts.", "هشداری در انتظار نیست.")}
                </EmptyState>
              ) : (
                <div className="dashboard-alert-list">
                  {alerts.slice(0, 5).map((item) => (
                    <DashboardListRow
                      key={item.id}
                      title={
                        item.product_code ? (
                          <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                            <UnitText>
                              {productName(item.product_code)}
                            </UnitText>
                          </bdi>
                        ) : (
                          t("Invoice", "فاکتور")
                        )
                      }
                      secondary={
                        <>
                          {item.supplier && (
                            <>
                              <LtrText>{item.supplier}</LtrText> ·{" "}
                            </>
                          )}
                          {branchName(item.branch)}
                          {item.type.startsWith("sale_") && (
                            <span className="dashboard-alert-cost">
                              {alertType(item.type)}
                            </span>
                          )}
                          {item.previous_cost && item.new_cost && (
                            <span className="dashboard-alert-cost">
                              {t("Old cost", "هزینه قبلی")}{" "}
                              <Money value={item.previous_cost} /> ·{" "}
                              {t("New cost", "هزینه جدید")}{" "}
                              <Money value={item.new_cost} />
                            </span>
                          )}
                        </>
                      }
                      pill={
                        <Badge
                          tone={
                            item.type === "date_reminder"
                              ? (
                                  item.date
                                    ? item.date < today
                                    : (item.days_left ?? 0) < 0
                                )
                                ? "danger"
                                : "pending"
                              : item.type === "lower_price" ||
                                  item.type === "other_supplier" ||
                                  item.type.startsWith("sale_")
                                ? "pending"
                                : "danger"
                          }
                        >
                          {item.type === "price_conflict"
                            ? t("Conflict", "اختلاف")
                            : item.type.startsWith("sale_")
                              ? t("Pending", "در انتظار")
                              : alertType(item.type)}
                        </Badge>
                      }
                      action={
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate("alerts")}
                        >
                          {t("Review", "بررسی")}
                          <ArrowRight
                            size={16}
                            className="directional"
                            aria-hidden="true"
                          />
                        </Button>
                      }
                    />
                  ))}
                  {alerts.length > 5 && (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("alerts")}
                    >
                      {t("View all alerts", "مشاهده همه هشدارها")}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
          <div className="dashboard-row">
            <Card
              title={t("Recent invoices", "فاکتورهای اخیر")}
              className="dashboard-invoices"
            >
              {recentInvoices.length === 0 ? (
                <EmptyState
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => navigate("invoices")}
                    >
                      {t("Receive an invoice", "دریافت فاکتور")}
                    </Button>
                  }
                >
                  {t(
                    "No invoices. Receive an invoice to get started.",
                    "فاکتوری نیست. برای شروع یک فاکتور دریافت کنید.",
                  )}
                </EmptyState>
              ) : (
                <DataTable
                  phoneList={{
                    name: "supplier",
                    value: "status",
                    secondary: ["invoice", "branch", "date"],
                  }}
                  columns={[
                    {
                      key: "invoice",
                      width: 112,
                      priority: 1,
                      required: true,
                      mobilePrimary: true,
                      minWidth: 112,
                    },
                    { key: "supplier", width: 240, priority: 3, minWidth: 240 },
                    { key: "branch", width: 112, priority: 5, minWidth: 112 },
                    { key: "date", width: 128, priority: 4, minWidth: 128 },
                    { key: "status", width: 112, priority: 2, minWidth: 112 },
                    { key: "actions", actions: true, width: 60, priority: 0 },
                  ]}
                >
                  <thead>
                    <tr>
                      <th>{t("Invoice", "فاکتور")}</th>
                      <th>{t("Supplier", "تأمین‌کننده")}</th>
                      <th>{t("Branch", "شعبه")}</th>
                      <th>{t("Date", "تاریخ")}</th>
                      <th>{t("Status", "وضعیت")}</th>
                      <th>{t("Action", "عملیات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        data-row-href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                      >
                        <td>
                          <LtrText className="dashboard-invoice-reference">
                            {invoice.supplier_invoice_number || "—"}
                          </LtrText>
                        </td>
                        <td>
                          <LtrText>{invoice.supplier}</LtrText>
                        </td>
                        <td>{branchName(invoice.branch)}</td>
                        <td>
                          <DateText value={invoice.invoice_date} />
                        </td>
                        <td>
                          <Badge
                            tone={
                              invoice.status === "posted"
                                ? "approved"
                                : invoice.status === "draft"
                                  ? "neutral"
                                  : "progress"
                            }
                          >
                            {invoiceStatus(invoice.status)}
                          </Badge>
                        </td>
                        <td>
                          <TableRowLink
                            href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                            aria-label={t("View", "مشاهده")}
                            onClick={() =>
                              navigate(
                                `invoices?id=${encodeURIComponent(invoice.id)}`,
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
            <Card className="dashboard-returns">
              <div className="dashboard-card-header">
                <h2>{t("Returns", "مرجوعی‌ها")}</h2>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => navigate("returns")}
                >
                  {t("View all returns", "مشاهده همه مرجوعی‌ها")}
                  <ArrowRight
                    size={16}
                    className="directional"
                    aria-hidden="true"
                  />
                </Button>
              </div>
              {openReturns.length === 0 ? (
                <EmptyState>
                  {t("No open returns.", "مرجوعی بازی نیست.")}
                </EmptyState>
              ) : (
                <div className="dashboard-return-list">
                  {openReturns.slice(0, 5).map((item) => {
                    const credit = returnCredits.some(
                      (record) => record.id === item.id,
                    );
                    return (
                      <DashboardListRow
                        key={item.id}
                        title={<LtrText>{item.supplier}</LtrText>}
                        secondary={
                          <>
                            {branchName(item.branch)} ·{" "}
                            {item.lines.map((line, index) => (
                              <span key={`${line.product_code}:${index}`}>
                                <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                                  <UnitText>
                                    {productName(line.product_code)}
                                  </UnitText>
                                </bdi>
                                {index < item.lines.length - 1 ? "، " : ""}
                              </span>
                            ))}
                          </>
                        }
                        pill={
                          <Badge
                            tone={
                              credit
                                ? "pending"
                                : item.status === "partially_resolved"
                                  ? "progress"
                                  : "info"
                            }
                          >
                            {credit
                              ? t("Waiting for credit", "در انتظار بستانکاری")
                              : item.status === "partially_resolved"
                                ? t("Partially resolved", "بخشی حل‌شده")
                                : t("Open", "باز")}
                          </Badge>
                        }
                        action={
                          <TableRowLink
                            href={`#return?id=${encodeURIComponent(item.id)}`}
                            aria-label={t("View", "مشاهده")}
                            onClick={() =>
                              navigate(
                                `return?id=${encodeURIComponent(item.id)}`,
                              )
                            }
                          />
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
          <Card
            title={t("Supplier balances", "مانده تأمین‌کنندگان")}
            className="dashboard-balances"
          >
            {balances.length === 0 ? (
              <EmptyState>
                {t(
                  "No supplier balances. Post an invoice to start the ledger.",
                  "مانده تأمین‌کننده‌ای نیست. برای شروع دفتر، یک فاکتور ثبت کنید.",
                )}
              </EmptyState>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "supplier",
                    width: "34%",
                    required: true,
                    mobilePrimary: true,
                    priority: 1,
                    minWidth: 240,
                  },
                  {
                    key: "balance",
                    width: "18%",
                    align: "end",
                    priority: 2,
                    minWidth: 128,
                  },
                  {
                    key: "open_invoices",
                    width: "15%",
                    align: "end",
                    priority: 3,
                    minWidth: 128,
                  },
                  {
                    key: "overdue",
                    width: "18%",
                    align: "end",
                    priority: 4,
                    minWidth: 128,
                  },
                  { key: "actions", width: 60, actions: true, priority: 0 },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Supplier", "تأمین‌کننده")}</th>
                    <th className="numeric">{t("Balance", "مانده")}</th>
                    <th className="numeric">
                      {t("Open invoices", "فاکتورهای باز")}
                    </th>
                    <th className="numeric">{t("Overdue", "سررسید گذشته")}</th>
                    <th>{t("Action", "عملیات")}</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((item) => (
                    <tr key={item.supplier} data-row-href="#payables">
                      <td>
                        <LtrText>{item.supplier}</LtrText>
                      </td>
                      <td className="numeric">
                        <Money value={item.balance} />
                      </td>
                      <td className="numeric">
                        <bdi>{item.outstandingCount}</bdi>
                      </td>
                      <td className="numeric">
                        <Money value={item.overdue} />
                      </td>
                      <td>
                        <TableRowLink
                          href="#payables"
                          aria-label={t("View", "مشاهده")}
                          onClick={() => navigate("payables")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
          <div className="dashboard-row dashboard-row-halves">
            <Card
              title={t(
                "Purchases by supplier, this month",
                "خرید از تأمین‌کنندگان، این ماه",
              )}
              className="dashboard-purchases"
            >
              {purchases.suppliers.length === 0 ? (
                <EmptyState>
                  {t("No purchases this month.", "این ماه خریدی ثبت نشده است.")}
                </EmptyState>
              ) : (
                <div className="purchase-bars" role="list">
                  {purchases.suppliers.map((item) => {
                    const max = Decimal.max(
                      ...purchases.suppliers.map((row) => row.amount),
                      1,
                    );
                    const width = Decimal.max(
                      0,
                      new Decimal(item.amount).div(max).times(100),
                    ).toNumber();
                    return (
                      <div
                        className="purchase-bar-row"
                        key={item.supplier}
                        role="listitem"
                      >
                        <div className="row-between">
                          <LtrText>{item.supplier}</LtrText>
                          <Money value={item.amount} />
                        </div>
                        <div className="purchase-bar-track" aria-hidden="true">
                          <span style={{ inlineSize: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="chart-axis-label muted">
                {t("Net purchases", "خرید خالص")} ·{" "}
                <LtrText>{state.config.company.currency}</LtrText>
              </p>
            </Card>
            <Card
              title={t("Purchases, last 8 weeks", "خرید، ۸ هفته گذشته")}
              className="dashboard-purchases"
            >
              {purchases.weeks.every((week) => week.amount === "0.00") ? (
                <EmptyState>
                  {t(
                    "No purchases in the last 8 weeks.",
                    "در ۸ هفته گذشته خریدی ثبت نشده است.",
                  )}
                </EmptyState>
              ) : (
                (() => {
                  const max = Decimal.max(
                    ...purchases.weeks.map((week) => week.amount),
                    1,
                  );
                  const min = Decimal.min(
                    ...purchases.weeks.map((week) => week.amount),
                    0,
                  );
                  const range = max.minus(min);
                  const points = purchases.weeks
                    .map(
                      (week, index) =>
                        `${30 + index * 52},${146 - new Decimal(week.amount).minus(min).div(range).times(126).toNumber()}`,
                    )
                    .join(" ");
                  return (
                    <>
                      <div className="purchase-line-chart">
                        <svg
                          viewBox="0 0 424 172"
                          role="img"
                          aria-label={t(
                            "Net purchases by week",
                            "خرید خالص در هر هفته",
                          )}
                        >
                          <line
                            x1="30"
                            y1="146"
                            x2="394"
                            y2="146"
                            className="chart-baseline"
                          />
                          <polygon
                            points={`30,146 ${points} 394,146`}
                            className="purchase-area"
                          />
                          <polyline points={points} className="purchase-line" />
                          {purchases.weeks.map((week, index) => (
                            <circle
                              key={week.start}
                              cx={30 + index * 52}
                              cy={
                                146 -
                                new Decimal(week.amount)
                                  .minus(min)
                                  .div(range)
                                  .times(126)
                                  .toNumber()
                              }
                              r="3"
                              className="purchase-point"
                              tabIndex={0}
                              aria-label={`${week.start} – ${week.end}: ${formatMoney(week.amount, { currency: state.config.company.currency })}`}
                              onMouseEnter={() => setHoveredPurchaseWeek(index)}
                              onMouseLeave={() => setHoveredPurchaseWeek(null)}
                              onFocus={() => setHoveredPurchaseWeek(index)}
                              onBlur={() => setHoveredPurchaseWeek(null)}
                            />
                          ))}
                        </svg>
                        {hoveredPurchaseWeek !== null && (
                          <div
                            className="purchase-chart-tooltip"
                            role="tooltip"
                          >
                            <DateText
                              value={purchases.weeks[hoveredPurchaseWeek].start}
                            />{" "}
                            –{" "}
                            <DateText
                              value={purchases.weeks[hoveredPurchaseWeek].end}
                            />
                            <strong>
                              <Money
                                value={
                                  purchases.weeks[hoveredPurchaseWeek].amount
                                }
                              />
                            </strong>
                          </div>
                        )}
                      </div>
                      <div className="purchase-week-labels">
                        {[0, 2, 4, 7].map((index) => (
                          <DateText
                            key={index}
                            value={purchases.weeks[index].start}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()
              )}
              <p className="chart-axis-label muted">
                {t("Net purchases", "خرید خالص")} ·{" "}
                <LtrText>{state.config.company.currency}</LtrText>
              </p>
            </Card>
          </div>
          <div className="dashboard-row dashboard-row-halves">
            <Card title={t("Arrived this week", "دریافتی‌های این هفته")}>
              {arrivals.length === 0 ? (
                <EmptyState>
                  {t(
                    "No deliveries this week.",
                    "این هفته تحویلی ثبت نشده است.",
                  )}
                </EmptyState>
              ) : (
                arrivals.slice(0, 6).map((item) => {
                  const product = state.products.find(
                    (row) =>
                      row.company_id === context.company_id &&
                      row.code === item.product_code,
                  );
                  return (
                    <DashboardListRow
                      key={item.id}
                      title={
                        product ? (
                          <ProductName product={product} />
                        ) : (
                          <LtrText>{item.product_code}</LtrText>
                        )
                      }
                      secondary={
                        <>
                          {branchName(item.branch)} ·{" "}
                          <DateText value={item.date} /> ·{" "}
                          <LtrText className="dashboard-invoice-reference">
                            {item.invoice_number}
                          </LtrText>
                        </>
                      }
                      pill={
                        <Badge tone="info">
                          {translateCount(
                            "{{count}} unit",
                            "{{count}} units",
                            "{{count}} واحد",
                            "{{count}} واحد",
                            item.units,
                            lang,
                          )}
                        </Badge>
                      }
                      action={
                        <TableRowLink
                          href={`#received?product=${encodeURIComponent(item.product_code)}`}
                          aria-label={t("View", "مشاهده")}
                          onClick={() =>
                            navigate(
                              `received?product=${encodeURIComponent(item.product_code)}`,
                            )
                          }
                        />
                      }
                    />
                  );
                })
              )}
            </Card>
            <Card
              title={t("Price changes this week", "تغییر قیمت‌های این هفته")}
            >
              {weeklyChanges.length === 0 ? (
                <EmptyState>
                  {t(
                    "No price changes this week.",
                    "این هفته تغییری در قیمت ثبت نشده است.",
                  )}
                </EmptyState>
              ) : (
                weeklyChanges.slice(0, 6).map((item) => {
                  const product = state.products.find(
                    (entry) =>
                      entry.company_id === context.company_id &&
                      entry.code === item.product_code,
                  );
                  const price = item.regular_price;
                  return (
                    <DashboardListRow
                      key={item.id}
                      title={
                        <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                          <UnitText>{productName(item.product_code!)}</UnitText>
                        </bdi>
                      }
                      secondary={
                        <>
                          {demoUserLabel(item.by, lang)} ·{" "}
                          {branchName(item.branch)} ·{" "}
                          <DateText
                            value={companyDate(state.config, new Date(item.at))}
                          />
                          {price && (
                            <>
                              {" "}
                              · <Money value={price} />
                              {product && (
                                <ManualPricePill
                                  product={product}
                                  branch={
                                    item.branch === "all" ? branch : item.branch
                                  }
                                />
                              )}
                            </>
                          )}
                        </>
                      }
                      pill={
                        <Badge tone="approved">
                          {t("Approved", "تأییدشده")}
                        </Badge>
                      }
                      action={
                        <TableRowLink
                          href={`#product?code=${item.product_code}`}
                          aria-label={t("View", "مشاهده")}
                          onClick={() =>
                            navigate(`product?code=${item.product_code}`)
                          }
                        />
                      }
                    />
                  );
                })
              )}
            </Card>
          </div>
        </div>
        <aside
          className="dashboard-aside"
          aria-label={t("Notes and activity", "یادداشت‌ها و فعالیت")}
        >
          <PriceUpdatesDashboardCard />
          <Card
            title={t(
              `Notes for ${configuredRoleLabel(state.config.roles, "manager", "en")}`,
              `یادداشت‌های ${configuredRoleLabel(state.config.roles, "manager", "fa")}`,
            )}
          >
            {notes.length === 0 ? (
              <EmptyState>
                {t(
                  `No open notes for the ${configuredRoleLabel(state.config.roles, "manager", "en")}.`,
                  `یادداشت بازی برای ${configuredRoleLabel(state.config.roles, "manager", "fa")} نیست.`,
                )}
              </EmptyState>
            ) : (
              <div className="dashboard-note-list">
                {notes.slice(0, 5).map((item) => (
                  <DashboardListRow
                    key={item.id}
                    title={noteText(item)}
                    secondary={
                      <>
                        {demoUserLabel(item.by, lang)} ·{" "}
                        {branchName(item.branch)} ·{" "}
                        <time
                          dateTime={item.created_at}
                          title={companyTimestamp(
                            state.config,
                            item.created_at,
                          )}
                        >
                          {relativeTime(item.created_at)}
                        </time>
                      </>
                    }
                    pill={
                      <Badge tone="info">
                        {item.status === "open"
                          ? t("Open", "باز")
                          : t("Seen", "دیده‌شده")}
                      </Badge>
                    }
                    action={
                      <TableRowLink
                        href="#notes"
                        aria-label={t("View", "مشاهده")}
                        onClick={() => navigate("notes")}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </Card>
          <Card title={t("Activity", "فعالیت")} id="recent-activity">
            {activity.length === 0 ? (
              <EmptyState>
                {t(
                  "No recent activity. Your actions appear here.",
                  "فعالیت اخیری نیست. کارهای شما اینجا ظاهر می‌شوند.",
                )}
              </EmptyState>
            ) : (
              <ol className="dashboard-activity-list">
                {activity.slice(0, 8).map((item) => (
                  <li className="dashboard-activity-item" key={item.id}>
                    <span className="initials-avatar" aria-hidden="true">
                      {initials(item.by)}
                    </span>
                    <div>
                      <strong>{actionLabel(item.action)}</strong>
                      {item.product_code && (
                        <span>
                          <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                            <UnitText>
                              {productName(item.product_code)}
                            </UnitText>
                          </bdi>
                        </span>
                      )}
                      <span className="muted">
                        {demoUserLabel(item.by, lang)} ·{" "}
                        {branchName(item.branch)}
                      </span>
                      <time
                        className="muted"
                        dateTime={item.at}
                        title={companyTimestamp(state.config, item.at)}
                      >
                        {relativeTime(item.at)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
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
    </>
  );
}

export default Dashboard;
