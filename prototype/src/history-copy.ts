import { activityLabel } from "./formatters";
import { translate } from "./i18n";
import { HistoryError } from "./history";
import type { CompanyConfig, Language } from "./types";
import { configSeed } from "./config";
import { configuredRoleLabel } from "./role-config";

const actions: Record<string, [string, string]> = {
  "Set category for new invoice products": [
    "Set category for new invoice products",
    "تعیین دسته برای کالاهای جدید فاکتور",
  ],
  "Add invoice charge or credit": [
    "Add invoice charge or credit",
    "افزودن هزینه یا اعتبار فاکتور",
  ],
  "Edit invoice charge or credit": [
    "Edit invoice charge or credit",
    "ویرایش هزینه یا اعتبار فاکتور",
  ],
  "Remove invoice charge or credit": [
    "Remove invoice charge or credit",
    "حذف هزینه یا اعتبار فاکتور",
  ],
  "Edit weight product cost": [
    "Edit weight product cost",
    "ویرایش هزینه کالای وزنی",
  ],
  "Propose price after manual cost edit": [
    "Propose price after manual cost edit",
    "پیشنهاد قیمت پس از ویرایش دستی هزینه",
  ],
  "Invoice paper total acknowledged as wrong": [
    "Invoice paper total acknowledged as wrong",
    "جمع اشتباه روی فاکتور تأیید شد",
  ],
  "Package offers reconciled": [
    "Package offers reconciled",
    "پیشنهادهای بسته هماهنگ شد",
  ],
  "Package sale needs review": [
    "Package sale needs review",
    "حراج بسته نیاز به بررسی دارد",
  ],
  "Add package size": ["Add package size", "افزودن اندازه بسته"],
  "Edit package size": ["Edit package size", "ویرایش اندازه بسته"],
  "Archive package size": ["Archive package size", "بایگانی اندازه بسته"],
  "Package price recalculated": [
    "Package price recalculated",
    "قیمت بسته دوباره محاسبه شد",
  ],
  "Package cost recalculated": [
    "Package cost recalculated",
    "هزینه بسته دوباره محاسبه شد",
  ],
  "Timesheet settings changed": [
    "Timesheet settings changed",
    "تنظیمات کارکرد تغییر کرد",
  ],
  "Add timesheet staff": ["Add timesheet staff", "افزودن فرد به فهرست کارکرد"],
  "Edit timesheet staff": [
    "Edit timesheet staff",
    "ویرایش فرد در فهرست کارکرد",
  ],
  "Archive timesheet staff": [
    "Archive timesheet staff",
    "بایگانی فرد در فهرست کارکرد",
  ],
  "Restore timesheet staff": [
    "Restore timesheet staff",
    "بازگردانی فرد در فهرست کارکرد",
  ],
  "Add timesheet day": ["Add timesheet day", "افزودن روز کارکرد"],
  "Add timesheet row": ["Add timesheet row", "افزودن ردیف کارکرد"],
  "Edit timesheet row": ["Edit timesheet row", "ویرایش ردیف کارکرد"],
  "Remove timesheet row": ["Remove timesheet row", "برداشتن ردیف کارکرد"],
  "Edit timesheet notes": ["Edit timesheet notes", "ویرایش یادداشت کارکرد"],
  "Created return": ["Created return", "ایجاد مرجوعی"],
  "Change approval category": [
    "Change approval category",
    "تغییر دسته‌بندی درخواست تأیید",
  ],
  "Resubmit approval": ["Resubmit approval", "ارسال دوباره درخواست تأیید"],
  "Create invoice draft": ["Create invoice draft", "ایجاد پیش‌نویس فاکتور"],
  "Invoice pages changed": ["Invoice pages changed", "تغییر صفحه‌های فاکتور"],
  "Cancel invoice": ["Discard invoice", "کنار گذاشتن فاکتور"],
  "Distinguish suppliers": ["Distinguish suppliers", "تأمین‌کنندگان متفاوت"],
  "Activate supplier without approval": [
    "Activate supplier without approval",
    "فعال‌سازی تأمین‌کننده بدون تأیید",
  ],
  "Removed fictional data": [
    "Removed fictional data",
    "داده‌های خیالی حذف شدند",
  ],
  "Create price update": ["Create price update", "ایجاد به‌روزرسانی قیمت"],
  "Replace pending price update": [
    "Replace pending price update",
    "جایگزینی به‌روزرسانی قیمت در انتظار",
  ],
  "Cancel price update": ["Cancel price update", "لغو به‌روزرسانی قیمت"],
  "Update price task": ["Update price task", "به‌روزرسانی کار قیمت"],
  "Complete price update": ["Complete price update", "تکمیل به‌روزرسانی قیمت"],
  "Mark price update seen": [
    "Mark price update seen",
    "علامت‌گذاری به‌روزرسانی قیمت به‌عنوان دیده‌شده",
  ],
  "Print price update labels": [
    "Print price update labels",
    "چاپ برچسب‌های به‌روزرسانی قیمت",
  ],
  "Confirm price update label": [
    "Confirm price update label",
    "تأیید برچسب به‌روزرسانی قیمت",
  ],
  "Save price update settings": [
    "Save price update settings",
    "ذخیرهٔ تنظیمات به‌روزرسانی قیمت",
  ],
  "Save notification settings": [
    "Save notification settings",
    "ذخیرهٔ تنظیمات اعلان",
  ],
  "Sale ends after today": [
    "Sale ends after today",
    "حراج پس از امروز پایان می‌یابد",
  ],
  "Selling price changed": ["Selling price changed", "قیمت فروش تغییر کرد"],
  "Apply price to all branches": [
    "Apply price to all branches",
    "اعمال قیمت به همهٔ شعب",
  ],
  "Schedule sale": ["Schedule sale", "زمان‌بندی تخفیف"],
  "Start sale": ["Start sale", "شروع تخفیف"],
  "Change sale": ["Change sale", "تغییر تخفیف"],
  "End sale": ["End sale", "پایان تخفیف"],
  "Sale reminder": ["Sale reminder", "یادآوری تخفیف"],
  "Revert sale": ["Revert sale", "بازگردانی تخفیف"],
  "Set regular price": ["Set regular price", "تعیین قیمت عادی"],
  "Request sale": ["Request sale", "درخواست تخفیف"],
  "Change sale request": ["Change sale request", "تغییر درخواست تخفیف"],
  "Withdraw sale request": ["Withdraw sale request", "پس گرفتن درخواست تخفیف"],
  "Approve sale request": ["Approve sale request", "تأیید درخواست تخفیف"],
  "Reject sale request": ["Reject sale request", "رد درخواست تخفیف"],
  "Expire sale request": ["Expire sale request", "انقضای درخواست تخفیف"],
  "Decide sale alert": ["Decide sale alert", "تصمیم درباره هشدار تخفیف"],
  "Save sales settings": ["Save sales settings", "ذخیره تنظیمات تخفیف‌ها"],
  Undone: ["Undone", "واگرد شد"],
  note_added: ["Add note", "افزودن یادداشت"],
  note_seen: ["Mark as seen", "علامت‌گذاری دیده‌شده"],
  note_reopened: ["Reopen", "بازگشایی"],
  notebook_entry_seen: ["Mark as seen", "علامت‌گذاری دیده‌شده"],
  note_resolved: ["Mark done", "علامت انجام‌شده"],
  "Mark ordered": ["Mark ordered", "علامت سفارش‌داده‌شده"],
  "Save draft": ["Save draft", "ذخیره پیش‌نویس"],
  "Edit draft": ["Edit draft", "ویرایش پیش‌نویس"],
  "Remove line": ["Remove line", "حذف ردیف"],
  "Supplier document settings changed": [
    "Supplier document settings changed",
    "تنظیمات اسناد تأمین‌کننده تغییر کرد",
  ],
  "Company settings changed": [
    "Company settings changed",
    "تنظیمات شرکت تغییر کرد",
  ],
  "AI reading settings changed": [
    "AI reading settings changed",
    "تنظیمات خواندن هوش مصنوعی تغییر کرد",
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
  "Correct invoice received date": [
    "Correct invoice received date",
    "اصلاح زمان دریافت فاکتور",
  ],
  "Attach original": ["Attach original", "پیوست اصل"],
  "Return settings changed": [
    "Return settings changed",
    "تنظیمات مرجوعی تغییر کرد",
  ],
  "Date tracking settings changed": [
    "Date tracking settings changed",
    "تنظیمات پیگیری تاریخ تغییر کرد",
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
  "Turn on date tracking": ["Turn on date tracking", "روشن کردن پیگیری تاریخ"],
  "Turn off date tracking": [
    "Turn off date tracking",
    "خاموش کردن پیگیری تاریخ",
  ],
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
  notebook_entry_reopened: ["Reopen", "بازگشایی"],
};
export function historyActionLabel(action: string, lang: Language): string {
  const imported = /^Imported (\d+) invoice readings from (.+)$/s.exec(action);
  if (imported) {
    if (lang !== "fa") return action;
    const count = new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(
      Number(imported[1]),
    );
    return `${count} خوانش فاکتور از \u2066${imported[2]}\u2069 وارد شد`;
  }
  if (action.startsWith("Reverted "))
    return `${translate("Reverted", "بازگردانده شد", lang)} ${historyActionLabel(action.slice(9), lang)}`;
  const copy = actions[action];
  return copy ? translate(...copy, lang) : activityLabel(action, lang);
}
const fields: Record<string, [string, string]> = {
  in_time: ["In", "ورود"],
  out_time: ["Out", "خروج"],
  department_key: ["Department", "بخش"],
  department_name_en: ["Department (English)", "بخش (انگلیسی)"],
  department_name_fa: ["Department (Persian)", "بخش (فارسی)"],
  usual_department_key: ["Usual department", "بخش معمول"],
  departments: ["Departments", "بخش‌ها"],
  photo_count: ["Photos", "عکس‌ها"],
  quantity_unit: ["Unit", "واحد"],
  sale_price: ["Sale price", "قیمت تخفیف"],
  requested_price: ["Sale price", "قیمت تخفیف"],
  regular_price: ["Regular price", "قیمت عادی"],
  price_unit: ["Sold by", "نوع فروش"],
  starts_on: ["Starts", "شروع"],
  last_day: ["Last day", "آخرین روز"],
  why: ["Why?", "چرا؟"],
  default_length_days: [
    "Default sale length (days)",
    "مدت پیش‌فرض تخفیف (روز)",
  ],
  open_ended_reminder_days: [
    "Remind me about sales with no end date every (days)",
    "یادآوری تخفیف بدون تاریخ پایان هر (روز)",
  ],
  add_promo_labels_on_start: [
    "Add Promo labels when a sale starts",
    "افزودن برچسب ویژه هنگام شروع تخفیف",
  ],
  add_regular_labels_on_end: [
    "Add regular labels when a sale ends",
    "افزودن برچسب عادی هنگام پایان تخفیف",
  ],
  branch: ["Location", "مکان"],
  location: ["Location", "مکان"],
  outstanding_amount: ["Outstanding amount", "مبلغ پرداخت‌نشده"],
  reason: ["Reason", "دلیل"],
  received_at: ["Received", "زمان دریافت"],
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
  notify_supervisor: ["Notify managers", "اطلاع به مدیران"],
  seen_receipts: ["Seen by", "دیده‌شده توسط"],
  done_by: ["Done by", "انجام‌شده توسط"],
  done_at: ["Completed at", "زمان انجام"],
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
export function historyFieldLabel(
  field: string,
  lang: Language,
  config: Pick<CompanyConfig, "roles"> = configSeed,
): string {
  if (field === "notify_supervisor") {
    const roles = (["owner", "manager", "branch_supervisor"] as const)
      .map((role) => configuredRoleLabel(config.roles, role, lang))
      .join(" / ");
    return lang === "fa" ? `اطلاع به ${roles}` : `Notify ${roles}`;
  }
  const copy = fields[field];
  return copy
    ? translate(...copy, lang)
    : translate("Recorded values", "مقادیر ثبت‌شده", lang);
}
export function historyErrorMessage(
  error: unknown,
  t: (en: string, fa: string) => string,
  config: Pick<CompanyConfig, "roles"> = configSeed,
): string {
  const managersEn = `${configuredRoleLabel(config.roles, "owner", "en")} or ${configuredRoleLabel(config.roles, "manager", "en")}`;
  const managersFa = `${configuredRoleLabel(config.roles, "owner", "fa")} یا ${configuredRoleLabel(config.roles, "manager", "fa")}`;
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
        `You cannot reverse this action. Ask an ${managersEn} to review History.`,
        `اجازه واگرد این کار را ندارید. از ${managersFa} بخواهید سابقه را بررسی کند.`,
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
        `The Undo window has ended. Ask an ${managersEn} to review History.`,
        `زمان واگرد به پایان رسیده است. از ${managersFa} بخواهید سابقه را بررسی کند.`,
      ],
    };
    return t(...messages[error.code]);
  }
  return t(
    "Review the latest values and try again.",
    "آخرین مقادیر را بررسی کنید و دوباره تلاش کنید.",
  );
}
