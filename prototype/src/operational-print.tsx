import { StaffPrintMaker } from "./MakerBrand";
import type { MakerBranding } from "./maker-branding";
import { createContext, useContext, type ReactNode } from "react";
import type { Language } from "./types";
import "./operational-print.css";

const PrintLanguagePolicy = createContext<"bilingual" | "en">("bilingual");

export function BilingualPrintText({ en, fa }: { en: string; fa: string }) {
  const policy = useContext(PrintLanguagePolicy);
  return (
    <span className="operational-bilingual">
      <span lang="en" dir="ltr">
        {en}
      </span>
      {policy === "bilingual" && (
        <span lang="fa" dir="rtl">
          {fa}
        </span>
      )}
    </span>
  );
}

export function OperationalPrintDocument({
  title_en,
  title_fa,
  company_name,
  reference,
  language,
  documentLanguage = "bilingual",
  branding,
  children,
}: {
  title_en: string;
  title_fa: string;
  company_name: string;
  reference: string;
  language: Language;
  documentLanguage?: "bilingual" | "en";
  branding?: MakerBranding;
  children: ReactNode;
}) {
  return (
    <PrintLanguagePolicy.Provider value={documentLanguage}>
      <article
        className="operational-print-document"
        lang={documentLanguage === "en" ? "en" : language}
        dir={
          documentLanguage === "en" ? "ltr" : language === "fa" ? "rtl" : "ltr"
        }
      >
        <header className="operational-print-heading">
          <div>
            <strong>{company_name}</strong>
            <h1>
              <BilingualPrintText en={title_en} fa={title_fa} />
            </h1>
          </div>
          <bdi dir="ltr">{reference}</bdi>
        </header>
        {children}
        <StaffPrintMaker
          config={{ branding }}
          language={documentLanguage === "en" ? "en" : language}
          bilingual={documentLanguage === "bilingual"}
        />
      </article>
    </PrintLanguagePolicy.Provider>
  );
}
