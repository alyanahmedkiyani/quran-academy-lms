"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAppSelector, useAppDispatch } from "@/core/redux/hooks";
import { all_routes } from "@/routes/all_routes";
import { fetchStudentDashboardStats, type StudentDashboardStats } from "@/services/dashboardService";
import { getStudentFees } from "@/services/feesService";
import { fetchStudentAssignments } from "@/services/assignmentService";
import { fetchStudentCoursesThunk } from "@/core/redux/courseDetailsSlice";
import { getCalendarEvents } from "@/services/classScheduleService";
import { getStudentSummary } from "@/services/attendanceService";
import { getCoursePDFs, pdfViewUrl, type CoursePDF } from "@/services/coursePDFService";
import { Fee } from "@/types/fees";
import type { SubmittedAssignment } from "@/types/assignment";
import type { CalendarEvent } from "@/types/classSchedule";
import type { AttendanceSummary } from "@/types/attendance";

const FEE_STATUS_COLOR: Record<string, string> = {
  pending: "warning",
  overdue: "danger",
  paid: "success",
  cancelled: "secondary",
};

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

const StudentDashboard = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { studentAssignments: myCourses, studentListStatus: coursesStatus } = useAppSelector(
    (state) => state.courseDetails
  );
  const [stats, setStats] = useState<StudentDashboardStats | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [assignments, setAssignments] = useState<SubmittedAssignment[]>([]);
  const [todayClasses, setTodayClasses] = useState<CalendarEvent[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<AttendanceSummary[]>([]);
  const [pdfModal, setPdfModal] = useState<{ courseId: number; courseName: string } | null>(null);
  const [pdfs, setPdfs] = useState<CoursePDF[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchStudentDashboardStats(user.id)
        .then(setStats)
        .catch(console.error);
      getStudentFees(user.id)
        .then(setFees)
        .catch(() => {});
      fetchStudentAssignments(user.id)
        .then((res) => setAssignments(res.assignments ?? []))
        .catch(() => {});
      dispatch(fetchStudentCoursesThunk(String(user.id)));

      const todayStr = new Date().toISOString().split("T")[0];
      getCalendarEvents({ userId: String(user.id), role: "student", start: todayStr, end: todayStr })
        .then((events) => setTodayClasses(events.filter((e) => e.extendedProps.type === "class")))
        .catch(() => {});

      getStudentSummary(Number(user.id))
        .then((res) => setAttendanceSummaries(res.summaries ?? []))
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
  const assignNotStarted = assignments.filter((a) => a.status === "Not Started").length;
  const assignSubmitted  = assignments.filter((a) => a.status === "Submitted").length;
  const assignGraded     = assignments.filter((a) => a.status === "Graded").length;

  // Fee stats
  const fmtAmt = (n: number) => "$" + (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : n.toFixed(0));
  const feeTotalAll  = fees.reduce((s, f) => s + Number(f.amount), 0);
  const feePaid      = fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);
  const feeDue       = fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
  const feePaidPct   = feeTotalAll > 0 ? Math.round((feePaid / feeTotalAll) * 100) : 0;

  const hasOverdue = fees.some((f) => f.status === "overdue");
  const activeFees = fees.filter((f) => f.status === "pending" || f.status === "overdue");
  const latestFee = activeFees[0] ?? null;

  // Upcoming deadlines: not-started assignments with future due dates
  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingDeadlines = assignments
    .filter((a) => a.status === "Not Started" && a.Assignment?.dueDate && a.Assignment.dueDate >= todayStr)
    .sort((a, b) => (a.Assignment?.dueDate ?? "").localeCompare(b.Assignment?.dueDate ?? ""))
    .slice(0, 4);

  // Graded assignments with scores
  const gradedAssignments = assignments.filter((a) => a.status === "Graded").slice(0, 5);
  const pctToGrade = (pct: number) => {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B+";
    if (pct >= 70) return "B";
    if (pct >= 60) return "C";
    return "D";
  };

  return (
    <>
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="fw-bold mb-0">Student Dashboard</h4>
            <p className="text-muted mb-0 fs-13">
              Welcome back, <strong>{user?.username ?? user?.email}</strong>
            </p>
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2">
            <Link href={all_routes.studentSchedule} className="btn btn-primary d-inline-flex align-items-center">
              <i className="ti ti-calendar me-1" />
              My Schedule
            </Link>
            <Link href={all_routes.studentCourses} className="btn btn-outline-white bg-white d-inline-flex align-items-center">
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
                    <p className="fs-13 mb-0">This Semester</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Enrolled Courses</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.enrolledCourses : "…"}</h3>
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
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-warning">Urgent</span>
                    <p className="fs-13 mb-0">Not submitted yet</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Pending Assignments</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.pendingAssignments : "…"}</h3>
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
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-info">Active</span>
                    <p className="fs-13 mb-0">Assigned to you</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Upcoming Quizzes</p>
                  <h3 className="fw-bold mb-0">{stats ? stats.upcomingQuizzes : "…"}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-success rounded-circle">
                    <i className="ti ti-chart-bar fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">Rate</span>
                    <p className="fs-13 mb-0">All sessions</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Attendance</p>
                  <h3 className="fw-bold mb-0">{stats ? `${stats.attendanceRate}%` : "…"}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Module Overview ── */}
        {(assignments.length > 0 || fees.length > 0) && (
          <div className="mb-2">
            <h5 className="fw-semibold text-muted mb-3" style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Module Overview
            </h5>

            {/* Assignments */}
            {assignments.length > 0 && (
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0"><i className="ti ti-clipboard-text me-1 text-warning" />My Assignments</h6>
                  <Link href={all_routes.studentAssignments} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>View All</Link>
                </div>
                <div className="row g-3">
                  {([
                    { label: "Not Started", value: String(assignNotStarted), icon: "ti-clock",        color: "secondary" },
                    { label: "Submitted",   value: String(assignSubmitted),  icon: "ti-circle-check", color: "primary"   },
                    { label: "Graded",      value: String(assignGraded),     icon: "ti-award",        color: "success"   },
                    { label: "Total",       value: String(assignments.length), icon: "ti-list",       color: "info"      },
                  ] as {label:string;value:string;icon:string;color:string}[]).map(({ label, value, icon, color }) => (
                    <div className="col-6 col-sm-3" key={label}>
                      <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fees */}
            {fees.length > 0 && (
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-bold mb-0"><i className="ti ti-receipt me-1 text-primary" />My Fees</h6>
                  <Link href={all_routes.studentFees} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>View All</Link>
                </div>
                <div className="row g-3">
                  {([
                    { label: "Total Fees",     value: fmtAmt(feeTotalAll), icon: "ti-receipt",      color: "primary" },
                    { label: "Paid",           value: fmtAmt(feePaid),     icon: "ti-circle-check", color: "success" },
                    { label: "Outstanding",    value: fmtAmt(feeDue),      icon: "ti-alert-circle", color: feeDue > 0 ? "danger" : "secondary" },
                    { label: "Paid Progress",  value: `${feePaidPct}%`,    icon: "ti-chart-bar",    color: "info"    },
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
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fw-semibold text-muted mb-0" style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              My Courses
            </h5>
            <Link href={all_routes.studentCourses} className="btn btn-sm btn-outline-primary px-2 py-1" style={{ fontSize: 12 }}>
              View All
            </Link>
          </div>

          {coursesStatus === "loading" || coursesStatus === "idle" ? (
            <div className="text-center py-3 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" />
              <span className="fs-13">Loading courses…</span>
            </div>
          ) : myCourses.length === 0 ? (
            <div className="card border-0 bg-light text-center py-4">
              <i className="ti ti-book-off fs-36 text-muted mb-2 d-block" />
              <p className="fs-13 text-muted mb-0">You are not enrolled in any courses yet.</p>
              <Link href={all_routes.studentCourses} className="btn btn-sm btn-primary mt-2">Browse Courses</Link>
            </div>
          ) : (
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
          )}
        </div>
        {/* ── End My Courses ── */}

        {/* Second Row */}
        <div className="row">
          {/* Today's Classes */}
          <div className="col-xl-8">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Today&apos;s Classes</h5>
                <Link href={all_routes.studentSchedule} className="btn fw-normal btn-outline-white">
                  Full Schedule
                </Link>
              </div>
              <div className="card-body">
                {todayClasses.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-calendar-off fs-36 mb-2 d-block" />
                    <p className="fs-13 mb-0">No classes scheduled for today.</p>
                    <Link href={all_routes.studentSchedule} className="btn btn-sm btn-outline-primary mt-2">View Schedule</Link>
                  </div>
                ) : (
                  todayClasses.map((c, i) => {
                    const st = new Date(c.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    const et = c.end ? new Date(c.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                    const liveStatus = c.extendedProps.sessionStatus;
                    const sessionStatus = c.extendedProps.status;
                    const statusLabel = liveStatus === "live" ? "Live" : sessionStatus === "completed" ? "Completed" : "Upcoming";
                    const statusColor = statusLabel === "Live" ? "danger" : statusLabel === "Completed" ? "success" : "info";
                    return (
                      <div key={c.id} className={`d-flex justify-content-between align-items-center ${i < todayClasses.length - 1 ? "mb-3" : "mb-0"}`}>
                        <div className="d-flex align-items-center">
                          <div className="avatar bg-primary-subtle rounded-2 me-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                            <i className="ti ti-video fs-22 text-primary" />
                          </div>
                          <div>
                            <h6 className="fs-14 fw-semibold mb-1">{c.title}</h6>
                            <p className="mb-0 fs-13 text-muted">
                              <i className="ti ti-clock me-1" />{st}{et ? ` – ${et}` : ""}
                              {c.extendedProps.teacherName ? ` | ${c.extendedProps.teacherName}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={`badge fs-12 py-1 badge-soft-${statusColor} border border-${statusColor} rounded fw-medium flex-shrink-0`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="col-xl-4">
            <div className="card shadow-sm">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Upcoming Deadlines</h5>
                <Link href={all_routes.studentAssignments} className="btn fw-normal btn-outline-white">
                  View All
                </Link>
              </div>
              <div className="card-body">
                {upcomingDeadlines.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-checks fs-36 mb-2 d-block" />
                    <p className="fs-13 mb-0">No upcoming deadlines.</p>
                  </div>
                ) : (
                  upcomingDeadlines.map((d, i) => (
                    <div key={d.id} className={`d-flex align-items-center justify-content-between ${i < upcomingDeadlines.length - 1 ? "mb-3" : "mb-0"}`}>
                      <div className="d-flex align-items-center">
                        <div className="avatar bg-warning-subtle rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0">
                          <i className="ti ti-calendar-event text-warning" />
                        </div>
                        <div>
                          <h6 className="fs-14 fw-medium mb-1 text-truncate" style={{ maxWidth: 140 }}>
                            {d.Assignment?.title ?? "Assignment"}
                          </h6>
                          <p className="mb-0 fs-12 text-muted">
                            Due: {d.Assignment?.dueDate ? new Date(d.Assignment.dueDate).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                      <span className="badge badge-soft-warning border border-warning fw-medium flex-shrink-0">
                        Assignment
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Third Row */}
        <div className="row">
          {/* My Grades */}
          <div className="col-xl-4 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">My Grades</h5>
                <Link href={all_routes.studentGrades} className="btn fw-normal btn-outline-white">
                  View All
                </Link>
              </div>
              <div className="card-body">
                {gradedAssignments.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-award-off fs-36 mb-2 d-block" />
                    <p className="fs-13 mb-0">No graded assignments yet.</p>
                  </div>
                ) : (
                  gradedAssignments.map((a, i) => {
                    const maxScore = a.Assignment?.maxScore ?? 100;
                    const score = a.score ?? 0;
                    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                    const grade = pctToGrade(pct);
                    const label = a.Assignment?.title ?? "Assignment";
                    const gradeColors = ["success", "primary", "info", "warning", "danger"] as const;
                    const color = gradeColors[i % gradeColors.length];
                    return (
                      <div key={a.id} className={`d-flex align-items-center justify-content-between ${i < gradedAssignments.length - 1 ? "mb-3" : "mb-0"}`}>
                        <div className="d-flex align-items-center overflow-hidden">
                          <span className={`avatar bg-${color}-subtle text-${color} rounded-circle fw-bold me-2 flex-shrink-0`}>
                            {label[0].toUpperCase()}
                          </span>
                          <div className="overflow-hidden">
                            <h6 className="fs-14 mb-0 fw-medium text-truncate">{label}</h6>
                            <p className="mb-0 fs-12 text-muted">{score}/{maxScore} pts</p>
                          </div>
                        </div>
                        <span className={`badge fw-bold badge-soft-${color} border border-${color} flex-shrink-0 fs-14`}>
                          {grade}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Attendance per course */}
          <div className="col-xl-4 col-lg-6 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Attendance per Course</h5>
                <Link href={all_routes.studentAttendance} className="btn fw-normal btn-outline-white">
                  View All
                </Link>
              </div>
              <div className="card-body">
                {attendanceSummaries.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-chart-off fs-36 mb-2 d-block" />
                    <p className="fs-13 mb-0">No attendance records yet.</p>
                  </div>
                ) : (
                  attendanceSummaries.slice(0, 5).map((c) => {
                    const pct = Math.round(c.percentage);
                    const color = pct >= 85 ? "success" : pct >= 70 ? "primary" : pct >= 60 ? "warning" : "danger";
                    return (
                      <div key={c.courseDetailsId} className="mb-3">
                        <div className="d-flex justify-content-between mb-1">
                          <p className="fs-13 mb-0 fw-medium text-truncate" style={{ maxWidth: 140 }}>{c.courseName}</p>
                          <p className="fs-13 mb-0 text-muted flex-shrink-0">{c.presentCount}/{c.totalSessions} ({pct}%)</p>
                        </div>
                        <div className="progress" style={{ height: 6 }}>
                          <div className={`progress-bar bg-${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="col-xl-4 col-lg-6 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header">
                <h5 className="fw-bold mb-0">Quick Actions</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {[
                    { icon: "ti-books", label: "My Courses", href: all_routes.studentCourses, color: "primary" },
                    { icon: "ti-clipboard-text", label: "Assignments", href: all_routes.studentAssignments, color: "warning" },
                    { icon: "ti-help-circle", label: "Quizzes", href: all_routes.studentQuizzes, color: "danger" },
                    { icon: "ti-award", label: "My Grades", href: all_routes.studentGrades, color: "success" },
                    { icon: "ti-calendar", label: "Schedule", href: all_routes.studentSchedule, color: "info" },
                    { icon: "ti-checkbox", label: "Attendance", href: all_routes.studentAttendance, color: "secondary" },
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

        {/* Fee Status Row — always visible so student always knows their fee status */}
        <div className="row">
            <div className="col-12">
              {hasOverdue && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-2" role="alert">
                  <i className="ti ti-alert-triangle fs-20 flex-shrink-0" />
                  <div>
                    <strong>Overdue fee!</strong> You have {fees.filter((f) => f.status === "overdue").length} overdue fee(s). Please contact admin or upload your payment proof.
                  </div>
                  <Link href={all_routes.studentPlans} className="btn btn-sm btn-danger ms-auto flex-shrink-0">View Plan</Link>
                </div>
              )}
              {fees.filter((f) => f.status === "pending").length > 0 && (
                <div className="alert alert-warning d-flex align-items-center gap-2 mb-3" role="alert">
                  <i className="ti ti-clock fs-20 flex-shrink-0" />
                  <div>
                    <strong>Payment due!</strong> You have {fees.filter((f) => f.status === "pending").length} pending fee(s). Please pay before the due date to avoid overdue charges.
                  </div>
                </div>
              )}
            </div>
            <div className="col-xl-8 d-flex">
              <div className="card shadow-sm flex-fill w-100">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">My Fees</h5>
                  <Link href={all_routes.studentPlans} className="btn fw-normal btn-outline-white">My Plan</Link>
                </div>
                <div className="card-body">
                  {fees.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <i className="ti ti-receipt-off fs-36 mb-2 d-block" />
                      <p className="fs-13 mb-0">No fee records found</p>
                    </div>
                  ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="fs-13">Title</th>
                          <th className="fs-13">Amount</th>
                          <th className="fs-13">Due Date</th>
                          <th className="fs-13">Status</th>
                          <th className="fs-13">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fees.slice(0, 5).map((fee) => (
                          <tr key={fee.id}>
                            <td className="fs-13 fw-medium">{fee.title}</td>
                            <td className="fs-13">${Number(fee.amount).toFixed(2)}</td>
                            <td className="fs-13 text-muted">{fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : "—"}</td>
                            <td>
                              <span className={`badge badge-soft-${FEE_STATUS_COLOR[fee.status]} border border-${FEE_STATUS_COLOR[fee.status]} fs-12`}>
                                {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                              </span>
                            </td>
                            <td>
                              {fee.invoicePath ? (
                                <a href={`/api/${fee.invoicePath}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success py-1 px-2 fs-12">
                                  <i className="ti ti-download me-1" />Invoice
                                </a>
                              ) : (
                                <span className="text-muted fs-12">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100">
                <div className="card-header">
                  <h5 className="fw-bold mb-0">Fee Summary</h5>
                </div>
                <div className="card-body">
                  {latestFee ? (
                    <>
                      <div className={`alert alert-${FEE_STATUS_COLOR[latestFee.status]} py-2 mb-3`}>
                        <p className="fs-12 mb-1 fw-semibold">{latestFee.title}</p>
                        <p className="fs-22 fw-bold mb-0">${Number(latestFee.amount).toFixed(2)}</p>
                        <p className="fs-12 mb-0 mt-1">
                          Due: {latestFee.dueDate ? new Date(latestFee.dueDate).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="d-flex gap-2 text-center">
                        <div className="flex-fill border rounded-2 p-2">
                          <p className="fs-12 text-muted mb-1">Pending</p>
                          <h6 className="fw-bold mb-0 text-warning">{fees.filter((f) => f.status === "pending").length}</h6>
                        </div>
                        <div className="flex-fill border rounded-2 p-2">
                          <p className="fs-12 text-muted mb-1">Overdue</p>
                          <h6 className="fw-bold mb-0 text-danger">{fees.filter((f) => f.status === "overdue").length}</h6>
                        </div>
                        <div className="flex-fill border rounded-2 p-2">
                          <p className="fs-12 text-muted mb-1">Paid</p>
                          <h6 className="fw-bold mb-0 text-success">{fees.filter((f) => f.status === "paid").length}</h6>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-3">
                      <i className="ti ti-circle-check fs-40 text-success mb-2 d-block" />
                      <p className="fs-13 text-muted mb-0">No outstanding fees</p>
                      <span className="badge badge-soft-success border border-success fs-12 mt-2">All Paid</span>
                    </div>
                  )}
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

export default StudentDashboard;
