import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Decimal from "decimal.js";
import { Search, ScanLine } from "lucide-react";
import {
  effectiveOffer,
  effectivePrice,
  lookupBranch,
  pendingPrice,
  searchProducts,
} from "../catalog";
import { branches, useDemo } from "../store";
import type { Product } from "../types";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  Select,
} from "../ui";

import {
  activityLabel,
  branchLabel,
  categoryLabel,
  demoUserLabel,
  LtrText,
  Money,
  OfferLabel,
  UnitSize,
} from "../presentation";

const PAGE_SIZE = 8;

function ProductPrice({ product }: { product: Product }) {
  const { state, branch, t, lang } = useDemo();
  const approved = effectivePrice(state, product, branch);
  const pending = pendingPrice(state, product, branch);
  const offer = effectiveOffer(state, product, branch);
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  return (
    <div className="stack">
      <div>
        <p className="muted">
          {!approved && pending
            ? t("Proposed price before tax", "قیمت پیشنهادی پیش از مالیات")
            : t("Selling price before tax", "قیمت فروش پیش از مالیات")}
        </p>
        <div className="actions">
          <strong className="price" dir="ltr">
            {approved || pending ? <Money value={approved || pending!} /> : "—"}
          </strong>
          {profile?.taxable && (
            <Badge tone="info">
              {t(
                state.config.tax.label_text_en,
                state.config.tax.label_text_fa,
              )}
            </Badge>
          )}
          {offer && (
            <Badge tone="info" className="offer-pill">
              <OfferLabel label={offer.label} language={lang} />
            </Badge>
          )}
        </div>
      </div>
      {pending && (
        <div className="banner pending" role="status">
          <Badge tone="pending">
            {approved
              ? t("New price pending", "قیمت جدید در انتظار تأیید")
              : t("Pending", "در انتظار تأیید")}
          </Badge>{" "}
          {approved ? (
            <span>
              {t("Proposed price", "قیمت پیشنهادی")}:{" "}
              <strong>
                <Money value={pending} />
              </strong>
              .{" "}
              {t(
                "Keep charging the approved price shown above.",
                "تا زمان تأیید، قیمت تأییدشدهٔ بالا را دریافت کنید.",
              )}
            </span>
          ) : (
            <span>
              {t(
                "Pending: confirm with a Supervisor before selling",
                "در انتظار تأیید: پیش از فروش با سرپرست تأیید کنید",
              )}
            </span>
          )}
        </div>
      )}
      {!approved && !pending && (
        <div className="banner pending">
          {t(
            "No approved price in this branch. Confirm with a Supervisor before selling.",
            "در این شعبه قیمت تأییدشده‌ای وجود ندارد. پیش از فروش با سرپرست تأیید کنید.",
          )}
        </div>
      )}
    </div>
  );
}

