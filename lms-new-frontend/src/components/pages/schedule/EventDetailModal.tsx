"use client";

import { useState, useEffect } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { CalendarEvent, UserRole } from "@/types/classSchedule";
import { SessionFeedbackResponse } from "@/types/feedback";
import { getSessionFeedback } from "@/services/feedbackService";
import { useAppDispatch } from "@/core/redux/hooks";
import { useNotification } from "@/hooks/useNotification";
import {
  cancelSessionThunk,
  approveScheduleThunk,
  markSessionCancelledOptimistic,
  markSessionUpdatedOptimistic,
  markSessionLiveOptimistic,
  fetchCalendarEventsThunk,
  fetchPendingApprovalsThunk,
  resetCancelStatus,
  resetApproveStatus,
  openCall,
} from "@/core/redux/calendarSlice";
import { joinSession, startSession, endSession, updateSession, updateLesson, UpdateSessionPayload, getSessionTranscript, LessonPayload } from "@/services/classScheduleService";
import { api_base_url, withAuthorization } from "@/services/apiClient";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  role: UserRole;
  onClose: () => void;
  calendarParams: { userId: string; role: UserRole; start: string; end: string; timezone?: string };
}

const TYPE_LABELS: Record<string, string> = {
  class: "Class",
  quiz: "Quiz",
  assignment: "Assignment",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "badge-soft-primary border-primary" },
  completed: { label: "Completed", className: "badge-soft-secondary border-secondary" },
  cancelled: { label: "Cancelled", className: "badge-soft-danger border-danger" },
  makeup: { label: "Makeup", className: "badge-soft-info border-info" },
  pending: { label: "Pending Approval", className: "badge-soft-warning border-warning" },
  active: { label: "Active", className: "badge-soft-success border-success" },
};

