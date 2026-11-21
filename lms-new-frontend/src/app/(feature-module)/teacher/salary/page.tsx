"use client";

import { useAppSelector } from "@/core/redux/hooks";
import TeacherSalary from "@/components/pages/hrm/teacherSalary";

export default function TeacherSalaryRoute() {
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

  return <TeacherSalary teacherId={Number(user.id)} />;
}
