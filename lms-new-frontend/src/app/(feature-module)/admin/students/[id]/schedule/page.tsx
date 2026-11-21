"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import LMSCalendar from "@/components/pages/schedule/LMSCalendar";

export default function AdminStudentSchedulePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <div className="px-4 pt-4 pb-2 d-flex align-items-center gap-2">
        <Link
          href={`/admin/students/${id}`}
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
        >
          <i className="ti ti-chevron-left" /> Back to Student
        </Link>
      </div>
      <LMSCalendar role="student" userId={id} canManage={false} />
    </div>
  );
}
