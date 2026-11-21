"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchAdminFeedbackSummaryThunk } from "@/core/redux/feedbackSlice";
import { FeedbackSummary, TeacherFeedbackSummary, SessionFeedbackItem } from "@/types/feedback";
import { resolveImageUrl } from "@/environment";

// ---------------------------------------------------------------------------
// Star display (read-only)
// ---------------------------------------------------------------------------
function StarDisplay({ value }: { value: number }) {
  return (
    <span style={{ color: "#F59E0B", fontSize: 14 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ opacity: s <= Math.round(value) ? 1 : 0.25 }}>
          ★
        </span>
      ))}
      <span
        className="text-muted ms-1"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        {value?.toFixed(1)}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category bar card
// ---------------------------------------------------------------------------
function CategoryBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const pct = ((value / 5) * 100).toFixed(0);
  const color =
    value >= 4 ? "#22C55E" : value >= 3 ? "#F59E0B" : "#EF4444";
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between mb-1" style={{ fontSize: 13 }}>
        <span>{label}</span>
        <span className="fw-semibold">{value?.toFixed(1)} / 5</span>
      </div>
      <div
        className="rounded-pill"
        style={{ height: 8, background: "#E5E7EB", overflow: "hidden" }}
      >
        <div
          className="rounded-pill"
          style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overall summary card
