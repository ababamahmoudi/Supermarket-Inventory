import type { OrderStatus } from "./orders";

export const orderStatusCopy: Record<OrderStatus, [string, string]> = {
  draft: ["Draft", "پیش‌نویس"],
  ordered: ["Ordered", "سفارش‌داده‌شده"],
  partially_received: ["Partially received", "بخشی دریافت‌شده"],
  received: ["Received", "دریافت‌شده"],
  cancelled: ["Cancelled", "لغوشده"],
};
const errors: Record<string, [string, string]> = {
  permission: [
    "Orders are not enabled for your role. Ask your Supervisor to check Settings.",
    "سفارش‌ها برای نقش شما فعال نیست. از سرپرست بخواهید تنظیمات را بررسی کند.",
  ],
  scope: [
    "This order is outside your company or assigned locations.",
    "این سفارش خارج از شرکت یا مکان‌های مجاز شما است.",
  ],
  location: [
    "Choose an active location you can use.",
    "یک مکان فعال و مجاز انتخاب کنید.",
  ],
  supplier: [
    "Choose an active, confirmed supplier.",
    "یک تأمین‌کنندهٔ فعال و تأییدشده انتخاب کنید.",
  ],
  item: [
    "Choose each supplier item only once.",
    "هر کالای تأمین‌کننده را فقط یک بار انتخاب کنید.",
  ],
  quantity: [
    "Enter positive Cases that convert to whole units with this pack.",
    "تعداد مثبت کارتن وارد کنید که با این بسته به تعداد صحیح واحد تبدیل شود.",
  ],
  cost: [
    "Enter Expected unit cost for every item before placing the order (up to 4 decimals).",
    "پیش از ثبت سفارش، هزینهٔ مورد انتظار هر واحد را برای همهٔ کالاها وارد کنید (تا ۴ رقم اعشار).",
  ],
  empty: [
    "Add at least one supplier item before placing the order.",
    "پیش از ثبت سفارش، دست‌کم یک کالای تأمین‌کننده اضافه کنید.",
  ],
  notes: [
    "Choose a supplier item and Cases for every selected To order note.",
    "برای هر یادداشت انتخاب‌شدهٔ برای سفارش، کالا و تعداد کارتن را انتخاب کنید.",
  ],
  status: [
    "This order cannot be changed in its current status.",
    "این سفارش در وضعیت فعلی قابل تغییر نیست.",
  ],
  stale: [
    "The order changed. Reopen it and review the latest values.",
    "سفارش تغییر کرده است. آن را دوباره باز و مقادیر جدید را بررسی کنید.",
  ],
  reason: [
    "Enter a reason for cancelling this order.",
    "دلیل لغو این سفارش را وارد کنید.",
  ],
  receipt: [
    "The receipt does not match the posted invoice. Review the linked invoice.",
    "رسید با فاکتور ثبت‌شده مطابقت ندارد. فاکتور مرتبط را بررسی کنید.",
  ],
  decision: [
    "Review every remaining order item and choose its delivery decision.",
    "همهٔ کالاهای باقی‌ماندهٔ سفارش را بررسی و تصمیم تحویل را انتخاب کنید.",
  ],
};
export function orderError(
  error: unknown,
  t: (en: string, fa: string) => string,
): string {
  return t(
    ...(errors[error instanceof Error ? error.message : ""] ?? errors.receipt),
  );
}
