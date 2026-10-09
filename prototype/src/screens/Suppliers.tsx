import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { ArrowLeft, Search } from "lucide-react";
import { useDemo } from "../store";
import {
  configuredBranches,
  branchLabel as configuredBranchLabel,
} from "../settings";
import {
  supplierRecords,
  supplierMatches,
  deactivateSupplier,
} from "../supplier-editor";
import { SupplierEditor } from "./SupplierEditor";
import SupplierItems from "./SupplierItems";
import { supplierItems } from "../supplier-items";
import Received from "./Received";
import { translateCount } from "../i18n";
import {
  supplierPage,
  suppliersOverview,
  type SupplierOverviewRow,
} from "../suppliers";
import {
  DateText,
  demoUserLabel,
  LtrText,
  Money,
  ProductName,
} from "../presentation";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterToolbar,
  KpiCard,
  PageHeader,
  Select,
  Tabs,
  ConfirmDialog,
} from "../ui";
import type { OperationsContext } from "../operations";
import "./suppliers-a2.css";

type Tab =
  | "overview"
  | "invoices"
  | "products"
  | "received"
  | "returns"
  | "shorts"
  | "alerts"
  | "payments"
  | "notes";
type SortKey =
  | "name"
  | "status"
  | "last_delivery"
  | "deliveries_this_month"
  | "open_returns"
  | "open_shorts"
  | "payment_terms"
  | "sales_rep_name"
  | "balance"
  | "overdue"
  | "next_due_date";

