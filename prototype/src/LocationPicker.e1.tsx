import { useState } from "react";
import { MapPin } from "lucide-react";
import { useDemo } from "./store";
import { configuredLocations } from "./authority";
import { Select } from "./ui";
import { branchLabel } from "./settings";
import type { LocationSelection } from "./authority-types";

const selectionKey = (selection: LocationSelection | null) =>
  selection?.kind === "location"
    ? `location:${selection.location_id}`
    : (selection?.kind ?? "");
export default function LocationPicker() {
  const { state, actor, locationSelection, setLocation, lang, t } = useDemo();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!actor) return null;
  // The picker uses display metadata; setLocation independently rechecks IDB.
  const ids = configuredLocations(state)
    .filter(
      (location) =>
        location.active !== false &&
        actor.allowed_branches.includes(location.id),
    )
    .map((location) => location.id);
  const options = ids.map((id) => ({
    value: `location:${id}`,
    label: branchLabel(state.config, id, lang),
  }));
  if (actor.location_scope.kind === "company")
    options.push({
      value: "all_locations",
      label: t("All locations", "همه مکان‌ها"),
    });
  else if (ids.length > 1)
    options.push({
      value: "all_my_locations",
      label: t("All my locations", "همه مکان‌های من"),
    });
  return (
    <>
      <Select
        aria-label={t("Location", "مکان")}
        className="branch-pill"
        leadingIcon={<MapPin size={16} />}
        value={selectionKey(locationSelection)}
        disabled={pending}
        options={options}
        onChange={(value) => {
          const selection: LocationSelection = value.startsWith("location:")
            ? { kind: "location", location_id: value.slice(9) }
            : value === "all_locations"
              ? { kind: "all_locations" }
              : { kind: "all_my_locations" };
          setPending(true);
          setError("");
          void setLocation(selection)
            .catch(() =>
              setError(
                t(
                  "Choose an allowed location.",
                  "یک مکان مجاز را انتخاب کنید.",
                ),
              ),
            )
            .finally(() => setPending(false));
        }}
      />
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </>
  );
}
