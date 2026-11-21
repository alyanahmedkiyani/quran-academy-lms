import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import {
  SubmitFeedbackPayload,
  SessionFeedbackResponse,
  TeacherFeedbackResponse,
  AdminFeedbackSummaryResponse,
} from "@/types/feedback";

const BASE = `${api_base_url}/session-feedback`;

// Check whether a student already submitted feedback for a session
export const checkFeedbackSubmitted = async (
  sessionId: number,
  studentId: number
): Promise<{ submitted: boolean }> => {
  const res = await fetch(
    `${BASE}/check/${sessionId}?studentId=${studentId}`,
    { headers: withAuthorization() }
  );
  return handleResponse(res);
};

// Student submits feedback for a session
export const submitFeedback = async (
  sessionId: number,
  payload: SubmitFeedbackPayload
): Promise<{ message: string }> => {
  const res = await fetch(`${BASE}/session/${sessionId}`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

// Get feedback for a specific session (admin: attributed, teacher: anonymous)
export const getSessionFeedback = async (
  sessionId: number
): Promise<SessionFeedbackResponse> => {
  const res = await fetch(`${BASE}/session/${sessionId}`, {
    headers: withAuthorization(),
  });
  return handleResponse(res);
};

// Teacher views their own session feedback (anonymous aggregated)
// Admin gets attributed version
export const getTeacherFeedback = async (
  teacherId: number
): Promise<TeacherFeedbackResponse> => {
  const res = await fetch(`${BASE}/teacher/${teacherId}`, {
    headers: withAuthorization(),
  });
  return handleResponse(res);
};

// Admin: overview of all session feedback
export const getAdminFeedbackSummary =
  async (): Promise<AdminFeedbackSummaryResponse> => {
    const res = await fetch(`${BASE}/admin/summary`, {
      headers: withAuthorization(),
    });
    return handleResponse(res);
  };

export interface StudentFeedbackItem {
  id: number; sessionId: number; teachingQuality: number; contentClarity: number;
  sessionPace: number; engagement: number; overallRating: number; comment?: string;
  createdAt: string;
  ClassSession?: { id: number; title: string; date: string; startTime: string } | null;
}

export interface StudentFeedbackSummary {
  count: number; teachingQuality: number; contentClarity: number;
  sessionPace: number; engagement: number; overallRating: number;
}

// Admin: all feedback submitted by a specific student
export const getStudentFeedbacks = async (
  studentId: number | string
): Promise<{ feedbacks: StudentFeedbackItem[]; summary: StudentFeedbackSummary | null }> => {
  const res = await fetch(`${BASE}/student/${studentId}`, { headers: withAuthorization() });
  return handleResponse(res);
};
