import Decimal from "decimal.js";
import {
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
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
      {invoice.reading_record?.source === "imported" && (
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
  showHeading = true,
}: {
  invoice: InvoiceReadDTO;
  showHeading?: boolean;
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
      {showHeading && (
        <h3>{t("Other charges and credits", "هزینه‌ها و اعتبارهای دیگر")}</h3>
      )}
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
                    {!onEdit && charge.applies_to && (
                      <small
                        className="posted-charge-applies"
                        data-testid={`posted-charge-${index}-applies-to`}
                      >
                        {t("Applies to:", "اعمال روی:")}{" "}
                        {charge.applies_to === "invoice_total"
                          ? t("Invoice total", "جمع فاکتور")
                          : t("Chosen items", "کالاهای انتخابی")}
                        {(charge.allocations ?? []).map((allocation) => {
                          const position = invoice.lines.findIndex(
                            (line, lineIndex) =>
                              (line.id ?? String(lineIndex)) ===
                              allocation.line_id,
                          );
                          const line = invoice.lines[position];
                          return (
                            <span key={allocation.line_id}>
                              {" · "}
                              <LtrValue
                                value={
                                  line?.new_name_en ||
                                  line?.description ||
                                  allocation.line_id
                                }
                              />{" "}
                              <ReadingMoney value={allocation.amount} /> (
                              {t("unit cost", "هزینه واحد")}{" "}
                              <ReadingMoney
                                value={allocation.unit_cost_before}
                                decimals={4}
                                fixedDecimals
                              />{" "}
                              →{" "}
                              <ReadingMoney
                                value={allocation.unit_cost_after}
                                decimals={4}
                                fixedDecimals
                              />
                              )
                            </span>
                          );
                        })}
                      </small>
                    )}
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
  /** The amber ! popover offers Looks right for this one field. */
  fieldLooksRight?: boolean;
  onAcknowledge(field: string): void;
  onNotOnInvoice?(field: string): unknown | Promise<unknown>;
  onEdit?(field: string, change: () => void): void;
} | null>(null);

export function ReadingCheckProvider({
  fields,
  record,
  idPrefix,
  fieldLooksRight = false,
  onAcknowledge,
  onNotOnInvoice,
  onEdit,
  children,
}: {
  fields?: readonly string[];
  record?: object;
  idPrefix: string;
  fieldLooksRight?: boolean;
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
        fieldLooksRight,
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
  // PR 29 (Ali, 2026-11-20): tapping the amber ! opens a small popover with
  // Looks right for this one field.
  const [helpOpen, setHelpOpen] = useState(false);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (!helpOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !popoverRef.current?.contains(event.target) &&
        !markerRef.current?.contains(event.target)
      )
        setHelpOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHelpOpen(false);
      markerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [helpOpen]);
  const canLooksRight = Boolean(field && context?.fieldLooksRight);
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
                <button
                  ref={markerRef}
                  type="button"
                  className="reading-check-marker"
                  data-control-kind="disclosure"
                  aria-label={t(
                    "Check this against the original",
                    "با اصل فاکتور بررسی کنید",
                  )}
                  aria-haspopup={canLooksRight ? "dialog" : undefined}
                  aria-expanded={canLooksRight ? helpOpen : undefined}
                  aria-describedby={
                    !helpOpen && (helpFocused || helpHovered)
                      ? helpId
                      : undefined
                  }
                  onFocus={() => setHelpFocused(true)}
                  onBlur={() => setHelpFocused(false)}
                  onMouseEnter={() => setHelpHovered(true)}
                  onMouseLeave={() => setHelpHovered(false)}
                  onClick={() => {
                    if (!canLooksRight) return;
                    setHelpOpen((open) => !open);
                    requestAnimationFrame(() =>
                      popoverRef.current
                        ?.querySelector<HTMLButtonElement>(
                          ".reading-check-looks-right",
                        )
                        ?.focus({ preventScroll: true }),
                    );
                  }}
                >
                  <span aria-hidden="true">!</span>
                  {!helpOpen && (helpFocused || helpHovered) && (
                    <span
                      id={helpId}
                      role="tooltip"
                      className="reading-check-tooltip reading-ai-tooltip"
                    >
                      {hint}
                    </span>
                  )}
                </button>
              )}
              {field && canLooksRight && helpOpen && (
                <span
                  ref={popoverRef}
                  role="dialog"
                  aria-label={t(
                    `Check ${String(props.label)}`,
                    `بررسی ${String(props.label)}`,
                  )}
                  className="reading-check-popover reading-ai-tooltip"
                >
                  <span className="reading-check-popover-text">{hint}</span>
                  <span className="reading-check-popover-actions">
                    <Button
                      variant="neutral"
                      size="sm"
                      className="reading-check-change"
                      onClick={() => {
                        setHelpOpen(false);
                        const target = childId
                          ? document.getElementById(childId)
                          : null;
                        (target?.matches("input, textarea, button, select")
                          ? target
                          : target?.querySelector<HTMLElement>(
                              "input, textarea, button",
                            )
                        )?.focus();
                      }}
                    >
                      {t("Change", "تغییر")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="reading-check-looks-right"
                      aria-label={t(
                        `Looks right: ${String(props.label)}`,
                        `درست است: ${String(props.label)}`,
                      )}
                      onClick={() => {
                        setHelpOpen(false);
                        context!.onAcknowledge(field);
                        markerRef.current?.blur();
                      }}
                    >
                      {t("Looks right", "درست است")}
                    </Button>
                  </span>
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
  const labels: Record<string, [string, string]> = {
    line_type: ["Line type", "نوع ردیف"],
    pack_size: ["Pack description", "شرح بسته"],
    import_handwritten_notes: ["Handwritten notes", "یادداشت‌های دست‌نویس"],
    delivery_reference: ["Delivery reference", "مرجع تحویل"],
  };
  return (
    <>
      {(fields ?? [])
        .filter(
          (field) =>
            !known.includes(invoiceCheckField(field)) &&
            labels[invoiceCheckField(field)],
        )
        .map((field) => {
          const key = invoiceCheckField(field);
          return (
            <ReadingField
              key={field}
              readingField={key}
              label={t(...labels[key])}
              hint={t(
                "Compare this reading with the original, then confirm the line or choose Looks right.",
                "این خوانش را با اصل فاکتور مقایسه کنید، سپس ردیف یا درست است را تأیید کنید.",
              )}
            >
              <input
                id={`${context?.idPrefix}-input-${key}`}
                readOnly
                value={
                  key === "line_type"
                    ? t("Item", "کالا")
                    : String(
                        (record as Record<string, unknown>)[key] ??
                          (record as Record<string, unknown>)[field] ??
                          "",
                      )
                }
              />
            </ReadingField>
          );
        })}
    </>
  );
}
