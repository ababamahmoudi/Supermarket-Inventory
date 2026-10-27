# R2f shared alignment review

## R0.1 — Peer controls

Shared `ControlRow` / `.ui-control-row` arranges peer page controls on one centre line at 44 px; `size="small"` uses 40 px for small in-card actions. `.ui-control-row-grid` preserves screen-specific grid columns while applying the same control sizing. Labelled field/action rows use `align="end"` / `.is-field-row`. Tabs inside those rows lose their old bottom margin/self-start placement; the entire track is 44 px, with 36 px segment buttons inside. Icons retain their approved widths and match their peer controls' height. Boolean filter chips are 44 px everywhere.

## R0.2 — Card and table edges

Shared outer table padding is zero; the existing 12 px inner padding still separates columns by 24 px. First/last text and row rules meet the same card-content edges as the title/filter row. The same edge rule covers dedicated receiving/posted/batch tables. Numeric captions retain the shared logical end alignment and zero-padding sort buttons from R2e B1.
