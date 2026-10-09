import type { ReactNode } from "react";
import type { Language } from "./types";
import "./operational-print.css";

export function BilingualPrintText({ en, fa }: { en: string; fa: string }) {
  return (
    <span className="operational-bilingual">
      <span lang="en" dir="ltr">
        {en}
      </span>
      <span lang="fa" dir="rtl">
        {fa}
      </span>
    </span>
  );
}

export function OperationalPrintDocument({
  title_en,
  title_fa,
  company_name,
  reference,
  language,
  children,
}: {
  title_en: string;
  title_fa: string;
  company_name: string;
  reference: string;
  language: Language;
  children: ReactNode;
}) {
  return (
    <article
      className="operational-print-document"
      lang={language}
      dir={language === "fa" ? "rtl" : "ltr"}
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
    </article>
  );
}
