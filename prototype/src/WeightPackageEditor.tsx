import {
  packageDraftsFromProducts,
  weightEditorErrorText,
  useWeightEditorScrollAnchor,
  type WeightPricingConfig,
} from "./weight-product-editor-ui";
import { useEffect, useId, useRef, useState } from "react";
import { Package, MoreHorizontal, Calculator, Plus } from "lucide-react";
import { useDemo } from "./store";
import { useCatalogQuery } from "./catalog-query";
import {
  calculatePackagePrice,
  packageSizeInLb,
  packageSettings,
  type PackageUnit,
} from "./package-pricing";
import { validatePackageBarcode } from "./package-barcodes";
import { previewWeightPackage } from "./package-service";
import {
  readWeightEditor,
  savePackageEditor,
  type WeightPackageDraft,
} from "./weight-product-editor";
import type { ProductReadDTO } from "./catalog-read-model";
import { configuredBranches, branchLabel } from "./settings";
import { pendingPrice, regularPrice } from "./catalog";
import {
  Button,
  Dialog,
  DialogActions,
  Field,
  Select,
  Menu,
  MenuItem,
  AutoTextarea as Textarea,
} from "./ui";
import { Money, LtrText, UnitText, categoryLabel } from "./presentation";
import { massUnitLabel } from "./formatters";
import "./weight-product-editor.css";

