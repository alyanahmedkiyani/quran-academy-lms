"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchTeachersThunk } from "@/core/redux/teacherSlice";
import { resolveImageUrl } from "@/environment";
import { all_routes } from "@/routes/all_routes";

import { fetchCoursesByTeacherId } from "@/services/courseDetailsService";
import { getTeacherHistory, getTeacherSessions } from "@/services/attendanceService";
import { getTeacherFeedback } from "@/services/feedbackService";

import { TeacherAttendanceRecord, TeacherSessionItem } from "@/types/attendance";
import { CourseDetail } from "@/types/course";
import { FeedbackSummary, PerSessionSummary } from "@/types/feedback";

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

function fmtTime(hms?: string | null) {
  if (!hms) return "—";
  const d = new Date(`1970-01-01T${hms}`);
  if (isNaN(d.getTime())) return hms;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function timeOnDate(date: string, hms: string | null): Date | null {
  if (!hms) return null;
  const d = new Date(`${date}T${hms}`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDuration(date: string, checkIn?: string | null, checkOut?: string | null) {
  const start = timeOnDate(date, checkIn ?? null);
  const end   = timeOnDate(date, checkOut ?? null);
  if (!start || !end || end <= start) return "—";
  const diff = end.getTime() - start.getTime();
  const hrs  = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

const shiftColors: Record<string, string> = {
  Morning: "#f59e0b",
  Afternoon: "#3b82f6",
  Evening: "#8b5cf6",
};

/* ─── main component ──────────────────────────────────────────────────────── */

const TeacherOverview = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { allItems, listStatus } = useAppSelector((state) => state.teachers);

  useEffect(() => {
    if (listStatus === "idle") dispatch(fetchTeachersThunk());
  }, [listStatus, dispatch]);

  const teacher = allItems.find((t) => String(t.id) === String(user?.id));
  const loading = listStatus === "loading";

  /* ── section data ── */
  const [courses,         setCourses]         = useState<CourseDetail[]>([]);
  const [attendanceRecs,  setAttendanceRecs]  = useState<TeacherAttendanceRecord[]>([]);
  const [sessionItems,    setSessionItems]    = useState<TeacherSessionItem[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [perSession,      setPerSession]      = useState<PerSessionSummary[]>([]);
  const [sectLoading,     setSectLoading]     = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const tid = String(user.id);
    const tidNum = Number(user.id);
    setSectLoading(true);
    Promise.allSettled([
      fetchCoursesByTeacherId(tid).then((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCourses((r as any).course ?? []);
      }),
      getTeacherHistory(tidNum, { limit: 20 }).then((r) => {
        setAttendanceRecs(r.records ?? []);
      }),
      getTeacherSessions(tidNum).then((r) => {
        setSessionItems(r.sessions ?? []);
      }),
      getTeacherFeedback(tidNum).then((r) => {
        setFeedbackSummary(r.summary);
        setPerSession(r.perSession ?? []);
      }),
    ]).finally(() => setSectLoading(false));
  }, [user?.id]);

  /* ── derived ── */
  const assignedStudents = (() => {
    const seen = new Map<number, { id: number; firstName: string; lastName: string; courseName: string; profileImg?: string | null }>();
    courses.forEach((c) => {
      if (c.Student) {
        const s = c.Student;
        const sid = Number(s.id);
        if (!seen.has(sid)) {
          seen.set(sid, {
            id: sid,
            firstName: s.firstName,
            lastName: s.lastName ?? "",
            courseName: c.Course?.courseName ?? "—",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            profileImg: (s as any).profileImg ?? null,
          });
        }
      }
    });
    return Array.from(seen.values());
  })();

  const totalCheckIns = attendanceRecs.length;
  const totalHours = attendanceRecs.reduce((acc, r) => {
    const start = timeOnDate(r.date, r.checkInTime);
    const end   = timeOnDate(r.date, r.checkOutTime);
    if (!start || !end || end <= start) return acc;
    return acc + (end.getTime() - start.getTime()) / 3600000;
  }, 0);
  const avgDailyHours = totalCheckIns > 0 ? (totalHours / totalCheckIns).toFixed(1) : null;

  const totalSessions   = sessionItems.length;
  const completedSessions = sessionItems.filter((s) => s.status === "completed").length;

  // Activity timeline
  const timelineEvents: { date: string; label: string; icon: string; color: string }[] = [];
  if (teacher?.createdAt) timelineEvents.push({ date: teacher.createdAt, label: "Account created", icon: "ti-user-plus", color: "#6366f1" });
  courses.forEach((c) => {
    if (c.createdAt) timelineEvents.push({ date: c.createdAt, label: `Assigned to course: ${c.Course?.courseName ?? "course"}`, icon: "ti-book", color: "#3b82f6" });
  });
  attendanceRecs.slice(0, 5).forEach((r) => {
    if (r.checkInTime) timelineEvents.push({ date: r.date, label: `Checked in at ${fmtTime(r.checkInTime)}${r.checkOutTime ? ` (${fmtDuration(r.date, r.checkInTime, r.checkOutTime)})` : " — no checkout"}`, icon: "ti-clock-in", color: "#22c55e" });
  });
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  /* ── loading ── */
  if (loading) return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
    </div>
  );

  if (!user) return null;

  const shifts = Array.isArray(teacher?.shift) ? teacher.shift : [];
  const initials = `${teacher?.firstName?.[0] ?? user.username?.[0] ?? ""}${teacher?.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName = `${teacher?.firstName ?? user.username ?? ""} ${teacher?.lastName ?? ""}`.trim();
  const profileImgUrl = user.profileImg ? `${resolveImageUrl(user.profileImg)}` : null;

  return (
    <div>
      {sectLoading && (
        <div className="text-center py-2 text-muted fs-13 mb-3">
          <span className="spinner-border spinner-border-sm me-2" />Loading overview…
        </div>
      )}

      {/* ── Header Card ── */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex align-items-start gap-4 flex-wrap">
            <div className="flex-shrink-0" style={{ width: 84, height: 84 }}>
              {profileImgUrl ? (
                <img
                  src={profileImgUrl}
                  alt={fullName}
                  width={84} height={84}
                  style={{ borderRadius: "50%", objectFit: "cover", width: 84, height: 84 }}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
                />
              ) : (
                <div className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 84, height: 84, fontSize: 30 }}>
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-1">{fullName}</h4>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <span className="badge border bg-white text-dark fs-13">@{user.username}</span>
                <span className="badge badge-soft-success border border-success fs-13">Active</span>
                {shifts.map((s) => (
                  <span key={s} className="badge fs-12" style={{ background: `${shiftColors[s] ?? "#6c757d"}20`, color: shiftColors[s] ?? "#6c757d", border: `1px solid ${shiftColors[s] ?? "#6c757d"}40` }}>
                    {s === "Morning" ? "☀️" : s === "Afternoon" ? "🌤️" : "🌙"} {s}
                  </span>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-3">
                <StatPill label="Courses"    value={[...new Set(courses.map((c) => c.courseId))].length}  color="#3b82f6" />
                <StatPill label="Students"   value={assignedStudents.length}    color="#6366f1" />
                <StatPill label="Sessions"   value={`${completedSessions}/${totalSessions}`} color="#22c55e" />
                <StatPill label="Avg Rating" value={feedbackSummary?.overallRating ? Number(feedbackSummary.overallRating).toFixed(1) : "—"} color="#f59e0b" />
                <StatPill label="Avg Hours/Day" value={avgDailyHours ? `${avgDailyHours}h` : "—"} color="#8b5cf6" />
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
                ["Email",      user.email || "—"],
                ["Username",   `@${user.username}`],
                ["Role",       "Teacher"],
                ["Member Since", fmtDate(teacher?.createdAt)],
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
              <EmptyState icon="ti-book-off" message="No courses assigned yet." />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Course</th>
                      <th>Student</th>
                      <th>Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c, i) => (
                      <tr key={i}>
                        <td className="fw-semibold">{c.Course?.courseName ?? "—"}</td>
                        <td>
                          {c.Student ? (
                            <span className="d-flex align-items-center gap-2">
                              <span className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center" style={{ width: 28, height: 28, fontSize: 12 }}>
                                <i className="ti ti-user" />
                              </span>
                              {c.Student.firstName} {c.Student.lastName}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="text-muted fs-13">{fmtDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Students */}
          <SectionCard title="My Students" icon="ti-users">
            {assignedStudents.length === 0 ? (
              <EmptyState icon="ti-users-minus" message="No students assigned yet." />
            ) : (
              <div className="row g-3">
                {assignedStudents.map((s) => (
                  <div key={s.id} className="col-sm-6 col-md-4">
                    <div className="bg-light rounded p-3 d-flex align-items-center gap-3">
                      {s.profileImg ? (
                        <img src={`${resolveImageUrl(s.profileImg)}`} alt="" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#3b82f6", flexShrink: 0 }}>
                          <i className="ti ti-user" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="fw-semibold mb-0 text-truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-muted fs-12 mb-0 text-truncate">{s.courseName}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Session Feedback */}
          <SectionCard title="Student Feedback" icon="ti-star">
            {!feedbackSummary ? (
              <EmptyState icon="ti-star-off" message="No feedback received yet." />
            ) : (
              <>
                <div className="d-flex flex-wrap gap-3 mb-4">
                  <StatPill label="Overall"    value={Number(feedbackSummary.overallRating  ?? 0).toFixed(1)} color="#f59e0b" />
                  <StatPill label="Teaching"   value={Number(feedbackSummary.teachingQuality ?? 0).toFixed(1)} color="#3b82f6" />
                  <StatPill label="Clarity"    value={Number(feedbackSummary.contentClarity  ?? 0).toFixed(1)} color="#22c55e" />
                  <StatPill label="Pace"       value={Number(feedbackSummary.sessionPace     ?? 0).toFixed(1)} color="#6366f1" />
                  <StatPill label="Engagement" value={Number(feedbackSummary.engagement      ?? 0).toFixed(1)} color="#ec4899" />
                  <StatPill label="Responses"  value={feedbackSummary.count ?? 0}                              color="#8b5cf6" />
                </div>
                {([
                  ["Teaching Quality", feedbackSummary.teachingQuality ?? 0],
                  ["Content Clarity",  feedbackSummary.contentClarity  ?? 0],
                  ["Session Pace",     feedbackSummary.sessionPace     ?? 0],
                  ["Engagement",       feedbackSummary.engagement      ?? 0],
                  ["Overall Rating",   feedbackSummary.overallRating   ?? 0],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="fs-13">{label}</span>
                    </div>
                    <StarBar value={Number(val)} />
                  </div>
                ))}
                {perSession.length > 0 && (
                  <div className="mt-4">
                    <h6 className="fw-bold mb-3 fs-14">Per Session</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr><th>Session</th><th>Responses</th><th>Avg Rating</th></tr>
                        </thead>
                        <tbody>
                          {perSession.slice(0, 8).map((p, i) => (
                            <tr key={i}>
                              <td className="fw-semibold">{p.sessionTitle ?? `Session ${p.sessionId}`}</td>
                              <td>{p.count}</td>
                              <td>
                                {p.feedback ? (
                                  <span className="badge" style={{ background: p.feedback.overallRating >= 4 ? "#dcfce7" : p.feedback.overallRating >= 3 ? "#fef9c3" : "#fee2e2", color: p.feedback.overallRating >= 4 ? "#16a34a" : p.feedback.overallRating >= 3 ? "#ca8a04" : "#dc2626" }}>
                                    ★ {Number(p.feedback.overallRating).toFixed(1)}
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

        </div>

        {/* ════ RIGHT col ════ */}
        <div className="col-lg-4">

          {/* Quick Links */}
          <SectionCard title="Quick Links" icon="ti-link">
            <div className="d-flex flex-column gap-2">
              <Link href={all_routes.teacherSchedule}   className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"><i className="ti ti-calendar" /> My Schedule</Link>
              <Link href={all_routes.teacherAttendance} className="btn btn-sm btn-outline-success d-flex align-items-center gap-2"><i className="ti ti-clock-check" /> My Attendance</Link>
              <Link href={all_routes.teacherFeedback ?? "/teacher/feedback"} className="btn btn-sm btn-outline-warning d-flex align-items-center gap-2"><i className="ti ti-star" /> View Feedback</Link>
              <Link href={all_routes.teacherProfile}    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"><i className="ti ti-user-cog" /> Edit Profile</Link>
            </div>
          </SectionCard>

          {/* Attendance History */}
          <SectionCard title="Attendance History" icon="ti-clock">
            {attendanceRecs.length === 0 ? (
              <EmptyState icon="ti-clock-off" message="No attendance records found." />
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {attendanceRecs.slice(0, 15).map((r, i) => (
                  <div key={i} className="d-flex align-items-start gap-3 mb-3 pb-3 border-bottom last-border-0">
                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                      <i className="ti ti-clock-in text-success" />
                    </div>
                    <div>
                      <p className="fw-semibold mb-0 fs-13">{fmtDate(r.date)}</p>
                      <p className="text-muted mb-0 fs-12">
                        {fmtTime(r.checkInTime)} → {fmtTime(r.checkOutTime)}
                        {r.checkInTime && r.checkOutTime && (
                          <span className="ms-2 badge badge-soft-primary">{fmtDuration(r.date, r.checkInTime, r.checkOutTime)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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

export default TeacherOverview;
