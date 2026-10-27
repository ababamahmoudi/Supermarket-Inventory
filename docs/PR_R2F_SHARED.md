# R2f shared alignment review

## R0.1 — Peer controls

Shared `ControlRow` / `.ui-control-row` arranges peer page controls on one centre line at 44 px; `size="small"` uses 40 px for small in-card actions. `.ui-control-row-grid` preserves screen-specific grid columns while applying the same control sizing. Labelled field/action rows use `align="end"` / `.is-field-row`. Tabs inside those rows lose their old bottom margin/self-start placement; the entire track is 44 px, with 36 px segment buttons inside. Icons retain their approved widths and match their peer controls' height. Boolean filter chips are 44 px everywhere.

## R0.2 — Card and table edges

Shared outer table padding is zero; the existing 12 px inner padding still separates columns by 24 px. First/last text and row rules meet the same card-content edges as the title/filter row. The same edge rule covers dedicated receiving/posted/batch tables. Numeric captions retain the shared logical end alignment and zero-padding sort buttons from R2e B1.

## R0.3 — Number baselines

`NumberGroup` / `.ui-number-group` owns three shared tracks: label, value and note. `NumberStat` uses display contents so differently sized values align on the same parent-grid baseline; optional column placement supports the approved arrow/divider layout. A quiet empty note preserves the common note track. Approved reusable typography tokens capture the 17/26 px approval values and 36/18 px weight Lookup hierarchy; existing ordinary Lookup typography is unchanged.

## R0.4 — Neighbouring cards

`CardHeader` / `.ui-card-header` reserves at least 44 px whether actions exist or not. `.ui-card-row` stretches two neighbouring cards to the same height and becomes one column on a phone. These compose real paired cards rather than forcing masonry departments to the same height; the approved Timesheets design deliberately keeps independent department heights and its compact baseline-aligned heading.

## R0.5 — Plain column values

Shared `ColumnValue` / `.ui-column-value` keeps dates/numbers as plain text with no pill padding or background. Pending/danger/muted tones use existing tokens. Status badges remain status badges; an amber expiry value now preserves its column's actual text edge.

## R0.6 — Icons beside title/subtitle

`IconText` / `.ui-icon-text` centres an icon on the whole title/subtitle block. The copy remains a two-line grid and the icon does not shrink. Existing approved icon size, colour and circle treatment remain the caller's ordinary tokens/composition; centring is shared.
