import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import {
  AdminStudentAttendanceFilter,
  AdminStudentAttendanceResponse,
  AdminTeacherAttendanceFilter,
  AdminTeacherAttendanceResponse,
  AttendanceSummary,
  BulkMarkPayload,
  SessionAttendanceSheet,
  StudentAttendance,
  TeacherAttendanceRecord,
  TeacherSessionItem,
} from "@/types/attendance";

const BASE = `${api_base_url}/attendance`;
const TEACHER_BASE = `${api_base_url}/teacher-attendance`;

// ─── Student Attendance ───────────────────────────────────────────────────────

export const bulkMarkAttendance = async (
  payload: BulkMarkPayload
): Promise<{ message: string; count: number }> => {
  const response = await fetch(`${BASE}/bulk-mark`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const getSessionAttendanceSheet = async (
  sessionId: number
): Promise<SessionAttendanceSheet> => {
  const response = await fetch(`${BASE}/session/${sessionId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const getTeacherSessions = async (
  teacherId: number
): Promise<{ sessions: TeacherSessionItem[] }> => {
  const response = await fetch(`${BASE}/teacher/${teacherId}/sessions`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const getStudentSummary = async (
  studentId: number
): Promise<{ summaries: AttendanceSummary[] }> => {
  const response = await fetch(`${BASE}/student/${studentId}/summary`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const getStudentHistory = async (
  studentId: number,
  filters?: { startDate?: string; endDate?: string; courseDetailsId?: number }
): Promise<{ attendance: StudentAttendance[] }> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  if (filters?.courseDetailsId) params.set("courseDetailsId", String(filters.courseDetailsId));

  const url = `${BASE}/student/${studentId}${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const getAdminStudentAttendance = async (
  filters: AdminStudentAttendanceFilter
): Promise<AdminStudentAttendanceResponse> => {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.teacherId) params.set("teacherId", String(filters.teacherId));
  if (filters.courseId) params.set("courseId", String(filters.courseId));
  if (filters.studentId) params.set("studentId", String(filters.studentId));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetch(`${BASE}/admin/students?${params}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

// ─── Teacher Attendance ───────────────────────────────────────────────────────

export const teacherCheckIn = async (
  teacherId: number,
  notes?: string
): Promise<{ message: string; record: TeacherAttendanceRecord }> => {
  const response = await fetch(`${TEACHER_BASE}/check-in`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ teacherId, notes }),
  });
  return handleResponse(response);
};

export const teacherCheckOut = async (
  teacherId: number
): Promise<{ message: string; record: TeacherAttendanceRecord }> => {
  const response = await fetch(`${TEACHER_BASE}/check-out`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ teacherId }),
  });
  return handleResponse(response);
};

export const getTeacherToday = async (
  teacherId: number
): Promise<{ record: TeacherAttendanceRecord | null }> => {
  const response = await fetch(`${TEACHER_BASE}/today/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const getTeacherHistory = async (
  teacherId: number,
  filters?: { startDate?: string; endDate?: string; page?: number; limit?: number }
): Promise<{ records: TeacherAttendanceRecord[]; total: number; page: number }> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  const url = `${TEACHER_BASE}/history/${teacherId}${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const getAdminTeacherAttendance = async (
  filters: AdminTeacherAttendanceFilter
): Promise<AdminTeacherAttendanceResponse> => {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.teacherId) params.set("teacherId", String(filters.teacherId));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetch(`${TEACHER_BASE}/admin/overview?${params}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};
