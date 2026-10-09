import Decimal from "decimal.js";
import { useState } from "react";
import { useDemo } from "../store";
import {
  compatibleInvoiceOrders,
  currentInvoiceOrderComparison,
  invoiceReviewerAllowed,
  linkedInvoiceOrder,
  setInvoiceExtraDecision,
  setInvoiceOrder,
  setInvoiceNewItemMatch,
} from "../invoice-orders";
import { orderError } from "../c-orders-i18n";
import { previousReceiptCost } from "../invoice";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateField,
  Field,
  SegmentedControl,
  Select,
} from "../ui";
import { LtrText, Money, ProductName } from "../presentation";
import type { DemoState } from "../types";
import "./invoice-orders.css";

export function InvoiceOrderReview() {
  const { state, update, role, branch, user, lang, t } = useDemo();
  const [matchErrors, setMatchErrors] = useState<Record<string, string>>({});
  const invoice = state.invoice;
  const origin = user?.branch ?? branch;
  if (!role || !invoiceReviewerAllowed(state, invoice, role, origin))
    return null;
  const locked = invoice.status === "posted";
  const choices = compatibleInvoiceOrders(state, role, origin);
  const order = linkedInvoiceOrder(state);
  const comparison = currentInvoiceOrderComparison(state);
  const stale =
    !locked && order && order.version !== invoice.order_review_version;
  const mutate = (action: (draft: DemoState) => void) =>
    update((draft) => {
      if (
        !invoiceReviewerAllowed(draft, draft.invoice, role, origin) ||
        draft.invoice.status === "posted"
      )
        throw new Error(
          "Review an invoice in your allowed receiving location.",
        );
      action(draft);
    });
  if (locked && !comparison) return null;
  return (
    <Card
      title={t("Compare with order", "مقایسه با سفارش")}
      className="invoice-order-card"
    >
      {!locked && (
        <Field
          label={t("Order (optional)", "سفارش (اختیاری)")}
          hint={t(
            "Choose an open order for this supplier and receiving location.",
            "سفارش باز همین تأمین‌کننده و مکان دریافت را انتخاب کنید.",
          )}
        >
          <Select
            value={invoice.order_id ?? ""}
            onChange={(value) =>
              mutate((draft) => setInvoiceOrder(draft, role, origin, value))
            }
            options={[
              { value: "", label: t("No linked order", "بدون سفارش مرتبط") },
              ...choices.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.reference} · ${candidate.date}`,
              })),
              ...(order &&
              !choices.some((candidate) => candidate.id === order.id)
                ? [{ value: order.id, label: order.reference, disabled: true }]
                : []),
            ]}
          />
        </Field>
      )}
      {order && (
        <p>
          <LtrText>{order.reference}</LtrText> ·{" "}
          <LtrText>{order.supplier}</LtrText>
        </p>
      )}
      {order?.lines.some((line) => line.new_item) && (
        <div className="invoice-new-item-matches">
          {order.lines
            .filter((line) => line.new_item)
            .map((temporary) => {
              const matchedIndex = invoice.lines.findIndex(
                (line) =>
                  line.order_new_item_match?.order_line_id === temporary.id ||
                  line.order_item_id === temporary.id,
              );
              const actual =
                matchedIndex >= 0 ? invoice.lines[matchedIndex] : undefined;
              return (
                <div key={temporary.id} className="invoice-new-item-match">
                  <div className="invoice-new-item-name">
                    <strong>
                      <bdi dir="auto">
                        {lang === "fa"
                          ? temporary.name_fa || temporary.name_en
                          : temporary.name_en}
                      </bdi>
                    </strong>
                    <Badge tone="info">{t("New item", "کالای جدید")}</Badge>
                  </div>
                  {!locked && !temporary.new_item_association ? (
                    <Field
                      label={`${t("Match invoice line", "تطبیق ردیف فاکتور")} — ${temporary.name_en}`}
                      error={
                        matchErrors[temporary.id]
                          ? orderError(new Error(matchErrors[temporary.id]), t)
                          : undefined
                      }
                      hint={t(
                        "Choose the actual product in the invoice. Supplier items are added only after posting.",
                        "کالای واقعی در فاکتور را انتخاب کنید. کالاهای تأمین‌کننده فقط پس از ثبت فاکتور اضافه می‌شوند.",
                      )}
                    >
                      <Select
                        value={matchedIndex < 0 ? "" : String(matchedIndex)}
                        disabled={!!stale}
                        onChange={(value) => {
                          setMatchErrors((current) => ({
                            ...current,
                            [temporary.id]: "",
                          }));
                          try {
                            mutate((draft) =>
                              setInvoiceNewItemMatch(
                                draft,
                                role,
                                origin,
                                temporary.id,
                                value === "" ? null : Number(value),
                              ),
                            );
                          } catch (cause) {
                            setMatchErrors((current) => ({
                              ...current,
                              [temporary.id]:
                                cause instanceof Error
                                  ? cause.message
                                  : "match",
                            }));
                          }
                        }}
                        options={[
                          {
                            value: "",
                            label: t(
                              "Choose invoice line",
                              "انتخاب ردیف فاکتور",
                            ),
                          },
                          ...invoice.lines
                            .map((line, index) => ({ line, index }))
                            .filter(
                              ({ line }) =>
                                (!line.order_item_id ||
                                  line.order_item_id === temporary.id) &&
                                (line.product_code !== "NEW" ||
                                  !!line.new_name_en?.trim()),
                            )
                            .map(({ line, index }) => {
                              const product = state.products.find(
                                (item) =>
                                  item.company_id === invoice.company_id &&
                                  item.code === line.product_code,
                              );
                              const name =
                                lang === "fa"
                                  ? product?.name_fa ||
                                    line.new_name_fa ||
                                    product?.name_en ||
                                    line.new_name_en ||
                                    line.description
                                  : product?.name_en ||
                                    line.new_name_en ||
                                    line.description;
                              return {
                                value: String(index),
                                label: `${index + 1} · ${name}${line.supplier_item_code ? ` · ${line.supplier_item_code}` : ""}`,
                              };
                            }),
                        ]}
                      />
                    </Field>
                  ) : (
                    <p className="muted">
                      {actual ? (
                        <ProductName
                          product={{
                            name_en:
                              state.products.find(
                                (product) =>
                                  product.code === actual.product_code &&
                                  product.company_id === invoice.company_id,
                              )?.name_en ??
                              actual.new_name_en ??
                              actual.description,
                            name_fa:
                              state.products.find(
                                (product) =>
                                  product.code === actual.product_code &&
                                  product.company_id === invoice.company_id,
                              )?.name_fa ??
                              actual.new_name_fa ??
                              "",
                          }}
                          language={lang}
                        />
                      ) : (
                        t("Not delivered", "تحویل نشده")
                      )}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      )}
      {stale && (
        <div className="banner danger">
          <p>
            {t(
              "The order changed. Refresh the comparison and review each difference again.",
              "سفارش تغییر کرده است. مقایسه را تازه کنید و اختلاف‌ها را دوباره بررسی کنید.",
            )}
          </p>
          <Button
            variant="secondary"
            disabled={!choices.some((candidate) => candidate.id === order.id)}
            onClick={() =>
              mutate((draft) => setInvoiceOrder(draft, role, origin, order.id))
            }
          >
            {t("Refresh comparison", "تازه‌سازی مقایسه")}
          </Button>
        </div>
      )}
      {comparison && (
        <DataTable
          className="invoice-order-table"
          columns={[
            { width: "30%" },
            { width: 140, align: "end" },
            { width: 140, align: "end" },
            { width: "40%" },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Product", "کالا")}</th>
              <th>
                {t("Ordered units remaining", "واحدهای باقی‌مانده سفارش")}
              </th>
              <th>{t("Delivered units", "واحدهای تحویل‌شده")}</th>
              <th>{t("Decision", "تصمیم")}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.lines.map((row) => {
              const line = invoice.lines[row.invoice_line_index];
              const product = state.products.find(
                (item) =>
                  item.company_id === invoice.company_id &&
                  item.code === line.product_code,
              );
              const previous = previousReceiptCost(
                state,
                line.product_code,
                line,
              );
              const lower =
                previous &&
                /^\d+(?:\.\d{1,4})?$/.test(line.unit_cost_before_tax) &&
                new Decimal(line.unit_cost_before_tax).lt(previous.cost);
              return (
                <tr
                  key={`invoice:${row.invoice_line_index}`}
                  data-invoice-line={row.invoice_line_index}
                >
                  <td>
                    <ProductName
                      product={{
                        name_en:
                          product?.name_en ??
                          line.new_name_en ??
                          line.description,
                        name_fa: product?.name_fa ?? line.new_name_fa ?? "",
                      }}
                      language={lang}
                    />
                    <small className="muted">
                      <LtrText>{line.supplier_item_code ?? ""}</LtrText>
                    </small>
                  </td>
                  <td className="numeric">
                    <LtrText>
                      {row.expected_remaining_units}
                      {line.source_quantity_unit ? " lb" : ""}
                    </LtrText>
                  </td>
                  <td className="numeric">
                    <LtrText>
                      {row.delivered_units}
                      {line.source_quantity_unit ? " lb" : ""}
                    </LtrText>
                  </td>
                  <td>
                    <div className="invoice-order-decisions">
                      {!row.extra_units &&
                        !row.short_units &&
                        !row.price_changed && (
                          <Badge tone="approved">{t("OK", "درست")}</Badge>
                        )}
                      {row.short_units > 0 && (
                        <Badge tone="danger">
                          {t("Short", "کسری")}:{" "}
                          <LtrText>{row.short_units}</LtrText>
                        </Badge>
                      )}
                      {row.extra_units > 0 && (
                        <>
                          <Badge tone="pending">
                            {t("Extra delivered", "تحویل اضافه")}:{" "}
                            <LtrText>{row.extra_units}</LtrText>
                          </Badge>
                          <SegmentedControl
                            aria-label={t(
                              "Extra delivered decision",
                              "تصمیم تحویل اضافه",
                            )}
                            value={line.extra_delivery_decision ?? ""}
                            onChange={(value) =>
                              mutate((draft) =>
                                setInvoiceExtraDecision(
                                  draft,
                                  role,
                                  origin,
                                  row.invoice_line_index,
                                  value as "keep" | "refuse",
                                ),
                              )
                            }
                            options={[
                              {
                                value: "keep",
                                label: t(
                                  "Keep it (we pay for it)",
                                  "نگه می‌داریم (هزینه را می‌پردازیم)",
                                ),
                                disabled: locked || !!stale,
                              },
                              {
                                value: "refuse",
                                label: t(
                                  "Refused / sent back with the driver",
                                  "رد شد / با راننده برگشت",
                                ),
                                disabled: locked || !!stale,
                              },
                            ]}
                          />
                        </>
                      )}
                      {row.price_changed && (
                        <>
                          <Badge tone="pending">
                            {t("Unit cost changed", "هزینه واحد تغییر کرد")}
                          </Badge>
                          <p className="invoice-order-costs">
                            {t(
                              "Unit cost before tax",
                              "هزینه هر واحد پیش از مالیات",
                            )}
                            :{" "}
                            <Money
                              value={row.previous_unit_cost ?? "0"}
                              currency={state.config.company.currency}
                              decimals={2}
                            />{" "}
                            →{" "}
                            <Money
                              value={row.new_unit_cost}
                              currency={state.config.company.currency}
                              decimals={2}
                            />
                          </p>
                          <p className="invoice-order-costs">
                            {t(
                              "Case cost before tax",
                              "هزینه کارتن پیش از مالیات",
                            )}
                            :{" "}
                            <Money
                              value={row.previous_case_cost ?? "0"}
                              currency={state.config.company.currency}
                              decimals={2}
                            />{" "}
                            →{" "}
                            <Money
                              value={row.new_case_cost}
                              currency={state.config.company.currency}
                              decimals={2}
                            />
                          </p>
                          {row.accepted_units > 0 && (
                            <SegmentedControl
                              aria-label={t(
                                "Changed cost decision",
                                "تصمیم هزینه تغییرکرده",
                              )}
                              value={line.order_price_decision ?? ""}
                              onChange={(value) =>
                                mutate((draft) => {
                                  const item =
                                    draft.invoice.lines[row.invoice_line_index];
                                  item.order_price_decision = value as
                                    "accept" | "short_dated";
                                  item.short_dated = value === "short_dated";
                                  item.review_confirmed = false;
                                  if (item.short_dated) {
                                    item.date_tracking = true;
                                    item.date_confirmed = true;
                                    item.date_type = "expiry";
                                  }
                                })
                              }
                              options={[
                                {
                                  value: "accept",
                                  label: t(
                                    "Accept new cost",
                                    "پذیرش هزینه جدید",
                                  ),
                                  disabled: locked || !!stale,
                                },
                                ...(lower
                                  ? [
                                      {
                                        value: "short_dated",
                                        label: t(
                                          "Short-dated (expiry discount)",
                                          "نزدیک انقضا (تخفیف انقضا)",
                                        ),
                                        disabled: locked || !!stale,
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          )}
                          {line.short_dated && (
                            <Field label={t("Expiry date", "تاریخ انقضا")}>
                              <DateField
                                value={line.date_value ?? ""}
                                disabled={locked || !!stale}
                                onChange={(value) =>
                                  mutate((draft) => {
                                    const item =
                                      draft.invoice.lines[
                                        row.invoice_line_index
                                      ];
                                    item.date_value = value;
                                    item.date_confirmed = true;
                                    item.review_confirmed = false;
                                  })
                                }
                              />
                            </Field>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {comparison.residual.map((row) => {
              const line = order?.lines.find(
                (item) => item.id === row.order_line_id,
              );
              if (!line) return null;
              return (
                <tr
                  key={`missing:${row.order_line_id}`}
                  data-order-line={row.order_line_id}
                >
                  <td>
                    <ProductName product={line} language={lang} />
                  </td>
                  <td className="numeric">
                    <LtrText>{row.missing_units}</LtrText>
                    {row.missing_units === null && (
                      <span>
                        <LtrText>{row.missing_cases}</LtrText>{" "}
                        {t("Cases", "کارتن")}
                      </span>
                    )}
                  </td>
                  <td className="numeric">
                    <LtrText>0</LtrText>
                  </td>
                  <td>
                    <div className="invoice-order-decisions">
                      <Badge tone="danger">
                        {row.absent
                          ? t("Not delivered", "تحویل نشده")
                          : t("Short", "کسری")}
                      </Badge>
                      <SegmentedControl
                        aria-label={t(
                          "Missing item decision",
                          "تصمیم کالای تحویل‌نشده",
                        )}
                        value={
                          invoice.order_missing_decisions?.[
                            row.order_line_id
                          ] ?? ""
                        }
                        onChange={(value) =>
                          mutate((draft) => {
                            draft.invoice.order_missing_decisions ??= {};
                            draft.invoice.order_missing_decisions[
                              row.order_line_id
                            ] = value as "short" | "back_ordered" | "cancelled";
                          })
                        }
                        options={[
                          {
                            value: "short",
                            label: t("Short", "کسری"),
                            disabled: locked || !!stale,
                          },
                          {
                            value: "back_ordered",
                            label: t("Back-ordered", "در انتظار تحویل بعدی"),
                            disabled: locked || !!stale,
                          },
                          {
                            value: "cancelled",
                            label: t("Cancelled", "لغوشده"),
                            disabled: locked || !!stale,
                          },
                        ]}
                      />
                      <small className="muted">
                        {t(
                          "Order-only missing units do not change this invoice's payable.",
                          "واحدهای سفارش که فاکتور نشده‌اند، بدهی این فاکتور را تغییر نمی‌دهند.",
                        )}
                      </small>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}
