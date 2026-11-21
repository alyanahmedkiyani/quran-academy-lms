"use client";

import { useAppSelector } from "@/core/redux/hooks";
import LMSCalendar from "@/components/pages/schedule/LMSCalendar";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";

export default function AdminClassSchedulePage() {
  const user = useAppSelector((state) => state.auth.user);

  usePermissionGuard(PERMISSIONS.SCHEDULE_VIEW);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canManage = canAccess(roleName, permissions, PERMISSIONS.SCHEDULE_MANAGE);

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <LMSCalendar role="admin" userId={String(user.id)} canManage={canManage} />;
}
