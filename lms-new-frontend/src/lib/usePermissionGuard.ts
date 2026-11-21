"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/core/redux/hooks";
import { canAccess } from "@/lib/permissions";
import { getDashboardRouteForRole } from "@/lib/roles";

/**
 * Redirects the user to their dashboard if they don't have the required permission.
 * Call this at the top of any admin page component that requires a specific permission.
 *
 * @example
 *   usePermissionGuard('students:view');
 */
export const usePermissionGuard = (requiredPermission: string) => {
  const { user, hydrated } = useAppSelector((state) => state.auth);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) return; // layout.tsx already handles the no-user redirect

    const roleName = user.role?.name ?? null;
    const permissions = user.permissions ?? [];

    if (!canAccess(roleName, permissions, requiredPermission)) {
      router.replace(getDashboardRouteForRole(roleName));
    }
  }, [hydrated, user, requiredPermission, router]);
};
