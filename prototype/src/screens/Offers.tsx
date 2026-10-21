import {
  branchLabel as configuredBranchLabel,
  branchSellsToCustomers,
  sellingBranches,
} from "../settings";
import { translateCount } from "../i18n";
import { useState } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
  activateOffer,
  businessDate,
  effectivePool,
  offerMapping,
  offerReadiness,
  stopOffer,
} from "../approvals";
import { effectivePrice, isOfferScheduledNow, regularPrice } from "../catalog";
import { ChangePriceDialog } from "../ChangePriceDialog";
import { endSale, withdrawSaleRequest } from "../sales";
import type {
  SaleReadDTO as SaleSchedule,
  SaleRequestReadDTO as SaleRequest,
} from "../offers-read-model";
import type { ResourceScope } from "../authority-types";
import { createId } from "../ids";
import { offerVersion, suppressedOfferStores } from "../offer-store-scopes";
import { configuredRoleLabel } from "../role-config";
import { offerPausedStores, salesOfferRows } from "../sales-offer-list";
import type { SalesOfferRow as SaleRow } from "../sales-offer-list";
import { salesText } from "../sales-locale";
import { SalesOfferRow, SalesOfferRecord } from "./SalesOffers";
import { useDemo } from "../store";
import { ManualPricePill } from "../manual-price-presentation";
import { ProductPrice } from "../weight-price-presentation";
import { SalePrice } from "../sales-presentation";
import {
  categoryLabel,
  DateText,
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
  DialogActions,
  EmptyState,
  Field,
  FilterToolbar,
  useListFilterOrigin,
  PageHeader,
  Checkbox,
  DateField,
  Select,
  Tabs,
  Menu,
  MenuItem,
  IconButton,
} from "../ui";

