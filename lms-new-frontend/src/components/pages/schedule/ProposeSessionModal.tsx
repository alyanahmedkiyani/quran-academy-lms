"use client";

import { useState, useEffect } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { proposeSessionThunk, resetProposeStatus } from "@/core/redux/calendarSlice";
import { fetchCoursesThunk } from "@/core/redux/courseSlice";
import { ProposeSessionPayload, Shift } from "@/types/classSchedule";
import { useNotification } from "@/hooks/useNotification";
import { api_base_url, withAuthorization } from "@/services/apiClient";

interface ProposeSessionModalProps {
  open: boolean;
  defaultDate?: string;
  teacherId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProposeSessionModal({
  open,
  defaultDate,
  teacherId,
  onClose,
  onSuccess,
}: ProposeSessionModalProps) {
  const dispatch = useAppDispatch();
  const notify = useNotification();
  const { allItems: courses } = useAppSelector((s) => s.courses);
  const { proposeStatus, proposeError } = useAppSelector((s) => s.calendar);
  const authUser = useAppSelector((s) => s.auth.user);

  // Derive the teacher's pre-fill shift: if they have exactly one shift assigned, pre-fill it.
  const teacherShifts = Array.isArray(authUser?.shift) ? (authUser.shift as Shift[]) : [];
  const defaultShift: Shift | "" = teacherShifts.length === 1 ? teacherShifts[0] : "";

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number>(0);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [startDate, setStartDate] = useState(defaultDate || "");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [shift, setShift] = useState<Shift | "">(defaultShift);

  const loading = proposeStatus === "loading";

  useEffect(() => {
    dispatch(fetchCoursesThunk());
  }, [dispatch]);

  // Fetch enrolled students when course changes
  useEffect(() => {
    if (!courseId) {
      setEnrolledStudents([]);
      return;
    }
    fetch(`${api_base_url}/course/students-by-course/${courseId}`, {
      headers: withAuthorization(),
    })
      .then((r) => r.json())
      .then((data) => setEnrolledStudents(data.students || []))
      .catch(() => setEnrolledStudents([]));
  }, [courseId]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setStartDate(defaultDate || "");
      setShift(defaultShift);
      dispatch(resetProposeStatus());
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, defaultDate, defaultShift, dispatch]);

  useEffect(() => {
    if (proposeError) notify.error(proposeError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposeError]);

  const validate = (): boolean => {
    if (!title.trim()) { notify.error("Title is required"); return false; }
    if (!courseId) { notify.error("Course is required"); return false; }
    if (!startDate) { notify.error("Date is required"); return false; }
    if (!startTime) { notify.error("Start time is required"); return false; }
    if (!endTime) { notify.error("End time is required"); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: ProposeSessionPayload = {
      title: title.trim(),
      courseId,
      teacherId,
      studentIds: studentIds.length > 0 ? studentIds : undefined,
      startDate,
      startTime,
      endTime,
      shift: shift || null,
    };
    try {
      await dispatch(proposeSessionThunk(payload)).unwrap();
      notify.success("Session proposed — pending admin approval");
      onSuccess();
      onClose();
    } catch {
      // error shown via proposeError useEffect
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
                <i className="ti ti-calendar-event me-2 text-warning" />
                Propose a Class Session
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
                <div className="alert alert-warning py-2 mb-4">
                  <i className="ti ti-info-circle me-1" />
                  This session will be sent to the admin for approval before appearing on calendars.
                </div>

                {/* Title */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Extra Quran Practice Session"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Course */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Course <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={courseId || ""}
                    onChange={(e) => {
                      setCourseId(Number(e.target.value));
                      setStudentIds([]);
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

                {/* Students (optional multi-select, filtered by enrolled) */}
                <div className="mb-3">
                  <label className="form-label fw-medium">Students (optional)</label>
                  {!courseId ? (
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
                            const checked = studentIds.includes(s.id);
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
                                    setStudentIds((ids) =>
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
                  <div className="form-text">
                    <i className="ti ti-info-circle me-1" />
                    Leave empty — all students enrolled in this course will see the session.
                  </div>
                </div>

                {/* Shift */}
                <div className="mb-3">
                  <label className="form-label fw-medium">Shift</label>
                  <select
                    className="form-select"
                    value={shift}
                    onChange={(e) => setShift(e.target.value as Shift | "")}
                    disabled={loading}
                  >
                    <option value="">No specific shift</option>
                    <option value="Morning">☀️ Morning (6am–12pm)</option>
                    <option value="Afternoon">🌤️ Afternoon (12pm–6pm)</option>
                    <option value="Evening">🌙 Evening (6pm–12am)</option>
                  </select>
                </div>

                {/* Date */}
                <div className="mb-3">
                  <label className="form-label fw-medium">
                    Date <span className="text-danger">*</span>
                  </label>
                  <DatePicker
                    style={{ width: "100%" }}
                    value={startDate ? dayjs(startDate) : null}
                    onChange={(_, ds) => setStartDate(ds as string)}
                    format="YYYY-MM-DD"
                    placeholder="Select date"
                    disabled={loading}
                  />
                </div>

                {/* Time — stored in PKT (Asia/Karachi); students see times converted to their timezone */}
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      Start Time <span className="text-danger">*</span>
                      <span className="ms-1 text-muted fw-normal" style={{ fontSize: 11 }}>(PKT)</span>
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-medium">
                      End Time <span className="text-danger">*</span>
                      <span className="ms-1 text-muted fw-normal" style={{ fontSize: 11 }}>(PKT)</span>
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

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
                  className="btn btn-warning text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-send me-2" />
                      Submit for Approval
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
