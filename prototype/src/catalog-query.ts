import { useEffect, useRef, useState } from "react";
import { useDemo } from "./store";
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import type { DemoState } from "./types";
export {
  productFinancialSnapshot,
  newProductPricePreview,
} from "./catalog-private-projections";

/** A protected query result is withheld immediately when its authority/input changes. */
export function useCatalogQuery<T>(
  capability: Capability,
  scope: ResourceScope,
  inputKey: string,
  project: (state: DemoState, actor: AuthenticatedActor) => T,
) {
  const {
    actor,
    query,
    can: may,
    businessRevision,
    authorityGeneration,
    authorityDirectoryVersion,
    branch,
  } = useDemo();
  const key = JSON.stringify([
    capability,
    scope,
    inputKey,
    actor?.user_id,
    actor?.authority_epoch,
    businessRevision,
    authorityGeneration,
    authorityDirectoryVersion,
    branch,
  ]);
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: unknown;
  }>();
  const allowed = !!actor && may(capability, scope);
  useEffect(() => {
    if (!allowed) return;
    let abandoned = false;
    const currentProject = projectRef.current;
    void query(capability, scope, (draft, freshActor) =>
      currentProject(draft, freshActor),
    ).then(
      (data) => {
        if (!abandoned) setResult({ key, data });
      },
      (error) => {
        if (!abandoned) setResult({ key, error });
      },
    );
    return () => {
      abandoned = true;
    };
    // The serialized key includes every scope, authority and input dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, key, query]);
  const current = allowed && result?.key === key ? result : undefined;
  return {
    key,
    data: current?.data,
    error: current?.error,
    ready: !!current,
    allowed,
  };
}
