"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchStudentAssignments } from "@/services/assignmentService";
import { useNotification } from "@/hooks/useNotification";
import { SubmittedAssignment } from "@/types/assignment";

interface CourseGrade {
  courseId: string;
  courseName: string;
  totalAssignments: number;
  gradedAssignments: number;
  totalEarned: number;
  totalPossible: number;
  percentage: number | null;
}

const getGradeLetter = (pct: number): { letter: string; colorClass: string } => {
  if (pct >= 90) return { letter: "A", colorClass: "text-success" };
  if (pct >= 80) return { letter: "B", colorClass: "text-primary" };
  if (pct >= 70) return { letter: "C", colorClass: "text-warning" };
  if (pct >= 60) return { letter: "D", colorClass: "text-orange" };
  return { letter: "F", colorClass: "text-danger" };
};

const getProgressClass = (pct: number): string => {
  if (pct >= 80) return "bg-success";
  if (pct >= 70) return "bg-primary";
  if (pct >= 60) return "bg-warning";
  return "bg-danger";
};

const buildCourseGrades = (assignments: SubmittedAssignment[]): CourseGrade[] => {
  const map = new Map<string, CourseGrade>();

  for (const item of assignments) {
    const a = item.Assignment;
    const courseId = String(a?.CourseDetails?.Courses?.id ?? a?.courseDetailsId ?? "unknown");
    const courseName = a?.CourseDetails?.Courses?.courseName ?? `Course #${courseId}`;

    if (!map.has(courseId)) {
      map.set(courseId, {
        courseId,
        courseName,
        totalAssignments: 0,
        gradedAssignments: 0,
        totalEarned: 0,
        totalPossible: 0,
        percentage: null,
      });
    }

    const entry = map.get(courseId)!;
    entry.totalAssignments += 1;

    if (item.status === "Graded" && item.score != null && a?.maxScore != null) {
      entry.gradedAssignments += 1;
      entry.totalEarned += item.score;
      entry.totalPossible += a.maxScore;
    }
  }

  return Array.from(map.values()).map((g) => ({
    ...g,
    percentage:
      g.totalPossible > 0 ? Math.round((g.totalEarned / g.totalPossible) * 100) : null,
  }));
};

