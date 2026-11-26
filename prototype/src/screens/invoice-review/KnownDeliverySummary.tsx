import { useDemo } from "../../store";
import { LtrValue } from "../../presentation";
import { ReadingMoney as Money } from "../../InvoiceReadingReview";
import type { InvoiceLineView } from "../../invoice-projections";
import { categoryLabel } from "../../formatters";

export function KnownDeliverySummary({
  known,
}: {
  known: InvoiceLineView["known_delivery"];
}) {
  const { t, state, lang } = useDemo();
  if (!known) return null;
  return (
    <small
      className="receiving-known-delivery"
      data-known-delivery={known.status}
    >
      {known.status === "same"
        ? t("Same as last delivery", "مانند تحویل قبلی")
        : known.changes.map((change) => (
            <span key={change.field} data-changed-field={change.field}>
              {change.field === "unit_cost_before_tax" ? (
                <>
                  {t("Cost", "هزینه")} <Money value={change.before} /> →{" "}
                  <Money value={change.after} />{" "}
                  {change.unit === "case"
                    ? t("per case", "برای هر کارتن")
                    : change.unit === "lb"
                      ? t("per lb", "برای هر پوند")
                      : t("per unit", "برای هر واحد")}
                </>
              ) : change.field === "quantity_unit" ? (
                <>
                  {t("Sold by", "نوع فروش")}{" "}
                  {change.before === "weight"
                    ? t("Weight", "وزن")
                    : t("Each", "واحد")}{" "}
                  →{" "}
                  {change.after === "weight"
                    ? t("Weight", "وزن")
                    : t("Each", "واحد")}
                </>
              ) : change.field === "supplier_item_code" ? (
                <>
                  {t("Supplier code", "کد تأمین‌کننده")}{" "}
                  <LtrValue value={change.before} /> →{" "}
                  <LtrValue value={change.after} />
                </>
              ) : change.field === "description" ? (
                t("Name differs from last time", "نام با تحویل قبلی تفاوت دارد")
              ) : change.field === "pricing_category" ? (
                <>
                  {t("Category", "دسته")}{" "}
                  {categoryLabel(
                    state.config.pricing_categories.find(
                      (category) => category.key === change.before,
                    )?.label ?? change.before,
                    lang,
                  )}{" "}
                  →{" "}
                  {categoryLabel(
                    state.config.pricing_categories.find(
                      (category) => category.key === change.after,
                    )?.label ?? change.after,
                    lang,
                  )}
                </>
              ) : (
                <>
                  {t("Pack", "بسته")} <LtrValue value={change.before} /> →{" "}
                  <LtrValue value={change.after} />
                </>
              )}{" "}
              {t("(was", "(قبلی")} <LtrValue value={known.date} />)
            </span>
          ))}
    </small>
  );
}