export default function Suppliers() {
  const { state, role, branch, setBranch, lang, user, navigate, t, update } =
    useDemo();
  const branches = configuredBranches(state.config);
  const [editor, setEditor] = useState<"new" | "edit" | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: "name",
    descending: false,
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [name, setName] = useState(() =>
    new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("name"),
  );
  useEffect(() => {
    const changed = () => {
      setName(
        new URLSearchParams(window.location.hash.split("?")[1] ?? "").get(
          "name",
        ),
      );
      setTab("overview");
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? "",
  };
  const supervisor = role === "supervisor";
  if (role !== "supervisor" && role !== "floor_worker")
    return (
      <EmptyState>
        {t(
          "You do not have access to Suppliers.",
          "به تأمین‌کنندگان دسترسی ندارید.",
        )}
      </EmptyState>
    );
  const overview = suppliersOverview(state, context);
  const current = name
    ? overview.find(
        (supplier) =>
          supplier.name === name || supplier.previous_names?.includes(name),
      )
    : undefined;
  const detail = current
    ? supplierPage(state, context, current.name)
    : undefined;
  const openSupplier = (supplier: string) => {
    setTab("overview");
    navigate(`suppliers?name=${encodeURIComponent(supplier)}`);
  };
  const money = (value: string) => (
    <Money value={value} currency={state.config.company.currency} />
  );
  const branchName = (value: string) =>
    configuredBranchLabel(state.config, value, lang);
  const supplierStatus = (value: string) =>
    value === "proposed"
      ? t("Proposed", "پیشنهادی")
      : t("Confirmed", "تأییدشده");
  const returnStatus = (value: string) =>
    ({
      open: t("Open", "باز"),
      picked_up: t("Picked up", "جمع‌آوری‌شده"),
      partially_resolved: t("Partially resolved", "تا حدی حل‌شده"),
      resolved: t("Resolved", "حل‌شده"),
      cancelled: t("Cancelled", "لغوشده"),
      cancellation_review: t("Needs review", "نیاز به بررسی"),
      claim_pending: t("Pending", "در انتظار"),
    })[value] ?? value;
  const invoiceStatus = (value: string) =>
    value === "posted" ? t("Posted", "ثبت‌شده") : t("Draft", "پیش‌نویس");
  const compareValue = (supplier: SupplierOverviewRow, key: SortKey) => {
    if (key === "balance" || key === "overdue")
      return supplier.financial?.[key] ?? "0.00";
    if (key === "next_due_date") return supplier.financial?.next_due_date ?? "";
    return supplier[key] ?? "";
  };
  const rows = overview
    .filter((supplier) =>
      supplier.name.toLowerCase().includes(query.toLowerCase().trim()),
    )
    .filter((supplier) =>
      filters.every((filter) =>
        filter === "overdue"
          ? !!supplier.financial &&
            new Decimal(supplier.financial.overdue).gt(0)
          : filter === "returns"
            ? supplier.open_returns > 0
            : filter === "shorts"
              ? supplier.open_shorts > 0
              : supplier.status === "proposed",
      ),
    )
    .sort((a, b) => {
      const left = compareValue(a, sort.key);
      const right = compareValue(b, sort.key);
      const result =
        sort.key === "balance" || sort.key === "overdue"
          ? new Decimal(left).cmp(right)
          : typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
      return sort.descending ? -result : result;
    });
  const sortHeader = (key: SortKey, en: string, fa: string) => (
    <button
      className="supplier-sort"
      type="button"
      onClick={() =>
        setSort({
          key,
          descending: sort.key === key ? !sort.descending : false,
        })
      }
      aria-label={t(`Sort by ${en.toLowerCase()}`, `مرتب‌سازی بر اساس ${fa}`)}
    >
      {t(en, fa)}
      {sort.key === key ? (sort.descending ? " ↓" : " ↑") : ""}
    </button>
  );

  if (!name)
    return (
      <>
        <PageHeader
          title={t("Suppliers", "تأمین‌کنندگان")}
          description={t(
            "Deliveries, returns and supplier details.",
            "تحویل‌ها، مرجوعی‌ها و اطلاعات تأمین‌کنندگان.",
          )}
          actions={
            supervisor ? (
              <Button onClick={() => setEditor("new")}>
                {t("Add supplier", "افزودن تأمین‌کننده")}
              </Button>
            ) : undefined
          }
        />
        {editor === "new" && (
          <SupplierEditor
            onClose={() => setEditor(null)}
            onSaved={(record) => openSupplier(record.name)}
          />
        )}
        <Card className="suppliers-overview">
          <FilterToolbar
            className="suppliers-toolbar"
            aria-label={t("Supplier filters", "فیلتر تأمین‌کنندگان")}
            count={
              <>
                {translateCount(
                  "{{count}} supplier",
                  "{{count}} suppliers",
                  "{{count}} تأمین‌کننده",
                  "{{count}} تأمین‌کننده",
                  rows.length,
                  lang,
                )}
              </>
            }
            search={
              <label className="supplier-search">
                <Search size={18} aria-hidden="true" />
                <input
                  aria-label={t("Search suppliers", "جست‌وجوی تأمین‌کنندگان")}
                  placeholder={t("Search suppliers", "جست‌وجوی تأمین‌کنندگان")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            }
          >
            {supervisor ? (
              <Select
                aria-label={t("Supplier branch", "شعبه تأمین‌کننده")}
                value={branch}
                onChange={(value) => setBranch(value as typeof branch)}
                options={[
                  { value: "all", label: t("All branches", "همهٔ شعب") },
                  ...branches.map((item) => ({
                    value: item,
                    label: branchName(item),
                  })),
                ]}
              />
            ) : (
              <span className="supplier-branch-pill">{branchName(branch)}</span>
            )}
            {[
              ...(supervisor ? [["overdue", "Overdue", "سررسید گذشته"]] : []),
              ["returns", "Open returns", "مرجوعی‌های باز"],
              ["shorts", "Open shorts", "کسری‌های باز"],
              ["proposed", "Waiting for confirmation", "در انتظار تأیید"],
            ].map(([key, en, fa]) => (
              <button
                type="button"
                key={key}
                className="supplier-filter-chip"
                aria-pressed={filters.includes(key)}
                onClick={() =>
                  setFilters((previous) =>
                    previous.includes(key)
                      ? previous.filter((item) => item !== key)
                      : [...previous, key],
                  )
                }
              >
                {t(en, fa)}
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilters([]);
              }}
            >
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          </FilterToolbar>
          <DataTable
            className={
              supervisor ? "suppliers-table supervisor" : "suppliers-table"
            }
            columns={[
              { width: "190px" },
              { width: "95px" },
              { width: "105px" },
              { width: "95px", align: "end" },
              { width: "80px", align: "end" },
              { width: "80px", align: "end" },
              { width: "90px" },
              { width: "140px" },
              ...(supervisor
                ? [
                    { width: "85px", align: "end" as const },
                    { width: "85px", align: "end" as const },
                    { width: "105px" },
                  ]
                : []),
              { width: "70px", actions: true },
            ]}
          >
            <thead>
              <tr>
                <th>{sortHeader("name", "Supplier", "تأمین‌کننده")}</th>
                <th>{sortHeader("status", "Status", "وضعیت")}</th>
                <th>
                  {sortHeader("last_delivery", "Last delivery", "آخرین تحویل")}
                </th>
                <th>
                  {sortHeader(
                    "deliveries_this_month",
                    "Deliveries this month",
                    "تحویل‌های این ماه",
                  )}
                </th>
                <th>
                  {sortHeader("open_returns", "Open returns", "مرجوعی‌های باز")}
                </th>
                <th>
                  {sortHeader("open_shorts", "Open shorts", "کسری‌های باز")}
                </th>
                <th>
                  {sortHeader("payment_terms", "Payment terms", "شرایط پرداخت")}
                </th>
                <th>
                  {sortHeader(
                    "sales_rep_name",
                    "Sales rep and phone",
                    "نماینده فروش و تلفن",
                  )}
                </th>
                {supervisor && (
                  <>
                    <th>{sortHeader("balance", "Balance", "مانده")}</th>
                    <th>{sortHeader("overdue", "Overdue", "سررسید گذشته")}</th>
                    <th>
                      {sortHeader(
                        "next_due_date",
                        "Next due date",
                        "سررسید بعدی",
                      )}
                    </th>
                  </>
                )}
                <th>{t("Actions", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => (
                <tr
                  key={supplier.name}
                  tabIndex={0}
                  className="supplier-overview-row"
                  onClick={() => openSupplier(supplier.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") openSupplier(supplier.name);
                  }}
                >
                  <td>
                    <LtrText>{supplier.name}</LtrText>
                  </td>
                  <td>
                    <Badge
                      tone={
                        supplier.status === "confirmed" ? "approved" : "pending"
                      }
                    >
                      {supplierStatus(supplier.status)}
                    </Badge>
                    {supplier.active === false && (
                      <Badge tone="neutral">
                        {t("Archived", "بایگانی‌شده")}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <DateText value={supplier.last_delivery} />
                  </td>
                  <td>{supplier.deliveries_this_month}</td>
                  <td>{supplier.open_returns}</td>
                  <td>{supplier.open_shorts}</td>
                  <td>
                    <LtrText>{supplier.payment_terms ?? "—"}</LtrText>
                  </td>
                  <td>
                    <LtrText>{supplier.sales_rep_name ?? "—"}</LtrText>
                    <small className="muted supplier-secondary">
                      <LtrText>{supplier.sales_rep_phone ?? "—"}</LtrText>
                    </small>
                  </td>
                  {supervisor && supplier.financial && (
                    <>
                      <td>{money(supplier.financial.balance)}</td>
                      <td>{money(supplier.financial.overdue)}</td>
                      <td>
                        <DateText value={supplier.financial.next_due_date} />
                      </td>
                    </>
                  )}
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        openSupplier(supplier.name);
                      }}
                    >
                      {t("View", "نمایش")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {rows.length === 0 && (
            <EmptyState>
              {t(
                "No suppliers match these filters.",
                "هیچ تأمین‌کننده‌ای با این فیلترها پیدا نشد.",
              )}
            </EmptyState>
          )}
        </Card>
      </>
    );
  if (!detail || !current)
    return (
      <>
        <Button variant="ghost" onClick={() => navigate("suppliers")}>
          {t("Back to Suppliers", "بازگشت به تأمین‌کنندگان")}
        </Button>
        <EmptyState>
          {t("Supplier not found.", "تأمین‌کننده پیدا نشد.")}
        </EmptyState>
      </>
    );
  const tabs = [
    ["overview", "Overview", "نمای کلی"],
    ["invoices", "Invoices", "فاکتورها"],
    ["products", "Supplier items", "کالاهای تأمین‌کننده"],
    ["received", "Received", "دریافت‌شده‌ها"],
    ["returns", "Returns and credits", "مرجوعی‌ها و اعتبارها"],
    ["shorts", "Shorts", "کسری‌ها"],
    ["alerts", "Price alerts", "هشدارهای قیمت"],
    ...(supervisor ? [["payments", "Payments", "پرداخت‌ها"]] : []),
    ["notes", "Notes", "یادداشت‌ها"],
  ];
  const effectiveTab = tab === "payments" && !supervisor ? "overview" : tab;
  return (
    <>
      <Button
        variant="ghost"
        className="supplier-back"
        onClick={() => navigate("suppliers")}
      >
        <ArrowLeft size={16} />
        {t("Back to Suppliers", "بازگشت به تأمین‌کنندگان")}
      </Button>
      <PageHeader
        title={<LtrText>{current.name}</LtrText>}
        description={t("Supplier details", "اطلاعات تأمین‌کننده")}
        actions={
          supervisor && current.id ? (
            <div className="actions">
              <Button variant="secondary" onClick={() => setEditor("edit")}>
                {t("Edit", "ویرایش")}
              </Button>
              {current.active !== false && (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDeactivate(true)}
                >
                  {t("Deactivate", "غیرفعال کردن")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
      {editor === "edit" && (
        <SupplierEditor
          supplier={supplierRecords(state).find(
            (record) =>
              record.company_id === context.company_id &&
              supplierMatches(record, current.name),
          )}
          onClose={() => setEditor(null)}
          onSaved={(record) => openSupplier(record.name)}
        />
      )}
      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title={t("Deactivate supplier", "غیرفعال کردن تأمین‌کننده")}
        description={t(
          "Keep all history and remove this supplier from new invoice choices.",
          "تاریخچه حفظ می‌شود و این تأمین‌کننده از گزینه‌های فاکتور جدید حذف خواهد شد.",
        )}
        confirmLabel={t("Deactivate supplier", "غیرفعال کردن تأمین‌کننده")}
        onConfirm={() =>
          update((draft) => deactivateSupplier(draft, context, current.id!))
        }
      />
      <Card className="supplier-header-card">
        <div className="supplier-header-line">
          <LtrText className="supplier-header-name">{current.name}</LtrText>
          <Badge tone={current.status === "confirmed" ? "approved" : "pending"}>
            {supplierStatus(current.status)}
          </Badge>
          {current.active === false && (
            <Badge tone="neutral">{t("Archived", "بایگانی‌شده")}</Badge>
          )}
        </div>
        <dl className="supplier-contact-grid">
          <div>
            <dt>{t("Phone", "تلفن")}</dt>
            <dd>
              <LtrText>{current.phone ?? "—"}</LtrText>
            </dd>
          </div>
          {current.address && (
            <div>
              <dt>{t("Address", "نشانی")}</dt>
              <dd>
                <bdi dir="auto">{current.address}</bdi>
              </dd>
            </div>
          )}
          {current.notes && (
            <div>
              <dt>{t("Notes", "یادداشت‌ها")}</dt>
              <dd>
                <bdi dir="auto">{current.notes}</bdi>
              </dd>
            </div>
          )}
          <div>
            <dt>{t("Email", "ایمیل")}</dt>
            <dd>
              <LtrText>{current.email ?? "—"}</LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Sales representative", "نماینده فروش")}</dt>
            <dd>
              <LtrText>{current.sales_rep_name ?? "—"}</LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Sales rep phone", "تلفن نماینده فروش")}</dt>
            <dd>
              <LtrText>{current.sales_rep_phone ?? "—"}</LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Payment terms", "شرایط پرداخت")}</dt>
            <dd>
              <LtrText>{current.payment_terms ?? "—"}</LtrText>
            </dd>
          </div>
        </dl>
      </Card>
      <div className="stats-grid supplier-kpis">
        <KpiCard
          label={t("Last delivery", "آخرین تحویل")}
          value={<DateText value={current.last_delivery} />}
          tone="accent"
        />
        <KpiCard
          label={t("Deliveries this month", "تحویل‌های این ماه")}
          value={current.deliveries_this_month}
          tone="charcoal"
        />
        <KpiCard
          label={t("Open returns", "مرجوعی‌های باز")}
          value={current.open_returns}
          tone="accent"
        />
        <KpiCard
          label={
            supervisor
              ? t("Balance", "مانده")
              : t("Open shorts", "کسری‌های باز")
          }
          value={
            supervisor && current.financial
              ? money(current.financial.balance)
              : current.open_shorts
          }
          tone="charcoal"
        />
      </div>
      <div className="supplier-tabs">
        <Tabs
          value={effectiveTab}
          onChange={(value) => setTab(value as Tab)}
          aria-label={t("Supplier sections", "بخش‌های تأمین‌کننده")}
          options={tabs.map(([value, en, fa]) => ({ value, label: t(en, fa) }))}
        />
      </div>
      <Card
        className="supplier-tab-card"
        title={
          tabs.find(([value]) => value === effectiveTab)
            ? t(
                tabs.find(([value]) => value === effectiveTab)![1],
                tabs.find(([value]) => value === effectiveTab)![2],
              )
            : ""
        }
      >
        {effectiveTab === "overview" && (
          <dl className="supplier-overview-facts">
            <div>
              <dt>{t("Branch", "شعبه")}</dt>
              <dd>{branchName(branch)}</dd>
            </div>
            <div>
              <dt>{t("Supplier items", "کالاهای تأمین‌کننده")}</dt>
              <dd>{supplierItems(state, context, current.name).length}</dd>
            </div>
            <div>
              <dt>{t("Open shorts", "کسری‌های باز")}</dt>
              <dd>{current.open_shorts}</dd>
            </div>
            {supervisor && current.financial && (
              <>
                <div>
                  <dt>{t("Overdue", "سررسید گذشته")}</dt>
                  <dd>{money(current.financial.overdue)}</dd>
                </div>
                <div>
                  <dt>{t("Next due date", "سررسید بعدی")}</dt>
                  <dd>
                    <DateText value={current.financial.next_due_date} />
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        {effectiveTab === "received" && (
          <Received supplier={current.name} embedded />
        )}
        {effectiveTab === "invoices" && (
          <DataTable
            columns={[
              { width: "180px" },
              { width: "125px" },
              { width: "120px" },
              { width: "80px", align: "end" },
              { width: "120px" },
              ...(supervisor
                ? [
                    { width: "125px", align: "end" as const },
                    { width: "125px", align: "end" as const },
                  ]
                : []),
              { width: "80px", actions: true },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Invoice", "فاکتور")}</th>
                <th>{t("Last delivery", "آخرین تحویل")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Items", "اقلام")}</th>
                <th>{t("Status", "وضعیت")}</th>
                {supervisor && (
                  <>
                    <th>{t("Total", "جمع")}</th>
                    <th>{t("Outstanding", "مانده پرداخت")}</th>
                  </>
                )}
                <th>{t("Actions", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <LtrText>{invoice.number}</LtrText>
                  </td>
                  <td>
                    <DateText value={invoice.received} />
                  </td>
                  <td>{branchName(invoice.branch)}</td>
                  <td>{invoice.items}</td>
                  <td>
                    <Badge tone="approved">
                      {invoiceStatus(invoice.status)}
                    </Badge>
                  </td>
                  {invoice.financial && (
                    <>
                      <td>{money(invoice.financial.total)}</td>
                      <td>{money(invoice.financial.outstanding)}</td>
                    </>
                  )}
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `invoices?id=${encodeURIComponent(invoice.id)}`,
                        )
                      }
                    >
                      {t("View", "نمایش")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {effectiveTab === "products" && (
          <SupplierItems
            supplier={current.name}
            editable={
              current.active !== false && current.status === "confirmed"
            }
          />
        )}
        {effectiveTab === "returns" && (
          <DataTable
            columns={[
              { width: "140px" },
              { width: "120px" },
              { width: "140px" },
              { width: "80px", align: "end" },
              { width: "170px" },
              ...(supervisor
                ? [{ width: "140px", align: "end" as const }]
                : []),
              { width: "80px", actions: true },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Return #", "مرجوعی شماره")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Created", "ایجادشده")}</th>
                <th>{t("Items", "اقلام")}</th>
                <th>{t("Status", "وضعیت")}</th>
                {supervisor && (
                  <th>{t("Credit or compensation", "اعتبار یا جبران")}</th>
                )}
                <th>{t("Actions", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.returns.map((record) => (
                <tr key={record.id}>
                  <td>
                    {t("Return", "مرجوعی")} <LtrText>#{record.number}</LtrText>
                  </td>
                  <td>{branchName(record.branch)}</td>
                  <td>
                    <DateText value={record.created_at} />
                  </td>
                  <td>{record.items}</td>
                  <td>
                    <Badge>{returnStatus(record.status)}</Badge>
                  </td>
                  {record.financial && (
                    <td>
                      {record.financial.compensation ? (
                        money(record.financial.compensation)
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(`return?id=${encodeURIComponent(record.id)}`)
                      }
                    >
                      {t("View", "نمایش")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {effectiveTab === "shorts" && (
          <DataTable
            columns={[
              { width: "260px" },
              { width: "110px" },
              { width: "160px" },
              { width: "120px" },
              { width: "100px", align: "end" },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Product", "کالا")}</th>
                <th>{t("Product Code", "کد کالا")}</th>
                <th>{t("Invoice", "فاکتور")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Short quantity", "تعداد کسری")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.shorts.map((short) => (
                <tr key={`${short.invoice_id}-${short.product_code}`}>
                  <td>
                    <ProductName product={short} language={lang} />
                  </td>
                  <td>
                    <LtrText>{short.product_code}</LtrText>
                  </td>
                  <td>
                    <LtrText>{short.invoice}</LtrText>
                  </td>
                  <td>{branchName(short.branch)}</td>
                  <td>{short.quantity}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {effectiveTab === "alerts" && (
          <DataTable
            columns={[
              { width: "260px" },
              { width: "120px" },
              { width: "200px" },
              { width: "150px" },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Product", "کالا")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Type", "نوع")}</th>
                <th>{t("Status", "وضعیت")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>
                    <ProductName product={alert} language={lang} />
                  </td>
                  <td>{branchName(alert.branch)}</td>
                  <td>
                    {
                      {
                        lower_price: t(
                          "Same-supplier lower price",
                          "قیمت پایین‌تر از همان تأمین‌کننده",
                        ),
                        price_conflict: t(
                          "Cross-branch price conflict",
                          "تعارض قیمت بین شعب",
                        ),
                        tax_discrepancy: t("Tax discrepancy", "اختلاف مالیات"),
                        barcode_conflict: t("Barcode conflict", "تعارض بارکد"),
                        other_supplier: t("Other supplier", "تأمین‌کننده دیگر"),
                        order_differences: t(
                          "Invoice and order differences",
                          "اختلاف‌های فاکتور و سفارش",
                        ),
                      }[alert.type]
                    }
                  </td>
                  <td>
                    <Badge>
                      {alert.status === "pending"
                        ? t("Pending", "در انتظار")
                        : alert.status === "resolved"
                          ? t("Resolved", "حل‌شده")
                          : t("Intentional", "عمدی")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {effectiveTab === "payments" && supervisor && (
          <DataTable
            columns={[
              { width: "140px" },
              { width: "140px" },
              { width: "220px" },
              { width: "140px" },
              { width: "130px", align: "end" },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Date", "تاریخ")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Reference", "مرجع")}</th>
                <th>{t("Cheque number", "شماره چک")}</th>
                <th>{t("Amount", "مبلغ")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments?.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <DateText value={payment.date} />
                  </td>
                  <td>{branchName(payment.branch)}</td>
                  <td>
                    <LtrText>{payment.reference}</LtrText>
                  </td>
                  <td>
                    <LtrText>{payment.cheque_number ?? "—"}</LtrText>
                  </td>
                  <td>{money(new Decimal(payment.amount).abs().toFixed(2))}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {effectiveTab === "notes" && (
          <div className="supplier-notes">
            {detail.notes.map((note) => (
              <article key={note.id}>
                <p>{note.text}</p>
                <small className="muted">
                  {demoUserLabel(note.by, lang)} · {branchName(note.branch)} ·{" "}
                  <DateText value={note.created_at} />
                </small>
              </article>
            ))}
          </div>
        )}
        {((effectiveTab === "invoices" && detail.invoices.length === 0) ||
          (effectiveTab === "returns" && detail.returns.length === 0) ||
          (effectiveTab === "shorts" && detail.shorts.length === 0) ||
          (effectiveTab === "alerts" && detail.alerts.length === 0) ||
          (effectiveTab === "payments" && !detail.payments?.length) ||
          (effectiveTab === "notes" && detail.notes.length === 0)) && (
          <EmptyState>
            {t(
              "No entries for this supplier in the selected branch.",
              "برای این تأمین‌کننده در شعبه انتخاب‌شده، موردی ثبت نشده است.",
            )}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
