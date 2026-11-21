"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { STUDENT_ROLES } from "@/lib/roles";
import StudentDashboard from "@/components/pages/student/dashboard/StudentDashboard";

export default function StudentDashboardPage() {
  return (
    <RoleGuard allowedRoles={STUDENT_ROLES}>
      <StudentDashboard />
    </RoleGuard>
  );
}
