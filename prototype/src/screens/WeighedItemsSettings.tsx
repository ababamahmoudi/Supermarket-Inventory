import { useState } from "react";
import { useDemo } from "../store";
import { Button, Card, Field, Select, Switch } from "../ui";
import { savePricingSettings } from "../settings";
import {
  weighedSettings,
  type WeighedSettings,
  type WeightUnit,
} from "../weighed";

export default function WeighedItemsSettings() {
  const { state } = useDemo();
  return (
    <WeighedSettingsForm key={JSON.stringify(weighedSettings(state.config))} />
  );
}

function WeighedSettingsForm() {
  const { state, update, t, role, user } = useDemo();
  const [draft, setDraft] = useState<WeighedSettings>(() =>
    weighedSettings(state.config),
  );
  const [error, setError] = useState<string>();
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(weighedSettings(state.config));
  function change(value: Partial<WeighedSettings>) {
    setDraft((previous) => ({ ...previous, ...value }));
    setError(undefined);
  }
  return (
    <Card title={t("Weighed items", "کالاهای وزنی")}>
      <div className="form-grid">
        <Field label={t("Main display unit", "واحد اصلی نمایش")}>
          <Select
            value={draft.main_display_unit}
            onChange={(value) =>
              change({ main_display_unit: value as WeightUnit })
            }
            options={[
              { value: "lb", label: "lb" },
              { value: "kg", label: "kg" },
            ]}
          />
        </Field>
        <Switch
          checked={draft.show_second_unit}
          onChange={(value) => change({ show_second_unit: value })}
        >
          {t("Show second unit", "نمایش واحد دوم")}
        </Switch>
        <Switch
          checked={draft.use_rounding_bands}
          onChange={(value) => change({ use_rounding_bands: value })}
        >
          {t("Use rounding bands", "استفاده از بازه‌های گرد کردن")}
        </Switch>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {dirty && (
        <div className="actions settings-section-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(weighedSettings(state.config));
              setError(undefined);
            }}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            onClick={() => {
              try {
                update((next) =>
                  savePricingSettings(
                    next,
                    { ...next.config, weighed_items: draft },
                    {
                      role: role ?? "cashier",
                      company_id: next.config.company.seed_key,
                      by: user?.name ?? "",
                    },
                  ),
                );
                setError(undefined);
              } catch {
                setError(
                  t(
                    "Check the settings and try again.",
                    "تنظیمات را بررسی کنید و دوباره تلاش کنید.",
                  ),
                );
              }
            }}
          >
            {t("Save changes", "ذخیره تغییرات")}
          </Button>
        </div>
      )}
    </Card>
  );
}
