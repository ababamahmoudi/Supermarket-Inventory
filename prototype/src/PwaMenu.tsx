import { useSyncExternalStore } from "react";
import { pwaSnapshot, requestAppUpdate, subscribePwa } from "./pwa-client";
import { useDemo } from "./store";
import { MenuItem } from "./ui";
export default function PwaMenu() {
  const state = useSyncExternalStore(subscribePwa, pwaSnapshot, pwaSnapshot);
  const { t } = useDemo();
  if (!state.available) return null;
  return (
    <>
      <p className="helper">{t("Update available", "به‌روزرسانی آماده است")}</p>
      <MenuItem
        disabled={!state.safe}
        onClick={() => {
          requestAppUpdate();
        }}
      >
        {t("Update app", "به‌روزرسانی برنامه")}
      </MenuItem>
      {!state.safe && (
        <p className="helper">
          {t(
            "Finish or close your current work before updating.",
            "پیش از به‌روزرسانی، کار فعلی را تمام کنید یا ببندید.",
          )}
        </p>
      )}
    </>
  );
}
