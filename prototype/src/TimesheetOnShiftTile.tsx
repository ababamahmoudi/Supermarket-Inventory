import { useDemo } from "./store";
import { onShiftNow } from "./timesheets";
import { SummaryTile } from "./SummaryTile";

export function TimesheetOnShiftTile() {
  const { actor, state, can, branch, navigate, t } = useDemo();
  if (
    !actor ||
    !["owner", "manager", "branch_supervisor"].includes(actor.role) ||
    state.config.modules.timesheets === false ||
    !can("timesheets.read")
  )
    return null;
  const count = branch === "all" ? null : onShiftNow(state, branch);
  return (
    <SummaryTile
      className="dashboard-summary-tile timesheet-on-shift-tile"
      label={t("On shift now", "اکنون در حال کار")}
      value={count ?? "—"}
      detailLines={2}
      detail={
        count === null
          ? t("Choose a branch", "یک شعبه انتخاب کنید")
          : t(`${count} without Out time`, `${count} نفر بدون زمان خروج`)
      }
      tone={count ? "accent" : "approved"}
      onClick={() => navigate("timesheets")}
    />
  );
}
