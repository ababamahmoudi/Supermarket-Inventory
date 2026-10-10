import { useDemo } from "./store";
import { Badge } from "./ui";
import {
  returnUiStatusLabel,
  type ReturnClosureSubtype,
  type ReturnUiStatus,
} from "./return-workflow";
import { returnStatusTone } from "./return-status";

export function ReturnStatusBadge({
  status,
  outcome,
}: {
  status: ReturnUiStatus;
  outcome?: ReturnClosureSubtype;
}) {
  const { t } = useDemo();
  return (
    <Badge
      tone={returnStatusTone(status, outcome)}
      data-return-status={status}
      data-return-outcome={outcome}
    >
      {`${returnUiStatusLabel(status, t)}${outcome ? ` (${returnUiStatusLabel(outcome, t)})` : ""}`}
    </Badge>
  );
}
