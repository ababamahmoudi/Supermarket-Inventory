import type { ComponentProps } from "react";
import type { Badge } from "./ui";
import type { Alert } from "./types";

type Tone = ComponentProps<typeof Badge>["tone"];
type Translate = (en: string, fa: string) => string;

/** The category a manager sees on every alert row (one list, one label each). */
export function alertCategory(
  type: Alert["type"],
  t: Translate,
): { label: string; tone: Tone } {
  switch (type) {
    case "price_conflict":
      return {
        label: t("Cross-branch price", "قیمت میان شعب"),
        tone: "danger",
      };
    case "date_reminder":
      return { label: t("Date tracking", "پیگیری تاریخ"), tone: "info" };
    case "lower_price":
      return {
        label: t("Lower supplier cost", "کاهش هزینه تأمین‌کننده"),
        tone: "pending",
      };
    case "other_supplier":
      return {
        label: t("Other supplier price", "قیمت تأمین‌کننده دیگر"),
        tone: "pending",
      };
    case "tax_discrepancy":
      return { label: t("Tax discrepancy", "مغایرت مالیات"), tone: "danger" };
    case "barcode_conflict":
      return { label: t("Barcode conflict", "تعارض بارکد"), tone: "danger" };
    case "order_differences":
      return {
        label: t("Order differences", "اختلاف‌های سفارش"),
        tone: "pending",
      };
    case "return_credit_overdue":
      return {
        label: t("Return credit", "اعتبار مرجوعی"),
        tone: "pending",
      };
    default:
      return { label: t("Sale", "حراج"), tone: "pending" };
  }
}
