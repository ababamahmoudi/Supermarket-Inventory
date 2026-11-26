import {
  BilingualPrintText,
  OperationalPrintDocument,
} from "./operational-print";
import { formatMoney } from "./formatters";
import { ProductName, UnitSize } from "./presentation";
import { branchLabel } from "./settings";
import type { OrderReadDTO } from "./purchase-projections";
import type { OrderPrintConfig } from "./orders-board";
import type { Language } from "./types";

export function OrderPrintDocument({
  order,
  config,
  language,
}: {
  order: OrderReadDTO;
  config: OrderPrintConfig;
  language: Language;
}) {
  const documentLanguage = config.supplier_documents?.supplier_order ?? "en";
  const printLanguage = documentLanguage === "en" ? "en" : language;
  const amount = (value: string | null | undefined) =>
    value === null || value === undefined
      ? "—"
      : formatMoney(value, { currency: order.currency });
  return (
    <div className="order-print-output">
      <OperationalPrintDocument
        title_en="Order"
        title_fa="سفارش"
        company_name={config.company.name_en}
        reference={order.reference}
        language={printLanguage}
        documentLanguage={documentLanguage}
        branding={config.branding}
      >
        <dl className="operational-print-meta">
          <div>
            <dt>
              <BilingualPrintText en="Supplier" fa="تأمین‌کننده" />
            </dt>
            <dd>{order.supplier}</dd>
          </div>
          <div>
            <dt>
              <BilingualPrintText en="Location" fa="مکان" />
            </dt>
            <dd>
              <BilingualPrintText
                en={branchLabel(config, order.branch, "en")}
                fa={branchLabel(config, order.branch, "fa")}
              />
            </dd>
          </div>
          <div>
            <dt>
              <BilingualPrintText en="Date" fa="تاریخ" />
            </dt>
            <dd>
              <bdi dir="ltr">{order.date}</bdi>
            </dd>
          </div>
        </dl>
        <table className="order-print-table">
          <thead>
            <tr>
              <th>
                <BilingualPrintText
                  en="Product / supplier code"
                  fa="کالا / کد تأمین‌کننده"
                />
              </th>
              <th>
                <BilingualPrintText en="Pack" fa="بسته" />
              </th>
              <th>
                <BilingualPrintText en="Cases" fa="کارتن" />
              </th>
              <th>
                <BilingualPrintText en="Units" fa="واحد" />
              </th>
              <th>
                <BilingualPrintText en="Unit cost" fa="هزینهٔ واحد" />
              </th>
              <th>
                <BilingualPrintText en="Case cost" fa="هزینهٔ کارتن" />
              </th>
              <th>
                <BilingualPrintText
                  en="Before-tax total"
                  fa="جمع پیش از مالیات"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <ProductName
                    product={
                      documentLanguage === "en"
                        ? { ...line, name_fa: "" }
                        : line
                    }
                    language={line.name_fa ? printLanguage : "en"}
                  />
                  {line.new_item && (
                    <span className="order-print-new-item">
                      <BilingualPrintText en="New item" fa="کالای جدید" />
                    </span>
                  )}
                  {line.unit_size &&
                    !line.name_en
                      .replace(/\s/g, "")
                      .toLocaleLowerCase()
                      .includes(
                        line.unit_size.replace(/\s/g, "").toLocaleLowerCase(),
                      ) && (
                      <UnitSize
                        className="order-print-unit-size"
                        value={line.unit_size}
                      />
                    )}
                  <bdi dir="ltr">
                    {line.supplier_item_code || line.product_code}
                  </bdi>
                </td>
                <td>
                  <bdi dir="ltr">
                    {line.quantity_unit === "lb"
                      ? `${line.case_weight ?? "—"} ${line.case_weight_unit ?? ""}`
                      : (line.units_per_case ?? "—")}
                  </bdi>
                </td>
                <td>
                  <bdi dir="ltr">{line.ordered_cases}</bdi>
                </td>
                <td>
                  <bdi dir="ltr">
                    {line.ordered_units ?? "—"}
                    {line.quantity_unit === "lb" ? " lb" : ""}
                  </bdi>
                </td>
                <td>
                  <bdi dir="ltr">{amount(line.expected_unit_cost)}</bdi>
                </td>
                <td>
                  <bdi dir="ltr">{amount(line.expected_case_cost)}</bdi>
                </td>
                <td>
                  <bdi dir="ltr">{amount(line.expected_line_total)}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="order-print-total">
          <BilingualPrintText
            en="Expected total before tax"
            fa="جمع مورد انتظار پیش از مالیات"
          />
          <strong>
            <bdi dir="ltr">{amount(order.expected_total_before_tax)}</bdi>
          </strong>
          {order.estimate_incomplete && (
            <BilingualPrintText
              en="Estimate incomplete"
              fa="برآورد کامل نیست"
            />
          )}
        </div>
      </OperationalPrintDocument>
    </div>
  );
}
