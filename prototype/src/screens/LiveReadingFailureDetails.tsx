import { readLiveInvoiceFailure } from "../invoice-live-failure";
import type { LiveReadingFailure } from "../live-reading-failure";
import type { InvoiceReadDTO } from "../invoice-projections";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";

type Translate = (en: string, fa: string) => string;
function liveReadingFailureText(value: LiveReadingFailure, t: Translate) {
  if (value.reason === "invalid_model_id")
    return t(
      "Reader response: models[].id must contain a model id. Check the reader kit, then try again.",
      "پاسخ خواننده: models[].id باید شناسهٔ مدل داشته باشد. کیت خواننده را بررسی و دوباره تلاش کنید.",
    );
  if (value.reason === "invalid_models")
    return t(
      "Reader response: models must be a list of model names or objects with an id. Check the reader kit, then try again.",
      "پاسخ خواننده: models باید فهرستی از نام مدل‌ها یا شیءهای دارای id باشد. کیت خواننده را بررسی و دوباره تلاش کنید.",
    );
  if (value.reason === "invalid_json")
    return t(
      "The reader returned invalid JSON. Check the reader kit, then try again.",
      "خواننده JSON نامعتبر برگرداند. کیت خواننده را بررسی و دوباره تلاش کنید.",
    );
  if (value.reason === "invalid_items")
    return t(
      "Reader response: reading.lines must include usable invoice items. Check the reader kit, then try again.",
      "پاسخ خواننده: reading.lines باید ردیف‌های قابل‌استفادهٔ فاکتور داشته باشد. کیت خواننده را بررسی و دوباره تلاش کنید.",
    );
  if (value.field)
    return t(
      `Reader response: ${value.field} is invalid. Check the reader kit, then try again.`,
      `پاسخ خواننده: ${value.field} نامعتبر است. کیت خواننده را بررسی و دوباره تلاش کنید.`,
    );
  if (value.reason === "http")
    return t(
      `The reader returned HTTP${value.status ? ` ${value.status}` : ""}. Check the reader kit and try again.`,
      `خواننده پاسخ HTTP${value.status ? ` ${value.status}` : ""} داد. کیت خواننده را بررسی و دوباره تلاش کنید.`,
    );
  if (value.reason === "network_or_cors" || value.reason === "address")
    return t(
      "Check the reader address, network and permission for this page, then try again. The browser cannot distinguish a network failure from a blocked page origin.",
      "نشانی خواننده، شبکه و مجوز این صفحه را بررسی و دوباره تلاش کنید. مرورگر نمی‌تواند قطعی شبکه را از مسدود بودن نشانی صفحه تشخیص دهد.",
    );
  if (value.reason === "timeout")
    return t(
      "Reading exceeded the four-minute limit. Try again or enter the invoice by hand.",
      "خوانش از محدودیت چهار دقیقه گذشت. دوباره تلاش کنید یا فاکتور را دستی وارد کنید.",
    );
  if (value.reason === "invoice_number" || value.reason === "page_sha256")
    return t(
      "This invoice or original is already in the app. Open the saved invoice before trying again.",
      "این فاکتور یا اصل فایل از قبل در برنامه است. پیش از تلاش دوباره، فاکتور ذخیره‌شده را باز کنید.",
    );
  if (value.reason === "pdf_pages")
    return t(
      "The saved PDF has more pages than the reader allows. Use a shorter PDF or enter the invoice by hand.",
      "PDF ذخیره‌شده بیشتر از محدودیت خواننده صفحه دارد. از PDF کوتاه‌تری استفاده کنید یا فاکتور را دستی وارد کنید.",
    );
  if (
    [
      "images",
      "empty",
      "pdf_decode",
      "pdf_selection",
      "image_decode",
      "unsupported_file",
      "canvas",
    ].includes(value.reason)
  )
    return t(
      "The saved pages could not be prepared for reading. Check the image or PDF pages and try again.",
      "صفحه‌های ذخیره‌شده برای خوانش آماده نشدند. تصویرها یا صفحه‌های PDF را بررسی و دوباره تلاش کنید.",
    );
  return t(
    "The reader could not finish this invoice. Check the reader kit, then try again or enter it by hand.",
    "خواننده نتوانست این فاکتور را کامل کند. کیت خواننده را بررسی و دوباره تلاش کنید یا آن را دستی وارد کنید.",
  );
}

export function LiveReadingFailureDetails({
  invoice,
}: {
  invoice: InvoiceReadDTO;
}) {
  const { actor, t } = useDemo();
  const attempt = invoice.live_reading?.attempt_id ?? "";
  const eligible =
    (actor?.role === "owner" || actor?.role === "manager") &&
    invoice.live_reading?.phase === "failed" &&
    Boolean(attempt);
  const failure = useProtectedQuery(
    eligible ? "invoices.cost_read" : null,
    {
      company_id: invoice.company_id,
      kind: "company_shared",
      entity_id: invoice.id,
    },
    (state, currentActor) =>
      readLiveInvoiceFailure(state, currentActor, invoice.id, attempt),
    JSON.stringify([invoice.id, attempt]),
  );
  return failure.data ? (
    <p
      className="helper"
      role="status"
      data-testid="live-reading-failure-details"
    >
      {liveReadingFailureText(failure.data, t)}
    </p>
  ) : null;
}
