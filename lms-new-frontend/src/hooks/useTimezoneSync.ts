"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { patchUserTimezone } from "@/core/redux/authSlice";
import { persistAuth } from "@/lib/auth-storage";
import { api_base_url, withAuthorization } from "@/services/apiClient";

/**
 * Detects the browser's IANA timezone once per session and syncs it to the
 * user's profile (Redux + localStorage + DB) when it differs from the stored
 * value. This ensures the calendar always shows times in the user's actual
 * local timezone regardless of whether an admin manually set the timeZone DB
 * field.
 *
 * - Fire-and-forget: the DB call is non-blocking and non-critical.
 * - Admin accounts have no timeZone column — Redux/localStorage only.
 * - Runs exactly once after auth hydration per session (deps: user.id + user.timeZone).
 */
export function useTimezoneSync() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.token);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  useEffect(() => {
    if (!hydrated || !user || !token) return;

    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (user.timeZone === browserTz) return; // already in sync — nothing to do

    const userType = (user.userType ?? "").toUpperCase();
    const userId = user.id;

    // Build the profile-update endpoint for roles that have a timeZone DB column
    let endpoint: string | null = null;
    if (userType === "STUDENT") endpoint = `${api_base_url}/student/update/${userId}`;
    else if (userType === "TEACHER") endpoint = `${api_base_url}/teacher/update/${userId}`;
    else if (userType === "PARENT") endpoint = `${api_base_url}/parent/update/${userId}`;
    // ADMIN: no timeZone column — update Redux + localStorage only

    // 1. Update Redux immediately so the calendar uses the correct timezone
    //    on this render cycle without waiting for the API round-trip.
    dispatch(patchUserTimezone({ timeZone: browserTz }));

    // 2. Re-persist the updated user to localStorage so it survives a refresh.
    persistAuth({ user: { ...user, timeZone: browserTz }, token });

    // 3. Persist to DB (fire-and-forget — non-critical if this fails).
    if (endpoint) {
      fetch(endpoint, {
        method: "PUT",
        headers: withAuthorization(),
        body: JSON.stringify({ timeZone: browserTz }),
      }).catch(() => {
        // Silent failure: the calendar already uses the browser timezone via
        // effectiveTz in LMSCalendar, so the UI is correct either way.
      });
    }
  // Re-run only when auth state changes (user logs in / switches account).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user?.id, user?.timeZone, token]);
}
