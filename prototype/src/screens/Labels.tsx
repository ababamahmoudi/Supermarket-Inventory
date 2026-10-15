import { beginAppWork } from "../app-work";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import logo from "../../../assets/arzon-logo.png?inline";
import { effectiveOffer, effectivePrice, regularPrice } from "../catalog";
import { activeSaleAt, salePriceDisplay } from "../sales";
import { confirmPriceTaskWaitlistLabels } from "../price-updates";
import { SalePrice, SaleStatus } from "../sales-presentation";
import { effectiveProjectedClearanceOffers } from "../receipt-lots";
import { useRouteParam } from "../navigation";
import { ProductPrice } from "../weight-price-presentation";
import { translateCount } from "../i18n";
import {
  labelContentGeometry,
  LabelLayoutError,
  labelLayout,
  labelSlotGeometry,
  promoContentGeometry,
  regularLabelGeometry,
} from "../labels";
import {
  addLabelsToWaitlist,
  branchLabelWaitlist,
  clearLabelWaitlist,
  confirmLabelsPrinted,
  duplicateLabelTemplate,
  editLabelWaitlist,
  emptyLabelFilters,
  filterLabelProducts,
  LabelWorkflowError,
  prepareLabelPrint,
  saveLabelTemplate,
  setLabelTemplateArchived,
  setLabelWaitlistLot,
  validateLabelTemplate,
  type LabelPrintSnapshot,
  type LabelPrintProduct,
} from "../label-workflow";
import { createId } from "../ids";
import { ManualPricePill } from "../manual-price-presentation";
import { categoryLabel } from "../formatters";
import { useDemo } from "../store";
import { useCatalogQuery } from "../catalog-query";
import type { AuthenticatedActor, ResourceScope } from "../authority-types";
import { actorAudit } from "../domain-authority";
import {
  projectProductReadDTO,
  type ProductReadDTO,
} from "../catalog-read-model";
import type { ScopedReadView } from "../e1-read-model";
import { StoredFileImage } from "../stored-file";
import { isStoredFileReference } from "../file-database";
import { waitForPrintImages } from "../print-images";
import { WhatsMissing } from "../WhatsMissing";
import type {
  Branch,
  DemoState,
  LabelTemplate,
  LabelWaitlistItem,
} from "../types";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  NumberField,
  PageHeader,
  Select,
  Tabs,
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
import "./labels-b.css";
import "./labels-c1.css";
import "./c3-labels-notes-offers.css";
import "./labels-klead.css";
const defaultFields = {
  name: true,
  description: true,
  price: true,
  offer: true,
  code: true,
  logo: true,
  unit: true,
  tax: true,
};
const countText = (
  count: number,
  singular: string,
  plural: string,
  fa: string,
  lang: string,
) =>
  translateCount(
    `{{count}} ${singular}`,
    `{{count}} ${plural}`,
    `{{count}} ${fa}`,
    `{{count}} ${fa}`,
    count,
    lang,
  );
function labelScope(company_id: string, branch = "all"): ResourceScope {
  return {
    company_id,
    kind: branch === "all" ? "company_shared" : "location_record",
    location_ids: branch === "all" ? [] : [branch],
    mutation: true,
    location_policy: "active_only",
  };
}
function templateName(
  template: LabelTemplate,
  t: ReturnType<typeof useDemo>["t"],
) {
  if (template.built_in === "regular" && template.name === "Regular")
    return t("Regular", "عادی");
  if (template.built_in === "promo" && template.name === "Promo")
    return t("Promo", "ویژه");
  return template.name;
}
function errorText(error: unknown, t: ReturnType<typeof useDemo>["t"]) {
  if (error instanceof LabelLayoutError) {
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
    if (error.code === "dimensions")
      return error.field === "width" || error.field === "height"
        ? t(
            `${names[error.field]} must be greater than zero.`,
            `${names[error.field]} باید بیشتر از صفر باشد.`,
          )
        : t(
            `${names[error.field ?? ""]} must be zero or greater.`,
            `${names[error.field ?? ""]} باید صفر یا بیشتر باشد.`,
          );
    if (error.code === "fit")
      return t(
        "Only 0 labels fit on A4. Reduce the dimensions or margins to fit on an A4 sheet.",
        "هیچ برچسبی روی A4 جا نمی‌شود. ابعاد یا حاشیه‌ها را کاهش دهید.",
      );
    if (error.code === "calibration")
      return t(
        "The calibration offset moves labels outside A4. Reduce the offset or increase the margins.",
        "جابه‌جایی تنظیم چاپ برچسب‌ها را از A4 بیرون می‌برد. جابه‌جایی را کاهش دهید یا حاشیه‌ها را بیشتر کنید.",
      );
    return t(
      "Choose a starting slot within the sheet.",
      "خانه شروع را در محدوده برگه انتخاب کنید.",
    );
  }
  if (error instanceof LabelWorkflowError) {
    if (error.code === "logo")
      return t(
        "Labels 50 mm or wider need at least 10 mm height for the 8 mm logo.",
        "برچسب‌های با عرض 50 میلی‌متر یا بیشتر برای نشان 8 میلی‌متری به حداقل ارتفاع 10 میلی‌متر نیاز دارند.",
      );
    if (error.code === "template")
      return t("Enter a template name.", "نام قالب را وارد کنید.");
    if (error.code === "lot")
      return t(
        "Choose an active clearance lot in this location and the Promo template before printing.",
        "پیش از چاپ، یک سری فروش ویژهٔ فعال در این مکان و قالب ویژه را انتخاب کنید.",
      );
    if (error.code === "price")
      return t(
        "No approved price yet. Confirm the product and price before adding or printing labels.",
        "هنوز قیمت تأییدشده ندارد. پیش از افزودن یا چاپ برچسب، کالا و قیمت را تأیید کنید.",
      );
    if (error.code === "copies")
      return t(
        "Enter a whole copy count from 1 to 1000.",
        "تعداد صحیح از 1 تا 1000 وارد کنید.",
      );
    return t(
      "Choose an allowed branch before changing or printing labels.",
      "پیش از تغییر یا چاپ برچسب‌ها یک شعبه مجاز را انتخاب کنید.",
    );
  }
  return t(
    "Could not save the template. Try saving again.",
    "قالب ذخیره نشد. دوباره ذخیره کنید.",
  );
}

