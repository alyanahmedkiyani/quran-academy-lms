"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchStudentAssignments } from "@/services/assignmentService";
import { useNotification } from "@/hooks/useNotification";
import { SubmittedAssignment, AssignmentStatus } from "@/types/assignment";
import { media_base_url } from "@/environment";
import SubmitAssignmentModal from "./SubmitAssignmentModal";

const statusConfig: Record<
  AssignmentStatus,
  { badgeClass: string; icon: string; label: string }
> = {
  "Not Started": {
    badgeClass: "badge-soft-secondary border border-secondary",
    icon: "ti ti-clock",
    label: "Not Started",
  },
  Submitted: {
    badgeClass: "badge-soft-info border border-info",
    icon: "ti ti-upload",
    label: "Submitted",
  },
  Graded: {
    badgeClass: "badge-soft-success border border-success",
    icon: "ti ti-circle-check",
    label: "Graded",
  },
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isPastDue = (dueDate?: string | null) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

const StudentAssignmentList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const notify = useNotification();
  const [assignments, setAssignments] = useState<SubmittedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<SubmittedAssignment | null>(null);

  const reload = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchStudentAssignments(String(user.id))
      .then((res) => setAssignments(res.assignments))
      .catch((err) => notify.error(err.message ?? "Failed to load assignments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const notStarted = assignments.filter((a) => a.status === "Not Started").length;
  const submitted = assignments.filter((a) => a.status === "Submitted").length;
  const graded = assignments.filter((a) => a.status === "Graded").length;

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              My Assignments
              {!loading && (
                <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                  {assignments.length} total
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Track and submit your course assignments</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={reload}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        {!loading && assignments.length > 0 && (
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 bg-light">
                <div className="card-body d-flex align-items-center gap-3 py-3">
                  <div className="d-flex align-items-center justify-content-center bg-secondary text-white rounded" style={{ width: 40, height: 40 }}>
                    <i className="ti ti-clock" />
                  </div>
                  <div>
                    <div className="fw-bold fs-5">{notStarted}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>Not Started</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 bg-light">
                <div className="card-body d-flex align-items-center gap-3 py-3">
                  <div className="d-flex align-items-center justify-content-center bg-info text-white rounded" style={{ width: 40, height: 40 }}>
                    <i className="ti ti-upload" />
                  </div>
                  <div>
                    <div className="fw-bold fs-5">{submitted}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>Submitted</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 bg-light">
                <div className="card-body d-flex align-items-center gap-3 py-3">
                  <div className="d-flex align-items-center justify-content-center bg-success text-white rounded" style={{ width: 40, height: 40 }}>
                    <i className="ti ti-circle-check" />
                  </div>
                  <div>
                    <div className="fw-bold fs-5">{graded}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>Graded</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && assignments.length === 0 && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-clipboard-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Assignments Yet</h5>
              <p className="text-muted mb-0">
                You don&apos;t have any assignments assigned. Check back after your teacher creates one.
              </p>
            </div>
          </div>
        )}

        {/* Submit Assignment Modal */}
        {submitting && (
          <SubmitAssignmentModal
            submittedAssignmentId={submitting.id}
            assignmentTitle={submitting.Assignment?.title ?? `Assignment #${submitting.assignmentId}`}
            onClose={() => setSubmitting(null)}
            onSubmitted={reload}
          />
        )}

        {/* Assignment cards */}
        {!loading && assignments.length > 0 && (
          <div className="row g-3">
            {assignments.map((item) => {
              const a = item.Assignment;
              const status = item.status;
              const cfg = statusConfig[status] ?? statusConfig["Not Started"];
              const courseName = a?.CourseDetails?.Courses?.courseName ?? "—";
              const teacherName = a?.Teacher
                ? `${a.Teacher.firstName} ${a.Teacher.lastName}`
                : "—";
              const teacherImg = a?.Teacher?.imageUrl
                ? `${media_base_url}/${a.Teacher.imageUrl}`
                : null;
              const overdue = status === "Not Started" && isPastDue(a?.dueDate);

              return (
                <div key={item.id} className="col-lg-6">
                  <div className={`card h-100 ${overdue ? "border-danger border-opacity-50" : ""}`}>
                    <div className="card-body">
                      {/* Top row: title + status */}
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <h6 className="fw-bold mb-0 flex-grow-1">
                          {a?.title ?? `Assignment #${item.assignmentId}`}
                        </h6>
                        <span className={`badge ${cfg.badgeClass} text-nowrap`}>
                          <i className={`${cfg.icon} me-1`} />
                          {cfg.label}
                        </span>
                      </div>

                      {/* Course */}
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className="ti ti-book text-primary" style={{ fontSize: 14 }} />
                        <span className="text-muted" style={{ fontSize: 13 }}>{courseName}</span>
                      </div>

                      {/* Teacher */}
                      <div className="d-flex align-items-center gap-2 mb-2">
                        {teacherImg ? (
                          <img
                            src={teacherImg}
                            alt={teacherName}
                            style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <i className="ti ti-user text-muted" style={{ fontSize: 14 }} />
                        )}
                        <span className="text-muted" style={{ fontSize: 13 }}>{teacherName}</span>
                      </div>

                      <hr className="my-2" />

                      <div className="row g-2">
                        {/* Due date */}
                        <div className="col-6">
                          <div style={{ fontSize: 12 }} className="text-muted">Due Date</div>
                          <div
                            className={`fw-medium ${overdue ? "text-danger" : ""}`}
                            style={{ fontSize: 13 }}
                          >
                            {overdue && <i className="ti ti-alert-triangle me-1 text-danger" />}
                            {formatDate(a?.dueDate)}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="col-6">
                          <div style={{ fontSize: 12 }} className="text-muted">Score</div>
                          <div className="fw-medium" style={{ fontSize: 13 }}>
                            {status === "Graded" && item.score != null
                              ? `${item.score} / ${a?.maxScore ?? "—"}`
                              : a?.maxScore != null
                              ? `— / ${a.maxScore}`
                              : "—"}
                          </div>
                        </div>

                        {/* Submission date (if submitted/graded) */}
                        {item.submissionDate && (
                          <div className="col-12">
                            <div style={{ fontSize: 12 }} className="text-muted">Submitted On</div>
                            <div className="fw-medium" style={{ fontSize: 13 }}>
                              {formatDate(item.submissionDate)}
                            </div>
                          </div>
                        )}

                        {/* Feedback */}
                        {status === "Graded" && item.feedback && (
                          <div className="col-12">
                            <div style={{ fontSize: 12 }} className="text-muted">Feedback</div>
                            <div
                              className="text-muted"
                              style={{ fontSize: 13, fontStyle: "italic" }}
                            >
                              &ldquo;{item.feedback}&rdquo;
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Assignment file download + Submit button */}
                      <div className="mt-3 d-flex flex-wrap gap-2">
                        {a?.fileUrl && (
                          <a
                            href={`${media_base_url}${a.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                          >
                            <i className="ti ti-download" />
                            Download Assignment
                          </a>
                        )}
                        {status === "Not Started" && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                            onClick={() => setSubmitting(item)}
                          >
                            <i className="ti ti-upload" />
                            Submit Work
                          </button>
                        )}
                        {status === "Submitted" && (
                          <button
                            type="button"
                            className="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-1"
                            onClick={() => setSubmitting(item)}
                          >
                            <i className="ti ti-refresh" />
                            Re-submit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAssignmentList;
