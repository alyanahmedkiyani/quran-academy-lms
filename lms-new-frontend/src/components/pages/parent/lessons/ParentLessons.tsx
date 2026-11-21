"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchParentById } from "@/services/parentService";
import { fetchLessons } from "@/services/classScheduleService";
import { LessonNote } from "@/types/classSchedule";

interface ChildData {
  id: string;
  name: string;
  lessons: LessonNote[];
  loading: boolean;
  error: string | null;
}

export default function ParentLessons() {
  const user = useAppSelector((s) => s.auth.user);
  const [children, setChildren] = useState<ChildData[]>([]);
  const [parentLoading, setParentLoading] = useState(true);
  const [parentError, setParentError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setParentLoading(true);

    fetchParentById(String(user.id))
      .then(async (parent) => {
        const students = parent.students ?? [];
        if (students.length === 0) {
          setChildren([]);
          setParentLoading(false);
          return;
        }

        const childList: ChildData[] = students.map((s) => ({
          id: String(s.id),
          name: `${s.firstName} ${s.lastName}`,
          lessons: [],
          loading: true,
          error: null,
        }));
        setChildren(childList);
        if (childList.length > 0) setSelectedChildId(childList[0].id);
        setParentLoading(false);

        // Fetch lessons for all children in parallel
        await Promise.all(
          students.map(async (s) => {
            try {
              const lessons = await fetchLessons(String(s.id), "student");
              setChildren((prev) =>
                prev.map((c) => c.id === String(s.id) ? { ...c, lessons, loading: false } : c)
              );
            } catch (err: unknown) {
              setChildren((prev) =>
                prev.map((c) => c.id === String(s.id)
                  ? { ...c, loading: false, error: (err as Error).message || "Failed to load" }
                  : c
                )
              );
            }
          })
        );
      })
      .catch((err: unknown) => {
        setParentError((err as Error).message || "Failed to load children");
        setParentLoading(false);
      });
  }, [user?.id]);

  const activeChild = children.find((c) => c.id === selectedChildId) ?? null;

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Lesson History</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><a href="/parent/dashboard">Dashboard</a></li>
                <li className="breadcrumb-item active">Lesson History</li>
              </ol>
            </nav>
          </div>
        </div>

        {parentLoading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
            <p className="mt-2 text-muted">Loading…</p>
          </div>
        )}

        {parentError && <div className="alert alert-danger">{parentError}</div>}

        {!parentLoading && !parentError && children.length === 0 && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-users-group" style={{ fontSize: 48, color: "#94a3b8", display: "block", marginBottom: 12 }} />
              <h5 className="text-muted fw-normal">No children linked</h5>
              <p className="text-muted" style={{ fontSize: 14 }}>Contact your administrator to link your children to your account.</p>
            </div>
          </div>
        )}

        {!parentLoading && children.length > 0 && (
          <>
            {/* Child selector tabs */}
            {children.length > 1 && (
              <div className="mb-3">
                <ul className="nav nav-tabs">
                  {children.map((child) => (
                    <li key={child.id} className="nav-item">
                      <button
                        className={`nav-link ${selectedChildId === child.id ? "active" : ""}`}
                        onClick={() => setSelectedChildId(child.id)}
                      >
                        <i className="ti ti-user me-1" style={{ fontSize: 13 }} />
                        {child.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lessons for selected child */}
            {activeChild && (
              <>
                {activeChild.loading && (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" />
                    <span className="ms-2 text-muted">Loading {activeChild.name}&apos;s lessons…</span>
                  </div>
                )}

                {activeChild.error && (
                  <div className="alert alert-danger">{activeChild.error}</div>
                )}

                {!activeChild.loading && !activeChild.error && activeChild.lessons.length === 0 && (
                  <div className="card">
                    <div className="card-body text-center py-5">
                      <i className="ti ti-book-off" style={{ fontSize: 48, color: "#94a3b8", display: "block", marginBottom: 12 }} />
                      <h5 className="text-muted fw-normal">No lesson notes yet for {activeChild.name}</h5>
                      <p className="text-muted" style={{ fontSize: 14 }}>
                        Lesson notes will appear here after teachers share them at session end.
                      </p>
                    </div>
                  </div>
                )}

                {!activeChild.loading && !activeChild.error && activeChild.lessons.length > 0 && (
                  <div className="row g-3">
                    {activeChild.lessons.map((lesson) => (
                      <div key={lesson.sessionId} className="col-12 col-md-6 col-xl-4">
                        <div className="card h-100" style={{ border: "1px solid #e2e8f0", borderRadius: 12 }}>
                          {/* Card header */}
                          <div
                            className="card-header"
                            style={{
                              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                              borderRadius: "12px 12px 0 0",
                              border: "none",
                              padding: "14px 16px",
                            }}
                          >
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <i className="ti ti-book-2" style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }} />
                              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Today&apos;s Lesson
                              </span>
                            </div>
                            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
                              {lesson.lessonTitle}
                            </div>
                          </div>

                          <div className="card-body" style={{ padding: "14px 16px" }}>
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <i className="ti ti-school" style={{ color: "#6366f1", fontSize: 14 }} />
                              <span style={{ fontSize: 13, color: "#374151" }}>{lesson.courseName ?? "—"}</span>
                            </div>
                            {lesson.teacherName && (
                              <div className="d-flex align-items-center gap-2 mb-2">
                                <i className="ti ti-user-check" style={{ color: "#6366f1", fontSize: 14 }} />
                                <span style={{ fontSize: 13, color: "#374151" }}>{lesson.teacherName}</span>
                              </div>
                            )}
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <i className="ti ti-calendar-event" style={{ color: "#6366f1", fontSize: 14 }} />
                              <span style={{ fontSize: 12, color: "#6b7280" }}>
                                {new Date(lesson.sessionDate + "T00:00:00").toLocaleDateString("en-US", {
                                  weekday: "short", month: "short", day: "numeric", year: "numeric",
                                })}
                              </span>
                            </div>

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

                            {lesson.lessonDueDate && (
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
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
