import { useState } from "react";
import {
  setNewInvoiceLineCategories,
  type NewInvoiceCategoriesRead,
} from "../../invoice-new-categories";
import { categoryLabel } from "../../formatters";
import { useDemo } from "../../store";
import { Button, Dialog, DialogActions, Field, Select } from "../../ui";

export function NewProductCategories({
  invoiceId,
  current,
}: {
  invoiceId: string;
  current?: NewInvoiceCategoriesRead | null;
}) {
  const { state, command, t, tCount, lang } = useDemo();
  const [review, setReview] = useState<NewInvoiceCategoriesRead | null>(null);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const label = (count: number) =>
    tCount(
      "Set category for {{count}} new product",
      "Set category for {{count}} new products",
      "تعیین دسته برای {{count}} کالای جدید",
      "تعیین دسته برای {{count}} کالای جدید",
      count,
    );
  const categories = state.config.pricing_categories.filter(
    (item) => !item.archived,
  );
  if (!current && !review) return null;
  return (
    <>
      {current && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setReview(structuredClone(current));
            setCategory("");
            setError("");
          }}
        >
          {label(current.count)}
        </Button>
      )}
      <Dialog
        open={review !== null}
        title={label(review?.count ?? 0)}
        description={t(
          "Choose their category, then check each new product's remaining details before confirming.",
          "دستهٔ این کالاها را انتخاب کنید، سپس پیش از تأیید، جزئیات باقی‌ماندهٔ هر کالای جدید را بررسی کنید.",
        )}
        onOpenChange={(open) => {
          if (!open && !saving) setReview(null);
        }}
      >
        <Field label={t("Pricing category", "دسته قیمت‌گذاری")}>
          <Select
            searchable
            value={category}
            disabled={saving}
            onChange={(value) => {
              setCategory(value);
              setError("");
            }}
            options={[
              {
                value: "",
                label: t("Choose a pricing category", "انتخاب دسته قیمت‌گذاری"),
                placeholder: true,
              },
              ...categories.map((item) => ({
                value: item.key,
                label:
                  lang === "fa"
                    ? item.label_fa || categoryLabel(item.label, lang)
                    : item.label,
                searchTerms: [item.label, item.label_fa ?? ""],
              })),
            ]}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <DialogActions>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setReview(null)}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            disabled={
              saving || !categories.some((item) => item.key === category)
            }
            onClick={async () => {
              if (!review) return;
              setSaving(true);
              try {
                const saved = await command(
                  "invoices.edit",
                  {
                    company_id: state.config.company.seed_key,
                    kind: "company_shared",
                    entity_id: invoiceId,
                  },
                  (draft, actor) => {
                    setNewInvoiceLineCategories(draft, actor, {
                      invoice_id: invoiceId,
                      expected_token: review.token,
                      line_ids: review.line_ids,
                      category,
                    });
                    return true;
                  },
                );
                if (saved !== true) throw new Error("category_not_saved");
                setReview(null);
              } catch {
                setError(
                  t(
                    "The invoice or category changed. Close this dialog, review the current new products, and try again.",
                    "فاکتور یا دسته تغییر کرده است. این پنجره را ببندید، کالاهای جدید فعلی را بررسی و دوباره تلاش کنید.",
                  ),
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? t("Saving…", "در حال ذخیره…")
              : t("Set category", "تعیین دسته")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
