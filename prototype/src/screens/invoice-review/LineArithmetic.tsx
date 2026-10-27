import Decimal from "decimal.js";
import type { InvoiceEditableLine } from "../../invoice-edit-types";
import {
  invoicePaperTotalMismatch,
  invoiceWeightDisplayedCost,
  invoiceWeightDisplayedQuantity,
  setInvoiceWeightCaseCost,
  setInvoiceWeightCost,
} from "../../invoice-weight";
import { useDemo } from "../../store";
import { Button } from "../../ui";
import { LtrValue } from "../../presentation";

export function LineArithmetic({
  line,
  edit,
  acknowledge,
}: {
  line: InvoiceEditableLine;
  edit(
    field: string,
    change: (item: InvoiceEditableLine) => void,
    recalculate?: boolean,
  ): void;
  acknowledge?: () => void;
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
  return (
    <>
      {hasCase && (
        <p className="receiving-pack-equation">
          <LtrValue
            value={t(
              `${cases} cases × ${line.case_weight} ${line.case_weight_unit} = ${line.source_quantity || "0"} ${line.source_quantity_unit ?? "lb"} · ${money(line.case_cost_before_tax!)} ÷ ${line.case_weight} ${line.case_weight_unit} = ${money(line.source_cost_before_tax || "0")}/${line.source_cost_unit ?? "lb"}`,
              `${cases} کارتن × ${line.case_weight} ${line.case_weight_unit} = ${line.source_quantity || "0"} ${line.source_quantity_unit ?? "lb"} · ${money(line.case_cost_before_tax!)} ÷ ${line.case_weight} ${line.case_weight_unit} = ${money(line.source_cost_before_tax || "0")}/${line.source_cost_unit ?? "lb"}`,
            )}
          />
        </p>
      )}
      {mismatch && (
        <div className="receiving-paper-mismatch" role="alert">
          <p>
            {t(
              `${line.quantity_unit === "cases" ? line.quantity_entered : weight ? invoiceWeightDisplayedQuantity(line) : line.qty_invoiced} ${line.quantity_unit ?? "units"} × ${money(line.quantity_unit === "cases" ? line.case_cost_before_tax || "0" : weight ? invoiceWeightDisplayedCost(line) : line.unit_cost_before_tax)} = ${money(mismatch.calculated)} but the paper says ${money(mismatch.paper)}.`,
              `جمع محاسبه‌شده ${money(mismatch.calculated)} است اما روی فاکتور ${money(mismatch.paper)} نوشته شده است.`,
            )}
          </p>
          <div className="button-row">
            {fixCost && (
              <Button
                variant="plain"
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
                variant="plain"
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
              <Button variant="plain" size="sm" onClick={acknowledge}>
                {t("Paper total is wrong", "جمع روی فاکتور اشتباه است")}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
