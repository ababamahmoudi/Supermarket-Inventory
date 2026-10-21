import {
  createContext,
  useContext,
  useId,
  useState,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ComponentProps,
} from "react";
import Decimal from "decimal.js";
import { useDemo } from "./store";
import { Badge, Button, DataTable, Field as BaseField, Select } from "./ui";
import { LtrValue, Money, NotAdded } from "./presentation";
import { invoiceCheckField, invoiceTotalsCheck } from "./invoice-checks";
import type { InvoiceReadDTO } from "./invoice-projections";

export function ImportedReadingNote({ invoice }: { invoice: InvoiceReadDTO }) {
  const { state, t } = useDemo();
  const notes = [
    ...(invoice.import_warnings ?? []),
    ...(invoice.import_handwritten_notes ?? []),
  ];
  return (
    <>
      {invoice.reading_record && (
        <p className="muted">
          {t(
            "Reading imported from the invoice-reader kit (not live)",
            "خوانش از کیت خواندن فاکتور وارد شده (زنده نیست)",
          )}{" "}
          · {invoice.reading_record.ai_source}
        </p>
      )}
      {invoice.import_currency &&
        invoice.import_currency !== state.config.company.currency && (
          <p className="banner pending" role="status">
            {t(
              "Invoice currency differs from company currency",
              "ارز فاکتور با ارز شرکت متفاوت است",
            )}
            : <LtrValue value={invoice.import_currency} />
          </p>
        )}
      {notes.length > 0 && (
        <div className="list-box" role="note">
          {notes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </div>
      )}
    </>
  );
}

export function InvoiceOtherCharges({
  invoice,
  onAcknowledge,
  onEdit,
}: {
  invoice: InvoiceReadDTO;
  onAcknowledge?(index: number, field: string): void;
  onEdit?(index: number, field: string, value: string): void;
}) {
  const { t } = useDemo();
  if (!invoice.other_charges?.length) return null;
  return (
    <section className="invoice-other-charges">
      <h3>{t("Other charges and credits", "هزینه‌ها و اعتبارهای دیگر")}</h3>
      <DataTable
        columns={[
          { key: "description" },
          { key: "amount", align: "end" },
          { key: "taxable" },
        ]}
        phoneList={{
          name: "description",
          value: "amount",
          secondary: ["taxable"],
        }}
      >
        <thead>
          <tr>
            <th>{t("Description", "شرح")}</th>
            <th>{t("Amount", "مبلغ")}</th>
            <th>{t("Taxable", "مشمول مالیات")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.other_charges.map((charge, index) => (
            <tr key={index}>
              <td>
                <LtrValue value={charge.description} />
              </td>
              <td className="numeric">
                <ReadingMoney value={charge.amount} />
              </td>
              <td>{charge.taxable ? t("Yes", "بله") : t("No", "خیر")}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {onAcknowledge &&
        (invoice.other_charges ?? []).map((charge, index) => (
          <ReadingCheckFields
            key={index}
            fields={charge.low_confidence_fields}
            record={{ ...charge, line_total: charge.amount }}
            idPrefix={`invoice-check-charge-${index}`}
            onAcknowledge={(field) => onAcknowledge(index, field)}
            onEdit={(field, value) => onEdit?.(index, field, value)}
          />
        ))}
    </section>
  );
}

export function InvoiceTotalsWarnings({
  invoice,
}: {
  invoice: InvoiceReadDTO;
}) {
  const { t } = useDemo();
  const differences = invoiceTotalsCheck(invoice);
  return (
    <>
      {differences.subtotalDifference && (
        <p className="banner pending" role="status">
          {t(
            "Items plus other charges differ from subtotal by",
            "جمع کالاها و هزینه‌های دیگر با جمع پیش از مالیات اختلاف دارد به مبلغ",
          )}{" "}
          <Money value={differences.subtotalDifference} />
        </p>
      )}
      {differences.totalDifference && (
        <p className="banner pending" role="status">
          {t(
            "Subtotal plus tax differs from total by",
            "جمع پیش از مالیات و مالیات با جمع نهایی اختلاف دارد به مبلغ",
          )}{" "}
          <Money value={differences.totalDifference} />
        </p>
      )}
    </>
  );
}

const CheckContext = createContext<{
  fields: readonly string[];
  idPrefix: string;
  onAcknowledge(field: string): void;
  onEdit?(field: string, change: () => void): void;
} | null>(null);

export function ReadingCheckProvider({
  fields,
  idPrefix,
  onAcknowledge,
  onEdit,
  children,
}: {
  fields?: readonly string[];
  idPrefix: string;
  onAcknowledge(field: string): void;
  onEdit?(field: string, change: () => void): void;
  children: ReactNode;
}) {
  return (
    <CheckContext.Provider
      value={{ fields: fields ?? [], idPrefix, onAcknowledge, onEdit }}
    >
      {children}
    </CheckContext.Provider>
  );
}

/** Adds review affordances to the normal editable field without replacing its input. */
export function ReadingField({
  readingField,
  ...props
}: ComponentProps<typeof BaseField> & { readingField?: string }) {
  const context = useContext(CheckContext);
  const { t } = useDemo();
  const helpId = useId();
  const [helpFocused, setHelpFocused] = useState(false);
  const [helpHovered, setHelpHovered] = useState(false);
  const childId = isValidElement<{ id?: string }>(props.children)
    ? (props.children.props.id ?? "")
    : "";
  const suffix = childId.replace(/^invoice-line-\d+-/, "");
  const key =
    readingField ??
    (
      {
        "invoice-supplier": "supplier",
        "invoice-number": "supplier_invoice_number",
        "invoice-date": "invoice_date",
        "invoice-due-date": "due_date",
        "invoice-subtotal": "subtotal",
        "invoice-tax": "tax",
        "invoice-final-total": "final_total",
        invoiced: "quantity_entered",
        cost: "unit_cost_before_tax",
        "supplier-code": "supplier_item_code",
        pack: "units_per_case",
      } as Record<string, string>
    )[suffix];
  const field = context?.fields.find(
    (value) => invoiceCheckField(value) === key,
  );
  const hint = t(
    "The AI wasn't sure about this. Compare it with the photo.",
    "هوش مصنوعی از این مورد مطمئن نبود. با عکس مقایسه کنید.",
  );
  const child = isValidElement<{ onChange?: (...args: never[]) => unknown }>(
    props.children,
  )
    ? props.children
    : null;
  const children =
    field && child?.props.onChange && context?.onEdit
      ? cloneElement(child, {
          onChange: (...args: never[]) =>
            context.onEdit!(field, () => {
              child.props.onChange?.(...args);
            }),
        })
      : props.children;
  return (
    <BaseField
      {...props}
      children={children}
      containerId={field ? `${context!.idPrefix}-${field}` : props.containerId}
      className={[props.className, field ? "please-check-field" : ""]
        .filter(Boolean)
        .join(" ")}
      adornment={
        field ? (
          <div className="reading-check-actions">
            <span
              className="reading-check-chip"
              tabIndex={0}
              aria-describedby={helpFocused || helpHovered ? helpId : undefined}
              onFocus={() => setHelpFocused(true)}
              onBlur={() => setHelpFocused(false)}
              onMouseEnter={() => setHelpHovered(true)}
              onMouseLeave={() => setHelpHovered(false)}
            >
              <Badge tone="pending">
                {t("Please check", "لطفاً بررسی کنید")}
              </Badge>
            </span>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`${t("Looks right", "درست است")}: ${props.label}`}
              onClick={() => context!.onAcknowledge(field)}
            >
              {t("Looks right", "درست است")}
            </Button>
            {(helpFocused || helpHovered) && (
              <span
                id={helpId}
                role="tooltip"
                className="reading-check-tooltip"
              >
                {hint}
              </span>
            )}
          </div>
        ) : (
          props.adornment
        )
      }
    />
  );
}

function ReadingCheckFields({
  fields,
  record,
  idPrefix,
  onEdit,
  onAcknowledge,
}: {
  fields?: readonly string[];
  record: object;
  idPrefix: string;
  onEdit(field: string, value: string): void;
  onAcknowledge(field: string): void;
}) {
  const { t } = useDemo();
  const values = record as {
    description: string;
    line_total: string;
    taxable: boolean;
  };
  return (
    <ReadingCheckProvider
      fields={fields}
      idPrefix={idPrefix}
      onAcknowledge={onAcknowledge}
    >
      <div className="list-box form-grid">
        <ReadingField
          readingField="description"
          label={t("Charge description", "شرح هزینه")}
        >
          <input
            value={values.description}
            onChange={(event) => onEdit("description", event.target.value)}
          />
        </ReadingField>
        <ReadingField
          readingField="line_total"
          label={t("Charge amount", "مبلغ هزینه")}
        >
          <input
            dir="ltr"
            inputMode="decimal"
            value={values.line_total}
            onChange={(event) => onEdit("line_total", event.target.value)}
          />
        </ReadingField>
        <ReadingField
          readingField="taxable"
          label={t("Charge taxable", "هزینه مشمول مالیات")}
        >
          <Select
            value={String(values.taxable)}
            onChange={(value) => onEdit("taxable", value)}
            options={[
              { value: "true", label: t("Yes", "بله") },
              { value: "false", label: t("No", "خیر") },
            ]}
          />
        </ReadingField>
      </div>
    </ReadingCheckProvider>
  );
}

/** Missing imported values remain visible as absent while the person checks them. */
export function ReadingMoney(props: ComponentProps<typeof Money>) {
  let valid = false;
  try {
    valid =
      Boolean(String(props.value).trim()) &&
      new Decimal(props.value).isFinite();
  } catch {
    /* A missing amount is a review field. */
  }
  return valid ? <Money {...props} /> : <NotAdded />;
}

export function ReadingUnknownChecks({
  fields,
  known,
  record,
}: {
  fields?: readonly string[];
  known: readonly string[];
  record: object;
}) {
  const { t } = useDemo();
  return (
    <>
      {(fields ?? [])
        .filter((field) => !known.includes(invoiceCheckField(field)))
        .map((field) => (
          <ReadingField
            key={field}
            readingField={invoiceCheckField(field)}
            label={
              field === "line_type"
                ? t("Line type", "نوع ردیف")
                : field.replaceAll("_", " ")
            }
          >
            <input
              readOnly
              value={
                field === "line_type"
                  ? t("Item", "کالا")
                  : String((record as Record<string, unknown>)[field] ?? "")
              }
            />
          </ReadingField>
        ))}
    </>
  );
}
