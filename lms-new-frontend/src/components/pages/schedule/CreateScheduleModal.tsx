"use client";

import { useState, useEffect, useRef } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { createScheduleThunk, resetCreateStatus } from "@/core/redux/calendarSlice";
import { fetchCoursesThunk } from "@/core/redux/courseSlice";
import { fetchTeachersThunk } from "@/core/redux/teacherSlice";
import { CreateSchedulePayload, RecurrenceType, Shift } from "@/types/classSchedule";
import { useNotification } from "@/hooks/useNotification";
import { api_base_url, withAuthorization } from "@/services/apiClient";
import { checkScheduleConflicts, ConflictCheckResult } from "@/services/classScheduleService";

const DAYS_OF_WEEK = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

interface CreateScheduleModalProps {
  open: boolean;
  defaultDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SHIFT_HOURS: Record<string, { start: string; end: string; label: string }> = {
  Morning:   { start: "06:00", end: "12:00", label: "6:00 AM – 12:00 PM" },
  Afternoon: { start: "12:00", end: "18:00", label: "12:00 PM – 6:00 PM" },
  Evening:   { start: "18:00", end: "22:00", label: "6:00 PM – 10:00 PM" },
};

// Convert "HH:MM" or "HH:MM:SS" (MySQL TIME) to 12-hour display: "6:00 AM"
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function generateTimeSlots(startHH: string, endHH: string, stepMins = 5): string[] {
  const [sh, sm] = startHH.split(":").map(Number);
  const [eh, em] = endHH.split(":").map(Number);
  const slots: string[] = [];
  for (let mins = sh * 60 + sm; mins <= eh * 60 + em; mins += stepMins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

// Full-day slots at 30-min intervals (no shift selected)
const ALL_DAY_SLOTS = generateTimeSlots("00:00", "23:30", 30);


const SHIFT_OPTIONS: { label: string; value: Shift | ""; description: string }[] = [
  { label: "No specific shift", value: "", description: "" },
  { label: "☀️ Morning (6:00 AM – 12:00 PM)", value: "Morning", description: "6:00 AM – 12:00 PM" },
  { label: "🌤️ Afternoon (12:00 PM – 6:00 PM)", value: "Afternoon", description: "12:00 PM – 6:00 PM" },
  { label: "🌙 Evening (6:00 PM – 10:00 PM)", value: "Evening", description: "6:00 PM – 10:00 PM" },
];

const defaultForm: CreateSchedulePayload = {
  title: "",
  description: "",
  recurrenceType: "one-time",
  daysOfWeek: [],
  startTime: "10:00",
  endTime: "11:00",
  startDate: "",
  endDate: "",
  courseId: 0,
  teacherId: 0,
  studentIds: [],
  shift: null,
};

export default function CreateScheduleModal({
  open,
  defaultDate,
  onClose,
  onSuccess,
}: CreateScheduleModalProps) {
  const dispatch = useAppDispatch();
  const notify = useNotification();
  const { allItems: courses } = useAppSelector((s) => s.courses);
  const { allItems: teachers } = useAppSelector((s) => s.teachers);
  const { createStatus, createError } = useAppSelector((s) => s.calendar);

  const [form, setForm] = useState<CreateSchedulePayload>({ ...defaultForm });
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [conflicts, setConflicts] = useState<ConflictCheckResult | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Generation counter: prevents stale API responses from overwriting newer ones
  // when the user changes fields faster than the debounce interval.
  const conflictGenRef = useRef(0);

  useEffect(() => {
    dispatch(fetchCoursesThunk());
    dispatch(fetchTeachersThunk());
  }, [dispatch]);

  // Fetch enrolled students whenever course selection changes
  useEffect(() => {
    if (!form.courseId) {
      setEnrolledStudents([]);
      return;
    }
    fetch(`${api_base_url}/course/students-by-course/${form.courseId}`, {
      headers: withAuthorization(),
    })
      .then((r) => r.json())
      .then((data) => setEnrolledStudents(data.students || []))
      .catch(() => setEnrolledStudents([]));
  }, [form.courseId]);

  // Debounced conflict check — fires 600ms after teacher/course/date/time change.
  // Generation counter guards against stale responses: if the user changes a field
  // while a request is in-flight, the older response is silently discarded.
  useEffect(() => {
    const { teacherId, courseId, startDate, startTime, endTime } = form;
    if (!teacherId || !courseId || !startDate || !startTime || !endTime) {
      setConflicts(null);
      setConflictLoading(false);
      return;
    }
    if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    const gen = ++conflictGenRef.current;
    conflictTimerRef.current = setTimeout(async () => {
      setConflictLoading(true);
      try {
        const result = await checkScheduleConflicts({
          teacherId,
          courseId,
          date: startDate,
          startTime,
          endTime,
        });
        // Discard if a newer request has already been issued
        if (gen !== conflictGenRef.current) return;
        setConflicts(result);
      } catch {
        if (gen !== conflictGenRef.current) return;
        setConflicts(null);
      } finally {
        if (gen === conflictGenRef.current) setConflictLoading(false);
      }
    }, 600);
    return () => {
      if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    };
  }, [form.teacherId, form.courseId, form.startDate, form.startTime, form.endTime]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setForm({ ...defaultForm, startDate: defaultDate || "" });
      setConflicts(null);
      dispatch(resetCreateStatus());
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, defaultDate, dispatch]);

  useEffect(() => {
    if (createError) notify.error(createError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createError]);

  const isRecurring = form.recurrenceType !== "one-time";
  const loading = createStatus === "loading";
  const hasTeacherConflict = conflicts?.hasTeacherConflict ?? false;

  // Time slots — 5-min intervals within shift window, 30-min for full day
  const timeRange = form.shift ? SHIFT_HOURS[form.shift] : null;
  const timeSlots = timeRange
    ? generateTimeSlots(timeRange.start, timeRange.end, 5)
    : ALL_DAY_SLOTS;


  const toggleDay = (day: number) => {
    const days = form.daysOfWeek || [];
    if (days.includes(day)) {
      setForm((f) => ({ ...f, daysOfWeek: days.filter((d) => d !== day) }));
    } else {
      setForm((f) => ({ ...f, daysOfWeek: [...days, day].sort() }));
    }
  };

  const validate = (): boolean => {
    if (!form.title.trim()) { notify.error("Title is required"); return false; }
    if (!form.startDate) { notify.error("Start date is required"); return false; }
    if (!form.startTime) { notify.error("Start time is required"); return false; }
    if (!form.endTime) { notify.error("End time is required"); return false; }
    if (form.startTime >= form.endTime) { notify.error("End time must be after start time"); return false; }
    if (!form.courseId) { notify.error("Course is required"); return false; }
    if (!form.teacherId) { notify.error("Teacher is required"); return false; }
    if (isRecurring && (!form.daysOfWeek || form.daysOfWeek.length === 0)) {
      notify.error("Select at least one day for recurring schedule");
      return false;
    }
    if (isRecurring && !form.endDate) {
      notify.error("End date is required for recurring schedules");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const payload: CreateSchedulePayload = {
        ...form,
        studentIds: form.studentIds && form.studentIds.length > 0 ? form.studentIds : undefined,
        endDate: isRecurring ? form.endDate : undefined,
        daysOfWeek: isRecurring ? form.daysOfWeek : undefined,
        description: form.description || undefined,
        shift: form.shift || null,
      };
      await dispatch(createScheduleThunk(payload)).unwrap();
      notify.success("Schedule created successfully");
      onSuccess();
      onClose();
    } catch {
      // error shown via createError useEffect
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={!loading ? onClose : undefined}
      />
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1055 }}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content" style={{ borderRadius: 12, overflow: "hidden" }}>
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">
                <i className="ti ti-calendar-plus me-2 text-primary" />
                Create Class Schedule
              </h4>
              <button
                type="button"
                className="btn-close custom-btn-close opacity-100"
                onClick={onClose}
                disabled={loading}
              />
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body" style={{ overflowY: "auto", maxHeight: "min(70vh, calc(100vh - 160px))" }}>
                {/* Title */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Quran Recitation - Mon/Wed"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                {/* Description */}
                <div className="mb-3">
                  <label className="form-label fw-medium">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Optional notes about this schedule"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                {/* Shift */}
                <div className="mb-3">
                  <label className="form-label fw-medium">Shift</label>
                  <select
                    className="form-select"
                    value={form.shift || ""}
                    onChange={(e) => {
                      const val = e.target.value as Shift | "";
                      const range = val ? SHIFT_HOURS[val] : null;
                      setForm((f) => ({
                        ...f,
                        shift: val || null,
                        teacherId: 0,
                        // Clamp existing times into the new shift window; reset to shift defaults if outside
                        startTime: range
                          ? (f.startTime >= range.start && f.startTime < range.end ? f.startTime : range.start)
                          : f.startTime,
                        endTime: range
                          ? (f.endTime > range.start && f.endTime <= range.end ? f.endTime : range.end)
                          : f.endTime,
                      }));
                    }}
                    disabled={loading}
                  >
                    {SHIFT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {form.shift && (
                    <div className="form-text">
                      Sessions will be tagged as <strong>{form.shift}</strong> shift. Only teachers in this shift are shown.
                    </div>
                  )}
                </div>

                {/* Course + Teacher */}
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      Course <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={form.courseId || ""}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, courseId: Number(e.target.value), studentIds: [] }));
                        setStudentSearch("");
                      }}
                      disabled={loading}
                    >
                      <option value="">Select course</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.courseName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      Teacher <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={form.teacherId || ""}
                      onChange={(e) => setForm((f) => ({ ...f, teacherId: Number(e.target.value) }))}
                      disabled={loading}
                    >
                      <option value="">Select teacher</option>
                      {teachers
                        .filter((t) => {
                          if (!form.shift) return true;
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const tShifts = (t as any).shift as Shift[] | null | undefined;
                          return !tShifts || tShifts.length === 0 || tShifts.includes(form.shift as Shift);
                        })
                        .map((t) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const tShifts = (t as any).shift as Shift[] | null | undefined;
                          return (
                            <option key={t.id} value={t.id}>
                              {t.firstName} {t.lastName}
                              {tShifts && tShifts.length > 0 ? ` (${tShifts.join(", ")})` : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {/* Students (optional multi-select, filtered by enrolled) */}
                <div className="mb-3">
                  <label className="form-label fw-medium">Students (optional)</label>
                  {!form.courseId ? (
                    <div className="form-control text-muted" style={{ minHeight: 38, fontSize: 13 }}>
                      Select a course first to see enrolled students
                    </div>
                  ) : enrolledStudents.length === 0 ? (
                    <div className="form-control text-muted" style={{ minHeight: 38, fontSize: 13 }}>
                      No students enrolled in this course
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="form-control form-control-sm mb-2"
                        placeholder="Search students..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        disabled={loading}
                      />
                      <div
                        className="border rounded p-2"
                        style={{ maxHeight: "min(160px, 30vh)", overflowY: "auto", background: "#fafafa" }}
                      >
                        {enrolledStudents
                          .filter((s) =>
                            `${s.firstName} ${s.lastName}`
                              .toLowerCase()
                              .includes(studentSearch.toLowerCase())
                          )
                          .map((s) => {
                            const checked = (form.studentIds || []).includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className="d-flex align-items-center gap-2 px-1 py-1 rounded"
                                style={{ cursor: "pointer", fontSize: 13 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={loading}
                                  onChange={() =>
                                    setForm((f) => ({
                                      ...f,
                                      studentIds: checked
                                        ? (f.studentIds || []).filter((id) => id !== s.id)
                                        : [...(f.studentIds || []), s.id],
                                    }))
                                  }
                                />
                                {s.firstName} {s.lastName}
                              </label>
                            );
                          })}
                      </div>
                    </>
                  )}
                  <div className="form-text">
                    <i className="ti ti-info-circle me-1" />
                    Leave empty — all students enrolled in this course will see the session.
                  </div>
                </div>

                {/* Recurrence type */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Recurrence <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {(["one-time", "weekly", "biweekly"] as RecurrenceType[]).map((rt) => (
                      <button
                        key={rt}
                        type="button"
                        className={`btn btn-sm ${
                          form.recurrenceType === rt ? "btn-primary" : "btn-outline-secondary"
                        }`}
                        onClick={() => setForm((f) => ({ ...f, recurrenceType: rt }))}
                        disabled={loading}
                      >
                        {rt === "one-time" ? "One-time" : rt === "weekly" ? "Weekly" : "Biweekly"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Days of week (recurring only) */}
                {isRecurring && (
                  <div className="mb-3">
                    <label className="form-label fw-medium">
                      Days of week <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex gap-1 flex-wrap">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          className={`btn btn-sm ${
                            (form.daysOfWeek || []).includes(d.value)
                              ? "btn-primary"
                              : "btn-outline-secondary"
                          }`}
                          style={{ minWidth: 44 }}
                          onClick={() => toggleDay(d.value)}
                          disabled={loading}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date range */}
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      {isRecurring ? "Start Date" : "Date"}{" "}
                      <span className="text-danger">*</span>
                    </label>
                    <DatePicker
                      style={{ width: "100%" }}
                      value={form.startDate ? dayjs(form.startDate) : null}
                      onChange={(_, ds) => setForm((f) => ({ ...f, startDate: ds as string }))}
                      format="YYYY-MM-DD"
                      placeholder="Select date"
                      disabled={loading}
                    />
                  </div>
                  {isRecurring && (
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-medium">
                        End Date <span className="text-danger">*</span>
                      </label>
                      <DatePicker
                        style={{ width: "100%" }}
                        value={form.endDate ? dayjs(form.endDate) : null}
                        onChange={(_, ds) => setForm((f) => ({ ...f, endDate: ds as string }))}
                        format="YYYY-MM-DD"
                        placeholder="Select date"
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>

                {/* Time — stored in PKT (Asia/Karachi); students see times converted to their timezone */}
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      Start Time <span className="text-danger">*</span>
                      <span className="ms-1 text-muted fw-normal" style={{ fontSize: 11 }}>(PKT)</span>
                    </label>
                    <select
                      className="form-select"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      disabled={loading}
                    >
                      {timeSlots.slice(0, -1).map((t) => (
                        <option key={t} value={t}>{fmt12(t)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      End Time <span className="text-danger">*</span>
                      <span className="ms-1 text-muted fw-normal" style={{ fontSize: 11 }}>(PKT)</span>
                    </label>
                    <select
                      className="form-select"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      disabled={loading}
                    >
                      {timeSlots.slice(1).map((t) => (
                        <option key={t} value={t}>{fmt12(t)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Conflict check panel */}
                {(conflictLoading || conflicts) && (
                  <div className="mb-3">
                    {conflictLoading ? (
                      <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: 13 }}>
                        <span className="spinner-border spinner-border-sm" />
                        Checking for scheduling conflicts on {form.startDate}…
                      </div>
                    ) : conflicts && !conflicts.hasTeacherConflict && !conflicts.hasStudentConflict ? (
                      <div
                        className="d-flex align-items-center gap-2 px-3 py-2 rounded"
                        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, color: "#15803d" }}
                      >
                        <i className="ti ti-circle-check fs-5" />
                        No conflicts on {form.startDate} for the selected teacher and enrolled students.
                        {isRecurring && (
                          <span className="ms-1 text-muted" style={{ fontSize: 11 }}>
                            (first occurrence only — other dates not checked)
                          </span>
                        )}
                      </div>
                    ) : conflicts ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {isRecurring && (
                          <div
                            className="d-flex align-items-center gap-2 px-3 py-2 rounded"
                            style={{ background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 12, color: "#0369a1" }}
                          >
                            <i className="ti ti-info-circle" />
                            Conflicts shown are for <strong>{form.startDate}</strong> only. Other recurrence dates are not pre-checked.
                          </div>
                        )}

                        {/* Teacher conflicts — HARD BLOCK */}
                        {conflicts.hasTeacherConflict && (
                          <div
                            className="rounded p-3"
                            style={{ background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13 }}
                          >
                            <div className="d-flex align-items-center gap-2 fw-semibold mb-2" style={{ color: "#b91c1c" }}>
                              <i className="ti ti-alert-circle fs-5" />
                              Teacher already has sessions at this time — creation blocked
                            </div>
                            <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Session</th>
                                  <th>Course</th>
                                  <th>Time</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {conflicts.teacherConflicts.map((s) => (
                                  <tr key={s.id}>
                                    <td>{s.title}</td>
                                    <td>{s.Course?.courseName ?? "—"}</td>
                                    <td>{fmt12(s.startTime)}–{fmt12(s.endTime)}</td>
                                    <td>
                                      <span
                                        className="badge"
                                        style={{
                                          background: s.sessionStatus === "live" ? "#22c55e" : "#6b7280",
                                          color: "#fff",
                                          fontSize: 10,
                                        }}
                                      >
                                        {s.sessionStatus}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Student conflicts — SOFT WARNING */}
                        {conflicts.hasStudentConflict && (
                          <div
                            className="rounded p-3"
                            style={{ background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13 }}
                          >
                            <div className="d-flex align-items-center gap-2 fw-semibold mb-2" style={{ color: "#92400e" }}>
                              <i className="ti ti-alert-triangle fs-5" />
                              {conflicts.studentConflicts.length} enrolled student(s) have conflicting sessions — you can still create
                            </div>
                            <table className="table table-sm mb-0" style={{ fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Student</th>
                                  <th>Conflicting Session</th>
                                  <th>Course</th>
                                  <th>Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {conflicts.studentConflicts.map((sc, idx) => (
                                  <tr key={`${sc.studentId}-${sc.session.id}-${idx}`}>
                                    <td>{sc.studentName}</td>
                                    <td>{sc.session.title}</td>
                                    <td>{sc.session.course?.courseName ?? "—"}</td>
                                    <td>{fmt12(sc.session.startTime)}–{fmt12(sc.session.endTime)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Recurring info */}
                {isRecurring &&
                  form.daysOfWeek &&
                  form.daysOfWeek.length > 0 &&
                  form.startDate &&
                  form.endDate && (
                    <div className="alert alert-info py-2 mb-0" style={{ fontSize: 12 }}>
                      <i className="ti ti-info-circle me-1" />
                      Individual sessions will be auto-generated for every{" "}
                      {form.daysOfWeek
                        .map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label)
                        .join(", ")}{" "}
                      between {form.startDate} and {form.endDate}.
                    </div>
                  )}
              </div>

              <div className="modal-footer d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || conflictLoading || hasTeacherConflict}
                  title={
                    hasTeacherConflict ? "Resolve teacher conflict before creating" :
                    conflictLoading ? "Checking for conflicts…" : undefined
                  }
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-calendar-plus me-2" />
                      {conflicts?.hasStudentConflict && !hasTeacherConflict ? "Create Anyway" : "Create Schedule"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
