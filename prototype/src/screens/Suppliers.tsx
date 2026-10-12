import "../c3-tables.css";
import { useEffect, useState } from "react";
import { useListState } from "../navigation";
import Decimal from "decimal.js";
import { ArrowLeft } from "lucide-react";
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
import { SupplierReturnsPanel } from "./SupplierReturnsPanel";
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
  TableRowLink,
  Menu,
  MenuItem,
  EmptyState,
  FilterToolbar,
  KpiCard,
  PageHeader,
  Select,
  Tabs,
  ConfirmDialog,
  useTableColumns,
} from "../ui";
import type { OperationsContext } from "../operations";
import "./suppliers-a2.css";
import { companyDate, dateAfter } from "../invoice";
import "./suppliers-c7.css";

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
  const [query, setQuery] = useListState("suppliers.search", "");
  const [filters, setFilters] = useListState<string[]>("suppliers.filters", []);
  const [sort, setSort] = useListState<{ key: SortKey; descending: boolean }>(
    "suppliers.sort",
    {
      key: "name",
      descending: false,
    },
  );
  const [tab, setTab] = useListState<Tab>("suppliers.tab", "overview");
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
  const tableColumns = useTableColumns("suppliers", [
    {
      key: "name",
      priority: 1,
      minWidth: 240,
      mobilePrimary: true,
      label: t("Supplier", "تأمین‌کننده"),
      required: true,
      width: 210,
    },
    {
      key: "status",
      priority: 2,
      minWidth: 120,
      label: t("Status", "وضعیت"),
      width: 136,
    },
    {
      key: "last_delivery",
      priority: 6,
      minWidth: 124,
      label: t("Last delivery", "آخرین تحویل"),
      width: 128,
    },
    {
      key: "deliveries",
      priority: 7,
      minWidth: 90,
      label: t("Deliveries", "تحویل‌ها"),
      width: 84,
      align: "end",
    },
    {
      key: "returns",
      priority: 4,
      minWidth: 105,
      label: t("Open returns", "مرجوعی‌های باز"),
      width: 88,
      align: "end",
    },
    {
      key: "shorts",
      priority: 5,
      minWidth: 100,
      label: t("Open shorts", "کسری‌های باز"),
      width: 88,
      align: "end",
    },
    {
      key: "terms",
      priority: 9,
      minWidth: 140,
      label: t("Payment terms", "شرایط پرداخت"),
      width: 96,
      defaultVisible: false,
    },
    {
      key: "contact",
      priority: 10,
      minWidth: 180,
      label: t("Sales rep and phone", "نماینده فروش و تلفن"),
      width: 160,
      defaultVisible: false,
    },
    ...(supervisor
      ? [
          {
            key: "balance",
            priority: 3,
            minWidth: 105,
            label: t("Balance", "مانده"),
            width: 120,
            align: "end" as const,
          },
          {
            key: "overdue",
            priority: 8,
            minWidth: 100,
            label: t("Overdue", "سررسید گذشته"),
            width: 120,
            align: "end" as const,
          },
          {
            key: "due",
            priority: 11,
            minWidth: 124,
            label: t("Next due date", "سررسید بعدی"),
            width: 128,
            defaultVisible: false,
          },
        ]
      : []),
    {
      key: "actions",
      label: t("Action", "عملیات"),
      width: 60,
      actions: true,
      priority: 0,
      required: true,
      align: "end",
    },
  ]);
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
              <span className="filter-toolbar-end">
                <span>
                  {translateCount(
                    "{{count}} supplier",
                    "{{count}} suppliers",
                    "{{count}} تأمین‌کننده",
                    "{{count}} تأمین‌کننده",
                    rows.length,
                    lang,
                  )}
                </span>
                {tableColumns.chooser}
              </span>
            }
            search={
              <input
                aria-label={t("Search suppliers", "جست‌وجوی تأمین‌کنندگان")}
                placeholder={t("Search suppliers", "جست‌وجوی تأمین‌کنندگان")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
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
              variant="plain"
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
            columns={tableColumns.columns}
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
                    "Deliveries",
                    "تحویل‌ها",
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
                <th>{t("Action", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => (
                <tr
                  key={supplier.name}
                  tabIndex={0}
                  className="supplier-overview-row"
                  data-row-href={`#suppliers?name=${encodeURIComponent(supplier.name)}`}
                  onClick={(event) => {
                    if (
                      !(event.target as HTMLElement).closest("a,button,input")
                    )
                      openSupplier(supplier.name);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      ["Enter", " "].includes(event.key)
                    ) {
                      event.preventDefault();
                      openSupplier(supplier.name);
                    }
                  }}
                >
                  <td>
                    <div className="table-identity">
                      <a
                        href={`#suppliers?name=${encodeURIComponent(supplier.name)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openSupplier(supplier.name);
                        }}
                      >
                        <LtrText>{supplier.name}</LtrText>
                      </a>
                    </div>
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
                  <td className="action-cell">
                    <TableRowLink
                      href={`#suppliers?name=${encodeURIComponent(supplier.name)}`}
                      aria-label={`${t("Supplier", "تأمین‌کننده")} ${supplier.name}`}
                      onClick={(event) => {
                        event.preventDefault();
                        openSupplier(supplier.name);
                      }}
                    />
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
        <Button variant="plain" onClick={() => navigate("suppliers")}>
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
  const latestInvoice = detail.invoices
    .filter((invoice) => invoice.status === "posted")
    .sort((left, right) => right.received.localeCompare(left.received))[0];
  const monthFrom = `${companyDate(state.config).slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthFrom}T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthTo = dateAfter(nextMonth.toISOString().slice(0, 10), -1);

  return (
    <>
      <Button
        variant="plain"
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
              <Button variant="neutral" onClick={() => setEditor("edit")}>
                {t("Edit", "ویرایش")}
              </Button>
              {current.active !== false && (
                <Menu label={t("More", "بیشتر")}>
                  <MenuItem
                    className="supplier-destructive-action"
                    onClick={() => setConfirmDeactivate(true)}
                  >
                    {t("Deactivate", "غیرفعال کردن")}
                  </MenuItem>
                </Menu>
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
          onClick={
            latestInvoice
              ? () =>
                  navigate(
                    `invoices?id=${encodeURIComponent(latestInvoice.id)}`,
                  )
              : undefined
          }
          value={<DateText value={current.last_delivery} />}
          tone="accent"
        />
        <KpiCard
          label={t("Deliveries this month", "تحویل‌های این ماه")}
          onClick={() =>
            navigate(
              `invoices?supplier=${encodeURIComponent(current.name)}&from=${monthFrom}&to=${monthTo}&tab=posted`,
            )
          }
          value={current.deliveries_this_month}
          tone="charcoal"
        />
        <KpiCard
          label={t("Open returns", "مرجوعی‌های باز")}
          onClick={() =>
            navigate(
              `returns?supplier=${encodeURIComponent(current.name)}&tab=open`,
            )
          }
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
              {
                key: "actions",
                width: 60,
                actions: true,
                priority: 0,
                required: true,
                align: "end",
              },
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
                <th>{t("Action", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  data-row-href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                >
                  <td>
                    <div className="table-identity">
                      <a
                        href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                      >
                        <LtrText>{invoice.number}</LtrText>
                      </a>
                    </div>
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
                  <td className="action-cell">
                    <TableRowLink
                      href={`#invoices?id=${encodeURIComponent(invoice.id)}`}
                      aria-label={`${t("Invoice", "فاکتور")} ${invoice.number}`}
                    />
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
          <SupplierReturnsPanel rows={detail.returns} supplier={current.name} />
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
                        date_reminder: t("Expiry reminder", "یادآوری انقضا"),
                        sale_cost_increase: t(
                          "Cost went up during a sale",
                          "هزینه هنگام تخفیف افزایش یافت",
                        ),
                        sale_regular_not_above_sale: t(
                          "The new regular price would be lower than the sale price",
                          "قیمت عادی جدید کمتر از قیمت تخفیف خواهد بود",
                        ),
                        sale_no_end_reminder: t("Sale", "تخفیف"),
                        sale_delivery_release: t(
                          "Sale ended",
                          "تخفیف پایان یافت",
                        ),
                        return_credit_overdue: t(
                          "Return waiting for credit",
                          "مرجوعی در انتظار اعتبار",
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
                  <td>{money(new Decimal(payment.amount).abs().toString())}</td>
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
