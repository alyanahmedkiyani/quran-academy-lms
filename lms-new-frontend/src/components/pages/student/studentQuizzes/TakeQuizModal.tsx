"use client";

import { useEffect, useRef, useState } from "react";
import { QuizWithQuestions, QuizAttempt } from "@/types/quiz";
import {
  fetchQuizWithQuestions,
  startQuizAttempt,
  submitQuizAttempt,
  checkQuizAttempt,
} from "@/services/quizService";
import { useNotification } from "@/hooks/useNotification";
import { normalizeOptions } from "@/lib/questionBank";

interface Props {
  quizId: number;
  studentId: number;
  quizTitle: string;
  onClose: () => void;
  onAttemptComplete: () => void;
}

type Phase = "loading" | "already_attempted" | "instructions" | "taking" | "submitting" | "result";

const TakeQuizModal = ({ quizId, studentId, quizTitle, onClose, onAttemptComplete }: Props) => {
  const notify = useNotification();

  const [phase, setPhase] = useState<Phase>("loading");
  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check if already attempted, then load quiz
  useEffect(() => {
    (async () => {
      try {
        const { hasAttempted, attempt: existingAttempt } = await checkQuizAttempt(
          String(studentId),
          quizId
        );
        if (hasAttempted && existingAttempt) {
          setFinalScore(existingAttempt.score ?? null);
          setAttempt(existingAttempt);
          setPhase("already_attempted");
          return;
        }
        const quizData = await fetchQuizWithQuestions(quizId);
        setQuiz(quizData);
        setAnswers(new Array(quizData.Questions?.length ?? 0).fill(""));
        setPhase("instructions");
      } catch (err: unknown) {
        notify.error((err as Error).message ?? "Failed to load quiz");
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer logic
  useEffect(() => {
    if (phase !== "taking" || timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => (t !== null ? t - 1 : null));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const startTaking = async () => {
    try {
      setPhase("loading");
      const newAttempt = await startQuizAttempt(quizId, studentId);
      setAttempt(newAttempt);
      if (quiz?.duration) {
        setTimeLeft(quiz.duration * 60);
      }
      setCurrentQ(0);
      setPhase("taking");
    } catch (err: unknown) {
      notify.error((err as Error).message ?? "Failed to start quiz");
      setPhase("instructions");
    }
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("submitting");
    try {
      const result = await submitQuizAttempt(attempt.id, answers);
      setFinalScore(result.score ?? null);
      setPhase("result");
      onAttemptComplete();
    } catch (err: unknown) {
      notify.error((err as Error).message ?? "Failed to submit quiz");
      setPhase("taking");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const questions = quiz?.Questions ?? [];
  const totalQ = questions.length;
  const answered = answers.filter((a) => a.trim() !== "").length;

  return (
    <div
      className="modal fade show d-block"
      style={{ background: "rgba(0,0,0,0.6)", zIndex: 1055 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className="ti ti-help-circle me-2 text-primary" />
              {quizTitle}
            </h5>
            {phase !== "taking" && phase !== "submitting" && (
              <button type="button" className="btn-close" onClick={onClose} />
            )}
            {phase === "taking" && timeLeft !== null && (
              <span
                className={`badge fs-6 ms-auto me-3 ${timeLeft < 60 ? "bg-danger" : "bg-primary"}`}
              >
                <i className="ti ti-clock me-1" />
                {formatTime(timeLeft)}
              </span>
            )}
          </div>

          <div className="modal-body">
            {/* Loading */}
            {(phase === "loading" || phase === "submitting") && (
              <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary me-3" />
                <span>{phase === "submitting" ? "Submitting your answers…" : "Loading quiz…"}</span>
              </div>
            )}

            {/* Already attempted */}
            {phase === "already_attempted" && (
              <div className="text-center py-4">
                {finalScore !== null && finalScore >= (quiz?.passingScore ?? 0) ? (
                  <>
                    <div style={{ fontSize: 52 }} className="mb-2">🏆</div>
                    <h4 className="fw-bold text-success mb-1">Congratulations!</h4>
                    <p className="text-muted mb-1" style={{ fontSize: 14 }}>
                      {finalScore >= 90
                        ? "What a score! You truly mastered this one."
                        : finalScore >= 75
                        ? "Excellent work! You passed this quiz."
                        : "Good effort — you cleared the bar!"}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 52 }} className="mb-2">📚</div>
                    <h4 className="fw-bold text-danger mb-1">Keep Learning!</h4>
                    <p className="text-muted mb-1" style={{ fontSize: 14 }}>
                      {finalScore !== null && finalScore >= 40
                        ? "You were close! Review the material and you'll do better."
                        : "Failure is just the first step to success. Keep going!"}
                    </p>
                  </>
                )}
                <p className="text-muted mb-4" style={{ fontSize: 13 }}>Each quiz can only be attempted once.</p>
                {finalScore !== null && (
                  <div className="d-inline-block px-5 py-3 rounded-3 border">
                    <div className="text-muted" style={{ fontSize: 13 }}>Your Score</div>
                    <div
                      className={`fw-bold display-5 ${
                        finalScore >= (quiz?.passingScore ?? 0) ? "text-success" : "text-danger"
                      }`}
                    >
                      {Math.round(finalScore)}%
                    </div>
                    {quiz?.passingScore != null && (
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Passing: {quiz.passingScore}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {phase === "instructions" && quiz && (
              <div>
                <div className="row g-3 mb-4">
                  {quiz.duration != null && (
                    <div className="col-md-4">
                      <div className="card border-0 bg-light text-center py-3">
                        <i className="ti ti-clock fs-4 text-primary mb-1" />
                        <div className="fw-bold">{quiz.duration} min</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>Duration</div>
                      </div>
                    </div>
                  )}
                  <div className="col-md-4">
                    <div className="card border-0 bg-light text-center py-3">
                      <i className="ti ti-list-numbers fs-4 text-primary mb-1" />
                      <div className="fw-bold">{totalQ}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>Questions</div>
                    </div>
                  </div>
                  {quiz.passingScore != null && (
                    <div className="col-md-4">
                      <div className="card border-0 bg-light text-center py-3">
                        <i className="ti ti-trophy fs-4 text-primary mb-1" />
                        <div className="fw-bold">{quiz.passingScore}%</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>Passing Score</div>
                      </div>
                    </div>
                  )}
                </div>

                {quiz.instructions && (
                  <div className="alert alert-info">
                    <strong>Instructions:</strong> {quiz.instructions}
                  </div>
                )}

                <div className="alert alert-warning mb-0">
                  <i className="ti ti-alert-triangle me-1" />
                  Once you start, the timer begins and you cannot pause. Submit before time runs out.
                </div>
              </div>
            )}

            {/* Quiz taking */}
            {phase === "taking" && quiz && totalQ > 0 && (
              <div>
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: 13 }} className="text-muted">
                      Question {currentQ + 1} of {totalQ}
                    </span>
                    <span style={{ fontSize: 13 }} className="text-muted">
                      {answered} answered
                    </span>
                  </div>
                  <div className="progress" style={{ height: 6 }}>
                    <div
                      className="progress-bar bg-primary"
                      style={{ width: `${((currentQ + 1) / totalQ) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question dots */}
                <div className="d-flex flex-wrap gap-1 mb-3">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentQ(i)}
                      className={`btn btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center border ${
                        i === currentQ
                          ? "btn-primary"
                          : answers[i]?.trim()
                          ? "btn-success"
                          : "btn-outline-secondary"
                      }`}
                      style={{ width: 28, height: 28, fontSize: 11 }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {/* Current question */}
                {(() => {
                  const q = questions[currentQ];
                  return (
                    <div className="card border">
                      <div className="card-body">
                        <p className="fw-semibold mb-3">
                          {currentQ + 1}. {q.question}
                        </p>

                        {/* Multiple choice */}
                        {q.type === "multiple_choice" && normalizeOptions(q.options).length > 0 && (
                          <div className="d-flex flex-column gap-2">
                            {normalizeOptions(q.options).map((opt, oi) => (
                              <label
                                key={oi}
                                className={`d-flex align-items-center gap-2 p-2 rounded border cursor-pointer ${
                                  answers[currentQ] === opt ? "border-primary bg-primary bg-opacity-10" : ""
                                }`}
                                style={{ cursor: "pointer" }}
                              >
                                <input
                                  type="radio"
                                  name={`q-${currentQ}`}
                                  value={opt}
                                  checked={answers[currentQ] === opt}
                                  onChange={() => {
                                    const next = [...answers];
                                    next[currentQ] = opt;
                                    setAnswers(next);
                                  }}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}

                        {/* True / False */}
                        {q.type === "true_false" && (
                          <div className="d-flex gap-3">
                            {["true", "false"].map((val) => (
                              <label
                                key={val}
                                className={`d-flex align-items-center gap-2 p-2 px-4 rounded border cursor-pointer ${
                                  answers[currentQ] === val ? "border-primary bg-primary bg-opacity-10" : ""
                                }`}
                                style={{ cursor: "pointer" }}
                              >
                                <input
                                  type="radio"
                                  name={`q-${currentQ}`}
                                  value={val}
                                  checked={answers[currentQ] === val}
                                  onChange={() => {
                                    const next = [...answers];
                                    next[currentQ] = val;
                                    setAnswers(next);
                                  }}
                                />
                                {val.charAt(0).toUpperCase() + val.slice(1)}
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Short answer */}
                        {q.type === "short_answer" && (
                          <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Type your answer here…"
                            value={answers[currentQ] ?? ""}
                            onChange={(e) => {
                              const next = [...answers];
                              next[currentQ] = e.target.value;
                              setAnswers(next);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Navigation */}
                <div className="d-flex justify-content-between mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={currentQ === 0}
                    onClick={() => setCurrentQ((q) => q - 1)}
                  >
                    <i className="ti ti-arrow-left me-1" /> Previous
                  </button>
                  {currentQ < totalQ - 1 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setCurrentQ((q) => q + 1)}
                    >
                      Next <i className="ti ti-arrow-right ms-1" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleSubmit}
                    >
                      <i className="ti ti-send me-1" />
                      Submit Quiz ({answered}/{totalQ} answered)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Result */}
            {phase === "result" && (
              <div className="text-center py-4">
                {finalScore !== null && finalScore >= (quiz?.passingScore ?? 0) ? (
                  <>
                    <div style={{ fontSize: 52 }} className="mb-2">🎉</div>
                    <h4 className="fw-bold text-success mb-1">Congratulations!</h4>
                    <p className="text-muted mb-1" style={{ fontSize: 14 }}>
                      {finalScore >= 90
                        ? "Outstanding performance! You nailed it!"
                        : finalScore >= 75
                        ? "Great job! You passed with flying colors!"
                        : "Well done! Keep up the good work!"}
                    </p>
                    <p className="text-muted mb-3" style={{ fontSize: 13 }}>Here's your result:</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 52 }} className="mb-2">💪</div>
                    <h4 className="fw-bold text-danger mb-1">Don't Give Up!</h4>
                    <p className="text-muted mb-1" style={{ fontSize: 14 }}>
                      {finalScore !== null && finalScore >= 40
                        ? "So close! A little more effort and you'll ace it next time."
                        : "Every expert was once a beginner. Keep practicing!"}
                    </p>
                    <p className="text-muted mb-3" style={{ fontSize: 13 }}>Here's your result:</p>
                  </>
                )}
                {finalScore !== null && (
                  <div className="d-inline-block px-5 py-3 rounded-3 border mb-3">
                    <div className="text-muted" style={{ fontSize: 13 }}>Your Score</div>
                    <div
                      className={`fw-bold display-5 ${
                        finalScore >= (quiz?.passingScore ?? 0) ? "text-success" : "text-danger"
                      }`}
                    >
                      {Math.round(finalScore)}%
                    </div>
                    {quiz?.passingScore != null && (
                      <div
                        className={`badge mt-1 ${
                          finalScore >= quiz.passingScore ? "bg-success" : "bg-danger"
                        }`}
                      >
                        {finalScore >= quiz.passingScore ? "Passed" : "Failed"}
                        {" — "}Passing score: {quiz.passingScore}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {phase === "instructions" && (
              <>
                <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startTaking}
                  disabled={totalQ === 0}
                >
                  <i className="ti ti-player-play me-1" />
                  {totalQ === 0 ? "No questions yet" : "Start Quiz"}
                </button>
              </>
            )}
            {(phase === "result" || phase === "already_attempted") && (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeQuizModal;
