import { ClipboardCheck } from "lucide-react";
import type { ProductReadDTO } from "../catalog-read-model";
import { useDemo } from "../store";
import { ProductName } from "../presentation";
import { ProductCost, ProductPrice } from "../weight-price-presentation";
import { Button, Checkbox, Dialog } from "../ui";
import Decimal from "decimal.js";
export interface InvoiceApprovalRow {
  id: string;
  product: ProductReadDTO;
  category: string;
  cost: string | null;
  price: string;
  margin: string | null;
  belowMinimum: boolean;
  individual: boolean;
}
export function InvoiceApprovalDialog({
  title,
  rows,
  selected,
  onSelect,
  onClose,
  onConfirm,
  busy,
  error,
}: {
  title: string;
  rows: readonly InvoiceApprovalRow[];
  selected: readonly string[];
  onSelect(ids: string[]): void;
  onClose(): void;
  onConfirm(): void;
  busy: boolean;
  error: string;
}) {
  const { state, lang, t, tCount } = useDemo();
  const eligible = rows.filter((row) => !row.individual).map((row) => row.id);
  const selectedIds = selected.filter((id) => eligible.includes(id));
  const blockedReason = busy
    ? t("Saving approvals…", "در حال ذخیره تأییدها…")
    : !selectedIds.length
      ? eligible.length
        ? t(
            "Select at least one product to approve.",
            "برای تأیید، دست‌کم یک کالا انتخاب کنید.",
          )
        : t(
            "These products need individual review.",
            "این کالاها به بررسی جداگانه نیاز دارند.",
          )
      : "";
  const allSelected =
    eligible.length > 0 && eligible.every((id) => selectedIds.includes(id));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={t("Review invoice approvals", "بررسی تأییدهای فاکتور")}
      description={title}
      icon={<ClipboardCheck size={22} aria-hidden="true" />}
      className="invoice-approval-dialog ui-form-surface"
      footer={
        <>
          <Button
            className="batch-approval-cancel"
            variant="neutral"
            disabled={busy}
            onClick={onClose}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <span
            className="batch-approval-status muted"
            role="status"
            data-blocked={Boolean(blockedReason)}
          >
            {blockedReason || "\u00a0"}
          </span>
          <Button
            className="batch-approval-confirm"
            variant={busy || !selectedIds.length ? "neutral" : "primary"}
            disabled={busy || !selectedIds.length}
            onClick={onConfirm}
          >
            {tCount(
              "Approve {{count}} product",
              "Approve {{count}} products",
              "تأیید {{count}} کالا",
              "تأیید {{count}} کالا",
              selectedIds.length,
            )}
          </Button>
        </>
      }
    >
      <div className="invoice-approval-table-wrap" aria-busy={busy}>
        <table className="invoice-approval-table">
          <colgroup>
            <col className="batch-select-column" />
            <col />
            <col className="batch-category-column" />
            <col className="batch-money-column" />
            <col className="batch-money-column" />
            <col className="batch-margin-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <Checkbox
                  checked={allSelected}
                  disabled={busy || !eligible.length}
                  aria-label={t("Select all products", "انتخاب همهٔ کالاها")}
                  onChange={(checked) => onSelect(checked ? eligible : [])}
                >
                  <span className="batch-select-all-caption">
                    {t("Select all", "انتخاب همه")}
                  </span>
                </Checkbox>
              </th>
              <th scope="col">{t("Product", "کالا")}</th>
              <th scope="col">{t("Category", "دسته‌بندی")}</th>
              <th scope="col" className="numeric">
                {t("Unit cost", "هزینه واحد")}
              </th>
              <th scope="col" className="numeric">
                {t("Price", "قیمت")}
              </th>
              <th scope="col" className="numeric">
                {t("Margin", "حاشیه سود")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={row.belowMinimum ? "batch-below-minimum" : undefined}
              >
                <td className="batch-select">
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    disabled={busy || row.individual}
                    aria-label={`${t("Include", "انتخاب")} ${row.product.name_en}`}
                    onChange={(checked) =>
                      onSelect(
                        checked
                          ? [...new Set([...selectedIds, row.id])]
                          : selectedIds.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                <td className="batch-product">
                  <ProductName product={row.product} language={lang} />
                  {row.individual && (
                    <small>
                      {t("Review individually", "جداگانه بررسی شود")}
                    </small>
                  )}
                </td>
                <td className="batch-category">{row.category}</td>
                <td
                  className="batch-cost numeric"
                  data-label={t("Unit cost", "هزینه واحد")}
                >
                  {row.cost !== null ? (
                    <ProductCost
                      value={row.cost}
                      product={row.product}
                      config={state.config}
                    />
                  ) : (
                    t("Not added", "اضافه نشده")
                  )}
                </td>
                <td
                  className="batch-price numeric"
                  data-label={t("Price", "قیمت")}
                >
                  <ProductPrice
                    value={row.price}
                    product={row.product}
                    config={state.config}
                  />
                </td>
                <td
                  className="batch-margin numeric"
                  data-label={t("Margin", "حاشیه سود")}
                >
                  <bdi dir="ltr">
                    {row.margin !== null
                      ? `${new Decimal(row.margin).times(100).toFixed(2)}%`
                      : t("Not added", "اضافه نشده")}
                  </bdi>
                  {row.belowMinimum && (
                    <small>{t("Below minimum", "کمتر از حداقل")}</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
