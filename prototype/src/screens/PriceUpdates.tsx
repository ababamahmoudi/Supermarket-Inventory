import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ChevronRight, Printer } from "lucide-react";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import { useRouteParam } from "../navigation";
import {
  priceUpdateTasks,
  priceUpdateProgress,
  updatePriceTask,
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
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Select,
  Tabs,
} from "../ui";
import { DateText, LtrText, ProductName } from "../presentation";
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
import { WhatsMissing } from "../WhatsMissing";
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
  const { state, actor, can, lang, t, navigate } = useDemo();
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
            "Confirm the cash register and label for every selected task first.",
            "ابتدا صندوق فروش و برچسب هر کار انتخاب‌شده را تأیید کنید.",
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
          "The price in the app changes right away. Confirm the cash register and shelf label here.",
          "قیمت در برنامه بلافاصله تغییر می‌کند. صندوق فروش و برچسب قفسه را اینجا تأیید کنید.",
        )}
        actions={
          isManager ? (
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
          <FilterToolbar>
            <Tabs
              value={status}
              onChange={setStatus}
              options={[
                { value: "pending", label: t("Pending", "در انتظار") },
                { value: "done", label: t("Done", "انجام‌شده") },
              ]}
            />
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
            {(location !== "all" || from || to) && (
              <Button
                variant="plain"
                onClick={() => {
                  setLocation("all");
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
              {t(
                "No price updates match these filters.",
                "به‌روزرسانی قیمتی با این فیلترها پیدا نشد.",
              )}
            </EmptyState>
          ) : (
            <div className="price-updates-list">
              {visible.map((task) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === task.company_id &&
                    item.code === task.product_code,
                );
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
                    <div>
                      {product ? (
                        <ProductName product={product} language={lang} />
                      ) : (
                        <LtrText>{task.product_code}</LtrText>
                      )}
                      <small className="muted">
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
                    <PriceUpdateChange task={task} />
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
  const [attempted, setAttempted] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
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
      draft: Parameters<typeof updatePriceTask>[0],
      freshActor: Parameters<typeof updatePriceTask>[1],
    ) => void,
    capability:
      | "price_updates.label_confirm"
      | "price_updates.register_confirm"
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
  if (!task)
    return (
      <div
        className="price-update-detail"
        data-pwa-unsaved={printing || confirmation || reason !== null || waiver}
      >
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
          <Button variant="plain" onClick={() => navigate("price-updates")}>
            {t("Back to Price updates", "بازگشت به به‌روزرسانی قیمت‌ها")}
          </Button>
        </Card>
      </div>
    );
  const product = state.products.find(
    (item) =>
      item.company_id === task.company_id && item.code === task.product_code,
  );
  const scope = taskScope(task.company_id, task.branch, true);
  const registerReady = Boolean(
    task.register_changed?.version === task.version,
  );
  const labelReady = Boolean(
    task.label_printed?.version === task.version ||
    task.no_label?.version === task.version,
  );
  const issues = attempted
    ? [
        ...(!registerReady
          ? [
              {
                id: "task-register",
                fieldId: "task-register",
                message: t(
                  "A register confirmation is still required.",
                  "تأیید صندوق فروش هنوز لازم است.",
                ),
              },
            ]
          : []),
        ...(!labelReady
          ? [
              {
                id: "task-label",
                fieldId: "task-label",
                message: t(
                  "Print the new label, or choose No label needed and add a reason.",
                  "برچسب جدید را چاپ کنید، یا «نیازی به برچسب نیست» را انتخاب کرده و دلیل بنویسید.",
                ),
              },
            ]
          : []),
      ]
    : [];
  return (
    <div
      className="price-update-detail"
      data-pwa-unsaved={
        printing ||
        confirmation ||
        (reason !== null && reason !== (task.no_label?.reason ?? "")) ||
        (waiver && !task.no_label)
      }
    >
      <PageHeader
        title={t("Price update", "به‌روزرسانی قیمت")}
        actions={
          <Button variant="plain" onClick={() => navigate("price-updates")}>
            {t("Back to Price updates", "بازگشت به به‌روزرسانی قیمت‌ها")}
          </Button>
        }
      />
      <WhatsMissing issues={issues} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card>
        {product && <ProductName product={product} language={lang} />}
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
        <PriceUpdateChange task={task} />
        {task.sale_end_preparation && (
          <p>
            <SaleEndTaskTitle task={task} />
          </p>
        )}
        <dl className="price-update-facts">
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
              <bdi>{task.decided_by ?? "—"}</bdi>
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <div className="price-update-checks">
          <div className="price-update-check-row">
            <div>
              <Checkbox
                id="task-register"
                checked={registerReady}
                disabled={
                  task.status !== "pending" ||
                  !can("price_updates.register_confirm", scope)
                }
                onChange={(checked) =>
                  void run((draft, freshActor) => {
                    updatePriceTask(draft, freshActor, id, {
                      register_changed: checked,
                    });
                  }, "price_updates.register_confirm")
                }
              >
                {t(
                  "Changed on the cash register",
                  "در صندوق فروش تغییر داده شد",
                )}
              </Checkbox>
              {task.register_changed && (
                <small className="muted">
                  <bdi>{task.register_changed.by}</bdi> ·{" "}
                  <LtrText>
                    {companyTimestampText(
                      state.config,
                      task.register_changed.at,
                    )}
                  </LtrText>
                </small>
              )}
            </div>
          </div>
          <div className="price-update-check-row">
            <div>
              <Checkbox
                id="task-label"
                checked={Boolean(task.label_printed?.version === task.version)}
                disabled={
                  task.status !== "pending" ||
                  !can("price_updates.label_confirm", scope)
                }
                onChange={(checked) => {
                  if (!checked)
                    void run((draft, freshActor) => {
                      updatePriceTask(draft, freshActor, id, {
                        label_printed: false,
                      });
                    }, "price_updates.label_confirm");
                  else if (pendingPrint)
                    void run((draft, freshActor) => {
                      confirmPriceTaskLabel(
                        draft,
                        freshActor,
                        id,
                        pendingPrint.id,
                      );
                    }, "price_updates.label_confirm");
                  else
                    setError(
                      t(
                        "Confirm that the label was printed.",
                        "تأیید کنید که برچسب چاپ شده است.",
                      ),
                    );
                }}
              >
                {t("New label printed", "برچسب جدید چاپ شد")}
              </Checkbox>
              {task.label_printed && (
                <small className="muted">
                  <bdi>{task.label_printed.by}</bdi> ·{" "}
                  <LtrText>
                    {companyTimestampText(state.config, task.label_printed.at)}
                  </LtrText>
                </small>
              )}
            </div>
            <div className="actions">
              <Button
                variant="tinted"
                disabled={printing || task.status !== "pending"}
                onClick={() => void print()}
              >
                {t("Print label now", "چاپ برچسب اکنون")}
              </Button>
              <Button
                variant="neutral"
                disabled={task.status !== "pending"}
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
          {task.status === "pending" &&
            can("price_updates.register_confirm", scope) && (
              <>
                <Checkbox
                  checked={waiver || Boolean(task.no_label)}
                  onChange={setWaiver}
                >
                  {t("No label needed", "نیازی به برچسب نیست")}
                </Checkbox>
                {(waiver || task.no_label) && (
                  <div>
                    <Field label={t("Reason", "دلیل")}>
                      <textarea
                        id="task-label-reason"
                        value={reason ?? task.no_label?.reason ?? ""}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </Field>
                    <Button
                      variant="neutral"
                      onClick={() => {
                        if (!(reason ?? task.no_label?.reason ?? "").trim()) {
                          setError(t("Add a reason.", "یک دلیل اضافه کنید."));
                          return;
                        }
                        void run((draft, freshActor) => {
                          updatePriceTask(draft, freshActor, id, {
                            no_label_reason:
                              reason ?? task.no_label?.reason ?? "",
                          });
                        }, "price_updates.register_confirm");
                      }}
                    >
                      {t("Save reason", "ذخیرهٔ دلیل")}
                    </Button>
                  </div>
                )}
              </>
            )}
          {task.no_label && (
            <p className="price-task-waiver-evidence" role="status">
              {t("No label needed", "نیازی به برچسب نیست")} ·{" "}
              {task.no_label.reason} · <bdi>{task.no_label.by}</bdi> ·{" "}
              <LtrText>
                {companyTimestampText(state.config, task.no_label.at)}
              </LtrText>
            </p>
          )}
          {task.status === "pending" &&
            can("price_updates.complete", scope) && (
              <div className="actions">
                <Button
                  onClick={() => {
                    setAttempted(true);
                    if (registerReady && labelReady)
                      void run((draft, freshActor) => {
                        completePriceTasks(draft, freshActor, [id]);
                      }, "price_updates.complete");
                  }}
                >
                  {t("Mark as done", "علامت‌گذاری انجام‌شده")}
                </Button>
              </div>
            )}
          {task.completed_at && (
            <p>
              <Badge tone="approved">{t("Done", "انجام‌شده")}</Badge>{" "}
              <bdi>{task.completed_by}</bdi> ·{" "}
              <LtrText>
                {companyTimestampText(state.config, task.completed_at)}
              </LtrText>
            </p>
          )}
        </div>
      </Card>
      <Card title={t("History", "تاریخچه")}>
        <ol className="price-update-history">
          {task.steps.map((step) => (
            <li key={step.version}>
              <span className="price-update-change">
                <PriceUpdateValue value={step.old_price} />
                <span aria-hidden="true">→</span>
                <PriceUpdateValue value={step.new_price} />
              </span>
              <small className="muted">
                {historyActionLabel(step.reason, lang)} ·{" "}
                <bdi>{step.decided_by}</bdi> ·{" "}
                <LtrText>{companyTimestampText(state.config, step.at)}</LtrText>
              </small>
            </li>
          ))}
        </ol>
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
