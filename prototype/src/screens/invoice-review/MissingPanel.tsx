import { useDemo } from "../../store";
import { Button } from "../../ui";
import { missingGroups } from "./missing-groups";
import type { InvoiceReadDTO } from "../../invoice-projections";
export function MissingPanel({
  invoice,
  blockers,
  blockerLineIndexes,
  onShow,
}: {
  invoice: InvoiceReadDTO;
  blockers: readonly string[];
  blockerLineIndexes: Readonly<Record<string, readonly number[] | undefined>>;
  onShow(target: string, line?: number): void;
}) {
  const { t } = useDemo();
  return (
    <section
      className="list-box receiving-missing"
      id="invoice-missing-list"
      role="alert"
      aria-label={t("What's missing", "موارد ناقص")}
      tabIndex={-1}
    >
      <h2>{t("What's missing", "موارد ناقص")}</h2>
      {missingGroups(invoice, t, blockers, blockerLineIndexes).map(
        (group, index) => (
          <div
            className="receiving-missing-row"
            key={`${group.target}:${index}`}
          >
            <span>{group.label}</span>
            <Button
              variant="plain"
              size="sm"
              onClick={() => onShow(group.target, group.line)}
            >
              {t("Show", "نمایش")}
            </Button>
          </div>
        ),
      )}
    </section>
  );
}
