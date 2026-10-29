import { Trash2 } from "lucide-react";
import { invoiceCheckField } from "../../invoice-checks";
import type { InvoiceReadDTO } from "../../invoice-projections";
import type { InvoiceChargeField } from "../../invoice-other-charges";
import { BufferedInput, Button, Field, SegmentedControl } from "../../ui";
import { useDemo } from "../../store";

/** The actual editable fields live once, beside each other inside the lines card. */
export function OtherChargesEditor({
  invoice,
  onEdit,
  onRemove,
}: {
  invoice: InvoiceReadDTO;
  onEdit(index: number, field: InvoiceChargeField, value: string): void;
  onRemove(index: number): void;
}) {
  const { t, state } = useDemo();
  if (!invoice.other_charges?.length) return null;
  const currencyCode =
    typeof invoice.import_currency === "string" &&
    /^[A-Z]{3}$/.test(invoice.import_currency)
      ? invoice.import_currency
      : state.config.company.currency;
  const currency =
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currencyCode;
  const hint = t(
    "The AI wasn't sure about this. Compare it with the photo.",
    "هوش مصنوعی از این مورد مطمئن نبود. با عکس مقایسه کنید.",
  );
  return (
    <section className="receiving-charges">
      <div className="receiving-charges-heading">
        <h3>{t("Other charges and credits", "هزینه‌ها و اعتبارهای دیگر")}</h3>
        <span className="muted">
          {t(
            "From the paper. Each one counts in the subtotal.",
            "از روی کاغذ. هر کدام در جمع جزء حساب می‌شود.",
          )}
        </span>
      </div>
      <ul className="receiving-charge-list">
        {invoice.other_charges.map((charge, index) => {
          const id = `invoice-check-charge-${index}`;
          const checked = (field: InvoiceChargeField) =>
            charge.low_confidence_fields?.some(
              (key) => invoiceCheckField(key) === field,
            );
          const fieldClass = (name: string, field: InvoiceChargeField) =>
            `receiving-charge-field ${name}${checked(field) ? " please-check-field" : ""}`;
          const description = t(
            `Charge ${index + 1} description`,
            `شرح هزینه ${index + 1}`,
          );
          const amount = t(
            `Charge ${index + 1} amount`,
            `مبلغ هزینه ${index + 1}`,
          );
          const tax = t(`Charge ${index + 1} tax`, `مالیات هزینه ${index + 1}`);
          return (
            <li
              className="receiving-charge"
              key={index}
              data-charge-index={index}
            >
              <Field
                className={fieldClass(
                  "receiving-charge-description",
                  "description",
                )}
                label={description}
                labelContent={<span className="sr-only">{description}</span>}
              >
                <BufferedInput
                  id={`${id}-input-description`}
                  className="ui-input"
                  value={charge.description}
                  title={checked("description") ? hint : undefined}
                  aria-describedby={
                    checked("description") ? `${id}-hint` : undefined
                  }
                  onChange={(event) =>
                    onEdit(index, "description", event.target.value)
                  }
                />
              </Field>
              <Field
                className={fieldClass("receiving-charge-money", "line_total")}
                label={amount}
                labelContent={<span className="sr-only">{amount}</span>}
                adornment={
                  <span
                    className="receiving-charge-currency"
                    aria-hidden="true"
                  >
                    {currency}
                  </span>
                }
              >
                <BufferedInput
                  id={`${id}-input-line_total`}
                  className="ui-input"
                  dir="ltr"
                  inputMode="decimal"
                  value={charge.amount}
                  title={checked("line_total") ? hint : undefined}
                  aria-describedby={
                    checked("line_total") ? `${id}-hint` : undefined
                  }
                  onChange={(event) =>
                    onEdit(index, "line_total", event.target.value)
                  }
                />
              </Field>
              <Field
                className={fieldClass("receiving-charge-tax", "taxable")}
                label={tax}
                labelContent={<span className="sr-only">{tax}</span>}
              >
                <SegmentedControl
                  id={`${id}-input-taxable`}
                  aria-label={tax}
                  title={checked("taxable") ? hint : undefined}
                  aria-describedby={
                    checked("taxable") ? `${id}-hint` : undefined
                  }
                  value={String(charge.taxable)}
                  options={[
                    { value: "false", label: t("No tax", "بدون مالیات") },
                    { value: "true", label: t("Taxable", "مشمول") },
                  ]}
                  onChange={(value) => onEdit(index, "taxable", value)}
                />
              </Field>
              <Button
                variant="plain"
                className="receiving-charge-remove ui-icon-button"
                aria-label={t(
                  `Remove charge ${index + 1}`,
                  `حذف هزینه ${index + 1}`,
                )}
                onClick={() => onRemove(index)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
              {charge.low_confidence_fields?.length ? (
                <span id={`${id}-hint`} className="sr-only">
                  {hint}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
