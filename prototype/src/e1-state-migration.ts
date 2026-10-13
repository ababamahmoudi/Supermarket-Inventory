import { configSeed } from "./config";
import {
  normalizeRoleDefinitions,
  migrateNotebookACLs,
  normalizeNotebookACL,
  migrateLegacyRoleACL,
} from "./role-config";
import type { DemoState } from "./types";
import type { PersonRecord } from "./authority-types";

/** Additive once-only config/business decoding, before first E1 IDB import. */
export function migrateE1BusinessState(state: DemoState): DemoState {
  if (state.prototype_e1_schema === 1) return state;
  state.config.roles = normalizeRoleDefinitions(
    state.config.roles,
    configSeed.roles,
  );
  if (state.config.notebooks) {
    state.config.notebooks.built_in = state.config.notebooks.built_in.map(
      (notebook) => ({
        ...notebook,
        ...migrateNotebookACLs(notebook),
        name_role_key:
          notebook.kind === "for_supervisor"
            ? "manager"
            : notebook.name_role_key,
      }),
    );
    // Custom creation rights preserve the prior management-only setting.
    const legacyCreation = state.config.notebooks.custom_created_by;
    state.config.notebooks.custom_created_by = normalizeNotebookACL(
      legacyCreation,
    ).filter((role) => role === "owner" || role === "manager");
  }
  state.config.promotions.who_can_create = migrateLegacyRoleACL(
    state.config.promotions.who_can_create,
  );
  state.config.session.accounts_created_by = migrateLegacyRoleACL(
    state.config.session.accounts_created_by,
  );
  state.config.history.revert_roles = migrateLegacyRoleACL(
    state.config.history.revert_roles,
  );
  state.config.session.simulated_authenticator_code ??=
    configSeed.session.simulated_authenticator_code;
  state.notebooks = state.notebooks?.map((notebook) => ({
    ...notebook,
    ...migrateNotebookACLs(notebook),
  }));
  state.offers = state.offers.map((offer) => ({
    ...offer,
    version:
      Number.isSafeInteger(offer.version) && (offer.version ?? 0) > 0
        ? offer.version
        : 1,
  }));
  state.offer_store_suppressions ??= [];
  state.prototype_e1_schema = 1;
  return state;
}

/** Fill known username attribution only after the actual directory exists.
 * Historic names, amounts, records and credential bytes are never rewritten.
 */
export function migrateE1BusinessAttribution(
  state: DemoState,
  people: readonly PersonRecord[],
): void {
  const company = state.config.company.seed_key;
  const findPerson = (username: string | undefined) => {
    if (!username) return undefined;
    const matches = people.filter(
      (person) =>
        person.company_id === company &&
        [person.username, ...person.aliases].includes(username),
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  for (const request of state.sale_requests ?? []) {
    if (request.company_id !== company || request.requester_user_id) continue;
    const person = findPerson(request.requester_username);
    if (person) request.requester_user_id = person.id;
  }
  for (const sale of state.sales ?? []) {
    if (sale.company_id !== company || sale.created_by_user_id) continue;
    const person = findPerson(sale.created_by_username);
    if (person) sale.created_by_user_id = person.id;
  }
  for (const notice of state.notifications ?? []) {
    if (notice.company_id !== company || notice.recipient_user_id) continue;
    const person = findPerson(notice.target_username);
    if (person) notice.recipient_user_id = person.id;
  }
}
