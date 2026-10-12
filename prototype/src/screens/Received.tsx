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
  TableRowLink,
  EmptyState,
  FilterToolbar,
  PageHeader,
  Select,
  useTableColumns,
} from "../ui";
import "./received-c.css";
import { ReceivedDateRange } from "./ReceivedDateRange";
import "./invoice-entry-c6.css";
import "./suppliers-c7.css";

function useReceivedColumns() {
  const { t } = useDemo();
  return useTableColumns("received", [
    {
      key: "product",
      label: t("Product", "کالا"),
      required: true,
      width: "21%",
      priority: 1,
      minWidth: 200,
      mobilePrimary: true,
    },
    {
      key: "quantity",
      label: t("Cases and units", "کارتن و واحد"),
      width: "10%",
      priority: 2,
      minWidth: 170,
      align: "end",
    },
    {
      key: "location",
      priority: 6,
      minWidth: 130,
      label: t("Location", "مکان"),
      width: "14%",
    },
    {
      key: "supplier",
      priority: 5,
      minWidth: 165,
      label: t("Supplier", "تأمین‌کننده"),
      width: "17%",
    },
    {
      key: "invoice",
      priority: 4,
      minWidth: 145,
      label: t("Invoice number", "شماره فاکتور"),
      width: "14%",
    },
    {
      key: "date",
      priority: 3,
      minWidth: 124,
      label: t("Date", "تاریخ"),
      width: "12%",
    },
    {
      key: "actor",
      priority: 7,
      minWidth: 150,
      label: t("Received by", "دریافت‌کننده"),
      width: "12%",
    },
  ]);
}

export function ReceivedTable({
  rows,
  columns,
}: {
  rows: DeliveryReceipt[];
  columns: ReturnType<typeof useTableColumns>["columns"];
}) {
  const { state, lang, t, tCount, navigate } = useDemo();
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
      <DataTable className="received-table" columns={columns}>
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
              <tr
                key={receipt.id}
                data-row-href={
                  receipt.invoice_id
                    ? `#invoices?id=${encodeURIComponent(receipt.invoice_id)}`
                    : undefined
                }
              >
                <td>
                  <div className="table-identity">
                    {product ? (
                      <ProductName product={product} language={lang} />
                    ) : (
                      <LtrText>{receipt.product_code}</LtrText>
                    )}
                    {receipt.invoice_id && (
                      <TableRowLink
                        href={`#invoices?id=${encodeURIComponent(receipt.invoice_id)}`}
                        aria-label={`${t("Invoice", "فاکتور")} ${receipt.invoice_number}`}
                      />
                    )}
                  </div>
                </td>
                <td className="numeric">
                  {receipt.sold_by === "weight" ? (
                    <>
                      <LtrText>
                        {receipt.source_quantity}{" "}
                        {receipt.source_quantity_unit ?? "lb"}
                      </LtrText>
                      {receipt.case_weight && (
                        <small className="muted received-units">
                          {t("Case of", "کارتنِ")}{" "}
                          <LtrText>
                            {receipt.case_weight} {receipt.case_weight_unit}
                          </LtrText>
                        </small>
                      )}
                    </>
                  ) : receipt.units_per_case > 1 ? (
                    <>
                      {tCount(
                        "{{count}} case",
                        "{{count}} cases",
                        "{{count}} کارتن",
                        "{{count}} کارتن",
                        Number(receipt.cases),
                      )}{" "}
                      <span className="muted">
                        (
                        {tCount(
                          "{{count}} unit",
                          "{{count}} units",
                          "{{count}} واحد",
                          "{{count}} واحد",
                          receipt.units,
                        )}
                        )
                      </span>
                    </>
                  ) : (
                    tCount(
                      "{{count}} unit",
                      "{{count}} units",
                      "{{count}} واحد",
                      "{{count}} واحد",
                      receipt.units,
                    )
                  )}
                </td>
                <td className="received-location">
                  {branchLabel(state.config, receipt.branch, lang)}
                </td>
                <td>
                  <LtrText>{receipt.supplier}</LtrText>
                </td>
                <td>
                  {receipt.invoice_id ? (
                    <a
                      className="received-invoice-link"
                      href={`#invoices?id=${encodeURIComponent(receipt.invoice_id)}`}
                      onClick={() =>
                        navigate(
                          `invoices?id=${encodeURIComponent(receipt.invoice_id)}`,
                        )
                      }
                    >
                      <LtrText>{receipt.invoice_number}</LtrText>
                    </a>
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
  const tableColumns = useReceivedColumns();
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
        count={
          <span className="filter-toolbar-end">
            <span>
              {tCount(
                "{{count}} delivery",
                "{{count}} deliveries",
                "{{count}} تحویل",
                "{{count}} تحویل",
                rows.length,
              )}
            </span>
            {tableColumns.chooser}
          </span>
        }
      >
        <ReceivedDateRange
          from={from}
          to={to}
          onChange={(nextFrom, nextTo) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
        />
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
          variant="plain"
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
        <ReceivedTable rows={rows} columns={tableColumns.columns} />
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
