"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchStudentQuizzes, fetchStudentQuizResults } from "@/services/quizService";
import { useNotification } from "@/hooks/useNotification";
import { Quiz, QuizResult } from "@/types/quiz";
import { media_base_url } from "@/environment";
import TakeQuizModal from "./TakeQuizModal";

type TabType = "quizzes" | "results";

const StudentQuizList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>("quizzes");

  // Quizzes tab
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Results tab
  const [results, setResults] = useState<QuizResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const loadQuizzes = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchStudentQuizzes(String(user.id))
      .then(setQuizzes)
      .catch((err) => notify.error(err.message ?? "Failed to load quizzes"))
      .finally(() => setLoading(false));
  };

  const loadResults = () => {
    if (!user?.id) return;
    setResultsLoading(true);
    fetchStudentQuizResults(String(user.id))
      .then((data) => setResults(data.results))
      .catch((err) => notify.error(err.message ?? "Failed to load results"))
      .finally(() => setResultsLoading(false));
  };

  useEffect(() => {
    loadQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "results") loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">My Quizzes</h4>
            <p className="text-muted mb-0 mt-1">Quizzes assigned to you by your teachers</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={activeTab === "quizzes" ? loadQuizzes : loadResults}
            disabled={activeTab === "quizzes" ? loading : resultsLoading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link${activeTab === "quizzes" ? " active" : ""}`}
              onClick={() => setActiveTab("quizzes")}
            >
              <i className="ti ti-help me-1" />
              My Quizzes
              {!loading && (
                <span className="badge badge-soft-primary ms-2">{quizzes.length}</span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link${activeTab === "results" ? " active" : ""}`}
              onClick={() => setActiveTab("results")}
            >
              <i className="ti ti-chart-bar me-1" />
              My Results
              {!resultsLoading && activeTab === "results" && (
                <span className="badge badge-soft-success ms-2">{results.length}</span>
              )}
            </button>
          </li>
        </ul>

        {/* ─── Quizzes Tab ─── */}
        {activeTab === "quizzes" && (
          <>
            {/* Take Quiz Modal */}
            {activeQuiz && user?.id && (
              <TakeQuizModal
                quizId={activeQuiz.id}
                studentId={Number(user.id)}
                quizTitle={activeQuiz.title}
                onClose={() => setActiveQuiz(null)}
                onAttemptComplete={loadQuizzes}
              />
            )}

            {loading && (
              <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}

            {!loading && quizzes.length === 0 && (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-help-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Quizzes Yet</h5>
                  <p className="text-muted mb-0">
                    You don&apos;t have any quizzes assigned. Your teacher will assign quizzes when ready.
                  </p>
                </div>
              </div>
            )}

            {!loading && quizzes.length > 0 && (
              <div className="row g-3">
                {quizzes.map((quiz) => {
                  const courseName = quiz.CourseDetails?.Courses?.courseName ?? "—";
                  const teacherName = quiz.Teacher
                    ? `${quiz.Teacher.firstName} ${quiz.Teacher.lastName}`
                    : "—";
                  const teacherImg = quiz.Teacher?.imageUrl
                    ? `${media_base_url}/${quiz.Teacher.imageUrl}`
                    : null;

                  const attempt = quiz.QuizAttempts?.[0] ?? null;
                  const isCompleted = !!attempt?.endTime;

                  return (
                    <div key={quiz.id} className="col-lg-4 col-md-6">
                      <div className="card h-100">
                        <div
                          className="rounded-top"
                          style={{ height: 4, background: isCompleted ? "var(--bs-success)" : "var(--bs-primary)" }}
                        />
                        <div className="card-body d-flex flex-column">
                          <div className="d-flex align-items-start justify-content-between mb-1">
                            <h6 className="fw-bold mb-0">{quiz.title}</h6>
                            {isCompleted && (
                              <span className="badge badge-soft-success ms-2 flex-shrink-0">Completed</span>
                            )}
                          </div>

                          <div className="d-flex align-items-center gap-2 mb-1">
                            <i className="ti ti-book text-primary" style={{ fontSize: 13 }} />
                            <span className="text-muted" style={{ fontSize: 13 }}>{courseName}</span>
                          </div>

                          <div className="d-flex align-items-center gap-2 mb-3">
                            {teacherImg ? (
                              <img
                                src={teacherImg}
                                alt={teacherName}
                                style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }}
                              />
                            ) : (
                              <i className="ti ti-user text-muted" style={{ fontSize: 13 }} />
                            )}
                            <span className="text-muted" style={{ fontSize: 13 }}>{teacherName}</span>
                          </div>

                          {quiz.instructions && (
                            <p
                              className="text-muted mb-3"
                              style={{
                                fontSize: 13,
                                lineHeight: 1.5,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {quiz.instructions}
                            </p>
                          )}

                          <div className="mt-auto">
                            <hr className="my-2" />
                            <div className="row g-2 text-center mb-3">
                              <div className="col-6">
                                <div style={{ fontSize: 11 }} className="text-muted text-uppercase fw-medium">
                                  Duration
                                </div>
                                <div className="fw-bold" style={{ fontSize: 14 }}>
                                  {quiz.duration != null ? `${quiz.duration} min` : "—"}
                                </div>
                              </div>
                              <div className="col-6">
                                <div style={{ fontSize: 11 }} className="text-muted text-uppercase fw-medium">
                                  Passing Score
                                </div>
                                <div className="fw-bold" style={{ fontSize: 14 }}>
                                  {quiz.passingScore != null ? `${quiz.passingScore}%` : "—"}
                                </div>
                              </div>
                            </div>
                            {isCompleted ? (
                              <div>
                                <div className="btn btn-success btn-sm w-100 d-flex align-items-center justify-content-center gap-1 mb-1" style={{ pointerEvents: "none" }}>
                                  <i className="ti ti-circle-check" />
                                  Completed
                                </div>
                                {attempt?.score != null && (
                                  <div className="text-center" style={{ fontSize: 12 }}>
                                    <span className="text-muted">Score: </span>
                                    <span className={`fw-bold ${attempt.score >= (quiz.passingScore ?? 0) ? "text-success" : "text-danger"}`}>
                                      {attempt.score}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                                onClick={() => setActiveQuiz(quiz)}
                              >
                                <i className="ti ti-player-play" />
                                Take Quiz
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
          </>
        )}

        {/* ─── Results Tab ─── */}
        {activeTab === "results" && (
          <>
            {resultsLoading && (
              <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}

            {!resultsLoading && results.length === 0 && (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-chart-bar-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Results Yet</h5>
                  <p className="text-muted mb-0">
                    You haven&apos;t completed any quizzes yet. Take a quiz to see your results here.
                  </p>
                </div>
              </div>
            )}

            {!resultsLoading && results.length > 0 && (
              <div className="card">
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover table-stack mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Quiz</th>
                          <th>Teacher</th>
                          <th className="text-center">Score</th>
                          <th className="text-center">Pass Score</th>
                          <th className="text-center">Status</th>
                          <th>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, idx) => {
                          const score = r.score ?? null;
                          const passing = r.Quiz?.passingScore ?? null;
                          const passed = score !== null && passing !== null && score >= passing;
                          const completed = r.endTime
                            ? new Date(r.endTime).toLocaleDateString()
                            : null;
                          const teacherName = r.Quiz?.Teacher
                            ? `${r.Quiz.Teacher.firstName} ${r.Quiz.Teacher.lastName}`
                            : "—";

                          return (
                            <tr key={r.id}>
                              <td data-label="#" className="text-muted">{idx + 1}</td>
                              <td data-label="Quiz" className="fw-medium">{r.Quiz?.title ?? "—"}</td>
                              <td data-label="Teacher">{teacherName}</td>
                              <td data-label="Score" className="text-center">
                                {score !== null ? (
                                  <span className={`fw-bold ${passed ? "text-success" : "text-danger"}`}>
                                    {score}%
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td data-label="Pass Score" className="text-center text-muted">
                                {passing !== null ? `${passing}%` : "—"}
                              </td>
                              <td data-label="Status" className="text-center">
                                {score !== null ? (
                                  <span className={`badge ${passed ? "badge-soft-success" : "badge-soft-danger"}`}>
                                    {passed ? "Passed" : "Failed"}
                                  </span>
                                ) : (
                                  <span className="badge badge-soft-secondary">Not Attempted</span>
                                )}
                              </td>
                              <td data-label="Completed" className="text-muted" style={{ fontSize: 13 }}>
                                {completed ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StudentQuizList;
