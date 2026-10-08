import { useState } from "react";
import logo from "../../../assets/arzon-logo.png?inline";
import { demoSeed } from "../config";
import { effectiveOffer, effectivePrice } from "../catalog";
import {
  labelContentGeometry,
  LabelLayoutError,
  labelLayout,
  labelPages,
} from "../labels";
import { createId } from "../ids";
import { useDemo } from "../store";
import type { LabelTemplate, Product } from "../types";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  NumberField,
  PageHeader,
  Select,
} from "../ui";
import {
  LtrText,
  Money,
  OfferLabel,
  ProductName,
  UnitSize,
} from "../presentation";
import "./invoice-settings-labels.css";
import "./labels-a2.css";

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
  const { state, update, branch, lang, t } = useDemo();
  const [selected, setSelected] = useState<string[]>(
    demoSeed.label_demo.product_codes,
  );
  const [copies, setCopies] = useState(1);
  const [templateId, setTemplateId] = useState("");
  const [draft, setDraft] = useState({ name: "Template 1", ...geometry });
  const [startSlot, setStartSlot] = useState(5);
  const [error, setError] = useState("");
  const [templateFormOpen, setTemplateFormOpen] = useState(
    state.templates.length === 0,
  );
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
      if (!draft.name.trim()) {
        setError(t("Enter a template name.", "نام قالب را وارد کنید."));
        return;
      }
      const item: LabelTemplate = {
        ...draft,
        name: draft.name.trim(),
        id: createId("label-template"),
        company_id: state.config.company.seed_key,
      };
      labelLayout(item);
      update((next) => {
        next.templates.push(item);
      });
      setTemplateId(item.id);
      setError("");
    } catch (cause) {
      if (cause instanceof LabelLayoutError && cause.code === "dimensions") {
        const names: Record<string, string> = {
          width: t("Width", "عرض"),
          height: t("Height", "ارتفاع"),
          margin_top: t("Top margin", "حاشیه بالا"),
          margin_bottom: t("Bottom margin", "حاشیه پایین"),
          margin_left: t("Left margin", "حاشیه چپ"),
          margin_right: t("Right margin", "حاشیه راست"),
          gap_x: t("Horizontal gap", "فاصله افقی"),
          gap_y: t("Vertical gap", "فاصله عمودی"),
        };
        const field = names[cause.field ?? ""];
        setError(
          cause.field === "width" || cause.field === "height"
            ? t(
                `${field} must be greater than zero.`,
                `${field} باید بیشتر از صفر باشد.`,
              )
            : t(
                `${field} must be zero or greater.`,
                `${field} باید صفر یا بیشتر باشد.`,
              ),
        );
      } else if (cause instanceof LabelLayoutError && cause.code === "fit") {
        setError(
          t(
            "Only 0 labels fit on A4. Reduce the dimensions or margins to fit on an A4 sheet.",
            "هیچ برچسبی روی A4 جا نمی‌شود. ابعاد یا حاشیه‌ها را کاهش دهید.",
          ),
        );
      } else {
        setError(
          t(
            "Could not save the template. Try saving again.",
            "قالب ذخیره نشد. دوباره ذخیره کنید.",
          ),
        );
      }
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
          <DataTable
            className="labels-product-table"
            columns={[
              { width: "48%" },
              { width: "18%" },
              { width: "17%" },
              { width: "17%", align: "end" },
            ]}
          >
            <thead>
              <tr>
                <th>{t("Product", "کالا")}</th>
                <th>{t("Product Code", "کد کالا")}</th>
                <th>{t("Unit size", "اندازه واحد")}</th>
                <th className="numeric">{t("Selling price", "قیمت فروش")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.code}>
                  <td>
                    <Checkbox
                      checked={selected.includes(product.code)}
                      onChange={(checked) =>
                        setSelected(
                          checked
                            ? [...selected, product.code]
                            : selected.filter((code) => code !== product.code),
                        )
                      }
                    >
                      <ProductName product={product} language={lang} />
                    </Checkbox>
                  </td>
                  <td>
                    <LtrText>{product.code}</LtrText>
                  </td>
                  <td>
                    <UnitSize value={product.unit_size} />
                  </td>
                  <td className="numeric">
                    <Money
                      value={effectivePrice(state, product, branch)!}
                      currency={state.config.company.currency}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Field
            label={t("Copies per product", "تعداد هر کالا")}
            className="labels-copies-field"
          >
            <NumberField
              dir="ltr"
              min="1"
              max="100"
              step="1"
              value={copies}
              onChange={(value) =>
                setCopies(
                  Math.max(1, Math.min(100, Math.floor(Number(value) || 1))),
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
            <Select
              value={templateId}
              onChange={(value) => {
                setTemplateId(value);
                setStartSlot(1);
              }}
              options={[
                {
                  value: "",
                  label: t("Choose a template", "یک قالب انتخاب کنید"),
                },
                ...templates.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
          </Field>
          <div className="labels-template-section">
            <Button
              variant="secondary"
              aria-expanded={templateFormOpen}
              aria-controls="labels-template-form"
              onClick={() => setTemplateFormOpen((open) => !open)}
            >
              {t("New template", "قالب جدید")}
            </Button>
            {templateFormOpen && (
              <div id="labels-template-form" className="labels-template-form">
                <Field label={t("Template name", "نام قالب")}>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </Field>
                <div className="form-grid labels-dimensions">
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
                    <Field
                      key={key}
                      label={`${t(en, fa)} (${t("mm", "میلی‌متر")})`}
                    >
                      <NumberField
                        dir="ltr"
                        min="0"
                        step="0.5"
                        value={draft[key]}
                        onChange={(value) =>
                          setDraft({ ...draft, [key]: Number(value) })
                        }
                      />
                    </Field>
                  ))}
                </div>
                {error && <p role="alert">{error}</p>}
                <div className="labels-template-actions">
                  <Button variant="secondary" onClick={saveTemplate}>
                    {t("Save template", "ذخیره قالب")}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {template && (
            <Field
              label={t("Starting slot", "خانه شروع")}
              error={
                startSlot > capacity
                  ? t(
                      `Only ${capacity} labels fit on A4. Choose a starting slot from 1 to ${capacity}.`,
                      `فقط ${capacity} برچسب روی A4 جا می‌شود. خانه شروع را از 1 تا ${capacity} انتخاب کنید.`,
                    )
                  : undefined
              }
            >
              <NumberField
                dir="ltr"
                min="1"
                max={capacity}
                step="1"
                value={startSlot}
                onChange={(value) =>
                  setStartSlot(Math.max(1, Math.floor(Number(value) || 1)))
                }
              />
            </Field>
          )}
          <div className="labels-print-actions">
            <Button
              disabled={pages.length === 0}
              onClick={() => window.print()}
            >
              {t("Print labels", "چاپ برچسب‌ها")}
            </Button>
          </div>
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
              {Array.from(
                { length: Math.min(capacity, page.length) },
                (_, index) => {
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
                  const content = labelContentGeometry(
                    template.width,
                    template.height,
                  );
                  return (
                    <div key={index} className="shelf-label" style={style}>
                      <div
                        className="shelf-label-content"
                        dir={lang === "fa" ? "rtl" : "ltr"}
                        style={{
                          left: content.left,
                          top: content.top,
                          transform: `scale(${content.scale})`,
                        }}
                      >
                        <span className="price" dir="ltr">
                          {price ? (
                            <Money
                              value={price}
                              currency={state.config.company.currency}
                            />
                          ) : (
                            t("Pending", "در انتظار")
                          )}
                        </span>
                        <div className="shelf-label-offer">
                          {offer && (
                            <OfferLabel
                              className="label-offer-badge"
                              label={offer.label}
                              language={lang}
                              currency={state.config.company.currency}
                            />
                          )}
                        </div>
                        <ProductName product={product} language={lang} />
                        <small className="shelf-label-code">
                          {t("Product Code", "کد کالا")}:{" "}
                          <LtrText>{product.code}</LtrText> ·{" "}
                          <UnitSize value={product.unit_size} />
                        </small>
                        <div className="shelf-label-footer">
                          {taxProfile?.taxable && (
                            <Badge tone="info">
                              {t(
                                state.config.tax.label_text_en,
                                state.config.tax.label_text_fa,
                              )}
                            </Badge>
                          )}
                          {template.width >= 40 && template.height >= 28 && (
                            <img src={logo} alt={state.config.company.name} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
