import type { ReactNode } from "react";
import Decimal from "decimal.js";
import { useDemo } from "../store";
import { branchLabel } from "../settings";
import { invoiceContentVersions } from "../invoice-version";
import {
  acceptedInvoiceUnits,
  lineShort,
  lineRefused,
  shortTotals,
  refusedTotals,
} from "../invoice";
import { effectiveInvoiceLocation } from "../received";
import { DateText, LtrText, Money, ProductName } from "../presentation";
import { Badge, Button, Card, DataTable } from "../ui";
import type { DemoInvoice, InvoiceLine } from "../types";
import "./invoice-document-c4.css";

export function InvoiceQuantity({ line }: { line: InvoiceLine }) {
  const { t, tCount } = useDemo();
  if (line.sold_by === "weight")
    return (
      <>
        {line.quantity_unit === "cases" && (
          <>
            <LtrText>{line.quantity_entered}</LtrText> {t("cases", "کارتن")}{" "}
            ·{" "}
          </>
        )}
        <LtrText>
          {line.source_quantity} {line.source_quantity_unit}
        </LtrText>
        {line.case_weight && line.case_weight_unit && (
          <p className="muted">
            {t("Case of", "کارتنِ")}{" "}
            <LtrText>
              {line.case_weight} {line.case_weight_unit}
            </LtrText>
          </p>
        )}
      </>
    );
  if ((line.units_per_case ?? 1) > 1)
    return (
      <>
        <LtrText>
          {new Decimal(line.qty_invoiced)
            .div(line.units_per_case!)
            .toDecimalPlaces(4)
            .toString()}
        </LtrText>{" "}
        {t("cases", "کارتن")}{" "}
        <span className="muted">
          (<LtrText>{line.qty_invoiced}</LtrText> {t("units", "واحد")})
        </span>
      </>
    );
  return (
    <LtrText>
      {tCount(
        "{{count}} unit",
        "{{count}} units",
        "{{count}} واحد",
        "{{count}} واحد",
        line.qty_invoiced,
      )}
    </LtrText>
  );
}

