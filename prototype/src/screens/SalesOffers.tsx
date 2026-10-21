import { ChevronRight, MoreHorizontal } from "lucide-react";
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "../authority-types";
import type {
  SaleRequestReadDTO as SaleRequest,
  SaleReadDTO as SaleSchedule,
} from "../offers-read-model";
import type { ProductReadDTO as Product } from "../catalog-read-model";
import type { ScopedReadView as SalesView } from "../e1-read-model";
type SalesContext = AuthenticatedActor;
import { salePriceDisplay } from "../sales";
import { branchLabel } from "../settings";
import { regularPrice } from "../catalog";
import { DateText, LtrText, ProductName } from "../presentation";
import {
  saleListStatus,
  type SalesOfferRow as SaleRow,
} from "../sales-offer-list";
import { saleCalendarDate, salesText } from "../sales-locale";
import { ProductPrice } from "../weight-price-presentation";
import { SellingPriceValue } from "../selling-price-presentation";
import { weightPriceDisplay } from "../weighed";
import { SalePrice } from "../sales-presentation";
import type { Language } from "../types";
import { Badge, IconButton, Menu, MenuItem } from "../ui";

type Presentation = {
  state: SalesView;
  lang: Language;
  t: (en: string, fa: string) => string;
};

function RecordedSalePrice({
  state,
  sale,
  regular,
  product,
}: {
  state: SalesView;
  sale: Pick<SaleSchedule, "sale_price" | "price_unit">;
  regular?: string | null;
  product?: Product;
}) {
  return (
    <SellingPriceValue
      current={salePriceDisplay(sale, state.config)}
      currency={state.config.company.currency}
      regular={
        regular
          ? product?.sold_by === "weight"
            ? weightPriceDisplay(regular, state.config)
            : { main: { amount: regular, unit: "each" } }
          : undefined
      }
    />
  );
}

function SaleTerm({
  state,
  lang,
  t,
  sale,
}: Presentation & { sale: SaleSchedule }) {
  const status = saleListStatus(state, sale);
  return (
    <div className="offer-group-entry">
      <Badge
        tone={
          status === "active"
            ? "approved"
            : status === "expired"
              ? "danger"
              : status === "ended"
                ? "neutral"
                : "info"
        }
      >
        {status === "active"
          ? t("Active", "فعال")
          : status === "scheduled"
            ? t("Scheduled", "زمان‌بندی‌شده")
            : status === "expired"
              ? t("Expired", "منقضی‌شده")
              : t("Ended", "پایان‌یافته")}
      </Badge>
      <p className="muted">
        {salesText(t, "starts")}: <DateText value={sale.starts_on} />
      </p>
      <p className="muted sale-end-date">
        {sale.last_day ? (
          <>
            {salesText(t, "until")}{" "}
            <bdi dir="auto" className="sale-calendar-date">
              {saleCalendarDate(sale.last_day, lang)}
            </bdi>
          </>
        ) : (
          salesText(t, "noEnd")
        )}
      </p>
    </div>
  );
}

