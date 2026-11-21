"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppSelector } from "@/core/redux/hooks";
import { resolveImageUrl } from "@/environment";
import { all_routes } from "@/routes/all_routes";

import { getTeacherById } from "@/services/profileService";
import { fetchCoursesByStudentId } from "@/services/courseDetailsService";
import { getTeacherFeedback } from "@/services/feedbackService";
import { getTeacherSessions } from "@/services/attendanceService";

import { TeacherProfile } from "@/services/profileService";
import { CourseDetail } from "@/types/course";
import { FeedbackSummary, PerSessionSummary } from "@/types/feedback";
import { TeacherSessionItem } from "@/types/attendance";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const SHIFT_COLORS: Record<string, string> = {
  Morning: "#F59E0B",
  Afternoon: "#3B82F6",
  Evening: "#8B5CF6",
};

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

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}


/* ─── main component ──────────────────────────────────────────────────────── */

type ExtendedTeacherProfile = TeacherProfile & { shift?: string[] | null; createdAt?: string | null };

export default function TeacherDetailView() {
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector((s) => s.auth.user);

  const [teacher,         setTeacher]         = useState<ExtendedTeacherProfile | null>(null);
  const [sharedCourses,   setSharedCourses]   = useState<CourseDetail[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [recentSessions,  setRecentSessions]  = useState<PerSessionSummary[]>([]);
  const [sessionItems,    setSessionItems]    = useState<TeacherSessionItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !id) return;
    const load = async () => {
      try {
        setLoading(true);
        const [teacherData, coursesRes, feedbackRes, sessionsRes] = await Promise.all([
          getTeacherById(id) as Promise<ExtendedTeacherProfile>,
          fetchCoursesByStudentId(String(user.id)),
          getTeacherFeedback(Number(id)),
          getTeacherSessions(Number(id)),
        ]);

        setTeacher(teacherData);
        setSharedCourses((coursesRes.course ?? []).filter((c) => String(c.teacherId) === String(id)));
        setFeedbackSummary(feedbackRes.summary);
        setRecentSessions((feedbackRes.perSession ?? []).slice(0, 6));
        setSessionItems((sessionsRes.sessions ?? []).slice(0, 20));
      } catch (err: any) {
        setError(err?.message ?? "Failed to load teacher profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, id]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger">{error ?? "Teacher not found."}</div>
          <Link href={all_routes.studentMyTeachers} className="btn btn-outline-secondary btn-sm">
            <i className="ti ti-arrow-left me-1" /> Back to My Teachers
          </Link>
        </div>
      </div>
    );
  }

  /* ── derived ── */
  const teacherName   = `${teacher.firstName} ${teacher.lastName}`.trim();
  const initials      = `${teacher.firstName[0]}${teacher.lastName?.[0] ?? ""}`.toUpperCase();
  const shifts        = Array.isArray(teacher.shift) ? teacher.shift : teacher.shift ? [teacher.shift as string] : [];
  const avgRating     = feedbackSummary?.overallRating ?? 0;
  const totalFeedbacks = feedbackSummary?.count ?? 0;

  // Only show sessions that belong to courses this student shares with the teacher
  const sharedCourseIdSet = new Set(sharedCourses.map((c) => Number(c.courseId)));
  const relevantSessions  = sessionItems.filter(
    (s) => !s.Course || sharedCourseIdSet.has(Number(s.Course.id))
  );

  const completedSessions = relevantSessions.filter((s) => s.status === "completed").length;
  const liveSessions      = relevantSessions.filter((s) => s.status === "live").length;
  const upcomingSessions  = relevantSessions
    .filter((s) => (s.status === "scheduled" || s.status === "live") && s.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  /* ── activity timeline from sessions ── */
  const timelineEvents: { date: string; label: string; icon: string; color: string }[] = [];
  if (teacher.createdAt) timelineEvents.push({ date: teacher.createdAt, label: "Your teacher joined", icon: "ti-user-plus", color: "#6366f1" });
  sharedCourses.forEach((c) => { if (c.createdAt) timelineEvents.push({ date: c.createdAt, label: `Started course: ${c.Course?.courseName ?? "course"}`, icon: "ti-book", color: "#3b82f6" }); });
  relevantSessions.filter((s) => s.status === "completed").slice(0, 4).forEach((s) => {
    timelineEvents.push({ date: s.date, label: `Session completed: ${s.title}`, icon: "ti-video", color: "#22c55e" });
  });
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Back nav */}
        <div className="mb-4">
          <Link href={all_routes.studentMyTeachers} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
            <i className="ti ti-chevron-left" /> Back to My Teachers
          </Link>
        </div>

        {/* ── Header Card ── */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex align-items-start gap-4 flex-wrap">
              <div className="flex-shrink-0" style={{ width: 84, height: 84 }}>
                {teacher.imageUrl ? (
                  <img src={`${resolveImageUrl(teacher.imageUrl)}`} alt={teacherName} width={84} height={84} style={{ borderRadius: "50%", objectFit: "cover", width: 84, height: 84 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                ) : (
                  <div className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 84, height: 84, fontSize: 30 }}>
                    {initials}
                  </div>
                )}
              </div>
              <div className="flex-grow-1">
                <h4 className="fw-bold mb-1">{teacherName}</h4>
                <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                  <span className="badge border bg-white text-dark fs-13">@{teacher.username}</span>
                  <span className="badge badge-soft-success border border-success fs-13">Active</span>
                  {shifts.map((s) => (
                    <span key={s} className="badge fs-12" style={{ background: `${SHIFT_COLORS[s] ?? "#6c757d"}20`, color: SHIFT_COLORS[s] ?? "#6c757d", border: `1px solid ${SHIFT_COLORS[s] ?? "#6c757d"}40` }}>
                      {s === "Morning" ? "☀️" : s === "Afternoon" ? "🌤️" : "🌙"} {s}
                    </span>
                  ))}
                  {liveSessions > 0 && (
                    <span className="badge badge-soft-danger border border-danger fs-12">
                      <i className="ti ti-live-photo me-1" />Live Now
                    </span>
                  )}
                </div>
                {/* Stat pills */}
                <div className="d-flex flex-wrap gap-3">
                  <StatPill label="Shared Courses"    value={sharedCourses.length}                                              color="#3b82f6" />
                  <StatPill label="Recent Sessions"   value={relevantSessions.length}                                           color="#22c55e" />
                  <StatPill label="Completed"         value={completedSessions}                                                 color="#6366f1" />
                  <StatPill label="Avg Rating"        value={totalFeedbacks > 0 ? `★ ${avgRating.toFixed(1)}` : "—"}           color="#f59e0b" />
                  <StatPill label="Total Reviews"     value={totalFeedbacks}                                                    color="#8b5cf6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-col layout ── */}
        <div className="row g-4">

          {/* ════ LEFT col ════ */}
          <div className="col-lg-8">

            {/* Our shared courses */}
            <SectionCard title="Our Courses Together" icon="ti-book">
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

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <SectionCard title="Upcoming Sessions" icon="ti-calendar-event">
                <div className="d-flex flex-column gap-3">
                  {upcomingSessions.map((s, i) => (
                    <div key={i} className="border rounded p-3 d-flex align-items-center gap-3" style={{ background: "#f0fdf4" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-video text-success fs-18" />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">{s.title}</p>
                        <p className="text-muted mb-0 fs-12">{fmtDate(s.date)}{s.startTime ? ` · ${s.startTime}` : ""}</p>
                      </div>
                      {(s as any).meetingLink && (
                        <a href={(s as any).meetingLink} target="_blank" rel="noreferrer" className="btn btn-sm btn-success d-flex align-items-center gap-1">
                          <i className="ti ti-video" /> Join
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Recent Session History */}
            <SectionCard title="Session History" icon="ti-history">
              {relevantSessions.length === 0 ? (
                <EmptyState icon="ti-calendar-off" message="No sessions yet." />
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ fontSize: 12 }}>Session</th>
                        <th style={{ fontSize: 12 }}>Date</th>
                        <th style={{ fontSize: 12 }}>Time</th>
                        <th style={{ fontSize: 12 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relevantSessions.map((s, i) => {
                        const statusColor = s.status === "completed" ? "success" : s.status === "live" ? "danger" : "secondary";
                        return (
                          <tr key={i}>
                            <td className="fw-semibold" style={{ fontSize: 13 }}>{s.title}</td>
                            <td style={{ fontSize: 13 }} className="text-muted">{fmtDate(s.date)}</td>
                            <td style={{ fontSize: 13 }} className="text-muted">
                              {s.startTime ?? "—"}{s.endTime ? ` – ${s.endTime}` : ""}
                            </td>
                            <td>
                              <span className={`badge badge-soft-${statusColor} border border-${statusColor}`} style={{ fontSize: 11 }}>
                                {s.status === "live" ? "🔴 Live" : s.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* Teaching Performance */}
            <SectionCard title="Teaching Performance" icon="ti-star">
              {!feedbackSummary || totalFeedbacks === 0 ? (
                <EmptyState icon="ti-mood-empty" message="No feedback available yet for this teacher." />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total Reviews"  value={totalFeedbacks}                color="#3b82f6" />
                    <StatPill label="Overall Rating" value={`${avgRating.toFixed(1)} / 5`} color="#f59e0b" />
                    <StatPill label="Teaching"       value={Number(feedbackSummary.teachingQuality).toFixed(1)} color="#22c55e" />
                    <StatPill label="Clarity"        value={Number(feedbackSummary.contentClarity).toFixed(1)} color="#6366f1" />
                  </div>
                  <div className="row g-3 mb-4">
                    {([
                      { label: "Teaching Quality", key: "teachingQuality" },
                      { label: "Content Clarity",  key: "contentClarity"  },
                      { label: "Session Pace",     key: "sessionPace"     },
                      { label: "Engagement",       key: "engagement"      },
                    ] as { label: string; key: keyof FeedbackSummary }[]).map(({ label, key }) => (
                      <div key={key} className="col-sm-6">
                        <div className="mb-1 d-flex justify-content-between">
                          <span className="text-muted" style={{ fontSize: 13 }}>{label}</span>
                        </div>
                        <StarBar value={Number(feedbackSummary[key]) ?? 0} />
                      </div>
                    ))}
                  </div>

                  {recentSessions.length > 0 && (
                    <>
                      <h6 className="fw-semibold mb-3 text-muted" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Per-Session Ratings</h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ fontSize: 12 }}>Session</th>
                              <th style={{ fontSize: 12 }}>Date</th>
                              <th style={{ fontSize: 12 }}>Reviews</th>
                              <th style={{ fontSize: 12 }}>Avg Rating</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentSessions.map((s) => (
                              <tr key={s.sessionId}>
                                <td style={{ fontSize: 13 }}>{s.sessionTitle}</td>
                                <td style={{ fontSize: 13 }} className="text-muted">
                                  {s.date ? new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                                </td>
                                <td style={{ fontSize: 13 }}>{s.count}</td>
                                <td>
                                  {s.feedback ? (
                                    <span className="badge" style={{ background: "#f59e0b15", color: "#d97706", border: "1px solid #f59e0b30" }}>
                                      <i className="ti ti-star-filled me-1" style={{ fontSize: 10 }} />
                                      {s.feedback.overallRating.toFixed(1)}
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
                </>
              )}
            </SectionCard>

          </div>

          {/* ════ RIGHT col ════ */}
          <div className="col-lg-4">

            {/* Teacher Highlights — achievements visible to student */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                  <i className="ti ti-trophy fs-18 text-warning" />
                  Teacher Highlights
                </h5>
                <div className="d-flex flex-column gap-3">

                  {/* Overall rating */}
                  <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-star-filled fs-20" style={{ color: "#d97706" }} />
                    </div>
                    <div className="flex-grow-1">
                      <p className="fw-semibold mb-0 fs-13">Student Rating</p>
                      <p className="text-muted mb-0 fs-12">{totalFeedbacks} review{totalFeedbacks !== 1 ? "s" : ""} from students</p>
                    </div>
                    <span className="fw-bold fs-16" style={{ color: "#d97706" }}>
                      {totalFeedbacks > 0 ? `★ ${avgRating.toFixed(1)}` : "—"}
                    </span>
                  </div>

                  {/* Sessions conducted */}
                  <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-video fs-20" style={{ color: "#16a34a" }} />
                    </div>
                    <div className="flex-grow-1">
                      <p className="fw-semibold mb-0 fs-13">Sessions Conducted</p>
                      <p className="text-muted mb-0 fs-12">{completedSessions} completed (last 30 days)</p>
                    </div>
                    <span className="fw-bold fs-16" style={{ color: "#16a34a" }}>{relevantSessions.length}</span>
                  </div>

                  {/* Teaching quality */}
                  {feedbackSummary && totalFeedbacks > 0 && (
                    <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-bulb fs-20" style={{ color: "#2563eb" }} />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">Teaching Quality</p>
                        <p className="text-muted mb-0 fs-12">Rated by students · out of 5</p>
                      </div>
                      <span className="fw-bold fs-16" style={{ color: "#2563eb" }}>
                        {Number(feedbackSummary.teachingQuality).toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Content clarity */}
                  {feedbackSummary && totalFeedbacks > 0 && (
                    <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#faf5ff", border: "1px solid #e9d5ff" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-book fs-20" style={{ color: "#7c3aed" }} />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">Content Clarity</p>
                        <p className="text-muted mb-0 fs-12">How clearly lessons are explained</p>
                      </div>
                      <span className="fw-bold fs-16" style={{ color: "#7c3aed" }}>
                        {Number(feedbackSummary.contentClarity).toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Shared courses */}
                  <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#fdf2f8", border: "1px solid #fbcfe8" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fce7f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-books fs-20" style={{ color: "#db2777" }} />
                    </div>
                    <div className="flex-grow-1">
                      <p className="fw-semibold mb-0 fs-13">Teaching You</p>
                      <p className="text-muted mb-0 fs-12">Course{sharedCourses.length !== 1 ? "s" : ""} you share together</p>
                    </div>
                    <span className="fw-bold fs-16" style={{ color: "#db2777" }}>{sharedCourses.length}</span>
                  </div>

                  {/* Shifts */}
                  {shifts.length > 0 && (
                    <div className="d-flex align-items-center gap-3 p-3 rounded" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-clock fs-20" style={{ color: "#64748b" }} />
                      </div>
                      <div className="flex-grow-1">
                        <p className="fw-semibold mb-0 fs-13">Available Shifts</p>
                        <p className="text-muted mb-0 fs-12">When your teacher is active</p>
                      </div>
                      <div className="d-flex flex-column gap-1 align-items-end">
                        {shifts.map((s) => (
                          <span key={s} className="badge fs-11" style={{ background: `${SHIFT_COLORS[s] ?? "#6c757d"}20`, color: SHIFT_COLORS[s] ?? "#6c757d", border: `1px solid ${SHIFT_COLORS[s] ?? "#6c757d"}40` }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="ti ti-link fs-18 text-primary" />
                  Quick Links
                </h5>
                <div className="d-flex flex-column gap-2">
                  <Link href={all_routes.studentSchedule} className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2">
                    <i className="ti ti-calendar" /> My Schedule
                  </Link>
                  <Link href={all_routes.studentAttendance} className="btn btn-sm btn-outline-success d-flex align-items-center gap-2">
                    <i className="ti ti-clipboard-check" /> My Attendance
                  </Link>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            {timelineEvents.length > 0 && (
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                    <i className="ti ti-timeline fs-18 text-primary" />
                    Timeline
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
