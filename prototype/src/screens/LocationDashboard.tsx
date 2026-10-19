import { CalendarClock, PackageMinus, Tags, Truck } from "lucide-react";
import { useDemo } from "../store";
import { PriceUpdatesDashboardCard } from "../price-update-presentation";
import { useProtectedQuery } from "../use-protected-query";
import {
  locationDashboardView,
  type LocationDashboardRow,
} from "../location-dashboard";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KpiCard,
  PageHeader,
  TableRowLink,
} from "../ui";
import { DateText, LtrText, UnitText } from "../presentation";
import { branchLabel } from "../settings";
import "./people-e1.css";

export default function LocationDashboard() {
  const { actor, can, state, lang, t, navigate } = useDemo();
  const result = useProtectedQuery(
    "dashboard.location",
    { company_id: state.config.company.seed_key, kind: "company_shared" },
    locationDashboardView,
    "location-dashboard",
  );
  const data = result.data;
  const error = result.error
    ? t(
        "You do not have permission for this action.",
        "اجازهٔ انجام این کار را ندارید.",
      )
    : "";
  if (!actor || !can("dashboard.location"))
    return (
      <EmptyState>
        {t(
          "You do not have permission for this action.",
          "اجازهٔ انجام این کار را ندارید.",
        )}
      </EmptyState>
    );
  const status = (value: string) =>
    ({
      active: t("Active", "فعال"),
      expired: t("Expired", "منقضی‌شده"),
      due_soon: t("Due soon", "نزدیک انقضا"),
      open: t("Open", "باز"),
      picked_up: t("Picked up", "برداشته شد"),
      partially_resolved: t("Partially resolved", "بخشی رسیدگی شده"),
      claim_pending: t("Pending", "در انتظار"),
      cancellation_review: t("Pending", "در انتظار"),
      draft: t("Draft", "پیش‌نویس"),
      requested: t("Requested", "درخواست‌شده"),
      sent: t("Sent", "ارسال‌شده"),
      received: t("Received", "دریافت‌شده"),
    })[value as "active"] ?? value;
  const list = (rows: LocationDashboardRow[]) =>
    rows.length ? (
      <div className="location-dashboard-list">
        {rows.map((row) => (
          <div className="location-dashboard-row" key={row.id}>
            <div>
              <strong>
                {row.code ? (
                  <bdi dir="auto">
                    <UnitText>
                      {lang === "fa"
                        ? row.title_fa || row.title_en
                        : row.title_en}
                    </UnitText>
                  </bdi>
                ) : (
                  <LtrText>{row.title_en}</LtrText>
                )}
              </strong>
              <small className="muted">
                {branchLabel(state.config, row.location_id, lang)}
                {row.date && (
                  <>
                    {" "}
                    · <DateText value={row.date} />
                  </>
                )}
              </small>
            </div>
            {row.status && (
              <Badge
                tone={
                  row.status === "expired"
                    ? "danger"
                    : row.status === "due_soon"
                      ? "pending"
                      : "neutral"
                }
              >
                {status(row.status)}
              </Badge>
            )}
            <TableRowLink
              href={`#${row.href}`}
              aria-label={
                lang === "fa" ? row.title_fa || row.title_en : row.title_en
              }
            />
          </div>
        ))}
      </div>
    ) : (
      <EmptyState>
        {t("Nothing here yet.", "هنوز موردی اینجا نیست.")}
      </EmptyState>
    );
  return (
    <div className="location-dashboard">
      <PageHeader title={t("Dashboard", "داشبورد")} />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">{t("Loading…", "در حال بارگذاری…")}</p>
      ) : (
        <>
          <div className="location-dashboard-kpis">
            <KpiCard
              label={t("Arrived this week", "رسیده در این هفته")}
              value={data.arrivals.length}
              icon={<Truck size={20} />}
              onClick={() => navigate("received")}
            />
            <KpiCard
              tone="charcoal"
              label={t("Running sales", "فروش‌های ویژهٔ جاری")}
              value={data.sales.length}
              icon={<Tags size={20} />}
              onClick={() => navigate("offers")}
            />
            <KpiCard
              label={t("Date tracking", "پیگیری تاریخ")}
              value={data.dates.length}
              icon={<CalendarClock size={20} />}
              onClick={() => navigate("expiry")}
            />
            <KpiCard
              tone="charcoal"
              label={t("Open returns", "مرجوعی‌های باز")}
              value={data.returns.length}
              icon={<PackageMinus size={20} />}
              onClick={() => navigate("returns")}
            />
          </div>
          <PriceUpdatesDashboardCard />
          <div className="location-dashboard-cards">
            {[
              {
                title: t("Arrived this week", "رسیده در این هفته"),
                rows: data.arrivals,
                href: "received",
              },
              {
                title: t("Running sales", "فروش‌های ویژهٔ جاری"),
                rows: data.sales,
                href: "offers",
              },
              {
                title: t("Date tracking", "پیگیری تاریخ"),
                rows: data.dates,
                href: "expiry",
              },
              {
                title: t("Open returns", "مرجوعی‌های باز"),
                rows: data.returns,
                href: "returns",
              },
              {
                title: t("Branch requests", "درخواست‌های شعب"),
                rows: data.requests,
                href: "requests",
              },
              {
                title: t("Notes", "یادداشت‌ها"),
                rows: data.notes,
                href: "notes",
              },
            ].map((section) => (
              <Card key={section.href}>
                <div className="card-heading">
                  <h2>{section.title}</h2>
                  <Button
                    variant="tinted"
                    size="sm"
                    onClick={() => navigate(section.href)}
                  >
                    {t("View all", "مشاهدهٔ همه")}
                  </Button>
                </div>
                {list(section.rows)}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
