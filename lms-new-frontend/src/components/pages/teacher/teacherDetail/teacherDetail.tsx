"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { resolveImageUrl } from "@/environment";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchTeachersThunk } from "@/core/redux/teacherSlice";
import { all_routes } from "@/routes/all_routes";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";

import { fetchCoursesByTeacherId } from "@/services/courseDetailsService";
import { getTeacherHistory, getTeacherSessions } from "@/services/attendanceService";
import { getTeacherFeedback } from "@/services/feedbackService";

import { TeacherAttendanceRecord, TeacherSessionItem } from "@/types/attendance";
import { CourseDetail } from "@/types/course";
import { FeedbackSummary, PerSessionSummary } from "@/types/feedback";

/* ─── helpers ──────────────────────────────────────────────── */

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

// checkInTime/checkOutTime come as bare "HH:MM:SS" strings from the DB (DataTypes.TIME)
// Combine with date "YYYY-MM-DD" to get a parseable datetime
function timeOnDate(date: string, hms: string | null): Date | null {
  if (!hms) return null;
  const d = new Date(`${date}T${hms}`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtTime(hms?: string | null) {
  if (!hms) return "—";
  // Parse as a time-only string against a dummy date so we get AM/PM formatting
  const d = new Date(`1970-01-01T${hms}`);
  if (isNaN(d.getTime())) return hms; // fallback: show raw
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(date: string, checkIn?: string | null, checkOut?: string | null) {
  const start = timeOnDate(date, checkIn ?? null);
  const end   = timeOnDate(date, checkOut ?? null);
  if (!start || !end) return "—";
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return "—";
  const hrs  = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

const shiftColors: Record<string, string> = {
  Morning: "#f59e0b",
  Afternoon: "#3b82f6",
  Evening: "#8b5cf6",
};

/* ─── main component ──────────────────────────────────────── */

const TeacherDetail = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const { allItems, listStatus } = useAppSelector((state) => state.teachers);

  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
  }, [user, router]);

  useEffect(() => {
    if (listStatus === "idle") dispatch(fetchTeachersThunk());
  }, [listStatus, dispatch]);

  const teacher = allItems.find((t) => String(t.id) === String(id));
  const loading = listStatus === "loading";

  /* ── section data ── */
  const [courses,         setCourses]         = useState<CourseDetail[]>([]);
  const [attendanceRecs,  setAttendanceRecs]  = useState<TeacherAttendanceRecord[]>([]);
  const [sessionItems,    setSessionItems]    = useState<TeacherSessionItem[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [perSession,      setPerSession]      = useState<PerSessionSummary[]>([]);
  const [sectLoading,     setSectLoading]     = useState(false);

  useEffect(() => {
    if (!teacher) return;
    const tid = String(teacher.id);
    const tidNum = Number(teacher.id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher?.id]);

  /* ── derived ── */
  // Unique students from courses
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
            profileImg: (s as any).profileImg ?? null,
          });
        }
      }
    });
    return Array.from(seen.values());
  })();

  // Attendance summary
  const totalCheckIns = attendanceRecs.length;
  const totalHours = attendanceRecs.reduce((acc, r) => {
    const start = timeOnDate(r.date, r.checkInTime);
    const end   = timeOnDate(r.date, r.checkOutTime);
    if (!start || !end || end <= start) return acc;
    return acc + (end.getTime() - start.getTime()) / 3600000;
  }, 0);
  const avgDailyHours = totalCheckIns > 0 ? (totalHours / totalCheckIns).toFixed(1) : null;

  // Session attendance summary
  const totalSessions = sessionItems.length;
  const completedSessions = sessionItems.filter((s) => s.status === "completed").length;
  const liveSessions      = sessionItems.filter((s) => s.status === "live").length;

  // Activity timeline
  const timelineEvents: { date: string; label: string; icon: string; color: string }[] = [];
  if (teacher?.createdAt) timelineEvents.push({ date: teacher.createdAt, label: "Teacher account created", icon: "ti-user-plus", color: "#6366f1" });
  courses.forEach((c) => {
    if (c.createdAt) timelineEvents.push({ date: c.createdAt, label: `Assigned to course: ${c.Course?.courseName ?? "course"}`, icon: "ti-book", color: "#3b82f6" });
  });
  attendanceRecs.slice(0, 5).forEach((r) => {
    if (r.checkInTime) timelineEvents.push({ date: r.date, label: `Checked in at ${fmtTime(r.checkInTime)}${r.checkOutTime ? ` (${fmtDuration(r.date, r.checkInTime, r.checkOutTime)})` : " — no checkout"}`, icon: "ti-clock-in", color: "#22c55e" });
  });
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  /* ── free hours period state (must be a hook, stays before guards) ── */
  const [freeHoursPeriod, setFreeHoursPeriod] = useState<1 | 7 | 14 | 30>(1);

  /* ── loading / not found ── */
  if (loading) return (
    <div className="page-wrapper">
      <div className="content d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
      </div>
    </div>
  );

  if (!teacher) return (
    <div className="page-wrapper">
      <div className="content">
        <div className="alert alert-warning mb-3">Teacher not found.</div>
        <Link href={all_routes.manageTeachers} className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">
          <i className="ti ti-arrow-left" /> Back to Teachers
        </Link>
      </div>
    </div>
  );

  const initials = `${teacher.firstName?.[0] ?? ""}${teacher.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName = `${teacher.firstName} ${teacher.lastName}`.trim();
  const shifts   = Array.isArray(teacher.shift) ? teacher.shift : [];

  /* ── free hours derived (needs shifts, so after guards) ── */
  const shiftCapacityPerDay = shifts.reduce((acc, s) => {
    return acc + (s === "Morning" ? 6 : s === "Afternoon" ? 6 : s === "Evening" ? 4 : 0);
  }, 0);

  function parseSessionTime(dateStr: string, timeStr: string | null | undefined): Date | null {
    if (!timeStr) return null;
    if (timeStr.includes("T") || timeStr.length > 10) {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? null : d;
    }
    return timeOnDate(dateStr, timeStr);
  }

  const sessionsByDate = new Map<string, TeacherSessionItem[]>();
  sessionItems.forEach((s) => {
    if (!sessionsByDate.has(s.date)) sessionsByDate.set(s.date, []);
    sessionsByDate.get(s.date)!.push(s);
  });

  const todayStr   = new Date().toISOString().slice(0, 10);
  const periodDays = freeHoursPeriod === 1
    ? [todayStr]
    : Array.from({ length: freeHoursPeriod }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (freeHoursPeriod - 1 - i));
        return d.toISOString().slice(0, 10);
      });

  const freeHoursByDay = periodDays.map((dateStr) => {
    const daySessions = sessionsByDate.get(dateStr) ?? [];
    const bookedHours = daySessions.reduce((acc, s) => {
      const start = parseSessionTime(dateStr, s.startTime);
      const end   = parseSessionTime(dateStr, s.endTime);
      if (!start || !end || end <= start) return acc;
      return acc + (end.getTime() - start.getTime()) / 3600000;
    }, 0);
    const freeHours      = Math.max(0, shiftCapacityPerDay - bookedHours);
    const utilizationPct = shiftCapacityPerDay > 0
      ? Math.min(100, Math.round((bookedHours / shiftCapacityPerDay) * 100))
      : 0;
    return { date: dateStr, sessions: daySessions, bookedHours, freeHours, utilizationPct };
  });

  const totalShiftHrs  = freeHoursByDay.length * shiftCapacityPerDay;
  const totalBookedHrs = freeHoursByDay.reduce((a, d) => a + d.bookedHours, 0);
  const totalFreeHrs   = freeHoursByDay.reduce((a, d) => a + d.freeHours, 0);
  const avgUtilization = freeHoursByDay.length > 0
    ? Math.round(freeHoursByDay.reduce((a, d) => a + d.utilizationPct, 0) / freeHoursByDay.length)
    : 0;

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Back nav */}
        <div className="mb-4 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <Link href={all_routes.manageTeachers} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
            <i className="ti ti-chevron-left" /> Back to Teachers
          </Link>
          <div className="d-flex gap-2 flex-wrap">
            <Link
              href={`/admin/teachers/${teacher.id}/schedule`}
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-calendar" /> View Schedule
            </Link>
            <Link
              href={`${all_routes.chat}?targetId=${teacher.id}&targetType=TEACHER&targetName=${encodeURIComponent(fullName)}`}
              className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-message" /> Open Chat
            </Link>
            <Link
              href={`${all_routes.adminAttendance}?teacherId=${teacher.id}`}
              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-clock-check" /> Attendance
            </Link>
            <Link
              href={`${all_routes.adminFeedback ?? "/admin/feedback"}?teacherId=${teacher.id}`}
              className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1"
            >
              <i className="ti ti-star" /> Feedback
            </Link>
          </div>
        </div>

        {/* ── Header Card ── */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex align-items-start gap-4 flex-wrap">
              <div className="flex-shrink-0" style={{ width: 84, height: 84 }}>
                {teacher.imageUrl ? (
                  <img
                    src={`${resolveImageUrl(teacher.imageUrl)}`}
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
                  <span className="badge border bg-white text-dark fs-13">@{teacher.username}</span>
                  <span className="badge badge-soft-success border border-success fs-13">Active</span>
                  {shifts.map((s) => (
                    <span
                      key={s}
                      className="badge fs-12"
                      style={{ background: `${shiftColors[s] ?? "#6c757d"}20`, color: shiftColors[s] ?? "#6c757d", border: `1px solid ${shiftColors[s] ?? "#6c757d"}40` }}
                    >
                      {s === "Morning" ? "☀️" : s === "Afternoon" ? "🌤️" : "🌙"} {s}
                    </span>
                  ))}
                  {teacher.canDirectlyPublish !== undefined && (
                    <span className={`badge fs-12 ${teacher.canDirectlyPublish ? "badge-soft-success border border-success" : "badge-soft-warning border border-warning"}`}>
                      <i className={`ti ${teacher.canDirectlyPublish ? "ti-shield-check" : "ti-shield-x"} me-1`} />
                      {teacher.canDirectlyPublish ? "Direct Publish" : "Needs Approval"}
                    </span>
                  )}
                </div>

                {/* Quick stats strip */}
                <div className="d-flex flex-wrap gap-3">
                  <StatPill label="Courses"   value={courses.length}                                                                              color="#3b82f6" />
                  <StatPill label="Students"  value={assignedStudents.length}                                                                     color="#22c55e" />
                  <StatPill label="Sessions"  value={totalSessions}                                                                               color="#6366f1" />
                  <StatPill label="Avg Rating" value={feedbackSummary ? feedbackSummary.overallRating.toFixed(1) : "—"}                           color="#f59e0b" />
                  <StatPill label="Check-ins"  value={totalCheckIns}                                                                              color="#ec4899" />
                  <StatPill label="Avg Hrs/Day" value={avgDailyHours ? `${avgDailyHours}h` : "—"}                                                color="#8b5cf6" />
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

            {/* 1. Free Hours */}
            <SectionCard title="Free Hours Overview" icon="ti-clock-pause">
              {/* Period filter */}
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
                <div className="d-flex align-items-center gap-1 bg-light rounded p-1">
                  {([1, 7, 14, 30] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm px-3 ${freeHoursPeriod === p ? "btn-primary" : "btn-light border-0"}`}
                      onClick={() => setFreeHoursPeriod(p)}
                    >
                      {p === 1 ? "Today" : p === 7 ? "This Week" : p === 14 ? "14 Days" : "30 Days"}
                    </button>
                  ))}
                </div>
                {shiftCapacityPerDay === 0 && (
                  <span className="badge badge-soft-warning border border-warning fs-12">
                    <i className="ti ti-alert-triangle me-1" />No shifts assigned
                  </span>
                )}
              </div>

              {/* Summary strip */}
              <div className="d-flex flex-wrap gap-3 mb-4">
                <StatPill label={freeHoursPeriod === 1 ? "Capacity (Today)" : `Total Capacity (${freeHoursPeriod}d)`} value={`${totalShiftHrs}h`} color="#6366f1" />
                <StatPill label="Booked Hours"                           value={`${totalBookedHrs.toFixed(1)}h`} color="#ef4444" />
                <StatPill label="Free Hours"                             value={`${totalFreeHrs.toFixed(1)}h`}   color="#22c55e" />
                <StatPill label="Avg Utilization"                        value={`${avgUtilization}%`}            color="#f59e0b" />
              </div>

              {shiftCapacityPerDay === 0 ? (
                <EmptyState icon="ti-clock-off" message="Assign shifts to this teacher to see free hours" />
              ) : (
                <div className="row g-2">
                  {freeHoursByDay.map(({ date, sessions, bookedHours, freeHours, utilizationPct }) => {
                    const isToday   = date === todayStr;
                    const dayLabel  = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    const isBusy    = utilizationPct >= 80;
                    const isMedium  = utilizationPct >= 40 && utilizationPct < 80;
                    const barColor  = isBusy ? "#ef4444" : isMedium ? "#f59e0b" : "#22c55e";

                    return (
                      <div key={date} className={`${freeHoursPeriod === 1 ? "col-12" : `col-sm-6 col-md-4 col-lg-${freeHoursPeriod === 7 ? "6" : "4"}`}`}>
                        <div
                          className="border rounded p-3 h-100"
                          style={{
                            borderColor: isToday ? "#6366f1" : undefined,
                            background:  isToday ? "#6366f108" : undefined,
                          }}
                        >
                          {/* Date header */}
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="fw-semibold fs-12" style={{ color: isToday ? "#6366f1" : undefined }}>
                              {isToday ? "Today" : dayLabel}
                            </span>
                            <span
                              className="badge fs-11 rounded-pill"
                              style={{ background: `${barColor}20`, color: barColor, border: `1px solid ${barColor}40` }}
                            >
                              {utilizationPct}%
                            </span>
                          </div>

                          {/* Utilization bar */}
                          <div className="rounded mb-2" style={{ height: 6, background: "#f0f0f0" }}>
                            <div
                              style={{
                                width:        `${utilizationPct}%`,
                                height:       6,
                                borderRadius: 3,
                                background:   barColor,
                                transition:   "width .4s",
                              }}
                            />
                          </div>

                          {/* Hours breakdown */}
                          <div className="d-flex justify-content-between mb-2">
                            <span className="fs-11 text-muted">
                              <span className="fw-semibold text-danger">{bookedHours.toFixed(1)}h</span> booked
                            </span>
                            <span className="fs-11 text-muted">
                              <span className="fw-semibold text-success">{freeHours.toFixed(1)}h</span> free
                            </span>
                          </div>

                          {/* Session pills */}
                          {sessions.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1 mt-1">
                              {sessions.slice(0, 3).map((s) => (
                                <span
                                  key={s.id}
                                  className="badge fs-10 rounded"
                                  style={{ background: "#6366f115", color: "#6366f1", border: "1px solid #6366f130", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={s.title || `Session #${s.id}`}
                                >
                                  {s.title || `Session #${s.id}`}
                                </span>
                              ))}
                              {sessions.length > 3 && (
                                <span className="badge fs-10 rounded badge-soft-secondary border">+{sessions.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted fs-11">No sessions scheduled</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* 2. Assigned Students */}
            <SectionCard title="Assigned Students" icon="ti-users">
              {assignedStudents.length === 0 ? (
                <EmptyState icon="ti-user-off" message="No students assigned to this teacher" />
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Student Name</th>
                        <th>Course</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedStudents.map((s, i) => (
                        <tr key={s.id}>
                          <td className="text-muted fs-12">{i + 1}</td>
                          <td className="fw-medium">
                            <Link href={`/admin/students/${s.id}`} className="text-primary text-decoration-none d-inline-flex align-items-center gap-2">
                              {s.profileImg ? (
                                <img src={`${resolveImageUrl(s.profileImg)}`} alt="" width={26} height={26} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                              ) : (
                                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#e9ecef", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#6c757d", flexShrink: 0 }}><i className="ti ti-user" /></span>
                              )}
                              {s.firstName} {s.lastName}
                            </Link>
                          </td>
                          <td className="text-muted fs-12">{s.courseName}</td>
                          <td>
                            <Link href={`/admin/students/${s.id}`} className="btn btn-outline-info btn-icon btn-xs">
                              <i className="ti ti-eye" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* 3. Courses Taught */}
            <SectionCard title="Courses Taught" icon="ti-book">
              {courses.length === 0 ? (
                <EmptyState icon="ti-books" message="No courses assigned yet" />
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
                        {c.Student && (
                          <p className="mb-1 fs-12 text-muted d-flex align-items-center gap-1">
                            <i className="ti ti-user" />
                            <Link href={`/admin/students/${c.Student.id}`} className="text-primary text-decoration-none">
                              {c.Student.firstName} {c.Student.lastName}
                            </Link>
                          </p>
                        )}
                        <p className="mb-0 text-muted fs-11">Since {fmtDate(c.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* 4. Session History */}
            <SectionCard title="Session History" icon="ti-calendar-check">
              {sessionItems.length === 0 ? (
                <EmptyState icon="ti-calendar-x" message="No session records found" />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total Sessions"  value={totalSessions}  color="#6366f1" />
                    <StatPill label="Completed"       value={completedSessions}                          color="#22c55e" />
                    <StatPill label="Live"            value={liveSessions}                                color="#ef4444" />
                    <StatPill label="Other"           value={totalSessions - completedSessions - liveSessions} color="#f59e0b" />
                  </div>
                  <div className="table-responsive" style={{ maxHeight: 420, overflowY: "auto" }}>
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Session</th>
                          <th>Date</th>
                          <th>Start</th>
                          <th>Course</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionItems.map((s) => (
                          <tr key={s.id}>
                            <td className="fw-medium">{s.title || `Session #${s.id}`}</td>
                            <td className="fs-12 text-muted">{fmtDate(s.date)}</td>
                            <td className="fs-12">{s.startTime ?? "—"}</td>
                            <td className="fs-12 text-muted">{s.Course?.courseName ?? "—"}</td>
                            <td>
                              <span className={`badge ${
                                s.status === "completed" ? "badge-soft-success border border-success" :
                                s.status === "live"      ? "badge-soft-danger border border-danger" :
                                s.status === "upcoming"  ? "badge-soft-primary border border-primary" :
                                "badge-soft-secondary border border-secondary"
                              }`}>{s.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sessionItems.length > 0 && (
                    <p className="text-muted fs-11 mt-2 mb-0 text-end">{sessionItems.length} session{sessionItems.length !== 1 ? "s" : ""} total</p>
                  )}
                </>
              )}
            </SectionCard>

            {/* 5. Attendance (Check-in / Check-out) */}
            <SectionCard title="Work Attendance — Check-in / Check-out" icon="ti-clock">
              {attendanceRecs.length === 0 ? (
                <EmptyState icon="ti-clock-off" message="No attendance records found" />
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <StatPill label="Total Check-ins" value={totalCheckIns}                                      color="#6366f1" />
                    <StatPill label="Total Hours"     value={`${totalHours.toFixed(1)}h`}                       color="#22c55e" />
                    <StatPill label="Avg Hours/Day"   value={avgDailyHours ? `${avgDailyHours}h` : "—"}         color="#f59e0b" />
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th>Check-in</th>
                          <th>Check-out</th>
                          <th>Duration</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecs.map((r) => (
                          <tr key={r.id}>
                            <td className="fs-12 fw-medium">{fmtDate(r.date)}</td>
                            <td className="fs-12 text-success">{fmtTime(r.checkInTime)}</td>
                            <td className="fs-12 text-danger">{r.checkOutTime ? fmtTime(r.checkOutTime) : <span className="text-muted">—</span>}</td>
                            <td className="fs-12">{fmtDuration(r.date, r.checkInTime, r.checkOutTime)}</td>
                            <td className="fs-11 text-muted">{r.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            {/* 6. Feedback Per Session */}
            {perSession.length > 0 && (
              <SectionCard title="Feedback Per Session" icon="ti-chart-bar">
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Session</th>
                        <th>Date</th>
                        <th>Responses</th>
                        <th>Avg Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perSession.map((ps) => (
                        <tr key={ps.sessionId}>
                          <td className="fw-medium">{ps.sessionTitle}</td>
                          <td className="fs-12 text-muted">{fmtDate(ps.date)}</td>
                          <td>{ps.count}</td>
                          <td>
                            {ps.feedback ? (
                              <div className="d-flex align-items-center gap-2">
                                <StarBar value={ps.feedback.overallRating} />
                              </div>
                            ) : <span className="text-muted fs-12">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* 7. Activity Timeline */}
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

            {/* Account Information */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="ti ti-id fs-18 text-primary" /> Account Information
                </h5>
                {([
                  ["ti-mail",          "Email",        teacher.email || "—"],
                  ["ti-phone",         "Contact",      teacher.contact || "—"],
                  ["ti-user",          "Username",     `@${teacher.username}`],
                  ["ti-id",            "CNIC",         teacher.cnic || "—"],
                  ["ti-sun",           "Shifts",       shifts.length > 0 ? shifts.join(", ") : "Not set"],
                  ["ti-calendar-plus", "Member Since", fmtDate(teacher.createdAt)],
                ] as [string, string, string][]).map(([icon, label, value]) => (
                  <div key={label} className="d-flex align-items-center gap-2 mb-2">
                    <span className="avatar avatar-sm rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32 }}>
                      <i className={`ti ${icon} fs-14 text-muted`} />
                    </span>
                    <div>
                      <p className="text-muted fs-11 mb-0">{label}</p>
                      <p className="fw-semibold fs-13 mb-0">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shifts */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="ti ti-clock fs-18 text-primary" /> Work Shifts
                </h5>
                {shifts.length === 0 ? (
                  <p className="text-muted fs-13 mb-0">No shifts assigned</p>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {shifts.map((s) => (
                      <div
                        key={s}
                        className="d-flex align-items-center gap-3 rounded p-2"
                        style={{ background: `${shiftColors[s]}10`, border: `1px solid ${shiftColors[s]}30` }}
                      >
                        <span className="fs-18">{s === "Morning" ? "☀️" : s === "Afternoon" ? "🌤️" : "🌙"}</span>
                        <div>
                          <p className="fw-semibold mb-0" style={{ color: shiftColors[s] }}>{s}</p>
                          <p className="text-muted fs-11 mb-0">
                            {s === "Morning" ? "6:00 AM – 12:00 PM" : s === "Afternoon" ? "12:00 PM – 6:00 PM" : "6:00 PM – 10:00 PM"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Feedback Received */}
            <SectionCard title="Feedback from Students" icon="ti-star">
              {!feedbackSummary || feedbackSummary.count === 0 ? (
                <EmptyState icon="ti-star-off" message="No feedback received yet" />
              ) : (
                <div className="bg-light rounded p-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="fw-semibold fs-13">Average Ratings</span>
                    <span className="badge badge-soft-primary border border-primary">{feedbackSummary.count} response{feedbackSummary.count !== 1 ? "s" : ""}</span>
                  </div>
                  {([
                    ["Teaching Quality", feedbackSummary.teachingQuality],
                    ["Content Clarity",  feedbackSummary.contentClarity],
                    ["Session Pace",     feedbackSummary.sessionPace],
                    ["Engagement",       feedbackSummary.engagement],
                    ["Overall Rating",   feedbackSummary.overallRating],
                  ] as [string, number][]).map(([label, val]) => (
                    <div key={label} className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="fs-12 text-muted">{label}</span>
                        <span className="fs-12 fw-semibold">{val.toFixed(1)}/5</span>
                      </div>
                      <StarBar value={val} />
                    </div>
                  ))}
                  <div className="mt-3 text-center">
                    <div
                      className="d-inline-flex align-items-center gap-1 px-3 py-1 rounded-pill"
                      style={{ background: "#f59e0b20", border: "1px solid #f59e0b40" }}
                    >
                      <i className="ti ti-star-filled text-warning" />
                      <span className="fw-bold text-warning">{feedbackSummary.overallRating.toFixed(2)} / 5.00</span>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>


          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDetail;
