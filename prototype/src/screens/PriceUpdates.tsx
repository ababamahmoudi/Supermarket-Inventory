import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Eye,
  Printer,
} from "lucide-react";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import { useRouteParam } from "../navigation";
import {
  priceUpdateTasks,
  priceUpdateProgress,
  markPriceTaskSeen,
  completePriceTasks,
  bulkPriceTasks,
  type PriceUpdateTask,
} from "../price-updates";
import { priceUpdatesCsv } from "../price-updates-csv";
import { PriceLabelPrintDialog } from "./PriceLabelPrint";
import { useTimedToast } from "../use-timed-toast";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Select,
  Tabs,
} from "../ui";
import { LtrText, NotAdded, ProductName } from "../presentation";
import { branchLabel } from "../settings";
import { companyDate, dateAfter } from "../invoice";
import { companyDateTime, companyTimestampText } from "../company-time";
import {
  PriceUpdateChange,
  PriceUpdateValue,
  SaleEndTaskTitle,
} from "../price-update-presentation";
import { priceUpdateReasonLabel } from "../price-update-copy";
import { ReceivedDateRange } from "./ReceivedDateRange";
import type { ResourceScope } from "../authority-types";
import "./price-updates-e2.css";

function taskScope(
  company_id: string,
  branch: string,
  mutation = false,
): ResourceScope {
  return {
    company_id,
    kind: "location_record",
    location_ids: [branch],
    mutation,
    location_policy: "active_only",
  };
}
export function PriceUpdates() {
  const { state, actor, can, lang, t, tCount, navigate } = useDemo();
  const requestedId = useRouteParam("id");
  const progress = useRouteParam("view") === "progress";
  const requestedLocation = useRouteParam("location") ?? "all";
  const requestedStatus =
    useRouteParam("status") === "done" ? "done" : "pending";
  const filterKey = JSON.stringify([requestedLocation, requestedStatus]);
  const [filters, setFilters] = useState({
    key: filterKey,
    location: requestedLocation,
    status: requestedStatus,
  });
  const location =
    filters.key === filterKey ? filters.location : requestedLocation;
  const status = filters.key === filterKey ? filters.status : requestedStatus;
  const setLocation = (value: string) =>
    setFilters({ key: filterKey, location: value, status });
  const setStatus = (value: string) =>
    setFilters({ key: filterKey, location, status: value });
  const today = companyDate(state.config);
  const last30 = {
    first: dateAfter(today, -29),
    last: today,
    en: "Last 30 days",
    fa: "۳۰ روز گذشته",
  };
  const [pendingRange, setPendingRange] = useState({ from: "", to: "" });
  // PR 29 (Ali, 2026-11-20): Done updates are kept forever; the Done tab
  // opens on the last 30 days and the dates reach older ones.
  const [doneRange, setDoneRange] = useState({
    from: last30.first,
    to: last30.last,
  });
  const range = status === "done" ? doneRange : pendingRange;
  const setRange = status === "done" ? setDoneRange : setPendingRange;
  const [selected, setSelected] = useState<string[]>([]);
  const [printTasks, setPrintTasks] = useState<PriceUpdateTask[]>([]);
  const [toast, setToast] = useTimedToast();
  const [error, setError] = useState("");
  const { command } = useDemo();
  const company = state.config.company.seed_key;
  const result = useProtectedQuery(
    "price_updates.read",
    { company_id: company, kind: "company_shared" },
    (canonical, freshActor) =>
      progress && can("dashboard.company")
        ? priceUpdateProgress(canonical, freshActor)
        : priceUpdateTasks(canonical, freshActor),
    `price-updates:${progress}`,
  );
  const tasks = result.data ?? [];
  const dayOf = (value?: string) =>
    value ? companyDate(state.config, new Date(value)) : "";
  const visible = tasks
    .filter((item) => {
      if (item.status !== status) return false;
      if (location !== "all" && item.branch !== location) return false;
      const day = dayOf(
        status === "done" ? item.completed_at : item.created_at,
      );
      return (
        (!range.from || day >= range.from) && (!range.to || day <= range.to)
      );
    })
    .sort((a, b) =>
      status === "done"
        ? (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
        : 0,
    );
  const selectable = status === "pending" ? visible : [];
  const selection = selected.filter((id) =>
    selectable.some((item) => item.id === id),
  );
  const selectedTasks = selectable.filter((item) =>
    selection.includes(item.id),
  );
  const ownedLocations = [...new Set(tasks.map((item) => item.branch))];
  const scopedIdentity = actor
    ? `${actor.company_id}:${actor.session_id}:${actor.authority_epoch}`
    : "";
  const currentIdentity = useRef(scopedIdentity);
  useEffect(() => {
    currentIdentity.current = scopedIdentity;
  }, [scopedIdentity]);
  const shortStamp = (at: string) => {
    const local = companyDateTime(state.config, at);
    return local.date === today ? local.time : local.date;
  };
  const productName = (task: PriceUpdateTask) => {
    const product = state.products.find(
      (item) =>
        item.company_id === task.company_id && item.code === task.product_code,
    );
    return product
      ? lang === "fa"
        ? product.name_fa || product.name_en
        : product.name_en
      : task.product_code;
  };
  const bulk = async (mode: "seen" | "done") => {
    if (!actor || !selection.length) return;
    try {
      // Each row is checked by the single-update rules inside bulkPriceTasks
      // (Seen needs read, Done needs complete, per location); rows the person
      // may not change are skipped and counted, never changed.
      const outcome = await command(
        "price_updates.read",
        {
          company_id: company,
          kind: "location_record",
          location_ids: [...new Set(selectedTasks.map((item) => item.branch))],
          mutation: true,
          location_policy: "active_only",
        },
        (draft, freshActor) =>
          bulkPriceTasks(draft, freshActor, selection, mode),
      );
      if (currentIdentity.current !== scopedIdentity) return;
      const changed = outcome.changed.length;
      const skipped = outcome.skipped.length;
      setToast(
        (mode === "done"
          ? t(`Marked ${changed} as done`, `${changed} مورد انجام‌شده شد`)
          : t(`Marked ${changed} as seen`, `${changed} مورد دیده‌شده شد`)) +
          (skipped
            ? ` · ${t(`${skipped} skipped`, `${skipped} مورد رد شد`)}`
            : ""),
      );
      setSelected([]);
      setError("");
    } catch {
      if (currentIdentity.current === scopedIdentity)
        setError(
          t(
            "Some selected price updates changed. Open the list again.",
            "برخی از به‌روزرسانی‌های انتخاب‌شده تغییر کرده‌اند. فهرست را دوباره باز کنید.",
          ),
        );
    }
  };
  const exportCsv = () => {
    const csv = priceUpdatesCsv(visible, {
      product: productName,
      location: (task) => branchLabel(state.config, task.branch, lang),
      stamp: (at) => companyTimestampText(state.config, at),
    });
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `price-updates-done-${range.from || "start"}-to-${range.to || today}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  if (
    !actor ||
    !can("price_updates.read") ||
    (location !== "all" && !actor.allowed_branches.includes(location))
  )
    return (
      <EmptyState>
        {t(
          "You do not have permission for this action.",
          "اجازهٔ انجام این کار را ندارید.",
        )}
      </EmptyState>
    );
  if (requestedId)
    return (
      <PriceUpdateDetail
        key={`${scopedIdentity}:${requestedId}`}
        id={requestedId}
      />
    );
  const isManager = can("dashboard.company");
  const allSelected =
    selectable.length > 0 && selection.length === selectable.length;
  const step = (
    kind: "seen" | "done",
    stamp: { by: string; at: string } | null,
  ) => (
    <span
      className={`price-updates-step ${stamp ? "is-complete" : kind === "seen" ? "is-pending" : "is-waiting"}`}
    >
      <span className="price-updates-step-dot" aria-hidden="true" />
      <span className="price-updates-step-label">
        {kind === "seen" ? t("Seen", "دیده‌شده") : t("Done", "انجام‌شده")}
      </span>
      {stamp ? (
        <span className="price-updates-step-copy">
          <bdi>{stamp.by}</bdi>
          <LtrText className="muted">{shortStamp(stamp.at)}</LtrText>
        </span>
      ) : (
        <span className="price-updates-step-copy">
          {kind === "seen"
            ? t("Not seen yet", "هنوز دیده نشده")
            : t("Not done yet", "هنوز انجام نشده")}
        </span>
      )}
    </span>
  );
  return (
    <div className="price-updates-page" data-pwa-unsaved={selection.length > 0}>
      <PageHeader
        title={t("Price updates", "به‌روزرسانی قیمت‌ها")}
        description={t(
          "The price in the app changes right away. Mark each update as seen, then done once the register and shelf label match.",
          "قیمت در برنامه بلافاصله تغییر می‌کند. هر به‌روزرسانی را دیده‌شده علامت بزنید و پس از هماهنگ شدن صندوق و برچسب قفسه، انجام‌شده.",
        )}
        actions={
          isManager && progress ? (
            <Button
              variant="neutral"
              onClick={() =>
                navigate(
                  progress ? "price-updates" : "price-updates?view=progress",
                )
              }
            >
              {progress
                ? t("Price updates", "به‌روزرسانی قیمت‌ها")
                : t("Store progress", "پیشرفت فروشگاه‌ها")}
            </Button>
          ) : undefined
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {progress && isManager ? (
        <PriceUpdateProgress tasks={tasks} />
      ) : (
        <Card className="price-updates-card">
          <FilterToolbar
            aria-label={t("Price update filters", "فیلترهای به‌روزرسانی قیمت")}
            count={tCount(
              "{{count}} price update",
              "{{count}} price updates",
              "{{count}} به‌روزرسانی قیمت",
              "{{count}} به‌روزرسانی قیمت",
              visible.length,
            )}
            actions={
              <>
                {status === "done" && (
                  <Button
                    variant="neutral"
                    disabled={!visible.length}
                    onClick={exportCsv}
                  >
                    <Download size={18} aria-hidden="true" />
                    {t("Export CSV", "خروجی CSV")}
                  </Button>
                )}
                {isManager && (
                  <Button
                    variant="neutral"
                    onClick={() => navigate("price-updates?view=progress")}
                  >
                    {t("Store progress", "پیشرفت فروشگاه‌ها")}
                  </Button>
                )}
              </>
            }
            leading={
              <Tabs
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setSelected([]);
                }}
                options={[
                  {
                    value: "pending",
                    label: t("Pending", "در انتظار"),
                    count: tasks.filter((item) => item.status === "pending")
                      .length,
                  },
                  {
                    value: "done",
                    label: t("Done", "انجام‌شده"),
                    count: tasks.filter((item) => item.status === "done")
                      .length,
                  },
                ]}
              />
            }
          >
            <Field label={t("Location", "مکان")}>
              <Select
                value={location}
                onChange={setLocation}
                options={[
                  {
                    value: "all",
                    label: t("All my locations", "همهٔ مکان‌های من"),
                  },
                  ...ownedLocations.map((id) => ({
                    value: id,
                    label: branchLabel(state.config, id, lang),
                  })),
                ]}
              />
            </Field>
            <ReceivedDateRange
              from={range.from}
              to={range.to}
              preset={status === "done" ? last30 : undefined}
              onChange={(from, to) => setRange({ from, to })}
            />
            {(status !== "pending" ||
              location !== "all" ||
              pendingRange.from ||
              pendingRange.to) && (
              <Button
                variant="plain"
                onClick={() => {
                  setFilters({
                    key: filterKey,
                    location: "all",
                    status: "pending",
                  });
                  setPendingRange({ from: "", to: "" });
                  setDoneRange({ from: last30.first, to: last30.last });
                }}
              >
                {t("Clear filters", "پاک کردن فیلترها")}
              </Button>
            )}
          </FilterToolbar>
          {status === "done" && (
            <p className="muted price-updates-retention">
              {t(
                "Done updates are kept forever. Change the dates to see older ones.",
                "موارد انجام‌شده برای همیشه نگه داشته می‌شوند. برای موارد قدیمی‌تر تاریخ را عوض کنید.",
              )}
            </p>
          )}
          {result.pending ? (
            <p role="status">{t("Loading…", "در حال بارگذاری…")}</p>
          ) : result.error ? (
            <p role="alert">
              {t(
                "You do not have permission for this action.",
                "اجازهٔ انجام این کار را ندارید.",
              )}
            </p>
          ) : !visible.length ? (
            <EmptyState>
              {tasks.length === 0
                ? t(
                    "No price updates yet; approved price changes will appear here for the register and shelf labels.",
                    "هنوز به‌روزرسانی قیمتی وجود ندارد؛ تغییرات قیمت تأییدشده برای صندوق و برچسب قفسه اینجا نمایش داده می‌شوند.",
                  )
                : t(
                    "No price updates match these filters.",
                    "به‌روزرسانی قیمتی با این فیلترها پیدا نشد.",
                  )}
            </EmptyState>
          ) : (
            <div className="price-updates-list">
              <div className="price-updates-table-header">
                {status === "pending" ? (
                  <Checkbox
                    className="price-updates-select-all"
                    aria-label={t(
                      "Select all on this page",
                      "انتخاب همه در این صفحه",
                    )}
                    checked={allSelected}
                    onChange={(checked) =>
                      setSelected(
                        checked ? selectable.map((item) => item.id) : [],
                      )
                    }
                  >
                    <span className="price-updates-select-all-text">
                      {t("Select all on this page", "انتخاب همه در این صفحه")}
                    </span>
                  </Checkbox>
                ) : (
                  <span />
                )}
                <span className="price-updates-wide-heading">
                  {t("Product", "کالا")}
                </span>
                <span className="price-updates-price-heading price-updates-wide-heading">
                  {t("Price", "قیمت")}
                </span>
                <span className="price-updates-wide-heading price-updates-step-heading">
                  {t("Seen", "دیده‌شده")}
                </span>
                <span className="price-updates-wide-heading price-updates-step-heading">
                  {t("Done", "انجام‌شده")}
                </span>
                <span className="price-updates-wide-heading price-updates-action-heading">
                  {t("Action", "اقدام")}
                </span>
              </div>
              {visible.map((task) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === task.company_id &&
                    item.code === task.product_code,
                );
                const seen =
                  task.seen?.version === task.version ? task.seen : null;
                const done =
                  task.status === "done" && task.completed_at
                    ? { by: task.completed_by ?? "", at: task.completed_at }
                    : null;
                const scope = taskScope(task.company_id, task.branch);
                const isSelected = selection.includes(task.id);
                const open = () =>
                  navigate(`price-update?id=${encodeURIComponent(task.id)}`);
                return (
                  <div
                    className={`price-updates-row${isSelected ? " is-selected" : ""}`}
                    key={task.id}
                    role="link"
                    tabIndex={0}
                    data-control-kind="disclosure"
                    onClick={(event) => {
                      if (
                        event.target instanceof Element &&
                        !event.target.closest(
                          "button,a,input,textarea,[role=checkbox],[role=combobox]",
                        )
                      )
                        open();
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        ["Enter", " "].includes(event.key)
                      ) {
                        event.preventDefault();
                        open();
                      }
                    }}
                  >
                    {task.status === "pending" ? (
                      <Checkbox
                        aria-label={`${t("Select", "انتخاب")} ${productName(task)}`}
                        checked={isSelected}
                        onChange={(checked) =>
                          setSelected(
                            checked
                              ? [...selection, task.id]
                              : selection.filter((id) => id !== task.id),
                          )
                        }
                      />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <div className="price-updates-product">
                      {product ? (
                        <ProductName product={product} language={lang} />
                      ) : (
                        <LtrText>{task.product_code}</LtrText>
                      )}
                      <small className="muted price-updates-meta">
                        {branchLabel(state.config, task.branch, lang)} ·{" "}
                        {priceUpdateReasonLabel(task.reason, lang)}
                        {task.decided_by && (
                          <>
                            {" "}
                            · <bdi>{task.decided_by}</bdi>
                          </>
                        )}
                      </small>
                      {task.sale_end_preparation && (
                        <small>
                          <SaleEndTaskTitle task={task} />
                        </small>
                      )}
                      <div className="price-updates-compact-steps">
                        {step("seen", seen)}
                        {step("done", done)}
                      </div>
                    </div>
                    <PriceUpdateChange task={task} />
                    <div className="price-updates-wide-cell">
                      {step("seen", seen)}
                    </div>
                    <div className="price-updates-wide-cell">
                      {step("done", done)}
                    </div>
                    <div className="price-updates-row-actions">
                      {task.status === "pending" && (
                        <Button
                          variant="tinted"
                          size="sm"
                          className="price-updates-print"
                          disabled={
                            !can("labels.print", scope) &&
                            !can("labels.queue_write", {
                              ...scope,
                              mutation: true,
                            })
                          }
                          onClick={() => setPrintTasks([task])}
                        >
                          {t("Print label", "چاپ برچسب")}
                        </Button>
                      )}
                      <Button
                        variant="plain"
                        className="price-update-open"
                        aria-label={`${t("Open price update", "باز کردن به‌روزرسانی قیمت")} ${productName(task)}`}
                        onClick={open}
                      >
                        <ChevronRight className="directional" size={20} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {selection.length > 0 && (
            <div
              className="price-updates-bulk-bar"
              role="region"
              aria-label={t(
                "Selected price updates",
                "به‌روزرسانی‌های انتخاب‌شده",
              )}
            >
              <p className="price-updates-bulk-count">
                <strong>
                  {t(
                    `${selection.length} selected`,
                    `${selection.length} انتخاب شده`,
                  )}
                </strong>
                {!allSelected && (
                  <>
                    {" · "}
                    <Button
                      variant="plain"
                      onClick={() =>
                        setSelected(selectable.map((item) => item.id))
                      }
                    >
                      {t(
                        `Select all ${selectable.length}`,
                        `انتخاب هر ${selectable.length}`,
                      )}
                    </Button>
                  </>
                )}
                {" · "}
                <Button variant="plain" onClick={() => setSelected([])}>
                  {t("Clear", "پاک کردن")}
                </Button>
              </p>
              <div className="price-updates-bulk-actions">
                <Button
                  variant="neutral"
                  onClick={() => setPrintTasks(selectedTasks)}
                >
                  <Printer size={18} aria-hidden="true" />
                  {t("Print labels", "چاپ برچسب‌ها")}
                </Button>
                <Button variant="tinted" onClick={() => void bulk("seen")}>
                  {t("Mark as seen", "علامت دیده‌شده")}
                </Button>
                {can("price_updates.complete") && (
                  <Button onClick={() => void bulk("done")}>
                    {t("Mark as done", "علامت انجام‌شده")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
      <PriceLabelPrintDialog
        key={printTasks.map((task) => task.id).join(",")}
        tasks={printTasks}
        open={printTasks.length > 0}
        onOpenChange={(next) => {
          if (!next) setPrintTasks([]);
        }}
        onNotice={(message) => {
          setToast(message);
          setSelected([]);
        }}
      />
      {toast}
    </div>
  );
}

export function PriceUpdateProgress({ tasks }: { tasks: PriceUpdateTask[] }) {
  const { state, can, lang, t, navigate } = useDemo();
  if (!can("dashboard.company")) return null;
  const groups = new Map<string, PriceUpdateTask[]>();
  tasks
    .filter((task) => task.status !== "cancelled")
    .forEach((task) => {
      const key = `${task.source_activity_id ?? task.product_code}:${task.product_code}`;
      groups.set(key, [...(groups.get(key) ?? []), task]);
    });
  return (
    <div className="price-update-progress-group">
      {groups.size ? (
        [...groups.entries()].map(([key, rows]) => {
          const product = state.products.find(
            (item) =>
              item.company_id === rows[0].company_id &&
              item.code === rows[0].product_code,
          );
          return (
            <Card
              key={key}
              title={
                product
                  ? lang === "fa"
                    ? product.name_fa || product.name_en
                    : product.name_en
                  : rows[0].product_code
              }
            >
              {rows.map((task) => (
                <div className="price-update-progress-row" key={task.id}>
                  <div>
                    <strong>
                      {branchLabel(state.config, task.branch, lang)}
                    </strong>
                    <div>
                      <PriceUpdateChange task={task} />
                    </div>
                    {task.completed_at && (
                      <small className="muted">
                        <bdi>{task.completed_by}</bdi> ·{" "}
                        <LtrText>
                          {companyTimestampText(
                            state.config,
                            task.completed_at,
                          )}
                        </LtrText>
                      </small>
                    )}
                  </div>
                  <Button
                    variant="plain"
                    onClick={() =>
                      navigate(`price-update?id=${encodeURIComponent(task.id)}`)
                    }
                  >
                    {task.status === "done"
                      ? t("Done", "انجام‌شده")
                      : t("Pending", "در انتظار")}
                  </Button>
                </div>
              ))}
            </Card>
          );
        })
      ) : (
        <EmptyState>
          {t("No price updates yet.", "هنوز به‌روزرسانی قیمتی وجود ندارد.")}
        </EmptyState>
      )}
    </div>
  );
}

function PriceUpdateDetail({ id }: { id: string }) {
  const { state, actor, can, command, t, lang, navigate } = useDemo();
  const result = useProtectedQuery(
    "price_updates.read",
    { company_id: state.config.company.seed_key, kind: "company_shared" },
    (canonical, freshActor) =>
      priceUpdateTasks(canonical, freshActor).find((item) => item.id === id) ??
      null,
    `price-update:${id}`,
  );
  const task = result.data;
  const [error, setError] = useState("");
  // The print flow keeps its own copy of the task: recording the print
  // reloads this page's data, and the dialog must stay mounted meanwhile.
  const [printTask, setPrintTask] = useState<PriceUpdateTask | null>(null);
  const [toast, setToast] = useTimedToast();
  // Same position in every branch, so the open print flow is never remounted.
  const withPrintDialog = (body: ReactNode) => (
    <>
      {body}
      <PriceLabelPrintDialog
        tasks={printTask ? [printTask] : []}
        open={printTask !== null}
        onOpenChange={(next) => {
          if (!next) setPrintTask(null);
        }}
        onNotice={setToast}
      />
      {toast}
    </>
  );
  const intent = actor
    ? `${actor.session_id}:${actor.authority_epoch}:${id}`
    : "";
  const currentIntent = useRef(intent);
  useEffect(() => {
    currentIntent.current = intent;
  }, [intent]);
  const fail = () =>
    setError(
      t(
        "This price update has changed. Open it again.",
        "این به‌روزرسانی قیمت تغییر کرده است. دوباره آن را باز کنید.",
      ),
    );
  const run = async (
    action: (
      draft: Parameters<typeof markPriceTaskSeen>[0],
      freshActor: Parameters<typeof markPriceTaskSeen>[1],
    ) => void,
    capability:
      | "price_updates.read"
      | "price_updates.label_confirm"
      | "price_updates.complete"
      | "labels.queue_write"
      | "labels.print",
  ) => {
    if (!task) return false;
    try {
      await command(
        capability,
        taskScope(task.company_id, task.branch, true),
        action,
      );
      if (currentIntent.current === intent) setError("");
      return currentIntent.current === intent;
    } catch {
      if (currentIntent.current === intent) fail();
      return false;
    }
  };
  const backLink = (
    <a
      className="back-link"
      href="#price-updates"
      onClick={(event) => {
        event.preventDefault();
        navigate("price-updates");
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {t("Back to Price updates", "بازگشت به به‌روزرسانی قیمت‌ها")}
    </a>
  );
  if (!task)
    return withPrintDialog(
      <div
        className="price-update-detail"
        data-pwa-unsaved={printTask !== null}
      >
        {backLink}
        <PageHeader title={t("Price update", "به‌روزرسانی قیمت")} />
        <Card>
          <p role={result.error ? "alert" : "status"}>
            {result.pending
              ? t("Loading…", "در حال بارگذاری…")
              : t(
                  "This task is no longer available. Open its list again.",
                  "این کار دیگر در دسترس نیست. فهرست آن را دوباره باز کنید.",
                )}
          </p>
        </Card>
      </div>,
    );
  const product = state.products.find(
    (item) =>
      item.company_id === task.company_id && item.code === task.product_code,
  );
  const scope = taskScope(task.company_id, task.branch, true);
  const seen = task.seen?.version === task.version ? task.seen : null;
  const seenEarlier = !seen && task.seen ? task.seen : null;
  const done = task.status === "done";
  const mayMarkSeen = !done && can("price_updates.read", scope);
  const mayComplete = !done && can("price_updates.complete", scope);
  const stamp = (by: string, at: string) => (
    <span className="price-update-stamp">
      <bdi>{by}</bdi>
      <span aria-hidden="true">·</span>
      <LtrText>{companyTimestampText(state.config, at)}</LtrText>
    </span>
  );
  const history = [...task.steps].sort((a, b) => b.at.localeCompare(a.at));
  return withPrintDialog(
    <div className="price-update-detail" data-pwa-unsaved={printTask !== null}>
      {backLink}
      <PageHeader title={t("Price update", "به‌روزرسانی قیمت")} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card className="price-update-summary">
        <div className="price-update-summary-head">
          {product ? (
            <ProductName product={product} language={lang} />
          ) : (
            <LtrText>{task.product_code}</LtrText>
          )}
          <Badge tone={done ? "approved" : "pending"}>
            {done ? t("Done", "انجام‌شده") : t("Pending", "در انتظار")}
          </Badge>
        </div>
        <p className="muted">
          {t(state.config.terminology.product_code, "کد محصول")}:{" "}
          <LtrText>{task.product_code}</LtrText>
          {product?.barcode && (
            <>
              {" "}
              · {t("Barcode", "بارکد")}: <LtrText>{product.barcode}</LtrText>
            </>
          )}
        </p>
        <div className="price-update-summary-change">
          <PriceUpdateChange task={task} />
        </div>
        {task.sale_end_preparation && (
          <p>
            <SaleEndTaskTitle task={task} />
          </p>
        )}
        <dl className="detail-grid">
          <div>
            <dt>{t("Location", "مکان")}</dt>
            <dd>{branchLabel(state.config, task.branch, lang)}</dd>
          </div>
          <div>
            <dt>{t("Effective from", "اجرا از")}</dt>
            <dd>
              <LtrText>
                {companyTimestampText(state.config, task.effective_at)}
              </LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Why it changed", "دلیل تغییر")}</dt>
            <dd>{priceUpdateReasonLabel(task.reason, lang)}</dd>
          </div>
          <div>
            <dt>{t("Decided by", "تصمیم‌گیرنده")}</dt>
            <dd>
              {task.decided_by ? <bdi>{task.decided_by}</bdi> : <NotAdded />}
            </dd>
          </div>
        </dl>
      </Card>
      <Card className="price-update-status-card">
        <h2>{t("Status", "وضعیت")}</h2>
        <ol className="price-update-status-steps">
          <li className={seen || done ? "is-complete" : "is-pending"}>
            <span className="price-update-status-icon" aria-hidden="true">
              {seen || done ? <Check size={16} /> : <Eye size={16} />}
            </span>
            <div className="price-update-status-copy">
              <strong>{t("Seen", "دیده‌شده")}</strong>
              {seen ? (
                stamp(seen.by, seen.at)
              ) : (
                <span className="muted">
                  {seenEarlier
                    ? t(
                        "The price changed again after it was seen.",
                        "قیمت پس از دیده شدن دوباره تغییر کرد.",
                      )
                    : t("Not seen yet", "هنوز دیده نشده")}
                </span>
              )}
            </div>
            {!seen && mayMarkSeen && (
              <Button
                variant="neutral"
                onClick={() =>
                  void run((draft, freshActor) => {
                    markPriceTaskSeen(draft, freshActor, id);
                  }, "price_updates.read")
                }
              >
                {t("Mark as seen", "علامت‌گذاری دیده‌شده")}
              </Button>
            )}
          </li>
          <li className={done ? "is-complete" : "is-pending"}>
            <span className="price-update-status-icon" aria-hidden="true">
              <Check size={16} />
            </span>
            <div className="price-update-status-copy">
              <strong>{t("Done", "انجام‌شده")}</strong>
              {done && task.completed_at ? (
                stamp(task.completed_by ?? "", task.completed_at)
              ) : (
                <span className="muted">
                  {t(
                    "Mark done once the cash register and shelf label show the new price.",
                    "وقتی صندوق فروش و برچسب قفسه قیمت جدید را نشان دادند، انجام‌شده علامت بزنید.",
                  )}
                </span>
              )}
            </div>
            {mayComplete && (
              <Button
                onClick={() =>
                  void run((draft, freshActor) => {
                    completePriceTasks(draft, freshActor, [id]);
                  }, "price_updates.complete")
                }
              >
                {t("Mark as done", "علامت‌گذاری انجام‌شده")}
              </Button>
            )}
          </li>
        </ol>
        {!done && (
          <div className="price-update-label-tools">
            <span className="muted">
              {t("Shelf label", "برچسب قفسه")}
              {task.label_printed?.version === task.version && (
                <>
                  {" "}
                  · {t("printed by", "چاپ توسط")}{" "}
                  {stamp(task.label_printed.by, task.label_printed.at)}
                </>
              )}
            </span>
            <Button
              variant="tinted"
              size="sm"
              disabled={
                !can("labels.print", scope) && !can("labels.queue_write", scope)
              }
              onClick={() => setPrintTask(task)}
            >
              <Printer size={16} aria-hidden="true" />
              {t("Print label", "چاپ برچسب")}
            </Button>
          </div>
        )}
      </Card>
      <Card className="price-update-history-card">
        <h2>{t("Price history", "تاریخچهٔ قیمت")}</h2>
        <DataTable
          className="price-update-history-table"
          columns={[
            {
              key: "when",
              label: t("When", "زمان"),
              required: true,
              priority: 1,
              minWidth: 150,
            },
            {
              key: "change",
              label: t("Price change", "تغییر قیمت"),
              required: true,
              priority: 1,
              minWidth: 150,
            },
            { key: "why", label: t("Why", "دلیل"), priority: 3 },
            { key: "by", label: t("By", "توسط"), priority: 2 },
          ]}
        >
          <thead>
            <tr>
              <th scope="col">{t("When", "زمان")}</th>
              <th scope="col">{t("Price change", "تغییر قیمت")}</th>
              <th scope="col">{t("Why", "دلیل")}</th>
              <th scope="col">{t("By", "توسط")}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((step, index) => (
              <tr key={step.version}>
                <td>
                  <LtrText>
                    {companyTimestampText(state.config, step.at)}
                  </LtrText>
                  {index === 0 && (
                    <>
                      {" "}
                      <Badge tone="info">{t("Latest", "آخرین")}</Badge>
                    </>
                  )}
                </td>
                <td>
                  <span className="price-update-change">
                    <PriceUpdateValue value={step.old_price} />
                    <span aria-hidden="true">→</span>
                    <PriceUpdateValue value={step.new_price} />
                  </span>
                </td>
                <td>{priceUpdateReasonLabel(step.reason, lang)}</td>
                <td>
                  {step.decided_by ? (
                    <bdi>{step.decided_by}</bdi>
                  ) : (
                    <NotAdded />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </div>,
  );
}
export default PriceUpdates;
