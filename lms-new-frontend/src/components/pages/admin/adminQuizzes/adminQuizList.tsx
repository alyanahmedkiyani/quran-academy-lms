"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { useTeachers } from "@/hooks/useTeachers";
import { useNotification } from "@/hooks/useNotification";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { normalizeOptions } from "@/lib/questionBank";
import {
  fetchAllQuizzesAdmin,
  createQuiz,
  approveQuiz,
  rejectQuiz,
  deleteQuizGroup,
  fetchQuizWithQuestions,
  addQuizQuestion,
  deleteQuestion,
  fetchAdminQuizResults,
  fetchEnrolledStudents,
} from "@/services/quizService";
import { fetchQuestionBank, createBankQuestion } from "@/services/questionBankService";
import { fetchCoursesByTeacherId } from "@/services/courseDetailsService";
import {
  QuizGroup,
  QuizWithQuestions,
  QuizQuestion,
  QuestionType,
  QuestionBankEntry,
  ContentStatus,
  QuizResult,
  EnrolledStudent,
} from "@/types/quiz";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import StatsCards, { StatCardItem } from "@/core/common/statsCards/StatsCards";

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const StatusBadge = ({ status }: { status?: ContentStatus }) => {
  if (status === "pending") return <span className="badge bg-warning text-dark">Pending</span>;
  if (status === "rejected") return <span className="badge bg-danger">Rejected</span>;
  return <span className="badge bg-success">Active</span>;
};

interface CourseOption { courseId: string; courseName: string; }

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
];

