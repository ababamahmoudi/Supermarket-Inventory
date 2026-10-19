import { useEffect, useRef, useState } from "react";
import { useDemo } from "./store";
import {
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRecord,
} from "./sales";
import { branchLabel } from "./settings";
import { companyTimestampText } from "./company-time";
import { ProductName, LtrText } from "./presentation";
import { MenuItem } from "./ui";

export function PersonalNotifications() {
  const { state, command, actor, can, setBranch, navigate, lang, t } =
    useDemo();
  const [error, setError] = useState("");
  const intentKey = actor
    ? `${actor.company_id}:${actor.session_id}:${actor.authority_epoch}:${actor.person_version}`
    : "";
  const currentIntent = useRef(intentKey);
  useEffect(() => {
    currentIntent.current = intentKey;
  }, [intentKey]);
  if (
    !actor ||
    !can("notifications.read", {
      company_id: actor.company_id,
      kind: "company_shared",
      owner_user_id: actor.user_id,
    })
  )
    return null;
  const notifications = [...(state.notifications ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const markAll = async () => {
    try {
      await command(
        "notifications.mark_read",
        {
          company_id: actor.company_id,
          kind: "company_shared",
          owner_user_id: actor.user_id,
          mutation: true,
        },
        (draft, freshActor) => markAllNotificationsRead(draft, freshActor),
      );
      if (currentIntent.current === intentKey) setError("");
    } catch {
      if (currentIntent.current === intentKey)
        setError(
          t(
            "This notification is no longer available. Open its list again.",
            "این اعلان دیگر در دسترس نیست. فهرست آن را دوباره باز کنید.",
          ),
        );
    }
  };
  const open = async (id: string) => {
    try {
      const destination = await command(
        "notifications.mark_read",
        {
          company_id: actor.company_id,
          kind: "company_shared",
          owner_user_id: actor.user_id,
          mutation: true,
        },
        (draft, freshActor) => {
          const source = (draft.notifications ?? []).find(
            (item) =>
              item.id === id &&
              item.company_id === freshActor.company_id &&
              item.recipient_user_id === freshActor.user_id &&
              (item.branch === "all" ||
                freshActor.allowed_branches.includes(item.branch)),
          );
          if (
            !source ||
            !/^(?:#)?(?:product\?code=|approvals(?:[?]|$)|alerts(?:[?]|$)|notes(?:[?]|$)|price-update\?id=|price-updates(?:[?]|$)|requests(?:[?]|$)|returns(?:[?]|$)|expiry(?:[?]|$))/.test(
              source.href,
            )
          )
            throw new Error("permission");
          markNotificationRead(draft, freshActor, id);
          return { branch: source.branch, href: source.href };
        },
      );
      if (currentIntent.current !== intentKey) return;
      if (destination.branch !== "all") await setBranch(destination.branch);
      if (currentIntent.current !== intentKey) return;
      navigate(destination.href);
      setError("");
    } catch {
      if (currentIntent.current === intentKey)
        setError(
          t(
            "This notification is no longer available. Open its list again.",
            "این اعلان دیگر در دسترس نیست. فهرست آن را دوباره باز کنید.",
          ),
        );
    }
  };
  if (!notifications.length) return null;
  const titles: Record<NotificationRecord["kind"], string> = {
    note_added: t("New note", "یادداشت جدید"),
    notebook_entry_added: t("New notebook entry", "یادداشت جدید دفترچه"),
    sale_request_decision: t("Sale request decision", "نتیجهٔ درخواست حراج"),
    price_update_created: t("Price update", "به‌روزرسانی قیمت"),
    price_update_reminder: t(
      "Price update reminder",
      "یادآوری به‌روزرسانی قیمت",
    ),
    price_update_escalation: t(
      "Price updates waiting",
      "به‌روزرسانی قیمت‌های در انتظار",
    ),
    approval_waiting: t("Approvals waiting", "تأییدهای در انتظار"),
    branch_request_waiting: t("Branch request", "درخواست شعبه"),
    return_waiting_credit: t(
      "Returns waiting for credit",
      "مرجوعی‌های در انتظار اعتبار",
    ),
    expiry_date_waiting: t("Expiring dates", "تاریخ‌های نزدیک انقضا"),
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
      {error && <p role="alert">{error}</p>}
      {notifications.some((item) => !item.read_at) && (
        <MenuItem onClick={markAll}>
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
            onClick={() => open(notification.id)}
          >
            <span className="personal-notification-copy">
              <strong>{titles[notification.kind]}</strong>
              {product && <ProductName product={product} language={lang} />}
              <small>
                {branchLabel(state.config, notification.branch, lang)} ·{" "}
                <LtrText>
                  {companyTimestampText(state.config, notification.created_at)}
                </LtrText>
              </small>
              {notification.kind === "price_update_escalation" &&
                notification.count !== undefined && (
                  <small>
                    {t(
                      `${branchLabel(state.config, notification.branch, "en")} has ${notification.count} price updates waiting`,
                      `${branchLabel(state.config, notification.branch, "fa")} دارای ${notification.count} به‌روزرسانی قیمت در انتظار است`,
                    )}
                  </small>
                )}
              {notification.reason && <small>{notification.reason}</small>}
            </span>
          </MenuItem>
        );
      })}
    </>
  );
}
