import type { Language } from "./types";

const copy = {
  change: ["Change price", "تغییر قیمت"],
  changeSale: ["Change sale", "تغییر حراج"],
  request: ["Request a sale", "درخواست حراج"],
  sale: ["Sale", "حراج"],
  saleChoice: ["Sale, for a while", "حراج، برای مدتی"],
  saleHint: [
    "The regular price comes back by itself.",
    "قیمت عادی خودبه‌خود برمی‌گردد.",
  ],
  regular: ["Regular", "عادی"],
  newRegular: ["New regular price", "قیمت عادی جدید"],
  regularHint: [
    "Stays until a new invoice changes the cost.",
    "تا زمانی می‌ماند که فاکتور جدید هزینه را تغییر دهد.",
  ],
  afterSale: ["Applies after the sale", "پس از حراج اعمال می‌شود"],
  saleChargeStays: [
    "Customers keep paying the sale price.",
    "مشتریان همچنان قیمت حراج را پرداخت می‌کنند.",
  ],
  deferredLabels: [
    "Regular labels are added when the sale ends. The current Promo label stays.",
    "برچسب‌های عادی پس از پایان حراج اضافه می‌شوند. برچسب حراج فعلی باقی می‌ماند.",
  ],
  price: ["Price", "قیمت"],
  stores: ["Stores", "فروشگاه‌ها"],
  allStores: ["All stores", "همهٔ فروشگاه‌ها"],
  chooseStores: ["Choose stores", "انتخاب فروشگاه‌ها"],
  starts: ["Starts", "شروع"],
  today: ["Today", "امروز"],
  tomorrow: ["Tomorrow", "فردا"],
  date: ["Date", "تاریخ"],
  ends: ["Ends", "پایان"],
  lastDay: ["Last day", "آخرین روز"],
  oneWeek: ["1 week", "۱ هفته"],
  twoWeeks: ["2 weeks", "۲ هفته"],
  endMonth: ["End of month", "پایان ماه"],
  whenEnded: ["When I end it", "وقتی خودم پایان بدهم"],
  noEnd: ["No end date", "بدون تاریخ پایان"],
  until: ["Until", "تا"],
  promoLabels: [
    "Add Promo labels to the label waitlist",
    "افزودن برچسب‌های حراج به فهرست انتظار برچسب‌ها",
  ],
  regularLabels: [
    "Add regular labels to the label waitlist",
    "افزودن برچسب‌های عادی به فهرست انتظار برچسب‌ها",
  ],
  useAnyway: ["Use this price anyway", "با این حال از این قیمت استفاده شود"],
  reason: ["Reason", "دلیل"],
  why: ["Why? (optional)", "چرا؟ (اختیاری)"],
  requested: ["Sale requested", "حراج درخواست‌شده"],
  waiting: ["Waiting for approval", "در انتظار تأیید"],
  approvalHint: [
    "The manager approves this first. Until then, the regular price stays.",
    "مدیر ابتدا این درخواست را تأیید می‌کند. تا آن زمان، قیمت عادی باقی می‌ماند.",
  ],
  startSale: ["Start sale", "شروع حراج"],
  scheduleSale: ["Schedule sale", "زمان‌بندی حراج"],
  saveRegular: ["Save new price", "ذخیرهٔ قیمت جدید"],
  sendRequest: ["Send request", "ارسال درخواست"],
  changeApprove: ["Change and approve", "تغییر و تأیید"],
  endNow: ["End sale now", "پایان حراج اکنون"],
  withdraw: ["Withdraw request", "پس‌گرفتن درخواست"],
  paused: ["Paused during sale", "متوقف در طول حراج"],
  onSale: ["On sale", "در حراج"],
} satisfies Record<string, [string, string]>;

export function salesText(
  t: (en: string, fa: string) => string,
  key: keyof typeof copy,
): string {
  return t(...copy[key]);
}

/** A local calendar date is not an instant; do not shift it across a time zone. */
export function saleCalendarDate(
  value: string,
  language: Language,
  long = false,
): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    language === "fa" ? "fa-IR-u-ca-gregory-nu-latn" : "en-CA",
    {
      timeZone: "UTC",
      month: long ? "long" : "short",
      day: "numeric",
      ...(long ? { weekday: "long" as const, year: "numeric" as const } : {}),
    },
  ).format(date);
}
