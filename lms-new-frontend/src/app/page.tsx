"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/core/redux/hooks";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { getDashboardRouteForRole } from "@/lib/roles";
import { all_routes } from "@/routes/all_routes";

export default function HomePage() {
  const { user, hydrated } = useAppSelector((state) => state.auth);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.replace(all_routes.login);
      return;
    }

    router.replace(getDashboardRouteForRole(user.role?.name));
  }, [hydrated, user, router]);

  return <FullScreenLoader />;
}
