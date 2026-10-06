import { useState } from "react";
import {
  activateOffer,
  businessDate,
  demoBranches,
  effectivePool,
  offerMapping,
  offerReadiness,
  stopOffer,
} from "../approvals";
import {
  effectiveOffer,
  effectivePrice,
  isOfferScheduledNow,
  lookupBranch,
} from "../catalog";
import { useDemo } from "../store";
import type { Branch, Offer } from "../types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
} from "../ui";

export function Offers() {
  const { state, update, role, branch, lang, t, money } = useDemo();
  const [tab, setTab] = useState<"offers" | "pools">("offers");
  const [showStopped, setShowStopped] = useState(false);
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
  const company = state.config.company.seed_key;
  const viewBranch = lookupBranch(branch);
  const products = state.products.filter(
    (product) => product.company_id === company && product.status === "active",
  );
  const ownOffers = state.offers.filter(
    (offer) =>
      offer.company_id === company &&
      (offer.scope === "all" || branch === "all" || offer.branch === branch),
  );
  const suggestions = ownOffers.filter((offer) => offer.status === "suggested");
  const rows = ownOffers.filter(
    (offer) =>
      offer.status === "active" || (showStopped && offer.status === "stopped"),
  );
  if (role === "cashier")
    return (
      <EmptyState>
        {t(
          "Switch to Floor Worker or Supervisor to manage offers.",
          "برای مدیریت پیشنهادها به کارکنان فروشگاه یا سرپرست تغییر دهید.",
        )}
      </EmptyState>
    );
  const offerLabel = (label: string) => t(label, label.replace("for", "برای"));
  const branchName = (value: Branch) =>
    value === "all"
      ? t("All branches", "همه شعبه‌ها")
      : t(value, `شعبه ${demoBranches.indexOf(value) + 1}`);
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
    })[reason];
  const activate = (offer: Offer) => {
    const readiness = offerReadiness(state, offer);
    if (readiness !== "ready") {
      setMessage(readyMessage(readiness));
      return;
    }
    update((draft) => activateOffer(draft, offer, role ?? "floor_worker"));
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
  return (
    <>
      <PageHeader
        title={t("Offers", "پیشنهادها")}
        description={t(
          "Confirm suggestions or create offers. The approved price chooses the offer definition.",
          "پیشنهادها را تأیید یا ایجاد کنید. قیمت تأییدشده نوع پیشنهاد را تعیین می‌کند.",
        )}
      />
      <div className="tabs">
        <Button
          variant={tab === "offers" ? "primary" : "secondary"}
          onClick={() => setTab("offers")}
        >
          {t("Offers", "پیشنهادها")}
        </Button>
        <Button
          variant={tab === "pools" ? "primary" : "secondary"}
          onClick={() => setTab("pools")}
        >
          {t("Mix-and-match pools", "گروه‌های ترکیبی")}
        </Button>
      </div>
      {message && (
        <div className="banner" role="status">
          {message}
        </div>
      )}
      {tab === "offers" ? (
        <>
          <Card title={t("Offer suggestions", "پیشنهادهای پیشنهادی")}>
            <p className="muted">
              {t(
                "Demo suggestions use configured price mappings. No real AI is running. Nothing starts until a worker confirms it.",
                "پیشنهادهای نمایشی از نگاشت قیمت تنظیم‌شده استفاده می‌کنند. هوش مصنوعی واقعی اجرا نمی‌شود. تا تأیید کارکنان هیچ پیشنهادی شروع نمی‌شود.",
              )}
            </p>
            {suggestions.length === 0 ? (
              <EmptyState>
                {t(
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
                        {product
                          ? lang === "fa"
                            ? product.name_fa
                            : product.name_en
                          : offer.product_code}
                      </h3>
                      <Badge tone="pending">{t("Pending", "در انتظار")}</Badge>
                      <span>{branchName(offer.branch)}</span>
                    </div>
                    <p>
                      <strong>
                        {t("Confirm offer", "تأیید پیشنهاد")}:{" "}
                        {offerLabel(offer.label)}
                      </strong>{" "}
                      · {t("Approved price", "قیمت تأییدشده")}:{" "}
                      {money(offer.price)}
                    </p>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={options.mix}
                        onChange={(event) =>
                          change({ mix: event.target.checked })
                        }
                      />
                      {t("Join the mix-and-match pool", "عضویت در گروه ترکیبی")}
                    </label>
                    <div className="grid-2">
                      <Field
                        label={t(
                          "Start date (optional)",
                          "تاریخ شروع (اختیاری)",
                        )}
                      >
                        <input
                          type="date"
                          value={options.start}
                          onChange={(event) =>
                            change({ start: event.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label={t(
                          "End date (optional)",
                          "تاریخ پایان (اختیاری)",
                        )}
                      >
                        <input
                          type="date"
                          value={options.end}
                          onChange={(event) =>
                            change({ end: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <p className="muted">{readyMessage(readiness)}</p>
                    <div className="row">
                      <Button
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
          <Card title={t("Current offers", "پیشنهادهای فعلی")}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showStopped}
                onChange={(event) => setShowStopped(event.target.checked)}
              />
              {t("Show stopped offers", "نمایش پیشنهادهای متوقف‌شده")}
            </label>
            {rows.length === 0 ? (
              <EmptyState>
                {t(
                  "No active offers. Confirm a suggestion or create an offer below.",
                  "پیشنهاد فعالی نیست. یک پیشنهاد را تأیید یا در پایین ایجاد کنید.",
                )}
              </EmptyState>
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>{t("Product", "کالا")}</th>
                    <th>{t("Offer", "پیشنهاد")}</th>
                    <th>{t("Scope", "دامنه")}</th>
                    <th>{t("Status", "وضعیت")}</th>
                    <th>{t("Action", "اقدام")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((offer) => {
                    const product = products.find(
                      (item) => item.code === offer.product_code,
                    );
                    const effective =
                      product &&
                      effectiveOffer(state, product, viewBranch)?.id ===
                        offer.id;
                    const scheduled = isOfferScheduledNow(
                      offer,
                      state.config.company.timezone,
                    );
                    const expired =
                      offer.end_date &&
                      offer.end_date <
                        businessDate(state.config.company.timezone);
                    return (
                      <tr key={offer.id}>
                        <td>
                          {product
                            ? lang === "fa"
                              ? product.name_fa
                              : product.name_en
                            : offer.product_code}
                          <br />
                          <span className="muted">{money(offer.price)}</span>
                        </td>
                        <td>
                          {offerLabel(offer.label)}
                          {offer.mix_and_match && (
                            <>
                              <br />
                              <span className="muted">
                                {t("Mix-and-match", "ترکیبی")}
                              </span>
                            </>
                          )}
                        </td>
                        <td>{branchName(offer.branch)}</td>
                        <td>
                          <Badge
                            tone={
                              offer.status === "stopped"
                                ? "neutral"
                                : effective
                                  ? "approved"
                                  : "pending"
                            }
                          >
                            {offer.status === "stopped"
                              ? t("Stopped", "متوقف‌شده")
                              : effective
                                ? t("Active", "فعال")
                                : !scheduled
                                  ? expired
                                    ? t("Expired", "منقضی‌شده")
                                    : t("Scheduled", "زمان‌بندی‌شده")
                                  : t(
                                      "Not effective in this branch",
                                      "در این شعبه مؤثر نیست",
                                    )}
                          </Badge>
                          {offer.start_date && (
                            <p className="muted">
                              {t("Starts", "شروع")}:{" "}
                              <bdi>{offer.start_date}</bdi>
                            </p>
                          )}
                          {offer.end_date && (
                            <p className="muted">
                              {t("Ends", "پایان")}: <bdi>{offer.end_date}</bdi>
                            </p>
                          )}
                        </td>
                        <td>
                          {offer.status === "active" && (
                            <Button
                              variant="secondary"
                              onClick={() => setStopId(offer.id)}
                            >
                              {t("Stop offer", "توقف پیشنهاد")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
          </Card>
          <Card title={t("Create offer", "ایجاد پیشنهاد")}>
            <div className="grid-2">
              <Field label={t("Product", "کالا")}>
                <select
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    const product = products.find(
                      (item) => item.code === event.target.value,
                    );
                    setScope(
                      product?.branch_prices?.[viewBranch] ? "branch" : "all",
                    );
                  }}
                >
                  <option value="">
                    {t("Choose a product", "یک کالا انتخاب کنید")}
                  </option>
                  {products.map((product) => (
                    <option key={product.code} value={product.code}>
                      {lang === "fa" ? product.name_fa : product.name_en} ·{" "}
                      {product.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Offer scope", "دامنه پیشنهاد")}>
                <select
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as "all" | "branch")
                  }
                >
                  <option value="branch">
                    {t("This branch only", "فقط این شعبه")} —{" "}
                    {branchName(viewBranch)}
                  </option>
                  <option value="all">
                    {t("Company default price", "قیمت پیش‌فرض شرکت")}
                  </option>
                </select>
              </Field>
              <Field label={t("Start date (optional)", "تاریخ شروع (اختیاری)")}>
                <input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </Field>
              <Field label={t("End date (optional)", "تاریخ پایان (اختیاری)")}>
                <input
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </Field>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={mix}
                onChange={(event) => setMix(event.target.checked)}
              />
              {t("Join the mix-and-match pool", "عضویت در گروه ترکیبی")}
            </label>
            <p>
              {candidate ? (
                <>
                  {t("Offer", "پیشنهاد")}:{" "}
                  <strong>{offerLabel(candidate.label)}</strong> ·{" "}
                  {t("Approved price", "قیمت تأییدشده")}:{" "}
                  {money(candidate.price)}
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
            <Button
              disabled={
                !candidate || offerReadiness(state, candidate) !== "ready"
              }
              onClick={() => {
                if (candidate) activate(candidate);
              }}
            >
              {t("Create offer", "ایجاد پیشنهاد")}
            </Button>
          </Card>
        </>
      ) : (
        <>
          <Card title={t("Mix-and-match pools", "گروه‌های ترکیبی")}>
            <p>
              {t("Showing effective offers for", "نمایش پیشنهادهای مؤثر برای")}:{" "}
              <strong>{branchName(viewBranch)}</strong>
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
              <Card
                key={mapping.mix_and_match_pool}
                title={offerLabel(mapping.offer)}
              >
                {members.length === 0 ? (
                  <EmptyState>
                    {t(
                      "No products in this pool. Confirm an offer with mix-and-match enabled.",
                      "کالایی در این گروه نیست. یک پیشنهاد را با گزینه ترکیبی تأیید کنید.",
                    )}
                  </EmptyState>
                ) : (
                  <DataTable>
                    <thead>
                      <tr>
                        <th>{t("Product", "کالا")}</th>
                        <th>{t("Product Code", "کد کالا")}</th>
                        <th>{t("Approved price", "قیمت تأییدشده")}</th>
                        <th>{t("Supplier", "تأمین‌کننده")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((product) => (
                        <tr key={product.code}>
                          <td>
                            {lang === "fa" ? product.name_fa : product.name_en}
                          </td>
                          <td>
                            <bdi>{product.code}</bdi>
                          </td>
                          <td>
                            {money(effectivePrice(state, product, viewBranch)!)}
                          </td>
                          <td>{product.main_supplier}</td>
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
          onConfirm={() => stop(stopId)}
        />
      )}
    </>
  );
}

export default Offers;
