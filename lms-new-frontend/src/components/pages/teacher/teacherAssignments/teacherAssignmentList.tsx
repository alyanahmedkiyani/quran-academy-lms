"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppSelector } from "@/core/redux/hooks";
import { useTeacherCourses } from "@/hooks/useTeacherCourses";
import { useNotification } from "@/hooks/useNotification";
import {
  fetchTeacherAssignments,
  fetchTeacherSubmissions,
  createAssignment,
  updateAssignment,
  gradeAssignment,
  deleteAssignment,
} from "@/services/assignmentService";
import { Assignment, SubmittedAssignment } from "@/types/assignment";
import { media_base_url } from "@/environment";
import ConfirmationModal from "@/core/common/modals/confirmationModal";

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

interface CourseOption { courseId: string; courseName: string; }

const TeacherAssignmentList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { teacherAssignments, loading: coursesLoading, loadCourses } = useTeacherCourses();
  const notify = useNotification();

  const [activeTab, setActiveTab] = useState<"assignments" | "submissions">("assignments");

  // Assignments list
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  // Submissions list
  const [submissions, setSubmissions] = useState<SubmittedAssignment[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);

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

  // Grade modal
  const [gradeTarget, setGradeTarget] = useState<SubmittedAssignment | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradeLoading, setGradeLoading] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editMaxScore, setEditMaxScore] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Unique courses from teacher's courseDetails
  const teacherCourses: CourseOption[] = Array.from(
    new Map(
      teacherAssignments
        .filter((a) => a.Course)
        .map((a) => [String(a.courseId), { courseId: String(a.courseId), courseName: a.Course!.courseName }])
    ).values()
  );

  const loadAssignments = () => {
    if (!user?.id) return;
    setAssignmentsLoading(true);
    fetchTeacherAssignments(String(user.id))
      .then((res) => setAssignments(res.assignments))
      .catch((err) => notify.error(err.message ?? "Failed to load assignments"))
      .finally(() => setAssignmentsLoading(false));
  };

  const loadSubmissions = () => {
    if (!user?.id) return;
    setSubmissionsLoading(true);
    fetchTeacherSubmissions(String(user.id))
      .then((res) => {
        setSubmissions(res.assignments);
        setSubmissionsLoaded(true);
      })
      .catch((err) => notify.error(err.message ?? "Failed to load submissions"))
      .finally(() => setSubmissionsLoading(false));
  };

  useEffect(() => {
    if (user?.id) {
      loadCourses(String(user.id));
      loadAssignments();
      loadSubmissions(); // load upfront for summary cards
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load submissions on first tab switch (if not already loaded)
  useEffect(() => {
    if (activeTab === "submissions" && !submissionsLoaded) {
      loadSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const resetCreateForm = () => {
    setCreateCourseId("");
    setCreateTitle("");
    setCreateDesc("");
    setCreateDueDate("");
    setCreateMaxScore("");
    setCreateFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!createCourseId) { notify.error("Please select a course."); return; }
    if (!createTitle.trim()) { notify.error("Please enter a title."); return; }
    if (!user?.id) return;

    const fd = new FormData();
    fd.append("courseId", createCourseId);
    fd.append("teacherId", String(user.id));
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

  const openGradeModal = (sub: SubmittedAssignment) => {
    setGradeTarget(sub);
    setGradeScore(sub.score != null ? String(sub.score) : "");
    setGradeFeedback(sub.feedback ?? "");
  };

  const handleGrade = async () => {
    if (!gradeTarget) return;
    const scoreNum = Number(gradeScore);
    if (gradeScore === "" || isNaN(scoreNum) || scoreNum < 0) {
      notify.error("Please enter a valid score (0 or above).");
      return;
    }
    setGradeLoading(true);
    try {
      await gradeAssignment({
        submittedAssignmentId: gradeTarget.id,
        score: scoreNum,
        feedback: gradeFeedback.trim() || undefined,
      });
      notify.success("Assignment graded successfully");
      setGradeTarget(null);
      loadSubmissions();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to grade assignment");
    } finally {
      setGradeLoading(false);
    }
  };

  const openEditModal = (a: Assignment) => {
    setEditTarget(a);
    setEditTitle(a.title);
    setEditDesc(a.description ?? "");
    setEditDueDate(a.dueDate ? a.dueDate.split("T")[0] : "");
    setEditMaxScore(a.maxScore != null ? String(a.maxScore) : "");
    setEditFile(null);
    if (editFileRef.current) editFileRef.current.value = "";
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editTitle.trim()) { notify.error("Please enter a title."); return; }
    const fd = new FormData();
    fd.append("title", editTitle.trim());
    if (editDesc.trim()) fd.append("description", editDesc.trim());
    if (editDueDate) fd.append("dueDate", editDueDate);
    if (editMaxScore) fd.append("maxScore", editMaxScore);
    if (editFile) fd.append("file", editFile);
    setEditLoading(true);
    try {
      await updateAssignment(editTarget.id, fd);
      notify.success("Assignment updated successfully");
      setEditTarget(null);
      loadAssignments();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to update assignment");
    } finally {
      setEditLoading(false);
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

  const pendingSubmissions = submissions.filter((s) => s.status === "Submitted");
  const gradedSubmissions = submissions.filter((s) => s.status === "Graded");

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">Assignments</h4>
            <p className="text-muted mb-0 mt-1">Create assignments and grade student submissions</p>
          </div>
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-1"
            onClick={() => setShowCreate(true)}
            disabled={coursesLoading || teacherCourses.length === 0}
          >
            <i className="ti ti-plus" />
            Create Assignment
          </button>
        </div>

        {/* Summary Cards */}
        {(assignments.length > 0 || submissions.length > 0) && (
          <div className="row g-3 mb-4">
            {([
              { label: "Total Assignments", value: assignments.length,                                                   icon: "ti-list",         color: "info"      },
              { label: "Active",            value: assignments.filter((a) => !a.status || a.status === "active").length, icon: "ti-circle-check", color: "success"   },
              { label: "Pending Approval",  value: assignments.filter((a) => a.status === "pending").length,             icon: "ti-clock",        color: "warning"   },
              { label: "To Grade",          value: submissions.filter((s) => s.status === "Submitted").length,           icon: "ti-pencil",       color: "primary"   },
              { label: "Graded",            value: submissions.filter((s) => s.status === "Graded").length,              icon: "ti-award",        color: "success"   },
            ] as {label:string;value:number;icon:string;color:string}[]).map(({ label, value, icon, color }) => (
              <div key={label} className="col-xl-2 col-md-4 col-sm-6">
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
        )}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "assignments" ? "active" : ""}`}
              onClick={() => setActiveTab("assignments")}
            >
              <i className="ti ti-clipboard-list me-1" />
              My Assignments
              {!assignmentsLoading && (
                <span className="badge badge-soft-primary ms-2">{assignments.length}</span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "submissions" ? "active" : ""}`}
              onClick={() => setActiveTab("submissions")}
            >
              <i className="ti ti-file-check me-1" />
              Grade Submissions
              {submissionsLoaded && pendingSubmissions.length > 0 && (
                <span className="badge bg-warning text-dark ms-2">{pendingSubmissions.length}</span>
              )}
            </button>
          </li>
        </ul>

        {/* ── TAB 1: My Assignments ── */}
        {activeTab === "assignments" && (
          <>
            {assignmentsLoading ? (
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-clipboard-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Assignments Yet</h5>
                  <p className="text-muted mb-2">
                    Click &ldquo;Create Assignment&rdquo; to create your first assignment for all enrolled students in a course.
                  </p>
                  {teacherCourses.length === 0 && !coursesLoading && (
                    <p className="text-warning small mb-0">
                      <i className="ti ti-alert-triangle me-1" />
                      You have no courses assigned yet. Ask your admin to assign you to a course first.
                    </p>
                  )}
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
                          <th style={{ fontSize: 13 }}>Course</th>
                          <th style={{ fontSize: 13 }}>Status</th>
                          <th style={{ fontSize: 13 }}>Due Date</th>
                          <th style={{ fontSize: 13 }}>Max Score</th>
                          <th style={{ fontSize: 13 }}>File</th>
                          <th style={{ fontSize: 13, width: 110 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((a, idx) => (
                          <tr key={a.id}>
                            <td data-label="#" className="text-muted" style={{ fontSize: 13 }}>{idx + 1}</td>
                            <td data-label="Title">
                              <div className="fw-medium" style={{ fontSize: 13 }}>{a.title}</div>
                              {a.description && (
                                <div className="text-muted" style={{ fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {a.description}
                                </div>
                              )}
                            </td>
                            <td data-label="Course">
                              <span className="badge badge-soft-info border border-info">
                                {a.CourseDetails?.Courses?.courseName ?? "—"}
                              </span>
                            </td>
                            <td data-label="Status">
                              {a.status === "pending" && <span className="badge bg-warning text-dark">Pending Approval</span>}
                              {a.status === "rejected" && <span className="badge bg-danger">Rejected</span>}
                              {(!a.status || a.status === "active") && <span className="badge bg-success">Active</span>}
                            </td>
                            <td data-label="Due Date" className="text-muted" style={{ fontSize: 13 }}>{formatDate(a.dueDate)}</td>
                            <td data-label="Max Score" className="text-muted" style={{ fontSize: 13 }}>{a.maxScore ?? "—"}</td>
                            <td data-label="File">
                              {a.fileUrl ? (
                                <a href={`${media_base_url}${a.fileUrl}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-icon btn-sm" title="Download">
                                  <i className="ti ti-download" />
                                </a>
                              ) : <span className="text-muted" style={{ fontSize: 12 }}>—</span>}
                            </td>
                            <td data-label="Actions">
                              <div className="d-flex gap-1">
                                <button type="button" className="btn btn-outline-primary btn-icon btn-sm" onClick={() => openEditModal(a)} title="Edit">
                                  <i className="ti ti-edit" />
                                </button>
                                <button type="button" className="btn btn-outline-danger btn-icon btn-sm" onClick={() => setDeleteTarget(a)} title="Delete">
                                  <i className="ti ti-trash" />
                                </button>
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
          </>
        )}

        {/* ── TAB 2: Grade Submissions ── */}
        {activeTab === "submissions" && (
          <>
            <div className="d-flex justify-content-end mb-3">
              <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1" onClick={loadSubmissions} disabled={submissionsLoading}>
                <i className="ti ti-refresh" />
                Refresh
              </button>
            </div>

            {submissionsLoading ? (
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-file-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Submissions Yet</h5>
                  <p className="text-muted mb-0">Student submissions will appear here once they submit their work.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Pending grading */}
                {pendingSubmissions.length > 0 && (
                  <div className="card mb-4">
                    <div className="card-header d-flex align-items-center gap-2">
                      <h6 className="fw-bold mb-0">
                        <i className="ti ti-hourglass me-2 text-warning" />
                        Pending Review
                        <span className="badge bg-warning text-dark ms-2">{pendingSubmissions.length}</span>
                      </h6>
                    </div>
                    <div className="card-body p-0">
                      <SubmissionsTable submissions={pendingSubmissions} onGrade={openGradeModal} />
                    </div>
                  </div>
                )}

                {/* Already graded */}
                {gradedSubmissions.length > 0 && (
                  <div className="card">
                    <div className="card-header">
                      <h6 className="fw-bold mb-0">
                        <i className="ti ti-circle-check me-2 text-success" />
                        Graded
                        <span className="badge badge-soft-success ms-2">{gradedSubmissions.length}</span>
                      </h6>
                    </div>
                    <div className="card-body p-0">
                      <SubmissionsTable submissions={gradedSubmissions} onGrade={openGradeModal} showScore />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
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
                    {/* Course */}
                    <div className="col-12">
                      <label className="form-label fw-medium">Course <span className="text-danger">*</span></label>
                      <select className="form-select" value={createCourseId} onChange={(e) => setCreateCourseId(e.target.value)} disabled={createLoading}>
                        <option value="">Select a course...</option>
                        {teacherCourses.map((c) => (
                          <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
                        ))}
                      </select>
                      <div className="form-text">Assignment will be assigned to all students enrolled in this course.</div>
                    </div>

                    {/* Title */}
                    <div className="col-12">
                      <label className="form-label fw-medium">Title <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" placeholder="e.g. Chapter 3 Homework" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} disabled={createLoading} />
                    </div>

                    {/* Description */}
                    <div className="col-12">
                      <label className="form-label fw-medium">Description</label>
                      <textarea className="form-control" rows={3} placeholder="Instructions for the assignment..." value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} disabled={createLoading} />
                    </div>

                    {/* Due date + Max score */}
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

                    {/* File upload */}
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
                      {createFile && (
                        <div className="form-text">
                          <i className="ti ti-paperclip me-1" />
                          {createFile.name}
                          <button type="button" className="btn btn-link btn-sm py-0 ms-2 text-danger" onClick={() => { setCreateFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} disabled={createLoading}>
                    Cancel
                  </button>
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

      {/* ── Grade Modal ── */}
      {gradeTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!gradeLoading) setGradeTarget(null); }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title fw-bold text-dark">Grade Submission</h4>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { if (!gradeLoading) setGradeTarget(null); }} disabled={gradeLoading}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3 p-3 bg-light rounded">
                    <div className="fw-medium">{gradeTarget.Assignment?.title ?? "Assignment"}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      Student: {gradeTarget.Student ? `${gradeTarget.Student.firstName} ${gradeTarget.Student.lastName}` : `#${gradeTarget.studentId}`}
                    </div>
                    {gradeTarget.fileUrl && (
                      <a href={`${media_base_url}${gradeTarget.fileUrl}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm mt-2 d-inline-flex align-items-center gap-1">
                        <i className="ti ti-download" />
                        View Submission
                      </a>
                    )}
                  </div>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-medium">
                        Score <span className="text-danger">*</span>
                        {gradeTarget.Assignment?.maxScore != null && (
                          <span className="text-muted fw-normal ms-1">/ {gradeTarget.Assignment.maxScore}</span>
                        )}
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        min={0}
                        max={gradeTarget.Assignment?.maxScore ?? undefined}
                        value={gradeScore}
                        onChange={(e) => setGradeScore(e.target.value)}
                        disabled={gradeLoading}
                        placeholder="Enter score"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Feedback <span className="text-muted fw-normal">(optional)</span></label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Write feedback for the student..."
                        value={gradeFeedback}
                        onChange={(e) => setGradeFeedback(e.target.value)}
                        disabled={gradeLoading}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { if (!gradeLoading) setGradeTarget(null); }} disabled={gradeLoading}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-success d-inline-flex align-items-center gap-2" onClick={handleGrade} disabled={gradeLoading}>
                    {gradeLoading && <span className="spinner-border spinner-border-sm" role="status" />}
                    <i className="ti ti-circle-check" />
                    Submit Grade
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Assignment Modal ── */}
      {editTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!editLoading) setEditTarget(null); }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title fw-bold text-dark">
                    Edit Assignment
                    {editTarget.status === "rejected" && (
                      <span className="badge bg-danger ms-2" style={{ fontSize: 12 }}>Rejected — editing will resubmit for approval</span>
                    )}
                  </h4>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { if (!editLoading) setEditTarget(null); }} disabled={editLoading}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-medium">Title <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={editLoading} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Description</label>
                      <textarea className="form-control" rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} disabled={editLoading} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Due Date</label>
                      <DatePicker
                        style={{ width: "100%" }}
                        value={editDueDate ? dayjs(editDueDate) : null}
                        onChange={(_, ds) => setEditDueDate(ds as string)}
                        format="YYYY-MM-DD"
                        placeholder="Select due date"
                        disabled={editLoading}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Max Score</label>
                      <input type="number" className="form-control" min={0} value={editMaxScore} onChange={(e) => setEditMaxScore(e.target.value)} disabled={editLoading} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Replace Attachment <span className="text-muted fw-normal">(optional — leave blank to keep existing)</span></label>
                      <input
                        ref={editFileRef}
                        type="file"
                        className="form-control"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                        onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                        disabled={editLoading}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { if (!editLoading) setEditTarget(null); }} disabled={editLoading}>Cancel</button>
                  <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleEdit} disabled={editLoading}>
                    {editLoading && <span className="spinner-border spinner-border-sm" role="status" />}
                    <i className="ti ti-device-floppy" />
                    {editTarget.status === "rejected" ? "Save & Resubmit" : "Save Changes"}
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
            <>Delete <strong>{deleteTarget.title}</strong>? All student submissions linked to this assignment will also be removed.</>
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

// Sub-component for submission rows
const SubmissionsTable = ({
  submissions,
  onGrade,
  showScore,
}: {
  submissions: SubmittedAssignment[];
  onGrade: (sub: SubmittedAssignment) => void;
  showScore?: boolean;
}) => (
  <div className="table-responsive">
    <table className="table table-hover table-stack mb-0">
      <thead className="table-light">
        <tr>
          <th style={{ fontSize: 13 }}>#</th>
          <th style={{ fontSize: 13 }}>Student</th>
          <th style={{ fontSize: 13 }}>Assignment</th>
          <th style={{ fontSize: 13 }}>Submitted</th>
          {showScore && <th style={{ fontSize: 13 }}>Score</th>}
          <th style={{ fontSize: 13 }}>Submission</th>
          <th style={{ fontSize: 13, width: 100 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {submissions.map((sub, idx) => (
          <tr key={sub.id}>
            <td data-label="#" className="text-muted" style={{ fontSize: 13 }}>{idx + 1}</td>
            <td data-label="Student">
              <div className="fw-medium" style={{ fontSize: 13 }}>
                {sub.Student ? `${sub.Student.firstName} ${sub.Student.lastName}` : `Student #${sub.studentId}`}
              </div>
            </td>
            <td data-label="Assignment" className="text-muted" style={{ fontSize: 13 }}>
              {sub.Assignment?.title ?? `Assignment #${sub.assignmentId}`}
            </td>
            <td data-label="Submitted" className="text-muted" style={{ fontSize: 13 }}>
              {sub.submissionDate
                ? new Date(sub.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—"}
            </td>
            {showScore && (
              <td data-label="Score" className="fw-medium" style={{ fontSize: 13 }}>
                {sub.score != null ? `${sub.score} / ${sub.Assignment?.maxScore ?? "—"}` : "—"}
              </td>
            )}
            <td data-label="File">
              {sub.fileUrl ? (
                <a
                  href={`${media_base_url}${sub.fileUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-icon btn-sm"
                  title="View file"
                >
                  <i className="ti ti-eye" />
                </a>
              ) : <span className="text-muted" style={{ fontSize: 12 }}>No file</span>}
            </td>
            <td data-label="Action">
              <button
                type="button"
                className={`btn btn-sm ${sub.status === "Graded" ? "btn-outline-success" : "btn-warning"} d-inline-flex align-items-center gap-1`}
                onClick={() => onGrade(sub)}
              >
                <i className={sub.status === "Graded" ? "ti ti-edit" : "ti ti-star"} />
                {sub.status === "Graded" ? "Re-grade" : "Grade"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default TeacherAssignmentList;
