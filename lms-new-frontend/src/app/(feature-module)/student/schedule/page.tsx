"use client";

import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/core/redux/hooks";
import { patchUserShift } from "@/core/redux/authSlice";
import { fetchStudentById } from "@/services/studentService";
import LMSCalendar from "@/components/pages/schedule/LMSCalendar";

export default function StudentSchedulePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  // Refresh the student's shift from the server on every page visit so a
  // shift change made by admin is reflected without requiring re-login.
  useEffect(() => {
    if (!user?.id) return;
    fetchStudentById(String(user.id))
      .then((student) => {
        dispatch(patchUserShift({ shift: student.shift ?? null }));
      })
      .catch(() => {/* silently ignore — stale value is acceptable fallback */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  return (
    <LMSCalendar
      role="student"
      userId={String(user.id)}
      userTimezone={user.timeZone ?? undefined}
      userShift={Array.isArray(user.shift) ? undefined : (user.shift ?? undefined)}
    />
  );
}
