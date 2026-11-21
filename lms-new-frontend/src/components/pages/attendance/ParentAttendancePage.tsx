"use client";
import { useEffect, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchStudentSummaryThunk,
  fetchStudentHistoryThunk,
  clearStudentHistory,
} from "@/core/redux/attendanceSlice";
import { api_base_url } from "@/environment";
import { getAccessToken } from "@/lib/auth-storage";
import { AttendanceSummary } from "@/types/attendance";

interface Child {
  id: number;
  firstName: string;
  lastName: string;
}

interface ParentAttendancePageProps {
  parentId: number;
}

export default function ParentAttendancePage({ parentId }: ParentAttendancePageProps) {
  const dispatch = useAppDispatch();
  const { summaries, summaryStatus, studentHistory, studentHistoryStatus } = useAppSelector(
    (s) => s.attendance
  );

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterCdId, setFilterCdId] = useState<number | "">("");
  const [loadingChildren, setLoadingChildren] = useState(true);

  // Fetch children from parent profile
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${api_base_url}/parent/getById/${parentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const kids: Child[] = (data.parent?.students ?? []).map((s: Child) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
        }));
        setChildren(kids);
        if (kids.length > 0) {
          setSelectedChildId(kids[0].id);
        }
      } catch {
        // silently handle
      } finally {
        setLoadingChildren(false);
      }
    };
    fetchChildren();
  }, [parentId]);

  // When child changes, fetch their attendance
  useEffect(() => {
    if (selectedChildId) {
      dispatch(clearStudentHistory());
      dispatch(fetchStudentSummaryThunk(selectedChildId));
      dispatch(fetchStudentHistoryThunk({ studentId: selectedChildId }));
    }
  }, [selectedChildId, dispatch]);

  const handleChildChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelectedChildId(id || null);
    setFilterStart("");
    setFilterEnd("");
    setFilterCdId("");
  };

  const handleFilter = () => {
    if (!selectedChildId) return;
    dispatch(
      fetchStudentHistoryThunk({
        studentId: selectedChildId,
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
    if (selectedChildId) {
      dispatch(fetchStudentHistoryThunk({ studentId: selectedChildId }));
    }
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

  const selectedChild = children.find((c) => c.id === selectedChildId);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="mb-3 pb-3 border-bottom d-flex align-items-center justify-content-between">
          <div>
            <h4 className="fw-bold mb-0">Child&apos;s Attendance</h4>
            <p className="text-muted mb-0 small">Read-only view</p>
          </div>
        </div>

        {/* Child Selector */}
        {loadingChildren ? (
          <div className="d-flex align-items-center gap-2 mb-4">
            <div className="spinner-border spinner-border-sm text-primary" />
            <span className="text-muted small">Loading children…</span>
          </div>
        ) : children.length === 0 ? (
          <div className="alert alert-info">No children linked to your account.</div>
        ) : (
          <div className="mb-4">
            {children.length > 1 && (
              <div className="row g-2 align-items-center mb-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Select Child</label>
                  <select
                    className="form-select"
                    value={selectedChildId ?? ""}
                    onChange={handleChildChange}
                  >
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedChild && (
              <div className="d-flex align-items-center gap-2 mb-3">
                <div
                  className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                  style={{ width: 36, height: 36, fontSize: 14, fontWeight: 600 }}
                >
                  {selectedChild.firstName[0]}
                  {selectedChild.lastName?.[0] ?? ""}
                </div>
                <div>
                  <p className="mb-0 fw-semibold">
                    {selectedChild.firstName} {selectedChild.lastName}
                  </p>
                  <small className="text-muted">Attendance Overview</small>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedChildId && (
          <>
            {/* Summary Cards */}
            {summaryStatus === "loading" ? (
              <div className="text-center py-3">
                <div className="spinner-border text-primary" />
              </div>
            ) : summaries.length === 0 ? (
              <div className="alert alert-info mb-4">No attendance records found.</div>
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

            {/* History Filters */}
            <h5 className="fw-semibold mb-3">Attendance History</h5>
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
          </>
        )}
      </div>
    </div>
  );
}
