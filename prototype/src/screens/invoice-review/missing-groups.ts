import Decimal from "decimal.js";
import { paymentTermsDays } from "../../invoice-entry";
import type { InvoiceOrderProblem } from "../../invoice-orders";
import { costPerUnit } from "../../supplier-items";
import {
  invoiceCheckField,
  visibleInvoiceCheckFields,
} from "../../invoice-checks";
import {
  actualDate,
  validCost,
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
} from "../../invoice";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { invoiceCheckTarget } from "./review-attention";
import { invoiceAmountIssue } from "./amount-issue";
export function missingGroups(
  invoice: InvoiceReadDTO,
  t: (en: string, fa: string) => string,
  blockers: readonly string[],
  blockerLineIndexes: Readonly<
    Record<string, readonly number[] | undefined>
  > = {},
  orderProblems: readonly InvoiceOrderProblem[] = [],
) {
  const groups: { label: string; target: string; line?: number }[] = [];
  const add = (label: string, target: string, line?: number) => {
    if (
      !groups.some((group) => group.label === label && group.target === target)
    )
      groups.push({ label, target, ...(line === undefined ? {} : { line }) });
  };
  const lineIssue = (index: number, en: string, fa: string, field: string) =>
    add(
      t(`Line ${index + 1}: ${en}`, `ردیف ${index + 1}: ${fa}`),
      invoiceCheckTarget(field, index),
      index,
    );
  const affected = (blocker: string) =>
    blockerLineIndexes[blocker] ?? invoice.lines.map((_, index) => index);
  if (blockers.includes("supplier"))
    add(
      t(
        "Supplier is missing or inactive. Choose an active supplier or add one.",
        "تأمین‌کننده خالی یا غیرفعال است. تأمین‌کننده فعال انتخاب یا اضافه کنید.",
      ),
      "invoice-supplier",
    );
  if (blockers.includes("header")) {
    if (!invoice.supplier_invoice_number.trim())
      add(
        t(
          "Invoice number is empty. Enter the number printed on the invoice.",
          "شماره فاکتور خالی است. شماره چاپ‌شده روی فاکتور را وارد کنید.",
        ),
        "invoice-number",
      );
    if (!actualDate(invoice.invoice_date))
      add(
        t(
          "Invoice date is missing or invalid. Choose the date printed on the invoice.",
          "تاریخ فاکتور خالی یا نامعتبر است. تاریخ چاپ‌شده روی فاکتور را انتخاب کنید.",
        ),
        "invoice-date",
      );
    if (!invoice.received_at || Number.isNaN(Date.parse(invoice.received_at)))
      add(
        t(
          "Received date and time are missing or invalid. Set when the delivery arrived.",
          "تاریخ و زمان دریافت خالی یا نامعتبر است. زمان رسیدن محموله را تعیین کنید.",
        ),
        "invoice-received-date",
      );
    if (!invoice.receiving_employee?.trim())
      add(
        t(
          "Received by is empty. Choose the person who received this delivery.",
          "دریافت‌کننده خالی است. شخصی را که این محموله را دریافت کرده انتخاب کنید.",
        ),
        "invoice-employee",
      );
  }
  if (blockers.includes("money")) {
    for (const field of ["subtotal", "tax", "final_total"] as const) {
      const issue = invoiceAmountIssue(field, invoice[field], t);
      if (issue) add(issue, invoiceCheckTarget(field));
    }
    for (const [index, charge] of (invoice.other_charges ?? []).entries()) {
      let valid = false;
      try {
        valid = new Decimal(charge.amount).isFinite();
      } catch {
        /* Unreadable amounts need a concrete edit. */
      }
      if (!valid)
        add(
          t(
            `Charge ${index + 1}: amount is invalid. Enter the amount from the invoice (negative for a credit).`,
            `هزینه ${index + 1}: مبلغ نامعتبر است. مبلغ فاکتور را وارد کنید (برای اعتبار، منفی).`,
          ),
          `invoice-check-charge-${index}-input-line_total`,
        );
    }
  }
  const totals = visibleInvoiceCheckFields(invoice).filter((field) =>
    ["subtotal", "tax", "final_total"].includes(invoiceCheckField(field)),
  );
  const details = visibleInvoiceCheckFields(invoice).filter(
    (field) => !totals.includes(field),
  );
  if (details.length)
    add(
      t(
        `Invoice details: ${details.length} highlighted ${details.length === 1 ? "field" : "fields"}`,
        `اطلاعات فاکتور: ${details.length} فیلد مشخص‌شده`,
      ),
      invoiceCheckTarget(details[0]),
    );
  const chargeChecks = (invoice.other_charges ?? []).flatMap((charge, index) =>
    visibleInvoiceCheckFields(charge).map((field) => ({ index, field })),
  );
  if (totals.length + chargeChecks.length)
    add(
      t(
        `Totals: ${totals.length + chargeChecks.length} to check`,
        `جمع‌ها: ${totals.length + chargeChecks.length} مورد برای بررسی`,
      ),
      totals[0]
        ? invoiceCheckTarget(totals[0])
        : `invoice-check-charge-${chargeChecks[0].index}-input-${invoiceCheckField(chargeChecks[0].field)}`,
    );
  const unconfirmed = invoice.lines.flatMap((line, index) =>
    line.review_confirmed ? [] : [index + 1],
  );
  if (unconfirmed.length)
    add(
      t(
        `Lines: ${unconfirmed.length} not confirmed (${unconfirmed.join(", ")})`,
        `ردیف‌ها: ${unconfirmed.length} تأییدنشده (${unconfirmed.join("، ")})`,
      ),
      `invoice-line-${unconfirmed[0] - 1}-confirm`,
      unconfirmed[0] - 1,
    );
  invoice.lines.forEach((line, index) => {
    if (line.product_code === "NEW" && !line.pricing_category)
      lineIssue(
        index,
        "choose a pricing category for the new product.",
        "دسته قیمت‌گذاری کالای جدید را انتخاب کنید.",
        "pricing_category",
      );
    const checks = visibleInvoiceCheckFields(line);
    if (checks.length)
      add(
        t(
          `Line ${index + 1}: ${checks.length} highlighted ${checks.length === 1 ? "field" : "fields"}. Compare with the original and confirm the line.`,
          `ردیف ${index + 1}: ${checks.length} فیلد مشخص‌شده. با اصل فاکتور مقایسه و ردیف را تأیید کنید.`,
        ),
        invoiceCheckTarget(checks[0], index),
        index,
      );
  });
  for (const index of affected("matching"))
    if (blockers.includes("matching")) {
      const line = invoice.lines[index];
      lineIssue(
        index,
        line.product_code === "NEW"
          ? "English name is empty. Enter the product name."
          : "the product match is unavailable. Choose an existing product or New product.",
        line.product_code === "NEW"
          ? "نام انگلیسی خالی است. نام کالا را وارد کنید."
          : "کالای مرتبط در دسترس نیست. کالای موجود یا کالای جدید را انتخاب کنید.",
        line.product_code === "NEW" ? "description" : "product_code",
      );
    }
  for (const index of affected("quantity"))
    if (blockers.includes("quantity")) {
      const line = invoice.lines[index];
      const quantityFacts = {
        ...line,
        unit_cost_before_tax: line.unit_cost_before_tax ?? "",
        line_total: line.line_total ?? "",
      };
      if (
        line.quantity_unit === "cases" &&
        line.sold_by !== "weight" &&
        (!Number.isSafeInteger(line.units_per_case ?? 1) ||
          (line.units_per_case ?? 1) <= 0)
      )
        lineIssue(
          index,
          "units per case is invalid. Enter a whole number greater than zero.",
          "واحد در کارتن نامعتبر است. عدد صحیح بیشتر از صفر وارد کنید.",
          "units_per_case",
        );
      else if (!validInvoiceLineQuantity(quantityFacts))
        lineIssue(
          index,
          "invoiced quantity is invalid. Enter a quantity greater than zero in the selected unit.",
          "تعداد فاکتورشده نامعتبر است. مقدار بیشتر از صفر در واحد انتخاب‌شده وارد کنید.",
          "quantity_entered",
        );
      else if (!validInvoiceLineReceived(quantityFacts))
        lineIssue(
          index,
          "delivered quantity is invalid. Enter zero up to the invoiced quantity.",
          "تعداد تحویل‌شده نامعتبر است. از صفر تا تعداد فاکتورشده وارد کنید.",
          "qty_received_at_posting",
        );
      else if (
        !Number.isFinite(line.refused_units ?? 0) ||
        (line.refused_units ?? 0) < 0 ||
        (line.refused_units ?? 0) > line.qty_received_at_posting ||
        (line.sold_by !== "weight" &&
          !Number.isSafeInteger(line.refused_units ?? 0))
      )
        lineIssue(
          index,
          "refused quantity is invalid. Enter zero up to the delivered quantity.",
          "تعداد ردشده نامعتبر است. از صفر تا تعداد تحویل‌شده وارد کنید.",
          "refused_units",
        );
      else
        lineIssue(
          index,
          "invoiced quantity does not match its pack. Check the quantity and units per case.",
          "تعداد فاکتورشده با بسته سازگار نیست. تعداد و واحد در کارتن را بررسی کنید.",
          "quantity_entered",
        );
    }
  for (const index of affected("cost"))
    if (blockers.includes("cost")) {
      const line = invoice.lines[index];
      if (
        line.sold_by !== "weight" &&
        line.quantity_unit === "cases" &&
        !validCost(line.case_cost_before_tax ?? "")
      )
        lineIssue(
          index,
          "case cost is empty or invalid. Enter zero or more with up to four decimal places.",
          "هزینه کارتن خالی یا نامعتبر است. صفر یا بیشتر با حداکثر چهار رقم اعشار وارد کنید.",
          "case_cost_before_tax",
        );
      else if (
        !validCost(line.unit_cost_before_tax ?? "") ||
        (line.sold_by === "weight" &&
          !validCost(line.source_cost_before_tax ?? ""))
      )
        lineIssue(
          index,
          "unit cost is empty or invalid. Enter zero or more with up to four decimal places.",
          "هزینه واحد خالی یا نامعتبر است. صفر یا بیشتر با حداکثر چهار رقم اعشار وارد کنید.",
          "unit_cost_before_tax",
        );
      else if (
        line.quantity_unit === "cases" &&
        line.sold_by !== "weight" &&
        (!Number.isSafeInteger(line.units_per_case ?? 1) ||
          (line.units_per_case ?? 1) <= 0)
      )
        lineIssue(
          index,
          "units per case is invalid. Enter a whole number greater than zero.",
          "واحد در کارتن نامعتبر است. عدد صحیح بیشتر از صفر وارد کنید.",
          "units_per_case",
        );
      else if (
        line.quantity_unit === "cases" &&
        line.sold_by !== "weight" &&
        Number.isSafeInteger(line.units_per_case ?? 1) &&
        (line.units_per_case ?? 1) > 0 &&
        costPerUnit(line.case_cost_before_tax!, line.units_per_case ?? 1) !==
          new Decimal(line.unit_cost_before_tax!).toFixed(4)
      )
        lineIssue(
          index,
          "case cost does not match the unit cost and pack. Correct the case cost or units per case.",
          "هزینه کارتن با هزینه واحد و بسته سازگار نیست. هزینه کارتن یا واحد در کارتن را اصلاح کنید.",
          "case_cost_before_tax",
        );
      else if (!(line.product_code === "NEW" && !line.pricing_category))
        lineIssue(
          index,
          "a selling price cannot be calculated. Check the pricing category and unit cost.",
          "قیمت فروش قابل محاسبه نیست. دسته قیمت‌گذاری و هزینه واحد را بررسی کنید.",
          "pricing_category",
        );
    }
  for (const index of affected("date"))
    if (blockers.includes("date")) {
      const line = invoice.lines[index];
      if (
        line.short_dated &&
        line.date_type !== undefined &&
        line.date_type !== "expiry"
      )
        lineIssue(
          index,
          "short-dated goods require Expiry. Change Date type to Expiry.",
          "کالای نزدیک انقضا به تاریخ انقضا نیاز دارد. نوع تاریخ را به انقضا تغییر دهید.",
          "date_type",
        );
      else if (line.short_dated && !line.date_tracking)
        lineIssue(
          index,
          "short-dated goods require date tracking. Choose Yes.",
          "کالای نزدیک انقضا به پیگیری تاریخ نیاز دارد. بله را انتخاب کنید.",
          "date_tracking",
        );
      else if (!line.date_confirmed || !actualDate(line.date_value))
        lineIssue(
          index,
          "tracked date is missing or unconfirmed. Enter a valid date and confirm the line.",
          "تاریخ پیگیری خالی یا تأییدنشده است. تاریخ معتبر وارد و ردیف را تأیید کنید.",
          "date_value",
        );
      else
        lineIssue(
          index,
          "short-dated receipt is not eligible. Check the matched product and lower unit cost, or choose Regular receipt.",
          "این دریافت شرایط نزدیک انقضا را ندارد. کالای مرتبط و هزینه کمتر را بررسی کنید یا دریافت عادی را انتخاب کنید.",
          "short_dated",
        );
    }
  for (const index of affected("barcode"))
    if (blockers.includes("barcode"))
      lineIssue(
        index,
        "barcode belongs to another product. Correct the barcode or match that product.",
        "بارکد متعلق به کالای دیگری است. بارکد را اصلاح یا همان کالا را مرتبط کنید.",
        "barcode",
      );
  for (const index of affected("selling_price"))
    if (blockers.includes("selling_price"))
      lineIssue(
        index,
        "selling price is invalid or its cost changed. Enter a positive price and review it again.",
        "قیمت فروش معتبر نیست یا هزینه تغییر کرده است. قیمت مثبت وارد و دوباره بررسی کنید.",
        "selling_price",
      );
  for (const index of affected("manual_price"))
    if (blockers.includes("manual_price"))
      lineIssue(
        index,
        "choose whether to keep the manual selling price or use the calculated price.",
        "انتخاب کنید قیمت دستی حفظ شود یا قیمت محاسبه‌شده استفاده شود.",
        "manual_price_decision",
      );
  const messages: Record<string, [string, string, string]> = {
    permission: [
      "Your role cannot post this invoice at this location. Ask an Owner or Manager with receiving access.",
      "نقش شما اجازه ثبت این فاکتور در این مکان را ندارد. از مالک یا مدیر دارای دسترسی دریافت کمک بگیرید.",
      "invoice-review-header",
    ],
    company: [
      "This record belongs to another company. Choose an invoice from this company in Invoices.",
      "این رکورد متعلق به شرکت دیگری است. در فاکتورها یک فاکتور از این شرکت انتخاب کنید.",
      "invoice-back-link",
    ],
    branch: [
      "Invoice location is unavailable. Choose an allowed location.",
      "مکان فاکتور در دسترس نیست. مکان مجاز انتخاب کنید.",
      "invoice-location",
    ],
    file: [
      "Original invoice is missing. Attach its PDF or photo.",
      "اصل فاکتور پیوست نشده است. PDF یا عکس آن را پیوست کنید.",
      "invoice-original-field",
    ],
    lines: [
      "The invoice has no lines. Choose a product and add a line.",
      "فاکتور ردیف ندارد. یک کالا انتخاب و ردیف اضافه کنید.",
      "invoice-add-product",
    ],
  };
  if (blockers.includes("payment_terms")) {
    const hasDays =
      paymentTermsDays(invoice.payment_terms ?? "") !== undefined ||
      /^monthly$/i.test(invoice.payment_terms?.trim() ?? "");
    if (hasDays && !invoice.due_date_manual && !actualDate(invoice.due_date))
      add(
        t(
          "Due date is missing or invalid. Choose the due date for these payment terms.",
          "تاریخ سررسید خالی یا نامعتبر است. سررسید این شرایط پرداخت را انتخاب کنید.",
        ),
        "invoice-due-date",
      );
    else
      add(
        t(
          "Payment terms are incomplete. Enter a nonnegative whole number of days or choose a listed term.",
          "شرایط پرداخت ناقص است. تعداد روز صحیح غیرمنفی وارد کنید یا شرایط فهرست را انتخاب کنید.",
        ),
        "invoice-payment-terms-days",
      );
  }
  if (blockers.includes("lower_price")) {
    const answer = invoice.lower_price_answers;
    if (answer?.same_expiry === "unknown")
      add(
        t(
          "Lower-cost receipt note is empty. Explain what information is unknown.",
          "یادداشت دریافت با هزینه کمتر خالی است. توضیح دهید چه اطلاعاتی نامعلوم است.",
        ),
        "invoice-lower-note",
      );
    else if (answer?.same_expiry === "yes")
      add(
        t(
          "Units left at the higher cost is missing or invalid. Enter a whole number of zero or more.",
          "واحد باقی‌مانده با هزینه بالاتر خالی یا نامعتبر است. عدد صحیح صفر یا بیشتر وارد کنید.",
        ),
        "invoice-lower-units-left",
      );
    else if (answer?.same_expiry === "no") {
      if (!answer.old_expiry)
        add(
          t(
            "Previous goods expiry is empty. Choose the expiry of the previous goods.",
            "انقضای کالای قبلی خالی است. تاریخ انقضای موجودی قبلی را انتخاب کنید.",
          ),
          "invoice-lower-old-expiry",
        );
      if (!answer.new_expiry)
        add(
          t(
            "New delivery expiry is empty. Choose the expiry of this delivery.",
            "انقضای تحویل جدید خالی است. تاریخ انقضای این محموله را انتخاب کنید.",
          ),
          "invoice-lower-new-expiry",
        );
    } else
      add(
        t(
          "Lower-cost receipt needs an answer. Compare the remaining goods or choose Unknown with a note.",
          "دریافت با هزینه کمتر به پاسخ نیاز دارد. کالای باقی‌مانده را مقایسه یا نامعلوم را با یادداشت انتخاب کنید.",
        ),
        "invoice-lower-answer",
      );
  }
  for (const problem of orderProblems) {
    const index = problem.line ?? 0;
    if (problem.kind === "stale")
      add(
        t(
          "The linked order changed. Refresh the comparison and review its differences.",
          "سفارش مرتبط تغییر کرده است. مقایسه را تازه و اختلاف‌ها را بررسی کنید.",
        ),
        "invoice-order-refresh",
      );
    else if (problem.kind === "unavailable" || problem.kind === "comparison")
      add(
        t(
          "The linked order cannot be compared. Choose a compatible open order or remove the link.",
          "سفارش مرتبط قابل مقایسه نیست. سفارش باز سازگار انتخاب یا ارتباط را حذف کنید.",
        ),
        "invoice-order",
      );
    else if (problem.kind === "supplier")
      add(
        t(
          "The linked order supplier is inactive. Reactivate it or choose an active supplier and another order.",
          "تأمین‌کننده سفارش مرتبط غیرفعال است. آن را فعال کنید یا تأمین‌کننده فعال و سفارش دیگری انتخاب کنید.",
        ),
        "invoice-supplier",
      );
    else if (problem.kind === "association")
      add(
        t(
          `Line ${index + 1}: the temporary item match is invalid. Choose a valid matching invoice line, or correct its product and supplier code.`,
          `ردیف ${index + 1}: تطبیق کالای موقت نامعتبر است. ردیف معتبر انتخاب یا کالا و کد تأمین‌کننده آن را اصلاح کنید.`,
        ),
        `invoice-order-match-${encodeURIComponent(problem.order_line_id!)}`,
      );
    else if (problem.kind === "extra")
      add(
        t(
          `Line ${index + 1}: decide whether to keep or refuse the extra delivery.`,
          `ردیف ${index + 1}: نگه‌داشتن یا رد تحویل اضافه را انتخاب کنید.`,
        ),
        `invoice-order-line-${index}-extra-decision`,
      );
    else if (problem.kind === "extra_quantity")
      add(
        t(
          `Line ${index + 1}: refused quantity disagrees with the extra-delivery decision. Choose Keep or Refuse again to apply its quantity.`,
          `ردیف ${index + 1}: تعداد ردشده با تصمیم تحویل اضافه سازگار نیست. نگه‌داشتن یا رد را دوباره انتخاب کنید تا تعداد اعمال شود.`,
        ),
        `invoice-order-line-${index}-extra-decision`,
      );
    else if (problem.kind === "refused")
      lineIssue(
        index,
        "refused units do not match the order decision. Correct the refused quantity.",
        "واحد ردشده با تصمیم سفارش سازگار نیست. تعداد ردشده را اصلاح کنید.",
        "refused_units",
      );
    else if (problem.kind === "price")
      add(
        t(
          `Line ${index + 1}: accept the changed cost or choose an eligible short-dated receipt.`,
          `ردیف ${index + 1}: هزینه تغییرکرده را بپذیرید یا دریافت واجد شرایط نزدیک انقضا انتخاب کنید.`,
        ),
        `invoice-order-line-${index}-price-decision`,
      );
    else if (problem.kind === "missing")
      add(
        t(
          "An ordered item is missing. Choose Short, Back-ordered or Cancelled for that item.",
          "یک کالای سفارش تحویل نشده است. برای همان کالا کسری، در انتظار تحویل بعدی یا لغوشده را انتخاب کنید.",
        ),
        `invoice-order-missing-${encodeURIComponent(problem.order_line_id!)}-decision`,
      );
  }
  if (
    !orderProblems.length &&
    (blockers.includes("order") || blockers.includes("order_decisions"))
  )
    add(
      t(
        "Linked order needs review. Refresh or choose a compatible open order.",
        "سفارش مرتبط به بررسی نیاز دارد. آن را تازه یا سفارش باز سازگار انتخاب کنید.",
      ),
      "invoice-order",
    );
  for (const blocker of blockers)
    if (messages[blocker]) {
      const [en, fa, target] = messages[blocker];
      add(t(en, fa), target);
    }
  return groups;
}
