import { useState } from "react";
import {
  applyApprovedPrice,
  approvalSnapshot,
  demoBranches,
  markPriceConflictIntentional,
  setAlertStatus,
} from "../approvals";
import { useDemo } from "../store";
import { effectiveOffer, effectivePrice } from "../catalog";
import {
  branchLabel,
  DateText,
  LtrText,
  Money,
  OfferLabel,
  ProductName,
} from "../presentation";
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
  const { state, update, role, branch, lang, t } = useDemo();
  const [showResolved, setShowResolved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{
    code: string;
    price: string;
    snapshot: string;
  } | null>(null);
  const company = state.config.company.seed_key;
  const alerts = state.alerts.filter(
    (item) =>
      item.company_id === company &&
      (showResolved || item.status === "pending") &&
      (branch === "all" || item.branch === branch || item.branch === "all"),
  );
  if (role !== "supervisor")
    return (
      <EmptyState>
        {t(
          "Switch to Supervisor to review alerts.",
          "برای بررسی هشدارها به سرپرست تغییر دهید.",
        )}
      </EmptyState>
    );
  const branchName = (value: string) => branchLabel(value, lang);
  const resolve = (id: string, status: "pending" | "resolved") => {
    update((draft) => setAlertStatus(draft, id, status, notes[id]));
    setMessage(
      status === "resolved"
        ? t("Marked as taken care of.", "رسیدگی‌شده ثبت شد.")
        : t("Kept as pending.", "در انتظار حفظ شد."),
    );
  };
  const applyToAll = () => {
    if (!confirm) return;
    const current = approvalSnapshot(state, confirm.code);
    if (current !== confirm.snapshot) {
      setConfirm(null);
      setMessage(
        t(
          "Prices changed. Review the latest conflict and choose the price again.",
          "قیمت‌ها تغییر کردند. اختلاف تازه را بررسی و دوباره قیمت را انتخاب کنید.",
        ),
      );
      return;
    }
    update((draft) =>
      applyApprovedPrice(draft, confirm.code, confirm.price, "all", "all"),
    );
    setMessage(
      t(
        "Applied price to all branches. Overrides were removed and offers were checked.",
        "قیمت به همه شعبه‌ها اعمال شد. قیمت‌های ویژه حذف و پیشنهادها بررسی شدند.",
      ),
    );
    setConfirm(null);
  };
  return (
    <>
      <PageHeader
        title={t("Alerts", "هشدارها")}
        description={t(
          "Lower supplier costs and branch price differences need a clear decision.",
          "کاهش هزینه تأمین‌کننده و اختلاف قیمت شعبه‌ها به تصمیم روشن نیاز دارند.",
        )}
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
      {alerts.length === 0 && (
        <EmptyState>
          {t(
            "No pending alerts. Receive the demo invoice to review a lower supplier cost.",
            "هشدار در انتظار وجود ندارد. فاکتور نمایشی را دریافت کنید تا کاهش هزینه تأمین‌کننده را بررسی کنید.",
          )}
        </EmptyState>
      )}
      {alerts.map((alert) => {
        const product = state.products.find(
          (item) =>
            item.company_id === company && item.code === alert.product_code,
        );
        const title =
          alert.type === "price_conflict"
            ? t("Cross-branch price conflict", "اختلاف قیمت بین شعبه‌ها")
            : alert.type === "lower_price"
              ? t("Same-supplier lower price", "قیمت کمتر از همان تأمین‌کننده")
              : alert.type === "other_supplier"
                ? t("Different-supplier price", "قیمت تأمین‌کننده دیگر")
                : alert.type === "tax_discrepancy"
                  ? t("Tax discrepancy", "اختلاف مالیات")
                  : t("Barcode conflict", "تداخل بارکد");
        return (
          <Card key={alert.id} title={title} className="alert-card">
            <div className="row">
              {product ? (
                <ProductName product={product} language={lang} />
              ) : (
                <LtrText>{alert.product_code}</LtrText>
              )}
              <Badge
                tone={
                  alert.status === "pending"
                    ? alert.type === "price_conflict" ||
                      alert.type === "tax_discrepancy" ||
                      alert.type === "barcode_conflict"
                      ? "danger"
                      : "pending"
                    : alert.status === "intentional"
                      ? "info"
                      : "approved"
                }
              >
                {alert.status === "pending"
                  ? alert.type === "price_conflict" ||
                    alert.type === "barcode_conflict"
                    ? t("Conflict", "اختلاف")
                    : alert.type === "tax_discrepancy"
                      ? t("Tax discrepancy", "اختلاف مالیات")
                      : t("Still pending", "هنوز در انتظار")
                  : alert.status === "intentional"
                    ? t("Intentional", "عمدی")
                    : t("Resolved", "حل‌شده")}
              </Badge>
            </div>
            <p className="muted alert-branch">{branchName(alert.branch)}</p>
            {alert.type === "price_conflict" ? (
              <>
                <DataTable
                  columns={[
                    { width: "40%" },
                    { width: 180, align: "end" },
                    { width: 260, actions: true, align: "end" },
                  ]}
                >
                  <thead>
                    <tr>
                      <th>{t("Branch", "شعبه")}</th>
                      <th className="numeric">
                        {t("Approved selling price", "قیمت فروش تأییدشده")}
                      </th>
                      <th>{t("Action", "اقدام")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(alert.branch_prices ?? {}).map(
                      ([name, price]) => (
                        <tr key={name}>
                          <td>{branchName(name)}</td>
                          <td className="numeric">
                            <Money value={price} />
                          </td>
                          <td>
                            {alert.status === "pending" && (
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  setConfirm({
                                    code: alert.product_code,
                                    price,
                                    snapshot: approvalSnapshot(
                                      state,
                                      alert.product_code,
                                    ),
                                  })
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
                      ),
                    )}
                  </tbody>
                </DataTable>
                <p className="muted">
                  {t(
                    "Intentional differences stay quiet until an approved branch price changes.",
                    "اختلاف‌های عمدی تا تغییر قیمت تأییدشده یک شعبه، دوباره هشدار نمی‌دهند.",
                  )}
                </p>
                {alert.status === "pending" && (
                  <Button
                    onClick={() => {
                      update((draft) =>
                        markPriceConflictIntentional(draft, alert.id),
                      );
                      setMessage(
                        t(
                          "Marked as intentional. A later price change will create a new alert.",
                          "عمدی ثبت شد. تغییر بعدی قیمت، هشدار تازه ایجاد می‌کند.",
                        ),
                      );
                    }}
                  >
                    {t("Mark as intentional", "ثبت به عنوان عمدی")}
                  </Button>
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
                {alert.type === "lower_price" && (
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
                          no: t("Different expiry dates", "تاریخ‌های متفاوت"),
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
                <Field
                  label={t(
                    "Supervisor note (optional)",
                    "یادداشت سرپرست (اختیاری)",
                  )}
                >
                  <input
                    value={notes[alert.id] ?? ""}
                    onChange={(event) =>
                      setNotes({ ...notes, [alert.id]: event.target.value })
                    }
                  />
                </Field>
                <div className="actions">
                  <Button onClick={() => resolve(alert.id, "resolved")}>
                    {t("Mark as taken care of", "ثبت رسیدگی‌شده")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => resolve(alert.id, "pending")}
                  >
                    {t("Keep as pending", "حفظ در انتظار")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        );
      })}
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
              {demoBranches.map((value) => {
                const product = state.products.find(
                  (item) =>
                    item.company_id === company && item.code === confirm.code,
                )!;
                const price = effectivePrice(state, product, value);
                const offer = effectiveOffer(state, product, value);
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
                      {offer ? (
                        <OfferLabel label={offer.label} language={lang} />
                      ) : (
                        t("None", "ندارد")
                      )}
                      {offer && offer.price !== confirm.price && (
                        <> · {t("Will stop", "متوقف می‌شود")}</>
                      )}
                    </td>
                    <td>
                      {product.branch_prices?.[value]
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
