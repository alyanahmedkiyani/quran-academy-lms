import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import {
  CalendarEvent,
  ClassSchedule,
  CreateSchedulePayload,
  ProposeSessionPayload,
  GetCalendarEventsParams,
  JoinSessionResponse,
  LessonNote,
} from "@/types/classSchedule";

const BASE = `${api_base_url}/class-schedule`;

// ---------------------------------------------------------------------------
// Get unified calendar events for a role+userId+dateRange
// ---------------------------------------------------------------------------
export const getCalendarEvents = async (
  params: GetCalendarEventsParams
): Promise<CalendarEvent[]> => {
  const query = new URLSearchParams({
    userId: params.userId,
    role: params.role,
    start: params.start,
    end: params.end,
    ...(params.timezone ? { timezone: params.timezone } : {}),
  });
  const response = await fetch(`${BASE}/events?${query}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<CalendarEvent[]>(response);
};

// ---------------------------------------------------------------------------
// Admin: create a schedule (recurring or one-off)
// ---------------------------------------------------------------------------
export const createSchedule = async (
  payload: CreateSchedulePayload
): Promise<{ schedule: ClassSchedule; sessionCount: number; message: string }> => {
  const response = await fetch(`${BASE}`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Teacher: propose a session
// ---------------------------------------------------------------------------
export const proposeSession = async (
  payload: ProposeSessionPayload
): Promise<{ schedule: ClassSchedule; message: string }> => {
  const response = await fetch(`${BASE}/propose`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Admin: approve a teacher proposal
// ---------------------------------------------------------------------------
export const approveSchedule = async (
  id: string
): Promise<{ schedule: ClassSchedule; message: string }> => {
  const response = await fetch(`${BASE}/${id}/approve`, {
    method: "PUT",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Admin: cancel entire schedule
// ---------------------------------------------------------------------------
export const cancelSchedule = async (
  id: string,
  reason?: string,
  cancelledByRole?: string
): Promise<{ message: string }> => {
  const response = await fetch(`${BASE}/${id}/cancel`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify({ reason, cancelledByRole }),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Admin/Teacher: cancel a single session
// ---------------------------------------------------------------------------
export const cancelSession = async (
  sessionId: string,
  reason?: string,
  cancelledByRole?: string
): Promise<{ message: string }> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}/cancel`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify({ reason, cancelledByRole }),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Admin: get pending teacher proposals
// ---------------------------------------------------------------------------
export const getPendingApprovals = async (): Promise<ClassSchedule[]> => {
  const response = await fetch(`${BASE}/admin/pending`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<ClassSchedule[]>(response);
};

// ---------------------------------------------------------------------------
// Admin: get all schedules
// ---------------------------------------------------------------------------
export const getAllSchedules = async (): Promise<ClassSchedule[]> => {
  const response = await fetch(`${BASE}/admin/all`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<ClassSchedule[]>(response);
};

// ---------------------------------------------------------------------------
// Calling: get a secure join URL for a session
// Body includes userId and role so backend can authorize and name the caller
// ---------------------------------------------------------------------------
export const joinSession = async (
  sessionId: number,
  userId: string,
  role: string
): Promise<JoinSessionResponse> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}/join`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ userId, role }),
  });
  return handleResponse<JoinSessionResponse>(response);
};

// ---------------------------------------------------------------------------
// Calling: teacher/admin starts the live session
// ---------------------------------------------------------------------------
export const startSession = async (
  sessionId: number,
  userId: string,
  role: string
): Promise<{ message: string; sessionStatus: string }> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}/start`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ userId, role }),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Calling: teacher/admin ends the live session
// Optionally includes Today's Lesson data submitted by the teacher
// ---------------------------------------------------------------------------
export interface LessonPayload {
  lessonTitle?: string;
  lessonDescription?: string;
  lessonDueDate?: string;
}

export const endSession = async (
  sessionId: number,
  userId: string,
  role: string,
  lessonData?: LessonPayload
): Promise<{ message: string; sessionStatus: string }> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}/end`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ userId, role, ...lessonData }),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Teacher/Admin: update lesson note on an ended session
// ---------------------------------------------------------------------------
export const updateLesson = async (
  sessionId: number,
  userId: string,
  role: string,
  lessonData: LessonPayload
): Promise<{ message: string }> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}/lesson`, {
    method: "PATCH",
    headers: withAuthorization(),
    body: JSON.stringify({ userId, role, ...lessonData }),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Lesson history — ended sessions with lesson notes for a role+userId
// ---------------------------------------------------------------------------
export const fetchLessons = async (
  userId: string,
  role: string
): Promise<LessonNote[]> => {
  const query = new URLSearchParams({ userId, role });
  const response = await fetch(`${BASE}/lessons?${query}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ lessons: LessonNote[] }>(response);
  return data.lessons ?? [];
};

// ---------------------------------------------------------------------------
// Admin: edit safe fields of a session (scheduled+idle only)
// ---------------------------------------------------------------------------
export interface UpdateSessionPayload {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  shift?: string | null;
  meetingLink?: string;
  teacherId?: number | null;
  studentIds?: number[];
}

export const updateSession = async (
  sessionId: number,
  payload: UpdateSessionPayload
): Promise<{ message: string; session: unknown }> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Admin: hard-delete a single session
// ---------------------------------------------------------------------------
export const deleteSession = async (sessionId: number): Promise<{ message: string }> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

// ---------------------------------------------------------------------------
// Admin: list ClassSessions for table view (synced with calendar)
// ---------------------------------------------------------------------------
export interface SessionsListParams {
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  /** Comma-separated teacher IDs for multi-select filter */
  teacherIds?: string;
  courseId?: string;
  status?: string;
  shift?: string;
  sessionStatus?: string;
  /** Comma-separated student IDs for multi-select filter */
  studentIds?: string;
  /** Max number of results to return */
  limit?: string;
  /** Sort direction: 'asc' (default) | 'desc' */
  sortDir?: 'asc' | 'desc';
}

export interface SessionListItem {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  sessionStatus: string;
  shift: string | null;
  teacherId: number;
  courseId: number;
  studentId: number | null;
  Teacher: { id: number; firstName: string; lastName: string; imageUrl: string | null; shift: string[] | null } | null;
  Course: { id: number; courseName: string; imageUrl: string | null } | null;
  schedule: { id: number; recurrenceType: string; daysOfWeek: number[] | null; title: string; status: string } | null;
  students: { id: number; firstName: string; lastName: string; profileImg: string | null }[];
}

export const getSessionsList = async (
  params: SessionsListParams = {}
): Promise<{ sessions: SessionListItem[] }> => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  const response = await fetch(`${BASE}/sessions-list?${query}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<{ sessions: SessionListItem[] }>(response);
};

// ---------------------------------------------------------------------------
// Admin: teacher availability for a given date + time window
// ---------------------------------------------------------------------------
export interface TeacherAvailabilityParams {
  date: string;     // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface TeacherAvailabilityItem {
  id: number;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  shift: string[] | null;
  isBusy: boolean;
  sessions: {
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    sessionStatus: string;
    Course: { id: number; courseName: string } | null;
  }[];
}

export interface TeacherAvailabilityResponse {
  teachers: TeacherAvailabilityItem[];
  queryDate: string;
  startTime: string;
  endTime: string;
  totalTeachers: number;
  freeCount: number;
  busyCount: number;
}

export const getTeacherAvailability = async (
  params: TeacherAvailabilityParams
): Promise<TeacherAvailabilityResponse> => {
  const query = new URLSearchParams(params as unknown as Record<string, string>);
  const response = await fetch(`${BASE}/teacher-availability?${query}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<TeacherAvailabilityResponse>(response);
};

export interface SessionWithTranscript {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  sessionStatus: string;
  shift: string | null;
  transcriptText: string;
  Teacher: { id: number; firstName: string; lastName: string } | null;
  Course: { id: number; courseName: string } | null;
}

// ---------------------------------------------------------------------------
// Admin: check scheduling conflicts before creating a schedule
// ---------------------------------------------------------------------------
export interface ConflictSession {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  sessionStatus: string;
  Course: { id: number; courseName: string } | null;
}

export interface StudentConflict {
  studentId: number;
  studentName: string;
  session: {
    id: number;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    course: { id: number; courseName: string } | null;
  };
}

export interface ConflictCheckResult {
  teacherConflicts: ConflictSession[];
  studentConflicts: StudentConflict[];
  hasTeacherConflict: boolean;
  hasStudentConflict: boolean;
}

export const checkScheduleConflicts = async (params: {
  teacherId: number;
  courseId: number;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<ConflictCheckResult> => {
  const query = new URLSearchParams({
    teacherId: String(params.teacherId),
    courseId: String(params.courseId),
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
  });
  const response = await fetch(`${BASE}/check-conflicts?${query}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<ConflictCheckResult>(response);
};

export const fetchSessionsWithTranscripts = async (params?: {
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  courseId?: string;
}): Promise<SessionWithTranscript[]> => {
  const query = new URLSearchParams({ hasTranscript: 'true', ...(params as Record<string, string>) });
  const response = await fetch(`${BASE}/sessions-list?${query}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ sessions: SessionWithTranscript[] }>(response);
  return data.sessions ?? [];
};

export interface TranscriptResponse {
  sessionId: number;
  title: string;
  transcriptText: string | null;
}

export const getSessionTranscript = async (sessionId: number): Promise<TranscriptResponse> => {
  const response = await fetch(`${BASE}/sessions/${sessionId}/transcript`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<TranscriptResponse>(response);
};
