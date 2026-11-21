"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { DatePicker, TimePicker, Table, Select, Tooltip } from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table";

import { useAppSelector } from "@/core/redux/hooks";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { media_base_url } from "@/environment";
import {
  getSessionsList,
  getTeacherAvailability,
  getAllSchedules,
  updateSession,
  cancelSession,
  deleteSession,
  SessionListItem,
  TeacherAvailabilityItem,
  TeacherAvailabilityResponse,
  UpdateSessionPayload,
} from "@/services/classScheduleService";
import { fetchAllTeachers } from "@/services/teacherService";
import { fetchAllStudents } from "@/services/studentService";
import type { Teacher } from "@/types/teacher";
import type { Student } from "@/types/student";
import { ClassSchedule } from "@/types/classSchedule";
import { useNotification } from "@/hooks/useNotification";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import { api_base_url, withAuthorization } from "@/services/apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: "badge-soft-primary border-primary",
  completed: "badge-soft-secondary border-secondary",
  cancelled: "badge-soft-danger border-danger",
  makeup: "badge-soft-purple border-purple",
  live: "badge-soft-success border-success",
};

const SESSION_STATUS_BADGE: Record<string, string> = {
  idle: "badge-soft-secondary border-secondary",
  live: "badge-soft-success border-success",
  ended: "badge-soft-dark border-dark",
};

const SHIFT_COLORS: Record<string, string> = {
  Morning: "#F59E0B",
  Afternoon: "#3B82F6",
  Evening: "#8B5CF6",
};

function ShiftBadge({ shift }: { shift: string | null }) {
  if (!shift) return <span className="text-muted fst-italic small">—</span>;
  return (
    <span
      className="badge fw-medium"
      style={{ background: SHIFT_COLORS[shift] ?? "#6B7280", color: "#fff", fontSize: 11 }}
    >
      {shift}
    </span>
  );
}

