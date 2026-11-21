"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { resolveImageUrl } from "@/environment";
import { all_routes } from "@/routes/all_routes";

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

const StudentOverview = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { allItems, listStatus } = useAppSelector((state) => state.students);

  useEffect(() => {
    if (listStatus === "idle") dispatch(fetchStudentsThunk());
  }, [listStatus, dispatch]);

  const student = allItems.find((s) => String(s.id) === String(user?.id));
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
    if (!user?.id) return;
    const sid  = String(user.id);
    const sidN = Number(user.id);
    setSectLoading(true);
    Promise.allSettled([
      getStudentSummary(sidN).then((r) => setAttendance(r.summaries ?? [])),
      getStudentFees(sidN).then((f) => setFees(f)),
      fetchCoursesByStudentId(sid).then((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCourses((r as any).course ?? []);
      }),
      fetchStudentAssignments(sid).then((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAssignArr((r as any).assignments ?? (r as any).data ?? []);
      }),
      fetchStudentQuizzes(sid).then((q) => setQuizzes(q)),
      getStudentCertificates(sidN).then((c) => setCertificates(c)),
      getStudentFeedbacks(sidN).then((r) => {
        setFeedbacks(r.feedbacks ?? []);
        setFeedbackSum(r.summary);
      }),
    ]).finally(() => setSectLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !quizzes.length) return;
    const sid = String(user.id);
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
  const totalPresent  = attendance.reduce((s, a) => s + a.presentCount, 0);
  const totalSessions = attendance.reduce((s, a) => s + a.totalSessions, 0);
  const attendancePct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;

  /* ── activity timeline ── */
  const timelineEvents: { date: string; label: string; icon: string; color: string }[] = [];
  if (student?.createdAt) timelineEvents.push({ date: student.createdAt, label: "Account created", icon: "ti-user-plus", color: "#6366f1" });
  courses.forEach((c) => { if (c.createdAt) timelineEvents.push({ date: c.createdAt, label: `Enrolled in ${c.Course?.courseName ?? "course"}`, icon: "ti-book", color: "#3b82f6" }); });
  fees.filter((f) => f.paidDate).forEach((f) => timelineEvents.push({ date: f.paidDate!, label: `Fee paid — ${f.title} ($${Number(f.amount).toFixed(2)})`, icon: "ti-receipt", color: "#22c55e" }));
  certificates.filter((c) => c.issuedAt).forEach((c) => timelineEvents.push({ date: c.issuedAt!, label: `Certificate issued — ${c.Course?.courseName ?? "course"}`, icon: "ti-award", color: "#f59e0b" }));
  feedbacks.forEach((f) => timelineEvents.push({ date: f.createdAt, label: `Feedback submitted${f.ClassSession ? ` for "${f.ClassSession.title}"` : ""}`, icon: "ti-star", color: "#ec4899" }));
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  /* ── loading ── */
  if (loading) return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
    </div>
  );

  if (!user) return null;

  const initials   = `${student?.firstName?.[0] ?? user.username?.[0] ?? ""}${student?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName   = `${student?.firstName ?? user.username ?? ""} ${student?.lastName ?? ""}`.trim();
  const isActive   = (student?.status ?? "active").toLowerCase() === "active";
  const shift      = student?.shift as string | null | undefined;
  const shiftColor = shift ? shiftColors[shift] ?? "#6c757d" : null;
  const profileImgUrl = user.profileImg ? `${resolveImageUrl(user.profileImg)}` : null;

  const pendingFees  = fees.filter((f) => f.status === "pending" || f.status === "overdue");
  const hasFeeAlert  = pendingFees.some((f) => f.status === "overdue");

  return (
    <div>
      {sectLoading && (
        <div className="text-center py-2 text-muted fs-13 mb-3">
          <span className="spinner-border spinner-border-sm me-2" />Loading overview…
        </div>
      )}

      {hasFeeAlert && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
          <i className="ti ti-alert-circle fs-18" />
          <span>You have overdue fees. <Link href={all_routes.studentFees ?? "/student/fees"} className="fw-bold">View Fees</Link></span>
        </div>
      )}

      {/* ── Header Card ── */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex align-items-start gap-4 flex-wrap">
            <div className="flex-shrink-0" style={{ width: 84, height: 84 }}>
              {profileImgUrl ? (
                <img src={profileImgUrl} alt={fullName} width={84} height={84} style={{ borderRadius: "50%", objectFit: "cover", width: 84, height: 84 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
              ) : (
                <div className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 84, height: 84, fontSize: 30 }}>{initials}</div>
              )}
            </div>
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-1">{fullName}</h4>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <span className="badge border bg-white text-dark fs-13">@{user.username}</span>
                <span className={`badge fs-13 ${isActive ? "badge-soft-success border border-success" : "badge-soft-danger border border-danger"}`}>{isActive ? "Active" : "Inactive"}</span>
                {shift && shiftColor && (
                  <span className="badge fs-12" style={{ background: `${shiftColor}20`, color: shiftColor, border: `1px solid ${shiftColor}40` }}>
                    {shift === "Morning" ? "☀️" : shift === "Afternoon" ? "🌤️" : "🌙"} {shift}
                  </span>
                )}
                {student?.plan && (
                  <span className="badge badge-soft-primary border border-primary fs-13">
                    <i className="ti ti-credit-card me-1" />{student.plan.name}
                  </span>
                )}
              </div>
              <div className="d-flex flex-wrap gap-3">
                <StatPill label="Attendance"    value={attendancePct != null ? `${attendancePct}%` : "—"} color="#22c55e" />
                <StatPill label="Assignments"   value={`${submitted}/${assignArr.length}`}               color="#3b82f6" />
                <StatPill label="Avg Score"     value={avgScore ?? "—"}                                   color="#6366f1" />
                <StatPill label="Quizzes Done"  value={`${attemptedQuizzes.length}/${quizzes.length}`}   color="#f59e0b" />
                <StatPill label="Certificates"  value={certificates.filter((c) => c.status === "issued").length} color="#ec4899" />
                <StatPill label="Feedback Given" value={feedbacks.length}                                 color="#8b5cf6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2-col layout ── */}
      <div className="row g-4">

        {/* ════ LEFT col ════ */}
        <div className="col-lg-8">

          {/* Account Info */}
          <SectionCard title="Account Information" icon="ti-id">
            <div className="row g-3">
              {([
                ["Email",     user.email || "—"],
                ["Username",  `@${user.username}`],
                ["Plan",      student?.plan?.name || "—"],
                ["Shift",     shift || "Not assigned"],
                ["Status",    isActive ? "Active" : "Inactive"],
                ["Member Since", fmtDate(student?.createdAt)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="col-sm-6 col-md-4">
                  <div className="bg-light rounded p-3 h-100">
                    <p className="text-muted fs-12 mb-1">{label}</p>
                    <p className="fw-semibold mb-0">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Courses */}
          <SectionCard title="My Courses" icon="ti-book">
            {courses.length === 0 ? (
              <EmptyState icon="ti-book-off" message="No courses enrolled yet." />
            ) : (
              <div className="row g-3">
                {[...new Map(courses.map((c) => [c.courseId, c])).values()].map((c, i) => (
                  <div key={i} className="col-sm-6">
                    <div className="bg-light rounded p-3 h-100">
                      <p className="fw-semibold mb-1">{c.Course?.courseName ?? "—"}</p>
                      {c.Teacher && <p className="text-muted fs-12 mb-0">Teacher: {c.Teacher.firstName} {c.Teacher.lastName}</p>}
                      <p className="text-muted fs-12 mb-0">Since: {fmtDate(c.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Assignments */}
          <SectionCard title="My Assignments" icon="ti-clipboard-list">
            {assignArr.length === 0 ? (
              <EmptyState icon="ti-clipboard-off" message="No assignments found." />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>Title</th><th>Status</th><th>Score</th><th>Due</th></tr>
                  </thead>
                  <tbody>
                    {assignArr.slice(0, 8).map((a, i) => {
                      const statusColor = a.status === "Graded" ? "success" : a.status === "Submitted" ? "primary" : a.status === "Pending" ? "warning" : "secondary";
                      return (
                        <tr key={i}>
                          <td className="fw-semibold">{a.title ?? a.Assignment?.title ?? "—"}</td>
                          <td><span className={`badge badge-soft-${statusColor}`}>{a.status ?? "—"}</span></td>
                          <td>{a.score != null ? `${a.score}` : "—"}</td>
                          <td className="text-muted fs-13">{fmtDate(a.dueDate ?? a.Assignment?.dueDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Quizzes */}
          <SectionCard title="My Quizzes" icon="ti-help">
            {quizzes.length === 0 ? (
              <EmptyState icon="ti-help-off" message="No quizzes assigned." />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>Quiz</th><th>Status</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {quizzes.slice(0, 8).map((q, i) => {
                      const att = quizAttempts[q.id as number];
                      return (
                        <tr key={i}>
                          <td className="fw-semibold">{q.title ?? "—"}</td>
                          <td>
                            <span className={`badge badge-soft-${att?.hasAttempted ? "success" : "secondary"}`}>
                              {att?.hasAttempted ? "Attempted" : "Not attempted"}
                            </span>
                          </td>
                          <td>{att?.score != null ? att.score : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {quizAvg && <p className="text-muted fs-13 mt-2 mb-0">Average quiz score: <strong>{quizAvg}</strong></p>}
              </div>
            )}
          </SectionCard>

          {/* Attendance Summary */}
          <SectionCard title="Attendance Summary" icon="ti-clipboard-check">
            {attendance.length === 0 ? (
              <EmptyState icon="ti-clipboard-off" message="No attendance records found." />
            ) : (
              <>
                <div className="d-flex flex-wrap gap-3 mb-4">
                  <StatPill label="Present"    value={totalPresent}                                              color="#22c55e" />
                  <StatPill label="Total"      value={totalSessions}                                             color="#3b82f6" />
                  <StatPill label="Rate"       value={attendancePct != null ? `${attendancePct}%` : "—"}        color="#6366f1" />
                </div>
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr><th>Course</th><th>Present</th><th>Total</th><th>Rate</th></tr>
                    </thead>
                    <tbody>
                      {attendance.map((a, i) => {
                        const pct = a.totalSessions > 0 ? Math.round((a.presentCount / a.totalSessions) * 100) : 0;
                        return (
                          <tr key={i}>
                            <td className="fw-semibold">{a.courseName ?? "—"}</td>
                            <td>{a.presentCount}</td>
                            <td>{a.totalSessions}</td>
                            <td>
                              <span className={`badge badge-soft-${pct >= 75 ? "success" : pct >= 50 ? "warning" : "danger"}`}>{pct}%</span>
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

          {/* Feedback Given */}
          {feedbacks.length > 0 && (
            <SectionCard title="Feedback I&apos;ve Given" icon="ti-star">
              {feedbackSum && (
                <div className="d-flex flex-wrap gap-3 mb-4">
                  <StatPill label="Sessions Rated" value={feedbacks.length}                                           color="#8b5cf6" />
                  <StatPill label="Avg Overall"    value={Number(feedbackSum.overallRating ?? 0).toFixed(1)}         color="#f59e0b" />
                </div>
              )}
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>Session</th><th>Overall</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {feedbacks.slice(0, 6).map((f, i) => (
                      <tr key={i}>
                        <td className="fw-semibold">{f.ClassSession?.title ?? `Session ${f.sessionId}`}</td>
                        <td>
                          <span className="badge" style={{ background: f.overallRating >= 4 ? "#dcfce7" : f.overallRating >= 3 ? "#fef9c3" : "#fee2e2", color: f.overallRating >= 4 ? "#16a34a" : f.overallRating >= 3 ? "#ca8a04" : "#dc2626" }}>
                            ★ {f.overallRating}
                          </span>
                        </td>
                        <td className="text-muted fs-13">{fmtDate(f.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

        </div>

        {/* ════ RIGHT col ════ */}
        <div className="col-lg-4">

          {/* Quick Links */}
          <SectionCard title="Quick Links" icon="ti-link">
            <div className="d-flex flex-column gap-2">
              <Link href={all_routes.studentSchedule}    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"><i className="ti ti-calendar" /> My Schedule</Link>
              <Link href={all_routes.studentAttendance}  className="btn btn-sm btn-outline-success d-flex align-items-center gap-2"><i className="ti ti-clipboard-check" /> My Attendance</Link>
              <Link href={all_routes.studentFees ?? "/student/fees"} className="btn btn-sm btn-outline-warning d-flex align-items-center gap-2"><i className="ti ti-cash" /> My Fees</Link>
              <Link href={all_routes.studentCertificates ?? "/student/certificates"} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"><i className="ti ti-certificate" /> Certificates</Link>
              <Link href={all_routes.studentPlans ?? "/student/plans"} className="btn btn-sm btn-outline-info d-flex align-items-center gap-2"><i className="ti ti-credit-card" /> My Plan</Link>
              <Link href={all_routes.studentProfile}     className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"><i className="ti ti-user-cog" /> Edit Profile</Link>
            </div>
          </SectionCard>

          {/* Certificates */}
          <SectionCard title="Certificates" icon="ti-award">
            {certificates.filter((c) => c.status === "issued").length === 0 ? (
              <EmptyState icon="ti-award-off" message="No certificates issued yet." />
            ) : (
              <div className="d-flex flex-column gap-3">
                {certificates.filter((c) => c.status === "issued").map((c, i) => (
                  <div key={i} className="bg-light rounded p-3 d-flex align-items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fef9c3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-award text-warning fs-18" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="fw-semibold mb-0 fs-13 text-truncate">{c.Course?.courseName ?? "—"}</p>
                      <p className="text-muted mb-0 fs-12">{fmtDate(c.issuedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Fees Overview */}
          <SectionCard title="Fee Overview" icon="ti-cash">
            {fees.length === 0 ? (
              <EmptyState icon="ti-receipt-off" message="No fee records found." />
            ) : (
              <>
                <div className="d-flex flex-wrap gap-3 mb-3">
                  <StatPill label="Total"   value={fees.length}                                      color="#6366f1" />
                  <StatPill label="Paid"    value={fees.filter((f) => f.status === "paid").length}   color="#22c55e" />
                  <StatPill label="Pending" value={fees.filter((f) => f.status === "pending").length} color="#f59e0b" />
                  <StatPill label="Overdue" value={fees.filter((f) => f.status === "overdue").length} color="#ef4444" />
                </div>
                {fees.slice(0, 4).map((f, i) => {
                  const statusColor = f.status === "paid" ? "#22c55e" : f.status === "overdue" ? "#ef4444" : "#f59e0b";
                  return (
                    <div key={i} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                      <div>
                        <p className="fw-semibold mb-0 fs-13">{f.title}</p>
                        <p className="text-muted mb-0 fs-12">Due: {fmtDate(f.dueDate)}</p>
                      </div>
                      <div className="text-end">
                        <p className="fw-bold mb-0 fs-13">${Number(f.amount).toFixed(2)}</p>
                        <span style={{ fontSize: 11, color: statusColor, textTransform: "capitalize" }}>{f.status}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </SectionCard>

          {/* Activity Timeline */}
          <SectionCard title="Activity Timeline" icon="ti-timeline">
            {timelineEvents.length === 0 ? (
              <EmptyState icon="ti-timeline-event-minus" message="No activity yet." />
            ) : (
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {timelineEvents.slice(0, 10).map((ev, i) => (
                  <div key={i} className="d-flex gap-3 mb-3">
                    <div className="d-flex flex-column align-items-center">
                      <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, background: `${ev.color}15`, border: `2px solid ${ev.color}40` }}>
                        <i className={`ti ${ev.icon} fs-14`} style={{ color: ev.color }} />
                      </div>
                      {i < timelineEvents.slice(0, 10).length - 1 && <div style={{ width: 2, flex: 1, background: "#e9ecef", marginTop: 4 }} />}
                    </div>
                    <div className="pb-3">
                      <p className="fw-semibold mb-0 fs-13">{ev.label}</p>
                      <p className="text-muted mb-0 fs-12">{fmtDate(ev.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  );
};

export default StudentOverview;
