import {
  BilingualPrintText,
  OperationalPrintDocument,
} from "./operational-print";
import { formatMoney } from "./formatters";
import type { ReturnMemo } from "./return-workflow";
import type { Language } from "./types";
import { useEffect, useRef, useState } from "react";
import "./return-memo.css";

/** Fit the complete retained paper preview while keeping printed A4 dimensions. */
export function ReturnMemoPreview({
  memo,
  language,
}: {
  memo: ReturnMemo;
  language: Language;
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
          <ReturnMemoDocument memo={memo} language={language} />
        </div>
      </div>
    </div>
  );
}

export function ReturnMemoDocument({
  memo,
  language,
}: {
  memo: ReturnMemo;
  language: Language;
}) {
  const amount = (value: string, decimals = 2) =>
    formatMoney(value, { currency: memo.currency, decimals });
  return (
    <OperationalPrintDocument
      title_en="Return memo"
      title_fa="یادداشت مرجوعی"
      company_name={memo.company_name}
      reference={memo.reference}
      language={language}
    >
      <dl className="operational-print-meta">
        <div>
          <dt>
            <BilingualPrintText en="Supplier" fa="تأمین‌کننده" />
          </dt>
          <dd>{memo.supplier}</dd>
        </div>
        <div>
          <dt>
            <BilingualPrintText en="Location" fa="مکان" />
          </dt>
          <dd>
            <BilingualPrintText
              en={memo.location_name_en}
              fa={memo.location_name_fa}
            />
          </dd>
        </div>
        <div>
          <dt>
            <BilingualPrintText en="Date" fa="تاریخ" />
          </dt>
          <dd>
            <bdi dir="ltr">{memo.date}</bdi>
          </dd>
        </div>
        <div>
          <dt>
            <BilingualPrintText en="Return reference" fa="مرجع مرجوعی" />
          </dt>
          <dd>
            <bdi dir="ltr">{memo.return_id}</bdi>
          </dd>
        </div>
      </dl>
      <table className="return-memo-table">
        <thead>
          <tr>
            <th>
              <BilingualPrintText en="Product" fa="کالا" />
            </th>
            <th>
              <BilingualPrintText en="Quantity" fa="تعداد" />
            </th>
            <th>
              <BilingualPrintText en="Unit cost" fa="هزینهٔ واحد" />
            </th>
            <th>
              <BilingualPrintText
                en="Expected credit"
                fa="اعتبار مورد انتظار"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {memo.lines.map((line) => (
            <tr key={line.product_code}>
              <td>
                <BilingualPrintText
                  en={line.name_en}
                  fa={line.name_fa || line.name_en}
                />
                <bdi dir="ltr">{line.product_code}</bdi>
              </td>
              <td>
                <bdi dir="ltr">
                  {line.quantity}
                  {line.quantity_unit === "lb" ? " lb" : ""}
                </bdi>
              </td>
              <td>
                <bdi dir="ltr">
                  {amount(line.unit_cost, 4)}
                  {line.quantity_unit === "lb" ? " / lb" : ""}
                </bdi>
              </td>
              <td>
                <bdi dir="ltr">{amount(line.expected_credit)}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="return-memo-total">
        <BilingualPrintText
          en="Total credit expected"
          fa="جمع اعتبار مورد انتظار"
        />
        <strong>
          <bdi dir="ltr">{amount(memo.expected_credit)}</bdi>
        </strong>
      </div>
      <dl className="operational-print-meta">
        <div>
          <dt>
            <BilingualPrintText en="Driver name" fa="نام راننده" />
          </dt>
          <dd>{memo.representative}</dd>
        </div>
        <div>
          <dt>
            <BilingualPrintText en="Recorded by" fa="ثبت‌کننده" />
          </dt>
          <dd>{memo.created_by}</dd>
        </div>
        <div>
          <dt>
            <BilingualPrintText
              en="Signed paper evidence"
              fa="مدرک کاغذی امضاشده"
            />
          </dt>
          <dd>{memo.signed_evidence_reference}</dd>
        </div>
      </dl>
      <div className="return-memo-signature">
        <BilingualPrintText en="Signature" fa="امضا" />
        <span />
      </div>
      <p>
        <BilingualPrintText
          en="Expected credit is a pending claim, not a supplier credit note."
          fa="اعتبار مورد انتظار یک ادعای در انتظار است، نه یادداشت اعتبار تأمین‌کننده."
        />
      </p>
    </OperationalPrintDocument>
  );
}
