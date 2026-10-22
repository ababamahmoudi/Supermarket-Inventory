import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowLeft, Check, ChevronRight, Eye, Printer } from "lucide-react";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import { useRouteParam } from "../navigation";
import {
  priceUpdateTasks,
  priceUpdateProgress,
  markPriceTaskSeen,
  completePriceTasks,
  queuePriceTaskLabels,
  preparePriceTaskPrint,
  recordPriceTaskPrint,
  confirmPriceTaskLabel,
  type PriceUpdateTask,
  type PriceTaskPrint,
} from "../price-updates";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Select,
  Tabs,
} from "../ui";
import { DateText, LtrText, NotAdded, ProductName } from "../presentation";
import { branchLabel } from "../settings";
import { companyDate } from "../invoice";
import { companyTimestampText } from "../company-time";
import {
  PriceUpdateChange,
  PriceUpdateValue,
  SaleEndTaskTitle,
} from "../price-update-presentation";
import { historyActionLabel } from "../history-copy";
import { ReceivedDateRange } from "./ReceivedDateRange";
import { PhysicalSheet } from "./Labels";
import { waitForPrintImages } from "../print-images";
import type { ScopedReadView } from "../e1-read-model";
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
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
  const visible = tasks.filter(
    (item) =>
      item.status === status &&
      (location === "all" || item.branch === location) &&
      (!from || companyDate(state.config, new Date(item.created_at)) >= from) &&
      (!to || companyDate(state.config, new Date(item.created_at)) <= to),
  );
  const selection = selected.filter((id) =>
    visible.some((item) => item.id === id && item.status === "pending"),
  );
  const ownedLocations = [...new Set(tasks.map((item) => item.branch))];
  const scopedIdentity = actor
    ? `${actor.company_id}:${actor.session_id}:${actor.authority_epoch}`
    : "";
  const currentIdentity = useRef(scopedIdentity);
  useEffect(() => {
    currentIdentity.current = scopedIdentity;
  }, [scopedIdentity]);
  const batch = async (mode: "labels" | "done") => {
    if (!actor || !selection.length) return;
    try {
      await command(
        mode === "labels" ? "labels.queue_write" : "price_updates.complete",
        {
          company_id: company,
          kind: "location_record",
          location_ids: [
            ...new Set(
              visible
                .filter((item) => selection.includes(item.id))
                .map((item) => item.branch),
            ),
          ],
          mutation: true,
          location_policy: "active_only",
        },
        (draft, freshActor) =>
          mode === "labels"
            ? queuePriceTaskLabels(draft, freshActor, selection)
            : completePriceTasks(draft, freshActor, selection),
      );
      if (currentIdentity.current === scopedIdentity) {
        setSelected([]);
        setError("");
      }
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
        <Card>
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
              isManager ? (
                <Button
                  variant="neutral"
                  onClick={() => navigate("price-updates?view=progress")}
                >
                  {t("Store progress", "پیشرفت فروشگاه‌ها")}
                </Button>
              ) : undefined
            }
            leading={
              <Tabs
                value={status}
                onChange={setStatus}
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
              from={from}
              to={to}
              onChange={(nextFrom, nextTo) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
            />
            {(status !== "pending" || location !== "all" || from || to) && (
              <Button
                variant="plain"
                onClick={() => {
                  setFilters({
                    key: filterKey,
                    location: "all",
                    status: "pending",
                  });
                  setFrom("");
                  setTo("");
                }}
              >
                {t("Clear filters", "پاک کردن فیلترها")}
              </Button>
            )}
          </FilterToolbar>
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
              <div className="price-updates-table-header" aria-hidden="true">
                <span />
                <span>{t("Product", "کالا")}</span>
                <span>{t("Store", "فروشگاه")}</span>
                <span className="price-updates-price-heading">
                  {t("Price", "قیمت")}
                </span>
                <span>{t("Why", "دلیل")}</span>
                <span>{t("Seen", "دیده‌شده")}</span>
                <span />
              </div>
              {visible.map((task) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === task.company_id &&
                    item.code === task.product_code,
                );
                const seen =
                  task.seen?.version === task.version ? task.seen : null;
                const scope = taskScope(task.company_id, task.branch);
                return (
                  <div
                    className="price-updates-row"
                    key={task.id}
                    role="link"
                    tabIndex={0}
                    onClick={(event) => {
                      if (
                        event.target instanceof Element &&
                        !event.target.closest(
                          "button,a,input,textarea,[role=checkbox],[role=combobox]",
                        )
                      )
                        navigate(
                          `price-update?id=${encodeURIComponent(task.id)}`,
                        );
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        ["Enter", " "].includes(event.key)
                      ) {
                        event.preventDefault();
                        navigate(
                          `price-update?id=${encodeURIComponent(task.id)}`,
                        );
                      }
                    }}
                  >
                    {task.status === "pending" ? (
                      <Checkbox
                        aria-label={`${t("Select", "انتخاب")} ${product?.name_en ?? task.product_code}`}
                        checked={selection.includes(task.id)}
                        onChange={(checked) =>
                          setSelected(
                            checked
                              ? [...selection, task.id]
                              : selection.filter((id) => id !== task.id),
                          )
                        }
                      />
                    ) : (
                      <Badge tone="approved">{t("Done", "انجام‌شده")}</Badge>
                    )}
                    <div className="price-updates-product">
                      {product ? (
                        <ProductName product={product} language={lang} />
                      ) : (
                        <LtrText>{task.product_code}</LtrText>
                      )}
                      <small className="muted price-updates-compact-meta">
                        {branchLabel(state.config, task.branch, lang)} ·{" "}
                        <DateText value={task.effective_at} />
                      </small>
                      {task.sale_end_preparation && (
                        <small>
                          <SaleEndTaskTitle task={task} />
                        </small>
                      )}
                      {task.status === "done" && (
                        <small className="muted">
                          <bdi>{task.completed_by}</bdi> ·{" "}
                          {task.completed_at && (
                            <LtrText>
                              {companyTimestampText(
                                state.config,
                                task.completed_at,
                              )}
                            </LtrText>
                          )}
                        </small>
                      )}
                    </div>
                    <div className="price-updates-store price-updates-wide-cell">
                      {branchLabel(state.config, task.branch, lang)}
                    </div>
                    <PriceUpdateChange task={task} />
                    <div className="price-updates-reason price-updates-wide-cell muted">
                      {historyActionLabel(task.reason, lang)}
                      {task.decided_by && (
                        <>
                          {" "}
                          · <bdi>{task.decided_by}</bdi>
                        </>
                      )}
                    </div>
                    <div
                      className={`price-updates-steps price-updates-wide-cell ${task.status === "done" ? "is-complete" : seen ? "is-started" : "is-pending"}`}
                    >
                      <span aria-hidden="true" />
                      {seen ? (
                        <span className="price-updates-seen">
                          <bdi>{seen.by}</bdi>
                          <small className="muted">
                            <LtrText>
                              {companyTimestampText(state.config, seen.at)}
                            </LtrText>
                          </small>
                        </span>
                      ) : (
                        t("Not seen yet", "هنوز دیده نشده")
                      )}
                    </div>
                    <div className="price-updates-row-actions">
                      {task.status === "pending" && (
                        <Button
                          variant="tinted"
                          size="sm"
                          className="price-updates-wide-cell"
                          disabled={!can("labels.print", scope)}
                          onClick={() =>
                            navigate(
                              `price-update?id=${encodeURIComponent(task.id)}`,
                            )
                          }
                        >
                          {t("Print label", "چاپ برچسب")}
                        </Button>
                      )}
                      <Button
                        variant="plain"
                        className="price-update-open"
                        aria-label={`${t("Open price update", "باز کردن به‌روزرسانی قیمت")} ${product?.name_en ?? task.product_code}`}
                        onClick={() =>
                          navigate(
                            `price-update?id=${encodeURIComponent(task.id)}`,
                          )
                        }
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
            <div className="actions">
              <Button variant="tinted" onClick={() => void batch("labels")}>
                <Printer size={18} />
                {t("Print labels", "چاپ برچسب‌ها")}
              </Button>
              {can("price_updates.complete") && (
                <Button onClick={() => void batch("done")}>
                  {t("Mark as done", "علامت‌گذاری انجام‌شده")}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
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
  const { state, actor, can, command, query, t, lang, navigate } = useDemo();
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
  const [printing, setPrinting] = useState(false);
  const [pendingPrint, setPendingPrint] = useState<PriceTaskPrint | null>(null);
  const [printState, setPrintState] = useState<ScopedReadView | null>(null);
  const [confirmation, setConfirmation] = useState(false);
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
  const print = async () => {
    if (!task || printing) return;
    setPrinting(true);
    try {
      const snapshot = await query(
        "labels.print",
        taskScope(task.company_id, task.branch),
        (canonical, freshActor) =>
          preparePriceTaskPrint(canonical, freshActor, [id]),
      );
      if (currentIntent.current !== intent) return;
      flushSync(() => {
        setPendingPrint(snapshot);
        setPrintState(structuredClone(state));
      });
      await waitForPrintImages(
        document.querySelector(".price-task-print-output"),
      );
      if (currentIntent.current !== intent) return;
      window.print();
      const recorded = await run((draft, freshActor) => {
        recordPriceTaskPrint(draft, freshActor, snapshot);
      }, "labels.print");
      if (recorded) setConfirmation(true);
    } catch {
      if (currentIntent.current === intent) fail();
    } finally {
      if (currentIntent.current === intent) setPrinting(false);
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
    return (
      <div
        className="price-update-detail"
        data-pwa-unsaved={printing || confirmation}
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
      </div>
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
  return (
    <div
      className="price-update-detail"
      data-pwa-unsaved={printing || confirmation}
    >
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
            <dd>{historyActionLabel(task.reason, lang)}</dd>
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
            <div className="actions">
              <Button
                variant="tinted"
                size="sm"
                disabled={printing || !can("labels.print", scope)}
                onClick={() => void print()}
              >
                <Printer size={16} aria-hidden="true" />
                {t("Print label now", "چاپ برچسب اکنون")}
              </Button>
              <Button
                variant="neutral"
                size="sm"
                disabled={!can("labels.queue_write", scope)}
                onClick={() =>
                  void run((draft, freshActor) => {
                    queuePriceTaskLabels(draft, freshActor, [id]);
                  }, "labels.queue_write")
                }
              >
                {t("Add to label waitlist", "افزودن به فهرست انتظار برچسب‌ها")}
              </Button>
            </div>
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
                <td>{historyActionLabel(step.reason, lang)}</td>
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
      {pendingPrint &&
        printState &&
        createPortal(
          <div className="label-print-output price-task-print-output">
            {pendingPrint.batches.flatMap((batch, batchIndex) =>
              batch.pages.map((page, index) => (
                <PhysicalSheet
                  key={`${batchIndex}:${index}`}
                  template={batch.template}
                  products={page}
                  state={printState}
                  branch={pendingPrint.branch}
                />
              )),
            )}
          </div>,
          document.body,
        )}
      <Dialog
        open={confirmation}
        onOpenChange={setConfirmation}
        title={t(
          "Did the labels print correctly?",
          "آیا برچسب‌ها درست چاپ شدند؟",
        )}
      >
        <DialogActions>
          <Button
            variant="neutral"
            onClick={() => {
              setConfirmation(false);
              setPendingPrint(null);
              setPrintState(null);
            }}
          >
            {t("No", "خیر")}
          </Button>
          <Button
            onClick={() => {
              if (pendingPrint)
                void run((draft, freshActor) => {
                  confirmPriceTaskLabel(draft, freshActor, id, pendingPrint.id);
                }, "price_updates.label_confirm").then((ok) => {
                  if (ok) setConfirmation(false);
                });
            }}
          >
            {t("Yes", "بله")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
export default PriceUpdates;
