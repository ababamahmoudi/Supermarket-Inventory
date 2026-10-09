import {
  branchLabel as configuredBranchLabel,
  configuredBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { useState } from "react";
import { useDemo } from "../store";
import type { Branch } from "../types";
import { companyDate } from "../invoice";
import { categoryLabel, DateText, LtrText, ProductName } from "../presentation";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterToolbar,
  PageHeader,
  Select,
} from "../ui";
import {
  clearExpiry,
  operationError,
  scopedRecords,
  type OperationsContext,
} from "../operations";

export function Expiry() {
  const { state, update, branch, setBranch, role, user, lang, t } = useDemo();
  const branches = configuredBranches(state.config);
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: user?.name ?? t("Floor Worker", "کارمند فروشگاه"),
  };
  const [window, setWindow] = useState("soon");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "name">("date");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const today = companyDate(state.config);
  const daysLeft = (date: string) =>
    Math.ceil((Date.parse(date) - Date.parse(today)) / 86_400_000);
  const entries = scopedRecords(state.expiry, context)
    .filter((entry) => {
      const product = state.products.find(
        (item) =>
          item.company_id === context.company_id &&
          item.code === entry.product_code,
      );
      const days = daysLeft(entry.date);
      return (
        (window === "cleared"
          ? entry.status === "cleared"
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
      sort === "date"
        ? a.date.localeCompare(b.date)
        : (
            state.products.find((item) => item.code === a.product_code)
              ?.name_en ?? ""
          ).localeCompare(
            state.products.find((item) => item.code === b.product_code)
              ?.name_en ?? "",
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
    <>
      <PageHeader
        title={t("Date tracking", "پیگیری تاریخ")}
        description={t(
          "Check expiry and best-before dates.",
          "تاریخ انقضا و بهترین زمان مصرف را بررسی کنید.",
        )}
      />
      {branch === "all" && (
        <div className="banner info">
          {t(
            "Choose one branch before clearing a date entry.",
            "پیش از پاک کردن تاریخ، یک شعبه انتخاب کنید.",
          )}
        </div>
      )}
      <FilterToolbar
        className="expiry-filters"
        aria-label={t("Date tracking filters", "فیلترهای پیگیری تاریخ")}
        count={translateCount(
          "{{count}} entry",
          "{{count}} entries",
          "{{count}} مورد",
          "{{count}} مورد",
          entries.length,
          lang,
        )}
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
          value={window}
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
              value: "cleared",
              label: t("Cleared history", "سوابق پاک‌شده"),
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
                  .filter((item) => item.company_id === context.company_id)
                  .map((product) => product.ai_category),
              ),
            ].map((value) => ({
              value,
              label: categoryLabel(value, lang),
            })),
          ]}
        />
        <Select
          aria-label={t("Date tracking branch", "شعبه پیگیری تاریخ")}
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
      {error && (
        <div className="banner danger" role="alert">
          {error}
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
          <DataTable
            columns={[
              { width: "22%" },
              { width: 110 },
              { width: 112 },
              { width: 110 },
              { width: 96, align: "end" },
              { width: "20%" },
              { width: 130 },
              { width: 180, actions: true, align: "end" },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Product", "محصول")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Date", "تاریخ")}</th>
                <th>{t("Type", "نوع")}</th>
                <th className="number-cell">
                  {t("Days left", "روز باقی‌مانده")}
                </th>
                <th>{t("Supplier / invoice", "تأمین‌کننده / فاکتور")}</th>
                <th>{t("Status", "وضعیت")}</th>
                <th>{t("Action", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === context.company_id &&
                    item.code === entry.product_code,
                );
                const richer = entry as typeof entry & {
                  date_type?: "expiry" | "best_before";
                  invoice_id?: string;
                  supplier?: string;
                };
                const days = daysLeft(entry.date);
                return (
                  <tr key={entry.id}>
                    <td>
                      {product && (
                        <ProductName product={product} language={lang} />
                      )}
                      <div className="muted">
                        <LtrText>{entry.product_code}</LtrText>
                      </div>
                    </td>
                    <td className="branch-label">
                      {configuredBranchLabel(state.config, entry.branch, lang)}
                    </td>
                    <td>
                      <DateText value={entry.date} />
                    </td>
                    <td>
                      {richer.date_type === "best_before"
                        ? t("Best before", "بهترین زمان مصرف")
                        : t("Expiry", "انقضا")}
                    </td>
                    <td className="number-cell">
                      <LtrText>{days}</LtrText>
                    </td>
                    <td>
                      <LtrText>
                        {richer.supplier ?? product?.main_supplier}
                      </LtrText>
                      <div className="muted">
                        <LtrText>
                          {entry.invoice_number ??
                            state.invoices?.find(
                              (invoice) => invoice.id === entry.invoice_id,
                            )?.supplier_invoice_number ??
                            "—"}
                        </LtrText>
                        {entry.received_date && (
                          <div>
                            <DateText value={entry.received_date} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          entry.status === "cleared"
                            ? "neutral"
                            : days < 0
                              ? "danger"
                              : days <= state.config.expiry.expiring_soon_days
                                ? "pending"
                                : "info"
                        }
                      >
                        {entry.status === "cleared"
                          ? t("Cleared", "پاک‌شده")
                          : days < 0
                            ? t("Expired", "منقضی‌شده")
                            : days <= state.config.expiry.expiring_soon_days
                              ? t("Expiring soon", "به‌زودی منقضی")
                              : t("Open", "باز")}
                      </Badge>
                    </td>
                    <td>
                      {entry.status === "active" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={branch === "all"}
                          onClick={() => {
                            try {
                              update((draft) =>
                                clearExpiry(draft, context, entry.id),
                              );
                              setMessage(t("Cleared.", "پاک شد."));
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
                          {t("Mark as cleared", "علامت‌گذاری به‌عنوان پاک‌شده")}
                        </Button>
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
          "Dates do not prove stock is still on the shelf. Clear only after checking the product. New tracked dates from posted invoices appear here.",
          "تاریخ‌ها ثابت نمی‌کنند که کالا هنوز در قفسه است. فقط پس از بررسی کالا پاک کنید. تاریخ‌های پیگیری‌شده فاکتورهای ثبت‌شده اینجا ظاهر می‌شوند.",
        )}
      </p>
    </>
  );
}
export default Expiry;
