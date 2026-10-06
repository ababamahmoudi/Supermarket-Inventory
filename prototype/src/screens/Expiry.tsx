import { useState } from "react";
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
          "Check expiry and best-before dates. Cleared entries stay in history until Reset demo.",
          "تاریخ انقضا و بهترین زمان مصرف را بررسی کنید. موارد پاک‌شده تا بازنشانی نمایش در سابقه می‌مانند.",
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
      <Card>
        <div className="form-grid">
          <Field label={t("Search products", "جستجوی محصولات")}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Name or Product Code", "نام یا کد محصول")}
            />
          </Field>
          <Field label={t("Time window", "بازه زمانی")}>
            <select
              value={window}
              onChange={(event) => setWindow(event.target.value)}
            >
              <option value="soon">
                {t("Expiring soon", "به‌زودی منقضی")} (
                {state.config.expiry.expiring_soon_days} {t("days", "روز")})
              </option>
              <option value="expired">{t("Expired", "منقضی‌شده")}</option>
              <option value="active">
                {t("All active dates", "همه تاریخ‌های فعال")}
              </option>
              <option value="cleared">
                {t("Cleared history", "سوابق پاک‌شده")}
              </option>
            </select>
          </Field>
          <Field label={t("AI category", "دسته‌بندی هوش مصنوعی")}>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">{t("All categories", "همه دسته‌ها")}</option>
              {[
                ...new Set(
                  state.products
                    .filter((item) => item.company_id === context.company_id)
                    .map((product) => product.ai_category),
                ),
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Sort by", "مرتب‌سازی بر اساس")}>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "date" | "name")
              }
            >
              <option value="date">{t("Date", "تاریخ")}</option>
              <option value="name">{t("Product", "محصول")}</option>
            </select>
          </Field>
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
      {entries.length === 0 ? (
        <EmptyState>
          {t(
            "No dates match these filters. Choose all active dates or Reset demo to restore the examples.",
            "هیچ تاریخی با این فیلترها مطابق نیست. همه تاریخ‌های فعال را انتخاب یا برای بازیابی نمونه‌ها نمایش را بازنشانی کنید.",
          )}
        </EmptyState>
      ) : (
        <Card>
          <DataTable>
            <thead>
              <tr>
                <th>{t("Product", "محصول")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Date", "تاریخ")}</th>
                <th>{t("Type", "نوع")}</th>
                <th>{t("Days left", "روز باقی‌مانده")}</th>
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
                      <strong>
                        {lang === "fa" ? product?.name_fa : product?.name_en}
                      </strong>
                      <div dir="ltr" className="muted">
                        {entry.product_code}
                      </div>
                    </td>
                    <td>{entry.branch}</td>
                    <td dir="ltr">{entry.date}</td>
                    <td>
                      {richer.date_type === "best_before"
                        ? t("Best before", "بهترین زمان مصرف")
                        : t("Expiry", "انقضا")}
                    </td>
                    <td dir="ltr">{days}</td>
                    <td>
                      {richer.supplier ?? product?.main_supplier}
                      <div className="muted">
                        {richer.invoice_id ??
                          t("Demo stock on hand", "موجودی نمونه")}
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
                              setMessage(
                                t(
                                  "Cleared. Reset demo restores the example.",
                                  "پاک شد. بازنشانی نمایش نمونه را بازیابی می‌کند.",
                                ),
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
                          {t("Cleared", "پاک شد")}
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
