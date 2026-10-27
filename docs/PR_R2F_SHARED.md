# R2f shared alignment review

## R0.1 — Peer controls

Shared `ControlRow` / `.ui-control-row` arranges peer page controls on one centre line at 44 px; `size="small"` uses 40 px for small in-card actions. `.ui-control-row-grid` preserves screen-specific grid columns while applying the same control sizing. Labelled field/action rows use `align="end"` / `.is-field-row`. Tabs inside those rows lose their old bottom margin/self-start placement; the entire track is 44 px, with 36 px segment buttons inside. Icons retain their approved widths and match their peer controls' height. Boolean filter chips are 44 px everywhere.
