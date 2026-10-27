import { historyActionLabel } from "./history-copy";
import type { Language } from "./types";

/** Task copy describes the completed decision; stored audit actions stay intact. */
export function priceUpdateReasonLabel(reason: string, language: Language) {
  const labels: Record<string, [string, string]> = {
    "Package price recalculated": [
      "Package price updated",
      "قیمت بسته به‌روز شد",
    ],
    "Approve product": ["New product approved", "کالای جدید تأیید شد"],
    "Approve price": ["Price change approved", "تغییر قیمت تأیید شد"],
    "Apply price to all branches": [
      "Price applied to all locations",
      "قیمت در همه مکان‌ها اعمال شد",
    ],
    "Set regular price": ["Regular price changed", "قیمت عادی تغییر کرد"],
    "Save product": ["Product price changed", "قیمت کالا تغییر کرد"],
    "Start sale": ["Sale started", "حراج شروع شد"],
    "Schedule sale": ["Sale scheduled", "حراج زمان‌بندی شد"],
    "Change sale": ["Sale price changed", "قیمت حراج تغییر کرد"],
    "End sale": ["Sale ended", "حراج پایان یافت"],
    "Revert sale": ["Sale restored", "حراج بازگردانده شد"],
    "Approve sale request": ["Sale request approved", "درخواست حراج تأیید شد"],
    "Create offer": ["Offer started", "پیشنهاد شروع شد"],
    "Confirm offer": ["Offer confirmed", "پیشنهاد تأیید شد"],
    "Stop offer": ["Offer ended", "پیشنهاد پایان یافت"],
    "Create clearance offer": [
      "Clearance price started",
      "قیمت فروش ویژه شروع شد",
    ],
    "Stop clearance offer": [
      "Clearance price ended",
      "قیمت فروش ویژه پایان یافت",
    ],
  };
  const label = labels[reason];
  return label
    ? label[language === "fa" ? 1 : 0]
    : historyActionLabel(reason, language);
}
