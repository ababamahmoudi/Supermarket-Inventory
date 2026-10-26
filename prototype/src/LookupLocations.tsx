import { lookupLocationRows } from "./lookup-locations";
import type { ProductReadDTO } from "./catalog-read-model";
import { useCatalogQuery } from "./catalog-query";
import { useDemo } from "./store";
import { branchLabel } from "./settings";
import { DateText } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import "./lookup-locations.css";

export function LookupLocations({ product }: { product: ProductReadDTO }) {
  const { state, lang, t } = useDemo();
  const result = useCatalogQuery(
    "lookup.read",
    {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    },
    `lookup-locations:${product.code}`,
    (canonical, actor) => lookupLocationRows(canonical, actor, product.code),
  );
  return (
    <section
      className="lookup-location-facts"
      aria-label={t("By location", "به تفکیک مکان")}
    >
      <h3>{t("By location", "به تفکیک مکان")}</h3>
      {result.error ? (
        <p role="alert">
          {t(
            "Location details are unavailable. Try again.",
            "جزئیات مکان در دسترس نیست. دوباره تلاش کنید.",
          )}
        </p>
      ) : !result.ready ? (
        <p className="muted" role="status">
          {t("Loading location details…", "در حال دریافت جزئیات مکان…")}
        </p>
      ) : (
        <ul>
          {result.data?.map((row) => (
            <li key={row.location}>
              <strong>{branchLabel(state.config, row.location, lang)}</strong>
              <span>
                {row.price ? (
                  <ProductPrice
                    value={row.price}
                    product={product}
                    config={state.config}
                  />
                ) : (
                  t("No approved price yet", "هنوز قیمت تأییدشده‌ای وجود ندارد")
                )}
              </span>
              <span className="muted">
                {row.delivered ? (
                  <>
                    {t("Delivered", "تحویل")} <DateText value={row.delivered} />
                  </>
                ) : (
                  t("No deliveries yet", "هنوز تحویلی ثبت نشده است")
                )}
              </span>
              <span className="muted">
                {row.dates.length
                  ? row.dates.map((entry, index) => (
                      <span key={`${entry.type}:${entry.date}:${index}`}>
                        {index > 0 ? " · " : ""}
                        {entry.type === "best_before"
                          ? t("Best before", "بهترین زمان مصرف")
                          : t("Expires", "انقضا")}{" "}
                        <DateText value={entry.date} />
                      </span>
                    ))
                  : t("No open dates", "بدون تاریخ باز")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
