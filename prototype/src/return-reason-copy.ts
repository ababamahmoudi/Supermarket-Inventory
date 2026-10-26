import type { ReturnReason } from "./return-create";
type Translate = (en: string, fa: string) => string;
export function returnReasonLabel(reason: ReturnReason, t: Translate): string {
  const labels: Record<ReturnReason, [string, string]> = {
    damaged: ["Damaged", "آسیب‌دیده"],
    expired: ["Expired", "منقضی‌شده"],
    wrong_item: ["Wrong item", "کالای اشتباه"],
    short_dated: ["Short-dated", "نزدیک انقضا"],
    other: ["Other", "سایر"],
  };
  return t(...labels[reason]);
}
