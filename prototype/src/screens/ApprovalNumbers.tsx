import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** Shared presentation of genuine approval projections; it performs no pricing. */
export function ApprovalNumbers({
  leadingLabel,
  leading,
  leadingNote,
  priceLabel,
  price,
  priceNote,
  marginLabel,
  margin,
  marginNote,
  warning = false,
  financial = true,
}: {
  leadingLabel: ReactNode;
  leading: ReactNode;
  leadingNote?: ReactNode;
  priceLabel: ReactNode;
  price: ReactNode;
  priceNote?: ReactNode;
  marginLabel: ReactNode;
  margin: ReactNode;
  marginNote?: ReactNode;
  warning?: boolean;
  financial?: boolean;
}) {
  return (
    <div
      className="ui-number-group approval-numbers"
      data-financial={financial}
    >
      {financial && (
        <>
          <div className="ui-number-stat approval-number-leading">
            <span className="ui-number-label muted">{leadingLabel}</span>
            <strong className="ui-number-value" data-number-baseline>
              {leading}
            </strong>
            <small className="ui-number-note muted">
              {leadingNote || "\u00a0"}
            </small>
          </div>
          <ArrowRight
            className="approval-number-arrow directional"
            size={16}
            aria-hidden="true"
          />
        </>
      )}
      <div className="ui-number-stat approval-number-price">
        <span className="ui-number-label muted">{priceLabel}</span>
        <strong className="ui-number-value" data-number-baseline>
          {price}
        </strong>
        <small className="ui-number-note muted">{priceNote || "\u00a0"}</small>
      </div>
      {financial && (
        <>
          <span className="approval-number-divider" aria-hidden="true" />
          <div
            className={`ui-number-stat approval-number-margin approval-margin${warning ? " is-warning is-below-minimum" : ""}`}
          >
            <span className="ui-number-label muted">{marginLabel}</span>
            <strong className="ui-number-value" data-number-baseline>
              {margin}
            </strong>
            <small className="ui-number-note muted">
              {marginNote || "\u00a0"}
            </small>
          </div>
        </>
      )}
    </div>
  );
}
