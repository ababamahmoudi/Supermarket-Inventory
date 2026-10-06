import { useEffect, useState, type ChangeEvent } from "react";
import Decimal from "decimal.js";
import demo from "../../../seed/demo-data.json";
import { useDemo, branches, demoUsers } from "../store";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
} from "../ui";
import { calculatePrice } from "../pricing";
import {
  addManualLine,
  companyDate,
  createInvoice,
  dateAfter,
  invoiceBlockers,
  lineShort,
  lowerPriceLines,
  postInvoice,
  previousReceiptCost,
  recalculateInvoice,
  receiveShort,
  shortTotals,
  type InvoiceBlocker,
} from "../invoice";
import type { Branch, InvoiceLine } from "../types";

type Translate = (en: string, fa: string) => string;
const blockerCopy: Record<InvoiceBlocker, [string, string]> = {
  permission: [
    "Sign in as a Floor Worker or Supervisor to receive invoices.",
    "برای دریافت فاکتور به عنوان کارمند فروشگاه یا سرپرست وارد شوید.",
  ],
  branch: [
    "Select the invoice branch in the top bar before posting.",
    "پیش از ثبت، شعبه فاکتور را در نوار بالا انتخاب کنید.",
  ],
  company: [
    "Use an invoice and products belonging to this company.",
    "از فاکتور و کالاهای همین شرکت استفاده کنید.",
  ],
  supplier: [
    "Choose a supplier before posting.",
    "پیش از ثبت، تأمین‌کننده را انتخاب کنید.",
  ],
  supplier_pending: [
    "Waiting for Supervisor to confirm supplier.",
    "در انتظار تأیید تأمین‌کننده توسط سرپرست.",
  ],
  header: [
    "Add the invoice date, received time, and receiving employee.",
    "تاریخ فاکتور، زمان دریافت و کارمند دریافت‌کننده را وارد کنید.",
  ],
  money: [
    "Enter nonnegative totals with no more than two decimal places.",
    "مبالغ غیرمنفی با حداکثر دو رقم اعشار وارد کنید.",
  ],
  file: [
    "Add the original invoice (PDF or photo) before posting.",
    "پیش از ثبت، اصل فاکتور (PDF یا عکس) را اضافه کنید.",
  ],
  lines: ["Add at least one invoice line.", "حداقل یک ردیف فاکتور اضافه کنید."],
  matching: [
    "Match every line to a product, or give a new product both names.",
    "هر ردیف را به کالا وصل کنید یا هر دو نام کالای جدید را وارد کنید.",
  ],
  quantity: [
    "Use whole quantities; delivered units must be between zero and invoiced units.",
    "تعداد صحیح وارد کنید؛ تعداد تحویل‌شده باید بین صفر و تعداد فاکتور باشد.",
  ],
  cost: [
    "Enter a nonnegative unit cost with no more than four decimal places.",
    "هزینه هر واحد غیرمنفی با حداکثر چهار رقم اعشار وارد کنید.",
  ],
  review: [
    "Review and confirm every invoice line.",
    "همه ردیف‌های فاکتور را بررسی و تأیید کنید.",
  ],
  date: [
    "Confirm date tracking on Grocery lines; add a date when tracking is on.",
    "پیگیری تاریخ ردیف‌های مواد غذایی را تأیید کنید؛ در صورت فعال بودن تاریخ را وارد کنید.",
  ],
  lower_price: [
    "Answer the lower-price questions; add a note if information is unknown.",
    "به پرسش‌های کاهش هزینه پاسخ دهید؛ اگر اطلاعات نامعلوم است یادداشت اضافه کنید.",
  ],
};

function categoryText(key: string, label: string, t: Translate) {
  const fa: Record<string, string> = {
    grocery: "مواد غذایی",
    grocery_taxable: "مواد غذایی (مشمول مالیات)",
    rice: "برنج",
    kitchenware: "لوازم آشپزخانه",
  };
  return t(label, fa[key] ?? label);
}

