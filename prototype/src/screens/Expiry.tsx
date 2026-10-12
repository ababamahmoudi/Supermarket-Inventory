import "../c3-tables.css";
import {
  branchLabel as configuredBranchLabel,
  configuredBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  navigationKey,
  saveNavigationValue,
  useListState,
  useRouteParam,
} from "../navigation";
import { useDemo } from "../store";
import type { Branch } from "../types";
import { companyDate } from "../invoice";
import { RemoveDateDialog, StopTrackingDialog } from "../AddDateDialog";
import {
  dateRemovalReasonLabel,
  scopedTrackedDates,
  trackedDateDaysLeft,
} from "../date-tracking";
import { DateQuickAdd } from "../DateQuickAdd";
import { categoryLabel, DateText, LtrText, ProductName } from "../presentation";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterToolbar,
  Menu,
  MenuItem,
  PageHeader,
  Select,
  useTableColumns,
} from "../ui";
export function Expiry() {
  const { state, branch, setBranch, role, user, historyContext, lang, t } =
    useDemo();
  const branches = configuredBranches(state.config);
  const [window, setWindow] = useListState("expiry.window", "soon");
  const [category, setCategory] = useListState("expiry.category", "all");
  const [search, setSearch] = useListState("expiry.search", "");
  const [sort, setSort] = useListState<"date" | "name">("expiry.sort", "date");
  const [message, setMessage] = useState("");
  const [newDateId, setNewDateId] = useState("");
  const requestedProduct = useRouteParam("product");
  const [removing, setRemoving] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const tableColumns = useTableColumns("expiry", [
    {
      key: "product",
      label: t("Product", "محصول"),
      required: true,
      width: 220,
    },
    { key: "location", label: t("Location", "مکان"), width: 112 },
    { key: "date", label: t("Date", "تاریخ"), width: 128 },
    { key: "type", label: t("Type", "نوع"), width: 104 },
    {
      key: "days",
      label: t("Days left", "روز باقی‌مانده"),
      width: 88,
      align: "end",
    },
    {
      key: "supplier",
      label: t("Source / invoice", "منبع / فاکتور"),
      width: 168,
    },
    { key: "status", label: t("Status", "وضعیت"), width: 136 },
    {
      key: "actions",
      label: t("Action", "عملیات"),
      width: 160,
      align: "end",
      actions: true,
    },
  ]);
  const today = companyDate(state.config);
  const daysLeft = (date: string) => trackedDateDaysLeft(date, today);
  const entries = (
    historyContext ? scopedTrackedDates(state, historyContext, true) : []
  )
    .filter((entry) => {
      const product = state.products.find(
        (item) =>
          item.company_id === state.config.company.seed_key &&
          item.code === entry.product_code,
      );
      const days = daysLeft(entry.date);
      return (
        (window === "removed" || window === "cleared"
          ? entry.status !== "active"
          : entry.status === "active") &&
        (category === "all" || product?.ai_category === category) &&
        (window !== "soon" ||
          (days >= 0 && days <= state.config.expiry.expiring_soon_days)) &&
        (window !== "expired" || days < 0) &&
        (!search ||
          `${product?.name_en} ${product?.name_fa} ${entry.product_code}`
            .toLowerCase()
            .includes(search.toLowerCase()))
      );
    })
    .sort((a, b) =>
      a.id === newDateId
        ? -1
        : b.id === newDateId
          ? 1
          : sort === "date"
            ? a.date.localeCompare(b.date)
            : (
                state.products.find(
                  (item) =>
                    item.company_id === state.config.company.seed_key &&
                    item.code === a.product_code,
                )?.name_en ?? ""
              ).localeCompare(
                state.products.find(
                  (item) =>
                    item.company_id === state.config.company.seed_key &&
                    item.code === b.product_code,
                )?.name_en ?? "",
              ),
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
    <div className="date-tracking-page">
      <PageHeader
        title={t("Date tracking", "پیگیری تاریخ")}
        description={t(
          "Check expiry and best-before dates.",
          "تاریخ انقضا و بهترین زمان مصرف را بررسی کنید.",
        )}
      />
      <Card className="date-quick-card">
        <DateQuickAdd
          key={requestedProduct ?? ""}
          productCode={requestedProduct ?? undefined}
          defaultLocation={branch}
          onAdded={(id, location) => {
            setNewDateId(id);
            setWindow("active");
            setSearch("");
            setCategory("all");
            if (
              role === "supervisor" &&
              branch !== "all" &&
              branch !== location
            ) {
              // The destination can have its own saved filters. Make the date
              // just added visible there without resetting the quick-add form.
              for (const [field, value] of [
                ["expiry.window", "active"],
                ["expiry.search", ""],
                ["expiry.category", "all"],
              ]) {
                saveNavigationValue(
                  navigationKey(
                    state.config.company.seed_key,
                    user?.username ?? "signed-out",
                    location,
                    field,
                  ),
                  value,
                );
              }
              setBranch(location);
            }
            setMessage("");
          }}
        />
      </Card>
      <FilterToolbar
        className="expiry-filters"
        aria-label={t("Date tracking filters", "فیلترهای پیگیری تاریخ")}
        count={
          <span className="date-filter-result-actions">
            <span>
              {translateCount(
                "{{count}} entry",
                "{{count}} entries",
                "{{count}} مورد",
                "{{count}} مورد",
                entries.length,
                lang,
              )}
            </span>
            {tableColumns.chooser}
          </span>
        }
        search={
          <input
            className="ui-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("Search products", "جستجوی محصولات")}
            placeholder={t("Name or Product Code", "نام یا کد محصول")}
          />
        }
      >
        <Select
          aria-label={t("Time window", "بازه زمانی")}
          value={window === "cleared" ? "removed" : window}
          onChange={setWindow}
          options={[
            {
              value: "soon",
              label: `${t("Expiring soon", "به‌زودی منقضی")} (${translateCount(
                "{{count}} day",
                "{{count}} days",
                "{{count}} روز",
                "{{count}} روز",
                state.config.expiry.expiring_soon_days,
                lang,
              )})`,
            },
            { value: "expired", label: t("Expired", "منقضی‌شده") },
            {
              value: "active",
              label: t("All active dates", "همه تاریخ‌های فعال"),
            },
            {
              value: "removed",
              label: t("Removed", "حذف‌شده"),
            },
          ]}
        />
        <Select
          aria-label={t("AI category", "دسته‌بندی هوش مصنوعی")}
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: t("All categories", "همه دسته‌ها") },
            ...[
              ...new Set(
                state.products
                  .filter(
                    (item) => item.company_id === state.config.company.seed_key,
                  )
                  .map((product) => product.ai_category),
              ),
            ].map((value) => ({
              value,
              label: categoryLabel(value, lang),
            })),
          ]}
        />
        <Select
          aria-label={t("Date tracking location", "مکان پیگیری تاریخ")}
          value={branch}
          onChange={(value) => setBranch(value as Branch)}
          disabled={role !== "supervisor"}
          options={
            role === "supervisor"
              ? [
                  { value: "all", label: t("All branches", "همه شعبه‌ها") },
                  ...branches.map((value) => ({
                    value,
                    label: configuredBranchLabel(state.config, value, lang),
                  })),
                ]
              : [
                  {
                    value: branch,
                    label: configuredBranchLabel(state.config, branch, lang),
                  },
                ]
          }
        />
        <Select
          aria-label={t("Sort by", "مرتب‌سازی بر اساس")}
          value={sort}
          onChange={(value) => setSort(value as "date" | "name")}
          options={[
            { value: "date", label: t("Date", "تاریخ") },
            { value: "name", label: t("Product", "محصول") },
          ]}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setCategory("all");
            setWindow("soon");
            setSort("date");
            if (role === "supervisor") setBranch("all");
          }}
        >
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
      </FilterToolbar>
      {message && (
        <div className="banner approved" role="status">
          {message}
        </div>
      )}
      {entries.length === 0 ? (
        <EmptyState>
          {t(
            "No dates match these filters.",
            "هیچ تاریخی با این فیلترها مطابق نیست.",
          )}
        </EmptyState>
      ) : (
        <Card>
          <DataTable className="expiry-table" columns={tableColumns.columns}>
            <thead>
              <tr>
                <th>{t("Product", "محصول")}</th>
                <th>{t("Location", "مکان")}</th>
                <th>{t("Date", "تاریخ")}</th>
                <th>{t("Type", "نوع")}</th>
                <th className="number-cell">
                  {t("Days left", "روز باقی‌مانده")}
                </th>
                <th>{t("Source / invoice", "منبع / فاکتور")}</th>
                <th>{t("Status", "وضعیت")}</th>
                <th>{t("Action", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === state.config.company.seed_key &&
                    item.code === entry.product_code,
                );
                const invoice = [...(state.invoices ?? []), state.invoice].find(
                  (item) =>
                    item.company_id === entry.company_id &&
                    item.id === entry.invoice_id,
                );
                const retainedSupplier = (
                  entry as typeof entry & { supplier?: string }
                ).supplier;
                const days = daysLeft(entry.date);
                return (
                  <tr
                    key={entry.id}
                    data-new-date={entry.id === newDateId || undefined}
                  >
                    <td>
                      {product && (
                        <ProductName product={product} language={lang} />
                      )}
                      <div className="muted">
                        <LtrText>{entry.product_code}</LtrText>
                      </div>
                      {(entry.quantity || entry.lot_number || entry.note) && (
                        <div className="date-entry-evidence">
                          {entry.quantity && (
                            <div>
                              {t("Quantity", "مقدار")}:{" "}
                              <LtrText>{entry.quantity}</LtrText>
                            </div>
                          )}
                          {entry.lot_number && (
                            <div>
                              {t("Lot", "سری ساخت")}:{" "}
                              <LtrText>{entry.lot_number}</LtrText>
                            </div>
                          )}
                          {entry.note && <div>{entry.note}</div>}
                        </div>
                      )}
                    </td>
                    <td className="branch-label">
                      {configuredBranchLabel(state.config, entry.branch, lang)}
                    </td>
                    <td>
                      <DateText value={entry.date} />
                    </td>
                    <td>
                      {entry.date_type === "best_before"
                        ? t("Best before", "بهترین زمان مصرف")
                        : t("Expiry", "انقضا")}
                    </td>
                    <td className="number-cell">
                      <LtrText>{days}</LtrText>
                    </td>
                    <td>
                      {entry.source === "manual" || !entry.invoice_id ? (
                        t("Manual entry", "ثبت دستی")
                      ) : (
                        <LtrText>
                          {invoice?.supplier ??
                            retainedSupplier ??
                            product?.main_supplier}
                        </LtrText>
                      )}
                      <div className="muted">
                        {entry.source === "manual" ? (
                          entry.created_by
                        ) : (
                          <LtrText>
                            {entry.invoice_number ??
                              invoice?.supplier_invoice_number ??
                              "—"}
                          </LtrText>
                        )}
                        {entry.source === "correction" && (
                          <div>{t("Corrected", "اصلاح‌شده")}</div>
                        )}
                        {entry.received_date && (
                          <div>
                            <DateText value={entry.received_date} />
                          </div>
                        )}
                        {entry.source === "manual" && entry.created_at && (
                          <div>
                            <DateText value={entry.created_at.slice(0, 10)} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          entry.status !== "active"
                            ? "neutral"
                            : days < 0
                              ? "danger"
                              : days <= state.config.expiry.expiring_soon_days
                                ? "pending"
                                : "info"
                        }
                      >
                        {entry.status !== "active"
                          ? t("Removed", "حذف‌شده")
                          : days < 0
                            ? t("Expired", "منقضی‌شده")
                            : days <= state.config.expiry.expiring_soon_days
                              ? t("Expiring soon", "به‌زودی منقضی")
                              : t("Open", "باز")}
                      </Badge>
                      {entry.status !== "active" && (
                        <div className="date-entry-evidence">
                          {entry.removed_reason && (
                            <div>
                              {dateRemovalReasonLabel(entry.removed_reason, t)}
                            </div>
                          )}
                          {entry.removal_action === "stop_tracking" && (
                            <div>
                              {t(
                                "Stop tracking this product",
                                "توقف پیگیری این محصول",
                              )}
                            </div>
                          )}
                          {entry.removal_action === "undo" && (
                            <div>{t("Undone", "واگرد شد")}</div>
                          )}
                          {entry.removal_action === "correction" && (
                            <div>{t("Corrected", "اصلاح‌شده")}</div>
                          )}
                          {entry.removed_by && <div>{entry.removed_by}</div>}
                          {entry.removed_at && (
                            <div>
                              <DateText value={entry.removed_at.slice(0, 10)} />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {entry.status === "active" && (
                        <div className="actions">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setRemoving(entry.id);
                              setMessage("");
                            }}
                          >
                            {t("Remove", "حذف")}
                          </Button>
                          {role === "supervisor" && (
                            <Menu
                              iconOnly
                              showChevron={false}
                              label={
                                <MoreHorizontal
                                  size={20}
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                />
                              }
                              aria-label={t("More", "بیشتر")}
                            >
                              <MenuItem
                                className="date-stop-menu-item"
                                onClick={() => {
                                  setStopping(entry.product_code);
                                  setMessage("");
                                }}
                              >
                                {t(
                                  "Stop tracking this product",
                                  "توقف پیگیری این محصول",
                                )}
                              </MenuItem>
                            </Menu>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </Card>
      )}
      <p className="muted">
        {t(
          "Dates do not prove stock is still on the shelf. Adding or removing a date does not change stock or supplier balances.",
          "تاریخ‌ها ثابت نمی‌کنند که کالا هنوز در قفسه است. افزودن یا حذف تاریخ موجودی یا مانده تأمین‌کننده را تغییر نمی‌دهد.",
        )}
      </p>
      {removing && (
        <RemoveDateDialog
          open
          entryId={removing}
          onOpenChange={(open) => {
            if (!open) setRemoving(null);
          }}
          onSaved={() => setMessage(t("Date removed.", "تاریخ حذف شد."))}
        />
      )}
      {stopping && (
        <StopTrackingDialog
          open
          productCode={stopping}
          onOpenChange={(open) => {
            if (!open) setStopping(null);
          }}
          onSaved={() =>
            setMessage(t("Date tracking stopped.", "پیگیری تاریخ متوقف شد."))
          }
        />
      )}
    </div>
  );
}
export default Expiry;
