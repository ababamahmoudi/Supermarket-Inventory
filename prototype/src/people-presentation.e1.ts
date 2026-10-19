import type { LocationScope, RoleId } from "./authority-types";
import type { CompanyConfig, Language } from "./types";
import { branchLabel } from "./settings";

export function configuredRoleLabel(
  config: Pick<CompanyConfig, "roles">,
  role: RoleId,
  language: Language,
) {
  const definition = config.roles.find((entry) => entry.key === role);
  if (!definition) throw new Error("configured_role_missing");
  return language === "fa"
    ? definition.label_fa || definition.label
    : definition.label;
}
export function personLocationLabel(
  config: Pick<CompanyConfig, "branches">,
  scope: LocationScope,
  language: Language,
  t: (en: string, fa: string) => string,
) {
  return scope.kind === "company"
    ? t("All locations", "همه مکان‌ها")
    : scope.location_ids
        .map((id) => branchLabel(config, id, language))
        .join(" · ");
}
export function peopleErrorText(
  code: string,
  t: (en: string, fa: string) => string,
) {
  const messages: Record<string, [string, string]> = {
    name: ["Enter the English name.", "نام انگلیسی را وارد کنید."],
    username: ["Enter a username.", "نام کاربری را وارد کنید."],
    contact: [
      "Enter a phone number or email.",
      "شماره تلفن یا ایمیل را وارد کنید.",
    ],
    role: ["Choose a role.", "نقش را انتخاب کنید."],
    locations: [
      "Choose one or more allowed locations.",
      "یک یا چند مکان مجاز را انتخاب کنید.",
    ],
    cashier_warehouse: [
      "Choose a selling location for this role.",
      "برای این نقش مکانی با فروش به مشتری انتخاب کنید.",
    ],
    duplicate_username: [
      "This username is already in use.",
      "این نام کاربری قبلاً استفاده شده است.",
    ],
    reason: ["Enter a reason.", "دلیل را وارد کنید."],
    self_role: [
      "You cannot change your own role.",
      "نمی‌توانید نقش خود را تغییر دهید.",
    ],
    self_deactivate: [
      "You cannot deactivate yourself.",
      "نمی‌توانید خودتان را غیرفعال کنید.",
    ],
    last_owner: [
      "Keep at least one active account in this role with completed sign-in setup.",
      "حداقل یک حساب فعال در این نقش با راه‌اندازی کامل ورود باقی بگذارید.",
    ],
    conflict: [
      "This person changed. Close and open the form again.",
      "این شخص تغییر کرده است. فرم را ببندید و دوباره باز کنید.",
    ],
    person: [
      "This person is no longer available.",
      "این شخص دیگر در دسترس نیست.",
    ],
  };
  return messages[code]
    ? t(...messages[code])
    : t(
        "You do not have permission for this action.",
        "اجازهٔ انجام این کار را ندارید.",
      );
}
