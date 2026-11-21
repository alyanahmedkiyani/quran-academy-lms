"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { STUDENT_ROLES } from "@/lib/roles";
import StudentOverviewPage from "@/components/pages/student/profile/StudentOverviewPage";

export default function StudentOverviewRoute() {
  return (
    <RoleGuard allowedRoles={STUDENT_ROLES}>
      <StudentOverviewPage />
    </RoleGuard>
  );
}
