type Translate = (en: string, fa: string) => string;

export function invoiceReadingsImportError(
  error: unknown,
  t: Translate,
): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.message
        : "invalid_file";
  if (/permission|actor|company/.test(code))
    return t(
      "Only an Owner or Manager can import invoice readings for this company.",
      "فقط مالک یا مدیر می‌تواند خوانش فاکتور را برای این شرکت وارد کند.",
    );
  if (/version/.test(code))
    return t(
      "This invoice-readings file uses an unsupported version. Export it again with version 1.",
      "نسخهٔ این فایل خوانش فاکتور پشتیبانی نمی‌شود. آن را با نسخهٔ ۱ دوباره صادر کنید.",
    );
  if (/schema/.test(code))
    return t(
      "This file does not use the invoice-reading-v2 reading schema.",
      "این فایل از ساختار خوانش invoice-reading-v2 استفاده نمی‌کند.",
    );
  if (/json|syntax/.test(code))
    return t(
      "This file is not valid JSON. Choose the JSON export from the invoice-reader kit.",
      "این فایل JSON معتبر نیست. خروجی JSON ابزار خواندن فاکتور را انتخاب کنید.",
    );
  if (code === "pages")
    return t(
      "An invoice page or its original SHA-256 is missing or damaged. Export the file again from the invoice-reader kit.",
      "یکی از صفحات فاکتور یا SHA-256 اصل آن وجود ندارد یا آسیب دیده است. فایل را دوباره از ابزار خواندن فاکتور صادر کنید.",
    );
  if (code === "invalid_number")
    return t(
      "This file contains an invalid quantity or amount. Check the export and try again.",
      "این فایل مقدار یا مبلغ نامعتبری دارد. خروجی را بررسی و دوباره تلاش کنید.",
    );
  if (/storage|quota|file_read_failed/.test(code))
    return t(
      "The file could not be read or saved. Check available browser storage and try again.",
      "خواندن یا ذخیرهٔ فایل ممکن نشد. فضای ذخیره‌سازی مرورگر را بررسی و دوباره تلاش کنید.",
    );
  return t(
    "This isn't an invoice-readings file from the invoice-reader kit. Choose a valid JSON export.",
    "این فایل خوانش فاکتور از ابزار خواندن فاکتور نیست. یک خروجی JSON معتبر انتخاب کنید.",
  );
}
