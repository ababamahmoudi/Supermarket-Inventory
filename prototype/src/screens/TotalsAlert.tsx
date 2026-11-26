import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { useDemo } from "../store";
import { invoiceTotalsAlertFacts } from "../alert-totals";
import { branchLabel } from "../settings";
import { configuredRoleLabel } from "../role-config";
import { companyTimestampText } from "../company-time";
import { demoUserLabel } from "../formatters";
import { LtrText, Money, NotAdded } from "../presentation";
import { Badge, Button, Field } from "../ui";
import type { Alert } from "../types";

/**
 * PR 29 (Ali, 2026-11-20): a totals alert says what is wrong in plain words
 * and shows the paper and calculated numbers side by side, with the posted
 * invoice one click away. Its Taken care of / Still pending rules are the
 * ordinary alert rules.
 */
export function TotalsAlert({
  alert,
  canDecide,
  note,
  onNote,
  onResolve,
}: {
  alert: Alert;
  canDecide: boolean;
  note: string;
  onNote: (value: string) => void;
  onResolve: (status: "pending" | "resolved") => void;
}) {
  const { state, lang, t, navigate } = useDemo();
  const invoiceId = alert.invoice_id ?? alert.id.replace(/:tax$/, "");
  const invoice = (state.invoices ?? []).find(
    (row) => row.company_id === alert.company_id && row.id === invoiceId,
  );
  const posted = state.activity.find(
    (entry) => entry.id === `${invoiceId}:activity`,
  );
  const facts = invoice ? invoiceTotalsAlertFacts(invoice) : null;
  const number = invoice?.supplier_invoice_number || invoiceId;
  const supplier = invoice?.supplier ?? alert.supplier;
  const href = `#invoices?id=${encodeURIComponent(invoiceId)}`;
  const label =
    facts?.kind === "tax"
      ? t("Tax doesn't match", "مالیات هم‌خوانی ندارد")
      : t("Totals don't match", "جمع‌ها هم‌خوانی ندارند");
  const tile = (
    key: string,
    caption: string,
    value: ReactNode,
    danger = false,
  ) => (
    <div
      className={`totals-alert-stat${danger ? " is-danger" : ""}`}
      data-stat={key}
    >
      <span className="totals-alert-stat-label">{caption}</span>
      <strong className="totals-alert-stat-value">{value}</strong>
    </div>
  );
  return (
    <section
      className="list-box totals-alert"
      data-alert-id={alert.id}
      aria-label={t(
        `Invoice ${number} totals don't match`,
        `جمع‌های فاکتور ${number} هم‌خوانی ندارند`,
      )}
    >
      <div className="totals-alert-head">
        <h3>
          {lang === "fa" ? (
            <>
              جمع‌های فاکتور{" "}
              <a className="entity-link" href={href}>
                <LtrText>{number}</LtrText>
              </a>{" "}
              هم‌خوانی ندارند
            </>
          ) : (
            <>
              Invoice{" "}
              <a className="entity-link" href={href}>
                <LtrText>{number}</LtrText>
              </a>{" "}
              totals don&apos;t match
            </>
          )}
        </h3>
        <span className="totals-alert-tags">
          <Badge tone="danger">{label}</Badge>
          {alert.status !== "pending" && (
            <Badge tone="approved">{t("Taken care of", "رسیدگی‌شده")}</Badge>
          )}
        </span>
      </div>
      <p className="muted totals-alert-meta">
        {supplier && (
          <a
            className="entity-link"
            href={`#suppliers?name=${encodeURIComponent(supplier)}`}
          >
            <bdi>{supplier}</bdi>
          </a>
        )}
        {" · "}
        {branchLabel(state.config, alert.branch, lang)}
        {(invoice?.posted_at || posted?.at) && (
          <>
            {" · "}
            {t("posted", "ثبت‌شده")}{" "}
            <LtrText>
              {companyTimestampText(
                state.config,
                invoice?.posted_at ?? posted?.at,
              )}
            </LtrText>
            {posted?.by && (
              <>
                {" "}
                {t("by", "توسط")} <bdi>{demoUserLabel(posted.by, lang)}</bdi>
              </>
            )}
          </>
        )}
      </p>
      {facts ? (
        <div className="totals-alert-stats">
          {tile(
            "paper",
            t("Subtotal on paper", "جمع پیش از مالیات روی کاغذ"),
            <Money value={facts.paperSubtotal} />,
          )}
          {tile(
            "calculated",
            t("Calculated from the lines", "محاسبه‌شده از ردیف‌ها"),
            <Money value={facts.calculated} />,
          )}
          {tile(
            "difference",
            t("Difference", "اختلاف"),
            <Money value={facts.difference} />,
            true,
          )}
          {tile(
            "tax-total",
            t("Tax · invoice total on paper", "مالیات · جمع فاکتور روی کاغذ"),
            <>
              <Money value={facts.tax} /> <span aria-hidden="true">·</span>{" "}
              <Money value={facts.total} />
            </>,
          )}
        </div>
      ) : (
        <p>{alert.note ?? <NotAdded />}</p>
      )}
      <p className="muted totals-alert-hint">
        {t(
          "Often a page that wasn't uploaded, or a line that was missed. Compare the lines with the paper, then use Correct invoice if something is missing.",
          "اغلب صفحه‌ای بارگذاری نشده یا ردیفی جا افتاده است. ردیف‌ها را با کاغذ مقایسه کنید و اگر چیزی کم است از «اصلاح فاکتور» استفاده کنید.",
        )}
      </p>
      {canDecide && alert.status === "pending" && (
        <Field
          label={t(
            `${configuredRoleLabel(state.config.roles, "manager", "en")} note (optional)`,
            `یادداشت ${configuredRoleLabel(state.config.roles, "manager", "fa")} (اختیاری)`,
          )}
        >
          <input
            value={note}
            placeholder={t("Not added", "ثبت نشده")}
            onChange={(event) => onNote(event.target.value)}
          />
        </Field>
      )}
      <div className="totals-alert-actions">
        <Button
          variant="tinted"
          disabled={!invoice}
          onClick={() =>
            navigate(`invoices?id=${encodeURIComponent(invoiceId)}`)
          }
        >
          <FileText size={18} aria-hidden="true" />
          {t("Open invoice", "باز کردن فاکتور")}
        </Button>
        {canDecide && alert.status === "pending" && (
          <span className="totals-alert-decisions">
            <Button variant="neutral" onClick={() => onResolve("pending")}>
              {t("Keep as pending", "حفظ در انتظار")}
            </Button>
            <Button onClick={() => onResolve("resolved")}>
              {t("Mark as taken care of", "ثبت رسیدگی‌شده")}
            </Button>
          </span>
        )}
      </div>
    </section>
  );
}
