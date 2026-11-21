"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { useTeacherCourses } from "@/hooks/useTeacherCourses";
import { useNotification } from "@/hooks/useNotification";
import {
  fetchTeacherQuizzes,
  createQuiz,
  updateQuiz,
  deleteQuizGroup,
  fetchQuizWithQuestions,
  addQuizQuestion,
  deleteQuestion,
  fetchTeacherQuizResults,
  fetchEnrolledStudents,
} from "@/services/quizService";
import { fetchQuestionBank, createBankQuestion } from "@/services/questionBankService";
import { Quiz, QuizGroup, QuizWithQuestions, QuizQuestion, QuestionType, QuestionBankEntry, QuizResult, EnrolledStudent } from "@/types/quiz";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import { normalizeOptions } from "@/lib/questionBank";

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** Deduplicate flat quiz list into QuizGroups (one per unique title+teacherId) */
const buildQuizGroups = (quizzes: Quiz[]): QuizGroup[] => {
  const map = new Map<string, QuizGroup>();
  for (const q of quizzes) {
    const key = `${q.teacherId}__${q.title}`;
    if (!map.has(key)) {
      map.set(key, {
        representativeId: q.id,
        title: q.title,
        instructions: q.instructions,
        duration: q.duration,
        passingScore: q.passingScore,
        teacherId: q.teacherId,
        status: q.status,
        createdAt: q.createdAt,
        studentCount: 0,
      });
    }
    map.get(key)!.studentCount += 1;
  }
  return Array.from(map.values());
};

interface CourseOption { courseId: string; courseName: string; }

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
];