const StudentGradeList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const notify = useNotification();
  const [assignments, setAssignments] = useState<SubmittedAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchStudentAssignments(String(user.id))
      .then((res) => setAssignments(res.assignments))
      .catch((err) => notify.error(err.message ?? "Failed to load grades"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const courseGrades = buildCourseGrades(assignments);
  const gradedItems = assignments.filter((a) => a.status === "Graded" && a.score != null);
  const overallEarned = gradedItems.reduce((sum, a) => sum + (a.score ?? 0), 0);
  const overallPossible = gradedItems.reduce(
    (sum, a) => sum + (a.Assignment?.maxScore ?? 0),
    0
  );
  const overallPct =
    overallPossible > 0 ? Math.round((overallEarned / overallPossible) * 100) : null;

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">My Grades</h4>
            <p className="text-muted mb-0 mt-1">Assignment performance summary by course</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={loadData}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

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
              <i className="ti ti-chart-bar-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Grade Data Yet</h5>
              <p className="text-muted mb-0">
                Grades will appear here once your teacher assigns and grades your work.
              </p>
            </div>
          </div>
        )}

        {!loading && assignments.length > 0 && (
          <>
            {/* Overall summary card */}
            <div className="card mb-4 border-primary border-opacity-25">
              <div className="card-body">
                <div className="row align-items-center">
                  <div className="col-md-8">
                    <h6 className="fw-bold mb-1">Overall Performance</h6>
                    <p className="text-muted mb-2" style={{ fontSize: 13 }}>
                      Based on {gradedItems.length} graded assignment{gradedItems.length !== 1 ? "s" : ""} across {courseGrades.length} course{courseGrades.length !== 1 ? "s" : ""}
                    </p>
                    {overallPct !== null && (
                      <div>
                        <div className="progress mb-1" style={{ height: 8 }}>
                          <div
                            className={`progress-bar ${getProgressClass(overallPct)}`}
                            style={{ width: `${overallPct}%` }}
                          />
                        </div>
                        <small className="text-muted">
                          {overallEarned} / {overallPossible} points
                        </small>
                      </div>
                    )}
                  </div>
                  <div className="col-md-4 text-center">
                    {overallPct !== null ? (
                      <div>
                        <div
                          className={`fw-bold ${getGradeLetter(overallPct).colorClass}`}
                          style={{ fontSize: 48, lineHeight: 1 }}
                        >
                          {getGradeLetter(overallPct).letter}
                        </div>
                        <div className="text-muted mt-1">{overallPct}%</div>
                      </div>
                    ) : (
                      <div className="text-muted">
                        <i className="ti ti-clock fs-48 d-block mb-1" />
                        <small>Awaiting grades</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Per-course grade cards */}
            <div className="row g-3">
              {courseGrades.map((cg) => {
                const grade = cg.percentage != null ? getGradeLetter(cg.percentage) : null;
                return (
                  <div key={cg.courseId} className="col-lg-6">
                    <div className="card h-100">
                      <div className="card-body">
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                          <div>
                            <h6 className="fw-bold mb-1">{cg.courseName}</h6>
                            <span className="text-muted" style={{ fontSize: 13 }}>
                              {cg.gradedAssignments} / {cg.totalAssignments} assignments graded
                            </span>
                          </div>
                          {grade ? (
                            <div className="text-center">
                              <span
                                className={`fw-bold ${grade.colorClass}`}
                                style={{ fontSize: 32, lineHeight: 1 }}
                              >
                                {grade.letter}
                              </span>
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                {cg.percentage}%
                              </div>
                            </div>
                          ) : (
                            <span className="badge badge-soft-secondary border border-secondary">
                              Pending
                            </span>
                          )}
                        </div>

                        {cg.percentage !== null && (
                          <>
                            <div className="progress mb-2" style={{ height: 6 }}>
                              <div
                                className={`progress-bar ${getProgressClass(cg.percentage)}`}
                                style={{ width: `${cg.percentage}%` }}
                              />
                            </div>
                            <small className="text-muted">
                              {cg.totalEarned} / {cg.totalPossible} points earned
                            </small>
                          </>
                        )}

                        {cg.percentage === null && cg.totalAssignments > 0 && (
                          <div className="text-muted" style={{ fontSize: 13 }}>
                            <i className="ti ti-clock me-1" />
                            {cg.totalAssignments} assignment{cg.totalAssignments !== 1 ? "s" : ""} awaiting grades
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed breakdown */}
            <div className="card mt-4">
              <div className="card-header">
                <h6 className="fw-bold mb-0">
                  <i className="ti ti-list-details me-2 text-primary" />
                  Assignment Breakdown
                </h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover table-stack mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ fontSize: 13 }}>#</th>
                        <th style={{ fontSize: 13 }}>Assignment</th>
                        <th style={{ fontSize: 13 }}>Course</th>
                        <th style={{ fontSize: 13 }}>Status</th>
                        <th style={{ fontSize: 13 }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((item, idx) => {
                        const a = item.Assignment;
                        return (
                          <tr key={item.id}>
                            <td data-label="#" className="text-muted" style={{ fontSize: 13 }}>{idx + 1}</td>
                            <td data-label="Assignment" className="fw-medium" style={{ fontSize: 13 }}>
                              {a?.title ?? `Assignment #${item.assignmentId}`}
                            </td>
                            <td data-label="Course" className="text-muted" style={{ fontSize: 13 }}>
                              {a?.CourseDetails?.Courses?.courseName ?? "—"}
                            </td>
                            <td data-label="Status">
                              {item.status === "Graded" ? (
                                <span className="badge badge-soft-success border border-success">Graded</span>
                              ) : item.status === "Submitted" ? (
                                <span className="badge badge-soft-info border border-info">Submitted</span>
                              ) : (
                                <span className="badge badge-soft-secondary border border-secondary">Not Started</span>
                              )}
                            </td>
                            <td data-label="Score" className="fw-medium" style={{ fontSize: 13 }}>
                              {item.status === "Graded" && item.score != null
                                ? `${item.score} / ${a?.maxScore ?? "—"}`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentGradeList;
