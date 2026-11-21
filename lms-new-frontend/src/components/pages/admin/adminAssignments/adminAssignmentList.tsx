"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppSelector } from "@/core/redux/hooks";
import { useTeachers } from "@/hooks/useTeachers";
import { useNotification } from "@/hooks/useNotification";
import {
  fetchAllAssignmentsAdmin,
  createAssignment,
  approveAssignment,
  rejectAssignment,
  deleteAssignment,
} from "@/services/assignmentService";
import { fetchCoursesByTeacherId } from "@/services/courseDetailsService";
import { Assignment, ContentStatus } from "@/types/assignment";
import { media_base_url } from "@/environment";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import StatsCards, { StatCardItem } from "@/core/common/statsCards/StatsCards";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const StatusBadge = ({ status }: { status?: ContentStatus }) => {
  if (status === "pending") return <span className="badge bg-warning text-dark">Pending</span>;
  if (status === "rejected") return <span className="badge bg-danger">Rejected</span>;
  return <span className="badge bg-success">Active</span>;
};

interface CourseOption { courseId: string; courseName: string; }

const AdminAssignmentList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const notify = useNotification();

  usePermissionGuard(PERMISSIONS.ASSIGNMENTS_VIEW);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canApprove = canAccess(roleName, permissions, PERMISSIONS.ASSIGNMENTS_APPROVE);
  const { allItems: teachers, loading: teachersLoading, loadTeachers } = useTeachers();

  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  // Teacher-based course selection for create
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherCourses, setTeacherCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createCourseId, setCreateCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createMaxScore, setCreateMaxScore] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Approval actions
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAssignments = () => {
    setLoadingAssignments(true);
    setAssignmentsError(null);
    fetchAllAssignmentsAdmin()
      .then((res) => setAssignments(res.assignments))
      .catch((err) => {
        const msg = err.message ?? "Failed to load assignments";
        setAssignmentsError(msg);
        notify.error(msg);
      })
      .finally(() => setLoadingAssignments(false));
  };

  useEffect(() => {
    loadTeachers();
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load courses when teacher is selected in create modal
  useEffect(() => {
    if (!selectedTeacherId) { setTeacherCourses([]); return; }
    setCoursesLoading(true);
    setCreateCourseId("");
    fetchCoursesByTeacherId(selectedTeacherId)
      .then((res) => {
        const courses: CourseOption[] = Array.from(
          new Map(
            res.course.map((cd) => [String(cd.courseId), { courseId: String(cd.courseId), courseName: (cd as any).Course?.courseName ?? `Course ${cd.courseId}` }])
          ).values()
        );
        setTeacherCourses(courses);
      })
      .catch(() => setTeacherCourses([]))
      .finally(() => setCoursesLoading(false));
  }, [selectedTeacherId]);

  const resetCreateForm = () => {
    setSelectedTeacherId("");
    setCreateCourseId("");
    setCreateTitle("");
    setCreateDesc("");
    setCreateDueDate("");
    setCreateMaxScore("");
    setCreateFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!selectedTeacherId) { notify.error("Please select a teacher."); return; }
    if (!createCourseId) { notify.error("Please select a course."); return; }
    if (!createTitle.trim()) { notify.error("Please enter a title."); return; }

    const fd = new FormData();
    fd.append("teacherId", selectedTeacherId);
    fd.append("courseId", createCourseId);
    fd.append("title", createTitle.trim());
    if (createDesc.trim()) fd.append("description", createDesc.trim());
    if (createDueDate) fd.append("dueDate", createDueDate);
    if (createMaxScore) fd.append("maxScore", createMaxScore);
    if (createFile) fd.append("file", createFile);

    setCreateLoading(true);
    try {
      await createAssignment(fd);
      notify.success("Assignment created successfully");
      setShowCreate(false);
      resetCreateForm();
      loadAssignments();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to create assignment");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      await approveAssignment(id);
      notify.success("Assignment approved");
      loadAssignments();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to approve");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setRejectingId(id);
    try {
      await rejectAssignment(id);
      notify.success("Assignment rejected");
      loadAssignments();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to reject");
    } finally {
      setRejectingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAssignment(deleteTarget.id);
      notify.success("Assignment deleted");
      setAssignments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayed = activeTab === "pending"
    ? assignments.filter((a) => a.status === "pending")
    : assignments;

  const pendingCount = assignments.filter((a) => a.status === "pending").length;

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Assignments
              {pendingCount > 0 && (
                <span className="badge bg-warning text-dark fw-medium border py-1 px-2 border-warning fs-13 ms-2">
                  {pendingCount} pending
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Manage all assignments and approve pending submissions</p>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1" onClick={loadAssignments} disabled={loadingAssignments}>
              <i className="ti ti-refresh" />
              Refresh
            </button>
            {canApprove && (
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-1" onClick={() => setShowCreate(true)}>
                <i className="ti ti-plus" />
                Create Assignment
              </button>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        {(() => {
          const total    = assignments.length;
          const active   = assignments.filter((a) => a.status === "active").length;
          const pending  = assignments.filter((a) => a.status === "pending").length;
          const rejected = assignments.filter((a) => a.status === "rejected").length;
          const withFile = assignments.filter((a) => a.fileUrl).length;
          const cards: StatCardItem[] = [
            {
              label: "Total Assignments",
              value: total,
              icon: "ti-clipboard-list",
              hex: "#2E37A4",
              spark: [18, 28, 22, 35, 25, 42, 38, 50, 44, 58],
            },
            {
              label: "Active",
              value: active,
              icon: "ti-circle-check",
              hex: "#27AE60",
              spark: [30, 42, 35, 50, 40, 60, 52, 68, 58, 75],
            },
            {
              label: "Pending Approval",
              value: pending,
              icon: "ti-hourglass",
              hex: pending > 0 ? "#F2994A" : "#858D9C",
              spark: [45, 32, 40, 28, 38, 22, 30, 18, 25, 15],
            },
            {
              label: "Rejected",
              value: rejected,
              icon: "ti-circle-x",
              hex: rejected > 0 ? "#EB5757" : "#858D9C",
              spark: [40, 30, 35, 22, 28, 18, 24, 14, 20, 12],
            },
            {
              label: "With Attachment",
              value: withFile,
              icon: "ti-paperclip",
              hex: "#2F80ED",
              spark: [20, 35, 28, 45, 32, 50, 40, 58, 48, 65],
            },
          ];
          return <StatsCards cards={cards} loading={loadingAssignments} />;
        })()}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
              <i className="ti ti-clipboard-list me-1" />
              All Assignments
              {!loadingAssignments && <span className="badge badge-soft-primary ms-2">{assignments.length}</span>}
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === "pending" ? "active" : ""}`} onClick={() => setActiveTab("pending")}>
              <i className="ti ti-hourglass me-1" />
              Pending Approval
              {pendingCount > 0 && <span className="badge bg-warning text-dark ms-2">{pendingCount}</span>}
            </button>
          </li>
        </ul>


        {loadingAssignments ? (
          <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status" /></div>
        ) : displayed.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-clipboard-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">{activeTab === "pending" ? "No Pending Assignments" : "No Assignments Yet"}</h5>
              <p className="text-muted mb-0">{activeTab === "pending" ? "All assignments are approved." : "Create an assignment to get started."}</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-stack mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ fontSize: 13 }}>#</th>
                      <th style={{ fontSize: 13 }}>Title</th>
                      <th style={{ fontSize: 13 }}>Teacher</th>
                      <th style={{ fontSize: 13 }}>Course</th>
                      <th style={{ fontSize: 13 }}>Status</th>
                      <th style={{ fontSize: 13 }}>Due Date</th>
                      <th style={{ fontSize: 13 }}>File</th>
                      <th style={{ fontSize: 13, width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((a, idx) => (
                      <tr key={a.id}>
                        <td data-label="#" className="text-muted" style={{ fontSize: 13 }}>{idx + 1}</td>
                        <td data-label="Title">
                          <div className="fw-medium" style={{ fontSize: 13 }}>{a.title}</div>
                          {a.description && (
                            <div className="text-muted" style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {a.description}
                            </div>
                          )}
                        </td>
                        <td data-label="Teacher" className="text-muted" style={{ fontSize: 13 }}>
                          {a.Teacher ? `${a.Teacher.firstName} ${a.Teacher.lastName}` : `#${a.teacherId}`}
                        </td>
                        <td data-label="Course">
                          <span className="badge badge-soft-info border border-info">
                            {a.CourseDetails?.Courses?.courseName ?? "—"}
                          </span>
                        </td>
                        <td data-label="Status"><StatusBadge status={a.status} /></td>
                        <td data-label="Due Date" className="text-muted" style={{ fontSize: 13 }}>{formatDate(a.dueDate)}</td>
                        <td data-label="File">
                          {a.fileUrl ? (
                            <a href={`${media_base_url}${a.fileUrl}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-icon btn-sm" title="Download">
                              <i className="ti ti-download" />
                            </a>
                          ) : <span className="text-muted" style={{ fontSize: 12 }}>—</span>}
                        </td>
                        <td data-label="Actions">
                          <div className="d-flex gap-1 flex-wrap">
                            {canApprove && a.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm d-inline-flex align-items-center gap-1"
                                  disabled={approvingId === a.id}
                                  onClick={() => handleApprove(a.id)}
                                >
                                  {approvingId === a.id ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-check" />}
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                                  disabled={rejectingId === a.id}
                                  onClick={() => handleReject(a.id)}
                                >
                                  {rejectingId === a.id ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-x" />}
                                  Reject
                                </button>
                              </>
                            )}
                            {canApprove && a.status === "rejected" && (
                              <button
                                type="button"
                                className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1"
                                disabled={approvingId === a.id}
                                onClick={() => handleApprove(a.id)}
                              >
                                {approvingId === a.id ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-check" />}
                                Approve
                              </button>
                            )}
                            {canApprove && (
                              <button type="button" className="btn btn-outline-danger btn-icon btn-sm" title="Delete" onClick={() => setDeleteTarget(a)}>
                                <i className="ti ti-trash" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Assignment Modal ── */}
      {showCreate && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title fw-bold text-dark">Create Assignment</h4>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} disabled={createLoading}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Teacher <span className="text-danger">*</span></label>
                      <select className="form-select" value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} disabled={createLoading || teachersLoading}>
                        <option value="">Select teacher...</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={String(t.id)}>{t.firstName} {t.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Course <span className="text-danger">*</span></label>
                      <select className="form-select" value={createCourseId} onChange={(e) => setCreateCourseId(e.target.value)} disabled={createLoading || !selectedTeacherId || coursesLoading}>
                        <option value="">{coursesLoading ? "Loading courses..." : "Select course..."}</option>
                        {teacherCourses.map((c) => (
                          <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Title <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" placeholder="e.g. Chapter 3 Homework" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} disabled={createLoading} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Description</label>
                      <textarea className="form-control" rows={3} placeholder="Instructions for the assignment..." value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} disabled={createLoading} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Due Date</label>
                      <DatePicker
                        style={{ width: "100%" }}
                        value={createDueDate ? dayjs(createDueDate) : null}
                        onChange={(_, ds) => setCreateDueDate(ds as string)}
                        format="YYYY-MM-DD"
                        placeholder="Select due date"
                        disabled={createLoading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Max Score</label>
                      <input type="number" className="form-control" placeholder="e.g. 100" min={0} value={createMaxScore} onChange={(e) => setCreateMaxScore(e.target.value)} disabled={createLoading} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Attachment <span className="text-muted fw-normal">(optional)</span></label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="form-control"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                        onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
                        disabled={createLoading}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} disabled={createLoading}>Cancel</button>
                  <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleCreate} disabled={createLoading}>
                    {createLoading && <span className="spinner-border spinner-border-sm" role="status" />}
                    <i className="ti ti-plus" />
                    Create Assignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete Assignment?"
        icon={<i className="ti ti-alert-triangle" />}
        description={
          deleteTarget ? (
            <>Delete <strong>{deleteTarget.title}</strong>? This will also remove all student submissions.</>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleteLoading) setDeleteTarget(null); }}
      />
    </div>
  );
};

export default AdminAssignmentList;