function ProductDetail({
  product,
  operational = false,
}: {
  product: Product;
  operational?: boolean;
}) {
  const { state, branch, role, lang, t } = useDemo();
  const category = state.config.pricing_categories.find(
    (item) => item.key === product.pricing_category,
  );
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  const canSeeOperations = operational && role !== "cashier";
  const visibleBranches =
    role === "supervisor" ? branches : [lookupBranch(branch)];
  return (
    <Card
      title={lang === "fa" ? product.name_fa : product.name_en}
      className="product-detail-card"
    >
      <div className="stack">
        <p
          lang={lang === "fa" ? "en" : "fa"}
          dir={lang === "fa" ? "ltr" : "rtl"}
        >
          <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
            {lang === "fa" ? product.name_en : product.name_fa}
          </bdi>
        </p>
        <div className="actions">
          <UnitSize value={product.unit_size} />
          <Badge
            tone={
              product.status === "pending_approval"
                ? "pending"
                : product.status === "archived"
                  ? "neutral"
                  : "approved"
            }
          >
            {product.status === "pending_approval"
              ? t("Pending", "در انتظار تأیید")
              : product.status === "archived"
                ? t("Archived", "بایگانی‌شده")
                : t("Approved", "تأییدشده")}
          </Badge>
        </div>
        <ProductPrice product={product} />
        <dl className="form-grid">
          <div>
            <dt className="muted">
              {t(state.config.terminology.product_code, "کد محصول")}
            </dt>
            <dd>
              <LtrText>{product.code}</LtrText>
            </dd>
          </div>
          <div>
            <dt className="muted">{t("Barcode", "بارکد")}</dt>
            <dd>
              {product.barcode ? (
                <LtrText>{product.barcode}</LtrText>
              ) : (
                t("Not added", "اضافه نشده")
              )}
            </dd>
          </div>
          <div>
            <dt className="muted">{t("AI category", "دستهٔ هوش مصنوعی")}</dt>
            <dd>{categoryLabel(product.ai_category, lang)}</dd>
          </div>
          <div>
            <dt className="muted">
              {product.status === "pending_approval"
                ? t("Proposed tax profile", "وضعیت مالیات پیشنهادی")
                : t("Approved tax profile", "وضعیت مالیات تأییدشده")}
            </dt>
            <dd>
              {profile
                ? t(profile.label_en, profile.label_fa)
                : t("Pending Supervisor review", "در انتظار بررسی سرپرست")}
              {profile && product.status === "pending_approval" && (
                <p className="muted">
                  {t("Pending Supervisor review", "در انتظار بررسی سرپرست")}
                </p>
              )}
            </dd>
          </div>
          {(product.description_en || product.description_fa) && (
            <div>
              <dt className="muted">{t("Description", "توضیحات")}</dt>
              <dd>
                {lang === "fa"
                  ? product.description_fa || product.description_en
                  : product.description_en || product.description_fa}
              </dd>
            </div>
          )}
        </dl>
        {canSeeOperations && (
          <>
            <dl className="form-grid">
              <div>
                <dt className="muted">
                  {t("Pricing category", "دستهٔ قیمت‌گذاری")}
                </dt>
                <dd>
                  {categoryLabel(
                    category?.label || product.pricing_category,
                    lang,
                  )}
                </dd>
              </div>
              <div>
                <dt className="muted">{t("Supplier", "تأمین‌کننده")}</dt>
                <dd>
                  <LtrText>{product.main_supplier}</LtrText>
                </dd>
              </div>
            </dl>
            {role === "supervisor" && (
              <div className="stack">
                <h3>
                  {t(
                    "Approved prices by branch",
                    "قیمت‌های تأییدشده در شعبه‌ها",
                  )}
                </h3>
                <DataTable>
                  <thead>
                    <tr>
                      <th>{t("Branch", "شعبه")}</th>
                      <th className="numeric">
                        {t("Approved price", "قیمت تأییدشده")}
                      </th>
                      <th>{t("Price scope", "محدودهٔ قیمت")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((item) => {
                      const price = effectivePrice(state, product, item);
                      return (
                        <tr key={item}>
                          <td>{branchLabel(item, lang)}</td>
                          <td className="numeric">
                            {price ? <Money value={price} /> : "—"}
                          </td>
                          <td>
                            {product.branch_prices?.[item]
                              ? t("This branch only", "فقط این شعبه")
                              : t("Company default", "پیش‌فرض شرکت")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
                <p>
                  {t(
                    "Last supplier unit cost before tax",
                    "آخرین هزینهٔ واحد از تأمین‌کننده پیش از مالیات",
                  )}
                  :{" "}
                  <strong>
                    <Money value={product.last_cost_before_tax} />
                  </strong>
                </p>
                <p className="muted">
                  {t(
                    "Demo seed cost. New receipt costs belong to their invoice branch.",
                    "هزینهٔ نمونهٔ دمو است. هزینهٔ دریافت جدید متعلق به شعبهٔ فاکتور است.",
                  )}
                </p>
              </div>
            )}
            <div className="stack">
              <h3>{t("Stock estimate", "برآورد موجودی")}</h3>
              <p className="muted">
                {t(
                  "An estimate until a cash register is connected.",
                  "تا زمان اتصال صندوق فروش، این مقدار برآورد است.",
                )}
              </p>
              <dl className="form-grid">
                {visibleBranches.map((item) => (
                  <div key={item}>
                    <dt className="muted">{branchLabel(item, lang)}</dt>
                    <dd>
                      <LtrText>
                        {state.stock[`${item}:${product.code}`] ?? 0}
                      </LtrText>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="stack">
              <h3>{t("History", "تاریخچه")}</h3>
              {state.activity.filter(
                (item) =>
                  item.company_id === product.company_id &&
                  item.product_code === product.code &&
                  (branch === "all" ||
                    item.branch === "all" ||
                    item.branch === branch),
              ).length ? (
                <ul>
                  {state.activity
                    .filter(
                      (item) =>
                        item.company_id === product.company_id &&
                        item.product_code === product.code &&
                        (branch === "all" ||
                          item.branch === "all" ||
                          item.branch === branch),
                    )
                    .map((item) => (
                      <li key={item.id}>
                        {activityLabel(item.action, lang)} ·{" "}
                        {demoUserLabel(item.by, lang)}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="muted">
                  {t(
                    "No demo changes yet. Approvals and invoice actions appear here.",
                    "هنوز تغییری در دمو نیست. تأییدها و اقدامات فاکتور اینجا نشان داده می‌شوند.",
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function LookupProductDetail({ product }: { product: Product }) {
  const { state, branch, t, lang } = useDemo();
  const approved = effectivePrice(state, product, branch);
  const pending = pendingPrice(state, product, branch);
  const offer = effectiveOffer(state, product, branch);
  const profile = state.config.tax.profiles.find(
    (item) => item.key === product.tax_profile,
  );
  return (
    <Card className="lookup-detail">
      <div className="lookup-detail-header">
        <div>
          <h2 lang={lang} dir={lang === "fa" ? "rtl" : "ltr"}>
            <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
              {lang === "fa" ? product.name_fa : product.name_en}
            </bdi>
          </h2>
          <p
            className="muted"
            lang={lang === "fa" ? "en" : "fa"}
            dir={lang === "fa" ? "ltr" : "rtl"}
          >
            <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
              {lang === "fa" ? product.name_en : product.name_fa}
            </bdi>
          </p>
          <p className="lookup-product-meta muted">
            <span>
              {t(state.config.terminology.product_code, "کد محصول")}{" "}
              <LtrText>{product.code}</LtrText>
            </span>
            <UnitSize value={product.unit_size} />
          </p>
        </div>
      </div>
      <div className="lookup-price-block">
        <div className="lookup-approved-price">
          <p className="muted">
            {t(state.config.terminology.selling_price, "قیمت فروش")}
          </p>
          {approved ? (
            <strong className="price" dir="ltr">
              <Money value={approved} />
            </strong>
          ) : (
            <p className="muted lookup-missing-price">
              {t("No approved price yet", "هنوز قیمت تأییدشده‌ای وجود ندارد")}
            </p>
          )}
          <p className="helper">{t("Before tax", "پیش از مالیات")}</p>
        </div>
        {pending && (
          <div className="lookup-pending-price">
            <Badge tone="pending">
              {approved
                ? t("New price pending", "قیمت جدید در انتظار تأیید")
                : t("Pending", "در انتظار تأیید")}
            </Badge>
            <Money value={pending} />
          </div>
        )}
      </div>
      {(profile?.taxable || offer) && (
        <div className="lookup-price-tags actions">
          {profile?.taxable && (
            <Badge tone="info">
              {t(
                state.config.tax.label_text_en,
                state.config.tax.label_text_fa,
              )}
            </Badge>
          )}
          {offer && (
            <Badge tone="info" className="offer-pill">
              <OfferLabel label={offer.label} language={lang} />
            </Badge>
          )}
        </div>
      )}
      {pending && (
        <p className="helper" role="status">
          {approved
            ? t(
                "Keep charging the approved price shown above.",
                "تا زمان تأیید، قیمت تأییدشدهٔ بالا را دریافت کنید.",
              )
            : t(
                "Pending: confirm with a Supervisor before selling",
                "در انتظار تأیید: پیش از فروش با سرپرست تأیید کنید",
              )}
        </p>
      )}
      {!approved && !pending && (
        <p className="helper">
          {t(
            "Confirm with a Supervisor before selling.",
            "پیش از فروش با سرپرست تأیید کنید.",
          )}
        </p>
      )}
    </Card>
  );
}

function searchFromLookupHash() {
  const [route, query = ""] = window.location.hash.slice(1).split("?");
  return route === "lookup"
    ? (new URLSearchParams(query).get("search") ?? "")
    : "";
}

export function Lookup() {
  const { state, branch, t, lang } = useDemo();
  const [search, setSearch] = useState(searchFromLookupHash);
  const [category, setCategory] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const resultsId = useId();
  const searchHintId = useId();
  const products = state.products.filter(
    (product) =>
      product.company_id === state.config.company.seed_key &&
      product.status !== "archived",
  );
  const results = searchProducts(products, search).filter(
    (product) => !category || product.ai_category === category,
  );
  const selected =
    results.find((product) => product.code === selectedCode) ?? results[0];
  const active =
    results.find((product) => product.code === activeCode) ?? selected;
  const categories = [
    ...new Set(products.map((product) => product.ai_category)),
  ].sort();

  useEffect(() => {
    const syncSearch = () => {
      if (window.location.hash.slice(1).split("?")[0] !== "lookup") return;
      setSearch(searchFromLookupHash());
      setCategory("");
      setSelectedCode("");
      setActiveCode("");
      searchRef.current?.focus();
    };
    window.addEventListener("hashchange", syncSearch);
    return () => window.removeEventListener("hashchange", syncSearch);
  }, []);

  const selectProduct = (product: Product) => {
    setSelectedCode(product.code);
    setActiveCode(product.code);
    searchRef.current?.focus();
    searchRef.current?.select();
  };
  const moveActive = (direction: number) => {
    const index = results.findIndex((product) => product.code === active?.code);
    const next = results[(index + direction + results.length) % results.length];
    if (next) setActiveCode(next.code);
    return next;
  };
  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || !results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && active) {
      event.preventDefault();
      selectProduct(active);
    }
  };
  const clearSearch = () => {
    setSearch("");
    setCategory("");
    setSelectedCode("");
    setActiveCode("");
    searchRef.current?.focus();
  };

  return (
    <div className="stack lookup-page">
      <PageHeader
        title={t("Cashier lookup", "جست‌وجوی صندوق‌دار")}
        description={t(
          "Find the approved price to charge now. Search in English or Persian, or scan a barcode.",
          "قیمت تأییدشدهٔ فعلی را پیدا کنید. انگلیسی یا فارسی جست‌وجو کنید یا بارکد را اسکن کنید.",
        )}
      />
      <div className="lookup-hero">
        <label className="sr-only" htmlFor={searchId}>
          {t("Search products", "جست‌وجوی محصولات")}
        </label>
        <div className="lookup-search-pill">
          <Search size={24} strokeWidth={1.5} aria-hidden="true" />
          <input
            id={searchId}
            ref={searchRef}
            className="lookup-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={resultsId}
            aria-expanded={Boolean(results.length)}
            aria-activedescendant={
              active ? `${resultsId}-${active.code}` : undefined
            }
            aria-describedby={searchHintId}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedCode("");
              setActiveCode("");
            }}
            onKeyDown={handleSearchKey}
            placeholder={t(
              "Name, Product Code or barcode",
              "نام، کد محصول یا بارکد",
            )}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button
            type="button"
            className="lookup-scan-button"
            aria-label={t("Scan barcode", "اسکن بارکد")}
            title={t("Scan barcode", "اسکن بارکد")}
            onClick={() => {
              searchRef.current?.focus();
              searchRef.current?.select();
            }}
          >
            <ScanLine size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="lookup-filterbar">
          <Field
            label={t("AI category", "دستهٔ هوش مصنوعی")}
            className="lookup-category"
          >
            <Select
              value={category}
              onChange={(value) => {
                setCategory(value);
                setSelectedCode("");
                setActiveCode("");
              }}
              options={[
                {
                  value: "",
                  label: t("All AI categories", "همهٔ دسته‌های هوش مصنوعی"),
                },
                ...categories.map((value) => ({
                  value,
                  label: categoryLabel(value, lang),
                })),
              ]}
            />
          </Field>
          <p id={searchHintId} className="helper">
            {t(
              "Use ↑ ↓ and Enter to select a product.",
              "برای انتخاب محصول از ↑ ↓ و Enter استفاده کنید.",
            )}
          </p>
          {(search || category) && (
            <Button variant="ghost" onClick={clearSearch}>
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          )}
        </div>
      </div>
      {branch === "all" && (
        <p className="muted">
          {t(
            `Showing the price to charge in ${branchLabel(lookupBranch(branch), "en")}. Choose a branch above to compare.`,
            `قیمت فروش ${branchLabel(lookupBranch(branch), "fa")} نمایش داده می‌شود. برای مقایسه، شعبه را در بالا انتخاب کنید.`,
          )}
        </p>
      )}
      {!selected ? (
        <EmptyState
          action={
            <Button variant="secondary" onClick={clearSearch}>
              {t("Clear search", "پاک کردن جست‌وجو")}
            </Button>
          }
        >
          {t(
            "No products match. Check the name or barcode, or clear the category filter.",
            "محصولی یافت نشد. نام یا بارکد را بررسی کنید یا فیلتر دسته را پاک کنید.",
          )}
        </EmptyState>
      ) : (
        <>
          <LookupProductDetail product={selected} />
          <Card
            title={t("Search results", "نتایج جست‌وجو")}
            className="lookup-results-card"
          >
            <div
              id={resultsId}
              className="lookup-results-list"
              role="listbox"
              aria-label={t("Product results", "نتایج محصولات")}
            >
              {results.map((product) => {
                const price = effectivePrice(state, product, branch);
                const pending = pendingPrice(state, product, branch);
                const offer = effectiveOffer(state, product, branch);
                const taxable = state.config.tax.profiles.find(
                  (item) => item.key === product.tax_profile,
                )?.taxable;
                return (
                  <button
                    key={product.code}
                    id={`${resultsId}-${product.code}`}
                    type="button"
                    role="option"
                    className={`lookup-result-row${product.code === selected.code ? " is-selected" : ""}${product.code === active?.code ? " is-active" : ""}`}
                    aria-selected={product.code === selected.code}
                    onClick={() => selectProduct(product)}
                    onFocus={() => setActiveCode(product.code)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                        return;
                      event.preventDefault();
                      const next = moveActive(
                        event.key === "ArrowDown" ? 1 : -1,
                      );
                      if (next)
                        document
                          .getElementById(`${resultsId}-${next.code}`)
                          ?.focus();
                    }}
                  >
                    <span
                      className="lookup-result-name"
                      dir={lang === "fa" ? "rtl" : "ltr"}
                    >
                      <strong lang={lang}>
                        <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                          {lang === "fa" ? product.name_fa : product.name_en}
                        </bdi>
                      </strong>
                      <span className="lookup-result-secondary muted">
                        <bdi
                          className="lookup-secondary-name"
                          lang={lang === "fa" ? "en" : "fa"}
                          dir={lang === "fa" ? "ltr" : "rtl"}
                        >
                          {lang === "fa" ? product.name_en : product.name_fa}
                        </bdi>
                        <span className="lookup-result-meta">
                          {t(state.config.terminology.product_code, "کد محصول")}{" "}
                          <LtrText>{product.code}</LtrText>
                        </span>
                      </span>
                    </span>
                    <span className="lookup-result-price">
                      {price ? (
                        <Money value={price} />
                      ) : (
                        <span className="muted">
                          {t(
                            "No approved price yet",
                            "هنوز قیمت تأییدشده‌ای وجود ندارد",
                          )}
                        </span>
                      )}
                      <span className="lookup-result-pills actions">
                        {pending && (
                          <Badge tone="pending">
                            {t("Pending", "در انتظار تأیید")}
                          </Badge>
                        )}
                        {taxable && (
                          <Badge tone="info">
                            {t(
                              state.config.tax.label_text_en,
                              state.config.tax.label_text_fa,
                            )}
                          </Badge>
                        )}
                        {offer && (
                          <Badge tone="info" className="offer-pill">
                            <OfferLabel label={offer.label} language={lang} />
                          </Badge>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

type SortColumn = "name" | "code" | "price";

export function Products() {
  const { state, role, branch, t, lang } = useDemo();
  const [search, setSearch] = useState("");
  const [pricingCategory, setPricingCategory] = useState("");
  const [aiCategory, setAiCategory] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [sort, setSort] = useState<SortColumn>("name");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);
  if (role === "cashier") return <Lookup />;
  const products = state.products.filter(
    (product) => product.company_id === state.config.company.seed_key,
  );
  const results = searchProducts(products, search)
    .filter(
      (product) =>
        (!pricingCategory || product.pricing_category === pricingCategory) &&
        (!aiCategory || product.ai_category === aiCategory) &&
        (!status || product.status === status) &&
        (!supplier || product.main_supplier === supplier) &&
        (!onlyPending || pendingPrice(state, product, branch)) &&
        (!onlyOffers || effectiveOffer(state, product, branch)),
    )
    .sort((left, right) => {
      let comparison = 0;
      if (sort === "name")
        comparison = (
          lang === "fa" ? left.name_fa : left.name_en
        ).localeCompare(lang === "fa" ? right.name_fa : right.name_en, lang);
      if (sort === "code")
        comparison = left.code.localeCompare(right.code, "en");
      if (sort === "price") {
        const leftPrice = effectivePrice(state, left, branch);
        const rightPrice = effectivePrice(state, right, branch);
        comparison =
          leftPrice && rightPrice
            ? new Decimal(leftPrice).comparedTo(rightPrice)
            : leftPrice
              ? -1
              : rightPrice
                ? 1
                : 0;
      }
      return ascending ? comparison : -comparison;
    });
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageResults = results.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const selected = products.find((product) => product.code === selectedCode);
  const sortBy = (column: SortColumn) => {
    setSort(column);
    setAscending(column === sort ? !ascending : true);
  };
  const clear = () => {
    setSearch("");
    setPricingCategory("");
    setAiCategory("");
    setStatus("");
    setSupplier("");
    setOnlyPending(false);
    setOnlyOffers(false);
    setPage(0);
  };
  return (
    <div className="stack">
      <PageHeader
        title={t("Products", "محصولات")}
        description={t(
          "Approved prices, pending changes and branch details in one catalog.",
          "قیمت‌های تأییدشده، تغییرات در انتظار تأیید و جزئیات شعبه در یک فهرست.",
        )}
      />
      {branch === "all" && (
        <p className="muted">
          {t(
            `Prices and offers below preview ${branchLabel(lookupBranch(branch), "en")}. Open product details to compare branch prices, or choose one branch above.`,
            `قیمت‌ها و پیشنهادهای زیر مربوط به ${branchLabel(lookupBranch(branch), "fa")} هستند. برای مقایسهٔ قیمت شعبه‌ها، جزئیات محصول را باز کنید یا یک شعبه را در بالا انتخاب کنید.`,
          )}
        </p>
      )}
      <Card>
        <div className="stack">
          <div className="catalog-filter-toolbar">
            <Field label={t("Search products", "جست‌وجوی محصولات")}>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder={t(
                  "Name, Product Code or barcode",
                  "نام، کد محصول یا بارکد",
                )}
              />
            </Field>
            <Field label={t("Pricing category", "دستهٔ قیمت‌گذاری")}>
              <Select
                value={pricingCategory}
                onChange={(value) => {
                  setPricingCategory(value);
                  setPage(0);
                }}
                options={[
                  {
                    value: "",
                    label: t(
                      "All pricing categories",
                      "همهٔ دسته‌های قیمت‌گذاری",
                    ),
                  },
                  ...state.config.pricing_categories.map((item) => ({
                    value: item.key,
                    label: categoryLabel(item.label, lang),
                  })),
                ]}
              />
            </Field>
            <Field label={t("AI category", "دستهٔ هوش مصنوعی")}>
              <Select
                value={aiCategory}
                onChange={(value) => {
                  setAiCategory(value);
                  setPage(0);
                }}
                options={[
                  {
                    value: "",
                    label: t("All AI categories", "همهٔ دسته‌های هوش مصنوعی"),
                  },
                  ...[
                    ...new Set(products.map((product) => product.ai_category)),
                  ]
                    .sort()
                    .map((value) => ({
                      value,
                      label: categoryLabel(value, lang),
                    })),
                ]}
              />
            </Field>
            <Field label={t("Status", "وضعیت")}>
              <Select
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPage(0);
                }}
                options={[
                  { value: "", label: t("All statuses", "همهٔ وضعیت‌ها") },
                  { value: "active", label: t("Approved", "تأییدشده") },
                  {
                    value: "pending_approval",
                    label: t("Pending", "در انتظار تأیید"),
                  },
                  { value: "archived", label: t("Archived", "بایگانی‌شده") },
                ]}
              />
            </Field>
            <Field label={t("Supplier", "تأمین‌کننده")}>
              <Select
                value={supplier}
                onChange={(value) => {
                  setSupplier(value);
                  setPage(0);
                }}
                options={[
                  {
                    value: "",
                    label: t("All suppliers", "همهٔ تأمین‌کنندگان"),
                  },
                  ...[
                    ...new Set(
                      products.map((product) => product.main_supplier),
                    ),
                  ]
                    .sort()
                    .map((value) => ({
                      value,
                      label: value,
                    })),
                ]}
              />
            </Field>
          </div>
          <div className="actions">
            <Checkbox
              checked={onlyPending}
              onChange={(value) => {
                setOnlyPending(value);
                setPage(0);
              }}
              aria-label={t("Has pending price", "دارای قیمت در انتظار تأیید")}
            >
              {t("Has pending price", "دارای قیمت در انتظار تأیید")}
            </Checkbox>
            <Checkbox
              checked={onlyOffers}
              onChange={(value) => {
                setOnlyOffers(value);
                setPage(0);
              }}
              aria-label={t("Has offer", "دارای پیشنهاد")}
            >
              {t("Has offer", "دارای پیشنهاد")}
            </Checkbox>
            <Button variant="ghost" onClick={clear}>
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          </div>
        </div>
      </Card>
      {!results.length ? (
        <EmptyState
          action={
            <Button variant="secondary" onClick={clear}>
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          }
        >
          {t(
            "No products match these filters. Clear a filter or check the search text.",
            "محصولی با این فیلترها یافت نشد. فیلتر را پاک کنید یا متن جست‌وجو را بررسی کنید.",
          )}
        </EmptyState>
      ) : (
        <Card>
          <div className="stack">
            <DataTable>
              <thead>
                <tr>
                  <th
                    aria-sort={
                      sort === "name"
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button variant="ghost" onClick={() => sortBy("name")}>
                      {t("Product", "محصول")}
                      {sort === "name" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={
                      sort === "code"
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button variant="ghost" onClick={() => sortBy("code")}>
                      {t("Product Code", "کد محصول")}
                      {sort === "code" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={
                      sort === "price"
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button variant="ghost" onClick={() => sortBy("price")}>
                      {t("Approved price", "قیمت تأییدشده")}
                      {sort === "price" ? (ascending ? " ↑" : " ↓") : ""}
                    </Button>
                  </th>
                  <th>{t("Status and offer", "وضعیت و پیشنهاد")}</th>
                  <th>{t("Details", "جزئیات")}</th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map((product) => {
                  const price = effectivePrice(state, product, branch);
                  const pending = pendingPrice(state, product, branch);
                  const offer = effectiveOffer(state, product, branch);
                  return (
                    <tr key={product.code}>
                      <td>
                        <strong className="catalog-product-name">
                          <bdi dir={lang === "fa" ? "rtl" : "ltr"}>
                            {lang === "fa" ? product.name_fa : product.name_en}
                          </bdi>
                        </strong>
                        <p className="muted catalog-product-secondary">
                          <bdi dir={lang === "fa" ? "ltr" : "rtl"}>
                            {lang === "fa" ? product.name_en : product.name_fa}
                          </bdi>
                        </p>
                        <p className="muted">
                          <UnitSize value={product.unit_size} />
                        </p>
                      </td>
                      <td className="numeric">
                        <LtrText>{product.code}</LtrText>
                      </td>
                      <td className="numeric">
                        {price ? <Money value={price} /> : "—"}
                      </td>
                      <td>
                        <div className="actions">
                          {pending && (
                            <Badge tone="pending">
                              {t("Pending", "در انتظار تأیید")}{" "}
                              <Money value={pending} />
                            </Badge>
                          )}
                          {!pending && (
                            <Badge
                              tone={
                                product.status === "archived"
                                  ? "neutral"
                                  : "approved"
                              }
                            >
                              {product.status === "archived"
                                ? t("Archived", "بایگانی‌شده")
                                : t("Approved", "تأییدشده")}
                            </Badge>
                          )}
                          {offer && (
                            <Badge tone="info" className="offer-pill">
                              <OfferLabel label={offer.label} language={lang} />
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedCode(product.code)}
                          aria-label={t(
                            `View ${product.name_en}`,
                            `نمایش ${product.name_fa}`,
                          )}
                        >
                          {t("View", "نمایش")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            <div className="actions">
              <Button
                variant="secondary"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("Previous", "قبلی")}
              </Button>
              <span>
                {t(
                  `Page ${currentPage + 1} of ${pageCount} · ${results.length} products`,
                  `صفحهٔ ${currentPage + 1} از ${pageCount} · ${results.length} محصول`,
                )}
              </span>
              <Button
                variant="secondary"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("Next", "بعدی")}
              </Button>
            </div>
          </div>
        </Card>
      )}
      {selected && <ProductDetail product={selected} operational />}
    </div>
  );
}
