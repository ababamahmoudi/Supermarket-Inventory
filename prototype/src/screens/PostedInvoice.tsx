import { companyTimestampText } from "../company-time";
import type { ReactNode } from "react";
import Decimal from "decimal.js";
import {
  ImportedReadingNote,
  InvoiceOtherCharges,
} from "../InvoiceReadingReview";
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
import {
  CasesAndUnits,
  QuantityText,
  DateText,
  demoUserLabel,
  LtrText,
  Money,
  ProductName,
} from "../presentation";
import { Badge, Button, Card, DataTable } from "../ui";
import type {
  InvoiceReadDTO,
  InvoicePurchaseReadDTO,
} from "../invoice-projections";
import type { InvoiceEditableLine } from "../invoice-edit-types";
import { useProtectedQuery } from "../use-protected-query";
import {
  requireInvoiceAuthority,
  canInvoiceAuthority,
} from "../invoice-authority";
import "./invoice-document-c4.css";
import "./invoices-c7.css";

export function InvoiceQuantity({ line }: { line: InvoiceEditableLine }) {
  const { lang, t, tCount } = useDemo();
  if (line.sold_by === "weight")
    return (
      <>
        {line.quantity_unit === "cases" && (
          <>
            <LtrText>{line.quantity_entered}</LtrText>{" "}
            {t(
              new Decimal(line.quantity_entered || 0).eq(1) ? "case" : "cases",
              "کارتن",
            )}{" "}
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
  if ((line.units_per_case ?? 1) > 1) {
    return (
      <>
        <CasesAndUnits
          units={line.qty_invoiced}
          unitsPerCase={line.units_per_case!}
          language={lang}
        />{" "}
        <span className="muted">
          (
          <QuantityText
            value={line.qty_invoiced}
            unit="units"
            language={lang}
          />
          )
        </span>
      </>
    );
  }
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
  original: InvoiceReadDTO;
  invoice: InvoicePurchaseReadDTO;
  versionId: string;
  onCorrect?: () => void;
  onMove?: () => void;
  children?: ReactNode;
}) {
  const { state, actor, can, lang, t } = useDemo();
  const scope = {
    company_id: original.company_id,
    kind: "company_shared" as const,
    entity_id: original.id,
  };
  const read = useProtectedQuery(
    "invoices.cost_read",
    scope,
    (canonical, currentActor) => {
      requireInvoiceAuthority(
        canonical,
        currentActor,
        "invoices.cost_read",
        original.id,
      );
      const record =
        original.id === canonical.invoice.id
          ? canonical.invoice
          : canonical.invoices?.find((row) => row.id === original.id);
      if (!record) throw new Error("Invoice was not found.");
      const versions = invoiceContentVersions(canonical, record);
      return {
        currentId: versions.at(-1)!.version_id,
        versions: canInvoiceAuthority(
          canonical,
          currentActor,
          "invoices.correct",
          original.id,
        )
          ? versions.map((version) => ({ version_id: version.version_id }))
          : [],
      };
    },
    original.id,
  );
  const versions = read.data?.versions ?? [];
  const current = read.data?.currentId === versionId;
  if (!actor || !can("invoices.cost_read", scope)) return null;
  const location = effectiveInvoiceLocation(state, original);
  const shorts = shortTotals(invoice);
  const refused = refusedTotals(invoice);
  return (
    <>
      <Card className="posted-invoice-document">
        <ImportedReadingNote invoice={invoice} />
        <div className="posted-invoice-title-row">
          <div className="posted-invoice-title">
            <h2>
              <LtrText>{invoice.supplier_invoice_number}</LtrText>
            </h2>
            <Badge tone="approved">
              {versions.length > 1
                ? t("Corrected", "اصلاح‌شده")
                : t("Posted", "ثبت‌شده")}
            </Badge>
          </div>
          {current &&
            (can("invoices.correct", scope) ||
              can("invoices.relocate", scope)) && (
              <div className="actions">
                {can("invoices.correct", scope) && (
                  <Button onClick={onCorrect}>
                    {t("Correct invoice", "اصلاح فاکتور")}
                  </Button>
                )}
                {can("invoices.relocate", scope) && (
                  <Button variant="neutral" onClick={onMove}>
                    {t("Move invoice", "انتقال فاکتور")}
                  </Button>
                )}
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
                {companyTimestampText(state.config, invoice.received_at)}
              </LtrText>
            </dd>
          </div>
          <div>
            <dt>{t("Received by", "دریافت‌کننده")}</dt>
            <dd>
              {invoice.receiving_employee
                ? demoUserLabel(invoice.receiving_employee, lang)
                : "—"}
            </dd>
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
          {invoice.order_reference && (
            <div>
              <dt>{t("Order reference", "مرجع سفارش")}</dt>
              <dd>{invoice.order_reference}</dd>
            </div>
          )}
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
                    {line.handwritten_note && <p>{line.handwritten_note}</p>}
                    {line.expiry_as_printed && (
                      <p className="muted">{line.expiry_as_printed}</p>
                    )}
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
                    {(short.quantity > 0 || refusedLine.quantity > 0) && (
                      <p className="muted">
                        {t("Received", "دریافت‌شده")}:{" "}
                        <LtrText>
                          {line.sold_by === "weight"
                            ? `${line.source_received_quantity} ${line.source_quantity_unit}`
                            : acceptedInvoiceUnits(line)}
                        </LtrText>
                      </p>
                    )}
                  </td>
                  <td className="numeric">
                    <LtrText>
                      <Money
                        value={
                          line.sold_by === "weight"
                            ? (line.source_cost_before_tax ??
                              line.unit_cost_before_tax)
                            : line.unit_cost_before_tax
                        }
                      />
                      {line.sold_by === "weight" &&
                        `/${line.source_cost_unit ?? "lb"}`}
                    </LtrText>
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
                      <span className="value-empty">
                        {t("Not tracked", "پیگیری نمی‌شود")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        <InvoiceOtherCharges invoice={invoice} />
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
          <div className="posted-invoice-payable">
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
              <Button key={version.version_id} asChild variant="neutral">
                <a
                  href={`#invoices?id=${encodeURIComponent(original.id)}&version=${encodeURIComponent(version.version_id)}`}
                >
                  {index === 0
                    ? t("Original invoice", "اصل فاکتور")
                    : t("Correction", "اصلاح")}{" "}
                  {index > 0 && <LtrText>{index}</LtrText>}
                </a>
              </Button>
            ))}
          </div>
        )}
      </Card>
      {children}
    </>
  );
}
