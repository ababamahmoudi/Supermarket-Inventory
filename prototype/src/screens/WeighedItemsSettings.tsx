import { useSettingsConfiguration } from "../settings-configuration";
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
  const configuration = useSettingsConfiguration();
  return (
    <WeighedSettingsForm key={JSON.stringify(weighedSettings(configuration))} />
  );
}

function WeighedSettingsForm() {
  const { command, t } = useDemo();
  const configuration = useSettingsConfiguration();
  const [draft, setDraft] = useState<WeighedSettings>(() =>
    weighedSettings(configuration),
  );
  const [error, setError] = useState<string>();
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(weighedSettings(configuration));
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
            variant="neutral"
            onClick={() => {
              setDraft(weighedSettings(configuration));
              setError(undefined);
            }}
          >
            {t("Cancel", "انصراف")}
          </Button>
          <Button
            onClick={async () => {
              try {
                await command(
                  "settings.manage",
                  {
                    company_id: configuration.company.seed_key,
                    kind: "company_shared",
                    mutation: true,
                  },
                  (next, freshActor) =>
                    savePricingSettings(
                      next,
                      { ...next.config, weighed_items: draft },
                      freshActor,
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
