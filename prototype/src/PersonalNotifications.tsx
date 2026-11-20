import { useLayoutEffect, useRef, useState } from "react";
import { useDemo } from "./store";
import {
  clearAllNotifications,
  markAllNotificationsRead,
  openNotificationGroup,
  type NotificationRecord,
} from "./sales";
import {
  groupedNotifications,
  notificationTimestamp,
} from "./notification-groups";
import { branchLabel } from "./settings";
import { ProductName, LtrText } from "./presentation";
import { Button, MenuItem, useMenuClose } from "./ui";

export function PersonalNotifications() {
  const { state, command, actor, branch, can, setBranch, navigate, lang, t } =
    useDemo();
  const closeMenu = useMenuClose();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const intentKey = actor
    ? `${actor.company_id}:${actor.session_id}:${actor.authority_epoch}:${actor.person_version}`
    : "";
  const currentIntent = useRef({ key: intentKey, branch });
  const requestSequence = useRef(0);
  useLayoutEffect(() => {
    currentIntent.current = { key: intentKey, branch };
  }, [intentKey, branch]);
  useLayoutEffect(
    () => () => {
      // Closing the popover or switching identity cancels its pending navigation.
      currentIntent.current = { key: "", branch: "" };
      requestSequence.current += 1;
    },
    [],
  );
  if (
    !actor ||
    !can("notifications.read", {
      company_id: actor.company_id,
      kind: "company_shared",
      owner_user_id: actor.user_id,
    })
  )
    return null;
  const groups = groupedNotifications(state.notifications ?? []);
  const scope = {
    company_id: actor.company_id,
    kind: "company_shared" as const,
    owner_user_id: actor.user_id,
    mutation: true,
  };
  const unavailable = () =>
    setError(
      t(
        "This notification is no longer available. Open its list again.",
        "این اعلان دیگر در دسترس نیست. فهرست آن را دوباره باز کنید.",
      ),
    );
  const updateAll = async (clear: boolean) => {
    const request = ++requestSequence.current;
    setBusy(true);
    try {
      await command("notifications.mark_read", scope, (draft, freshActor) =>
        clear
          ? clearAllNotifications(draft, freshActor)
          : markAllNotificationsRead(draft, freshActor),
      );
      if (
        currentIntent.current.key === intentKey &&
        requestSequence.current === request
      )
        setError("");
    } catch {
      if (
        currentIntent.current.key === intentKey &&
        requestSequence.current === request
      )
        unavailable();
    } finally {
      if (
        currentIntent.current.key === intentKey &&
        requestSequence.current === request
      )
        setBusy(false);
    }
  };
  const open = async (id: string) => {
    const request = ++requestSequence.current;
    const route = window.location.hash;
    const initialBranch = branch;
    const isCurrent = () =>
      currentIntent.current.key === intentKey &&
      requestSequence.current === request &&
      window.location.hash === route;
    try {
      const destination = await command(
        "notifications.mark_read",
        scope,
        (draft, freshActor) => openNotificationGroup(draft, freshActor, id),
      );
      if (!isCurrent() || currentIntent.current.branch !== initialBranch)
        return;
      if (destination.branch !== "all") await setBranch(destination.branch);
      if (
        !isCurrent() ||
        (currentIntent.current.branch !== initialBranch &&
          currentIntent.current.branch !== destination.branch)
      )
        return;
      setError("");
      navigate(destination.href);
      closeMenu?.();
    } catch {
      if (isCurrent()) unavailable();
    }
  };
  const titles: Record<NotificationRecord["kind"], string> = {
    supplier_profile_incomplete: t(
      "Complete supplier profile",
      "تکمیل مشخصات تأمین‌کننده",
    ),
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
    <section
      className="personal-notifications"
      aria-label={t("Notifications", "اعلان‌ها")}
    >
      <header className="personal-notifications-header">
        <h2>{t("Notifications", "اعلان‌ها")}</h2>
        <div className="personal-notifications-actions">
          <Button
            role="menuitem"
            variant="secondary"
            disabled={busy || !groups.some((group) => group.unread)}
            onClick={() => void updateAll(false)}
          >
            {t("Mark all as read", "همه را خوانده‌شده علامت بزن")}
          </Button>
          <Button
            role="menuitem"
            variant="secondary"
            disabled={busy || !groups.length}
            onClick={() => void updateAll(true)}
          >
            {t("Clear all", "پاک کردن همه")}
          </Button>
        </div>
      </header>
      {error && (
        <p className="personal-notifications-error" role="alert">
          {error}
        </p>
      )}
      <div className="personal-notifications-scroll" tabIndex={-1}>
        {!groups.length && (
          <p className="personal-notifications-empty">
            {t("No new notifications.", "اعلان جدیدی وجود ندارد.")}
          </p>
        )}
        {groups.map((group) => {
          const notification = group.notification;
          const supplier =
            notification.kind === "supplier_profile_incomplete" &&
            state.suppliers?.find(
              (record) =>
                record.id === notification.supplier_id &&
                record.company_id === notification.company_id,
            );
          const product = state.products.find(
            (item) =>
              item.company_id === notification.company_id &&
              item.code === notification.product_code,
          );
          return (
            <MenuItem
              className={`personal-notification${group.unread ? " is-unread" : " is-read"}`}
              data-control-kind="disclosure"
              closeOnSelect={false}
              key={group.id}
              onClick={() => void open(group.id)}
            >
              <span
                className="personal-notification-dot"
                aria-label={
                  group.unread ? t("Unread", "خوانده‌نشده") : undefined
                }
              />
              <span className="personal-notification-copy">
                <span className="personal-notification-heading">
                  <strong>{titles[notification.kind]}</strong>
                  <time dateTime={notification.created_at}>
                    {notificationTimestamp(
                      state.config,
                      notification.created_at,
                      lang,
                    )}
                  </time>
                </span>
                {supplier && <LtrText>{supplier.name}</LtrText>}
                {product && <ProductName product={product} language={lang} />}
                <small className="personal-notification-branches">
                  {group.branches
                    .map((location) =>
                      branchLabel(state.config, location, lang),
                    )
                    .join(lang === "fa" ? "، " : ", ")}
                </small>
                {notification.kind === "price_update_escalation" &&
                  notification.count !== undefined && (
                    <small>
                      {t(
                        `${notification.count} price updates waiting`,
                        `${notification.count} به‌روزرسانی قیمت در انتظار`,
                      )}
                    </small>
                  )}
                {notification.reason && <small>{notification.reason}</small>}
              </span>
            </MenuItem>
          );
        })}
      </div>
    </section>
  );
}
