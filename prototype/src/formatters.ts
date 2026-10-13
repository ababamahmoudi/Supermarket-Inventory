import Decimal from "decimal.js";
import { configSeed } from "./config";
import { translate } from "./i18n";
import type { Language } from "./types";

export interface MoneyOptions {
  currency?: string;
  decimals?: number;
  compact?: boolean;
}

/** Presentation only: amounts remain Decimal strings in the business model. */
export function formatMoney(
  value: Decimal.Value,
  { currency = configSeed.company.currency, decimals = 4 }: MoneyOptions = {},
): string {
  const amount = new Decimal(value);
  if (!amount.isFinite()) throw new Error("Money must be finite");
  const symbol =
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  // Currency always retains cents; extra source-cost precision is presentation
  // evidence, not a new monetary rounding or allocation rule.
  let digits = amount
    .abs()
    .toFixed(Math.min(4, Math.max(2, decimals)), Decimal.ROUND_HALF_UP)
    .replace(/(\.\d{2,}?)0+$/, "$1");
  const [whole, fraction] = digits.split(".");
  digits =
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction === undefined ? "" : `.${fraction}`);
  return `${amount.isNegative() && !amount.isZero() ? "-" : ""}${symbol}${digits}`;
}

/** Calendar dates stay unchanged; instants use the configured store's day. */
export function formatDate(
  value: string | Date | null | undefined,
  timeZone = configSeed.company.timezone,
): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    numberingSystem: "latn",
  }).format(instant);
}

export function formatUnitSize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Keep the entered quantity's precision; choose only its translated unit label. */
export function formatQuantity(
  value: string | number,
  unit: "units" | "cases" | "lb" | "kg",
  language: Language,
): string {
  let singular = false;
  try {
    singular = new Decimal(value).eq(1);
  } catch {
    /* Invalid form drafts retain their text. */
  }
  const label =
    unit === "units"
      ? translate(singular ? "unit" : "units", "واحد", language)
      : unit === "cases"
        ? translate(singular ? "case" : "cases", "کارتن", language)
        : unit;
  return `${value} ${label}`;
}

/** Read-only Each quantities use actual units and their retained integer pack. */
export function formatCasesAndUnits(
  units: Decimal.Value,
  unitsPerCase: Decimal.Value,
  language: Language,
): string {
  const quantity = new Decimal(units);
  const pack = new Decimal(unitsPerCase);
  if (
    !quantity.isFinite() ||
    !quantity.isInteger() ||
    quantity.isNegative() ||
    !pack.isFinite() ||
    !pack.isInteger() ||
    pack.lte(1)
  )
    return formatQuantity(quantity.toString(), "units", language);
  const cases = quantity.div(pack).floor();
  const loose = quantity.mod(pack);
  if (cases.isZero())
    return formatQuantity(loose.toString(), "units", language);
  const fullCases = formatQuantity(cases.toString(), "cases", language);
  return loose.isZero()
    ? fullCases
    : `${fullCases} + ${formatQuantity(loose.toString(), "units", language)}`;
}

export function branchLabel(branch: string, language: Language): string {
  if (branch === "all")
    return translate("All branches", "همه شعبه‌ها", language);
  const number = branch.match(/^(?:Branch\s*|B)(\d+)(?:\b|$)/i)?.[1];
  if (number) return translate(`Branch ${number}`, `شعبه ${number}`, language);
  return branch;
}

const userCopy: Record<string, [string, string]> = {
  supervisor: ["Demo Supervisor", "سرپرست نمایشی"],
  floorworker: ["Demo Floor Worker", "کارمند سالن نمایشی"],
  cashier: ["Demo Cashier", "صندوقدار نمایشی"],
  newemployee: ["Demo New Employee", "کارمند جدید نمایشی"],
};
export function demoUserLabel(
  nameOrUsername: string,
  language: Language,
): string {
  const entry =
    userCopy[nameOrUsername.toLowerCase()] ??
    Object.values(userCopy).find(([name]) => name === nameOrUsername);
  return entry ? translate(...entry, language) : nameOrUsername;
}

const categoryCopy: Record<string, [string, string]> = {
  grocery: ["Grocery", "مواد غذایی"],
  grocery_taxable: ["Grocery (Taxable)", "مواد غذایی (مشمول مالیات)"],
  rice: ["Rice", "برنج"],
  kitchenware: ["Kitchenware", "لوازم آشپزخانه"],
  "beans & legumes": ["Beans & legumes", "حبوبات"],
  "bread & bakery": ["Bread & bakery", "نان و محصولات نانوایی"],
  cleaning: ["Cleaning", "شوینده‌ها"],
  cookware: ["Cookware", "ظروف پخت‌وپز"],
  juices: ["Juices", "آبمیوه‌ها"],
  oils: ["Oils", "روغن‌ها"],
  "small appliances": ["Small appliances", "لوازم برقی کوچک"],
  snacks: ["Snacks", "تنقلات"],
  "soft drinks": ["Soft drinks", "نوشابه‌ها"],
  spices: ["Spices", "ادویه‌ها"],
  tableware: ["Tableware", "ظروف غذاخوری"],
  "tea & coffee": ["Tea & coffee", "چای و قهوه"],
};
export function categoryLabel(value: string, language: Language): string {
  const entry =
    categoryCopy[value.toLowerCase()] ??
    Object.values(categoryCopy).find(([name]) => name === value);
  return entry ? translate(...entry, language) : value;
}

