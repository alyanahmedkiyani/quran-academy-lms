import { all_routes } from '@/routes/all_routes';

/**
 * Returns the correct login page URL for a given protected path.
 * - /student/* → /login          (student login)
 * - /teacher/* → /teacher/login
 * - /parent/*  → /parent/login
 * - everything else → /admin/login
 */
export const getLoginRouteForPath = (pathname?: string | null): string => {
  if (!pathname) {
    return all_routes.adminLogin ?? all_routes.login;
  }

  if (pathname.startsWith('/student')) return all_routes.login;
  if (pathname.startsWith('/teacher')) return all_routes.teacherLogin;
  if (pathname.startsWith('/parent'))  return all_routes.parentLogin;

  return all_routes.adminLogin ?? all_routes.login;
};

