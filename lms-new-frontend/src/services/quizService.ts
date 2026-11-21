import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { Quiz, QuizAttempt, QuizWithQuestions, QuizQuestion, QuestionType } from "@/types/quiz";

export const fetchStudentQuizzes = async (studentId: string): Promise<Quiz[]> => {
  const response = await fetch(`${api_base_url}/quiz/student/${studentId}/quizzes`, {
    method: "GET",
    headers: withAuthorization(),
  });
  // Backend returns 404 with message if no quizzes — treat as empty list
  if (response.status === 404) return [];
  return handleResponse<Quiz[]>(response);
};

export const fetchTeacherQuizzes = async (teacherId: string): Promise<Quiz[]> => {
  const response = await fetch(`${api_base_url}/quiz/quizzesByTeacher/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  if (response.status === 404) return [];
  return handleResponse<Quiz[]>(response);
};

export const checkQuizAttempt = async (
  studentId: string,
  quizId: number
): Promise<{ hasAttempted: boolean; attempt: QuizAttempt | null }> => {
  const response = await fetch(
    `${api_base_url}/quiz/student/${studentId}/quiz-attempts/${quizId}`,
    { method: "GET", headers: withAuthorization() }
  );
  return handleResponse(response);
};

export const deleteQuiz = async (quizId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/quiz/quizzes/${quizId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const deleteQuizGroup = async (quizId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/quiz/quizGroup/${quizId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const createQuiz = async (payload: {
  courseId: string;
  teacherId: string;
  title: string;
  instructions?: string;
  duration: number;
  passingScore: number;
  studentIds?: number[];
}): Promise<Quiz> => {
  const response = await fetch(`${api_base_url}/quiz/quizzes`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Quiz>(response);
};

export const fetchQuizWithQuestions = async (quizId: number): Promise<QuizWithQuestions> => {
  const response = await fetch(`${api_base_url}/quiz/quizzes/${quizId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<QuizWithQuestions>(response);
};

export const addQuizQuestion = async (
  quizId: number,
  payload: {
    type: QuestionType;
    question: string;
    options?: string[] | null;
    correctAnswer: string;
  }
): Promise<QuizQuestion> => {
  const response = await fetch(`${api_base_url}/quiz/quizzes/${quizId}/questions`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<QuizQuestion>(response);
};

export const deleteQuestion = async (questionId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/quiz/quizzes/questions/${questionId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const updateQuiz = async (
  quizId: number,
  payload: {
    title?: string;
    instructions?: string;
    duration?: number;
    passingScore?: number;
  }
): Promise<void> => {
  const response = await fetch(`${api_base_url}/quiz/update/${quizId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const approveQuiz = async (quizId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/quiz/approve/${quizId}`, {
    method: "POST",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const rejectQuiz = async (quizId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/quiz/reject/${quizId}`, {
    method: "POST",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const fetchAllQuizzesAdmin = async (): Promise<{ quizzes: import("@/types/quiz").QuizGroup[] }> => {
  const response = await fetch(`${api_base_url}/quiz/admin/all`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const startQuizAttempt = async (
  quizId: number,
  studentId: number
): Promise<QuizAttempt> => {
  const response = await fetch(`${api_base_url}/quiz/quiz-attempts`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ quizId, studentId }),
  });
  // Backend returns 400 if already attempted — surface the existing attempt data
  const payload = await response.json().catch(() => ({}));
  if (response.status === 400 && payload?.data) {
    return payload.data as QuizAttempt;
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Failed to start quiz");
  }
  return payload as QuizAttempt;
};

export const submitQuizAttempt = async (
  attemptId: number,
  answers: string[]
): Promise<QuizAttempt> => {
  const response = await fetch(`${api_base_url}/quiz/quiz-attempts/${attemptId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify({ answers, endTime: new Date().toISOString() }),
  });
  return handleResponse<QuizAttempt>(response);
};

export const fetchEnrolledStudents = async (
  teacherId: string,
  courseId: string
): Promise<{ students: import("@/types/quiz").EnrolledStudent[] }> => {
  const q = new URLSearchParams({ teacherId, courseId });
  const response = await fetch(`${api_base_url}/quiz/enrolled-students?${q}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const fetchAdminQuizResults = async (): Promise<{ results: import("@/types/quiz").QuizResult[] }> => {
  const response = await fetch(`${api_base_url}/quiz/results/admin`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const fetchTeacherQuizResults = async (teacherId: string): Promise<{ results: import("@/types/quiz").QuizResult[] }> => {
  const response = await fetch(`${api_base_url}/quiz/results/teacher/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const fetchStudentQuizResults = async (studentId: string): Promise<{ results: import("@/types/quiz").QuizResult[] }> => {
  const response = await fetch(`${api_base_url}/quiz/results/student/${studentId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

// Suppress unused import warnings — these types are re-exported for convenience
export type { QuizWithQuestions, QuizQuestion, QuestionType };
