import { useState } from "react";
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
import { demoUserLabel, DateText, LtrText, Money } from "../presentation";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateField,
  Dialog,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Select,
} from "../ui";
import type { Activity } from "../types";
import "./history-b.css";

export default function History() {
  const { state, role, user, lang, t, tCount, historyContext, revertActivity } =
    useDemo();
  const [person, setPerson] = useState("all");
  const [branch, setBranch] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
  const visible = entries.filter(
    (entry) =>
      (person === "all" || entry.by === person) &&
      (branch === "all" || entry.branch === branch) &&
      (action === "all" || entry.action === action) &&
      (!from || entry.at.slice(0, 10) >= from) &&
      (!to || entry.at.slice(0, 10) <= to) &&
      (!search ||
        `${historyActionLabel(entry.action, lang)} ${entry.by} ${entry.product_code ?? ""} ${entry.entity_id ?? ""} ${JSON.stringify(entry.before)} ${JSON.stringify(entry.after)}`
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
  const value = (raw: unknown, patch?: ReversalPatch) => {
    if (raw === undefined || raw === null || raw === "")
      return <span className="muted">—</span>;
    if (typeof raw === "boolean") return raw ? t("Yes", "بله") : t("No", "خیر");
    if (
      typeof raw === "string" &&
      patch &&
      /price|cost/.test(String(patch.path.at(-1))) &&
      /^\d+(\.\d+)?$/.test(raw)
    )
      return <Money value={raw} />;
    if (typeof raw === "string") {
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
        review: ["Needs review", "نیاز به بررسی"],
        cleared: ["Cleared", "پاک‌شده"],
        confirmed: ["Confirmed", "تأییدشده"],
        proposed: ["Proposed", "پیشنهادی"],
      };
      if (statuses[raw]) return t(...statuses[raw]);
      return <bdi>{raw}</bdi>;
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
    const first = entry.reversal?.[0];
    if (first)
      return (
        <div className="history-value-summary">
          <span>{fieldLabel(first)}</span>
          <span>
            {value(first.before, first)} {lang === "fa" ? "←" : "→"}{" "}
            {value(first.after, first)}
          </span>
          {entry.reversal!.length > 1 && (
            <span className="muted">
              {tCount(
                "+{{count}} change",
                "+{{count}} changes",
                "+{{count}} تغییر",
                "+{{count}} تغییر",
                entry.reversal!.length - 1,
              )}
            </span>
          )}
        </div>
      );
    return <span className="muted">{t("Recorded action", "کار ثبت‌شده")}</span>;
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
        <DateField
          aria-label={t("From date", "از تاریخ")}
          value={from}
          onChange={setFrom}
        />
        <DateField
          aria-label={t("To date", "تا تاریخ")}
          value={to}
          onChange={setTo}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setPerson("all");
            setBranch("all");
            setAction("all");
            setFrom("");
            setTo("");
            setSearch("");
          }}
        >
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
      </FilterToolbar>
      <Card className="history-card">
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
              { width: 145 },
              { width: 160 },
              { width: 110 },
              { width: 190 },
              { width: 145 },
              { width: 280 },
              { width: 120, actions: true },
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
                    {entry.product_code ? (
                      <LtrText>
                        {t("Product Code", "کد محصول")} {entry.product_code}
                      </LtrText>
                    ) : entry.entity_type === "settings" ? (
                      t("Settings", "تنظیمات")
                    ) : entry.entity_type === "supplier" ? (
                      t("Supplier", "تأمین‌کننده")
                    ) : entry.entity_type?.includes("notebook") ? (
                      t("Notebooks", "دفترچه‌ها")
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{summary(entry)}</td>
                  <td>
                    {canReverse(state, entry, historyContext, "revert") ? (
                      <Button
                        variant="secondary"
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
          if (!open) setSelected(null);
        }}
        title={t("Revert change", "بازگردانی تغییر")}
        className="history-revert-dialog"
      >
        {selectedEntry && (
          <>
            <div className="history-revert-context">
              <strong>{historyActionLabel(selectedEntry.action, lang)}</strong>
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
                <Field key={index} label={fieldLabel(patch)}>
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
                  {changed && (
                    <p className="form-error">
                      {t(
                        "Changed since this action",
                        "پس از این کار تغییر کرده است",
                      )}
                    </p>
                  )}
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
            <div className="actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
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
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
