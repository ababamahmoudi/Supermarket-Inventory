import { X } from "lucide-react";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { useDemo } from "../../store";
import { Button, SegmentedControl, Select } from "../../ui";
import { LtrValue } from "../../presentation";
import { ReadingMoney as Money } from "../../InvoiceReadingReview";

type Charge = NonNullable<InvoiceReadDTO["other_charges"]>[number];

/**
 * PR 29 (Ali, 2026-11-20): a discount or credit applies to the invoice total
 * or to chosen items. Nothing is preselected; until someone picks it is a
 * highlighted check and the invoice cannot be posted.
 */
export function CreditAppliesTo({
  index,
  charge,
  lines,
  lineName,
  checked,
  onChange,
}: {
  index: number;
  charge: Charge;
  lines: { id: string; name: string }[];
  lineName(id: string): string;
  checked: boolean;
  onChange(
    appliesTo: "invoice_total" | "chosen_items",
    lineIds: string[],
  ): void;
}) {
  const { t } = useDemo();
  const id = `invoice-check-charge-${index}-input-applies_to`;
  const chosen = charge.chosen_line_ids ?? [];
  const label = t("Applies to", "اعمال روی");
  const available = lines.filter((line) => !chosen.includes(line.id));
  return (
    <div
      className={`receiving-credit${checked ? " please-check-field" : ""}`}
      id={`invoice-check-charge-${index}-applies_to`}
    >
      <div className="receiving-credit-choice">
        <span className="receiving-credit-label" id={`${id}-label`}>
          {label}
          {checked && (
            <span className="reading-check-marker" aria-hidden="true">
              !
            </span>
          )}
        </span>
        <SegmentedControl
          id={id}
          aria-labelledby={`${id}-label`}
          value={charge.applies_to ?? ""}
          options={[
            {
              value: "invoice_total",
              label: t("Invoice total", "جمع فاکتور"),
            },
            {
              value: "chosen_items",
              label: t("Chosen items", "کالاهای انتخابی"),
            },
          ]}
          onChange={(value) =>
            onChange(
              value as "invoice_total" | "chosen_items",
              value === "chosen_items" ? chosen : [],
            )
          }
        />
      </div>
      {checked && (
        <p className="receiving-credit-question" role="status">
          {charge.applies_to === "chosen_items"
            ? t(
                "Add the items this credit is for.",
                "کالاهایی را که این اعتبار برای آن‌هاست اضافه کنید.",
              )
            : t(
                "Choose whether this lowers the invoice total or the cost of chosen items.",
                "انتخاب کنید که این مبلغ جمع فاکتور را کم کند یا هزینهٔ کالاهای انتخابی را.",
              )}
        </p>
      )}
      {charge.applies_to === "chosen_items" && (
        <>
          <div className="receiving-credit-items">
            {chosen.map((lineId) => (
              <span className="receiving-credit-chip" key={lineId}>
                <LtrValue value={lineName(lineId)} />
                <Button
                  variant="plain"
                  size="sm"
                  className="ui-icon-button"
                  aria-label={t(
                    `Remove ${lineName(lineId)}`,
                    `حذف ${lineName(lineId)}`,
                  )}
                  onClick={() =>
                    onChange(
                      "chosen_items",
                      chosen.filter((item) => item !== lineId),
                    )
                  }
                >
                  <X size={14} aria-hidden="true" />
                </Button>
              </span>
            ))}
            {available.length > 0 && (
              <Select
                searchable
                className="receiving-credit-add"
                aria-label={t(
                  `Add an item to charge ${index + 1}`,
                  `افزودن کالا به هزینه ${index + 1}`,
                )}
                value=""
                options={[
                  {
                    value: "",
                    label: t("+ Add item", "+ افزودن کالا"),
                    placeholder: true,
                  },
                  ...available.map((line) => ({
                    value: line.id,
                    label: line.name,
                  })),
                ]}
                onChange={(value) =>
                  value && onChange("chosen_items", [...chosen, value])
                }
              />
            )}
          </div>
          {(charge.allocations ?? []).length > 0 && (
            <p className="receiving-credit-info">
              {t("Split by line total.", "به نسبت جمع هر ردیف تقسیم شد.")}{" "}
              {(charge.allocations ?? []).map((allocation, position) => (
                <span key={allocation.line_id}>
                  {position > 0 && " · "}
                  <LtrValue value={lineName(allocation.line_id)} />
                  {": "}
                  {t("unit cost", "هزینه واحد")}{" "}
                  <Money
                    value={allocation.unit_cost_before}
                    decimals={4}
                    fixedDecimals
                  />{" "}
                  →{" "}
                  <Money
                    value={allocation.unit_cost_after}
                    decimals={4}
                    fixedDecimals
                  />
                </span>
              ))}
              {". "}
              {t(
                "Their suggested prices are worked out again from the new cost and go to Approvals as usual.",
                "قیمت پیشنهادی آن‌ها از هزینهٔ جدید دوباره حساب می‌شود و طبق روال به تأییدها می‌رود.",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
