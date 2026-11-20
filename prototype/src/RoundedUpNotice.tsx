import type { ReactNode } from "react";
import { useDemo } from "./store";
import { Button } from "./ui";
import { LtrText } from "./presentation";

/**
 * A store correction (for example 1.49 → 1.99) is a suggestion. Explain the
 * lower price it replaced and, where a price can be chosen, offer "Use lower".
 */
export function RoundedUpNotice({
  from,
  meetsMargin,
  format,
  onUseLower,
  disabled,
  testId = "rounded-up-notice",
  className,
}: {
  from: string;
  meetsMargin: boolean | null;
  format: (value: string) => ReactNode;
  onUseLower?: () => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  const { t } = useDemo();
  return (
    <div
      className={
        className ? `rounded-up-notice ${className}` : "rounded-up-notice"
      }
      data-testid={testId}
    >
      <p className="helper">
        {t("Rounded up from", "گردشده به بالا از")}{" "}
        <LtrText>{format(from)}</LtrText>{" "}
        {t("by the store rule.", "طبق قاعدهٔ فروشگاه.")}{" "}
        {meetsMargin === true &&
          t(
            "The lower price already meets the minimum margin.",
            "قیمت کمتر هم حداقل حاشیهٔ سود را دارد.",
          )}
        {meetsMargin === false &&
          t(
            "The lower price is below the minimum margin.",
            "قیمت کمتر از حداقل حاشیهٔ سود پایین‌تر است.",
          )}
      </p>
      {onUseLower && (
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={onUseLower}
        >
          {t("Use lower", "استفاده از قیمت کمتر")}{" "}
          <LtrText>({format(from)})</LtrText>
        </Button>
      )}
    </div>
  );
}
