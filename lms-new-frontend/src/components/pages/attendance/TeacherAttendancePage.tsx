"use client";
import { useEffect, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchTodayThunk,
  checkInThunk,
  checkOutThunk,
  fetchTeacherHistoryThunk,
  fetchTeacherSessionsThunk,
  fetchSessionSheetThunk,
} from "@/core/redux/attendanceSlice";
import { useNotification } from "@/hooks/useNotification";
import { TeacherSessionItem } from "@/types/attendance";
import BulkAttendanceSheet from "./BulkAttendanceSheet";

interface TeacherAttendancePageProps {
  teacherId: number;
}

type Tab = "myAttendance" | "markStudents";

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function calcDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "—";
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  const totalMin = (oh * 60 + om) - (ih * 60 + im);
  if (totalMin <= 0) return "—";
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export default function TeacherAttendancePage({ teacherId }: TeacherAttendancePageProps) {
  const dispatch = useAppDispatch();
  const notify = useNotification();

  const {
    todayRecord,
    todayStatus,
    checkInStatus,
    checkOutStatus,
    teacherHistory,
    teacherHistoryTotal,
    historyStatus,
    teacherSessions,
    sessionsStatus,
  } = useAppSelector((s) => s.attendance);

  const [activeTab, setActiveTab] = useState<Tab>("myAttendance");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");

  useEffect(() => {
    dispatch(fetchTodayThunk(teacherId));
    dispatch(fetchTeacherHistoryThunk({ teacherId }));
    dispatch(fetchTeacherSessionsThunk(teacherId));
  }, [teacherId, dispatch]);

  const handleCheckIn = async () => {
    const result = await dispatch(checkInThunk({ teacherId }));
    if (checkInThunk.fulfilled.match(result)) {
      notify.success("Checked in successfully!");
    } else {
      notify.error("Check-in failed");
    }
  };

  const handleCheckOut = async () => {
    const result = await dispatch(checkOutThunk(teacherId));
    if (checkOutThunk.fulfilled.match(result)) {
      notify.success("Checked out successfully!");
    } else {
      notify.error("Check-out failed");
    }
  };

  const handleSessionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelectedSessionId(id || null);
    if (id) dispatch(fetchSessionSheetThunk(id));
  };

  const handleFilterHistory = () => {
    dispatch(
      fetchTeacherHistoryThunk({
        teacherId,
        filters: {
          startDate: historyStart || undefined,
          endDate: historyEnd || undefined,
        },
      })
    );
  };

  const isCheckedIn = !!todayRecord?.checkInTime;
  const isCheckedOut = !!todayRecord?.checkOutTime;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="mb-3 pb-3 border-bottom d-flex align-items-center justify-content-between">
          <div>
            <h4 className="fw-bold mb-0">Attendance</h4>
            <p className="text-muted mb-0 small">{today}</p>
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "myAttendance" ? "active" : ""}`}
              onClick={() => setActiveTab("myAttendance")}
            >
              <i className="ti ti-user-check me-2" />
              My Attendance
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "markStudents" ? "active" : ""}`}
              onClick={() => setActiveTab("markStudents")}
            >
              <i className="ti ti-clipboard-check me-2" />
              Mark Students
            </button>
          </li>
        </ul>

        {/* ── Tab: My Attendance ── */}
        {activeTab === "myAttendance" && (
          <>
            {/* Today's Check-In Card */}
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center ${
                          isCheckedIn ? "bg-success" : "bg-secondary"
                        } bg-opacity-10`}
                        style={{ width: 42, height: 42 }}
                      >
                        <i
                          className={`ti ti-${isCheckedIn ? "user-check" : "user"} fs-5 ${
                            isCheckedIn ? "text-success" : "text-secondary"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="mb-0 fw-semibold">Today&apos;s Status</p>
                        <span
                          className={`badge ${
                            isCheckedIn ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary"
                          }`}
                        >
                          {isCheckedIn ? "Present" : "Not Checked In"}
                        </span>
                      </div>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <div className="bg-light rounded p-2 text-center">
                          <small className="text-muted d-block">Check In</small>
                          <span className="fw-semibold text-success">
                            {formatTime(todayRecord?.checkInTime)}
                          </span>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="bg-light rounded p-2 text-center">
                          <small className="text-muted d-block">Check Out</small>
                          <span className="fw-semibold text-primary">
                            {formatTime(todayRecord?.checkOutTime)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isCheckedIn && (
                      <div className="bg-light rounded p-2 text-center mb-3">
                        <small className="text-muted d-block">Duration</small>
                        <span className="fw-semibold">
                          {calcDuration(todayRecord?.checkInTime ?? null, todayRecord?.checkOutTime ?? null)}
                        </span>
                      </div>
                    )}

                    {todayStatus === "loading" ? (
                      <div className="text-center">
                        <span className="spinner-border spinner-border-sm text-primary" />
                      </div>
                    ) : !isCheckedIn ? (
                      <button
                        className="btn btn-success w-100"
                        onClick={handleCheckIn}
                        disabled={checkInStatus === "loading"}
                      >
                        {checkInStatus === "loading" ? (
                          <span className="spinner-border spinner-border-sm me-2" />
                        ) : (
                          <i className="ti ti-login me-2" />
                        )}
                        Check In
                      </button>
                    ) : !isCheckedOut ? (
                      <button
                        className="btn btn-warning w-100"
                        onClick={handleCheckOut}
                        disabled={checkOutStatus === "loading"}
                      >
                        {checkOutStatus === "loading" ? (
                          <span className="spinner-border spinner-border-sm me-2" />
                        ) : (
                          <i className="ti ti-logout me-2" />
                        )}
                        Check Out
                      </button>
                    ) : (
                      <div className="alert alert-success py-2 mb-0 text-center">
                        <i className="ti ti-circle-check me-2" />
                        Day completed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Summary Cards */}
            {teacherHistory.length > 0 && (() => {
              const present = teacherHistory.filter((r) => r.status === "Present").length;
              const absent  = teacherHistory.filter((r) => r.status === "Absent").length;
              const total   = teacherHistory.length;
              const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
              return (
                <div className="row g-3 mb-4">
                  {([
                    { label: "Total Records",   value: String(total),   icon: "ti-list",         color: "info"    },
                    { label: "Present",          value: String(present), icon: "ti-circle-check", color: "success" },
                    { label: "Absent",           value: String(absent),  icon: "ti-circle-x",     color: "danger"  },
                    { label: "Attendance Rate",  value: `${rate}%`,      icon: "ti-chart-bar",    color: "primary" },
                  ] as {label:string;value:string;icon:string;color:string}[]).map(({ label, value, icon, color }) => (
                    <div key={label} className="col-xl-3 col-md-6">
                      <div className="card border-0 shadow-sm mb-0">
                        <div className="card-body d-flex align-items-center gap-3 py-3">
                          <div className={`rounded-circle bg-${color} bg-opacity-10 p-3`}>
                            <i className={`ti ${icon} text-${color} fs-4`} />
                          </div>
                          <div>
                            <p className="text-muted mb-0 small">{label}</p>
                            <h5 className="mb-0 fw-semibold">{value}</h5>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* History Filter */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body py-2">
                <div className="row g-2 align-items-end">
                  <div className="col-md-3">
                    <label className="form-label small mb-1">From</label>
                    <DatePicker
                      size="small"
                      style={{ width: "100%" }}
                      value={historyStart ? dayjs(historyStart) : null}
                      onChange={(_, ds) => setHistoryStart(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Start date"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1">To</label>
                    <DatePicker
                      size="small"
                      style={{ width: "100%" }}
                      value={historyEnd ? dayjs(historyEnd) : null}
                      onChange={(_, ds) => setHistoryEnd(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="End date"
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      className="btn btn-primary btn-sm w-100"
                      onClick={handleFilterHistory}
                    >
                      <i className="ti ti-filter me-1" />
                      Filter
                    </button>
                  </div>
                  <div className="col-md-2">
                    <button
                      className="btn btn-outline-secondary btn-sm w-100"
                      onClick={() => {
                        setHistoryStart("");
                        setHistoryEnd("");
                        dispatch(fetchTeacherHistoryThunk({ teacherId }));
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="col-md-2 text-muted small text-end">
                    {teacherHistoryTotal} record(s)
                  </div>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                {historyStatus === "loading" ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover table-stack mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Date</th>
                          <th>Check In</th>
                          <th>Check Out</th>
                          <th>Duration</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teacherHistory.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted py-4">
                              No attendance records found.
                            </td>
                          </tr>
                        ) : (
                          teacherHistory.map((rec) => (
                            <tr key={rec.id}>
                              <td data-label="Date" className="fw-medium">{rec.date}</td>
                              <td data-label="Check In" className="text-success">{formatTime(rec.checkInTime)}</td>
                              <td data-label="Check Out" className="text-primary">{formatTime(rec.checkOutTime)}</td>
                              <td data-label="Duration">{calcDuration(rec.checkInTime, rec.checkOutTime)}</td>
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

        {/* ── Tab: Mark Students ── */}
        {activeTab === "markStudents" && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="mb-4">
                <label className="form-label fw-semibold">Select a Session</label>
                {sessionsStatus === "loading" ? (
                  <div className="d-flex align-items-center gap-2">
                    <span className="spinner-border spinner-border-sm text-primary" />
                    <span className="text-muted small">Loading sessions…</span>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedSessionId ?? ""}
                    onChange={handleSessionSelect}
                  >
                    <option value="">— Choose a session to mark attendance —</option>
                    {teacherSessions.map((session: TeacherSessionItem) => (
                      <option key={session.id} value={session.id}>
                        {session.date} | {session.title}
                        {session.Course ? ` — ${session.Course.courseName}` : ""}
                        {" ("}
                        {session.startTime} – {session.endTime}
                        {")"}
                      </option>
                    ))}
                  </select>
                )}
                {teacherSessions.length === 0 && sessionsStatus === "succeeded" && (
                  <p className="text-muted small mt-1 mb-0">
                    No sessions found in the past 30 days or next 14 days.
                  </p>
                )}
              </div>

              {selectedSessionId && (
                <BulkAttendanceSheet
                  sessionId={selectedSessionId}
                  onSuccess={() => {
                    // Sheet will re-fetch automatically
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
