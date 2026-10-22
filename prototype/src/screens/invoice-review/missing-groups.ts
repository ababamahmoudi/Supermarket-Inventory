import { invoiceCheckField } from "../../invoice-checks";
import { validCost } from "../../invoice";
import type { InvoiceReadDTO } from "../../invoice-projections";
export function missingGroups(
  invoice: InvoiceReadDTO,
  t: (en: string, fa: string) => string,
  blockers: readonly string[],
  blockerLineIndexes: Readonly<
    Record<string, readonly number[] | undefined>
  > = {},
) {
  const groups: { label: string; target: string; line?: number }[] = [];
  const totals = (invoice.low_confidence_fields ?? []).filter((x) =>
    ["subtotal", "tax", "final_total"].includes(invoiceCheckField(x)),
  );
  const details = (invoice.low_confidence_fields ?? []).filter(
    (x) => !totals.includes(x),
  );
  if (details.length)
    groups.push({
      label: t(
        `Invoice details: ${details.length} highlighted fields`,
        `اطلاعات فاکتور: ${details.length} فیلد مشخص‌شده`,
      ),
      target: "invoice-details-fields",
    });
  const totalChecks =
    totals.length +
    (invoice.other_charges ?? []).reduce(
      (sum, charge) => sum + (charge.low_confidence_fields?.length ?? 0),
      0,
    );
  if (totalChecks)
    groups.push({
      label: t(
        `Totals: ${totalChecks} to check`,
        `جمع‌ها: ${totalChecks} مورد برای بررسی`,
      ),
      target: "invoice-totals",
    });
  const unconfirmed = invoice.lines.flatMap((x, i) =>
    x.review_confirmed ? [] : [i + 1],
  );
  if (unconfirmed.length)
    groups.push({
      label: t(
        `Lines: ${unconfirmed.length} not confirmed (${unconfirmed.join(", ")})`,
        `ردیف‌ها: ${unconfirmed.length} تأییدنشده (${unconfirmed.join("، ")})`,
      ),
      target: `invoice-line-${unconfirmed[0] - 1}-detail`,
      line: unconfirmed[0] - 1,
    });
  invoice.lines.forEach((line, index) => {
    if (line.product_code === "NEW" && !line.pricing_category)
      groups.push({
        label: t(
          `Line ${index + 1}: choose a pricing category`,
          `ردیف ${index + 1}: دسته قیمت‌گذاری را انتخاب کنید`,
        ),
        target: `invoice-line-${index}-category`,
        line: index,
      });
  });
  if (blockers.includes("date"))
    invoice.lines.forEach((line, index) => {
      if (
        line.date_tracking &&
        !/^\d{4}-\d{2}-\d{2}$/.test(line.date_value ?? "")
      )
        groups.push({
          label: t(
            `Line ${index + 1}: enter the tracked date`,
            `ردیف ${index + 1}: تاریخ پیگیری را وارد کنید`,
          ),
          target: `invoice-line-${index}-date`,
          line: index,
        });
    });
  const known = new Set([
    "checks",
    "review",
    ...(groups.some((x) => /enter the tracked date|تاریخ پیگیری/.test(x.label))
      ? ["date"]
      : []),
  ]);
  for (const blocker of blockers) {
    if (known.has(blocker)) continue;
    const copy: Record<string, [string, string]> = {
      date: [
        "Lines: enter the tracked date",
        "ردیف‌ها: تاریخ پیگیری را وارد کنید",
      ],
      matching: [
        "Lines: match the product or enter an English name",
        "ردیف‌ها: کالا را وصل کنید یا نام انگلیسی وارد کنید",
      ],
      cost: [
        "Lines: check quantity, category and cost",
        "ردیف‌ها: تعداد، دسته و هزینه را بررسی کنید",
      ],
      quantity: [
        "Lines: check the invoiced and delivered quantities",
        "ردیف‌ها: تعداد فاکتورشده و تحویل‌شده را بررسی کنید",
      ],
      permission: [
        "Check your receiving permission",
        "دسترسی دریافت را بررسی کنید",
      ],
      company: [
        "Choose records from this company",
        "رکوردهای این شرکت را انتخاب کنید",
      ],
      branch: ["Choose the invoice location", "مکان فاکتور را انتخاب کنید"],
      supplier: [
        "Invoice details: choose a supplier",
        "اطلاعات فاکتور: تأمین‌کننده را انتخاب کنید",
      ],
      header: [
        "Invoice details: complete the number, date and receiver",
        "اطلاعات فاکتور: شماره، تاریخ و دریافت‌کننده را کامل کنید",
      ],
      money: ["Totals: check the amounts", "جمع‌ها: مبلغ‌ها را بررسی کنید"],
      file: ["Attach the original invoice", "اصل فاکتور را پیوست کنید"],
      lines: ["Add at least one line", "حداقل یک ردیف اضافه کنید"],
      payment_terms: [
        "Invoice details: check payment terms",
        "اطلاعات فاکتور: شرایط پرداخت را بررسی کنید",
      ],
      lower_price: [
        "Answer the lower-price question",
        "به سؤال کاهش هزینه پاسخ دهید",
      ],
      order: ["Review the linked order", "سفارش مرتبط را بررسی کنید"],
      order_decisions: [
        "Review the order differences",
        "اختلاف‌های سفارش را بررسی کنید",
      ],
      manual_price: [
        "Choose the manual-price decision",
        "تصمیم قیمت دستی را انتخاب کنید",
      ],
      barcode: ["Correct the duplicate barcode", "بارکد تکراری را اصلاح کنید"],
    };
    const affectedLine = blockerLineIndexes[blocker]?.[0];
    const lineBlocker = [
      "matching",
      "cost",
      "quantity",
      "manual_price",
      "barcode",
      "date",
    ].includes(blocker);
    const affected = invoice.lines[affectedLine ?? 0];
    const targetField =
      blocker === "cost" &&
      affected?.quantity_unit === "cases" &&
      affected.sold_by !== "weight" &&
      !validCost(affected.case_cost_before_tax ?? "")
        ? "case-cost"
        : (
            {
              matching: "matching",
              cost: "cost",
              quantity: "invoiced",
              manual_price: "manual",
              barcode: "barcode",
              date: "date",
            } as Record<string, string>
          )[blocker];
    if (copy[blocker])
      groups.push({
        label: t(...copy[blocker]),
        line: lineBlocker ? (affectedLine ?? 0) : undefined,
        target: lineBlocker
          ? `invoice-line-${affectedLine ?? 0}-${targetField}`
          : blocker === "file"
            ? "invoice-original-field"
            : blocker === "money"
              ? "invoice-totals"
              : blocker.startsWith("order")
                ? "invoice-order-review"
                : blocker === "lower_price"
                  ? "invoice-lower-answer"
                  : "invoice-details-fields",
      });
  }
  return groups;
}