export function PackageSizeSection({
  parent,
  rows,
  onChange,
  pricePerLb,
  pendingPricePerLb,
  stagedPriceBranches,
  stagedPricePerLb,
  pendingPriceBranches,
  pricingConfig,
  parentIsNew = false,
}: {
  parent: ProductReadDTO;
  rows: WeightPackageDraft[];
  onChange(rows: WeightPackageDraft[]): void;
  pricePerLb: string | null;
  pendingPricePerLb?: string | null;
  stagedPriceBranches?: readonly string[];
  stagedPricePerLb?: string | null;
  pendingPriceBranches?: readonly string[];
  pricingConfig?: WeightPricingConfig;
  parentIsNew?: boolean;
}) {
  const { state, branch, actor, t, lang } = useDemo();
  const id = useId();
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState<PackageUnit>("g");
  const [previewLocation, setPreviewLocation] = useState("");
  const location = branch === "all" ? previewLocation : branch;
  const [editing, setEditing] = useState<WeightPackageDraft | null>(null);
  const [archiving, setArchiving] = useState<WeightPackageDraft | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [error, setError] = useState("");
  const counter = useRef(0);
  const visibleRows = rows;
  const retainControl = useWeightEditorScrollAnchor();
  const unitOptions = (["g", "kg", "lb", "oz"] as const).map((value) => ({
    value,
    label: value,
  }));
  const queryInput = [
    ...visibleRows.map((row) => ({ size: row.size, unit: row.unit })),
    { size, unit },
  ];
  const previews = useCatalogQuery(
    "catalog.package_edit",
    {
      company_id: parent.company_id,
      kind: "company_shared",
      entity_id: parentIsNew ? undefined : parent.code,
    },
    JSON.stringify({ parent: parent.code, location, queryInput }),
    (canonical, current) => {
      if (parentIsNew || !location) return [];
      return queryInput.map((row) => {
        try {
          return previewWeightPackage(
            canonical,
            current,
            parent.code,
            row.size,
            row.unit,
            location,
          ).price;
        } catch {
          return null;
        }
      });
    },
  );
  const preview = (
    rowSize: string,
    rowUnit: PackageUnit,
    index: number,
    proposed = false,
  ): string | null => {
    try {
      const price = proposed
        ? pendingPriceBranches
          ? pendingPriceBranches.includes(location)
            ? pendingPricePerLb
            : null
          : branch === "all" && !parentIsNew
            ? location
              ? pendingPrice(state, parent, location)
              : null
            : pendingPricePerLb
        : branch === "all" && !parentIsNew
          ? location
            ? stagedPriceBranches?.includes(location)
              ? stagedPricePerLb
              : regularPrice(state, parent, location)
            : null
          : pricePerLb;
      if (pricingConfig && price && (location || parentIsNew))
        return calculatePackagePrice(
          rowSize,
          rowUnit,
          price,
          "0.0000",
          parent.pricing_category,
          pricingConfig,
        ).selling_price;
      return proposed ? null : (previews.data?.[index] ?? null);
    } catch {
      return null;
    }
  };
  const sizeText = (row: Pick<WeightPackageDraft, "size" | "unit">) =>
    lang === "fa"
      ? `${row.size.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])} ${massUnitLabel(row.unit, lang)}`
      : `${row.size} ${row.unit}`;
  const validate = (row: WeightPackageDraft) => {
    packageSizeInLb(row.size, row.unit, state.config);
    if (row.barcode) validatePackageBarcode(row.barcode);
    const sizeLb = packageSizeInLb(row.size, row.unit, state.config);
    if (
      visibleRows.some(
        (other) =>
          !other.archived &&
          other.key !== row.key &&
          packageSizeInLb(other.size, other.unit, state.config) === sizeLb,
      )
    )
      throw new Error("duplicate_size");
  };
  const add = () => {
    const row: WeightPackageDraft = {
      key: `${id}-${++counter.current}`,
      size,
      unit,
      barcode: "",
      name_en: "",
      name_fa: "",
      generated: true,
    };
    try {
      validate(row);
      onChange([...rows, row]);
      setSize("");
      setError("");
    } catch {
      setError(
        t(
          "Enter a positive size that is not already listed.",
          "یک اندازه مثبت وارد کنید که در فهرست نباشد.",
        ),
      );
    }
  };
  const currency = state.config.company.currency;
  const fee = packageSettings(state.config).container_fee;
  const category = state.config.pricing_categories.find(
    (item) => item.key === parent.pricing_category,
  );
  return (
    <section
      onPointerDownCapture={(event) => {
        const control =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>("button,input,[role=combobox]")
            : null;
        if (control) retainControl(control);
      }}
      onInputCapture={(event) => {
        if (event.target instanceof HTMLElement) retainControl(event.target);
      }}
      onKeyDownCapture={(event) => {
        if (
          ["Enter", " "].includes(event.key) &&
          event.target instanceof HTMLElement
        )
          retainControl(event.target);
      }}
      className="product-editor-section weight-package-section"
      aria-label={t("Package sizes", "اندازه بسته‌ها")}
    >
      <div className="weight-package-heading">
        <h3 className="product-editor-section-title">
          {t("Package sizes", "اندازه بسته‌ها")}
        </h3>
        <span className="muted">
          {t(
            "Each size is its own item with its own code and label.",
            "هر اندازه یک کالای جدا با کد و برچسب خودش است.",
          )}
        </span>
      </div>
      <p className="weight-package-formula">
        <Calculator aria-hidden="true" size={16} />
        <span>
          {t("Package price = size × ", "قیمت بسته = اندازه × ")}
          {pricePerLb ? (
            <>
              <LtrText>
                <Money value={pricePerLb} currency={currency} />
                /lb
              </LtrText>
            </>
          ) : (
            t("approved price per lb", "قیمت تأییدشده هر پوند")
          )}{" "}
          + <Money value={fee} currency={currency} />{" "}
          {t(
            `container, then the ${categoryLabel(category?.label ?? "", lang)} rounding. Prices update when the price per lb changes.`,
            `ظرف، سپس گرد کردن ${categoryLabel(category?.label ?? "", lang)}. با تغییر قیمت هر پوند، قیمت‌ها خودکار به‌روز می‌شوند.`,
          )}
        </span>
      </p>
      {branch === "all" && (
        <Field label={t("Preview location", "مکان پیش‌نمایش")}>
          <Select
            value={previewLocation}
            onChange={setPreviewLocation}
            placeholder={t("Choose location", "انتخاب مکان")}
            options={configuredBranches(state.config)
              .filter((value) => actor?.allowed_branches.includes(value))
              .map((value) => ({
                value,
                label: branchLabel(state.config, value, lang),
              }))}
          />
        </Field>
      )}
      <div
        className="weight-package-table"
        role="table"
        aria-label={t("Package sizes", "اندازه بسته‌ها")}
      >
        <div
          className="weight-package-row weight-package-table-head"
          role="row"
        >
          <span role="columnheader">{t("Size", "اندازه")}</span>
          <span role="columnheader" className="weight-package-number">
            {t("Product Code", "کد محصول")}
          </span>
          <span role="columnheader" className="weight-package-number">
            {t("Barcode", "بارکد")}
          </span>
          <span role="columnheader" className="weight-package-number">
            {t("Price", "قیمت")}
          </span>
          <span role="columnheader">
            <span className="sr-only">{t("Actions", "کارها")}</span>
          </span>
        </div>
        {visibleRows.map((row, index) => {
          const price = preview(row.size, row.unit, index);
          const proposed = preview(row.size, row.unit, index, true);
          return (
            <div
              className="weight-package-row"
              role="row"
              key={row.key}
              data-package-code={row.code ?? "staged"}
              data-pending-archive={row.archived || undefined}
            >
              <span role="cell" className="weight-package-size">
                <Package size={16} aria-hidden="true" />
                <strong>
                  <UnitText>{sizeText(row)}</UnitText>
                </strong>
              </span>
              <span role="cell" className="weight-package-number">
                <LtrText>
                  {row.code ??
                    t("Assigned on save", "هنگام ذخیره تعیین می‌شود")}
                </LtrText>
              </span>
              <span
                role="cell"
                className="weight-package-number weight-package-barcode"
              >
                <LtrText>
                  {row.barcode ||
                    t("Assigned on save", "هنگام ذخیره تعیین می‌شود")}
                </LtrText>
                {(row.generated || row.archived) && (
                  <span>
                    {row.archived
                      ? t("Archive on save", "بایگانی هنگام ذخیره")
                      : t("In-store", "داخلی")}
                  </span>
                )}
              </span>
              <span
                role="cell"
                className="weight-package-number weight-package-price"
              >
                {price ? <Money value={price} currency={currency} /> : "—"}
                {proposed && proposed !== price && (
                  <span className="muted">
                    {t("Pending", "در انتظار")}{" "}
                    <Money value={proposed} currency={currency} />
                  </span>
                )}
              </span>
              <span role="cell">
                {row.archived ? (
                  <Button
                    variant="plain"
                    className="weight-package-undo"
                    onClick={() =>
                      onChange(
                        rows.map((other) =>
                          other.key === row.key
                            ? {
                                ...other,
                                archived: false,
                                archive_reason: undefined,
                              }
                            : other,
                        ),
                      )
                    }
                  >
                    {t("Undo", "برگرداندن")}
                  </Button>
                ) : (
                  <Menu
                    label={t(
                      `Package actions ${sizeText(row)}`,
                      `کارهای بسته ${sizeText(row)}`,
                    )}
                    icon={<MoreHorizontal size={18} aria-hidden="true" />}
                    iconOnly
                    showChevron={false}
                    className="weight-package-menu"
                  >
                    <MenuItem
                      onClick={() => {
                        setEditing({ ...row });
                        setError("");
                      }}
                    >
                      {t("Edit", "ویرایش")}
                    </MenuItem>
                    <MenuItem
                      className="danger"
                      onClick={() => {
                        setArchiving(row);
                        setArchiveReason("");
                        setError("");
                      }}
                    >
                      {t("Archive", "بایگانی")}
                    </MenuItem>
                  </Menu>
                )}
              </span>
            </div>
          );
        })}
        {!visibleRows.length && (
          <p className="muted weight-package-empty">
            {t("No package sizes yet.", "هنوز اندازه بسته‌ای افزوده نشده است.")}
          </p>
        )}
      </div>
      <div
        className="weight-package-add ui-control-row is-field-row"
        data-alignment-row="package-new-size"
      >
        <Field label={t("New size", "اندازه جدید")}>
          <input
            aria-label={t("New size", "اندازه جدید")}
            dir="ltr"
            inputMode="decimal"
            value={size}
            onChange={(event) => {
              setSize(event.target.value);
              setError("");
            }}
          />
        </Field>
        <Field
          label={t("Unit", "واحد")}
          labelContent={<span className="sr-only">{t("Unit", "واحد")}</span>}
          className="weight-package-add-unit"
        >
          <Select
            aria-label={t("Package unit", "واحد بسته")}
            value={unit}
            onChange={(value) => setUnit(value as PackageUnit)}
            options={unitOptions}
          />
        </Field>
        <div className="weight-package-add-preview">
          <span className="muted">{t("Price", "قیمت")}</span>
          <strong>
            {preview(size, unit, visibleRows.length) ? (
              <Money
                value={preview(size, unit, visibleRows.length)!}
                currency={currency}
              />
            ) : (
              "—"
            )}
          </strong>
        </div>
        <Button variant="neutral" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          {t("Add size", "افزودن اندازه")}
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          title={t("Edit package size", "ویرایش اندازه بسته")}
          className="weight-package-edit-dialog"
        >
          <div className="form-grid">
            <Field label={t("Size", "اندازه")}>
              <input
                dir="ltr"
                inputMode="decimal"
                value={editing.size}
                onChange={(event) =>
                  setEditing({ ...editing, size: event.target.value })
                }
              />
            </Field>
            <Field label={t("Unit", "واحد")}>
              <Select
                value={editing.unit}
                onChange={(value) =>
                  setEditing({ ...editing, unit: value as PackageUnit })
                }
                options={unitOptions}
              />
            </Field>
            <Field label={t("Barcode (optional)", "بارکد (اختیاری)")}>
              <input
                dir="ltr"
                value={editing.barcode}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    barcode: event.target.value,
                    generated:
                      rows.find((row) => row.key === editing.key)?.generated &&
                      event.target.value ===
                        rows.find((row) => row.key === editing.key)?.barcode,
                  })
                }
              />
            </Field>
            <Field label={t("English name", "نام انگلیسی")}>
              <input
                dir="ltr"
                value={editing.name_en}
                onChange={(event) =>
                  setEditing({ ...editing, name_en: event.target.value })
                }
              />
            </Field>
            <Field label={t("Persian name (optional)", "نام فارسی (اختیاری)")}>
              <input
                dir="rtl"
                value={editing.name_fa}
                onChange={(event) =>
                  setEditing({ ...editing, name_fa: event.target.value })
                }
              />
            </Field>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <DialogActions>
            <Button variant="neutral" onClick={() => setEditing(null)}>
              {t("Cancel", "لغو")}
            </Button>
            <Button
              onClick={() => {
                try {
                  validate(editing);
                  if (editing.code && !editing.name_en.trim())
                    throw new Error("name");
                  onChange(
                    rows.map((row) =>
                      row.key === editing.key ? editing : row,
                    ),
                  );
                  setEditing(null);
                  setError("");
                } catch {
                  setError(
                    t(
                      "Check the size and barcode. The size must be unique and a manufacturer barcode needs a valid check digit.",
                      "اندازه و بارکد را بررسی کنید. اندازه باید یکتا و رقم کنترل بارکد سازنده معتبر باشد.",
                    ),
                  );
                }
              }}
            >
              {t("Apply to draft", "اعمال در پیش‌نویس")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {archiving && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setArchiving(null);
          }}
          title={t("Archive package size", "بایگانی اندازه بسته")}
          description={t(
            "The package and its history are retained. Changes apply when you save.",
            "بسته و تاریخچه آن حفظ می‌شود. تغییرات هنگام ذخیره اعمال می‌شود.",
          )}
        >
          <Field label={t("Reason", "دلیل")}>
            <Textarea
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
          </Field>
          <DialogActions>
            <Button variant="neutral" onClick={() => setArchiving(null)}>
              {t("Cancel", "لغو")}
            </Button>
            <Button
              variant="destructive"
              disabled={!archiveReason.trim()}
              onClick={() => {
                onChange(
                  rows.map((row) =>
                    row.key === archiving.key
                      ? {
                          ...row,
                          archived: true,
                          archive_reason: archiveReason.trim(),
                        }
                      : row,
                  ),
                );
                setArchiving(null);
              }}
            >
              {t("Archive", "بایگانی")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </section>
  );
}

