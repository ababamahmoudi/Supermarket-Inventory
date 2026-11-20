import { validMoney } from "../../invoice";
export type InvoiceAmountField = "subtotal" | "tax" | "final_total";
export function invoiceAmountIssue(
  field: InvoiceAmountField,
  value: string | undefined,
  t: (en: string, fa: string) => string,
): string | undefined {
  if (validMoney(value ?? "")) return;
  const labels: Record<InvoiceAmountField, [string, string]> = {
    subtotal: ["Subtotal", "جمع پیش از مالیات"],
    tax: ["Tax", "مالیات"],
    final_total: ["Invoice total", "جمع فاکتور"],
  };
  if (!value?.trim()) {
    if (field === "tax")
      return t(
        "Tax is empty. Enter the tax from the invoice (0.00 if there is none).",
        "مالیات خالی است. مالیات فاکتور را وارد کنید (اگر مالیات ندارد، 0.00 وارد کنید).",
      );
    return t(
      `${labels[field][0]} is empty. Enter the ${field === "subtotal" ? "subtotal" : "invoice total"} from the invoice.`,
      `${labels[field][1]} خالی است. مبلغ را از روی فاکتور وارد کنید.`,
    );
  }
  return t(
    `${labels[field][0]} is invalid. Enter a nonnegative amount with up to two decimal places.`,
    `${labels[field][1]} نامعتبر است. مبلغ صفر یا بیشتر با حداکثر دو رقم اعشار وارد کنید.`,
  );
}