function TeacherAvatar({
  teacher,
}: {
  teacher: { firstName: string; lastName: string; imageUrl: string | null } | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!teacher) return <span className="text-muted fst-italic">Not assigned</span>;
  const name = `${teacher.firstName} ${teacher.lastName}`;
  const src = teacher.imageUrl?.trim() ? `${media_base_url}/${teacher.imageUrl}` : null;
  const initials = [teacher.firstName[0], teacher.lastName[0]].join("").toUpperCase();
  const showInitials = !src || imgFailed;

  return (
    <div className="d-flex align-items-center gap-2">
      {showInitials ? (
        <div
          className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
          style={{ width: 28, height: 28, borderRadius: "50%", fontSize: 11, flexShrink: 0 }}
        >
          {initials}
        </div>
      ) : (
        <img
          src={src!}
          alt={name}
          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          onError={() => setImgFailed(true)}
        />
      )}
      <span className="small">{name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Students List Modal
// ---------------------------------------------------------------------------
type StudentItem = { id: number; firstName: string; lastName: string; profileImg: string | null };

function StudentsModal({
  students,
  sessionTitle,
  onClose,
}: {
  students: StudentItem[];
  sessionTitle: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) : students;
  }, [students, search]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">
                Enrolled Students
                <span className="badge bg-primary ms-2" style={{ fontSize: 13 }}>
                  {students.length}
                </span>
              </h4>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body p-0">
              <div className="px-3 pt-3 pb-2">
                <div className="text-muted small mb-2">{sessionTitle}</div>
                <input
                  className="form-control form-control-sm"
                  placeholder="Search students…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <div className="text-center py-4 text-muted small">No students found.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {filtered.map((s) => {
                      const src = s.profileImg ? `${media_base_url}/${s.profileImg}` : null;
                      const initials = [s.firstName[0], s.lastName[0]].join("").toUpperCase();
                      return (
                        <li key={s.id} className="list-group-item d-flex align-items-center gap-2 py-2">
                          {src ? (
                            <img
                              src={src}
                              alt={`${s.firstName} ${s.lastName}`}
                              style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                              style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 11, flexShrink: 0 }}
                            >
                              {initials}
                            </div>
                          )}
                          <span className="small">
                            {s.firstName} {s.lastName}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Edit Session Modal
// ---------------------------------------------------------------------------
interface EditSessionModalProps {
  session: SessionListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditSessionModal({ session, onClose, onSaved }: EditSessionModalProps) {
  const notify = useNotification();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateSessionPayload>({});

  // Teacher list for reassignment dropdown
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const teachersLoadedRef = useRef(false);

  // Enrolled students (filtered by course)
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Track original teacherId to detect change
  const originalTeacherIdRef = useRef<number | null>(null);
  const isTeacherChanging =
    form.teacherId !== undefined && form.teacherId !== null && form.teacherId !== originalTeacherIdRef.current;

  const selectedTeacher = teachers.find((t) => Number(t.id) === form.teacherId);
  const originalTeacher = teachers.find((t) => Number(t.id) === originalTeacherIdRef.current);

  useEffect(() => {
    if (session) {
      setError(null);
      setStudentSearch("");
      originalTeacherIdRef.current = session.teacherId;
      setForm({
        title: session.title,
        date: session.date,
        startTime: session.startTime.slice(0, 5),
        endTime: session.endTime.slice(0, 5),
        shift: session.shift ?? undefined,
        notes: "",
        teacherId: session.teacherId,
      });
      // Pre-fill from junction table students array (falls back to legacy single studentId)
      const junctionStudents: { id: number }[] = session.students || [];
      setSelectedStudentIds(
        junctionStudents.length > 0 ? junctionStudents.map((s) => s.id) : session.studentId ? [session.studentId] : [],
      );
      // Fetch enrolled students for this course
      fetch(`${api_base_url}/course/students-by-course/${session.courseId}`, {
        headers: withAuthorization(),
      })
        .then((r) => r.json())
        .then((data) => setEnrolledStudents(data.students || []))
        .catch(() => setEnrolledStudents([]));
    }
  }, [session]);

  // Load teacher list once
  useEffect(() => {
    if (!teachersLoadedRef.current) {
      teachersLoadedRef.current = true;
      fetchAllTeachers()
        .then((res) => setTeachers(res.teachers))
        .catch(() => {
          /* non-fatal */
        });
    }
  }, []);

  useEffect(() => {
    if (session) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [session]);

  if (!session) return null;

  const handleCancel = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!form.title?.trim() || !form.date || !form.startTime || !form.endTime) {
      setError("Title, date, start time, and end time are required.");
      return;
    }
    if (form.startTime >= form.endTime) {
      setError("End time must be after start time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSession(session.id, { ...form, studentIds: selectedStudentIds });
      notify.success(
        isTeacherChanging
          ? "Session updated. Old teacher unassigned, new teacher assigned. All parties notified."
          : "Session updated. Teacher, students, and parents notified.",
      );
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update session.");
    } finally {
      setSaving(false);
    }
  };

  const set =
    (field: keyof UpdateSessionPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value || undefined }));

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={handleCancel} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">Edit Session</h4>
              <button
                type="button"
                className="btn-close custom-btn-close opacity-100"
                onClick={handleCancel}
                disabled={saving}
              >
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2 mb-3" role="alert">
                  {error}
                </div>
              )}

              <div className="row">
                {/* Title */}
                <div className="col-12 mb-3">
                  <label className="form-label">
                    Title <span className="text-danger">*</span>
                  </label>
                  <input className="form-control" value={form.title ?? ""} onChange={set("title")} disabled={saving} />
                </div>

                {/* Date / Times */}
                <div className="col-12 col-md-4 mb-3">
                  <label className="form-label">
                    Date <span className="text-danger">*</span>
                  </label>
                  <DatePicker
                    style={{ width: "100%" }}
                    value={form.date ? dayjs(form.date) : null}
                    onChange={(_, ds) => set("date")({ target: { value: ds } } as any)}
                    format="YYYY-MM-DD"
                    placeholder="Select date"
                    disabled={saving}
                  />
                </div>
                <div className="col-12 col-md-4 mb-3">
                  <label className="form-label">
                    Start Time <span className="text-danger">*</span>
                  </label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.startTime ?? ""}
                    onChange={set("startTime")}
                    disabled={saving}
                  />
                </div>
                <div className="col-12 col-md-4 mb-3">
                  <label className="form-label">
                    End Time <span className="text-danger">*</span>
                  </label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.endTime ?? ""}
                    onChange={set("endTime")}
                    disabled={saving}
                  />
                </div>

                {/* Shift */}
                <div className="col-12 col-md-6 mb-3">
                  <label className="form-label">Shift</label>
                  <select className="form-select" value={form.shift ?? ""} onChange={set("shift")} disabled={saving}>
                    <option value="">— No shift —</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="col-12 col-md-6 mb-3">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={1}
                    value={form.notes ?? ""}
                    onChange={set("notes")}
                    disabled={saving}
                  />
                </div>

                {/* Teacher reassignment */}
                <div className="col-12 mb-3">
                  <label className="form-label">
                    Assigned Teacher
                    <span className="badge bg-warning text-dark ms-2" style={{ fontSize: 10 }}>
                      Reassignable
                    </span>
                  </label>
                  <select
                    className="form-select"
                    value={form.teacherId ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, teacherId: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    disabled={saving}
                  >
                    <option value="">— Select teacher —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={Number(t.id)}>
                        {t.firstName} {t.lastName}
                        {Array.isArray(t.shift) && t.shift.length ? ` (${t.shift.join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Students multi-select */}
                <div className="col-12 mb-0">
                  <label className="form-label">Students (optional)</label>
                  {enrolledStudents.length === 0 ? (
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
                        disabled={saving}
                      />
                      <div
                        className="border rounded p-2"
                        style={{ maxHeight: "min(160px, 30vh)", overflowY: "auto", background: "#fafafa" }}
                      >
                        {enrolledStudents
                          .filter((s) =>
                            `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()),
                          )
                          .map((s) => {
                            const checked = selectedStudentIds.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className="d-flex align-items-center gap-2 px-1 py-1 rounded"
                                style={{ cursor: "pointer", fontSize: 13 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={saving}
                                  onChange={() =>
                                    setSelectedStudentIds((ids) =>
                                      checked ? ids.filter((id) => id !== s.id) : [...ids, s.id],
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
                  <div className="form-text">
                    <i className="ti ti-info-circle me-1" />
                    Leave empty — all enrolled students will see this session.
                  </div>
                </div>
              </div>

              {/* Teacher reassignment warning */}
              {isTeacherChanging &&
                (() => {
                  const sessionShift = form.shift;
                  const teacherShifts = Array.isArray(selectedTeacher?.shift) ? selectedTeacher!.shift : [];
                  const hasShiftMismatch =
                    !!sessionShift &&
                    teacherShifts.length > 0 &&
                    !teacherShifts.includes(sessionShift as "Morning" | "Afternoon" | "Evening");
                  return (
                    <>
                      <div className="alert alert-warning mt-3 mb-0 small">
                        <div className="fw-bold mb-1">
                          <i className="ti ti-alert-triangle me-1" />
                          Teacher Reassignment — Please Read
                        </div>
                        <ul className="mb-2 ps-3">
                          <li>
                            <strong>
                              {originalTeacher
                                ? `${originalTeacher.firstName} ${originalTeacher.lastName}`
                                : "Current teacher"}
                            </strong>{" "}
                            will receive a notification that they have been{" "}
                            <span className="text-danger fw-medium">removed</span> from this session.
                          </li>
                          <li>
                            <strong>
                              {selectedTeacher
                                ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`
                                : "New teacher"}
                            </strong>{" "}
                            will receive a notification that they have been{" "}
                            <span className="text-success fw-medium">assigned</span> to this session.
                          </li>
                          <li>
                            Students enrolled under the <strong>current teacher</strong> will be notified of the teacher
                            change.
                          </li>
                          <li className="text-danger">
                            <strong>Attendance drift:</strong> Any attendance already marked for this session is linked
                            to the current teacher's course enrollment records. It will <em>not</em> automatically
                            transfer to the new teacher.
                          </li>
                        </ul>
                      </div>
                      {hasShiftMismatch && (
                        <div className="alert alert-danger mt-2 mb-0 small">
                          <div className="fw-bold mb-1">
                            <i className="ti ti-clock-exclamation me-1" />
                            Shift Mismatch Detected
                          </div>
                          <p className="mb-0">
                            This session is scheduled for the <strong>{sessionShift}</strong> shift, but{" "}
                            <strong>
                              {selectedTeacher!.firstName} {selectedTeacher!.lastName}
                            </strong>{" "}
                            is assigned to the <strong>{teacherShifts.join(" / ")}</strong> shift. Assigning this
                            teacher outside their normal working hours may cause scheduling conflicts. Proceed only if
                            this is intentional.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}

              {/* Static info boxes */}
              {!isTeacherChanging && (
                <div className="alert alert-info py-2 small mt-3 mb-0">
                  <i className="ti ti-info-circle me-1" />
                  Teacher, students, and parents will be notified of any changes.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light border" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${isTeacherChanging ? "btn-warning" : "btn-primary"} d-inline-flex align-items-center justify-content-center`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Processing...
                  </>
                ) : isTeacherChanging ? (
                  "Save & Reassign Teacher"
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cancel Session Confirm (inline)
// ---------------------------------------------------------------------------
interface CancelConfirmProps {
  session: SessionListItem | null;
  onClose: () => void;
  onCancelled: () => void;
}

function CancelSessionConfirm({ session, onClose, onCancelled }: CancelConfirmProps) {
  const notify = useNotification();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) setReason("");
  }, [session]);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      notify.error("Please enter a reason.");
      return;
    }
    setLoading(true);
    try {
      await cancelSession(String(session!.id), reason.trim(), "admin");
      notify.success("Session cancelled. Teacher, students, and parents notified.");
      onCancelled();
      onClose();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : "Failed to cancel session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmationModal
      open={!!session}
      title="Cancel Session"
      confirmText="Confirm Cancel"
      cancelText="Back"
      confirmVariant="danger"
      confirmLoading={loading}
      icon={<i className="ti ti-alert-triangle" />}
      description={
        session ? (
          <div className="text-start">
            <div className="small mb-3">
              Cancelling: <strong>{session.title}</strong> on <strong>{fmtDate(session.date)}</strong>
            </div>
            <label className="form-label fw-medium">
              Reason <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Teacher unavailable, public holiday…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
          </div>
        ) : null
      }
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}

// ---------------------------------------------------------------------------
// Delete Session Confirm (inline)
// ---------------------------------------------------------------------------
interface DeleteConfirmProps {
  session: SessionListItem | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteSessionConfirm({ session, onClose, onDeleted }: DeleteConfirmProps) {
  const notify = useNotification();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await deleteSession(session!.id);
      notify.success("Session deleted.");
      onDeleted();
      onClose();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : "Failed to delete session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmationModal
      open={!!session}
      title="Delete Session"
      confirmText="Delete"
      cancelText="Cancel"
      confirmVariant="danger"
      confirmLoading={loading}
      icon={<i className="ti ti-trash" />}
      description={
        session ? (
          <div className="text-start">
            <p className="mb-0">
              Are you sure you want to permanently delete <strong>{session.title}</strong> on{" "}
              <strong>{fmtDate(session.date)}</strong>?
            </p>
            <p className="text-danger small mt-2 mb-0">This action cannot be undone.</p>
          </div>
        ) : null
      }
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Sessions Table
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = ["", "scheduled", "completed", "cancelled", "makeup"];
const SHIFT_OPTIONS = ["", "Morning", "Afternoon", "Evening"];
const SESSION_STATUS_OPTIONS = ["", "idle", "live", "ended"];

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit / Cancel / Delete / Students state
  const [editSession, setEditSession] = useState<SessionListItem | null>(null);
  const [cancelSession_, setCancelSession] = useState<SessionListItem | null>(null);
  const [deleteSession_, setDeleteSession] = useState<SessionListItem | null>(null);
  const [studentsModal, setStudentsModal] = useState<SessionListItem | null>(null);

  // Bulk delete state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const notify = useNotification();

  // Filters — From defaults to today, To empty
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [shift, setShift] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Teacher & student option lists for multi-select dropdowns
  const [teacherOptions, setTeacherOptions] = useState<{ value: string; label: string }[]>([]);
  const [studentOptions, setStudentOptions] = useState<{ value: string; label: string }[]>([]);

  // Load teacher + student lists once on mount
  useEffect(() => {
    fetchAllTeachers()
      .then((res) =>
        setTeacherOptions(
          res.teachers.map((t: Teacher) => ({
            value: String(t.id),
            label: `${t.firstName} ${t.lastName}`,
          })),
        ),
      )
      .catch(() => {});
    fetchAllStudents()
      .then((res) =>
        setStudentOptions(
          res.students.map((s: Student) => ({
            value: String(s.id),
            label: `${s.firstName} ${s.lastName}`,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (overrides?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      shift?: string;
      sessionStatus?: string;
      teacherIds?: string[];
      studentIds?: string[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const teacherIds = overrides?.teacherIds ?? selectedTeacherIds;
        const studentIds = overrides?.studentIds ?? selectedStudentIds;
        const res = await getSessionsList({
          startDate: overrides?.startDate ?? startDate,
          endDate: overrides?.endDate ?? endDate,
          status: overrides?.status ?? status,
          shift: overrides?.shift ?? shift,
          sessionStatus: overrides?.sessionStatus ?? sessionStatus,
          ...(teacherIds.length > 0 ? { teacherIds: teacherIds.join(",") } : {}),
          ...(studentIds.length > 0 ? { studentIds: studentIds.join(",") } : {}),
        });
        setSessions(res.sessions);
        setSelectedRowKeys([]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, status, shift, sessionStatus, selectedTeacherIds, selectedStudentIds],
  );

  // Load once on mount with no filters
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedRowKeys.map((key) => deleteSession(Number(key))));
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;
    setBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedRowKeys([]);
    if (failed === 0) {
      notify.success(`${succeeded} session${succeeded !== 1 ? "s" : ""} deleted.`);
    } else {
      notify.error(`${succeeded} deleted, ${failed} failed.`);
    }
    load();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const columns: ColumnsType<SessionListItem> = [
    {
      title: "Session",
      key: "session",
      render: (_, row) => (
        <div>
          <div className="fw-medium small">{row.title}</div>
          {row.schedule && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              {row.schedule.recurrenceType === "one-time"
                ? "One-time"
                : row.schedule.recurrenceType === "weekly"
                  ? "Weekly"
                  : "Biweekly"}
              {row.schedule.daysOfWeek?.length
                ? " · " + row.schedule.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")
                : ""}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Course",
      key: "course",
      render: (_, row) => {
        const c = row.Course;
        if (!c) return <span className="text-muted">—</span>;
        const src = c.imageUrl ? `${media_base_url}/${c.imageUrl}` : null;
        return (
          <div className="d-flex align-items-center gap-2">
            {src ? (
              <img
                src={src}
                alt={c.courseName}
                style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center bg-light border rounded"
                style={{ width: 28, height: 28 }}
              >
                <i className="ti ti-book text-muted" style={{ fontSize: 13 }} />
              </div>
            )}
            <span className="small">{c.courseName}</span>
          </div>
        );
      },
    },
    {
      title: "Teacher",
      key: "teacher",
      render: (_, row) => <TeacherAvatar teacher={row.Teacher} />,
    },
    {
      title: "Students",
      key: "students",
      render: (_, row) => {
        const students = row.students ?? [];
        if (students.length === 0) return <span className="text-muted fst-italic small">—</span>;
        const MAX_SHOWN = 3;
        const shown = students.slice(0, MAX_SHOWN);
        const extra = students.length - MAX_SHOWN;
        return (
          <Tooltip title="Click to view all students">
            <div
              className="d-flex align-items-center"
              style={{ cursor: "pointer", display: "inline-flex" }}
              onClick={() => setStudentsModal(row)}
            >
              {shown.map((s, i) => {
                const src = s.profileImg?.trim() ? `${media_base_url}/${s.profileImg}` : null;
                const initials = [s.firstName[0], s.lastName[0]].join("").toUpperCase();
                return src ? (
                  <img
                    key={s.id}
                    src={src}
                    alt={`${s.firstName} ${s.lastName}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #fff",
                      marginLeft: i > 0 ? -10 : 0,
                      zIndex: MAX_SHOWN - i,
                      position: "relative",
                    }}
                  />
                ) : (
                  <div
                    key={s.id}
                    className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      fontSize: 10,
                      border: "2px solid #fff",
                      marginLeft: i > 0 ? -10 : 0,
                      zIndex: MAX_SHOWN - i,
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                );
              })}
              {extra > 0 && (
                <div
                  className="d-flex align-items-center justify-content-center bg-secondary text-white fw-bold"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    fontSize: 10,
                    border: "2px solid #fff",
                    marginLeft: -10,
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  +{extra}
                </div>
              )}
              <span className="ms-2 small text-muted">{students.length}</span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Date",
      key: "date",
      render: (_, row) => <span className="small text-muted">{fmtDate(row.date)}</span>,
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: "Time",
      key: "time",
      render: (_, row) => (
        <span className="small text-muted">
          {fmtTime(row.startTime)} – {fmtTime(row.endTime)}
        </span>
      ),
    },
    {
      title: "Shift",
      key: "shift",
      render: (_, row) => <ShiftBadge shift={row.shift} />,
    },
    {
      title: "Status",
      key: "status",
      render: (_, row) => (
        <div className="d-flex flex-column gap-1">
          <span
            className={`badge ${STATUS_BADGE[row.status] ?? "badge-soft-secondary border-secondary"}`}
            style={{ fontSize: 11 }}
          >
            {row.status}
          </span>
          {row.sessionStatus !== "idle" && (
            <span className={`badge ${SESSION_STATUS_BADGE[row.sessionStatus] ?? ""}`} style={{ fontSize: 10 }}>
              {row.sessionStatus === "live" ? "🔴 Live" : "Ended"}
            </span>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_, row) => {
        const canEdit = row.status === "scheduled" && row.sessionStatus === "idle";
        const canCancel = row.status === "scheduled";
        return (
          <div className="d-flex gap-1">
            {canEdit && (
              <Tooltip title="Edit Session">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-icon btn-sm"
                  onClick={() => setEditSession(row)}
                >
                  <i className="ti ti-edit" />
                </button>
              </Tooltip>
            )}
            {canCancel && (
              <Tooltip title="Cancel Session">
                <button
                  type="button"
                  className="btn btn-outline-warning btn-icon btn-sm"
                  onClick={() => setCancelSession(row)}
                >
                  <i className="ti ti-ban" />
                </button>
              </Tooltip>
            )}
            <Tooltip title="Delete Session">
              <button
                type="button"
                className="btn btn-outline-danger btn-icon btn-sm"
                onClick={() => setDeleteSession(row)}
              >
                <i className="ti ti-trash" />
              </button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="filter-panel-box mb-3">
        <div className="filter-panel-heading">
          <i className="ti ti-filter" />
          <span className="filter-panel-title">Filter by</span>
        </div>
        <div className="row g-3 align-items-end">
          {/* From */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>From</label>
              <DatePicker
                size="large"
                style={{ width: 150 }}
                value={startDate ? dayjs(startDate) : null}
                onChange={(_, ds) => setStartDate(ds as string)}
                format="YYYY-MM-DD"
                placeholder="From"
              />
            </div>
          </div>
          {/* To */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>To</label>
              <DatePicker
                size="large"
                style={{ width: 150 }}
                value={endDate ? dayjs(endDate) : null}
                onChange={(_, ds) => setEndDate(ds as string)}
                format="YYYY-MM-DD"
                placeholder="To"
              />
            </div>
          </div>
          {/* Status */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>Status</label>
              <Select
                mode="multiple"
                maxCount={1}
                size="large"
                placeholder="All"
                value={status ? [status] : []}
                onChange={(vals: string[]) => setStatus(vals[vals.length - 1] ?? "")}
                allowClear
                options={STATUS_OPTIONS.filter((s) => s !== "").map((s) => ({ label: s, value: s }))}
                style={{ width: 150 }}
                maxTagCount="responsive"
              />
            </div>
          </div>
          {/* Shift */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>Shift</label>
              <Select
                mode="multiple"
                maxCount={1}
                size="large"
                placeholder="All"
                value={shift ? [shift] : []}
                onChange={(vals: string[]) => setShift(vals[vals.length - 1] ?? "")}
                allowClear
                options={SHIFT_OPTIONS.filter((s) => s !== "").map((s) => ({ label: s, value: s }))}
                style={{ width: 150 }}
                maxTagCount="responsive"
              />
            </div>
          </div>
          {/* Live Status */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>Live Status</label>
              <Select
                mode="multiple"
                maxCount={1}
                size="large"
                placeholder="All"
                value={sessionStatus ? [sessionStatus] : []}
                onChange={(vals: string[]) => setSessionStatus(vals[vals.length - 1] ?? "")}
                allowClear
                options={SESSION_STATUS_OPTIONS.filter((s) => s !== "").map((s) => ({ label: s, value: s }))}
                style={{ width: 150 }}
                maxTagCount="responsive"
              />
            </div>
          </div>
          {/* Teacher */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>Teacher</label>
              <Select
                mode="multiple"
                allowClear
                size="large"
                placeholder="All teachers"
                value={selectedTeacherIds}
                onChange={(vals) => setSelectedTeacherIds(vals as string[])}
                options={teacherOptions}
                style={{ width: 150 }}
                maxTagCount="responsive"
              />
            </div>
          </div>
          {/* Student */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>Student</label>
              <Select
                mode="multiple"
                allowClear
                size="large"
                placeholder="All students"
                value={selectedStudentIds}
                onChange={(vals) => setSelectedStudentIds(vals as string[])}
                options={studentOptions}
                style={{ width: 150 }}
                maxTagCount="responsive"
              />
            </div>
          </div>
          {/* Actions */}
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>&nbsp;</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-primary d-inline-flex align-items-center" style={{ height: 40 }} onClick={() => load()} disabled={loading}>
                  <i className="ti ti-search me-1" />
                  Apply
                </button>
                <button
                  type="button"
                  className="btn filter-panel-clear-btn"
                  onClick={() => {
                    const reset = {
                      startDate: todayStr(),
                      endDate: "",
                      status: "",
                      shift: "",
                      sessionStatus: "",
                      teacherIds: [] as string[],
                      studentIds: [] as string[],
                    };
                    setStartDate(reset.startDate);
                    setEndDate(reset.endDate);
                    setStatus(reset.status);
                    setShift(reset.shift);
                    setSessionStatus(reset.sessionStatus);
                    setSelectedTeacherIds(reset.teacherIds);
                    setSelectedStudentIds(reset.studentIds);
                    load(reset);
                  }}
                >
                  <i className="ti ti-x fs-12" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {/* Bulk delete toolbar */}
      {selectedRowKeys.length > 0 && (
        <div className="d-flex align-items-center gap-2 mb-3 p-2 border rounded bg-light">
          <span className="small fw-semibold text-muted">
            {selectedRowKeys.length} session{selectedRowKeys.length !== 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm d-inline-flex align-items-center gap-1"
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <i className="ti ti-trash" />
            Delete Selected
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedRowKeys([])}>
            Clear
          </button>
        </div>
      )}

      {/* Summary pills */}
      {!loading && sessions.length > 0 && (
        <div className="d-flex gap-2 flex-wrap mb-3">
          <span className="badge badge-soft-primary border border-primary py-1 px-2">{sessions.length} sessions</span>
          <span className="badge badge-soft-success border border-success py-1 px-2">
            {sessions.filter((s) => s.sessionStatus === "live").length} live
          </span>
          <span className="badge badge-soft-secondary border border-secondary py-1 px-2">
            {sessions.filter((s) => s.status === "completed").length} completed
          </span>
          <span className="badge badge-soft-danger border border-danger py-1 px-2">
            {sessions.filter((s) => s.status === "cancelled").length} cancelled
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          <Table
            rowSelection={rowSelection}
            dataSource={sessions.map((s) => ({ ...s, key: String(s.id) }))}
            columns={columns}
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={
              {
                current: currentPage,
                pageSize,
                total: sessions.length,
                showSizeChanger: false,
                onChange: (page) => setCurrentPage(page),
                showTotal: () => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    Rows per page:
                    <Select
                      value={pageSize}
                      onChange={(v) => {
                        setPageSize(Number(v));
                        setCurrentPage(1);
                      }}
                      style={{ width: 80 }}
                      popupMatchSelectWidth={false}
                    >
                      {[10, 20, 30, 50].map((s) => (
                        <Select.Option key={s} value={s}>
                          {s}
                        </Select.Option>
                      ))}
                    </Select>
                    of {sessions.length} Entries
                  </div>
                ),
                itemRender: (_p, type, orig) => {
                  if (type === "prev")
                    return (
                      <span className="ant-pagination-item-link">
                        <i className="ti ti-chevron-left" />
                      </span>
                    );
                  if (type === "next")
                    return (
                      <span className="ant-pagination-item-link">
                        <i className="ti ti-chevron-right" />
                      </span>
                    );
                  return orig;
                },
              } as TablePaginationConfig
            }
            locale={{
              emptyText: (
                <div className="text-center py-4">
                  <i className="ti ti-calendar-off fs-48 text-muted d-block mb-2" />
                  <p className="text-muted mb-0">No sessions found for the selected filters.</p>
                </div>
              ),
            }}
          />
        </div>
      </div>

      {/* Edit modal */}
      <EditSessionModal session={editSession} onClose={() => setEditSession(null)} onSaved={load} />

      {/* Cancel confirm modal */}
      <CancelSessionConfirm session={cancelSession_} onClose={() => setCancelSession(null)} onCancelled={load} />

      {/* Delete confirm modal */}
      <DeleteSessionConfirm session={deleteSession_} onClose={() => setDeleteSession(null)} onDeleted={load} />

      {/* Bulk delete confirm modal */}
      <ConfirmationModal
        open={showBulkDeleteConfirm}
        title="Delete Selected Sessions"
        confirmText="Delete All"
        cancelText="Cancel"
        confirmVariant="danger"
        confirmLoading={bulkDeleting}
        icon={<i className="ti ti-trash" />}
        description={
          <div className="text-start">
            <div className="mb-0">
              Are you sure you want to permanently delete{" "}
              <strong>
                {selectedRowKeys.length} session{selectedRowKeys.length !== 1 ? "s" : ""}
              </strong>
              ?
            </div>
            <div className="text-danger small mt-2 mb-0">This action cannot be undone.</div>
          </div>
        }
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {/* Students list modal */}
      {studentsModal && (
        <StudentsModal
          students={studentsModal.students ?? []}
          sessionTitle={studentsModal.title}
          onClose={() => setStudentsModal(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Schedules Table (ClassSchedule templates)
// ---------------------------------------------------------------------------
function SchedulesTab() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setLoading(true);
    getAllSchedules()
      .then((data) => setSchedules(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load schedules"))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnsType<ClassSchedule & { key: string }> = [
    {
      title: "Title",
      key: "title",
      render: (_, row) => <span className="fw-medium small">{(row as ClassSchedule).title}</span>,
    },
    {
      title: "Recurrence",
      key: "recurrence",
      render: (_, row) => {
        const s = row as ClassSchedule;
        const type = s.recurrenceType;
        const days =
          Array.isArray(s.daysOfWeek) && s.daysOfWeek.length ? s.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ") : null;
        return (
          <div>
            <span className="badge badge-soft-info border border-info small">{type}</span>
            {days && (
              <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                {days}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Time",
      key: "time",
      render: (_, row) => {
        const s = row as ClassSchedule;
        return (
          <span className="small text-muted">
            {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
          </span>
        );
      },
    },
    {
      title: "Date Range",
      key: "dates",
      render: (_, row) => {
        const s = row as ClassSchedule;
        return (
          <span className="small text-muted">
            {fmtDate(s.startDate)}
            {s.endDate ? ` → ${fmtDate(s.endDate)}` : " (open)"}
          </span>
        );
      },
    },
    {
      title: "Shift",
      key: "shift",
      render: (_, row) => <ShiftBadge shift={(row as ClassSchedule).shift ?? null} />,
    },
    {
      title: "Status",
      key: "status",
      render: (_, row) => {
        const s = row as ClassSchedule;
        const cls =
          s.status === "active"
            ? "badge-soft-success border-success"
            : s.status === "pending"
              ? "badge-soft-warning border-warning"
              : "badge-soft-danger border-danger";
        return <span className={`badge ${cls}`}>{s.status}</span>;
      },
    },
    {
      title: "Created by",
      key: "createdBy",
      render: (_, row) => {
        const s = row as ClassSchedule;
        return <span className="small text-muted">{s.createdBy}</span>;
      },
    },
  ];

  return (
    <div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card">
        <div className="card-body p-0">
          <Table
            dataSource={(schedules as (ClassSchedule & { key: string })[]).map((s) => ({
              ...s,
              key: String(s.id),
            }))}
            columns={columns}
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={
              {
                current: currentPage,
                pageSize,
                total: schedules.length,
                showSizeChanger: false,
                onChange: (page) => setCurrentPage(page),
                showTotal: () => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    Rows per page:
                    <Select
                      value={pageSize}
                      onChange={(v) => {
                        setPageSize(Number(v));
                        setCurrentPage(1);
                      }}
                      style={{ width: 80 }}
                      popupMatchSelectWidth={false}
                    >
                      {[10, 20, 30, 50].map((s) => (
                        <Select.Option key={s} value={s}>
                          {s}
                        </Select.Option>
                      ))}
                    </Select>
                    of {schedules.length} Entries
                  </div>
                ),
                itemRender: (_p, type, orig) => {
                  if (type === "prev")
                    return (
                      <span className="ant-pagination-item-link">
                        <i className="ti ti-chevron-left" />
                      </span>
                    );
                  if (type === "next")
                    return (
                      <span className="ant-pagination-item-link">
                        <i className="ti ti-chevron-right" />
                      </span>
                    );
                  return orig;
                },
              } as TablePaginationConfig
            }
            locale={{
              emptyText: (
                <div className="text-center py-4">
                  <i className="ti ti-calendar-off fs-48 text-muted d-block mb-2" />
                  <p className="text-muted mb-0">
                    No schedules yet. Create one from the <a href="/admin/class-schedule">Calendar page</a>.
                  </p>
                </div>
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Teacher Availability
// ---------------------------------------------------------------------------
const TIME_PRESETS = [
  {
    label: "Right Now",
    getValues: () => ({ date: todayStr(), startTime: nowTimeStr(), endTime: addHour(nowTimeStr()) }),
  },
  { label: "Morning (6–12)", getValues: () => ({ date: todayStr(), startTime: "06:00", endTime: "12:00" }) },
  { label: "Afternoon (12–18)", getValues: () => ({ date: todayStr(), startTime: "12:00", endTime: "18:00" }) },
  { label: "Evening (18–00)", getValues: () => ({ date: todayStr(), startTime: "18:00", endTime: "00:00" }) },
];

function AvailabilityTab() {
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(nowTimeStr());
  const [endTime, setEndTime] = useState(addHour(nowTimeStr()));
  const [result, setResult] = useState<TeacherAvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "free" | "busy">("all");

  const search = useCallback(async (d: string, st: string, et: string) => {
    if (!d || !st || !et) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTeacherAvailability({ date: d, startTime: st, endTime: et });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch availability");
    } finally {
      setLoading(false);
    }
  }, []);

  const applyPreset = (preset: (typeof TIME_PRESETS)[number]) => {
    const v = preset.getValues();
    setDate(v.date);
    setStartTime(v.startTime);
    setEndTime(v.endTime);
    search(v.date, v.startTime, v.endTime);
  };

  const displayed = result
    ? result.teachers.filter((t) => (filterMode === "free" ? !t.isBusy : filterMode === "busy" ? t.isBusy : true))
    : [];

  return (
    <div>
      {/* Query panel */}
      <div className="filter-panel-box mb-3">
        <div className="filter-panel-heading">
          <i className="ti ti-filter" />
          <span className="filter-panel-title">Filter by</span>
        </div>
        <div className="row g-3 align-items-end mb-3">
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>Date</label>
              <DatePicker
                size="large"
                style={{ width: 160 }}
                value={date ? dayjs(date) : null}
                onChange={(_, ds) => setDate(ds as string)}
                format="YYYY-MM-DD"
                placeholder="Select date"
              />
            </div>
          </div>
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>From</label>
              <TimePicker
                size="large"
                style={{ width: 140 }}
                value={startTime ? dayjs(startTime, "HH:mm") : null}
                onChange={(_, ts) => setStartTime(ts as string)}
                format="HH:mm"
                allowClear={false}
              />
            </div>
          </div>
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>To</label>
              <TimePicker
                size="large"
                style={{ width: 140 }}
                value={endTime ? dayjs(endTime, "HH:mm") : null}
                onChange={(_, ts) => setEndTime(ts as string)}
                format="HH:mm"
                allowClear={false}
              />
            </div>
          </div>
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>&nbsp;</label>
              <button
                className="btn btn-primary d-inline-flex align-items-center"
                style={{ height: 40 }}
                onClick={() => search(date, startTime, endTime)}
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : (
                  <i className="ti ti-search me-1" />
                )}
                Check Availability
              </button>
            </div>
          </div>
          <div className="col-md-auto">
            <div className="sf-filter-item">
              <label>&nbsp;</label>
              <button
                type="button"
                className="btn filter-panel-clear-btn"
                onClick={() => {
                  const d = todayStr();
                  const st = nowTimeStr();
                  const et = addHour(st);
                  setDate(d);
                  setStartTime(st);
                  setEndTime(et);
                  setFilterMode("all");
                  setResult(null);
                  setError(null);
                }}
              >
                <i className="ti ti-x fs-12" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Quick presets */}
        <div className="d-flex gap-2 flex-wrap">
          <span className="small text-muted align-self-center">Quick:</span>
          {TIME_PRESETS.map((p) => (
            <button
              key={p.label}
              className="btn btn-outline-secondary btn-sm"
              onClick={() => applyPreset(p)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className="d-flex gap-3 flex-wrap align-items-center mb-3">
            <div className="d-flex gap-2">
              <div className="card border-0 bg-light px-3 py-2 text-center" style={{ minWidth: 90 }}>
                <div className="fw-bold fs-5">{result.totalTeachers}</div>
                <div className="text-muted small">Total</div>
              </div>
              <div className="card border-0 px-3 py-2 text-center" style={{ minWidth: 90, background: "#dcfce7" }}>
                <div className="fw-bold fs-5 text-success">{result.freeCount}</div>
                <div className="text-muted small">Free</div>
              </div>
              <div className="card border-0 px-3 py-2 text-center" style={{ minWidth: 90, background: "#fee2e2" }}>
                <div className="fw-bold fs-5 text-danger">{result.busyCount}</div>
                <div className="text-muted small">Busy</div>
              </div>
            </div>

            {/* Filter pills */}
            <div className="d-flex gap-1 ms-auto">
              {(["all", "free", "busy"] as const).map((m) => (
                <button
                  key={m}
                  className="btn btn-sm"
                  style={{
                    color: filterMode === m ? "#fff" : "#2E37A4",
                    background: filterMode === m ? "#2E37A4" : "#fff",
                    border: "1.5px solid #2E37A4",
                  }}
                  onClick={() => setFilterMode(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 text-muted small">
            Showing availability for <strong>{fmtDate(result.queryDate)}</strong> between{" "}
            <strong>{fmtTime(result.startTime)}</strong> – <strong>{fmtTime(result.endTime)}</strong>
          </div>

          {/* Teacher grid */}
          <div className="row g-3">
            {displayed.length === 0 && (
              <div className="col-12 text-center py-4 text-muted">
                <i className="ti ti-user-off fs-48 d-block mb-2" />
                No teachers match the selected filter.
              </div>
            )}
            {displayed.map((t) => (
              <TeacherCard key={t.id} teacher={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeacherCard({ teacher }: { teacher: TeacherAvailabilityItem }) {
  const src = teacher.imageUrl ? `${media_base_url}/${teacher.imageUrl}` : null;
  const initials = [teacher.firstName[0], teacher.lastName[0]].join("").toUpperCase();
  const shifts: string[] = Array.isArray(teacher.shift) ? teacher.shift : [];

  return (
    <div className="col-12 col-sm-6 col-lg-4 col-xl-3">
      <div
        className={`card h-100 border-2 ${teacher.isBusy ? "border-danger" : "border-success"}`}
        style={{ borderStyle: "solid" }}
      >
        <div className="card-body p-3">
          {/* Header */}
          <div className="d-flex align-items-center gap-2 mb-2">
            {src ? (
              <img
                src={src}
                alt={`${teacher.firstName} ${teacher.lastName}`}
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center fw-bold text-white"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: teacher.isBusy ? "#EF4444" : "#22C55E",
                  fontSize: 14,
                }}
              >
                {initials}
              </div>
            )}
            <div>
              <div className="fw-medium small">
                {teacher.firstName} {teacher.lastName}
              </div>
              {shifts.length > 0 && (
                <div className="d-flex gap-1 flex-wrap mt-1">
                  {shifts.map((s) => (
                    <span
                      key={s}
                      className="badge"
                      style={{ background: SHIFT_COLORS[s] ?? "#6B7280", color: "#fff", fontSize: 10 }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className={`badge ms-auto ${teacher.isBusy ? "bg-danger" : "bg-success"}`} style={{ fontSize: 11 }}>
              {teacher.isBusy ? "Busy" : "Free"}
            </span>
          </div>

          {/* Sessions during that window */}
          {teacher.isBusy && teacher.sessions.length > 0 && (
            <div className="mt-2 border-top pt-2">
              {teacher.sessions.map((s) => (
                <div key={s.id} className="small text-muted mb-1">
                  <i className="ti ti-calendar me-1 text-danger" />
                  <span className="fw-medium text-dark">{s.title}</span>
                  {s.Course && <span className="text-muted"> · {s.Course.courseName}</span>}
                  <div className="ms-3" style={{ fontSize: 11 }}>
                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                    {s.sessionStatus === "live" && (
                      <span className="badge bg-success ms-1" style={{ fontSize: 9 }}>
                        LIVE
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!teacher.isBusy && (
            <div className="small text-success mt-1">
              <i className="ti ti-check me-1" />
              Available in this time window
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type TabKey = "sessions" | "schedules" | "availability";

const ClassList = () => {
  const user = useAppSelector((state) => state.auth.user);
  usePermissionGuard(PERMISSIONS.CLASSES_VIEW);

  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canManage = canAccess(roleName, permissions, PERMISSIONS.CLASSES_MANAGE);

  const [activeTab, setActiveTab] = useState<TabKey>("sessions");

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "sessions", label: "Sessions", icon: "ti-calendar-event" },
    { key: "schedules", label: "Schedule Templates", icon: "ti-calendar-repeat" },
    { key: "availability", label: "Teacher Availability", icon: "ti-user-check" },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">Scheduled Classes</h4>
            <p className="text-muted mb-0 mt-1">View sessions, recurring schedules, and teacher availability</p>
          </div>
          {canManage && (
            <a href="/admin/class-schedule" className="btn btn-primary d-inline-flex align-items-center gap-1">
              <i className="ti ti-calendar-plus" />
              Manage in Calendar
            </a>
          )}
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          {tabs.map((t) => (
            <li key={t.key} className="nav-item">
              <button
                type="button"
                className={`nav-link d-flex align-items-center gap-1 ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                <i className={`ti ${t.icon}`} />
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        {activeTab === "sessions" && <SessionsTab />}
        {activeTab === "schedules" && <SchedulesTab />}
        {activeTab === "availability" && <AvailabilityTab />}
      </div>
    </div>
  );
};

export default ClassList;
