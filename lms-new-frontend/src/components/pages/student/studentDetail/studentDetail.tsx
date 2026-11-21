"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { resolveImageUrl } from "@/environment";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { setActiveConversation } from "@/core/redux/chatSlice";
import { all_routes } from "@/routes/all_routes";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";

import { getStudentSummary } from "@/services/attendanceService";
import { getStudentFees } from "@/services/feesService";
import { fetchCoursesByStudentId } from "@/services/courseDetailsService";
import { fetchStudentAssignments } from "@/services/assignmentService";
import { fetchStudentQuizzes, checkQuizAttempt } from "@/services/quizService";
import { getStudentCertificates } from "@/services/certificateService";
import { getStudentFeedbacks, StudentFeedbackItem, StudentFeedbackSummary } from "@/services/feedbackService";

import { AttendanceSummary } from "@/types/attendance";
import { Fee } from "@/types/fees";
import { CourseDetail } from "@/types/course";
import { Certificate } from "@/types/certificate";
import { Quiz } from "@/types/quiz";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function StarBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="d-flex align-items-center gap-2">
      <div className="flex-fill bg-light rounded" style={{ height: 6 }}>
        <div style={{ width: `${pct}%`, height: 6, background: color, borderRadius: 3, transition: "width .4s" }} />
      </div>
      <span className="fw-semibold" style={{ fontSize: 12, minWidth: 28 }}>{value.toFixed(1)}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, className = "" }: {
  title: string; icon: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`card mb-4 ${className}`}>
      <div className="card-body">
        <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
          <i className={`ti ${icon} fs-18 text-primary`} />
          {title}
        </h5>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-4 text-muted">
      <i className={`ti ${icon} fs-28 mb-2 d-block`} />
      <p className="mb-0 fs-13">{message}</p>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="d-flex flex-column align-items-center px-3 py-2 rounded" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
      <span className="fw-bold fs-16" style={{ color }}>{value}</span>
      <span className="text-muted" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const shiftColors: Record<string, string> = {
  Morning: "#f59e0b",
  Afternoon: "#3b82f6",
  Evening: "#8b5cf6",
};

