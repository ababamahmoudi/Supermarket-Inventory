import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDemo } from "./store";
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import type { DemoState } from "./types";

interface QuerySnapshot<T> {
  key: string;
  requestToken: object;
  data: T | null;
  error: unknown;
  pending: boolean;
}

/**
 * A cached DTO is visible only for the current genuine session and revision.
 * Callers select from the callback's canonical state; the public read view is
 * never cast into a command/query state. requestKey includes selector inputs.
 */
export function useProtectedQuery<T>(
  capability: Capability | null,
  scope: ResourceScope,
  project: (canonical: DemoState, actor: AuthenticatedActor) => T,
  requestKey: string,
) {
  const {
    actor,
    can,
    query,
    authorityGeneration,
    businessRevision,
    authorityDirectoryVersion,
    locationSelection,
    locked,
  } = useDemo();
  const [reloadRevision, setReloadRevision] = useState(0);
  const latest = useRef({ query, scope, project });
  useEffect(() => {
    latest.current = { query, scope, project };
  }, [query, scope, project]);
  const permitted = Boolean(
    actor && !locked && capability && can(capability, scope),
  );
  const key = JSON.stringify([
    capability,
    requestKey,
    scope,
    actor?.company_id,
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    authorityGeneration,
    businessRevision,
    authorityDirectoryVersion,
    locationSelection,
    permitted,
    reloadRevision,
  ]);
  // A returning request key is a new request, not permission to reuse an old
  // DTO while its replacement is pending. No private data enters this token.
  const requestToken = useMemo(() => ({ key }), [key]);
  const [snapshot, setSnapshot] = useState<QuerySnapshot<T> | null>(null);
  useEffect(() => {
    let current = true;
    if (!permitted || !capability) {
      return () => {
        current = false;
      };
    }
    const request = latest.current;
    void request.query(capability, request.scope, request.project).then(
      (data) => {
        if (current)
          setSnapshot({ key, requestToken, data, error: null, pending: false });
      },
      (error: unknown) => {
        if (current)
          setSnapshot({ key, requestToken, data: null, error, pending: false });
      },
    );
    return () => {
      current = false;
    };
  }, [key, permitted, capability, requestToken]);
  const reload = useCallback(
    () => setReloadRevision((revision) => revision + 1),
    [],
  );
  const visible =
    snapshot?.key === key && snapshot.requestToken === requestToken && permitted
      ? snapshot
      : null;
  return {
    data: visible?.data ?? null,
    error: visible?.error ?? null,
    pending: permitted && (visible?.pending ?? true),
    reload,
  };
}
