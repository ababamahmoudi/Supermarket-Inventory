import { useDemo } from "./store";
import {
  userNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRecord,
} from "./sales";
import { branchLabel } from "./settings";
import { companyTimestampText } from "./company-time";
import { ProductName } from "./presentation";
import { MenuItem } from "./ui";

export function PersonalNotifications() {
  const { state, update, historyContext, setBranch, lang, t } = useDemo();
  if (!historyContext) return null;
  const notifications = userNotifications(state, historyContext);
  if (!notifications.length) return null;
  const titles: Record<NotificationRecord["kind"], string> = {
    sale_request_submitted: t("Sale request", "درخواست حراج"),
    sale_request_approved: t(
      "Your sale request was approved",
      "درخواست حراج شما تأیید شد",
    ),
    sale_request_rejected: t(
      "Your sale request was rejected",
      "درخواست حراج شما رد شد",
    ),
    sale_request_withdrawn: t(
      "Sale request withdrawn",
      "درخواست حراج پس گرفته شد",
    ),
    sale_request_expired: t(
      "Your sale request expired",
      "درخواست حراج شما منقضی شد",
    ),
    sale_no_end_reminder: t("Sale with no end date", "حراج بدون تاریخ پایان"),
    sale_cost_increase: t(
      "Cost went up during a sale",
      "هزینه در طول حراج افزایش یافت",
    ),
    sale_regular_not_above_sale: t(
      "The new regular price would be lower than the sale price",
      "قیمت عادی جدید از قیمت حراج کمتر خواهد بود",
    ),
    sale_delivery_release: t(
      "Sale ended: put the held products on the shelf.",
      "حراج پایان یافت: کالاهای نگه‌داشته‌شده را در قفسه بگذارید.",
    ),
  };
  return (
    <>
      {notifications.some((item) => !item.read_at) && (
        <MenuItem
          onClick={() =>
            update((draft) => markAllNotificationsRead(draft, historyContext))
          }
        >
          {t("Mark all as read", "همه را خوانده‌شده علامت بزن")}
        </MenuItem>
      )}
      {notifications.map((notification) => {
        const product = state.products.find(
          (item) =>
            item.company_id === notification.company_id &&
            item.code === notification.product_code,
        );
        return (
          <MenuItem
            className={`personal-notification${notification.read_at ? " is-read" : ""}`}
            key={notification.id}
            onClick={() => {
              update((draft) =>
                markNotificationRead(draft, historyContext, notification.id),
              );
              if (historyContext.allowed_branches.includes(notification.branch))
                setBranch(notification.branch);
              window.location.hash = notification.href;
            }}
          >
            <span className="personal-notification-copy">
              <strong>{titles[notification.kind]}</strong>
              {product && <ProductName product={product} language={lang} />}
              <small>
                {branchLabel(state.config, notification.branch, lang)} ·{" "}
                {companyTimestampText(state.config, notification.created_at)}
              </small>
              {notification.reason && <small>{notification.reason}</small>}
            </span>
          </MenuItem>
        );
      })}
    </>
  );
}
