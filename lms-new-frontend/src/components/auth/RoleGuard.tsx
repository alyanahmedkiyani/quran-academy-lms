"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/core/redux/hooks";
import FullScreenLoader from "../common/FullScreenLoader";
import { getDashboardRouteForRole } from "@/lib/roles";
import { RoleName } from "@/types/auth";
import { getLoginRouteForPath } from "@/lib/routing";

type Props = {
  children: ReactNode;
  allowedRoles?: RoleName[];
  fallbackRoute?: string;
};

const RoleGuard = ({ children, allowedRoles, fallbackRoute }: Props) => {
  const { user, hydrated } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const pathname = usePathname();
  const loginRoute = getLoginRouteForPath(pathname);

  const roleName = user?.role?.name ?? null;
  const userType = user?.userType ?? null;
  const isAllowed =
    !allowedRoles ||
    (roleName ? allowedRoles.includes(roleName) : false) ||
    (userType ? allowedRoles.includes(userType) : false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace(loginRoute);
      return;
    }
    if (!isAllowed) {
      const redirectTo =
        fallbackRoute ?? getDashboardRouteForRole(roleName ?? undefined);
      router.replace(redirectTo);
    }
  }, [hydrated, user, isAllowed, router, fallbackRoute, roleName]);

  if (!hydrated || !user || !isAllowed) {
    return <FullScreenLoader label="Loading access..." />;
  }

  return <>{children}</>;
};

export default RoleGuard;