export function PostedInvoice({
  original,
  invoice,
  versionId,
  onCorrect,
  onMove,
  children,
}: {
  original: DemoInvoice;
  invoice: DemoInvoice;
  versionId: string;
  onCorrect?: () => void;
  onMove?: () => void;
  children?: ReactNode;
}) {
  const { state, role, lang, t } = useDemo();
  const versions = invoiceContentVersions(state, original);
  const current = versions.at(-1)!.version_id === versionId;
  const location = effectiveInvoiceLocation(state, original);
  const shorts = shortTotals(invoice);
  const refused = refusedTotals(invoice);
  return (
    <>
      <Card
        title={invoice.supplier_invoice_number}
        className="posted-invoice-document"
      >
        <div className="inline-actions">
          <Badge tone="approved">
            {versions.length > 1
              ? t("Corrected", "اصلاح‌شده")
              : t("Posted", "ثبت‌شده")}
          </Badge>
          {role === "supervisor" && current && (
            <div className="actions">
              <Button onClick={onCorrect}>
                {t("Correct invoice", "اصلاح فاکتور")}
              </Button>
              <Button variant="secondary" onClick={onMove}>
                {t("Move invoice", "انتقال فاکتور")}
              </Button>
            </div>
          )}
        </div>
        <dl className="posted-invoice-header">
          <div>
            <dt>{t("Supplier", "تأمین‌کننده")}</dt>
            <dd>
              <LtrText>{invoice.supplier}</LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Invoice number", "شماره فاکتور")}</dt>
            <dd>
              <LtrText>{invoice.supplier_invoice_number}</LtrText>
              {invoice.number_is_system_assigned && (
                <> · {t("System assigned", "اختصاص‌یافته توسط سیستم")}</>
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Location", "مکان")}</dt>
            <dd>{branchLabel(state.config, location, lang)}</dd>
          </div>
          <div>
            <dt>{t("Invoice date", "تاریخ فاکتور")}</dt>
            <dd>
              <DateText value={invoice.invoice_date} />
            </dd>
          </div>
          <div>
            <dt>{t("Received at", "زمان دریافت")}</dt>
            <dd>
              <LtrText>
                {invoice.received_at
                  ? `${invoice.received_at.slice(0, 10)} ${invoice.received_at.slice(11, 16)}`
                  : "—"}
              </LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Received by", "دریافت‌کننده")}</dt>
            <dd>{invoice.receiving_employee ?? "—"}</dd>
          </div>
          <div>
            <dt>{t("Payment terms", "شرایط پرداخت")}</dt>
            <dd>{invoice.payment_terms || "—"}</dd>
          </div>
          <div>
            <dt>{t("Due date", "سررسید")}</dt>
            <dd>
              <DateText value={invoice.due_date} />
            </dd>
          </div>
          {invoice.ship_to && (
            <div>
              <dt>{t("Ship to", "نشانی تحویل")}</dt>
              <dd>{invoice.ship_to}</dd>
            </div>
          )}
        </dl>
        <DataTable
          className="posted-invoice-lines"
          columns={[
            { width: "35%" },
            { width: "20%", align: "end" },
            { width: "16%", align: "end" },
            { width: "14%", align: "end" },
            { width: "15%" },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Product", "کالا")}</th>
              <th>{t("Quantity", "تعداد")}</th>
              <th>
                {t("Unit cost before tax", "هزینه هر واحد پیش از مالیات")}
              </th>
              <th>{t("Line total", "جمع ردیف")}</th>
              <th>{t("Tracked date", "تاریخ پیگیری‌شده")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => {
              const product = state.products.find(
                (product) =>
                  product.company_id === invoice.company_id &&
                  product.code === line.product_code,
              );
              const short = lineShort(line);
              const refusedLine = lineRefused(line);
              return (
                <tr key={index} data-posted-line={index}>
                  <td>
                    <ProductName
                      product={{
                        name_en:
                          line.description ||
                          product?.name_en ||
                          line.new_name_en ||
                          line.product_code,
                        name_fa: line.new_name_fa || product?.name_fa || "",
                      }}
                      language={lang}
                    />
                    <p className="muted">
                      <LtrText>{line.product_code}</LtrText>
                      {line.supplier_item_code && (
                        <>
                          {" "}
                          · <LtrText>{line.supplier_item_code}</LtrText>
                        </>
                      )}
                    </p>
                    <div className="posted-invoice-line-decisions">
                      {short.quantity > 0 && (
                        <span>
                          {t("Short", "کسری")}:{" "}
                          <LtrText>{short.quantity}</LtrText> ·{" "}
                          <Money value={short.total} />
                        </span>
                      )}
                      {line.extra_delivery_decision && (
                        <span>
                          {line.extra_delivery_decision === "keep"
                            ? t(
                                "Keep it (we pay for it)",
                                "نگه می‌داریم (هزینه را می‌پردازیم)",
                              )
                            : t(
                                "Refused / sent back with the driver",
                                "رد شد / با راننده برگشت",
                              )}
                          {refusedLine.quantity > 0 && (
                            <>
                              {" "}
                              · <LtrText>{refusedLine.quantity}</LtrText> ·{" "}
                              <Money value={refusedLine.total} />
                            </>
                          )}
                        </span>
                      )}
                      {line.short_dated && (
                        <Badge tone="pending">
                          {t(
                            "Short-dated (expiry discount)",
                            "نزدیک انقضا (تخفیف انقضا)",
                          )}
                        </Badge>
                      )}
                      {line.manual_price_decision && (
                        <span>
                          {line.manual_price_decision === "keep"
                            ? t("Keep manual price", "حفظ قیمت دستی")
                            : t("Use rule price", "استفاده از قیمت قاعده")}
                        </span>
                      )}
                      {line.order_price_decision === "accept" && (
                        <span>{t("Accept new cost", "پذیرش هزینه جدید")}</span>
                      )}
                    </div>
                  </td>
                  <td className="numeric">
                    <InvoiceQuantity line={line} />
                    <p className="muted">
                      {t("Delivered quantity", "تعداد تحویل‌شده")}:{" "}
                      <LtrText>
                        {line.sold_by === "weight"
                          ? `${line.source_received_quantity} ${line.source_quantity_unit}`
                          : acceptedInvoiceUnits(line)}
                      </LtrText>
                    </p>
                  </td>
                  <td className="numeric">
                    <Money
                      value={
                        line.sold_by === "weight"
                          ? (line.source_cost_before_tax ??
                            line.unit_cost_before_tax)
                          : line.unit_cost_before_tax
                      }
                      decimals={4}
                    />
                    {line.sold_by === "weight" && (
                      <LtrText>/{line.source_cost_unit ?? "lb"}</LtrText>
                    )}
                  </td>
                  <td className="numeric">
                    <Money value={line.line_total} />
                  </td>
                  <td>
                    {line.date_tracking && line.date_value ? (
                      <>
                        <span>
                          {line.date_type === "best_before"
                            ? t("Best before", "بهترین زمان مصرف")
                            : t("Expiry", "انقضا")}
                        </span>
                        <p>
                          <DateText value={line.date_value} />
                        </p>
                        {line.lot_number && (
                          <p className="muted">
                            <LtrText>{line.lot_number}</LtrText>
                          </p>
                        )}
                      </>
                    ) : (
                      t("No", "خیر")
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        <dl className="posted-invoice-totals">
          <div>
            <dt>{t("Subtotal", "جمع پیش از مالیات")}</dt>
            <dd>
              <Money value={invoice.subtotal} />
            </dd>
          </div>
          <div>
            <dt>{t("Tax", "مالیات")}</dt>
            <dd>
              <Money value={invoice.tax} />
            </dd>
          </div>
          <div>
            <dt>{t("Invoice total", "جمع فاکتور")}</dt>
            <dd>
              <Money value={invoice.final_total} />
            </dd>
          </div>
          <div>
            <dt>{t("Deductions", "کسورات")}</dt>
            <dd>
              <Money
                value={new Decimal(shorts.total)
                  .plus(refused.total)
                  .negated()
                  .toFixed(2)}
              />
            </dd>
          </div>
          <div>
            <dt>{t("Payable", "قابل پرداخت")}</dt>
            <dd>
              <Money
                value={new Decimal(invoice.final_total)
                  .minus(shorts.total)
                  .minus(refused.total)
                  .toFixed(2)}
              />
            </dd>
          </div>
        </dl>
        {invoice.order_missing_decisions &&
          Object.keys(invoice.order_missing_decisions).length > 0 && (
            <p className="muted">
              {t("Missing item decisions", "تصمیم کالاهای تحویل‌نشده")}:{" "}
              {Object.entries(invoice.order_missing_decisions).map(
                ([id, decision]) => (
                  <span key={id}>
                    <LtrText>{id}</LtrText> ·{" "}
                    {decision === "short"
                      ? t("Short", "کسری")
                      : decision === "back_ordered"
                        ? t("Back-ordered", "در انتظار تحویل بعدی")
                        : t("Cancelled", "لغوشده")}{" "}
                  </span>
                ),
              )}
            </p>
          )}
        {versions.length > 1 && (
          <div className="posted-invoice-versions">
            {versions.map((version, index) => (
              <a
                key={version.version_id}
                className="button button-secondary"
                href={`#invoices?id=${encodeURIComponent(original.id)}&version=${encodeURIComponent(version.version_id)}`}
              >
                {index === 0
                  ? t("Original invoice", "اصل فاکتور")
                  : t("Correction", "اصلاح")}{" "}
                {index > 0 && <LtrText>{index}</LtrText>}
              </a>
            ))}
          </div>
        )}
      </Card>
      {children}
    </>
  );
}
