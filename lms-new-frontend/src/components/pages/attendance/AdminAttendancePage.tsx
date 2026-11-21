"use client";
import { useEffect, useState } from "react";
import { DatePicker, Select } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchAdminStudentAttendanceThunk, fetchAdminTeacherAttendanceThunk } from "@/core/redux/attendanceSlice";
import { fetchTeachersThunk } from "@/core/redux/teacherSlice";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { fetchCoursesThunk } from "@/core/redux/courseSlice";
import { AdminStudentAttendanceFilter, AdminTeacherAttendanceFilter } from "@/types/attendance";
import { resolveImageUrl } from "@/environment";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

type Tab = "students" | "teachers";

function calcDuration(checkIn: string | null | undefined, checkOut: string | null | undefined): string {
  if (!checkIn || !checkOut) return "—";
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  const totalMin = oh * 60 + om - (ih * 60 + im);
  if (totalMin <= 0) return "—";
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export default function AdminAttendancePage() {
  usePermissionGuard(PERMISSIONS.ATTENDANCE_VIEW);
  const dispatch = useAppDispatch();

  const {
    adminStudentRecords,
    adminStudentTotal,
    adminStudentStats,
    adminStudentStatus,
    adminTeacherRecords,
    adminTeacherTotal,
    adminTeacherStats,
    adminTeacherStatus,
  } = useAppSelector((s) => s.attendance);

  const { allItems: teachers, listStatus: teachersStatus } = useAppSelector((s) => s.teachers);
  const { allItems: students, listStatus: studentsStatus } = useAppSelector((s) => s.students);
  const { allItems: courses, listStatus: coursesStatus } = useAppSelector((s) => s.courses);

  const [activeTab, setActiveTab] = useState<Tab>("students");

  // Student filters
  const [sStartDate, setSStartDate] = useState("");
  const [sEndDate, setSEndDate] = useState("");
  const [sTeacherId, setSTeacherId] = useState<number | "">("");
  const [sCourseId, setSCourseId] = useState<number | "">("");
  const [sStudentId, setSStudentId] = useState<number | "">("");

  // Teacher filters
  const [tStartDate, setTStartDate] = useState("");
  const [tEndDate, setTEndDate] = useState("");
  const [tTeacherId, setTTeacherId] = useState<number | "">("");

  useEffect(() => {
    if (teachersStatus === "idle") dispatch(fetchTeachersThunk());
    if (studentsStatus === "idle") dispatch(fetchStudentsThunk());
    if (coursesStatus === "idle") dispatch(fetchCoursesThunk());
    // Initial load with no filters
    dispatch(fetchAdminStudentAttendanceThunk({}));
    dispatch(fetchAdminTeacherAttendanceThunk({}));
  }, [dispatch]);

  const handleStudentFilter = () => {
    const filters: AdminStudentAttendanceFilter = {};
    if (sStartDate) filters.startDate = sStartDate;
    if (sEndDate) filters.endDate = sEndDate;
    if (sTeacherId) filters.teacherId = Number(sTeacherId);
    if (sCourseId) filters.courseId = Number(sCourseId);
    if (sStudentId) filters.studentId = Number(sStudentId);
    dispatch(fetchAdminStudentAttendanceThunk(filters));
  };

  const handleStudentReset = () => {
    setSStartDate("");
    setSEndDate("");
    setSTeacherId("");
    setSCourseId("");
    setSStudentId("");
    dispatch(fetchAdminStudentAttendanceThunk({}));
  };

  const handleTeacherFilter = () => {
    const filters: AdminTeacherAttendanceFilter = {};
    if (tStartDate) filters.startDate = tStartDate;
    if (tEndDate) filters.endDate = tEndDate;
    if (tTeacherId) filters.teacherId = Number(tTeacherId);
    dispatch(fetchAdminTeacherAttendanceThunk(filters));
  };

  const handleTeacherReset = () => {
    setTStartDate("");
    setTEndDate("");
    setTTeacherId("");
    dispatch(fetchAdminTeacherAttendanceThunk({}));
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="mb-3 pb-3 border-bottom">
          <h4 className="fw-bold mb-0">Attendance Management</h4>
          <p className="text-muted mb-0 small">View and filter student & teacher attendance</p>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "students" ? "active" : ""}`}
              onClick={() => setActiveTab("students")}
            >
              <i className="ti ti-users me-2" />
              Student Attendance
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "teachers" ? "active" : ""}`}
              onClick={() => setActiveTab("teachers")}
            >
              <i className="ti ti-user-check me-2" />
              Teacher Attendance
            </button>
          </li>
        </ul>

        {/* ── Tab: Student Attendance ── */}
        {activeTab === "students" && (
          <>
            {/* Stats Cards */}
            {adminStudentStats && (
              <div className="row g-3 mb-4">
                {[
                  { label: "Total Records", value: adminStudentStats.total, color: "primary", icon: "clipboard-list" },
                  { label: "Present", value: adminStudentStats.present, color: "success", icon: "user-check" },
                  { label: "Absent", value: adminStudentStats.absent, color: "danger", icon: "user-x" },
                  {
                    label: "Attendance %",
                    value: `${adminStudentStats.percentage}%`,
                    color: "info",
                    icon: "chart-bar",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm">
                      <div className="card-body d-flex align-items-center gap-3">
                        <div
                          className={`rounded-circle bg-${stat.color} bg-opacity-10 d-flex align-items-center justify-content-center`}
                          style={{ width: 46, height: 46 }}
                        >
                          <i className={`ti ti-${stat.icon} text-${stat.color} fs-5`} />
                        </div>
                        <div>
                          <p className="mb-0 text-muted small">{stat.label}</p>
                          <p className={`mb-0 fw-bold fs-5 text-${stat.color}`}>{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="filter-panel-box mb-3">
              <div className="filter-panel-heading">
                <i className="ti ti-filter" />
                <span className="filter-panel-title">Filter by</span>
              </div>
              <div className="row g-3 align-items-end">
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>From</label>
                    <DatePicker
                      size="large"
                      style={{ width: 150 }}
                      value={sStartDate ? dayjs(sStartDate) : null}
                      onChange={(_, ds) => setSStartDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Start date"
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>To</label>
                    <DatePicker
                      size="large"
                      style={{ width: 150 }}
                      value={sEndDate ? dayjs(sEndDate) : null}
                      onChange={(_, ds) => setSEndDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="End date"
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>Teacher</label>
                    <Select
                      allowClear
                      showSearch
                      size="large"
                      placeholder="All Teachers"
                      style={{ minWidth: 170 }}
                      value={sTeacherId || undefined}
                      onChange={(v) => setSTeacherId(v ?? "")}
                      options={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                      suffixIcon={<i className="ti ti-chalkboard" />}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>Course</label>
                    <Select
                      allowClear
                      showSearch
                      size="large"
                      placeholder="All Courses"
                      style={{ minWidth: 170 }}
                      value={sCourseId || undefined}
                      onChange={(v) => setSCourseId(v ?? "")}
                      options={courses.map((c) => ({ value: c.id, label: c.courseName }))}
                      suffixIcon={<i className="ti ti-books" />}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>Student</label>
                    <Select
                      allowClear
                      showSearch
                      size="large"
                      placeholder="All Students"
                      style={{ minWidth: 170 }}
                      value={sStudentId || undefined}
                      onChange={(v) => setSStudentId(v ?? "")}
                      options={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
                      suffixIcon={<i className="ti ti-users" />}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>&nbsp;</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-primary d-inline-flex align-items-center"
                        style={{ height: 40 }}
                        onClick={handleStudentFilter}
                      >
                        <i className="ti ti-filter" />
                      </button>
                      <button type="button" className="btn filter-panel-clear-btn" onClick={handleStudentReset}>
                        <i className="ti ti-x fs-12" />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-muted small mt-2 mb-0">{adminStudentTotal} record(s) found</p>
            </div>

            {/* Student Attendance Table */}
            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                {adminStudentStatus === "loading" ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover table-stack mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Student</th>
                          <th>Course</th>
                          <th>Teacher</th>
                          <th>Session</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminStudentRecords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-4">
                              No attendance records found. Adjust filters to view data.
                            </td>
                          </tr>
                        ) : (
                          adminStudentRecords.map((rec) => (
                            <tr key={rec.id}>
                              <td data-label="Student">
                                <div className="d-flex align-items-center gap-2">
                                  {rec.Student?.profileImg ? (
                                    <img
                                      src={`${resolveImageUrl(rec.Student.profileImg)}`}
                                      alt=""
                                      className="rounded-circle"
                                      style={{ width: 32, height: 32, objectFit: "cover" }}
                                    />
                                  ) : (
                                    <div
                                      className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-semibold"
                                      style={{ width: 32, height: 32, fontSize: 12 }}
                                    >
                                      {rec.Student?.firstName?.[0]}
                                      {rec.Student?.lastName?.[0]}
                                    </div>
                                  )}
                                  <span className="fw-medium">
                                    {rec.Student?.firstName} {rec.Student?.lastName}
                                  </span>
                                </div>
                              </td>
                              <td data-label="Course" className="text-muted">
                                {rec.CourseDetail?.Course?.courseName ?? "—"}
                              </td>
                              <td data-label="Teacher">
                                {rec.CourseDetail?.Teacher ? (
                                  <div className="d-flex align-items-center gap-2">
                                    {rec.CourseDetail.Teacher.imageUrl ? (
                                      <img
                                        src={`${resolveImageUrl(rec.CourseDetail.Teacher.imageUrl)}`}
                                        alt=""
                                        className="rounded-circle"
                                        style={{ width: 32, height: 32, objectFit: "cover" }}
                                      />
                                    ) : (
                                      <div
                                        className="rounded-circle bg-info d-flex align-items-center justify-content-center text-white fw-semibold"
                                        style={{ width: 32, height: 32, fontSize: 12 }}
                                      >
                                        {rec.CourseDetail.Teacher.firstName?.[0]}
                                        {rec.CourseDetail.Teacher.lastName?.[0]}
                                      </div>
                                    )}
                                    <span className="fw-medium">
                                      {rec.CourseDetail.Teacher.firstName} {rec.CourseDetail.Teacher.lastName}
                                    </span>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td data-label="Session" className="text-muted">
                                {rec.ClassSession ? `${rec.ClassSession.title} (${rec.ClassSession.startTime})` : "—"}
                              </td>
                              <td data-label="Date" className="fw-medium">
                                {rec.date}
                              </td>
                              <td data-label="Status">
                                <span
                                  className={`badge ${rec.status === "Present" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}
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

        {/* ── Tab: Teacher Attendance ── */}
        {activeTab === "teachers" && (
          <>
            {/* Stats Cards */}
            {adminTeacherStats && (
              <div className="row g-3 mb-4">
                {[
                  { label: "Total Records", value: adminTeacherStats.total, color: "primary", icon: "clipboard-list" },
                  { label: "Present Days", value: adminTeacherStats.present, color: "success", icon: "user-check" },
                  { label: "Absent Days", value: adminTeacherStats.absent, color: "danger", icon: "user-x" },
                  {
                    label: "Attendance %",
                    value: `${adminTeacherStats.percentage}%`,
                    color: "info",
                    icon: "chart-bar",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm">
                      <div className="card-body d-flex align-items-center gap-3">
                        <div
                          className={`rounded-circle bg-${stat.color} bg-opacity-10 d-flex align-items-center justify-content-center`}
                          style={{ width: 46, height: 46 }}
                        >
                          <i className={`ti ti-${stat.icon} text-${stat.color} fs-5`} />
                        </div>
                        <div>
                          <p className="mb-0 text-muted small">{stat.label}</p>
                          <p className={`mb-0 fw-bold fs-5 text-${stat.color}`}>{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="filter-panel-box mb-3">
              <div className="filter-panel-heading">
                <i className="ti ti-filter" />
                <span className="filter-panel-title">Filter by</span>
              </div>
              <div className="row g-3 align-items-end">
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>From</label>
                    <DatePicker
                      size="large"
                      style={{ width: 150 }}
                      value={tStartDate ? dayjs(tStartDate) : null}
                      onChange={(_, ds) => setTStartDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Start date"
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>To</label>
                    <DatePicker
                      size="large"
                      style={{ width: 150 }}
                      value={tEndDate ? dayjs(tEndDate) : null}
                      onChange={(_, ds) => setTEndDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="End date"
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>Teacher</label>
                    <Select
                      allowClear
                      showSearch
                      size="large"
                      placeholder="All Teachers"
                      style={{ minWidth: 170 }}
                      value={tTeacherId || undefined}
                      onChange={(v) => setTTeacherId(v ?? "")}
                      options={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                      suffixIcon={<i className="ti ti-chalkboard" />}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>
                </div>
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                    <label>&nbsp;</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-primary d-inline-flex align-items-center"
                        style={{ height: 40 }}
                        onClick={handleTeacherFilter}
                      >
                        <i className="ti ti-filter" />
                      </button>
                      <button type="button" className="btn filter-panel-clear-btn" onClick={handleTeacherReset}>
                        <i className="ti ti-x fs-12" />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-muted small mt-2 mb-0">{adminTeacherTotal} record(s) found</p>
            </div>

            {/* Teacher Attendance Table */}
            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                {adminTeacherStatus === "loading" ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover table-stack mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Teacher</th>
                          <th>Date</th>
                          <th>Check In</th>
                          <th>Check Out</th>
                          <th>Duration</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminTeacherRecords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-4">
                              No teacher attendance records found. Adjust filters to view data.
                            </td>
                          </tr>
                        ) : (
                          adminTeacherRecords.map((rec) => (
                            <tr key={rec.id}>
                              <td data-label="Teacher">
                                <div className="d-flex align-items-center gap-2">
                                  {rec.Teacher?.imageUrl ? (
                                    <img
                                      src={`${resolveImageUrl(rec.Teacher.imageUrl)}`}
                                      alt=""
                                      className="rounded-circle"
                                      style={{ width: 32, height: 32, objectFit: "cover" }}
                                    />
                                  ) : (
                                    <div
                                      className="rounded-circle bg-info d-flex align-items-center justify-content-center text-white fw-semibold"
                                      style={{ width: 32, height: 32, fontSize: 12 }}
                                    >
                                      {rec.Teacher?.firstName?.[0]}
                                      {rec.Teacher?.lastName?.[0]}
                                    </div>
                                  )}
                                  <span className="fw-medium">
                                    {rec.Teacher?.firstName} {rec.Teacher?.lastName}
                                  </span>
                                </div>
                              </td>
                              <td data-label="Date" className="fw-medium">
                                {rec.date}
                              </td>
                              <td data-label="Check In" className="text-success">
                                {formatTime(rec.checkInTime)}
                              </td>
                              <td data-label="Check Out" className="text-primary">
                                {formatTime(rec.checkOutTime)}
                              </td>
                              <td data-label="Duration">{calcDuration(rec.checkInTime, rec.checkOutTime)}</td>
                              <td data-label="Status">
                                <span
                                  className={`badge ${rec.status === "Present" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}
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
