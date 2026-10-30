import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Plus, RotateCcw, X } from "lucide-react";
import { useDemo } from "../store";
import {
  Button,
  Dialog,
  Field,
  Select,
  NumberField,
  BufferedTextarea,
} from "../ui";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import { branchLabel } from "../settings";
import { DateText, LtrText } from "../presentation";
import { formatMoney } from "../formatters";
import { createId } from "../ids";
import {
  createReturn,
  normalizeReturnQuantity,
  type ReturnQuantityUnit,
  returnCreateChoices,
  returnCreateScope,
  returnReasons,
  type ReturnCreateChoices,
  type ReturnCreateProductChoice,
  type ReturnCreateSourceInput,
  type ReturnReason,
} from "../return-create";
import {
  uploadReturnCreationPhoto,
  type ReturnCreationPhoto,
} from "../return-create-files";
import { returnReasonLabel } from "../return-reason-copy";
import "./new-return.css";

type Translate = (en: string, fa: string) => string;

function errorCopy(code: string, t: Translate): string {
  const errors: Record<string, [string, string]> = {
    location: ["Choose an allowed location.", "یک مکان مجاز انتخاب کنید."],
    supplier: [
      "Choose the supplier who delivered this product.",
      "تأمین‌کننده‌ای را انتخاب کنید که این محصول را تحویل داده است.",
    ],
    product: [
      "Choose a received product from this supplier.",
      "یک محصول دریافت‌شده از این تأمین‌کننده انتخاب کنید.",
    ],
    quantity: [
      "Enter a positive quantity: whole units or cases, or weight with up to three decimal places.",
      "مقدار مثبت وارد کنید: واحد یا کارتن کامل، یا وزن با حداکثر سه رقم اعشار.",
    ],
    unit: [
      "Choose one of the received product's units.",
      "یکی از واحدهای محصول دریافت‌شده را انتخاب کنید.",
    ],
    reason: ["Choose a return reason.", "دلیل مرجوعی را انتخاب کنید."],
    note: ["Add a note for Other.", "برای سایر، یادداشت بنویسید."],
    photos: [
      "Add at least one photo for damaged or expired goods.",
      "برای کالای آسیب‌دیده یا منقضی‌شده دست‌کم یک عکس اضافه کنید.",
    ],
    image: [
      "Choose a PNG, JPG, WebP or GIF photo.",
      "عکسی با قالب PNG، JPG، WebP یا GIF انتخاب کنید.",
    ],
    quota: [
      "The photo could not be saved. Free some browser storage and try again.",
      "عکس ذخیره نشد. بخشی از فضای مرورگر را خالی کرده و دوباره تلاش کنید.",
    ],
    source_cost: [
      "This receipt's cost needs a manager's review before a return can be created.",
      "پیش از ایجاد مرجوعی، هزینه این رسید باید توسط مدیر بررسی شود.",
    ],
    source_ambiguous: [
      "The latest receipts disagree. Ask a manager to review the receipt before creating this return.",
      "آخرین رسیدها متفاوت‌اند. پیش از ایجاد مرجوعی از مدیر بخواهید رسید را بررسی کند.",
    ],
    source_currency: [
      "This receipt's currency needs a manager's review before this return can be created.",
      "پیش از ایجاد این مرجوعی، ارز رسید باید توسط مدیر بررسی شود.",
    ],
    changed: [
      "The receipt or your access changed. Refresh the choices and try again.",
      "رسید یا دسترسی شما تغییر کرد. گزینه‌ها را تازه‌سازی کرده و دوباره تلاش کنید.",
    ],
    request: [
      "This request changed after saving. Close this form and open a new return.",
      "این درخواست پس از ذخیره تغییر کرد. فرم را ببندید و مرجوعی تازه‌ای باز کنید.",
    ],
    module: [
      "Returns is switched off. Ask a manager to enable it.",
      "بخش مرجوعی خاموش است. از مدیر بخواهید آن را فعال کند.",
    ],
  };
  return errors[code]
    ? t(...errors[code])
    : t(
        "The return was not saved. Check your access and browser storage, then try again.",
        "مرجوعی ذخیره نشد. دسترسی و فضای ذخیره‌سازی مرورگر را بررسی کرده و دوباره تلاش کنید.",
      );
}
export function NewReturnDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const {
    state,
    actor,
    branch,
    can,
    command,
    query,
    t,
    lang,
    businessRevision,
    authorityGeneration,
  } = useDemo();
  const [location, setLocation] = useState(branch === "all" ? "" : branch);
  const [supplier, setSupplier] = useState("");
  const [productCode, setProductCode] = useState("");
  const [chosenProduct, setChosenProduct] =
    useState<ReturnCreateProductChoice | null>(null);
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState<ReturnQuantityUnit>("units");
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [note, setNote] = useState("");
  const [requestId] = useState(() => createId("new-return"));
  const [photos, setPhotos] = useState<
    { id: string; name: string; url: string; handle: ReturnCreationPhoto }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    urls = useRef(new Set<string>());
  const [loaded, setLoaded] = useState<{
    key: string;
    data: ReturnCreateChoices;
  } | null>(null);
  const company = state.config.company.seed_key;
  const key = JSON.stringify([
    company,
    actor?.user_id,
    actor?.session_id,
    actor?.person_version,
    actor?.authority_epoch,
    authorityGeneration,
    actor?.selection,
    location,
    refresh,
  ]);
  const permitted = Boolean(
    actor &&
    location &&
    can("returns.create", returnCreateScope(company, location, true)),
  );
  const choices = loaded?.key === key && permitted ? loaded.data : null;
  const locations = actor
    ? actor.allowed_branches.filter((id) =>
        can("returns.create", returnCreateScope(company, id, true)),
      )
    : [];
  const product =
    chosenProduct?.product_code === productCode &&
    chosenProduct.supplier_id === supplier
      ? chosenProduct
      : null;
  const sourceChanged = Boolean(
    product &&
    choices &&
    !choices.products.some(
      (item) =>
        item.supplier_id === supplier &&
        item.product_code === productCode &&
        item.source_fingerprint === product.source_fingerprint,
    ),
  );

  const source: ReturnCreateSourceInput = {
    request_id: requestId,
    branch: location,
    supplier_id: supplier,
    product_code: productCode,
    source_fingerprint: product?.source_fingerprint ?? "",
  };
  const busy = saving || uploading;
  useEffect(() => {
    alive.current = true;
    const currentUrls = urls.current;
    return () => {
      alive.current = false;
      for (const url of currentUrls) URL.revokeObjectURL(url);
      currentUrls.clear();
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!permitted) return;
    void query(
      "returns.create",
      returnCreateScope(company, location),
      (canonical, current) => returnCreateChoices(canonical, current, location),
    )
      .then((data) => {
        if (active) setLoaded({ key, data });
      })
      .catch((caught: unknown) => {
        if (active) {
          setLoaded(null);
          setError(errorCopy(caught instanceof Error ? caught.message : "", t));
        }
      });
    return () => {
      active = false;
    };
  }, [key, permitted, query, company, location, businessRevision, t]);
  const clearPhotos = () => {
    for (const photo of photos) {
      URL.revokeObjectURL(photo.url);
      urls.current.delete(photo.url);
    }
    setPhotos([]);
  };
  const refreshChoices = () => {
    clearPhotos();
    setChosenProduct(null);
    setProductCode("");
    setRefresh((value) => value + 1);
    setError("");
    setIssues((current) =>
      current.filter((issue) => !["product", "photos"].includes(issue.id)),
    );
  };
  const clearIssue = (id: string) =>
    setIssues((current) => current.filter((item) => item.id !== id));
  const upload = async (files: File[]) => {
    if (
      !actor ||
      !product ||
      product.issue ||
      sourceChanged ||
      !files.length ||
      busy
    )
      return;
    setUploading(true);
    setError("");
    try {
      const batch = await Promise.all(
        files.map(async (file) => {
          const handle = await uploadReturnCreationPhoto(query, {
            ...source,
            company_id: company,
            file,
          });
          return { file, handle };
        }),
      );
      if (!alive.current) return;
      const added = batch.map(({ file, handle }) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return {
          id: createId("return-photo-preview"),
          name: file.name,
          url,
          handle,
        };
      });
      setPhotos((current) => [...current, ...added]);
      clearIssue("photos");
    } catch (caught) {
      if (alive.current)
        setError(errorCopy(caught instanceof Error ? caught.message : "", t));
    } finally {
      if (alive.current) setUploading(false);
    }
  };
  const save = async () => {
    if (busy || !actor) return;
    const missing: ValidationIssue[] = [];
    const add = (id: string, message: string) =>
      missing.push({ id, message, fieldId: `new-return-${id}` });
    if (!location) add("location", errorCopy("location", t));
    if (!supplier) add("supplier", errorCopy("supplier", t));
    if (!product) add("product", errorCopy("product", t));
    else if (sourceChanged) add("product", errorCopy("changed", t));
    else if (product.issue) add("product", errorCopy(product.issue, t));
    try {
      if (!product) throw new Error("product");
      normalizeReturnQuantity(
        quantity,
        quantityUnit,
        product.quantity_unit,
        product.unit_multipliers,
      );
    } catch {
      add("quantity", errorCopy("quantity", t));
    }
    if (!reason) add("reason", errorCopy("reason", t));
    if (reason === "other" && !note.trim()) add("note", errorCopy("note", t));
    if ((reason === "damaged" || reason === "expired") && !photos.length)
      add("photos", errorCopy("photos", t));
    setIssues(missing);
    setError("");
    if (missing.length || !product || !reason) return;
    setSaving(true);
    try {
      const id = await command(
        "returns.create",
        returnCreateScope(company, location, true),
        (canonical, current) =>
          createReturn(canonical, current, {
            ...source,
            quantity,
            quantity_unit: quantityUnit,
            reason,
            note,
            photos: photos.map((photo) => photo.handle),
          }),
      );
      if (alive.current) onCreated(id);
    } catch (caught) {
      if (alive.current)
        setError(errorCopy(caught instanceof Error ? caught.message : "", t));
    } finally {
      if (alive.current) setSaving(false);
    }
  };
  const fieldError = (id: string) =>
    issues.find((item) => item.id === id)?.message;
  let normalizedQuantity = "";
  if (product && quantity && quantityUnit !== product.quantity_unit) {
    try {
      normalizedQuantity = normalizeReturnQuantity(
        quantity,
        quantityUnit,
        product.quantity_unit,
        product.unit_multipliers,
      ).toString();
    } catch {
      /* The normal field validation explains incomplete input on save. */
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={t("New return", "مرجوعی جدید")}
      description={t(
        "Set aside received goods and keep a clear record for the supplier.",
        "کالای دریافت‌شده را کنار بگذارید و سابقه روشنی برای تأمین‌کننده نگه دارید.",
      )}
      icon={<RotateCcw size={24} />}
      className="new-return-dialog ui-form-surface"
      footer={
        <>
          <Button variant="neutral" disabled={busy} onClick={onClose}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            <Plus size={18} />
            {saving
              ? t("Saving…", "در حال ذخیره…")
              : t("Create return", "ایجاد مرجوعی")}
          </Button>
        </>
      }
    >
      <WhatsMissing issues={issues} />
      {error && (
        <div className="banner danger" role="alert">
          {error}
          <Button
            variant="plain"
            disabled={busy}
            onClick={() => {
              refreshChoices();
            }}
          >
            {t("Refresh choices", "تازه‌سازی گزینه‌ها")}
          </Button>
        </div>
      )}
      <div className="new-return-grid">
        <Field label={t("Location", "مکان")} error={fieldError("location")}>
          <Select
            id="new-return-location"
            disabled={busy || branch !== "all"}
            value={location}
            placeholder={t("Choose location", "انتخاب مکان")}
            options={locations.map((id) => ({
              value: id,
              label: branchLabel(state.config, id, lang),
            }))}
            onChange={(value) => {
              clearPhotos();
              setLocation(value);
              setSupplier("");
              setProductCode("");
              setChosenProduct(null);
              clearIssue("location");
            }}
          />
        </Field>
        <Field
          label={t("Supplier", "تأمین‌کننده")}
          error={fieldError("supplier")}
        >
          <Select
            id="new-return-supplier"
            searchable
            disabled={busy || !choices}
            value={supplier}
            placeholder={t("Choose a supplier", "انتخاب تأمین‌کننده")}
            options={(choices?.suppliers ?? []).map((item) => ({
              value: item.id,
              label: item.name,
              searchTerms: [item.name],
            }))}
            onChange={(value) => {
              clearPhotos();
              setSupplier(value);
              setProductCode("");
              setChosenProduct(null);
              clearIssue("supplier");
            }}
          />
        </Field>
        <Field
          className="new-return-product"
          label={t("Product", "محصول")}
          error={fieldError("product")}
        >
          <Select
            id="new-return-product"
            searchable
            disabled={busy || !supplier || !choices}
            value={productCode}
            placeholder={t(
              "Choose a received product",
              "انتخاب محصول دریافت‌شده",
            )}
            options={(choices?.products ?? [])
              .filter((item) => item.supplier_id === supplier)
              .map((item) => ({
                value: item.product_code,
                label: `${lang === "fa" ? item.name_fa || item.name_en : item.name_en} · \u2066${item.unit_size}\u2069 · \u2066${item.product_code}\u2069`,
                searchTerms: [
                  item.name_en,
                  item.name_fa,
                  item.product_code,
                  item.barcode,
                ],
              }))}
            onChange={(value) => {
              clearPhotos();
              setProductCode(value);
              const chosen =
                choices?.products.find(
                  (item) =>
                    item.supplier_id === supplier &&
                    item.product_code === value,
                ) ?? null;
              setChosenProduct(chosen);
              setQuantityUnit(chosen?.received_unit ?? "units");
              clearIssue("product");
            }}
          />
        </Field>
        <div className="new-return-receipt" aria-live="polite">
          {product ? (
            <>
              <span>
                {t("Last received", "آخرین دریافت")}:{" "}
                <DateText value={product.last_received_at} />
              </span>
              {product.unit_cost !== undefined && (
                <span>
                  {t("Unit cost", "هزینه واحد")}:{" "}
                  <LtrText>
                    {formatMoney(product.unit_cost, {
                      currency: product.currency,
                      decimals: 4,
                      fixedDecimals: true,
                    })}
                  </LtrText>
                </span>
              )}
              {sourceChanged && (
                <p className="form-error">
                  {errorCopy("changed", t)}{" "}
                  <Button
                    variant="plain"
                    disabled={busy}
                    onClick={refreshChoices}
                  >
                    {t("Refresh choices", "تازه‌سازی گزینه‌ها")}
                  </Button>
                </p>
              )}
              {product.issue && (
                <p className="form-error">{errorCopy(product.issue, t)}</p>
              )}
            </>
          ) : (
            <span className="muted">
              {choices && choices.products.length === 0
                ? t(
                    "No received products here yet. Post an invoice at this location first.",
                    "هنوز محصولی اینجا دریافت نشده است. ابتدا فاکتوری در این مکان ثبت کنید.",
                  )
                : t(
                    "Choose a supplier and product to see the last receipt.",
                    "برای دیدن آخرین دریافت، تأمین‌کننده و محصول را انتخاب کنید.",
                  )}
            </span>
          )}
        </div>
        <div className="new-return-quantity-row">
          <Field label={t("Quantity", "مقدار")} error={fieldError("quantity")}>
            <NumberField
              id="new-return-quantity"
              keepTyping
              disabled={busy}
              min="0"
              step={
                quantityUnit === "lb" || quantityUnit === "kg" ? "0.001" : "1"
              }
              value={quantity}
              onChange={(value) => {
                setQuantity(value);
                clearIssue("quantity");
              }}
            />
          </Field>
          <Field label={t("Unit", "واحد")}>
            <Select
              id="new-return-unit"
              disabled={busy || !product}
              value={quantityUnit}
              aria-label={t("Unit", "واحد")}
              options={(
                Object.keys(
                  product?.unit_multipliers ?? { units: "1" },
                ) as ReturnQuantityUnit[]
              ).map((unit) => ({
                value: unit,
                label:
                  unit === "units"
                    ? t("Units", "واحد")
                    : unit === "cases"
                      ? t("Cases", "کارتن")
                      : unit,
              }))}
              onChange={(value) => {
                setQuantityUnit(value as ReturnQuantityUnit);
                clearIssue("quantity");
              }}
            />
          </Field>
        </div>
        {normalizedQuantity && product && (
          <p className="new-return-normalized muted">
            {t("Recorded as", "ثبت به صورت")}{" "}
            <bdi dir="ltr">
              {normalizedQuantity}{" "}
              {product.quantity_unit === "lb" ? "lb" : t("units", "واحد")}
            </bdi>
          </p>
        )}
        <Field label={t("Reason", "دلیل")} error={fieldError("reason")}>
          <Select
            id="new-return-reason"
            disabled={busy}
            value={reason}
            placeholder={t("Choose a reason", "انتخاب دلیل")}
            options={returnReasons.map((value) => ({
              value,
              label: returnReasonLabel(value, t),
            }))}
            onChange={(value) => {
              setReason(value as ReturnReason);
              clearIssue("reason");
            }}
          />
        </Field>
        <Field
          label={
            reason === "other"
              ? t("Note", "یادداشت")
              : t("Note (optional)", "یادداشت (اختیاری)")
          }
          error={fieldError("note")}
        >
          <BufferedTextarea
            id="new-return-note"
            disabled={busy}
            value={note}
            rows={2}
            onChange={(event) => {
              setNote(event.target.value);
              clearIssue("note");
            }}
          />
        </Field>
      </div>
      <section
        className="new-return-photos"
        id="new-return-photos"
        aria-label={t("Photos", "عکس‌ها")}
      >
        <div className="new-return-photo-heading">
          <strong>{t("Photos", "عکس‌ها")}</strong>
          <span className="muted">
            {t(
              "Required for Damaged or Expired",
              "برای آسیب‌دیده یا منقضی‌شده الزامی است",
            )}
          </span>
        </div>
        <div className="new-return-photo-actions">
          <Button
            variant="neutral"
            disabled={
              busy || !product || sourceChanged || Boolean(product.issue)
            }
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={18} />
            {t("Add photos", "افزودن عکس")}
          </Button>
          <Button
            variant="neutral"
            disabled={
              busy || !product || sourceChanged || Boolean(product.issue)
            }
            onClick={() => cameraRef.current?.click()}
          >
            <Camera size={18} />
            {t("Take photo", "گرفتن عکس")}
          </Button>
          <span className="muted" role="status">
            {uploading
              ? t("Saving photos…", "در حال ذخیره عکس‌ها…")
              : t(
                  photos.length === 1
                    ? "1 photo saved"
                    : `${photos.length} photos saved`,
                  `${photos.length} عکس ذخیره شد`,
                )}
          </span>
        </div>
        <input
          ref={fileRef}
          className="ui-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          aria-label={t("Choose return photos", "انتخاب عکس‌های مرجوعی")}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          className="ui-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label={t("Capture return photo", "گرفتن عکس مرجوعی")}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        {photos.length > 0 && (
          <div className="new-return-photo-list">
            {photos.map((photo) => (
              <div className="new-return-photo" key={photo.id}>
                <img
                  src={photo.url}
                  alt={t("Selected return photo", "عکس انتخاب‌شده مرجوعی")}
                />
                <span>{photo.name}</span>
                <Button
                  variant="plain"
                  disabled={busy}
                  aria-label={t(
                    `Remove ${photo.name}`,
                    `برداشتن ${photo.name}`,
                  )}
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    urls.current.delete(photo.url);
                    setPhotos((current) =>
                      current.filter((item) => item.id !== photo.id),
                    );
                  }}
                >
                  <X size={18} />
                </Button>
              </div>
            ))}
          </div>
        )}
        {fieldError("photos") && (
          <p className="form-error">{fieldError("photos")}</p>
        )}
      </section>
    </Dialog>
  );
}
