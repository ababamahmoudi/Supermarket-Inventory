import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useDemo } from "./store";
import { loadReturnPhoto } from "./return-file-access";

export function ReturnEvidenceImage({
  companyId,
  returnId,
  eventId,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  companyId: string;
  returnId: string;
  eventId: string;
}) {
  const {
    query,
    actor,
    authorityGeneration,
    authorityDirectoryVersion,
    businessRevision,
    locationSelection,
    locked,
  } = useDemo();
  const key = JSON.stringify([
    authorityGeneration,
    authorityDirectoryVersion,
    businessRevision,
    actor?.company_id,
    actor?.user_id,
    actor?.session_id,
    actor?.authority_epoch,
    actor?.person_version,
    actor?.selection,
    locationSelection,
    locked,
    companyId,
    returnId,
    eventId,
  ]);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    url?: string;
    error: boolean;
  }>({ key, error: false });
  const visible = snapshot.key === key && actor && !locked ? snapshot : null;
  const url = visible?.url;
  const error = visible?.error ?? false;
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (actor && !locked)
      void loadReturnPhoto(query, {
        company_id: companyId,
        return_id: returnId,
        event_id: eventId,
      })
        .then((file) => {
          if (active) {
            objectUrl = URL.createObjectURL(file.source);
            setSnapshot({ key, url: objectUrl, error: false });
          }
        })
        .catch(() => {
          if (active) setSnapshot({ key, error: true });
        });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [query, actor, companyId, returnId, eventId, key, locked]);
  return (
    <img
      {...props}
      src={url}
      aria-busy={(!url && !error) || undefined}
      data-file-error={error || undefined}
    />
  );
}