export default function EventDetailModal({ event, role, onClose, calendarParams }: EventDetailModalProps) {
  const dispatch = useAppDispatch();
  const notify = useNotification();
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [approving, setApproving] = useState(false);
  // Calling state
  const [joiningCall, setJoiningCall] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  // End-session lesson flow
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEndLessonStep, setShowEndLessonStep] = useState(false);
  const [endLessonTitle, setEndLessonTitle] = useState("");
  const [endLessonDescription, setEndLessonDescription] = useState("");
  const [endLessonDueDate, setEndLessonDueDate] = useState("");

  // Edit session state (admin only, scheduled+idle)
  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<UpdateSessionPayload>({});
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Feedback panel (teacher/admin: view session feedback)
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [feedbackData, setFeedbackData] = useState<SessionFeedbackResponse | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Transcript download
  const [downloadingTranscript, setDownloadingTranscript] = useState(false);

  // Lesson notes (teacher: editable; student/parent: read-only)
  const [lessonEditTitle, setLessonEditTitle] = useState("");
  const [lessonEditDescription, setLessonEditDescription] = useState("");
  const [lessonEditDueDate, setLessonEditDueDate] = useState("");
  const [lessonEditing, setLessonEditing] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonSaved, setLessonSaved] = useState(false);
  // Local copy of lesson data so we can update it after save without re-fetching
  const [localLesson, setLocalLesson] = useState<{ title: string | null; description: string | null; dueDate: string | null }>({ title: null, description: null, dueDate: null });

  useEffect(() => {
    if (event) {
      document.body.style.overflow = "hidden";
      // Pre-fill edit form from event data
      const startIso = event.start ?? "";
      const endIso = event.end ?? "";
      setStudentSearch("");
      // Pre-fill from junction table studentIds array (falls back to legacy single studentId)
      const currentStudentIds = event.extendedProps.studentIds;
      const legacyStudentId = event.extendedProps.studentId;
      setSelectedStudentIds(
        currentStudentIds && currentStudentIds.length > 0
          ? currentStudentIds
          : legacyStudentId ? [legacyStudentId] : []
      );
      setEditForm({
        title: event.title,
        date: startIso.slice(0, 10),
        startTime: startIso.slice(11, 16),
        endTime: endIso.slice(11, 16),
        shift: (event.extendedProps.shift as string) ?? undefined,
      });
      // Fetch enrolled students for this session's course
      const courseId = event.extendedProps.courseId;
      if (courseId) {
        fetch(`${api_base_url}/course/students-by-course/${courseId}`, {
          headers: withAuthorization(),
        })
          .then((r) => r.json())
          .then((data) => setEnrolledStudents(data.students || []))
          .catch(() => setEnrolledStudents([]));
      } else {
        setEnrolledStudents([]);
      }
      // Initialize lesson state from event data
      setLocalLesson({
        title: event.extendedProps.lessonTitle ?? null,
        description: event.extendedProps.lessonDescription ?? null,
        dueDate: event.extendedProps.lessonDueDate ?? null,
      });
      setLessonEditTitle(event.extendedProps.lessonTitle ?? "");
      setLessonEditDescription(event.extendedProps.lessonDescription ?? "");
      setLessonEditDueDate(event.extendedProps.lessonDueDate ?? "");
      setLessonEditing(false);
      setLessonSaved(false);
    } else {
      document.body.style.overflow = "";
      setShowCancelForm(false);
      setCancelReason("");
      setShowEditForm(false);
      setShowFeedbackPanel(false);
      setFeedbackData(null);
      setEnrolledStudents([]);
      setSelectedStudentIds([]);
      setDownloadingTranscript(false);
      setLessonEditing(false);
      setLessonSaved(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [event]);

  const sessionId = event?.extendedProps?.sessionId;

  // Load feedback data when the panel is toggled open
  useEffect(() => {
    if (!showFeedbackPanel || !sessionId) return;
    setFeedbackLoading(true);
    setFeedbackError(null);
    getSessionFeedback(sessionId)
      .then((data) => {
        setFeedbackData(data);
        setFeedbackLoading(false);
      })
      .catch((err: unknown) => {
        setFeedbackError((err as Error).message || "Failed to load feedback");
        setFeedbackLoading(false);
      });
  }, [showFeedbackPanel, sessionId]);

  if (!event) return null;

  const props = event.extendedProps;
  const isClass = props.type === "class";
  const isQuiz = props.type === "quiz";
  const isAssignment = props.type === "assignment";
  const isCancelled = props.status === "cancelled";
  const isPending = props.status === "pending";
  const isScheduled = props.status === "scheduled";
  // Live-call lifecycle
  const sessionStatus = props.sessionStatus ?? "idle";
  // A cancelled session must never show LIVE even if sessionStatus is stale in the data
  const isLive = sessionStatus === "live" && !isCancelled;
  const isSessionEnded = sessionStatus === "ended" || (sessionStatus === "live" && isCancelled);
  const isIdle = sessionStatus === "idle";

  // Use the same timezone as the calendar so detail modal always matches what the user sees
  const displayTz = calendarParams.timezone || "Asia/Karachi";
  // Short label for time inputs: "Asia/Karachi" → "Karachi", "America/New_York" → "New York"
  const tzLabel = displayTz.includes("/")
    ? displayTz.split("/").pop()!.replace(/_/g, " ")
    : displayTz;

  const formatDateTime = (dateTimeStr: string) => {
    const d = new Date(dateTimeStr);
    return d.toLocaleString("en-US", {
      timeZone: displayTz,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight; use UTC to avoid day-boundary shift
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    const d = new Date(isDateOnly ? dateStr + "T00:00:00" : dateStr);
    return d.toLocaleDateString("en-US", {
      timeZone: isDateOnly ? "UTC" : displayTz,
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCancelSession = async () => {
    if (!props.sessionId) return;
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      await dispatch(
        cancelSessionThunk({
          sessionId: String(props.sessionId),
          reason: cancelReason.trim(),
          cancelledByRole: calendarParams.role,
        }),
      ).unwrap();
      dispatch(
        markSessionCancelledOptimistic({
          sessionId: props.sessionId,
          reason: cancelReason.trim(),
        }),
      );
      dispatch(fetchCalendarEventsThunk(calendarParams));
      notify.success("Session cancelled successfully");
      setCancelReason("");
      setShowCancelForm(false);
      onClose();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to cancel session.");
    } finally {
      setCancelling(false);
      dispatch(resetCancelStatus());
    }
  };

  const handleApprove = async () => {
    if (!props.scheduleId) return;
    setApproving(true);
    try {
      await dispatch(approveScheduleThunk(String(props.scheduleId))).unwrap();
      dispatch(fetchCalendarEventsThunk(calendarParams));
      dispatch(fetchPendingApprovalsThunk());
      dispatch(resetApproveStatus());
      notify.success("Session approved successfully");
      onClose();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to approve session.");
    } finally {
      setApproving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Save lesson note handler (teacher/admin, ended sessions)
  // ---------------------------------------------------------------------------
  const handleSaveLesson = async () => {
    if (!sessionId) return;
    setSavingLesson(true);
    try {
      await updateLesson(sessionId, calendarParams.userId, calendarParams.role, {
        lessonTitle: lessonEditTitle.trim() || undefined,
        lessonDescription: lessonEditDescription.trim() || undefined,
        lessonDueDate: lessonEditDueDate || undefined,
      });
      setLocalLesson({
        title: lessonEditTitle.trim() || null,
        description: lessonEditDescription.trim() || null,
        dueDate: lessonEditDueDate || null,
      });
      setLessonEditing(false);
      setLessonSaved(true);
      setTimeout(() => setLessonSaved(false), 3000);
    } catch {
      notify.error("Failed to save lesson note.");
    } finally {
      setSavingLesson(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Edit session handler (admin only, scheduled+idle)
  // ---------------------------------------------------------------------------
  const handleSaveEdit = async () => {
    if (!sessionId) return;
    if (!editForm.title?.trim() || !editForm.date || !editForm.startTime || !editForm.endTime) {
      notify.error("Title, date, and time are required.");
      return;
    }
    if (editForm.startTime >= editForm.endTime) {
      notify.error("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await updateSession(sessionId, { ...editForm, studentIds: selectedStudentIds });
      dispatch(markSessionUpdatedOptimistic({ sessionId, ...editForm }));
      dispatch(fetchCalendarEventsThunk(calendarParams));
      notify.success("Session updated. Teacher, students, and parents have been notified.");
      setShowEditForm(false);
      onClose();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to update session.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Calling handlers
  // ---------------------------------------------------------------------------
  const handleJoinCall = async () => {
    if (!props.sessionId) return;
    setJoiningCall(true);
    try {
      const { joinUrl } = await joinSession(props.sessionId, calendarParams.userId, calendarParams.role);
      dispatch(openCall({ sessionId: props.sessionId, joinUrl, sessionTitle: event!.title, courseId: props.courseId ?? null }));
      onClose();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Unable to join call.");
    } finally {
      setJoiningCall(false);
    }
  };

  const handleStartSession = async () => {
    if (!props.sessionId) return;
    setStartingSession(true);
    try {
      await startSession(props.sessionId, calendarParams.userId, calendarParams.role);
      dispatch(markSessionLiveOptimistic({ sessionId: props.sessionId, sessionStatus: "live" }));
      // Now join automatically
      const { joinUrl } = await joinSession(props.sessionId, calendarParams.userId, calendarParams.role);
      dispatch(openCall({ sessionId: props.sessionId, joinUrl, sessionTitle: event!.title, courseId: props.courseId ?? null }));
      notify.success("Session started");
      onClose();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Unable to start session.");
    } finally {
      setStartingSession(false);
    }
  };

  const handleEndSessionClick = () => setShowEndConfirm(true);

  const handleCancelEndFlow = () => {
    setShowEndConfirm(false);
    setShowEndLessonStep(false);
    setEndLessonTitle("");
    setEndLessonDescription("");
    setEndLessonDueDate("");
  };

  const handleConfirmEndSession = async (skipLesson = false) => {
    if (!props.sessionId) return;
    setEndingSession(true);
    try {
      const lessonData: LessonPayload = skipLesson ? {} : {
        lessonTitle: endLessonTitle.trim() || undefined,
        lessonDescription: endLessonDescription.trim() || undefined,
        lessonDueDate: endLessonDueDate || undefined,
      };
      await endSession(props.sessionId, calendarParams.userId, calendarParams.role, lessonData);
      dispatch(markSessionLiveOptimistic({ sessionId: props.sessionId, sessionStatus: "ended" }));
      dispatch(fetchCalendarEventsThunk(calendarParams));
      notify.success("Session ended");
      handleCancelEndFlow();
      onClose();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Unable to end session.");
    } finally {
      setEndingSession(false);
    }
  };

  const typeLabel = TYPE_LABELS[props.type] || props.type;
  const statusInfo = STATUS_BADGE[props.status as string] || {
    label: props.status,
    className: "badge-soft-secondary border-secondary",
  };

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={!cancelling && !approving && !saving ? onClose : undefined}
      />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content" style={{ overflow: "hidden", borderRadius: 12 }}>
            {/* Colored header strip */}
            <div
              style={{
                background: event.backgroundColor,
                padding: "16px 20px",
              }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i
                    className={`ti ${
                      isClass ? "ti-calendar" : isQuiz ? "ti-list-check" : "ti-file-description"
                    } text-white fs-20`}
                  />
                  <div>
                    <div className="fw-bold text-white fs-16">{event.title}</div>
                    <div className="text-white opacity-75" style={{ fontSize: 12 }}>
                      {typeLabel}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close opacity-100"
                  onClick={onClose}
                  disabled={cancelling || approving || saving}
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: "auto", maxHeight: "min(65vh, calc(100vh - 160px))" }}>
              {/* Status badges */}
              <div className="mb-3 mt-1 d-flex align-items-center gap-2 flex-wrap">
                <span className={`badge ${statusInfo.className} border fw-medium px-2 py-1`}>{statusInfo.label}</span>
                {isClass && isLive && (
                  <span
                    className="badge fw-bold px-2 py-1"
                    style={{
                      background: "#22c55e",
                      color: "#fff",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#fff",
                        animation: "livePulse 1.5s infinite",
                      }}
                    />
                    LIVE
                  </span>
                )}
                {isClass && isSessionEnded && (
                  <span className="badge badge-soft-secondary border fw-medium px-2 py-1" style={{ fontSize: 11 }}>
                    Call Ended
                  </span>
                )}
              </div>

              {/* Date/Time info */}
              <div className="mb-3">
                {event.start && !event.allDay && (
                  <div className="d-flex align-items-start gap-2 mb-2">
                    <i className="ti ti-clock text-muted mt-1" style={{ minWidth: 16 }} />
                    <div>
                      <div className="fw-medium text-dark" style={{ fontSize: 13 }}>
                        {formatDateTime(event.start)}
                      </div>
                      {event.end && event.end !== event.start && (
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          to {formatDateTime(event.end)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {event.allDay && event.start && (
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="ti ti-calendar text-muted" style={{ minWidth: 16 }} />
                    <span className="text-dark fw-medium" style={{ fontSize: 13 }}>
                      {formatDate(event.start)}
                    </span>
                  </div>
                )}
              </div>

              {/* Course info */}
              {props.courseName && (
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="ti ti-book text-muted" style={{ minWidth: 16 }} />
                  <span style={{ fontSize: 13 }}>{props.courseName}</span>
                </div>
              )}

              {/* Teacher info */}
              {isClass && props.teacherName && (
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="ti ti-user text-muted" style={{ minWidth: 16 }} />
                  <span style={{ fontSize: 13 }}>{props.teacherName}</span>
                </div>
              )}

              {/* Student info (admin/teacher/parent) */}
              {isClass && props.studentName && (role === "admin" || role === "teacher" || role === "parent") && (
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="ti ti-user-circle text-muted" style={{ minWidth: 16 }} />
                  <span style={{ fontSize: 13 }}>{props.studentName}</span>
                </div>
              )}

              {/* Cancellation reason */}
              {isCancelled && props.cancellationReason && (
                <div className="alert alert-danger py-2 mt-3" style={{ fontSize: 13 }}>
                  <i className="ti ti-alert-circle me-1" />
                  <strong>Cancellation reason:</strong> {props.cancellationReason}
                </div>
              )}

              {/* Admin: Inline edit form (scheduled+idle only) */}
              {role === "admin" && isClass && isScheduled && isIdle && showEditForm && (
                <div className="border border-primary rounded p-3 mt-3">
                  <div className="fw-medium text-primary mb-2" style={{ fontSize: 13 }}>
                    <i className="ti ti-pencil me-1" />
                    Edit Session
                  </div>
                  <div className="alert alert-info py-1 small mb-2">
                    Teacher, students, and parents will be notified of changes.
                  </div>

                  <div className="mb-2">
                    <label className="form-label small mb-1 fw-medium">Title</label>
                    <input
                      className="form-control form-control-sm"
                      value={editForm.title ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label small mb-1 fw-medium">Date</label>
                    <DatePicker
                      size="small"
                      style={{ width: "100%" }}
                      value={editForm.date ? dayjs(editForm.date) : null}
                      onChange={(_, ds) => setEditForm((f) => ({ ...f, date: ds as string }))}
                      format="YYYY-MM-DD"
                      placeholder="Select date"
                    />
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-12 col-sm-6">
                      <label className="form-label small mb-1 fw-medium">
                        Start
                        <span className="ms-1 text-muted fw-normal" style={{ fontSize: 10 }}>({tzLabel})</span>
                      </label>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={editForm.startTime ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label small mb-1 fw-medium">
                        End
                        <span className="ms-1 text-muted fw-normal" style={{ fontSize: 10 }}>({tzLabel})</span>
                      </label>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={editForm.endTime ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small mb-1 fw-medium">Shift</label>
                    <select
                      className="form-select form-select-sm"
                      value={editForm.shift ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, shift: e.target.value || undefined }))}
                    >
                      <option value="">— No shift —</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small mb-1 fw-medium">Students (optional)</label>
                    {enrolledStudents.length === 0 ? (
                      <div className="form-control form-control-sm text-muted" style={{ fontSize: 12 }}>
                        No students enrolled in this course
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="form-control form-control-sm mb-1"
                          placeholder="Search students..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                        />
                        <div className="border rounded p-1" style={{ maxHeight: "min(130px, 25vh)", overflowY: "auto", background: "#fafafa" }}>
                          {enrolledStudents
                            .filter((s) =>
                              `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase())
                            )
                            .map((s) => {
                              const checked = selectedStudentIds.includes(s.id);
                              return (
                                <label
                                  key={s.id}
                                  className="d-flex align-items-center gap-2 px-1 py-1 rounded"
                                  style={{ cursor: "pointer", fontSize: 12 }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setSelectedStudentIds((ids) =>
                                        checked ? ids.filter((id) => id !== s.id) : [...ids, s.id]
                                      )
                                    }
                                  />
                                  {s.firstName} {s.lastName}
                                </label>
                              );
                            })}
                        </div>
                      </>
                    )}
                    <div className="form-text" style={{ fontSize: 11 }}>
                      Leave empty — all enrolled students will see this session.
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small mb-1 fw-medium">Notes</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      value={editForm.notes ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value || undefined }))}
                    />
                  </div>

                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-grow-1"
                      onClick={handleSaveEdit}
                      disabled={saving}
                    >
                      {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                      Save Changes
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowEditForm(false)}
                      disabled={saving}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* Quiz details */}
              {isQuiz && (
                <div className="mt-2">
                  {props.duration && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="ti ti-clock text-muted" style={{ minWidth: 16 }} />
                      <span style={{ fontSize: 13 }}>Duration: {props.duration} min</span>
                    </div>
                  )}
                  {props.passingScore !== undefined && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="ti ti-award text-muted" style={{ minWidth: 16 }} />
                      <span style={{ fontSize: 13 }}>Passing score: {props.passingScore}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Assignment details */}
              {isAssignment && (
                <div className="mt-2">
                  {props.dueDate && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="ti ti-calendar-due text-muted" style={{ minWidth: 16 }} />
                      <span style={{ fontSize: 13 }}>Due: {formatDate(props.dueDate)}</span>
                    </div>
                  )}
                  {props.maxScore !== undefined && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="ti ti-star text-muted" style={{ minWidth: 16 }} />
                      <span style={{ fontSize: 13 }}>Max score: {props.maxScore}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Teacher/Admin/Student: Download Whisper transcript for ended/completed sessions */}
              {isClass && (isSessionEnded || props.status === "completed") &&
                (role === "teacher" || role === "admin" || role === "student") && sessionId && (
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                    disabled={downloadingTranscript}
                    onClick={async () => {
                      setDownloadingTranscript(true);
                      try {
                        const data = await getSessionTranscript(sessionId);
                        if (!data.transcriptText) {
                          notify.info("No transcript available for this session yet.");
                          return;
                        }
                        const blob = new Blob([data.transcriptText], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `transcript-session-${sessionId}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        notify.error("Failed to fetch transcript.");
                      } finally {
                        setDownloadingTranscript(false);
                      }
                    }}
                  >
                    {downloadingTranscript ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="ti ti-file-text" />
                    )}
                    Download Transcript
                  </button>
                </div>
              )}

              {/* Today's Lesson — shown for ended/completed class sessions */}
              {isClass && (isSessionEnded || props.status === "completed") && (
                <div className="mt-3">
                  <div className="border rounded p-3" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", borderColor: "#c4b5fd !important" }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <i className="ti ti-book-2" style={{ color: "#7c3aed", fontSize: 16 }} />
                        <span className="fw-semibold" style={{ fontSize: 13, color: "#5b21b6" }}>Today&apos;s Lesson</span>
                      </div>
                      {/* Teacher/Admin: edit button */}
                      {(role === "teacher" || role === "admin") && !lessonEditing && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: "transparent", border: "1px solid #c4b5fd", color: "#7c3aed", fontSize: 11, padding: "2px 10px", borderRadius: 6 }}
                          onClick={() => setLessonEditing(true)}
                        >
                          <i className="ti ti-pencil me-1" style={{ fontSize: 11 }} />
                          {localLesson.title ? "Edit" : "Add"}
                        </button>
                      )}
                    </div>

                    {/* Teacher/Admin: edit form */}
                    {(role === "teacher" || role === "admin") && lessonEditing ? (
                      <div>
                        <div className="mb-2">
                          <label className="form-label small mb-1 fw-medium">Lesson Title</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Chapter 4: Algebra Basics"
                            maxLength={200}
                            value={lessonEditTitle}
                            onChange={(e) => setLessonEditTitle(e.target.value)}
                          />
                        </div>
                        <div className="mb-2">
                          <label className="form-label small mb-1 fw-medium">Description / Homework</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={3}
                            placeholder="What was covered? Any homework or reading..."
                            value={lessonEditDescription}
                            onChange={(e) => setLessonEditDescription(e.target.value)}
                            style={{ resize: "none" }}
                          />
                        </div>
                        <div className="mb-2">
                          <label className="form-label small mb-1 fw-medium">Due Date <span className="text-muted fw-normal">(optional)</span></label>
                          <DatePicker
                            size="small"
                            style={{ width: "100%" }}
                            value={lessonEditDueDate ? dayjs(lessonEditDueDate) : null}
                            onChange={(_, ds) => setLessonEditDueDate(ds as string)}
                            format="YYYY-MM-DD"
                            placeholder="Select due date"
                          />
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveLesson}
                            disabled={savingLesson}
                          >
                            {savingLesson ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ti ti-device-floppy me-1" />}
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            onClick={() => {
                              setLessonEditing(false);
                              setLessonEditTitle(localLesson.title ?? "");
                              setLessonEditDescription(localLesson.description ?? "");
                              setLessonEditDueDate(localLesson.dueDate ?? "");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : localLesson.title ? (
                      /* Display lesson data */
                      <div>
                        {lessonSaved && (
                          <div className="alert alert-success py-1 px-2 mb-2" style={{ fontSize: 12 }}>
                            <i className="ti ti-circle-check me-1" /> Lesson notes saved!
                          </div>
                        )}
                        <div className="fw-semibold mb-1" style={{ fontSize: 14 }}>{localLesson.title}</div>
                        {localLesson.description && (
                          <p className="mb-1 text-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{localLesson.description}</p>
                        )}
                        {localLesson.dueDate && (
                          <span className="badge" style={{ background: "#ede9fe", color: "#5b21b6", fontSize: 11, fontWeight: 600 }}>
                            <i className="ti ti-calendar-due me-1" />
                            Due: {new Date(localLesson.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    ) : (
                      /* No lesson yet */
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        {(role === "teacher" || role === "admin")
                          ? "No lesson notes added yet. Click 'Add' to share today's lesson with students."
                          : "No lesson notes shared for this session."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Teacher/Admin: Feedback panel for ended/completed sessions */}
              {(role === "teacher" || role === "admin") && isClass && (isSessionEnded || props.status === "completed") && (
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                    onClick={() => setShowFeedbackPanel((v) => !v)}
                  >
                    <i className={`ti ${showFeedbackPanel ? "ti-chevron-up" : "ti-message-star"}`} />
                    {showFeedbackPanel ? "Hide Feedback" : "View Session Feedback"}
                  </button>

                  {showFeedbackPanel && (
                    <div className="border rounded p-2 p-md-3 mt-2" style={{ background: "#f8f9ff" }}>
                      {feedbackLoading && (
                        <div className="text-center py-3">
                          <div className="spinner-border spinner-border-sm text-primary" />
                        </div>
                      )}
                      {feedbackError && (
                        <div className="alert alert-danger py-2" style={{ fontSize: 13 }}>
                          {feedbackError}
                        </div>
                      )}
                      {feedbackData && !feedbackLoading && (
                        <>
                          {feedbackData.feedbacks.length === 0 ? (
                            <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                              <i className="ti ti-message-off me-1" />
                              No feedback submitted for this session yet.
                            </p>
                          ) : (
                            <>
                              {/* Summary averages */}
                              {feedbackData.summary && (
                                <div className="mb-3">
                                  <div className="fw-semibold mb-2" style={{ fontSize: 13 }}>
                                    Average Ratings ({feedbackData.summary.count} response{feedbackData.summary.count !== 1 ? "s" : ""})
                                  </div>
                                  {(
                                    [
                                      ["Teaching Quality", feedbackData.summary.teachingQuality],
                                      ["Content Clarity", feedbackData.summary.contentClarity],
                                      ["Session Pace", feedbackData.summary.sessionPace],
                                      ["Engagement", feedbackData.summary.engagement],
                                      ["Overall", feedbackData.summary.overallRating],
                                    ] as [string, number][]
                                  ).map(([label, val]) => (
                                    <div key={label} className="mb-1">
                                      <div className="d-flex justify-content-between" style={{ fontSize: 12 }}>
                                        <span>{label}</span>
                                        <span className="fw-semibold">{val?.toFixed(1)} / 5</span>
                                      </div>
                                      <div
                                        className="rounded-pill"
                                        style={{ height: 5, background: "#E5E7EB", overflow: "hidden" }}
                                      >
                                        <div
                                          className="rounded-pill"
                                          style={{
                                            width: `${((val / 5) * 100).toFixed(0)}%`,
                                            height: "100%",
                                            background: val >= 4 ? "#22C55E" : val >= 3 ? "#F59E0B" : "#EF4444",
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Individual responses */}
                              <div className="fw-semibold mb-2" style={{ fontSize: 13 }}>
                                {role === "admin" ? "Responses" : "Anonymous Responses"}
                              </div>
                              <div style={{ maxHeight: "min(180px, 35vh)", overflowY: "auto" }}>
                                {feedbackData.feedbacks.map((fb) => (
                                  <div
                                    key={fb.id}
                                    className="border rounded p-2 mb-2"
                                    style={{ background: "#fff", fontSize: 12 }}
                                  >
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                      {role === "admin" && fb.Student ? (
                                        <span className="fw-medium">
                                          {fb.Student.firstName} {fb.Student.lastName}
                                        </span>
                                      ) : (
                                        <span className="text-muted fst-italic">Anonymous</span>
                                      )}
                                      <span style={{ color: "#F59E0B" }}>
                                        {"★".repeat(fb.overallRating)}
                                        {"☆".repeat(5 - fb.overallRating)}
                                        <span className="text-muted ms-1">{fb.overallRating}/5</span>
                                      </span>
                                    </div>
                                    {fb.comment && (
                                      <p className="mb-0 text-muted" style={{ fontSize: 12 }}>
                                        &ldquo;{fb.comment}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Student: waiting notice when session is idle */}
              {role === "student" && isClass && isScheduled && isIdle && (
                <div className="d-flex align-items-center gap-2 mt-3 text-muted" style={{ fontSize: 13 }}>
                  <div
                    className="spinner-grow spinner-grow-sm text-primary"
                    role="status"
                    style={{ width: 10, height: 10 }}
                  />
                  Waiting for the teacher to start the session…
                </div>
              )}

              {/* Admin/Teacher: Cancel session form */}
              {(role === "admin" || role === "teacher") && isClass && !isCancelled && showCancelForm && (
                <div className="border border-danger rounded p-3 mt-3">
                  <label className="form-label fw-medium text-danger" style={{ fontSize: 13 }}>
                    Reason for cancellation <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control mb-2"
                    rows={2}
                    placeholder="e.g. Teacher unavailable, public holiday..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-danger flex-grow-1"
                      onClick={handleCancelSession}
                      disabled={cancelling || !cancelReason.trim()}
                    >
                      {cancelling ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                      Confirm Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setShowCancelForm(false);
                        setCancelReason("");
                      }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer d-flex align-items-center gap-1">
              <button
                type="button"
                className="btn btn-light border"
                onClick={onClose}
                disabled={cancelling || approving || saving}
              >
                Close
              </button>

              {/* Student: Join Class (only when live) */}
              {role === "student" && isClass && isScheduled && isLive && (
                <button type="button" className="btn btn-success" onClick={handleJoinCall} disabled={joiningCall}>
                  {joiningCall ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="ti ti-video me-2" />
                  )}
                  Join Class
                </button>
              )}

              {/* Teacher/Admin: Start Session (when idle) */}
              {(role === "teacher" || role === "admin") && isClass && isScheduled && isIdle && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleStartSession}
                  disabled={startingSession || endingSession}
                >
                  {startingSession ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="ti ti-player-play me-2" />
                  )}
                  Start Session
                </button>
              )}

              {/* Teacher/Admin: Join Running Session (when live) */}
              {(role === "teacher" || role === "admin") && isClass && isScheduled && isLive && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleJoinCall}
                  disabled={joiningCall || endingSession}
                >
                  {joiningCall ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="ti ti-video me-2" />
                  )}
                  Rejoin Session
                </button>
              )}

              {/* Teacher/Admin: End Session (when live) */}
              {(role === "teacher" || role === "admin") && isClass && isScheduled && isLive && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleEndSessionClick}
                  disabled={endingSession || joiningCall}
                >
                  <i className="ti ti-player-stop me-2" />
                  End Session
                </button>
              )}

              {/* Admin: Approve pending teacher proposal */}
              {role === "admin" && isClass && isPending && (
                <button type="button" className="btn btn-success" onClick={handleApprove} disabled={approving}>
                  {approving ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="ti ti-check me-2" />
                  )}
                  Approve Session
                </button>
              )}

              {/* Admin: Edit session toggle (scheduled+idle only) */}
              {role === "admin" && isClass && isScheduled && isIdle && !showCancelForm && !showEditForm && (
                <button type="button" className="btn btn-outline-primary" onClick={() => setShowEditForm(true)}>
                  <i className="ti ti-pencil me-2" />
                  Edit Session
                </button>
              )}

              {/* Admin/Teacher: Cancel session toggle */}
              {(role === "admin" || role === "teacher") && isClass && !isCancelled && !showCancelForm && !showEditForm && (
                <button type="button" className="btn btn-outline-danger" onClick={() => setShowCancelForm(true)}>
                  <i className="ti ti-x me-2" />
                  Cancel Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── End Session Step 1: Confirm ── */}
      {showEndConfirm && !showEndLessonStep && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1065 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-dark fw-bold d-flex align-items-center gap-2">
                    <i className="ti ti-player-stop text-danger fs-18" />
                    End Session?
                  </h5>
                  <button type="button" className="btn-close" onClick={handleCancelEndFlow} disabled={endingSession} />
                </div>
                <div className="modal-body py-3">
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                    This will end the session for all participants. You&apos;ll be able to share today&apos;s lesson and homework on the next step.
                  </p>
                </div>
                <div className="modal-footer d-flex align-items-center gap-1">
                  <button type="button" className="btn btn-light border" onClick={handleCancelEndFlow} disabled={endingSession}>Cancel</button>
                  <button type="button" className="btn btn-danger d-flex align-items-center gap-1" onClick={() => setShowEndLessonStep(true)}>
                    <i className="ti ti-arrow-right" />
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── End Session Step 2: Lesson form ── */}
      {showEndConfirm && showEndLessonStep && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1065 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title text-dark fw-bold d-flex align-items-center gap-2">
                    <i className="ti ti-book-2 fs-18" />
                    Today&apos;s Lesson
                  </h4>
                  <button type="button" className="btn-close" onClick={handleCancelEndFlow} disabled={endingSession} />
                </div>
                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Share lesson notes or homework with your students (optional).
                  </p>
                  <div className="mb-3">
                    <label className="form-label fw-medium">Lesson Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={endLessonTitle}
                      onChange={(e) => setEndLessonTitle(e.target.value)}
                      placeholder="e.g. Chapter 4: Algebra Basics"
                      maxLength={200}
                      disabled={endingSession}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-medium">Description / Homework</label>
                    <textarea
                      className="form-control"
                      value={endLessonDescription}
                      onChange={(e) => setEndLessonDescription(e.target.value)}
                      placeholder="What was covered today? Any homework or reading for next class..."
                      rows={4}
                      disabled={endingSession}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-medium">
                      Due Date <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <DatePicker
                      style={{ width: "100%" }}
                      value={endLessonDueDate ? dayjs(endLessonDueDate) : null}
                      onChange={(_, ds) => setEndLessonDueDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Select due date"
                      disabled={endingSession}
                    />
                  </div>
                </div>
                <div className="modal-footer d-flex align-items-center gap-1">
                  <button type="button" className="btn btn-light border" onClick={handleCancelEndFlow} disabled={endingSession}>Cancel</button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => handleConfirmEndSession(true)} disabled={endingSession}>
                    Skip &amp; End
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger d-flex align-items-center gap-1"
                    onClick={() => handleConfirmEndSession(false)}
                    disabled={endingSession}
                  >
                    {endingSession
                      ? <><span className="spinner-border spinner-border-sm" /> Ending…</>
                      : <><i className="ti ti-player-stop" /> End Session</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
