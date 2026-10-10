import { useDemo } from "../store";
import { useListState } from "../navigation";
import { returnUiStatusLabel } from "../return-workflow";
import type { SupplierReturnRow } from "../suppliers";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterToolbar,
  Select,
  Tabs,
  useTableColumns,
} from "../ui";
import { DateText, LtrText, Money } from "../presentation";
import { branchLabel } from "../settings";

export function SupplierReturnsPanel({
  rows,
  supplier,
}: {
  rows: SupplierReturnRow[];
  supplier: string;
}) {
  const { t, lang, state, role } = useDemo();
  const [tab, setTab] = useListState("supplierReturns.tab", "open");
  const [search, setSearch] = useListState("supplierReturns.search", "");
  const [status, setStatus] = useListState("supplierReturns.status", "all");
  const [location, setLocation] = useListState(
    "supplierReturns.location",
    "all",
  );
  const supervisor = role === "supervisor";
  const columns = useTableColumns("supplier-returns", [
    {
      key: "reference",
      label: t("Return #", "شماره مرجوعی"),
      required: true,
      width: 110,
    },
    { key: "location", label: t("Location", "مکان"), width: 130 },
    { key: "created", label: t("Created", "ایجادشده"), width: 110 },
    { key: "items", label: t("Items", "اقلام"), width: 64, align: "end" },
    { key: "status", label: t("Status", "وضعیت"), width: 220 },
    ...(supervisor
      ? [
          {
            key: "credit",
            label: t("Pending credit", "اعتبار در انتظار"),
            width: 120,
            align: "end" as const,
          },
        ]
      : []),
    {
      key: "actions",
      label: t("Next action", "اقدام بعدی"),
      width: 100,
      align: "end",
      actions: true,
    },
  ]);
  const visible = rows.filter(
    (row) =>
      (tab === "open"
        ? row.ui_status === "waiting_for_pickup" ||
          row.ui_status === "waiting_for_credit"
        : row.ui_status === "closed" || row.ui_status === "cancelled") &&
      (status === "all" || row.ui_status === status) &&
      (location === "all" || row.branch === location) &&
      `${row.number} ${supplier} ${row.branch}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <div className="supplier-returns-panel">
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setStatus("all");
        }}
        aria-label={t("Supplier returns view", "نمایش مرجوعی‌های تأمین‌کننده")}
        options={[
          { value: "open", label: t("Open", "باز") },
          { value: "history", label: t("History", "تاریخچه") },
        ]}
      />
      <FilterToolbar
        aria-label={t("Filter returns", "فیلتر مرجوعی‌ها")}
        search={
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("Search returns", "جستجوی مرجوعی‌ها")}
            placeholder={t("Search returns", "جستجوی مرجوعی‌ها")}
          />
        }
        count={visible.length}
      >
        <Select
          aria-label={t("Status", "وضعیت")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: t("All statuses", "همه وضعیت‌ها") },
            ...(tab === "open"
              ? ["waiting_for_pickup", "waiting_for_credit"]
              : ["closed", "cancelled"]
            ).map((value) => ({ value, label: returnUiStatusLabel(value, t) })),
          ]}
        />
        <Select
          aria-label={t("Return branch", "شعبه مرجوعی")}
          value={location}
          onChange={setLocation}
          options={[
            { value: "all", label: t("All branches", "همه شعبه‌ها") },
            ...[...new Set(rows.map((row) => row.branch))].map((value) => ({
              value,
              label: branchLabel(state.config, value, lang),
            })),
          ]}
        />
        <Button
          variant="quiet"
          onClick={() => {
            setSearch("");
            setStatus("all");
            setLocation("all");
          }}
        >
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
        {columns.chooser}
      </FilterToolbar>
      {visible.length ? (
        <DataTable className="supplier-returns-table" columns={columns.columns}>
          <thead>
            <tr>
              <th>{t("Return #", "شماره مرجوعی")}</th>
              <th>{t("Location", "مکان")}</th>
              <th>{t("Created", "ایجادشده")}</th>
              <th>{t("Items", "اقلام")}</th>
              <th>{t("Status", "وضعیت")}</th>
              {supervisor && <th>{t("Pending credit", "اعتبار در انتظار")}</th>}
              <th>{t("Next action", "اقدام بعدی")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <a
                    className="returns-number-link"
                    href={`#return?id=${encodeURIComponent(row.id)}`}
                  >
                    <LtrText>#{row.number}</LtrText>
                  </a>
                </td>
                <td>{branchLabel(state.config, row.branch, lang)}</td>
                <td>
                  <DateText value={row.created_at} />
                </td>
                <td>{row.items}</td>
                <td>
                  <Badge>
                    {returnUiStatusLabel(row.ui_status, t)}
                    {row.closure_subtype &&
                      ` (${returnUiStatusLabel(row.closure_subtype, t)})`}
                  </Badge>
                </td>
                {supervisor && (
                  <td>
                    <Money value={row.financial?.pending_credit ?? "0.00"} />
                  </td>
                )}
                <td>
                  <Button asChild variant="secondary" size="sm">
                    <a href={`#return?id=${encodeURIComponent(row.id)}`}>
                      {t("View", "نمایش")}
                    </a>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState>
          {t(
            "No returns match these filters.",
            "هیچ مرجوعی با این فیلترها مطابقت ندارد.",
          )}
        </EmptyState>
      )}
    </div>
  );
}
