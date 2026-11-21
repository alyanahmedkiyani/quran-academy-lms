"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { STUDENT_ROLES } from "@/lib/roles";
import StudentFees from "@/components/pages/fees/StudentFees";

export default function StudentFeesPage() {
  return (
    <RoleGuard allowedRoles={STUDENT_ROLES}>
      <StudentFees />
    </RoleGuard>
  );
}
