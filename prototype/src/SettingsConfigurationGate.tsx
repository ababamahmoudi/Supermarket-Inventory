import { Activity, useEffect, useState, type ReactNode } from "react";
import { useDemo } from "./store";
import type { CompanyConfig } from "./types";
import { PageHeader } from "./ui";
import { SettingsConfigurationContext } from "./settings-configuration";

/** This DTO is fetched with fresh settings authority, and cleared on identity changes. */
export function SettingsConfigurationGate({
  children,
}: {
  children: ReactNode;
}) {
  const {
    actor,
    query,
    can,
    t,
    businessRevision,
    authorityGeneration,
    authorityDirectoryVersion,
    locked,
  } = useDemo();
  const [loaded, setLoaded] = useState<{
    identity: string;
    revision: number;
    directoryVersion: number;
    configuration: CompanyConfig;
  } | null>(null);
  const identity = actor
    ? JSON.stringify([
        actor.company_id,
        actor.session_id,
        actor.authority_epoch,
        actor.person_version,
        authorityGeneration,
      ])
    : "";
  const permitted = !locked && can("settings.manage");
  // Updates trigger a fresh query; no credentials or private canonical state enter this context.
  const companyId = actor?.company_id;
  useEffect(() => {
    let current = true;
    if (!identity || !companyId || !permitted) return;
    void query(
      "settings.manage",
      { company_id: companyId, kind: "company_shared" },
      (draft) => structuredClone(draft.config),
    )
      .then((configuration) => {
        if (current)
          setLoaded({
            identity,
            revision: businessRevision,
            directoryVersion: authorityDirectoryVersion,
            configuration,
          });
      })
      .catch(() => {
        if (current) setLoaded(null);
      });
    return () => {
      current = false;
    };
  }, [
    identity,
    companyId,
    permitted,
    businessRevision,
    authorityDirectoryVersion,
    query,
  ]);
  if (!permitted || !actor) return null;
  if (!loaded || loaded.identity !== identity)
    return <PageHeader title={t("Settings", "تنظیمات")} />;
  const refreshing =
    loaded.revision !== businessRevision ||
    loaded.directoryVersion !== authorityDirectoryVersion;
  return (
    <SettingsConfigurationContext.Provider value={loaded.configuration}>
      {refreshing && <PageHeader title={t("Settings", "تنظیمات")} />}
      <Activity mode={refreshing ? "hidden" : "visible"}>{children}</Activity>
    </SettingsConfigurationContext.Provider>
  );
}
