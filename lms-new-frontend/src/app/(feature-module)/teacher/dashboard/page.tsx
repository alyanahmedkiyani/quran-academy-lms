"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { TEACHER_ROLES } from "@/lib/roles";
import TeacherDashboard from "@/components/pages/teacher/dashboard/TeacherDashboard";

export default function TeacherDashboardPage() {
  return (
    <RoleGuard allowedRoles={TEACHER_ROLES}>
      <TeacherDashboard />
    </RoleGuard>
  );
}
