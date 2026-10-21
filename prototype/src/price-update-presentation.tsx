import { useDemo } from "./store";
import { activeSaleAt } from "./sales";
import type { Product } from "./types";
import type { PriceSnapshot, PriceUpdateTask } from "./price-updates";
import { Badge, Button, Card, EmptyState } from "./ui";
import {
  DateText,
  LtrText,
  Money,
  ProductName,
  OfferLabel,
} from "./presentation";
import { branchLabel } from "./settings";
import { SnapshotSellingPrice } from "./selling-price-presentation";
import { snapshotHasDiscount } from "./selling-price-model";

export function PriceUpdateValue({ value }: { value: PriceSnapshot }) {
  const { t, lang } = useDemo();
  if (!value.price) return <LtrText>—</LtrText>;
  return (
    <span className="price-update-value">
      <SnapshotSellingPrice value={value} />
      {snapshotHasDiscount(value) && (
        <>
          <Badge tone="info">{t("Sale", "حراج")}</Badge>
          <small className="muted">
            {value.sale_last_day ? (
              <>
                {t("Until", "تا")} <DateText value={value.sale_last_day} />
              </>
            ) : (
              t("No end date", "بدون تاریخ پایان")
            )}
          </small>
        </>
      )}
      {value.clearance_offers?.map((offer) => (
        <Badge tone="info" key={offer.id}>
          {t("Clearance price", "قیمت فروش ویژه")} <Money value={offer.price} />
        </Badge>
      ))}
      {value.offer_label && (
        <Badge tone="info">
          <OfferLabel label={value.offer_label} language={lang} />
        </Badge>
      )}
    </span>
  );
}
export function SaleEndTaskTitle({ task }: { task: PriceUpdateTask }) {
  const { t } = useDemo();
  const [before, after] = t(
    "Sale ends after today: back to {{price}} tomorrow",
    "حراج پس از امروز پایان می‌یابد: فردا بازگشت به {{price}}",
  ).split("{{price}}");
  return (
    <>
      {before}
      <LtrText>
        {task.new_price.price ? <Money value={task.new_price.price} /> : "—"}
        {task.new_price.unit !== "each" && `/${task.new_price.unit}`}
      </LtrText>
      {after}
    </>
  );
}
export function PriceUpdateChange({ task }: { task: PriceUpdateTask }) {
  return (
    <span className="price-update-change">
      <del>
        <PriceUpdateValue value={task.old_price} />
      </del>
      <span aria-hidden="true">→</span>
      <strong>
        <PriceUpdateValue value={task.new_price} />
      </strong>
    </span>
  );
}
export function PriceChangedPill({
  product,
}: {
  product: Pick<Product, "code" | "company_id" | "status">;
}) {
  const { state, role, branch, t } = useDemo();
  if (
    role !== "cashier" ||
    branch === "all" ||
    activeSaleAt(state, product, branch)
  )
    return null;
  const hint = state.price_change_hints?.find(
    (item) =>
      item.product_code === product.code &&
      item.branch === branch &&
      item.company_id === product.company_id,
  );
  if (!hint) return null;
  return (
    <div className="price-changed-hint" role="status">
      <Badge tone="pending">{t("Price changed", "قیمت تغییر کرد")}</Badge>
      {hint.old_price !== null && (
        <del>
          <LtrText>
            <Money value={hint.old_price} />
            {hint.old_unit !== "each" && `/${hint.old_unit}`}
          </LtrText>
        </del>
      )}
    </div>
  );
}
export function PriceUpdatesDashboardCard() {
  const { state, can, lang, t, navigate } = useDemo();
  if (!can("price_updates.read")) return null;
  const tasks = (state.price_update_tasks ?? []).filter(
    (item) => item.status === "pending",
  );
  return (
    <Card className="price-update-dashboard-card">
      <div className="card-heading">
        <h2>{t("Price updates to apply", "به‌روزرسانی قیمت‌های قابل اجرا")}</h2>
        <Button
          variant="plain"
          size="sm"
          onClick={() => navigate("price-updates")}
        >
          {t("View all", "مشاهدهٔ همه")} <LtrText>{tasks.length}</LtrText>
        </Button>
      </div>
      {tasks.length ? (
        <div className="price-update-dashboard-list list-box-stack">
          {tasks.slice(0, 4).map((task) => {
            const product = state.products.find(
              (item) =>
                item.code === task.product_code &&
                item.company_id === task.company_id,
            );
            return (
              <button
                type="button"
                className="price-update-dashboard-row list-box"
                key={task.id}
                onClick={() =>
                  navigate(`price-update?id=${encodeURIComponent(task.id)}`)
                }
              >
                {product ? (
                  <ProductName product={product} language={lang} />
                ) : (
                  <LtrText>{task.product_code}</LtrText>
                )}
                <PriceUpdateChange task={task} />
                <small className="muted">
                  {branchLabel(state.config, task.branch, lang)} ·{" "}
                  <DateText value={task.effective_at} />
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState>
          {t(
            "No pending price updates.",
            "به‌روزرسانی قیمت در انتظار وجود ندارد.",
          )}
        </EmptyState>
      )}
    </Card>
  );
}
