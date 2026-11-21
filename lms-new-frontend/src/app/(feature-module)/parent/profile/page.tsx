"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { PARENT_ROLES } from "@/lib/roles";
import ParentProfileSettings from "@/components/pages/parent/profile/ParentProfileSettings";

export default function ParentProfilePage() {
  return (
    <RoleGuard allowedRoles={PARENT_ROLES}>
      <ParentProfileSettings />
    </RoleGuard>
  );
}
