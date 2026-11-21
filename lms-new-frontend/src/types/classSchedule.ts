// -----------------------------------------------------------------------
// Enum types
// -----------------------------------------------------------------------
export type EventType = 'class' | 'quiz' | 'assignment';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'makeup';
/** Live-call lifecycle status — separate from attendance status */
export type LiveSessionStatus = 'idle' | 'live' | 'ended';
export type ScheduleStatus = 'pending' | 'active' | 'cancelled';
export type RecurrenceType = 'one-time' | 'weekly' | 'biweekly';
export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';
export type Shift = 'Morning' | 'Afternoon' | 'Evening';

// -----------------------------------------------------------------------
// FullCalendar-compatible event shape returned from /api/class-schedule/events
// -----------------------------------------------------------------------
export interface CalendarEventProps {
  type: EventType;
  status: SessionStatus | ScheduleStatus | string;
  /** Live-call lifecycle: idle | live | ended */
  sessionStatus?: LiveSessionStatus;
  meetingLink?: string;
  /** Unique calling-app room identifier (e.g. 'lms-42') */
  roomId?: string;
  courseId?: number | null;
  courseName?: string;
  teacherName?: string;
  teacherImageUrl?: string;
  /** Convenience alias — set only when exactly 1 student assigned */
  studentId?: number | null;
  studentName?: string;
  /** All student IDs assigned via junction table (empty = group session) */
  studentIds?: number[];
  /** Display names of assigned students */
  studentNames?: string[];
  sessionId?: number;
  scheduleId?: number;
  cancellationReason?: string;
  shift?: Shift | null;
  quizId?: number;
  assignmentId?: number;
  dueDate?: string;
  duration?: number;
  passingScore?: number;
  maxScore?: number;
  // Today's Lesson fields — filled by teacher when ending a session
  lessonTitle?: string | null;
  lessonDescription?: string | null;
  lessonDueDate?: string | null;
}

// -----------------------------------------------------------------------
// Calling integration
// -----------------------------------------------------------------------
export interface JoinSessionResponse {
  joinUrl: string;
  roomId: string;
}

export interface LiveSessionNotificationPayload {
  sessionId: number;
  title: string;
  teacherName: string;
  courseName: string;
  courseId?: number | null;
  roomId: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  borderColor: string;
  allDay?: boolean;
  classNames?: string[];
  extendedProps: CalendarEventProps;
}

// -----------------------------------------------------------------------
// ClassSchedule (recurring template)
// -----------------------------------------------------------------------
export interface ClassSchedule {
  id: number;
  title: string;
  description?: string;
  recurrenceType: RecurrenceType;
  daysOfWeek?: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  meetingLink?: string;
  status: ScheduleStatus;
  createdBy: 'admin' | 'teacher';
  courseId: number;
  teacherId: number;
  studentId?: number;
  courseDetailsId?: number;
  shift?: Shift | null;
  Course?: { id: number; courseName: string };
  Teacher?: { id: number; firstName: string; lastName: string; shift?: Shift | null };
  Student?: { id: number; firstName: string; lastName: string };
  createdAt?: string;
  updatedAt?: string;
}

// -----------------------------------------------------------------------
// Payloads
// -----------------------------------------------------------------------
export interface CreateSchedulePayload {
  title: string;
  description?: string;
  recurrenceType: RecurrenceType;
  daysOfWeek?: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  meetingLink?: string;
  courseId: number;
  teacherId: number;
  studentIds?: number[];
  courseDetailsId?: number;
  shift?: Shift | null;
}

export interface ProposeSessionPayload {
  title: string;
  startTime: string;
  endTime: string;
  startDate: string;
  meetingLink?: string;
  courseId: number;
  teacherId: number;
  studentIds?: number[];
  courseDetailsId?: number;
  shift?: Shift | null;
}

export interface GetCalendarEventsParams {
  userId: string;
  role: UserRole;
  start: string;
  end: string;
  timezone?: string;
}

// -----------------------------------------------------------------------
// Lesson history item — returned from GET /api/class-schedule/lessons
// -----------------------------------------------------------------------
export interface LessonNote {
  sessionId: number;
  sessionTitle: string;
  sessionDate: string;
  startTime: string;
  lessonTitle: string;
  lessonDescription: string | null;
  lessonDueDate: string | null;
  courseName: string | null;
  courseId: number | null;
  teacherName: string | null;
  teacherId: number | null;
}
