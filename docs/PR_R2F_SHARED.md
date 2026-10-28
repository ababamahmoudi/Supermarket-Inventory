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

R0.1 compact controls may pass the actual popup body's minimum height/gap to shared `usePopover`; defaults remain 240/8 px for existing menus, while the one-option Timesheet Now popup uses 56/6 px and still flips/clamps when needed. Shared AutoTextarea/BufferedTextarea accepts an explicit minimum height for the approved 72 px Notes field, retaining the six-line cap and default two-line behaviour elsewhere.

## R0.7 — Rendered alignment proof

`tests/r2f-alignment.ts` ports the approved `align.js` peer-pair and table/grid grouping algorithm. It keeps the 48 px adjacency and half-height-overlap checks, fails above 1.5 px centre/column spread or 2 px height difference, and resolves logical text edges in RTL. Actual glyph ranges avoid padded-container false passes; centred editable columns compare their field centres. Extra probes check real number baselines, icon/title/subtitle centres, composed card headers/paired heights and plain column values.

Exceptions are registered by scene and exact semantic selector with a reason, reported with use counts. They distinguish controls in separate masonry departments/dashboard stacks, retain approved contextual Type chips and canonical status dots as complete value probes, compare decorative activity-avatar centres, and identify the approved 24 px inline request-note action. They do not waive a whole screen, table or numeric column. Unregistered caller exceptions are rejected. The oracle's browser negative controls deliberately shift real geometry in LTR/RTL and prove failures before restoring it.

Direct row icon buttons use a square target matching the peer control height (44/40 px). The approved narrow Timesheet menu may explicitly retain a compact width; it still has a 44 px height. Other row icons cannot inherit the old 36 px width.

Independent-column exceptions require actual horizontal separation. Dashboard additionally requires a real grid with at least two computed columns; phone/display-contents/same-column wrappers receive no exemption. Negative controls reproduce the real semantic wrappers and prove same-column/phone overlaps still fail. Visibility uses actual browser visibility/content-visibility plus the closed-details rule, retaining summary content: controls hidden inside a closed disclosure cannot create false peer pairs, and opening a misaligned pair makes it fail. The Original invoice # column uses one documented complete status-icon/row-number probe; its financial columns remain actual glyph checks.

The grid control-row utility decorates an existing screen grid and leaves its display mode to that composition, so a phone-only hidden column header stays hidden. It supplies shared heights/centres without overriding responsive visibility.

The Dashboard decision column uses the approved real control-group edge, with its deliberately blank heading and centred Approve/Review captions. This is an exact semantic probe, not an ignored Actions column: a four-pixel group shift fails in both directions, while all peer button heights/centres and numeric columns remain strict.

Registered fixed/absolute popups add separate audit render planes to the source's main/dialog scope. Controls behind an overlay are not its peers; controls within each actual popup still use the same strict 1.5/2 px limits. A negative control proves a 40/44 px mismatch inside the popup fails, while an actual background/footer cannot create a false cross-plane pair. A static element cannot claim the registered overlay-plane contract.

The shared FilterChip offers a neutral idle appearance for the approved Lookup row while other lists retain the existing surface idle appearance. Both use the same reserved check, pressed-state accent, keyboard toggle, 44 px height and token palette; no screen overrides a shared chip style.

DataTable also offers the approved medium list density: 48 px body rows and a 32 px heading track on desktop, using the same shared column padding/edges. Existing default/compact densities and phone record layouts keep their prior contract. Lookup's location table consumes this shared option instead of restyling a table on one screen.
