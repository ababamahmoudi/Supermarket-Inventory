import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { AuthenticatedActor } from "./authority-types";

type SearchIdentity = Pick<
  AuthenticatedActor,
  | "company_id"
  | "user_id"
  | "session_id"
  | "role"
  | "authority_epoch"
  | "person_version"
>;

// Only input text survives a transient protected-view remount. Never retain
// products, package selections, location facts, prices or private query DTOs.
const drafts = new Map<string, { hash: string; search: string }>();
let watchingRoute = false;
function discardDraft(key: string) {
  drafts.delete(key);
  if (!drafts.size && watchingRoute) {
    window.removeEventListener("hashchange", discardOtherRoutes);
    watchingRoute = false;
  }
}
function discardOtherRoutes(event: HashChangeEvent) {
  const destination = event.newURL
    ? new URL(event.newURL).hash
    : window.location.hash;
  for (const [key, draft] of drafts)
    if (draft.hash !== destination) discardDraft(key);
}
function rememberDraft(key: string, search: string) {
  // One current input, bounded independently of sessions or branch switches.
  drafts.clear();
  drafts.set(key, { hash: window.location.hash, search });
  if (!watchingRoute) {
    // This observer must survive a protected-view remount: a user can navigate
    // away while no Lookup widget exists to run its own cleanup.
    window.addEventListener("hashchange", discardOtherRoutes);
    watchingRoute = true;
  }
}

export function useLookupSearchDraft(
  actor: SearchIdentity | null,
  initialSearch: () => string,
): [string, (value: string) => void] {
  const key = actor
    ? JSON.stringify([
        actor.company_id,
        actor.user_id,
        actor.session_id,
        actor.role,
        actor.authority_epoch,
        actor.person_version,
      ])
    : "";
  const currentKey = useRef(key);
  useLayoutEffect(() => {
    currentKey.current = key;
  }, [key]);
  const read = () => {
    const saved = key ? drafts.get(key) : undefined;
    return saved?.hash === window.location.hash
      ? saved.search
      : initialSearch();
  };
  const [entry, setEntry] = useState(() => ({ key, search: read() }));
  if (entry.key !== key) setEntry({ key, search: read() });
  const setSearch = useCallback(
    (value: string) => {
      if (currentKey.current !== key) return;
      if (key) rememberDraft(key, value);
      setEntry({ key, search: value });
    },
    [key],
  );
  useEffect(
    () => () => {
      if (
        currentKey.current !== key ||
        drafts.get(key)?.hash !== window.location.hash
      )
        discardDraft(key);
    },
    [key],
  );
  return [entry.search, setSearch];
}
