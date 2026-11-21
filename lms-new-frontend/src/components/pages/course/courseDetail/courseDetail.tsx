"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spin, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import { all_routes } from "@/routes/all_routes";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchCoursesThunk } from "@/core/redux/courseSlice";
import {
  fetchAllCourseDetailsThunk,
  assignCourseThunk,
  unassignCourseThunk,
  resetAssignStatus,
} from "@/core/redux/courseDetailsSlice";
import { fetchTeachersThunk } from "@/core/redux/teacherSlice";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";
import { CourseDetail } from "@/types/course";
import { media_base_url } from "@/environment";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import CommonSelect, { Option as SelectOption } from "@/core/common/common-select/commonSelect";

interface AssignmentRow {
  key: string;
  teacherName: string;
  studentName: string;
  raw: CourseDetail;
}

const CourseDetailComponent = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useParams();
  const courseId = params?.id as string;

  const user = useAppSelector((state) => state.auth.user);
  const { allItems: courses, listStatus: coursesStatus } = useAppSelector((state) => state.courses);
  const {
    allAssignments,
    listStatus: assignmentsStatus,
    assignStatus,
    assignError,
    unassignStatus,
    unassigningId,
  } = useAppSelector((state) => state.courseDetails);
  const { allItems: teachers } = useAppSelector((state) => state.teachers);
  const { allItems: students } = useAppSelector((state) => state.students);

  const [selectedTeacher, setSelectedTeacher] = useState<SelectOption | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SelectOption | null>(null);
  const [assignErrorLocal, setAssignErrorLocal] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [pendingUnassign, setPendingUnassign] = useState<AssignmentRow | null>(null);

  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
  }, [user, router]);

  useEffect(() => {
    dispatch(fetchCoursesThunk());
    dispatch(fetchAllCourseDetailsThunk());
    dispatch(fetchTeachersThunk());
    dispatch(fetchStudentsThunk());
    return () => {
      dispatch(resetAssignStatus());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const course = courses.find((c) => String(c.id) === String(courseId));
  const courseAssignments = allAssignments.filter((a) => String(a.courseId) === String(courseId));

  const handleAssign = async () => {
    setAssignErrorLocal(null);
    setAssignSuccess(null);

    if (!selectedTeacher || !selectedStudent) {
      setAssignErrorLocal("Please select both a teacher and a student.");
      return;
    }

    try {
      await dispatch(
        assignCourseThunk({
          courseId: Number(courseId),
          teacherId: Number(selectedTeacher.value),
          studentId: Number(selectedStudent.value),
        })
      ).unwrap();
      setAssignSuccess("Course assigned successfully.");
      setSelectedTeacher(null);
      setSelectedStudent(null);
      dispatch(fetchAllCourseDetailsThunk());
    } catch (err: unknown) {
      const message =
        typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to assign course.";
      setAssignErrorLocal(message);
    }
  };

  const confirmUnassign = async () => {
    if (!pendingUnassign) return;
    try {
      await dispatch(unassignCourseThunk(String(pendingUnassign.raw.id))).unwrap();
      setPendingUnassign(null);
    } catch (err: unknown) {
      const message =
        typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to remove assignment.";
      alert(message);
    }
  };

  const tableData: AssignmentRow[] = courseAssignments.map((a) => ({
    key: String(a.id),
    teacherName: a.Teacher
      ? `${a.Teacher.firstName} ${a.Teacher.lastName}`
      : `Teacher #${a.teacherId ?? "—"}`,
    studentName: a.Student
      ? `${a.Student.firstName} ${a.Student.lastName}`
      : `Student #${a.studentId}`,
    raw: a,
  }));

  const assignmentColumns: ColumnsType<AssignmentRow> = [
    {
      title: "#",
      key: "serial",
      width: 50,
      render: (_, __, index) => <span className="text-muted">{index + 1}</span>,
    },
    {
      title: "Teacher",
      dataIndex: "teacherName",
      key: "teacherName",
      render: (value) => <span className="fw-semibold">{value}</span>,
    },
    {
      title: "Student",
      dataIndex: "studentName",
      key: "studentName",
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => {
        const isRemoving = unassigningId === record.key && unassignStatus === "loading";
        return (
          <button
            type="button"
            className="btn btn-outline-danger btn-icon btn-sm"
            title="Remove Assignment"
            disabled={isRemoving}
            onClick={() => setPendingUnassign(record)}
          >
            <i className={isRemoving ? "ti ti-loader" : "ti ti-trash"} />
          </button>
        );
      },
    },
  ];

  // Loading states
  if (coursesStatus === "loading" || !course) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  const imageSrc = course.imageUrl
    ? `${media_base_url}/${course.imageUrl}`
    : null;

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">{course.courseName}</h4>
            <nav aria-label="breadcrumb" className="mt-1">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <a href={all_routes.manageCourses} className="text-muted">
                    Courses
                  </a>
                </li>
                <li className="breadcrumb-item active">{course.courseName}</li>
              </ol>
            </nav>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border"
            onClick={() => router.push(all_routes.manageCourses)}
          >
            <i className="ti ti-arrow-left me-1" />
            Back to Courses
          </button>
        </div>

        <div className="row g-4">
          {/* Course Info Card */}
          <div className="col-lg-4">
            <div className="card h-100">
              <div className="card-body">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={course.courseName}
                    className="w-100 rounded mb-3"
                    style={{ height: 180, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="d-flex align-items-center justify-content-center bg-light rounded mb-3"
                    style={{ height: 180 }}
                  >
                    <i className="ti ti-book fs-48 text-muted" />
                  </div>
                )}

                <h5 className="fw-bold mb-3">{course.courseName}</h5>

                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <i className="ti ti-clock text-primary" />
                    <span className="text-muted">Duration:</span>
                    <span className="fw-medium">{course.duration ?? "—"}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <i className="ti ti-currency-dollar text-success" />
                    <span className="text-muted">Price:</span>
                    <span className="fw-medium">
                      {course.price != null ? `$${Number(course.price).toFixed(2)}` : "Free"}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <i className="ti ti-tag text-warning" />
                    <span className="text-muted">Status:</span>
                    {course.isComing ? (
                      <span className="badge badge-soft-warning border border-warning">Upcoming</span>
                    ) : (
                      <span className="badge badge-soft-success border border-success">Active</span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <i className="ti ti-users text-info" />
                    <span className="text-muted">Enrollments:</span>
                    <span className="fw-medium">{courseAssignments.length}</span>
                  </div>
                </div>

                {course.description && (
                  <div className="mt-3 pt-3 border-top">
                    <p className="text-muted mb-0" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      {course.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side — Assignments */}
          <div className="col-lg-8">
            {/* Assign Form */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="fw-bold mb-0">
                  <i className="ti ti-link me-2 text-primary" />
                  Assign Course to Student
                </h6>
              </div>
              <div className="card-body">
                {assignErrorLocal && (
                  <div className="alert alert-danger py-2 mb-3">{assignErrorLocal}</div>
                )}
                {assignSuccess && (
                  <div className="alert alert-success py-2 mb-3">{assignSuccess}</div>
                )}
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label fw-medium">Teacher</label>
                    <CommonSelect
                      options={teachers.map((t) => ({
                        value: String(t.id),
                        label: `${t.firstName} ${t.lastName}`,
                      }))}
                      value={selectedTeacher}
                      onChange={(option) => setSelectedTeacher(option)}
                      placeholder="Select teacher"
                      isClearable
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-medium">Student</label>
                    <CommonSelect
                      options={students.map((s) => ({
                        value: String(s.id),
                        label: `${s.firstName} ${s.lastName}`,
                      }))}
                      value={selectedStudent}
                      onChange={(option) => setSelectedStudent(option)}
                      placeholder="Select student"
                      isClearable
                    />
                  </div>
                  <div className="col-md-4">
                    <button
                      type="button"
                      className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
                      onClick={handleAssign}
                      disabled={assignStatus === "loading"}
                    >
                      {assignStatus === "loading" && (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      )}
                      <i className="ti ti-plus" />
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignments Table */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h6 className="fw-bold mb-0">
                  <i className="ti ti-users me-2 text-info" />
                  Current Enrollments
                  <span className="badge badge-soft-info ms-2">{courseAssignments.length}</span>
                </h6>
              </div>
              <div className="card-body p-0">
                <Table<AssignmentRow>
                  columns={assignmentColumns}
                  dataSource={tableData}
                  rowKey="key"
                  loading={assignmentsStatus === "loading"}
                  pagination={false}
                  locale={{ emptyText: "No students assigned yet. Use the form above to assign." }}
                  scroll={{ x: 500 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unassign Confirmation */}
      <ConfirmationModal
        open={!!pendingUnassign}
        title="Remove Assignment?"
        description={
          pendingUnassign ? (
            <>
              Remove <strong>{pendingUnassign.studentName}</strong> from this course? Their progress
              data linked to this assignment may also be affected.
            </>
          ) : undefined
        }
        confirmText="Remove"
        confirmVariant="danger"
        confirmLoading={unassignStatus === "loading"}
        icon={<i className="ti ti-unlink" />}
        onConfirm={confirmUnassign}
        onCancel={() => {
          if (unassignStatus !== "loading") setPendingUnassign(null);
        }}
      />
    </div>
  );
};

export default CourseDetailComponent;
