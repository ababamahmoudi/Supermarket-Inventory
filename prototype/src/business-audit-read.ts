/** Private authentication data never belongs in a business read model or export. */
const privateAuthorityKeys = new Set([
  "pricingquote",
  "authority",
  "authoritysnapshot",
  "privateauthority",
  "directory",
  "directorysnapshot",
  "people",
  "person",
  "sessions",
  "session",
  "credentials",
  "credential",
  "challenges",
  "challenge",
  "sessionid",
  "authorityepoch",
  "personversion",
  "authenticatedat",
  "secondstepverifiedat",
  "setup",
  "setupcomplete",
  "setupcode",
  "onetimesetupcode",
  "passwordcomplete",
  "secondstepcomplete",
  "secondstepmethod",
  "password",
  "passwordhash",
  "passwordsalt",
  "passwordorsetupcode",
  "recoverycodes",
  "authenticatorsecret",
  "passkeycredential",
  "selectedlocation",
  "locationscope",
  "allowedbranches",
  "aliases",
  "lastsigninat",
]);
const decisionSnapshotKeys = new Set([
  "user_id",
  "company_id",
  "username",
  "name_snapshot",
  "role_snapshot",
  "device_id",
  "at",
]);
const normalized = (key: string) => key.replace(/[_\s-]/g, "").toLowerCase();

export function privateAuthorityField(key: string): boolean {
  return key
    .split(/[.[\]]/)
    .some((part) => privateAuthorityKeys.has(normalized(part)));
}

/** Matching source references stay internal in every audit/export projection. */
const privateMatchingKeys = new Set([
  "printeddescriptionkeys",
  "freecasegroup",
  "acquisitionbasis",
  "acquisitionamount",
  "sourceinvoiceids",
  "retainedoriginalpages",
]);
function privateAuditField(key: string): boolean {
  return (
    privateAuthorityField(key) ||
    key
      .split(/[.[\]·]/)
      .some((part) => privateMatchingKeys.has(normalized(part)))
  );
}

function publicValue(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value))
    return value.map((item) => publicValue(item, parentKey));
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const decision = Boolean(
    parentKey &&
    ["decisionattribution", "sourcedecision"].includes(normalized(parentKey)),
  );
  const authorityObject = Object.keys(record).some((key) =>
    privateAuthorityField(key),
  );
  const pathIsPrivate = (path: unknown) =>
    Array.isArray(path) &&
    path.some((part) =>
      typeof part === "string"
        ? privateAuditField(part)
        : part &&
          typeof part === "object" &&
          "key" in part &&
          privateAuditField(String(part.key)),
    );
  const privatePath =
    pathIsPrivate(record.path) ||
    (record.patch !== null &&
      typeof record.patch === "object" &&
      "path" in record.patch &&
      pathIsPrivate(record.patch.path));
  return Object.fromEntries(
    Object.entries(record)
      .filter(
        ([key]) =>
          !privateAuditField(key) &&
          (!decision || decisionSnapshotKeys.has(key)) &&
          !(authorityObject && ["phone", "email"].includes(key)) &&
          !(
            privatePath &&
            ["before", "after", "guards", "current"].includes(key)
          ),
      )
      .map(([key, item]) => [
        key,
        privatePath && key === "path" ? [] : publicValue(item, key),
      ]),
  );
}

/** Copies audit DTOs only; never alters retained canonical evidence or grants authority. */
export function businessAuditRead<T>(value: T): T {
  return publicValue(value) as T;
}
