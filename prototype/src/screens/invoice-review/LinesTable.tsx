import { useLayoutEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { useDemo } from "../../store";
import { Badge, DataTable, TableRowLink } from "../../ui";
import { LtrValue } from "../../presentation";
import { invoiceLineId } from "../../invoice-line-links";
import { ReadingMoney as Money } from "../../InvoiceReadingReview";
import { LineEditor } from "./LineEditor";
import type { ReviewProps } from "./types";
export function LinesTable({
  invoice,
  workspace,
  update,
  editLine,
  onQuantity,
  openLine,
  onOpen,
  anchor,
  attemptedPost,
}: {
  invoice: ReviewProps["invoice"];
  workspace: ReviewProps["workspace"];
  update: ReviewProps["update"];
  editLine: ReviewProps["editLine"];
  onQuantity: ReviewProps["onQuantity"];
  attemptedPost: boolean;
  openLine: number | null;
  onOpen(index: number | null): void;
  anchor(element?: HTMLElement): void;
}) {
  const { state, t } = useDemo();
  const panel = useRef<HTMLElement>(null);
  const [editorWidth, setEditorWidth] = useState(560);
  useLayoutEffect(() => {
    const node = panel.current?.querySelector<HTMLElement>(
      ".receiving-lines-table",
    );
    if (!node) return;
    const measure = () => setEditorWidth(Math.max(240, node.clientWidth - 32));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const amount = (value: string) => {
    try {
      return new Decimal(value).toFixed(4);
    } catch {
      return value;
    }
  };
  return (
    <section ref={panel} className="list-box receiving-lines">
      <h2>{t("Invoice lines", "ردیف‌های فاکتور")}</h2>
      <DataTable
        className="receiving-lines-table"
        role="region"
        aria-label={t("Invoice lines", "ردیف‌های فاکتور")}
        horizontalScroll
        density="compact"
        columns={[
          { key: "number", width: 48, fixedWidth: true, required: true },
          { key: "product", width: 285, fixedWidth: true, required: true },
          { key: "quantity", width: 190, fixedWidth: true, required: true },
          { key: "delivered", width: 90, fixedWidth: true, required: true },
          {
            key: "cost",
            width: 220,
            fixedWidth: true,
            required: true,
            align: "end",
          },
          {
            key: "total",
            width: 100,
            fixedWidth: true,
            required: true,
            align: "end",
          },
          { key: "category", width: 130, fixedWidth: true, required: true },
          { key: "status", width: 180, fixedWidth: true, required: true },
        ]}
        phoneList={{
          name: "product",
          value: "cost",
          secondary: ["quantity", "delivered", "status"],
        }}
      >
        <thead>
          <tr>
            {[
              ["#", "#"],
              ["Product", "کالا"],
              ["Quantity", "تعداد"],
              ["Delivered", "تحویل‌شده"],
              ["Unit cost before tax", "هزینه هر واحد پیش از مالیات"],
              ["Line total", "جمع ردیف"],
              ["Category", "دسته"],
              ["Status", "وضعیت"],
            ].map(([en, fa]) => (
              <th key={en}>{t(en, fa)}</th>
            ))}
          </tr>
        </thead>
        {invoice.lines.map((line, index) => {
          const product = state.products.find(
            (x) =>
              x.company_id === invoice.company_id &&
              x.code === line.product_code,
          );
          const name = line.new_name_en || product?.name_en || line.description;
          const category = state.config.pricing_categories.find(
            (x) =>
              x.key === (line.pricing_category ?? product?.pricing_category),
          );
          const count = line.low_confidence_fields?.length ?? 0;
          const lineId = invoiceLineId(line, index);
          const rowId = `invoice-line-row-${index}`;
          return (
            <tbody
              key={lineId}
              className="invoice-line"
              data-expanded={openLine === index}
            >
              <tr
                className="invoice-line-summary"
                id={rowId}
                data-testid={rowId}
                data-line-id={lineId}
                data-control-kind="disclosure"
                tabIndex={0}
                aria-expanded={openLine === index}
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest("button,a")
                  )
                    return;
                  anchor(event.currentTarget);
                  onOpen(openLine === index ? null : index);
                }}
                onKeyDown={(e) => {
                  if (
                    e.target === e.currentTarget &&
                    ["Enter", " "].includes(e.key)
                  ) {
                    e.preventDefault();
                    anchor(e.currentTarget);
                    onOpen(openLine === index ? null : index);
                  }
                }}
              >
                <td>
                  <LtrValue value={String(index + 1)} />
                </td>
                <td>
                  <a
                    href="#invoice-line-editor"
                    className="invoice-line-toggle"
                    data-control-kind="disclosure"
                    aria-expanded={openLine === index}
                    onClick={(event) => {
                      event.preventDefault();
                      const row = document.getElementById(rowId);
                      if (row) anchor(row);
                      onOpen(openLine === index ? null : index);
                    }}
                  >
                    <span className="receiving-product-name" title={name}>
                      <LtrValue value={name} />
                    </span>
                  </a>
                  <small className="receiving-product-meta">
                    {line.supplier_item_code && (
                      <LtrValue value={line.supplier_item_code} />
                    )}{" "}
                    {!product && (
                      <Badge tone="neutral">
                        {t("New product", "کالای جدید")}
                      </Badge>
                    )}
                  </small>
                </td>
                <td>
                  <LtrValue
                    value={
                      line.sold_by === "weight"
                        ? `${line.source_quantity ?? line.qty_invoiced} ${line.source_quantity_unit ?? "kg"}`
                        : line.quantity_unit === "cases"
                          ? t(
                              `${line.quantity_entered ?? 0} ${Number(line.quantity_entered) === 1 ? "case" : "cases"} × ${line.units_per_case ?? 1} = ${line.qty_invoiced} ${line.qty_invoiced === 1 ? "unit" : "units"}`,
                              `${line.quantity_entered ?? 0} کارتن × ${line.units_per_case ?? 1} = ${line.qty_invoiced} واحد`,
                            )
                          : t(
                              `${line.qty_invoiced} ${line.qty_invoiced === 1 ? "unit" : "units"}`,
                              `${line.qty_invoiced} واحد`,
                            )
                    }
                  />
                </td>
                <td>
                  {line.qty_received_at_posting !== line.qty_invoiced && (
                    <span className="form-error">
                      <LtrValue
                        value={
                          line.sold_by === "weight"
                            ? (line.source_received_quantity ??
                              String(line.qty_received_at_posting))
                            : String(line.qty_received_at_posting)
                        }
                      />
                    </span>
                  )}
                </td>
                <td className="numeric">
                  <Money
                    value={amount(
                      line.sold_by === "weight"
                        ? (line.source_cost_before_tax ??
                            line.unit_cost_before_tax)
                        : line.unit_cost_before_tax,
                    )}
                    decimals={4}
                    fixedDecimals
                    currency={state.config.company.currency}
                  />
                </td>
                <td className="numeric">
                  <Money value={line.line_total} />
                </td>
                <td>
                  {category
                    ? t(
                        category.label,
                        (
                          {
                            grocery: "خواربار",
                            grocery_taxable: "خواربار مشمول مالیات",
                            rice: "برنج",
                            kitchenware: "لوازم آشپزخانه",
                          } as Record<string, string>
                        )[category.key] ?? category.label,
                      )
                    : t("Not added", "اضافه نشده")}
                </td>
                <td>
                  <div className="receiving-line-status">
                    <span className={count ? "receiving-check-summary" : ""}>
                      {line.review_confirmed
                        ? t("Confirmed ✓", "تأیید شد ✓")
                        : line.review_changed_after_confirmation
                          ? t(
                              "Changed after confirming: confirm again",
                              "پس از تأیید تغییر کرد: دوباره تأیید کنید",
                            )
                          : count
                            ? t(`${count} to check`, `${count} برای بررسی`)
                            : t("Not confirmed", "تأیید نشده")}
                    </span>
                    <TableRowLink
                      href="#invoice-line-editor"
                      aria-label={t(
                        `Review line ${index + 1}`,
                        `بررسی ردیف ${index + 1}`,
                      )}
                      aria-expanded={openLine === index}
                      onClick={(event) => {
                        event.preventDefault();
                        const row = document.getElementById(rowId);
                        if (row) anchor(row);
                        onOpen(openLine === index ? null : index);
                      }}
                    />
                  </div>
                </td>
              </tr>
              {openLine === index && (
                <tr className="table-expanded-row receiving-editor-row invoice-line-detail">
                  <td colSpan={8}>
                    <LineEditor
                      invoice={invoice}
                      workspace={workspace}
                      index={index}
                      attemptedPost={attemptedPost}
                      editorWidth={editorWidth}
                      update={update}
                      editLine={editLine}
                      onQuantity={onQuantity}
                      onClose={() => onOpen(null)}
                      anchor={() => {
                        const row = document.getElementById(rowId);
                        if (row) anchor(row);
                      }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </DataTable>
    </section>
  );
}
