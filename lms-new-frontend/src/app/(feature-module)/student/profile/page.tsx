"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { STUDENT_ROLES } from "@/lib/roles";
import StudentProfileSettings from "@/components/pages/student/profile/StudentProfileSettings";

export default function StudentProfilePage() {
  return (
    <RoleGuard allowedRoles={STUDENT_ROLES}>
      <StudentProfileSettings />
    </RoleGuard>
  );
}
