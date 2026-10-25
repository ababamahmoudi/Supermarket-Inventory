import { useRef, useState } from "react";
import Decimal from "decimal.js";
import { Check, X } from "lucide-react";
import { useDemo } from "../../store";
import {
  Badge,
  BufferedInput,
  Button,
  ConfirmDialog,
  DateField,
  Disclosure,
  IconButton,
  NumberField,
  SegmentedControl,
  Select,
} from "../../ui";
import {
  ReadingField as Field,
  ReadingMoney as Money,
  ReadingCheckProvider,
} from "../../InvoiceReadingReview";
import { LtrValue, LtrText } from "../../presentation";
import {
  invoiceCheckField,
  acknowledgeInvoiceFieldAbsence,
  visibleInvoiceCheckFields,
  acknowledgeInvoiceCheck,
  setInvoiceLineCategory,
  confirmInvoiceLineChecks,
  InvoiceLineConfirmationError,
} from "../../invoice-checks";
import {
  removeInvoiceLine,
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
  recalculateInvoice,
} from "../../invoice";
import {
  setInvoiceWeightCost,
  setInvoiceWeightReceived,
  selectInvoiceWeightUnit,
  invoiceLineAmount,
} from "../../invoice-weight";
import { clearInvoiceOrderLine } from "../../invoice-orders";
import { costPerCase, costPerUnit } from "../../supplier-items";
import type { ReviewProps } from "./types";
export function LineEditor({
  invoice,
  workspace,
  index,
  update,
  editLine,
  onQuantity,
  onClose,
  anchor,
  attemptedPost,
}: {
  invoice: ReviewProps["invoice"];
  workspace: ReviewProps["workspace"];
  index: number;
  attemptedPost: boolean;
  update: ReviewProps["update"];
  editLine: ReviewProps["editLine"];
  onQuantity: ReviewProps["onQuantity"];
  onClose(): void;
  anchor(): void;
}) {
  const { state, t, money, lang } = useDemo();
  const line = invoice.lines[index];
  const checkCount = visibleInvoiceCheckFields(line).length;
  const product = state.products.find(
    (x) => x.company_id === invoice.company_id && x.code === line.product_code,
  );
  const importedMatch =
    line.reading_product_match?.product_code === line.product_code
      ? line.reading_product_match
      : undefined;
  const checkMatch =
    importedMatch?.requires_check &&
    line.low_confidence_fields?.some(
      (field) => invoiceCheckField(field) === "product_code",
    );
  const [english, setEnglish] = useState(
    line.new_name_en ?? product?.name_en ?? line.description,
  );
  const [persian, setPersian] = useState(
    line.new_name_fa ?? product?.name_fa ?? "",
  );
  const [attempted, setAttempted] = useState(false);
  const editorBody = useRef<HTMLDivElement>(null);
  const [reservedBodyHeight, setReservedBodyHeight] = useState(0);
  const reserveBody = () => {
    const body = editorBody.current;
    const height = body
      ? Math.max(body.getBoundingClientRect().height, body.scrollHeight)
      : 0;
    setReservedBodyHeight((current) => Math.max(current, height));
  };
  const showErrors = attempted || attemptedPost;
  const [failure, setFailure] = useState("");
  const [failedField, setFailedField] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [shortOpen, setShortOpen] = useState(false);
  const [printedOpen, setPrintedOpen] = useState(
    () =>
      !!line.low_confidence_fields?.some(
        (key) => invoiceCheckField(key) === "line_total",
      ),
  );
  const moreKeys = [
    "barcode",
    "lot_number",
    "expiry_as_printed",
    "description",
    "handwritten_note",
  ];
  const [more, setMore] = useState(
    () =>
      !!line.low_confidence_fields?.some(
        (x) =>
          invoiceCheckField(x) !== "description" &&
          moreKeys.includes(invoiceCheckField(x)) &&
          String(
            (line as unknown as Record<string, unknown>)[
              invoiceCheckField(x)
            ] ?? "",
          ).trim() !== "",
      ),
  );
  const [short, setShort] = useState(
    String(Math.max(0, line.qty_invoiced - line.qty_received_at_posting)),
  );
  const [refused, setRefused] = useState(String(line.refused_units ?? 0));
  const [reason, setReason] = useState("");
  const id = (suffix: string) => `invoice-line-${index}-${suffix}`;
  const edit = (
    field: string,
    change: Parameters<ReviewProps["editLine"]>[1],
    recalculate = false,
  ) => {
    setFailedField("");
    setFailure("");
    editLine(
      index,
      (item, draft, actor) => {
        change(item, draft, actor);
        acknowledgeInvoiceCheck(draft, actor, field, index);
      },
      recalculate,
    );
  };
  const nameError =
    showErrors &&
    ((line.product_code === "NEW" && !english.trim()) ||
      failedField === "new_name_en")
      ? t("Enter the English name.", "نام انگلیسی را وارد کنید.")
      : undefined;
  const categoryError =
    showErrors &&
    ((line.product_code === "NEW" && !line.pricing_category) ||
      failedField === "pricing_category")
      ? t("Choose a pricing category.", "دسته قیمت‌گذاری را انتخاب کنید.")
      : undefined;
  const quantityError =
    showErrors &&
    (!validInvoiceLineQuantity(line) || failedField === "quantity_entered")
      ? t("Enter a valid quantity.", "تعداد معتبر وارد کنید.")
      : undefined;
  const receivedError =
    showErrors &&
    (!validInvoiceLineReceived(line) ||
      failedField === "qty_received_at_posting")
      ? t("Check the delivered quantity.", "تعداد تحویل‌شده را بررسی کنید.")
      : undefined;
  const costError =
    showErrors &&
    (!workspace.lineDetails[index]?.costValid ||
      failedField === "unit_cost_before_tax")
      ? t(
          "Enter a cost of zero or more with up to four decimal places.",
          "هزینه صفر یا بیشتر با حداکثر چهار رقم اعشار وارد کنید.",
        )
      : undefined;
  const validCaseCost =
    line.quantity_unit !== "cases" ||
    line.sold_by === "weight" ||
    /^\d+(?:\.\d{1,4})?$/.test(line.case_cost_before_tax ?? "");
  const caseCostError =
    showErrors && (!validCaseCost || failedField === "case_cost_before_tax")
      ? t(
          "Enter a case cost of zero or more that agrees with the unit cost and pack.",
          "هزینه کارتن صفر یا بیشتر وارد کنید که با هزینه واحد و اندازه بسته سازگار باشد.",
        )
      : undefined;
  const saveName = async () => {
    if (english !== (line.new_name_en ?? product?.name_en ?? line.description))
      await update((draft, actor) => {
        const item = draft.invoice.lines[index];
        item.new_name_en = english;
        item.review_changed_after_confirmation ||= item.review_confirmed;
        item.review_confirmed = false;
        acknowledgeInvoiceCheck(draft, actor, "description", index);
      });
  };
  const confirm = async () => {
    anchor();
    setAttempted(true);
    await saveName();
    let error = "";
    let field = "";
    const result = await update((draft, actor) => {
      try {
        confirmInvoiceLineChecks(draft, actor, index, true);
        return true;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
        if (cause instanceof InvoiceLineConfirmationError) field = cause.field;
        return false;
      }
    });
    if (result) {
      onClose();
    } else {
      setFailedField(field);
      if (field) {
        const suffix: Record<string, string> = {
          new_name_en: "name-en",
          pricing_category: "category",
          quantity_entered: "invoiced",
          qty_received_at_posting: "delivered",
          unit_cost_before_tax: "cost",
          case_cost_before_tax: "case-cost",
          units_per_case: "pack",
          date_value: "date",
        };
        document
          .getElementById(id(suffix[field] ?? field))
          ?.focus({ preventScroll: true });
      }
      setFailure(
        field
          ? t(
              "Check the marked field before confirming.",
              "پیش از تأیید، فیلد مشخص‌شده را بررسی کنید.",
            )
          : error ||
              t(
                "Check the fields before confirming.",
                "پیش از تأیید فیلدها را بررسی کنید.",
              ),
      );
    }
  };

  let lowerCost = false;
  try {
    lowerCost =
      !!workspace.lineDetails[index]?.previous &&
      new Decimal(line.unit_cost_before_tax).lt(
        workspace.lineDetails[index]!.previous!.cost,
      );
  } catch {
    /* Validation describes an incomplete cost. */
  }
  let deduction = "0.00";
  try {
    deduction = new Decimal(invoiceLineAmount(line))
      .times(new Decimal(short || 0).plus(refused || 0))
      .div(line.qty_invoiced)
      .toFixed(2);
  } catch {
    /* Keep incomplete edits visible. */
  }
  let calculated = "";
  try {
    calculated = invoiceLineAmount(line);
  } catch {
    /* The cost error explains incomplete input. */
  }
  return (
    <section
      className="receiving-line-editor ui-form-large"
      onPointerDownCapture={reserveBody}
      onKeyDownCapture={reserveBody}
      onChangeCapture={reserveBody}
      onWheelCapture={() => setReservedBodyHeight(0)}
      onTouchMoveCapture={() => setReservedBodyHeight(0)}
      role="region"
      tabIndex={-1}
      aria-label={t(`Line ${index + 1}`, `ردیف ${index + 1}`)}
      id={id("detail")}
    >
      <header className="receiving-editor-phone-header">
        <IconButton
          variant="secondary"
          aria-label={t("Close", "بستن")}
          onClick={() => {
            void saveName();
            anchor();
            onClose();
          }}
        >
          <X size={20} aria-hidden="true" />
        </IconButton>
        <div>
          <small>
            {t(
              `Line ${index + 1} of ${invoice.lines.length}`,
              `ردیف ${index + 1} از ${invoice.lines.length}`,
            )}
          </small>
          <strong>
            <LtrValue value={english} />
          </strong>
        </div>
      </header>
      <ReadingCheckProvider
        fields={line.low_confidence_fields}
        idPrefix={`invoice-check-line-${index}`}
        onAcknowledge={() => {}}
        record={line}
        onNotOnInvoice={(field) =>
          update((draft, actor) => {
            acknowledgeInvoiceFieldAbsence(draft, actor, field, index);
            return true;
          })
        }
      >
        <div
          className="receiving-editor-body"
          ref={editorBody}
          style={
            {
              "--receiving-editor-reserved-height": reservedBodyHeight
                ? `${reservedBodyHeight}px`
                : undefined,
            } as import("react").CSSProperties
          }
        >
          {checkCount > 0 && (
            <p className="receiving-editor-check-note">
              <span aria-hidden="true" />
              {t(
                `${checkCount} highlighted ${checkCount === 1 ? "field" : "fields"}: compare ${checkCount === 1 ? "it" : "them"} with the original before you confirm.`,
                `${checkCount} فیلد مشخص‌شده: پیش از تأیید با اصل فاکتور مقایسه کنید.`,
              )}
            </p>
          )}
          <div className="receiving-editor-columns">
            <section className="receiving-product-section">
              <h3>{t("Product", "کالا")}</h3>
              <div className="receiving-product-grid">
                <Field
                  className="receiving-full"
                  label={t("Matched product", "کالای مرتبط")}
                  readingField="product_code"
                  readingHint={t(
                    "Check the match against the product and pack printed on the invoice.",
                    "تطبیق کالا و بسته‌بندی را با موارد چاپ‌شده روی فاکتور بررسی کنید.",
                  )}
                  hint={
                    importedMatch &&
                    product &&
                    (importedMatch.earlier_delivery || checkMatch) ? (
                      <>
                        {importedMatch.earlier_delivery && (
                          <>
                            {t("Matched to “", "تطبیق با «")}
                            <bdi dir="auto">
                              {lang === "fa" && product.name_fa
                                ? product.name_fa
                                : product.name_en}
                            </bdi>
                            {t(
                              "” from an earlier delivery.",
                              "» از دریافت قبلی.",
                            )}
                          </>
                        )}
                        {checkMatch && (
                          <>
                            {" "}
                            <Badge tone="pending">
                              {t("Check the match", "تطبیق را بررسی کنید")}
                            </Badge>
                          </>
                        )}
                      </>
                    ) : undefined
                  }
                >
                  <Select
                    id={id("matching")}
                    value={line.product_code}
                    onChange={(value) =>
                      edit(
                        "product_code",
                        (item) => {
                          const matched = state.products.find(
                            (x) =>
                              x.company_id === invoice.company_id &&
                              x.code === value,
                          );
                          item.product_code = value;
                          item.reading_product_match = undefined;
                          item.supplier_item_id = undefined;
                          item.pricing_category =
                            matched?.pricing_category ?? "";
                          item.date_tracking = matched?.date_tracking ?? false;
                          item.date_confirmed = true;
                        },
                        true,
                      )
                    }
                    options={[
                      { value: "NEW", label: t("New product", "کالای جدید") },
                      ...state.products
                        .filter(
                          (x) =>
                            x.company_id === invoice.company_id &&
                            x.status !== "archived",
                        )
                        .map((x) => ({
                          value: x.code,
                          label: `${x.name_en} · ${x.code}`,
                        })),
                    ]}
                  />
                </Field>
                <div className="receiving-full">
                  <Field
                    readingField="description"
                    label={t("English name", "نام انگلیسی")}
                    error={nameError}
                  >
                    <input
                      id={id("name-en")}
                      dir="ltr"
                      value={english}
                      onChange={(e) => {
                        const inputValue = e.currentTarget.value;
                        setEnglish(inputValue);
                      }}
                      onBlur={() => {
                        void saveName();
                      }}
                    />
                  </Field>
                  {line.new_name_suggestion && (
                    <div className="receiving-name-suggestion">
                      <span>
                        {t("Suggested name:", "نام پیشنهادی:")}{" "}
                        <LtrValue value={line.new_name_suggestion} />
                      </span>
                      <Button
                        variant="plain"
                        size="sm"
                        disabled={english === line.new_name_suggestion}
                        aria-label={t(
                          `Use '${line.new_name_suggestion}' as the name`,
                          `استفاده از «${line.new_name_suggestion}» به‌عنوان نام`,
                        )}
                        onClick={() => {
                          const value = line.new_name_suggestion!;
                          setEnglish(value);
                          edit("description", (item) => {
                            item.new_name_en = value;
                          });
                        }}
                      >
                        {english === line.new_name_suggestion
                          ? t("Name applied", "نام اعمال شد")
                          : t("Use this name", "استفاده از این نام")}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="receiving-full">
                  <Field
                    label={t("Persian name (optional)", "نام فارسی (اختیاری)")}
                  >
                    <input
                      id={id("name-fa")}
                      dir="rtl"
                      value={persian}
                      onChange={(e) => {
                        const inputValue = e.currentTarget.value;
                        setPersian(inputValue);
                      }}
                      onBlur={() => {
                        if (
                          persian !==
                          (line.new_name_fa ?? product?.name_fa ?? "")
                        )
                          edit("new_name_fa", (item) => {
                            item.new_name_fa = persian;
                          });
                      }}
                    />
                  </Field>
                </div>
                <Field
                  readingField="pricing_category"
                  label={t("Pricing category", "دسته قیمت‌گذاری")}
                  error={categoryError}
                >
                  <Select
                    id={id("category")}
                    value={
                      line.pricing_category ?? product?.pricing_category ?? ""
                    }
                    onChange={(value) =>
                      edit(
                        "pricing_category",
                        (item, draft) =>
                          setInvoiceLineCategory(item, value, draft.config),
                        true,
                      )
                    }
                    options={[
                      {
                        value: "",
                        label: t(
                          "Choose a pricing category",
                          "انتخاب دسته قیمت‌گذاری",
                        ),
                      },
                      ...state.config.pricing_categories.map((x) => ({
                        value: x.key,
                        label: t(
                          x.label,
                          (
                            {
                              grocery: "خواربار",
                              grocery_taxable: "خواربار مشمول مالیات",
                              rice: "برنج",
                              kitchenware: "لوازم آشپزخانه",
                            } as Record<string, string>
                          )[x.key] ?? x.label,
                        ),
                      })),
                    ]}
                  />
                </Field>
                <Field
                  readingField="supplier_item_code"
                  label={t("Supplier code", "کد تأمین‌کننده")}
                  hint={
                    line.supplier_item_code_inferred
                      ? t("Filled from the name", "از نام پر شده است")
                      : undefined
                  }
                >
                  <BufferedInput
                    id={id("supplier-code")}
                    aria-label={t(
                      "Supplier item code (optional)",
                      "کد کالای تأمین‌کننده (اختیاری)",
                    )}
                    dir="ltr"
                    value={line.supplier_item_code ?? ""}
                    onChange={(e) => {
                      const inputValue = e.currentTarget.value;
                      edit("supplier_item_code", (item) => {
                        item.supplier_item_code = inputValue;
                        item.supplier_item_code_inferred = false;
                      });
                    }}
                  />
                </Field>
              </div>
            </section>
            <section className="receiving-quantity-section">
              <h3>{t("Quantity and cost", "تعداد و هزینه")}</h3>
              <div
                className={`receiving-quantity-grid${line.quantity_unit === "cases" ? " is-cases" : ""}`}
              >
                <Field readingField="quantity_unit" label={t("Unit", "واحد")}>
                  <Select
                    id={id("unit")}
                    value={
                      line.sold_by === "weight"
                        ? (line.quantity_unit ?? "kg")
                        : (line.quantity_unit ?? "units")
                    }
                    onChange={(value) =>
                      edit(
                        "quantity_unit",
                        (item) => {
                          if (value === "kg" || value === "lb") {
                            selectInvoiceWeightUnit(item, value, state.config);
                            onQuantity(
                              item,
                              item.quantity_entered ?? item.qty_invoiced,
                              value,
                            );
                          } else
                            onQuantity(
                              item,
                              item.quantity_entered ?? item.qty_invoiced,
                              value as "cases" | "units",
                            );
                        },
                        true,
                      )
                    }
                    options={[
                      { value: "cases", label: t("Cases", "کارتن") },
                      { value: "units", label: t("Units", "واحد") },
                      { value: "kg", label: t("Weight (kg)", "وزن (کیلوگرم)") },
                      { value: "lb", label: t("Weight (lb)", "وزن (پوند)") },
                    ]}
                  />
                </Field>
                <Field
                  readingField="quantity_entered"
                  label={
                    line.quantity_unit === "cases"
                      ? t("Cases invoiced", "کارتن‌های فاکتور شده")
                      : line.sold_by === "weight"
                        ? t("Invoiced weight", "وزن فاکتور شده")
                        : t("Invoiced units", "واحدهای فاکتور شده")
                  }
                  error={quantityError}
                >
                  <NumberField
                    keepTyping
                    id={id("invoiced")}
                    dir="ltr"
                    min="0"
                    step={line.sold_by === "weight" ? "0.001" : "1"}
                    value={
                      line.sold_by === "weight"
                        ? (line.source_quantity ?? "")
                        : (line.quantity_entered ?? line.qty_invoiced)
                    }
                    onChange={(value) =>
                      edit(
                        "quantity_entered",
                        (item) =>
                          onQuantity(
                            item,
                            value,
                            item.quantity_unit ?? "units",
                          ),
                        true,
                      )
                    }
                  />
                </Field>
                {line.quantity_unit === "cases" &&
                  line.sold_by !== "weight" && (
                    <Field
                      readingField="units_per_case"
                      label={t("Units per case", "واحد در کارتن")}
                      error={
                        showErrors && failedField === "units_per_case"
                          ? t(
                              "Enter a valid number of units per case.",
                              "تعداد معتبر واحد در هر کارتن را وارد کنید.",
                            )
                          : undefined
                      }
                    >
                      <NumberField
                        keepTyping
                        id={id("pack")}
                        aria-label={t("Units per case", "واحد در هر کارتن")}
                        dir="ltr"
                        min="1"
                        step="1"
                        value={line.units_per_case ?? 1}
                        onChange={(value) =>
                          edit(
                            "units_per_case",
                            (item) => {
                              item.units_per_case = Number(value);
                              onQuantity(
                                item,
                                item.quantity_entered ?? 1,
                                "cases",
                                Number(value),
                              );
                            },
                            true,
                          )
                        }
                      />
                    </Field>
                  )}
                <Field
                  label={t("Delivered", "تحویل‌شده")}
                  error={receivedError}
                >
                  <NumberField
                    keepTyping
                    id={id("delivered")}
                    aria-label={t("Delivered units", "واحدهای تحویل‌شده")}
                    dir="ltr"
                    min="0"
                    step={line.sold_by === "weight" ? "0.001" : "1"}
                    value={
                      line.sold_by === "weight"
                        ? (line.source_received_quantity ?? "")
                        : line.qty_received_at_posting
                    }
                    onChange={(value) =>
                      edit(
                        "qty_received_at_posting",
                        (item) => {
                          if (item.sold_by === "weight")
                            setInvoiceWeightReceived(item, value, state.config);
                          else item.qty_received_at_posting = Number(value);
                        },
                        true,
                      )
                    }
                  />
                </Field>
                {line.quantity_unit === "cases" && (
                  <Field
                    readingField="case_cost_before_tax"
                    label={t("Case cost", "هزینه کارتن")}
                    error={caseCostError}
                  >
                    <BufferedInput
                      id={id("case-cost")}
                      aria-label={t(
                        "Case cost before tax",
                        "هزینه کارتن پیش از مالیات",
                      )}
                      dir="ltr"
                      inputMode="decimal"
                      value={line.case_cost_before_tax ?? ""}
                      onChange={(e) => {
                        const inputValue = e.currentTarget.value;
                        edit(
                          "case_cost_before_tax",
                          (item) => {
                            item.case_cost_before_tax = inputValue;
                            try {
                              item.unit_cost_before_tax = costPerUnit(
                                inputValue,
                                item.units_per_case ?? 1,
                              );
                            } catch {
                              /* Keep invalid cost for validation. */
                            }
                          },
                          true,
                        );
                      }}
                    />
                  </Field>
                )}
                <Field
                  readingField="unit_cost_before_tax"
                  label={
                    line.sold_by === "weight"
                      ? t(
                          `Cost per ${line.source_cost_unit ?? "lb"}`,
                          `هزینه هر ${line.source_cost_unit === "kg" ? "کیلوگرم" : "پوند"}`,
                        )
                      : t("Unit cost", "هزینه واحد")
                  }
                  error={costError}
                >
                  <BufferedInput
                    id={id("cost")}
                    aria-label={t(
                      "Unit cost before tax",
                      "هزینه هر واحد پیش از مالیات",
                    )}
                    dir="ltr"
                    inputMode="decimal"
                    value={
                      line.sold_by === "weight"
                        ? (line.source_cost_before_tax ?? "")
                        : line.unit_cost_before_tax
                    }
                    onChange={(e) => {
                      const inputValue = e.currentTarget.value;
                      edit(
                        "unit_cost_before_tax",
                        (item) => {
                          if (item.sold_by === "weight")
                            setInvoiceWeightCost(
                              item,
                              inputValue,
                              item.source_cost_unit ?? "lb",
                              state.config,
                            );
                          else {
                            item.converted_case_cost_before_tax = undefined;
                            item.converted_case_units_per_case = undefined;
                            item.unit_cost_before_tax = inputValue;
                            if (
                              /^\d+(\.\d{1,4})?$/.test(inputValue) &&
                              item.quantity_unit === "cases"
                            )
                              item.case_cost_before_tax = costPerCase(
                                inputValue,
                                item.units_per_case ?? 1,
                              );
                          }
                        },
                        true,
                      );
                    }}
                  />
                </Field>
              </div>
              {line.quantity_unit === "cases" && line.sold_by !== "weight" && (
                <p className="receiving-pack-equation">
                  <LtrValue
                    value={t(
                      `${line.quantity_entered ?? 0} cases × ${line.units_per_case ?? 1} units = ${line.qty_invoiced} units`,
                      `${line.quantity_entered ?? 0} کارتن × ${line.units_per_case ?? 1} واحد = ${line.qty_invoiced} واحد`,
                    )}
                  />
                </p>
              )}
              <div className="receiving-printed-total">
                <span>
                  {t("Line total on paper:", "جمع ردیف روی فاکتور:")}{" "}
                  <Money value={line.line_total} />
                  {calculated && calculated !== line.line_total && (
                    <>
                      {" "}
                      · {t("Calculated:", "محاسبه‌شده:")}{" "}
                      <Money value={calculated} />
                    </>
                  )}
                </span>
                <Button
                  variant="plain"
                  size="sm"
                  aria-expanded={printedOpen}
                  onClick={() => setPrintedOpen(!printedOpen)}
                >
                  {t("Edit", "ویرایش")}
                </Button>
              </div>
              {printedOpen && (
                <Field
                  readingField="line_total"
                  label={t("Printed line total", "جمع چاپ‌شده ردیف")}
                  hint={
                    calculated && calculated !== line.line_total
                      ? t(
                          `Calculated: ${money(calculated)}`,
                          `محاسبه‌شده: ${money(calculated)}`,
                        )
                      : undefined
                  }
                >
                  <BufferedInput
                    id={id("line-total")}
                    dir="ltr"
                    inputMode="decimal"
                    value={line.line_total}
                    onChange={(e) => {
                      const inputValue = e.currentTarget.value;
                      edit("line_total", (item) => {
                        item.line_total = inputValue;
                      });
                    }}
                  />
                </Field>
              )}
            </section>
          </div>
          <div className="receiving-editor-bottom">
            <section className="receiving-tax-section">
              <Field
                readingField="taxable"
                label={t("Taxable", "مشمول مالیات")}
              >
                <SegmentedControl
                  id={id("taxable")}
                  aria-label={t("Taxable", "مشمول مالیات")}
                  value={String(line.taxable)}
                  options={[
                    { value: "false", label: t("No", "خیر") },
                    { value: "true", label: t("Yes", "بله") },
                  ]}
                  onChange={(value) =>
                    edit(
                      "taxable",
                      (item) => {
                        item.taxable = value === "true";
                        item.taxable_inferred = false;
                        const category = state.config.pricing_categories.find(
                          (x) => x.key === item.pricing_category,
                        );
                        const configuredProfile =
                          state.config.tax.profiles.find(
                            (x) =>
                              x.key === category?.default_tax_profile &&
                              new Decimal(x.rate).gt(0),
                          ) ??
                          state.config.tax.profiles.find((x) =>
                            new Decimal(x.rate).gt(0),
                          );
                        item.tax_profile =
                          value === "true"
                            ? (configuredProfile?.key ?? "non_taxable")
                            : "non_taxable";
                      },
                      true,
                    )
                  }
                />
              </Field>
            </section>
            <section className="receiving-date-section">
              <Field label={t("Track dates", "پیگیری تاریخ‌ها")}>
                <SegmentedControl
                  id={id("date-tracking")}
                  aria-label={t("Track date", "پیگیری تاریخ")}
                  value={String(line.date_tracking ?? false)}
                  options={[
                    {
                      value: "false",
                      label: t("No", "خیر"),
                      disabled: !!line.short_dated,
                    },
                    { value: "true", label: t("Yes", "بله") },
                  ]}
                  onChange={(value) =>
                    edit("date_tracking", (item) => {
                      item.date_tracking = value === "true";
                      item.date_confirmed = true;
                      if (
                        value === "true" &&
                        !item.date_value &&
                        item.expiry_as_printed &&
                        /^\d{4}-\d{2}-\d{2}$/.test(item.expiry_as_printed)
                      )
                        item.date_value = item.expiry_as_printed;
                    })
                  }
                />
              </Field>
              {line.date_tracking && (
                <div className="receiving-date-fields">
                  <Field label={t("Date type", "نوع تاریخ")}>
                    <Select
                      value={line.date_type ?? "expiry"}
                      options={[
                        { value: "expiry", label: t("Expiry", "انقضا") },
                        {
                          value: "best_before",
                          label: t("Best before", "بهترین زمان مصرف"),
                        },
                      ]}
                      onChange={(value) =>
                        edit("date_type", (item) => {
                          item.date_type = value as "expiry" | "best_before";
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t("Date", "تاریخ")}
                    hint={
                      line.expiry_as_printed
                        ? t(
                            `Expiry as printed: ${line.expiry_as_printed}`,
                            `تاریخ چاپ‌شده: ${line.expiry_as_printed}`,
                          )
                        : undefined
                    }
                  >
                    <DateField
                      id={id("date")}
                      value={line.date_value ?? ""}
                      onChange={(value) =>
                        edit("date_value", (item) => {
                          item.date_value = value;
                          item.date_confirmed = true;
                        })
                      }
                    />
                  </Field>
                </div>
              )}
            </section>
            <section className="receiving-line-price">
              <div className="receiving-selling-price">
                <div>
                  <span>{t("Selling price", "قیمت فروش")}</span>
                  <strong className="price-display numeric">
                    {workspace.lineDetails[index]?.price ? (
                      <Money
                        value={
                          line.short_dated
                            ? product?.branch_prices?.[invoice.branch] ||
                              product?.selling_price ||
                              workspace.lineDetails[index]!.price!
                            : workspace.lineDetails[index]!.price!
                        }
                      />
                    ) : (
                      t("Not added", "اضافه نشده")
                    )}
                  </strong>
                </div>
                <div className="receiving-approved-price">
                  <span>{t("Approved:", "تأییدشده:")}</span>
                  {product?.branch_prices?.[invoice.branch] ||
                  product?.selling_price ? (
                    <Money
                      value={
                        product.branch_prices?.[invoice.branch] ||
                        product.selling_price!
                      }
                    />
                  ) : (
                    t("No approved price yet", "هنوز قیمت تأییدشده‌ای نیست")
                  )}
                </div>
              </div>
              {line.short_dated && (
                <p className="muted">
                  {t(
                    "Regular cost and selling price stay unchanged.",
                    "هزینه عادی و قیمت فروش بدون تغییر می‌مانند.",
                  )}
                </p>
              )}
            </section>
          </div>
          {lowerCost && (
            <Field label={t("Lower-cost receipt", "دریافت با هزینه کمتر")}>
              <SegmentedControl
                aria-label={t("Lower-cost receipt", "دریافت با هزینه کمتر")}
                value={line.short_dated ? "short_dated" : "regular"}
                options={[
                  {
                    value: "regular",
                    label: t("Regular receipt", "دریافت عادی"),
                  },
                  {
                    value: "short_dated",
                    label: t(
                      "Short-dated (expiry discount)",
                      "نزدیک انقضا (تخفیف انقضا)",
                    ),
                  },
                ]}
                onChange={(value) =>
                  edit("short_dated", (item) => {
                    item.short_dated = value === "short_dated";
                    if (item.short_dated) {
                      item.date_tracking = true;
                      item.date_confirmed = true;
                      item.date_type = "expiry";
                      item.order_price_decision = "short_dated";
                    } else item.order_price_decision = undefined;
                  })
                }
              />
            </Field>
          )}
          {workspace.lineDetails[index]?.manualReplacement &&
            !line.short_dated && (
              <section>
                <Field label={t("Manual price decision", "تصمیم قیمت دستی")}>
                  <SegmentedControl
                    id={id("manual")}
                    aria-label={t("Manual price decision", "تصمیم قیمت دستی")}
                    value={line.manual_price_decision ?? ""}
                    options={[
                      {
                        value: "keep",
                        label: t(
                          `Keep ${money(workspace.lineDetails[index]!.manualReplacement!.price)}`,
                          `حفظ ${money(workspace.lineDetails[index]!.manualReplacement!.price)}`,
                        ),
                      },
                      {
                        value: "rule",
                        label: t(
                          `Use the new calculated price ${workspace.lineDetails[index]?.price ? money(workspace.lineDetails[index]!.price!) : ""}`,
                          `استفاده از قیمت محاسبه‌شده جدید ${workspace.lineDetails[index]?.price ? money(workspace.lineDetails[index]!.price!) : ""}`,
                        ),
                      },
                    ]}
                    onChange={(value) =>
                      edit("manual_price_decision", (item) => {
                        item.manual_price_decision = value as "keep" | "rule";
                      })
                    }
                  />
                </Field>
              </section>
            )}
          <Disclosure
            className="receiving-more"
            summary={t("More details", "جزئیات بیشتر")}
            open={more}
            onToggle={(e) => setMore(e.currentTarget.open)}
          >
            <div className="detail-grid ui-fields-align-labels">
              {moreKeys.map((key) => {
                const labels: Record<string, [string, string]> = {
                  barcode: ["Barcode on the invoice", "بارکد روی فاکتور"],
                  lot_number: ["Lot number", "شماره سری ساخت"],
                  expiry_as_printed: [
                    "Expiry as printed",
                    "تاریخ انقضای چاپ‌شده",
                  ],
                  description: ["Printed description", "شرح چاپ‌شده"],
                  handwritten_note: ["Handwritten note", "یادداشت دست‌نویس"],
                };
                return (
                  <Field key={key} readingField={key} label={t(...labels[key])}>
                    <BufferedInput
                      id={id(key)}
                      dir="ltr"
                      value={String(
                        (line as unknown as Record<string, unknown>)[key] ?? "",
                      )}
                      onChange={(e) => {
                        const inputValue = e.currentTarget.value;
                        edit(key, (item) => {
                          (item as unknown as Record<string, unknown>)[key] =
                            inputValue;
                        });
                      }}
                    />
                  </Field>
                );
              })}
            </div>
          </Disclosure>
          {shortOpen && (
            <section className="list-box">
              <h3>{t("Report short or refused", "گزارش کسری یا مرجوعی")}</h3>
              <div className="detail-grid">
                <Field label={t("Short units", "واحدهای کسری")}>
                  <NumberField
                    keepTyping
                    min="0"
                    dir="ltr"
                    value={short}
                    onChange={setShort}
                  />
                </Field>
                <Field label={t("Refused units", "واحدهای ردشده")}>
                  <NumberField
                    keepTyping
                    min="0"
                    dir="ltr"
                    value={refused}
                    onChange={setRefused}
                  />
                </Field>
                <Field label={t("Reason", "دلیل")}>
                  <input
                    value={reason}
                    onChange={(e) => {
                      const inputValue = e.currentTarget.value;
                      setReason(inputValue);
                    }}
                  />
                </Field>
              </div>
              <p>
                {t("Delivered units", "واحدهای تحویل‌شده")}:{" "}
                <LtrValue
                  value={String(
                    Math.max(0, line.qty_invoiced - Number(short || 0)),
                  )}
                />
              </p>
              <p>
                {t("Deduction:", "کسر:")}{" "}
                <LtrText>
                  <LtrValue
                    value={new Decimal(short || 0)
                      .plus(refused || 0)
                      .toString()}
                  />{" "}
                  {t("units", "واحد")} ×{" "}
                  <Money
                    value={line.unit_cost_before_tax || "0"}
                    decimals={4}
                    fixedDecimals
                    currency={state.config.company.currency}
                  />{" "}
                  ={" "}
                  <Money
                    value={deduction}
                    currency={state.config.company.currency}
                  />
                </LtrText>
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  void update((draft) => {
                    const item = draft.invoice.lines[index];
                    const wasConfirmed = item.review_confirmed;
                    clearInvoiceOrderLine(item);
                    item.qty_received_at_posting = Math.max(
                      0,
                      item.qty_invoiced - Number(short || 0),
                    );
                    item.refused_units = Number(refused || 0);
                    item.handwritten_note = [item.handwritten_note, reason]
                      .filter(Boolean)
                      .join(" · ");
                    item.review_changed_after_confirmation ||= wasConfirmed;
                    item.review_confirmed = false;
                    recalculateInvoice(draft.invoice, draft.config);
                  });
                }}
              >
                {t("Apply", "اعمال")}
              </Button>
            </section>
          )}
          {failure && (
            <p role="alert" className="form-error">
              {failure}
            </p>
          )}
        </div>
        <footer className="receiving-line-footer">
          <div className="actions receiving-line-secondary-actions">
            <Button
              className="receiving-line-remove"
              variant="destructive"
              size="sm"
              onClick={() => setRemoveOpen(true)}
            >
              {t("Remove line", "حذف ردیف")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t("Report short or refused", "گزارش کسری یا مرجوعی")}
              onClick={() => setShortOpen(!shortOpen)}
            >
              <span className="receiving-report-desktop">
                {t("Report short or refused", "گزارش کسری یا مرجوعی")}
              </span>
              <span className="receiving-report-phone">
                {t("Report short/refused", "گزارش کسری/مرجوعی")}
              </span>
            </Button>
          </div>
          <div className="actions receiving-line-confirm-actions">
            <Button
              className="receiving-line-close"
              variant="secondary"
              onClick={() => {
                void saveName();
                anchor();
                onClose();
              }}
            >
              {t("Close", "بستن")}
            </Button>
            <Button
              className="receiving-line-confirm"
              id={id("confirm")}
              onClick={() => {
                void confirm();
              }}
            >
              <Check size={18} aria-hidden="true" />
              {t("Confirm line", "تأیید ردیف")}
            </Button>
          </div>
        </footer>
      </ReadingCheckProvider>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t("Remove line?", "ردیف حذف شود؟")}
        description={t(
          "Remove this line from the draft invoice.",
          "این ردیف از پیش‌نویس فاکتور حذف می‌شود.",
        )}
        confirmLabel={t("Remove line", "حذف ردیف")}
        onConfirm={async () => {
          await update((draft, actor) =>
            removeInvoiceLine(draft, actor, index),
          );
          onClose();
        }}
      />
    </section>
  );
}
