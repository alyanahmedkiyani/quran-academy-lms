"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { PARENT_ROLES } from "@/lib/roles";
import ParentDashboard from "@/components/pages/parent/dashboard/ParentDashboard";

export default function ParentDashboardPage() {
  return (
    <RoleGuard allowedRoles={PARENT_ROLES}>
      <ParentDashboard />
    </RoleGuard>
  );
}
