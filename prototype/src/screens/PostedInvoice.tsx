import {
  invoiceDisplayLineShort as lineShort,
  invoiceDisplayLineRefused as lineRefused,
  invoiceDisplayShortTotals as shortTotals,
  invoiceDisplayRefusedTotals as refusedTotals,
} from "../invoice-display-arithmetic";
import { readInvoiceReturnRoute } from "../navigation";
import { companyTimestampText } from "../company-time";
import { invoiceLineId } from "../invoice-line-links";
import { useInvoiceLineHighlight } from "./invoice-review/useInvoiceLineHighlight";
import { useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { InvoiceOtherCharges } from "../InvoiceReadingReview";
import { useDemo } from "../store";
import { branchLabel } from "../settings";
import { invoiceContentVersions } from "../invoice-version";
import { acceptedInvoiceUnits } from "../invoice";
import { effectiveInvoiceLocation } from "../received";
import {
  QuantityText,
  DateText,
  demoUserLabel,
  LtrText,
  Money,
  ProductName,
} from "../presentation";
import { Badge, Button, Card, CardHeader, Disclosure } from "../ui";
import { OriginalViewer } from "./invoice-review/OriginalViewer";
import { FitText } from "../FitText";
import { importedReadingReceived } from "../invoice-reading-dates";
import { correctHandwrittenReceivedDate } from "../invoice-received-time";
import { readingNoteCopy } from "../invoice-reading-note-copy";
import "./posted-invoice-r2b.css";
import "../weight-price.css";
import type {
  InvoiceReadDTO,
  InvoicePurchaseReadDTO,
} from "../invoice-projections";
import type { InvoiceEditableLine } from "../invoice-edit-types";
import { useProtectedQuery } from "../use-protected-query";
import { LiveReadingProvenance } from "../LiveReadingProvenance";
import {
  requireInvoiceAuthority,
  canInvoiceAuthority,
} from "../invoice-authority";
import "./invoice-document-c4.css";
import "./invoices-c7.css";
import "./invoice-review/invoice-review.css";

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
  if (line.quantity_unit === "cases") {
    return (
      <>
        <span className="receiving-quantity-primary">
          <QuantityText
            value={
              line.quantity_entered ??
              new Decimal(line.qty_invoiced)
                .div(line.units_per_case ?? 1)
                .toString()
            }
            unit="cases"
            language={lang}
          />
          {" × "}
          <LtrText>{line.units_per_case ?? 1}</LtrText>
        </span>
        <small className="muted">
          <QuantityText
            value={line.qty_invoiced}
            unit="units"
            language={lang}
          />
        </small>
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

/** Retain the source four-decimal amount and unit as complete price atoms. */
function InvoiceSourceCost({ line }: { line: InvoiceEditableLine }) {
  return (
    <LtrText className="posted-source-cost">
      <Money
        className="weight-price-main"
        decimals={4}
        fixedDecimals
        value={
          line.sold_by === "weight"
            ? (line.source_cost_before_tax ?? line.unit_cost_before_tax)
            : line.unit_cost_before_tax
        }
      />
      {line.sold_by === "weight" && (
        <>
          <wbr />
          <LtrText className="weight-price-main">
            /{line.source_cost_unit ?? "lb"}
          </LtrText>
        </>
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
  onAttachOriginal,
  children,
}: {
  original: InvoiceReadDTO;
  invoice: InvoicePurchaseReadDTO;
  versionId: string;
  onCorrect?: () => void;
  onMove?: () => void;
  onAttachOriginal?: () => void;
  children?: ReactNode;
}) {
  const { state, actor, can, command, lang, t, user, branch, navigate } =
    useDemo();
  const [originalVisible, setOriginalVisible] = useState(true);
  const [receivedPending, setReceivedPending] = useState(false);
  const [receivedError, setReceivedError] = useState("");
  useInvoiceLineHighlight(invoice.id, true);
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
  const handwritten = importedReadingReceived(state.config, {
    invoice_date: invoice.invoice_date,
    handwritten_notes: invoice.import_handwritten_notes,
  });
  const hasTrackedDates = invoice.lines.some(
    (line) => line.date_tracking && line.date_value,
  );
  const notes = invoice.import_warnings ?? [];
  async function applyHandwriting() {
    if (receivedPending) return;
    setReceivedPending(true);
    setReceivedError("");
    try {
      await command("invoices.correct", scope, (draft, currentActor) =>
        correctHandwrittenReceivedDate(
          draft,
          currentActor,
          original.id,
          invoice.received_at,
        ),
      );
    } catch {
      setReceivedError(
        t(
          "The received date could not be changed. Open the invoice again and check your permission.",
          "زمان دریافت تغییر نکرد. فاکتور را دوباره باز کنید و مجوز خود را بررسی کنید.",
        ),
      );
    } finally {
      setReceivedPending(false);
    }
  }
  return (
    <div
      className="receiving-review posted-receiving invoice-posted-workspace posted-invoice-document"
      data-invoice-status={invoice.status}
      data-invoice-id={invoice.id}
      data-can-correct={current && can("invoices.correct", scope)}
      data-can-move={current && can("invoices.relocate", scope)}
    >
      <header className="receiving-header">
        <a className="back-link" href="#invoices">
          {t("Invoices", "فاکتورها")}
        </a>
        <div className="page-header receiving-header-main posted-invoice-title-row">
          <div>
            <h1>
              {t("Invoice", "فاکتور")}{" "}
              <span className="invoice-title-reference">
                <LtrText>{invoice.supplier_invoice_number}</LtrText>
              </span>
            </h1>
            <p>
              <a
                className="entity-link"
                href={`#suppliers?name=${encodeURIComponent(invoice.supplier)}`}
              >
                {invoice.supplier}
              </a>
              {" · "}
              {branchLabel(state.config, location, lang)}
              {" · "}
              <DateText value={invoice.invoice_date ?? ""} />
              {" · "}
              <Badge tone="approved">{t("Posted", "ثبت‌شده")}</Badge>
            </p>
            {(invoice.reading_record ||
              invoice.live_reading?.phase === "complete") && (
              <small className="muted">
                {invoice.reading_record?.source === "live" ||
                invoice.live_reading?.phase === "complete"
                  ? t("Read by AI", "خوانده‌شده با هوش مصنوعی")
                  : t(
                      "Read by AI · imported file",
                      "خوانده‌شده با هوش مصنوعی · فایل واردشده",
                    )}
              </small>
            )}
            {invoice.simulated_reading && (
              <small className="muted">
                {t("Simulated reading", "خوانش شبیه‌سازی‌شده")}
              </small>
            )}
          </div>
          <div className="actions">
            {current &&
              (can("invoices.correct", scope) ||
                can("invoices.relocate", scope)) && (
                <>
                  {can("invoices.correct", scope) && (
                    <Button
                      variant="secondary"
                      data-posted-action="correct"
                      onClick={onCorrect}
                    >
                      {t("Correct invoice", "اصلاح فاکتور")}
                    </Button>
                  )}
                  {can("invoices.relocate", scope) && (
                    <Button
                      data-posted-action="move"
                      variant="secondary"
                      onClick={onMove}
                    >
                      {t("Move invoice", "انتقال فاکتور")}
                    </Button>
                  )}
                </>
              )}
            <Button
              data-posted-action="done"
              onClick={() =>
                navigate(
                  readInvoiceReturnRoute(
                    state.config.company.seed_key,
                    user?.username ?? "signed-out",
                    branch,
                    invoice.id,
                  ).slice(1),
                )
              }
            >
              {t("Done", "تمام")}
            </Button>
          </div>
        </div>
      </header>
      <div
        className={`receiving-layout${originalVisible ? "" : " is-original-hidden"}`}
      >
        <div className="receiving-work">
          <Card className="receiving-details">
            <div className="receiving-card-title">
              <h2>{t("Invoice details", "جزئیات فاکتور")}</h2>
            </div>
            <LiveReadingProvenance invoice={invoice} />
            {notes.length > 0 && (
              <Disclosure
                className="posted-reading-notes"
                summary={t(
                  `Reading notes (${notes.length})`,
                  `یادداشت‌های خوانش (${notes.length})`,
                )}
              >
                <ul>
                  {notes.map((note, index) => (
                    <li key={index}>{readingNoteCopy(note, t)}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
            <dl className="detail-grid receiving-details-grid posted-invoice-header">
              <div>
                <dt>{t("Supplier", "تأمین‌کننده")}</dt>
                <dd>
                  <LtrText>{invoice.supplier}</LtrText>
                </dd>
              </div>
              <div>
                <dt>{t("Invoice number", "شماره فاکتور")}</dt>
                <dd>
                  <FitText
                    className="posted-invoice-number"
                    value={invoice.supplier_invoice_number}
                    render={(visible) => <LtrText>{visible}</LtrText>}
                  />
                  {invoice.number_is_system_assigned && (
                    <small className="muted">
                      {t("System assigned", "اختصاص‌یافته توسط سیستم")}
                    </small>
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
              {invoice.bill_to && (
                <div>
                  <dt>{t("Bill to", "نشانی صورتحساب")}</dt>
                  <dd>{invoice.bill_to}</dd>
                </div>
              )}
              {(invoice.import_handwritten_notes?.length ?? 0) > 0 && (
                <div className="posted-handwriting">
                  <dt>
                    {t("Handwritten on the invoice", "دست‌نوشته روی فاکتور")}
                  </dt>
                  <dd>
                    <LtrText>
                      {invoice.import_handwritten_notes!.join(" · ")}
                    </LtrText>
                  </dd>
                  {handwritten.source === "handwriting" && (
                    <dd className="posted-handwriting-action">
                      {handwritten.received_at !== invoice.received_at ? (
                        <Button
                          variant="secondary"
                          disabled={
                            receivedPending ||
                            !current ||
                            !can("invoices.correct", scope)
                          }
                          onClick={() => void applyHandwriting()}
                        >
                          {t(
                            "Use as received date",
                            "استفاده به‌عنوان زمان دریافت",
                          )}
                        </Button>
                      ) : (
                        <span className="muted">
                          {t(
                            "Used as received date",
                            "به‌عنوان زمان دریافت استفاده شد",
                          )}
                        </span>
                      )}
                    </dd>
                  )}
                  {receivedError && (
                    <dd role="alert" className="form-error">
                      {receivedError}
                    </dd>
                  )}
                </div>
              )}
            </dl>
            {invoice.reading_record?.source === "imported" && (
              <Disclosure
                className="receiving-more"
                summary={t("More details", "جزئیات بیشتر")}
              >
                <div className="receiving-reading-evidence">
                  <h3>{t("Reading", "خوانش")}</h3>
                  <p className="muted">
                    {t(
                      "Read by AI · imported file",
                      "خوانده‌شده با هوش مصنوعی · فایل واردشده",
                    )}
                  </p>
                  <p>
                    {t("Models", "مدل‌ها")}:{" "}
                    <LtrText>
                      {invoice.reading_record.models.join(", ")}
                    </LtrText>
                  </p>
                </div>
              </Disclosure>
            )}
          </Card>
          <Card className="receiving-lines">
            <div className="receiving-card-title">
              <h2>{t("Invoice lines", "ردیف‌های فاکتور")}</h2>
            </div>
            <table className="receiving-table posted-invoice-lines">
              <colgroup>
                <col />
                <col style={{ width: "24%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "16%" }} />
                {hasTrackedDates && <col style={{ width: "18%" }} />}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{t("Product", "کالا")}</th>
                  <th scope="col" className="numeric">
                    {t("Quantity", "تعداد")}
                  </th>
                  <th scope="col" className="numeric">
                    {t("Unit cost", "هزینه واحد")}
                  </th>
                  <th scope="col" className="numeric">
                    {t("Line total", "جمع ردیف")}
                  </th>
                  {hasTrackedDates && (
                    <th scope="col">{t("Tracked date", "تاریخ پیگیری‌شده")}</th>
                  )}
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
                    <tr
                      key={invoiceLineId(line, index)}
                      className="invoice-line-summary"
                      data-posted-line={index}
                      data-line-id={invoiceLineId(line, index)}
                    >
                      <td className="receiving-product-cell">
                        <ProductName
                          product={{
                            name_en:
                              line.new_name_en ||
                              product?.name_en ||
                              line.description ||
                              line.product_code,
                            name_fa: line.new_name_fa || product?.name_fa || "",
                          }}
                          language={lang}
                        />
                        <p className="muted receiving-product-meta">
                          <LtrText>{line.product_code}</LtrText>
                          {line.supplier_item_code &&
                            ![
                              line.new_name_en,
                              product?.name_en,
                              line.description,
                            ].some(
                              (name) =>
                                name?.trim().toLowerCase() ===
                                line.supplier_item_code?.trim().toLowerCase(),
                            ) && (
                              <>
                                {" "}
                                · <LtrText>{line.supplier_item_code}</LtrText>
                              </>
                            )}
                        </p>
                        <small className="receiving-phone-quantity">
                          <InvoiceQuantity line={line} /> ·{" "}
                          <InvoiceSourceCost line={line} />
                        </small>
                        {line.date_tracking && line.date_value && (
                          <small className="posted-phone-tracked-date">
                            <DateText value={line.date_value} />
                          </small>
                        )}
                        {line.handwritten_note && (
                          <p>{line.handwritten_note}</p>
                        )}
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
                                  · <LtrText>
                                    {refusedLine.quantity}
                                  </LtrText> ·{" "}
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
                            <span>
                              {t("Accept new cost", "پذیرش هزینه جدید")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="numeric receiving-quantity-cell">
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
                      <td className="numeric receiving-cost-cell">
                        <InvoiceSourceCost line={line} />
                      </td>
                      <td className="numeric receiving-total-cell">
                        <Money value={line.line_total} />
                      </td>
                      {hasTrackedDates && (
                        <td className="posted-tracked-cell">
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
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {(invoice.other_charges?.length ?? 0) > 0 && (
            <Card className="posted-invoice-other-charges">
              <CardHeader
                title={t(
                  "Other charges and credits",
                  "هزینه‌ها و اعتبارهای دیگر",
                )}
              />
              <InvoiceOtherCharges invoice={invoice} showHeading={false} />
            </Card>
          )}
          <Card className="receiving-totals">
            <div className="receiving-card-title">
              <h2>{t("Totals", "جمع‌ها")}</h2>
            </div>
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
          </Card>
          {((invoice.order_missing_decisions &&
            Object.keys(invoice.order_missing_decisions).length > 0) ||
            versions.length > 1) && (
            <Card>
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
          )}
          {children}
        </div>
        <OriginalViewer
          invoice={original}
          onAttach={onAttachOriginal}
          onVisibilityChange={setOriginalVisible}
        />
      </div>
    </div>
  );
}
