import { invoiceDisplayPaperMismatch as invoicePaperTotalMismatch } from "../../invoice-display-arithmetic";
import Decimal from "decimal.js";
import type { InvoiceEditableLine } from "../../invoice-edit-types";
import {
  invoiceWeightDisplayedCost,
  invoiceWeightDisplayedQuantity,
  setInvoiceWeightCaseCost,
  setInvoiceWeightCost,
} from "../../invoice-weight";
import { useDemo } from "../../store";
import { Button } from "../../ui";
import { LtrValue } from "../../presentation";
import { countedWord } from "./counted-word";

/**
 * PR 29 (item 11): the math check and the paper line total are one compact
 * box. Its choices are real shared buttons.
 */
export function LineArithmetic({
  line,
  edit,
  acknowledge,
  paper,
  packEquation,
}: {
  line: InvoiceEditableLine;
  edit(
    field: string,
    change: (item: InvoiceEditableLine) => void,
    recalculate?: boolean,
  ): void;
  acknowledge?: () => void;
  paper: {
    calculated?: string;
    open: boolean;
    onToggle(): void;
  };
  /** The ordinary case/unit equation, shown as the box's quiet second line. */
  packEquation?: string;
}) {
  const { t, money, state } = useDemo();
  const mismatch = invoicePaperTotalMismatch(line);
  const hasCase =
    line.sold_by === "weight" &&
    !!line.case_weight &&
    !!line.case_weight_unit &&
    !!line.case_cost_before_tax;
  let cases = "";
  try {
    cases =
      line.quantity_unit === "cases"
        ? String(line.quantity_entered ?? "")
        : new Decimal(line.source_quantity || "0")
            .times(
              line.source_quantity_unit === "kg"
                ? (line.weight_conversion_factor ?? "2.20462")
                : "1",
            )
            .div(
              new Decimal(line.case_weight || "1").times(
                line.case_weight_unit === "kg"
                  ? (line.weight_conversion_factor ?? "2.20462")
                  : "1",
              ),
            )
            .toString();
  } catch {
    /* An incomplete field keeps its validation message. */
  }
  const weight = line.sold_by === "weight";
  const quantity = weight
    ? line.source_quantity || "0"
    : String(line.qty_invoiced);
  const fixCost =
    mismatch && new Decimal(quantity).gt(0)
      ? new Decimal(mismatch.paper).div(quantity).toFixed(4)
      : undefined;
  const fixCaseCost =
    mismatch && hasCase && new Decimal(cases || 0).gt(0)
      ? new Decimal(mismatch.paper).div(cases).toFixed(4)
      : undefined;
  const weightEquation = hasCase
    ? t(
        `${cases} ${countedWord(cases || 0, "case", "cases")} × ${line.case_weight} ${line.case_weight_unit} = ${line.source_quantity || "0"} ${line.source_quantity_unit ?? "lb"} · ${money(line.case_cost_before_tax!)} ÷ ${line.case_weight} ${line.case_weight_unit} = ${money(line.source_cost_before_tax || "0")}/${line.source_cost_unit ?? "lb"}`,
        `${cases} کارتن × ${line.case_weight} ${line.case_weight_unit} = ${line.source_quantity || "0"} ${line.source_quantity_unit ?? "lb"} · ${money(line.case_cost_before_tax!)} ÷ ${line.case_weight} ${line.case_weight_unit} = ${money(line.source_cost_before_tax || "0")}/${line.source_cost_unit ?? "lb"}`,
      )
    : packEquation;
  let difference = "";
  try {
    if (mismatch)
      difference = new Decimal(mismatch.calculated)
        .minus(mismatch.paper)
        .abs()
        .toFixed(2);
  } catch {
    difference = "";
  }
  const shownQuantity =
    line.quantity_unit === "cases"
      ? String(line.quantity_entered ?? "")
      : weight
        ? invoiceWeightDisplayedQuantity(line)
        : String(line.qty_invoiced);
  const shownUnit =
    line.quantity_unit === "cases"
      ? countedWord(shownQuantity || 0, "case", "cases")
      : line.quantity_unit === "kg" || line.quantity_unit === "lb"
        ? line.quantity_unit
        : countedWord(shownQuantity || 0, "unit", "units");
  return (
    <div
      className={`receiving-line-math${mismatch ? " receiving-paper-mismatch" : ""}`}
      role={mismatch ? "alert" : undefined}
    >
      <div className="receiving-printed-total">
        <span>
          {mismatch ? (
            t(
              `${shownQuantity} ${shownUnit} × ${money(line.quantity_unit === "cases" ? line.case_cost_before_tax || "0" : weight ? invoiceWeightDisplayedCost(line) : line.unit_cost_before_tax)} = ${money(mismatch.calculated)}, but the paper says ${money(mismatch.paper)}.`,
              `جمع محاسبه‌شده ${money(mismatch.calculated)} است اما روی فاکتور ${money(mismatch.paper)} نوشته شده است.`,
            )
          ) : (
            <>
              {t("Line total on paper:", "جمع ردیف روی فاکتور:")}{" "}
              <LtrValue
                value={money(line.paper_line_total ?? line.line_total)}
              />
              {paper.calculated && paper.calculated !== line.line_total && (
                <>
                  {" "}
                  · {t("Calculated:", "محاسبه‌شده:")}{" "}
                  <LtrValue value={money(paper.calculated)} />
                </>
              )}
            </>
          )}
        </span>
        <Button
          variant="plain"
          size="sm"
          aria-expanded={paper.open}
          onClick={paper.onToggle}
        >
          {mismatch
            ? t("Edit paper total", "ویرایش جمع روی فاکتور")
            : t("Edit", "ویرایش")}
        </Button>
      </div>
      {(weightEquation || (mismatch && difference)) && (
        <p className="receiving-pack-equation">
          {weightEquation && <LtrValue value={weightEquation} />}
          {mismatch && difference && (
            <>
              {weightEquation ? " · " : ""}
              {t("difference", "اختلاف")} <LtrValue value={money(difference)} />
            </>
          )}
        </p>
      )}
      {mismatch && (
        <div className="receiving-line-math-actions">
          {fixCost && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                edit(
                  "unit_cost_before_tax",
                  (item) => {
                    if (weight)
                      setInvoiceWeightCost(
                        item,
                        fixCost,
                        item.source_quantity_unit ?? "lb",
                        state.config,
                      );
                    else {
                      item.unit_cost_before_tax = fixCost;
                      item.imported_unit_cost_basis = undefined;
                      if (item.quantity_unit === "cases")
                        item.case_cost_before_tax = new Decimal(fixCost)
                          .times(item.units_per_case ?? 1)
                          .toFixed(4);
                    }
                  },
                  true,
                )
              }
            >
              {t(
                `Use ${money(fixCost)}/${weight ? (line.source_quantity_unit ?? "lb") : "unit"}`,
                `استفاده از ${money(fixCost)} برای هر واحد`,
              )}
            </Button>
          )}
          {fixCaseCost && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                edit(
                  "case_cost_before_tax",
                  (item) => {
                    item.weight_case_quantity = cases;
                    setInvoiceWeightCaseCost(item, fixCaseCost, state.config);
                  },
                  true,
                )
              }
            >
              {t(
                `Use ${money(fixCaseCost)} per case`,
                `استفاده از ${money(fixCaseCost)} برای هر کارتن`,
              )}
            </Button>
          )}
          {acknowledge && (
            <Button variant="secondary" size="sm" onClick={acknowledge}>
              {t("Paper total is wrong", "جمع روی فاکتور اشتباه است")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
