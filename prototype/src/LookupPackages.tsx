import { Package } from "lucide-react";
import { readWeightPackages } from "./package-service";
import type { ProductReadDTO } from "./catalog-read-model";
import type { LookupBranchProduct } from "./lookup-branch";
import { useCatalogQuery } from "./catalog-query";
import { useDemo } from "./store";
import { pendingPrice, effectiveOffer } from "./catalog";
import { Badge } from "./ui";
import { Money, LtrText, OfferLabel, UnitSize } from "./presentation";
import { SalePrice } from "./sales-presentation";

export function LookupPackages({
  product,
  facts,
  onOpen,
}: {
  product: ProductReadDTO;
  facts: ReadonlyMap<string, LookupBranchProduct>;
  onOpen: (code: string) => void;
}) {
  const { state, branch, lang, t } = useDemo();
  const result = useCatalogQuery(
    "lookup.read",
    {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    },
    `lookup-packages:${product.code}`,
    (canonical, actor) => readWeightPackages(canonical, actor, product.code),
  );
  if (!result.ready)
    return (
      <p className="muted" role="status">
        {t("Loading package sizes…", "در حال دریافت اندازه‌های بسته…")}
      </p>
    );
  if (result.error)
    return (
      <p role="alert">
        {t(
          "Package sizes are unavailable. Try again.",
          "اندازه‌های بسته در دسترس نیست. دوباره تلاش کنید.",
        )}
      </p>
    );
  if (!result.data?.length) return null;
  return (
    <section className="lookup-packages" aria-label={t("Packages", "بسته‌ها")}>
      <div className="lookup-packages-heading">
        <h3>{t("Packages", "بسته‌ها")}</h3>
        <span className="muted">{t("Container included", "شامل ظرف")}</span>
      </div>
      <div className="lookup-package-grid">
        {result.data.map((child) => {
          const price = branch === "all" ? null : facts.get(child.code)?.price;
          const pending = pendingPrice(state, child, branch);
          const offer = price ? effectiveOffer(state, child, branch) : null;
          return (
            <button
              type="button"
              className="lookup-package-box"
              data-control-kind="disclosure"
              key={child.code}
              onClick={() => onOpen(child.code)}
              aria-label={`${t("Open", "باز کردن")} ${lang === "fa" ? child.name_fa || child.name_en : child.name_en}`}
            >
              <span className="lookup-package-icon">
                <Package size={20} aria-hidden="true" />
              </span>
              <span className="lookup-package-name">
                <strong>
                  <UnitSize
                    value={`${child.package_size} ${child.package_size_unit}`}
                  />
                </strong>
                <span className="muted">
                  {t(state.config.terminology.product_code, "کد محصول")}{" "}
                  <LtrText>{child.code}</LtrText>
                </span>
              </span>
              <span className="lookup-package-price">
                {price ? (
                  <SalePrice product={child} />
                ) : (
                  <span className="muted">
                    {branch === "all"
                      ? t("By location", "به تفکیک مکان")
                      : t(
                          "Not approved here yet",
                          "هنوز در این مکان تأیید نشده",
                        )}
                  </span>
                )}
                {offer && (
                  <span className="lookup-package-offer">
                    <OfferLabel label={offer.label} language={lang} />
                  </span>
                )}
                {pending && (
                  <span className="lookup-package-pending">
                    <Badge tone="pending">{t("Pending", "در انتظار")}</Badge>{" "}
                    <Money
                      value={pending}
                      currency={state.config.company.currency}
                    />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