export default function Invoices() {
  const { state, update, role, branch, lang, t, money } = useDemo();
  const invoice = state.invoice;
  const [tab, setTab] = useState<"current" | "posted">("current");
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [manualCode, setManualCode] = useState("0002");
  const [deliveryQuantities, setDeliveryQuantities] = useState<
    Record<string, number>
  >({});
  const [deliveryRefs, setDeliveryRefs] = useState<Record<string, string>>({});
  const blockers = role ? invoiceBlockers(state, role, branch) : [];
  const totals = shortTotals(invoice);
  const lowerLines = lowerPriceLines(state);
  const locked = invoice.status === "posted";
  const active = invoice.status !== "empty";

  // Refreshing a processing draft resumes the honest simulated reading state.
  useEffect(() => {
    if (invoice.status !== "reading") return;
    const id = invoice.id;
    window.setTimeout(
      () =>
        update((draft) => {
          if (draft.invoice.id === id && draft.invoice.status === "reading")
            draft.invoice.status = "review";
        }),
      2500,
    );
  }, [invoice.id, invoice.status, update]);

  if (role === "cashier" || !role)
    return (
      <EmptyState>
        {t(
          "Sign in as a Floor Worker or Supervisor to receive invoices.",
          "برای دریافت فاکتور به عنوان کارمند فروشگاه یا سرپرست وارد شوید.",
        )}
      </EmptyState>
    );

  function start(manual = false) {
    update((draft) => {
      draft.invoice = createInvoice(
        draft,
        branch === "all" ? "Branch 1" : branch,
        manual,
      );
    });
    setTab("current");
    setMessage("");
    setUploadError("");
  }

  async function attachFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !/^image\/(png|jpeg|webp|gif)$/.test(file.type) &&
      file.type !== "application/pdf"
    ) {
      setUploadError(
        t(
          "Choose a PDF, PNG, JPEG, WebP, or GIF file.",
          "فایل PDF، PNG، JPEG، WebP یا GIF انتخاب کنید.",
        ),
      );
      return;
    }
    if (file.size > 2_500_000) {
      setUploadError(
        t(
          "Choose a file smaller than 2.5 MB so this browser demo can save the original.",
          "برای ذخیره اصل فاکتور در این دموی مرورگر، فایل کوچک‌تر از 2.5 مگابایت انتخاب کنید.",
        ),
      );
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      update((draft) => {
        const existing = draft.invoice;
        if (existing.status === "posted") return;
        const next =
          existing.status === "empty"
            ? createInvoice(draft, branch === "all" ? "Branch 1" : branch)
            : existing;
        next.file_name = file.name;
        next.file_type = file.type;
        next.file_data = data;
        // Existing manual entries stay intact when their original is attached.
        next.status = next.lines.length ? "reading" : "draft";
        draft.invoice = next;
      });
      setUploadError("");
      setMessage("");
      setTab("current");
    } catch {
      setUploadError(
        t(
          "The file could not be read. Choose it again or save a manual draft.",
          "فایل خوانده نشد. دوباره انتخاب کنید یا پیش‌نویس دستی ذخیره کنید.",
        ),
      );
    }
  }

  function editLine(
    index: number,
    change: (line: InvoiceLine) => void,
    recalculate = false,
  ) {
    update((draft) => {
      if (draft.invoice.status === "posted") return;
      change(draft.invoice.lines[index]);
      draft.invoice.lines[index].review_confirmed = false;
      if (recalculate) recalculateInvoice(draft.invoice, draft.config);
    });
    setMessage("");
  }

  function post() {
    if (blockers.length) {
      setMessage(
        t(
          "Complete the highlighted requirements before posting.",
          "پیش از ثبت، موارد مشخص‌شده را کامل کنید.",
        ),
      );
      return;
    }
    update((draft) => {
      postInvoice(draft, role!, branch);
    });
    setMessage(
      t(
        "Posted. Delivered stock, approvals, alerts, and supplier ledger are updated.",
        "ثبت شد. موجودی تحویل‌شده، تأییدها، هشدارها و دفتر تأمین‌کننده به‌روز شدند.",
      ),
    );
  }

  function receive(code: string) {
    const line = invoice.lines.find((item) => item.product_code === code)!;
    const remaining = lineShort(line).quantity - (line.qty_later_received ?? 0);
    const quantity = deliveryQuantities[code] ?? Math.min(2, remaining);
    const receipt =
      deliveryRefs[code] ??
      `DEMO-DELIVERY-${(line.qty_later_received ?? 0) + 1}`;
    if (
      !receipt.trim() ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > remaining
    ) {
      setMessage(
        t(
          "Enter a delivery reference and no more than the remaining missing units.",
          "مرجع تحویل را وارد کنید؛ تعداد نباید از واحدهای کمبود باقی‌مانده بیشتر باشد.",
        ),
      );
      return;
    }
    // The amount is a pure allocation preview; posting stores the same result once.
    const oldLedgerIds = new Set(state.ledger.map((entry) => entry.id));
    const preview = structuredClone(state);
    const restored = receiveShort(
      preview,
      code,
      quantity,
      receipt,
      role!,
      branch,
    );
    if (preview.ledger.every((entry) => oldLedgerIds.has(entry.id))) {
      setMessage(
        t(
          "This delivery reference was already recorded. No stock or money was added.",
          "این مرجع تحویل قبلاً ثبت شده است. موجودی یا مبلغی اضافه نشد.",
        ),
      );
      return;
    }
    update((draft) => {
      receiveShort(draft, code, quantity, receipt, role!, branch);
    });
    setMessage(
      `${t("Received short delivery. Payable restored:", "تحویل کسری دریافت شد. مبلغ بدهی بازگردانده‌شده:")} ${money(restored)}`,
    );
    setDeliveryRefs((current) => ({ ...current, [code]: "" }));
  }

  const branchInvoices =
    state.invoices?.filter(
      (item) =>
        item.company_id === state.config.company.seed_key &&
        (branch === "all" || item.branch === branch),
    ) ?? [];
  return (
    <>
      <PageHeader
        title={t("Invoices", "فاکتورها")}
        description={t(
          "Deliveries and supplier invoices",
          "تحویل‌ها و فاکتورهای تأمین‌کننده",
        )}
        actions={
          <Button
            variant="secondary"
            onClick={() => start()}
            disabled={active && !locked}
          >
            {t("New invoice", "فاکتور جدید")}
          </Button>
        }
      />
      <div
        className="tabs"
        role="tablist"
        aria-label={t("Invoice views", "نمای فاکتورها")}
      >
        <button
          role="tab"
          aria-selected={tab === "current"}
          className={tab === "current" ? "active" : ""}
          onClick={() => setTab("current")}
        >
          {t("Drafts / Under review", "پیش‌نویس‌ها / در حال بررسی")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "posted"}
          className={tab === "posted" ? "active" : ""}
          onClick={() => setTab("posted")}
        >
          {t("Posted", "ثبت‌شده")} ({branchInvoices.length})
        </button>
      </div>
      {message && (
        <div role="status" className="banner info">
          {message}
        </div>
      )}
      {tab === "posted" ? (
        <Card title={t("Posted invoices", "فاکتورهای ثبت‌شده")}>
          {!branchInvoices.length ? (
            <EmptyState>
              {t(
                "No posted invoices. Review and post a delivery first.",
                "فاکتور ثبت‌شده‌ای نیست. ابتدا یک تحویل را بررسی و ثبت کنید.",
              )}
            </EmptyState>
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th scope="col">{t("Invoice", "فاکتور")}</th>
                  <th scope="col">{t("Supplier", "تأمین‌کننده")}</th>
                  <th scope="col">{t("Branch", "شعبه")}</th>
                  <th scope="col">{t("Date", "تاریخ")}</th>
                  <th scope="col">{t("Status", "وضعیت")}</th>
                  <th scope="col">{t("Review", "بررسی")}</th>
                </tr>
              </thead>
              <tbody>
                {branchInvoices.map((item) => (
                  <tr key={item.id}>
                    <td dir="ltr">{item.supplier_invoice_number}</td>
                    <td>{item.supplier}</td>
                    <td>
                      {t(item.branch, item.branch.replace("Branch", "شعبه"))}
                    </td>
                    <td dir="ltr">{item.invoice_date}</td>
                    <td>
                      <Badge tone="approved">{t("Posted", "ثبت‌شده")}</Badge>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          update((draft) => {
                            draft.invoice = structuredClone(item);
                          });
                          setTab("current");
                        }}
                      >
                        {t("View invoice", "مشاهده فاکتور")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      ) : (
        <>
          {!locked && (
            <Card title={t("Original invoice", "اصل فاکتور")}>
              <p className="muted">
                {t(
                  "Demo: AI invoice reading is simulated",
                  "دمو: خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
                )}
              </p>
              <p className="muted">
                {t(
                  "Your PDF or photo is displayed locally. The review uses fictional demo lines, not the contents of your file.",
                  "PDF یا عکس شما فقط محلی نمایش داده می‌شود. بررسی از ردیف‌های ساختگی دمو استفاده می‌کند، نه محتوای فایل شما.",
                )}
              </p>
              <Field
                label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
                error={uploadError}
              >
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    void attachFile(event);
                  }}
                  disabled={invoice.status === "reading"}
                />
              </Field>
              {!active && (
                <Button variant="secondary" onClick={() => start(true)}>
                  {t("Enter manually without a file", "ورود دستی بدون فایل")}
                </Button>
              )}
              {invoice.file_name && (
                <p>
                  <Badge tone="info">
                    {t("Original attached", "اصل پیوست شد")}
                  </Badge>{" "}
                  <span dir="auto">{invoice.file_name}</span>
                </p>
              )}
            </Card>
          )}
          {invoice.status === "reading" ? (
            <Card>
              <p role="status">
                {t("Reading invoice…", "در حال خواندن فاکتور…")}
              </p>
              <p className="muted">
                {t(
                  "Simulated reading takes 2–3 seconds. Your file is not sent anywhere.",
                  "خواندن شبیه‌سازی‌شده ۲ تا ۳ ثانیه طول می‌کشد. فایل شما به جایی فرستاده نمی‌شود.",
                )}
              </p>
            </Card>
          ) : !active ? (
            <EmptyState>
              {t(
                "No drafts. Upload a file or start a manual invoice.",
                "پیش‌نویسی نیست. فایل بارگذاری کنید یا فاکتور دستی شروع کنید.",
              )}
            </EmptyState>
          ) : (
            <>
              <Card title={t("Invoice details", "جزئیات فاکتور")}>
                <p>
                  <Badge
                    tone={
                      locked ? "approved" : blockers.length ? "pending" : "info"
                    }
                  >
                    {locked
                      ? t("Posted", "ثبت‌شده")
                      : blockers.length
                        ? t("Needs review", "نیازمند بررسی")
                        : t("Ready to post", "آماده ثبت")}
                  </Badge>{" "}
                  <span className="muted">
                    {t(
                      "Changes save automatically in this browser.",
                      "تغییرات در این مرورگر خودکار ذخیره می‌شوند.",
                    )}
                  </span>
                </p>
                <fieldset disabled={locked} className="form-grid">
                  <Field label={t("Supplier", "تأمین‌کننده")}>
                    <select
                      value={invoice.supplier}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.supplier = event.target.value;
                          draft.invoice.supplier_confirmed = true;
                          draft.invoice.lower_price_answers = undefined;
                        })
                      }
                    >
                      {demo.suppliers.map((supplier) => (
                        <option key={supplier}>{supplier}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t(
                      "Supplier invoice number (optional)",
                      "شماره فاکتور تأمین‌کننده (اختیاری)",
                    )}
                  >
                    <input
                      dir="ltr"
                      value={invoice.supplier_invoice_number}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.supplier_invoice_number =
                            event.target.value;
                        })
                      }
                      placeholder={t(
                        "Assigned on posting if blank",
                        "اگر خالی باشد هنگام ثبت تعیین می‌شود",
                      )}
                    />
                  </Field>
                  <Field label={t("Invoice date", "تاریخ فاکتور")}>
                    <input
                      type="date"
                      dir="ltr"
                      value={invoice.invoice_date ?? ""}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.invoice_date = event.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t(
                      "Received date and time (UTC)",
                      "تاریخ و زمان دریافت (UTC)",
                    )}
                  >
                    <input
                      type="datetime-local"
                      dir="ltr"
                      value={invoice.received_at?.slice(0, 16) ?? ""}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.received_at = event.target.value
                            ? `${event.target.value}:00Z`
                            : "";
                        })
                      }
                    />
                  </Field>
                  <Field label={t("Receiving employee", "کارمند دریافت‌کننده")}>
                    <select
                      value={invoice.receiving_employee}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.receiving_employee = event.target.value;
                        })
                      }
                    >
                      {demoUsers
                        .filter((user) => user.role !== "cashier")
                        .map((user) => (
                          <option key={user.role} value={user.name}>
                            {t(
                              user.name,
                              user.role === "supervisor"
                                ? "سرپرست دمو"
                                : "کارمند فروشگاه دمو",
                            )}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={t("Branch", "شعبه")}>
                    <select
                      value={invoice.branch}
                      disabled={locked || role !== "supervisor"}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.branch = event.target.value as Branch;
                          draft.invoice.lower_price_answers = undefined;
                        })
                      }
                    >
                      {branches.map((item) => (
                        <option key={item} value={item}>
                          {t(item, item.replace("Branch", "شعبه"))}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("Subtotal", "جمع پیش از مالیات")}>
                    <input
                      dir="ltr"
                      inputMode="decimal"
                      value={invoice.subtotal}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.subtotal = event.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label={t("Tax", "مالیات")}>
                    <input
                      dir="ltr"
                      inputMode="decimal"
                      value={invoice.tax}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.tax = event.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label={t("Final total", "جمع نهایی")}>
                    <input
                      dir="ltr"
                      inputMode="decimal"
                      value={invoice.final_total}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.final_total = event.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t("Due date (optional)", "تاریخ سررسید (اختیاری)")}
                  >
                    <input
                      type="date"
                      dir="ltr"
                      value={invoice.due_date ?? ""}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.due_date = event.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t(
                      "Payment terms (optional)",
                      "شرایط پرداخت (اختیاری)",
                    )}
                  >
                    <input
                      value={invoice.payment_terms}
                      onChange={(event) =>
                        update((draft) => {
                          draft.invoice.payment_terms = event.target.value;
                        })
                      }
                    />
                  </Field>
                </fieldset>
                {invoice.number_is_system_assigned && (
                  <p className="muted">
                    {t(
                      "Invoice number was system-assigned.",
                      "شماره فاکتور توسط سیستم تعیین شده است.",
                    )}
                  </p>
                )}
              </Card>
              <Card title={t("Review invoice lines", "بررسی ردیف‌های فاکتور")}>
                <p className="muted">
                  {t(
                    "Quantities are individual units. Confirm the product, quantities, cost, and date decision on each line.",
                    "تعدادها واحد تکی هستند. کالا، تعداد، هزینه و تصمیم پیگیری تاریخ هر ردیف را تأیید کنید.",
                  )}
                </p>
                {!invoice.lines.length && (
                  <EmptyState>
                    {t(
                      "No lines. Add a product below to start your manual draft.",
                      "ردیفی نیست. برای شروع پیش‌نویس دستی، کالا را در زیر اضافه کنید.",
                    )}
                  </EmptyState>
                )}
                {invoice.lines.map((line, index) => {
                  const product = state.products.find(
                    (item) =>
                      item.code === line.product_code &&
                      item.company_id === invoice.company_id,
                  );
                  const category = state.config.pricing_categories.find(
                    (item) =>
                      item.key ===
                      (line.pricing_category ??
                        product?.pricing_category ??
                        "grocery"),
                  )!;
                  const short = lineShort(line);
                  let price: string | null = null;
                  let costValid = true;
                  try {
                    price = locked
                      ? line.calculated_selling_price
                      : calculatePrice(
                          line.unit_cost_before_tax,
                          category.key,
                          state.config,
                        ).selling_price;
                  } catch {
                    costValid = false;
                  }
                  const oldPrice =
                    product?.branch_prices?.[invoice.branch] ||
                    product?.selling_price ||
                    null;
                  const name =
                    lang === "fa"
                      ? (product?.name_fa ??
                        line.new_name_fa ??
                        line.description)
                      : (product?.name_en ?? line.description);
                  return (
                    <section
                      className="invoice-line"
                      key={`${index}-${line.product_code}`}
                      aria-label={`${t("Line", "ردیف")} ${index + 1}: ${name}`}
                    >
                      <div className="page-header">
                        <h3>
                          {index + 1}. {name}
                        </h3>
                        <div className="inline-actions">
                          {line.product_code === "NEW" ||
                          product?.status === "pending_approval" ? (
                            <Badge tone="pending">
                              {t("Pending new product", "کالای جدید در انتظار")}
                            </Badge>
                          ) : (
                            <Badge tone="info">
                              {t("Matched", "تطبیق داده شد")}
                            </Badge>
                          )}
                          {short.quantity > 0 && (
                            <Badge tone="danger">
                              {t("Short", "کسری")}: {short.quantity}
                            </Badge>
                          )}
                          {line.taxable && (
                            <Badge tone="info">
                              {t("Taxable", "مشمول مالیات")}
                            </Badge>
                          )}
                          {line.review_confirmed && (
                            <Badge tone="approved">
                              {t("Confirmed", "تأیید شد")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <fieldset disabled={locked} className="form-grid">
                        <Field
                          label={t("Matched product", "کالای تطبیق‌یافته")}
                        >
                          <select
                            value={line.product_code}
                            onChange={(event) =>
                              editLine(
                                index,
                                (item) => {
                                  item.product_code = event.target.value;
                                  const chosen = state.products.find(
                                    (entry) =>
                                      entry.code === event.target.value,
                                  );
                                  if (chosen) {
                                    item.pricing_category =
                                      chosen.pricing_category;
                                    item.taxable = chosen.taxable;
                                    item.tax_profile = chosen.tax_profile;
                                  }
                                  item.date_confirmed = false;
                                },
                                true,
                              )
                            }
                          >
                            <option value="NEW">
                              {t(
                                "Create pending new product",
                                "ایجاد کالای جدید در انتظار",
                              )}
                            </option>
                            {state.products
                              .filter(
                                (item) =>
                                  item.company_id === invoice.company_id &&
                                  item.status !== "archived",
                              )
                              .map((item) => (
                                <option key={item.code} value={item.code}>
                                  {item.code} ·{" "}
                                  {lang === "fa" ? item.name_fa : item.name_en}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field label={t("Pricing category", "دسته قیمت‌گذاری")}>
                          <select
                            value={category.key}
                            onChange={(event) =>
                              editLine(index, (item) => {
                                item.pricing_category = event.target.value;
                                item.date_confirmed = false;
                              })
                            }
                          >
                            {state.config.pricing_categories.map((item) => (
                              <option key={item.key} value={item.key}>
                                {categoryText(item.key, item.label, t)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {line.product_code === "NEW" && (
                          <>
                            <Field
                              label={t(
                                "New product name (English)",
                                "نام کالای جدید (انگلیسی)",
                              )}
                            >
                              <input
                                value={line.new_name_en ?? ""}
                                onChange={(event) =>
                                  editLine(index, (item) => {
                                    item.new_name_en = event.target.value;
                                  })
                                }
                              />
                            </Field>
                            <Field
                              label={t(
                                "New product name (Persian)",
                                "نام کالای جدید (فارسی)",
                              )}
                            >
                              <input
                                dir="rtl"
                                value={line.new_name_fa ?? ""}
                                onChange={(event) =>
                                  editLine(index, (item) => {
                                    item.new_name_fa = event.target.value;
                                  })
                                }
                              />
                            </Field>
                          </>
                        )}
                        <Field label={t("Invoiced quantity", "تعداد فاکتور")}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            dir="ltr"
                            value={line.qty_invoiced}
                            onChange={(event) =>
                              editLine(
                                index,
                                (item) => {
                                  item.qty_invoiced = Number(
                                    event.target.value,
                                  );
                                  item.qty_received_at_posting = Math.min(
                                    item.qty_received_at_posting,
                                    item.qty_invoiced,
                                  );
                                },
                                true,
                              )
                            }
                          />
                        </Field>
                        <Field
                          label={t("Delivered quantity", "تعداد تحویل‌شده")}
                        >
                          <input
                            type="number"
                            min="0"
                            max={line.qty_invoiced}
                            step="1"
                            dir="ltr"
                            value={line.qty_received_at_posting}
                            onChange={(event) =>
                              editLine(index, (item) => {
                                item.qty_received_at_posting = Number(
                                  event.target.value,
                                );
                              })
                            }
                          />
                        </Field>
                        <Field
                          label={t(
                            "Unit cost before tax",
                            "هزینه هر واحد پیش از مالیات",
                          )}
                          error={
                            !costValid
                              ? t(
                                  "Enter a cost of zero or more with up to four decimal places.",
                                  "هزینه صفر یا بیشتر با حداکثر چهار رقم اعشار وارد کنید.",
                                )
                              : undefined
                          }
                        >
                          <input
                            dir="ltr"
                            inputMode="decimal"
                            value={line.unit_cost_before_tax}
                            onChange={(event) =>
                              editLine(
                                index,
                                (item) => {
                                  item.unit_cost_before_tax =
                                    event.target.value;
                                },
                                true,
                              )
                            }
                          />
                        </Field>
                        <div className="field">
                          <span className="field-label">
                            {t(
                              "Calculated selling price",
                              "قیمت فروش محاسبه‌شده",
                            )}
                          </span>
                          <strong className="price-display numeric" dir="ltr">
                            {price ? money(price) : "—"}
                          </strong>
                          <span className="muted">
                            {t("Before tax", "پیش از مالیات")}
                          </span>
                          {price && oldPrice !== price && (
                            <Badge tone="pending">
                              {t(
                                "Pending approval after posting",
                                "پس از ثبت در انتظار تأیید",
                              )}
                            </Badge>
                          )}
                          {oldPrice && (
                            <p className="muted">
                              {t(
                                "Approved price to charge:",
                                "قیمت تأییدشده برای فروش:",
                              )}{" "}
                              <span dir="ltr">{money(oldPrice)}</span>
                            </p>
                          )}
                        </div>
                      </fieldset>
                      {!locked && (
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={short.quantity > 0}
                            onChange={(event) =>
                              editLine(index, (item) => {
                                item.qty_received_at_posting = event.target
                                  .checked
                                  ? Math.max(
                                      0,
                                      item.qty_invoiced -
                                        Math.min(4, item.qty_invoiced),
                                    )
                                  : item.qty_invoiced;
                              })
                            }
                          />
                          {t("Mark as short", "ثبت کسری")}
                        </label>
                      )}
                      {short.quantity > 0 && (
                        <p className="banner danger">
                          {t("Missing units:", "واحدهای کمبود:")}{" "}
                          {short.quantity} · {t("Deduction:", "کسر مبلغ:")}{" "}
                          <span dir="ltr">{money(short.total)}</span> (
                          {money(short.beforeTax)} + {money(short.tax)}{" "}
                          {t("tax", "مالیات")})
                        </p>
                      )}
                      {category.date_tracking_prompt && (
                        <fieldset disabled={locked} className="date-review">
                          <label className="check-row">
                            <input
                              type="checkbox"
                              checked={line.date_tracking ?? false}
                              onChange={(event) =>
                                editLine(index, (item) => {
                                  item.date_tracking = event.target.checked;
                                  item.date_confirmed = false;
                                })
                              }
                            />
                            {t(
                              "Track a date for this line",
                              "پیگیری تاریخ این ردیف",
                            )}
                          </label>
                          {line.date_tracking && (
                            <div className="form-grid">
                              <Field label={t("Date tracking", "پیگیری تاریخ")}>
                                <select
                                  value={line.date_type ?? "expiry"}
                                  onChange={(event) =>
                                    editLine(index, (item) => {
                                      item.date_type = event.target.value as
                                        "expiry" | "best_before";
                                    })
                                  }
                                >
                                  <option value="expiry">
                                    {t("Expiry", "انقضا")}
                                  </option>
                                  <option value="best_before">
                                    {t("Best before", "بهترین زمان مصرف")}
                                  </option>
                                </select>
                              </Field>
                              <Field label={t("Date", "تاریخ")}>
                                <input
                                  type="date"
                                  dir="ltr"
                                  value={line.date_value ?? ""}
                                  min="1900-01-01"
                                  onChange={(event) =>
                                    editLine(index, (item) => {
                                      item.date_value = event.target.value;
                                      item.date_confirmed = false;
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label={t(
                                  "Lot number (optional)",
                                  "شماره بچ (اختیاری)",
                                )}
                              >
                                <input
                                  dir="ltr"
                                  value={line.lot_number ?? ""}
                                  onChange={(event) =>
                                    editLine(index, (item) => {
                                      item.lot_number = event.target.value;
                                    })
                                  }
                                />
                              </Field>
                            </div>
                          )}
                          <label className="check-row">
                            <input
                              type="checkbox"
                              checked={line.date_confirmed ?? false}
                              onChange={(event) =>
                                editLine(index, (item) => {
                                  item.date_confirmed = event.target.checked;
                                })
                              }
                            />
                            {t(
                              "Confirm date tracking decision",
                              "تأیید تصمیم پیگیری تاریخ",
                            )}
                          </label>
                        </fieldset>
                      )}
                      <label className="check-row">
                        <input
                          type="checkbox"
                          disabled={locked}
                          checked={line.review_confirmed ?? false}
                          onChange={(event) =>
                            update((draft) => {
                              draft.invoice.lines[index].review_confirmed =
                                event.target.checked;
                            })
                          }
                        />
                        {t(
                          "Confirm this invoice line",
                          "تأیید این ردیف فاکتور",
                        )}
                      </label>
                    </section>
                  );
                })}
                {!locked && (
                  <div className="inline-actions">
                    <Field
                      label={t(
                        "Add a product to the invoice",
                        "افزودن کالا به فاکتور",
                      )}
                    >
                      <select
                        value={manualCode}
                        onChange={(event) => setManualCode(event.target.value)}
                      >
                        {state.products
                          .filter(
                            (item) =>
                              item.company_id === invoice.company_id &&
                              item.status !== "archived",
                          )
                          .map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.code} ·{" "}
                              {lang === "fa" ? item.name_fa : item.name_en}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        update((draft) => {
                          addManualLine(draft, manualCode);
                        })
                      }
                    >
                      {t("Add line", "افزودن ردیف")}
                    </Button>
                  </div>
                )}
              </Card>
              {lowerLines.length > 0 && (
                <Card
                  title={t(
                    "Same-supplier lower price",
                    "کاهش هزینه همان تأمین‌کننده",
                  )}
                >
                  {lowerLines.map((line) => {
                    const product = state.products.find(
                      (item) => item.code === line.product_code,
                    )!;
                    return (
                      <p key={line.product_code}>
                        {lang === "fa" ? product.name_fa : product.name_en} ·{" "}
                        {invoice.supplier} ·{" "}
                        <span dir="ltr">
                          {money(
                            previousReceiptCost(state, product.code)?.cost ??
                              product.last_cost_before_tax,
                          )}{" "}
                          → {money(line.unit_cost_before_tax)}
                        </span>
                      </p>
                    );
                  })}
                  <p className="muted">
                    {t(
                      "Your answers create a Supervisor alert when you post. Unknown information is allowed with a note.",
                      "پاسخ‌های شما هنگام ثبت هشدار سرپرست ایجاد می‌کند. اطلاعات نامعلوم با یادداشت پذیرفته می‌شود.",
                    )}
                  </p>
                  <fieldset disabled={locked} className="form-grid">
                    <Field
                      label={t(
                        "Is the expiry date the same as the stock on hand?",
                        "آیا تاریخ انقضا با موجودی قبلی یکسان است؟",
                      )}
                    >
                      <select
                        value={invoice.lower_price_answers?.same_expiry ?? ""}
                        onChange={(event) =>
                          update((draft) => {
                            draft.invoice.lower_price_answers = {
                              same_expiry: event.target.value,
                            };
                          })
                        }
                      >
                        <option value="">
                          {t("Choose an answer", "پاسخ را انتخاب کنید")}
                        </option>
                        <option value="yes">
                          {t("Yes, same date", "بله، تاریخ یکسان")}
                        </option>
                        <option value="no">
                          {t("No, different dates", "خیر، تاریخ‌های متفاوت")}
                        </option>
                        <option value="no_previous_stock">
                          {t("No previous stock", "موجودی قبلی نیست")}
                        </option>
                        <option value="dates_not_tracked">
                          {t("Dates not tracked", "تاریخ‌ها پیگیری نمی‌شوند")}
                        </option>
                        <option value="unknown">
                          {t(
                            "Unknown — add a note",
                            "نامعلوم — یادداشت اضافه کنید",
                          )}
                        </option>
                      </select>
                    </Field>
                    {invoice.lower_price_answers?.same_expiry === "yes" && (
                      <Field
                        label={t(
                          "Units left at the higher cost",
                          "واحدهای باقی‌مانده با هزینه بالاتر",
                        )}
                      >
                        <input
                          type="number"
                          min="0"
                          step="1"
                          dir="ltr"
                          value={invoice.lower_price_answers.units_left ?? ""}
                          onChange={(event) =>
                            update((draft) => {
                              draft.invoice.lower_price_answers!.units_left =
                                event.target.value === ""
                                  ? undefined
                                  : Number(event.target.value);
                            })
                          }
                        />
                      </Field>
                    )}
                    {invoice.lower_price_answers?.same_expiry === "no" && (
                      <>
                        <Field
                          label={t("Old stock expiry", "انقضای موجودی قبلی")}
                        >
                          <input
                            type="date"
                            dir="ltr"
                            value={invoice.lower_price_answers.old_expiry ?? ""}
                            onChange={(event) =>
                              update((draft) => {
                                draft.invoice.lower_price_answers!.old_expiry =
                                  event.target.value;
                              })
                            }
                          />
                        </Field>
                        <Field
                          label={t("New delivery expiry", "انقضای تحویل جدید")}
                        >
                          <input
                            type="date"
                            dir="ltr"
                            value={invoice.lower_price_answers.new_expiry ?? ""}
                            onChange={(event) =>
                              update((draft) => {
                                draft.invoice.lower_price_answers!.new_expiry =
                                  event.target.value;
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    {invoice.lower_price_answers?.same_expiry === "unknown" && (
                      <Field
                        label={t(
                          "What information is unknown? (required)",
                          "چه اطلاعاتی نامعلوم است؟ (الزامی)",
                        )}
                      >
                        <textarea
                          value={invoice.lower_price_answers.note ?? ""}
                          onChange={(event) =>
                            update((draft) => {
                              draft.invoice.lower_price_answers!.note =
                                event.target.value;
                            })
                          }
                        />
                      </Field>
                    )}
                  </fieldset>
                  {!locked && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        update((draft) => {
                          const today = companyDate(draft.config);
                          draft.invoice.lower_price_answers = {
                            same_expiry: "no",
                            old_expiry: dateAfter(
                              today,
                              demo.same_supplier_lower_price_alert
                                .example_answer.old_expiry_relative_days,
                            ),
                            new_expiry: dateAfter(
                              today,
                              demo.same_supplier_lower_price_alert
                                .example_answer.new_expiry_relative_days,
                            ),
                            units_left:
                              demo.same_supplier_lower_price_alert
                                .example_answer.units_left_at_old_cost,
                          };
                        })
                      }
                    >
                      {t(
                        "Use fictional demo answer",
                        "استفاده از پاسخ ساختگی دمو",
                      )}
                    </Button>
                  )}
                </Card>
              )}
              <Card title={t("Delivery summary", "خلاصه تحویل")}>
                <dl className="detail-list">
                  <div>
                    <dt>{t("Original invoice total", "جمع اصل فاکتور")}</dt>
                    <dd dir="ltr">{money(invoice.final_total)}</dd>
                  </div>
                  <div>
                    <dt>{t("Open shorts deduction", "کسر کسری باز")}</dt>
                    <dd dir="ltr">−{money(totals.total)}</dd>
                  </div>
                  <div>
                    <dt>
                      {t(
                        "Invoice total after open shorts",
                        "جمع فاکتور پس از کسری باز",
                      )}
                    </dt>
                    <dd dir="ltr">
                      {money(
                        /^[0-9]+(?:\.[0-9]{1,2})?$/.test(invoice.final_total)
                          ? new Decimal(invoice.final_total)
                              .minus(totals.total)
                              .toFixed(2)
                          : "0",
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="muted">
                  {t(
                    "This is the amount of this invoice, not a supplier balance. Only physically delivered units are added to stock.",
                    "این مبلغ همین فاکتور است، نه مانده تأمین‌کننده. فقط واحدهای واقعاً تحویل‌شده به موجودی اضافه می‌شوند.",
                  )}
                </p>
              </Card>
              {locked &&
                invoice.lines
                  .filter((line) => lineShort(line).quantity > 0)
                  .map((line) => {
                    const remaining =
                      lineShort(line).quantity - (line.qty_later_received ?? 0);
                    const product = state.products.find(
                      (item) => item.code === line.product_code,
                    )!;
                    return (
                      <Card
                        key={line.product_code}
                        title={`${t("Later short delivery", "تحویل بعدی کسری")} · ${lang === "fa" ? product.name_fa : product.name_en}`}
                      >
                        <p>
                          <Badge tone={remaining ? "danger" : "approved"}>
                            {remaining
                              ? t("Short", "کسری")
                              : t("Resolved", "رفع شد")}
                          </Badge>{" "}
                          {t("Still missing:", "کمبود باقی‌مانده:")} {remaining}{" "}
                          · {t("Received later:", "دریافت بعدی:")}{" "}
                          {line.qty_later_received ?? 0}
                        </p>
                        <p>
                          {t(
                            "Stock received from this invoice:",
                            "موجودی دریافت‌شده از این فاکتور:",
                          )}{" "}
                          {line.qty_received_at_posting +
                            (line.qty_later_received ?? 0)}
                        </p>
                        {remaining > 0 && (
                          <>
                            <div className="form-grid">
                              <Field
                                label={t(
                                  "Actual units received now",
                                  "واحدهای واقعاً دریافت‌شده اکنون",
                                )}
                              >
                                <input
                                  dir="ltr"
                                  type="number"
                                  min="1"
                                  max={remaining}
                                  step="1"
                                  value={
                                    deliveryQuantities[line.product_code] ??
                                    Math.min(2, remaining)
                                  }
                                  onChange={(event) =>
                                    setDeliveryQuantities((current) => ({
                                      ...current,
                                      [line.product_code]: Number(
                                        event.target.value,
                                      ),
                                    }))
                                  }
                                />
                              </Field>
                              <Field
                                label={t(
                                  "Delivery document reference",
                                  "مرجع سند تحویل",
                                )}
                              >
                                <input
                                  dir="ltr"
                                  value={
                                    deliveryRefs[line.product_code] ??
                                    `DEMO-DELIVERY-${(line.qty_later_received ?? 0) + 1}`
                                  }
                                  onChange={(event) =>
                                    setDeliveryRefs((current) => ({
                                      ...current,
                                      [line.product_code]: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                            </div>
                            <Button
                              onClick={() => receive(line.product_code)}
                              disabled={branch !== invoice.branch}
                            >
                              {t("Receive short delivery", "دریافت تحویل کسری")}
                            </Button>
                          </>
                        )}
                        {state.ledger
                          .filter(
                            (entry) =>
                              entry.invoice_id === invoice.id &&
                              entry.type === "short_restoration",
                          )
                          .map((entry) => (
                            <p key={entry.id}>
                              <span dir="ltr">{entry.reference}</span> ·{" "}
                              {t("Restored:", "بازگردانده شد:")}{" "}
                              <span dir="ltr">{money(entry.amount)}</span>
                            </p>
                          ))}
                      </Card>
                    );
                  })}
              {invoice.file_data && (
                <Card title={t("Original preview", "پیش‌نمایش اصل فاکتور")}>
                  <p dir="auto">{invoice.file_name}</p>
                  {invoice.file_type === "application/pdf" ? (
                    <iframe
                      title={t("Original invoice PDF", "PDF اصل فاکتور")}
                      src={invoice.file_data}
                      style={{
                        width: "100%",
                        height: 420,
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <img
                      src={invoice.file_data}
                      alt={t("Original invoice image", "تصویر اصل فاکتور")}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 420,
                        objectFit: "contain",
                      }}
                    />
                  )}
                </Card>
              )}
              {!locked && (
                <>
                  {blockers.length > 0 && (
                    <div className="banner pending">
                      <ul>
                        {blockers.map((blocker) => (
                          <li key={blocker}>{t(...blockerCopy[blocker])}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bottom-bar">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        update((draft) => {
                          draft.invoice.status = "draft";
                        });
                        setMessage(
                          t("Saved as draft", "به عنوان پیش‌نویس ذخیره شد"),
                        );
                      }}
                    >
                      {t("Save as draft", "ذخیره به عنوان پیش‌نویس")}
                    </Button>
                    <Button onClick={post} disabled={blockers.length > 0}>
                      {t("Post invoice", "ثبت فاکتور")}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
