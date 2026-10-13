import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { allowedLocationIds, can } from "./permissions";
import type { DemoState, LabelTemplate, LabelWaitlistItem } from "./types";

export type LabelTemplateReadDTO = Pick<
  LabelTemplate,
  | "id"
  | "company_id"
  | "name"
  | "width"
  | "height"
  | "margin_top"
  | "margin_bottom"
  | "margin_left"
  | "margin_right"
  | "gap_x"
  | "gap_y"
  | "offset_x"
  | "offset_y"
  | "archived"
  | "style"
  | "built_in"
>;
export function projectLabelTemplateReadDTO(
  template: LabelTemplate,
): LabelTemplateReadDTO {
  return {
    id: template.id,
    company_id: template.company_id,
    name: template.name,
    width: template.width,
    height: template.height,
    margin_top: template.margin_top,
    margin_bottom: template.margin_bottom,
    margin_left: template.margin_left,
    margin_right: template.margin_right,
    gap_x: template.gap_x,
    gap_y: template.gap_y,
    offset_x: template.offset_x,
    offset_y: template.offset_y,
    archived: template.archived,
    style: template.style,
    built_in: template.built_in,
  };
}
export type LabelWaitlistReadDTO = Pick<
  LabelWaitlistItem,
  | "id"
  | "company_id"
  | "branch"
  | "branch_id"
  | "product_code"
  | "lot_id"
  | "copies"
  | "added_by"
  | "added_by_user_id"
  | "added_at"
  | "preferred_template"
  | "source_event_id"
  | "source_reason"
>;
export interface LabelsReadProjection {
  templates: LabelTemplateReadDTO[];
  label_waitlist: LabelWaitlistReadDTO[];
  label_settings: DemoState["label_settings"];
}
export function projectLabelsReadView(
  state: DemoState,
  actor: AuthenticatedActor,
): LabelsReadProjection {
  const current = freshActor(state, actor);
  if (!can(state, current, "labels.read").allowed)
    return { templates: [], label_waitlist: [], label_settings: undefined };
  const allowed = allowedLocationIds(state, current, { includeInactive: true });
  const locations = new Set(
    current.branch === "all"
      ? allowed
      : allowed.filter((id) => id === current.branch),
  );
  const settings = state.label_settings;
  return {
    templates: state.templates
      .filter((template) => template.company_id === current.company_id)
      .map(projectLabelTemplateReadDTO),
    label_waitlist: (state.label_waitlist ?? [])
      .filter(
        (entry) =>
          entry.company_id === current.company_id &&
          locations.has(entry.branch),
      )
      .map((entry) => ({
        id: entry.id,
        company_id: entry.company_id,
        branch: entry.branch,
        branch_id: entry.branch_id,
        product_code: entry.product_code,
        lot_id: entry.lot_id,
        copies: entry.copies,
        added_by: entry.added_by,
        added_by_user_id: entry.added_by_user_id,
        added_at: entry.added_at,
        preferred_template: entry.preferred_template,
        source_event_id: entry.source_event_id,
        source_reason: entry.source_reason,
      })),
    label_settings: settings && {
      recent_price_days: settings.recent_price_days,
      auto_add_approved: settings.auto_add_approved,
      fields: settings.fields && {
        name: settings.fields.name,
        description: settings.fields.description,
        price: settings.fields.price,
        offer: settings.fields.offer,
        code: settings.fields.code,
        logo: settings.fields.logo,
        unit: settings.fields.unit,
        tax: settings.fields.tax,
      },
      languages: settings.languages && [...settings.languages],
    },
  };
}
