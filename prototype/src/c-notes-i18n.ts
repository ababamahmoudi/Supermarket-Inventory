import { configuredRoleLabel } from "./role-config";
import type { CompanyConfig } from "./types";

export const en = {
  location: "Location",
  chooseLocation: "Choose a location for this note.",
  readOnly:
    "You can read this notebook. Adding notes is not enabled for your role.",
  noLocation:
    "No active location is available for this notebook. Ask someone who manages notebooks to check its location settings.",
  unavailableLocation:
    "This location is not active. Choose an active location before adding a note.",
  scope:
    "This notebook is not available for this company or location. Choose a location allowed by the notebook.",
  productRequired: "Product (required)",
  storeUse:
    "Saving store use records the actual quantity used. It does not change Payables.",
};

export const fa: Record<keyof typeof en, string> = {
  location: "مکان",
  chooseLocation: "مکان این یادداشت را انتخاب کنید.",
  readOnly:
    "می‌توانید این دفترچه را بخوانید. افزودن یادداشت برای نقش شما فعال نیست.",
  noLocation:
    "مکان فعالی برای این دفترچه در دسترس نیست. از مسئول دفترچه‌ها بخواهید تنظیمات مکان آن را بررسی کند.",
  unavailableLocation:
    "این مکان فعال نیست. پیش از افزودن یادداشت، یک مکان فعال انتخاب کنید.",
  scope:
    "این دفترچه برای این شرکت یا مکان در دسترس نیست. مکانی مجاز در تنظیمات دفترچه انتخاب کنید.",
  productRequired: "کالا (ضروری)",
  storeUse:
    "ذخیره مصرف فروشگاه، تعداد واقعی مصرف‌شده را ثبت می‌کند. پرداختنی‌ها تغییر نمی‌کنند.",
};

export function notesText(
  t: (english: string, persian: string) => string,
  key: keyof typeof en,
  config?: Pick<CompanyConfig, "roles">,
) {
  if (key === "noLocation" && config)
    return t(
      `No active location is available for this notebook. Ask an ${configuredRoleLabel(config.roles, "owner", "en")} or ${configuredRoleLabel(config.roles, "manager", "en")} to check its location settings.`,
      `مکان فعالی برای این دفترچه در دسترس نیست. از ${configuredRoleLabel(config.roles, "owner", "fa")} یا ${configuredRoleLabel(config.roles, "manager", "fa")} بخواهید تنظیمات مکان آن را بررسی کند.`,
    );
  return t(en[key], fa[key]);
}
