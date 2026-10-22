import { useSettingsConfiguration } from "../settings-configuration";
import { SettingsConfigurationGate } from "../SettingsConfigurationGate";
import People from "./People";
import NotificationSettings from "./NotificationSettings";
import RegisteredComputers from "./RegisteredComputers";
import InvoiceReadingsImport from "./InvoiceReadingsImport";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import companyLogo from "../../../assets/arzon-logo.png?inline";
import { MoreHorizontal, Plus } from "lucide-react";
import { useDemo } from "../store";
import { storeUploadedFile } from "../file-database";
import { StoredFileImage } from "../stored-file";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogActions,
  Field,
  NumberField,
  PageHeader,
  Menu,
  MenuItem,
  Select,
  Switch,
} from "../ui";
import {
  branchId,
  branchSellsToCustomers,
  branchLabel,
  newBranch,
  saveBranchSettings,
  saveCompanySettings,
  saveModuleSettings,
  saveOrderSettings,
  saveOfferSettings,
  setBranchActive,
  SettingsError,
  type ConfigBranch,
} from "../settings";
import type { CompanyConfig } from "../types";
import PricingSettings from "./PricingSettings";
import WeighedItemsSettings from "./WeighedItemsSettings";
import { LabelsSettings } from "./Labels";
import { ReturnsSettings } from "./ReturnsSettings";
import { WhatsMissing } from "../WhatsMissing";
import { DateText } from "../presentation";
import { SalesSettings } from "./SalesSettings";
import "./settings-b.css";
import "./settings-c7.css";

type Group =
  | "company"
  | "branches"
  | "people"
  | "catalog"
  | "pricing"
  | "offers"
  | "taxes"
  | "receiving"
  | "returns"
  | "notifications"
  | "modules"
  | "data";
