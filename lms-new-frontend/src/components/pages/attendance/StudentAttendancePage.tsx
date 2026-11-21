"use client";
import { useEffect, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchStudentSummaryThunk,
  fetchStudentHistoryThunk,
} from "@/core/redux/attendanceSlice";
import { AttendanceSummary } from "@/types/attendance";

interface StudentAttendancePageProps {
  studentId: number;
  readOnly?: boolean;
}

export default function StudentAttendancePage({
  studentId,
  readOnly = false,
}: StudentAttendancePageProps) {
  const dispatch = useAppDispatch();
  const { summaries, summaryStatus, studentHistory, studentHistoryStatus } = useAppSelector(
    (s) => s.attendance
  );

  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterCdId, setFilterCdId] = useState<number | "">("");

  useEffect(() => {
    dispatch(fetchStudentSummaryThunk(studentId));
    dispatch(fetchStudentHistoryThunk({ studentId }));
  }, [studentId, dispatch]);

  const handleFilter = () => {
    dispatch(
      fetchStudentHistoryThunk({
        studentId,
        filters: {
          startDate: filterStart || undefined,
          endDate: filterEnd || undefined,
          courseDetailsId: filterCdId ? Number(filterCdId) : undefined,
        },
      })
    );
  };

  const handleReset = () => {
    setFilterStart("");
    setFilterEnd("");
    setFilterCdId("");
    dispatch(fetchStudentHistoryThunk({ studentId }));
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 75) return "text-success";
    if (pct >= 50) return "text-warning";
    return "text-danger";
  };

  const getProgressBarColor = (pct: number) => {
    if (pct >= 75) return "bg-success";
    if (pct >= 50) return "bg-warning";
    return "bg-danger";
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="mb-3 pb-3 border-bottom">
          <h4 className="fw-bold mb-0">My Attendance</h4>
          {readOnly && (
            <p className="text-muted mb-0 small">Viewing as parent (read-only)</p>
          )}
        </div>

        {/* Summary Cards */}
        {summaryStatus === "loading" ? (
          <div className="text-center py-3">
            <div className="spinner-border text-primary" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="alert alert-info">No attendance records found.</div>
        ) : (
          <div className="row g-3 mb-4">
            {summaries.map((s: AttendanceSummary) => (
              <div key={s.courseDetailsId} className="col-md-4 col-sm-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-start justify-content-between mb-2">
                      <div>
                        <p className="fw-semibold mb-0 text-truncate" style={{ maxWidth: 160 }}>
                          {s.courseName}
                        </p>
                        <small className="text-muted">
                          {s.totalSessions} session{s.totalSessions !== 1 ? "s" : ""}
                        </small>
                      </div>
                      <span className={`fs-4 fw-bold ${getPercentageColor(s.percentage)}`}>
                        {s.percentage}%
                      </span>
                    </div>

                    <div className="progress mb-2" style={{ height: 6 }}>
                      <div
                        className={`progress-bar ${getProgressBarColor(s.percentage)}`}
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>

                    <div className="d-flex justify-content-between">
                      <small className="text-success">
                        <i className="ti ti-check me-1" />
                        {s.presentCount} Present
                      </small>
                      <small className="text-danger">
                        <i className="ti ti-x me-1" />
                        {s.absentCount} Absent
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Section */}
        <h5 className="fw-semibold mb-3">Attendance History</h5>

        {/* Filters */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small mb-1">From</label>
                <DatePicker
                  size="small"
                  style={{ width: "100%" }}
                  value={filterStart ? dayjs(filterStart) : null}
                  onChange={(_, ds) => setFilterStart(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="Start date"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">To</label>
                <DatePicker
                  size="small"
                  style={{ width: "100%" }}
                  value={filterEnd ? dayjs(filterEnd) : null}
                  onChange={(_, ds) => setFilterEnd(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="End date"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Course</label>
                <select
                  className="form-select form-select-sm"
                  value={filterCdId}
                  onChange={(e) => setFilterCdId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">All Courses</option>
                  {summaries.map((s) => (
                    <option key={s.courseDetailsId} value={s.courseDetailsId}>
                      {s.courseName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-1">
                <button className="btn btn-primary btn-sm w-100" onClick={handleFilter}>
                  <i className="ti ti-filter" />
                </button>
              </div>
              <div className="col-md-2">
                <button
                  className="btn btn-outline-secondary btn-sm w-100"
                  onClick={handleReset}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {studentHistoryStatus === "loading" ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-stack mb-0">
                  <thead className="thead-light">
                    <tr>
                      <th>Date</th>
                      <th>Course</th>
                      <th>Session</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          No attendance records found.
                        </td>
                      </tr>
                    ) : (
                      studentHistory.map((rec) => (
                        <tr key={rec.id}>
                          <td data-label="Date" className="fw-medium">{rec.date}</td>
                          <td data-label="Course" className="text-muted">
                            {rec.CourseDetail?.Course?.courseName ?? "—"}
                          </td>
                          <td data-label="Session" className="text-muted">
                            {rec.ClassSession
                              ? `${rec.ClassSession.title} (${rec.ClassSession.startTime})`
                              : "—"}
                          </td>
                          <td data-label="Status">
                            <span
                              className={`badge ${
                                rec.status === "Present"
                                  ? "bg-success-subtle text-success"
                                  : "bg-danger-subtle text-danger"
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
