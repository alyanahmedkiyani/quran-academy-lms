"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { TEACHER_ROLES } from "@/lib/roles";
import TeacherProfileSettings from "@/components/pages/teacher/profile/TeacherProfileSettings";

export default function TeacherProfilePage() {
  return (
    <RoleGuard allowedRoles={TEACHER_ROLES}>
      <TeacherProfileSettings />
    </RoleGuard>
  );
}