export function ShelfLabel({
  product,
  state,
  branch,
  template,
}: {
  product: ProductReadDTO;
  state: ScopedReadView;
  branch: Branch;
  template: LabelTemplate;
}) {
  const { lang, t } = useDemo();
  const fields = { ...defaultFields, ...state.label_settings?.fields };
  const languages = state.label_settings?.languages ?? ["en", "fa"];
  const showLogo = template.width >= 50 && fields.logo;
  const descriptionLanguage = languages.includes(lang) ? lang : languages[0];
  const description =
    descriptionLanguage === "fa"
      ? product.description_fa
      : product.description_en;
  const content = labelContentGeometry(
    template.width,
    Math.max(0.1, template.height - (showLogo ? 9 : 0)),
  );
  const snapshot: Partial<LabelPrintProduct> = product;
  const lotOffer = snapshot.label_clearance_offer;
  const ordinaryOffer = Object.hasOwn(snapshot, "label_offer")
    ? snapshot.label_offer
    : effectiveOffer(state, product, branch);
  const offer = lotOffer ?? ordinaryOffer;
  const sale = Object.hasOwn(snapshot, "label_sale")
    ? snapshot.label_sale
    : activeSaleAt(state, product, branch);
  const promotional = Boolean(offer || sale);
  const regular = Object.hasOwn(snapshot, "label_regular_price")
    ? (snapshot.label_regular_price ?? null)
    : regularPrice(state, product, branch);
  const effective = Object.hasOwn(snapshot, "label_effective_price")
    ? (snapshot.label_effective_price ?? null)
    : effectivePrice(state, product, branch);
  const saleDisplay = sale ? salePriceDisplay(sale, state.config) : null;
  const saleAmount = saleDisplay && (
    <span className={product.sold_by === "weight" ? "weight-price" : undefined}>
      <LtrText>
        <Money
          value={saleDisplay.main.amount}
          currency={state.config.company.currency}
        />
        {saleDisplay.main.unit !== "each" && `/${saleDisplay.main.unit}`}
      </LtrText>
      {saleDisplay.secondary && (
        <LtrText className="weight-price-secondary">
          {" "}
          ·{" "}
          <Money
            value={saleDisplay.secondary.amount}
            currency={state.config.company.currency}
          />
          /{saleDisplay.secondary.unit}
        </LtrText>
      )}
    </span>
  );
  const taxable = state.config.tax.profiles.find(
    (profile) => profile.key === product.tax_profile,
  )?.taxable;
  if (template.style === "promo") {
    const promo = promoContentGeometry(
      template.width,
      template.height,
      showLogo,
    );
    return (
      <>
        <svg
          className="promo-label-frame"
          aria-hidden="true"
          viewBox={`0 0 ${promo.frameWidth} ${promo.frameHeight}`}
          style={{
            left: `${promo.inset}mm`,
            top: `${promo.inset}mm`,
            width: `${promo.frameWidth}mm`,
            height: `${promo.frameHeight}mm`,
          }}
        >
          <rect
            x={promo.border / 2}
            y={promo.border / 2}
            width={promo.frameWidth - promo.border}
            height={promo.frameHeight - promo.border}
            fill="none"
            stroke="#000"
            strokeWidth={promo.border}
          />
        </svg>
        <div
          className={`promo-label-content${promotional ? " has-offer" : ""}`}
          dir={lang === "fa" ? "rtl" : "ltr"}
          style={{
            left: promo.left,
            top: promo.top,
            transform: `scale(${promo.scale})`,
          }}
        >
          <div className="promo-label-special">
            {promotional && t("SPECIAL", "ویژه")}
          </div>
          <div className="price promo-label-price">
            {sale && !lotOffer ? (
              saleAmount
            ) : offer ? (
              lotOffer ? (
                <ProductPrice
                  value={lotOffer.price}
                  product={product}
                  config={state.config}
                />
              ) : (
                <OfferLabel
                  label={offer.label}
                  language={lang}
                  currency={state.config.company.currency}
                />
              )
            ) : (
              <ProductPrice
                value={effective!}
                product={product}
                config={state.config}
              />
            )}
          </div>
          <div className="promo-label-regular-price">
            {promotional && regular && (
              <>
                {t("Regular", "عادی")}{" "}
                <ProductPrice
                  value={regular}
                  product={product}
                  config={state.config}
                />
              </>
            )}
          </div>
          <ProductName product={product} language={lang} />
          <small className="promo-label-code">
            {fields.code && (
              <>
                {t("Product Code", "کد کالا")}:{" "}
                <LtrText>{product.code}</LtrText>
              </>
            )}
            {fields.code && fields.unit && " · "}
            {fields.unit && <UnitSize value={product.unit_size} />}
          </small>
          <div className="promo-label-footer">
            {fields.tax && taxable && (
              <span>
                {t(
                  state.config.tax.label_text_en,
                  state.config.tax.label_text_fa,
                )}
              </span>
            )}
          </div>
        </div>
        {showLogo && (
          <span className="shelf-label-logo">
            <StoredFileImage
              className={state.config.company.logo_data ? "" : "arzon-logo-art"}
              value={state.config.company.logo_data || logo}
              companyId={state.config.company.seed_key}
              alt={state.config.company.name}
            />
          </span>
        )}
      </>
    );
  }
  return (
    <>
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
          {fields.price &&
            (sale && !lotOffer ? (
              saleAmount
            ) : (
              <ProductPrice
                value={effective!}
                product={product}
                config={state.config}
              />
            ))}
        </span>
        <div className="shelf-label-offer">
          {promotional && (
            <span className="regular-label-special">
              {t("SPECIAL", "ویژه")}
            </span>
          )}
          {fields.offer && offer && (
            <OfferLabel
              className="label-offer-badge"
              label={offer.label}
              language={lang}
              currency={state.config.company.currency}
            />
          )}
        </div>
        <div className="label-name-block">
          {fields.name &&
            (languages.length === 2 ? (
              <ProductName product={product} language={lang} />
            ) : (
              <span className="product-name">
                <strong
                  lang={languages[0]}
                  dir={languages[0] === "fa" ? "rtl" : "ltr"}
                >
                  {languages[0] === "fa"
                    ? product.name_fa || product.name_en
                    : product.name_en}
                </strong>
              </span>
            ))}
          {fields.description && description && (
            <bdi
              className="label-description"
              lang={descriptionLanguage}
              dir={descriptionLanguage === "fa" ? "rtl" : "ltr"}
            >
              {description}
            </bdi>
          )}
        </div>
        <small className="shelf-label-code">
          {fields.code && (
            <>
              {t("Product Code", "کد کالا")}: <LtrText>{product.code}</LtrText>
            </>
          )}
          {fields.code && fields.unit && " · "}
          {fields.unit && <UnitSize value={product.unit_size} />}
        </small>
        <div className="shelf-label-footer">
          {fields.tax && taxable && (
            <Badge tone="info">
              {t(
                state.config.tax.label_text_en,
                state.config.tax.label_text_fa,
              )}
            </Badge>
          )}
        </div>
      </div>
      {showLogo && (
        <span className="shelf-label-logo">
          <StoredFileImage
            className={state.config.company.logo_data ? "" : "arzon-logo-art"}
            value={state.config.company.logo_data || logo}
            companyId={state.config.company.seed_key}
            alt={state.config.company.name}
          />
        </span>
      )}
    </>
  );
}

export function PhysicalSheet({
  template,
  products,
  state,
  branch,
  alignment = false,
}: {
  template: LabelTemplate;
  products: (ProductReadDTO | null)[];
  state: ScopedReadView;
  branch: Branch;
  alignment?: boolean;
}) {
  const { capacity } = labelLayout(template);
  return (
    <div
      className="print-sheet"
      dir="ltr"
      style={{ width: "210mm", height: "297mm" }}
    >
      {Array.from(
        { length: alignment ? capacity : products.length },
        (_, index) => {
          const slot = labelSlotGeometry(template, index);
          const style: CSSProperties = {
            position: "absolute",
            left: `${slot.left}mm`,
            top: `${slot.top}mm`,
            width: `${slot.width}mm`,
            height: `${slot.height}mm`,
          };
          if (alignment)
            return (
              <div className="label-alignment-box" style={style} key={index}>
                <span>{index + 1}</span>
                <i />
                <i />
              </div>
            );
          const product = products[index];
          return product ? (
            <div
              className={`shelf-label${template.style === "promo" ? " promo-shelf-label" : ""}`}
              key={index}
              style={style}
            >
              <ShelfLabel
                product={product}
                state={state}
                branch={branch}
                template={template}
              />
            </div>
          ) : null;
        },
      )}
    </div>
  );
}

