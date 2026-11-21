"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppSelector } from "@/core/redux/hooks";
import { api_base_url, media_base_url } from "@/environment";
import { all_routes } from "@/routes/all_routes";

import { getStudentById } from "@/services/profileService";
import { fetchCoursesByStudentId } from "@/services/courseDetailsService";
import { fetchStudentAssignments } from "@/services/assignmentService";
import { fetchStudentQuizzes, checkQuizAttempt } from "@/services/quizService";
import { getStudentSummary } from "@/services/attendanceService";
import { getStudentCertificates } from "@/services/certificateService";

import { StudentProfile } from "@/services/profileService";
import { CourseDetail } from "@/types/course";
import { SubmittedAssignment } from "@/types/assignment";
import { Quiz } from "@/types/quiz";
import { AttendanceSummary } from "@/types/attendance";
import { Certificate } from "@/types/certificate";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const SHIFT_COLORS: Record<string, string> = {
  Morning: "#F59E0B",
  Afternoon: "#3B82F6",
  Evening: "#8B5CF6",
};

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card mb-4">
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

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="d-flex flex-column align-items-center px-3 py-2 rounded" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
      <span className="fw-bold fs-16" style={{ color }}>{value}</span>
      <span className="text-muted" style={{ fontSize: 11 }}>{label}</span>
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