type Translate = (en: string, fa: string) => string;
const groups: {
  key: Group;
  label: [string, string];
  description: [string, string];
  planned?: [string, string][];
}[] = [
  {
    key: "company",
    label: ["Company", "شرکت"],
    description: [
      "Company name, branding and display preferences.",
      "نام شرکت، هویت بصری و تنظیمات نمایش.",
    ],
  },
  {
    key: "branches",
    label: ["Branches", "شعب"],
    description: [
      "Add locations and keep their details up to date.",
      "مکان‌ها را اضافه کنید و اطلاعات آن‌ها را به‌روز نگه دارید.",
    ],
  },
  {
    key: "people",
    label: ["People", "کارکنان"],
    description: [
      "Employees, roles and registered store computers.",
      "کارکنان، نقش‌ها و رایانه‌های ثبت‌شده فروشگاه.",
    ],
    planned: [
      ["Employees and roles", "کارکنان و نقش‌ها"],
      ["Permissions", "مجوزها"],
      ["Password rules and lockout", "قواعد رمز عبور و قفل حساب"],
      ["Idle lock", "قفل خودکار"],
      ["Registered store computers", "رایانه‌های ثبت‌شده فروشگاه"],
    ],
  },
  {
    key: "catalog",
    label: ["Catalog", "کاتالوگ"],
    description: [
      "Pricing categories, rounding rules and the live price tester.",
      "دسته‌های قیمت‌گذاری، قواعد گرد کردن و آزمایش زنده قیمت.",
    ],
  },
  {
    key: "pricing",
    label: ["Pricing and approvals", "قیمت‌گذاری و تأییدها"],
    description: [
      "Approval rules and branch price conflicts.",
      "قواعد تأیید و تعارض قیمت شعب.",
    ],
    planned: [
      ["Changes that need approval", "تغییرات نیازمند تأیید"],
      ["Default approval scope", "دامنه پیش‌فرض تأیید"],
      ["Cross-branch conflict alerts", "هشدار تعارض قیمت میان شعب"],
    ],
  },
  {
    key: "offers",
    label: ["Offers", "پیشنهادها"],
    description: [
      "Price-to-offer mappings and mix-and-match pools.",
      "نگاشت قیمت به پیشنهاد و گروه‌های ترکیبی.",
    ],
  },
  {
    key: "taxes",
    label: ["Taxes", "مالیات"],
    description: [
      "Tax profiles, rates and additional fees.",
      "پروفایل‌های مالیات، نرخ‌ها و هزینه‌های اضافی.",
    ],
    planned: [
      ["Tax profiles and rates", "پروفایل‌ها و نرخ‌های مالیات"],
      [
        "Container deposits and additional fees",
        "ودیعه ظروف و هزینه‌های اضافی",
      ],
    ],
  },
  {
    key: "receiving",
    label: ["Receiving", "دریافت کالا"],
    description: [
      "Invoice fields, numbering and reading preferences.",
      "فیلدهای فاکتور، شماره‌گذاری و تنظیمات خواندن.",
    ],
    planned: [
      ["Required invoice fields", "فیلدهای الزامی فاکتور"],
      ["Automatic invoice numbering", "شماره‌گذاری خودکار فاکتور"],
      ["Tax-mismatch tolerance", "تلورانس اختلاف مالیات"],
      ["AI reading and confidence", "خواندن هوش مصنوعی و اطمینان"],
      [
        "Same-supplier lower-price questions",
        "پرسش‌های کاهش قیمت همان تأمین‌کننده",
      ],
    ],
  },
  {
    key: "returns",
    label: ["Returns/date tracking/labels", "مرجوعی/پیگیری تاریخ/برچسب"],
    description: [
      "Pending return credits, reminders, label waitlist preferences and A4 templates.",
      "اعتبار مرجوعی در انتظار، یادآوری‌ها، فهرست انتظار برچسب و قالب‌های A4.",
    ],
  },
  {
    key: "notifications",
    label: ["Notifications", "اعلان‌ها"],
    description: [
      "Which events notify each role.",
      "اعلان رویدادها برای هر نقش.",
    ],
    planned: [
      ["In-app notification rules", "قواعد اعلان داخل برنامه"],
      ["Email notifications", "اعلان ایمیلی"],
    ],
  },
  {
    key: "modules",
    label: ["Modules", "بخش‌ها"],
    description: [
      "Choose the sections available to your company.",
      "بخش‌های در دسترس شرکت را انتخاب کنید.",
    ],
  },
  {
    key: "data",
    label: ["Data", "داده‌ها"],
    description: [
      "Import invoice readings or start with an empty store.",
      "خوانش فاکتورها را وارد کنید یا با فروشگاهی خالی شروع کنید.",
    ],
  },
];
function requestedGroup(): Group | undefined {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const requested = query.get("group");
  return groups.find((group) => group.key === requested)?.key;
}
function settingsError(error: unknown, t: Translate): string {
  const messages: Record<string, [string, string]> = {
    permission: [
      "Only an Owner or Manager can change Settings.",
      "فقط مالک یا مدیر می‌تواند تنظیمات را تغییر دهد.",
    ],
    company: [
      "This change belongs to another company.",
      "این تغییر متعلق به شرکت دیگری است.",
    ],
    name: [
      "Enter both the English and Persian names.",
      "نام انگلیسی و فارسی را وارد کنید.",
    ],
    duplicate: [
      "A branch already has this name. Use a different name.",
      "شعبه‌ای با این نام وجود دارد. نام دیگری وارد کنید.",
    ],
    branch: [
      "Choose a branch from this company.",
      "شعبه‌ای از این شرکت انتخاب کنید.",
    ],
    last_branch: [
      "Keep at least one active branch.",
      "حداقل یک شعبه فعال نگه دارید.",
    ],
    currency: [
      "Enter a three-letter currency code, such as CAD.",
      "کد سه‌حرفی ارز، مانند CAD، وارد کنید.",
    ],
    timezone: [
      "Enter a valid time zone, such as America/Toronto.",
      "منطقه زمانی معتبر، مانند America/Toronto، وارد کنید.",
    ],
    color: [
      "Enter a six-digit brand color, such as #2B59C3.",
      "رنگ شش‌رقمی برند، مانند ‎#2B59C3، وارد کنید.",
    ],
    mapping: [
      "Use unique two-decimal prices, and give each mapping an offer and a pool.",
      "از قیمت‌های یکتا با دو رقم اعشار استفاده کنید و برای هر نگاشت پیشنهاد و گروه وارد کنید.",
    ],
  };
  return t(
    ...(messages[error instanceof SettingsError ? error.code : "name"] ??
      messages.name),
  );
}
function SaveBar({
  dirty,
  save,
  cancel,
}: {
  dirty: boolean;
  save: () => void;
  cancel: () => void;
}) {
  const { t } = useDemo();
  return dirty ? (
    <div className="settings-save-bar">
      <span>{t("Unsaved changes", "تغییرات ذخیره‌نشده")}</span>
      <Button variant="neutral" onClick={cancel}>
        {t("Cancel", "لغو")}
      </Button>
      <Button onClick={save}>{t("Save changes", "ذخیره تغییرات")}</Button>
    </div>
  ) : null;
}
function CompanySettings() {
  const { command, query, t } = useDemo();
  const configuration = useSettingsConfiguration();
  const logoPicker = useRef<HTMLInputElement>(null);
  const persisted = JSON.stringify(configuration.company);
  const [draft, commitDraft] = useState<CompanyConfig["company"]>(() =>
    structuredClone(configuration.company),
  );
  const [error, setError] = useState<string>();
  const [errorField, setErrorField] = useState<string>();
  function setDraft(next: SetStateAction<CompanyConfig["company"]>) {
    const value = typeof next === "function" ? next(draft) : next;
    const changed =
      errorField === "name"
        ? value.name_en !== draft.name_en || value.name_fa !== draft.name_fa
        : errorField === "color"
          ? JSON.stringify(value.branding) !== JSON.stringify(draft.branding)
          : errorField === "logo"
            ? value.logo_data !== draft.logo_data
            : errorField === "currency"
              ? value.currency !== draft.currency
              : errorField === "timezone"
                ? value.timezone !== draft.timezone
                : false;
    if (changed) {
      setError(undefined);
      setErrorField(undefined);
    }
    commitDraft(value);
  }
  const fieldError = (field: string) =>
    errorField === field ? error : undefined;
  async function save() {
    try {
      await command(
        "settings.manage",
        {
          company_id: configuration.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (next, freshActor) => saveCompanySettings(next, draft, freshActor),
      );
      setError(undefined);
    } catch (failure) {
      setError(settingsError(failure, t));
      setErrorField(
        failure instanceof SettingsError ? failure.code : undefined,
      );
    }
  }
  async function logo(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setErrorField("logo");
      setError(
        t(
          "Use a PNG, JPEG or WebP logo.",
          "از نشان PNG، JPEG یا WebP استفاده کنید.",
        ),
      );
      return;
    }
    try {
      const scope = {
        company_id: configuration.company.seed_key,
        kind: "company_shared" as const,
      };
      await query("settings.manage", scope, () => undefined);
      const stored = await storeUploadedFile(
        file,
        configuration.company.seed_key,
        { purpose: "logo" },
      );
      await query("settings.manage", scope, () => undefined);
      setDraft((current) => ({ ...current, logo_data: stored.reference }));
      setError(undefined);
      setErrorField(undefined);
    } catch {
      setErrorField("logo");
      setError(
        t(
          "The logo could not be saved. Allow browser storage and try again.",
          "نشان ذخیره نشد. حافظهٔ مرورگر را فعال کنید و دوباره تلاش کنید.",
        ),
      );
    }
  }
  return (
    <>
      <WhatsMissing
        issues={
          error
            ? [
                {
                  id: errorField ?? "company",
                  message: error,
                  fieldId:
                    errorField === "name"
                      ? !draft.name_en.trim()
                        ? "company-name-en"
                        : "company-name-fa"
                      : errorField === "currency"
                        ? "company-currency"
                        : errorField === "timezone"
                          ? "company-timezone"
                          : errorField === "color"
                            ? !/^#[0-9a-f]{6}$/i.test(
                                draft.branding.primary_color,
                              )
                              ? "company-brand"
                              : "company-dark-brand"
                            : "company-logo",
                },
              ]
            : []
        }
      />
      <Card
        title={t("Company details", "اطلاعات شرکت")}
        className="settings-form-card"
      >
        <div className="form-grid settings-company-fields">
          <Field
            label={t("Name (English)", "نام (انگلیسی)")}
            error={!draft.name_en.trim() ? fieldError("name") : undefined}
          >
            <input
              id="company-name-en"
              value={draft.name_en}
              onChange={(event) =>
                setDraft({ ...draft, name_en: event.target.value })
              }
            />
          </Field>
          <Field
            label={t("Name (Persian)", "نام (فارسی)")}
            error={!draft.name_fa.trim() ? fieldError("name") : undefined}
          >
            <input
              id="company-name-fa"
              dir="rtl"
              value={draft.name_fa}
              onChange={(event) =>
                setDraft({ ...draft, name_fa: event.target.value })
              }
            />
          </Field>
          <Field label={t("Currency", "ارز")} error={fieldError("currency")}>
            <input
              id="company-currency"
              dir="ltr"
              maxLength={3}
              value={draft.currency}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  currency: event.target.value.toUpperCase(),
                })
              }
            />
          </Field>
          <Field
            label={t("Time zone", "منطقه زمانی")}
            error={fieldError("timezone")}
          >
            <input
              id="company-timezone"
              dir="ltr"
              value={draft.timezone}
              onChange={(event) =>
                setDraft({ ...draft, timezone: event.target.value })
              }
            />
          </Field>
          <Field
            label={t("Brand color", "رنگ برند")}
            error={fieldError("color")}
          >
            <div className="company-color-field">
              <span
                className="company-color-swatch"
                aria-hidden="true"
                style={{
                  backgroundColor: /^#[0-9a-f]{6}$/i.test(
                    draft.branding.primary_color,
                  )
                    ? draft.branding.primary_color
                    : undefined,
                }}
              />
              <input
                id="company-brand"
                dir="ltr"
                value={draft.branding.primary_color}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    branding: {
                      ...draft.branding,
                      primary_color: event.target.value,
                    },
                  })
                }
              />
            </div>
          </Field>
          <Field
            label={t("Dark-theme brand color", "رنگ برند در حالت تیره")}
            error={fieldError("color")}
          >
            <div className="company-color-field">
              <span
                className="company-color-swatch"
                aria-hidden="true"
                style={{
                  backgroundColor: /^#[0-9a-f]{6}$/i.test(
                    draft.branding.dark_primary_color,
                  )
                    ? draft.branding.dark_primary_color
                    : undefined,
                }}
              />
              <input
                id="company-dark-brand"
                dir="ltr"
                value={draft.branding.dark_primary_color}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    branding: {
                      ...draft.branding,
                      dark_primary_color: event.target.value,
                    },
                  })
                }
              />
            </div>
          </Field>
          <Field label={t("Date format", "قالب تاریخ")}>
            <Select
              value="yyyy-mm-dd"
              onChange={() => setDraft({ ...draft, date_format: "yyyy-mm-dd" })}
              options={[{ value: "yyyy-mm-dd", label: "YYYY-MM-DD" }]}
            />
          </Field>
          <Field label={t("Default text size", "اندازه پیش‌فرض متن")}>
            <Select
              value={draft.text_size ?? "normal"}
              onChange={(value) =>
                setDraft({ ...draft, text_size: value as "normal" | "large" })
              }
              options={[
                { value: "normal", label: t("Normal", "معمولی") },
                { value: "large", label: t("Comfortable", "خوانا") },
              ]}
            />
          </Field>
        </div>
        <div className="settings-switch-list">
          <Switch
            checked={draft.ui_languages.includes("en")}
            onChange={(enabled) => {
              const languages = enabled
                ? [...new Set([...draft.ui_languages, "en"])]
                : draft.ui_languages.filter((language) => language !== "en");
              if (languages.length)
                setDraft({ ...draft, ui_languages: languages });
            }}
          >
            {t("English", "انگلیسی")}
          </Switch>
          <Switch
            checked={draft.ui_languages.includes("fa")}
            onChange={(enabled) => {
              const languages = enabled
                ? [...new Set([...draft.ui_languages, "fa"])]
                : draft.ui_languages.filter((language) => language !== "fa");
              if (languages.length)
                setDraft({ ...draft, ui_languages: languages });
            }}
          >
            {t("Persian", "فارسی")}
          </Switch>
        </div>
      </Card>
      <Card
        id="company-logo"
        tabIndex={-1}
        title={t("Logo", "نشان")}
        className="settings-form-card"
      >
        {fieldError("logo") && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="company-logo-control">
          <StoredFileImage
            className="settings-logo-preview"
            value={draft.logo_data || companyLogo}
            companyId={configuration.company.seed_key}
            alt={t("Company logo", "نشان شرکت")}
          />
          <Button variant="neutral" onClick={() => logoPicker.current?.click()}>
            {t("Replace", "جایگزینی")}
          </Button>
          <input
            ref={logoPicker}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            aria-label={t("Replace logo", "جایگزینی نشان")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void logo(file);
              event.target.value = "";
            }}
          />
        </div>
      </Card>
      {error &&
        !["name", "currency", "timezone", "color", "logo"].includes(
          errorField ?? "",
        ) && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      <SaveBar
        dirty={JSON.stringify(draft) !== persisted}
        save={save}
        cancel={() => {
          setDraft(structuredClone(configuration.company));
          setError(undefined);
        }}
      />
    </>
  );
}
function BranchSettings() {
  const { command, t, lang } = useDemo();
  const configuration = useSettingsConfiguration();
  const [editing, commitEditing] = useState<ConfigBranch | null>(null);
  const [error, setError] = useState<string>();
  const [errorField, setErrorField] = useState<string>();
  const [sellingEdited, setSellingEdited] = useState(false);
  function setEditing(value: ConfigBranch | null) {
    if (
      editing &&
      value &&
      ((["name", "duplicate"].includes(errorField ?? "") &&
        (editing.name_en !== value.name_en ||
          editing.name_fa !== value.name_fa)) ||
        (errorField === "branch" &&
          (editing.type !== value.type ||
            editing.sells_to_customers !== value.sells_to_customers)))
    ) {
      setError(undefined);
      setErrorField(undefined);
    }
    commitEditing(value);
  }
  async function save() {
    if (!editing) return;
    try {
      await command(
        "settings.manage",
        {
          company_id: configuration.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (next, freshActor) => saveBranchSettings(next, editing, freshActor),
      );
      setEditing(null);
      setError(undefined);
    } catch (failure) {
      setError(settingsError(failure, t));
      setErrorField(
        failure instanceof SettingsError ? failure.code : undefined,
      );
    }
  }
  async function active(code: string, value: boolean) {
    try {
      await command(
        "settings.manage",
        {
          company_id: configuration.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (next, freshActor) => setBranchActive(next, code, value, freshActor),
      );
      setError(undefined);
    } catch (failure) {
      setError(settingsError(failure, t));
      setErrorField(
        failure instanceof SettingsError ? failure.code : undefined,
      );
    }
  }
  return (
    <>
      <Card title={t("Branches", "شعب")}>
        <div className="settings-section-actions">
          <Button
            onClick={() => {
              setSellingEdited(false);
              setEditing(newBranch(configuration));
              setError(undefined);
            }}
          >
            <Plus size={18} />
            {t("Add location", "افزودن مکان")}
          </Button>
        </div>
        <DataTable
          columns={[
            { width: "20%" },
            { width: "13%" },
            { width: "12%" },
            { width: "17%" },
            { width: "15%" },
            { width: "12%" },
            { width: 176, actions: true },
          ]}
        >
          <thead>
            <tr>
              <th>{t("Name", "نام")}</th>
              <th>{t("Location type", "نوع مکان")}</th>
              <th>{t("Sells to customers", "فروش به مشتری")}</th>
              <th>{t("Address", "نشانی")}</th>
              <th>{t("Phone", "تلفن")}</th>
              <th>{t("Status", "وضعیت")}</th>
              <th>{t("Actions", "عملیات")}</th>
            </tr>
          </thead>
          <tbody>
            {configuration.branches.map((branch, index) => (
              <tr key={branch.code}>
                <th scope="row">
                  {branchLabel(configuration, branchId(branch, index), lang)}
                </th>
                <td>
                  {branch.type === "warehouse"
                    ? t("Warehouse", "انبار")
                    : t("Store", "فروشگاه")}
                </td>
                <td>
                  {branchSellsToCustomers(
                    configuration,
                    branchId(branch, index),
                  )
                    ? t("Yes", "بله")
                    : t("No", "خیر")}
                </td>
                <td>{branch.address || "—"}</td>
                <td>
                  <bdi dir="ltr">{branch.phone || "—"}</bdi>
                </td>
                <td>
                  <Badge
                    tone={branch.active === false ? "neutral" : "approved"}
                  >
                    {branch.active === false
                      ? t("Inactive", "غیرفعال")
                      : t("Active", "فعال")}
                  </Badge>
                </td>
                <td>
                  <div className="actions">
                    <Button
                      size="sm"
                      variant="neutral"
                      onClick={() => {
                        setSellingEdited(
                          branch.sells_to_customers !== undefined,
                        );
                        setEditing({
                          ...structuredClone(branch),
                          id: branchId(branch, index),
                          name_en: branch.name_en.replace(
                            /\s*\(PLACEHOLDER.*$/i,
                            "",
                          ),
                        });
                        setError(undefined);
                      }}
                    >
                      {t("Edit", "ویرایش")}
                    </Button>
                    <Menu
                      label={t("More actions", "کارهای بیشتر")}
                      icon={<MoreHorizontal size={18} aria-hidden="true" />}
                      iconOnly
                    >
                      <MenuItem
                        className={
                          branch.active === false
                            ? undefined
                            : "menu-item-danger"
                        }
                        onClick={() =>
                          active(branch.code, branch.active === false)
                        }
                      >
                        {branch.active === false
                          ? t("Reactivate", "فعال‌سازی دوباره")
                          : t("Deactivate", "غیرفعال کردن")}
                      </MenuItem>
                    </Menu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
      {error && !editing && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setError(undefined);
          }
        }}
        title={
          configuration.branches.some((branch) => branch.code === editing?.code)
            ? t("Edit branch", "ویرایش شعبه")
            : t("Add location", "افزودن مکان")
        }
        className="settings-dialog"
        description={
          editing ? (
            <bdi dir="auto">{editing.name_en || editing.code}</bdi>
          ) : undefined
        }
      >
        {editing && (
          <>
            <WhatsMissing
              issues={
                error
                  ? [
                      {
                        id: errorField ?? "branch",
                        message: error,
                        fieldId: ["name", "duplicate"].includes(
                          errorField ?? "",
                        )
                          ? !editing.name_en.trim() ||
                            errorField === "duplicate"
                            ? "branch-name-en"
                            : "branch-name-fa"
                          : "branch-type",
                      },
                    ]
                  : []
              }
            />
            <div className="form-grid settings-dialog-fields">
              <Field
                label={t("Name (English)", "نام (انگلیسی)")}
                error={
                  errorField === "duplicate" ||
                  (errorField === "name" && !editing.name_en.trim())
                    ? error
                    : undefined
                }
              >
                <input
                  id="branch-name-en"
                  value={editing.name_en}
                  onChange={(event) =>
                    setEditing({ ...editing, name_en: event.target.value })
                  }
                />
              </Field>
              <Field
                label={t("Name (Persian)", "نام (فارسی)")}
                error={
                  errorField === "name" && !editing.name_fa.trim()
                    ? error
                    : undefined
                }
              >
                <input
                  id="branch-name-fa"
                  dir="rtl"
                  value={editing.name_fa}
                  onChange={(event) =>
                    setEditing({ ...editing, name_fa: event.target.value })
                  }
                />
              </Field>
              <Field label={t("Address", "نشانی")}>
                <input
                  value={editing.address ?? ""}
                  onChange={(event) =>
                    setEditing({ ...editing, address: event.target.value })
                  }
                />
              </Field>
              <Field label={t("Location type", "نوع مکان")}>
                <Select
                  id="branch-type"
                  value={editing.type ?? "store"}
                  onChange={(value) =>
                    setEditing({
                      ...editing,
                      type: value as "store" | "warehouse",
                      sells_to_customers: sellingEdited
                        ? editing.sells_to_customers
                        : value !== "warehouse",
                    })
                  }
                  options={[
                    { value: "store", label: t("Store", "فروشگاه") },
                    { value: "warehouse", label: t("Warehouse", "انبار") },
                  ]}
                />
              </Field>
              <Switch
                checked={
                  editing.sells_to_customers ?? editing.type !== "warehouse"
                }
                onChange={(checked) => {
                  setSellingEdited(true);
                  setEditing({ ...editing, sells_to_customers: checked });
                }}
              >
                {t("Sells to customers", "فروش به مشتری")}
              </Switch>
              <Field label={t("Phone", "تلفن")}>
                <input
                  dir="ltr"
                  value={editing.phone ?? ""}
                  onChange={(event) =>
                    setEditing({ ...editing, phone: event.target.value })
                  }
                />
              </Field>
              <Field label={t("Opening hours", "ساعت کاری")}>
                <input
                  value={editing.opening_hours ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      opening_hours: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label={t("Tax region", "منطقه مالیاتی")}>
                <input
                  value={editing.tax_region ?? ""}
                  onChange={(event) =>
                    setEditing({ ...editing, tax_region: event.target.value })
                  }
                />
              </Field>
            </div>
            {error && !["name", "duplicate"].includes(errorField ?? "") && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <DialogActions className="settings-save-bar">
              <span>{t("Unsaved changes", "تغییرات ذخیره‌نشده")}</span>
              <Button variant="neutral" onClick={() => setEditing(null)}>
                {t("Cancel", "لغو")}
              </Button>
              <Button onClick={save}>
                {t("Save changes", "ذخیره تغییرات")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
function OfferSettings() {
  const { command, t } = useDemo();
  const configuration = useSettingsConfiguration();
  const persisted = JSON.stringify(configuration.promotions);
  const [draft, commitDraft] = useState(() =>
    structuredClone(configuration.promotions),
  );
  const [error, setError] = useState<string>();
  function setDraft(next: SetStateAction<CompanyConfig["promotions"]>) {
    const value = typeof next === "function" ? next(draft) : next;
    if (
      JSON.stringify(value.price_to_offer) !==
      JSON.stringify(draft.price_to_offer)
    )
      setError(undefined);
    commitDraft(value);
  }
  async function save() {
    try {
      await command(
        "settings.manage",
        {
          company_id: configuration.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (next, freshActor) => saveOfferSettings(next, draft, freshActor),
      );
      setError(undefined);
    } catch (failure) {
      setError(settingsError(failure, t));
    }
  }
  return (
    <>
      <SalesSettings />
      <WhatsMissing
        issues={
          error
            ? draft.price_to_offer.flatMap((mapping, index) => {
                const normalize = (price: string) => {
                  const [whole, fraction = ""] = price
                    .replace(/^0+(?=\d)/, " ")
                    .trim()
                    .split(".");
                  return `${whole}.${fraction.padEnd(2, "0")}`;
                };
                const duplicate =
                  draft.price_to_offer.filter(
                    (other) =>
                      normalize(other.price) === normalize(mapping.price),
                  ).length > 1;
                return [
                  ...(!/^\d+(?:\.\d{1,2})?$/.test(mapping.price) || duplicate
                    ? [
                        {
                          id: `price-${index}`,
                          message: `${t("Selling price", "قیمت فروش")}: ${error}`,
                          fieldId: `offer-price-${index}`,
                        },
                      ]
                    : []),
                  ...(!mapping.offer.trim()
                    ? [
                        {
                          id: `offer-${index}`,
                          message: `${t("Offer", "پیشنهاد")}: ${error}`,
                          fieldId: `offer-text-${index}`,
                        },
                      ]
                    : []),
                  ...(!mapping.mix_and_match_pool.trim()
                    ? [
                        {
                          id: `pool-${index}`,
                          message: `${t("Mix-and-match pool", "گروه ترکیبی")}: ${error}`,
                          fieldId: `offer-pool-${index}`,
                        },
                      ]
                    : []),
                ];
              })
            : []
        }
      />
      <Card
        title={t("Price-to-offer mappings", "نگاشت قیمت به پیشنهاد")}
        className="settings-form-card"
      >
        <div className="settings-offer-mappings">
          {draft.price_to_offer.map((mapping, index) => (
            <div className="settings-offer-mapping" key={index}>
              <Field
                label={t("Selling price", "قیمت فروش")}
                error={
                  error && !/^\d+(?:\.\d{1,2})?$/.test(mapping.price)
                    ? error
                    : undefined
                }
              >
                <NumberField
                  id={`offer-price-${index}`}
                  dir="ltr"
                  value={mapping.price}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      price_to_offer: draft.price_to_offer.map(
                        (entry, position) =>
                          position === index
                            ? { ...entry, price: value }
                            : entry,
                      ),
                    })
                  }
                />
              </Field>
              <Field
                label={t("Offer", "پیشنهاد")}
                error={error && !mapping.offer.trim() ? error : undefined}
              >
                <input
                  id={`offer-text-${index}`}
                  dir="ltr"
                  value={mapping.offer}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      price_to_offer: draft.price_to_offer.map(
                        (entry, position) =>
                          position === index
                            ? { ...entry, offer: event.target.value }
                            : entry,
                      ),
                    })
                  }
                />
              </Field>
              <Field
                label={t("Mix-and-match pool", "گروه ترکیبی")}
                error={
                  error && !mapping.mix_and_match_pool.trim()
                    ? error
                    : undefined
                }
              >
                <input
                  id={`offer-pool-${index}`}
                  dir="ltr"
                  value={mapping.mix_and_match_pool}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      price_to_offer: draft.price_to_offer.map(
                        (entry, position) =>
                          position === index
                            ? {
                                ...entry,
                                mix_and_match_pool: event.target.value,
                              }
                            : entry,
                      ),
                    })
                  }
                />
              </Field>
              <Button
                variant="danger"
                onClick={() =>
                  setDraft({
                    ...draft,
                    price_to_offer: draft.price_to_offer.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
              >
                {t("Remove", "برداشتن")}
              </Button>
            </div>
          ))}
        </div>
        <div className="settings-section-actions">
          <Button
            variant="neutral"
            onClick={() =>
              setDraft({
                ...draft,
                price_to_offer: [
                  ...draft.price_to_offer,
                  {
                    price: "",
                    offer: "",
                    mix_and_match_pool: "",
                    assumption: false,
                  },
                ],
              })
            }
          >
            {t("Add mapping", "افزودن نگاشت")}
          </Button>
        </div>
      </Card>
      <Card
        title={t("Offer suggestions", "پیشنهادهای تخفیف")}
        className="settings-form-card"
      >
        <Switch
          checked={draft.ai_suggestions_enabled !== false}
          onChange={(enabled) =>
            setDraft({ ...draft, ai_suggestions_enabled: enabled })
          }
        >
          {t("AI offer suggestions", "پیشنهاد تخفیف هوش مصنوعی")}
        </Switch>
        <p className="muted">
          {t(
            "Suggested offers need confirmation before becoming active.",
            "پیشنهادها پیش از فعال شدن به تأیید نیاز دارند.",
          )}
        </p>
      </Card>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <SaveBar
        dirty={JSON.stringify(draft) !== persisted}
        save={save}
        cancel={() => {
          setDraft(structuredClone(configuration.promotions));
          setError(undefined);
        }}
      />
    </>
  );
}
const moduleLabels: [keyof CompanyConfig["modules"], string, string][] = [
  ["invoices", "Invoices", "فاکتورها"],
  ["suppliers", "Suppliers", "تأمین‌کنندگان"],
  ["returns", "Returns", "مرجوعی‌ها"],
  ["labels", "Labels", "برچسب‌ها"],
  ["date_tracking", "Date tracking", "پیگیری تاریخ"],
  ["notes", "Notes", "یادداشت‌ها"],
  ["payables", "Payables", "حساب‌های پرداختنی"],
];
function ModuleSettings() {
  const { command, t } = useDemo();
  const configuration = useSettingsConfiguration();
  const persisted = JSON.stringify(configuration.modules);
  const [draft, setDraft] = useState(() =>
    structuredClone(configuration.modules),
  );
  const [allowOrders, setAllowOrders] = useState(
    configuration.orders?.allow_floor_worker ?? false,
  );
  return (
    <>
      <Card title={t("Modules", "بخش‌ها")} className="settings-form-card">
        <div className="settings-switch-list">
          {moduleLabels.map(([key, en, fa]) => (
            <Switch
              key={key}
              checked={draft[key]}
              onChange={(value) => setDraft({ ...draft, [key]: value })}
            >
              {t(en, fa)}
            </Switch>
          ))}
          <Switch checked={allowOrders} onChange={setAllowOrders}>
            {t(
              "Allow Floor Workers to use Orders",
              "اجازه استفاده از سفارش‌ها به کارکنان فروشگاه",
            )}
          </Switch>
        </div>
      </Card>
      <Card
        title={t("Planned sections", "بخش‌های برنامه‌ریزی‌شده")}
        className="settings-form-card"
      >
        <p className="muted">
          {t(
            "Register and Online orders are not available yet.",
            "صندوق فروش و سفارش‌های آنلاین هنوز در دسترس نیستند.",
          )}
        </p>
      </Card>
      <SaveBar
        dirty={
          JSON.stringify(draft) !== persisted ||
          allowOrders !== (configuration.orders?.allow_floor_worker ?? false)
        }
        save={async () => {
          await command(
            "settings.manage",
            {
              company_id: configuration.company.seed_key,
              kind: "company_shared",
              mutation: true,
            },
            (next, freshActor) => {
              saveModuleSettings(next, draft, freshActor);
              saveOrderSettings(
                next,
                { allow_floor_worker: allowOrders },
                freshActor,
              );
            },
          );
        }}
        cancel={() => {
          setDraft(structuredClone(configuration.modules));
          setAllowOrders(configuration.orders?.allow_floor_worker ?? false);
        }}
      />
    </>
  );
}
function PlannedSettings({ group }: { group: (typeof groups)[number] }) {
  const { t } = useDemo();
  return (
    <Card title={t(...group.label)} className="settings-form-card">
      <p className="muted">
        {t(
          "These settings are planned. Changes are not available yet.",
          "این تنظیمات برنامه‌ریزی شده‌اند. تغییر آن‌ها هنوز در دسترس نیست.",
        )}
      </p>
      <ul className="settings-planned-list">
        {group.planned?.map(([en, fa]) => (
          <li key={en}>{t(en, fa)}</li>
        ))}
      </ul>
      {group.key === "pricing" && (
        <p>
          {t(
            "Minimum margins can be edited in Catalog → Pricing categories.",
            "حداقل حاشیه سود در کاتالوگ ← دسته‌های قیمت‌گذاری قابل ویرایش است.",
          )}
        </p>
      )}
    </Card>
  );
}
function SettingsContent() {
  const { state, t, can } = useDemo();
  const configuration = useSettingsConfiguration();
  const [selected, setSelected] = useState<Group>(() => {
    const requested = requestedGroup();
    if (requested) return requested;
    const saved = sessionStorage.getItem(
      "arzon-settings-group",
    ) as Group | null;
    return groups.some((group) => group.key === saved) ? saved! : "company";
  });
  useEffect(() => {
    const changed = () => {
      const requested = requestedGroup();
      if (requested) {
        setSelected(requested);
        sessionStorage.setItem("arzon-settings-group", requested);
      }
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const group = groups.find((entry) => entry.key === selected)!;
  if (!can("settings.manage")) return null;
  const changed = state.activity.find(
    (activity) =>
      activity.entity_type === "settings" &&
      activity.entity_id === (selected === "returns" ? "labels" : selected),
  );
  return (
    <>
      <PageHeader title={t("Settings", "تنظیمات")} />
      <div className="settings-layout">
        <nav
          className="settings-group-menu"
          aria-label={t("Settings groups", "گروه‌های تنظیمات")}
        >
          {groups.map((item) => (
            <button
              data-control-kind="settings-navigation"
              type="button"
              key={item.key}
              className={selected === item.key ? "active" : ""}
              aria-current={selected === item.key ? "page" : undefined}
              onClick={() => {
                setSelected(item.key);
                sessionStorage.setItem("arzon-settings-group", item.key);
                window.location.hash = `settings?group=${item.key}`;
              }}
            >
              {t(...item.label)}
            </button>
          ))}
        </nav>
        <section
          className="settings-group-content"
          aria-label={t(...group.label)}
        >
          <div className="settings-group-intro">
            <h2>{t(...group.label)}</h2>
            <p className="muted">{t(...group.description)}</p>
          </div>
          {selected === "company" ? (
            <CompanySettings key={JSON.stringify(configuration.company)} />
          ) : selected === "branches" ? (
            <BranchSettings />
          ) : selected === "people" ? (
            <>
              <People />
              <RegisteredComputers />
            </>
          ) : selected === "catalog" ? (
            <PricingSettings
              key={JSON.stringify([
                configuration.pricing_categories,
                configuration.rounding_bands,
                configuration.special_corrections,
              ])}
            />
          ) : selected === "pricing" ? (
            <>
              <WeighedItemsSettings />
              <PlannedSettings group={group} />
            </>
          ) : selected === "offers" ? (
            <OfferSettings key={JSON.stringify(configuration.promotions)} />
          ) : selected === "returns" ? (
            <>
              <ReturnsSettings />
              <LabelsSettings />
            </>
          ) : selected === "notifications" ? (
            <NotificationSettings
              key={JSON.stringify([
                configuration.notifications,
                configuration.price_updates,
              ])}
            />
          ) : selected === "modules" ? (
            <ModuleSettings
              key={JSON.stringify({
                modules: configuration.modules,
                orders: configuration.orders,
              })}
            />
          ) : selected === "data" ? (
            <InvoiceReadingsImport />
          ) : (
            <PlannedSettings group={group} />
          )}{" "}
          {changed && (
            <p className="settings-changed-line">
              {t("Changed by", "تغییر توسط")} {changed.by} {t("on", "در")}{" "}
              <DateText value={changed.at} /> ·{" "}
              <a href="#history">{t("History", "تاریخچه")}</a>
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export default function Settings() {
  return (
    <SettingsConfigurationGate>
      <SettingsContent />
    </SettingsConfigurationGate>
  );
}
