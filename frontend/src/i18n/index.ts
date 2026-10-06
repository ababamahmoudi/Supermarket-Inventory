import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import fa from "./fa.json";

export const languageStorageKey = "supermarket-ui-language";

function savedLanguage() {
  try {
    return localStorage.getItem(languageStorageKey) === "fa" ? "fa" : "en";
  } catch {
    return "en";
  }
}

function updateLanguage(language: string) {
  const resolved = language === "fa" ? "fa" : "en";
  document.documentElement.lang = resolved;
  document.documentElement.dir = resolved === "fa" ? "rtl" : "ltr";
  try {
    localStorage.setItem(languageStorageKey, resolved);
  } catch {
    // Language switching remains usable when browser storage is unavailable.
  }
}

i18n.on("languageChanged", updateLanguage);
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fa: { translation: fa } },
  lng: savedLanguage(),
  supportedLngs: ["en", "fa"],
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
