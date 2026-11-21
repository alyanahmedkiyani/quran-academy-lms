import Cookies from 'js-cookie';
import { UserWithPermissions } from '@/types/auth';

const TOKEN_KEY = 'hms:access-token';
const USER_KEY = 'hms:user';
const COOKIE_EXPIRATION_DAYS = 1; // refresh token via backend if needed
const isBrowser = typeof window !== 'undefined';

export interface StoredAuthPayload {
  user: UserWithPermissions;
  token: string;
}

export const persistAuth = ({ user, token }: StoredAuthPayload) => {
  if (!isBrowser) return;

  Cookies.set(TOKEN_KEY, token, {
    sameSite: 'lax',
    expires: COOKIE_EXPIRATION_DAYS,
    secure: window.location.protocol === 'https:',
  });

  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Swallow storage errors (e.g., Safari private mode)
  }
};

export const clearAuthStorage = () => {
  if (!isBrowser) return;

  Cookies.remove(TOKEN_KEY);
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
};

export const getStoredAuth = (): StoredAuthPayload | null => {
  if (!isBrowser) {
    return null;
  }
  const token = Cookies.get(TOKEN_KEY);
  if (!token) {
    return null;
  }
  try {
    const rawUser = window.localStorage.getItem(USER_KEY);
    if (!rawUser) {
      return null;
    }
    const user = JSON.parse(rawUser) as UserWithPermissions;
    return { user, token };
  } catch {
    return null;
  }
};

export const getAccessToken = () => {
  if (!isBrowser) {
    return null;
  }
  return Cookies.get(TOKEN_KEY) ?? null;
};

