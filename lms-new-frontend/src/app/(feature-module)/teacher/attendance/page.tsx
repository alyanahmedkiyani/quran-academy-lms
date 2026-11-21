"use client";

import { useAppSelector } from "@/core/redux/hooks";
import TeacherAttendancePage from "@/components/pages/attendance/TeacherAttendancePage";

export default function TeacherAttendanceRoute() {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex align-items-center justify-content-center" style={{ minHeight: 200 }}>
          <div className="spinner-border text-primary" role="status" />
        </div>
      </div>
    );
  }

  return <TeacherAttendancePage teacherId={Number(user.id)} />;
}
