import { useState } from "react";
import Decimal from "decimal.js";
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
  DataTable,
  EmptyState,
  Field,
  PageHeader,
} from "../ui";

const PAGE_SIZE = 8;

function ProductPrice({ product }: { product: Product }) {
  const { state, branch, t, money } = useDemo();
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
            {approved ? money(approved) : pending ? money(pending) : "—"}
          </strong>
          {profile?.taxable && (
            <Badge tone="info">
              {t(
                state.config.tax.label_text_en,
                state.config.tax.label_text_fa,
              )}
            </Badge>
          )}
          {offer && <Badge tone="approved">{offer.label}</Badge>}
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
              <strong dir="ltr">{money(pending)}</strong>.{" "}
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
  const { state, branch, role, lang, t, money } = useDemo();
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
    <Card title={lang === "fa" ? product.name_fa : product.name_en}>
      <div className="stack">
        <p
          lang={lang === "fa" ? "en" : "fa"}
          dir={lang === "fa" ? "ltr" : "rtl"}
        >
          {lang === "fa" ? product.name_en : product.name_fa}
        </p>
        <div className="actions">
          <span dir="ltr">{product.unit_size}</span>
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
            <dd dir="ltr">{product.code}</dd>
          </div>
          <div>
            <dt className="muted">{t("Barcode", "بارکد")}</dt>
            <dd dir="ltr">{product.barcode || t("Not added", "اضافه نشده")}</dd>
          </div>
          <div>
            <dt className="muted">{t("AI category", "دستهٔ هوش مصنوعی")}</dt>
            <dd>{product.ai_category}</dd>
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
                <dd>{category?.label || product.pricing_category}</dd>
              </div>
              <div>
                <dt className="muted">{t("Supplier", "تأمین‌کننده")}</dt>
                <dd>{product.main_supplier}</dd>
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
                      <th>{t("Approved price", "قیمت تأییدشده")}</th>
                      <th>{t("Price scope", "محدودهٔ قیمت")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((item) => {
                      const price = effectivePrice(state, product, item);
                      return (
                        <tr key={item}>
                          <td>{item}</td>
                          <td dir="ltr">{price ? money(price) : "—"}</td>
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
                  <strong dir="ltr">
                    {money(product.last_cost_before_tax)}
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
                    <dt className="muted">{item}</dt>
                    <dd dir="ltr">
                      {state.stock[`${item}:${product.code}`] ?? 0}
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
                        {item.action} · {item.by}
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

export function Lookup() {
  const { state, branch, t, money, lang } = useDemo();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
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
  const categories = [
    ...new Set(products.map((product) => product.ai_category)),
  ].sort();
  return (
    <div className="stack">
      <PageHeader
        title={t("Cashier lookup", "جست‌وجوی صندوق‌دار")}
        description={t(
          "Find the approved price to charge now. Search in English or Persian, or scan a barcode.",
          "قیمت تأییدشدهٔ فعلی را پیدا کنید. انگلیسی یا فارسی جست‌وجو کنید یا بارکد را اسکن کنید.",
        )}
      />
      <Card>
        <div className="stack">
          <Field label={t("Search products", "جست‌وجوی محصولات")}>
            <input
              className="lookup-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedCode("");
              }}
              placeholder={t(
                "Name, Product Code or barcode",
                "نام، کد محصول یا بارکد",
              )}
              autoComplete="off"
            />
          </Field>
          <Field label={t("AI category", "دستهٔ هوش مصنوعی")}>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setSelectedCode("");
              }}
            >
              <option value="">
                {t("All AI categories", "همهٔ دسته‌های هوش مصنوعی")}
              </option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
      {branch === "all" && (
        <p className="muted">
          {t(
            `Showing the price to charge in ${lookupBranch(branch)}. Choose a branch above to compare.`,
            `قیمت فروش ${lookupBranch(branch)} نمایش داده می‌شود. برای مقایسه، شعبه را در بالا انتخاب کنید.`,
          )}
        </p>
      )}
      {!selected ? (
        <EmptyState
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setCategory("");
              }}
            >
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
        <div className="grid-2">
          <Card title={t("Search results", "نتایج جست‌وجو")}>
            <div
              className="stack"
              aria-label={t("Product results", "نتایج محصولات")}
            >
              {results.map((product) => {
                const price = effectivePrice(state, product, branch);
                return (
                  <Button
                    key={product.code}
                    variant={
                      product.code === selected.code ? "secondary" : "ghost"
                    }
                    onClick={() => setSelectedCode(product.code)}
                    aria-pressed={product.code === selected.code}
                  >
                    <span>
                      {lang === "fa" ? product.name_fa : product.name_en}
                    </span>
                    {" · "}
                    <span dir="ltr">
                      {price ? money(price) : t("Pending", "در انتظار تأیید")}
                    </span>
                  </Button>
                );
              })}
            </div>
          </Card>
          <ProductDetail product={selected} />
        </div>
      )}
    </div>
  );
}

