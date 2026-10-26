import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { FitText } from "./FitText";
import { cn } from "./ui";

/** Shared surface KPI: a static value becomes a button only with a destination. */
export function SummaryTile({
  label,
  value,
  detail,
  tone = "accent",
  onClick,
  className,
  accessibleLabel,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: "accent" | "pending" | "approved" | "danger";
  onClick?: () => void;
  className?: string;
  accessibleLabel?: string;
}) {
  const content = (
    <>
      <span className="kpi-label">{label}</span>
      <span className={`summary-tile-dot tone-${tone}`} aria-hidden="true" />
      <strong className="kpi-value" dir="ltr">
        {value}
      </strong>
      {typeof detail === "string" ? (
        <FitText value={detail} className="kpi-detail" />
      ) : (
        <span className="kpi-detail">{detail}</span>
      )}
      {onClick && (
        <ChevronRight
          size={16}
          className="directional kpi-arrow"
          aria-hidden="true"
        />
      )}
    </>
  );
  const classes = cn(
    "ui-summary-tile kpi-card",
    value === 0 && "is-zero",
    className,
  );
  return onClick ? (
    <button
      type="button"
      className={classes}
      aria-label={
        accessibleLabel ??
        `${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}`
      }
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
