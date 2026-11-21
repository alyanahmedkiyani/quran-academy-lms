"use client";

import DashboardComponent from "@/components/pages/dashboard/dashboard/dashboard";
import RoleGuard from "@/components/auth/RoleGuard";
import { ADMIN_CORE_ROLES } from "@/lib/roles";

export default function AdminDashboard() {
  return (
    <RoleGuard allowedRoles={ADMIN_CORE_ROLES}>
      <DashboardComponent />
    </RoleGuard>
  );
}
