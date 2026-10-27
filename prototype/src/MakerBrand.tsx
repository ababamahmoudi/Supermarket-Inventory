import type { Language } from "./types";
import {
  configuredMaker,
  makerAsset,
  makerSupport,
  type MakerConfig,
} from "./maker-branding";
import "./maker-brand.css";

export function MakerLogo({
  config,
  compact = false,
}: {
  config: MakerConfig;
  compact?: boolean;
}) {
  const maker = configuredMaker(config);
  if (!maker?.logo_file) return null;
  return (
    <span className={`maker-logo-space${compact ? " is-compact" : ""}`}>
      <img
        className="maker-logo-light"
        src={makerAsset(
          compact ? (maker.mark_file ?? maker.logo_file) : maker.logo_file,
        )}
        alt={maker.name}
      />
      <img
        className="maker-logo-dark"
        src={makerAsset(maker.logo_dark_file ?? maker.logo_file)}
        alt={maker.name}
      />
    </span>
  );
}

export function PoweredByMaker({
  config,
  language,
}: {
  config: MakerConfig;
  language: Language;
}) {
  const maker = configuredMaker(config);
  if (!maker) return null;
  return (
    <p className="maker-powered">
      <span>
        {language === "fa" ? "با پشتیبانی" : "Powered by"}{" "}
        <bdi>{maker.name}</bdi>
      </span>
      <MakerLogo config={config} compact />
    </p>
  );
}

export function MakerAbout({
  config,
  language,
  appName,
  version,
}: {
  config: MakerConfig;
  language: Language;
  appName: string;
  version: string;
}) {
  const maker = configuredMaker(config);
  const support = makerSupport(config);
  return (
    <div className="maker-about">
      <div>
        <h3>{appName}</h3>
        <p className="muted">
          {language === "fa" ? "نسخه" : "Version"}{" "}
          <bdi dir="ltr">{version}</bdi>
        </p>
      </div>
      {maker && (
        <div className="maker-about-identity">
          <span>
            {language === "fa" ? "ساخته‌شده توسط" : "Made by"}{" "}
            <bdi>{maker.name}</bdi>
          </span>
          <MakerLogo config={config} />
        </div>
      )}
      {support && (
        <p className="maker-support">
          <span>{language === "fa" ? "پشتیبانی" : "Support"}</span>:{" "}
          <bdi dir="auto">{support}</bdi>
        </p>
      )}
    </div>
  );
}

export function StaffPrintMaker({
  config,
  language = "en",
  bilingual = false,
  printOnly = false,
}: {
  config: MakerConfig;
  language?: Language;
  bilingual?: boolean;
  printOnly?: boolean;
}) {
  const maker = configuredMaker(config);
  if (!maker) return null;
  return (
    <footer className={`maker-print${printOnly ? " maker-print-only" : ""}`}>
      {(bilingual || language === "en") && (
        <span lang="en" dir="ltr">
          Made with <bdi>{maker.name}</bdi>
        </span>
      )}
      {(bilingual || language === "fa") && (
        <span lang="fa" dir="rtl">
          ساخته‌شده با <bdi>{maker.name}</bdi>
        </span>
      )}
    </footer>
  );
}
