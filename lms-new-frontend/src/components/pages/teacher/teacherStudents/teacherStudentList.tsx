"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppSelector } from "@/core/redux/hooks";
import { useTeacherCourses } from "@/hooks/useTeacherCourses";
import { media_base_url } from "@/environment";
import { CourseDetail } from "@/types/course";

interface StudentRow {
  studentId: string;
  firstName: string;
  lastName: string;
  nameForTeacher: string | null;
  profileImg: string | null;
  courses: { courseId: string; courseName: string }[];
}

const PAGE_SIZE = 9;

const buildStudentRows = (assignments: CourseDetail[]): StudentRow[] => {
  const map = new Map<string, StudentRow>();
  for (const a of assignments) {
    if (!a.Student) continue;
    const sid = String(a.Student.id);
    if (!map.has(sid)) {
      map.set(sid, {
        studentId: sid,
        firstName: a.Student.firstName,
        lastName: a.Student.lastName,
        nameForTeacher: a.Student.nameForTeacher ?? null,
        profileImg: a.Student.profileImg ?? null,
        courses: [],
      });
    }
    if (a.Course) {
      const row = map.get(sid)!;
      const already = row.courses.some((c) => c.courseId === String(a.courseId));
      if (!already) {
        row.courses.push({ courseId: String(a.courseId), courseName: a.Course.courseName });
      }
    }
  }
  return Array.from(map.values());
};

const StudentCard = ({ row }: { row: StudentRow }) => {
  const displayName = row.nameForTeacher?.trim()
    ? row.nameForTeacher
    : `${row.firstName} ${row.lastName}`;
  const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase();
  const imgSrc = row.profileImg ? `${media_base_url}/${row.profileImg}` : null;

  return (
    <div className="col-xl-4 col-md-6">
      <div
        className="card h-100"
        style={{ borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0", overflow: "hidden" }}
      >
        <div className="card-body d-flex flex-column align-items-center pt-4 pb-3 px-4">
          {/* Avatar */}
          <div className="position-relative mb-3">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={displayName}
                style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                style={{ width: 80, height: 80, borderRadius: "50%", fontSize: 22 }}
              >
                {initials}
              </div>
            )}
            {/* online dot */}
            <span
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid #fff",
              }}
            />
          </div>

          {/* Name */}
          <div className="fw-bold text-dark mb-0" style={{ fontSize: 16 }}>{displayName}</div>
          {row.nameForTeacher?.trim() && (
            <div className="text-muted" style={{ fontSize: 12 }}>
              {row.firstName} {row.lastName}
            </div>
          )}

          {/* Student ID */}
          <div className="text-muted mt-1" style={{ fontSize: 12 }}>
            <i className="ti ti-id-badge me-1" />
            #{row.studentId}
          </div>

          {/* Divider rows */}
          <div className="w-100 mt-3">
            <div className="d-flex justify-content-between align-items-center py-2" style={{ borderTop: "1px solid #f0f0f0" }}>
              <span className="text-muted" style={{ fontSize: 13 }}>Courses</span>
              <span className="fw-semibold text-dark" style={{ fontSize: 13 }}>
                {String(row.courses.length).padStart(2, "0")}
              </span>
            </div>
            <div className="d-flex flex-column gap-1 py-2" style={{ borderTop: "1px solid #f0f0f0" }}>
              {row.courses.length === 0 ? (
                <span className="text-muted" style={{ fontSize: 12 }}>No courses assigned</span>
              ) : (
                <div className="d-flex flex-wrap gap-1">
                  {row.courses.map((c) => (
                    <span
                      key={c.courseId}
                      className="badge badge-soft-primary border border-primary"
                      style={{ fontSize: 11 }}
                    >
                      {c.courseName}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-2" style={{ borderTop: "1px solid #f0f0f0" }}>
              <Link
                href={`/teacher/students/${row.studentId}`}
                className="btn btn-sm btn-outline-primary w-100"
              >
                <i className="ti ti-eye me-1" />
                View Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TeacherStudentList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { teacherAssignments, loading, error, loadCourses } = useTeacherCourses();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (user?.id) loadCourses(String(user.id));
  }, [user?.id]);

  // reset to page 1 on search change
  useEffect(() => { setPage(1); }, [search]);

  const allStudents = buildStudentRows(teacherAssignments);
  const filtered = search.trim()
    ? allStudents.filter((s) => {
        const q = search.toLowerCase();
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        const alias = (s.nameForTeacher ?? "").toLowerCase();
        return name.includes(q) || alias.includes(q);
      })
    : allStudents;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              My Students
              {!loading && (
                <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                  {allStudents.length} student{allStudents.length !== 1 ? "s" : ""}
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Students assigned to your courses</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={() => user?.id && loadCourses(String(user.id))}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {/* Search */}
        {!loading && allStudents.length > 0 && (
          <div className="mb-4">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <i className="ti ti-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search students…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        )}

        {!loading && allStudents.length === 0 && !error && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-users-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Students Assigned</h5>
              <p className="text-muted mb-0">You have no students assigned yet. Contact your administrator.</p>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && allStudents.length > 0 && (
          <div className="card">
            <div className="card-body text-center py-4">
              <i className="ti ti-search-off fs-36 text-muted mb-2 d-block" />
              <p className="text-muted mb-0">No students match your search.</p>
            </div>
          </div>
        )}

        {!loading && paginated.length > 0 && (
          <>
            <div className="row g-4">
              {paginated.map((row) => (
                <StudentCard key={row.studentId} row={row} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center align-items-center gap-1 mt-4 flex-wrap">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <i className="ti ti-chevron-left" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === page ? "btn-primary" : "btn-outline-secondary"}`}
                    style={{ minWidth: 36 }}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <i className="ti ti-chevron-right" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeacherStudentList;