/** This pure row renderer returns a real tr so the shared responsive table can inspect every cell. */
export function SalesOfferRow({
  row,
  state,
  lang,
  t,
  context,
  can,
  onOpen,
  onChange,
  onEnd,
  onWithdraw,
}: Presentation & {
  row: SaleRow;
  context: SalesContext | null;
  can: (capability: Capability, scope?: ResourceScope) => boolean;
  onOpen: (row: SaleRow) => void;
  onChange: (row: SaleSchedule | SaleRequest) => void;
  onEnd: (sale: SaleSchedule) => void;
  onWithdraw: (request: SaleRequest) => void;
}) {
  const owner =
    row.kind === "request" &&
    row.request.requester_user_id === context?.user_id &&
    can("sales.request_edit_own", {
      company_id: row.request.company_id,
      kind: "location_record",
      location_ids: [row.request.branch],
      owner_user_id: row.request.requester_user_id,
      entity_id: row.request.id,
    });
  const actionableSale =
    row.kind === "sale" &&
    row.sales.some((sale) =>
      can("sales.manage", {
        company_id: sale.company_id,
        kind: "location_record",
        location_ids: [sale.branch],
        entity_id: sale.id,
      }),
    ) &&
    row.sales.some((sale) =>
      ["active", "scheduled"].includes(saleListStatus(state, sale)),
    );
  const actionLabel = t("Open offer", "باز کردن پیشنهاد");
  return (
    <tr
      key={row.key}
      data-product-code={row.product.code}
      data-offer-kind={row.kind}
      data-row-href={`#product?code=${encodeURIComponent(row.product.code)}`}
      tabIndex={0}
      onClick={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest("button,a,input,[role='button']")
        ) {
          event.preventDefault();
          onOpen(row);
        }
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          ["Enter", " "].includes(event.key)
        ) {
          event.preventDefault();
          onOpen(row);
        }
      }}
    >
      <td>
        <ProductName product={row.product} language={lang} />
      </td>
      <td className="numeric">
        {row.kind === "sale" ? (
          row.sales.map((sale) => {
            const regular = regularPrice(state, row.product, sale.branch);
            return (
              <div className="offer-group-entry sale-offer-price" key={sale.id}>
                <span>{t("Sale price", "قیمت حراج")}</span>
                <strong>
                  <RecordedSalePrice
                    state={state}
                    sale={sale}
                    regular={regular}
                    product={row.product}
                  />
                </strong>
              </div>
            );
          })
        ) : (
          <div className="offer-group-entry sale-offer-price">
            <strong>
              <SalePrice product={row.product} branch={row.request.branch} />
            </strong>
          </div>
        )}
      </td>
      <td>
        <span className="product-offer-lines">
          {row.kind === "sale" ? (
            row.sales.map((sale) => (
              <span className="product-offer-line" key={sale.id}>
                {t("Sale", "حراج")} ·{" "}
                {sale.last_day ? (
                  <>
                    {t("ends", "پایان")}{" "}
                    <bdi>{saleCalendarDate(sale.last_day, lang)}</bdi>
                  </>
                ) : (
                  t("no end date", "بدون تاریخ پایان")
                )}
              </span>
            ))
          ) : (
            <span className="product-offer-line is-requested">
              {salesText(t, "requested")} ·{" "}
              <RecordedSalePrice
                state={state}
                sale={{
                  sale_price: row.request.requested_price,
                  price_unit: row.request.price_unit,
                }}
              />
            </span>
          )}
        </span>
      </td>
      <td className="branch-label offer-scope">
        {row.kind === "sale"
          ? row.sales.map((sale) => (
              <div className="offer-group-entry" key={sale.id}>
                {branchLabel(state.config, sale.branch, lang)}
              </div>
            ))
          : branchLabel(state.config, row.request.branch, lang)}
      </td>
      <td>
        {row.kind === "sale" ? (
          row.sales.map((sale) => (
            <SaleTerm
              key={sale.id}
              sale={sale}
              state={state}
              lang={lang}
              t={t}
            />
          ))
        ) : (
          <div className="offer-group-entry">
            <Badge tone="pending">{t("Requested", "درخواست‌شده")}</Badge>
            <p className="muted">
              {salesText(t, "starts")}:{" "}
              <DateText value={row.request.starts_on} />
            </p>
            <p className="muted">
              {row.request.last_day ? (
                <>
                  {salesText(t, "until")}{" "}
                  <bdi dir="auto" className="sale-calendar-date">
                    {saleCalendarDate(row.request.last_day, lang)}
                  </bdi>
                </>
              ) : (
                salesText(t, "noEnd")
              )}
            </p>
          </div>
        )}
      </td>
      <td>
        <div className="actions offer-row-actions">
          {actionableSale || owner ? (
            <Menu
              iconOnly
              showChevron={false}
              aria-label={t("More", "بیشتر")}
              label={
                <MoreHorizontal
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              }
            >
              {row.kind === "sale" ? (
                row.sales
                  .filter((sale) =>
                    ["active", "scheduled"].includes(
                      saleListStatus(state, sale),
                    ),
                  )
                  .map((sale) => (
                    <div key={sale.id}>
                      <MenuItem onClick={() => onChange(sale)}>
                        {salesText(t, "changeSale")} ·{" "}
                        {branchLabel(state.config, sale.branch, lang)}
                      </MenuItem>
                      <MenuItem onClick={() => onEnd(sale)}>
                        {salesText(t, "endNow")} ·{" "}
                        {branchLabel(state.config, sale.branch, lang)}
                      </MenuItem>
                    </div>
                  ))
              ) : (
                <>
                  <MenuItem onClick={() => onChange(row.request)}>
                    {t("Change request", "تغییر درخواست")}
                  </MenuItem>
                  <MenuItem onClick={() => onWithdraw(row.request)}>
                    {salesText(t, "withdraw")}
                  </MenuItem>
                </>
              )}
            </Menu>
          ) : (
            <span className="offer-more-slot" aria-hidden="true" />
          )}
          <IconButton
            variant="ghost"
            aria-label={actionLabel}
            onClick={() => onOpen(row)}
            className="table-row-link offer-record-action"
          >
            <ChevronRight
              className="directional"
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function SaleRecordPrice({
  state,
  lang,
  t,
  product,
  sale,
}: Presentation & { product: Product; sale: SaleSchedule }) {
  const regular = regularPrice(state, product, sale.branch);
  return (
    <section className="offer-record">
      <h3>{branchLabel(state.config, sale.branch, lang)}</h3>
      <dl>
        <div>
          <dt>{t("Sale price", "قیمت حراج")}</dt>
          <dd>
            <RecordedSalePrice state={state} sale={sale} />
          </dd>
        </div>
        {regular && (
          <div>
            <dt>{salesText(t, "regular")}</dt>
            <dd>
              <ProductPrice
                value={regular}
                product={product}
                config={state.config}
              />
            </dd>
          </div>
        )}
        <div>
          <dt>{salesText(t, "starts")}</dt>
          <dd>
            <DateText value={sale.starts_on} />
          </dd>
        </div>
        <div>
          <dt>{salesText(t, "lastDay")}</dt>
          <dd>
            {sale.last_day ? (
              <DateText value={sale.last_day} />
            ) : (
              salesText(t, "noEnd")
            )}
          </dd>
        </div>
        {sale.created_by && (
          <div>
            <dt>{t("Created by", "ایجادشده توسط")}</dt>
            <dd>
              <bdi dir="auto">{sale.created_by}</bdi>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function SalesOfferRecord({
  row,
  state,
  lang,
  t,
}: Presentation & { row: SaleRow }) {
  return (
    <>
      <ProductName product={row.product} language={lang} />
      <p className="muted">
        {t("Product Code", "کد کالا")}: <LtrText>{row.product.code}</LtrText>
      </p>
      {row.kind === "sale" ? (
        row.sales.map((sale) => (
          <SaleRecordPrice
            key={sale.id}
            state={state}
            lang={lang}
            t={t}
            product={row.product}
            sale={sale}
          />
        ))
      ) : (
        <section className="offer-record">
          <h3>
            {t("Requested", "درخواست‌شده")} ·{" "}
            {branchLabel(state.config, row.request.branch, lang)}
          </h3>
          <dl>
            <div>
              <dt>{t("Sale price", "قیمت حراج")}</dt>
              <dd>
                <RecordedSalePrice
                  state={state}
                  sale={{
                    sale_price: row.request.requested_price,
                    price_unit: row.request.price_unit,
                  }}
                />
              </dd>
            </div>
            <div>
              <dt>{salesText(t, "starts")}</dt>
              <dd>
                <DateText value={row.request.starts_on} />
              </dd>
            </div>
            <div>
              <dt>{salesText(t, "lastDay")}</dt>
              <dd>
                {row.request.last_day ? (
                  <DateText value={row.request.last_day} />
                ) : (
                  salesText(t, "noEnd")
                )}
              </dd>
            </div>
            {row.request.requester && (
              <div>
                <dt>{t("Requested by", "درخواست‌شده توسط")}</dt>
                <dd>
                  <bdi dir="auto">{row.request.requester}</bdi>
                </dd>
              </div>
            )}
            {row.request.why && (
              <div>
                <dt>{t("Why?", "چرا؟")}</dt>
                <dd>
                  <bdi dir="auto">{row.request.why}</bdi>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </>
  );
}
