import i18next from "i18next";
import { initReactI18next } from "react-i18next";

void i18next.use(initReactI18next).init({
  resources: { en: { translation: {} }, fa: { translation: {} } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
});

/** Keep each piece of copy bilingual while routing all display text through i18next. */
export function translate(en: string, fa: string): string {
  i18next.addResource("en", "translation", en, en);
  i18next.addResource("fa", "translation", en, fa);
  return String(i18next.t(en));
}
export default i18next;
