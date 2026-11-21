"use client";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchSessionSheetThunk,
  bulkMarkThunk,
  resetBulkMarkStatus,
} from "@/core/redux/attendanceSlice";
import { AttendanceStudent, AttendanceStatus } from "@/types/attendance";
import { useNotification } from "@/hooks/useNotification";

interface BulkAttendanceSheetProps {
  sessionId: number;
  onSuccess?: () => void;
}

export default function BulkAttendanceSheet({ sessionId, onSuccess }: BulkAttendanceSheetProps) {
  const dispatch = useAppDispatch();
  const notify = useNotification();
  const { attendanceSheet, sheetStatus, sheetError, bulkMarkStatus } =
    useAppSelector((s) => s.attendance);

  const [localStatuses, setLocalStatuses] = useState<Record<number, AttendanceStatus>>({});

  useEffect(() => {
    dispatch(fetchSessionSheetThunk(sessionId));
    return () => {
      dispatch(resetBulkMarkStatus());
    };
  }, [sessionId, dispatch]);

  // Pre-populate from existing records
  useEffect(() => {
    if (attendanceSheet) {
      const initial: Record<number, AttendanceStatus> = {};
      attendanceSheet.students.forEach((s) => {
        initial[s.studentId] = s.status ?? "Present";
      });
      setLocalStatuses(initial);
    }
  }, [attendanceSheet]);

  const toggleStatus = (studentId: number) => {
    setLocalStatuses((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "Present" ? "Absent" : "Present",
    }));
  };

  const handleSubmit = async () => {
    if (!attendanceSheet) return;
    const records = attendanceSheet.students.map((s) => ({
      studentId: s.studentId,
      courseDetailsId: s.courseDetailsId,
      status: localStatuses[s.studentId] ?? "Present",
    }));
    const result = await dispatch(bulkMarkThunk({ sessionId, records }));
    if (bulkMarkThunk.fulfilled.match(result)) {
      notify.success(`Attendance saved for ${records.length} student(s)`);
      onSuccess?.();
      // Re-fetch to show updated statuses
      dispatch(fetchSessionSheetThunk(sessionId));
    } else if (bulkMarkThunk.rejected.match(result)) {
      notify.error((result.payload as string) || "Failed to save attendance");
    }
  };

  const markAllPresent = () => {
    if (!attendanceSheet) return;
    const all: Record<number, AttendanceStatus> = {};
    attendanceSheet.students.forEach((s) => {
      all[s.studentId] = "Present";
    });
    setLocalStatuses(all);
  };

  const markAllAbsent = () => {
    if (!attendanceSheet) return;
    const all: Record<number, AttendanceStatus> = {};
    attendanceSheet.students.forEach((s) => {
      all[s.studentId] = "Absent";
    });
    setLocalStatuses(all);
  };

  if (sheetStatus === "loading") {
    return (
      <div className="text-center py-4">
        <div className="spinner-border spinner-border-sm text-primary" role="status" />
        <p className="text-muted mt-2 mb-0">Loading attendance sheet…</p>
      </div>
    );
  }

  if (sheetStatus === "failed") {
    return (
      <div className="alert alert-danger py-2">
        {sheetError || "Failed to load attendance sheet"}
      </div>
    );
  }

  if (!attendanceSheet) return null;

  const { session, students } = attendanceSheet;
  const presentCount = Object.values(localStatuses).filter((s) => s === "Present").length;
  const absentCount = students.length - presentCount;

  return (
    <div>
      {/* Session Header */}
      <div className="card border-0 bg-light mb-3">
        <div className="card-body py-2 px-3">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div>
              <p className="mb-0 fw-semibold">{session.title}</p>
              <small className="text-muted">
                {session.date} &bull; {session.startTime} – {session.endTime}
              </small>
            </div>
            {session.course && (
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                {session.course.courseName}
              </span>
            )}
            <span
              className={`badge ms-auto ${
                session.status === "completed"
                  ? "bg-secondary-subtle text-secondary"
                  : "bg-primary-subtle text-primary"
              }`}
            >
              {session.status}
            </span>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="alert alert-info py-2">
          No enrolled students found for this session.
        </div>
      ) : (
        <>
          {/* Bulk actions + summary */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={markAllPresent}
              >
                All Present
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={markAllAbsent}
              >
                All Absent
              </button>
            </div>
            <div className="d-flex gap-3 text-sm">
              <span className="text-success fw-semibold">
                <i className="ti ti-user-check me-1" />
                {presentCount} Present
              </span>
              <span className="text-danger fw-semibold">
                <i className="ti ti-user-x me-1" />
                {absentCount} Absent
              </span>
            </div>
          </div>

          {/* Student List */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover table-stack mb-3">
              <thead className="thead-light">
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Student</th>
                  <th style={{ width: "160px" }} className="text-center">
                    Attendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: AttendanceStudent, idx: number) => {
                  const status = localStatuses[student.studentId] ?? "Present";
                  const isPresent = status === "Present";
                  return (
                    <tr
                      key={student.studentId}
                      className={isPresent ? "" : "table-danger"}
                    >
                      <td data-label="#" className="text-muted align-middle">{idx + 1}</td>
                      <td data-label="Student" className="align-middle">
                        <div className="d-flex align-items-center gap-2">
                          {student.profileImg ? (
                            <img
                              src={student.profileImg}
                              alt=""
                              className="rounded-circle"
                              style={{ width: 32, height: 32, objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                              style={{ width: 32, height: 32, fontSize: 13, fontWeight: 600 }}
                            >
                              {student.firstName[0]}
                              {student.lastName?.[0] ?? ""}
                            </div>
                          )}
                          <span className="fw-medium">
                            {student.firstName} {student.lastName}
                          </span>
                        </div>
                      </td>
                      <td data-label="Attendance" className="align-middle text-center">
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            isPresent ? "btn-success" : "btn-danger"
                          }`}
                          style={{ minWidth: 100 }}
                          onClick={() => toggleStatus(student.studentId)}
                        >
                          {isPresent ? (
                            <>
                              <i className="ti ti-check me-1" />
                              Present
                            </>
                          ) : (
                            <>
                              <i className="ti ti-x me-1" />
                              Absent
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={bulkMarkStatus === "loading"}
            >
              {bulkMarkStatus === "loading" ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Saving…
                </>
              ) : (
                <>
                  <i className="ti ti-device-floppy me-2" />
                  Save Attendance
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