const AdminQuizList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const notify = useNotification();
  const { allItems: teachers, loading: teachersLoading, loadTeachers } = useTeachers();

  usePermissionGuard(PERMISSIONS.QUIZZES_VIEW);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canApprove = canAccess(roleName, permissions, PERMISSIONS.QUIZZES_APPROVE);

  // Main tabs
  const [mainTab, setMainTab] = useState<"all" | "pending" | "results">("all");
  const [quizGroups, setQuizGroups] = useState<QuizGroup[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  // Results state
  const [results, setResults] = useState<QuizResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsSearch, setResultsSearch] = useState("");

  // Student filter for create modal
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [createCourseId, setCreateCourseId] = useState("");
  const [teacherCourses, setTeacherCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createInstructions, setCreateInstructions] = useState("");
  const [createDuration, setCreateDuration] = useState("");
  const [createPassingScore, setCreatePassingScore] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Approval
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Delete quiz group
  const [deleteTarget, setDeleteTarget] = useState<QuizGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const loadQuizzes = () => {
    setLoadingQuizzes(true);
    fetchAllQuizzesAdmin()
      .then((res) => setQuizGroups(res.quizzes))
      .catch((err) => notify.error(err.message ?? "Failed to load quizzes"))
      .finally(() => setLoadingQuizzes(false));
  };

  const loadResults = () => {
    setResultsLoading(true);
    fetchAdminQuizResults()
      .then((res) => setResults(res.results))
      .catch(() => setResults([]))
      .finally(() => setResultsLoading(false));
  };

  useEffect(() => {
    loadTeachers();
    loadQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load courses when teacher is selected
  useEffect(() => {
    if (!createTeacherId) { setTeacherCourses([]); return; }
    setCoursesLoading(true);
    setCreateCourseId("");
    fetchCoursesByTeacherId(createTeacherId)
      .then((res) => {
        const courses: CourseOption[] = Array.from(
          new Map(
            res.course.map((cd) => [String(cd.courseId), { courseId: String(cd.courseId), courseName: (cd as any).Course?.courseName ?? `Course ${cd.courseId}` }])
          ).values()
        );
        setTeacherCourses(courses);
      })
      .catch(() => setTeacherCourses([]))
      .finally(() => setCoursesLoading(false));
  }, [createTeacherId]);

  useEffect(() => {
    if (!createTeacherId || !createCourseId) {
      setEnrolledStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    setStudentsLoading(true);
    fetchEnrolledStudents(createTeacherId, createCourseId)
      .then((res) => {
        setEnrolledStudents(res.students);
        setSelectedStudentIds(res.students.map((s) => s.id));
      })
      .catch(() => { setEnrolledStudents([]); setSelectedStudentIds([]); })
      .finally(() => setStudentsLoading(false));
  }, [createTeacherId, createCourseId]);

  const resetCreateForm = () => {
    setCreateTeacherId("");
    setCreateCourseId("");
    setCreateTitle("");
    setCreateInstructions("");
    setCreateDuration("");
    setCreatePassingScore("");
    setEnrolledStudents([]);
    setSelectedStudentIds([]);
  };

  const handleCreate = async () => {
    if (!createTeacherId) { notify.error("Please select a teacher."); return; }
    if (!createCourseId) { notify.error("Please select a course."); return; }
    if (!createTitle.trim()) { notify.error("Please enter a quiz title."); return; }
    const dur = Number(createDuration);
    const pass = Number(createPassingScore);
    if (!createDuration || isNaN(dur) || dur <= 0) { notify.error("Please enter a valid duration."); return; }
    if (!createPassingScore || isNaN(pass) || pass < 0 || pass > 100) { notify.error("Passing score must be 0–100."); return; }

    const titleToFind = createTitle.trim();
    const teacherIdToFind = createTeacherId;
    setCreateLoading(true);
    try {
      await createQuiz({
        courseId: createCourseId,
        teacherId: teacherIdToFind,
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
      const res = await fetchAllQuizzesAdmin();
      setQuizGroups(res.quizzes);
      const newGroup = (res.quizzes as QuizGroup[]).find(
        (g) => g.title === titleToFind && String(g.teacherId) === String(teacherIdToFind)
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

  const handleApprove = async (representativeId: number) => {
    setApprovingId(representativeId);
    try {
      await approveQuiz(representativeId);
      notify.success("Quiz approved");
      loadQuizzes();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to approve");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (representativeId: number) => {
    setRejectingId(representativeId);
    try {
      await rejectQuiz(representativeId);
      notify.success("Quiz rejected");
      loadQuizzes();
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to reject");
    } finally {
      setRejectingId(null);
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
      setQuizDetail({ id: group.representativeId, title: group.title, Questions: [] });
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
      if (qOptions.filter((o) => o.trim()).length < 2) { notify.error("Please provide at least 2 options."); return; }
      if (!qCorrect.trim()) { notify.error("Please specify the correct answer."); return; }
    }
    if ((qType === "true_false" || qType === "short_answer") && !qCorrect.trim()) { notify.error("Correct answer is required."); return; }
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

  const displayed = mainTab === "pending"
    ? quizGroups.filter((g) => g.status === "pending")
    : quizGroups;

  const pendingCount = quizGroups.filter((g) => g.status === "pending").length;
  const filteredBankQuestions = bankQuestions.filter(
    (q) => !bankSearch || q.question.toLowerCase().includes(bankSearch.toLowerCase()) || (q.subject ?? "").toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Quizzes
              {pendingCount > 0 && (
                <span className="badge bg-warning text-dark fw-medium border py-1 px-2 border-warning fs-13 ms-2">
                  {pendingCount} pending
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Manage all quizzes and approve pending submissions</p>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1" onClick={loadQuizzes} disabled={loadingQuizzes}>
              <i className="ti ti-refresh" />
              Refresh
            </button>
            {canApprove && (
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-1" onClick={() => setShowCreate(true)}>
                <i className="ti ti-plus" />
                Create Quiz
              </button>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        {(() => {
          const total    = quizGroups.length;
          const active   = quizGroups.filter((g) => g.status === "active").length;
          const pending  = quizGroups.filter((g) => g.status === "pending").length;
          const rejected = quizGroups.filter((g) => g.status === "rejected").length;
          const totalStudents = quizGroups.reduce((s, g) => s + (g.studentCount ?? 0), 0);
          const cards: StatCardItem[] = [
            {
              label: "Total Quizzes",
              value: total,
              icon: "ti-help-circle",
              hex: "#2E37A4",
              spark: [18, 28, 22, 35, 25, 42, 38, 50, 44, 58],
            },
            {
              label: "Active",
              value: active,
              icon: "ti-circle-check",
              hex: "#27AE60",
              spark: [30, 42, 35, 50, 40, 60, 52, 68, 58, 75],
            },
            {
              label: "Pending Approval",
              value: pending,
              icon: "ti-hourglass",
              hex: pending > 0 ? "#F2994A" : "#858D9C",
              spark: [45, 32, 40, 28, 38, 22, 30, 18, 25, 15],
            },
            {
              label: "Rejected",
              value: rejected,
              icon: "ti-circle-x",
              hex: rejected > 0 ? "#EB5757" : "#858D9C",
              spark: [40, 30, 35, 22, 28, 18, 24, 14, 20, 12],
            },
            {
              label: "Students Assigned",
              value: totalStudents,
              icon: "ti-users",
              hex: "#2F80ED",
              spark: [20, 35, 28, 45, 32, 50, 40, 58, 48, 65],
            },
          ];
          return <StatsCards cards={cards} loading={loadingQuizzes} />;
        })()}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${mainTab === "all" ? "active" : ""}`} onClick={() => setMainTab("all")}>
              <i className="ti ti-help-circle me-1" />
              All Quizzes
              {!loadingQuizzes && <span className="badge badge-soft-primary ms-2">{quizGroups.length}</span>}
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${mainTab === "pending" ? "active" : ""}`} onClick={() => setMainTab("pending")}>
              <i className="ti ti-hourglass me-1" />
              Pending Approval
              {pendingCount > 0 && <span className="badge bg-warning text-dark ms-2">{pendingCount}</span>}
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

        {(mainTab === "all" || mainTab === "pending") && (
          loadingQuizzes ? (
            <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" role="status" /></div>
          ) : displayed.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-5">
                <i className="ti ti-help-off fs-48 text-muted mb-3 d-block" />
                <h5 className="fw-bold text-muted">{mainTab === "pending" ? "No Pending Quizzes" : "No Quizzes Yet"}</h5>
                <div className="text-muted">{mainTab === "pending" ? "All quizzes are approved." : "Create a quiz to get started."}</div>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {displayed.map((group) => (
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
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <div className="flex-grow-1">
                          <h6 className="fw-bold mb-1">{group.title}</h6>
                          <StatusBadge status={group.status} />
                        </div>
                        {canApprove && (
                          <button type="button" className="btn btn-outline-danger btn-icon btn-sm" title="Delete" onClick={() => setDeleteTarget(group)}>
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>

                      {group.teacherName && (
                        <div className="text-muted mb-1" style={{ fontSize: 12 }}>
                          <i className="ti ti-user me-1" />
                          {group.teacherName}
                        </div>
                      )}
                      {group.courseName && (
                        <div className="mb-2">
                          <span className="badge badge-soft-info border border-info">{group.courseName}</span>
                        </div>
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

                        <div className="d-flex flex-column gap-2">
                          {canApprove && group.status === "pending" && (
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-success btn-sm flex-fill d-inline-flex align-items-center justify-content-center gap-1"
                                disabled={approvingId === group.representativeId}
                                onClick={() => handleApprove(group.representativeId)}
                              >
                                {approvingId === group.representativeId ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-check" />}
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm flex-fill d-inline-flex align-items-center justify-content-center gap-1"
                                disabled={rejectingId === group.representativeId}
                                onClick={() => handleReject(group.representativeId)}
                              >
                                {rejectingId === group.representativeId ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-x" />}
                                Reject
                              </button>
                            </div>
                          )}
                          {canApprove && group.status === "rejected" && (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm d-inline-flex align-items-center justify-content-center gap-1"
                              disabled={approvingId === group.representativeId}
                              onClick={() => handleApprove(group.representativeId)}
                            >
                              {approvingId === group.representativeId ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-check" />}
                              Approve
                            </button>
                          )}
                          {canApprove && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center justify-content-center gap-1"
                              onClick={() => openManageQuestions(group)}
                            >
                              <i className="ti ti-list-check" />
                              Manage Questions
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {mainTab === "results" && (
          <div>
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search by student, quiz, or teacher..."
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
                  <div className="text-muted">No students have attempted any quizzes yet.</div>
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
                          <th>Teacher</th>
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
                            const teacherName = r.Quiz?.Teacher ? `${r.Quiz.Teacher.firstName} ${r.Quiz.Teacher.lastName}`.toLowerCase() : "";
                            return studentName.includes(s) || quizTitle.includes(s) || teacherName.includes(s);
                          })
                          .map((r) => {
                            const studentName = r.Student ? `${r.Student.firstName} ${r.Student.lastName}` : `Student #${r.studentId}`;
                            const quizTitle = r.Quiz?.title ?? `Quiz #${r.quizId}`;
                            const teacherName = r.Quiz?.Teacher ? `${r.Quiz.Teacher.firstName} ${r.Quiz.Teacher.lastName}` : "—";
                            const score = r.score != null ? Math.round(r.score) : null;
                            const passed = score != null && r.Quiz?.passingScore != null ? score >= r.Quiz.passingScore : null;
                            const durationMs = r.startTime && r.endTime ? new Date(r.endTime).getTime() - new Date(r.startTime).getTime() : null;
                            const durationMin = durationMs != null ? Math.round(durationMs / 60000) : null;
                            return (
                              <tr key={r.id}>
                                <td data-label="Student"><div className="fw-medium">{studentName}</div></td>
                                <td data-label="Quiz">
                                  <div className="fw-medium small">{quizTitle}</div>
                                  {r.Quiz?.passingScore != null && <div className="text-muted" style={{ fontSize: 11 }}>Pass: {r.Quiz.passingScore}%</div>}
                                </td>
                                <td data-label="Teacher" className="text-muted small">{teacherName}</td>
                                <td data-label="Score"><span className="fw-bold fs-15">{score != null ? `${score}%` : "—"}</span></td>
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
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Teacher <span className="text-danger">*</span></label>
                      <select className="form-select" value={createTeacherId} onChange={(e) => setCreateTeacherId(e.target.value)} disabled={createLoading || teachersLoading}>
                        <option value="">Select teacher...</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={String(t.id)}>{t.firstName} {t.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Course <span className="text-danger">*</span></label>
                      <select className="form-select" value={createCourseId} onChange={(e) => setCreateCourseId(e.target.value)} disabled={createLoading || !createTeacherId || coursesLoading}>
                        <option value="">{coursesLoading ? "Loading courses..." : "Select course..."}</option>
                        {teacherCourses.map((c) => (
                          <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
                        ))}
                      </select>
                    </div>
                    {createTeacherId && createCourseId && (
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
                          <div className="text-muted small">No students enrolled in this course under this teacher.</div>
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
                      <textarea className="form-control" rows={2} value={createInstructions} onChange={(e) => setCreateInstructions(e.target.value)} disabled={createLoading} />
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
                      No questions yet.
                    </div>
                  ) : (
                    <div className="mb-4">
                      <h6 className="fw-bold mb-3">Questions <span className="badge badge-soft-info ms-1">{quizDetail!.Questions!.length}</span></h6>
                      <div className="d-flex flex-column gap-2">
                        {quizDetail!.Questions!.map((q, idx) => {
                          const options = normalizeOptions(q.options);
                          return (
                          <div key={q.id} className="d-flex align-items-start gap-3 p-3 bg-light rounded">
                            <div className="flex-shrink-0 fw-bold text-muted" style={{ fontSize: 13, minWidth: 24 }}>{idx + 1}.</div>
                            <div className="flex-grow-1">
                              <div className="fw-medium" style={{ fontSize: 13 }}>{q.question}</div>
                              <div className="d-flex gap-2 mt-1">
                                <span className="badge badge-soft-secondary">{q.type.replace("_", " ")}</span>
                                {options.length > 0 && <span className="text-muted" style={{ fontSize: 12 }}>{options.join(" / ")}</span>}
                              </div>
                              <div className="text-success" style={{ fontSize: 12 }}><i className="ti ti-check me-1" />{q.correctAnswer}</div>
                            </div>
                            <button type="button" className="btn btn-outline-danger btn-icon btn-sm flex-shrink-0" onClick={() => setDeleteQuestionTarget(q)}>
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <hr />

                  <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                      <button className={`nav-link ${questionsTab === "add" ? "active" : ""}`} onClick={() => setQuestionsTab("add")}>
                        <i className="ti ti-plus me-1" />Add New
                      </button>
                    </li>
                    <li className="nav-item">
                      <button className={`nav-link ${questionsTab === "bank" ? "active" : ""}`} onClick={() => { setQuestionsTab("bank"); if (bankQuestions.length === 0) loadBankQuestions(); }}>
                        <i className="ti ti-database me-1" />From Bank
                        {bankQuestions.length > 0 && <span className="badge badge-soft-info ms-1">{bankQuestions.length}</span>}
                      </button>
                    </li>
                  </ul>

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
                          <textarea className="form-control" rows={2} value={qText} onChange={(e) => setQText(e.target.value)} disabled={qAddLoading} />
                        </div>
                        {qType === "multiple_choice" && (
                          <>
                            <div className="col-12">
                              <label className="form-label fw-medium">Options</label>
                              <div className="d-flex flex-column gap-2">
                                {qOptions.map((opt, i) => (
                                  <div key={i} className="input-group">
                                    <span className="input-group-text">{String.fromCharCode(65 + i)}</span>
                                    <input type="text" className="form-control" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => { const n = [...qOptions]; n[i] = e.target.value; setQOptions(n); }} disabled={qAddLoading} />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="col-12">
                              <label className="form-label fw-medium">Correct Answer</label>
                              <select className="form-select" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={qAddLoading}>
                                <option value="">Select...</option>
                                {qOptions.filter((o) => o.trim()).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </>
                        )}
                        {qType === "true_false" && (
                          <div className="col-md-6">
                            <label className="form-label fw-medium">Correct Answer</label>
                            <select className="form-select" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={qAddLoading}>
                              <option value="">Select...</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          </div>
                        )}
                        {qType === "short_answer" && (
                          <div className="col-12">
                            <label className="form-label fw-medium">Answer Keywords</label>
                            <input type="text" className="form-control" placeholder="comma-separated keywords" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={qAddLoading} />
                          </div>
                        )}
                        <div className="col-12">
                          <div className="p-3 bg-light rounded border">
                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="adminSaveToBank"
                                checked={qSaveToBank}
                                onChange={(e) => setQSaveToBank(e.target.checked)}
                                disabled={qAddLoading}
                              />
                              <label className="form-check-label fw-medium" htmlFor="adminSaveToBank">
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
                            <i className="ti ti-plus" />Add Question
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {questionsTab === "bank" && (
                    <>
                      <input type="text" className="form-control mb-3" placeholder="Search..." value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} />
                      {bankLoading ? (
                        <div className="text-center py-3"><div className="spinner-border text-primary spinner-border-sm" role="status" /></div>
                      ) : filteredBankQuestions.length === 0 ? (
                        <div className="text-center py-4 text-muted">No questions found.</div>
                      ) : (
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                          {filteredBankQuestions.map((q) => (
                            <div key={q.id} className="d-flex align-items-start gap-3 p-3 border rounded">
                              <div className="flex-grow-1">
                                <div className="fw-medium" style={{ fontSize: 13 }}>{q.question}</div>
                                <div className="d-flex gap-2 mt-1">
                                  <span className="badge badge-soft-secondary">{q.type.replace("_", " ")}</span>
                                  {q.subject && <span className="badge badge-soft-info">{q.subject}</span>}
                                </div>
                                <div className="text-success" style={{ fontSize: 12 }}><i className="ti ti-check me-1" />{q.correctAnswer}</div>
                              </div>
                              <button type="button" className="btn btn-outline-primary btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1" disabled={bankAddingId === q.id} onClick={() => handleAddFromBank(q)}>
                                {bankAddingId === q.id ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-plus" />}
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => { setQuestionTarget(null); setQuizDetail(null); resetQForm(); }}>Close</button>
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
        description={deleteQuestionTarget ? <><strong>&ldquo;{deleteQuestionTarget.question}&rdquo;</strong> will be removed.</> : undefined}
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
        description={deleteTarget ? <>Delete <strong>{deleteTarget.title}</strong>? This removes the quiz and all questions for {deleteTarget.studentCount} student{deleteTarget.studentCount !== 1 ? "s" : ""}.</> : undefined}
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deleteLoading}
        onConfirm={handleDeleteGroup}
        onCancel={() => { if (!deleteLoading) setDeleteTarget(null); }}
      />
    </div>
  );
};

export default AdminQuizList;
