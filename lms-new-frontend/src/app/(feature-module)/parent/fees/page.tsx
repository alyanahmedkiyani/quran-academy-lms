"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import { PARENT_ROLES } from "@/lib/roles";
import ParentFees from "@/components/pages/fees/ParentFees";

export default function ParentFeesPage() {
  return (
    <RoleGuard allowedRoles={PARENT_ROLES}>
      <ParentFees />
    </RoleGuard>
  );
}
