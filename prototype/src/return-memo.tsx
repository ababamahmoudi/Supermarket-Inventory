import { StaffPrintMaker } from "./MakerBrand";
import type { MakerConfig } from "./maker-branding";
import { BilingualPrintText } from "./operational-print";
import { formatMoney } from "./formatters";
import type { ReturnMemoRead } from "./return-projections";
import type { Language } from "./types";
import { useEffect, useRef, useState } from "react";
import "./return-memo.css";

/** Fit the complete retained paper preview while keeping printed A4 dimensions. */
export function ReturnMemoPreview({
  memo,
  language,
  documentLanguage,
  config = {},
}: {
  memo: ReturnMemoRead;
  language: Language;
  documentLanguage?: "en" | "bilingual";
  config?: MakerConfig;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 794, height: 1123, scale: 1 });
  useEffect(() => {
    const measure = () => {
      const article = paper.current?.querySelector<HTMLElement>(
        ".operational-print-document",
      );
      if (
        !viewport.current ||
        !article ||
        article.offsetWidth <= 0 ||
        article.offsetHeight <= 0
      )
        return;
      const width = article.offsetWidth;
      const height = article.offsetHeight;
      setSize({
        width,
        height,
        scale: Math.min(
          1,
          viewport.current.clientWidth / width,
          Math.max(220, window.innerHeight * 0.62) / height,
        ),
      });
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (viewport.current) observer?.observe(viewport.current);
    if (paper.current) observer?.observe(paper.current);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className="return-memo-preview" ref={viewport}>
      <div
        className="return-memo-frame"
        style={{
          width: size.width * size.scale,
          height: size.height * size.scale,
        }}
      >
        <div
          className="return-memo-scaled"
          ref={paper}
          style={{ transform: `scale(${size.scale})` }}
        >
          <ReturnMemoDocument
            memo={memo}
            language={language}
            documentLanguage={documentLanguage}
            config={config}
          />
        </div>
      </div>
    </div>
  );
}

export function ReturnMemoDocument({
  memo,
  language,
  documentLanguage,
  config = {},
}: {
  memo: ReturnMemoRead;
  language: Language;
  documentLanguage?: "en" | "bilingual";
  config?: MakerConfig;
}) {
  const bilingual =
    (documentLanguage ?? memo.document_language ?? "en") === "bilingual";
  const text = (en: string, fa: string) =>
    bilingual ? (
      <BilingualPrintText en={en} fa={fa} />
    ) : (
      <span lang="en" dir="ltr">
        {en}
      </span>
    );
  const amount = (value: string) =>
    formatMoney(value, { currency: memo.currency });
  const showMoney =
    typeof memo.expected_credit === "string" &&
    memo.lines.every(
      (line) =>
        typeof line.unit_cost === "string" &&
        typeof line.expected_credit === "string",
    );
  return (
    <article
      className="operational-print-document return-memo-document"
      lang={bilingual ? language : "en"}
      dir={bilingual && language === "fa" ? "rtl" : "ltr"}
    >
      <header className="operational-print-heading">
        <div>
          <strong>{memo.company_name}</strong>
          <p>{text(memo.location_name_en, memo.location_name_fa)}</p>
          <p>
            {text("Address", "نشانی")}: {memo.location_address || "—"}
          </p>
          <h1>{text("Return memo", "یادداشت مرجوعی")}</h1>
        </div>
        <div className="return-memo-reference">
          <strong>
            <bdi dir="ltr">{memo.reference}</bdi>
          </strong>
          <p>
            {text("Date", "تاریخ")}: <bdi dir="ltr">{memo.date}</bdi>
          </p>
        </div>
      </header>
      <section className="return-memo-supplier">
        <h2>{text("Supplier", "تأمین‌کننده")}</h2>
        <strong>{memo.supplier}</strong>
        {memo.supplier_address && <p>{memo.supplier_address}</p>}
        {memo.supplier_phone && (
          <p>
            {text("Phone", "تلفن")}: <bdi>{memo.supplier_phone}</bdi>
          </p>
        )}
        {memo.supplier_email && (
          <p>
            {text("Email", "ایمیل")}: <bdi>{memo.supplier_email}</bdi>
          </p>
        )}
      </section>
      <table className="return-memo-table">
        <thead>
          <tr>
            <th>{text("Product", "کالا")}</th>
            <th>{text("Product Code", "کد کالا")}</th>
            <th>{text("Quantity", "تعداد")}</th>
            {showMoney && <th>{text("Unit cost", "هزینهٔ واحد")}</th>}
            {showMoney && (
              <th>{text("Credit expected", "اعتبار مورد انتظار")}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {memo.lines.map((line) => (
            <tr key={line.product_code}>
              <td>{text(line.name_en, line.name_fa || line.name_en)}</td>
              <td>
                <bdi dir="ltr">{line.product_code}</bdi>
              </td>
              <td>
                <bdi dir="ltr">
                  {line.quantity}
                  {line.quantity_unit === "lb" ? " lb" : ""}
                </bdi>
              </td>
              {showMoney && line.unit_cost !== undefined && (
                <td>
                  <bdi dir="ltr">
                    {amount(line.unit_cost)}
                    {line.quantity_unit === "lb" ? " / lb" : ""}
                  </bdi>
                </td>
              )}
              {showMoney && line.expected_credit !== undefined && (
                <td>
                  <bdi dir="ltr">{amount(line.expected_credit)}</bdi>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {showMoney && memo.expected_credit !== undefined && (
        <div className="return-memo-total">
          {text("Total credit expected", "جمع اعتبار مورد انتظار")}
          <strong>
            <bdi dir="ltr">{amount(memo.expected_credit)}</bdi>
          </strong>
        </div>
      )}
      <p>
        {text("Signed paper evidence", "مدرک کاغذی امضاشده")}:{" "}
        <bdi>
          {memo.signed_evidence_reference ||
            text("No reference provided", "مرجعی ارائه نشده")}
        </bdi>
      </p>
      {memo.correction_of && (
        <p>{text("Corrected pickup", "جمع‌آوری اصلاح‌شده")}</p>
      )}
      <div className="return-memo-signatures">
        {[
          { label: text("Driver", "راننده"), name: memo.representative },
          {
            label: text("Store staff", "کارمند فروشگاه"),
            name: memo.created_by,
          },
        ].map((person, index) => (
          <section key={index}>
            <h2>{person.label}</h2>
            <p>
              {text("Name", "نام")}: {person.name}
            </p>
            <p>
              {text("Date", "تاریخ")}: <bdi dir="ltr">{memo.date}</bdi>
            </p>
            <div className="return-memo-signature">
              {text("Signature", "امضا")}
              <span />
            </div>
          </section>
        ))}
      </div>
      <p className="return-memo-footnote">
        {text(
          "Expected credit is a pending claim, not a supplier credit note.",
          "اعتبار مورد انتظار یک ادعای در انتظار است، نه یادداشت اعتبار تأمین‌کننده.",
        )}
      </p>
      <StaffPrintMaker
        config={config}
        language={bilingual ? language : "en"}
        bilingual={bilingual}
      />
    </article>
  );
}
