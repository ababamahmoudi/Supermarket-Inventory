import { lookupLocationRows } from "./lookup-locations";
import { differingLookupLocations } from "./lookup-location-comparison";
import type { ProductReadDTO } from "./catalog-read-model";
import { useCatalogQuery } from "./catalog-query";
import { useDemo } from "./store";
import { branchLabel } from "./settings";
import { DateText, OfferLabel } from "./presentation";
import { ProductPrice } from "./weight-price-presentation";
import { DataTable } from "./ui";
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
  const different = differingLookupLocations(result.data ?? []);
  return (
    <section
      className="lookup-location-facts"
      aria-label={t("By location", "به تفکیک مکان")}
    >
      <div className="lookup-packages-heading">
        <h3>{t("By location", "به تفکیک مکان")}</h3>
        {different.length > 0 && (
          <span className="muted">
            {different.length === 1
              ? t(
                  `${branchLabel(state.config, different[0], "en")}'s price differs`,
                  `قیمت ${branchLabel(state.config, different[0], "fa")} متفاوت است`,
                )
              : t("Prices differ by location", "قیمت‌ها در مکان‌ها متفاوت است")}
          </span>
        )}
      </div>
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
        <DataTable
          className="lookup-locations-table"
          density="medium"
          recordDetails
          columns={[
            {
              key: "location",
              label: t("Location", "مکان"),
              required: true,
              minWidth: 112,
              priority: 0,
            },
            {
              key: "price",
              label: t("Price", "قیمت"),
              required: true,
              width: 96,
              minWidth: 96,
              align: "end",
              priority: 0,
            },
            {
              key: "offer",
              label: t("Offer", "پیشنهاد"),
              required: true,
              minWidth: 108,
              priority: 1,
            },
            {
              key: "delivered",
              label: t("Last delivered", "آخرین تحویل"),
              width: 120,
              minWidth: 120,
              align: "end",
              priority: 2,
            },
            {
              key: "expiry",
              label: t("Next expiry", "انقضای بعدی"),
              width: 120,
              minWidth: 120,
              align: "end",
              priority: 3,
            },
          ]}
          phoneList={{
            name: "location",
            value: "price",
            secondary: ["offer", "delivered"],
            render: ({ cell }) => (
              <>
                <td className="lookup-location-phone-name">
                  {cell("location")}
                </td>
                <td className="lookup-location-phone-price">{cell("price")}</td>
                <td className="lookup-location-phone-offer">{cell("offer")}</td>
                <td className="lookup-location-phone-delivered">
                  {cell("delivered")}
                </td>
              </>
            ),
          }}
        >
          <thead>
            <tr>
              <th>{t("Location", "مکان")}</th>
              <th className="numeric">{t("Price", "قیمت")}</th>
              <th>{t("Offer", "پیشنهاد")}</th>
              <th className="numeric">{t("Last delivered", "آخرین تحویل")}</th>
              <th className="numeric">{t("Next expiry", "انقضای بعدی")}</th>
            </tr>
          </thead>
          <tbody>
            {result.data?.map((row) => (
              <tr key={row.location} data-location={row.location}>
                <td>
                  <strong>
                    {branchLabel(state.config, row.location, lang)}
                  </strong>
                </td>
                <td className="numeric">
                  <span
                    className={
                      different.includes(row.location)
                        ? "lookup-location-price differs"
                        : "lookup-location-price"
                    }
                  >
                    {row.price ? (
                      <ProductPrice
                        value={row.price}
                        product={product}
                        config={state.config}
                      />
                    ) : (
                      <span className="muted">
                        {row.sells_here
                          ? t(
                              "No approved price yet",
                              "هنوز قیمت تأییدشده‌ای وجود ندارد",
                            )
                          : t("Not sold here", "اینجا فروخته نمی‌شود")}
                      </span>
                    )}
                  </span>
                </td>
                <td>
                  {row.on_sale ? (
                    <span className="lookup-location-offer">
                      {t("Sale", "حراج")}
                      {row.sale_last_day && (
                        <>
                          {" "}
                          · <DateText value={row.sale_last_day} />
                        </>
                      )}
                    </span>
                  ) : row.offer_label ? (
                    <span className="lookup-location-offer">
                      <OfferLabel label={row.offer_label} language={lang} />
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="numeric">
                  {row.delivered ? (
                    <DateText value={row.delivered} />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="numeric">
                  {row.next_expiry ? (
                    <span
                      className={
                        row.next_expiry.soon
                          ? "lookup-location-expiry is-soon ui-column-value"
                          : "lookup-location-expiry ui-column-value"
                      }
                    >
                      <DateText value={row.next_expiry.date} />
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </section>
  );
}
