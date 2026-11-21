"use client";

import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  submitFeedbackThunk,
  resetSubmitStatus,
} from "@/core/redux/feedbackSlice";
import { checkFeedbackSubmitted } from "@/services/feedbackService";
import { PendingFeedbackSession } from "@/types/feedback";

interface FeedbackModalProps {
  session: PendingFeedbackSession;
  studentId: number;
  onClose: () => void;
}

const CATEGORIES = [
  { key: "teachingQuality", label: "Teaching Quality", icon: "ti-school" },
  { key: "contentClarity", label: "Content Clarity", icon: "ti-book" },
  { key: "sessionPace", label: "Session Pace", icon: "ti-clock" },
  { key: "engagement", label: "Engagement", icon: "ti-users" },
  { key: "overallRating", label: "Overall Rating", icon: "ti-star" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

// Star rating sub-component
function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div
      className="feedback-stars d-flex gap-1"
      onMouseLeave={() => setHovered(0)}
      style={{ fontSize: 24, cursor: disabled ? "default" : "pointer" }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            color:
              star <= (hovered || value)
                ? "#F59E0B"
                : "#D1D5DB",
            transition: "color 0.1s",
          }}
          onMouseEnter={() => !disabled && setHovered(star)}
          onClick={() => !disabled && onChange(star)}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function FeedbackModal({
  session,
  studentId,
  onClose,
}: FeedbackModalProps) {
  const dispatch = useAppDispatch();
  const { submitStatus, submitError } = useAppSelector((s) => s.feedback);

  const [ratings, setRatings] = useState<Record<CategoryKey, number>>({
    teachingQuality: 0,
    contentClarity: 0,
    sessionPace: 0,
    engagement: 0,
    overallRating: 0,
  });
  const [comment, setComment] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if student already submitted feedback when modal opens
  useEffect(() => {
    let cancelled = false;
    setCheckingStatus(true);
    checkFeedbackSubmitted(session.sessionId, studentId)
      .then(({ submitted }) => {
        if (!cancelled) {
          setAlreadySubmitted(submitted);
          setCheckingStatus(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.sessionId, studentId]);

  // Lock body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      dispatch(resetSubmitStatus());
    };
  }, [dispatch]);

  const allRated = Object.values(ratings).every((v) => v > 0);
  const isSubmitting = submitStatus === "loading";
  const succeeded = submitStatus === "succeeded";

  const handleSubmit = async () => {
    if (!allRated || isSubmitting) return;
    await dispatch(
      submitFeedbackThunk({
        sessionId: session.sessionId,
        payload: { studentId, ...ratings, comment: comment || undefined },
      })
    );
  };

  const handleClose = () => {
    dispatch(resetSubmitStatus());
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 9500,
        }}
        onClick={succeeded || alreadySubmitted ? handleClose : undefined}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9501,
          width: "calc(100% - 32px)",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="feedback-modal-header"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            padding: "20px 24px",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="ti ti-message-star" style={{ fontSize: 22 }} />
            <span style={{ fontSize: 17, fontWeight: 700 }}>Session Feedback</span>
          </div>
          {/* Session info */}
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Session
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {session.sessionTitle}
            </span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          {/* Today's Lesson card — shown only when teacher submitted a lesson */}
          {session.lessonTitle && (
            <div
              style={{
                marginTop: 10,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <i className="ti ti-book-2" style={{ fontSize: 15 }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.9 }}>
                  Today&apos;s Lesson
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: session.lessonDescription ? 4 : 0 }}>
                {session.lessonTitle}
              </div>
              {session.lessonDescription && (
                <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                  {session.lessonDescription}
                </div>
              )}
              {session.lessonDueDate && (
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>
                  <i className="ti ti-calendar-due" style={{ fontSize: 12 }} />
                  Due: {new Date(session.lessonDueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="feedback-modal-body" style={{ padding: "20px 24px 8px", overflowY: "auto", flex: 1 }}>
          {checkingStatus ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" />
            </div>
          ) : alreadySubmitted ? (
            <div className="text-center py-3">
              <i
                className="ti ti-circle-check"
                style={{ fontSize: 52, color: "#22C55E" }}
              />
              <p className="fw-semibold mt-2 mb-1">Feedback Already Submitted</p>
              <p className="text-muted" style={{ fontSize: 13 }}>
                You have already shared your thoughts for this session. Thank
                you!
              </p>
            </div>
          ) : succeeded ? (
            <div className="text-center py-3">
              <i
                className="ti ti-circle-check"
                style={{ fontSize: 52, color: "#22C55E" }}
              />
              <p className="fw-semibold mt-2 mb-1">Thank you for your feedback!</p>
              <p className="text-muted" style={{ fontSize: 13 }}>
                Your response helps us improve the learning experience.
              </p>
            </div>
          ) : (
            <>
              <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                Rate the session on the criteria below. Your feedback is
                anonymous to your teacher.
              </p>

              {/* Category ratings */}
              <div className="d-flex flex-column gap-3 mb-3">
                {CATEGORIES.map(({ key, label, icon }) => (
                  <div
                    key={key}
                    className="d-flex align-items-center justify-content-between feedback-category-row"
                    style={{ flexWrap: "wrap", gap: 6 }}
                  >
                    <div className="d-flex align-items-center gap-2" style={{ flex: 1, minWidth: 120 }}>
                      <i
                        className={`ti ${icon}`}
                        style={{ fontSize: 16, color: "#6366f1", width: 20, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {label}
                      </span>
                    </div>
                    <StarRating
                      value={ratings[key]}
                      onChange={(v) =>
                        setRatings((prev) => ({ ...prev, [key]: v }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                ))}
              </div>

              {/* Comment */}
              <div className="mb-3">
                <label
                  className="form-label"
                  style={{ fontSize: 13, fontWeight: 500 }}
                >
                  Additional comments{" "}
                  <span className="text-muted fw-normal">(optional)</span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Share anything else about the session..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isSubmitting}
                  style={{ fontSize: 13, resize: "none" }}
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13 }}>
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="feedback-modal-footer d-flex gap-2 justify-content-end"
          style={{ padding: "12px 24px 20px", flexShrink: 0, flexWrap: "wrap" }}
        >
          {succeeded || alreadySubmitted ? (
            <button className="btn btn-primary btn-sm" onClick={handleClose}>
              Close
            </button>
          ) : (
            <>
              <button
                className="btn btn-light btn-sm"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Skip
              </button>
              <button
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                onClick={handleSubmit}
                disabled={!allRated || isSubmitting}
              >
                {isSubmitting && (
                  <span className="spinner-border spinner-border-sm" />
                )}
                Submit Feedback
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 520px) {
          .feedback-modal-header { padding: 14px 16px !important; }
          .feedback-modal-body   { padding: 14px 16px 6px !important; }
          .feedback-modal-footer { padding: 10px 16px 16px !important; }
        }
        @media (max-width: 400px) {
          .feedback-stars { font-size: 20px !important; }
          .feedback-modal-footer { flex-direction: column-reverse !important; }
          .feedback-modal-footer .btn { width: 100%; }
        }
      `}</style>
    </>
  );
}
