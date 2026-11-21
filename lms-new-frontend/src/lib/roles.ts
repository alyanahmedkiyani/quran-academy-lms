import { all_routes } from "@/routes/all_routes";
import { RoleName } from "@/types/auth";

export const ADMIN_CORE_ROLES: RoleName[] = ["SUPER_ADMIN", "ADMIN"];
export const STUDENT_ROLES: RoleName[] = ["STUDENT"];
export const TEACHER_ROLES: RoleName[] = ["TEACHER"];
export const PARENT_ROLES: RoleName[] = ["PARENT"];
export const DOCTOR_ROLES: RoleName[] = ["DOCTOR"];
export const PATIENT_ROLES: RoleName[] = ["PATIENT"];

const roleDashboardMap: Partial<Record<RoleName, string>> = {
  SUPER_ADMIN: all_routes.dashboard,
  ADMIN: all_routes.dashboard,
  TEACHER: all_routes.teacherDashboard,
  STUDENT: all_routes.studentDashboard,
  PARENT: all_routes.parentDashboard,
};

export const getDashboardRouteForRole = (role?: RoleName | null) => {
  if (!role) return all_routes.dashboard;
  return roleDashboardMap[role] ?? all_routes.dashboard;
};

export const isAdminAuthorityRole = (role?: RoleName | null) => {
  if (!role) return false;
  return role === "SUPER_ADMIN" || role === "ADMIN";
};

export const isStudentRole = (role?: RoleName | null) => {
  if (!role) return false;
  return role === "STUDENT";
};

export const isTeacherRole = (role?: RoleName | null) => {
  if (!role) return false;
  return role === "TEACHER";
};

export const isParentRole = (role?: RoleName | null) => {
  if (!role) return false;
  return role === "PARENT";
};
