import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useDemo } from "../store";
import {
  canReverse,
  hasBeenReversed,
  historyChangePreview,
  selectHistory,
  type ReversalPatch,
} from "../history";
import {
  historyActionLabel,
  historyFieldLabel,
  historyErrorMessage,
} from "../history-copy";
import { branchLabel } from "../settings";
import {
  demoUserLabel,
  DateText,
  LtrText,
  Money,
  UnitText,
} from "../presentation";
import {
  historyChangeIsMoney,
  historyDisplayChanges,
  historyProductName,
  type HistoryDisplayChange,
} from "../history-display";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  Menu,
  MenuItem,
  PageHeader,
  Select,
} from "../ui";
import type { Activity } from "../types";
import { useListState } from "../navigation";
import { formatDate } from "../formatters";
import { ReceivedDateRange } from "./ReceivedDateRange";
import "./history-b.css";

function InvoiceVersionLinks({ entry }: { entry: Activity }) {
  const { t } = useDemo();
  if (entry.entity_type !== "invoice_content_correction" || !entry.entity_id)
    return null;
  const before = entry.before as { version_id?: string } | undefined;
  const after = entry.after as { version_id?: string } | undefined;
  if (!after?.version_id) return null;
  const route = `#invoices?id=${encodeURIComponent(entry.entity_id)}&version=`;
  return (
    <div className="actions history-invoice-version-links">
      <Button asChild variant="plain" size="sm">
        <a href={`${route}${encodeURIComponent(after.version_id)}`}>
          {t("View corrected", "نمایش اصلاح‌شده")}
        </a>
      </Button>
      <Menu
        iconOnly
        icon={<MoreHorizontal size={20} aria-hidden="true" />}
        label={t("More actions", "کارهای بیشتر")}
      >
        <MenuItem
          onClick={() => {
            window.location.hash = `${route}original`;
          }}
        >
          {t("View original", "نمایش اصل")}
        </MenuItem>
        {before?.version_id && before.version_id !== "original" && (
          <MenuItem
            onClick={() => {
              window.location.hash = `${route}${encodeURIComponent(before.version_id!)}`;
            }}
          >
            {t("View previous version", "نمایش نسخه قبلی")}
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}

export default function History() {
  const { state, role, user, lang, t, tCount, historyContext, revertActivity } =
    useDemo();
  const [filters, setFilters] = useListState("history", {
    person: "all",
    branch: "all",
    action: "all",
    from: "",
    to: "",
    search: "",
  });
  const { person, branch, action, from, to, search } = filters;
  const setPerson = (person: string) =>
    setFilters((current) => ({ ...current, person }));
  const setBranch = (branch: string) =>
    setFilters((current) => ({ ...current, branch }));
  const setAction = (action: string) =>
    setFilters((current) => ({ ...current, action }));
  const setSearch = (search: string) =>
    setFilters((current) => ({ ...current, search }));
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedChanges, setExpandedChanges] = useState<string[]>([]);
  if (!historyContext || !user || role === "cashier")
    return (
      <EmptyState>
        {t(
          "History is available to the Supervisor and Floor Workers.",
          "سابقه برای سرپرست و کارکنان سالن در دسترس است.",
        )}
      </EmptyState>
    );
  const entries = selectHistory(state, historyContext);
  const productName = (entry: Activity) =>
    historyProductName(state.products, entry, historyContext.company_id, lang);
  const visible = entries.filter(
    (entry) =>
      (person === "all" || entry.by === person) &&
      (branch === "all" || entry.branch === branch) &&
      (action === "all" || entry.action === action) &&
      (!from || formatDate(entry.at, state.config.company.timezone) >= from) &&
      (!to || formatDate(entry.at, state.config.company.timezone) <= to) &&
      (!search ||
        `${historyActionLabel(entry.action, lang)} ${entry.by} ${productName(entry) ?? ""} ${entry.product_code ?? ""} ${entry.entity_id ?? ""} ${JSON.stringify(entry.before)} ${JSON.stringify(entry.after)}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const selectedEntry = entries.find((entry) => entry.id === selected);
  const preview = selectedEntry
    ? historyChangePreview(state, selectedEntry)
    : [];
  const conflict = preview.some((item) => item.conflict);
  const fieldLabel = (patch: ReversalPatch) => {
    const last = patch.path.at(-1);
    const previous = patch.path.at(-2);
    return historyFieldLabel(
      typeof last === "string"
        ? last
        : typeof previous === "string"
          ? previous
          : "record",
      lang,
    );
  };
  const value = (
    raw: unknown,
    patch?: ReversalPatch | HistoryDisplayChange,
  ) => {
    if (raw === undefined || raw === null || raw === "")
      return <span className="muted">—</span>;
    if (typeof raw === "boolean") return raw ? t("Yes", "بله") : t("No", "خیر");
    if (
      (typeof raw === "string" || typeof raw === "number") &&
      patch &&
      ("field" in patch
        ? historyChangeIsMoney(patch)
        : /price|cost|amount|total/.test(String(patch.path.at(-1)))) &&
      /^-?\d+(\.\d+)?$/.test(String(raw))
    )
      return <Money value={raw} />;
    if (typeof raw === "string") {
      const field = patch
        ? "field" in patch
          ? patch.field
          : String(patch.path.at(-1))
        : undefined;
      if (field === "supplier_invoice_number" || field === "invoice_number")
        return <LtrText className="history-invoice-reference">{raw}</LtrText>;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return <DateText value={raw} />;
      const statuses: Record<string, [string, string]> = {
        active: ["Active", "فعال"],
        stopped: ["Stopped", "متوقف‌شده"],
        approved: ["Approved", "تأییدشده"],
        pending: ["Pending", "در انتظار"],
        rejected: ["Rejected", "ردشده"],
        open: ["Open", "باز"],
        done: ["Done", "انجام‌شده"],
        resolved: ["Resolved", "حل‌شده"],
        read: ["Read", "خوانده‌شده"],
        draft: ["Draft", "پیش‌نویس"],
        ordered: ["Ordered", "سفارش‌داده‌شده"],
        partially_received: ["Partially received", "بخشی دریافت‌شده"],
        received: ["Received", "دریافت‌شده"],
        cancelled: ["Cancelled", "لغوشده"],
        scheduled: ["Scheduled", "زمان‌بندی‌شده"],
        ended: ["Ended", "پایان‌یافته"],
        withdrawn: ["Withdrawn", "پس‌گرفته‌شده"],
        expired: ["Expired", "منقضی‌شده"],
        review: ["Needs review", "نیاز به بررسی"],
        cleared: ["Cleared", "پاک‌شده"],
        removed: ["Removed", "حذف‌شده"],
        sold_out: ["Sold out", "فروخته شد"],
        thrown_away: ["Thrown away", "دور ریخته شد"],
        returned_to_supplier: [
          "Returned to supplier",
          "به تأمین‌کننده برگشت داده شد",
        ],
        entered_by_mistake: ["Entered by mistake", "اشتباهی وارد شد"],
        stop_tracking: ["Stop tracking this product", "توقف پیگیری این کالا"],
        expiry: ["Expiry", "انقضا"],
        best_before: ["Best before", "بهترین زمان مصرف"],
        manual: ["Manual", "دستی"],
        invoice: ["Invoice", "فاکتور"],
        correction: ["Correction", "اصلاح"],
        undo: ["Undo", "واگرد"],
        remove: ["Remove", "حذف"],
        superseded: ["Superseded", "جایگزین‌شده"],
        confirmed: ["Confirmed", "تأییدشده"],
        proposed: ["Proposed", "پیشنهادی"],
      };
      if (statuses[raw]) return t(...statuses[raw]);
      return (
        <bdi>
          <UnitText>{raw}</UnitText>
        </bdi>
      );
    }
    if (typeof raw === "number") return <LtrText>{raw}</LtrText>;
    if (Array.isArray(raw))
      return tCount(
        "{{count}} item",
        "{{count}} items",
        "{{count}} مورد",
        "{{count}} مورد",
        raw.length,
      );
    const record = raw as Record<string, unknown>;
    return (
      <bdi>
        {String(
          record[lang === "fa" ? "name_fa" : "name_en"] ??
            record.name ??
            record.text ??
            record.code ??
            t("Recorded values", "مقادیر ثبت‌شده"),
        )}
      </bdi>
    );
  };
  const summary = (entry: Activity) => {
    const changes = historyDisplayChanges(entry);
    const expanded = expandedChanges.includes(entry.id);
    const displayChange = (change: HistoryDisplayChange, index: number) => {
      const label = historyFieldLabel(change.field, lang);
      return (
        <div className="history-recorded-change" key={index}>
          {label !== t("Recorded values", "مقادیر ثبت‌شده") && (
            <span className="muted">{label}</span>
          )}
          <span>
            {value(change.before, change)} {lang === "fa" ? "←" : "→"}{" "}
            {value(change.after, change)}
          </span>
        </div>
      );
    };
    if (changes.length)
      return (
        <div className="history-value-summary">
          {(expanded ? changes : changes.slice(0, 1)).map(displayChange)}
          {changes.length > 1 && (
            <Button
              variant="plain"
              size="sm"
              aria-expanded={expanded}
              onClick={() =>
                setExpandedChanges((current) =>
                  expanded
                    ? current.filter((id) => id !== entry.id)
                    : [...current, entry.id],
                )
              }
            >
              {tCount(
                "+{{count}} change",
                "+{{count}} changes",
                "+{{count}} تغییر",
                "+{{count}} تغییر",
                changes.length - 1,
              )}
            </Button>
          )}
        </div>
      );
    return <span className="muted">—</span>;
  };
  return (
    <>
      <PageHeader
        title={t("History", "سابقه")}
        description={
          role === "supervisor"
            ? t(
                "Review recorded actions and before-and-after values.",
                "کارهای ثبت‌شده و مقادیر پیش و پس از تغییر را بررسی کنید.",
              )
            : t(
                "Review your recorded actions.",
                "کارهای ثبت‌شده خود را بررسی کنید.",
              )
        }
      />
      {message && (
        <p role="status" className="banner success">
          {message}
        </p>
      )}
      <Card className="history-card">
        <FilterToolbar
          className="history-toolbar"
          search={
            <input
              aria-label={t("Search History", "جستجوی سابقه")}
              placeholder={t("Search History", "جستجوی سابقه")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
          count={tCount(
            "{{count}} action",
            "{{count}} actions",
            "{{count}} کار",
            "{{count}} کار",
            visible.length,
          )}
        >
          <Select
            aria-label={t("Person", "شخص")}
            value={person}
            onChange={setPerson}
            options={[
              { value: "all", label: t("All people", "همه افراد") },
              ...[...new Set(entries.map((entry) => entry.by))].map((name) => ({
                value: name,
                label: demoUserLabel(name, lang),
              })),
            ]}
          />
          <Select
            aria-label={t("History branch", "شعبه سابقه")}
            value={branch}
            onChange={setBranch}
            options={[
              { value: "all", label: t("All branches", "همه شعبه‌ها") },
              ...historyContext.allowed_branches.map((id) => ({
                value: id,
                label: branchLabel(state.config, id, lang),
              })),
            ]}
          />
          <Select
            aria-label={t("Action type", "نوع کار")}
            value={action}
            onChange={setAction}
            options={[
              { value: "all", label: t("All actions", "همه کارها") },
              ...[...new Set(entries.map((entry) => entry.action))].map(
                (name) => ({
                  value: name,
                  label: historyActionLabel(name, lang),
                }),
              ),
            ]}
          />
          <ReceivedDateRange
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) =>
              setFilters((current) => ({
                ...current,
                from: nextFrom,
                to: nextTo,
              }))
            }
          />
          <Button
            variant="plain"
            onClick={() => {
              setPerson("all");
              setBranch("all");
              setAction("all");
              setFilters((current) => ({ ...current, from: "", to: "" }));
              setSearch("");
            }}
          >
            {t("Clear filters", "پاک کردن فیلترها")}
          </Button>
        </FilterToolbar>
        {!visible.length ? (
          <EmptyState>
            {t(
              "No actions match these filters. Clear the filters to see History.",
              "هیچ کاری با این فیلترها مطابقت ندارد. برای دیدن سابقه، فیلترها را پاک کنید.",
            )}
          </EmptyState>
        ) : (
          <DataTable
            className="history-table"
            columns={[
              {
                key: "time",
                width: 150,
                priority: 1,
                required: true,
                minWidth: 140,
                mobilePrimary: true,
              },
              { key: "person", width: 150, priority: 5, mobilePrimary: false },
              { key: "branch", width: 120, priority: 6, mobilePrimary: false },
              { key: "action", width: 170, priority: 4, mobilePrimary: false },
              {
                key: "item",
                width: 260,
                priority: 0,
                required: true,
                minWidth: 240,
                mobilePrimary: true,
              },
              {
                key: "values",
                width: 240,
                priority: 2,
                minWidth: 210,
                mobilePrimary: true,
              },
              { key: "actions", width: 120, actions: true },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Time", "زمان")}</th>
                <th>{t("Person", "شخص")}</th>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Action", "کار")}</th>
                <th>{t("Item", "مورد")}</th>
                <th>{t("Before → after", "پیش ← پس")}</th>
                <th>{t("Actions", "عملیات")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <DateText value={entry.at} />
                    <small className="muted">
                      <LtrText>
                        {new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: state.config.company.timezone,
                        }).format(new Date(entry.at))}
                      </LtrText>
                    </small>
                  </td>
                  <td>{demoUserLabel(entry.by, lang)}</td>
                  <td>
                    <span className="history-branch">
                      {branchLabel(state.config, entry.branch, lang)}
                    </span>
                  </td>
                  <td>{historyActionLabel(entry.action, lang)}</td>
                  <td>
                    {productName(entry) ? (
                      <bdi dir="auto">
                        <UnitText>{productName(entry)!}</UnitText>
                      </bdi>
                    ) : entry.product_code ? (
                      <LtrText>
                        {t("Product Code", "کد محصول")} {entry.product_code}
                      </LtrText>
                    ) : entry.entity_type === "invoice_content_correction" ? (
                      t("Invoice", "فاکتور")
                    ) : entry.entity_type === "settings" ? (
                      t("Settings", "تنظیمات")
                    ) : entry.entity_type === "supplier" ? (
                      t("Supplier", "تأمین‌کننده")
                    ) : entry.entity_type === "order" ? (
                      t("Orders", "سفارش‌ها")
                    ) : entry.entity_type === "branch_request" ? (
                      t("Branch requests", "درخواست‌های شعب")
                    ) : entry.entity_type === "supplier_item" ? (
                      t("Supplier items", "کالاهای تأمین‌کننده")
                    ) : entry.entity_type?.includes("notebook") ? (
                      t("Notebooks", "دفترچه‌ها")
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{summary(entry)}</td>
                  <td>
                    {entry.entity_type === "invoice_content_correction" ? (
                      <InvoiceVersionLinks entry={entry} />
                    ) : canReverse(state, entry, historyContext, "revert") ? (
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => {
                          setSelected(entry.id);
                          setError("");
                          setMessage("");
                        }}
                      >
                        {t("Revert", "بازگردانی")}
                      </Button>
                    ) : hasBeenReversed(state, entry.id) ? (
                      <Badge tone="neutral">
                        {t("Reverted", "بازگردانده‌شده")}
                      </Badge>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setError("");
          }
        }}
        title={t("Revert change", "بازگردانی تغییر")}
        description={
          selectedEntry
            ? historyActionLabel(selectedEntry.action, lang)
            : undefined
        }
        className="history-revert-dialog"
      >
        {selectedEntry && (
          <>
            <div className="history-revert-context">
              <span>
                {demoUserLabel(selectedEntry.by, lang)} ·{" "}
                {branchLabel(state.config, selectedEntry.branch, lang)} ·{" "}
                <DateText value={selectedEntry.at} />
              </span>
            </div>
            <p className="muted">
              {t(
                "Review the values that will be restored. This creates a new History entry.",
                "مقادیری که بازیابی می‌شوند را بررسی کنید. این کار یک سابقه جدید ایجاد می‌کند.",
              )}
            </p>
            <div className="history-revert-fields">
              {preview.map(({ patch, current, conflict: changed }, index) => (
                <Field
                  key={index}
                  label={fieldLabel(patch)}
                  error={
                    changed
                      ? t(
                          "Changed since this action",
                          "پس از این کار تغییر کرده است",
                        )
                      : undefined
                  }
                >
                  <div className="history-revert-values">
                    <div>
                      <span className="muted">{t("Current", "فعلی")}</span>
                      <span>{value(current, patch)}</span>
                    </div>
                    <span aria-hidden="true">{lang === "fa" ? "←" : "→"}</span>
                    <div>
                      <span className="muted">{t("Restore", "بازیابی")}</span>
                      <span>
                        {!patch.before_exists && patch.creation !== "remove"
                          ? t("Archived", "بایگانی‌شده")
                          : value(patch.before, patch)}
                      </span>
                    </div>
                  </div>
                </Field>
              ))}
            </div>
            {(conflict || error) && (
              <p className="banner danger" role="alert">
                {error ||
                  t(
                    "This item changed again. Review the latest values before making another change.",
                    "این مورد دوباره تغییر کرده است. پیش از تغییر بعدی، آخرین مقادیر را بررسی کنید.",
                  )}
              </p>
            )}
            <DialogActions>
              <Button
                variant="neutral"
                onClick={() => {
                  setSelected(null);
                  setError("");
                }}
              >
                {t("Cancel", "لغو")}
              </Button>
              <Button
                disabled={conflict}
                onClick={() => {
                  try {
                    revertActivity(selectedEntry.id);
                    setSelected(null);
                    setMessage(t("Change reverted", "تغییر بازگردانده شد"));
                  } catch (caught) {
                    setError(historyErrorMessage(caught, t));
                  }
                }}
              >
                {t("Revert change", "بازگردانی تغییر")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