type SortColumn = "name" | "code" | "price";

export function Products() {
  const { state, role, branch, t, money, lang } = useDemo();
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
            `Prices and offers below preview ${lookupBranch(branch)}. Open product details to compare branch prices, or choose one branch above.`,
            `قیمت‌ها و پیشنهادهای زیر مربوط به ${lookupBranch(branch)} هستند. برای مقایسهٔ قیمت شعبه‌ها، جزئیات محصول را باز کنید یا یک شعبه را در بالا انتخاب کنید.`,
          )}
        </p>
      )}
      <Card>
        <div className="stack">
          <div className="form-grid">
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
              <select
                value={pricingCategory}
                onChange={(event) => {
                  setPricingCategory(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">
                  {t("All pricing categories", "همهٔ دسته‌های قیمت‌گذاری")}
                </option>
                {state.config.pricing_categories.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("AI category", "دستهٔ هوش مصنوعی")}>
              <select
                value={aiCategory}
                onChange={(event) => {
                  setAiCategory(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">
                  {t("All AI categories", "همهٔ دسته‌های هوش مصنوعی")}
                </option>
                {[...new Set(products.map((product) => product.ai_category))]
                  .sort()
                  .map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("Status", "وضعیت")}>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">{t("All statuses", "همهٔ وضعیت‌ها")}</option>
                <option value="active">{t("Approved", "تأییدشده")}</option>
                <option value="pending_approval">
                  {t("Pending", "در انتظار تأیید")}
                </option>
                <option value="archived">{t("Archived", "بایگانی‌شده")}</option>
              </select>
            </Field>
            <Field label={t("Supplier", "تأمین‌کننده")}>
              <select
                value={supplier}
                onChange={(event) => {
                  setSupplier(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">
                  {t("All suppliers", "همهٔ تأمین‌کنندگان")}
                </option>
                {[...new Set(products.map((product) => product.main_supplier))]
                  .sort()
                  .map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="actions">
            <label>
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(event) => {
                  setOnlyPending(event.target.checked);
                  setPage(0);
                }}
              />{" "}
              {t("Has pending price", "دارای قیمت در انتظار تأیید")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={onlyOffers}
                onChange={(event) => {
                  setOnlyOffers(event.target.checked);
                  setPage(0);
                }}
              />{" "}
              {t("Has offer", "دارای پیشنهاد")}
            </label>
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
                        <span>
                          {lang === "fa" ? product.name_fa : product.name_en}
                        </span>
                        <p className="muted">{product.unit_size}</p>
                      </td>
                      <td dir="ltr">{product.code}</td>
                      <td dir="ltr">{price ? money(price) : "—"}</td>
                      <td>
                        <div className="actions">
                          {pending && (
                            <Badge tone="pending">
                              {t("Pending", "در انتظار تأیید")}{" "}
                              <span dir="ltr">{money(pending)}</span>
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
                            <Badge tone="approved">{offer.label}</Badge>
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
