"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { TEACHER_ROLES } from "@/lib/roles";
import TeacherOverviewPage from "@/components/pages/teacher/profile/TeacherOverviewPage";

export default function TeacherOverviewRoute() {
  return (
    <RoleGuard allowedRoles={TEACHER_ROLES}>
      <TeacherOverviewPage />
    </RoleGuard>
  );
}
