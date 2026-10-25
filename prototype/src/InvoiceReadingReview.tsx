import Decimal from "decimal.js";
import {
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  invoiceCheckField,
  invoiceTotalsCheck,
  isEmptyOptionalInvoiceField,
} from "./invoice-checks";
import type { InvoiceReadDTO } from "./invoice-projections";
import { LtrValue, Money, NotAdded } from "./presentation";
import { useDemo } from "./store";
import { Field as BaseField, DataTable, Select, Button } from "./ui";

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
  const [openCharge, setOpenCharge] = useState<number | null>(null);
  if (!invoice.other_charges?.length) return null;
  const hint = t(
    "The AI wasn't sure about this. Compare it with the photo.",
    "هوش مصنوعی از این مورد مطمئن نبود. با عکس مقایسه کنید.",
  );
  return (
    <section className="invoice-other-charges">
      <h3>{t("Other charges and credits", "هزینه‌ها و اعتبارهای دیگر")}</h3>
      <DataTable
        density="compact"
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
          {invoice.other_charges.map((charge, index) => {
            const checked = (field: string) =>
              charge.low_confidence_fields?.some(
                (key) => invoiceCheckField(key) === field,
              );
            return (
              <Fragment key={index}>
                <tr>
                  <td>
                    <span
                      className={
                        checked("description")
                          ? "reading-check-value"
                          : undefined
                      }
                      title={checked("description") ? hint : undefined}
                    >
                      {onEdit ? (
                        <a
                          href="#invoice-charge-editor"
                          data-charge-index={index}
                          data-control-kind="disclosure"
                          aria-expanded={openCharge === index}
                          onClick={(event) => {
                            event.preventDefault();
                            setOpenCharge(openCharge === index ? null : index);
                          }}
                        >
                          <LtrValue value={charge.description} />
                        </a>
                      ) : (
                        <LtrValue value={charge.description} />
                      )}
                    </span>
                  </td>
                  <td className="numeric">
                    <span
                      className={
                        checked("line_total")
                          ? "reading-check-value"
                          : undefined
                      }
                      title={checked("line_total") ? hint : undefined}
                    >
                      <ReadingMoney value={charge.amount} />
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        checked("taxable") ? "reading-check-value" : undefined
                      }
                      title={checked("taxable") ? hint : undefined}
                    >
                      {charge.taxable ? t("Yes", "بله") : t("No", "خیر")}
                    </span>
                  </td>
                </tr>
                {onEdit && openCharge === index && (
                  <tr>
                    <td colSpan={3}>
                      <div
                        role="region"
                        aria-label={t(
                          `Other charge ${index + 1}`,
                          `هزینه دیگر ${index + 1}`,
                        )}
                      >
                        <ReadingCheckFields
                          fields={charge.low_confidence_fields}
                          record={{ ...charge, line_total: charge.amount }}
                          idPrefix={`invoice-check-charge-${index}`}
                          onAcknowledge={(field) =>
                            onAcknowledge?.(index, field)
                          }
                          onEdit={(field, value) => onEdit(index, field, value)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </DataTable>
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
  record?: object;
  idPrefix: string;
  onAcknowledge(field: string): void;
  onNotOnInvoice?(field: string): unknown | Promise<unknown>;
  onEdit?(field: string, change: () => void): void;
} | null>(null);

export function ReadingCheckProvider({
  fields,
  record,
  idPrefix,
  onAcknowledge,
  onNotOnInvoice,
  onEdit,
  children,
}: {
  fields?: readonly string[];
  record?: object;
  idPrefix: string;
  onAcknowledge(field: string): void;
  onNotOnInvoice?(field: string): unknown | Promise<unknown>;
  onEdit?(field: string, change: () => void): void;
  children: ReactNode;
}) {
  return (
    <CheckContext.Provider
      value={{
        fields: fields ?? [],
        record,
        idPrefix,
        onAcknowledge,
        onNotOnInvoice,
        onEdit,
      }}
    >
      {children}
    </CheckContext.Provider>
  );
}

/** Adds review affordances to the normal editable field without replacing its input. */
export function ReadingField({
  readingField,
  readingHint,
  labelAdornment,
  ...props
}: ComponentProps<typeof BaseField> & {
  readingField?: string;
  readingHint?: string;
}) {
  const context = useContext(CheckContext);
  const { t } = useDemo();
  const helpId = useId();
  const [helpFocused, setHelpFocused] = useState(false);
  const [helpHovered, setHelpHovered] = useState(false);
  const [absenceAcknowledged, setAbsenceAcknowledged] = useState(false);
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
    (value) => invoiceCheckField(value) === invoiceCheckField(key ?? ""),
  );
  const hint =
    readingHint ??
    t(
      "The AI wasn't sure about this. Compare it with the photo.",
      "هوش مصنوعی از این مورد مطمئن نبود. با عکس مقایسه کنید.",
    );
  const canMarkAbsent = !!(
    field &&
    context?.record &&
    context.onNotOnInvoice &&
    isEmptyOptionalInvoiceField(context.record, field)
  );
  const child = isValidElement<{ onChange?: (...args: never[]) => unknown }>(
    props.children,
  )
    ? props.children
    : null;
  const children =
    child?.props.onChange && ((field && context?.onEdit) || absenceAcknowledged)
      ? cloneElement(child, {
          onChange: (...args: never[]) => {
            setAbsenceAcknowledged(false);
            if (field && context?.onEdit)
              context.onEdit(field, () => child.props.onChange?.(...args));
            else child.props.onChange?.(...args);
          },
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
      labelAdornment={
        <>
          {labelAdornment}
          {(field || absenceAcknowledged) && (
            <span className="reading-check-label-actions">
              {field && (
                <span
                  className="reading-check-marker"
                  role="img"
                  aria-label={t(
                    "Check this against the original",
                    "با اصل فاکتور بررسی کنید",
                  )}
                  tabIndex={0}
                  aria-describedby={
                    helpFocused || helpHovered ? helpId : undefined
                  }
                  onFocus={() => setHelpFocused(true)}
                  onBlur={() => setHelpFocused(false)}
                  onMouseEnter={() => setHelpHovered(true)}
                  onMouseLeave={() => setHelpHovered(false)}
                >
                  <span aria-hidden="true">!</span>
                  {(helpFocused || helpHovered) && (
                    <span
                      id={helpId}
                      role="tooltip"
                      className="reading-check-tooltip reading-ai-tooltip"
                    >
                      {hint}
                    </span>
                  )}
                </span>
              )}
              {!field && absenceAcknowledged && (
                <span
                  className="reading-check-marker-placeholder"
                  aria-hidden="true"
                />
              )}
              {(canMarkAbsent || absenceAcknowledged) && (
                <Button
                  variant="secondary"
                  size="label"
                  disabled={absenceAcknowledged}
                  aria-label={t(
                    `Not on the invoice: ${props.label}`,
                    `در فاکتور نیست: ${props.label}`,
                  )}
                  onClick={async () => {
                    if (!field || !context?.onNotOnInvoice) return;
                    setAbsenceAcknowledged(true);
                    const acknowledged = await context.onNotOnInvoice(field);
                    if (!acknowledged) setAbsenceAcknowledged(false);
                  }}
                >
                  {t("Not on the invoice", "در فاکتور نیست")}
                </Button>
              )}
            </span>
          )}
        </>
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
            id={`${idPrefix}-input-description`}
            value={values.description}
            onChange={(event) => onEdit("description", event.target.value)}
          />
        </ReadingField>
        <ReadingField
          readingField="line_total"
          label={t("Charge amount", "مبلغ هزینه")}
        >
          <input
            id={`${idPrefix}-input-line_total`}
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
            id={`${idPrefix}-input-taxable`}
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
  const context = useContext(CheckContext);
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
                : invoiceCheckField(field) === "pack_size"
                  ? t("Pack description", "شرح بسته")
                  : invoiceCheckField(field) === "import_handwritten_notes"
                    ? t("Handwritten notes", "یادداشت‌های دست‌نویس")
                    : t("Other reading field", "فیلد دیگر خوانش")
            }
            hint={
              field === "line_type" ? undefined : ![
                  "pack_size",
                  "handwritten_notes",
                  "import_handwritten_notes",
                ].includes(field) ? (
                <LtrValue value={field} />
              ) : (
                t(
                  "Compare this reading with the original, then confirm the line or choose Looks right.",
                  "این خوانش را با اصل فاکتور مقایسه کنید، سپس ردیف یا درست است را تأیید کنید.",
                )
              )
            }
          >
            <input
              id={`${context?.idPrefix}-input-${invoiceCheckField(field)}`}
              readOnly
              value={
                field === "line_type"
                  ? t("Item", "کالا")
                  : String(
                      (record as Record<string, unknown>)[field] ??
                        (field === "handwritten_notes"
                          ? (record as Record<string, unknown>)
                              .import_handwritten_notes
                          : undefined) ??
                        "",
                    )
              }
            />
          </ReadingField>
        ))}
    </>
  );
}
