import { useState } from "react";
import { useDemo } from "../store";
import { useSettingsConfiguration } from "../settings-configuration";
import { configuredRoleLabel } from "../role-config";
import {
  priceUpdatesSettings,
  savePriceUpdateSettings,
  saveNotificationSettings,
  notificationSettings,
  type NotificationEvent,
} from "../price-updates";
import { Button, Card, Checkbox, Field, NumberField, Switch } from "../ui";
import type { RoleId } from "../authority-types";
import "./price-updates-e2.css";

export default function NotificationSettings() {
  const { state, can, command, lang, t } = useDemo();
  const config = useSettingsConfiguration();
  const settings = priceUpdatesSettings({ config });
  const [hours, setHours] = useState(String(settings.remind_after_hours));
  const [escalate, setEscalate] = useState(
    String(settings.escalate_after_hours),
  );
  const [allowFloor, setAllowFloor] = useState(
    settings.allow_floor_worker_complete,
  );
  const [events, setEvents] = useState(() =>
    structuredClone(notificationSettings({ config }).events),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const roleLabel = (role: RoleId, language: "en" | "fa") =>
    configuredRoleLabel(config.roles, role, language);
  const roles: RoleId[] = [
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
    "cashier",
  ];
  const eventLabels: Record<NotificationEvent, [string, string]> = {
    price_updates: ["Price updates", "به‌روزرسانی قیمت‌ها"],
    approvals_waiting: ["Approvals waiting", "تأییدهای در انتظار"],
    branch_requests: ["Branch requests", "درخواست‌های شعب"],
    returns_waiting_for_credit: [
      "Returns waiting for credit",
      "مرجوعی‌های در انتظار اعتبار",
    ],
    expiring_dates: ["Expiring dates", "تاریخ‌های نزدیک انقضا"],
    sale_requests: ["Sale requests", "درخواست‌های حراج"],
    sale_decisions: ["Sale request decisions", "تصمیم‌های درخواست حراج"],
    cost_went_up_during_sale: [
      "Costs that went up during a sale",
      "هزینه‌های افزایش‌یافته در طول حراج",
    ],
  };
  if (!can("settings.manage")) return null;
  const save = async () => {
    if (
      !/^\d+$/.test(hours) ||
      !/^\d+$/.test(escalate) ||
      Number(hours) <= 0 ||
      Number(escalate) <= Number(hours)
    ) {
      setError(
        t(
          "Use a reminder time above zero and a later Owner and Manager alert time.",
          "زمان یادآوری باید بیشتر از صفر و زمان هشدار مالک و مدیر دیرتر باشد.",
        ),
      );
      return;
    }
    try {
      await command(
        "settings.manage",
        {
          company_id: state.config.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (draft, actor) => {
          savePriceUpdateSettings(draft, actor, {
            remind_after_hours: Number(hours),
            escalate_after_hours: Number(escalate),
            allow_floor_worker_complete: allowFloor,
          });
          saveNotificationSettings(draft, actor, { events });
        },
      );
      setError("");
      setMessage(t("Changes saved.", "تغییرات ذخیره شد."));
    } catch {
      setError(
        t(
          "Only an Owner or Manager can change Settings.",
          "فقط مالک یا مدیر می‌تواند تنظیمات را تغییر دهد.",
        ),
      );
    }
  };
  return (
    <div className="notification-rules">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <Card title={t("Price update reminders", "یادآوری به‌روزرسانی قیمت‌ها")}>
        <div className="price-update-settings-fields">
          <Field label={t("Remind after (hours)", "یادآوری پس از (ساعت)")}>
            <NumberField value={hours} onChange={setHours} min={1} step={1} />
          </Field>
          <Field
            label={t(
              `Alert ${roleLabel("owner", "en")} and ${roleLabel("manager", "en")} after (hours)`,
              `هشدار به ${roleLabel("owner", "fa")} و ${roleLabel("manager", "fa")} پس از (ساعت)`,
            )}
          >
            <NumberField
              value={escalate}
              onChange={setEscalate}
              min={1}
              step={1}
            />
          </Field>
        </div>
        <Switch checked={allowFloor} onChange={setAllowFloor}>
          {t(
            `Allow ${roleLabel("floor_worker", "en")} to mark tasks done`,
            `اجازهٔ انجام‌شده کردن کارها برای ${roleLabel("floor_worker", "fa")}`,
          )}
        </Switch>
      </Card>
      <Card title={t("In-app notification rules", "قواعد اعلان داخل برنامه")}>
        {(
          Object.entries(eventLabels) as [NotificationEvent, [string, string]][]
        ).map(([event, label]) => (
          <div className="notification-event" key={event}>
            <h3>{t(...label)}</h3>
            <div className="notification-role-options">
              {roles.map((role) => (
                <Checkbox
                  key={role}
                  checked={(events[event] ?? []).includes(role)}
                  onChange={(checked) =>
                    setEvents((prior) => ({
                      ...prior,
                      [event]: checked
                        ? [...(prior[event] ?? []), role]
                        : (prior[event] ?? []).filter(
                            (current) => current !== role,
                          ),
                    }))
                  }
                >
                  {configuredRoleLabel(config.roles, role, lang)}
                </Checkbox>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <div className="actions">
        <Button onClick={() => void save()}>
          {t("Save changes", "ذخیره تغییرات")}
        </Button>
      </div>
    </div>
  );
}
