"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAppSelector } from "@/core/redux/hooks";
import { all_routes } from "@/routes/all_routes";
import { fetchTeacherDashboardStats, type TeacherDashboardStats } from "@/services/dashboardService";
import { fetchTeacherAssignments, fetchTeacherSubmissions } from "@/services/assignmentService";
import { getTeacherToday, getTeacherHistory } from "@/services/attendanceService";
import { fetchCoursesByTeacherId } from "@/services/courseDetailsService";
import { getCalendarEvents } from "@/services/classScheduleService";
import { getCoursePDFs, pdfViewUrl, type CoursePDF } from "@/services/coursePDFService";
import type { Assignment, SubmittedAssignment } from "@/types/assignment";
import type { TeacherAttendanceRecord } from "@/types/attendance";
import type { CourseDetail, CourseStudent } from "@/types/course";
import type { CalendarEvent } from "@/types/classSchedule";

const colorHex: Record<string, string> = {
  primary: "#4F46E5", success: "#16A34A", warning: "#D97706",
  danger: "#DC2626", info: "#0891B2", secondary: "#64748B",
};
const ModuleStatCard = ({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) => {
  const hex = colorHex[color] ?? "#4F46E5";
  return (
    <div className="card border-0 h-100" style={{ borderRadius: 12, boxShadow: "0 2px 14px rgba(0,0,0,0.07)", borderLeft: `4px solid ${hex}` }}>
      <div className="card-body d-flex align-items-center gap-3 py-3 px-3">
        <div style={{ width: 48, height: 48, borderRadius: 10, background: `${hex}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 22, color: hex }} />
        </div>
        <div>
          <div className="fw-bold" style={{ fontSize: 22, lineHeight: 1.2, color: "#1e293b" }}>{value}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>{label}</div>
        </div>
      </div>
    </div>
  );
};

const TeacherDashboard = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [stats, setStats] = useState<TeacherDashboardStats | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<SubmittedAssignment[]>([]);
  const [todayRecord, setTodayRecord] = useState<TeacherAttendanceRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<TeacherAttendanceRecord[]>([]);
  const [myCourses, setMyCourses] = useState<CourseDetail[]>([]);
  const [todaySessions, setTodaySessions] = useState<CalendarEvent[]>([]);
  const [recentStudents, setRecentStudents] = useState<CourseStudent[]>([]);
  const [pdfModal, setPdfModal] = useState<{ courseId: number; courseName: string } | null>(null);
  const [pdfs, setPdfs] = useState<CoursePDF[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchTeacherDashboardStats(user.id)
        .then(setStats)
        .catch(console.error);

      // Module overview data
      fetchTeacherAssignments(user.id)
        .then((res) => setAssignments(res.assignments ?? []))
        .catch(() => {});

      fetchTeacherSubmissions(user.id)
        .then((res) => setSubmissions(res.assignments ?? []))
        .catch(() => {});

      const numId = Number(user.id);
      getTeacherToday(numId)
        .then((res) => setTodayRecord(res.record))
        .catch(() => {});

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      getTeacherHistory(numId, { startDate, endDate, limit: 31 })
        .then((res) => setHistoryRecords(res.records ?? []))
        .catch(() => {});

      // Fetch teacher's courses (deduplicated by courseId) + extract unique students
      fetchCoursesByTeacherId(String(user.id))
        .then((res) => {
          const seenCourses = new Set<number>();
          const unique: CourseDetail[] = [];
          const seenStudents = new Set<number>();
          const students: CourseStudent[] = [];
          for (const cd of res.course ?? []) {
            const cid = Number(cd.courseId);
            if (!seenCourses.has(cid)) { seenCourses.add(cid); unique.push(cd); }
            if (cd.Student) {
              const sid = Number(cd.Student.id);
              if (!seenStudents.has(sid)) { seenStudents.add(sid); students.push(cd.Student); }
            }
          }
          setMyCourses(unique);
          setRecentStudents(students.slice(0, 5));
        })
        .catch(() => {});

      // Fetch today's class sessions
      const todayStr = new Date().toISOString().split("T")[0];
      getCalendarEvents({ userId: String(user.id), role: "teacher", start: todayStr, end: todayStr })
        .then((events) => setTodaySessions(events.filter((e) => e.extendedProps.type === "class")))
        .catch(() => {});
    }
  }, [user?.id]);

  const openPDFs = async (courseId: number, courseName: string) => {
    setPdfModal({ courseId, courseName });
    setPdfsLoading(true);
    setPdfs([]);
    try {
      const result = await getCoursePDFs(courseId);
      setPdfs(result);
    } catch {
      setPdfs([]);
    } finally {
      setPdfsLoading(false);
    }
  };

  // Assignment stats
  const assignTotal   = assignments.length;
  const assignActive  = assignments.filter((a) => a.status === "active").length;
  const assignPending = assignments.filter((a) => a.status === "pending").length;

  // Submission stats
  const subTotal   = submissions.length;
  const subPending = submissions.filter((s) => s.status === "Submitted").length;
  const subGraded  = submissions.filter((s) => s.status === "Graded").length;

  // Attendance stats
  const monthPresent = historyRecords.filter((r) => r.status === "Present").length;
  const monthAbsent  = historyRecords.filter((r) => r.status === "Absent").length;
  const monthTotal   = historyRecords.length;
  const monthRate    = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;
  const todayStatus  = todayRecord?.status ?? null;
  const checkedIn    = !!todayRecord?.checkInTime;

  return (
    <>
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="fw-bold mb-0">Teacher Dashboard</h4>
            <p className="text-muted mb-0 fs-13">
              Welcome back, <strong>{user?.username ?? user?.email}</strong>
            </p>
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2">
            <Link href={all_routes.teacherSchedule} className="btn btn-primary d-inline-flex align-items-center">
              <i className="ti ti-calendar me-1" />
              My Schedule
            </Link>
            <Link href={all_routes.teacherCourses} className="btn btn-outline-white bg-white d-inline-flex align-items-center">
              <i className="ti ti-books me-1" />
              My Courses
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="row">
          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-primary rounded-circle">
                    <i className="ti ti-books fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">Active</span>
                    <p className="fs-13 mb-0">Assigned to you</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">My Courses</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.totalCourses : "…"}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-success rounded-circle">
                    <i className="ti ti-users fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">Enrolled</span>
                    <p className="fs-13 mb-0">Across all courses</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">My Students</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.totalStudents : "…"}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-warning rounded-circle">
                    <i className="ti ti-clipboard-text fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-warning">Review</span>
                    <p className="fs-13 mb-0">Awaiting grading</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Assignments Due</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.pendingReview : "…"}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-danger rounded-circle">
                    <i className="ti ti-help-circle fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-info">Live</span>
                    <p className="fs-13 mb-0">Published quizzes</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Active Quizzes</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.activeQuizzes : "…"}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Module Overview ── */}
        {(assignments.length > 0 || submissions.length > 0 || checkedIn || historyRecords.length > 0) && (
          <div className="mb-2">
            <h5 className="fw-semibold text-muted mb-3" style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Module Overview
            </h5>

            {/* My Assignments */}
            {assignTotal > 0 && (
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0"><i className="ti ti-clipboard-text me-1 text-warning" />My Assignments</h6>
                  <Link href={all_routes.teacherAssignments} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>View All</Link>
                </div>
                <div className="row g-3">
                  {([
                    { label: "Total",            value: String(assignTotal),   icon: "ti-list",         color: "info"      },
                    { label: "Active",            value: String(assignActive),  icon: "ti-circle-check", color: "success"   },
                    { label: "Pending Approval",  value: String(assignPending), icon: "ti-clock",        color: "warning"   },
                    { label: "To Grade",          value: String(subPending),    icon: "ti-pencil",       color: "primary"   },
                  ] as {label:string;value:string;icon:string;color:string}[]).map(({ label, value, icon, color }) => (
                    <div className="col-6 col-sm-3" key={label}>
                      <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student Submissions */}
            {subTotal > 0 && (
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0"><i className="ti ti-file-text me-1 text-primary" />Student Submissions</h6>
                  <Link href={all_routes.teacherAssignments} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>Review</Link>
                </div>
                <div className="row g-3">
                  {([
                    { label: "Total Received", value: String(subTotal),   icon: "ti-inbox",        color: "primary" },
                    { label: "Pending Review", value: String(subPending), icon: "ti-clock",        color: "warning" },
                    { label: "Graded",         value: String(subGraded),  icon: "ti-circle-check", color: "success" },
                    { label: "Not Started",    value: String(subTotal - subPending - subGraded), icon: "ti-hourglass", color: "secondary" },
                  ] as {label:string;value:string;icon:string;color:string}[]).map(({ label, value, icon, color }) => (
                    <div className="col-6 col-sm-3" key={label}>
                      <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Attendance */}
            {(checkedIn || historyRecords.length > 0) && (
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0"><i className="ti ti-checkbox me-1 text-success" />My Attendance</h6>
                  <Link href={all_routes.teacherAttendance} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>View All</Link>
                </div>
                <div className="row g-3">
                  {([
                    { label: "Today",           value: todayStatus ?? "—",          icon: "ti-calendar-today", color: todayStatus === "Present" ? "success" : todayStatus === "Absent" ? "danger" : "secondary" },
                    { label: "This Month Present", value: String(monthPresent),      icon: "ti-circle-check",   color: "success"   },
                    { label: "This Month Absent",  value: String(monthAbsent),       icon: "ti-circle-x",       color: "danger"    },
                    { label: "Monthly Rate",       value: `${monthRate}%`,           icon: "ti-chart-bar",      color: "info"      },
                  ] as {label:string;value:string;icon:string;color:string}[]).map(({ label, value, icon, color }) => (
                    <div className="col-6 col-sm-3" key={label}>
                      <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
        {/* ── End Module Overview ── */}

        {/* ── My Courses ── */}
        {myCourses.length > 0 && (
          <div className="mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-semibold text-muted mb-0" style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                My Courses
              </h5>
              <Link href={all_routes.teacherCourses} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>
                View All
              </Link>
            </div>
            <div className="row g-3">
              {myCourses.map((cd) => (
                <div className="col-xl-3 col-md-4 col-sm-6" key={cd.id}>
                  <div className="card border shadow-sm h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex align-items-center mb-2">
                        <span className="avatar bg-primary-subtle rounded-circle me-2 flex-shrink-0">
                          <i className="ti ti-books text-primary fs-20" />
                        </span>
                        <div className="flex-fill overflow-hidden">
                          <h6 className="fs-14 fw-semibold mb-0 text-truncate">{cd.Course?.courseName ?? "Untitled"}</h6>
                          {cd.Course?.duration && <p className="fs-12 text-muted mb-0">{cd.Course.duration}</p>}
                        </div>
                      </div>
                      {cd.Course?.description && (
                        <p className="fs-12 text-muted mb-2 flex-fill" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                          {cd.Course.description}
                        </p>
                      )}
                      <button
                        className="btn btn-sm btn-outline-primary w-100 mt-auto d-flex align-items-center justify-content-center gap-1"
                        onClick={() => openPDFs(Number(cd.courseId), cd.Course?.courseName ?? "Course")}
                      >
                        <i className="ti ti-eye fs-16" />
                        View PDFs
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── End My Courses ── */}

        {/* Second Row */}
        <div className="row">
          {/* Today's Sessions */}
          <div className="col-xl-8">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Today&apos;s Sessions</h5>
                <Link href={all_routes.teacherSchedule} className="btn fw-normal btn-outline-white">
                  View Full Schedule
                </Link>
              </div>
              <div className="card-body">
                {todaySessions.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-calendar-off fs-36 mb-2 d-block" />
                    <p className="fs-13 mb-0">No sessions scheduled for today.</p>
                    <Link href={all_routes.teacherSchedule} className="btn btn-sm btn-outline-primary mt-2">View Schedule</Link>
                  </div>
                ) : (
                  todaySessions.map((s, i) => {
                    const st = new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    const et = s.end ? new Date(s.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                    const liveStatus = s.extendedProps.sessionStatus;
                    const sessionStatus = s.extendedProps.status;
                    const statusLabel = liveStatus === "live" ? "Live" : sessionStatus === "completed" ? "Completed" : "Upcoming";
                    const statusColor = statusLabel === "Live" ? "danger" : statusLabel === "Completed" ? "success" : "info";
                    return (
                      <div key={s.id} className={`d-flex justify-content-between align-items-center ${i < todaySessions.length - 1 ? "mb-3" : "mb-0"}`}>
                        <div className="d-flex align-items-center">
                          <div className="avatar bg-primary-subtle rounded-2 me-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                            <i className="ti ti-video fs-22 text-primary" />
                          </div>
                          <div>
                            <h6 className="fs-14 fw-semibold mb-1">{s.title}</h6>
                            <p className="mb-0 fs-13 text-muted">
                              <i className="ti ti-clock me-1" />{st}{et ? ` – ${et}` : ""}{s.extendedProps.courseName ? ` | ${s.extendedProps.courseName}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={`badge fs-12 py-1 badge-soft-${statusColor} border border-${statusColor} rounded fw-medium`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="col-xl-4">
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="fw-bold mb-0">Assignments Overview</h5>
              </div>
              <div className="card-body">
                <div className="row g-2 mb-4">
                  <div className="col d-flex border-end">
                    <div className="text-center flex-fill">
                      <p className="mb-1 fs-13">Created</p>
                      <h3 className="fw-bold mb-0">{assignTotal}</h3>
                    </div>
                  </div>
                  <div className="col d-flex border-end">
                    <div className="text-center flex-fill">
                      <p className="mb-1 fs-13">Received</p>
                      <h3 className="fw-bold mb-0 text-success">{subTotal}</h3>
                    </div>
                  </div>
                  <div className="col d-flex">
                    <div className="text-center flex-fill">
                      <p className="mb-1 fs-13">To Grade</p>
                      <h3 className="fw-bold mb-0 text-warning">{subPending}</h3>
                    </div>
                  </div>
                </div>

                {submissions.filter((s) => s.status === "Submitted").slice(0, 3).map((sub, i, arr) => (
                  <div key={sub.id} className={`d-flex align-items-center justify-content-between ${i < arr.length - 1 ? "mb-3" : "mb-0"}`}>
                    <div>
                      <h6 className="fs-14 fw-semibold mb-1 text-truncate" style={{ maxWidth: 160 }}>
                        {sub.Assignment?.title ?? "Assignment"}
                      </h6>
                      <p className="mb-0 fs-13 text-muted">
                        {sub.Assignment?.dueDate ? `Due: ${new Date(sub.Assignment.dueDate).toLocaleDateString()}` : "Pending review"}
                      </p>
                    </div>
                    <span className="badge badge-soft-warning border border-warning fw-medium flex-shrink-0">Pending</span>
                  </div>
                ))}
                {submissions.filter((s) => s.status === "Submitted").length === 0 && assignTotal > 0 && (
                  <p className="fs-13 text-muted text-center mb-0">No submissions pending review.</p>
                )}
                {assignTotal === 0 && (
                  <p className="fs-13 text-muted text-center mb-0">No assignments created yet.</p>
                )}

                <Link href={all_routes.teacherAssignments} className="btn btn-light w-100 mt-3">
                  View All Assignments
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Third Row */}
        <div className="row">
          {/* My Students */}
          <div className="col-xl-4 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Recent Students</h5>
                <Link href={all_routes.teacherStudents} className="btn fw-normal btn-outline-white">
                  View All
                </Link>
              </div>
              <div className="card-body">
                {recentStudents.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-users-off fs-36 mb-2 d-block" />
                    <p className="fs-13 mb-0">No students assigned yet.</p>
                  </div>
                ) : (
                  recentStudents.map((s, i) => {
                    const name = s.nameForTeacher ?? `${s.firstName} ${s.lastName}`;
                    const avatarColors = ["success", "primary", "info", "warning", "danger"] as const;
                    const color = avatarColors[i % avatarColors.length];
                    return (
                      <div key={Number(s.id)} className={`d-flex align-items-center ${i < recentStudents.length - 1 ? "mb-3" : "mb-0"}`}>
                        <span className={`avatar bg-${color}-subtle text-${color} rounded-circle fw-bold me-2 flex-shrink-0`}>
                          {name[0].toUpperCase()}
                        </span>
                        <div className="overflow-hidden">
                          <h6 className="fs-14 mb-0 fw-medium text-truncate">{name}</h6>
                          <p className="mb-0 fs-12 text-muted text-truncate">{s.email}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="col-xl-4 col-lg-6 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Attendance Summary</h5>
                <Link href={all_routes.teacherAttendance} className="btn fw-normal btn-outline-white">
                  View All
                </Link>
              </div>
              <div className="card-body">
                <div className="row g-2 mb-4">
                  <div className="col d-flex border-end">
                    <div className="text-center flex-fill">
                      <p className="mb-1 fs-13">Present</p>
                      <h3 className="fw-bold mb-0 text-success">{monthPresent}</h3>
                    </div>
                  </div>
                  <div className="col d-flex border-end">
                    <div className="text-center flex-fill">
                      <p className="mb-1 fs-13">Absent</p>
                      <h3 className="fw-bold mb-0 text-danger">{monthAbsent}</h3>
                    </div>
                  </div>
                  <div className="col d-flex">
                    <div className="text-center flex-fill">
                      <p className="mb-1 fs-13">Rate</p>
                      <h3 className="fw-bold mb-0 text-primary">{monthRate}%</h3>
                    </div>
                  </div>
                </div>

                {historyRecords.length === 0 ? (
                  <div className="text-center py-2 text-muted">
                    <p className="fs-13 mb-1">No attendance records this month.</p>
                    <Link href={all_routes.teacherAttendance} className="btn btn-sm btn-outline-primary">Check In</Link>
                  </div>
                ) : (
                  <div className="mb-0">
                    <div className="d-flex justify-content-between mb-1">
                      <p className="fs-13 mb-0 fw-medium">This Month</p>
                      <p className="fs-13 mb-0 text-muted">{monthPresent}/{monthTotal} days</p>
                    </div>
                    <div className="progress mb-3" style={{ height: 8 }}>
                      <div className="progress-bar bg-success" style={{ width: `${monthRate}%` }} />
                    </div>
                    <p className="fs-12 text-muted mb-0 text-center">
                      {monthRate >= 90 ? "Excellent attendance this month!" : monthRate >= 75 ? "Good attendance this month." : "Attendance needs improvement."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-xl-4 col-lg-6 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header">
                <h5 className="fw-bold mb-0">Quick Actions</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {[
                    { icon: "ti-books", label: "My Courses", href: all_routes.teacherCourses, color: "primary" },
                    { icon: "ti-users", label: "My Students", href: all_routes.teacherStudents, color: "success" },
                    { icon: "ti-clipboard-text", label: "Assignments", href: all_routes.teacherAssignments, color: "warning" },
                    { icon: "ti-help-circle", label: "Quizzes", href: all_routes.teacherQuizzes, color: "danger" },
                    { icon: "ti-calendar", label: "Schedule", href: all_routes.teacherSchedule, color: "info" },
                    { icon: "ti-checkbox", label: "Attendance", href: all_routes.teacherAttendance, color: "secondary" },
                  ].map((item, i) => (
                    <div key={i} className="col-6">
                      <Link
                        href={item.href}
                        className={`d-flex flex-column align-items-center justify-content-center p-3 rounded-2 border bg-${item.color}-subtle text-${item.color} text-decoration-none`}
                      >
                        <i className={`${item.icon} fs-24 mb-2`} />
                        <span className="fs-13 fw-medium">{item.label}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* PDF Viewer Modal */}
    {pdfModal && (
      <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }} onClick={() => setPdfModal(null)}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold">
                <i className="ti ti-file-type-pdf text-danger me-2" />
                {pdfModal.courseName} — Course PDFs
              </h5>
              <button type="button" className="btn-close" onClick={() => setPdfModal(null)} />
            </div>
            <div className="modal-body">
              {pdfsLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" />
                  <p className="fs-13 text-muted mt-2 mb-0">Loading PDFs…</p>
                </div>
              ) : pdfs.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="ti ti-file-off fs-40 mb-2 d-block" />
                  <p className="fs-13 mb-0">No PDFs uploaded for this course yet.</p>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {pdfs.map((pdf) => (
                    <a
                      key={pdf.id}
                      href={pdfViewUrl(pdf.filePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="list-group-item list-group-item-action d-flex align-items-center gap-2 px-0"
                    >
                      <i className="ti ti-file-type-pdf text-danger fs-20 flex-shrink-0" />
                      <span className="fs-14 flex-fill text-truncate">{pdf.originalName}</span>
                      <i className="ti ti-external-link text-muted fs-14 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default TeacherDashboard;