export function PackageSizesDialog({
  product,
  onClose,
}: {
  product: ProductReadDTO;
  onClose(): void;
}) {
  const { state, branch, command, t, lang } = useDemo();
  const scope = {
    company_id: product.company_id,
    kind: "company_shared" as const,
    entity_id: product.code,
  };
  const boot = useCatalogQuery(
    "catalog.package_edit",
    scope,
    product.code,
    (canonical, actor) =>
      readWeightEditor(canonical, actor, product.code, true),
  );
  const [snapshot, setSnapshot] = useState("");
  const [rows, setRows] = useState<WeightPackageDraft[]>([]);
  const initialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (boot.data && !initialized.current) {
      initialized.current = true;
      setSnapshot(boot.data.snapshot);
      setRows(packageDraftsFromProducts(boot.data.packages));
    }
  }, [boot.data]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={t("Package sizes", "اندازه بسته‌ها")}
      description={
        <UnitText>
          {lang === "fa" ? product.name_fa || product.name_en : product.name_en}
        </UnitText>
      }
      className="product-editor-dialog weight-product-dialog"
    >
      <div className="product-editor-body">
        <div className="weight-product-content">
          <PackageSizeSection
            parent={product}
            rows={rows}
            onChange={setRows}
            pricePerLb={regularPrice(state, product, branch)}
            pendingPricePerLb={pendingPrice(state, product, branch)}
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
      </div>
      <DialogActions>
        <Button variant="neutral" onClick={onClose} disabled={saving}>
          {t("Cancel", "لغو")}
        </Button>
        <Button
          disabled={!boot.ready || saving || !snapshot}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              await command(
                "catalog.package_edit",
                { ...scope, mutation: true },
                (canonical, actor) =>
                  savePackageEditor(
                    canonical,
                    actor,
                    product.code,
                    snapshot,
                    rows,
                  ),
              );
              onClose();
            } catch (cause) {
              setError(weightEditorErrorText(cause, t));
            } finally {
              setSaving(false);
            }
          }}
        >
          {t("Save changes", "ذخیره تغییرات")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
