import { activityLabel } from "./formatters";
import { translate } from "./i18n";
import { HistoryError } from "./history";
import type { Language } from "./types";

const actions: Record<string, [string, string]> = {
  Undone: ["Undone", "واگرد شد"],
  note_added: ["Add note", "افزودن یادداشت"],
  note_seen: ["Mark seen", "علامت دیده‌شده"],
  note_resolved: ["Mark done", "علامت انجام‌شده"],
  "Mark ordered": ["Mark ordered", "علامت سفارش‌داده‌شده"],
  "Save draft": ["Save draft", "ذخیره پیش‌نویس"],
  "Edit draft": ["Edit draft", "ویرایش پیش‌نویس"],
  "Company settings changed": [
    "Company settings changed",
    "تنظیمات شرکت تغییر کرد",
  ],
  "Branches changed": ["Branches changed", "شعبه‌ها تغییر کردند"],
  "Pricing rules changed": [
    "Pricing rules changed",
    "قواعد قیمت‌گذاری تغییر کرد",
  ],
  "Offer settings changed": [
    "Offer settings changed",
    "تنظیمات پیشنهاد ویژه تغییر کرد",
  ],
  "Modules changed": ["Modules changed", "ماژول‌ها تغییر کردند"],
  "Add to waitlist": ["Add to waitlist", "افزودن به صف چاپ"],
  "Remove from waitlist": ["Remove from waitlist", "حذف از صف چاپ"],
  "Change copies": ["Change copies", "تغییر تعداد نسخه"],
  "Clear waitlist": ["Clear waitlist", "پاک کردن صف چاپ"],
  "Save template": ["Save template", "ذخیره قالب"],
  "Duplicate template": ["Duplicate template", "کپی قالب"],
  "Archive template": ["Archive template", "بایگانی قالب"],
  "Restore template": ["Restore template", "بازیابی قالب"],
  "Move invoice": ["Move invoice", "انتقال فاکتور"],
  "Correct invoice": ["Correct invoice", "اصلاح فاکتور"],
  "Attach original": ["Attach original", "پیوست اصل"],
  "Return settings changed": [
    "Return settings changed",
    "تنظیمات مرجوعی تغییر کرد",
  ],
  "Return memo printed": ["Return memo printed", "رسید مرجوعی چاپ شد"],
  "Order settings changed": [
    "Order settings changed",
    "تنظیمات سفارش تغییر کرد",
  ],
  "Add supplier item": ["Add supplier item", "افزودن کالای تأمین‌کننده"],
  "Save supplier item": ["Save supplier item", "ذخیره کالای تأمین‌کننده"],
  "Create order draft": ["Create order draft", "ایجاد پیش‌نویس سفارش"],
  "Edit order draft": ["Edit order draft", "ویرایش پیش‌نویس سفارش"],
  "Add To order note to draft": [
    "Add To order note to draft",
    "افزودن یادداشت برای سفارش به پیش‌نویس",
  ],
  "To order note ordered": [
    "To order note ordered",
    "یادداشت برای سفارش ثبت شد",
  ],
  "Place order": ["Place order", "ثبت سفارش"],
  "Cancel order": ["Cancel order", "لغو سفارش"],
  "Receive order invoice": ["Receive order invoice", "دریافت فاکتور سفارش"],
  "Receive order Short delivery": [
    "Receive order Short delivery",
    "دریافت کسری سفارش",
  ],
  "Send request": ["Send request", "ارسال درخواست"],
  "Mark as sent": ["Mark as sent", "علامت ارسال‌شده"],
  "Mark as received": ["Mark as received", "علامت دریافت‌شده"],
  "Close request": ["Close request", "بستن درخواست"],
  "Cancel request": ["Cancel request", "لغو درخواست"],
  "Copy short or missing items": [
    "Copy short or missing items",
    "کپی کالاهای کسری یا دریافت‌نشده",
  ],
  "Create template": ["Create template", "ایجاد قالب"],
  "Save label settings": ["Save label settings", "ذخیره تنظیمات برچسب"],
  "Print labels": ["Print labels", "چاپ برچسب‌ها"],
  "Print test page": ["Print test page", "چاپ صفحه آزمایشی"],
  "Print test alignment page": [
    "Print test alignment page",
    "چاپ صفحه آزمایش هم‌ترازی",
  ],
  "Add notebook": ["Add notebook", "افزودن دفترچه"],
  "Edit notebook": ["Edit notebook", "ویرایش دفترچه"],
  "Archive notebook": ["Archive notebook", "بایگانی دفترچه"],
  "Restore notebook": ["Restore notebook", "بازیابی دفترچه"],
  "Add notebook entry": ["Add notebook entry", "افزودن یادداشت دفترچه"],
  "Edit notebook entry": ["Edit notebook entry", "ویرایش یادداشت دفترچه"],
  "Complete notebook entry": [
    "Complete notebook entry",
    "تکمیل یادداشت دفترچه",
  ],
  "Reopen notebook entry": ["Reopen notebook entry", "بازگشایی یادداشت دفترچه"],
  "Add supplier": ["Add supplier", "افزودن تأمین‌کننده"],
  "Save supplier": ["Save supplier", "ذخیره تأمین‌کننده"],
  "Edit supplier": ["Edit supplier", "ویرایش تأمین‌کننده"],
  "Deactivate supplier": ["Deactivate supplier", "غیرفعال کردن تأمین‌کننده"],
  "Confirm supplier": ["Confirm supplier", "تأیید تأمین‌کننده"],
  "Reject supplier": ["Reject supplier", "رد تأمین‌کننده"],
  "Add product": ["Add product", "افزودن محصول"],
  "Add date": ["Add date", "افزودن تاریخ"],
  "Remove date": ["Remove date", "حذف تاریخ"],
  "Stop tracking this product": [
    "Stop tracking this product",
    "توقف پیگیری این محصول",
  ],
  notebook_created: ["Save notebook", "ذخیره دفترچه"],
  notebook_updated: ["Save notebook", "ذخیره دفترچه"],
  notebook_archived: ["Archive notebook", "بایگانی دفترچه"],
  notebook_restored: ["Restore notebook", "بازیابی دفترچه"],
  notebook_entry_added: ["Save note", "ذخیره یادداشت"],
  notebook_entry_updated: ["Edit note", "ویرایش یادداشت"],
  notebook_entry_done: ["Mark done", "علامت انجام‌شده"],
  notebook_entry_reopened: ["Mark open", "علامت باز"],
};
export function historyActionLabel(action: string, lang: Language): string {
  if (action.startsWith("Reverted "))
    return `${translate("Reverted", "بازگردانده شد", lang)} ${historyActionLabel(action.slice(9), lang)}`;
  const copy = actions[action];
  return copy ? translate(...copy, lang) : activityLabel(action, lang);
}
const fields: Record<string, [string, string]> = {
  branch: ["Location", "مکان"],
  location: ["Location", "مکان"],
  outstanding_amount: ["Outstanding amount", "مبلغ پرداخت‌نشده"],
  reason: ["Reason", "دلیل"],
  name: ["Name", "نام"],
  name_en: ["English name", "نام انگلیسی"],
  name_fa: ["Persian name", "نام فارسی"],
  selling_price: ["Selling price", "قیمت فروش"],
  price: ["Selling price", "قیمت فروش"],
  pending_price: ["Proposed price", "قیمت پیشنهادی"],
  proposed_price: ["Proposed price", "قیمت پیشنهادی"],
  current_price: ["Previous price", "قیمت قبلی"],
  last_cost_before_tax: ["Unit cost before tax", "هزینه واحد پیش از مالیات"],
  unit_size: ["Unit size", "اندازه واحد"],
  barcode: ["Barcode", "بارکد"],
  description_en: ["Description (English)", "توضیحات انگلیسی"],
  description_fa: ["Description (Persian)", "توضیحات فارسی"],
  ai_category: ["Category", "دسته‌بندی"],
  pricing_category: ["Pricing category", "دسته قیمت‌گذاری"],
  main_supplier: ["Supplier", "تأمین‌کننده"],
  status: ["Status", "وضعیت"],
  active: ["Active", "فعال"],
  archived: ["Archived", "بایگانی‌شده"],
  branch_prices: ["Branch prices", "قیمت شعبه‌ها"],
  date_tracking: ["Date tracking", "پیگیری تاریخ"],
  expiry: ["Tracked date", "تاریخ پیگیری‌شده"],
  date_type: ["Type", "نوع"],
  source: ["Source", "منبع"],
  quantity: ["Quantity", "مقدار"],
  lot_number: ["Lot", "سری ساخت"],
  removed_reason: ["Removal reason", "دلیل حذف"],
  removal_action: ["Removal action", "کار حذف"],
  removed_by: ["Removed by", "حذف‌کننده"],
  removed_at: ["Removed at", "زمان حذف"],
  created_by: ["Added by", "افزوده‌شده توسط"],
  created_at: ["Added at", "زمان افزودن"],
  note: ["Note", "یادداشت"],
  copies: ["Copies", "نسخه‌ها"],
  text: ["Note", "یادداشت"],
  qty: ["Quantity", "تعداد"],
  measurement: ["Measurement", "اندازه‌گیری"],
  measurement_unit: ["Unit", "واحد"],
  date: ["Date", "تاریخ"],
  phone: ["Phone", "تلفن"],
  email: ["Email", "ایمیل"],
  payment_terms: ["Payment terms", "شرایط پرداخت"],
  address: ["Address", "نشانی"],
  notes: ["Notes", "یادداشت‌ها"],
  sales_rep_name: ["Sales representative", "نماینده فروش"],
  sales_rep_phone: ["Representative phone", "تلفن نماینده"],
  currency: ["Currency", "ارز"],
  timezone: ["Time zone", "منطقه زمانی"],
  date_format: ["Date format", "قالب تاریخ"],
  text_size: ["Text size", "اندازه متن"],
  divisor: ["Divisor", "مقسوم‌علیه"],
  minimum_margin: ["Minimum margin", "حداقل حاشیه سود"],
  rounding_rule: ["Rounding rule", "قاعده گرد کردن"],
  apply_special_correction: ["Special correction", "اصلاح ویژه"],
  apply_2_49_3_49_correction: ["Special correction", "اصلاح ویژه"],
  label: ["Label", "برچسب"],
  pool: ["Pool", "گروه"],
  mix_and_match: ["Mix and match", "ترکیب کالاها"],
  start_date: ["Start date", "تاریخ شروع"],
  end_date: ["End date", "تاریخ پایان"],
  width: ["Width", "عرض"],
  height: ["Height", "ارتفاع"],
  margin_top: ["Top margin", "حاشیه بالا"],
  margin_bottom: ["Bottom margin", "حاشیه پایین"],
  margin_left: ["Left margin", "حاشیه چپ"],
  margin_right: ["Right margin", "حاشیه راست"],
  gap_x: ["Horizontal gap", "فاصله افقی"],
  gap_y: ["Vertical gap", "فاصله عمودی"],
  offset_x: ["Horizontal offset", "جابجایی افقی"],
  offset_y: ["Vertical offset", "جابجایی عمودی"],
  recent_price_days: ["Recent price changes (days)", "تغییر قیمت اخیر (روز)"],
  auto_add_approved: [
    "Automatically add approved prices",
    "افزودن خودکار قیمت‌های تأییدشده",
  ],
  notify_supervisor: ["Notify Supervisor", "اطلاع به سرپرست"],
  read_roles: ["Who can read", "افراد مجاز به خواندن"],
  add_roles: ["Who can add", "افراد مجاز به افزودن"],
  status_enabled: ["Entry status", "وضعیت یادداشت"],
  invoice_date: ["Invoice date", "تاریخ فاکتور"],
  supplier_invoice_number: [
    "Supplier invoice number",
    "شماره فاکتور تأمین‌کننده",
  ],
  supplier: ["Supplier", "تأمین‌کننده"],
  supplier_item_code: ["Supplier item code", "کد کالای تأمین‌کننده"],
  product_code: ["Product Code", "کد کالا"],
  units_per_case: ["Units per case", "واحد در هر کارتن"],
  quoted_unit_cost_before_tax: [
    "Expected unit cost",
    "هزینه مورد انتظار هر واحد",
  ],
  allow_floor_worker: [
    "Allow Floor Workers to use Orders",
    "اجازه استفاده از سفارش‌ها به کارکنان فروشگاه",
  ],
  lines: ["Invoice lines", "ردیف‌های فاکتور"],
};
export function historyFieldLabel(field: string, lang: Language): string {
  const copy = fields[field];
  return copy
    ? translate(...copy, lang)
    : translate("Recorded values", "مقادیر ثبت‌شده", lang);
}
export function historyErrorMessage(
  error: unknown,
  t: (en: string, fa: string) => string,
): string {
  if (error instanceof HistoryError) {
    const messages: Record<string, [string, string]> = {
      conflict: [
        "This item changed again. Review the latest values before making another change.",
        "این مورد دوباره تغییر کرده است. پیش از تغییر بعدی، آخرین مقادیر را بررسی کنید.",
      ],
      barcode_conflict: [
        "This barcode now belongs to another product. Review the products before reverting.",
        "این بارکد اکنون به محصول دیگری تعلق دارد. پیش از بازگردانی، محصولات را بررسی کنید.",
      ],
      permission: [
        "You cannot reverse this action. Ask the Supervisor to review History.",
        "اجازه واگرد این کار را ندارید. از سرپرست بخواهید سابقه را بررسی کند.",
      ],
      scope: [
        "This action belongs to another company or branch.",
        "این کار مربوط به شرکت یا شعبه دیگری است.",
      ],
      irreversible: [
        "This action needs a recorded correction. Review its original page.",
        "این کار به اصلاح ثبت‌شده نیاز دارد. صفحه اصلی آن را بررسی کنید.",
      ],
      expired: [
        "The Undo window has ended. Ask the Supervisor to review History.",
        "زمان واگرد به پایان رسیده است. از سرپرست بخواهید سابقه را بررسی کند.",
      ],
    };
    return t(...messages[error.code]);
  }
  return t(
    "Review the latest values and try again.",
    "آخرین مقادیر را بررسی کنید و دوباره تلاش کنید.",
  );
}