// ---------------------------------------------------------------------------
function OverallSummaryCard({ summary }: { summary: FeedbackSummary }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
          <i className="ti ti-chart-bar text-primary" />
          Overall Averages
        </h6>
        <CategoryBar label="Teaching Quality" value={summary.teachingQuality} />
        <CategoryBar label="Content Clarity" value={summary.contentClarity} />
        <CategoryBar label="Session Pace" value={summary.sessionPace} />
        <CategoryBar label="Engagement" value={summary.engagement} />
        <div className="border-top mt-3 pt-3">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-semibold">Overall Rating</span>
            <StarDisplay value={summary.overallRating} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teacher summary card
// ---------------------------------------------------------------------------
function TeacherCard({ teacher }: { teacher: TeacherFeedbackSummary }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              background: "#EEF2FF",
              overflow: "hidden",
            }}
          >
            {teacher.imageUrl ? (
              <img
                src={`${resolveImageUrl(teacher.imageUrl)}`}
                alt={teacher.teacherName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <i className="ti ti-user text-primary" style={{ fontSize: 18 }} />
            )}
          </div>
          <div>
            <p className="mb-0 fw-semibold" style={{ fontSize: 14 }}>
              {teacher.teacherName}
            </p>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {teacher.count} response{teacher.count !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="ms-auto">
            <StarDisplay value={teacher.overallRating} />
          </div>
        </div>
        <CategoryBar label="Teaching Quality" value={teacher.teachingQuality} />
        <CategoryBar label="Content Clarity" value={teacher.contentClarity} />
        <CategoryBar label="Session Pace" value={teacher.sessionPace} />
        <CategoryBar label="Engagement" value={teacher.engagement} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent feedback row
// ---------------------------------------------------------------------------
function FeedbackRow({ fb }: { fb: SessionFeedbackItem }) {
  const student = fb.Student;
  const session = fb.ClassSession;
  const date = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : "-";

  return (
    <tr>
      <td data-label="Student">
        {student ? (
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 30, height: 30, background: "#EEF2FF", overflow: "hidden" }}
            >
              {student.profileImg ? (
                <img
                  src={`${resolveImageUrl(student.profileImg)}`}
                  alt={student.firstName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <i className="ti ti-user text-primary" style={{ fontSize: 13 }} />
              )}
            </div>
            <span style={{ fontSize: 13 }}>
              {student.firstName} {student.lastName}
            </span>
          </div>
        ) : (
          <span className="text-muted" style={{ fontSize: 13 }}>—</span>
        )}
      </td>
      <td data-label="Session" style={{ fontSize: 13 }}>{session?.title || "—"}</td>
      <td data-label="Overall">
        <StarDisplay value={fb.overallRating} />
      </td>
      <td data-label="Scores">
        <div className="d-flex gap-1 flex-wrap">
          <span className="badge" style={{ background: "#EEF2FF", color: "#6366f1", fontSize: 11 }}>
            TQ: {fb.teachingQuality}
          </span>
          <span className="badge" style={{ background: "#F0FDF4", color: "#16A34A", fontSize: 11 }}>
            CC: {fb.contentClarity}
          </span>
          <span className="badge" style={{ background: "#FFFBEB", color: "#D97706", fontSize: 11 }}>
            SP: {fb.sessionPace}
          </span>
          <span className="badge" style={{ background: "#FFF1F2", color: "#BE123C", fontSize: 11 }}>
            EN: {fb.engagement}
          </span>
        </div>
      </td>
      <td
        data-label="Comment"
        style={{ fontSize: 12, maxWidth: 200, color: "#6B7280" }}
      >
        {fb.comment ? (
          <span title={fb.comment}>
            {fb.comment.length > 60 ? fb.comment.slice(0, 60) + "…" : fb.comment}
          </span>
        ) : (
          <span className="text-muted fst-italic">No comment</span>
        )}
      </td>
      <td data-label="Date" style={{ fontSize: 12, color: "#6B7280" }}>{date}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function AdminFeedbackPage() {
  const dispatch = useAppDispatch();
  const { adminSummary, adminSummaryStatus, adminSummaryError } =
    useAppSelector((s) => s.feedback);

  useEffect(() => {
    dispatch(fetchAdminFeedbackSummaryThunk());
  }, [dispatch]);

  const isLoading = adminSummaryStatus === "loading";

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
          <div>
            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <i className="ti ti-message-star text-primary" />
              Session Feedback Analytics
            </h4>
            <p className="text-muted mb-0 mt-1" style={{ fontSize: 13 }}>
              Aggregated student feedback for all completed class sessions
            </p>
          </div>
          <button
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
            onClick={() => dispatch(fetchAdminFeedbackSummaryThunk())}
            disabled={isLoading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {isLoading && !adminSummary && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
            <p className="text-muted mt-2">Loading feedback data…</p>
          </div>
        )}

        {adminSummaryError && (
          <div className="alert alert-danger">{adminSummaryError}</div>
        )}

        {adminSummary && (
          <>
            {/* Stat cards row */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#6366f1" }}>
                    {adminSummary.total}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Total Responses
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#F59E0B" }}>
                    {adminSummary.overallSummary?.overallRating?.toFixed(1) ?? "—"}
                    <span style={{ fontSize: 16, color: "#F59E0B" }}> ★</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Avg Overall Rating
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#22C55E" }}>
                    {adminSummary.overallSummary?.teachingQuality?.toFixed(1) ?? "—"}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Avg Teaching Quality
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#3B82F6" }}>
                    {adminSummary.teacherSummaries.length}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Teachers Reviewed
                  </div>
                </div>
              </div>
            </div>

            {/* Overall + Teacher breakdown */}
            <div className="row g-4 mb-4">
              {adminSummary.overallSummary && (
                <div className="col-md-4">
                  <OverallSummaryCard summary={adminSummary.overallSummary} />
                </div>
              )}
              <div className={adminSummary.overallSummary ? "col-md-8" : "col-12"}>
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                      <i className="ti ti-user-star text-primary" />
                      Teacher Rankings
                    </h6>
                    {adminSummary.teacherSummaries.length === 0 ? (
                      <p className="text-muted fst-italic">No teacher data yet.</p>
                    ) : (
                      <div className="row g-3">
                        {adminSummary.teacherSummaries.map((t) => (
                          <div key={t.teacherId} className="col-md-6">
                            <TeacherCard teacher={t} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent feedback table */}
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="ti ti-list text-primary" />
                  Recent Feedback
                </h6>
                {adminSummary.recentFeedbacks.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="ti ti-message-circle" style={{ fontSize: 40 }} />
                    <p className="mt-2">No feedback submitted yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover table-stack align-middle" style={{ fontSize: 13 }}>
                      <thead className="table-light">
                        <tr>
                          <th>Student</th>
                          <th>Session</th>
                          <th>Overall</th>
                          <th>Category Scores</th>
                          <th>Comment</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSummary.recentFeedbacks.map((fb) => (
                          <FeedbackRow key={fb.id} fb={fb} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {adminSummary && adminSummary.total === 0 && !isLoading && (
          <div className="text-center py-5 text-muted">
            <i className="ti ti-message-star" style={{ fontSize: 60, opacity: 0.3 }} />
            <p className="mt-3 fw-semibold">No feedback yet</p>
            <p style={{ fontSize: 13 }}>
              Feedback appears here once students rate their class sessions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
