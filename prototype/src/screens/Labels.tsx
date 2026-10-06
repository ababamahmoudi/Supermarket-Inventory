import { useState } from "react";
import logo from "../../../assets/arzon-logo.png";
import demoSeed from "../../../seed/demo-data.json";
import { effectiveOffer, effectivePrice } from "../catalog";
import { labelLayout, labelPages } from "../labels";
import { useDemo } from "../store";
import type { LabelTemplate, Product } from "../types";
import { Badge, Button, Card, EmptyState, Field, PageHeader } from "../ui";

const geometry = {
  width: 60,
  height: 40,
  margin_top: 10,
  margin_bottom: 10,
  margin_left: 10,
  margin_right: 10,
  gap_x: 4,
  gap_y: 4,
};

export function Labels() {
  const { state, update, branch, t, money } = useDemo();
  const [selected, setSelected] = useState<string[]>(
    demoSeed.label_demo.product_codes,
  );
  const [copies, setCopies] = useState(1);
  const [templateId, setTemplateId] = useState("");
  const [draft, setDraft] = useState({ name: "Template 1", ...geometry });
  const [startSlot, setStartSlot] = useState(5);
  const [error, setError] = useState("");
  const templates = state.templates.filter(
    (item) => item.company_id === state.config.company.seed_key,
  );
  const template = templates.find((item) => item.id === templateId);
  const products = state.products.filter(
    (product) =>
      product.company_id === state.config.company.seed_key &&
      product.status === "active" &&
      branch !== "all" &&
      effectivePrice(state, product, branch) !== null,
  );
  const labels = products
    .filter((product) => selected.includes(product.code))
    .flatMap((product) => Array<Product>(copies).fill(product));
  let pages: (Product | null)[][] = [];
  let capacity = 0;
  if (template) {
    capacity = labelLayout(template).capacity;
    if (startSlot >= 1 && startSlot <= capacity)
      pages = labelPages(labels, template, startSlot);
  }
  const saveTemplate = () => {
    try {
      if (!draft.name.trim()) throw new Error("name");
      const item: LabelTemplate = {
        ...draft,
        name: draft.name.trim(),
        id: crypto.randomUUID(),
        company_id: state.config.company.seed_key,
      };
      labelLayout(item);
      update((next) => {
        next.templates.push(item);
      });
      setTemplateId(item.id);
      setError("");
    } catch {
      setError(
        t(
          "Enter a name and positive dimensions that fit on an A4 sheet.",
          "نام و ابعاد مثبت متناسب با برگه A4 وارد کنید.",
        ),
      );
    }
  };
  return (
    <>
      <PageHeader
        title={t("Labels", "برچسب‌ها")}
        description={t(
          "Choose products, create your template, then preview and print.",
          "کالاها را انتخاب کنید، قالب بسازید، سپس پیش‌نمایش و چاپ کنید.",
        )}
      />
      {branch === "all" && (
        <div className="banner info" role="status">
          {t(
            "Choose one branch above before selecting or printing labels. Labels use that branch’s approved prices and offers.",
            "پیش از انتخاب یا چاپ برچسب‌ها، یک شعبه را در بالا انتخاب کنید. برچسب‌ها قیمت‌ها و پیشنهادهای تأییدشدهٔ همان شعبه را نشان می‌دهند.",
          )}
        </div>
      )}
      <div className="labels-controls">
        <Card title={t("Choose products", "انتخاب کالاها")}>
          <div className="form-grid">
            {products.map((product) => (
              <label key={product.code}>
                <input
                  type="checkbox"
                  checked={selected.includes(product.code)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, product.code]
                        : selected.filter((code) => code !== product.code),
                    )
                  }
                />{" "}
                {product.name_en} · {product.name_fa}
              </label>
            ))}
          </div>
          <Field label={t("Copies per product", "تعداد هر کالا")}>
            <input
              type="number"
              min="1"
              max="100"
              value={copies}
              onChange={(event) =>
                setCopies(
                  Math.max(
                    1,
                    Math.min(100, Math.floor(Number(event.target.value) || 1)),
                  ),
                )
              }
            />
          </Field>
        </Card>
        <Card title={t("Templates", "قالب‌ها")}>
          {templates.length === 0 && (
            <EmptyState>
              {t(
                "No templates. Create your first template.",
                "قالبی وجود ندارد. اولین قالب را بسازید.",
              )}
            </EmptyState>
          )}
          <Field label={t("Saved template", "قالب ذخیره‌شده")}>
            <select
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setStartSlot(1);
              }}
            >
              <option value="">
                {t("Choose a template", "یک قالب انتخاب کنید")}
              </option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <details open={templates.length === 0}>
            <summary>{t("New template", "قالب جدید")}</summary>
            <Field label={t("Template name", "نام قالب")}>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              {(
                [
                  ["width", "Width", "عرض"],
                  ["height", "Height", "ارتفاع"],
                  ["margin_top", "Top margin", "حاشیه بالا"],
                  ["margin_bottom", "Bottom margin", "حاشیه پایین"],
                  ["margin_left", "Left margin", "حاشیه چپ"],
                  ["margin_right", "Right margin", "حاشیه راست"],
                  ["gap_x", "Horizontal gap", "فاصله افقی"],
                  ["gap_y", "Vertical gap", "فاصله عمودی"],
                ] as const
              ).map(([key, en, fa]) => (
                <Field key={key} label={`${t(en, fa)} (mm)`}>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft({ ...draft, [key]: Number(event.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            {error && <p role="alert">{error}</p>}
            <Button onClick={saveTemplate}>
              {t("Save template", "ذخیره قالب")}
            </Button>
          </details>
          {template && (
            <Field
              label={t("Starting slot", "خانه شروع")}
              error={
                startSlot > capacity
                  ? t(
                      "Choose a slot on this sheet.",
                      "خانه‌ای از این برگه انتخاب کنید.",
                    )
                  : undefined
              }
            >
              <input
                type="number"
                min="1"
                max={capacity}
                value={startSlot}
                onChange={(event) =>
                  setStartSlot(
                    Math.max(1, Math.floor(Number(event.target.value) || 1)),
                  )
                }
              />
            </Field>
          )}
          <p>
            {t(
              "Use slot 5 when the first four slots are already used.",
              "اگر چهار خانه اول استفاده شده، از خانه 5 شروع کنید.",
            )}
          </p>
          <Button disabled={pages.length === 0} onClick={() => window.print()}>
            {t("Print labels", "چاپ برچسب‌ها")}
          </Button>
        </Card>
      </div>
      {template && pages.length > 0 && (
        <section
          aria-label={t("A4 preview", "پیش‌نمایش A4")}
          className="label-preview"
        >
          {pages.map((page, pageIndex) => (
            <div
              className="print-sheet"
              key={pageIndex}
              style={{
                width: "210mm",
                height: "297mm",
                position: "relative",
                background: "var(--card)",
                marginBlock: "16px",
                direction: "ltr",
              }}
            >
              {Array.from({ length: capacity }, (_, index) => {
                const product = page[index];
                const { columns } = labelLayout(template);
                const style = {
                  position: "absolute" as const,
                  insetInlineStart: `${template.margin_left + (index % columns) * (template.width + template.gap_x)}mm`,
                  top: `${template.margin_top + Math.floor(index / columns) * (template.height + template.gap_y)}mm`,
                  width: `${template.width}mm`,
                  height: `${template.height}mm`,
                };
                if (!product)
                  return (
                    <div key={index} className="label-unused" style={style}>
                      {pageIndex === 0 && index < startSlot - 1
                        ? t("Used", "استفاده‌شده")
                        : ""}
                    </div>
                  );
                const price = effectivePrice(state, product, branch);
                const offer = effectiveOffer(state, product, branch);
                const taxProfile = state.config.tax.profiles.find(
                  (profile) => profile.key === product.tax_profile,
                );
                return (
                  <div key={index} className="shelf-label" style={style}>
                    <img src={logo} alt={state.config.company.name} />
                    <strong>{product.name_en}</strong>
                    <strong lang="fa" dir="rtl">
                      {product.name_fa}
                    </strong>
                    {(product.description_en || product.description_fa) && (
                      <small>
                        {product.description_en} · {product.description_fa}
                      </small>
                    )}
                    <span className="price" dir="ltr">
                      {price ? money(price) : t("Pending", "در انتظار")}
                    </span>
                    {offer && <span>{offer.label}</span>}
                    <small>
                      {t("Product Code", "کد کالا")}: {product.code} ·{" "}
                      {product.unit_size}
                    </small>
                    {taxProfile?.taxable && (
                      <Badge tone="info">
                        {t(
                          state.config.tax.label_text_en,
                          state.config.tax.label_text_fa,
                        )}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
