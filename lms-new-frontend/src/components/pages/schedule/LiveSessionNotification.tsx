"use client";

import { useEffect, useState } from "react";
import { useAppDispatch } from "@/core/redux/hooks";
import { openCall, markSessionLiveOptimistic } from "@/core/redux/calendarSlice";
import { joinSession } from "@/services/classScheduleService";
import { LiveSessionNotificationPayload } from "@/types/classSchedule";

interface Props {
  notification: LiveSessionNotificationPayload;
  userId: string;
  role: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 30_000;

export default function LiveSessionNotification({ notification, userId, role, onDismiss }: Props) {
  const dispatch = useAppDispatch();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(100);

  // Auto-dismiss countdown
  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        onDismiss();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [onDismiss]);

  const handleJoinNow = async () => {
    setJoining(true);
    setError(null);
    try {
      const { joinUrl } = await joinSession(notification.sessionId, userId, role);
      dispatch(markSessionLiveOptimistic({ sessionId: notification.sessionId, sessionStatus: "live" }));
      dispatch(openCall({
        sessionId: notification.sessionId,
        joinUrl,
        sessionTitle: notification.title,
        courseId: notification.courseId ?? null,
      }));
      onDismiss();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to join.");
      setJoining(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 8000,
        width: "min(340px, calc(100vw - 32px))",
        background: "#1e293b",
        border: "1px solid #22c55e",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        overflow: "hidden",
        animation: "slideInRight 0.3s ease",
      }}
    >
      {/* Progress bar (auto-dismiss countdown) */}
      <div
        style={{
          height: 3,
          background: "#22c55e",
          width: `${progress}%`,
          transition: "width 0.1s linear",
        }}
      />

      <div style={{ padding: "14px 14px 12px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Pulsing dot */}
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#22c55e",
                flexShrink: 0,
                animation: "livePulse 1.5s infinite",
              }}
            />
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Class is Live!
            </span>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Session info */}
        <div style={{ color: "#f8fafc", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          {notification.title}
        </div>
        {notification.teacherName && (
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>
            <i className="ti ti-user me-1" />
            {notification.teacherName}
          </div>
        )}
        {notification.courseName && (
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 12 }}>
            <i className="ti ti-book me-1" />
            {notification.courseName}
          </div>
        )}

        {error && (
          <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="lsn-actions" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleJoinNow}
            disabled={joining}
            style={{
              flex: 1,
              background: "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              fontSize: 13,
              cursor: joining ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: joining ? 0.7 : 1,
            }}
          >
            {joining ? (
              <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14, borderWidth: 2 }} />
            ) : (
              <i className="ti ti-video" style={{ fontSize: 14 }} />
            )}
            Join Now
          </button>
          <button
            onClick={onDismiss}
            style={{
              background: "#334155",
              color: "#94a3b8",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);   }
        }
        @media (max-width: 360px) {
          .lsn-actions { flex-direction: column; }
          .lsn-actions button { width: 100%; }
        }
      `}</style>
    </div>
  );
}
