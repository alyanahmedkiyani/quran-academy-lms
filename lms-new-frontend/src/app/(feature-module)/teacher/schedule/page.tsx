"use client";

import { useAppSelector } from "@/core/redux/hooks";
import LMSCalendar from "@/components/pages/schedule/LMSCalendar";

export default function TeacherSchedulePage() {
  const user = useAppSelector((state) => state.auth.user);

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
      role="teacher"
      userId={String(user.id)}
      userTimezone={(user as { timeZone?: string }).timeZone}
    />
  );
}
