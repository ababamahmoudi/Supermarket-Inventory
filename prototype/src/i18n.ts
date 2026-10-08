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
export function translate(
  en: string,
  fa: string,
  language = i18next.language,
): string {
  i18next.addResource("en", "translation", en, en);
  i18next.addResource("fa", "translation", en, fa);
  return String(i18next.t(en, { lng: language }));
}

/** Resolve count-dependent copy with i18next's locale plural rules. */
export function translateCount(
  enSingular: string,
  enPlural: string,
  faSingular: string,
  faPlural: string,
  count: number,
  language = i18next.language,
): string {
  const key = `count:${enSingular}`;
  i18next.addResource("en", "translation", `${key}_one`, enSingular);
  i18next.addResource("en", "translation", `${key}_other`, enPlural);
  i18next.addResource("fa", "translation", `${key}_one`, faSingular);
  i18next.addResource("fa", "translation", `${key}_other`, faPlural);
  return String(i18next.t(key, { count, lng: language }));
}
export default i18next;