function SheetPreview({
  template,
  startSlot,
  onStartSlot,
  entries = [],
  state,
  branch,
}: {
  template: LabelTemplate;
  startSlot: number;
  onStartSlot: (slot: number) => void;
  entries?: ProductReadDTO[];
  state: ScopedReadView;
  branch: Branch;
}) {
  const { t, lang } = useDemo();
  let layout;
  try {
    validateLabelTemplate(
      template,
      state.label_settings?.fields?.logo !== false,
    );
    layout = labelLayout(template);
  } catch (error) {
    return (
      <div className="label-live-preview-error" role="status">
        {errorText(error, t)}
      </div>
    );
  }
  const validStart = Math.min(Math.max(1, startSlot), layout.capacity);
  return (
    <section
      className="label-live-preview"
      aria-label={t("Live A4 preview", "پیش‌نمایش زنده A4")}
    >
      <div className="label-preview-caption">
        <strong>
          {countText(
            layout.capacity,
            "label per sheet",
            "labels per sheet",
            "برچسب در هر برگه",
            lang,
          )}{" "}
          <LtrText>
            ({layout.columns} × {layout.rows})
          </LtrText>
        </strong>
        <span className="muted">
          {t(
            "Select the first unused slot.",
            "اولین خانه استفاده‌نشده را انتخاب کنید.",
          )}
        </span>
      </div>
      <svg
        className="label-a4-svg"
        viewBox="0 0 210 297"
        role="img"
        aria-label={t("A4 preview", "پیش‌نمایش A4")}
      >
        <rect width="210" height="297" className="label-a4-paper" />
        {Array.from({ length: layout.capacity }, (_, index) => {
          const slot = labelSlotGeometry(template, index);
          const product = entries[index - validStart + 1];
          const used = index < validStart - 1;
          const selected = index === validStart - 1;
          return (
            <g
              key={index}
              role="button"
              tabIndex={0}
              aria-label={t(
                `Starting slot ${index + 1}`,
                `خانه شروع ${index + 1}`,
              )}
              aria-pressed={selected}
              onClick={() => onStartSlot(index + 1)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onStartSlot(index + 1);
                }
              }}
              className={`label-preview-slot${used ? " is-used" : ""}${selected ? " is-start" : ""}`}
              data-slot={index + 1}
            >
              <rect
                x={slot.left}
                y={slot.top}
                width={slot.width}
                height={slot.height}
                rx="1"
              />
              <text
                x={slot.left + slot.width / 2}
                y={slot.top + Math.min(slot.height / 2, 7)}
                textAnchor="middle"
                fontSize={Math.min(4, slot.height / 3)}
              >
                {used ? t("Used", "استفاده‌شده") : index + 1}
              </text>
              {product && slot.height >= 20 && (
                <>
                  <text
                    x={slot.left + slot.width / 2}
                    y={slot.top + slot.height / 2}
                    textAnchor="middle"
                    fontSize="3"
                  >
                    {product.code}
                  </text>
                  <text
                    x={slot.left + slot.width / 2}
                    y={slot.top + slot.height / 2 + 5}
                    textAnchor="middle"
                    fontSize="4"
                  >
                    {effectivePrice(state, product, branch)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function ScaledSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const resize = () => setWidth(Math.min(794, target.clientWidth || 340));
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const scale = width / ((210 * 96) / 25.4);
  return (
    <div
      className="label-scaled-sheet"
      ref={ref}
      style={{ height: `${((297 * 96) / 25.4) * scale}px` }}
    >
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

function TemplateDesigner({
  onSaved,
}: {
  onSaved?: (template: LabelTemplate) => void;
}) {
  const { state, command, query, can, branch, t } = useDemo();
  const initialTemplate = state.templates.find(
    (item) =>
      item.company_id === state.config.company.seed_key && !item.archived,
  );
  const [id, setId] = useState(initialTemplate?.id ?? "");
  const [draft, setDraft] = useState<LabelTemplate>(() =>
    structuredClone(
      initialTemplate ?? {
        id: "",
        company_id: state.config.company.seed_key,
        name: "Template 1",
        style: "regular",
        ...regularLabelGeometry,
      },
    ),
  );
  const [startSlot, setStartSlot] = useState(initialTemplate ? 1 : 5);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [alignmentTemplate, setAlignmentTemplate] =
    useState<LabelTemplate | null>(null);
  const templates = state.templates.filter(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      (showArchived || !item.archived),
  );
  const showError = (cause: unknown) => {
    setError(errorText(cause, t));
    setErrorField(
      cause instanceof LabelLayoutError
        ? (cause.field ?? "geometry")
        : cause instanceof LabelWorkflowError && cause.code === "template"
          ? "name"
          : cause instanceof LabelWorkflowError && cause.code === "logo"
            ? "geometry"
            : null,
    );
  };
  const clearErrorFor = (field: string) => {
    if (
      errorField === field ||
      (errorField === "geometry" && field !== "name")
    ) {
      setError("");
      setErrorField(null);
    }
  };
  const choose = (value: string) => {
    setId(value);
    setError("");
    setSaved(false);
    const template = templates.find((item) => item.id === value);
    if (template) {
      setDraft({
        ...template,
        offset_x: template.offset_x ?? 0,
        offset_y: template.offset_y ?? 0,
      });
      setStartSlot(1);
    } else {
      setDraft({
        id: "",
        company_id: state.config.company.seed_key,
        name: `Template ${state.templates.filter((item) => item.company_id === state.config.company.seed_key && !item.built_in).length + 1}`,
        style: "regular",
        ...regularLabelGeometry,
      });
      setStartSlot(5);
    }
  };
  const duplicate = async () => {
    try {
      const copy = await command(
        "labels.templates_create",
        labelScope(state.config.company.seed_key),
        (current, freshActor) =>
          duplicateLabelTemplate(
            current,
            id,
            freshActor,
            `${templateName(draft, t)} ${t("copy", "کپی")}`,
          ),
      );
      if (copy) {
        setId(copy.id);
        setDraft(copy);
        setStartSlot(1);
        setSaved(false);
        setError("");
        onSaved?.(copy);
      }
    } catch (cause) {
      showError(cause);
    }
  };
  const setArchived = async (archived: boolean) => {
    try {
      await command(
        "labels.templates_archive",
        labelScope(state.config.company.seed_key),
        (current, freshActor) =>
          setLabelTemplateArchived(current, id, archived, freshActor),
      );
      setDraft({ ...draft, archived });
      setShowArchived(archived || showArchived);
      setError("");
      setSaved(false);
    } catch (cause) {
      showError(cause);
    }
  };
  const save = async () => {
    if (draft.archived) {
      setError(
        t(
          "This template is archived. Restore it before editing or printing.",
          "این قالب بایگانی شده است. پیش از ویرایش یا چاپ آن را بازیابی کنید.",
        ),
      );
      setErrorField("archived");
      return;
    }
    try {
      const next = {
        ...draft,
        id: id || createId("label-template"),
        company_id: state.config.company.seed_key,
      };
      if (!next.name.trim()) throw new LabelWorkflowError("template");
      validateLabelTemplate(next, state.label_settings?.fields?.logo !== false);
      await command(
        id ? "labels.templates_edit" : "labels.templates_create",
        labelScope(state.config.company.seed_key),
        (current, freshActor) => saveLabelTemplate(current, next, freshActor),
      );
      setId(next.id);
      setDraft(next);
      setError("");
      setSaved(true);
      onSaved?.(next);
    } catch (cause) {
      showError(cause);
    }
  };
  const printAlignment = async () => {
    try {
      await query(
        "labels.calibrate",
        labelScope(state.config.company.seed_key),
        (current) =>
          validateLabelTemplate(
            draft,
            current.label_settings?.fields?.logo !== false,
          ),
      );
      flushSync(() => setAlignmentTemplate(structuredClone(draft)));
      window.print();
      await command(
        "labels.calibrate",
        labelScope(state.config.company.seed_key),
        (next, freshActor) =>
          next.activity.push({
            id: createId("label-test-print"),
            company_id: next.config.company.seed_key,
            branch,
            action: "Print test alignment page",
            by: freshActor.actor,
            ...actorAudit(next, freshActor),
            at: new Date().toISOString(),
            reversible: false,
            after: { template: structuredClone(draft) },
          }),
      );
    } catch (cause) {
      showError(cause);
    }
  };
  return (
    <Card
      className="labels-template-designer"
      title={t("Templates", "قالب‌ها")}
    >
      <p className="labels-record-caption muted">
        <bdi dir="auto">{templateName(draft, t)}</bdi>
      </p>
      <WhatsMissing
        issues={
          error
            ? [
                {
                  id: errorField ?? "template",
                  message: error,
                  fieldId:
                    errorField === "archived"
                      ? "label-template-restore"
                      : errorField === "name"
                        ? "label-template-name"
                        : errorField && errorField !== "geometry"
                          ? `label-template-${errorField}`
                          : "label-template-width",
                },
              ]
            : []
        }
      />
      <div className="label-template-picker">
        <Field label={t("Saved template", "قالب ذخیره‌شده")}>
          <Select
            value={id}
            onChange={choose}
            options={[
              {
                value: "",
                label: t("Choose a template", "یک قالب انتخاب کنید"),
              },
              ...templates.map((item) => ({
                value: item.id,
                label: `${templateName(item, t)}${item.archived ? ` · ${t("Archived", "بایگانی‌شده")}` : ""}`,
              })),
            ]}
          />
        </Field>
        <Button variant="neutral" onClick={() => choose("")}>
          {t("New template", "قالب جدید")}
        </Button>
        <Checkbox checked={showArchived} onChange={setShowArchived}>
          {t("Show archived", "نمایش بایگانی‌شده‌ها")}
        </Checkbox>
      </div>
      {draft.built_in && (
        <p className="muted label-template-kind">
          {t("Built-in template", "قالب آماده")}
        </p>
      )}
      {draft.archived && (
        <p className="banner info" role="status">
          {t(
            "This template is archived. Restore it before editing or printing.",
            "این قالب بایگانی شده است. پیش از ویرایش یا چاپ آن را بازیابی کنید.",
          )}
        </p>
      )}
      <div className="label-designer-grid">
        <div className="labels-template-form" id="labels-template-form">
          <Field
            label={t("Template name", "نام قالب")}
            error={errorField === "name" ? error : undefined}
          >
            <input
              id="label-template-name"
              value={draft.name}
              disabled={draft.archived || !can("labels.calibrate")}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                setSaved(false);
                clearErrorFor("name");
              }}
            />
          </Field>
          <Field label={t("Label style", "سبک برچسب")}>
            <Select
              value={draft.style ?? "regular"}
              disabled={draft.archived}
              onChange={(value) => {
                setDraft({ ...draft, style: value as "regular" | "promo" });
                setSaved(false);
                clearErrorFor("style");
              }}
              options={[
                { value: "regular", label: t("Regular", "عادی") },
                { value: "promo", label: t("Promo", "ویژه") },
              ]}
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
                ["offset_x", "Horizontal offset", "جابه‌جایی افقی"],
                ["offset_y", "Vertical offset", "جابه‌جایی عمودی"],
              ] as const
            ).map(([key, en, fa]) => (
              <Field
                key={key}
                label={`${t(en, fa)} (${t("mm", "میلی‌متر")})`}
                error={
                  errorField === key ||
                  (errorField === "geometry" && key === "width")
                    ? error
                    : undefined
                }
              >
                <NumberField
                  id={`label-template-${key}`}
                  disabled={draft.archived}
                  dir="ltr"
                  min={key.startsWith("offset") ? undefined : "0"}
                  step="0.5"
                  value={draft[key] ?? 0}
                  onChange={(value) => {
                    setDraft({ ...draft, [key]: Number(value) });
                    setSaved(false);
                    clearErrorFor(key);
                  }}
                />
              </Field>
            ))}
          </div>
          <Field
            className="label-narrow-field"
            label={t("Starting slot", "خانه شروع")}
          >
            <NumberField
              dir="ltr"
              min="1"
              step="1"
              value={startSlot}
              onChange={(value) =>
                setStartSlot(Math.max(1, Math.floor(Number(value) || 1)))
              }
            />
          </Field>
          {error && (errorField === null || errorField === "geometry") && (
            <p role="alert">{error}</p>
          )}
          {saved && (
            <p className="muted" role="status">
              {t("Template saved.", "قالب ذخیره شد.")}
            </p>
          )}
          <DialogActions className="label-designer-actions">
            <Button
              variant="tinted"
              onClick={printAlignment}
              disabled={draft.archived}
            >
              {t("Print test alignment page", "چاپ برگه تنظیم آزمایشی")}
            </Button>
            {id && (
              <Button
                variant="neutral"
                onClick={duplicate}
                disabled={draft.archived || !can("labels.templates_create")}
              >
                {t("Duplicate template", "کپی قالب")}
              </Button>
            )}
            {id && (
              <Button
                id="label-template-restore"
                variant={draft.archived ? "neutral" : "destructive"}
                onClick={() => setArchived(!draft.archived)}
              >
                {draft.archived
                  ? t("Restore template", "بازیابی قالب")
                  : t("Archive template", "بایگانی قالب")}
              </Button>
            )}
            <Button
              onClick={save}
              disabled={
                !can(id ? "labels.templates_edit" : "labels.templates_create")
              }
            >
              {t("Save template", "ذخیره قالب")}
            </Button>
          </DialogActions>
        </div>
        <SheetPreview
          template={draft}
          startSlot={startSlot}
          onStartSlot={setStartSlot}
          state={state}
          branch={branch}
        />
      </div>
      {alignmentTemplate &&
        createPortal(
          <div className="label-print-output">
            <PhysicalSheet
              template={alignmentTemplate}
              products={[]}
              state={state}
              branch={branch}
              alignment
            />
          </div>,
          document.body,
        )}
    </Card>
  );
}

export function LabelsSettings() {
  const { state, command, can, branch, t } = useDemo();
  const [saveError, setSaveError] = useState("");
  const [days, setDays] = useState(
    state.label_settings?.recent_price_days ?? 3,
  );
  const [auto, setAuto] = useState(
    state.label_settings?.auto_add_approved ?? false,
  );
  const [fields, setFields] = useState({
    ...defaultFields,
    ...state.label_settings?.fields,
  });
  const [languages, setLanguages] = useState(
    state.label_settings?.languages ?? ["en", "fa"],
  );
  const dirty =
    days !== (state.label_settings?.recent_price_days ?? 3) ||
    auto !== (state.label_settings?.auto_add_approved ?? false) ||
    JSON.stringify(fields) !==
      JSON.stringify({ ...defaultFields, ...state.label_settings?.fields }) ||
    languages.join(",") !==
      (state.label_settings?.languages ?? ["en", "fa"]).join(",");
  return (
    <div className="labels-settings-stack">
      <Card title={t("Label waitlist", "فهرست انتظار برچسب‌ها")}>
        <Field
          className="label-narrow-field"
          label={t("Price changed recently (days)", "تغییر اخیر قیمت (روز)")}
        >
          <NumberField
            dir="ltr"
            min="1"
            max="365"
            step="1"
            value={days}
            onChange={(value) =>
              setDays(
                Math.max(1, Math.min(365, Math.floor(Number(value) || 1))),
              )
            }
          />
        </Field>
        <Checkbox checked={auto} onChange={setAuto}>
          {t(
            "Add products automatically when a new price is approved",
            "افزودن خودکار کالا پس از تأیید قیمت جدید",
          )}
        </Checkbox>
        <div className="label-settings-fields">
          <h3>{t("Label fields", "فیلدهای برچسب")}</h3>
          <div className="label-field-options">
            {(
              [
                ["name", "Product name", "نام کالا"],
                ["description", "Description", "توضیحات"],
                ["price", "Selling price", "قیمت فروش"],
                ["offer", "Offer", "پیشنهاد"],
                ["code", "Product Code", "کد کالا"],
                ["logo", "Logo", "نشان"],
                ["unit", "Unit size", "اندازه واحد"],
                ["tax", "Tax indicator", "نشان مالیات"],
              ] as const
            ).map(([key, en, fa]) => (
              <Checkbox
                key={key}
                checked={fields[key]}
                onChange={(checked) => setFields({ ...fields, [key]: checked })}
              >
                {t(en, fa)}
              </Checkbox>
            ))}
          </div>
        </div>
        <div className="label-settings-fields">
          <h3>{t("Languages", "زبان‌ها")}</h3>
          <div className="label-field-options">
            {(
              [
                ["en", "English", "انگلیسی"],
                ["fa", "Persian", "فارسی"],
              ] as const
            ).map(([key, en, fa]) => (
              <Checkbox
                key={key}
                checked={languages.includes(key)}
                onChange={(checked) =>
                  setLanguages((previous) =>
                    checked
                      ? [...new Set([...previous, key])].sort()
                      : previous.length > 1
                        ? previous.filter((item) => item !== key)
                        : previous,
                  )
                }
              >
                {t(en, fa)}
              </Checkbox>
            ))}
          </div>
        </div>
        {dirty && (
          <div className="label-designer-actions">
            <Button
              onClick={async () => {
                try {
                  if (!can("labels.settings_manage")) return;
                  await command(
                    "labels.settings_manage",
                    labelScope(state.config.company.seed_key),
                    (next, freshActor) => {
                      const before = structuredClone(next.label_settings);
                      next.label_settings = {
                        recent_price_days: days,
                        auto_add_approved: auto,
                        fields,
                        languages: languages as ("en" | "fa")[],
                      };
                      next.activity.push({
                        id: createId("label-settings"),
                        company_id: next.config.company.seed_key,
                        branch: "all",
                        action: "Save label settings",
                        by: freshActor.actor,
                        ...actorAudit(next, freshActor),
                        at: new Date().toISOString(),
                        reversible: true,
                        before,
                        after: next.label_settings,
                      });
                    },
                  );
                  setSaveError("");
                } catch (cause) {
                  setSaveError(errorText(cause, t));
                }
              }}
            >
              {t("Save changes", "ذخیره تغییرات")}
            </Button>
          </div>
        )}
      </Card>
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <TemplateDesigner key={`settings:${branch}`} />
    </div>
  );
}

const waitlistStyle = (item: LabelWaitlistItem) =>
  item.lot_id ? "promo" : (item.preferred_template ?? "regular");

export function Labels() {
  const { state, command, query, branch, lang, t } = useDemo();
  const requestedLot = useRouteParam("lot");
  const allWaiting = useMemo(
    () => (branch === "all" ? [] : branchLabelWaitlist(state, branch)),
    [state, branch],
  );
  const regularWaiting = useMemo(
    () => allWaiting.filter((item) => waitlistStyle(item) === "regular"),
    [allWaiting],
  );
  const promoWaiting = useMemo(
    () => allWaiting.filter((item) => waitlistStyle(item) === "promo"),
    [allWaiting],
  );
  const requestedPromo =
    requestedLot &&
    branch !== "all" &&
    allWaiting.some((item) => item.lot_id === requestedLot)
      ? state.templates.find(
          (item) =>
            item.company_id === state.config.company.seed_key &&
            item.style === "promo" &&
            !item.archived,
        )
      : undefined;
  const defaultStyle = requestedPromo
    ? "promo"
    : allWaiting[0]
      ? waitlistStyle(allWaiting[0])
      : "regular";
  const groupScope = `${state.config.company.seed_key}:${branch}`;
  const [selectedGroup, setSelectedGroup] = useState<{
    scope: string;
    style: "regular" | "promo";
  }>({ scope: groupScope, style: defaultStyle });
  const chosenStyle =
    selectedGroup.scope === groupScope ? selectedGroup.style : defaultStyle;
  const groupStyle =
    chosenStyle === "regular" &&
    regularWaiting.length === 0 &&
    promoWaiting.length > 0
      ? "promo"
      : chosenStyle === "promo" &&
          promoWaiting.length === 0 &&
          regularWaiting.length > 0
        ? "regular"
        : chosenStyle;
  const groupKey = `${groupScope}:${groupStyle}`;
  const waiting = groupStyle === "promo" ? promoWaiting : regularWaiting;
  const [tab, setTab] = useState(
    requestedPromo
      ? "waitlist"
      : state.templates.filter((item) => !item.archived).length
        ? "products"
        : "templates",
  );
  const [filters, setFilters] = useState(emptyLabelFilters);
  const [selection, setSelection] = useState<{
    branch: Branch;
    codes: string[];
  }>({
    branch,
    codes: [],
  });
  const [allCopies, setAllCopies] = useState(1);
  const [templateChoices, setTemplateChoices] = useState<
    Record<string, string>
  >({});
  const [startingSlots, setStartingSlots] = useState<Record<string, number>>(
    {},
  );
  const [error, setError] = useState("");
  const [pendingPrint, setPendingPrint] = useState<LabelPrintSnapshot | null>(
    null,
  );
  const [printState, setPrintState] = useState<ScopedReadView | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const templates = state.templates.filter(
    (item) =>
      item.company_id === state.config.company.seed_key && !item.archived,
  );
  const matchingTemplates = templates.filter(
    (item) => (item.style ?? "regular") === groupStyle,
  );
  const matchingTemplate =
    matchingTemplates.find((item) => item.built_in === groupStyle) ??
    matchingTemplates[0];
  const explicitTemplateId = templateChoices[groupKey];
  const templateId =
    explicitTemplateId === "" ||
    templates.some((item) => item.id === explicitTemplateId)
      ? explicitTemplateId
      : (matchingTemplate?.id ?? "");
  const setTemplateId = (id: string) =>
    setTemplateChoices((choices) => ({ ...choices, [groupKey]: id }));
  const startSlot = startingSlots[groupKey] ?? 1;
  const setStartSlot = (slot: number) =>
    setStartingSlots((slots) => ({ ...slots, [groupKey]: slot }));
  const template = templates.find((item) => item.id === templateId);
  const filteredProducts = useCatalogQuery(
    "labels.read",
    { ...labelScope(state.config.company.seed_key, branch), mutation: false },
    JSON.stringify(filters),
    (canonical, freshActor) =>
      filterLabelProducts(canonical, branch, filters).map((product) =>
        projectProductReadDTO(canonical, freshActor, product),
      ),
  );
  const products = filteredProducts.data ?? [];
  const queueProducts = waiting.flatMap((item) => {
    const product = state.products.find(
      (candidate) =>
        candidate.company_id === item.company_id &&
        candidate.code === item.product_code,
    );
    if (!product) return [];
    const clearance = item.lot_id
      ? effectiveProjectedClearanceOffers(state, product, branch).find(
          (offer) => offer.lot_id === item.lot_id,
        )
      : undefined;
    if (item.lot_id && !clearance) return [];
    return Array<LabelPrintProduct>(item.copies).fill({
      ...product,
      label_lot_id: item.lot_id,
      label_clearance_offer: clearance,
    });
  });
  const run = async (
    action: (next: DemoState, freshActor: AuthenticatedActor) => void,
    capability: "labels.queue_write" | "labels.print" = "labels.queue_write",
  ) => {
    try {
      await command(
        capability,
        labelScope(state.config.company.seed_key, branch),
        action,
      );
      setError("");
      return true;
    } catch (cause) {
      setError(errorText(cause, t));
      return false;
    }
  };
  const allowed = (product: ProductReadDTO) =>
    product.status === "active" &&
    branch !== "all" &&
    effectivePrice(state, product, branch) !== null;
  const selectable = products.filter(allowed);
  const selectedCodes =
    selection.branch === branch
      ? selection.codes.filter((code) =>
          state.products.some(
            (product) =>
              product.company_id === state.config.company.seed_key &&
              product.code === code &&
              allowed(product),
          ),
        )
      : [];
  const allFilteredSelected =
    selectable.length > 0 &&
    selectable.every((product) => selectedCodes.includes(product.code));
  const selectFiltered = (checked: boolean) => {
    const filteredCodes = selectable.map((product) => product.code);
    setSelection({
      branch,
      codes: checked
        ? [...new Set([...selectedCodes, ...filteredCodes])]
        : selectedCodes.filter((code) => !filteredCodes.includes(code)),
    });
  };
  const printable =
    waiting.length > 0 &&
    waiting.every((item) => {
      const product = state.products.find(
        (candidate) =>
          candidate.code === item.product_code &&
          candidate.company_id === item.company_id,
      );
      return (
        product &&
        allowed(product) &&
        (!item.lot_id ||
          (template?.style === "promo" &&
            effectiveProjectedClearanceOffers(state, product, branch).some(
              (offer) => offer.lot_id === item.lot_id,
            )))
      );
    });
  const print = async () => {
    if (printing) return;
    setPrinting(true);
    const release = beginAppWork();
    try {
      if (!template) throw new LabelWorkflowError("template");
      const snapshot = await query(
        "labels.print",
        labelScope(state.config.company.seed_key, branch),
        (current, freshActor) =>
          prepareLabelPrint(
            current,
            branch,
            template,
            startSlot,
            freshActor,
            waiting.map((item) => item.id),
          ),
      );
      flushSync(() => {
        setPendingPrint(snapshot);
        setPrintState(structuredClone(state));
      });
      if (
        isStoredFileReference(state.config.company.logo_data) &&
        state.label_settings?.fields?.logo !== false &&
        template.width >= 50
      ) {
        try {
          await waitForPrintImages(
            document.querySelector(".label-print-output"),
          );
        } catch {
          setError(
            t(
              "The label logo could not load. Reattach it in Settings or turn off Logo before printing.",
              "نشان برچسب بارگیری نشد. آن را در تنظیمات دوباره پیوست کنید یا پیش از چاپ نشان را خاموش کنید.",
            ),
          );
          return;
        }
      }
      window.print();
      setConfirmationOpen(true);
      setError("");
    } catch (cause) {
      setError(errorText(cause, t));
    } finally {
      release();
      setPrinting(false);
    }
  };
  const previewKey = JSON.stringify({
    branch,
    template,
    startSlot,
    waiting,
    printable,
  });
  const preview = useCatalogQuery(
    "labels.print",
    { ...labelScope(state.config.company.seed_key, branch), mutation: false },
    previewKey,
    (canonical, freshActor) => {
      if (!template || !printable) return [];
      return prepareLabelPrint(
        canonical,
        branch,
        template,
        startSlot,
        freshActor,
        waiting.map((item) => item.id),
      ).pages;
    },
  );
  const previewPages = preview.data ?? [];
  return (
    <>
      <PageHeader
        title={t("Labels", "برچسب‌ها")}
        description={t(
          "Add products to the waitlist, then preview and print.",
          "کالاها را به فهرست انتظار اضافه کنید، سپس پیش‌نمایش و چاپ کنید.",
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
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setError("");
          setPendingPrint(null);
          setPrintState(null);
        }}
        aria-label={t("Labels sections", "بخش‌های برچسب‌ها")}
        options={[
          { value: "products", label: t("Products", "کالاها") },
          {
            value: "waitlist",
            label: t("Waitlist", "فهرست انتظار"),
            count: allWaiting.length,
          },
          { value: "templates", label: t("Templates", "قالب‌ها") },
        ]}
      />
      <div className="labels-b-content">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {tab === "products" && (
          <Card className="labels-products-card">
            <FilterToolbar
              className="labels-filter-toolbar"
              search={
                <input
                  aria-label={t("Search products", "جستجوی کالاها")}
                  placeholder={t(
                    "Name, Product Code or barcode",
                    "نام، کد کالا یا بارکد",
                  )}
                  value={filters.query}
                  onChange={(event) =>
                    setFilters({ ...filters, query: event.target.value })
                  }
                />
              }
              count={countText(
                products.length,
                "product",
                "products",
                "کالا",
                lang,
              )}
            >
              <Checkbox
                checked={filters.arrived}
                onChange={(checked) =>
                  setFilters({ ...filters, arrived: checked })
                }
              >
                {t("Arrived today", "رسیده امروز")}
              </Checkbox>
              <Checkbox
                checked={filters.changed}
                onChange={(checked) =>
                  setFilters({ ...filters, changed: checked })
                }
              >
                {t("Price changed recently", "قیمت اخیراً تغییر کرده")}
              </Checkbox>
              <Checkbox
                checked={filters.onOffer}
                onChange={(checked) =>
                  setFilters({ ...filters, onOffer: checked })
                }
              >
                {t("On offer", "دارای پیشنهاد")}
              </Checkbox>
              <Select
                aria-label={t("Pricing category", "دسته قیمت‌گذاری")}
                value={filters.pricing}
                onChange={(value) => setFilters({ ...filters, pricing: value })}
                options={[
                  {
                    value: "",
                    label: t(
                      "All pricing categories",
                      "همه دسته‌های قیمت‌گذاری",
                    ),
                  },
                  ...state.config.pricing_categories.map((item) => ({
                    value: item.key,
                    label:
                      item.label_fa && lang === "fa"
                        ? item.label_fa
                        : categoryLabel(item.label, lang),
                  })),
                ]}
              />
              <Select
                aria-label={t("AI category", "دسته هوش مصنوعی")}
                value={filters.category}
                onChange={(value) =>
                  setFilters({ ...filters, category: value })
                }
                options={[
                  {
                    value: "",
                    label: t("All AI categories", "همه دسته‌های هوش مصنوعی"),
                  },
                  ...[
                    ...new Set(
                      state.products
                        .filter(
                          (item) =>
                            item.company_id === state.config.company.seed_key,
                        )
                        .map((item) => item.ai_category),
                    ),
                  ]
                    .sort()
                    .map((value) => ({ value, label: value })),
                ]}
              />
              <Select
                aria-label={t("Supplier", "تأمین‌کننده")}
                value={filters.supplier}
                onChange={(value) =>
                  setFilters({ ...filters, supplier: value })
                }
                options={[
                  { value: "", label: t("All suppliers", "همه تأمین‌کنندگان") },
                  ...[
                    ...new Set(
                      state.products
                        .filter(
                          (item) =>
                            item.company_id === state.config.company.seed_key,
                        )
                        .map((item) => item.main_supplier),
                    ),
                  ]
                    .sort()
                    .map((value) => ({ value, label: value })),
                ]}
              />
              <Button
                variant="ghost"
                onClick={() => setFilters(emptyLabelFilters)}
              >
                {t("Clear filters", "پاک کردن فیلترها")}
              </Button>
            </FilterToolbar>
            <div className="labels-selection-toolbar">
              <Checkbox
                checked={allFilteredSelected}
                disabled={selectable.length === 0}
                onChange={selectFiltered}
              >
                {t("Select all filtered", "انتخاب همه نتایج فیلترشده")}
              </Checkbox>
            </div>
            <DataTable
              className="labels-product-table"
              phoneList={{
                name: "product",
                value: "price",
                secondary: ["code", "offer"],
                selection: "selection",
              }}
              columns={[
                {
                  key: "selection",
                  width: 48,
                  minWidth: 48,
                  fixedWidth: true,
                  required: true,
                  mobilePrimary: true,
                },
                {
                  key: "product",
                  minWidth: 180,
                  priority: 1,
                  mobilePrimary: true,
                },
                {
                  key: "code",
                  width: 104,
                  minWidth: 104,
                  fixedWidth: true,
                  priority: 3,
                  mobilePrimary: false,
                },
                {
                  key: "offer",
                  width: 150,
                  minWidth: 150,
                  fixedWidth: true,
                  priority: 4,
                  mobilePrimary: false,
                },
                {
                  key: "price",
                  width: 156,
                  minWidth: 156,
                  fixedWidth: true,
                  priority: 2,
                  mobilePrimary: true,
                  align: "end",
                },
              ]}
            >
              <thead>
                <tr>
                  <th
                    aria-label={t(
                      "Select all filtered",
                      "انتخاب همه نتایج فیلترشده",
                    )}
                  />
                  <th>{t("Product", "کالا")}</th>
                  <th>{t("Product Code", "کد کالا")}</th>
                  <th>{t("Offer", "پیشنهاد")}</th>
                  <th>{t("Selling price", "قیمت فروش")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.code}
                    data-row-href={`#product?code=${encodeURIComponent(product.code)}`}
                  >
                    <td>
                      <Checkbox
                        aria-label={t(
                          `Select product ${product.code}`,
                          `انتخاب کالای ${product.code}`,
                        )}
                        checked={selectedCodes.includes(product.code)}
                        disabled={!allowed(product)}
                        onChange={(checked) =>
                          setSelection({
                            branch,
                            codes: checked
                              ? [...new Set([...selectedCodes, product.code])]
                              : selectedCodes.filter(
                                  (code) => code !== product.code,
                                ),
                          })
                        }
                      />
                    </td>
                    <td>
                      <ProductName product={product} language={lang} />
                    </td>
                    <td>
                      <LtrText>{product.code}</LtrText>
                    </td>
                    <td>
                      {activeSaleAt(state, product, branch) ? (
                        <Badge tone="info">{t("Sale", "حراج")}</Badge>
                      ) : (
                        effectiveOffer(state, product, branch) && (
                          <OfferLabel
                            label={
                              effectiveOffer(state, product, branch)!.label
                            }
                            language={lang}
                            currency={state.config.company.currency}
                          />
                        )
                      )}
                    </td>
                    <td>
                      {effectivePrice(state, product, branch) ? (
                        <div className="label-price-display">
                          <SalePrice
                            product={product}
                            branch={branch}
                            stacked
                          />
                          <SaleStatus
                            product={product}
                            branch={branch}
                            compact
                          />
                          <ManualPricePill product={product} branch={branch} />
                        </div>
                      ) : (
                        <span className="muted label-price-unavailable">
                          {t(
                            "No approved price yet",
                            "هنوز قیمت تأییدشده ندارد",
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {selectedCodes.length > 0 && (
              <div
                className="labels-selection-bar"
                data-pwa-unsaved="true"
                role="region"
                aria-label={t("Add to waitlist", "افزودن به فهرست انتظار")}
              >
                <Field
                  className="label-narrow-field"
                  label={t("Copies", "تعداد")}
                >
                  <NumberField
                    dir="ltr"
                    min="1"
                    max="1000"
                    step="1"
                    value={allCopies}
                    onChange={(value) => {
                      setAllCopies(
                        Math.max(
                          1,
                          Math.min(1000, Math.floor(Number(value) || 1)),
                        ),
                      );
                      setError("");
                    }}
                  />
                </Field>
                <Button
                  variant="tinted"
                  onClick={async () => {
                    if (
                      await run((next, freshActor) =>
                        addLabelsToWaitlist(
                          next,
                          selectedCodes,
                          allCopies,
                          branch,
                          freshActor,
                        ),
                      )
                    )
                      setSelection({ branch, codes: [] });
                  }}
                >
                  {translateCount(
                    "Add {{count}} product to waitlist",
                    "Add {{count}} products to waitlist",
                    "افزودن {{count}} کالا به فهرست انتظار",
                    "افزودن {{count}} کالا به فهرست انتظار",
                    selectedCodes.length,
                    lang,
                  )}
                </Button>
              </div>
            )}
            {products.length === 0 && (
              <EmptyState>
                {t(
                  "No products match these filters.",
                  "کالایی با این فیلترها پیدا نشد.",
                )}
              </EmptyState>
            )}
          </Card>
        )}
        {tab === "templates" && (
          <TemplateDesigner
            onSaved={(item) => {
              setTemplateId(item.id);
              setStartSlot(Math.min(5, labelLayout(item).capacity));
            }}
          />
        )}
        {tab === "waitlist" && (
          <>
            <Card
              className="labels-waitlist-card"
              title={t("Waitlist", "فهرست انتظار")}
            >
              {regularWaiting.length > 0 && promoWaiting.length > 0 && (
                <Tabs
                  value={groupStyle}
                  onChange={(style) => {
                    setSelectedGroup({
                      scope: groupScope,
                      style: style as "regular" | "promo",
                    });
                    setError("");
                    setPendingPrint(null);
                    setPrintState(null);
                  }}
                  aria-label={t("Label styles", "نوع برچسب")}
                  options={[
                    {
                      value: "regular",
                      label: t("Regular", "عادی"),
                      count: regularWaiting.reduce(
                        (total, item) => total + item.copies,
                        0,
                      ),
                    },
                    {
                      value: "promo",
                      label: t("Promo", "ویژه"),
                      count: promoWaiting.reduce(
                        (total, item) => total + item.copies,
                        0,
                      ),
                    },
                  ]}
                />
              )}
              <div className="labels-waitlist-heading">
                <span className="muted">
                  {countText(
                    allWaiting.length,
                    "product",
                    "products",
                    "کالا",
                    lang,
                  )}{" "}
                  ·{" "}
                  {countText(
                    allWaiting.reduce((total, item) => total + item.copies, 0),
                    "label",
                    "labels",
                    "برچسب",
                    lang,
                  )}
                </span>
                <Button
                  variant="destructive"
                  disabled={allWaiting.length === 0}
                  onClick={() =>
                    run((next, freshActor) =>
                      clearLabelWaitlist(next, branch, freshActor),
                    )
                  }
                >
                  {t("Clear waitlist", "پاک کردن فهرست انتظار")}
                </Button>
              </div>
              {waiting.length === 0 ? (
                <EmptyState>
                  {t(
                    "No labels waiting. Add products from the Products tab.",
                    "برچسبی در انتظار نیست. از بخش کالاها، کالا اضافه کنید.",
                  )}
                </EmptyState>
              ) : (
                <DataTable
                  className="labels-waitlist-table"
                  columns={[
                    {},
                    { width: 104 },
                    { width: 136, align: "end" },
                    { width: 144, align: "end" },
                    { width: 120, actions: true },
                  ]}
                >
                  <thead>
                    <tr>
                      <th>{t("Product", "کالا")}</th>
                      <th>{t("Product Code", "کد کالا")}</th>
                      <th>{t("Selling price", "قیمت فروش")}</th>
                      <th>{t("Copies", "تعداد")}</th>
                      <th>{t("Actions", "عملیات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waiting.map((item) => {
                      const product = state.products.find(
                        (candidate) =>
                          candidate.company_id === item.company_id &&
                          candidate.code === item.product_code,
                      );
                      const lotOffer =
                        product && item.lot_id
                          ? effectiveProjectedClearanceOffers(
                              state,
                              product,
                              branch,
                            ).find((offer) => offer.lot_id === item.lot_id)
                          : undefined;
                      return (
                        <tr key={item.id}>
                          <td>
                            {product ? (
                              <ProductName product={product} language={lang} />
                            ) : (
                              <LtrText>{item.product_code}</LtrText>
                            )}
                            {product &&
                              (item.lot_id ||
                                effectiveProjectedClearanceOffers(
                                  state,
                                  product,
                                  branch,
                                ).length > 0) && (
                                <Select
                                  aria-label={t(
                                    `Label price for ${item.product_code}`,
                                    `قیمت برچسب برای ${item.product_code}`,
                                  )}
                                  value={item.lot_id ?? ""}
                                  onChange={(value) =>
                                    run((next, freshActor) =>
                                      setLabelWaitlistLot(
                                        next,
                                        item.id,
                                        value || undefined,
                                        branch,
                                        freshActor,
                                      ),
                                    )
                                  }
                                  options={[
                                    {
                                      value: "",
                                      label: t("Regular price", "قیمت عادی"),
                                    },
                                    ...effectiveProjectedClearanceOffers(
                                      state,
                                      product,
                                      branch,
                                    ).map((offer) => ({
                                      value: offer.lot_id!,
                                      label: `${t("Clearance price", "قیمت فروش ویژه")} ${offer.price} · ${offer.expiry_date}`,
                                    })),
                                  ]}
                                />
                              )}
                          </td>
                          <td>
                            <LtrText>{item.product_code}</LtrText>
                          </td>
                          <td>
                            {product &&
                            allowed(product) &&
                            (!item.lot_id || lotOffer) ? (
                              <div className="label-price-display">
                                <ProductPrice
                                  value={
                                    lotOffer?.price ??
                                    effectivePrice(state, product, branch)!
                                  }
                                  product={product}
                                  config={state.config}
                                />
                                <ManualPricePill
                                  product={product}
                                  branch={branch}
                                />
                              </div>
                            ) : (
                              <span className="muted">
                                {t(
                                  item.lot_id
                                    ? "No active clearance offer"
                                    : "No approved price yet",
                                  item.lot_id
                                    ? "پیشنهاد فروش ویژهٔ فعالی وجود ندارد"
                                    : "هنوز قیمت تأییدشده ندارد",
                                )}
                              </span>
                            )}
                          </td>
                          <td>
                            <NumberField
                              aria-label={t(
                                `Copies for ${item.product_code}`,
                                `تعداد ${item.product_code}`,
                              )}
                              dir="ltr"
                              min="1"
                              max="1000"
                              step="1"
                              value={item.copies}
                              onChange={(value) =>
                                run((next, freshActor) =>
                                  editLabelWaitlist(
                                    next,
                                    item.id,
                                    Number(value),
                                    branch,
                                    freshActor,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                run((next, freshActor) =>
                                  editLabelWaitlist(
                                    next,
                                    item.id,
                                    null,
                                    branch,
                                    freshActor,
                                  ),
                                )
                              }
                            >
                              {t("Remove", "حذف از فهرست")}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              )}
            </Card>
            <Card
              className="labels-print-card"
              title={t("Preview and print", "پیش‌نمایش و چاپ")}
            >
              <div className="label-print-controls">
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
                        label: templateName(item, t),
                      })),
                    ]}
                  />
                </Field>
                <Field
                  className="label-narrow-field"
                  label={t("Starting slot", "خانه شروع")}
                >
                  <NumberField
                    dir="ltr"
                    min="1"
                    step="1"
                    value={startSlot}
                    onChange={(value) =>
                      setStartSlot(Math.max(1, Math.floor(Number(value) || 1)))
                    }
                  />
                </Field>
              </div>
              {!printable && waiting.length > 0 && (
                <p className="banner danger">
                  {t(
                    "Confirm every product and price before printing.",
                    "پیش از چاپ، تمام کالاها و قیمت‌ها را تأیید کنید.",
                  )}
                </p>
              )}
              {template ? (
                <div className="label-print-preview-grid">
                  <SheetPreview
                    template={template}
                    startSlot={startSlot}
                    onStartSlot={setStartSlot}
                    entries={queueProducts}
                    state={state}
                    branch={branch}
                  />
                  {previewPages.length > 0 && (
                    <div className="label-bilingual-preview">
                      <h3 className="label-grayscale-caption">
                        {t("Grayscale preview", "پیش‌نمایش خاکستری")}
                      </h3>
                      <p className="muted">
                        {countText(
                          previewPages.length,
                          "sheet",
                          "sheets",
                          "برگه",
                          lang,
                        )}{" "}
                        ·{" "}
                        {t(
                          "Print at 100% / Actual size, A4, no browser margins or headers.",
                          "با اندازه واقعی / 100٪، A4، بدون حاشیه و سرصفحه مرورگر چاپ کنید.",
                        )}
                      </p>
                      {previewPages.map((page, index) => (
                        <div className="label-grayscale-preview" key={index}>
                          <ScaledSheet>
                            <PhysicalSheet
                              template={template}
                              products={page}
                              state={state}
                              branch={branch}
                            />
                          </ScaledSheet>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="muted">
                  {t(
                    "Choose a saved template or create one in Templates.",
                    "یک قالب ذخیره‌شده انتخاب کنید یا در بخش قالب‌ها بسازید.",
                  )}
                </p>
              )}
              <DialogActions className="label-designer-actions">
                <Button
                  variant="tinted"
                  disabled={
                    printing ||
                    !template ||
                    !printable ||
                    previewPages.length === 0
                  }
                  onClick={print}
                >
                  {t("Print labels", "چاپ برچسب‌ها")}
                </Button>
              </DialogActions>
            </Card>
          </>
        )}
      </div>
      {pendingPrint &&
        printState &&
        createPortal(
          <div className="label-print-output">
            {pendingPrint.pages.map((page, index) => (
              <PhysicalSheet
                key={index}
                template={pendingPrint.template}
                products={page}
                state={printState}
                branch={pendingPrint.branch}
              />
            ))}
          </div>,
          document.body,
        )}
      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          setConfirmationOpen(open);
          if (!open) {
            setPendingPrint(null);
            setPrintState(null);
          }
        }}
        title={t(
          "Did the labels print correctly?",
          "آیا برچسب‌ها درست چاپ شدند؟",
        )}
      >
        <p>
          {t(
            "Only confirmed printed copies leave the waitlist.",
            "فقط تعداد چاپ‌شده و تأییدشده از فهرست انتظار خارج می‌شود.",
          )}
        </p>
        <DialogActions>
          <Button
            variant="neutral"
            onClick={() => {
              setConfirmationOpen(false);
              setPendingPrint(null);
              setPrintState(null);
            }}
          >
            {t("No", "خیر")}
          </Button>
          <Button
            onClick={async () => {
              if (
                pendingPrint &&
                !(await run((next, freshActor) => {
                  confirmLabelsPrinted(next, pendingPrint, freshActor);
                  confirmPriceTaskWaitlistLabels(
                    next,
                    freshActor,
                    pendingPrint,
                  );
                }, "labels.print"))
              )
                return;
              setConfirmationOpen(false);
              setPendingPrint(null);
              setPrintState(null);
            }}
          >
            {t("Yes", "بله")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