/* ─── main component ──────────────────────────────────────────────────────── */

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const { allItems, listStatus } = useAppSelector((state) => state.students);

  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
  }, [user, router]);

  useEffect(() => {
    if (listStatus === "idle") dispatch(fetchStudentsThunk());
  }, [listStatus, dispatch]);

  const student = allItems.find((s) => String(s.id) === String(id));
  const loading = listStatus === "loading";

  /* ── section data ── */
  const [attendance,   setAttendance]   = useState<AttendanceSummary[]>([]);
  const [fees,         setFees]         = useState<Fee[]>([]);
  const [courses,      setCourses]      = useState<CourseDetail[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assignArr,    setAssignArr]    = useState<any[]>([]);
  const [quizzes,      setQuizzes]      = useState<Quiz[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Record<number, { hasAttempted: boolean; score?: number | null }>>({});
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [feedbacks,    setFeedbacks]    = useState<StudentFeedbackItem[]>([]);
  const [feedbackSum,  setFeedbackSum]  = useState<StudentFeedbackSummary | null>(null);
  const [sectLoading,  setSectLoading]  = useState(false);

  useEffect(() => {
    if (!student) return;
    const sid = String(student.id);
    const sidNum = Number(student.id);
    setSectLoading(true);
    Promise.allSettled([
      getStudentSummary(sidNum).then((r) => setAttendance(r.summaries ?? [])),
      getStudentFees(sidNum).then((f) => setFees(f)),
      fetchCoursesByStudentId(sid).then((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCourses((r as any).course ?? []);
      }),
      fetchStudentAssignments(sid).then((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAssignArr((r as any).assignments ?? (r as any).data ?? []);
      }),
      fetchStudentQuizzes(sid).then((q) => setQuizzes(q)),
      getStudentCertificates(sidNum).then((c) => setCertificates(c)),
      getStudentFeedbacks(sidNum).then((r) => {
        setFeedbacks(r.feedbacks ?? []);
        setFeedbackSum(r.summary);
      }),
    ]).finally(() => setSectLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  useEffect(() => {
    if (!student || !quizzes.length) return;
    const sid = String(student.id);
    quizzes.forEach((q) => {
      checkQuizAttempt(sid, q.id as number).then((r) => {
        setQuizAttempts((prev) => ({ ...prev, [q.id as number]: { hasAttempted: r.hasAttempted, score: r.attempt?.score } }));
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizzes]);

  /* ── derived stats ── */
  const submitted  = assignArr.filter((a) => a.status === "Submitted" || a.status === "Graded").length;
  const graded     = assignArr.filter((a) => a.status === "Graded").length;
  const avgScore   = graded > 0
    ? (assignArr.filter((a) => a.status === "Graded" && a.score != null)
        .reduce((s: number, a) => s + Number(a.score), 0) / graded).toFixed(1)
    : null;

  const attemptedQuizzes = quizzes.filter((q) => quizAttempts[q.id as number]?.hasAttempted);
  const quizAvg = attemptedQuizzes.length > 0
    ? (attemptedQuizzes.reduce((s, q) => s + (quizAttempts[q.id as number]?.score ?? 0), 0) / attemptedQuizzes.length).toFixed(1)
    : null;

  const totalPresent   = attendance.reduce((s, a) => s + a.presentCount, 0);
  const totalSessions  = attendance.reduce((s, a) => s + a.totalSessions, 0);
  const attendancePct  = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;

  /* ── activity timeline (derived from fetched data) ── */
  const timelineEvents: { date: string; label: string; icon: string; color: string }[] = [];
  if (student?.createdAt) timelineEvents.push({ date: student.createdAt, label: "Student account created", icon: "ti-user-plus", color: "#6366f1" });
  courses.forEach((c) => { if (c.createdAt) timelineEvents.push({ date: c.createdAt, label: `Enrolled in ${c.Course?.courseName ?? "course"}`, icon: "ti-book", color: "#3b82f6" }); });
  fees.filter((f) => f.paidDate).forEach((f) => timelineEvents.push({ date: f.paidDate!, label: `Fee paid — ${f.title} ($${Number(f.amount).toFixed(2)})`, icon: "ti-receipt", color: "#22c55e" }));
  certificates.filter((c) => c.issuedAt).forEach((c) => timelineEvents.push({ date: c.issuedAt!, label: `Certificate issued — ${c.Course?.courseName ?? "course"}`, icon: "ti-award", color: "#f59e0b" }));
  feedbacks.forEach((f) => timelineEvents.push({ date: f.createdAt, label: `Feedback submitted${f.ClassSession ? ` for "${f.ClassSession.title}"` : ""}`, icon: "ti-star", color: "#ec4899" }));
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  /* ── loading / not found ── */
  if (loading) return (
    <div className="page-wrapper">
      <div className="content d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
      </div>
    </div>
  );

  if (!student) return (
    <div className="page-wrapper">
      <div className="content">
        <div className="alert alert-warning mb-3">Student not found.</div>
        <Link href={all_routes.manageStudents} className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">
          <i className="ti ti-arrow-left" /> Back to Students
        </Link>
      </div>
    </div>
  );

  const initials   = `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName   = `${student.firstName} ${student.lastName ?? ""}`.trim();
  const isActive   = (student.status ?? "active").toLowerCase() === "active";
  const shiftColor = student.shift ? shiftColors[student.shift] ?? "#6c757d" : null;

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Back nav + Quick Links */}
        <div className="mb-4 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <Link href={all_routes.manageStudents} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
            <i className="ti ti-chevron-left" /> Back to Students
          </Link>
          <div className="d-flex gap-2 flex-wrap">
            <Link
              href={`${all_routes.manageStudents}?edit=${student.id}`}
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-edit" /> Edit Student
            </Link>
            <button
              className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
              onClick={() => {
                dispatch(setActiveConversation({ userId: Number(student.id), userType: "student", displayName: `${student.firstName} ${student.lastName ?? ""}`.trim() }));
                router.push(`${all_routes.chat}?from=students`);
              }}
            >
              <i className="ti ti-message" /> Chat
            </button>
            <Link
              href={`/admin/students/${student.id}/schedule`}
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-calendar" /> View Schedule
            </Link>
            <Link
              href={all_routes.adminAttendance}
              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-clipboard-check" /> Attendance
            </Link>
            <Link
              href="/admin/fees"
              className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-cash" /> Fees
            </Link>
            <Link
              href={all_routes.adminCertificates}
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-certificate" /> Certificates
            </Link>
          </div>
        </div>

        {/* ── Header Card ── */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex align-items-start gap-4 flex-wrap">
              <div className="flex-shrink-0" style={{ width: 84, height: 84 }}>
                {student.profileImg ? (
                  <img
                    src={`${resolveImageUrl(student.profileImg)}`}
                    alt={fullName}
                    width={84} height={84}
                    style={{ borderRadius: "50%", objectFit: "cover", width: 84, height: 84 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
                  />
                ) : (
                  <div
                    className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                    style={{ width: 84, height: 84, fontSize: 30 }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="flex-grow-1">
                <h4 className="fw-bold mb-1">{fullName}</h4>
                <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                  <span className="badge border bg-white text-dark fs-13">@{student.username}</span>
                  <span className={`badge fs-13 ${isActive ? "badge-soft-success border border-success" : "badge-soft-danger border border-danger"}`}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                  {student.shift && shiftColor && (
                    <span className="badge" style={{ background: `${shiftColor}20`, color: shiftColor, border: `1px solid ${shiftColor}40` }}>
                      {student.shift === "Morning" ? "☀️" : student.shift === "Afternoon" ? "🌤️" : "🌙"} {student.shift}
                    </span>
                  )}
                  {student.plan && (
                    <span className="badge badge-soft-primary border border-primary fs-13">
                      <i className="ti ti-credit-card me-1" />{student.plan.name}
                    </span>
                  )}
                  {student.feeStatus && student.feeStatus !== "none" && (
                    <span className={`badge fs-13 ${student.feeStatus === "paid" ? "badge-soft-success border border-success" : "badge-soft-danger border border-danger"}`}>
                      <i className={`ti ${student.feeStatus === "paid" ? "ti-check" : "ti-alert-circle"} me-1`} />
                      Fee {student.feeStatus === "paid" ? "Paid" : "Unpaid"}
                    </span>
                  )}
                </div>

                {/* Quick stats strip */}
                <div className="d-flex flex-wrap gap-3">
                  <StatPill label="Attendance" value={attendancePct != null ? `${attendancePct}%` : "—"} color="#22c55e" />
                  <StatPill label="Assignments" value={`${submitted}/${assignArr.length}`} color="#3b82f6" />
                  <StatPill label="Avg Score" value={avgScore ?? "—"} color="#6366f1" />
                  <StatPill label="Quizzes Done" value={`${attemptedQuizzes.length}/${quizzes.length}`} color="#f59e0b" />
                  <StatPill label="Certificates" value={certificates.filter((c) => c.status === "issued").length} color="#ec4899" />
                  <StatPill label="Feedback Given" value={feedbacks.length} color="#8b5cf6" />
                </div>

              </div>
            </div>
          </div>
        </div>

        {sectLoading && (
          <div className="text-center py-2 text-muted fs-13 mb-3">
            <span className="spinner-border spinner-border-sm me-2" />Loading detail sections…
          </div>
        )}

        {/* ── 2-col layout ── */}
        <div className="row g-4">

          {/* ════ LEFT col-lg-8 ════ */}
          <div className="col-lg-8">

            {/* 1. Assignment & Enrollment */}
            <SectionCard title="Assignment &amp; Enrollment" icon="ti-users">
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="bg-light rounded p-3 h-100">
                    <p className="text-muted fs-12 mb-1">Assigned Teacher</p>
                    {student.assignedTeacher ? (
                      <Link href={`/admin/teachers/${student.assignedTeacher.id}`} className="fw-semibold text-primary text-decoration-none d-flex align-items-center gap-2">
                        {student.assignedTeacher.imageUrl ? (
                          <img src={`${resolveImageUrl(student.assignedTeacher.imageUrl)}`} alt="" width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                        ) : (
                          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#dbeafe", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#3b82f6", flexShrink: 0 }}><i className="ti ti-user" /></span>
                        )}
                        {student.assignedTeacher.firstName} {student.assignedTeacher.lastName}
                      </Link>
                    ) : <p className="fw-semibold mb-0 text-muted">Not assigned</p>}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="bg-light rounded p-3 h-100">
                    <p className="text-muted fs-12 mb-1">Parent / Guardian</p>
                    {student.parent ? (
                      <Link href={`/admin/parents/${student.parent.id}`} className="fw-semibold text-primary text-decoration-none d-flex align-items-center gap-2">
                        {student.parent.profileImg ? (
                          <img src={`${resolveImageUrl(student.parent.profileImg)}`} alt="" width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                        ) : (
                          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#d1fae5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#10b981", flexShrink: 0 }}><i className="ti ti-heart" /></span>
                        )}
                        {student.parent.firstName} {student.parent.lastName}
                      </Link>
                    ) : <p className="fw-semibold mb-0 text-muted">None linked</p>}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="bg-light rounded p-3 h-100">
                    <p className="text-muted fs-12 mb-1">Enrolled Course</p>
                    <p className="fw-semibold mb-0">{student.courseName || "—"}</p>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="bg-light rounded p-3 h-100">
                    <p className="text-muted fs-12 mb-1">Subscription Plan</p>
                    <p className="fw-semibold mb-0">{student.plan?.name || "—"}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 3. Attendance Summary */}
            <SectionCard title="Attendance Summary" icon="ti-calendar-check">
              {attendance.length === 0 ? (
                <EmptyState icon="ti-calendar-x" message="No attendance records found" />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total Sessions" value={totalSessions} color="#6366f1" />
                    <StatPill label="Present" value={totalPresent} color="#22c55e" />
                    <StatPill label="Absent" value={totalSessions - totalPresent} color="#ef4444" />
                    <StatPill label="Overall %" value={attendancePct != null ? `${attendancePct}%` : "—"} color="#f59e0b" />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Course</th>
                          <th className="text-center">Total</th>
                          <th className="text-center">Present</th>
                          <th className="text-center">Absent</th>
                          <th style={{ minWidth: 140 }}>Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((a) => (
                          <tr key={a.courseDetailsId}>
                            <td className="fw-medium">{a.courseName || "—"}</td>
                            <td className="text-center">{a.totalSessions}</td>
                            <td className="text-center text-success fw-semibold">{a.presentCount}</td>
                            <td className="text-center text-danger fw-semibold">{a.absentCount}</td>
                            <td>
                              <StarBar value={(a.percentage ?? 0) / 20} />
                              <span className="fs-11 text-muted">{a.percentage ?? 0}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            {/* 4. Fee History */}
            <SectionCard title="Fee History" icon="ti-receipt">
              {fees.length === 0 ? (
                <EmptyState icon="ti-receipt-off" message="No fee records found" />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total" value={fees.length} color="#6366f1" />
                    <StatPill label="Paid" value={fees.filter((f) => f.status === "paid").length} color="#22c55e" />
                    <StatPill label="Pending" value={fees.filter((f) => f.status === "pending").length} color="#f59e0b" />
                    <StatPill label="Overdue" value={fees.filter((f) => f.status === "overdue").length} color="#ef4444" />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Title</th><th>Amount</th><th>Due Date</th><th>Paid Date</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {fees.map((f) => (
                          <tr key={f.id}>
                            <td className="fw-medium">{f.title}</td>
                            <td>${Number(f.amount).toFixed(2)}</td>
                            <td>{fmtDate(f.dueDate)}</td>
                            <td>{fmtDate(f.paidDate)}</td>
                            <td>
                              <span className={`badge ${
                                f.status === "paid" ? "badge-soft-success border border-success" :
                                f.status === "overdue" ? "badge-soft-danger border border-danger" :
                                f.status === "cancelled" ? "badge-soft-secondary border border-secondary" :
                                "badge-soft-warning border border-warning"
                              }`}>{f.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            {/* 5. Course Enrollments */}
            <SectionCard title="Course Enrollments" icon="ti-book">
              {courses.length === 0 ? (
                <EmptyState icon="ti-books" message="No course enrollments found" />
              ) : (
                <div className="row g-3">
                  {courses.map((c) => (
                    <div key={c.id} className="col-sm-6">
                      <div className="border rounded p-3 h-100">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="avatar avatar-sm rounded d-flex align-items-center justify-content-center bg-primary text-white" style={{ width: 36, height: 36 }}>
                            <i className="ti ti-book fs-16" />
                          </span>
                          <div>
                            <h6 className="mb-0 fw-semibold fs-14">{c.Course?.courseName ?? "—"}</h6>
                            {c.Course?.duration && <p className="mb-0 text-muted fs-11">{c.Course.duration}</p>}
                          </div>
                        </div>
                        {c.Teacher && (
                          <p className="mb-1 fs-12 text-muted d-flex align-items-center gap-1">
                            <i className="ti ti-user" />
                            <Link href={`/admin/teachers/${c.Teacher.id}`} className="text-primary text-decoration-none">
                              {c.Teacher.firstName} {c.Teacher.lastName}
                            </Link>
                          </p>
                        )}
                        <p className="mb-0 text-muted fs-11">Enrolled {fmtDate(c.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 6. Assignment Progress */}
            <SectionCard title="Assignment Progress" icon="ti-clipboard-list">
              {assignArr.length === 0 ? (
                <EmptyState icon="ti-clipboard-x" message="No assignments found" />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total" value={assignArr.length} color="#6366f1" />
                    <StatPill label="Submitted" value={submitted} color="#3b82f6" />
                    <StatPill label="Graded" value={graded} color="#22c55e" />
                    <StatPill label="Avg Score" value={avgScore ?? "—"} color="#f59e0b" />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Assignment</th><th>Course</th><th>Due</th><th>Score</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {assignArr.map((a: any) => (
                          <tr key={a.id}>
                            <td className="fw-medium">{a.Assignment?.title ?? "—"}</td>
                            <td className="text-muted fs-12">{a.Assignment?.CourseDetails?.Course?.courseName ?? "—"}</td>
                            <td className="fs-12">{fmtDate(a.Assignment?.dueDate)}</td>
                            <td>{a.score != null ? <span className="fw-semibold">{a.score}</span> : "—"}</td>
                            <td>
                              <span className={`badge ${
                                a.status === "Graded" ? "badge-soft-success border border-success" :
                                a.status === "Submitted" ? "badge-soft-primary border border-primary" :
                                "badge-soft-secondary border border-secondary"
                              }`}>{a.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            {/* 7. Quiz Performance */}
            <SectionCard title="Quiz Performance" icon="ti-help-circle">
              {quizzes.length === 0 ? (
                <EmptyState icon="ti-question-mark" message="No quizzes assigned" />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total Quizzes" value={quizzes.length} color="#6366f1" />
                    <StatPill label="Attempted" value={attemptedQuizzes.length} color="#3b82f6" />
                    <StatPill label="Avg Score" value={quizAvg ?? "—"} color="#22c55e" />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Quiz</th><th>Course</th><th>Pass Score</th><th>Score</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {quizzes.map((q) => {
                          const attempt = quizAttempts[q.id as number];
                          const passed  = attempt?.hasAttempted && attempt.score != null && attempt.score >= (q.passingScore ?? 0);
                          return (
                            <tr key={q.id}>
                              <td className="fw-medium">{q.title}</td>
                              <td className="text-muted fs-12">{q.CourseDetails?.Courses?.courseName ?? "—"}</td>
                              <td>{q.passingScore ?? "—"}</td>
                              <td>{attempt?.score != null ? <span className="fw-semibold">{attempt.score}</span> : "—"}</td>
                              <td>
                                {!attempt?.hasAttempted
                                  ? <span className="badge badge-soft-secondary border border-secondary">Not attempted</span>
                                  : passed
                                  ? <span className="badge badge-soft-success border border-success">Passed</span>
                                  : <span className="badge badge-soft-danger border border-danger">Failed</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            {/* 10. Activity Timeline */}
            <SectionCard title="Activity Timeline" icon="ti-timeline">
              {timelineEvents.length === 0 ? (
                <EmptyState icon="ti-clock-off" message="No activity recorded yet" />
              ) : (
                <div className="position-relative" style={{ paddingLeft: 28 }}>
                  <div className="position-absolute top-0 h-100" style={{ width: 2, background: "#e5e7eb", left: 9 }} />
                  {timelineEvents.map((ev, i) => (
                    <div key={i} className="position-relative d-flex gap-3 mb-3">
                      <span
                        className="position-absolute d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                        style={{ width: 20, height: 20, background: ev.color, left: -19, top: 3, zIndex: 1 }}
                      >
                        <i className={`ti ${ev.icon} text-white`} style={{ fontSize: 10 }} />
                      </span>
                      <div className="border rounded px-3 py-2 flex-fill">
                        <p className="mb-0 fw-medium fs-13">{ev.label}</p>
                        <p className="mb-0 text-muted fs-11">{fmtDate(ev.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

          </div>

          {/* ════ RIGHT col-lg-4 ════ */}
          <div className="col-lg-4">

            {/* About */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="ti ti-info-circle fs-18 text-primary" /> About
                </h5>
                {([
                  ["ti-mail",          student.email || "—"],
                  ["ti-phone",         student.contact || "—"],
                  ["ti-user",          `@${student.username}`],
                  ["ti-writing",       `Alias: ${student.nameForTeacher || "—"}`],
                  ["ti-map-pin",       student.city || "—"],
                  ["ti-world",         student.countryName || "—"],
                  ["ti-clock",         student.timeZone || "—"],
                  ["ti-sun",           `Class Time: ${student.classTime || "—"}`],
                  ["ti-calendar",      `New Class Time: ${student.newClassTime || "—"}`],
                  ["ti-toggle-right",  `Status: ${isActive ? "Active" : "Inactive"}`],
                  ["ti-calendar-plus", `Member Since: ${fmtDate(student.createdAt)}`],
                ] as [string, string][]).map(([icon, label]) => (
                  <div key={icon + label} className="d-flex align-items-center gap-2 mb-2">
                    <span className="avatar avatar-sm rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32 }}>
                      <i className={`ti ${icon} fs-14 text-muted`} />
                    </span>
                    <span className="fs-13">{label}</span>
                  </div>
                ))}
                {student.note && (
                  <div className="mt-3 p-3 rounded" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <p className="text-muted fs-11 mb-1 fw-semibold d-flex align-items-center gap-1">
                      <i className="ti ti-notes fs-13 text-warning" /> Note
                    </p>
                    <p className="mb-0 fs-13" style={{ whiteSpace: "pre-wrap" }}>{student.note}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 8. Certificates */}
            <SectionCard title="Certificates" icon="ti-award">
              {certificates.length === 0 ? (
                <EmptyState icon="ti-certificate-off" message="No certificates yet" />
              ) : (
                <div className="d-flex flex-column gap-3">
                  {certificates.map((c) => (
                    <div key={c.id} className="border rounded p-3">
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <div>
                          <h6 className="fw-semibold mb-1 fs-13">{c.Course?.courseName ?? "—"}</h6>
                          <p className="mb-1 text-muted fs-11">Issued: {fmtDate(c.issuedAt)}</p>
                        </div>
                        <span className={`badge flex-shrink-0 ${
                          c.status === "issued" ? "badge-soft-success border border-success" :
                          c.status === "revoked" ? "badge-soft-danger border border-danger" :
                          "badge-soft-warning border border-warning"
                        }`}>{c.status}</span>
                      </div>
                      {c.notes && <p className="mb-0 text-muted fs-11 fst-italic">{c.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 9. Session Feedback Given */}
            <SectionCard title="Session Feedback Given" icon="ti-star">
              {feedbacks.length === 0 ? (
                <EmptyState icon="ti-star-off" message="No feedback submitted yet" />
              ) : (
                <>
                  {feedbackSum && (
                    <div className="bg-light rounded p-3 mb-4">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="fw-semibold fs-13">Average Ratings</span>
                        <span className="badge badge-soft-primary border border-primary">{feedbackSum.count} session{feedbackSum.count !== 1 ? "s" : ""}</span>
                      </div>
                      {([
                        ["Teaching Quality", feedbackSum.teachingQuality],
                        ["Content Clarity",  feedbackSum.contentClarity],
                        ["Session Pace",     feedbackSum.sessionPace],
                        ["Engagement",       feedbackSum.engagement],
                        ["Overall Rating",   feedbackSum.overallRating],
                      ] as [string, number][]).map(([label, val]) => (
                        <div key={label} className="mb-2">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="fs-11 text-muted">{label}</span>
                          </div>
                          <StarBar value={val} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="d-flex flex-column gap-2">
                    {feedbacks.slice(0, 5).map((f) => (
                      <div key={f.id} className="border rounded p-3">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="fw-medium fs-12 text-truncate me-2">{f.ClassSession?.title ?? "Session"}</span>
                          <span className="d-flex align-items-center gap-1 text-warning flex-shrink-0">
                            <i className="ti ti-star-filled fs-12" />
                            <span className="fw-semibold fs-12">{f.overallRating}/5</span>
                          </span>
                        </div>
                        {f.comment && <p className="mb-1 text-muted fs-11 fst-italic">&ldquo;{f.comment}&rdquo;</p>}
                        <p className="mb-0 text-muted fs-10">{fmtDate(f.createdAt)}</p>
                      </div>
                    ))}
                    {feedbacks.length > 5 && (
                      <p className="text-muted text-center fs-12 mb-0">+{feedbacks.length - 5} more</p>
                    )}
                  </div>
                </>
              )}
            </SectionCard>

          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
