import type { InvoiceReadDTO } from "./invoice-projections";
import { Money } from "./presentation";
import { useDemo } from "./store";
import "./screens/live-invoice-reading.css";

/** Private reading expenditure is already removed by the protected projector. */
export function LiveReadingProvenance({
  invoice,
}: {
  invoice: InvoiceReadDTO;
}) {
  const { actor, t } = useDemo();
  const record = invoice.reading_record;
  if (
    !actor ||
    !["owner", "manager"].includes(actor.role) ||
    record?.source !== "live" ||
    typeof record.seconds !== "number" ||
    !Number.isFinite(record.seconds) ||
    !record.reading_cost_usd
  )
    return null;
  return (
    <p
      className="helper live-reading-provenance"
      data-testid="live-reading-provenance"
    >
      {t("Read by AI", "خوانده‌شده با هوش مصنوعی")}
      {" · "}
      <bdi>
        {Math.round(record.seconds)} {t("s", "ثانیه")}
      </bdi>
      {" · "}
      <Money
        value={record.reading_cost_usd}
        currency="USD"
        decimals={2}
        fixedDecimals
      />
      {" USD"}
      {Boolean(record.models?.length) && (
        <>
          {" · "}
          <bdi>{record.models.join(" + ")}</bdi>
        </>
      )}
    </p>
  );
}