const TeacherQuizList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { teacherAssignments, loading: coursesLoading, loadCourses } = useTeacherCourses();
  const notify = useNotification();

  const [quizGroups, setQuizGroups] = useState<QuizGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createCourseId, setCreateCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createInstructions, setCreateInstructions] = useState("");
  const [createDuration, setCreateDuration] = useState("");
  const [createPassingScore, setCreatePassingScore] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Quiz modal
  const [editTarget, setEditTarget] = useState<QuizGroup | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPassingScore, setEditPassingScore] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Manage Questions modal
  const [questionTarget, setQuestionTarget] = useState<QuizGroup | null>(null);
  const [quizDetail, setQuizDetail] = useState<QuizWithQuestions | null>(null);
  const [questionDetailLoading, setQuestionDetailLoading] = useState(false);
  const [questionsTab, setQuestionsTab] = useState<"add" | "bank">("add");

  // Question Bank
  const [bankQuestions, setBankQuestions] = useState<QuestionBankEntry[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankAddingId, setBankAddingId] = useState<number | null>(null);

  // Add question form
  const [qType, setQType] = useState<QuestionType>("multiple_choice");
  const [qText, setQText] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState("");
  const [qSaveToBank, setQSaveToBank] = useState(false);
  const [qSubject, setQSubject] = useState("");
  const [qAddLoading, setQAddLoading] = useState(false);

  // Delete question
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<QuizQuestion | null>(null);
  const [deleteQuestionLoading, setDeleteQuestionLoading] = useState(false);

  // Delete quiz group
  const [deleteTarget, setDeleteTarget] = useState<QuizGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Main tabs: quizzes / results
  const [mainTab, setMainTab] = useState<"quizzes" | "results">("quizzes");

  // Results state
  const [results, setResults] = useState<QuizResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsSearch, setResultsSearch] = useState("");

  // Student filter for create modal
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  const teacherCourses: CourseOption[] = Array.from(
    new Map(
      teacherAssignments
        .filter((a) => a.Course)
        .map((a) => [String(a.courseId), { courseId: String(a.courseId), courseName: a.Course!.courseName }])
    ).values()
  );

  const loadQuizzes = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchTeacherQuizzes(String(user.id))
      .then((quizzes) => setQuizGroups(buildQuizGroups(quizzes)))
      .catch((err) => notify.error(err.message ?? "Failed to load quizzes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.id) {
      loadCourses(String(user.id));
      loadQuizzes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!createCourseId || !user?.id) {
      setEnrolledStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    setStudentsLoading(true);
    fetchEnrolledStudents(String(user.id), createCourseId)
      .then((res) => {
        setEnrolledStudents(res.students);
        setSelectedStudentIds(res.students.map((s) => s.id)); // all selected by default
      })
      .catch(() => { setEnrolledStudents([]); setSelectedStudentIds([]); })
      .finally(() => setStudentsLoading(false));
  }, [createCourseId, user?.id]);

  const loadResults = () => {
    if (!user?.id) return;
    setResultsLoading(true);
    fetchTeacherQuizResults(String(user.id))
      .then((res) => setResults(res.results))
      .catch(() => setResults([]))
      .finally(() => setResultsLoading(false));
  };

  const resetCreateForm = () => {
    setCreateCourseId("");
    setCreateTitle("");
    setCreateInstructions("");
    setCreateDuration("");
    setCreatePassingScore("");
    setEnrolledStudents([]);
    setSelectedStudentIds([]);
  };

  const handleCreate = async () => {
    if (!createCourseId) { notify.error("Please select a course."); return; }
    if (!createTitle.trim()) { notify.error("Please enter a quiz title."); return; }
    const dur = Number(createDuration);
    const pass = Number(createPassingScore);
    if (!createDuration || isNaN(dur) || dur <= 0) { notify.error("Please enter a valid duration in minutes."); return; }
    if (!createPassingScore || isNaN(pass) || pass < 0 || pass > 100) { notify.error("Please enter a passing score between 0 and 100."); return; }
    if (!user?.id) return;

    const titleToFind = createTitle.trim();
    setCreateLoading(true);
    try {
      await createQuiz({
        courseId: createCourseId,
        teacherId: String(user.id),
        title: titleToFind,
        instructions: createInstructions.trim() || undefined,
        duration: dur,
        passingScore: pass,
        studentIds: selectedStudentIds.length < enrolledStudents.length ? selectedStudentIds : undefined,
      });
      notify.success("Quiz created — now add your questions");
      setShowCreate(false);
      resetCreateForm();

      // Fetch updated list and auto-open Manage Questions for the new quiz
      const updatedQuizzes = await fetchTeacherQuizzes(String(user.id));
      const groups = buildQuizGroups(updatedQuizzes);
      setQuizGroups(groups);
      const newGroup = groups.find(
        (g) => g.title === titleToFind && String(g.teacherId) === String(user.id)
      );
      if (newGroup) {
        openManageQuestions(newGroup);
      }
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to create quiz");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (group: QuizGroup) => {
    setEditTarget(group);
    setEditTitle(group.title);
    setEditInstructions(group.instructions ?? "");
    setEditDuration(group.duration != null ? String(group.duration) : "");
    setEditPassingScore(group.passingScore != null ? String(group.passingScore) : "");
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editTitle.trim()) { notify.error("Title is required."); return; }
    const dur = Number(editDuration);
    const pass = Number(editPassingScore);
    if (!editDuration || isNaN(dur) || dur <= 0) { notify.error("Please enter a valid duration."); return; }
    if (!editPassingScore || isNaN(pass) || pass < 0 || pass > 100) { notify.error("Passing score must be 0–100."); return; }
    setEditLoading(true);
    try {
      await updateQuiz(editTarget.representativeId, {
        title: editTitle.trim(),
        instructions: editInstructions.trim() || undefined,
        duration: dur,
        passingScore: pass,
      });
      notify.success("Quiz updated successfully");
      setEditTarget(null);
      loadQuizzes();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to update quiz");
    } finally {
      setEditLoading(false);
    }
  };

  const loadBankQuestions = async () => {
    setBankLoading(true);
    try {
      const res = await fetchQuestionBank();
      setBankQuestions(res.questions);
    } catch {
      setBankQuestions([]);
    } finally {
      setBankLoading(false);
    }
  };

  const openManageQuestions = async (group: QuizGroup) => {
    setQuestionTarget(group);
    setQuizDetail(null);
    setQuestionDetailLoading(true);
    setQuestionsTab("add");
    resetQForm();
    try {
      const detail = await fetchQuizWithQuestions(group.representativeId);
      setQuizDetail(detail);
    } catch {
      setQuizDetail({ ...group, id: group.representativeId, title: group.title, Questions: [] });
    } finally {
      setQuestionDetailLoading(false);
    }
  };

  const resetQForm = () => {
    setQType("multiple_choice");
    setQText("");
    setQOptions(["", "", "", ""]);
    setQCorrect("");
    setQSaveToBank(false);
    setQSubject("");
  };

  const handleAddQuestion = async () => {
    if (!qText.trim()) { notify.error("Question text is required."); return; }
    if (qType === "multiple_choice") {
      const filled = qOptions.filter((o) => o.trim());
      if (filled.length < 2) { notify.error("Please provide at least 2 options."); return; }
      if (!qCorrect.trim()) { notify.error("Please specify the correct answer."); return; }
    }
    if (qType === "true_false" && !qCorrect.trim()) { notify.error("Please select the correct answer."); return; }
    if (qType === "short_answer" && !qCorrect.trim()) { notify.error("Please provide the correct answer keywords."); return; }
    if (!questionTarget) return;

    // Duplicate check
    const isDuplicate = quizDetail?.Questions?.some(
      (q) => q.question.trim().toLowerCase() === qText.trim().toLowerCase()
    );
    if (isDuplicate) { notify.error("This question already exists in the quiz."); return; }

    setQAddLoading(true);
    try {
      const payload = {
        type: qType,
        question: qText.trim(),
        options: qType === "multiple_choice" ? qOptions.filter((o) => o.trim()) : null,
        correctAnswer: qCorrect.trim(),
      };
      await addQuizQuestion(questionTarget.representativeId, payload);
      if (qSaveToBank) {
        await createBankQuestion({
          ...payload,
          subject: qSubject.trim() || undefined,
          createdBy: user?.id ? Number(user.id) : undefined,
        });
      }
      const detail = await fetchQuizWithQuestions(questionTarget.representativeId);
      setQuizDetail(detail);
      // Refresh bank list if it was loaded
      if (bankQuestions.length > 0 && qSaveToBank) loadBankQuestions();
      notify.success(qSaveToBank ? "Question added and saved to bank" : "Question added");
      resetQForm();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to add question");
    } finally {
      setQAddLoading(false);
    }
  };

  const handleAddFromBank = async (bankQ: QuestionBankEntry) => {
    if (!questionTarget) return;

    // Duplicate check
    const isDuplicate = quizDetail?.Questions?.some(
      (q) => q.question.trim().toLowerCase() === bankQ.question.trim().toLowerCase()
    );
    if (isDuplicate) { notify.error("This question is already in the quiz."); return; }

    setBankAddingId(bankQ.id);
    try {
      await addQuizQuestion(questionTarget.representativeId, {
        type: bankQ.type,
        question: bankQ.question,
        options: bankQ.options || null,
        correctAnswer: bankQ.correctAnswer,
      });
      const detail = await fetchQuizWithQuestions(questionTarget.representativeId);
      setQuizDetail(detail);
      notify.success("Question added from bank");
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to add question from bank");
    } finally {
      setBankAddingId(null);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestionTarget || !questionTarget) return;
    setDeleteQuestionLoading(true);
    try {
      await deleteQuestion(deleteQuestionTarget.id);
      const detail = await fetchQuizWithQuestions(questionTarget.representativeId);
      setQuizDetail(detail);
      notify.success("Question deleted");
      setDeleteQuestionTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to delete question");
    } finally {
      setDeleteQuestionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteQuizGroup(deleteTarget.representativeId);
      notify.success("Quiz deleted");
      setQuizGroups((prev) => prev.filter((g) => g.representativeId !== deleteTarget.representativeId));
      setDeleteTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to delete quiz");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredBankQuestions = bankQuestions.filter(
    (q) => !bankSearch || q.question.toLowerCase().includes(bankSearch.toLowerCase()) || (q.subject ?? "").toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">My Quizzes</h4>
            <p className="text-muted mb-0 mt-1">Create and manage quizzes for your students</p>
          </div>
          <div className="d-flex gap-2">
            {mainTab === "quizzes" && (
              <>
                <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1" onClick={loadQuizzes} disabled={loading}>
                  <i className="ti ti-refresh" />
                  Refresh
                </button>
                <button
                  type="button"
                  className="btn btn-primary d-inline-flex align-items-center gap-1"
                  onClick={() => setShowCreate(true)}
                  disabled={coursesLoading || teacherCourses.length === 0}
                >
                  <i className="ti ti-plus" />
                  Create Quiz
                </button>
              </>
            )}
            {mainTab === "results" && (
              <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1" onClick={loadResults} disabled={resultsLoading}>
                <i className="ti ti-refresh" />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${mainTab === "quizzes" ? "active" : ""}`} onClick={() => setMainTab("quizzes")}>
              <i className="ti ti-help-circle me-1" />
              My Quizzes
              {!loading && <span className="badge badge-soft-primary ms-2">{quizGroups.length}</span>}
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${mainTab === "results" ? "active" : ""}`} onClick={() => { setMainTab("results"); if (results.length === 0 && !resultsLoading) loadResults(); }}>
              <i className="ti ti-chart-bar me-1" />
              Results
              {!resultsLoading && results.length > 0 && <span className="badge badge-soft-success ms-2">{results.length}</span>}
            </button>
          </li>
        </ul>

        {mainTab === "quizzes" && (loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : quizGroups.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-help-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Quizzes Yet</h5>
              <p className="text-muted mb-2">Click &ldquo;Create Quiz&rdquo; to create your first quiz.</p>
              {teacherCourses.length === 0 && !coursesLoading && (
                <p className="text-warning small mb-0">
                  <i className="ti ti-alert-triangle me-1" />
                  You need courses assigned before creating quizzes.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="row g-3">
            {quizGroups.map((group) => (
              <div key={group.representativeId} className="col-lg-4 col-md-6">
                <div className="card h-100">
                  <div
                    className="rounded-top"
                    style={{
                      height: 4,
                      background: group.status === "rejected" ? "var(--bs-danger)" : group.status === "pending" ? "var(--bs-warning)" : "var(--bs-primary)",
                    }}
                  />
                  <div className="card-body d-flex flex-column">
                    {/* Header row */}
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div className="flex-grow-1">
                        <h6 className="fw-bold mb-1">{group.title}</h6>
                        {group.status === "pending" && <span className="badge bg-warning text-dark" style={{ fontSize: 10 }}>Pending Approval</span>}
                        {group.status === "rejected" && <span className="badge bg-danger" style={{ fontSize: 10 }}>Rejected</span>}
                        {(!group.status || group.status === "active") && <span className="badge bg-success" style={{ fontSize: 10 }}>Active</span>}
                      </div>
                      <div className="d-flex gap-1 flex-shrink-0">
                        <button type="button" className="btn btn-outline-primary btn-icon btn-sm" title="Edit Quiz" onClick={() => openEditModal(group)}>
                          <i className="ti ti-edit" />
                        </button>
                        <button type="button" className="btn btn-outline-danger btn-icon btn-sm" title="Delete Quiz" onClick={() => setDeleteTarget(group)}>
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </div>

                    {group.instructions && (
                      <p className="text-muted mb-3" style={{ fontSize: 13, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {group.instructions}
                      </p>
                    )}

                    <div className="mt-auto">
                      <hr className="my-2" />
                      <div className="row g-2 text-center mb-3">
                        <div className="col-4">
                          <div style={{ fontSize: 11 }} className="text-muted text-uppercase fw-medium">Duration</div>
                          <div className="fw-bold" style={{ fontSize: 13 }}>{group.duration != null ? `${group.duration}m` : "—"}</div>
                        </div>
                        <div className="col-4">
                          <div style={{ fontSize: 11 }} className="text-muted text-uppercase fw-medium">Pass</div>
                          <div className="fw-bold" style={{ fontSize: 13 }}>{group.passingScore != null ? `${group.passingScore}%` : "—"}</div>
                        </div>
                        <div className="col-4">
                          <div style={{ fontSize: 11 }} className="text-muted text-uppercase fw-medium">Students</div>
                          <div className="fw-bold" style={{ fontSize: 13 }}>{group.studentCount}</div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center justify-content-between">
                        <small className="text-muted">
                          <i className="ti ti-calendar me-1" />
                          {formatDate(group.createdAt)}
                        </small>
                        <button type="button" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1" onClick={() => openManageQuestions(group)}>
                          <i className="ti ti-list-check" />
                          Questions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {mainTab === "results" && (
          <div>
            {/* Search */}
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search by student or quiz title..."
                value={resultsSearch}
                onChange={(e) => setResultsSearch(e.target.value)}
              />
            </div>
            {resultsLoading ? (
              <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status" /></div>
            ) : results.length === 0 ? (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-chart-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Results Yet</h5>
                  <div className="text-muted">No students have attempted your quizzes yet.</div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover table-stack align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Student</th>
                          <th>Quiz</th>
                          <th>Score</th>
                          <th>Result</th>
                          <th>Duration</th>
                          <th>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results
                          .filter((r) => {
                            if (!resultsSearch) return true;
                            const s = resultsSearch.toLowerCase();
                            const studentName = r.Student ? `${r.Student.firstName} ${r.Student.lastName}`.toLowerCase() : "";
                            const quizTitle = (r.Quiz?.title ?? "").toLowerCase();
                            return studentName.includes(s) || quizTitle.includes(s);
                          })
                          .map((r) => {
                            const studentName = r.Student ? `${r.Student.firstName} ${r.Student.lastName}` : `Student #${r.studentId}`;
                            const quizTitle = r.Quiz?.title ?? `Quiz #${r.quizId}`;
                            const score = r.score != null ? Math.round(r.score) : null;
                            const passed = score != null && r.Quiz?.passingScore != null ? score >= r.Quiz.passingScore : null;
                            const durationMs = r.startTime && r.endTime ? new Date(r.endTime).getTime() - new Date(r.startTime).getTime() : null;
                            const durationMin = durationMs != null ? Math.round(durationMs / 60000) : null;
                            return (
                              <tr key={r.id}>
                                <td data-label="Student">
                                  <div className="fw-medium">{studentName}</div>
                                </td>
                                <td data-label="Quiz">
                                  <div className="fw-medium small">{quizTitle}</div>
                                  {r.Quiz?.passingScore != null && (
                                    <div className="text-muted" style={{ fontSize: 11 }}>Pass: {r.Quiz.passingScore}%</div>
                                  )}
                                </td>
                                <td data-label="Score">
                                  <span className="fw-bold fs-15">{score != null ? `${score}%` : "—"}</span>
                                </td>
                                <td data-label="Result">
                                  {passed === null ? <span className="badge bg-secondary">—</span>
                                    : passed ? <span className="badge bg-success">Passed</span>
                                    : <span className="badge bg-danger">Failed</span>}
                                </td>
                                <td data-label="Duration" className="text-muted small">{durationMin != null ? `${durationMin} min` : "—"}</td>
                                <td data-label="Completed" className="text-muted small">
                                  {r.endTime ? new Date(r.endTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
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
          </div>
        )}
      </div>

      {/* ── Create Quiz Modal ── */}
      {showCreate && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title fw-bold text-dark">Create Quiz</h4>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} disabled={createLoading}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-medium">Course <span className="text-danger">*</span></label>
                      <select className="form-select" value={createCourseId} onChange={(e) => setCreateCourseId(e.target.value)} disabled={createLoading}>
                        <option value="">Select a course...</option>
                        {teacherCourses.map((c) => <option key={c.courseId} value={c.courseId}>{c.courseName}</option>)}
                      </select>
                    </div>
                    {createCourseId && (
                      <div className="col-12">
                        <label className="form-label fw-medium">
                          Assign To Students
                          <span className="text-muted fw-normal ms-2" style={{ fontSize: 12 }}>
                            {selectedStudentIds.length}/{enrolledStudents.length} selected
                          </span>
                        </label>
                        {studentsLoading ? (
                          <div className="py-2"><div className="spinner-border spinner-border-sm text-primary" role="status" /></div>
                        ) : enrolledStudents.length === 0 ? (
                          <div className="text-muted small">No students enrolled in this course.</div>
                        ) : (
                          <div className="border rounded p-2" style={{ maxHeight: 180, overflowY: "auto" }}>
                            <div className="mb-2">
                              <button type="button" className="btn btn-link btn-sm p-0 text-primary me-3" onClick={() => setSelectedStudentIds(enrolledStudents.map((s) => s.id))}>Select All</button>
                              <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={() => setSelectedStudentIds([])}>Deselect All</button>
                            </div>
                            {enrolledStudents.map((s) => (
                              <div key={s.id} className="form-check mb-1">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`stu-${s.id}`}
                                  checked={selectedStudentIds.includes(s.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedStudentIds((prev) => [...prev, s.id]);
                                    else setSelectedStudentIds((prev) => prev.filter((id) => id !== s.id));
                                  }}
                                />
                                <label className="form-check-label small" htmlFor={`stu-${s.id}`}>
                                  {s.firstName} {s.lastName}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label fw-medium">Quiz Title <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" placeholder="e.g. Chapter 3 Quiz" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} disabled={createLoading} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Instructions <span className="text-muted fw-normal">(optional)</span></label>
                      <textarea className="form-control" rows={2} placeholder="e.g. Read each question carefully..." value={createInstructions} onChange={(e) => setCreateInstructions(e.target.value)} disabled={createLoading} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Duration (minutes) <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" placeholder="e.g. 30" min={1} value={createDuration} onChange={(e) => setCreateDuration(e.target.value)} disabled={createLoading} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Passing Score (%) <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" placeholder="e.g. 70" min={0} max={100} value={createPassingScore} onChange={(e) => setCreatePassingScore(e.target.value)} disabled={createLoading} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { if (!createLoading) { setShowCreate(false); resetCreateForm(); } }} disabled={createLoading}>Cancel</button>
                  <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleCreate} disabled={createLoading}>
                    {createLoading && <span className="spinner-border spinner-border-sm" role="status" />}
                    <i className="ti ti-plus" />
                    Create Quiz
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Quiz Modal ── */}
      {editTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!editLoading) setEditTarget(null); }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title fw-bold text-dark">
                    Edit Quiz
                    {editTarget.status === "rejected" && (
                      <span className="badge bg-danger ms-2" style={{ fontSize: 12 }}>Rejected — saving will resubmit for approval</span>
                    )}
                  </h4>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { if (!editLoading) setEditTarget(null); }} disabled={editLoading}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-medium">Quiz Title <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} disabled={editLoading} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Instructions</label>
                      <textarea className="form-control" rows={2} value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} disabled={editLoading} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Duration (minutes) <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" min={1} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} disabled={editLoading} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Passing Score (%) <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" min={0} max={100} value={editPassingScore} onChange={(e) => setEditPassingScore(e.target.value)} disabled={editLoading} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-primary d-inline-flex align-items-center gap-1"
                    disabled={editLoading}
                    onClick={() => {
                      const target = editTarget!;
                      setEditTarget(null);
                      openManageQuestions(target);
                    }}
                  >
                    <i className="ti ti-list-check" />
                    View / Edit Questions
                  </button>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-light border" onClick={() => { if (!editLoading) setEditTarget(null); }} disabled={editLoading}>Cancel</button>
                    <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleEdit} disabled={editLoading}>
                      {editLoading && <span className="spinner-border spinner-border-sm" role="status" />}
                      <i className="ti ti-device-floppy" />
                      {editTarget.status === "rejected" ? "Save & Resubmit" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Manage Questions Modal ── */}
      {questionTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!qAddLoading) { setQuestionTarget(null); setQuizDetail(null); resetQForm(); } }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h4 className="modal-title fw-bold text-dark mb-0">{questionTarget.title}</h4>
                    <small className="text-muted">Manage Questions</small>
                  </div>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { if (!qAddLoading) { setQuestionTarget(null); setQuizDetail(null); resetQForm(); } }}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  {/* Existing questions */}
                  {questionDetailLoading ? (
                    <div className="text-center py-3"><div className="spinner-border text-primary spinner-border-sm" role="status" /></div>
                  ) : (quizDetail?.Questions?.length ?? 0) === 0 ? (
                    <div className="text-center py-3 text-muted">
                      <i className="ti ti-help-circle fs-48 d-block mb-2" />
                      No questions yet. Add your first question below.
                    </div>
                  ) : (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3">
                        Questions <span className="badge badge-soft-info ms-1">{quizDetail!.Questions!.length}</span>
                      </h6>
                      <div className="d-flex flex-column gap-2">
                        {quizDetail!.Questions!.map((q, idx) => {
                          const options = normalizeOptions(q.options);
                          return (
                          <div key={q.id} className="d-flex align-items-start gap-3 p-3 bg-light rounded">
                            <div className="flex-shrink-0 fw-bold text-muted" style={{ fontSize: 13, minWidth: 24 }}>{idx + 1}.</div>
                            <div className="flex-grow-1">
                              <div className="fw-medium" style={{ fontSize: 13 }}>{q.question}</div>
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <span className="badge badge-soft-secondary">{q.type.replace("_", " ")}</span>
                                {options.length > 0 && (
                                  <span className="text-muted" style={{ fontSize: 12 }}>{options.join(" / ")}</span>
                                )}
                              </div>
                              <div className="text-success" style={{ fontSize: 12 }}>
                                <i className="ti ti-check me-1" />
                                {q.correctAnswer}
                              </div>
                            </div>
                            <button type="button" className="btn btn-outline-danger btn-icon btn-sm flex-shrink-0" title="Delete question" onClick={() => setDeleteQuestionTarget(q)}>
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <hr />

                  {/* Add question tabs */}
                  <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                      <button className={`nav-link ${questionsTab === "add" ? "active" : ""}`} onClick={() => setQuestionsTab("add")}>
                        <i className="ti ti-plus me-1" />
                        Add New Question
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${questionsTab === "bank" ? "active" : ""}`}
                        onClick={() => {
                          setQuestionsTab("bank");
                          if (bankQuestions.length === 0) loadBankQuestions();
                        }}
                      >
                        <i className="ti ti-database me-1" />
                        From Question Bank
                        {bankQuestions.length > 0 && <span className="badge badge-soft-info ms-2">{bankQuestions.length}</span>}
                      </button>
                    </li>
                  </ul>

                  {/* Add question form */}
                  {questionsTab === "add" && (
                    <>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label fw-medium">Type</label>
                          <select className="form-select" value={qType} onChange={(e) => { setQType(e.target.value as QuestionType); setQCorrect(""); }} disabled={qAddLoading}>
                            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-medium">Question <span className="text-danger">*</span></label>
                          <textarea className="form-control" rows={2} placeholder="Enter your question..." value={qText} onChange={(e) => setQText(e.target.value)} disabled={qAddLoading} />
                        </div>

                        {qType === "multiple_choice" && (
                          <>
                            <div className="col-12">
                              <label className="form-label fw-medium">Options</label>
                              <div className="d-flex flex-column gap-2">
                                {qOptions.map((opt, i) => (
                                  <div key={i} className="input-group">
                                    <span className="input-group-text" style={{ fontSize: 13 }}>{String.fromCharCode(65 + i)}</span>
                                    <input type="text" className="form-control" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => { const next = [...qOptions]; next[i] = e.target.value; setQOptions(next); }} disabled={qAddLoading} />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="col-12">
                              <label className="form-label fw-medium">Correct Answer <span className="text-danger">*</span></label>
                              <select className="form-select" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={qAddLoading}>
                                <option value="">Select correct option...</option>
                                {qOptions.filter((o) => o.trim()).map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}

                        {qType === "true_false" && (
                          <div className="col-md-6">
                            <label className="form-label fw-medium">Correct Answer <span className="text-danger">*</span></label>
                            <select className="form-select" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={qAddLoading}>
                              <option value="">Select...</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          </div>
                        )}

                        {qType === "short_answer" && (
                          <div className="col-12">
                            <label className="form-label fw-medium">Correct Answer Keywords <span className="text-danger">*</span></label>
                            <input type="text" className="form-control" placeholder="e.g. photosynthesis, chlorophyll (comma-separated)" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={qAddLoading} />
                            <div className="form-text">Separate keywords with commas. Student answers are graded by keyword matching.</div>
                          </div>
                        )}

                        <div className="col-12">
                          <div className="p-3 bg-light rounded border">
                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="saveToBank"
                                checked={qSaveToBank}
                                onChange={(e) => setQSaveToBank(e.target.checked)}
                                disabled={qAddLoading}
                              />
                              <label className="form-check-label fw-medium" htmlFor="saveToBank">
                                <i className="ti ti-database me-1 text-primary" />
                                Also save to Question Bank
                              </label>
                              <div className="form-text mt-0">Save this question for reuse in other quizzes</div>
                            </div>
                            {qSaveToBank && (
                              <input
                                type="text"
                                className="form-control form-control-sm mt-2"
                                placeholder="Subject / topic (optional, e.g. Mathematics)"
                                value={qSubject}
                                onChange={(e) => setQSubject(e.target.value)}
                                disabled={qAddLoading}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-12">
                          <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleAddQuestion} disabled={qAddLoading}>
                            {qAddLoading && <span className="spinner-border spinner-border-sm" role="status" />}
                            <i className="ti ti-plus" />
                            Add Question
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Question Bank tab */}
                  {questionsTab === "bank" && (
                    <>
                      <div className="mb-3">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search questions or subjects..."
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                        />
                      </div>
                      {bankLoading ? (
                        <div className="text-center py-3"><div className="spinner-border text-primary spinner-border-sm" role="status" /></div>
                      ) : filteredBankQuestions.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                          <i className="ti ti-database-off fs-48 d-block mb-2" />
                          {bankQuestions.length === 0 ? "No questions in the bank yet. Add questions to the bank first." : "No questions match your search."}
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                          {filteredBankQuestions.map((q) => {
                            const options = normalizeOptions(q.options);
                            return (
                            <div key={q.id} className="d-flex align-items-start gap-3 p-3 border rounded">
                              <div className="flex-grow-1">
                                <div className="fw-medium" style={{ fontSize: 13 }}>{q.question}</div>
                                <div className="d-flex align-items-center gap-2 mt-1">
                                  <span className="badge badge-soft-secondary">{q.type.replace("_", " ")}</span>
                                  {q.subject && <span className="badge badge-soft-info">{q.subject}</span>}
                                  {options.length > 0 && (
                                    <span className="text-muted" style={{ fontSize: 12 }}>{options.join(" / ")}</span>
                                  )}
                                </div>
                                <div className="text-success" style={{ fontSize: 12 }}>
                                  <i className="ti ti-check me-1" />
                                  {q.correctAnswer}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1"
                                disabled={bankAddingId === q.id}
                                onClick={() => handleAddFromBank(q)}
                              >
                                {bankAddingId === q.id
                                  ? <span className="spinner-border spinner-border-sm" role="status" />
                                  : <i className="ti ti-plus" />
                                }
                                Add
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { setQuestionTarget(null); setQuizDetail(null); resetQForm(); }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete question confirmation */}
      <ConfirmationModal
        open={!!deleteQuestionTarget}
        title="Delete Question?"
        icon={<i className="ti ti-alert-triangle" />}
        description={
          deleteQuestionTarget ? (
            <>Remove the question: <strong>&ldquo;{deleteQuestionTarget.question}&rdquo;</strong>?</>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deleteQuestionLoading}
        onConfirm={handleDeleteQuestion}
        onCancel={() => { if (!deleteQuestionLoading) setDeleteQuestionTarget(null); }}
      />

      {/* Delete quiz group confirmation */}
      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete Quiz?"
        icon={<i className="ti ti-alert-triangle" />}
        description={
          deleteTarget ? (
            <>Delete <strong>{deleteTarget.title}</strong>? This will remove the quiz and all its questions for all {deleteTarget.studentCount} enrolled student{deleteTarget.studentCount !== 1 ? "s" : ""}.</>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deleteLoading}
        onConfirm={handleDeleteGroup}
        onCancel={() => { if (!deleteLoading) setDeleteTarget(null); }}
      />
    </div>
  );
};

export default TeacherQuizList;
