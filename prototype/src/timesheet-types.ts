export interface TimesheetDepartment {
  key: string;
  name_en: string;
  name_fa: string;
  order: number;
}
export interface TimesheetSettings {
  departments: TimesheetDepartment[];
}

export class TimesheetError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "module"
      | "company"
      | "location"
      | "date"
      | "time"
      | "department"
      | "staff"
      | "row"
      | "name"
      | "person"
      | "conflict"
      | "settings",
  ) {
    super(code);
    this.name = "TimesheetError";
  }
}
export interface TimesheetStaff {
  id: string;
  company_id: string;
  branch: string;
  branch_id: string;
  name_en: string;
  name_fa?: string;
  usual_department_key: string;
  app_person_id?: string;
  status: "active" | "archived";
  version: number;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  updated_by_user_id: string;
}
export interface TimesheetDay {
  id: string;
  company_id: string;
  branch: string;
  branch_id: string;
  date: string;
  notes: string;
  version: number;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  updated_by_user_id: string;
}
export interface TimesheetRow {
  id: string;
  company_id: string;
  branch: string;
  branch_id: string;
  day_id: string;
  date: string;
  department_key: string;
  department_name_en: string;
  department_name_fa: string;
  staff_id: string;
  name_en: string;
  name_fa?: string;
  in_time: string;
  out_time: string;
  version: number;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  updated_by_user_id: string;
  removed_at?: string;
  removed_by_user_id?: string;
}
export interface TimesheetDuration {
  minutes: number;
  overnight: boolean;
  on_shift: boolean;
  warning: "out_missing" | "long_shift" | null;
}
export interface TimesheetRowRead extends TimesheetRow, TimesheetDuration {}
export interface TimesheetDepartmentRead extends TimesheetDepartment {
  rows: TimesheetRowRead[];
  people_count: number;
  minutes: number;
  retained?: boolean;
}
export interface TimesheetDayRead {
  company_id: string;
  branch: string;
  date: string;
  day: TimesheetDay | null;
  staff: TimesheetStaff[];
  departments: TimesheetDepartmentRead[];
  people_count: number;
  minutes: number;
  history: import("./types").Activity[];
}
export interface TimesheetWeekStaffRead {
  staff_id: string;
  name_en: string;
  name_fa?: string;
  department_key: string;
  department_name_en: string;
  department_name_fa: string;
  days: { date: string; minutes: number; rows: TimesheetRowRead[] }[];
  minutes: number;
}
export interface TimesheetWeekRead {
  company_id: string;
  branch: string;
  start_date: string;
  end_date: string;
  dates: string[];
  staff: TimesheetWeekStaffRead[];
  departments: {
    key: string;
    name_en: string;
    name_fa: string;
    minutes: number;
    days: number[];
  }[];
  minutes: number;
  days: number[];
}