function ProgressBar({ value, max = 100, color = "#3b82f6" }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bg-light rounded" style={{ height: 8 }}>
      <div style={{ width: `${pct}%`, height: 8, background: color, borderRadius: 4, transition: "width .4s" }} />
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── main component ──────────────────────────────────────────────────────── */

export default function StudentDetailView() {
  const { id: studentId } = useParams<{ id: string }>();
  const user = useAppSelector((s) => s.auth.user);

  const [student,               setStudent]               = useState<StudentProfile & { shift?: string | null; nameForTeacher?: string | null } | null>(null);
  const [sharedCourses,         setSharedCourses]         = useState<CourseDetail[]>([]);
  const [assignments,           setAssignments]           = useState<SubmittedAssignment[]>([]);
  const [quizzes,               setQuizzes]               = useState<Quiz[]>([]);
  const [quizAttempts,          setQuizAttempts]          = useState<Record<number, { hasAttempted: boolean; score?: number | null }>>({});
  const [attendance,            setAttendance]            = useState<AttendanceSummary[]>([]);
  const [certificates,          setCertificates]          = useState<Certificate[]>([]);
  const [loading,               setLoading]               = useState(true);
  const [error,                 setError]                 = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !studentId) return;
    const teacherId = String(user.id);

    const load = async () => {
      try {
        setLoading(true);
        const [studentData, coursesRes, assignmentsRes, quizzesRes, summaryRes, certsRes] = await Promise.all([
          getStudentById(studentId) as Promise<StudentProfile & { shift?: string | null; nameForTeacher?: string | null }>,
          fetchCoursesByStudentId(studentId),
          fetchStudentAssignments(studentId),
          fetchStudentQuizzes(studentId),
          getStudentSummary(Number(studentId)),
          getStudentCertificates(Number(studentId)),
        ]);

        setStudent(studentData);
        setCertificates(certsRes);

        const shared = (coursesRes.course ?? []).filter((c) => String(c.teacherId) === teacherId);
        setSharedCourses(shared);
        const cdIds = new Set(shared.map((c) => Number(c.id)));

        setAssignments((assignmentsRes.assignments ?? []).filter(
          (a) => a.Assignment && String(a.Assignment.teacherId) === teacherId
        ));
        setQuizzes((quizzesRes ?? []).filter((q) => String(q.teacherId) === teacherId));
        setAttendance((summaryRes.summaries ?? []).filter((s) => cdIds.has(Number(s.courseDetailsId))));
      } catch (err: any) {
        setError(err?.message ?? "Failed to load student profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, studentId]);

  // Load quiz attempt details after quizzes are fetched
  useEffect(() => {
    if (!studentId || !quizzes.length) return;
    quizzes.forEach((q) => {
      checkQuizAttempt(studentId, q.id as number)
        .then((r) => setQuizAttempts((prev) => ({ ...prev, [q.id as number]: { hasAttempted: r.hasAttempted, score: r.attempt?.score } })))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizzes]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger">{error ?? "Student not found."}</div>
          <Link href={all_routes.teacherStudents} className="btn btn-outline-secondary btn-sm">
            <i className="ti ti-arrow-left me-1" /> Back to My Students
          </Link>
        </div>
      </div>
    );
  }

  /* ── derived stats ── */
  const studentName    = `${student.firstName}${student.lastName ? ` ${student.lastName}` : ""}`;
  const shift          = student.shift as string | null | undefined;
  const nameForTeacher = student.nameForTeacher as string | null | undefined;
  const displayName    = nameForTeacher?.trim() ? nameForTeacher : studentName;
  const profileImgSrc  = student.profileImg ? `${media_base_url}/${student.profileImg}` : null;
  const isActive       = ((student as any).status ?? "active").toLowerCase() === "active";

  const totalAssignments    = assignments.length;
  const submittedAssignments = assignments.filter((a) => ["Submitted", "Graded"].includes(a.status)).length;
  const gradedAssignments   = assignments.filter((a) => a.status === "Graded" && a.score != null).length;
  const avgScore            = gradedAssignments > 0
    ? assignments.filter((a) => a.status === "Graded" && a.score != null).reduce((s, a) => s + (a.score ?? 0), 0) / gradedAssignments
    : 0;

  const totalQuizzes    = quizzes.length;
  const attemptedQuizzes = quizzes.filter((q) => quizAttempts[q.id as number]?.hasAttempted);
  const passedQuizzes   = quizzes.filter((q) => {
    const att = quizAttempts[q.id as number];
    return att?.hasAttempted && att.score != null && q.passingScore != null && att.score >= q.passingScore;
  }).length;
  const quizAvgScore    = attemptedQuizzes.length > 0
    ? (attemptedQuizzes.reduce((s, q) => s + (quizAttempts[q.id as number]?.score ?? 0), 0) / attemptedQuizzes.length).toFixed(1)
    : null;

  const totalSessions   = attendance.reduce((s, a) => s + a.totalSessions, 0);
  const presentSessions = attendance.reduce((s, a) => s + a.presentCount, 0);
  const attendanceRate  = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : null;

  const issuedCerts = certificates.filter((c) => c.status === "issued").length;

  /* ── activity timeline ── */
  const timelineEvents: { date: string; label: string; icon: string; color: string }[] = [];
  if ((student as any).createdAt) timelineEvents.push({ date: (student as any).createdAt, label: "Student account created", icon: "ti-user-plus", color: "#6366f1" });
  sharedCourses.forEach((c) => { if (c.createdAt) timelineEvents.push({ date: c.createdAt, label: `Enrolled in ${c.Course?.courseName ?? "course"}`, icon: "ti-book", color: "#3b82f6" }); });
  certificates.filter((c) => c.issuedAt).forEach((c) => timelineEvents.push({ date: c.issuedAt!, label: `Certificate — ${c.Course?.courseName ?? "course"}`, icon: "ti-award", color: "#f59e0b" }));
  assignments.filter((a) => a.status === "Graded" && a.score != null).slice(0, 3).forEach((a) => {
    const evDate = (a as any).updatedAt ?? (a as any).createdAt;
    if (evDate) timelineEvents.push({ date: evDate, label: `Graded: ${a.Assignment?.title ?? "assignment"} — ${a.score}pts`, icon: "ti-check", color: "#22c55e" });
  });
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Back nav */}
        <div className="mb-4 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <Link href={all_routes.teacherStudents} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
            <i className="ti ti-chevron-left" /> Back to My Students
          </Link>
        </div>

        {/* ── Header Card ── */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex align-items-start gap-4 flex-wrap">
              <div className="flex-shrink-0" style={{ width: 84, height: 84 }}>
                {profileImgSrc ? (
                  <img src={profileImgSrc} alt={displayName} width={84} height={84} style={{ borderRadius: "50%", objectFit: "cover", width: 84, height: 84 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                ) : (
                  <div className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 84, height: 84, fontSize: 30 }}>
                    {student.firstName[0]}{student.lastName?.[0] ?? ""}
                  </div>
                )}
              </div>
              <div className="flex-grow-1">
                <h4 className="fw-bold mb-1">{displayName}</h4>
                {nameForTeacher?.trim() && <p className="text-muted fs-13 mb-1">{studentName}</p>}
                <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                  <span className="badge border bg-white text-dark fs-13">@{student.username}</span>
                  <span className={`badge fs-13 ${isActive ? "badge-soft-success border border-success" : "badge-soft-danger border border-danger"}`}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                  {shift && (
                    <span className="badge fs-12" style={{ background: `${SHIFT_COLORS[shift] ?? "#6c757d"}20`, color: SHIFT_COLORS[shift] ?? "#6c757d", border: `1px solid ${SHIFT_COLORS[shift] ?? "#6c757d"}40` }}>
                      {shift === "Morning" ? "☀️" : shift === "Afternoon" ? "🌤️" : "🌙"} {shift}
                    </span>
                  )}
                </div>
                {/* Stat pills */}
                <div className="d-flex flex-wrap gap-3">
                  <StatPill label="Attendance"     value={attendanceRate != null ? `${attendanceRate}%` : "—"}   color="#22c55e" />
                  <StatPill label="Assignments"    value={`${submittedAssignments}/${totalAssignments}`}          color="#3b82f6" />
                  <StatPill label="Avg Score"      value={gradedAssignments > 0 ? avgScore.toFixed(1) : "—"}     color="#6366f1" />
                  <StatPill label="Quizzes"        value={`${attemptedQuizzes.length}/${totalQuizzes}`}           color="#f59e0b" />
                  <StatPill label="Quiz Avg"       value={quizAvgScore ?? "—"}                                    color="#8b5cf6" />
                  <StatPill label="Certificates"   value={issuedCerts}                                            color="#ec4899" />
                  <StatPill label="Courses (mine)" value={sharedCourses.length}                                   color="#0ea5e9" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-col layout ── */}
        <div className="row g-4">

          {/* ════ LEFT col ════ */}
          <div className="col-lg-8">

            {/* Courses I teach this student */}
            <SectionCard title="Enrolled in My Courses" icon="ti-book">
              {sharedCourses.length === 0 ? (
                <EmptyState icon="ti-book-off" message="No shared courses found." />
              ) : (
                <div className="row g-3">
                  {sharedCourses.map((c) => (
                    <div key={c.id} className="col-sm-6">
                      <div className="border rounded p-3 d-flex align-items-start gap-3" style={{ background: "#f8fafc" }}>
                        <div className="d-flex align-items-center justify-content-center rounded flex-shrink-0" style={{ width: 44, height: 44, background: "#3b82f615", color: "#3b82f6" }}>
                          <i className="ti ti-book fs-20" />
                        </div>
                        <div>
                          <div className="fw-semibold text-dark mb-1" style={{ fontSize: 14 }}>{c.Course?.courseName ?? `Course #${c.courseId}`}</div>
                          {c.Course?.duration && <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: 12 }}><i className="ti ti-clock" />{c.Course.duration}</div>}
                          <div className="text-muted d-flex align-items-center gap-1 mt-1" style={{ fontSize: 12 }}><i className="ti ti-calendar" />Enrolled {fmtDate(c.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Attendance */}
            <SectionCard title="Attendance in My Sessions" icon="ti-clipboard-check">
              {attendance.length === 0 ? (
                <EmptyState icon="ti-calendar-off" message="No attendance records yet." />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total Sessions" value={totalSessions}                color="#3b82f6" />
                    <StatPill label="Present"        value={presentSessions}              color="#22c55e" />
                    <StatPill label="Absent"         value={totalSessions - presentSessions} color="#ef4444" />
                    <StatPill label="Rate"           value={attendanceRate != null ? `${attendanceRate}%` : "—"} color={attendanceRate != null && attendanceRate >= 75 ? "#22c55e" : "#f59e0b"} />
                  </div>
                  <div className="row g-3">
                    {attendance.map((a) => (
                      <div key={a.courseDetailsId} className="col-sm-6">
                        <div className="border rounded p-3" style={{ background: "#f8fafc" }}>
                          <div className="fw-semibold mb-1" style={{ fontSize: 13 }}>{a.courseName}</div>
                          <div className="d-flex justify-content-between text-muted mb-2" style={{ fontSize: 12 }}>
                            <span>{a.presentCount} / {a.totalSessions} sessions</span>
                            <span className="fw-semibold" style={{ color: a.percentage >= 75 ? "#22c55e" : "#f59e0b" }}>{a.percentage}%</span>
                          </div>
                          <ProgressBar value={a.presentCount} max={a.totalSessions} color={a.percentage >= 75 ? "#22c55e" : "#f59e0b"} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>

            {/* Assignment Progress */}
            <SectionCard title="Assignment Progress" icon="ti-file-text">
              {assignments.length === 0 ? (
                <EmptyState icon="ti-file-off" message="No assignments assigned yet." />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total"     value={totalAssignments}    color="#3b82f6" />
                    <StatPill label="Submitted" value={submittedAssignments} color="#22c55e" />
                    <StatPill label="Graded"    value={gradedAssignments}   color="#8b5cf6" />
                    {gradedAssignments > 0 && <StatPill label="Avg Score" value={avgScore.toFixed(1)} color="#f59e0b" />}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ fontSize: 12 }}>Assignment</th>
                          <th style={{ fontSize: 12 }}>Due Date</th>
                          <th style={{ fontSize: 12 }}>Status</th>
                          <th style={{ fontSize: 12 }}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((a) => (
                          <tr key={a.id}>
                            <td style={{ fontSize: 13 }}>{a.Assignment?.title ?? `#${a.assignmentId}`}</td>
                            <td style={{ fontSize: 13 }} className="text-muted">{fmtDate(a.Assignment?.dueDate)}</td>
                            <td>
                              <span className={`badge ${a.status === "Graded" ? "badge-soft-success border border-success" : a.status === "Submitted" ? "badge-soft-primary border border-primary" : "badge-soft-secondary border border-secondary"}`} style={{ fontSize: 11 }}>
                                {a.status}
                              </span>
                            </td>
                            <td style={{ fontSize: 13 }}>
                              {a.score != null ? (
                                <span className="fw-semibold" style={{ color: a.score >= (a.Assignment?.maxScore ?? 100) * 0.6 ? "#22c55e" : "#ef4444" }}>
                                  {a.score}{a.Assignment?.maxScore ? `/${a.Assignment.maxScore}` : ""}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            {/* Quiz Performance */}
            <SectionCard title="Quiz Performance" icon="ti-help-square">
              {quizzes.length === 0 ? (
                <EmptyState icon="ti-notes-off" message="No quizzes assigned yet." />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total"     value={totalQuizzes}             color="#3b82f6" />
                    <StatPill label="Attempted" value={attemptedQuizzes.length}  color="#8b5cf6" />
                    <StatPill label="Passed"    value={passedQuizzes}            color="#22c55e" />
                    {quizAvgScore && <StatPill label="Avg Score" value={quizAvgScore} color="#f59e0b" />}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ fontSize: 12 }}>Quiz</th>
                          <th style={{ fontSize: 12 }}>Pass Mark</th>
                          <th style={{ fontSize: 12 }}>Score</th>
                          <th style={{ fontSize: 12 }}>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((q) => {
                          const att     = quizAttempts[q.id as number];
                          const score   = att?.score ?? null;
                          const passed  = score != null && q.passingScore != null && score >= q.passingScore;
                          return (
                            <tr key={q.id}>
                              <td style={{ fontSize: 13 }}>{q.title}</td>
                              <td style={{ fontSize: 13 }} className="text-muted">{q.passingScore ?? "—"}</td>
                              <td style={{ fontSize: 13 }}>
                                {score != null ? <span className="fw-semibold" style={{ color: passed ? "#22c55e" : "#ef4444" }}>{score}</span> : "—"}
                              </td>
                              <td>
                                {att?.hasAttempted ? (
                                  <span className={`badge ${passed ? "badge-soft-success border border-success" : "badge-soft-danger border border-danger"}`} style={{ fontSize: 11 }}>
                                    {passed ? "Pass" : "Fail"}
                                  </span>
                                ) : (
                                  <span className="badge badge-soft-secondary border border-secondary" style={{ fontSize: 11 }}>Not attempted</span>
                                )}
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

            {/* Certificates */}
            {certificates.length > 0 && (
              <SectionCard title="Certificates" icon="ti-award">
                <div className="row g-3">
                  {certificates.map((c, i) => (
                    <div key={i} className="col-sm-6">
                      <div className="border rounded p-3 d-flex align-items-center gap-3" style={{ background: c.status === "issued" ? "#fffbeb" : "#f8fafc" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef9c3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <i className="ti ti-award text-warning fs-20" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="fw-semibold mb-0 fs-13 text-truncate">{c.Course?.courseName ?? "—"}</p>
                          <p className="text-muted mb-0 fs-12">{fmtDate(c.issuedAt)}</p>
                          <span className={`badge ${c.status === "issued" ? "badge-soft-success" : "badge-soft-secondary"} fs-11`}>{c.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

          </div>

          {/* ════ RIGHT col ════ */}
          <div className="col-lg-4">

            {/* Student Highlights — achievements visible to teacher */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                  <i className="ti ti-trophy fs-18 text-warning" />
                  Student Highlights
                </h5>
                <div className="d-flex flex-column gap-3">
                  {/* Attendance */}
                  <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: attendanceRate != null && attendanceRate >= 75 ? "#f0fdf4" : "#fff7ed", border: `1px solid ${attendanceRate != null && attendanceRate >= 75 ? "#bbf7d0" : "#fed7aa"}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: attendanceRate != null && attendanceRate >= 75 ? "#dcfce7" : "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-clipboard-check fs-20" style={{ color: attendanceRate != null && attendanceRate >= 75 ? "#16a34a" : "#ea580c" }} />
                    </div>
                    <div className="flex-grow-1">
                      <p className="fw-semibold mb-0 fs-13">Attendance Rate</p>
                      <p className="text-muted mb-0 fs-12">{presentSessions} present out of {totalSessions} sessions</p>
                    </div>
                    <span className="fw-bold fs-16" style={{ color: attendanceRate != null && attendanceRate >= 75 ? "#16a34a" : "#ea580c" }}>
                      {attendanceRate != null ? `${attendanceRate}%` : "—"}
                    </span>
                  </div>

                  {/* Assignment completion */}
                  <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-file-check fs-20" style={{ color: "#2563eb" }} />
                    </div>
                    <div className="flex-grow-1">
                      <p className="fw-semibold mb-0 fs-13">Assignments</p>
                      <p className="text-muted mb-0 fs-12">{submittedAssignments} submitted · {gradedAssignments} graded</p>
                    </div>
                    <span className="fw-bold fs-16" style={{ color: "#2563eb" }}>
                      {totalAssignments > 0 ? `${Math.round((submittedAssignments / totalAssignments) * 100)}%` : "—"}
                    </span>
                  </div>

                  {/* Avg score */}
                  {gradedAssignments > 0 && (
                    <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#faf5ff", border: "1px solid #e9d5ff" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-chart-bar fs-20" style={{ color: "#7c3aed" }} />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">Average Score</p>
                        <p className="text-muted mb-0 fs-12">Across {gradedAssignments} graded assignment{gradedAssignments !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="fw-bold fs-16" style={{ color: "#7c3aed" }}>{avgScore.toFixed(1)}</span>
                    </div>
                  )}

                  {/* Quiz pass rate */}
                  {totalQuizzes > 0 && (
                    <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-help-square fs-20" style={{ color: "#d97706" }} />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">Quiz Performance</p>
                        <p className="text-muted mb-0 fs-12">{attemptedQuizzes.length} attempted · {passedQuizzes} passed</p>
                      </div>
                      <span className="fw-bold fs-16" style={{ color: "#d97706" }}>
                        {attemptedQuizzes.length > 0 ? `${Math.round((passedQuizzes / attemptedQuizzes.length) * 100)}%` : "—"}
                      </span>
                    </div>
                  )}

                  {/* Certificates */}
                  {issuedCerts > 0 && (
                    <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#fdf2f8", border: "1px solid #fbcfe8" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fce7f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-award fs-20" style={{ color: "#db2777" }} />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">Certificates Earned</p>
                        <p className="text-muted mb-0 fs-12">Across all courses</p>
                      </div>
                      <span className="fw-bold fs-16" style={{ color: "#db2777" }}>{issuedCerts}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            {timelineEvents.length > 0 && (
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                    <i className="ti ti-timeline fs-18 text-primary" />
                    Activity Timeline
                  </h5>
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {timelineEvents.slice(0, 8).map((ev, i) => (
                      <div key={i} className="d-flex gap-3 mb-3">
                        <div className="d-flex flex-column align-items-center">
                          <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, background: `${ev.color}15`, border: `2px solid ${ev.color}40` }}>
                            <i className={`ti ${ev.icon} fs-14`} style={{ color: ev.color }} />
                          </div>
                          {i < timelineEvents.slice(0, 8).length - 1 && <div style={{ width: 2, flex: 1, background: "#e9ecef", marginTop: 4 }} />}
                        </div>
                        <div className="pb-3">
                          <p className="fw-semibold mb-0 fs-13">{ev.label}</p>
                          <p className="text-muted mb-0 fs-12">{fmtDate(ev.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
