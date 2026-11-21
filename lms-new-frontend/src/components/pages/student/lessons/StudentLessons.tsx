"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchLessons } from "@/services/classScheduleService";
import { LessonNote } from "@/types/classSchedule";

export default function StudentLessons() {
  const user = useAppSelector((s) => s.auth.user);
  const [lessons, setLessons] = useState<LessonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchLessons(String(user.id), "student")
      .then((data) => { setLessons(data); setError(null); })
      .catch((err: unknown) => setError((err as Error).message || "Failed to load lessons"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">My Lessons</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><a href="/student/dashboard">Dashboard</a></li>
                <li className="breadcrumb-item active">My Lessons</li>
              </ol>
            </nav>
          </div>
        </div>

        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
            <p className="mt-2 text-muted">Loading lessons…</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">{error}</div>
        )}

        {!loading && !error && lessons.length === 0 && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-book-off" style={{ fontSize: 48, color: "#94a3b8", display: "block", marginBottom: 12 }} />
              <h5 className="text-muted fw-normal">No lesson notes yet</h5>
              <p className="text-muted" style={{ fontSize: 14 }}>
                Lesson notes will appear here after your teachers share them at the end of a session.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && lessons.length > 0 && (
          <div className="row g-3">
            {lessons.map((lesson) => (
              <div key={lesson.sessionId} className="col-12 col-md-6 col-xl-4">
                <div className="card h-100" style={{ border: "1px solid #e2e8f0", borderRadius: 12 }}>
                  {/* Card header — purple gradient */}
                  <div
                    className="card-header"
                    style={{
                      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      borderRadius: "12px 12px 0 0",
                      border: "none",
                      padding: "14px 16px",
                    }}
                  >
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <i className="ti ti-book-2" style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, flexShrink: 0 }} />
                          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Today&apos;s Lesson
                          </span>
                        </div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.3, wordBreak: "break-word" }}>
                          {lesson.lessonTitle}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-body" style={{ padding: "14px 16px" }}>
                    {/* Course + teacher */}
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="ti ti-school" style={{ color: "#6366f1", fontSize: 14, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#374151" }}>{lesson.courseName ?? "—"}</span>
                    </div>
                    {lesson.teacherName && (
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="ti ti-user-check" style={{ color: "#6366f1", fontSize: 14, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#374151" }}>{lesson.teacherName}</span>
                      </div>
                    )}
                    {/* Session date */}
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="ti ti-calendar-event" style={{ color: "#6366f1", fontSize: 14, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {new Date(lesson.sessionDate + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Description */}
                    {lesson.lessonDescription && (
                      <div
                        className="mb-2"
                        style={{
                          background: "#f8f9ff",
                          borderRadius: 8,
                          padding: "10px 12px",
                          fontSize: 13,
                          color: "#374151",
                          lineHeight: 1.55,
                          borderLeft: "3px solid #6366f1",
                        }}
                      >
                        {lesson.lessonDescription}
                      </div>
                    )}

                    {/* Due date */}
                    {lesson.lessonDueDate && (
                      <div className="mt-2">
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: "#ede9fe",
                            color: "#5b21b6",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <i className="ti ti-calendar-due" style={{ fontSize: 13 }} />
                          Due: {new Date(lesson.lessonDueDate + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
