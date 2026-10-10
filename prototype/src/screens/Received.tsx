import "../c3-tables.css";
import { useListState } from "../navigation";
import { useDemo } from "../store";
import { receivedLog, type DeliveryReceipt } from "../received";
import { branchLabel, configuredBranches } from "../settings";
import { supplierRecords } from "../supplier-editor";
import { DateText, demoUserLabel, LtrText, ProductName } from "../presentation";
import {
  Button,
  Card,
  DataTable,
  DateField,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Select,
  useTableColumns,
} from "../ui";
import "./received-c.css";

export function ReceivedTable({ rows }: { rows: DeliveryReceipt[] }) {
  const { state, lang, t, tCount, navigate } = useDemo();
  const tableColumns = useTableColumns("received", [
    {
      key: "product",
      label: t("Product", "کالا"),
      required: true,
      width: "21%",
    },
    {
      key: "quantity",
      label: t("Cases and units", "کارتن و واحد"),
      width: "10%",
      align: "end",
    },
    { key: "location", label: t("Location", "مکان"), width: "14%" },
    { key: "supplier", label: t("Supplier", "تأمین‌کننده"), width: "17%" },
    {
      key: "invoice",
      label: t("Invoice number", "شماره فاکتور"),
      width: "14%",
    },
    { key: "date", label: t("Date", "تاریخ"), width: "12%" },
    { key: "actor", label: t("Received by", "دریافت‌کننده"), width: "12%" },
  ]);
  if (!rows.length)
    return (
      <EmptyState>
        {t(
          "No deliveries match these filters.",
          "تحویلی با این فیلترها پیدا نشد.",
        )}
      </EmptyState>
    );
  return (
    <>
      <div className="table-column-actions">{tableColumns.chooser}</div>
      <DataTable className="received-table" columns={tableColumns.columns}>
        <thead>
          <tr>
            <th>{t("Product", "کالا")}</th>
            <th>{t("Cases and units", "کارتن و واحد")}</th>
            <th>{t("Location", "مکان")}</th>
            <th>{t("Supplier", "تأمین‌کننده")}</th>
            <th>{t("Invoice number", "شماره فاکتور")}</th>
            <th>{t("Date", "تاریخ")}</th>
            <th>{t("Received by", "دریافت‌کننده")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((receipt) => {
            const product = state.products.find(
              (item) =>
                item.company_id === receipt.company_id &&
                item.code === receipt.product_code,
            );
            return (
              <tr key={receipt.id}>
                <td>
                  {product ? (
                    <ProductName product={product} language={lang} />
                  ) : (
                    <LtrText>{receipt.product_code}</LtrText>
                  )}
                </td>
                <td className="numeric">
                  {receipt.units_per_case > 1 && (
                    <>
                      {tCount(
                        "{{count}} case",
                        "{{count}} cases",
                        "{{count}} کارتن",
                        "{{count}} کارتن",
                        Number(receipt.cases),
                      )}
                    </>
                  )}
                  <span
                    className={
                      receipt.units_per_case > 1
                        ? "muted received-units"
                        : undefined
                    }
                  >
                    {tCount(
                      "{{count}} unit",
                      "{{count}} units",
                      "{{count}} واحد",
                      "{{count}} واحد",
                      receipt.units,
                    )}
                  </span>
                </td>
                <td className="received-location">
                  {branchLabel(state.config, receipt.branch, lang)}
                </td>
                <td>
                  <LtrText>{receipt.supplier}</LtrText>
                </td>
                <td>
                  {receipt.invoice_id ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `invoices?id=${encodeURIComponent(receipt.invoice_id)}`,
                        )
                      }
                    >
                      <LtrText>{receipt.invoice_number}</LtrText>
                    </Button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <DateText value={receipt.date} />
                </td>
                <td>
                  {receipt.received_by ? (
                    demoUserLabel(receipt.received_by, lang)
                  ) : (
                    <span className="muted">
                      {t("Not recorded", "ثبت نشده")}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </>
  );
}

export default function Received({
  supplier,
  embedded = false,
}: { supplier?: string; embedded?: boolean } = {}) {
  const { state, role, user, branch, setBranch, lang, t, tCount } = useDemo();
  const [from, setFrom] = useListState("received.from", "");
  const [to, setTo] = useListState("received.to", "");
  const [supplierFilter, setSupplier] = useListState(
    "received.supplier",
    "all",
  );
  const [product, setProduct] = useListState(
    "received.product",
    () =>
      new URLSearchParams(window.location.hash.split("?")[1] ?? "").get(
        "product",
      ) ?? "all",
  );
  const [search, setSearch] = useListState("received.search", "");
  if (role !== "supervisor" && role !== "floor_worker")
    return (
      <EmptyState>
        {t(
          "You do not have access to Received.",
          "به دریافت‌شده‌ها دسترسی ندارید.",
        )}
      </EmptyState>
    );
  const rows = receivedLog(
    state,
    {
      company_id: state.config.company.seed_key,
      branch: role === "floor_worker" ? (user?.branch ?? branch) : branch,
      role,
      actor: user?.name ?? "",
    },
    { from, to, supplier: supplier ?? supplierFilter, product, search },
  );
  const content = (
    <>
      <FilterToolbar
        className="received-filters"
        aria-label={t("Received filters", "فیلتر دریافت‌شده‌ها")}
        search={
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(
              "Search products, invoices or suppliers",
              "جستجوی کالا، فاکتور یا تأمین‌کننده",
            )}
            aria-label={t("Search Received", "جستجوی دریافت‌شده‌ها")}
          />
        }
        count={tCount(
          "{{count}} delivery",
          "{{count}} deliveries",
          "{{count}} تحویل",
          "{{count}} تحویل",
          rows.length,
        )}
      >
        <Field label={t("From", "از")}>
          <DateField value={from} onChange={setFrom} />
        </Field>
        <Field label={t("To", "تا")}>
          <DateField value={to} onChange={setTo} />
        </Field>
        {role === "supervisor" && (
          <Select
            value={branch}
            onChange={setBranch}
            aria-label={t("Location", "مکان")}
            options={[
              { value: "all", label: t("All branches", "همه شعب") },
              ...configuredBranches(state.config, true).map((location) => ({
                value: location,
                label: branchLabel(state.config, location, lang),
              })),
            ]}
          />
        )}
        {!supplier && (
          <Select
            value={supplierFilter}
            onChange={setSupplier}
            aria-label={t("Supplier", "تأمین‌کننده")}
            options={[
              { value: "all", label: t("All suppliers", "همه تأمین‌کنندگان") },
              ...supplierRecords(state)
                .filter(
                  (record) =>
                    record.company_id === state.config.company.seed_key,
                )
                .map((record) => ({
                  value: record.name,
                  label: `\u2066${record.name}\u2069`,
                })),
            ]}
          />
        )}
        <Select
          value={product}
          onChange={setProduct}
          aria-label={t("Product", "کالا")}
          options={[
            { value: "all", label: t("All products", "همه کالاها") },
            ...state.products
              .filter(
                (item) => item.company_id === state.config.company.seed_key,
              )
              .map((item) => ({
                value: item.code,
                label: `${lang === "fa" ? item.name_fa : item.name_en} · ${item.code}`,
              })),
          ]}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setFrom("");
            setTo("");
            setSupplier("all");
            setProduct("all");
            setSearch("");
          }}
        >
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
      </FilterToolbar>
      {from && to && from > to ? (
        <p role="alert" className="form-error">
          {t(
            "Choose an end date on or after the start date.",
            "تاریخ پایان را برابر یا پس از تاریخ شروع انتخاب کنید.",
          )}
        </p>
      ) : (
        <ReceivedTable rows={rows} />
      )}
    </>
  );
  return embedded ? (
    content
  ) : (
    <>
      <PageHeader
        title={t("Received", "دریافت‌شده‌ها")}
        description={t(
          "What came in, where and when.",
          "چه کالایی، کجا و چه زمانی دریافت شد.",
        )}
      />
      <Card>{content}</Card>
    </>
  );
}
