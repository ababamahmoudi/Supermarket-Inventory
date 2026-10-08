import { useState } from "react";
import { demoUsers, useDemo } from "../store";
import { companyDate } from "../invoice";
import {
  branchLabel,
  categoryLabel,
  DateText,
  LtrText,
  ProductName,
} from "../presentation";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
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
  const { state, update, branch, role, lang, t } = useDemo();
  const context: OperationsContext = {
    company_id: state.config.company.seed_key,
    branch,
    role: role ?? "cashier",
    actor: demoUsers.find((user) => user.role === role)?.name ?? "Demo user",
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
      <FilterToolbar count={`${entries.length} ${t("entries", "مورد")}`}>
        <Field label={t("Search products", "جستجوی محصولات")}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Name or Product Code", "نام یا کد محصول")}
          />
        </Field>
        <Field label={t("Time window", "بازه زمانی")}>
          <Select
            value={window}
            onChange={setWindow}
            options={[
              {
                value: "soon",
                label: `${t("Expiring soon", "به‌زودی منقضی")} (${state.config.expiry.expiring_soon_days} ${t("days", "روز")})`,
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
        </Field>
        <Field label={t("AI category", "دسته‌بندی هوش مصنوعی")}>
          <Select
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
        </Field>
        <Field label={t("Sort by", "مرتب‌سازی بر اساس")}>
          <Select
            value={sort}
            onChange={(value) => setSort(value as "date" | "name")}
            options={[
              { value: "date", label: t("Date", "تاریخ") },
              { value: "name", label: t("Product", "محصول") },
            ]}
          />
        </Field>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setCategory("all");
            setWindow("soon");
            setSort("date");
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
                    <td>{branchLabel(entry.branch, lang)}</td>
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
