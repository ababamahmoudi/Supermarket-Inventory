import { useState } from "react";
import {
  applyApprovedPrice,
  approvalSnapshot,
  markPriceConflictIntentional,
  setAlertStatus,
} from "../approvals";
import { useDemo } from "../store";
import { alertPriceEffects, type AlertPriceEffects } from "../alerts-read";
import { configuredRoleLabel } from "../role-config";
import {
  DateText,
  LtrText,
  Money,
  OfferLabel,
  ProductName,
} from "../presentation";
import { branchLabel } from "../settings";
import type { Alert } from "../types";
import { dateReminderMessage } from "../date-tracking";
import { SalesAlerts } from "./SalesAlerts";
import { AlertRow } from "./AlertRow";
import { alertCategory } from "../alert-categories";
import { saleAlertsFor } from "../sale-alerts";
import { useRouteParam } from "../navigation";
import "./financial-polish.css";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  Checkbox,
} from "../ui";

export function Alerts() {
  const { state, actor, can, command, query, branch, lang, t, historyContext } =
    useDemo();
  const requestedId = useRouteParam("id");
  const [showResolved, setShowResolved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState<{
    product_code: string;
    message: string;
  }>();
  const [confirm, setConfirm] = useState<{
    code: string;
    price: string;
    snapshot: string;
    effects: AlertPriceEffects["effects"];
  } | null>(null);
  const company = state.config.company.seed_key;
  const alerts = state.alerts.filter(
    (item) =>
      item.company_id === company &&
      (showResolved || item.status === "pending") &&
      (branch === "all" || item.branch === branch || item.branch === "all"),
  );
  if (!actor || !can("alerts.read")) return null;
  const canDecide = can("alerts.decide");
  const branchName = (value: string) => branchLabel(state.config, value, lang);
  const alertPriority: Partial<Record<Alert["type"], number>> = {
    lower_price: 0,
    price_conflict: 1,
    tax_discrepancy: 2,
    other_supplier: 3,
    barcode_conflict: 4,
    order_differences: 5,
    return_credit_overdue: 6,
  };
  const decisionAlerts = alerts
    .filter(
      (alert) =>
        alert.type !== "date_reminder" &&
        !alert.type.startsWith("sale_") &&
        (canDecide || alert.type === "return_credit_overdue"),
    )
    .sort(
      (left, right) =>
        (alertPriority[left.type] ?? 9) - (alertPriority[right.type] ?? 9),
    );
  const dateAlerts = alerts.filter((alert) => alert.type === "date_reminder");
  const saleAlertCount = saleAlertsFor(
    state,
    historyContext,
    branch,
    showResolved,
  ).length;
  const alertSummary = (alert: Alert) => {
    if (alert.type === "price_conflict") {
      const count = Object.keys(alert.branch_prices ?? {}).filter((name) =>
        actor.allowed_branches.includes(name),
      ).length;
      return t(
        `${branchName(alert.branch)} · Prices differ across ${count} branches`,
        `${branchName(alert.branch)} · قیمت در ${count} شعبه متفاوت است`,
      );
    }
    return [alert.supplier, branchName(alert.branch)]
      .filter(Boolean)
      .join(" · ");
  };
  const resolve = async (id: string, status: "pending" | "resolved") => {
    try {
      await command(
        "alerts.decide",
        {
          company_id: company,
          kind: "company_shared",
          entity_id: id,
          mutation: true,
        },
        (draft, current) =>
          setAlertStatus(draft, current, id, status, notes[id]),
      );
      setMessage(
        status === "resolved"
          ? t("Marked as taken care of.", "رسیدگی‌شده ثبت شد.")
          : t("Kept as pending.", "در انتظار حفظ شد."),
      );
    } catch {
      setError({
        product_code:
          state.alerts.find((item) => item.id === id)?.product_code ?? "",
        message: t(
          "Prices changed. Review the latest conflict and choose the price again.",
          "قیمت‌ها تغییر کردند. اختلاف تازه را بررسی و دوباره قیمت را انتخاب کنید.",
        ),
      });
    }
  };
  const reviewPrice = async (code: string, price: string) => {
    setError(undefined);
    try {
      const reviewed = await query(
        "pricing.regular_manage",
        { company_id: company, kind: "company_shared" },
        (canonical, current) =>
          alertPriceEffects(canonical, current, code, price),
      );
      setConfirm({ code, price, ...reviewed });
    } catch {
      setError({
        product_code: code,
        message: t(
          "Prices changed. Review the latest conflict and choose the price again.",
          "قیمت‌ها تغییر کردند. اختلاف تازه را بررسی و دوباره قیمت را انتخاب کنید.",
        ),
      });
    }
  };
  const applyToAll = async () => {
    if (!confirm) return;
    const reviewed = confirm;
    try {
      await command(
        "pricing.regular_manage",
        { company_id: company, kind: "company_shared", mutation: true },
        (draft, current) => {
          if (
            approvalSnapshot(draft, current, reviewed.code) !==
            reviewed.snapshot
          )
            throw new Error("stale");
          applyApprovedPrice(
            draft,
            current,
            reviewed.code,
            reviewed.price,
            "all",
            "all",
          );
        },
      );
      setMessage(
        t(
          "Applied price to all branches. Overrides were removed and offers were checked.",
          "قیمت به همه شعبه‌ها اعمال شد. قیمت‌های ویژه حذف و پیشنهادها بررسی شدند.",
        ),
      );
      setError(undefined);
    } catch {
      setError({
        product_code: reviewed.code,
        message: t(
          "Prices changed. Review the latest conflict and choose the price again.",
          "قیمت‌ها تغییر کردند. اختلاف تازه را بررسی و دوباره قیمت را انتخاب کنید.",
        ),
      });
    }
    setConfirm(null);
  };
  const intentional = async (id: string, product_code: string) => {
    try {
      await command(
        "alerts.decide",
        {
          company_id: company,
          kind: "company_shared",
          entity_id: id,
          mutation: true,
        },
        (draft, current) => markPriceConflictIntentional(draft, current, id),
      );
      setMessage(
        t(
          "Marked as intentional. A later price change will create a new alert.",
          "عمدی ثبت شد. تغییر بعدی قیمت، هشدار تازه ایجاد می‌کند.",
        ),
      );
    } catch {
      setError({
        product_code,
        message: t(
          "Prices changed. Review the latest conflict and choose the price again.",
          "قیمت‌ها تغییر کردند. اختلاف تازه را بررسی و دوباره قیمت را انتخاب کنید.",
        ),
      });
    }
  };
  return (
    <>
      <PageHeader
        title={t("Alerts", "هشدارها")}
        description={
          canDecide
            ? t(
                "Lower supplier costs and branch price differences need a clear decision.",
                "کاهش هزینه تأمین‌کننده و اختلاف قیمت شعبه‌ها به تصمیم روشن نیاز دارند.",
              )
            : undefined
        }
      />
      <div className="toolbar">
        <Checkbox checked={showResolved} onChange={setShowResolved}>
          {t(
            "Show resolved and intentional alerts",
            "نمایش هشدارهای حل‌شده و عمدی",
          )}
        </Checkbox>
      </div>
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="banner danger" role="alert">
          {error.message}
        </div>
      )}
      {alerts.length === 0 && (
        <EmptyState>
          {t(
            "No pending alerts. Receive an invoice to review a lower supplier cost.",
            "هشدار در انتظار وجود ندارد. فاکتور را دریافت کنید تا کاهش هزینه تأمین‌کننده را بررسی کنید.",
          )}
        </EmptyState>
      )}
      {(decisionAlerts.length > 0 ||
        dateAlerts.length > 0 ||
        saleAlertCount > 0) && (
        <Card title={t("All alerts", "همه هشدارها")} className="alerts-card">
          <div className="list-box-stack alert-list">
            {decisionAlerts.map((alert) => {
              const product = state.products.find(
                (item) =>
                  item.company_id === company &&
                  item.code === alert.product_code,
              );
              const category = alertCategory(alert.type, t);
              return (
                <AlertRow
                  key={
                    alert.type === "price_conflict"
                      ? `conflict-${alert.product_code}`
                      : alert.id
                  }
                  data-alert-id={alert.id}
                  defaultOpen={alert.id === requestedId}
                  title={
                    product ? (
                      <ProductName product={product} language={lang} />
                    ) : (
                      <LtrText>{alert.product_code}</LtrText>
                    )
                  }
                  summary={alertSummary(alert)}
                  category={category.label}
                  categoryTone={category.tone}
                  status={
                    alert.status === "pending" ? undefined : (
                      <Badge
                        tone={
                          alert.status === "intentional" ? "info" : "approved"
                        }
                      >
                        {alert.status === "intentional"
                          ? t("Intentional", "عمدی")
                          : t("Resolved", "حل‌شده")}
                      </Badge>
                    )
                  }
                >
                  {alert.type === "return_credit_overdue" ? (
                    <>
                      <p>{alert.supplier}</p>
                      <p className="muted">
                        {t(
                          "Review the retained pickup evidence and record the supplier's resolution.",
                          "مدرک جمع‌آوری نگهداری‌شده را بررسی و نتیجه تأمین‌کننده را ثبت کنید.",
                        )}
                      </p>
                      <Button asChild variant="plain">
                        <a
                          href={`#return?id=${encodeURIComponent(alert.return_id ?? "")}`}
                        >
                          {t("View return", "نمایش مرجوعی")}
                        </a>
                      </Button>
                    </>
                  ) : alert.type === "price_conflict" ? (
                    <>
                      <DataTable
                        columns={[
                          { width: "40%" },
                          { width: 180, align: "end" },
                          { width: 200, actions: true, align: "end" },
                        ]}
                      >
                        <thead>
                          <tr>
                            <th>{t("Branch", "شعبه")}</th>
                            <th className="numeric">
                              {t(
                                "Approved selling price",
                                "قیمت فروش تأییدشده",
                              )}
                            </th>
                            <th>{t("Action", "اقدام")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(alert.branch_prices ?? {})
                            .filter(([name]) =>
                              actor.allowed_branches.includes(name),
                            )
                            .map(([name, price]) => (
                              <tr key={name}>
                                <td>{branchName(name)}</td>
                                <td className="numeric">
                                  <Money value={price} />
                                </td>
                                <td>
                                  {canDecide && alert.status === "pending" && (
                                    <Button
                                      variant="neutral"
                                      size="sm"
                                      onClick={() =>
                                        void reviewPrice(
                                          alert.product_code,
                                          price,
                                        )
                                      }
                                    >
                                      {t(
                                        "Apply this price to all",
                                        "اعمال این قیمت به همه",
                                      )}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </DataTable>
                      <p className="muted">
                        {t(
                          "Intentional differences stay quiet until an approved branch price changes.",
                          "اختلاف‌های عمدی تا تغییر قیمت تأییدشده یک شعبه، دوباره هشدار نمی‌دهند.",
                        )}
                      </p>
                      {canDecide && alert.status === "pending" && (
                        <div className="actions">
                          <Button
                            onClick={() =>
                              void intentional(alert.id, alert.product_code)
                            }
                          >
                            {t("Mark as intentional", "ثبت به عنوان عمدی")}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {alert.supplier && (
                        <p>
                          {t("Supplier", "تأمین‌کننده")}:{" "}
                          <LtrText>{alert.supplier}</LtrText>
                        </p>
                      )}
                      {alert.type === "order_differences" && (
                        <>
                          <div className="actions">
                            <Button asChild variant="plain">
                              <a
                                href={`#invoices?id=${encodeURIComponent(alert.invoice_id ?? "")}`}
                              >
                                {t("View invoice", "مشاهده فاکتور")}
                              </a>
                            </Button>
                            <Button asChild variant="plain">
                              <a
                                href={`#orders?id=${encodeURIComponent(alert.order_id ?? "")}`}
                              >
                                {t("View order", "مشاهده سفارش")}
                              </a>
                            </Button>
                          </div>
                          <DataTable
                            columns={[
                              { width: "25%" },
                              { width: 180 },
                              { width: 100, align: "end" },
                              { width: "25%" },
                              { width: "25%" },
                            ]}
                          >
                            <thead>
                              <tr>
                                <th>{t("Product", "کالا")}</th>
                                <th>{t("Difference", "اختلاف")}</th>
                                <th>{t("Units", "واحد")}</th>
                                <th>
                                  {t("Before-tax cost", "هزینه پیش از مالیات")}
                                </th>
                                <th>{t("Decision", "تصمیم")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(alert.order_differences ?? []).map(
                                (difference, index) => (
                                  <tr key={index}>
                                    <td>
                                      <ProductName
                                        product={{
                                          name_en:
                                            difference.name_en ??
                                            difference.product_code,
                                          name_fa: difference.name_fa ?? "",
                                        }}
                                        language={lang}
                                      />
                                    </td>
                                    <td>
                                      {
                                        {
                                          short: t("Short", "کسری"),
                                          not_delivered: t(
                                            "Not delivered",
                                            "تحویل نشده",
                                          ),
                                          extra: t(
                                            "Extra delivered",
                                            "تحویل اضافه",
                                          ),
                                          price_change: t(
                                            "Unit cost changed",
                                            "هزینه واحد تغییر کرد",
                                          ),
                                          short_dated: t(
                                            "Short-dated (expiry discount)",
                                            "نزدیک انقضا (تخفیف انقضا)",
                                          ),
                                        }[difference.kind]
                                      }
                                    </td>
                                    <td className="numeric">
                                      <LtrText>
                                        {difference.units ?? "—"}
                                      </LtrText>
                                    </td>
                                    <td>
                                      {difference.new_unit_cost ? (
                                        <>
                                          {difference.previous_unit_cost !==
                                          undefined ? (
                                            <Money
                                              value={
                                                difference.previous_unit_cost
                                              }
                                              decimals={2}
                                              currency={
                                                state.config.company.currency
                                              }
                                            />
                                          ) : (
                                            "—"
                                          )}{" "}
                                          →{" "}
                                          <Money
                                            value={difference.new_unit_cost}
                                            decimals={2}
                                            currency={
                                              state.config.company.currency
                                            }
                                          />
                                        </>
                                      ) : (
                                        "—"
                                      )}
                                      {difference.expiry_date && (
                                        <p>
                                          <DateText
                                            value={difference.expiry_date}
                                          />
                                        </p>
                                      )}
                                    </td>
                                    <td>
                                      {{
                                        short: t("Short", "کسری"),
                                        back_ordered: t(
                                          "Back-ordered",
                                          "در انتظار تحویل بعدی",
                                        ),
                                        cancelled: t("Cancelled", "لغوشده"),
                                        keep: t(
                                          "Keep it (we pay for it)",
                                          "نگه می‌داریم (هزینه را می‌پردازیم)",
                                        ),
                                        refuse: t(
                                          "Refused / sent back with the driver",
                                          "رد شد / با راننده برگشت",
                                        ),
                                        accept: t(
                                          "Accept new cost",
                                          "پذیرش هزینه جدید",
                                        ),
                                        short_dated: t(
                                          "Short-dated (expiry discount)",
                                          "نزدیک انقضا (تخفیف انقضا)",
                                        ),
                                      }[difference.decision] ??
                                        difference.decision}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </DataTable>
                        </>
                      )}
                      {alert.previous_cost && alert.new_cost && (
                        <div className="price-change-values alert-costs">
                          <span>
                            {t("Old cost", "هزینه قبلی")}{" "}
                            <Money value={alert.previous_cost} />
                          </span>
                          <span>
                            {t("New cost", "هزینه جدید")}{" "}
                            <Money value={alert.new_cost} />
                          </span>
                        </div>
                      )}
                      {(alert.type === "lower_price" ||
                        (alert.type === "order_differences" &&
                          alert.same_expiry)) && (
                        <div className="grid-2">
                          <div>
                            <p>
                              <strong>
                                {t(
                                  "Worker expiry answer",
                                  "پاسخ کارکنان درباره تاریخ",
                                )}
                              </strong>
                            </p>
                            <p>
                              {{
                                yes: t("Same expiry date", "تاریخ یکسان"),
                                no: t(
                                  "Different expiry dates",
                                  "تاریخ‌های متفاوت",
                                ),
                                no_previous_stock: t(
                                  "No previous stock",
                                  "موجودی قبلی ندارد",
                                ),
                                dates_not_tracked: t(
                                  "Dates not tracked",
                                  "تاریخ ثبت نمی‌شود",
                                ),
                                unknown: t("Unknown", "نامشخص"),
                              }[alert.same_expiry ?? ""] ??
                                t("Not recorded", "ثبت نشده")}
                            </p>
                          </div>
                          <div>
                            {alert.old_expiry && (
                              <p>
                                {t("Old stock date", "تاریخ موجودی قبلی")}:{" "}
                                <DateText value={alert.old_expiry} />
                              </p>
                            )}
                            {alert.new_expiry && (
                              <p>
                                {t("New delivery date", "تاریخ تحویل جدید")}:{" "}
                                <DateText value={alert.new_expiry} />
                              </p>
                            )}
                            {alert.units_left !== undefined && (
                              <p>
                                {t(
                                  "Units left at higher cost",
                                  "تعداد باقی‌مانده با هزینه بالاتر",
                                )}
                                : <bdi>{alert.units_left}</bdi>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {alert.note && (
                        <p>
                          {t("Recorded note", "یادداشت ثبت‌شده")}: {alert.note}
                        </p>
                      )}
                      {canDecide && (
                        <>
                          <Field
                            label={t(
                              `${configuredRoleLabel(state.config.roles, "manager", "en")} note (optional)`,
                              `یادداشت ${configuredRoleLabel(state.config.roles, "manager", "fa")} (اختیاری)`,
                            )}
                          >
                            <input
                              value={notes[alert.id] ?? ""}
                              onChange={(event) =>
                                setNotes({
                                  ...notes,
                                  [alert.id]: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <div className="actions">
                            <Button
                              onClick={() => resolve(alert.id, "resolved")}
                            >
                              {t("Mark as taken care of", "ثبت رسیدگی‌شده")}
                            </Button>
                            <Button
                              variant="neutral"
                              onClick={() => resolve(alert.id, "pending")}
                            >
                              {t("Keep as pending", "حفظ در انتظار")}
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </AlertRow>
              );
            })}
            <SalesAlerts showResolved={showResolved} />
            {dateAlerts.map((alert) => {
              const product = state.products.find(
                (item) =>
                  item.company_id === company &&
                  item.code === alert.product_code,
              );
              const past = (alert.days_left ?? 0) < 0;
              const category = alertCategory(alert.type, t);
              return (
                <AlertRow
                  key={alert.id}
                  data-alert-id={alert.id}
                  href={`#expiry?product=${encodeURIComponent(alert.product_code)}`}
                  title={
                    product ? (
                      <ProductName product={product} language={lang} />
                    ) : (
                      <LtrText>{alert.product_code}</LtrText>
                    )
                  }
                  summary={dateReminderMessage(state, alert, lang)}
                  category={category.label}
                  categoryTone={category.tone}
                  status={
                    <Badge tone={past ? "danger" : "pending"}>
                      {past
                        ? t("Expired", "تاریخ‌گذشته")
                        : t("Expiring soon", "نزدیک انقضا")}
                    </Badge>
                  }
                />
              );
            })}
          </div>
        </Card>
      )}
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title={t("Apply price to all branches", "اعمال قیمت به همه شعبه‌ها")}
          description={t(
            "Review the company-wide price before confirming.",
            "پیش از تأیید، قیمت سراسری شرکت را بررسی کنید.",
          )}
          confirmLabel={t(
            "Apply price to all branches",
            "اعمال قیمت به همه شعبه‌ها",
          )}
          onConfirm={applyToAll}
        >
          <p>
            {t("Every branch will use", "همه شعبه‌ها استفاده می‌کنند")}:{" "}
            <strong>
              <Money value={confirm.price} />
            </strong>
          </p>
          <DataTable>
            <thead>
              <tr>
                <th>{t("Branch", "شعبه")}</th>
                <th>{t("Price change", "تغییر قیمت")}</th>
                <th>{t("Affected offer", "پیشنهاد مرتبط")}</th>
                <th>{t("Override removed", "حذف قیمت ویژه")}</th>
              </tr>
            </thead>
            <tbody>
              {confirm.effects.map((effect) => {
                const value = effect.branch,
                  price = effect.price;
                return (
                  <tr key={value}>
                    <td>{branchName(value)}</td>
                    <td>
                      <div className="price-change-values">
                        <span>
                          {t("Old", "قبلی")}{" "}
                          {price ? <Money value={price} /> : "—"}
                        </span>
                        <span>
                          {t("New", "جدید")} <Money value={confirm.price} />
                        </span>
                      </div>
                    </td>
                    <td>
                      {effect.offer_label ? (
                        <OfferLabel
                          label={effect.offer_label}
                          language={lang}
                        />
                      ) : (
                        t("None", "ندارد")
                      )}
                      {effect.offer_stops && (
                        <> · {t("Will stop", "متوقف می‌شود")}</>
                      )}
                    </td>
                    <td>
                      {effect.override_removed
                        ? t("Yes", "بله")
                        : t("No", "خیر")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <p>
            {t(
              "This removes every branch override, including intentional differences. Incompatible offers stop; newly suggested offers need worker confirmation.",
              "این کار همه قیمت‌های ویژه شعبه‌ها، از جمله اختلاف‌های عمدی را حذف می‌کند. پیشنهادهای ناسازگار متوقف می‌شوند و پیشنهادهای جدید به تأیید کارکنان نیاز دارند.",
            )}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

export default Alerts;