const activityCopy: Record<string, [string, string]> = {
  "Save product": ["Save product", "ذخیره محصول"],
  "Report barcode conflict": ["Report barcode conflict", "گزارش تداخل بارکد"],
  "Keep barcode mappings": ["Keep barcode mappings", "حفظ اتصال بارکدها"],
  "Reject barcode change": ["Reject barcode change", "رد تغییر بارکد"],
  "Approve product": ["Approve product", "تأیید محصول"],
  "Approve price": ["Approve price", "تأیید قیمت"],
  "Reject proposal": ["Reject proposal", "رد پیشنهاد"],
  "Apply price to all branches": [
    "Apply price to all branches",
    "اعمال قیمت به همه شعبه‌ها",
  ],
  "Keep approved price": ["Keep approved price", "حفظ قیمت تأییدشده"],
  "Propose manual override": [
    "Propose manual override",
    "پیشنهاد تغییر دستی قیمت",
  ],
  "Mark as intentional": ["Mark as intentional", "علامت‌گذاری به‌عنوان عمدی"],
  "Confirm offer": ["Confirm offer", "تأیید پیشنهاد ویژه"],
  "Create offer": ["Create offer", "ایجاد پیشنهاد ویژه"],
  Dismiss: ["Dismiss", "نادیده گرفتن"],
  "Stop offer": ["Stop offer", "توقف پیشنهاد ویژه"],
  "Turn on date tracking": ["Turn on date tracking", "روشن کردن پیگیری تاریخ"],
  "Turn off date tracking": [
    "Turn off date tracking",
    "خاموش کردن پیگیری تاریخ",
  ],
  "Keep as pending": ["Keep as pending", "نگه داشتن در انتظار"],
  "Mark as taken care of": [
    "Mark as taken care of",
    "علامت‌گذاری به‌عنوان رسیدگی‌شده",
  ],
  "Posted invoice": ["Posted invoice", "فاکتور ثبت شد"],
  "Received short delivery": [
    "Received short delivery",
    "تحویل کسری دریافت شد",
  ],
  supplier_dispute_recorded: [
    "Recorded supplier dispute",
    "اختلاف تأمین‌کننده ثبت شد",
  ],
  return_original_recovered: [
    "Received safe original goods",
    "اصل کالای سالم دریافت شد",
  ],
  return_pickup: ["Recorded return pickup", "جمع‌آوری مرجوعی ثبت شد"],
  return_pickup_corrected: ["Corrected pickup", "جمع‌آوری اصلاح شد"],
  return_resolution_outstanding: [
    "Recorded outstanding return",
    "باقی‌مانده مرجوعی ثبت شد",
  ],
  return_leftover_shelf: [
    "Put returned goods back on the shelf",
    "کالای مرجوعی به قفسه بازگردانده شد",
  ],
  return_leftover_thrown_away: [
    "Recorded thrown-away return goods",
    "دورریختن کالای مرجوعی ثبت شد",
  ],
  "Remove line": ["Remove line", "حذف ردیف"],
  replacement_received: ["Received replacement", "جایگزین دریافت شد"],
  return_claim_submitted: ["Submitted return claim", "ادعای مرجوعی ارسال شد"],
  return_claim_posted: ["Posted return claim", "ادعای مرجوعی ثبت شد"],
  return_cancelled: ["Cancelled return", "مرجوعی لغو شد"],
  return_cancellation_review: [
    "Requested cancellation review",
    "بررسی لغو درخواست شد",
  ],
  return_cancellation_approved: ["Approved cancellation", "لغو تأیید شد"],
  return_cancellation_declined: ["Declined cancellation", "لغو رد شد"],
  store_use_recorded: ["Recorded store use", "مصرف فروشگاه ثبت شد"],
  note_added: ["Added note", "یادداشت افزوده شد"],
  note_seen: ["Marked note seen", "یادداشت دیده‌شده علامت‌گذاری شد"],
  note_resolved: ["Completed note", "یادداشت انجام شد"],
  expiry_cleared: ["Cleared date entry", "تاریخ پاک شد"],
  payment_recorded: [
    "Recorded external payment",
    "پرداخت خارج از برنامه ثبت شد",
  ],
  ledger_adjustment_recorded: [
    "Recorded ledger adjustment",
    "تعدیل دفتر ثبت شد",
  ],
};
export function activityLabel(action: string, language: Language): string {
  const entry = activityCopy[action];
  return entry
    ? translate(...entry, language)
    : translate("Recorded activity", "فعالیت ثبت‌شده", language);
}

export function offerParts(
  label: string,
): { quantity: string; price: string } | undefined {
  const match = label.match(/^(\d+)\s+for\s+\$\s*(\d+(?:\.\d+)?)$/i);
  return match ? { quantity: match[1], price: match[2] } : undefined;
}
export function formatOffer(
  label: string,
  language: Language,
  currency?: string,
): string {
  const parts = offerParts(label);
  if (!parts) return label;
  const quantity = new Intl.NumberFormat(
    language === "fa" ? "fa-IR" : "en-US",
    { useGrouping: false },
  ).format(Number(parts.quantity));
  const price = formatMoney(parts.price, { currency, compact: true });
  return language === "fa"
    ? `${quantity} ${translate("for", "عدد", language)} \u2066${price}\u2069`
    : `${quantity} for ${price}`;
}
