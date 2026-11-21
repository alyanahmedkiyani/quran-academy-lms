"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchTeacherFeedbackThunk } from "@/core/redux/feedbackSlice";
import { PerSessionSummary, SessionFeedbackItem } from "@/types/feedback";

// ---------------------------------------------------------------------------
// Star display (read-only)
// ---------------------------------------------------------------------------
function StarDisplay({ value }: { value: number }) {
  return (
    <span style={{ fontSize: 15 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= Math.round(value) ? "#F59E0B" : "#D1D5DB" }}>
          ★
        </span>
      ))}
      <span className="text-muted ms-1" style={{ fontSize: 12, fontWeight: 600 }}>
        {value?.toFixed(1)}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mini progress bar for one category
// ---------------------------------------------------------------------------
function CategoryBar({ label, value }: { label: string; value: number }) {
  const pct = ((value / 5) * 100).toFixed(0);
  const color = value >= 4 ? "#22C55E" : value >= 3 ? "#F59E0B" : "#EF4444";
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between mb-1" style={{ fontSize: 12 }}>
        <span className="text-muted">{label}</span>
        <span className="fw-semibold">{value?.toFixed(1)} / 5</span>
      </div>
      <div className="rounded-pill" style={{ height: 6, background: "#E5E7EB", overflow: "hidden" }}>
        <div
          className="rounded-pill"
          style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-session card
// ---------------------------------------------------------------------------
function SessionFeedbackCard({ session }: { session: PerSessionSummary }) {
  const s = session.feedback;
  if (!s) return null;
  const date = session.date ? new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between mb-2">
          <div>
            <p className="fw-semibold mb-0" style={{ fontSize: 14 }}>{session.sessionTitle}</p>
            <span className="text-muted" style={{ fontSize: 12 }}>{date}</span>
          </div>
          <div className="text-end">
            <StarDisplay value={s.overallRating} />
            <div className="text-muted" style={{ fontSize: 11 }}>
              {s.count} response{s.count !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <CategoryBar label="Teaching Quality" value={s.teachingQuality} />
        <CategoryBar label="Content Clarity" value={s.contentClarity} />
        <CategoryBar label="Session Pace" value={s.sessionPace} />
        <CategoryBar label="Engagement" value={s.engagement} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anonymous feedback comment row
// ---------------------------------------------------------------------------
function CommentRow({ fb }: { fb: SessionFeedbackItem }) {
  const date = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : "";
  const sessionTitle = fb.ClassSession?.title || "—";
  return (
    <div className="border rounded p-3 mb-2" style={{ background: "#fafafa", fontSize: 13 }}>
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="fw-medium text-muted fst-italic">Anonymous Student</span>
        <div className="d-flex align-items-center gap-2">
          <span className="badge" style={{ background: "#EEF2FF", color: "#6366f1", fontSize: 11 }}>
            {sessionTitle}
          </span>
          <span style={{ color: "#F59E0B" }}>
            {"★".repeat(fb.overallRating)}{"☆".repeat(5 - fb.overallRating)}
          </span>
          <span className="text-muted" style={{ fontSize: 11 }}>{date}</span>
        </div>
      </div>
      {fb.comment ? (
        <p className="mb-0 text-muted">&ldquo;{fb.comment}&rdquo;</p>
      ) : (
        <p className="mb-0 text-muted fst-italic" style={{ fontSize: 12 }}>No written comment.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TeacherFeedbackPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { teacherFeedback, teacherFeedbackStatus, teacherFeedbackError } =
    useAppSelector((s) => s.feedback);

  const teacherId = user?.id;

  useEffect(() => {
    if (teacherId) {
      dispatch(fetchTeacherFeedbackThunk(Number(teacherId)));
    }
  }, [dispatch, teacherId]);

  const isLoading = teacherFeedbackStatus === "loading";
  const data = teacherFeedback;
  const summary = data?.summary;
  const sessionsWithFeedback = (data?.perSession ?? []).filter((s) => s.count > 0);
  const feedbacksWithComments = (data?.feedbacks ?? []).filter((f) => f.comment);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
          <div>
            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
              <i className="ti ti-message-star text-primary" />
              My Feedback
            </h4>
            <p className="text-muted mb-0 mt-1" style={{ fontSize: 13 }}>
              Anonymous student feedback for your class sessions
            </p>
          </div>
          <button
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
            onClick={() => teacherId && dispatch(fetchTeacherFeedbackThunk(Number(teacherId)))}
            disabled={isLoading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {isLoading && !data && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
            <p className="text-muted mt-2">Loading feedback…</p>
          </div>
        )}

        {teacherFeedbackError && (
          <div className="alert alert-danger">{teacherFeedbackError}</div>
        )}

        {data && data.feedbacks.length === 0 && !isLoading && (
          <div className="text-center py-5 text-muted">
            <i className="ti ti-message-star" style={{ fontSize: 64, opacity: 0.2 }} />
            <p className="mt-3 fw-semibold">No feedback yet</p>
            <p style={{ fontSize: 13 }}>
              Students can rate your sessions after they end. Check back after your next class.
            </p>
          </div>
        )}

        {data && data.feedbacks.length > 0 && (
          <>
            {/* Overall summary cards */}
            {summary && (
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-2">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#6366f1" }}>
                      {summary.count}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Responses</div>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#F59E0B" }}>
                      {summary.overallRating?.toFixed(1)}
                      <span style={{ fontSize: 16 }}> ★</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Overall</div>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#22C55E" }}>
                      {summary.teachingQuality?.toFixed(1)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Teaching</div>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#3B82F6" }}>
                      {summary.contentClarity?.toFixed(1)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Clarity</div>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#8B5CF6" }}>
                      {summary.sessionPace?.toFixed(1)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Pace</div>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#EC4899" }}>
                      {summary.engagement?.toFixed(1)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Engagement</div>
                  </div>
                </div>
              </div>
            )}

            {/* Per-session breakdown */}
            {sessionsWithFeedback.length > 0 && (
              <div className="mb-4">
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="ti ti-calendar-stats text-primary" />
                  Per Session Breakdown
                </h6>
                <div className="row g-3">
                  {sessionsWithFeedback.map((session) => (
                    <div key={session.sessionId} className="col-md-6 col-lg-4">
                      <SessionFeedbackCard session={session} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="ti ti-message-circle text-primary" />
                Student Comments
                <span className="badge bg-light text-muted fw-normal ms-1">
                  Anonymous
                </span>
              </h6>
              {feedbacksWithComments.length === 0 ? (
                <p className="text-muted fst-italic" style={{ fontSize: 13 }}>
                  No written comments yet.
                </p>
              ) : (
                feedbacksWithComments.map((fb) => (
                  <CommentRow key={fb.id} fb={fb} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