export function Offers() {
  const {
    state,
    command,
    query,
    can,
    branch,
    setBranch,
    lang,
    t,
    actor: historyContext,
  } = useDemo();
  const branches = sellingBranches(state.config).filter((id) =>
    historyContext?.allowed_branches.includes(id),
  );
  const companyLocations = historyContext?.location_scope.kind === "company";
  const mayManageMultiBuy = can("offers.multibuy_manage");
  const mayCreateSale = can("sales.manage") || can("sales.request");
  const [tab, setTab] = useState<"offers" | "past" | "pools">("offers");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [type, setType] = useState("");
  const { locationChanged: locationFilterChanged, resetLocation } =
    useListFilterOrigin("offers");
  const [code, setCode] = useState("");
  const [scope, setScope] = useState<"all" | "branch">("branch");
  const [mix, setMix] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [taskOptions, setTaskOptions] = useState<
    Record<string, { mix: boolean; start: string; end: string }>
  >({});
  const [message, setMessage] = useState<readonly [string, string] | null>(
    null,
  );
  const [stopId, setStopId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openedOffer, setOpenedOffer] = useState<Offer[] | null>(null);
  const [openedSale, setOpenedSale] = useState<SaleRow | null>(null);
  const [changePrice, setChangePrice] = useState<{
    product_code: string;
    branch?: Branch;
    existing_sale_id?: string;
    request_id?: string;
  } | null>(null);
  const [endSelected, setEndSelected] = useState<SaleSchedule | null>(null);
  const [withdrawSelected, setWithdrawSelected] = useState<SaleRequest | null>(
    null,
  );
  const [createType, setCreateType] = useState<"multi_buy" | "sale">(
    mayManageMultiBuy ? "multi_buy" : "sale",
  );
  const [createAttempted, setCreateAttempted] = useState(false);
  const company = state.config.company.seed_key;
  const viewBranch = branch;
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
    const paused = offerPausedStores(
      state,
      offer,
      branch,
      historyContext?.allowed_branches ?? [],
    );
    const visibleStatus =
      offer.status === "active" &&
      !isOfferScheduledNow(offer, state.config.company.timezone)
        ? isPastOffer(offer, state.config.company.timezone)
          ? "expired"
          : "scheduled"
        : paused.length
          ? "paused"
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
      (!type ||
        (type === "clearance"
          ? offer.clearance === true
          : type === "multi_buy" && !offer.clearance))
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
  const saleRows = salesOfferRows(
    state,
    historyContext,
    branch,
    {
      tab: tab === "past" ? "past" : "offers",
      search,
      status,
      category,
      supplier,
      type,
    },
    new Date(),
    can("approvals.decide"),
  );
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCategory("");
    setSupplier("");
    setType("");
    void resetLocation({});
  };
  if (!can("offers.read"))
    return (
      <EmptyState>
        {t(
          `Switch to ${configuredRoleLabel(state.config.roles, "floor_worker", "en")} or ${configuredRoleLabel(state.config.roles, "manager", "en")} to manage offers.`,
          `برای مدیریت پیشنهادها به ${configuredRoleLabel(state.config.roles, "floor_worker", "fa")} یا ${configuredRoleLabel(state.config.roles, "manager", "fa")} تغییر دهید.`,
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
  const readinessCopy = (
    reason: ReturnType<typeof offerReadiness>,
  ): readonly [string, string] =>
    (
      ({
        ready: [
          "Ready to confirm. Only the matching approved price can use this offer.",
          "آماده تأیید. فقط قیمت تأییدشده سازگار می‌تواند از این پیشنهاد استفاده کند.",
        ],
        price_changed: [
          "The approved price changed. Refresh this suggestion before confirming.",
          "قیمت تأییدشده تغییر کرده است. پیش از تأیید، پیشنهاد را تازه‌سازی کنید.",
        ],
        mapping_missing: [
          "No matching offer is configured for this price. Check Settings.",
          "برای این قیمت پیشنهاد سازگار تنظیم نشده است. تنظیمات را بررسی کنید.",
        ],
        dates_invalid: [
          "Use valid dates and put the end date on or after the start date.",
          "تاریخ‌های معتبر وارد کنید و پایان را برابر یا پس از شروع قرار دهید.",
        ],
        company_mismatch: [
          "Choose an active product in this company.",
          "یک کالای فعال از همین شرکت انتخاب کنید.",
        ],
        location_not_selling: [
          "Choose a location that sells to customers.",
          "مکانی را انتخاب کنید که به مشتریان فروش دارد.",
        ],
      }) as const
    )[reason];
  const readyMessage = (reason: ReturnType<typeof offerReadiness>) =>
    t(...readinessCopy(reason));
  const offerWriteScope = (offer: Offer): ResourceScope => ({
    company_id: offer.company_id,
    kind: "location_record",
    location_ids:
      offer.scope === "all"
        ? companyLocations
          ? branches
          : branch === "all"
            ? []
            : [branch]
        : [offer.branch],
    entity_id: offer.id,
    version: offerVersion(offer),
    mutation: true,
  });
  const denied = () =>
    setMessage([
      "You do not have permission for this action.",
      "اجازهٔ انجام این کار را ندارید.",
    ]);
  const activate = async (source: Offer) => {
    if (!historyContext) return;
    if (!companyLocations && branch === "all") {
      setMessage(readinessCopy("location_not_selling"));
      return;
    }
    const offer =
      !companyLocations && source.scope === "all"
        ? {
            ...source,
            id: createId("offer"),
            scope: "branch" as const,
            branch,
            version: 1,
          }
        : source;
    const readiness = offerReadiness(state, offer);
    if (readiness !== "ready") {
      setMessage(readinessCopy(readiness));
      return;
    }
    let result: "created" | "unchanged";
    try {
      const currentReady = await query(
        "offers.multibuy_manage",
        offerWriteScope(offer),
        (draft) => offerReadiness(draft, offer),
      );
      if (currentReady !== "ready") {
        setMessage(readinessCopy(currentReady));
        return;
      }
      result = await command(
        "offers.multibuy_manage",
        offerWriteScope(offer),
        (draft, freshActor) => activateOffer(draft, freshActor, offer),
      );
    } catch {
      denied();
      return;
    }
    setCreateOpen(false);
    if (result === "unchanged") {
      setMessage([
        "This offer already exists.",
        "این پیشنهاد از قبل وجود دارد.",
      ]);
      return;
    }
    const manual = offer.status !== "suggested";
    setMessage(
      isOfferScheduledNow(offer, state.config.company.timezone)
        ? manual
          ? [
              "Created offer. Cashier lookup and labels now use the effective offer.",
              "پیشنهاد ایجاد شد. جستجوی صندوق‌دار و برچسب‌ها اکنون پیشنهاد مؤثر را نمایش می‌دهند.",
            ]
          : [
              "Confirmed offer. Cashier lookup and labels now use the effective offer.",
              "پیشنهاد تأیید شد. جستجوی صندوق‌دار و برچسب‌ها اکنون پیشنهاد مؤثر را نمایش می‌دهند.",
            ]
        : manual
          ? [
              "Created offer with dates. It appears only during its scheduled dates.",
              "پیشنهاد با تاریخ ایجاد شد. فقط در تاریخ‌های برنامه‌ریزی‌شده نمایش داده می‌شود.",
            ]
          : [
              "Confirmed offer with dates. It appears only during its scheduled dates.",
              "پیشنهاد با تاریخ تأیید شد. فقط در تاریخ‌های برنامه‌ریزی‌شده نمایش داده می‌شود.",
            ],
    );
  };
  const stop = async (id: string, dismissed = false) => {
    const offer = state.offers.find(
      (item) => item.id === id && item.company_id === company,
    );
    if (!offer) return;
    try {
      await command(
        "offers.multibuy_manage",
        offerWriteScope(offer),
        (draft, freshActor) =>
          stopOffer(draft, freshActor, id, dismissed, offerVersion(offer)),
      );
    } catch {
      denied();
      return;
    }
    setStopId(null);
    setMessage(
      dismissed
        ? ["Dismissed offer suggestion.", "پیشنهاد پیشنهادی کنار گذاشته شد."]
        : ["Stopped offer.", "پیشنهاد متوقف شد."],
    );
  };
  const selected = products.find((product) => product.code === code);
  const endingProduct = products.find(
    (product) => product.code === endSelected?.product_code,
  );
  const manualPrice = selected
    ? scope === "all"
      ? selected.selling_price
      : regularPrice(state, selected, viewBranch)
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
  const listFilters = (
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
        rows.length +
          saleRows.length +
          (tab === "offers" ? suggestions.length : 0),
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
                { value: "ended", label: t("Ended", "پایان‌یافته") },
              ]
            : [
                { value: "suggested", label: t("Pending", "در انتظار") },
                { value: "active", label: t("Active", "فعال") },
                { value: "requested", label: t("Requested", "درخواست‌شده") },
                { value: "paused", label: salesText(t, "paused") },
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
        onChange={(value) => {
          void setBranch(value as Branch);
        }}
        disabled={branches.length < 2}
        options={
          branches.length > 1
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
          { value: "multi_buy", label: t("Multi-buy", "خرید چندتایی") },
          { value: "sale", label: t("Sale price", "قیمت حراج") },
          { value: "clearance", label: t("Clearance", "فروش ویژه") },
        ]}
      />
      {(search ||
        status ||
        category ||
        supplier ||
        type ||
        locationFilterChanged) && (
        <Button variant="plain" onClick={clearFilters}>
          {t("Clear filters", "پاک کردن فیلترها")}
        </Button>
      )}
    </FilterToolbar>
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
            disabled={!mayManageMultiBuy && !mayCreateSale}
            onClick={() => {
              setCreateOpen(true);
              setCreateType(mayManageMultiBuy ? "multi_buy" : "sale");
              setCreateAttempted(false);
              setMessage(null);
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
          {t(...message)}
        </div>
      )}
      {tab !== "pools" ? (
        <>
          {tab === "offers" && suggestions.length === 0 && (
            <p className="muted offers-empty-suggestions">
              {state.config.promotions.ai_suggestions_enabled === false
                ? t(
                    "Offer suggestions are turned off in Settings.",
                    "پیشنهادهای خودکار فروش در تنظیمات غیرفعال هستند.",
                  )
                : t("No suggestions waiting.", "پیشنهادی در انتظار نیست.")}
            </p>
          )}
          {tab === "offers" && suggestions.length > 0 && (
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
                          variant="primary"
                          disabled={readiness !== "ready"}
                          onClick={() => activate(task)}
                        >
                          {t("Confirm offer", "تأیید پیشنهاد")}:{" "}
                          {offerLabel(offer.label)}
                        </Button>
                        <Button
                          variant="neutral"
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
            {listFilters}
            {rows.length + saleRows.length === 0 ? (
              <EmptyState>
                {t(
                  "No offers match these filters. Clear filters or create an offer.",
                  "هیچ پیشنهادی با این فیلترها مطابقت ندارد. فیلترها را پاک کنید یا پیشنهاد ایجاد کنید.",
                )}
              </EmptyState>
            ) : (
              <DataTable
                className={`current-offers-table${tab === "past" ? " past-offers-table" : ""}`}
                phoneList={{
                  name: "product",
                  value: "price",
                  secondary: ["offer", "location", "status", "actions"],
                }}
                columns={[
                  {
                    key: "product",
                    required: true,
                    minWidth: 240,
                    priority: 1,
                    mobilePrimary: true,
                  },
                  {
                    key: "price",
                    label: t("Price", "قیمت"),
                    width: 180,
                    minWidth: 150,
                    priority: 2,
                    align: "end",
                  },
                  {
                    key: "offer",
                    width: 190,
                    minWidth: 190,
                    priority: 2,
                    mobilePrimary: true,
                  },
                  {
                    key: "location",
                    width: 144,
                    priority: 4,
                    mobilePrimary: false,
                  },
                  {
                    key: "status",
                    width: 220,
                    priority: 3,
                    mobilePrimary: true,
                  },
                  { key: "actions", width: 92, actions: true },
                ]}
              >
                <thead>
                  <tr>
                    <th>{t("Product", "کالا")}</th>
                    <th className="numeric">{t("Price", "قیمت")}</th>
                    <th>{t("Offer", "پیشنهاد")}</th>
                    <th>{t("Scope", "دامنه")}</th>
                    <th>{t("Status", "وضعیت")}</th>
                    <th>{t("Action", "اقدام")}</th>
                  </tr>
                </thead>
                <tbody>
                  {saleRows.map((row) =>
                    SalesOfferRow({
                      row,
                      state,
                      lang,
                      t,
                      context: historyContext,
                      can,
                      onOpen: setOpenedSale,
                      onChange: (record) =>
                        setChangePrice({
                          product_code: record.product_code,
                          branch: record.branch,
                          ...("requested_price" in record
                            ? { request_id: record.id }
                            : { existing_sale_id: record.id }),
                        }),
                      onEnd: setEndSelected,
                      onWithdraw: setWithdrawSelected,
                    }),
                  )}
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
                        data-row-href={
                          product
                            ? `#product?code=${encodeURIComponent(product.code)}`
                            : undefined
                        }
                        tabIndex={0}
                        onClick={(event) => {
                          if (
                            !(event.target instanceof Element) ||
                            !event.target.closest(
                              "button,a,input,[role='button']",
                            )
                          ) {
                            event.preventDefault();
                            setOpenedOffer(group);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setOpenedOffer(group);
                          }
                        }}
                      >
                        <td>
                          {product ? (
                            <ProductName product={product} language={lang} />
                          ) : (
                            <LtrText>{first.product_code}</LtrText>
                          )}
                        </td>
                        <td className="numeric">
                          {product
                            ? group.map((offer) => (
                                <div
                                  className="offer-group-entry"
                                  key={offer.id}
                                >
                                  <SalePrice
                                    product={product}
                                    branch={
                                      branch === "all" ? offer.branch : branch
                                    }
                                  />
                                </div>
                              ))
                            : "—"}
                        </td>
                        <td>
                          {group.map((offer) => {
                            const paused = offerPausedStores(
                              state,
                              offer,
                              branch,
                              historyContext?.allowed_branches ?? [],
                            );
                            return (
                              <div
                                className="product-offer-lines offer-group-entry"
                                key={offer.id}
                              >
                                <span className="product-offer-line">
                                  {offerLabel(offer.label)}
                                </span>
                                {paused.length > 0 && (
                                  <span className="product-offer-line is-paused">
                                    {salesText(t, "paused")}
                                  </span>
                                )}
                                {offer.mix_and_match && (
                                  <span className="muted offer-entry-pool">
                                    {t("Mix-and-match", "ترکیبی")}
                                  </span>
                                )}
                              </div>
                            );
                          })}
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
                            const paused = offerPausedStores(
                              state,
                              offer,
                              branch,
                              historyContext?.allowed_branches ?? [],
                            );
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
                                        : paused.length
                                          ? "pending"
                                          : scheduled
                                            ? "approved"
                                            : "info"
                                  }
                                >
                                  {offer.status === "stopped"
                                    ? t("Stopped", "متوقف‌شده")
                                    : expired
                                      ? t("Expired", "منقضی‌شده")
                                      : paused.length
                                        ? salesText(t, "paused")
                                        : scheduled
                                          ? t("Active", "فعال")
                                          : t("Scheduled", "زمان‌بندی‌شده")}
                                </Badge>
                                {paused.map((store) => (
                                  <p key={store} className="muted">
                                    {branchName(store)}
                                  </p>
                                ))}
                                {suppressedOfferStores(
                                  state,
                                  offer,
                                  historyContext?.allowed_branches ?? [],
                                )
                                  .filter(
                                    (store) =>
                                      branch === "all" || store === branch,
                                  )
                                  .map((store) => (
                                    <p
                                      key={`stopped:${store}`}
                                      className="muted"
                                    >
                                      <Badge tone="neutral">
                                        {t("Stopped", "متوقف‌شده")}
                                      </Badge>{" "}
                                      {branchName(store)}
                                    </p>
                                  ))}
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
                        <td>
                          <div className="actions offer-row-actions">
                            {tab === "offers" && mayManageMultiBuy ? (
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
                                    disabled={
                                      !can(
                                        "offers.multibuy_manage",
                                        offerWriteScope(offer),
                                      )
                                    }
                                    onClick={() => setStopId(offer.id)}
                                  >
                                    {t("Stop offer", "توقف پیشنهاد")} ·{" "}
                                    {branchName(offer.branch)}
                                  </MenuItem>
                                ))}
                              </Menu>
                            ) : (
                              <span
                                className="offer-more-slot"
                                aria-hidden="true"
                              />
                            )}
                            <IconButton
                              variant="ghost"
                              className="table-row-link offer-record-action"
                              aria-label={t("Open offer", "باز کردن پیشنهاد")}
                              onClick={() => setOpenedOffer(group)}
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
          if (!open) setMessage(null);
        }}
        title={t("Create offer", "ایجاد پیشنهاد")}
        description={
          selected ? (
            <>
              <ProductName product={selected} language={lang} />
              {" · "}
              {createType === "sale" || scope === "branch"
                ? branchName(viewBranch)
                : t("Company default price", "قیمت پیش‌فرض شرکت")}
            </>
          ) : (
            t(
              "Choose a product with an approved price to create an offer.",
              "برای ایجاد پیشنهاد، کالایی با قیمت تأییدشده انتخاب کنید.",
            )
          )
        }
        className="c3-operation-dialog offers-create-dialog"
      >
        <form
          aria-label={t("Create offer", "ایجاد پیشنهاد")}
          onSubmit={(event) => {
            event.preventDefault();
            setCreateAttempted(true);
            if (createType === "sale") {
              if (!selected) return;
              setCreateOpen(false);
              setChangePrice({
                product_code: selected.code,
                branch: viewBranch,
              });
              return;
            }
            if (candidate && offerReadiness(state, candidate) === "ready")
              activate(candidate);
          }}
        >
          <Field label={t("Offer type", "نوع پیشنهاد")}>
            <Select
              value={createType}
              onChange={(value) => {
                setCreateType(value as "multi_buy" | "sale");
                setCreateAttempted(false);
              }}
              options={[
                ...(mayManageMultiBuy
                  ? [
                      {
                        value: "multi_buy",
                        label: t("Multi-buy", "خرید چندتایی"),
                      },
                    ]
                  : []),
                ...(mayCreateSale
                  ? [{ value: "sale", label: t("Sale price", "قیمت حراج") }]
                  : []),
              ]}
            />
          </Field>
          <div className="grid-2">
            <Field
              label={t("Product", "کالا")}
              error={
                createAttempted && !selected
                  ? t("Choose a product", "یک کالا انتخاب کنید")
                  : undefined
              }
            >
              <Select
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setMessage(null);
                  const product = products.find((item) => item.code === value);
                  setScope(
                    !companyLocations || product?.branch_prices?.[viewBranch]
                      ? "branch"
                      : "all",
                  );
                }}
                options={[
                  {
                    value: "",
                    label: t("Choose a product", "یک کالا انتخاب کنید"),
                  },
                  ...products.map((product) => ({
                    value: product.code,
                    label: `${lang === "fa" ? product.name_fa || product.name_en : product.name_en} · \u2066${product.code}\u2069`,
                  })),
                ]}
              />
            </Field>
            {createType === "multi_buy" && (
              <>
                <Field label={t("Offer scope", "دامنه پیشنهاد")}>
                  <Select
                    value={scope}
                    onChange={(value) => {
                      setScope(value as "all" | "branch");
                      setMessage(null);
                    }}
                    options={[
                      {
                        value: "branch",
                        label: `${t("This branch only", "فقط این شعبه")} — ${branchName(viewBranch)}`,
                      },
                      ...(companyLocations
                        ? [
                            {
                              value: "all",
                              label: t(
                                "Company default price",
                                "قیمت پیش‌فرض شرکت",
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Field>
                <Field
                  label={t("Start date (optional)", "تاریخ شروع (اختیاری)")}
                >
                  <DateField
                    value={start}
                    onChange={(value) => {
                      setStart(value);
                      setMessage(null);
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
                      setMessage(null);
                    }}
                  />
                </Field>
              </>
            )}
          </div>
          {createType === "multi_buy" && (
            <>
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
                ) : null}
              </p>
              {candidate && (
                <p className="muted">
                  {readyMessage(offerReadiness(state, candidate))}
                </p>
              )}
            </>
          )}
          <DialogActions>
            <Button variant="neutral" onClick={() => setCreateOpen(false)}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button type="submit">
              {createType === "sale"
                ? t("Continue", "ادامه")
                : t("Create offer", "ایجاد پیشنهاد")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {openedOffer && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setOpenedOffer(null);
          }}
          title={t("Offer", "پیشنهاد")}
        >
          {openedOffer.map((offer) => {
            const product = products.find(
              (item) => item.code === offer.product_code,
            );
            return (
              <section className="offer-record" key={offer.id}>
                {product && <ProductName product={product} language={lang} />}
                <dl>
                  <div>
                    <dt>{t("Product Code", "کد کالا")}</dt>
                    <dd>
                      <LtrText>{offer.product_code}</LtrText>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Offer", "پیشنهاد")}</dt>
                    <dd>{offerLabel(offer.label)}</dd>
                  </div>
                  <div>
                    <dt>{t("Selling price", "قیمت فروش")}</dt>
                    <dd>
                      <Money
                        value={offer.price}
                        currency={state.config.company.currency}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Location", "مکان")}</dt>
                    <dd>{branchName(offer.branch)}</dd>
                  </div>
                  {offer.start_date && (
                    <div>
                      <dt>{t("Starts", "شروع")}</dt>
                      <dd>
                        <DateText value={offer.start_date} />
                      </dd>
                    </div>
                  )}
                  {offer.end_date && (
                    <div>
                      <dt>{t("Ends", "پایان")}</dt>
                      <dd>
                        <DateText value={offer.end_date} />
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            );
          })}
          <DialogActions>
            <Button variant="neutral" onClick={() => setOpenedOffer(null)}>
              {t("Close", "بستن")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {openedSale && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setOpenedSale(null);
          }}
          title={t("Offer", "پیشنهاد")}
        >
          <SalesOfferRecord row={openedSale} state={state} lang={lang} t={t} />
          <DialogActions>
            <Button variant="neutral" onClick={() => setOpenedSale(null)}>
              {t("Close", "بستن")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {changePrice && (
        <ChangePriceDialog
          {...changePrice}
          onClose={() => setChangePrice(null)}
        />
      )}
      {endSelected && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setEndSelected(null);
          }}
          title={salesText(t, "endNow")}
          description={branchName(endSelected.branch)}
          confirmLabel={salesText(t, "endNow")}
          confirmVariant="danger"
          onConfirm={async () => {
            if (!historyContext) return;
            try {
              await command(
                "sales.manage",
                {
                  company_id: company,
                  kind: "location_record",
                  location_ids: [endSelected.branch],
                  entity_id: endSelected.id,
                  version: endSelected.revision,
                  mutation: true,
                },
                (draft, freshActor) =>
                  endSale(draft, freshActor, endSelected.id, {
                    expected_revision: endSelected.revision,
                  }),
              );
              setEndSelected(null);
              setMessage(["Ended sale.", "حراج پایان یافت."]);
            } catch {
              setEndSelected(null);
              setMessage([
                "The sale changed. Open it again before ending it.",
                "حراج تغییر کرده است. پیش از پایان دادن دوباره آن را باز کنید.",
              ]);
            }
          }}
        >
          {endingProduct && (
            <p>
              <ProductName product={endingProduct} language={lang} />
            </p>
          )}
          <p>
            {t("Regular", "عادی")}{" "}
            {endingProduct && (
              <ProductPrice
                value={
                  regularPrice(
                    state,
                    endSelected.product_code,
                    endSelected.branch,
                  ) ?? endSelected.regular_price_snapshot
                }
                product={endingProduct}
                config={state.config}
              />
            )}
          </p>
        </ConfirmDialog>
      )}
      {withdrawSelected && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setWithdrawSelected(null);
          }}
          title={salesText(t, "withdraw")}
          description={branchName(withdrawSelected.branch)}
          confirmLabel={salesText(t, "withdraw")}
          confirmVariant="danger"
          onConfirm={async () => {
            if (!historyContext) return;
            try {
              await command(
                "sales.request_withdraw_own",
                {
                  company_id: company,
                  kind: "location_record",
                  location_ids: [withdrawSelected.branch],
                  entity_id: withdrawSelected.id,
                  owner_user_id: withdrawSelected.requester_user_id,
                  version: withdrawSelected.revision,
                  mutation: true,
                },
                (draft, freshActor) =>
                  withdrawSaleRequest(
                    draft,
                    freshActor,
                    withdrawSelected.id,
                    withdrawSelected.revision,
                  ),
              );
              setWithdrawSelected(null);
              setMessage([
                "Withdrew sale request.",
                "درخواست حراج پس گرفته شد.",
              ]);
            } catch {
              setWithdrawSelected(null);
              setMessage([
                "The request changed. Open it again before withdrawing it.",
                "درخواست تغییر کرده است. پیش از پس‌گرفتن دوباره آن را باز کنید.",
              ]);
            }
          }}
        />
      )}
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
