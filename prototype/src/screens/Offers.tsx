import {
  branchLabel as configuredBranchLabel,
  branchSellsToCustomers,
  sellingBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  activateOffer,
  businessDate,
  effectivePool,
  offerMapping,
  offerReadiness,
  stopOffer,
} from "../approvals";
import { effectivePrice, isOfferScheduledNow, lookupBranch } from "../catalog";
import { useDemo } from "../store";
import { ManualPricePill } from "../manual-price-presentation";
import {
  categoryLabel,
  DateText,
  formatOffer,
  LtrText,
  Money,
  OfferLabel,
  ProductName,
} from "../presentation";
import type { Branch, Offer } from "../types";
import {
  currentOfferGroups,
  isPastOffer,
  pastOffers,
  scopedOffers,
} from "../offer-list";
import "./filters-a2.css";
import "./c3-labels-notes-offers.css";
import "./c5-catalog-offers.css";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  FilterToolbar,
  PageHeader,
  Checkbox,
  DateField,
  Select,
  Tabs,
  Menu,
  MenuItem,
} from "../ui";

export function Offers() {
  const { state, update, role, branch, setBranch, lang, t } = useDemo();
  const branches = sellingBranches(state.config);
  const [tab, setTab] = useState<"offers" | "past" | "pools">("offers");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [type, setType] = useState("");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState<"all" | "branch">("branch");
  const [mix, setMix] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [taskOptions, setTaskOptions] = useState<
    Record<string, { mix: boolean; start: string; end: string }>
  >({});
  const [message, setMessage] = useState("");
  const [stopId, setStopId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const company = state.config.company.seed_key;
  const viewBranch =
    branch === "all" ? (branches[0] ?? lookupBranch(branch)) : branch;
  const locationCanSell =
    branch === "all"
      ? branches.length > 0
      : branchSellsToCustomers(state.config, branch);
  const products = state.products.filter(
    (product) => product.company_id === company && product.status === "active",
  );
  const ownOffers = scopedOffers(state, branch);
  const needle = search.trim().toLocaleLowerCase();
  const filteredOffers = ownOffers.filter((offer) => {
    const product = state.products.find(
      (item) => item.company_id === company && item.code === offer.product_code,
    );
    const visibleStatus =
      offer.status === "active" &&
      !isOfferScheduledNow(offer, state.config.company.timezone)
        ? isPastOffer(offer, state.config.company.timezone)
          ? "expired"
          : "scheduled"
        : offer.status;
    return (
      (!needle ||
        [
          product?.name_en,
          product?.name_fa,
          offer.product_code,
          offer.label,
        ].some((value) => value?.toLocaleLowerCase().includes(needle))) &&
      (!status || visibleStatus === status) &&
      (!category || product?.ai_category === category) &&
      (!supplier || product?.main_supplier === supplier) &&
      (!type || offer.label === type)
    );
  });
  const suggestions = filteredOffers.filter(
    (offer) => offer.status === "suggested",
  );
  const rows =
    tab === "past"
      ? pastOffers(filteredOffers, state.config.company.timezone).map(
          (offer) => [offer],
        )
      : currentOfferGroups(filteredOffers, state.config.company.timezone);
  const categories = [
    ...new Set(products.map((product) => product.ai_category)),
  ].sort();
  const suppliers = [
    ...new Set(products.map((product) => product.main_supplier)),
  ].sort();
  const offerTypes = [
    ...new Set([
      ...state.config.promotions.price_to_offer.map((mapping) => mapping.offer),
      ...ownOffers.map((offer) => offer.label),
    ]),
  ];
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCategory("");
    setSupplier("");
    setType("");
    if (role === "supervisor") setBranch("all");
  };
  if (role === "cashier")
    return (
      <EmptyState>
        {t(
          "Switch to Floor Worker or Supervisor to manage offers.",
          "برای مدیریت پیشنهادها به کارکنان فروشگاه یا سرپرست تغییر دهید.",
        )}
      </EmptyState>
    );
  const offerLabel = (label: string) => (
    <OfferLabel
      label={label}
      language={lang}
      currency={state.config.company.currency}
    />
  );
  const branchName = (value: Branch) =>
    configuredBranchLabel(state.config, value, lang);
  const readyMessage = (reason: ReturnType<typeof offerReadiness>) =>
    ({
      ready: t(
        "Ready to confirm. Only the matching approved price can use this offer.",
        "آماده تأیید. فقط قیمت تأییدشده سازگار می‌تواند از این پیشنهاد استفاده کند.",
      ),
      price_changed: t(
        "The approved price changed. Refresh this suggestion before confirming.",
        "قیمت تأییدشده تغییر کرده است. پیش از تأیید، پیشنهاد را تازه‌سازی کنید.",
      ),
      mapping_missing: t(
        "No matching offer is configured for this price. Check Settings.",
        "برای این قیمت پیشنهاد سازگار تنظیم نشده است. تنظیمات را بررسی کنید.",
      ),
      dates_invalid: t(
        "Use valid dates and put the end date on or after the start date.",
        "تاریخ‌های معتبر وارد کنید و پایان را برابر یا پس از شروع قرار دهید.",
      ),
      company_mismatch: t(
        "Choose an active product in this company.",
        "یک کالای فعال از همین شرکت انتخاب کنید.",
      ),
      location_not_selling: t(
        "Choose a location that sells to customers.",
        "مکانی را انتخاب کنید که به مشتریان فروش دارد.",
      ),
    })[reason];
  const activate = (offer: Offer) => {
    const readiness = offerReadiness(state, offer);
    if (readiness !== "ready") {
      setMessage(readyMessage(readiness));
      return;
    }
    const activation = { result: "created" as "created" | "unchanged" };
    update((draft) => {
      activation.result = activateOffer(draft, offer, role ?? "floor_worker");
    });
    setCreateOpen(false);
    if (activation.result === "unchanged") {
      setMessage(
        t("This offer already exists.", "این پیشنهاد از قبل وجود دارد."),
      );
      return;
    }
    const manual = offer.status !== "suggested";
    setMessage(
      isOfferScheduledNow(offer, state.config.company.timezone)
        ? manual
          ? t(
              "Created offer. Cashier lookup and labels now use the effective offer.",
              "پیشنهاد ایجاد شد. جستجوی صندوق‌دار و برچسب‌ها اکنون پیشنهاد مؤثر را نمایش می‌دهند.",
            )
          : t(
              "Confirmed offer. Cashier lookup and labels now use the effective offer.",
              "پیشنهاد تأیید شد. جستجوی صندوق‌دار و برچسب‌ها اکنون پیشنهاد مؤثر را نمایش می‌دهند.",
            )
        : manual
          ? t(
              "Created offer with dates. It appears only during its scheduled dates.",
              "پیشنهاد با تاریخ ایجاد شد. فقط در تاریخ‌های برنامه‌ریزی‌شده نمایش داده می‌شود.",
            )
          : t(
              "Confirmed offer with dates. It appears only during its scheduled dates.",
              "پیشنهاد با تاریخ تأیید شد. فقط در تاریخ‌های برنامه‌ریزی‌شده نمایش داده می‌شود.",
            ),
    );
  };
  const stop = (id: string, dismissed = false) => {
    update((draft) => stopOffer(draft, id, dismissed, role ?? "floor_worker"));
    setStopId(null);
    setMessage(
      dismissed
        ? t("Dismissed offer suggestion.", "پیشنهاد پیشنهادی کنار گذاشته شد.")
        : t("Stopped offer.", "پیشنهاد متوقف شد."),
    );
  };
  const selected = products.find((product) => product.code === code);
  const manualPrice = selected
    ? scope === "all"
      ? selected.selling_price
      : effectivePrice(state, selected, viewBranch)
    : null;
  const mapping = offerMapping(state, manualPrice);
  const candidate: Offer | null =
    selected && mapping && manualPrice
      ? {
          id: `manual-offer:${company}:${state.offers.length}`,
          company_id: company,
          product_code: code,
          branch: scope === "all" ? "all" : viewBranch,
          scope,
          label: mapping.offer,
          pool: mapping.mix_and_match_pool,
          currency: state.config.company.currency,
          price: manualPrice,
          mix_and_match: mix,
          status: "active",
          start_date: start || undefined,
          end_date: end || undefined,
        }
      : null;
  const dateError =
    candidate && offerReadiness(state, candidate) === "dates_invalid"
      ? readyMessage("dates_invalid")
      : undefined;
  if (!locationCanSell)
    return (
      <>
        <PageHeader title={t("Offers", "پیشنهادهای فروش")} />
        <EmptyState>{readyMessage("location_not_selling")}</EmptyState>
      </>
    );
  return (
    <>
      <PageHeader
        title={t("Offers", "پیشنهادهای فروش")}
        description={t(
          "Confirm suggestions or create offers. The approved price chooses the offer definition.",
          "پیشنهادها را تأیید یا ایجاد کنید. قیمت تأییدشده نوع پیشنهاد را تعیین می‌کند.",
        )}
        actions={
          <Button
            onClick={() => {
              setCreateOpen(true);
              setMessage("");
            }}
          >
            {t("Create offer", "ایجاد پیشنهاد")}
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value as "offers" | "past" | "pools");
          setStatus("");
        }}
        aria-label={t("Offers", "پیشنهادهای فروش")}
        options={[
          { value: "offers", label: t("Current offers", "پیشنهادهای فعلی") },
          { value: "past", label: t("Past offers", "پیشنهادهای قبلی") },
          {
            value: "pools",
            label: t("Mix-and-match pools", "گروه‌های ترکیبی"),
          },
        ]}
      />
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {tab !== "pools" ? (
        <>
          <FilterToolbar
            className="offers-filters"
            aria-label={t("Offer filters", "فیلترهای پیشنهادها")}
            search={
              <input
                className="ui-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label={t("Search offers", "جستجوی پیشنهادها")}
                placeholder={t("Search offers", "جستجوی پیشنهادها")}
              />
            }
            count={translateCount(
              "{{count}} offer",
              "{{count}} offers",
              "{{count}} پیشنهاد",
              "{{count}} پیشنهاد",
              rows.length + (tab === "offers" ? suggestions.length : 0),
              lang,
            )}
          >
            <Select
              aria-label={t("Offer status", "وضعیت پیشنهاد")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: t("All statuses", "همه وضعیت‌ها") },
                ...(tab === "past"
                  ? [
                      { value: "stopped", label: t("Stopped", "متوقف‌شده") },
                      { value: "expired", label: t("Expired", "منقضی‌شده") },
                    ]
                  : [
                      { value: "suggested", label: t("Pending", "در انتظار") },
                      { value: "active", label: t("Active", "فعال") },
                      {
                        value: "scheduled",
                        label: t("Scheduled", "زمان‌بندی‌شده"),
                      },
                    ]),
              ]}
            />
            <Select
              aria-label={t("Offer category", "دسته پیشنهاد")}
              value={category}
              onChange={setCategory}
              options={[
                { value: "", label: t("All categories", "همه دسته‌ها") },
                ...categories.map((value) => ({
                  value,
                  label: categoryLabel(value, lang),
                })),
              ]}
            />
            <Select
              aria-label={t("Offer supplier", "تأمین‌کننده پیشنهاد")}
              value={supplier}
              onChange={setSupplier}
              options={[
                { value: "", label: t("All suppliers", "همه تأمین‌کنندگان") },
                ...suppliers.map((value) => ({
                  value,
                  label: value,
                })),
              ]}
            />
            <Select
              aria-label={t("Offer branch", "شعبه پیشنهاد")}
              value={branch}
              onChange={(value) => setBranch(value as Branch)}
              disabled={role !== "supervisor"}
              options={
                role === "supervisor"
                  ? [
                      { value: "all", label: t("All branches", "همه شعبه‌ها") },
                      ...branches.map((value) => ({
                        value,
                        label: branchName(value),
                      })),
                    ]
                  : [{ value: branch, label: branchName(branch) }]
              }
            />
            <Select
              aria-label={t("Offer type", "نوع پیشنهاد")}
              value={type}
              onChange={setType}
              options={[
                { value: "", label: t("All offer types", "همه انواع پیشنهاد") },
                ...offerTypes.map((value) => ({
                  value,
                  label: formatOffer(
                    value,
                    lang,
                    state.config.company.currency,
                  ),
                })),
              ]}
            />
            <Button variant="ghost" onClick={clearFilters}>
              {t("Clear filters", "پاک کردن فیلترها")}
            </Button>
          </FilterToolbar>
          {tab === "offers" && (
            <Card title={t("Offer suggestions", "پیشنهادهای پیشنهادی")}>
              <p className="muted">
                {t(
                  "Confirm an offer before it starts.",
                  "پیش از شروع، پیشنهاد را تأیید کنید.",
                )}
              </p>
              {suggestions.length === 0 ? (
                <EmptyState>
                  {state.config.promotions.ai_suggestions_enabled === false
                    ? t(
                        "Offer suggestions are turned off in Settings.",
                        "پیشنهادهای خودکار فروش در تنظیمات غیرفعال هستند.",
                      )
                    : t(
                        "No suggestions waiting. Approve a mapped price to create one.",
                        "پیشنهادی منتظر نیست. یک قیمت دارای نگاشت را تأیید کنید تا پیشنهاد ایجاد شود.",
                      )}
                </EmptyState>
              ) : (
                suggestions.map((offer) => {
                  const product = products.find(
                    (item) => item.code === offer.product_code,
                  );
                  const options = taskOptions[offer.id] ?? {
                    mix: offer.mix_and_match,
                    start: offer.start_date ?? "",
                    end: offer.end_date ?? "",
                  };
                  const task: Offer = {
                    ...offer,
                    mix_and_match: options.mix,
                    start_date: options.start || undefined,
                    end_date: options.end || undefined,
                  };
                  const readiness = offerReadiness(state, task);
                  const change = (values: Partial<typeof options>) =>
                    setTaskOptions({
                      ...taskOptions,
                      [offer.id]: { ...options, ...values },
                    });
                  return (
                    <section className="offer-task" key={offer.id}>
                      <div className="row">
                        <h3>
                          {product ? (
                            <ProductName product={product} language={lang} />
                          ) : (
                            <LtrText>{offer.product_code}</LtrText>
                          )}
                        </h3>
                        <Badge tone="pending">
                          {t("Pending", "در انتظار")}
                        </Badge>
                        <span className="branch-label">
                          {branchName(offer.branch)}
                        </span>
                      </div>
                      <p>
                        <strong>
                          {t("Confirm offer", "تأیید پیشنهاد")}:{" "}
                          {offerLabel(offer.label)}
                        </strong>{" "}
                        · {t("Approved price", "قیمت تأییدشده")}:{" "}
                        <Money
                          value={offer.price}
                          currency={state.config.company.currency}
                        />
                        {product && (
                          <ManualPricePill
                            product={product}
                            branch={offer.branch}
                            companyDefault={offer.scope === "all"}
                          />
                        )}
                      </p>
                      <Checkbox
                        checked={options.mix}
                        onChange={(value) => change({ mix: value })}
                      >
                        {t(
                          "Join the mix-and-match pool",
                          "عضویت در گروه ترکیبی",
                        )}
                      </Checkbox>
                      <div className="grid-2">
                        <Field
                          label={t(
                            "Start date (optional)",
                            "تاریخ شروع (اختیاری)",
                          )}
                        >
                          <DateField
                            value={options.start}
                            onChange={(value) => change({ start: value })}
                          />
                        </Field>
                        <Field
                          label={t(
                            "End date (optional)",
                            "تاریخ پایان (اختیاری)",
                          )}
                        >
                          <DateField
                            value={options.end}
                            onChange={(value) => change({ end: value })}
                          />
                        </Field>
                      </div>
                      <p className="muted">{readyMessage(readiness)}</p>
                      <div className="actions">
                        <Button
                          variant="secondary"
                          disabled={readiness !== "ready"}
                          onClick={() => activate(task)}
                        >
                          {t("Confirm offer", "تأیید پیشنهاد")}:{" "}
                          {offerLabel(offer.label)}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => stop(offer.id, true)}
                        >
                          {t("Dismiss", "کنار گذاشتن")}
                        </Button>
                      </div>
                    </section>
                  );
                })
              )}
            </Card>
          )}
          <Card
            title={
              tab === "past"
                ? t("Past offers", "پیشنهادهای قبلی")
                : t("Current offers", "پیشنهادهای فعلی")
            }
          >
            {rows.length === 0 ? (
              <EmptyState>
                {t(
                  "No offers match these filters. Clear filters or create an offer.",
                  "هیچ پیشنهادی با این فیلترها مطابقت ندارد. فیلترها را پاک کنید یا پیشنهاد ایجاد کنید.",
                )}
              </EmptyState>
            ) : (
              <DataTable
                className={`current-offers-table${tab === "past" ? " past-offers-table" : ""}`}
                columns={[
                  {},
                  { width: 140 },
                  { width: 140 },
                  { width: 220 },
                  ...(tab === "offers" ? [{ width: 124, actions: true }] : []),
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Product", "کالا")}</th>
                    <th>{t("Offer", "پیشنهاد")}</th>
                    <th>{t("Scope", "دامنه")}</th>
                    <th>{t("Status", "وضعیت")}</th>
                    {tab === "offers" && <th>{t("Action", "اقدام")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((group) => {
                    const first = group[0];
                    const product = state.products.find(
                      (item) =>
                        item.company_id === company &&
                        item.code === first.product_code,
                    );
                    return (
                      <tr
                        key={tab === "past" ? first.id : first.product_code}
                        data-product-code={first.product_code}
                      >
                        <td>
                          {product ? (
                            <ProductName product={product} language={lang} />
                          ) : (
                            <LtrText>{first.product_code}</LtrText>
                          )}
                        </td>
                        <td>
                          {group.map((offer) => (
                            <div className="offer-group-entry" key={offer.id}>
                              {offerLabel(offer.label)}
                              <span className="muted offer-entry-price">
                                <Money
                                  value={offer.price}
                                  currency={state.config.company.currency}
                                />
                                {product && (
                                  <ManualPricePill
                                    product={product}
                                    branch={offer.branch}
                                    companyDefault={offer.scope === "all"}
                                  />
                                )}
                              </span>
                              {offer.mix_and_match && (
                                <>
                                  <br />
                                  <span className="muted">
                                    {t("Mix-and-match", "ترکیبی")}
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="branch-label offer-scope">
                          {group.map((offer) => (
                            <div className="offer-group-entry" key={offer.id}>
                              {branchName(offer.branch)}
                            </div>
                          ))}
                        </td>
                        <td>
                          {group.map((offer) => {
                            const scheduled = isOfferScheduledNow(
                              offer,
                              state.config.company.timezone,
                            );
                            const expired = Boolean(
                              offer.end_date &&
                              offer.end_date <
                                businessDate(state.config.company.timezone),
                            );
                            return (
                              <div className="offer-group-entry" key={offer.id}>
                                <Badge
                                  tone={
                                    offer.status === "stopped"
                                      ? "neutral"
                                      : expired
                                        ? "danger"
                                        : scheduled
                                          ? "approved"
                                          : "info"
                                  }
                                >
                                  {offer.status === "stopped"
                                    ? t("Stopped", "متوقف‌شده")
                                    : expired
                                      ? t("Expired", "منقضی‌شده")
                                      : scheduled
                                        ? t("Active", "فعال")
                                        : t("Scheduled", "زمان‌بندی‌شده")}
                                </Badge>
                                {offer.start_date && (
                                  <p className="muted">
                                    {t("Starts", "شروع")}:{" "}
                                    <DateText value={offer.start_date} />
                                  </p>
                                )}
                                {offer.end_date && (
                                  <p className="muted">
                                    {t("Ends", "پایان")}:{" "}
                                    <DateText value={offer.end_date} />
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </td>
                        {tab === "offers" && (
                          <td>
                            {group.length === 1 ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setStopId(first.id)}
                              >
                                {t("Stop offer", "توقف پیشنهاد")}
                              </Button>
                            ) : (
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
                                {group.map((offer) => (
                                  <MenuItem
                                    key={offer.id}
                                    onClick={() => setStopId(offer.id)}
                                  >
                                    {t("Stop offer", "توقف پیشنهاد")} ·{" "}
                                    {branchName(offer.branch)}
                                  </MenuItem>
                                ))}
                              </Menu>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card title={t("Mix-and-match pools", "گروه‌های ترکیبی")}>
            <p>
              {t("Showing effective offers for", "نمایش پیشنهادهای مؤثر برای")}:{" "}
              <strong className="branch-label">{branchName(viewBranch)}</strong>
            </p>
            <p className="muted">
              {t(
                "Products in the same pool combine across suppliers and categories. Pools keep company, branch, currency, and offer definition separate.",
                "کالاهای یک گروه بین تأمین‌کنندگان و دسته‌ها ترکیب می‌شوند. گروه‌ها شرکت، شعبه، ارز و نوع پیشنهاد را جدا نگه می‌دارند.",
              )}
            </p>
          </Card>
          {state.config.promotions.price_to_offer.map((mapping) => {
            const members = effectivePool(
              state,
              viewBranch,
              mapping.mix_and_match_pool,
              state.config.company.currency,
            );
            return (
              <Card key={mapping.mix_and_match_pool}>
                <h2>{offerLabel(mapping.offer)}</h2>
                {members.length === 0 ? (
                  <EmptyState>
                    {t(
                      "No products in this pool. Confirm an offer with mix-and-match enabled.",
                      "کالایی در این گروه نیست. یک پیشنهاد را با گزینه ترکیبی تأیید کنید.",
                    )}
                  </EmptyState>
                ) : (
                  <DataTable
                    columns={[
                      { width: "38%" },
                      { width: "18%" },
                      { width: "18%", align: "end" },
                      { width: "26%" },
                    ]}
                  >
                    <thead>
                      <tr>
                        <th>{t("Product", "کالا")}</th>
                        <th>{t("Product Code", "کد کالا")}</th>
                        <th className="number-cell">
                          {t("Approved price", "قیمت تأییدشده")}
                        </th>
                        <th>{t("Supplier", "تأمین‌کننده")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((product) => (
                        <tr key={product.code}>
                          <td>
                            <ProductName product={product} language={lang} />
                          </td>
                          <td>
                            <LtrText>{product.code}</LtrText>
                          </td>
                          <td className="number-cell">
                            <Money
                              value={effectivePrice(
                                state,
                                product,
                                viewBranch,
                              )!}
                              currency={state.config.company.currency}
                            />
                            <ManualPricePill
                              product={product}
                              branch={viewBranch}
                            />
                          </td>
                          <td>
                            <LtrText>{product.main_supplier}</LtrText>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                )}
              </Card>
            );
          })}
        </>
      )}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setMessage("");
        }}
        title={t("Create offer", "ایجاد پیشنهاد")}
        className="c3-operation-dialog offers-create-dialog"
      >
        <form
          aria-label={t("Create offer", "ایجاد پیشنهاد")}
          onSubmit={(event) => {
            event.preventDefault();
            if (candidate && offerReadiness(state, candidate) === "ready")
              activate(candidate);
          }}
        >
          <div className="grid-2">
            <Field label={t("Product", "کالا")}>
              <Select
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setMessage("");
                  const product = products.find((item) => item.code === value);
                  setScope(
                    product?.branch_prices?.[viewBranch] ? "branch" : "all",
                  );
                }}
                options={[
                  {
                    value: "",
                    label: t("Choose a product", "یک کالا انتخاب کنید"),
                  },
                  ...products.map((product) => ({
                    value: product.code,
                    label: `${lang === "fa" ? product.name_fa : product.name_en} · \u2066${product.code}\u2069`,
                  })),
                ]}
              />
            </Field>
            <Field label={t("Offer scope", "دامنه پیشنهاد")}>
              <Select
                value={scope}
                onChange={(value) => {
                  setScope(value as "all" | "branch");
                  setMessage("");
                }}
                options={[
                  {
                    value: "branch",
                    label: `${t("This branch only", "فقط این شعبه")} — ${branchName(viewBranch)}`,
                  },
                  {
                    value: "all",
                    label: t("Company default price", "قیمت پیش‌فرض شرکت"),
                  },
                ]}
              />
            </Field>
            <Field label={t("Start date (optional)", "تاریخ شروع (اختیاری)")}>
              <DateField
                value={start}
                onChange={(value) => {
                  setStart(value);
                  setMessage("");
                }}
              />
            </Field>
            <Field
              label={t("End date (optional)", "تاریخ پایان (اختیاری)")}
              error={dateError}
            >
              <DateField
                value={end}
                onChange={(value) => {
                  setEnd(value);
                  setMessage("");
                }}
              />
            </Field>
          </div>
          <Checkbox checked={mix} onChange={setMix}>
            {t("Join the mix-and-match pool", "عضویت در گروه ترکیبی")}
          </Checkbox>
          <p>
            {candidate ? (
              <>
                {t("Offer", "پیشنهاد")}:{" "}
                <strong>{offerLabel(candidate.label)}</strong> ·{" "}
                {t("Approved price", "قیمت تأییدشده")}:{" "}
                <Money
                  value={candidate.price}
                  currency={state.config.company.currency}
                />
                {selected && (
                  <ManualPricePill product={selected} branch={viewBranch} />
                )}
              </>
            ) : selected ? (
              t(
                "This approved price has no configured offer. Choose another product or change the mapping in Settings.",
                "این قیمت تأییدشده پیشنهاد تنظیم‌شده ندارد. کالای دیگری انتخاب کنید یا نگاشت را در تنظیمات تغییر دهید.",
              )
            ) : (
              t(
                "Choose a product with an approved price to create an offer.",
                "برای ایجاد پیشنهاد، کالایی با قیمت تأییدشده انتخاب کنید.",
              )
            )}
          </p>
          {candidate && (
            <p className="muted">
              {readyMessage(offerReadiness(state, candidate))}
            </p>
          )}
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button
              type="submit"
              disabled={
                !candidate || offerReadiness(state, candidate) !== "ready"
              }
            >
              {t("Create offer", "ایجاد پیشنهاد")}
            </Button>
          </div>
        </form>
      </Dialog>
      {stopId && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setStopId(null);
          }}
          title={t("Stop offer", "توقف پیشنهاد")}
          description={t(
            "This offer will stop in its scope. An eligible company offer may become effective again when a branch offer stops.",
            "این پیشنهاد در دامنه خود متوقف می‌شود. پس از توقف پیشنهاد شعبه، پیشنهاد سازگار شرکت ممکن است دوباره مؤثر شود.",
          )}
          confirmLabel={t("Stop offer", "توقف پیشنهاد")}
          confirmVariant="danger"
          onConfirm={() => stop(stopId)}
        />
      )}
    </>
  );
}

export default Offers;
