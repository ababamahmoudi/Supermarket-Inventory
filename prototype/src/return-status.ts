import type { ReturnClosureSubtype, ReturnUiStatus } from "./return-workflow";

/** Tones follow the displayed outcome, never the retained internal workflow state. */
export function returnStatusTone(
  status: ReturnUiStatus,
  outcome?: ReturnClosureSubtype,
) {
  if (status === "waiting_for_pickup") return "info";
  if (status === "waiting_for_credit") return "pending";
  if (status === "closed" && outcome !== "written_off") return "approved";
  return "neutral";
}
